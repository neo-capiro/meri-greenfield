/** Stage 3 bindings on THROWAWAY material: render-material.fixture.mjs renders two application roles from a fresh pki.py PKI (synthetic
 * passwords and Core credential), stage3-bindings builds every binding from the real foundation/private-edge outputs plus fake
 * secret VersionIds and scan hashes in their real formats, and the app template synthesizes through their own validators.
 * Needs MERI_REVIEW_SOURCE_ROOT=<worktree root> and Python 3 with `cryptography`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRenderFixture} from './render-material.fixture.mjs';
import {nativeProcessingInputs} from './native-processing-material.fixture.mjs';
import {PATHS,ROLES,renderMaterial,writeRendered} from './render-material.mjs';
import {STAGE3_FAMILIES,STAGE3_EXISTING,STAGE3_DEPLOY_ORDER,nextRevisions,stage3RenderInput,buildStage3Bindings,synthesizeStage3,applyLiveServiceProfile,liveControlTargetGroup,nativeWorkerTaskRole} from './stage3-bindings.mjs';
import {parseLatestTsv,coreValues,parseVersionsTsv,outputsObject,deployPlan,uploadPlan,secretLabelReadback,verifyOutputs,main} from './stage3-deploy.mjs';
import {productWorkerTrustsPinnedServerCa} from '../../../apps/runtime/cli.mjs';
import {createActionSessionOwner} from '../../../apps/control/action-host/session/owner.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';

const here=fileURLToPath(new URL('.',import.meta.url));
const load=async name=>JSON.parse(await readFile(join(here,name),'utf8'));
const fixture=createRenderFixture();
test.after(()=>fixture.cleanup());
const fakeVersion=n=>`${String(n).repeat(8)}-aaaa-4bbb-8ccc-${String(n).repeat(12)}`;
const SECRET_VERSIONS=Object.fromEntries(ROLES.map((role,i)=>[role,fakeVersion(i+1)]));
/** A before-upload label readback per material secret: AWSCURRENT, AWSPREVIOUS and one earlier release label, plus extras. */
const labelReadback=(deployment,extra={})=>Object.fromEntries(['control/material','worker/material'].map(key=>deployment.secrets[key]).map(arn=>[arn,
 [{VersionId:'v-current',VersionStages:['AWSCURRENT']},{VersionId:'v-previous',VersionStages:['AWSPREVIOUS']},{VersionId:'v-e',VersionStages:['FIRST_CHAT_20261020E']},...(extra[arn]??[])]]));
const SCANS={nodeRuntime:'d'.repeat(64)};
/** The live app stack's control service as `get-template --stage Original` returns it: public 8080 and private 8082 groups. */
const PUBLIC_TG='arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-preview-control-8080/03297203fa59801c';
const LIVE_APP={Resources:{controlService:{Type:'AWS::ECS::Service',Properties:{LoadBalancers:[{ContainerName:'control',ContainerPort:8080,TargetGroupArn:PUBLIC_TG},
 {ContainerName:'control',ContainerPort:8082,TargetGroupArn:'arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-preview-control-8082/1732509ee5fbf759'}]}}}};
const LATEST=[...Object.values(STAGE3_FAMILIES).flatMap(f=>[`${f}\tNone`,`${f}\tNone`])].join('\n').replace(
 'meri-product-preview-temporal-worker\tNone','meri-product-preview-temporal-worker\tarn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-temporal-worker:3')+'\n';

let state;
async function setup(){
 if(state)return state;
 const inputs=await fixture.setup(),foundationOutputs=fixture.foundationOutputs;
 const revisions=nextRevisions(parseLatestTsv(LATEST));
 const stage3=stage3RenderInput({deployment:inputs.deployment,foundationOutputs,revisions});
 const rendered=await fixture.render(i=>{i.stage3=structuredClone(stage3);});
 const privateEdgeOutputs={ControlPrivateOrigin:inputs.deployment.privateEdge.controlPrivateOrigin,
  ControlPrivateTargetGroupArn:inputs.deployment.privateEdge.controlPrivateTargetGroupArn,PrivateAlbSecurityGroupId:inputs.deployment.privateEdge.privateAlbSecurityGroupId};
 const args={deployment:inputs.deployment,foundationOutputs,privateEdgeOutputs,renderSummary:rendered.summary,
  renderedExpected:Object.fromEntries(ROLES.map(role=>[role,rendered.roles[role].expected])),secretVersions:SECRET_VERSIONS,imageScans:SCANS,liveAppTemplate:LIVE_APP};
 const bindings=buildStage3Bindings(structuredClone(args));
 state={inputs,foundationOutputs,revisions,stage3,rendered,args,bindings,synth:synthesizeStage3(bindings)};
 return state;
}
const resources=(template,type)=>Object.values(template.Resources).filter(r=>r.Type===type).map(r=>r.Properties);
const env=(container,name)=>(container.Environment??[]).find(e=>e.Name===name)?.Value;
const sameSet=(a,b)=>assert.deepEqual([...a].sort(),[...b].sort());

test('revisions: new families start at 1, an existing family continues after its highest ACTIVE/INACTIVE revision',async()=>{
 const {revisions,stage3}=await setup();
 assert.deepEqual(revisions,{control:1,'temporal-worker':4});
 assert.equal(stage3.taskDefinitions['temporal-worker'],'arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-temporal-worker:4');
 assert.deepEqual(Object.keys(stage3.services),['control','temporal-worker']);
 assert.throws(()=>nextRevisions({control:['arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-control-x:9']}),/STAGE3_BINDING_REFUSED/u);
 assert.throws(()=>parseLatestTsv('meri-product-preview-control\tNone\n'),/STAGE3_BINDING_REFUSED/u);
});

