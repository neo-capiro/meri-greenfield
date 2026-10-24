import test from 'node:test';
import assert from 'node:assert/strict';
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
 const create=(options={})=>createCoreObjectiveGenerationClient({transport,source:x.source,now:()=>state.now,...options});
 return {x,calls,state,queue,transport,create};
}

test('construction refuses an incomplete transport, malformed source or bounds',()=>{
 const h=harness();
 for(const options of [{transport:{}},{source:{generationJobId:h.x.source.generationJobId}},{maxRequestMs:0},{maxRequestMs:30001},{now:1}])
  assert.throws(()=>h.create(options),unavailable);
});

test('effect phases return closed decoded Core replies in order',async()=>{
 const h=harness(),client=h.create(),admitted=await client.admit();
 assert.equal(admitted.sourceAdmissionSha256,h.x.sourceAdmissionSha256);
 const publication=await client.publish({admission:admitted.sourceAdmission});assert.equal(publication.queuedType,'appropriations');
 const accepted=await client.accept({admission:admitted.sourceAdmission,record:h.x.record});assert.equal(accepted.effectExpiresAtMs,h.x.record.effectExpiresAtMs);
 assert.deepEqual(h.calls.map(c=>c.method),['admit','publish','accept']);
 assert.ok(h.calls.every(c=>Number.isSafeInteger(c.value.deadlineMs)&&c.value.deadlineMs===NOW+3000));
});

test('a missing or undecodable reply after an effect POST is UNKNOWN; after a read it is unavailable',async()=>{
 for(const reply of ['unavailable',Error('socket'),{schemaVersion:1}]){
  const h=harness({replies:{admit:[reply],readAdmission:[reply]}}),client=h.create();
  await assert.rejects(client.admit(),unknown);await assert.rejects(client.readAdmission(),unavailable);
 }
 const h=harness({replies:{accept:[{...coreRepliesFixture().replies.accept(),extra:true}]}});
 await assert.rejects(h.create().accept({admission:h.x.admission,record:h.x.record}),unknown);
});

test('completion is an effect (UNKNOWN when lost) and readCompletion a read-only reconciliation',async()=>{
 const h=harness(),client=h.create(),publication=await client.readRequest({admission:h.x.admission});
 const acceptance=(await client.readAdmission()).acceptance,context={admission:h.x.admission,publication,acceptance};
 const done=await client.complete(context);assert.equal(done.strategyId,h.x.admission.canonical.canonicalStrategyId);
 assert.equal((await client.readCompletion(context)).objectiveReceiptSha256,done.objectiveReceiptSha256);
 const lost=harness({replies:{complete:['unavailable'],readCompletion:['unavailable']}}),other=lost.create();
 await assert.rejects(other.complete(context),unknown);await assert.rejects(other.readCompletion(context),unavailable);
});
