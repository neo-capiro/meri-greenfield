import test from 'node:test';
import {createHash} from 'node:crypto';
import {compilePreparedRunFacts} from '../../prepared-run-issuance.mjs';
import assert from 'node:assert/strict';
import {candidateFixture} from '../../test/prepared-candidate-fixture.mjs';
import {createRenderFixture} from '../../../../infra/product-preview/first-chat/render-material.fixture.mjs';
import {createExecutionBinding} from '../../../control/conversations/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {compilePreparedRunConfigurationSha256} from '../../prepared-run-configuration.mjs';
import {compileHistoricalStopFacts,assertHistoricalStopFacts,matchHistoricalStopAllocation} from '../historical-stop-facts.mjs';

function fixture(){
 const f=candidateFixture(),c=f.configuration.nativeCandidate,original=createExecutionBinding({
  binding:f.binding,versions:c.runtime.versions,plan:{qualified:'old first-chat workload'},expiresAtMs:c.runtime.deadlineMs
 });
 // N21's product renderer uses the runner poststart ENTRYPOINT with command ['start'].
 c.taskRequest.overrides.containerOverrides[0].command=['start'];
 const input={schemaVersion:1,original,allocationJson:c.allocationJson,taskRequest:c.taskRequest,
  containerName:c.containerName,qualification:c.qualification,grantIntents:c.grantIntents,
  configurationSha256:hash({qualified:'old configuration'}),effectiveDescriptorSha256:hash({effective:'old admission'})};
 const capsule=compileHistoricalStopFacts(input),record={binding:original.binding,allocationKey:original.executionKey,
  original,allocationSha256:capsule.allocationSha256,qualification:c.qualification,grantIntents:c.grantIntents,
  taskRequestSha256:capsule.taskRequestSha256,expiresAtMs:original.expiresAtMs,state:'CLAIMED',resource:null};
 return {f,input,capsule,record};
}

test('closed capsule retains exact old stop inputs and only derived canonical hashes',()=>{
 const {f,input,capsule}=fixture();
 assert.equal(capsule.allocationSha256,hash(JSON.parse(input.allocationJson)));
 assert.deepEqual(assertHistoricalStopFacts(structuredClone(capsule)),capsule);
 assert.equal(Object.isFrozen(capsule),true);
 const serialized=JSON.stringify(capsule);
 for(const credential of Object.values(f.secret))assert.equal(serialized.includes(credential),false);
 for(const forbidden of ['proxyCredential','taskCapability','controlCapability','credentialFile'])assert.equal(Object.hasOwn(capsule,forbidden),false);
});

test('N21 first-chat renderer emits the exact admitted command and allocation shape',async t=>{
 const renderer=createRenderFixture();t.after(()=>renderer.cleanup());
 const {roles}=await renderer.render(),control=roles.control.config,c=control.nativeCandidate;
 const original=createExecutionBinding({binding:c.runtime.binding,versions:c.runtime.versions,
  plan:{qualified:'rendered first-chat workload'},expiresAtMs:c.runtime.deadlineMs});
 const capsule=compileHistoricalStopFacts({schemaVersion:1,original,allocationJson:c.allocationJson,
  taskRequest:c.taskRequest,containerName:c.containerName,qualification:c.qualification,
  grantIntents:c.grantIntents,configurationSha256:compilePreparedRunConfigurationSha256(control),
  effectiveDescriptorSha256:hash({originalAdmission:original.binding})});
 assert.deepEqual(c.taskRequest.overrides.containerOverrides[0].command,['start']);
 assert.deepEqual(c.taskRequest.overrides.containerOverrides[0].environment,[]);
 assert.equal(capsule.allocationSha256,hash(JSON.parse(c.allocationJson)));
 assert.deepEqual(assertHistoricalStopFacts(capsule),capsule);
});

test('allocation hash follows parsed canonical semantics across JSONB key reordering',()=>{
 const {input,capsule}=fixture(),parsed=JSON.parse(input.allocationJson),reordered={
  schedule:parsed.schedule,budgets:parsed.budgets,catalogSha256:parsed.catalogSha256,
  manifestSha256:parsed.manifestSha256,manifest:parsed.manifest,run:parsed.run
 };
 const other=compileHistoricalStopFacts({...input,allocationJson:JSON.stringify(reordered,null,2)});
 assert.equal(other.allocationSha256,capsule.allocationSha256);
 assert.notEqual(other.allocationJson,capsule.allocationJson);
 assert.deepEqual(assertHistoricalStopFacts(other),other);
});

