/** Stage 3 bindings on THROWAWAY material: render-material.fixture.mjs renders three service roles from a fresh pki.py PKI (synthetic
 * passwords and Core credential), stage3-bindings builds every binding from the real foundation/private-edge outputs plus fake
 * secret VersionIds and scan hashes in their real formats, and both templates synthesize through their own validators.
 * Needs MERI_REVIEW_SOURCE_ROOT=<worktree root> and Python 3 with `cryptography`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRenderFixture} from './render-material.fixture.mjs';
import {PATHS,ROLES,writeRendered} from './render-material.mjs';
import {STAGE3_FAMILIES,STAGE3_EXISTING,STAGE3_DEPLOY_ORDER,nextRevisions,stage3RenderInput,buildStage3Bindings,synthesizeStage3,applyLiveServiceProfile,liveControlTargetGroup} from './stage3-bindings.mjs';
import {parseLatestTsv,coreValuesFromMembership,parseVersionsTsv,outputsObject,deployPlan,uploadPlan,secretLabelReadback,verifyOutputs,probeTaskDefinition,PROBE_PROGRAM,main} from './stage3-deploy.mjs';
import {productWorkerTrustsPinnedServerCa} from '../../../apps/runtime/cli.mjs';

const here=fileURLToPath(new URL('.',import.meta.url));
const load=async name=>JSON.parse(await readFile(join(here,name),'utf8'));
const fixture=createRenderFixture();
test.after(()=>fixture.cleanup());
const fakeVersion=n=>`${String(n).repeat(8)}-aaaa-4bbb-8ccc-${String(n).repeat(12)}`;
const SECRET_VERSIONS=Object.fromEntries(ROLES.map((role,i)=>[role,fakeVersion(i+1)]));
/** A before-upload label readback per material secret: AWSCURRENT, AWSPREVIOUS and one earlier release label, plus extras. */
const labelReadback=(deployment,extra={})=>Object.fromEntries(['control/material','worker/material','issuer/material'].map(key=>deployment.secrets[key]).map(arn=>[arn,
 [{VersionId:'v-current',VersionStages:['AWSCURRENT']},{VersionId:'v-previous',VersionStages:['AWSPREVIOUS']},{VersionId:'v-e',VersionStages:['FIRST_CHAT_20261020E']},...(extra[arn]??[])]]));
const SCANS={nodeRuntime:'d'.repeat(64)};
/** The live app stack's control service as `get-template --stage Original` returns it: public 8080 and private 8082 groups. */
const PUBLIC_TG='arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-preview-control-8080/03297203fa59801c';
const LIVE_APP={Resources:{controlService:{Type:'AWS::ECS::Service',Properties:{LoadBalancers:[{ContainerName:'control',ContainerPort:8080,TargetGroupArn:PUBLIC_TG},
 {ContainerName:'control',ContainerPort:8082,TargetGroupArn:'arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-preview-control-8082/1732509ee5fbf759'}]}}}};
const LATEST=[...Object.values(STAGE3_FAMILIES).flatMap(f=>[`${f}\tNone`,`${f}\tNone`])].join('\n').replace(
 'meri-product-preview-temporal-issuer\tNone','meri-product-preview-temporal-issuer\tarn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-temporal-issuer:3')+'\n';

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
 assert.deepEqual(revisions,{control:1,'temporal-worker':1,'temporal-issuer':4,runner:1});
 assert.equal(stage3.taskDefinitions['temporal-issuer'],'arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-temporal-issuer:4');
 assert.deepEqual(Object.keys(stage3.services),['control','temporal-worker','temporal-issuer']);
 assert.throws(()=>nextRevisions({control:['arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-control-x:9']}),/STAGE3_BINDING_REFUSED/u);
 assert.throws(()=>parseLatestTsv('meri-product-preview-control\tNone\n'),/STAGE3_BINDING_REFUSED/u);
});