test('the application binding passes its renderer with control and worker',async ctx=>{
 const {synth,bindings,foundationOutputs:f,inputs}=await setup(),t=synth.templates;
 ctx.diagnostic('template bytes '+JSON.stringify(synth.sizes));
 for(const [key,size] of Object.entries(synth.sizes))assert.ok(size.bytes>0,key);
 // (a) manifest: per-role execution roles and log groups, private 8082 target group only.
 const tasks=resources(t.app,'AWS::ECS::TaskDefinition'),services=resources(t.app,'AWS::ECS::Service');
 const task=family=>tasks.find(x=>x.Family===family);
 for(const [family,role,group] of [['meri-product-preview-control','ControlExecutionRoleArn','ControlLogGroupName'],
  ['meri-product-preview-temporal-worker','WorkerExecutionRoleArn','WorkerLogGroupName']]){
  assert.equal(task(family).ExecutionRoleArn,f[role]);
  for(const c of task(family).ContainerDefinitions)assert.equal(c.LogConfiguration.Options['awslogs-group'],f[group]);
 }
 assert.equal(tasks.length,2);assert.equal(task('meri-product-preview-runner'),undefined);
 assert.equal(task('meri-product-preview-control').TaskRoleArn,f.ControlTaskRoleArn);
 for(const task of tasks)assert.equal(task.RuntimePlatform.CpuArchitecture,'ARM64');
 const control=services.find(s=>s.ServiceName==='meri-product-preview-control');
 assert.deepEqual(control.LoadBalancers,[{ContainerName:'control',ContainerPort:8080,TargetGroupArn:f.ControlTargetGroupArn},
  {ContainerName:'control',ContainerPort:8082,TargetGroupArn:inputs.deployment.privateEdge.controlPrivateTargetGroupArn}],'the live public group and the private one');
 sameSet(control.NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,[f.ControlSecurityGroupId,f.DbClientSecurityGroupId]);
 sameSet(services.find(s=>s.ServiceName==='meri-product-preview-temporal-worker').NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,[f.WorkerSecurityGroupId]);
 assert.equal(Object.keys(t.app.Outputs).some(key=>key.startsWith('Runner')),false);
 assert.deepEqual(bindings.stacks,{app:'meri-first-chat-app'});
 assert.deepEqual(Object.keys(t),['app']);
});

test('rendered configs and the synthesized task definitions agree: native TLS and shared worker/control CA trust',async()=>{
 const {synth:{templates:t},rendered,stage3,revisions}=await setup();
 const config=role=>JSON.parse(rendered.roles[role].configBytes.toString('utf8'));
 const tasks=resources(t.app,'AWS::ECS::TaskDefinition');
 const services=[...resources(t.app,'AWS::ECS::Service')];
 const byFamily=family=>tasks.find(x=>x.Family===family),main=task=>task.ContainerDefinitions.at(-1);
 const serviceOf=arn=>services.find(s=>arn.endsWith('/'+s.ServiceName));
 // Every rendered task-definition ARN names a family these templates register, at the predicted revision.
 for(const [role,arn] of Object.entries(stage3.taskDefinitions)){const [family,revision]=arn.split('/')[1].split(':');assert.ok(byFamily(family),family);assert.equal(Number(revision),revisions[role]);}
 for(const role of ROLES){
  const c=config(role);assert.deepEqual(Object.keys(c.temporal).sort(),['address','namespace','taskQueue','tls']);
  assert.equal(c.native.serverCaFile,PATHS.serverCa);
  assert.equal(c.native.serverCaSha256,rendered.summary.pinsDer['server-ca']);
 }
 assert.equal(Object.hasOwn(config('control'),'nativeCandidate'),false);assert.equal(Object.hasOwn(stage3.taskDefinitions,'runner'),false);
 // Worker NODE_EXTRA_CA_CERTS is rendered by the manifest (native TLS material) and satisfies the cli.mjs product gate.
 const worker=main(byFamily('meri-product-preview-temporal-worker'));
 assert.equal(env(worker,'NODE_EXTRA_CA_CERTS'),PATHS.serverCa);assert.equal(env(worker,'NODE_EXTRA_CA_CERTS'),rendered.summary.worker.NODE_EXTRA_CA_CERTS);
 assert.equal(productWorkerTrustsPinnedServerCa(config('temporal-worker'),{NODE_EXTRA_CA_CERTS:env(worker,'NODE_EXTRA_CA_CERTS')}),true);
 const control=byFamily('meri-product-preview-control'),controlMain=main(control),controlInit=control.ContainerDefinitions[0];
 assert.equal(env(controlMain,'NODE_EXTRA_CA_CERTS'),rendered.summary.control.NODE_EXTRA_CA_CERTS);
 assert.deepEqual(controlInit.Command,['write','--control-node-ca']);
 assert.deepEqual(controlInit.MountPoints.find(m=>m.SourceVolume==='tmp'),{SourceVolume:'tmp',ContainerPath:'/tmp',ReadOnly:false});
 // Material envelopes and config pins equal the render; no compute-specific task material remains.
 assert.equal(Object.hasOwn(rendered.summary.wiring,'runner'),false);
 for(const [family,role] of [['meri-product-preview-control','control'],['meri-product-preview-temporal-worker','temporal-worker']]){
  const init=byFamily(family).ContainerDefinitions[0];
  assert.equal(init.Name,'material-init');assert.deepEqual(JSON.parse(env(init,'MERI_STATIC_MATERIAL_EXPECTED')),rendered.roles[role].expected,role);
  assert.match(init.Secrets[0].ValueFrom,new RegExp(`:::${SECRET_VERSIONS[role]}$`,'u'));
 }
});

test('retained private endpoint facts are independent of retired runner infrastructure',async()=>{
 const binding=await load('foundation-binding.json'),temporal=await load('temporal-binding.json');
 assert.equal(STAGE3_EXISTING.endpointSecurityGroupId,binding.endpointSecurityGroupId);
 assert.equal(STAGE3_EXISTING.endpointSecurityGroupId,temporal.network.interfaceEndpoints.secretsManager.securityGroupId);
 const {bindings}=await setup();
 for(const key of ['runnerPoststart','runnerTaskRoleArn','runnerSha256'])assert.equal(Object.hasOwn(bindings.app,key),false);
 for(const key of ['sizing','executionRoleArns','logGroupNames'])assert.equal(Object.hasOwn(bindings.app[key],'runner'),false);
});

