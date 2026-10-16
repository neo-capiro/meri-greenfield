import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createObjectivePreparedFactsReader} from './prepared-facts-reader.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {hash,sourceAdmissionDigest} from '../../../packages/runtime/objective-generation-custody.mjs';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const NOW=1792065600000;
const sha=value=>createHash('sha256').update(value).digest('hex');

function fixture(){
 const binding={tenantId:id(1),actorId:id(2),conversationId:id(10),runId:id(11),attemptId:id(12),workerId:id(13),writerFence:1};
 const request=JSON.parse(readFileSync(new URL('../../../packages/contracts/strategy-operations-candidate/fixtures/strategy.draft.request.json',import.meta.url),'utf8'));
 Object.assign(request,{requestId:id(20),jobId:id(21),originalExpiresAtMs:NOW+200000});
 Object.assign(request.principal,{tenantId:binding.tenantId,actorId:binding.actorId,clientId:id(3),ownerActorId:binding.actorId});
 Object.assign(request.source,{objectiveId:id(4),objectiveRevisionId:id(5),objectiveVersion:2});
 const acceptedRequest={requestId:request.requestId,prompt:'Prepare a synthetic strategy.',window:null,windowRequest:null,skill:null};
 const canonical={canonicalPlanId:id(6),tenantId:binding.tenantId,clientId:request.principal.clientId,objectiveId:request.source.objectiveId,canonicalStrategyId:id(7),canonicalProjectId:id(8),bindingVersion:1,epoch:1,requestedIntentId:id(9),requestedObjectiveRevisionId:request.source.objectiveRevisionId,requestedObjectiveVersion:request.source.objectiveVersion,snapshotHash:request.source.snapshotSha256};
 const sourceAdmission={schemaVersion:1,namespace:'capiro.objective-strategy.admission:v1',canonical,actorUserId:id(14),clerkUserId:binding.actorId,consentId:id(15),controlVersion:1,generationJobId:request.jobId,generationRequestId:request.requestId,admittedAtMs:NOW-1000,effectExpiresAtMs:NOW+150000,expectedStrategyVersionId:null};
 const objectiveGeneration={sourceAdmission,sourceAdmissionSha256:sourceAdmissionDigest(sourceAdmission)};
 const objectiveStrategy={schemaVersion:1,operation:'strategy.draft',request,requestSha256:hash(request),executionContext:{schemaVersion:1,prompt:acceptedRequest.prompt,promptSha256:sha(Buffer.from(acceptedRequest.prompt,'utf8')),ownerRefs:[{ownerRef:request.context.ownerRefs[0],clerkUserId:binding.actorId}],contextPacketId:request.context.packetId},queuedType:null,executionSelection:{provider:'aws-bedrock',model:'synthetic-model'}};
 const original=createExecutionBinding({binding,versions,plan:{purpose:'synthetic-objective'},expiresAtMs:NOW+100000});
 const facts={original,allocationSha256:'a'.repeat(64),taskRequestSha256:'b'.repeat(64),grantIntents:[{grantId:id(30),capabilitySha256:'c'.repeat(64),expiresAtMs:original.expiresAtMs}],qualification:{policyRevision:'synthetic-policy'},objectiveGeneration,objectiveStrategy};
 const factsSha256=hash(facts),issuance={issuanceKey:hash(binding),binding,requestSha256:hash(acceptedRequest),expiresAtMs:original.expiresAtMs,grantId:id(30),capabilitySha256:'c'.repeat(64),factsSha256},issued={issuance,...facts,factsSha256};
 const record={state:'ADMITTED',original,allocationSha256:facts.allocationSha256,taskRequestSha256:facts.taskRequestSha256,grantIntents:facts.grantIntents,resource:{taskArn:'arn:aws:ecs:us-east-1:967807252336:task/synthetic/'+'d'.repeat(32)}};
 const core={binding,sourceRequestSha256:issuance.requestSha256,objectiveGeneration,objectiveStrategy,checkedAtMs:NOW,expiresAtMs:NOW+5000};
 const state={request:structuredClone(acceptedRequest),run:{binding,state:'running',scopes:[{tenantId:binding.tenantId,kind:'client',resourceId:canonical.clientId,policyRevision:'synthetic-policy'}],policyRevision:'synthetic-policy',versions},issuance:structuredClone(issuance),record:structuredClone(record),core:structuredClone(core),task:{taskArn:record.resource.taskArn,imageSha256:versions.imageDigest.slice(7),runnerSha256:'e'.repeat(64),checkedAtMs:NOW,expiresAtMs:original.expiresAtMs},calls:{run:0,issuance:0,allocation:0,task:0,core:0}};
 const ports={store:{async read(){state.calls.run++;return {run:state.run,request:state.request};},allocations:{async read(){state.calls.allocation++;return {record:state.record};}}},issuance:{async readIssuance(){state.calls.issuance++;return state.issuance;}},taskProof:{async verifyTask(){state.calls.task++;return state.task;}},coreCurrent:{async readCurrent(){state.calls.core++;return state.core;}}};
 const create=(options={})=>createObjectivePreparedFactsReader({issued,store:ports.store,issuance:ports.issuance,taskProof:ports.taskProof,coreCurrent:ports.coreCurrent,enabled:true,now:()=>NOW,maxRequestMs:1000,...options});
 return {binding,issued,ports,state,create};
}