test('both bindings pass their renderers: app (control, worker, runner) and issuer',async ctx=>{
 const {synth,bindings,foundationOutputs:f,inputs}=await setup(),t=synth.templates;
 ctx.diagnostic('template bytes '+JSON.stringify(synth.sizes));
 for(const [key,size] of Object.entries(synth.sizes))assert.ok(size.bytes>0,key);
 // (a) manifest: per-role execution roles and log groups, private 8082 target group only.
 const tasks=resources(t.app,'AWS::ECS::TaskDefinition'),services=resources(t.app,'AWS::ECS::Service');
 const task=family=>tasks.find(x=>x.Family===family);
 for(const [family,role,group] of [['meri-product-preview-control','ControlExecutionRoleArn','ControlLogGroupName'],
  ['meri-product-preview-temporal-worker','WorkerExecutionRoleArn','WorkerLogGroupName'],['meri-product-preview-runner','RunnerExecutionRoleArn','RunnerLogGroupName']]){
  assert.equal(task(family).ExecutionRoleArn,f[role]);
  for(const c of task(family).ContainerDefinitions)assert.equal(c.LogConfiguration.Options['awslogs-group'],f[group]);
 }
 assert.equal(task('meri-product-preview-runner').ExecutionRoleArn,'arn:aws:iam::967807252336:role/MeriPreview-runner-execution');
 assert.equal(task('meri-product-preview-control').TaskRoleArn,f.ControlTaskRoleArn);
 assert.equal(task('meri-product-preview-runner').TaskRoleArn,f.RunnerTaskRoleArn);
 for(const task of tasks)assert.equal(task.RuntimePlatform.CpuArchitecture,'ARM64');
 const control=services.find(s=>s.ServiceName==='meri-product-preview-control');
 assert.deepEqual(control.LoadBalancers,[{ContainerName:'control',ContainerPort:8080,TargetGroupArn:f.ControlTargetGroupArn},
  {ContainerName:'control',ContainerPort:8082,TargetGroupArn:inputs.deployment.privateEdge.controlPrivateTargetGroupArn}],'the live public group and the private one');
 sameSet(control.NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,[f.ControlSecurityGroupId,f.IssuerClientSecurityGroupId,f.DbClientSecurityGroupId]);
 sameSet(services.find(s=>s.ServiceName==='meri-product-preview-temporal-worker').NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,[f.WorkerSecurityGroupId,f.IssuerClientSecurityGroupId]);
 assert.equal(t.app.Outputs.RunnerSecurityGroupIds.Value,f.RunnerSecurityGroupId);
 // (b) issuer: still desired 1, now on the Node runtime image with the new material version.
 const issuer=t.issuer.Resources.TemporalIssuerService.Properties,issuerTask=t.issuer.Resources.TemporalIssuerTask.Properties;
 assert.equal(issuer.DesiredCount,1);assert.equal(issuerTask.ContainerDefinitions[1].Image,inputs.deployment.images.nodeRuntime);
 assert.equal(issuerTask.ContainerDefinitions[0].Secrets[0].ValueFrom,`${inputs.deployment.secrets['issuer/material']}:::${SECRET_VERSIONS['temporal-issuer']}`);
 assert.equal(bindings.stacks.app,'meri-first-chat-app');assert.equal(Object.hasOwn(bindings.stacks,'model'),false);assert.equal(bindings.stacks.issuer,'meri-first-chat-issuer');
});

