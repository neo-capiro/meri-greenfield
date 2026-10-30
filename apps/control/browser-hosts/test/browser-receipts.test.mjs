import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createBrowserReceiptProducer} from '../browser-receipts.mjs';
import {assertConversationEvent,isBrowserReceiptEventType} from '../../../../packages/contracts/conversation-sources/validate.mjs';
import {BROWSER_RECEIPT_EVENT,assertBrowserReceipt,browserActionReceiptEventId,browserDownloadReceiptEventId}
 from '../../../../packages/contracts/runtime-0.2/browser-receipt.mjs';

const NOW=1700000000000;
const binding={tenantId:'tenant',actorId:'actor',conversationId:'22222222-2222-4222-8222-222222222222',
 runId:'33333333-3333-4333-8333-333333333333',attemptId:'44444444-4444-4444-8444-444444444444',
 workerId:'55555555-5555-4555-8555-555555555555',writerFence:7};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:'66666666-6666-4666-8666-666666666666',policyRevision:'p1'}];
const sessionId='77777777-7777-4777-8777-777777777777';

/** The documented event-owner port: duplicate keeps the stored time and refuses a changed payload
 * exactly like the real appendEvent; the real validator runs on every event. */
function eventStore(){
 const rows=new Map();
 return {rows,async appendBrowserReceipt(binding,input,check,expectedScopes){
  const event={contractVersion:'0.1.0',eventId:input.eventId,binding,sequence:rows.size+1,
   createdAt:input.createdAt,scopes:expectedScopes,type:input.type,data:input.data};
  assertConversationEvent(event);check();
  const old=rows.get(event.eventId);
  if(old){const replayed={...event,sequence:old.sequence,createdAt:old.createdAt};
   if(hash(old)!==hash(replayed))throw Object.assign(Error('EVENT_REPLAY_REFUSED'),{code:'EVENT_REPLAY_REFUSED'});
   return old;}
  rows.set(event.eventId,event);return event;}};
}
const producer=store=>createBrowserReceiptProducer({store,now:()=>NOW});

test('an action receipt becomes one closed conversation event derived from session and tool use',async()=>{
 const store=eventStore(),p=producer(store);
 const result=await p.appendAction({binding,scopes,sessionId,toolUseId:'toolu_01',action:'click',
  urlHost:'app.example',atMs:NOW,outcome:'ok',reference:'pages/one.html'});
 const event=store.rows.get(result.eventId);
 assert.equal(event.type,BROWSER_RECEIPT_EVENT);
 assert.equal(event.data.schema,'meri-browser-receipt/1');assert.equal(event.data.kind,'browser.action');
 assert.equal(event.data.binding.writerFence,7);assert.equal(event.data.outcome,'ok');
 assert.equal(result.eventId,browserActionReceiptEventId({binding,sessionId,toolUseId:'toolu_01'}));
 assert.equal(isBrowserReceiptEventType(event.type),true);
 assert.doesNotThrow(()=>assertBrowserReceipt(event.data));
});

test('a retry acknowledges the same event with the stored time; a changed payload refuses',async()=>{
 const store=eventStore(),p=producer(store);
 const first=await p.appendAction({binding,scopes,sessionId,toolUseId:'toolu_02',action:'click',
  urlHost:'app.example',atMs:NOW,outcome:'ok',reference:null});
 const again=await p.appendAction({binding,scopes,sessionId,toolUseId:'toolu_02',action:'click',
  urlHost:'app.example',atMs:NOW,outcome:'ok',reference:null});
 assert.equal(again.eventId,first.eventId);assert.equal(store.rows.size,1);
 assert.equal(again.event.createdAt,first.event.createdAt,'the owner keeps the stored time');
 // The same identity with a different observed outcome is a conflict, never a second event.
 await assert.rejects(p.appendAction({binding,scopes,sessionId,toolUseId:'toolu_02',action:'click',
  urlHost:'app.example',atMs:NOW,outcome:'error',reference:null}),{message:'EVENT_REPLAY_REFUSED'});
 assert.equal(store.rows.size,1);
});

test('a download receipt binds the acknowledged version, digest and size',async()=>{
 const store=eventStore(),p=producer(store);
 const result=await p.appendDownload({binding,scopes,urlHost:'files.example',atMs:NOW,
  reference:'a1b2c3d4-0000-4000-8000-000000000001',sha256:'c'.repeat(64),bytes:2048,mimeType:'application/pdf'});
 const event=store.rows.get(result.eventId);
 assert.equal(event.data.kind,'browser.download');
 assert.equal(event.data.reference,'a1b2c3d4-0000-4000-8000-000000000001');
 assert.equal(result.eventId,browserDownloadReceiptEventId({binding,reference:event.data.reference}));
 // A partial download (reference without digest or size) is refused, not recorded.
 await assert.rejects(p.appendDownload({binding,scopes,urlHost:'files.example',atMs:NOW,
  reference:'a1b2c3d4-0000-4000-8000-000000000002',sha256:null,bytes:null,mimeType:'application/pdf'}),
  /BROWSER_RECEIPT_REFUSED/u);
 // An absolute or traversing reference is refused.
 await assert.rejects(p.appendAction({binding,scopes,sessionId,toolUseId:'toolu_03',action:'click',
  urlHost:'app.example',atMs:NOW,outcome:'ok',reference:'../escape.html'}),/BROWSER_RECEIPT_REFUSED/u);
});

test('a foreign binding inside the receipt data is refused by the event validator',async()=>{
 assert.throws(()=>assertConversationEvent({contractVersion:'0.1.0',eventId:browserActionReceiptEventId({binding,sessionId,toolUseId:'t'}),
  binding,sequence:1,createdAt:new Date(NOW).toISOString(),scopes,type:BROWSER_RECEIPT_EVENT,
  data:{schema:'meri-browser-receipt/1',kind:'browser.action',binding:{...binding,writerFence:9},sessionId,
   toolUseId:'t',action:'click',urlHost:'app.example',atMs:NOW,reference:null,outcome:'ok'}}),
  /INVALID_BROWSER_RECEIPT_EVENT/u);
});

test('a producer without the real event owner refuses instead of succeeding quietly',()=>{
 assert.throws(()=>createBrowserReceiptProducer({store:{}}),{message:'BROWSER_RECEIPT_CONFIGURATION'});
 assert.throws(()=>createBrowserReceiptProducer({}),{message:'BROWSER_RECEIPT_CONFIGURATION'});
});
