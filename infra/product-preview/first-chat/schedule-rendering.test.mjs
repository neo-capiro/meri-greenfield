/** Optional schedule service through the actual material, binding and deployment owners. Synthetic inputs only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createRenderFixture,addScheduleBindings} from './render-material.fixture.mjs';
import {ALL_ROLES,PATHS,assertProductCliGates,readPrivateDirectory,renderMaterial} from './render-material.mjs';
import {ALL_STAGE3_FAMILIES,buildStage3Bindings,synthesizeStage3,nextRevisions} from './stage3-bindings.mjs';
import {parseLatestTsv,uploadPlan,parseVersionsTsv,verifyOutputs} from './stage3-deploy.mjs';
import {releaseSteps,buildShipPacket} from './ship-packet.mjs';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM} from '../../../apps/runtime/product-ports/capability-policy.mjs';

const fixture=createRenderFixture();test.after(()=>fixture.cleanup());
const serviceSecretArn='arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/core/internal_service_secret-Syn123';
const serviceSecret=Buffer.from('synthetic-schedule-core-service-secret');
const featureSecrets={'reads.serviceSecret':{secretArn:serviceSecretArn,versionId:'1'.repeat(32),bytes:serviceSecret}};
const publicKey=generateKeyPairSync('ed25519').publicKey.export({format:'jwk'});
function scheduled(i){
 const platform=structuredClone(PROPOSED_PREVIEW_CAPABILITY_PLATFORM);
 for(const policy of [platform.maximum,platform.defaults,...Object.values(platform.roleCeilings)]){policy.generalReads=false;policy.activeReadOperations=[];}
 i.deployment.features={sourceEnabled:true,capabilityPlatform:platform,reads:{enabled:true,serviceSecretArn},routines:{enabled:true,
  task:{taskId:'11111111-1111-4111-8111-000000000009',version:1},workflow:{taskQueue:'synthetic-schedules',workflowIdPrefix:'synthetic/routine/'},
  core:{unattendedGrant:{issuer:'synthetic:core',kid:'grant-1',publicKey}}}};
 addScheduleBindings(i);
}
async function inputs(){const i=structuredClone(await fixture.setup());scheduled(i);return i;}
async function render(change=()=>{}){return fixture.render(i=>{scheduled(i);change(i);},{featureSecrets});}
const file=(rendered,role,path)=>Buffer.from(rendered.roles[role].bundle.files.find(f=>f.path===path).base64,'base64');
const version=n=>String(n).repeat(32);

test('schedule material uses the pinned schedule certificate, separate database credential, existing Core secret and two distinct queues',async()=>{
 const r=await render(),c=r.roles['schedule-worker'].config,control=r.roles.control.config;
 assert.deepEqual(Object.keys(r.roles),ALL_ROLES);assert.equal(c.sourceEnabled,false);
 assert.equal(c.temporal.taskQueue,control.routines.workflow.taskQueue);
 assert.equal(c.scheduledDispatch.conversationTaskQueue,control.temporal.taskQueue);
 assert.notEqual(c.temporal.taskQueue,c.scheduledDispatch.conversationTaskQueue);
 assert.equal(c.routines.task,undefined);assert.equal(c.routines.workflow,undefined);
 assert.equal(c.native.preparedKickoff,undefined);assert.equal(c.agentcore,undefined);
 assert.deepEqual(Object.keys(r.roles['schedule-worker'].expected.sha256ByPath).sort(),[PATHS.schedule,PATHS.database,PATHS.controlCapability,PATHS.readsServiceSecret,PATHS.temporalCa,PATHS.temporalCert,PATHS.temporalKey,PATHS.serverCa].sort());
 const pki=await readPrivateDirectory(fixture.pkiDir,{scheduleWorker:true});
 assert.deepEqual(file(r,'schedule-worker',PATHS.temporalCert),pki.certs['temporal-client-schedule']);
 assert.notDeepEqual(file(r,'schedule-worker',PATHS.temporalCert),file(r,'temporal-worker',PATHS.temporalCert));
 assert.notDeepEqual(file(r,'schedule-worker',PATHS.database),file(r,'control',PATHS.database));
 assert.deepEqual(file(r,'schedule-worker',PATHS.readsServiceSecret),serviceSecret);
 assert.equal(r.roles['temporal-worker'].expected.sha256ByPath[PATHS.readsServiceSecret],undefined);
 assert.doesNotThrow(()=>assertProductCliGates('schedule-worker',c,{NODE_EXTRA_CA_CERTS:PATHS.serverCa}));
 assert.throws(()=>assertProductCliGates('schedule-worker',c,{}),/PRODUCT_SCHEDULE_WORKER_REFUSED/);
});

test('schedule opt-in refuses missing canonical task/authority/role/material, shared queues and incorrect certificate ownership',async()=>{
 for(const change of [i=>{delete i.deployment.features.routines.task;},i=>{delete i.deployment.features.routines.core.unattendedGrant;},
  i=>{i.deployment.features.sourceEnabled=false;},i=>{delete i.deployment.database.roles.schedule;},
  i=>{i.deployment.database.roles.schedule=i.deployment.database.roles.control;},i=>{delete i.deployment.secrets['schedule/material'];},
  i=>{i.deployment.features.routines.workflow.taskQueue=i.deployment.temporal.taskQueue;},i=>{delete i.stage3.taskDefinitions['schedule-worker'];}])
  await assert.rejects(render(change),/RENDER_INPUT_REFUSED/);
 const i=await inputs(),pki=await readPrivateDirectory(fixture.pkiDir,{scheduleWorker:true});
 pki.certs['temporal-client-schedule']=pki.certs['temporal-client-worker'];pki.keys['temporal-client-schedule']=pki.keys['temporal-client-worker'];
 await assert.rejects(async()=>renderMaterial({...i,private:pki,featureSecrets}),/RENDER_PRIVATE_REFUSED/);
});

test('three role bundles bind upload versions, schedule network and service activation to exact task readbacks',async()=>{
 const i=await inputs(),rendered=await render(),d=i.deployment;
 const secretLabels=Object.fromEntries(['control/material','worker/material','schedule/material'].map(key=>[d.secrets[key],[{VersionId:'prior',VersionStages:['AWSCURRENT']}]]));
 const uploads=uploadPlan({deployment:d,renderedDirectory:'/synthetic/rendered',label:'SYNTHETIC_SCHEDULE',secretLabels,newToken:()=>version(9)});
 assert.deepEqual(uploads.map(r=>r.role),ALL_ROLES);assert.equal(new Set(uploads.map(r=>r.secretArn)).size,3);
 const secretVersions=parseVersionsTsv(ALL_ROLES.map((role,index)=>`${role}\t${version(index+1)}`).join('\n'));
 const args={deployment:d,foundationOutputs:d.foundation,
  privateEdgeOutputs:{ControlPrivateOrigin:d.privateEdge.controlPrivateOrigin,ControlPrivateTargetGroupArn:d.privateEdge.controlPrivateTargetGroupArn,PrivateAlbSecurityGroupId:d.privateEdge.privateAlbSecurityGroupId},
  renderSummary:rendered.summary,renderedExpected:Object.fromEntries(ALL_ROLES.map(role=>[role,rendered.roles[role].expected])),secretVersions,imageScans:{nodeRuntime:'d'.repeat(64)},
  liveAppTemplate:{Resources:{controlService:{Properties:{LoadBalancers:[{ContainerPort:8080,TargetGroupArn:d.foundation.ControlTargetGroupArn}]}}}}};
 const bindings=buildStage3Bindings(args),{templates}=synthesizeStage3(bindings),task=templates.app.Resources.scheduleWorkerTask.Properties,service=templates.app.Resources.scheduleWorkerService.Properties;
 assert.equal(service.DesiredCount,1);assert.equal(task.ExecutionRoleArn,d.foundation.ScheduleExecutionRoleArn);assert.equal(task.TaskRoleArn,undefined);
 assert.deepEqual(service.NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,[d.foundation.WorkerSecurityGroupId,d.foundation.DbClientSecurityGroupId]);
 assert.equal(task.ContainerDefinitions[0].Secrets[0].ValueFrom,`${d.secrets['schedule/material']}:::${version(3)}`);
 const app={ControlTaskDefinitionArn:i.stage3.taskDefinitions.control,TemporalWorkerTaskDefinitionArn:i.stage3.taskDefinitions['temporal-worker'],ScheduleWorkerTaskDefinitionArn:i.stage3.taskDefinitions['schedule-worker']};
 assert.equal(verifyOutputs({expectedTaskDefinitions:bindings.expectedTaskDefinitions,app}).length,3);
 delete app.ScheduleWorkerTaskDefinitionArn;assert.throws(()=>verifyOutputs({expectedTaskDefinitions:bindings.expectedTaskDefinitions,app}),/schedule-worker/);
 const wrong=structuredClone(args);delete wrong.secretVersions['schedule-worker'];assert.throws(()=>buildStage3Bindings(wrong),/secretVersions/);
 const steps=releaseSteps({deployment:d,stage3:i.stage3,upload:{label:'SYNTHETIC_SCHEDULE',roles:uploads},migrations:{stages:[],currentEntries:44},work:'/synthetic'});
 assert.equal(steps.find(s=>s.id==='readback').commands.length,6);
 assert.ok(steps.find(s=>s.id==='deploy-app').commands.some(c=>c.argv?.includes(ALL_STAGE3_FAMILIES['schedule-worker'])));
 assert.ok(steps.find(s=>s.id==='deploy-app').commands.some(c=>c.argv?.includes(d.foundation.ScheduleLogGroupName)));
 assert.match(steps.find(s=>s.id==='deploy-app').gate,/actual authorized scheduled occurrence/);
 const packetDeployment=structuredClone(d);packetDeployment.agentcore.runtimeArn='arn:aws:bedrock-agentcore:us-east-1:967807252336:runtime/meri_preview-0123456789';
 const receiptSha256='d'.repeat(64),packetInput={deployment:packetDeployment,previousDeployment:structuredClone(packetDeployment),runtime:i.runtime,
  operatorSource:{commit:'c'.repeat(40),tree:'d'.repeat(40)},
  receipt:{sourceCommit:d.images.nodeRuntimeSourceCommit,imageDigest:d.images.nodeRuntime.split('@')[1],sourceVersion:'synthetic-source-version',platform:'linux/arm64',scanStatus:'COMPLETE',findingSeverityCounts:{}},
  receiptSha256,imageScans:{nodeRuntime:receiptSha256},stage3:i.stage3,upload:{label:'SYNTHETIC_SCHEDULE',roles:uploads},
  migrations:{stages:[],currentEntries:1,previousEntries:1,added:[],required:false,integrationChanged:false},ceilingUsd:5,work:fixture.work,hashes:{}};
 packetInput.previousDeployment.images.nodeRuntime=packetDeployment.images.nodeRuntime.replace(/@sha256:[a-f0-9]{64}$/u,`@sha256:${'1'.repeat(64)}`);
 const packet=buildShipPacket(packetInput);assert.ok(packet.prerequisites.some(s=>s.includes('reviewed distinct database-role grants')));
 const incomplete=structuredClone(packetInput);incomplete.upload.roles.pop();assert.throws(()=>buildShipPacket(incomplete),/upload plan roles/);
});

test('schedule revision planning requires both live listing states and advances the existing family',()=>{
 const latest=ALL_ROLES.flatMap(role=>[`${ALL_STAGE3_FAMILIES[role]}\tarn:aws:ecs:us-east-1:967807252336:task-definition/${ALL_STAGE3_FAMILIES[role]}:4`,`${ALL_STAGE3_FAMILIES[role]}\tNone`]).join('\n');
 assert.equal(nextRevisions(parseLatestTsv(latest,{roles:ALL_ROLES}),{roles:ALL_ROLES})['schedule-worker'],5);
 assert.throws(()=>parseLatestTsv(latest.split('\n').slice(0,-1).join('\n'),{roles:ALL_ROLES}),/ACTIVE and INACTIVE/);
});
