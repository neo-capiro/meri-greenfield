import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledConversationFixture} from './scheduled-conversation-fixture.mjs';
import {createScheduledConversationCurrentness} from '../scheduled-conversation-currentness.mjs';
import {productFailure} from '../../product-access/errors.mjs';
import {id} from '../../conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {receiveConversationHistoryRequest,receiveConversationHistoryResponse} from '../../../../packages/contracts/dist/conversation-history.mjs';

test('actual scheduled conversation is listed and transcript renders canonical completion/output without a Core conversation',async()=>{
 const f=await scheduledConversationFixture();
 await f.publish('run.status',{state:'starting',reasonCode:null});await f.publish('run.status',{state:'running',reasonCode:null});
 await f.publish('message.delta',{messageId:id(190),text:'The saved routine result.'});await f.publish('run.status',{state:'completed',reasonCode:null});
 const listed=await f.post('list',{});assert.equal(listed.status,200);const page=await listed.json();
 assert.equal(page.conversations.length,1);assert.equal(page.conversations[0].conversationId,f.identity.binding.conversationId);
 const response=await f.post('transcript',{conversationId:f.call.conversationId});assert.equal(response.status,200);const history=await response.json();
 assert.equal(history.latestRun.state,'completed');assert.equal(history.turns[0].request.prompt,'Summarise new committee activity for the selected client.');
 assert.equal(history.events.find(e=>e.event.type==='message.delta').event.data.text,'The saved routine result.');assert.equal(f.state.coreReads,0);
 const admitted=receiveConversationHistoryRequest('transcript',Buffer.from(JSON.stringify({conversationId:f.call.conversationId})));
 assert.equal((await receiveConversationHistoryResponse('transcript',200,Buffer.from(JSON.stringify(history)),admitted)).latestRun.state,'completed');
 assert.equal(f.runCount(),1);assert.equal(f.workflowCount(),1);
});

test('receipt reports queued dispatch separately from actual completed run and pages canonical output',async()=>{
 const f=await scheduledConversationFixture(),queued=await f.receipts.read(f.call);
 assert.equal(queued.dispatchState,'DISPATCHED');assert.equal(queued.run.state,'queued');assert.equal(queued.admitted,true);assert.equal(queued.lastSequence,1);
 await f.publish('run.status',{state:'starting',reasonCode:null});await f.publish('run.status',{state:'running',reasonCode:null});
 await f.publish('message.delta',{messageId:id(190),text:'Saved text'});await f.publish('run.status',{state:'completed',reasonCode:null});
 const first=await f.receipts.read({...f.call,limit:2});assert.equal(first.run.state,'completed');assert.equal(first.hasMore,true);assert.equal(first.nextSequence,2);
 const tail=await f.receipts.read({...f.call,after:2,limit:100});assert.equal(tail.hasMore,false);assert.equal(tail.lastSequence,5);assert.equal(tail.events[1].data.text,'Saved text');
 assert.deepEqual(tail.binding,f.identity.binding);assert.equal(f.temporal.calls.start,1);assert.equal(f.runCount(),1);
});

test('OPEN read facet returns only the exact canonical root and settlement does not imply completion',async()=>{
 const f=await scheduledConversationFixture(),row=f.storedOrigin();row.state='OPEN';
 const read=await f.scheduleOwner.readOpenOccurrenceForSchedule({tenantId:f.p.owner.tenantId,scheduleId:f.p.scheduleId},()=>{});
 assert.equal(read.occurrenceKey,f.identity.occurrenceKey);assert.deepEqual(read.effect.binding,f.identity.binding);
 row.state='DISPATCHED';assert.equal(await f.scheduleOwner.readOpenOccurrenceForSchedule({tenantId:f.p.owner.tenantId,scheduleId:f.p.scheduleId},()=>{}),null);
});

test('OPEN with confirmed original absence is not delivery; DISPATCHED without its run refuses inconsistent evidence',async()=>{
 const f=await scheduledConversationFixture();f.storedOrigin().state='OPEN';f.conversations.state.runs.clear();
 const r=await f.receipts.read(f.call);assert.equal(r.admitted,false);assert.equal(r.run,null);assert.deepEqual(r.events,[]);assert.equal(r.lastSequence,0);
 f.storedOrigin().state='DISPATCHED';await assert.rejects(f.receipts.read(f.call));assert.equal(f.temporal.calls.start,1);
});

test('history stays readable after original routine update/cancellation without granting another execution',async()=>{
 const f=await scheduledConversationFixture();
 const projection=f.schedules.state.projections.get(`${f.p.owner.tenantId}:${f.p.scheduleId}`);projection.generation='12';projection.projection.state='cancelled';projection.active_intent='a-new-unresolved-intent';
 await f.currentness.assertCurrent(f.call);assert.equal((await f.receipts.read(f.call)).run.state,'queued');assert.equal(f.temporal.calls.start,1);assert.equal(f.state.coreReads,0);
});

test('positively absent origin delegates to Core; Core failure never becomes scheduled authorization',async()=>{
 const f=await scheduledConversationFixture();f.schedules.state.occurrences.clear();
 await f.currentness.assertCurrent(f.call);assert.equal(f.state.coreReads,1);
 f.state.coreDenied=true;await assert.rejects(f.currentness.assertCurrent(f.call));assert.equal(f.state.coreReads,2);
});

