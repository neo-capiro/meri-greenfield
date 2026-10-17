import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPreparedObjectiveSelection} from '../../../../packages/runtime/objective-generation-custody.mjs';
import {productFailure} from '../../product-access/errors.mjs';
import {createCoreObjectiveGenerationClient} from '../core-client.mjs';
import {coreRepliesFixture,NOW} from './core-replies-fixture.mjs';
const code=expected=>error=>productFailure(error)?.code===expected;
const unavailable=code('OBJECTIVE_GENERATION_CORE_UNAVAILABLE');
const unknown=error=>productFailure(error)?.code==='OBJECTIVE_GENERATION_CORE_OUTCOME_UNKNOWN'&&productFailure(error)?.outcome==='UNKNOWN';

/** Synthetic transport with the core-http.mjs method surface and reply envelope. */
function harness({replies={},available=true,clock=NOW}={}){
 const x=coreRepliesFixture(),calls=[],state={now:clock,available};
 const queue={admit:[x.replies.admit()],publish:[x.replies.publication()],accept:[x.replies.accept()],complete:[x.replies.completion()],readCompletion:[x.replies.completion()],
  readAdmission:[x.replies.admissionRead(),x.replies.admissionRead()],readRequest:[x.replies.publication()],...replies};
 const respond=method=>async value=>{calls.push({method,value});const next=queue[method].shift();
  if(next instanceof Error)throw next;if(next===undefined||next==='unavailable')return {kind:'unavailable'};
  return {kind:'unqualified-response',status:method.startsWith('read')?200:201,value:next};};
 const transport={available:()=>state.available,...Object.fromEntries(['admit','publish','accept','readAdmission','readRequest','complete','readCompletion'].map(m=>[m,respond(m)]))};
 const create=(options={})=>createCoreObjectiveGenerationClient({transport,source:x.source,executionSelection:x.executionSelection,issuance:x.issuance,now:()=>state.now,...options});
 return {x,calls,state,queue,transport,create};
}

test('construction refuses an incomplete transport, malformed source or bounds',()=>{
 const h=harness();
 for(const options of [{transport:{}},{source:{generationJobId:h.x.source.generationJobId}},{maxRequestMs:0},{maxFreshMs:30001},{now:1},{executionSelection:{provider:'p'}}])
  assert.throws(()=>h.create(options),unavailable);
});

test('effect phases return closed decoded Core replies in order',async()=>{
 const h=harness(),client=h.create(),admitted=await client.admit();
 assert.equal(admitted.sourceAdmissionSha256,h.x.sourceAdmissionSha256);
 const publication=await client.publish({admission:admitted.sourceAdmission});assert.equal(publication.queuedType,'appropriations');
 const accepted=await client.accept({admission:admitted.sourceAdmission,issuance:h.x.issuance});assert.deepEqual(accepted.issuance,h.x.issuance);
 assert.deepEqual(h.calls.map(c=>c.method),['admit','publish','accept']);
 assert.ok(h.calls.every(c=>Number.isSafeInteger(c.value.deadlineMs)&&c.value.deadlineMs===NOW+3000));
});

test('a missing or undecodable reply after an effect POST is UNKNOWN; after a read it is unavailable',async()=>{
 for(const reply of ['unavailable',Error('socket'),{schemaVersion:1}]){
  const h=harness({replies:{admit:[reply],readAdmission:[reply]}}),client=h.create();
  await assert.rejects(client.admit(),unknown);await assert.rejects(client.readAdmission(),unavailable);
 }
 const h=harness({replies:{accept:[{...coreRepliesFixture().replies.accept(),acceptedAtMs:NOW}]}});
 await assert.rejects(h.create().accept({admission:h.x.admission,issuance:h.x.issuance}),unknown);
});

test('readCurrent brackets the publication with two admission reads and returns the prepared-reader shape',async()=>{
 const h=harness(),client=h.create();
 const current=await client.readCurrent({binding:h.x.source.binding,generationJobId:h.x.source.generationJobId,sourceRequestSha256:h.x.issuance.requestSha256});
 assert.deepEqual(h.calls.map(c=>c.method),['readAdmission','readRequest','readAdmission']);
 assert.deepEqual(Object.keys(current).sort(),['binding','checkedAtMs','expiresAtMs','objectiveGeneration','objectiveStrategy','sourceRequestSha256']);
 assert.equal(current.checkedAtMs,NOW);assert.equal(current.expiresAtMs,NOW+3000,'bounded by the fresh read window');
 assert.deepEqual(current.objectiveStrategy.executionSelection,h.x.executionSelection);assert.deepEqual(current.binding,h.x.source.binding);
 const selected=assertPreparedObjectiveSelection({objectiveGeneration:current.objectiveGeneration,objectiveStrategy:current.objectiveStrategy},
  {binding:h.x.source.binding,acceptedRequest:h.x.f.accepted.request,expiresAtMs:h.x.issuance.expiresAtMs,nowMs:NOW});
 assert.equal(selected.sourceAdmissionSha256,h.x.sourceAdmissionSha256);
});

test('readCurrent refuses missing selection, unavailability, unaccepted job, drift and expiry',async()=>{
 const x=coreRepliesFixture(),input=h=>({binding:h.x.source.binding,generationJobId:h.x.source.generationJobId,sourceRequestSha256:h.x.issuance.requestSha256});
 const cases=[
  ['no execution selection',harness(),{executionSelection:undefined}],
  ['transport disabled',harness({available:false}),{}],
  ['acceptance not yet recorded',harness({replies:{readAdmission:[x.replies.admissionRead(null),x.replies.admissionRead(null)]}}),{}],
  ['admission changed between reads',harness({replies:{readAdmission:[x.replies.admissionRead(NOW),x.replies.admissionRead(NOW+1)]}}),{}],
  ['different original issuance',harness(),{issuance:{...x.issuance,grantId:'00000000-0000-4000-8000-000000000099'}}],
  ['publication unavailable',harness({replies:{readRequest:['unavailable']}}),{}],
  ['effect expired',harness({clock:x.admission.effectExpiresAtMs}),{}],
 ];
 for(const [name,h,options] of cases)await assert.rejects(h.create(options).readCurrent(input(h)),unavailable,name);
 const h=harness();
 await assert.rejects(h.create().readCurrent({...input(h),sourceRequestSha256:'0'.repeat(64)}),unavailable);
 await assert.rejects(h.create().readCurrent({...input(h),binding:{...h.x.source.binding,writerFence:2}}),unavailable);
 assert.equal(h.calls.length,1,'binding mismatch refuses before any Core read');
});

test('completion is an effect (UNKNOWN when lost) and readCompletion a read-only reconciliation',async()=>{
 const h=harness(),client=h.create(),publication=await client.readRequest({admission:h.x.admission});
 const acceptance=(await client.readAdmission()).acceptance,context={admission:h.x.admission,publication,acceptance};
 const done=await client.complete(context);assert.equal(done.strategyId,h.x.admission.canonical.canonicalStrategyId);
 assert.equal((await client.readCompletion(context)).objectiveReceiptSha256,done.objectiveReceiptSha256);
 const lost=harness({replies:{complete:['unavailable'],readCompletion:['unavailable']}}),other=lost.create();
 await assert.rejects(other.complete(context),unknown);await assert.rejects(other.readCompletion(context),unavailable);
});