test('rendered configs and the synthesized task definitions agree: issuer pins, worker CA trust, runner poststart',async()=>{
 const {synth:{templates:t},rendered,stage3,revisions}=await setup();
 const config=role=>JSON.parse(rendered.roles[role].configBytes.toString('utf8'));
 const tasks=[...resources(t.app,'AWS::ECS::TaskDefinition'),t.issuer.Resources.TemporalIssuerTask.Properties];
 const services=[...resources(t.app,'AWS::ECS::Service')];
 const byFamily=family=>tasks.find(x=>x.Family===family),main=task=>task.ContainerDefinitions.at(-1);
 const serviceOf=arn=>services.find(s=>arn.endsWith('/'+s.ServiceName));
 // Every rendered task-definition ARN names a family these templates register, at the predicted revision.
 for(const [role,arn] of Object.entries(stage3.taskDefinitions)){const [family,revision]=arn.split('/')[1].split(':');assert.ok(byFamily(family),family);assert.equal(Number(revision),revisions[role]);}
 // Issuer taskAuthority pins (temporal-issuer peer check) equal the control and worker task definitions and services.
 const authority=config('temporal-issuer').issuer.taskAuthority;
 for(const role of ['control','temporal-worker']){
  const pin=authority.roles[role],task=byFamily(pin.taskDefinitionArn.split('/')[1].split(':')[0]),c=main(task);
  assert.equal(task.ExecutionRoleArn,pin.executionRoleArn,role);assert.equal(task.TaskRoleArn??null,pin.taskRoleArn,role);
  assert.equal(c.Name,pin.containerName);assert.equal(c.Image,pin.imageUri);
  sameSet(serviceOf(pin.serviceArn).NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,pin.securityGroupIds);
 }
 sameSet(authority.privateSubnetIds,serviceOf(authority.roles.control.serviceArn).NetworkConfiguration.AwsvpcConfiguration.Subnets);
 // Control's runner RunTask request names the runner family, container and the one runner SG.
 const request=config('control').nativeCandidate.taskRequest,runner=byFamily('meri-product-preview-runner');
 assert.equal(request.taskDefinition,stage3.taskDefinitions.runner);assert.equal(main(runner).Name,request.overrides.containerOverrides[0].name);
 assert.equal(t.app.Outputs.RunnerPrivateSubnetId.Value,request.networkConfiguration.awsvpcConfiguration.subnets[0]);
 assert.equal(t.app.Outputs.RunnerSecurityGroupIds.Value,request.networkConfiguration.awsvpcConfiguration.securityGroups.join(','));
 // Worker NODE_EXTRA_CA_CERTS is rendered by the manifest (token writers configured) and satisfies the cli.mjs product gate.
 const worker=main(byFamily('meri-product-preview-temporal-worker'));
 assert.equal(env(worker,'NODE_EXTRA_CA_CERTS'),PATHS.issuerCa);assert.equal(env(worker,'NODE_EXTRA_CA_CERTS'),rendered.summary.worker.NODE_EXTRA_CA_CERTS);
 assert.equal(productWorkerTrustsPinnedServerCa(config('temporal-worker'),{NODE_EXTRA_CA_CERTS:env(worker,'NODE_EXTRA_CA_CERTS')}),true);
 const control=byFamily('meri-product-preview-control'),controlMain=main(control),controlInit=control.ContainerDefinitions[0];
 assert.equal(env(controlMain,'NODE_EXTRA_CA_CERTS'),rendered.summary.control.NODE_EXTRA_CA_CERTS);
 assert.deepEqual(controlInit.Command,['write','--control-node-ca']);
 assert.deepEqual(controlInit.MountPoints.find(m=>m.SourceVolume==='tmp'),{SourceVolume:'tmp',ContainerPath:'/tmp',ReadOnly:false});
 // Runner environment equals the render wiring exactly; material-init envelopes and config pins equal the render.
 assert.deepEqual(main(runner).Environment.map(e=>({name:e.Name,value:e.Value})),rendered.summary.wiring.runner.environment);
 for(const [family,role] of [['meri-product-preview-control','control'],['meri-product-preview-temporal-worker','temporal-worker'],['meri-product-preview-temporal-issuer','temporal-issuer']]){
  const init=byFamily(family).ContainerDefinitions[0];
  assert.equal(init.Name,'material-init');assert.deepEqual(JSON.parse(env(init,'MERI_STATIC_MATERIAL_EXPECTED')),rendered.roles[role].expected,role);
  assert.match(init.Secrets[0].ValueFrom,new RegExp(`:::${SECRET_VERSIONS[role]}$`,'u'));
 }
 assert.deepEqual(main(byFamily('meri-product-preview-temporal-issuer')).Command,['--config','/run/meri/issuer.json','--config-sha256',rendered.roles['temporal-issuer'].configSha256]);
});

