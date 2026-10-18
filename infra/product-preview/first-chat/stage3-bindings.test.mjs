/** Stage 3 bindings on THROWAWAY material: render-material.fixture.mjs renders all five roles from a fresh pki.py PKI (synthetic
 * passwords and Core credential), stage3-bindings builds every binding from the real foundation/private-edge outputs plus fake
 * secret VersionIds and scan hashes in their real formats, and all three templates synthesize through their own validators.
 * Needs MERI_REVIEW_SOURCE_ROOT=<worktree root> and Python 3 with `cryptography`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRenderFixture} from './render-material.fixture.mjs';
import {PATHS,ROLES,writeRendered} from './render-material.mjs';
import {STAGE3_FAMILIES,STAGE3_EXISTING,nextRevisions,stage3RenderInput,buildStage3Bindings,synthesizeStage3} from './stage3-bindings.mjs';
import {parseLatestTsv,coreValuesFromMembership,tenantBudgetOverrides,TENANT_BUDGET_PROGRAM,parseVersionsTsv,outputsObject,deployPlan,verifyOutputs,probeTaskDefinition,PROBE_PROGRAM,main} from './stage3-deploy.mjs';
import {productWorkerTrustsPinnedServerCa} from '../../../apps/runtime/cli.mjs';

const here=fileURLToPath(new URL('.',import.meta.url));
const load=async name=>JSON.parse(await readFile(join(here,name),'utf8'));
const fixture=createRenderFixture();
test.after(()=>fixture.cleanup());
const fakeVersion=n=>`${String(n).repeat(8)}-aaaa-4bbb-8ccc-${String(n).repeat(12)}`;
const SECRET_VERSIONS=Object.fromEntries(ROLES.map((role,i)=>[role,fakeVersion(i+1)]));
const SCANS={proxy:'c'.repeat(64),nodeRuntime:'d'.repeat(64)};
const LATEST=[...Object.values(STAGE3_FAMILIES).flatMap(f=>[`${f}\tNone`,`${f}\tNone`])].join('\n').replace(
 'meri-product-preview-temporal-issuer\tNone','meri-product-preview-temporal-issuer\tarn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-temporal-issuer:3')+'\n';

let state;
async function setup(){
 if(state)return state;
 const inputs=await fixture.setup(),foundationOutputs=await load('foundation-outputs.json');
 const revisions=nextRevisions(parseLatestTsv(LATEST));
 const stage3=stage3RenderInput({deployment:inputs.deployment,foundationOutputs,revisions});
 const rendered=await fixture.render(i=>{i.stage3=structuredClone(stage3);});
 const privateEdgeOutputs={ControlPrivateOrigin:inputs.deployment.privateEdge.controlPrivateOrigin,
  ControlPrivateTargetGroupArn:inputs.deployment.privateEdge.controlPrivateTargetGroupArn,PrivateAlbSecurityGroupId:inputs.deployment.privateEdge.privateAlbSecurityGroupId};
 const args={deployment:inputs.deployment,foundationOutputs,privateEdgeOutputs,renderSummary:rendered.summary,
  renderedExpected:Object.fromEntries(ROLES.map(role=>[role,rendered.roles[role].expected])),secretVersions:SECRET_VERSIONS,imageScans:SCANS};
 const bindings=buildStage3Bindings(structuredClone(args));
 state={inputs,foundationOutputs,revisions,stage3,rendered,args,bindings,synth:synthesizeStage3(bindings)};
 return state;
}
const resources=(template,type)=>Object.values(template.Resources).filter(r=>r.Type===type).map(r=>r.Properties);
const env=(container,name)=>(container.Environment??[]).find(e=>e.Name===name)?.Value;
const sameSet=(a,b)=>assert.deepEqual([...a].sort(),[...b].sort());

test('revisions: new families start at 1, an existing family continues after its highest ACTIVE/INACTIVE revision',async()=>{
 const {revisions,stage3}=await setup();
 assert.deepEqual(revisions,{control:1,'temporal-worker':1,'temporal-issuer':4,'model-owner':1,'model-proxy':1,runner:1});
 assert.equal(stage3.taskDefinitions['temporal-issuer'],'arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-temporal-issuer:4');
 assert.equal(stage3.services['model-owner'],'arn:aws:ecs:us-east-1:967807252336:service/capiro-dev/meri-product-preview-owner');
 assert.throws(()=>nextRevisions({control:['arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-control-x:9']}),/STAGE3_BINDING_REFUSED/u);
 assert.throws(()=>parseLatestTsv('meri-product-preview-control\tNone\n'),/STAGE3_BINDING_REFUSED/u);
});

test('all three bindings pass their renderers: app (control, worker, runner), model (proxy, owner) and the issuer re-render',async ctx=>{
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
 const control=services.find(s=>s.ServiceName==='meri-product-preview-control');
 assert.deepEqual(control.LoadBalancers,[{ContainerName:'control',ContainerPort:8082,TargetGroupArn:inputs.deployment.privateEdge.controlPrivateTargetGroupArn}]);
 assert.equal(JSON.stringify(t.app).includes(f.ControlTargetGroupArn),false,'the public 8080 target group is Stage 6');
 sameSet(control.NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,[f.ControlSecurityGroupId,f.IssuerClientSecurityGroupId,f.DbClientSecurityGroupId]);
 sameSet(services.find(s=>s.ServiceName==='meri-product-preview-temporal-worker').NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,[f.WorkerSecurityGroupId,f.IssuerClientSecurityGroupId]);
 assert.equal(t.app.Outputs.RunnerSecurityGroupIds.Value,f.RunnerSecurityGroupId);
 // (b) model: foundation roles, log groups, Cloud Map registries and ENI sets.
 const model=resources(t.model,'AWS::ECS::Service'),proxy=model.find(s=>s.ServiceName==='meri-product-preview-proxy'),owner=model.find(s=>s.ServiceName==='meri-product-preview-owner');
 assert.deepEqual(proxy.ServiceRegistries,[{RegistryArn:f.ProxyDiscoveryServiceArn}]);assert.deepEqual(owner.ServiceRegistries,[{RegistryArn:f.OwnerDiscoveryServiceArn}]);
 assert.deepEqual(proxy.NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,[f.ProxySecurityGroupId]);
 assert.deepEqual(owner.NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,[f.OwnerSecurityGroupId,f.DbClientSecurityGroupId]);
 assert.equal(t.model.Metadata.ProxyImageScanSha256,SCANS.proxy);assert.equal(t.model.Metadata.NodeRuntimeScanSha256,SCANS.nodeRuntime);
 // (c) issuer: still desired 1, now on the Node runtime image with the new material version.
 const issuer=t.issuer.Resources.TemporalIssuerService.Properties,issuerTask=t.issuer.Resources.TemporalIssuerTask.Properties;
 assert.equal(issuer.DesiredCount,1);assert.equal(issuerTask.ContainerDefinitions[1].Image,inputs.deployment.images.nodeRuntime);
 assert.equal(issuerTask.ContainerDefinitions[0].Secrets[0].ValueFrom,`${inputs.deployment.secrets['issuer/material']}:::${SECRET_VERSIONS['temporal-issuer']}`);
 assert.equal(bindings.stacks.app,'meri-first-chat-app');assert.equal(bindings.stacks.model,'meri-first-chat-model');assert.equal(bindings.stacks.issuer,'meri-first-chat-issuer');
});

test('rendered configs and the synthesized task definitions agree: issuer and owner pins, worker CA trust, runner poststart',async()=>{
 const {synth:{templates:t},rendered,stage3,revisions}=await setup();
 const config=role=>JSON.parse(rendered.roles[role].configBytes.toString('utf8'));
 const tasks=[...resources(t.app,'AWS::ECS::TaskDefinition'),...resources(t.model,'AWS::ECS::TaskDefinition'),t.issuer.Resources.TemporalIssuerTask.Properties];
 const services=[...resources(t.app,'AWS::ECS::Service'),...resources(t.model,'AWS::ECS::Service')];
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
 // Owner serviceTasks pins equal the model template.
 const serviceTasks=config('model-owner').serviceTasks;
 for(const key of ['owner','proxy']){
  const pin=serviceTasks[key],task=byFamily(pin.taskDefinitionArn.split('/')[1].split(':')[0]),c=main(task),svc=serviceOf(pin.serviceArn);
  assert.equal(task.ExecutionRoleArn,pin.executionRoleArn,key);assert.equal(task.TaskRoleArn,pin.taskRoleArn,key);assert.equal(c.Name,pin.containerName);assert.equal(c.Image,pin.imageUri);
  assert.deepEqual(svc.NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,pin.securityGroupIds);assert.deepEqual(svc.NetworkConfiguration.AwsvpcConfiguration.Subnets,pin.subnetIds);
 }
 // Control's runner RunTask request names the runner family, container and the one runner SG.
 const request=config('control').nativeCandidate.taskRequest,runner=byFamily('meri-product-preview-runner');
 assert.equal(request.taskDefinition,stage3.taskDefinitions.runner);assert.equal(main(runner).Name,request.overrides.containerOverrides[0].name);
 assert.equal(t.app.Outputs.RunnerPrivateSubnetId.Value,request.networkConfiguration.awsvpcConfiguration.subnets[0]);
 assert.equal(t.app.Outputs.RunnerSecurityGroupIds.Value,request.networkConfiguration.awsvpcConfiguration.securityGroups.join(','));
 // Worker NODE_EXTRA_CA_CERTS is rendered by the manifest (token writers configured) and satisfies the cli.mjs product gate.
 const worker=main(byFamily('meri-product-preview-temporal-worker'));
 assert.equal(env(worker,'NODE_EXTRA_CA_CERTS'),PATHS.issuerCa);assert.equal(env(worker,'NODE_EXTRA_CA_CERTS'),rendered.summary.worker.NODE_EXTRA_CA_CERTS);
 assert.equal(productWorkerTrustsPinnedServerCa(config('temporal-worker'),{NODE_EXTRA_CA_CERTS:env(worker,'NODE_EXTRA_CA_CERTS')}),true);
 // Runner environment equals the render wiring exactly; material-init envelopes and config pins equal the render.
 assert.deepEqual(main(runner).Environment.map(e=>({name:e.Name,value:e.Value})),rendered.summary.wiring.runner.environment);
 for(const [family,role] of [['meri-product-preview-control','control'],['meri-product-preview-temporal-worker','temporal-worker'],['meri-product-preview-owner','model-owner'],['meri-product-preview-proxy','model-proxy'],['meri-product-preview-temporal-issuer','temporal-issuer']]){
  const init=byFamily(family).ContainerDefinitions[0];
  assert.equal(init.Name,'material-init');assert.deepEqual(JSON.parse(env(init,'MERI_STATIC_MATERIAL_EXPECTED')),rendered.roles[role].expected,role);
  assert.match(init.Secrets[0].ValueFrom,new RegExp(`:::${SECRET_VERSIONS[role]}$`,'u'));
 }
 assert.equal(env(main(byFamily('meri-product-preview-owner')),'MERI_PRODUCT_OWNER_CONFIG_SHA256'),rendered.roles['model-owner'].configSha256);
 assert.deepEqual(main(byFamily('meri-product-preview-proxy')).Command,['--config','/run/meri/proxy.json','--config-sha256',rendered.roles['model-proxy'].configSha256]);
 assert.deepEqual(main(byFamily('meri-product-preview-temporal-issuer')).Command,['--config','/run/meri/issuer.json','--config-sha256',rendered.roles['temporal-issuer'].configSha256]);
});

test('existing infrastructure facts the bindings rely on hold in the reviewed foundation sources',async()=>{
 const template=await load('foundation.template.json'),binding=await load('foundation-binding.json'),temporal=await load('temporal-binding.json');
 assert.equal(STAGE3_EXISTING.endpointSecurityGroupId,binding.endpointSecurityGroupId);
 assert.equal(STAGE3_EXISTING.endpointSecurityGroupId,temporal.network.interfaceEndpoints.secretsManager.securityGroupId);
 const policy=Object.values(template.Resources).find(r=>r.Type==='AWS::IAM::Policy'&&JSON.stringify(r.Properties).includes('iam:PassRole'));
 const pass=policy.Properties.PolicyDocument.Statement.find(s=>s.Action==='iam:PassRole');
 const passed=template.Resources[pass.Resource['Fn::GetAtt'][0]];
 assert.equal(passed.Properties.RoleName,STAGE3_EXISTING.runnerExecutionRoleName,'control may pass exactly the runner execution role');
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
 refused(x=>{x.renderedExpected['model-owner'].materialContractSha256='0'.repeat(64);});
 refused(x=>{x.secretVersions['model-proxy']='AWSCURRENT';});
 refused(x=>{delete x.secretVersions.control;});
 refused(x=>{x.imageScans.proxy='PENDING';});
 refused(x=>{x.renderSummary.roles['temporal-issuer'].taskDefinitionArn='arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-issuer:1';});
 refused(x=>{x.renderSummary.runnerPoststart.MERI_POSTSTART_CONTROL_ORIGIN='https://other.meri-preview.internal';});
 refused(x=>{x.deployment.images.nodeRuntime=x.deployment.images.nodeRuntime.replace(/@sha256:[a-f0-9]{64}$/u,'@sha256:'+'e'.repeat(64));});
 // The renderer still refuses what the builder cannot see: a swapped execution role fails the manifest.
 const {bindings}=await setup(),x=structuredClone(bindings);x.app.executionRoleArns.runner=x.app.controlTaskRoleArn;
 assert.throws(()=>synthesizeStage3(x),/PRODUCT_PREVIEW_BINDING_REFUSED/u);
});

test('deploy plumbing: core values from a membership receipt, tenant budget overrides, versions, outputs and verification',async()=>{
 const {bindings,synth}=await setup(),now=Date.now();
 const membership={tenantId:'org_synthetic',actorId:'user_synthetic',status:'active',role:'standard_user',permissions:[],clientIds:['11111111-1111-4111-8111-000000000005'],membershipRevision:'m1',checkedAtMs:now,expiresAtMs:now+60000};
 const core=coreValuesFromMembership(membership,{identityCredentialPath:join(tmpdir(),'identity'),frontendOrigin:'https://frontend.synthetic.invalid',nowMs:now});
 assert.deepEqual({tenantId:core.tenantId,actorId:core.actorId,clientId:core.clientId,coreOrigin:core.coreOrigin},
  {tenantId:'org_synthetic',actorId:'user_synthetic',clientId:'11111111-1111-4111-8111-000000000005',coreOrigin:'https://first-chat-preview.app-dev.capiro.ai'});
 assert.throws(()=>coreValuesFromMembership({...membership,status:'suspended'},{identityCredentialPath:join(tmpdir(),'identity'),frontendOrigin:'https://f.invalid'}),/STAGE3_BINDING_REFUSED/u);
 assert.throws(()=>coreValuesFromMembership({...membership,clientIds:[...membership.clientIds,'22222222-2222-4222-8222-000000000005']},{identityCredentialPath:join(tmpdir(),'identity'),frontendOrigin:'https://f.invalid'}),/--client-id/u);
 const overrides=tenantBudgetOverrides(core,{containerName:'d2-migrate'}),o=overrides.containerOverrides[0];
 assert.equal(o.name,'d2-migrate');assert.deepEqual(o.environment.map(e=>e.name),['MERI_TENANT_ID','MERI_STAGE3_PROGRAM']);
 assert.ok(JSON.stringify(overrides).length<8192,'RunTask overrides limit');new vm.Script(TENANT_BUDGET_PROGRAM);
 assert.match(TENANT_BUDGET_PROGRAM,/INSERT INTO meri_product_budget\.tenant_budgets \(tenant_id, monthly_cap_micro_usd, max_concurrent_runs\)/u);
 assert.match(TENANT_BUDGET_PROGRAM,/cap='25000000',runs=2/u);
 assert.deepEqual(parseVersionsTsv(ROLES.map(r=>`${r}\t${SECRET_VERSIONS[r]}`).join('\n')),SECRET_VERSIONS);
 assert.throws(()=>parseVersionsTsv('control\ta\ncontrol\tb'),/STAGE3_BINDING_REFUSED/u);
 const plan=deployPlan(synth.sizes,'/w/b');
 assert.equal(plan.model.command.includes('CAPABILITY_IAM'),true);assert.equal(plan.app.command.includes('--no-execute-changeset'),true);
 for(const key of ['app','model','issuer'])assert.equal(plan[key].command.includes('--s3-bucket'),synth.sizes[key].viaS3);
 // The private readiness probe: runner execution role and log group, the Node runtime image, no secret, no task role.
 const {inputs,foundationOutputs,rendered}=await setup(),probe=probeTaskDefinition({deployment:inputs.deployment,foundationOutputs,renderSummary:rendered.summary});
 new vm.Script(PROBE_PROGRAM);assert.equal(probe.executionRoleArn,foundationOutputs.RunnerExecutionRoleArn);assert.equal(probe.taskRoleArn,undefined);
 assert.equal(probe.containerDefinitions.length,1);assert.equal(probe.containerDefinitions[0].secrets,undefined);assert.equal(probe.containerDefinitions[0].image,inputs.deployment.images.nodeRuntime);
 assert.equal(probe.containerDefinitions[0].logConfiguration.options['awslogs-group'],foundationOutputs.RunnerLogGroupName);
 assert.deepEqual(probe.containerDefinitions[0].environment,[{name:'MERI_PROBE_CA_BASE64',value:rendered.summary.runnerPoststart.MERI_POSTSTART_CA_BASE64}]);
 const e=bindings.expectedTaskDefinitions;
 const outputs={app:outputsObject([{OutputKey:'ControlTaskDefinitionArn',OutputValue:e.control},{OutputKey:'TemporalWorkerTaskDefinitionArn',OutputValue:e['temporal-worker']},{OutputKey:'RunnerTaskDefinitionArn',OutputValue:e.runner}]),
  model:{ModelOwnerTaskDefinitionArn:e['model-owner'],ModelProxyTaskDefinitionArn:e['model-proxy']},issuer:{TemporalIssuerTaskDefinitionArn:e['temporal-issuer']}};
 assert.equal(verifyOutputs({expectedTaskDefinitions:e,...outputs}).length,6);
 assert.throws(()=>verifyOutputs({expectedTaskDefinitions:e,...outputs,issuer:{TemporalIssuerTaskDefinitionArn:e['temporal-issuer'].replace(/:4$/u,':5')}}),/re-render/u);
});

test('CLI writes stage3.json, bindings, templates and the deploy plan outside the repository',async()=>{
 const {inputs,rendered,args}=await setup(),work=await mkdtemp(join(tmpdir(),'meri-stage3-cli-'));
 try{
  const quiet=async argv=>{const lines=[];const code=await main(argv,{out:t=>lines.push(t),err:t=>lines.push(t)});return {code,text:lines.join('')};};
  await writeFile(join(work,'deployment.json'),JSON.stringify(inputs.deployment));await writeFile(join(work,'latest.tsv'),LATEST);
  const foundation=join(here,'foundation-outputs.json');
  let r=await quiet(['stage3-input','--deployment-inputs',join(work,'deployment.json'),'--foundation-outputs',foundation,'--latest',join(work,'latest.tsv'),'--out',join(work,'stage3.json')]);
  assert.equal(r.code,0,r.text);assert.deepEqual(JSON.parse(await readFile(join(work,'stage3.json'),'utf8')),(await setup()).stage3);
  const out=await writeRendered(join(work,'rendered'),rendered);
  await writeFile(join(work,'versions.tsv'),ROLES.map(role=>`${role}\t${SECRET_VERSIONS[role]}`).join('\n')+'\n');
  await writeFile(join(work,'scans.json'),JSON.stringify(SCANS));
  await writeFile(join(work,'edge.json'),JSON.stringify(Object.entries(args.privateEdgeOutputs).map(([OutputKey,OutputValue])=>({OutputKey,OutputValue}))));
  r=await quiet(['bindings','--deployment-inputs',join(work,'deployment.json'),'--foundation-outputs',foundation,'--private-edge-outputs',join(work,'edge.json'),
   '--rendered',out,'--secret-versions',join(work,'versions.tsv'),'--image-scans',join(work,'scans.json'),'--out',join(work,'bindings')]);
  assert.equal(r.code,0,r.text);assert.match(r.text,/STAGE3_BINDINGS_WRITTEN/u);
  for(const key of ['app','model','issuer'])assert.deepEqual(JSON.parse(await readFile(join(work,'bindings',`${key}.binding.json`),'utf8')),(await setup()).bindings[key]);
  // The output carries no secret: no bundle bytes, password or identity credential.
  const text=r.text+await readFile(join(work,'bindings','app.template.json'),'utf8');
  for(const secret of ['synthetic-control','synthetic-core-identity-bearer-not-real','PRIVATE KEY'])assert.equal(text.includes(secret),false,secret);
  r=await quiet(['bindings','--deployment-inputs',join(work,'deployment.json'),'--foundation-outputs',foundation,'--private-edge-outputs',join(work,'edge.json'),
   '--rendered',out,'--secret-versions',join(work,'versions.tsv'),'--image-scans',join(work,'scans.json'),'--out',join(here,'should-not-exist')]);
  assert.equal(r.code,2);assert.match(r.text,/outside the repository/u);
 }finally{await rm(work,{recursive:true,force:true});}
});
