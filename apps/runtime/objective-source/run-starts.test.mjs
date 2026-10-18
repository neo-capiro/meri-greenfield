/** Pure D7-4 run-start record checks. No database, Core, issuer or Temporal is involved. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {objectiveRunIdentity,objectiveAcceptedRequest,assertObjectiveRunSelection,createObjectiveRunStartRecord,assertObjectiveRunStartRecord,
 objectiveRunStartColumns,decodeObjectiveRunStartRow} from './run-starts.mjs';
import {runStartFixture,id,NOW} from './test/run-start-fixture.mjs';
const refused=/OBJECTIVE_RUN_START_REFUSED/u;

test('one job derives exactly one stable original binding; any input change derives another',()=>{
 const a=objectiveRunIdentity({tenantId:id(1),actorId:id(2),generationJobId:id(21)}),b=objectiveRunIdentity({tenantId:id(1),actorId:id(2),generationJobId:id(21)});
 assert.deepEqual(a,b);assert.equal(a.binding.writerFence,1);assert.ok(Object.isFrozen(a.binding));
 const ids=[a.binding.conversationId,a.binding.runId,a.binding.attemptId,a.binding.workerId,a.eventId];assert.equal(new Set(ids).size,5);
 for(const v of ids)assert.match(v,/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
 for(const change of [{tenantId:id(9)},{actorId:id(9)},{generationJobId:id(9)}])
  assert.notEqual(objectiveRunIdentity({tenantId:id(1),actorId:id(2),generationJobId:id(21),...change}).binding.conversationId,a.binding.conversationId);
 for(const bad of [{tenantId:'',actorId:id(2),generationJobId:id(21)},{tenantId:id(1),actorId:' x',generationJobId:id(21)},{tenantId:id(1),actorId:id(2),generationJobId:'job'},
  {tenantId:id(1),actorId:id(2),generationJobId:id(21),runId:id(3)},null])assert.throws(()=>objectiveRunIdentity(bad),refused);
});

test('a valid selection yields a closed immutable record; the accepted request is Core request ID plus published prompt',()=>{
 const f=runStartFixture();
 assert.deepEqual(f.acceptedRequest,{requestId:id(20),prompt:'Synthetic Objective source only.',skill:null,window:null,windowRequest:null});
 const r=f.record;assert.ok(Object.isFrozen(r));
 assert.deepEqual(Object.keys(r),['schemaVersion','generationJobId','binding','sourceAdmissionSha256','sourceRequestSha256','typedRequestSha256','selectionSha256','effectExpiresAtMs','selection']);
 assert.equal(r.sourceRequestSha256,hash(f.acceptedRequest));assert.equal(r.typedRequestSha256,hash(f.selection.request));assert.equal(r.selectionSha256,hash(f.selection));
 assert.equal(r.effectExpiresAtMs,NOW+150000,'the earlier of Core effect expiry and the typed request original expiry');
 assert.deepEqual(assertObjectiveRunStartRecord(structuredClone(r)),r);
 assert.equal(JSON.stringify(r).includes('meri-objective-run-start-validation'),false,'the validation-only execution stand-in is never stored');
 const checked=assertObjectiveRunSelection(f.selection,{binding:f.binding,nowMs:NOW});assert.equal(checked.clientId,f.clientId);
});

test('selection refusals: foreign binding, other job, drifted prompt, expired window, extra member, other actor',()=>{
 const f=runStartFixture(),base={binding:f.binding,generationJobId:f.generationJobId,selection:f.selection,nowMs:NOW};
 const cases=[
  {...base,binding:{...f.binding,runId:id(99)}},
  {...base,binding:runStartFixture({generationJobId:id(22)}).binding},
  {...base,generationJobId:id(22)},
  {...base,selection:{...f.selection,executionContext:{...f.selection.executionContext,prompt:'changed'}}},
  {...base,nowMs:NOW+150000},
  {...base,selection:{...f.selection,executionSelection:{provider:'x',model:'y'}}},
  {...base,selection:{...f.selection,queuedType:'earmark'}},
  {...base,selection:{...f.selection,sourceAdmission:{...f.selection.sourceAdmission,clerkUserId:id(77)}}},
  {...base,nowMs:'now'},
 ];
 for(const value of cases)assert.throws(()=>createObjectiveRunStartRecord(value),refused);
 assert.throws(()=>objectiveAcceptedRequest({...f.selection,executionContext:{...f.selection.executionContext,prompt:' '}}),refused);
});

test('stored record integrity is recomputed without a clock, so an expired start still decodes for history',()=>{
 const f=runStartFixture(),r=structuredClone(f.record);
 assert.deepEqual(assertObjectiveRunStartRecord(r),f.record);
 for(const change of [x=>{x.selectionSha256='0'.repeat(64);},x=>{x.sourceRequestSha256='0'.repeat(64);},x=>{x.effectExpiresAtMs+=1;},x=>{x.schemaVersion=2;},
  x=>{x.binding.attemptId=id(70);},x=>{x.extra=1;},x=>{x.selection.queuedType='earmark';}]){const bad=structuredClone(f.record);change(bad);assert.throws(()=>assertObjectiveRunStartRecord(bad),refused);}
});

test('columns duplicate the record exactly and decoding refuses any drift or foreign tenant',()=>{
 const f=runStartFixture(),c=objectiveRunStartColumns(f.record,{tenantId:f.tenantId});
 assert.equal(c.issuance_key,hash(f.binding),'the issuance key the issuer and custody use');assert.equal(c.record_sha256,hash(f.record));
 const row={...structuredClone(c),effect_expires_at_ms:String(c.effect_expires_at_ms),created_at:new Date(NOW)};
 assert.deepEqual(decodeObjectiveRunStartRow(row,{tenantId:f.tenantId}),f.record);
 assert.throws(()=>objectiveRunStartColumns(f.record,{tenantId:id(9)}),refused);
 for(const change of [r=>{r.issuance_key='0'.repeat(64);},r=>{r.run_id=id(70);},r=>{r.effect_expires_at_ms='1.5';},r=>{r.record_sha256='0'.repeat(64);},
  r=>{r.created_at='not-a-date';},r=>{r.binding={...r.binding,writerFence:2};},r=>{r.extra=1;}]){const bad=structuredClone(row);change(bad);assert.throws(()=>decodeObjectiveRunStartRow(bad,{tenantId:f.tenantId}),refused);}
});