test('existing infrastructure facts the bindings rely on hold in the reviewed foundation sources',async()=>{
 const template=await load('foundation.template.json'),binding=await load('foundation-binding.json'),temporal=await load('temporal-binding.json');
 assert.equal(STAGE3_EXISTING.endpointSecurityGroupId,binding.endpointSecurityGroupId);
 assert.equal(STAGE3_EXISTING.endpointSecurityGroupId,temporal.network.interfaceEndpoints.secretsManager.securityGroupId);
 const policy=Object.values(template.Resources).find(r=>r.Type==='AWS::IAM::Policy'&&JSON.stringify(r.Properties).includes('iam:PassRole'));
 const pass=policy.Properties.PolicyDocument.Statement.find(s=>s.Action==='iam:PassRole');
 const passed=pass.Resource.map(resource=>template.Resources[resource['Fn::GetAtt'][0]].Properties.RoleName);
 assert.deepEqual(passed,[STAGE3_EXISTING.runnerExecutionRoleName,STAGE3_EXISTING.runnerTaskRoleName],'control may pass only the two runner roles');
 const runTask=policy.Properties.PolicyDocument.Statement.find(s=>s.Action==='ecs:RunTask');
 assert.equal(runTask.Resource,`arn:aws:ecs:us-east-1:967807252336:task-definition/${STAGE3_FAMILIES.runner}:*`);
});

test('fail closed: foundation, private edge, render mismatch, secret version, scans and runner role',async()=>{
 const {args}=await setup();
 const refused=change=>{const x=structuredClone(args);change(x);assert.throws(()=>buildStage3Bindings(x),/STAGE3_BINDING_REFUSED/u);};
 refused(x=>{x.foundationOutputs.ControlSecurityGroupId='sg-0123456789abcdef0';});
 refused(x=>{x.foundationOutputs.RunnerExecutionRoleArn='arn:aws:iam::967807252336:role/other';x.deployment.foundation.RunnerExecutionRoleArn=x.foundationOutputs.RunnerExecutionRoleArn;});
 refused(x=>{x.privateEdgeOutputs.ControlPrivateTargetGroupArn=x.foundationOutputs.ControlTargetGroupArn;});
 refused(x=>{x.privateEdgeOutputs.Extra='x';});
 refused(x=>{x.renderedExpected.control=x.renderedExpected['temporal-worker'];});
 refused(x=>{x.renderedExpected['temporal-issuer'].materialContractSha256='0'.repeat(64);});
 refused(x=>{x.secretVersions['temporal-worker']='AWSCURRENT';});
 refused(x=>{delete x.secretVersions.control;});
 refused(x=>{x.imageScans.nodeRuntime='PENDING';});
 refused(x=>{x.renderSummary.roles['temporal-issuer'].taskDefinitionArn='arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-issuer:1';});
 refused(x=>{x.renderSummary.runnerPoststart.MERI_POSTSTART_CONTROL_ORIGIN='https://other.meri-preview.internal';});
 refused(x=>{x.deployment.images.nodeRuntime=x.deployment.images.nodeRuntime.replace(/@sha256:[a-f0-9]{64}$/u,'@sha256:'+'e'.repeat(64));});
 // The renderer still refuses what the builder cannot see: a swapped execution role fails the manifest.
 const {bindings}=await setup(),x=structuredClone(bindings);x.app.executionRoleArns.runner=x.app.controlTaskRoleArn;
 assert.throws(()=>synthesizeStage3(x),/PRODUCT_PREVIEW_BINDING_REFUSED/u);
});