test('fail closed: foundation, private edge, render mismatch, secret version, scans and retained roles',async()=>{
 const {args}=await setup();
 const refused=change=>{const x=structuredClone(args);change(x);assert.throws(()=>buildStage3Bindings(x),/STAGE3_BINDING_REFUSED/u);};
 refused(x=>{x.foundationOutputs.ControlSecurityGroupId='sg-0123456789abcdef0';});
 refused(x=>{x.renderSummary.agentcore.runtimeVersion='999';});
 refused(x=>{x.privateEdgeOutputs.ControlPrivateTargetGroupArn=x.foundationOutputs.ControlTargetGroupArn;});
 refused(x=>{x.privateEdgeOutputs.Extra='x';});
 refused(x=>{x.renderedExpected.control=x.renderedExpected['temporal-worker'];});
 refused(x=>{x.renderedExpected['temporal-worker'].materialContractSha256='0'.repeat(64);});
 refused(x=>{x.secretVersions['temporal-worker']='AWSCURRENT';});
 refused(x=>{delete x.secretVersions.control;});
 refused(x=>{x.imageScans.nodeRuntime='PENDING';});
 refused(x=>{x.renderSummary.roles['temporal-worker'].taskDefinitionArn='arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-worker-wrong:1';});
 refused(x=>{x.renderSummary.agentcore.runtimeArn='arn:aws:bedrock-agentcore:us-east-1:967807252336:runtime/meri_preview-other';});
 refused(x=>{x.deployment.images.nodeRuntime=x.deployment.images.nodeRuntime.replace(/@sha256:[a-f0-9]{64}$/u,'@sha256:'+'e'.repeat(64));});
 // The renderer still refuses what the builder cannot see: a swapped execution role fails the manifest.
 const {bindings}=await setup(),x=structuredClone(bindings);x.app.executionRoleArns.temporalWorker=x.app.controlTaskRoleArn;
 assert.throws(()=>synthesizeStage3(x),/PRODUCT_PREVIEW_BINDING_REFUSED/u);
});

test('deploy plumbing: origin-only Core values, versions, outputs and verification',async()=>{
 const {bindings,synth}=await setup(),now=Date.now();
 const core=coreValues({frontendOrigin:'https://frontend.synthetic.invalid'});
 assert.deepEqual(core,{coreOrigin:'https://first-chat-preview.app-dev.capiro.ai',frontendOrigin:'https://frontend.synthetic.invalid'});
 for(const key of ['tenantId','actorId','clientId','identityCredentialPath','membership'])assert.throws(()=>coreValues({frontendOrigin:'https://f.invalid',[key]:'retired'}),/STAGE3_BINDING_REFUSED/);
 assert.throws(()=>coreValues({frontendOrigin:'http://f.invalid'}),/RENDER_INPUT_REFUSED/);
 assert.deepEqual(parseVersionsTsv(ROLES.map(r=>`${r}\t${SECRET_VERSIONS[r]}`).join('\n')),SECRET_VERSIONS);
 assert.throws(()=>parseVersionsTsv('control\ta\ncontrol\tb'),/STAGE3_BINDING_REFUSED/u);
 const plan=deployPlan(synth.sizes,'/w/b');
 assert.deepEqual(Object.keys(plan),['app'],'one app update after independent Temporal and AgentCore qualification');
 for(const key of STAGE3_DEPLOY_ORDER)assert.deepEqual(plan[key].wait.slice(0,4),['aws','cloudformation','wait','stack-update-complete']);
 assert.equal(plan.app.command.includes('--no-execute-changeset'),true);
 for(const key of ['app'])assert.equal(plan[key].command.includes('--s3-bucket'),synth.sizes[key].viaS3);
 // AgentCore connectivity is qualified by an actual invocation, not a separate Fargate probe.
 const e=bindings.expectedTaskDefinitions;
 const outputs={app:outputsObject([{OutputKey:'ControlTaskDefinitionArn',OutputValue:e.control},{OutputKey:'TemporalWorkerTaskDefinitionArn',OutputValue:e['temporal-worker']}])};
 assert.equal(verifyOutputs({expectedTaskDefinitions:e,...outputs}).length,2);
 assert.throws(()=>verifyOutputs({expectedTaskDefinitions:e,...outputs,app:{...outputs.app,TemporalWorkerTaskDefinitionArn:e['temporal-worker'].replace(/:4$/u,':5')}}),/re-render/u);
});

test('CLI writes stage3.json, bindings, templates and the deploy plan outside the repository',async()=>{
 const {inputs,rendered,args}=await setup(),work=await mkdtemp(join(tmpdir(),'meri-stage3-cli-'));
 try{
  const quiet=async argv=>{const lines=[];const code=await main(argv,{out:t=>lines.push(t),err:t=>lines.push(t)});return {code,text:lines.join('')};};
  await writeFile(join(work,'deployment.json'),JSON.stringify(inputs.deployment));await writeFile(join(work,'latest.tsv'),LATEST);
  const foundation=join(work,'foundation.json');await writeFile(foundation,JSON.stringify((await setup()).foundationOutputs));
  let r=await quiet(['stage3-input','--deployment-inputs',join(work,'deployment.json'),'--foundation-outputs',foundation,'--latest',join(work,'latest.tsv'),'--out',join(work,'stage3.json')]);
  assert.equal(r.code,0,r.text);assert.deepEqual(JSON.parse(await readFile(join(work,'stage3.json'),'utf8')),(await setup()).stage3);
  const out=await writeRendered(join(work,'rendered'),rendered);
  await writeFile(join(work,'versions.tsv'),ROLES.map(role=>`${role}\t${SECRET_VERSIONS[role]}`).join('\n')+'\n');
  await writeFile(join(work,'scans.json'),JSON.stringify(SCANS));await writeFile(join(work,'app.live.json'),JSON.stringify(LIVE_APP));
  await writeFile(join(work,'edge.json'),JSON.stringify(Object.entries(args.privateEdgeOutputs).map(([OutputKey,OutputValue])=>({OutputKey,OutputValue}))));
  r=await quiet(['bindings','--deployment-inputs',join(work,'deployment.json'),'--foundation-outputs',foundation,'--private-edge-outputs',join(work,'edge.json'),
   '--rendered',out,'--secret-versions',join(work,'versions.tsv'),'--image-scans',join(work,'scans.json'),'--live-app-template',join(work,'app.live.json'),'--out',join(work,'bindings')]);
  assert.equal(r.code,0,r.text);assert.match(r.text,/STAGE3_BINDINGS_WRITTEN/u);
  for(const key of ['app'])assert.deepEqual(JSON.parse(await readFile(join(work,'bindings',`${key}.binding.json`),'utf8')),(await setup()).bindings[key]);
  // The output carries no secret: no bundle bytes, password or identity credential.
  const text=r.text+await readFile(join(work,'bindings','app.template.json'),'utf8');
  for(const secret of ['synthetic-control','synthetic-core-identity-bearer-not-real','PRIVATE KEY'])assert.equal(text.includes(secret),false,secret);
  r=await quiet(['bindings','--deployment-inputs',join(work,'deployment.json'),'--foundation-outputs',foundation,'--private-edge-outputs',join(work,'edge.json'),
   '--rendered',out,'--secret-versions',join(work,'versions.tsv'),'--image-scans',join(work,'scans.json'),'--live-app-template',join(work,'app.live.json'),'--out',join(here,'should-not-exist')]);
  assert.equal(r.code,2);assert.match(r.text,/outside the repository/u);
  await mkdir(join(work,'labels'));
  for(const [i,[ARN,Versions]] of Object.entries(labelReadback(args.deployment)).entries())await writeFile(join(work,'labels',`${i}.json`),JSON.stringify({ARN,Name:`secret-${i}`,Versions}));
  r=await quiet(['upload-plan','--deployment-inputs',join(work,'deployment.json'),'--rendered',out,'--label','FIRST_CHAT_20261020E','--secret-labels',join(work,'labels'),'--out',join(work,'upload-reused.json')]);
  assert.equal(r.code,2);assert.match(r.text,/FIRST_CHAT_20261020E is already on a version/u);
  r=await quiet(['upload-plan','--deployment-inputs',join(work,'deployment.json'),'--rendered',out,'--label','FIRST_CHAT_20261021A','--secret-labels',join(work,'labels'),'--out',join(work,'upload-plan.json')]);
  assert.equal(r.code,0,r.text);
  const upload=await readFile(join(work,'upload-plan.json'),'utf8');assert.equal(JSON.parse(upload).roles.length,ROLES.length);
  for(const secret of ['synthetic-control','synthetic-core-identity-bearer-not-real','PRIVATE KEY'])assert.equal(upload.includes(secret),false,secret);
 }finally{await rm(work,{recursive:true,force:true});}
});

