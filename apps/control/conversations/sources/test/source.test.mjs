import test from 'node:test';import assert from 'node:assert/strict';
import {createPostgresConversationStore} from '../../postgres-store.mjs';
import {storeFixture,id} from '../../test/store-fixture.mjs';
import {binding,scopes,seedStore,status,proof,check} from './fixture.mjs';
import {createBillTextSourceCapture,releaseBillTextPage,savedBillTextRequest} from '../bill-text.mjs';
import {assertNativeSourceEvent} from '../../../../../packages/contracts/conversation-sources/validate.mjs';
async function fixture(){const f=storeFixture();let at=1000;const store=createPostgresConversationStore({pool:f.pool,now:()=>at});await seedStore(store);return {...f,store,clock:v=>at=v,capture:createBillTextSourceCapture({store,defaultCongress:119})};}
const call=p=>({...p,scopes,check});
test('source publication persists once, replays with first recorded time, rejects changed reuse and remains readable after completion',async()=>{
 const f=await fixture(),p=proof();await f.capture(call(p));let page=await f.store.read(binding,{},check);const event=page.events.at(-1);assertNativeSourceEvent(event);assert.equal(event.sequence,4);assert.equal(event.createdAt,new Date(1000).toISOString());
 assert.equal(Object.hasOwn(event.data,'authorizationDecisionId'),false);assert.doesNotMatch(JSON.stringify(event),/xxxxxxxx|evidence\.example|sourceLocator/);
 f.clock(2000);await f.capture(call(p));assert.equal((await f.store.read(binding,{},check)).lastSequence,4);
 await assert.rejects(f.capture(call(proof({total:13}))),/SOURCE_PUBLICATION_CONFLICT/);
 await f.store.append(binding,status(10,'completed'),check);const principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[id(5)]};
 const saved=await f.store.history.source({principal,conversationId:binding.conversationId,runId:binding.runId,referenceId:event.eventId},check);assert.deepEqual(saved.event,event);
 assert.deepEqual(releaseBillTextPage(event,p.result).text,p.result.text);
 for(const change of [{tenantId:id(80)},{actorId:id(80)},{clientIds:[]}])await assert.rejects(f.store.history.source({principal:{...principal,...change},conversationId:binding.conversationId,runId:binding.runId,referenceId:event.eventId},check));
 await assert.rejects(f.capture(call(proof({deliveryId:'late'}))),/NOT_WRITABLE/);
});
test('lost commit acknowledgement retains one reference and exact replay reconciles it',async()=>{const f=await fixture(),p=proof();f.state.commitUnknown=true;await assert.rejects(f.capture(call(p)),/SOURCE_PUBLICATION_UNKNOWN/);f.state.commitUnknown=false;f.clock(9000);await f.capture(call(p));const page=await f.store.read(binding,{},check);assert.equal(page.lastSequence,4);assert.equal(page.events.at(-1).createdAt,new Date(1000).toISOString());});
test('query results are excluded and first/continuation pages preserve exact UTF-16 location',()=>{
 assert.equal(proof({args:{billId:'H.R. 1',query:'x'}}).event,null);
 const first=proof({total:10000});assert.deepEqual(savedBillTextRequest(first.event),{billId:'119-hr-1',versionCode:'ih'});
 const next=proof({total:10000,args:{billId:'119-hr-1',versionCode:'ih',cursor:first.result.coverage.nextCursor}});assert.equal(next.event.data.page.offset,9000);assert.equal(next.event.data.page.endOffset,10000);assert.equal(savedBillTextRequest(next.event).cursor,first.result.coverage.nextCursor);releaseBillTextPage(next.event,next.result);
});
test('current source mismatches withhold content, and unsafe source locators are inert',()=>{
 const {event,result}=proof();for(const key of ['revisionId','versionHash','textHash','versionCode','packageId','lineageKey','provider'])assert.throws(()=>releaseBillTextPage(event,{...result,[key]:'changed'}),/SOURCE_REFERENCE_STALE/);
 assert.throws(()=>releaseBillTextPage(event,{...result,text:'y'.repeat(12)}),/SOURCE_REFERENCE_STALE/);
 assert.throws(()=>releaseBillTextPage(event,{currentStatus:'unavailable'}),/SOURCE_REFERENCE_UNAVAILABLE/);
 for(const sourceLocator of ['javascript:alert(1)','https://user:pass@example.invalid/x','https://example.invalid/\\evil','https://example.invalid/'+'é'.repeat(1000)]){const current=releaseBillTextPage(event,{...result,sourceLocator});assert.equal(current.sourceLocator,null);assert.equal(current.linkStatus,'unsafe');}
});
