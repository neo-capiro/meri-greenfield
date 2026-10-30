/** Real conversation store + real appendEvent path for browser receipts, over the scripted PostgreSQL
 * fixture (no database). Proves the changed stored-time branch actually executes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {storeFixture,binding,scopes,versions} from './store-fixture.mjs';
import {MODEL_CATALOG} from '../../../../packages/contracts/test/model-selection-fixture.mjs';
import {browserActionReceiptEventId,BROWSER_RECEIPT_EVENT}
 from '../../../../packages/contracts/runtime-0.2/browser-receipt.mjs';

const NOW=1700000000000,SESSION='77777777-7777-4777-8777-777777777777';
const key=b=>`${b.tenantId}:${b.conversationId}:${b.runId}`;
const request={requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',prompt:'go'};
function setup({state='running',hold=null,commitUnknown=false}={}){
 const f=storeFixture();
 const projection={binding,scopes,versions,state,createdAt:new Date(NOW).toISOString(),policyRevision:'policy1'};
 f.state.runs.set(key(binding),{tenant_id:binding.tenantId,conversation_id:binding.conversationId,
  run_id:binding.runId,request_id:request.requestId,projection,projection_sha256:hash(projection),
  request,request_sha256:hash(request),last_sequence:3,hold_control_id:hold,sequence_end:null});
 f.state.commitUnknown=commitUnknown;
 const store=createPostgresConversationStore({pool:f.pool,modelCatalog:MODEL_CATALOG});
 const receipt={schema:'meri-browser-receipt/1',kind:'browser.action',binding,sessionId:SESSION,
  toolUseId:'toolu_01',action:'click',urlHost:'app.example',atMs:NOW,reference:null,outcome:'ok'};
 const eventId=browserActionReceiptEventId({binding,sessionId:SESSION,toolUseId:'toolu_01'});
 const input=(overrides={})=>({eventId,createdAt:new Date(NOW).toISOString(),type:BROWSER_RECEIPT_EVENT,
  data:{...receipt,...overrides}});
 return {f,store,input,eventId,receipt};
}
const append=(h,input,expectedScopes=scopes)=>h.store.appendBrowserReceipt(binding,input,()=>{},expectedScopes);

test('a receipt is stored as one conversation event with a UUID identity',async()=>{
 const h=setup();
 const event=await append(h,h.input());
 assert.equal(event.type,BROWSER_RECEIPT_EVENT);
 assert.equal(event.eventId,h.eventId);
 assert.match(event.eventId,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
  'the event identity is a validated UUID projection');
 assert.equal(event.data.kind,'browser.action');
 assert.deepEqual(event.data.binding,binding);
 assert.equal(event.sequence,4,'the next run sequence');
 assert.equal(h.f.state.events.size,1);
});

test('a later retry with the same bytes reuses the stored time and sequence',async()=>{
 const h=setup();
 const first=await append(h,h.input());
 const later=await append(h,{...h.input(),createdAt:new Date(NOW+30000).toISOString()});
 assert.equal(later.createdAt,first.createdAt,'the owner keeps the stored time');
 assert.equal(later.sequence,first.sequence);
 assert.equal(h.f.state.events.size,1);
});

test('the same identity with a changed payload refuses',async()=>{
 const h=setup();
 await append(h,h.input());
 await assert.rejects(append(h,h.input({atMs:NOW+1})),{message:'EVENT_REPLAY_REFUSED'});
 await assert.rejects(append(h,h.input({outcome:'error'})),{message:'EVENT_REPLAY_REFUSED'});
 assert.equal(h.f.state.events.size,1);
});

test('foreign scopes, a held run and a lost commit acknowledgement refuse',async()=>{
 const wrong=setup();
 await assert.rejects(append(wrong,wrong.input(),[{...scopes[0],policyRevision:'policy2'}]),/SCOPE_REFUSED|EVENT|RUN/u);
 const held=setup({state:'paused',hold:'11111111-1111-4111-8111-111111111111'});
 await assert.rejects(append(held,held.input()),{message:'RUN_HELD'});
 const lost=setup({commitUnknown:true});
 await assert.rejects(append(lost,lost.input()),/UNKNOWN|EVENT/u);
});

test('the named receipt port refuses missing or empty canonical scopes',async()=>{
 const h=setup();
 await assert.throws(()=>h.store.appendBrowserReceipt(binding,h.input(),()=>{},undefined),{message:'BROWSER_RECEIPT_REFUSED'});
 await assert.throws(()=>h.store.appendBrowserReceipt(binding,h.input(),()=>{},[]),{message:'BROWSER_RECEIPT_REFUSED'});
 assert.equal(h.f.state.events.size,0,'nothing was stored');
 // The valid path is unchanged: the same scopes still append and a retry still reuses the stored time.
 const first=await append(h,h.input());
 const later=await append(h,{...h.input(),createdAt:new Date(NOW+5000).toISOString()});
 assert.equal(later.createdAt,first.createdAt);
});

test('a terminal run range refuses a late receipt',async()=>{
 const h=setup({state:'completed'});
 h.f.state.runs.get(key(binding)).sequence_end=9;
 await assert.rejects(append(h,h.input()),{message:'RUN_RANGE_CLOSED'});
});