/** Scheduler arithmetic from the documented `update-service` contract: `maximumPercent` is an upper bound on
 * RUNNING/PENDING tasks rounded down, `minimumHealthyPercent` a floor on healthy tasks rounded up, and a service
 * behind a load balancer counts a task healthy only once the load balancer reports it. A replacement therefore starts
 * only in a free slot; without one the service must stop a task first, and it may do that only while the remainder
 * still meets the healthy minimum. Returns what serves while that replacement is still starting. */
const serviceCapacity=(configuration,desired=1)=>{
 const slots=Math.floor(desired*configuration.MaximumPercent/100);
 const requiredHealthy=Math.ceil(desired*configuration.MinimumHealthyPercent/100);
 const stopsBeforeStart=slots-desired<1&&requiredHealthy<desired;
 return {slots,requiredHealthy,stopsBeforeStart,servingWhileStarting:stopsBeforeStart?desired-1:desired,peak:Math.min(slots,desired+1)};
};

/** The actual Control session owner, composed as apps/runtime/control.mjs composes it, with one synthetic identity and
 * context. Two of these stand in for two Control tasks during a rollout. */
const SESSION_BINDING={tenantId:'00000000-0000-4000-8000-000000000001',actorId:'00000000-0000-4000-8000-000000000002',
 conversationId:'00000000-0000-4000-8000-000000000003',runId:'00000000-0000-4000-8000-000000000004',
 attemptId:'00000000-0000-4000-8000-000000000005',workerId:'00000000-0000-4000-8000-000000000006',writerFence:1};
const SESSION_CLIENT='00000000-0000-4000-8000-000000000007';
function sessionOwner(){
 const at=Date.now(),scopes=[{tenantId:SESSION_BINDING.tenantId,kind:'client',resourceId:SESSION_CLIENT,policyRevision:'policy'}];
 return createActionSessionOwner({mode:'process-local',now:()=>at,limits:{maxSessions:4,maxRequestMs:1000,maxTtlMs:10000,maxFactBytes:65536},
  verifyIdentity:async()=>({principal:{tenantId:SESSION_BINDING.tenantId,actorId:SESSION_BINDING.actorId},identityRevision:'identity',checkedAtMs:at,expiresAtMs:at+20000}),
  resolveContext:async({identity})=>({identitySha256:canonicalSha256(identity),binding:SESSION_BINDING,scopes,selectedClientId:SESSION_CLIENT,
   contextRevision:'context',checkedAtMs:at,expiresAtMs:at+20000})});
}

test('a token issued by one Control task is refused by another: overlap needs shared or routed sessions',async()=>{
 const a=sessionOwner(),b=sessionOwner();
 try{
  const issued=await a.issue({identityCredential:'synthetic-native'});
  const authentication=await a.authenticateSession({credential:issued.credential});
  assert.equal((await a.readCurrentState({authentication})).binding.conversationId,SESSION_BINDING.conversationId,'the owning task serves its own session');
  await assert.rejects(b.authenticateSession({credential:issued.credential}),error=>error.code==='SESSION_REFUSED');
 }finally{a.close();b.close();}
});