test('deploy plumbing: core values from a membership receipt, versions, outputs and verification',async()=>{
 const {bindings,synth}=await setup(),now=Date.now();
 const membership={tenantId:'org_synthetic',actorId:'user_synthetic',status:'active',role:'standard_user',permissions:[],clientIds:['11111111-1111-4111-8111-000000000005'],membershipRevision:'m1',checkedAtMs:now,expiresAtMs:now+60000};
 const core=coreValuesFromMembership(membership,{identityCredentialPath:join(tmpdir(),'identity'),frontendOrigin:'https://frontend.synthetic.invalid',nowMs:now});
 assert.deepEqual({tenantId:core.tenantId,actorId:core.actorId,clientId:core.clientId,coreOrigin:core.coreOrigin},
  {tenantId:'org_synthetic',actorId:'user_synthetic',clientId:'11111111-1111-4111-8111-000000000005',coreOrigin:'https://first-chat-preview.app-dev.capiro.ai'});
 assert.throws(()=>coreValuesFromMembership({...membership,status:'suspended'},{identityCredentialPath:join(tmpdir(),'identity'),frontendOrigin:'https://f.invalid'}),/STAGE3_BINDING_REFUSED/u);
 assert.throws(()=>coreValuesFromMembership({...membership,clientIds:[...membership.clientIds,'22222222-2222-4222-8222-000000000005']},{identityCredentialPath:join(tmpdir(),'identity'),frontendOrigin:'https://f.invalid'}),/--client-id/u);
 assert.deepEqual(parseVersionsTsv(ROLES.map(r=>`${r}\t${SECRET_VERSIONS[r]}`).join('\n')),SECRET_VERSIONS);
 assert.throws(()=>parseVersionsTsv('control\ta\ncontrol\tb'),/STAGE3_BINDING_REFUSED/u);
 const plan=deployPlan(synth.sizes,'/w/b');
 assert.deepEqual(Object.keys(plan),['issuer','app'],'issuer gate, then application');
 for(const key of STAGE3_DEPLOY_ORDER)assert.deepEqual(plan[key].wait.slice(0,4),['aws','cloudformation','wait','stack-update-complete']);
 assert.equal(plan.app.command.includes('--no-execute-changeset'),true);
 for(const key of ['app','issuer'])assert.equal(plan[key].command.includes('--s3-bucket'),synth.sizes[key].viaS3);
 // The private readiness probe: runner execution role and log group, the Node runtime image, no secret, no task role.
 const {inputs,foundationOutputs,rendered}=await setup(),probe=probeTaskDefinition({deployment:inputs.deployment,foundationOutputs,renderSummary:rendered.summary});
 new vm.Script(PROBE_PROGRAM);assert.equal(probe.runtimePlatform.cpuArchitecture,'ARM64');assert.equal(probe.executionRoleArn,foundationOutputs.RunnerExecutionRoleArn);assert.equal(probe.taskRoleArn,undefined);
 assert.equal(probe.containerDefinitions.length,1);assert.equal(probe.containerDefinitions[0].secrets,undefined);assert.equal(probe.containerDefinitions[0].image,inputs.deployment.images.nodeRuntime);
 assert.equal(probe.containerDefinitions[0].logConfiguration.options['awslogs-group'],foundationOutputs.RunnerLogGroupName);
 assert.deepEqual(probe.containerDefinitions[0].environment,[{name:'MERI_PROBE_CA_BASE64',value:rendered.summary.runnerPoststart.MERI_POSTSTART_CA_BASE64}]);
 const e=bindings.expectedTaskDefinitions;
 const outputs={app:outputsObject([{OutputKey:'ControlTaskDefinitionArn',OutputValue:e.control},{OutputKey:'TemporalWorkerTaskDefinitionArn',OutputValue:e['temporal-worker']},{OutputKey:'RunnerTaskDefinitionArn',OutputValue:e.runner}]),
  issuer:{TemporalIssuerTaskDefinitionArn:e['temporal-issuer']}};
 assert.equal(verifyOutputs({expectedTaskDefinitions:e,...outputs}).length,4);
 assert.throws(()=>verifyOutputs({expectedTaskDefinitions:e,...outputs,issuer:{TemporalIssuerTaskDefinitionArn:e['temporal-issuer'].replace(/:4$/u,':5')}}),/re-render/u);
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
  for(const key of ['app','issuer'])assert.deepEqual(JSON.parse(await readFile(join(work,'bindings',`${key}.binding.json`),'utf8')),(await setup()).bindings[key]);
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

test('live stacks: every update keeps issuer, control and worker serving, control one task at a time after the runner',async()=>{
 const {synth:{templates:t},bindings,args}=await setup();
 const svc=(template,id)=>template.Resources[id];
 for(const [template,id] of [[t.app,'controlService'],[t.app,'temporalWorkerService'],[t.issuer,'TemporalIssuerService']])
  assert.equal(svc(template,id).Properties.DesiredCount,1,id);
 const control=svc(t.app,'controlService');
 assert.deepEqual(control.Properties.DeploymentConfiguration,{MaximumPercent:100,MinimumHealthyPercent:0});
 assert.equal(control.Properties.AvailabilityZoneRebalancing,'DISABLED','ECS refuses max 100 while AZ rebalancing is ENABLED');
 assert.deepEqual(control.DependsOn,['runnerTask']);
 assert.equal(svc(t.app,'temporalWorkerService').Properties.AvailabilityZoneRebalancing,undefined,'only control changes deployment shape');
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