test('historical Stop facts match an old allocation with no resource after a dispatch uncertainty',()=>{
 const {capsule,record}=fixture();
 assert.deepEqual(matchHistoricalStopAllocation(capsule,record),capsule);
 assert.deepEqual(matchHistoricalStopAllocation(capsule,{...record,state:'UNKNOWN'}),capsule);
 assert.throws(()=>matchHistoricalStopAllocation(capsule,{...record,state:'ALLOCATED'}),{code:'HISTORICAL_STOP_FACTS_REFUSED'});
});

test('saved resource is bound to the old cluster, definition, container and original',()=>{
 const {capsule,record}=fixture(),resource={taskArn:'arn:aws:ecs:us-east-1:967807252336:task/meri-greenfield-qualification/'+'a'.repeat(32),
  clusterArn:capsule.taskRequest.cluster,taskDefinitionArn:capsule.taskRequest.taskDefinition,
  containerName:capsule.containerName,createdAtMs:capsule.original.expiresAtMs-100};
 assert.deepEqual(matchHistoricalStopAllocation(capsule,{...record,state:'ALLOCATED',resource}),capsule);
 for(const changed of [{...resource,clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/other'},
  {...resource,taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/other:1'},
  {...resource,containerName:'other'}])assert.throws(()=>matchHistoricalStopAllocation(capsule,{...record,state:'ALLOCATED',resource:changed}),{code:'HISTORICAL_STOP_FACTS_REFUSED'});
});

test('credential-bearing and unreviewed command surfaces refuse before a capsule exists',()=>{
 const {input}=fixture();
 for(const change of [
  x=>{x.taskRequest.overrides.containerOverrides[0].environment=[{name:'MERI_PROXY_CREDENTIAL',value:'secret'}];},
  x=>{x.taskRequest.overrides.containerOverrides[0].environment=[{name:'MERI_CONFIG_PATH',value:'/run/meri/task.json'}];},
  x=>{x.taskRequest.overrides.containerOverrides[0].command.push('--token=secret');},
  x=>{x.taskRequest.overrides.containerOverrides[0].command=['conversation-runner','--config','/run/meri/task.json'];},
  x=>{x.proxyCredential='secret';},
  x=>{x.taskRequest.credential='secret';}
 ]){const changed=structuredClone(input);change(changed);assert.throws(()=>compileHistoricalStopFacts(changed),{code:'HISTORICAL_STOP_FACTS_REFUSED'});}
});

test('old intent, configuration lineage, grant, request and derived digest drift refuse',()=>{
 const {input,capsule,record}=fixture();
 for(const change of [
  x=>{x.configurationSha256='invalid';},
  x=>{x.effectiveDescriptorSha256='invalid';},
  x=>{x.grantIntents[0].grantId=x.grantIntents[1].grantId;},
  x=>{const a=JSON.parse(x.allocationJson);a.run.runId='00000000-0000-4000-8000-000000000099';x.allocationJson=JSON.stringify(a);},
  x=>{x.taskRequest.networkConfiguration.awsvpcConfiguration.subnets=['subnet-ffff'];}
 ]){const changed=structuredClone(input);change(changed);
  if(changed.taskRequest.networkConfiguration.awsvpcConfiguration.subnets[0]==='subnet-ffff'){
   assert.notEqual(compileHistoricalStopFacts(changed).taskRequestSha256,capsule.taskRequestSha256);
  }else assert.throws(()=>compileHistoricalStopFacts(changed),{code:'HISTORICAL_STOP_FACTS_REFUSED'});
 }
 const changedImage=structuredClone(input);changedImage.original.versions.imageDigest='sha256:'+'f'.repeat(64);
 const changedImageCapsule=compileHistoricalStopFacts(changedImage);
 assert.throws(()=>matchHistoricalStopAllocation(changedImageCapsule,record),{code:'HISTORICAL_STOP_FACTS_REFUSED'});
 assert.throws(()=>assertHistoricalStopFacts({...capsule,allocationSha256:'f'.repeat(64)}),{code:'HISTORICAL_STOP_FACTS_REFUSED'});
 assert.throws(()=>assertHistoricalStopFacts({...capsule,taskRequestSha256:'f'.repeat(64)}),{code:'HISTORICAL_STOP_FACTS_REFUSED'});
 for(const changed of [{...record,original:{...record.original,planSha256:'f'.repeat(64)}},
  {...record,allocationSha256:'f'.repeat(64)},
  {...record,taskRequestSha256:'f'.repeat(64)},
  {...record,grantIntents:record.grantIntents.map((g,i)=>i?g:{...g,grantId:'00000000-0000-4000-8000-000000000098'})}])
  assert.throws(()=>matchHistoricalStopAllocation(capsule,changed),{code:'HISTORICAL_STOP_FACTS_REFUSED'});
});

function custodyFixture(){
 const x=fixture(),c=x.f.configuration.nativeCandidate,{configurationSha256,effectiveDescriptorSha256,...base}=x.input;
 const issuedFacts={original:base.original,allocationSha256:x.capsule.allocationSha256,taskRequestSha256:x.capsule.taskRequestSha256,qualification:base.qualification,grantIntents:base.grantIntents,grantId:c.grantId,operations:c.operations,controlCapabilitySha256:hash({control:'original nonsecret digest'}),transport:{origin:c.taskOrigin,http:c.taskHttp}};
 const grant=base.grantIntents.find(g=>g.grantId===c.grantId),issuance={issuanceKey:base.original.executionKey,binding:base.original.binding,requestSha256:hash({request:'immutable original'}),expiresAtMs:base.original.expiresAtMs,...grant,factsSha256:hash(issuedFacts)};
 const input={...base,schemaVersion:2,issuance,issuedFacts},capsule=compileHistoricalStopFacts(input);
 return {...x,input,capsule,record:{...x.record,retirementFacts:capsule}};
}
test('MR01 v2 custody retains the exact issuance projection with no credential material',()=>{
 const {f,input,capsule,record}=custodyFixture();assert.deepEqual(assertHistoricalStopFacts(capsule),capsule);assert.deepEqual(matchHistoricalStopAllocation(capsule,record),capsule);
 assert.equal(hash(capsule.issuedFacts),input.issuance.factsSha256);assert.equal(Object.hasOwn(capsule,'configurationSha256'),false);
 for(const secret of Object.values(f.secret))assert.equal(JSON.stringify(capsule).includes(secret),false);
});
test('MR01 v2 custody refuses coherent receipt, fact, secret and immutable-intent substitutions',()=>{
 const {input,capsule,record}=custodyFixture();
 for(const change of [x=>{x.issuance.requestSha256='invalid';},x=>{x.issuance.binding.writerFence++;},x=>{x.issuance.factsSha256='f'.repeat(64);},x=>{x.issuedFacts.original.planSha256='f'.repeat(64);},x=>{x.issuedFacts.controlCapabilitySha256=x.grantIntents[0].capabilitySha256;},x=>{x.issuedFacts.transport.http.frontendOrigin='https://other.invalid';},x=>{x.issuedFacts.proxyCredential='SYNTHETIC-PRIVATE-MATERIAL';},x=>{x.taskRequest.overrides.containerOverrides[0].environment.push({name:'TOKEN',value:'SYNTHETIC-PRIVATE-MATERIAL'});},x=>{x.issuedFacts.objectiveStrategy={credential:'SYNTHETIC-PRIVATE-MATERIAL'};}]){
  const changed=structuredClone(input);change(changed);if(changed.issuance.factsSha256===input.issuance.factsSha256)changed.issuance.factsSha256=hash(changed.issuedFacts);
  assert.throws(()=>compileHistoricalStopFacts(changed),{code:'HISTORICAL_STOP_FACTS_REFUSED'});
 }
 const changed=structuredClone(record);changed.retirementFacts.issuance.requestSha256='e'.repeat(64);assert.throws(()=>matchHistoricalStopAllocation(capsule,changed));
});