test('live stacks: control keeps one serving task while its action sessions stay process-local',async()=>{
 const {synth:{templates:t},bindings,args}=await setup();
 const svc=(template,id)=>template.Resources[id];
 for(const [template,id] of [[t.app,'controlService'],[t.app,'temporalWorkerService']])
  assert.equal(svc(template,id).Properties.DesiredCount,1,id);
 const control=svc(t.app,'controlService');
 // Each task owns its sessions in-process and both target groups are non-sticky, so a second serving task refuses a
 // token issued by the first (proved above). The single-serving profile is deliberate; its cost is the stop-before-start
 // gap, and closing that gap requires a qualified ownership/routing change, not a higher percentage.
 const owner=sessionOwner(),mode=owner.status().mode;owner.close();
 const live=serviceCapacity(control.Properties.DeploymentConfiguration,control.Properties.DesiredCount);
 assert.equal(mode,'process-local');
 assert.equal(live.peak,1,`a ${mode} session owner cannot be shared by two serving tasks`);
 assert.equal(live.stopsBeforeStart,true,'the running task is stopped before its replacement starts; that gap is known, not hidden');
 // Raising either percentage alone would add a second serving owner: the counterexample this guard rejects.
 const overlap=serviceCapacity({MaximumPercent:200,MinimumHealthyPercent:100},control.Properties.DesiredCount);
 assert.equal(overlap.peak,2);
 assert.deepEqual(control.Properties.DeploymentConfiguration,{MaximumPercent:100,MinimumHealthyPercent:0});
 assert.equal(control.Properties.AvailabilityZoneRebalancing,'DISABLED','ECS refuses max 100 while AZ rebalancing is ENABLED');
 assert.equal(control.DependsOn?.includes('runnerTask')??false,false);
 assert.equal(svc(t.app,'temporalWorkerService').Properties.AvailabilityZoneRebalancing,undefined,'only control changes deployment shape');
 assert.equal(svc(t.app,'temporalWorkerService').Properties.DeploymentConfiguration,undefined,'worker keeps the ECS default deployment shape');
 // Control keeps the live public 8080 group and the private 8082 group.
 assert.equal(bindings.app.controlTargetGroupArn,PUBLIC_TG);
 assert.deepEqual(control.Properties.LoadBalancers.map(l=>l.ContainerPort).sort(),[8080,8082]);
 // The profile is the only difference from the renderers' create-time templates.
 const created=JSON.parse(JSON.stringify(t));
 for(const id of ['controlService','temporalWorkerService'])created.app.Resources[id].Properties.DesiredCount=0;
 assert.deepEqual(JSON.parse(JSON.stringify(applyLiveServiceProfile(created))),JSON.parse(JSON.stringify(t)));
 // Fail closed without exactly one live public group.
 assert.throws(()=>liveControlTargetGroup({Resources:{}}),/public 8080 target group/u);
 assert.throws(()=>liveControlTargetGroup({Resources:{controlService:{Properties:{LoadBalancers:[...LIVE_APP.Resources.controlService.Properties.LoadBalancers,
  {ContainerPort:8080,TargetGroupArn:PUBLIC_TG}]}}}}),/public 8080 target group/u);
 assert.throws(()=>buildStage3Bindings({...structuredClone(args),liveAppTemplate:undefined}),/public 8080 target group/u);
});

test('secret upload plan: one new version per role under a fresh label, fixed idempotency token, bundles by path only',async()=>{
 const inputs={deployment:await load('deployment-inputs.json')};let n=0;
 const secretLabels=labelReadback(inputs.deployment);
 const plan=uploadPlan({deployment:inputs.deployment,renderedDirectory:'/w/rendered',label:'FIRST_CHAT_20261021A',secretLabels,newToken:()=>`token-${++n}`});
 assert.deepEqual(plan.map(p=>p.role),ROLES);
 for(const [i,p] of plan.entries()){
  assert.equal(p.command[p.command.indexOf('--version-stages')+1],'FIRST_CHAT_20261021A','never AWSCURRENT: task definitions pin exact VersionIds');
  assert.equal(p.command[p.command.indexOf('--client-request-token')+1],`token-${i+1}`);
  assert.equal(p.command[p.command.indexOf('--secret-string')+1],`file://${join('/w/rendered',p.role,'bundle.json')}`);
  assert.equal(p.command[p.command.indexOf('--secret-id')+1],p.secretArn);
  assert.deepEqual(p.labelsBefore,['AWSCURRENT','AWSPREVIOUS','FIRST_CHAT_20261020E'],'the before state the readback gate compares against');
 }
 for(const label of ['AWSCURRENT','AWSPREVIOUS','AWSPENDING','','bad label'])assert.throws(()=>uploadPlan({deployment:inputs.deployment,renderedDirectory:'/w',label,secretLabels}),/new custom staging label/u);
 const broken=structuredClone(inputs.deployment);broken.secrets['control/material']='arn:aws:secretsmanager:us-east-1:111111111111:secret:x';
 assert.throws(()=>uploadPlan({deployment:broken,renderedDirectory:'/w',label:'L',secretLabels}),/control\/material/u);
});

test('secret upload preconditions: a label already in use, a full secret or a missing readback refuses before any command exists',async()=>{
 const d=await load('deployment-inputs.json'),arn=d.secrets['control/material'];
 const plan=extra=>()=>uploadPlan({deployment:d,renderedDirectory:'/w',label:'FIRST_CHAT_20261021A',secretLabels:labelReadback(d,extra)});
 // PutSecretValue would silently move a reused label off an older version: refuse instead.
 assert.throws(plan({[arn]:[{VersionId:'v-reused',VersionStages:['FIRST_CHAT_20261021A']}]}),/already on a version of control/u);
 const labels=Array.from({length:17},(_,i)=>({VersionId:`v-${i}`,VersionStages:[`FIRST_CHAT_OLD${i}`]}));
 assert.throws(plan({[arn]:labels}),/20 staging-label quota/u,'AWSCURRENT, AWSPREVIOUS, E and 17 more labels reach the quota');
 assert.doesNotThrow(plan({[arn]:labels.slice(1)}),'19 labels leave room for one more');
 assert.throws(plan({[arn]:Array.from({length:97},(_,i)=>({VersionId:`u-${i}`}))}),/already holds 100 versions/u);
 const missing=labelReadback(d);delete missing[arn];
 assert.throws(()=>uploadPlan({deployment:d,renderedDirectory:'/w',label:'FIRST_CHAT_20261021A',secretLabels:missing}),/no label readback for control/u);
 // The CLI reads one raw list-secret-version-ids output per secret, keyed by its own ARN; duplicates or other shapes refuse.
 const outputs=Object.entries(labelReadback(d)).map(([ARN,Versions])=>({ARN,Name:'n',Versions}));
 assert.deepEqual(secretLabelReadback(outputs),labelReadback(d));
 assert.throws(()=>secretLabelReadback([...outputs,outputs[0]]),/one list-secret-version-ids output per secret/u);
 assert.throws(()=>secretLabelReadback([{Versions:[]}]),/one list-secret-version-ids output per secret/u);
});

test('upload readbacks refuse incomplete pages and malformed version records before producing a plan',async()=>{
 const d=await load('deployment-inputs.json'),ARN=d.secrets['control/material'];
 const valid=labelReadback(d)[ARN];
 for(const Versions of [valid,[]])assert.throws(()=>secretLabelReadback([{ARN,Versions,NextToken:'more'}]),/incomplete/u);
 const malformed=[null,[],{}, {VersionId:''},{VersionId:'v',VersionStages:null},{VersionId:'v',VersionStages:'AWSCURRENT'},
  {VersionId:'v',VersionStages:[null]},{VersionId:'v',VersionStages:['']},{VersionId:'v',VersionStages:['A','A']}];
 for(const version of malformed){
  const Versions=[version];
  assert.throws(()=>secretLabelReadback([{ARN,Versions}]),/secret label readback/u);
  assert.throws(()=>uploadPlan({deployment:d,renderedDirectory:'/w',label:'NEW',secretLabels:{...labelReadback(d),[ARN]:Versions}}),/secret label readback/u);
 }
 for(const Versions of [[valid[0],valid[0]],[valid[0],{VersionId:'different',VersionStages:['AWSCURRENT']}]])
  assert.throws(()=>secretLabelReadback([{ARN,Versions}]),/secret label readback/u);
 const Versions=[...valid,{VersionId:'deprecated-without-stages'}];
 assert.deepEqual(secretLabelReadback([{ARN,Versions}]),{[ARN]:Versions});
 const plan=uploadPlan({deployment:d,renderedDirectory:'/w',label:'NEW',secretLabels:{...labelReadback(d),[ARN]:Versions}});
 assert.deepEqual(plan[0].labelsBefore,['AWSCURRENT','AWSPREVIOUS','FIRST_CHAT_20261020E']);
});

