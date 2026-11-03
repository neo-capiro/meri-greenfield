import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {operatorCaseFixture,cleanupOperatorFixture} from '../../../apps/runtime/test/browser-operator-fixture.mjs';
import {renderOperatorCaseMaterial} from './render-material.mjs';
import {operatorCaseStage3Input,composeOperatorCaseStartup,compileOperatorCaseBindings} from './operator-case-bindings.mjs';
import {operatorCaseNames,createOperatorControlAdmission} from '../../../apps/runtime/operator-control-configuration.mjs';
import {startControl} from '../../../apps/runtime/control.mjs';
import {renderMaterial} from './render-material.mjs';
import {synthesizeOperatorAgentCoreRuntime} from '../agentcore-runtime.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),caseId='a123456789ab',n=operatorCaseNames(caseId),account='967807252336';
const arn=name=>`arn:aws:secretsmanager:us-east-1:${account}:secret:synthetic/${name}-Abc123`;
const tg=name=>`arn:aws:elasticloadbalancing:us-east-1:${account}:targetgroup/${name}/${'a'.repeat(16)}`;
const capability=Buffer.from('synthetic-case-control-capability-'.repeat(2)),productionHash=sha('synthetic-production-capability-'.repeat(2));
after(cleanupOperatorFixture);
async function fixture(){
 const c=await operatorCaseFixture({binding:{tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:'synthetic-conversation'}});
 const i={...c.inputs,deployment:structuredClone(c.inputs.deployment)},d=i.deployment;
 const production={temporal:{...d.temporal,address:d.origins.temporalAddress},secretArns:[...Object.values(d.secrets)],
  trafficSecurityGroupIds:[d.foundation.ControlSecurityGroupId,d.foundation.WorkerSecurityGroupId],targetGroupArns:[d.privateEdge.controlPrivateTargetGroupArn,tg('production-host')],runtimeArn:d.agentcore.runtimeArn,
  controlCaSha256:sha('synthetic-production-ca'),controlCapabilitySha256:productionHash};
 const edge={CaseControlSecurityGroupId:'sg-11111111111111111',CaseClientSecurityGroupId:'sg-22222222222222222',ControlPrivateTargetGroupArn:tg(`${n.prefix}-8082`),HostListenerTargetGroupArn:tg(`${n.prefix}-host`)};
 d.temporal.taskQueue=n.queue;d.agentcore={...d.agentcore,runtimeArn:`arn:aws:bedrock-agentcore:us-east-1:${account}:runtime/${n.runtime}-synthetic`,qualifier:'case'};
 d.features.browserActivation={state:'held'};
 Object.assign(d.foundation,{ControlTaskRoleArn:`arn:aws:iam::${account}:role/MeriCase-${caseId}-control`,WorkerTaskRoleArn:`arn:aws:iam::${account}:role/MeriCase-${caseId}-worker`});
 Object.assign(d.foundation,{ControlExecutionRoleArn:`arn:aws:iam::${account}:role/MeriCase-${caseId}-control-execution`,WorkerExecutionRoleArn:`arn:aws:iam::${account}:role/MeriCase-${caseId}-worker-execution`});
 d.secrets['control/material']=arn('case-control');d.secrets['worker/material']=arn('case-worker');
 i.stage3=operatorCaseStage3Input({caseId,deployment:d,edge,revisions:{control:1,'temporal-worker':1}});
 const rendered=renderOperatorCaseMaterial({...i,nowMs:Date.now(),validityDays:1/24},{caseId,controlCapability:capability,productionControlCapabilitySha256:productionHash});
 const startup=composeOperatorCaseStartup({caseId,rendered,observerMaterial:c.material,selection:c.selection,expiresAtMs:c.expiresAtMs,productionControlCapabilitySha256:productionHash});
 return {caseId,deployment:d,rendered,startup,edge,production,versions:{control:'1'.repeat(32),'temporal-worker':'2'.repeat(32),'operator-control':'3'.repeat(32),'operator-worker':'4'.repeat(32)},
  operatorSecrets:{control:arn('case-control-startup'),'temporal-worker':arn('case-worker-callback')},network:{temporalFrontendSecurityGroupId:'sg-33333333333333333'},inputs:i,case:c};
}
test('real renderer reaches protected Control startup and isolated once-only task definitions',async()=>{
 const f=await fixture(),b=compileOperatorCaseBindings(f),r=Object.values(b.template.Resources);
 assert.equal(r.filter(x=>x.Type==='AWS::ECS::TaskDefinition').length,2);assert.equal(r.filter(x=>x.Type==='AWS::ECS::Service').length,0);
 for(const task of r.filter(x=>x.Type==='AWS::ECS::TaskDefinition').map(x=>x.Properties)){
  assert(task.Family.startsWith(n.prefix));const app=task.ContainerDefinitions.find(x=>x.Essential),init=task.ContainerDefinitions.find(x=>x.Name==='operator-material-init');
  assert.deepEqual(app.EntryPoint,['node','apps/runtime/operator-case-entrypoint.mjs']);
  assert.deepEqual(app.MountPoints.find(m=>m.ContainerPath==='/run/meri-operator'),{ContainerPath:'/run/meri-operator',SourceVolume:'operator-material',ReadOnly:true});
  assert.deepEqual(init.MountPoints,[{ContainerPath:'/run/meri-operator',SourceVolume:'operator-material',ReadOnly:false}]);
  assert.equal(app.Secrets,undefined);assert(!app.Environment.some(e=>e.Name==='MERI_OPERATOR_MATERIAL_BUNDLE'));
  assert.equal(init.Secrets.length,1);assert(!init.MountPoints.some(m=>m.ContainerPath==='/run/meri'));
 }
 assert.equal(f.rendered.roles.control.config.temporal.taskQueue,n.queue);assert.equal(f.rendered.roles['temporal-worker'].config.temporal.taskQueue,n.queue);
 assert.deepEqual(f.rendered.summary.wiring.control.entryPoint,['node','apps/runtime/operator-case-entrypoint.mjs']);
 assert.equal(b.execution.automaticReplacement,false);assert(!JSON.stringify(b.template).includes('meri-product-preview-control'));
});
test('refuses ordinary queue, credentials, targets, groups, runtime and secret references',async()=>{
 const f=await fixture();
 for(const mutate of [x=>x.production.temporal.taskQueue=n.queue,x=>x.production.controlCapabilitySha256=sha(capability),
  x=>x.production.targetGroupArns.push(x.edge.ControlPrivateTargetGroupArn),x=>x.production.trafficSecurityGroupIds.push(x.edge.CaseClientSecurityGroupId),
  x=>x.production.secretArns.push(x.operatorSecrets.control),x=>x.production.runtimeArn=x.rendered.roles.control.config.agentcore.runtimeArn,
  x=>x.startup.control.expected.sha256ByPath['/run/meri/control.json']='a'.repeat(64),x=>x.deployment.foundation.ControlTaskRoleArn=`arn:aws:iam::${account}:role/MeriPreview-control-task`,
  x=>x.deployment.foundation.DbClientSecurityGroupId=x.production.trafficSecurityGroupIds[0],x=>x.deployment.foundation.ControlExecutionRoleArn=`arn:aws:iam::${account}:role/MeriPreview-control-execution`]){
  const {case:unused,inputs,...plain}=f,x=structuredClone(plain);mutate(x);assert.throws(()=>compileOperatorCaseBindings(x));
 }
 assert.throws(()=>renderOperatorCaseMaterial(f.inputs,{caseId,controlCapability:capability,productionControlCapabilitySha256:sha(capability)}));
 assert.throws(()=>renderMaterial(f.inputs));assert.throws(()=>startControl(f.rendered.roles.control.config));
});
test('runtime Control join refuses a changed queue, credential, source or stale admission before startup',async()=>{
 const f=await fixture(),descriptor=JSON.parse(Buffer.from(f.startup.control.bundle.files[0].base64,'base64')),c=f.rendered.roles.control.config;
 assert.throws(()=>createOperatorControlAdmission(descriptor,c,Buffer.from('foreign-control-capability-'.repeat(2)),descriptor.sourceCommit));
 assert.throws(()=>createOperatorControlAdmission(descriptor,c,capability,'0'.repeat(40)));
 const wrong=structuredClone(c);wrong.temporal.taskQueue=f.production.temporal.taskQueue;
 assert.throws(()=>createOperatorControlAdmission(descriptor,wrong,capability,descriptor.sourceCommit));
 assert.throws(()=>createOperatorControlAdmission({...descriptor,expiresAtMs:1},c,capability,descriptor.sourceCommit));
});
test('case AgentCore is separate and carries only pinned public callback material',async()=>{
 const f=await fixture(),callback=JSON.parse(Buffer.from(f.startup.agentcore.bundle.files[0].base64,'base64'));
 const b={imageUri:f.deployment.images.nodeRuntime,sourceCommit:f.deployment.images.nodeRuntimeSourceCommit,vpcId:f.deployment.vpcId,privateSubnetIds:f.deployment.privateSubnetIds,
  controlTaskRoleName:`MeriCase-${caseId}-control`,controlOrigin:callback.origin,controlCaBase64:Buffer.from(callback.caCertificate).toString('base64'),controlCaSha256:sha(callback.caCertificate),
  bedrock:[{inferenceProfileArn:`arn:aws:bedrock:us-east-1:${account}:inference-profile/us.anthropic.claude-sonnet-4-6`,foundationModelArns:['arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6'],countTokensModelArn:'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6'}],claudeApiSecretArn:null};
 const o={caseId,clientSecurityGroupId:f.edge.CaseClientSecurityGroupId,delivery:f.startup.agentcore,commonImageUri:b.imageUri.replace(/@sha256:.+$/u,'@sha256:'+'8'.repeat(64))};
 const t=synthesizeOperatorAgentCoreRuntime(b,o),runtime=t.Resources.Runtime.Properties;
 assert.equal(runtime.AgentRuntimeName,n.runtime);assert(runtime.NetworkConfiguration.NetworkModeConfig.SecurityGroups.includes(o.clientSecurityGroupId));
 assert.equal(runtime.EnvironmentVariables.MERI_CONTROL_ORIGIN,undefined);assert(!JSON.stringify(t).includes(capability.toString()));
 const policy=Object.values(t.Resources).find(x=>x.Type==='AWS::IAM::Policy'&&x.Properties.PolicyName===`MeriCase-${caseId}-Invocation`);
 assert.deepEqual(policy.Properties.Roles,[b.controlTaskRoleName]);
 assert.throws(()=>synthesizeOperatorAgentCoreRuntime({...b,controlTaskRoleName:'MeriPreview-control-task'},o));
 assert.throws(()=>synthesizeOperatorAgentCoreRuntime(b,{...o,commonImageUri:b.imageUri}));
});
