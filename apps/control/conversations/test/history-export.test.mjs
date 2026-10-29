/** Synthetic transcript pages; integration/fencing is separately exercised through the canonical HTTP/store fixture. */
import test from 'node:test';import assert from 'node:assert/strict';
import {exportConversationMessages} from '../history/export.mjs';
import {receiveConversationHistoryRequest as request,receiveConversationHistoryResponse as receive} from '../../../../packages/contracts/dist/conversation-history.mjs';
import {id,bytes,binding,conversation,resumed} from '../../../../packages/contracts/test/conversation-history-fixture.mjs';
const call={request:{conversationId:binding.conversationId},signal:new AbortController().signal};
const now=()=>Date.parse('2026-10-29T07:00:00.000Z');
const run=(read)=>exportConversationMessages({call,read,now});
const page=()=>{const p=resumed();p.events[0].event={...p.events[0].event,type:'message.delta',data:{messageId:id(90),text:'first'}};p.events[1].event={...p.events[1].event,type:'message.delta',data:{messageId:id(91),text:'second'}};return p;};
test('exports resumed prompt once; keeps each assistant run and no raw source/tool/request metadata',async()=>{
 const result=await run(async()=>page());
 assert.deepEqual(result.turns.map(t=>t.prompt),[page().turns[0].request.prompt,null]);
 assert.deepEqual(result.turns.map(t=>t.messages[0].text),['first','second']);
 assert.equal(Date.parse(result.expiresAt)-Date.parse(result.exportedAt),60000);
 assert.deepEqual(await receive('export',200,bytes(result),request('export',bytes(call.request))),result);
 assert.equal('request' in result.turns[0],false);
});
test('fixes the first sequence boundary across pages while later messages continue to arrive',async()=>{
 let calls=0;const p=page();
 const result=await run(async({request})=>{
  calls++;if(request.after===0)return {...p,events:p.events.slice(0,1),turns:p.turns.slice(0,1),hasMore:true,nextSequence:1};
  return {...p,lastSequence:3,events:[p.events[1],{sequence:3,event:{...p.events[1].event,data:{messageId:id(99),text:'newer'}}}],hasMore:false};
 });
 assert.equal(calls,2);assert.equal(result.throughSequence,2);assert.deepEqual(result.turns.flatMap(t=>t.messages).map(m=>m.text),['first','second']);
});
test('same-text genuine submission is preserved; exclusion is based only on logical request identity',async()=>{
 const p=page();p.turns[1].promptLineage.logicalRequestId=id(222);
 const result=await run(async()=>p);assert.equal(result.turns[0].prompt,result.turns[1].prompt);
});
for(const [name,change] of [
 ['oversized event history',p=>p.lastSequence=10001],
 ['oversized UTF8 content',p=>p.events[0].event.data.text='🙂'.repeat(262145)],
 ['oversized escaped transport',p=>p.events[0].event.data.text='\u0001'.repeat(400000)],
])test('explicitly refuses '+name+' without returning a partial file',async()=>{
 const p=page();change(p);await assert.rejects(run(async()=>p),/CONVERSATION_EXPORT_TOO_LARGE/);
});
for(const [name,change] of [
 ['gap',p=>p.events[0].sequence=2],['empty advancing page',p=>{p.events=[];p.hasMore=true;}],
 ['missing run',p=>p.turns=[]],
])test('refuses corrupt '+name,async()=>{
 const p=page();change(p);await assert.rejects(run(async()=>p),/CONVERSATION_STORE_CORRUPT/);
});
test('aborted export never reads or returns bytes',async()=>{
 const controller=new AbortController();controller.abort();let reads=0;
 await assert.rejects(exportConversationMessages({call:{...call,signal:controller.signal},read:async()=>{reads++;return page();},now}));assert.equal(reads,0);
});
test('public receiver refuses foreign selection, extra internal fields, forged lifetime and duplicate messages',async()=>{
 const result=await run(async()=>page()),admitted=request('export',bytes(call.request));
 for(const mutate of [r=>r.conversation.conversationId=id(333),r=>r.turns[0].request={prompt:'internal'},r=>r.expiresAt=r.exportedAt,r=>r.turns[0].messages.push(r.turns[0].messages[0]),r=>r.turns.push(r.turns[0])]){
  const bad=structuredClone(result);mutate(bad);await assert.rejects(receive('export',200,bytes(bad),admitted));
 }
 assert.throws(()=>request('export',bytes({...call.request,tenantId:'untrusted'})));
 assert.deepEqual(await receive('export',413,bytes({error:{code:'CONVERSATION_EXPORT_TOO_LARGE'}}),admitted),{error:{code:'CONVERSATION_EXPORT_TOO_LARGE'}});
});