// SCRUM-237: the optional control-only public search binding, exercised through the real
// buildStage3Bindings -> synthesizeStage3 -> manifest task rendering path.
const GATEWAY_URL='https://meri-preview-web-search-abc123.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp';
const TARGET_TOOL='WebSearch-tool-abc123';
const webSearchEnv=(container)=>Object.fromEntries((container.Environment??[])
 .filter(e=>e.Name.startsWith('MERI_WEB_SEARCH_')).map(e=>[e.Name,e.Value]));

test('absent public search inputs leave the app binding and every rendered task byte-identical',async()=>{
 const {args,bindings,synth}=await setup();
 assert.equal(Object.hasOwn(bindings.app,'controlWebSearch'),false);
 assert.deepEqual(webSearchEnv(synth.templates.app.Resources.controlTask.Properties.ContainerDefinitions.find(c=>c.Name==='control')),{});
 const explicit=buildStage3Bindings({...structuredClone(args),webSearchOutputs:undefined});
 assert.deepEqual(explicit,bindings,'re-building without the input changes nothing');
 assert.equal(JSON.stringify(synthesizeStage3(explicit).templates.app),JSON.stringify(synth.templates.app));
});

test('enabled public search adds exactly three control variables and nothing else',async()=>{
 const {args,bindings,synth}=await setup();
 const enabled=buildStage3Bindings({...structuredClone(args),webSearchOutputs:{GatewayUrl:GATEWAY_URL,TargetToolName:TARGET_TOOL}});
 assert.deepEqual(enabled.app.controlWebSearch,{gatewayUrl:GATEWAY_URL,toolName:TARGET_TOOL,region:'us-east-1'});
 const next=synthesizeStage3(enabled),task=next.templates.app.Resources.controlTask.Properties.ContainerDefinitions;
 const before=synth.templates.app.Resources.controlTask.Properties.ContainerDefinitions;
 const control=task.find(c=>c.Name==='control'),prior=before.find(c=>c.Name==='control');
 assert.deepEqual(webSearchEnv(control),{MERI_WEB_SEARCH_GATEWAY_ENDPOINT:GATEWAY_URL,MERI_WEB_SEARCH_TOOL:TARGET_TOOL,
  MERI_WEB_SEARCH_REGION:'us-east-1'});
 // Same variables otherwise, same worker containers, same images/roles/refs and same service shape.
 assert.deepEqual(control.Environment.filter(e=>!e.Name.startsWith('MERI_WEB_SEARCH_')),prior.Environment);
 assert.deepEqual(task.filter(c=>c.Name!=='control'),before.filter(c=>c.Name!=='control'));
 assert.deepEqual(next.templates.app.Resources.controlTask.Properties.TaskRoleArn,synth.templates.app.Resources.controlTask.Properties.TaskRoleArn);
 assert.deepEqual(next.templates.app.Resources.controlTask.Properties.ExecutionRoleArn,synth.templates.app.Resources.controlTask.Properties.ExecutionRoleArn);
 for(const id of ['controlTask','temporalWorkerTask'])assert.equal(JSON.stringify(next.templates.app.Resources[id].Properties.ContainerDefinitions.find(c=>c.Name!=='control')),
  JSON.stringify(synth.templates.app.Resources[id].Properties.ContainerDefinitions.find(c=>c.Name!=='control')));
 assert.equal(next.templates.app.Resources.controlService.Properties.DesiredCount,synth.templates.app.Resources.controlService.Properties.DesiredCount);
 assert.deepEqual(bindings.services,enabled.services);
 // Only the control container environment differs in the whole template.
 const normalize=t=>{const copy=structuredClone(t);delete copy.Description;for(const c of copy.Resources.controlTask.Properties.ContainerDefinitions)
  if(c.Name==='control')c.Environment=c.Environment.filter(e=>!e.Name.startsWith('MERI_WEB_SEARCH_'));return copy;};
 assert.deepEqual(normalize(next.templates.app),normalize(synth.templates.app));
});

test('invalid public search bindings are refused before any template is produced',async()=>{
 const {args}=await setup();
 for(const webSearchOutputs of [
  {GatewayUrl:'https://meri-preview-web-search-abc123.gateway.bedrock-agentcore.us-east-1.amazonaws.com',TargetToolName:TARGET_TOOL},
  {GatewayUrl:`${GATEWAY_URL}/extra`,TargetToolName:TARGET_TOOL},
  {GatewayUrl:'http://meri-preview-web-search-abc123.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp',TargetToolName:TARGET_TOOL},
  {GatewayUrl:GATEWAY_URL,TargetToolName:'bad tool'},
  {GatewayUrl:GATEWAY_URL,TargetToolName:''},
  {GatewayUrl:GATEWAY_URL},
  {GatewayUrl:GATEWAY_URL,TargetToolName:123},
  'not-an-object']){
  assert.throws(()=>buildStage3Bindings({...structuredClone(args),webSearchOutputs}),/STAGE3_BINDING_REFUSED/u);
 }
 // The real gateway stack emits more outputs; only GatewayUrl/TargetToolName are consumed.
 const superset=buildStage3Bindings({...structuredClone(args),webSearchOutputs:{GatewayArn:'arn:aws:bedrock-agentcore:us-east-1:967807252336:gateway/x',
  GatewayUrl:GATEWAY_URL,GatewayId:'x',TargetToolName:TARGET_TOOL,ConnectorOperation:'WebSearch',ConnectorVersion:'1.2.0',ProtocolVersion:'2026-07-28'}});
 assert.deepEqual(superset.app.controlWebSearch,{gatewayUrl:GATEWAY_URL,toolName:TARGET_TOOL,region:'us-east-1'});
});