test('origin store failure and corrupt/rehashed foreign custody never call Core',async()=>{
 for(const mutation of [r=>{r.effect_sha256='0'.repeat(64);},r=>{r.effect.requestId=id(199);r.effect_sha256=hash(r.effect);},r=>{r.occurrence_key='b'.repeat(64);},r=>{r.generation='2';}]){
  const f=await scheduledConversationFixture();mutation(f.storedOrigin());await assert.rejects(f.currentness.assertCurrent(f.call));assert.equal(f.state.coreReads,0);
 }
 const f=await scheduledConversationFixture();f.schedules.state.failNext='SELECT tenant_id,generation';await assert.rejects(f.currentness.assertCurrent(f.call));assert.equal(f.state.coreReads,0);
});

test('ambiguous retained occurrence rows refuse both read facets',async()=>{
 const f=await scheduledConversationFixture();f.storedOrigin().state='OPEN';const copy=structuredClone(f.storedOrigin());f.schedules.state.occurrences.set('duplicate',copy);
 await assert.rejects(f.scheduleOwner.readOccurrenceForConversation({tenantId:f.p.owner.tenantId,conversationId:f.call.conversationId},()=>{}));
 await assert.rejects(f.scheduleOwner.readOpenOccurrenceForSchedule({tenantId:f.p.owner.tenantId,scheduleId:f.p.scheduleId},()=>{}));
 assert.equal(f.state.coreReads,0);
});

test('wrong actor, client scope and external/arbitrary destinations never obtain a scheduled history result',async()=>{
 const f=await scheduledConversationFixture();
 await assert.rejects(f.currentness.assertCurrent({...f.call,principal:{...f.principal,actorId:'other-actor'}}));
 await assert.rejects(f.currentness.assertCurrent({...f.call,scopes:[{...f.p.scopes[0],resourceId:id(92)}]}));
 for(const destinationId of ['https://outside.invalid/','existing-thread:'+id(90),'slack:channel','destination-a']){
  const other=await scheduledConversationFixture({destinationId});await assert.rejects(other.currentness.assertCurrent(other.call));assert.equal(other.state.coreReads,0);
 }
 assert.equal(f.state.coreReads,0);
});

test('native removal before or during read withholds canonical output and leaves all work counts unchanged',async()=>{
 const f=await scheduledConversationFixture();f.state.denied=true;
 await assert.rejects(f.receipts.read(f.call),e=>productFailure(e)?.code==='MEMBERSHIP_REVOKED');
 f.state.denied=false;let hook=0;f.state.readHook=()=>{if(++hook===1)f.state.denied=true;};
 await assert.rejects(f.receipts.read(f.call),e=>productFailure(e)?.code==='MEMBERSHIP_REVOKED');
 assert.equal(f.temporal.calls.start,1);assert.equal(f.runCount(),1);
});

test('origin drift during native authorization never releases data or falls through to Core',async()=>{
 const f=await scheduledConversationFixture();let reads=0;f.state.originHook=()=>{if(++reads===2)f.storedOrigin().state='REFUSED';};
 await assert.rejects(f.currentness.assertCurrent(f.call));assert.equal(f.state.coreReads,0);
});

test('absent-to-present custody during Core read refuses rather than changing authorization owners mid-request',async()=>{
 const f=await scheduledConversationFixture(),row=structuredClone(f.storedOrigin());f.schedules.state.occurrences.clear();let reads=0;
 f.state.originHook=()=>{if(++reads===2)f.schedules.state.occurrences.set(`${f.p.owner.tenantId}:${f.identity.occurrenceKey}`,row);};
 await assert.rejects(f.currentness.assertCurrent(f.call));assert.equal(f.state.coreReads,1);
});

test('current client removal is denied even while original origin and saved run remain intact',async()=>{
 const f=await scheduledConversationFixture();f.member.clientIds=[];
 await assert.rejects(f.receipts.read(f.call),e=>productFailure(e)?.code==='MEMBERSHIP_CHANGED');assert.equal(f.state.coreReads,0);assert.equal(f.runCount(),1);
});

test('retention suppresses receipt and history even with positive origin and native membership',async()=>{
 const f=await scheduledConversationFixture();f.state.retained=false;await assert.rejects(f.receipts.read(f.call));
 const page=await f.post('list',{});assert.equal(page.status,200);assert.deepEqual((await page.json()).conversations,[]);
});

test('cancelled or expired reads do not start SQL/authority work and constructors remain inert',async()=>{
 const f=await scheduledConversationFixture(),controller=new AbortController();controller.abort();const before=f.state.originReads;
 await assert.rejects(f.currentness.assertCurrent({...f.call,signal:controller.signal}));
 await assert.rejects(f.receipts.read({...f.call,deadlineMs:0}));assert.equal(f.state.originReads,before);
 let getters=0;assert.throws(()=>createScheduledConversationCurrentness({get scheduleOwner(){getters++;return f.scheduleOwner;},gate:f.gate,core:f.core,now:()=>0}));assert.equal(getters,0);
});
