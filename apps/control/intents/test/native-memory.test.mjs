import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeMemoryFixture,operation,NOW,id} from './native-memory-fixture.mjs';
import {createIntentApprovalOwner} from '../approval.mjs';
import {productFailure} from '../../product-access/errors.mjs';
import {assertPreparedResult} from '../../../worker/conversation/intents/prepared.mjs';
import {receiveIntentsResponse} from '../../../../packages/contracts/dist/intents-application.mjs';
const code=expected=>error=>(productFailure(error)?.code??error.code)===expected;
for(const general of [false,true])test(`${general?'General':'client'} native memory submits once, replays exact original receipt and lists review without task approval`,async()=>{
 const f=nativeMemoryFixture({general}),first=await f.port.prepare(f.call);
 assert.equal(first.status,'review_pending');assert.equal(first.result.status,'pending');
 assert.deepEqual(await f.port.prepare(f.call),first);assert.equal(f.state.prepares,1);assert.equal(f.journal.rows.size,1);assert.equal(f.core.reviews.size,1);
 const resumed={...f.binding,runId:id(20),attemptId:id(21),writerFence:2};
 assert.deepEqual(await f.newMount(resumed).prepare(f.call),first);assert.equal(f.state.prepares,1);
 assert.equal(assertPreparedResult('memory',operation,first,resumed,{scopes:f.scopes,nowMs:NOW}).reference,first.result.candidateId);
 const owner=createIntentApprovalOwner({journal:f.intentStore.port,now:f.now,limits:{maxRequestMs:3000},enabled:true});
 const principal={tenantId:f.binding.tenantId,actorId:f.binding.actorId,clientIds:general?[]:[f.scopes[0].resourceId]},request={conversationId:f.binding.conversationId};
 const listed=await owner.list({principal,request}),received=await receiveIntentsResponse('list',200,JSON.stringify(listed),{request});
 assert.equal(received.intents[0].kind,'memory_review');assert.deepEqual(received.intents[0].review,first);assert.equal(Object.hasOwn(received.intents[0],'decision'),false);
 await assert.rejects(owner.decide({principal,request:{...request,deliveryId:f.call.deliveryId,proposalId:first.result.candidateId,commandSha256:first.result.commandSha256,decision:'approved'}}),code('INTENT_NOT_APPROVABLE'));
 if(!general){const hidden=await owner.list({principal:{...principal,clientIds:[]},request});assert.equal(hidden.intents[0].withheld,true);assert.equal(Object.hasOwn(hidden.intents[0],'review'),false);await receiveIntentsResponse('list',200,JSON.stringify(hidden),{request});}
 assert.equal(JSON.stringify(listed).includes(f.raw.content),false);
});
test('lost producer ACK leaves UNKNOWN and never creates a second candidate or review',async()=>{
 const f=nativeMemoryFixture();f.state.loseProducerAck=true;
 await assert.rejects(f.port.prepare(f.call),code('UNKNOWN'));f.state.loseProducerAck=false;
 await assert.rejects(f.port.prepare(f.call),code('UNKNOWN'));
 assert.equal(f.state.prepares,1);assert.equal(f.journal.rows.size,1);assert.equal(f.core.reviews.size,1);
});
test('lost outer settlement ACK recovers the original pending receipt without redispatch',async()=>{
 const f=nativeMemoryFixture();f.intentStore.state.loseSettleAck=true;
 await assert.rejects(f.port.prepare(f.call),code('UNKNOWN'));
 assert.equal((await f.port.prepare(f.call)).status,'review_pending');assert.equal(f.state.prepares,1);assert.equal(f.journal.rows.size,1);
});
test('concurrent same-delivery calls never start a second producer',async()=>{
 const f=nativeMemoryFixture();let enter,finish;
 const entered=new Promise(resolve=>{enter=resolve;}),blocked=new Promise(resolve=>{finish=resolve;});
 f.state.afterPrepare=async()=>{enter();await blocked;};
 const first=f.port.prepare(f.call);await entered;
 await assert.rejects(f.newMount().prepare(f.call),code('UNKNOWN'));finish();
 const result=await first;assert.deepEqual(await f.newMount().prepare(f.call),result);assert.equal(f.state.prepares,1);assert.equal(f.core.reviews.size,1);
});
test('Core accepted then lost ACK leaves the actual candidate submission unknown without redispatch',async()=>{
 const f=nativeMemoryFixture();f.core.failSubmit='lostAck';
 await assert.rejects(f.port.prepare(f.call),code('UNKNOWN'));await assert.rejects(f.port.prepare(f.call),code('UNKNOWN'));
 assert.equal([...f.journal.rows.values()][0].submission.state,'SUBMISSION_UNKNOWN');assert.equal(f.core.reviews.size,1);assert.equal(f.state.prepares,1);
 assert.equal(f.core.calls.filter(call=>call.route==='submit').length,1);
});
test('revocation after submission withholds release but preserves candidate and replay custody',async()=>{
 const f=nativeMemoryFixture();f.state.afterPrepare=()=>{f.state.revoked=true;};
 await assert.rejects(f.port.prepare(f.call),code('ACCESS_DENIED'));assert.equal([...f.intentStore.rows.values()][0].state,'PREPARED');
 await assert.rejects(f.port.prepare(f.call),code('ACCESS_DENIED'));f.state.revoked=false;
 assert.equal((await f.port.prepare(f.call)).status,'review_pending');assert.equal(f.state.prepares,1);
});
test('changed delivery arguments refuse rather than submitting another memory',async()=>{
 const f=nativeMemoryFixture();await f.port.prepare(f.call);
 await assert.rejects(f.port.prepare({...f.call,arguments:{...f.raw,content:'Another request'}}),code('CONFLICT'));assert.equal(f.state.prepares,1);
});
const changes={extra:r=>({...r,approved:true}),published:r=>({...r,status:'published'}),result:r=>({...r,result:{...r.result,status:'approved'}}),digest:r=>({...r,result:{...r.result,commandSha256:'bad'}}),candidate:r=>({...r,result:{...r.result,candidateId:'bad'}}),binding:r=>({...r,binding:{...r.binding,runId:id(99)}}),actor:r=>({...r,binding:{...r.binding,actorId:'another'}}),scope:r=>({...r,scopes:[{...r.scopes[0],resourceId:id(98)}]}),tenant:r=>({...r,scopes:[{...r.scopes[0],tenantId:'another'}]}),wide:r=>({...r,scopes:[...r.scopes,...r.scopes]})};
for(const [name,change] of Object.entries(changes))test(`malformed or foreign ${name} memory result is withheld without reprepare`,async()=>{
 const f=nativeMemoryFixture();f.state.mutate=change;await assert.rejects(f.port.prepare(f.call));await assert.rejects(f.port.prepare(f.call));assert.equal(f.state.prepares,1);
 const raw=[...f.intentStore.rows.values()][0].outcome.result;
 if(name!=='binding')assert.throws(()=>assertPreparedResult('memory',operation,raw,f.binding,{scopes:f.scopes,nowMs:NOW}),code('INVALID_RESULT'));
});
test('public memory history refuses miscorrelation, extra fields and approval-like statuses',async()=>{
 const f=nativeMemoryFixture({general:true}),review=await f.port.prepare(f.call),request={conversationId:f.binding.conversationId};
 const base={conversationId:request.conversationId,intents:[{deliveryId:f.call.deliveryId,createdAt:new Date(NOW).toISOString(),operation,state:'prepared',kind:'memory_review',review}],next:null};
 for(const alter of [x=>{x.intents[0].operation.id='create_task';},x=>{x.intents[0].review.binding.conversationId=id(99);},x=>{x.intents[0].review.scopes[0].resourceId='another';},x=>{x.intents[0].review.result.status='saved';},x=>{x.intents[0].decision='approved';}]){
  const x=structuredClone(base);alter(x);await assert.rejects(receiveIntentsResponse('list',200,JSON.stringify(x),{request}));
 }
});
test('history cannot publish a malformed or scope-substituted retained memory result',async()=>{
 for(const mutate of [r=>{r.status='published';},r=>{r.scopes[0].resourceId=id(99);},r=>{r.binding.conversationId=id(99);}]){
  const f=nativeMemoryFixture();await f.port.prepare(f.call);mutate([...f.intentStore.rows.values()][0].outcome.result);
  const owner=createIntentApprovalOwner({journal:f.intentStore.port,now:f.now,limits:{maxRequestMs:3000},enabled:true});
  await assert.rejects(owner.list({principal:{tenantId:f.binding.tenantId,actorId:f.binding.actorId,clientIds:[f.scopes[0].resourceId,id(99)]},request:{conversationId:f.binding.conversationId}}),code('INTENT_JOURNAL_UNAVAILABLE'));
 }
});