test('the rendered control variables are exactly what the producer constructor accepts',async()=>{
 const {args}=await setup();
 const enabled=buildStage3Bindings({...structuredClone(args),webSearchOutputs:{GatewayUrl:GATEWAY_URL,TargetToolName:TARGET_TOOL}});
 const {primarySearchTarget,createPrimaryWebSearch}=await import('../../../apps/gateway/sources/public-web/primary-search.mjs');
 const env={MERI_WEB_SEARCH_GATEWAY_ENDPOINT:enabled.app.controlWebSearch.gatewayUrl,
  MERI_WEB_SEARCH_TOOL:enabled.app.controlWebSearch.toolName,MERI_WEB_SEARCH_REGION:enabled.app.controlWebSearch.region};
 assert.deepEqual(primarySearchTarget(env),{endpoint:GATEWAY_URL,toolName:TARGET_TOOL,region:'us-east-1'});
 const primary=createPrimaryWebSearch({...primarySearchTarget(env),credentials:async()=>({accessKeyId:'A',secretAccessKey:'B'})});
 assert.equal(primary.toolName,TARGET_TOOL);
 assert.equal(primary.admission.unitMicroUsd,7005);
 assert.equal(primarySearchTarget({...env,MERI_WEB_SEARCH_GATEWAY_ENDPOINT:GATEWAY_URL.replace('/mcp','')}),undefined,
  'an origin-only value keeps the family on the old Core route');
});

test('the host-currentness listener and the host listener load balancer travel together: port mapping and target only with both',async()=>{
 const {args,synth}=await setup(),edge={HostListenerTargetGroupArn:'arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-preview-host-control/0123456789abcdef',
  HostListenerSecurityGroupId:'sg-0123456789abcdef0',HostListenerAddress:'10.40.7.250'};
 const control=t=>resources(t,'AWS::ECS::TaskDefinition').find(d=>d.Family==='meri-product-preview-control').ContainerDefinitions.find(c=>c.Name==='control');
 const service=t=>resources(t,'AWS::ECS::Service').find(s=>s.ServiceName==='meri-product-preview-control');
 // Without the listener: no port 8443 and no third target, and edge outputs alone refuse.
 assert.deepEqual(control(synth.templates.app).PortMappings.map(p=>p.ContainerPort),[8080,8082]);
 assert.throws(()=>buildStage3Bindings({...structuredClone(args),hostListenerOutputs:edge}),/must be supplied together/u);
 // A render that carries the listener (control key browserHosts from the native family) requires the outputs, then maps them.
 const listening={...structuredClone(args),renderSummary:{...structuredClone(args.renderSummary),features:{controlKeys:['uploads','browserHosts']}}};
 assert.throws(()=>buildStage3Bindings(listening),/must be supplied together/u);
 assert.throws(()=>buildStage3Bindings({...listening,hostListenerOutputs:{...edge,HostListenerTargetGroupArn:'arn:aws:elasticloadbalancing:us-east-1:111111111111:targetgroup/x/0123456789abcdef'}}),/HostListenerTargetGroupArn/u);
 const bound=buildStage3Bindings({...listening,hostListenerOutputs:edge});
 assert.equal(bound.app.controlHostListenerTargetGroupArn,edge.HostListenerTargetGroupArn);
 const t=synthesizeStage3(bound).templates.app;
 assert.deepEqual(control(t).PortMappings.map(p=>p.ContainerPort),[8080,8082,8443]);
 assert.deepEqual(service(t).LoadBalancers.find(l=>l.ContainerPort===8443),{ContainerName:'control',ContainerPort:8443,TargetGroupArn:edge.HostListenerTargetGroupArn});
});

test('native material reaches the Temporal worker task role and database network alongside the control host listener',async()=>{
 const {args,revisions}=await setup(),edge={HostListenerTargetGroupArn:'arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-preview-host-control/0123456789abcdef'};
 for(const browserOnly of [true,false]){
  const i=await nativeProcessingInputs(fixture);
  if(browserOnly)delete i.deployment.features.nativeProcessing.deployment;
  // No fabricated foundation output: the task role comes from the prerequisite stack that actually owns it.
  const f=args.foundationOutputs,roleArn=i.deployment.foundation.WorkerTaskRoleArn;
  i.stage3=stage3RenderInput({deployment:i.deployment,foundationOutputs:f,revisions});
  sameSet(i.stage3.network['temporal-worker'].securityGroups,[f.WorkerSecurityGroupId,f.DbClientSecurityGroupId]);
  const rendered=renderMaterial(i);
  const bound=buildStage3Bindings({...args,deployment:i.deployment,foundationOutputs:f,renderSummary:rendered.summary,
   renderedExpected:Object.fromEntries(ROLES.map(role=>[role,rendered.roles[role].expected])),hostListenerOutputs:edge,
   nativeWorkerRoleOutputs:{NativeWorkerTaskRoleArn:roleArn}});
  const t=synthesizeStage3(bound).templates.app,tasks=resources(t,'AWS::ECS::TaskDefinition');
  const worker=tasks.find(d=>d.Family==='meri-product-preview-temporal-worker'),control=tasks.find(d=>d.Family==='meri-product-preview-control');
  assert.equal(worker.TaskRoleArn,roleArn,'native provisioning needs the distinct worker role on the actual task');
  assert.equal(worker.TaskRoleArn,rendered.summary.wiring['temporal-worker'].taskRoleArn);
  assert.notEqual(worker.TaskRoleArn,control.TaskRoleArn);assert.equal(control.TaskRoleArn,f.ControlTaskRoleArn);
  const workerService=resources(t,'AWS::ECS::Service').find(s=>s.ServiceName==='meri-product-preview-temporal-worker');
  sameSet(workerService.NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,i.stage3.network['temporal-worker'].securityGroups);
  assert.ok(control.ContainerDefinitions.find(c=>c.Name==='control').PortMappings.some(p=>p.ContainerPort===8443));
  const service=resources(t,'AWS::ECS::Service').find(s=>s.ServiceName==='meri-product-preview-control');
  sameSet(service.NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,[f.ControlSecurityGroupId,f.DbClientSecurityGroupId]);
  assert.deepEqual(service.LoadBalancers.find(l=>l.ContainerPort===8443),{ContainerName:'control',ContainerPort:8443,TargetGroupArn:edge.HostListenerTargetGroupArn});
 }
});

