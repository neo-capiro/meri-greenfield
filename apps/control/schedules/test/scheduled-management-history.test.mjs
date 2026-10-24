/** Preserve the real occurrence-custody reader while ordinary history gains
 * Core metadata. No Core refusal may manufacture a scheduled origin. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledConversationFixture} from './scheduled-conversation-fixture.mjs';
import {createConversationHistoryService} from '../../conversations/history/service.mjs';
import {createConversationHistoryApplication} from '../../conversations/history/http.mjs';
import {ProductError,productFailure} from '../../product-access/errors.mjs';
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
async function mixed(){const f=await scheduledConversationFixture(),scopes=f.p.scopes,scheduled=f.call.conversationId,calls=[];
 const conversations=[scheduled,id(91),id(92)].map(conversationId=>({conversationId,scopes}));
 const metadata={async metadata(conversationId){calls.push(conversationId);return {conversationId,clientId:scopes[0].resourceId,status:conversationId===id(92)?'archived':'active'};}};
 const store={history:{async list(){return {conversations,nextBefore:null};},async transcript(){return {conversation:conversations[0]};}}};
 const app=createConversationHistoryApplication({service:createConversationHistoryService({store,gate:f.gate,retention:f.retention}),gate:f.gate,currentness:f.currentness,management:{forRequest:()=>metadata},now:()=>f.call.deadlineMs-2000,limits:{maxRequestMs:2000,maxRequestBytes:131072,maxResponseBytes:2097152}});
 const post=()=>app.handle(new Request('https://meri.invalid/api/conversations/list',{method:'POST',headers:{authorization:'Bearer native','content-type':'application/json'},body:'{}'}));
 return {...f,scheduled,metadata,calls,post};}
test('mixed page retains positively validated scheduled row and active ordinary row, omitting only explicit archive',async()=>{
 const f=await mixed(),response=await f.post();assert.equal(response.status,200);assert.deepEqual((await response.json()).conversations.map(c=>c.conversationId),[f.scheduled,id(91)]);
 assert.deepEqual(f.calls.sort(),[id(91),id(92)]);assert.equal(f.state.coreReads,0);assert.ok(f.state.originReads>=6,'each origin is reread after current membership');
});
test('ordinary callback refusal and unavailable propagate; neither falls back to schedule authorization',async()=>{
 for(const code of ['ACCESS_DENIED','CONVERSATION_UNAVAILABLE']){const f=await mixed();f.metadata.metadata=async id=>{f.calls.push(id);throw new ProductError(code);};const response=await f.post();assert.equal(response.status,code==='ACCESS_DENIED'?403:503);assert.ok((await response.json()).error);assert.equal(f.state.coreReads,0);assert.ok(!f.calls.includes(f.scheduled));}
});
test('scheduled origin is rechecked after ordinary callback; mutation never yields null metadata permission',async()=>{
 const f=await scheduledConversationFixture();let reads=0;
 f.state.originHook=()=>{if(++reads===2)f.storedOrigin().effect_sha256='0'.repeat(64);};
 await assert.rejects(f.currentness.assertCurrent(f.call,undefined,()=>{throw Error('scheduled must not call ordinary reader');}),e=>productFailure(e)?.code==='CONVERSATION_UNAVAILABLE');
});