test('one immutable issued entry is returned only after fresh run, issuance, allocation, task and Core reads',async()=>{
 const f=fixture(),reader=f.create();assert.equal(reader.available(),true);
 const expected=structuredClone(f.issued);f.issued.objectiveStrategy.executionSelection.model='late caller mutation';
 assert.deepEqual(await reader.read({binding:f.binding}),expected);
 assert.deepEqual(f.state.calls,{run:3,issuance:3,allocation:3,task:1,core:1});
});

test('missing owner or disabled reader has no source effects',async()=>{
 for(const options of [{coreCurrent:undefined},{taskProof:undefined},{enabled:false}]){
  const f=fixture(),reader=f.create(options);assert.equal(reader.available(),false);await assert.rejects(reader.read({binding:f.binding}),/OBJECTIVE_TYPED_RESULT_REFUSED/);assert.deepEqual(f.state.calls,{run:0,issuance:0,allocation:0,task:0,core:0});
 }
});

test('current accepted request, durable issuance and facts hash must still equal the captured entry',async()=>{
 for(const mutate of [f=>{f.state.request.prompt='changed';},f=>{f.state.issuance.factsSha256='f'.repeat(64);},f=>{f.state.run.state='completed';},f=>{f.state.run.policyRevision='other';}]){
  const f=fixture(),reader=f.create();mutate(f);await assert.rejects(reader.read({binding:f.binding}),/OBJECTIVE_TYPED_RESULT_REFUSED/);assert.equal(f.state.calls.core,0);
 }
 const f=fixture(),bad=structuredClone(f.issued);bad.factsSha256='f'.repeat(64);bad.issuance.factsSha256=bad.factsSha256;
 assert.throws(()=>f.create({issued:bad}),/OBJECTIVE_TYPED_RESULT_REFUSED/);
});

test('allocation or task identity drift refuses before Core disclosure',async()=>{
 for(const mutate of [f=>{f.state.record.state='RETIRED';},f=>{f.state.record.allocationSha256='f'.repeat(64);},f=>{f.state.record.resource.taskArn='foreign-task';},f=>{f.state.task.taskArn='foreign-task';},f=>{f.state.task.imageSha256='f'.repeat(64);},f=>{f.state.task.expiresAtMs=NOW-1;}]){
  const f=fixture(),reader=f.create();mutate(f);await assert.rejects(reader.read({binding:f.binding}),/OBJECTIVE_TYPED_RESULT_REFUSED/);assert.equal(f.state.calls.core,0);
 }
});

test('Core current read must match the exact protected pair and fresh source binding',async()=>{
 for(const mutate of [f=>{f.state.core.binding.runId=id(99);},f=>{f.state.core.sourceRequestSha256='f'.repeat(64);},f=>{f.state.core.objectiveStrategy.executionSelection.model='other';},f=>{f.state.core.objectiveGeneration.sourceAdmission.canonical.clientId=id(99);},f=>{f.state.core.expiresAtMs=NOW;},f=>{f.state.core.checkedAtMs=NOW+1;}]){
  const f=fixture(),reader=f.create();mutate(f);await assert.rejects(reader.read({binding:f.binding}),/OBJECTIVE_TYPED_RESULT_REFUSED/);assert.equal(f.state.calls.core,1);
 }
});

test('source drift while Core currentness is read refuses the captured entry',async()=>{
 for(const mutate of [f=>{f.state.request.prompt='later request';},f=>{f.state.issuance.factsSha256='f'.repeat(64);},f=>{f.state.record.resource.taskArn='later-task';},f=>{f.state.record.resource.createdAtMs=NOW+1;}]){
  const f=fixture();f.ports.coreCurrent.readCurrent=async function(){f.state.calls.core++;mutate(f);return f.state.core;};
  const reader=f.create();await assert.rejects(reader.read({binding:f.binding}),/OBJECTIVE_TYPED_RESULT_REFUSED/);assert.equal(f.state.calls.core,1);
 }
});