test('native provisioning takes the worker task role from its own stack readback, never from the foundation outputs',async()=>{
 const {args,revisions}=await setup(),edge={HostListenerTargetGroupArn:'arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-preview-host-control/0123456789abcdef'};
 const i=await nativeProcessingInputs(fixture);
 delete i.deployment.features.nativeProcessing.deployment;
 const declared=i.deployment.foundation.WorkerTaskRoleArn;
 // Reality: the foundation stack exports WorkerExecutionRoleArn and no worker TASK role at all.
 assert.equal(Object.hasOwn(args.foundationOutputs,'WorkerTaskRoleArn'),false,'the foundation stack exports no worker task role');
 // The rendered stage3 input must accept the foundation readback as it is; the task role is not one of its outputs.
 i.stage3=stage3RenderInput({deployment:i.deployment,foundationOutputs:args.foundationOutputs,revisions});
 const rendered=renderMaterial(i);
 const renderedExpected=Object.fromEntries(ROLES.map(role=>[role,rendered.roles[role].expected]));
 const bind=extra=>buildStage3Bindings({...args,deployment:i.deployment,foundationOutputs:args.foundationOutputs,
  renderSummary:rendered.summary,renderedExpected,hostListenerOutputs:edge,...extra});
 const bound=bind({nativeWorkerRoleOutputs:{NativeWorkerTaskRoleArn:declared}});
 assert.equal(bound.app.workerTaskRoleArn,declared);
 const worker=resources(synthesizeStage3(bound).templates.app,'AWS::ECS::TaskDefinition').find(d=>d.Family==='meri-product-preview-temporal-worker');
 assert.equal(worker.TaskRoleArn,declared,'the browser-capable worker carries its task role on the actual task');
 // Fail closed instead of rendering a browser-capable worker with no role.
 assert.throws(()=>bind({}),/STAGE3_BINDING_REFUSED/u,'no prerequisite stack readback');
 assert.throws(()=>bind({nativeWorkerRoleOutputs:{}}),/STAGE3_BINDING_REFUSED/u,'readback without the role');
 assert.throws(()=>bind({nativeWorkerRoleOutputs:{NativeWorkerTaskRoleArn:'arn:aws:iam::967807252336:role/another-worker'}}),
  /STAGE3_BINDING_REFUSED/u,'readback drifting from the reviewed input');
});

test('a task role may never be an execution role, and the foundation drift check still applies to every real output',async()=>{
 const {args}=await setup();
 // An execution role grants the ECS agent pull/log rights, not the application's cloud calls: the exact live confusion.
 for(const key of ['WorkerExecutionRoleArn','ControlExecutionRoleArn']){
  const i=await nativeProcessingInputs(fixture);
  i.deployment.foundation.WorkerTaskRoleArn=args.foundationOutputs[key];
  assert.throws(()=>renderMaterial(i),/RENDER_INPUT_REFUSED/u,key);
 }
 // The stage3 input refuses a real foundation output that drifted from deployment-inputs.json.
 const i=await nativeProcessingInputs(fixture);
 const drifted={...args.foundationOutputs,WorkerSecurityGroupId:'sg-00000000000000000'};
 assert.throws(()=>stage3RenderInput({deployment:i.deployment,foundationOutputs:drifted,revisions:nextRevisions(parseLatestTsv(LATEST))}),
  /STAGE3_BINDING_REFUSED/u,'a genuine foundation output still has to match');
});

for(const [state,nativeProcessing] of [['absent',undefined],['disabled',{enabled:false}]]){
 test(`native worker role refuses inputs when native processing is ${state}`,()=>{
  const deployment={foundation:{}};
  if(nativeProcessing!==undefined)deployment.features={nativeProcessing};
  const role='arn:aws:iam::967807252336:role/synthetic-native-worker';
  assert.equal(nativeWorkerTaskRole({deployment}),undefined);
  // Call the role guard directly so unrelated material validation cannot satisfy these refusals.
  assert.throws(()=>nativeWorkerTaskRole({deployment:{...deployment,foundation:{WorkerTaskRoleArn:role}}}),{
   code:'STAGE3_BINDING_REFUSED',message:'STAGE3_BINDING_REFUSED: foundation.WorkerTaskRoleArn requires features.nativeProcessing'
  });
  for(const nativeWorkerRoleOutputs of [{},{NativeWorkerTaskRoleArn:role}]){
   assert.throws(()=>nativeWorkerTaskRole({deployment,nativeWorkerRoleOutputs}),{
    code:'STAGE3_BINDING_REFUSED',message:'STAGE3_BINDING_REFUSED: nativeWorkerRoleOutputs is only consumed when features.nativeProcessing is enabled'
   });
  }
 });
}

test('absent or disabled native processing grants neither the native worker role nor database network',async()=>{
 const {args,revisions}=await setup();
 for(const nativeProcessing of [undefined,{enabled:false}]){
  const i=structuredClone(await fixture.setup());
  if(nativeProcessing!==undefined)i.deployment.features={nativeProcessing};
  const f={...args.foundationOutputs,...i.deployment.foundation};
  i.stage3=stage3RenderInput({deployment:i.deployment,foundationOutputs:f,revisions});
  assert.deepEqual(i.stage3.network['temporal-worker'].securityGroups,[f.WorkerSecurityGroupId]);
  const rendered=await fixture.render(x=>Object.assign(x,i));
  const bound=buildStage3Bindings({...args,deployment:i.deployment,foundationOutputs:{...args.foundationOutputs,...i.deployment.foundation},renderSummary:rendered.summary,
   renderedExpected:Object.fromEntries(ROLES.map(role=>[role,rendered.roles[role].expected]))});
  const t=synthesizeStage3(bound).templates.app;
  assert.equal(bound.app.workerTaskRoleArn,undefined);
  assert.equal(resources(t,'AWS::ECS::TaskDefinition').find(d=>d.Family==='meri-product-preview-temporal-worker').TaskRoleArn,undefined);
  assert.deepEqual(resources(t,'AWS::ECS::Service').find(s=>s.ServiceName==='meri-product-preview-temporal-worker').NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,[f.WorkerSecurityGroupId]);
  assert.equal(resources(t,'AWS::ECS::Service').find(s=>s.ServiceName==='meri-product-preview-control').LoadBalancers.some(l=>l.ContainerPort===8443),false);
 }
});
