/** Pure splice-reader checks over a synthetic run-start read port, the actual protected-facts compiler and an inert base fact
 * set. No issuer, database, task or model grant is involved. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertIssuedObjectiveProtectedFacts} from './protected-facts.mjs';
import {createObjectiveRunStartFacts} from './run-start-facts.mjs';
import {runStartFixture,id,NOW} from './test/run-start-fixture.mjs';
const refused=/OBJECTIVE_RUN_START_FACTS_REFUSED/u;

function setup(){
 const f=runStartFixture(),policyRevision='c'.repeat(64),versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
 const run={binding:f.binding,state:'queued',scopes:[{tenantId:f.tenantId,kind:'client',resourceId:f.clientId,policyRevision}],createdAt:new Date(NOW-1000).toISOString(),policyRevision,versions};
 const accepted={run,request:f.acceptedRequest},issuance={issuanceKey:hash(f.binding),binding:f.binding,requestSha256:hash(f.acceptedRequest),expiresAtMs:NOW+100000,grantId:id(30),capabilitySha256:'d'.repeat(64)};
 const base={original:{binding:f.binding,executionKey:hash(f.binding),executionId:hash(f.binding),planSha256:'e'.repeat(64),expiresAtMs:issuance.expiresAtMs,versions},
  allocationSha256:'f'.repeat(64),taskRequestSha256:'1'.repeat(64),qualification:{attempt:1,policyRevision},grantIntents:[{grantId:issuance.grantId,capabilitySha256:issuance.capabilitySha256,expiresAtMs:issuance.expiresAtMs}],
  grantId:issuance.grantId,operations:['load'],controlCapabilitySha256:'2'.repeat(64),transport:{origin:'https://synthetic-control.example',http:{hostname:'127.0.0.1',port:8443,frontendOrigin:'https://synthetic-control.example'}}};
 const port={answer:{state:'STARTED',record:structuredClone(f.record)},reads:[],async read(q){this.reads.push(q);if(this.answer instanceof Error)throw this.answer;return structuredClone(this.answer);}};
 const input={accepted,issuance,preparedFacts:{...base,factsSha256:hash(base)},executionSelection:{provider:'synthetic-provider',model:'synthetic-model'},nowMs:NOW};
 return {f,accepted,issuance,base,port,input,facts:createObjectiveRunStartFacts({runStarts:port})};
}

test('a STARTED run is decorated with the protected pair from the stored selection and the issued execution selection',async()=>{
 const s=setup(),out=await s.facts.decorate(s.input);
 assert.deepEqual(s.port.reads.map(q=>q.binding),[s.f.binding]);
 assert.equal(out.facts.objectiveGeneration.sourceAdmissionSha256,s.f.record.sourceAdmissionSha256);
 assert.equal(out.facts.objectiveStrategy.requestSha256,s.f.record.typedRequestSha256);
 assert.deepEqual(out.facts.objectiveStrategy.executionSelection,s.input.executionSelection);
 assert.equal(out.bindFactsInput.factsSha256,out.facts.factsSha256);assert.notEqual(out.facts.factsSha256,s.input.preparedFacts.factsSha256);
 assert.equal(JSON.stringify(out).includes('meri-objective-run-start-validation'),false);
 const {factsSha256,...rest}=out.facts;
 assert.ok(assertIssuedObjectiveProtectedFacts({issuance:{...s.issuance,factsSha256},...rest,factsSha256},{accepted:s.accepted}),'the issued entry passes the historical validator');
});

test('reconstruction after ISSUED rebuilds the identical pair without a clock, so base plus pair matches the bound digest',async()=>{
 const s=setup(),out=await s.facts.decorate(s.input);s.input.nowMs=Number.MAX_SAFE_INTEGER;
 const pair=await s.facts.pairFor({binding:s.f.binding,executionSelection:s.input.executionSelection});
 assert.equal(hash({...s.base,...pair}),out.facts.factsSha256);assert.notEqual(hash(s.base),out.facts.factsSha256,'base facts alone never match a pair-bearing receipt');
 s.port.answer={state:'ABSENT'};assert.equal(await s.facts.pairFor({binding:s.f.binding,executionSelection:s.input.executionSelection}),null);
 s.port.answer={state:'UNKNOWN'};await assert.rejects(s.facts.pairFor({binding:s.f.binding,executionSelection:s.input.executionSelection}),refused);
});

test('ABSENT is ordinary chat (null, nothing compiled); UNKNOWN, read failure or a foreign row refuse and never downgrade',async()=>{
 const s=setup();s.port.answer={state:'ABSENT'};assert.equal(await s.facts.decorate(s.input),null);
 for(const answer of [{state:'UNKNOWN'},Object.assign(Error('down'),{code:'OBJECTIVE_RUN_START_UNAVAILABLE'}),{state:'STARTED',record:runStartFixture({generationJobId:id(22)}).record},{state:'STARTED'}]){
  const t=setup();t.port.answer=answer;await assert.rejects(t.facts.decorate(t.input),refused);
 }
});

test('drift between the stored start and the accepted run or issuance refuses',async()=>{
 const changes=[
  s=>{s.input.accepted={...s.accepted,request:{...s.accepted.request,prompt:'ordinary prompt'}};},
  s=>{s.input.issuance={...s.issuance,expiresAtMs:s.f.record.effectExpiresAtMs+1};},
  s=>{s.input.executionSelection={provider:'',model:'m'};},
  s=>{s.input.accepted={...s.accepted,run:{...s.accepted.run,scopes:[{...s.accepted.run.scopes[0],resourceId:id(77)}]}};},
  s=>{s.input.nowMs=s.issuance.expiresAtMs;},
 ];
 for(const change of changes){const s=setup();change(s);await assert.rejects(s.facts.decorate(s.input),refused);}
 assert.throws(()=>createObjectiveRunStartFacts({runStarts:{}}),refused);
});
