/** HTTP acquisition timeout must not shorten the Core-issued authority receipt expiry.
 *  Safety: HTTP request budget stays <=maxRequestMs; receipt expiry is the genuine Core value.
 *  The readConversation reader already separates these concerns (network acquisition timeout
 *  in conversation-authority.test.mjs lines 49-54); this test does the same for readCurrent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeToolAuthorityClient,assertNativeToolAuthority} from '../core-client.mjs';

const uuid=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
const origin='https://native-core.example.invalid',currentPath='/api/clio/application-authority/current';
const SHA='a'.repeat(64),MEM='b'.repeat(64),CTX='c'.repeat(64);

/** Minimal Core /current fixture. Core issues expiresAtMs=now()+coreExpiry unless mutated.
 *  Uses valid UUIDs (hex-only) and well-formed SHA256 so authority-http.mjs currentReceipt passes.
 *  Binding mutations after receipt validation use uuid('d') etc. — valid hex UUID. */
function fixture({maxRequestMs=3000,coreExpiry=60000}={}){
 const state={now:1800000000000,calls:[],advance:0,mutate:undefined},now=()=>state.now;
 const principal={tenantId:uuid('b'),actorId:uuid('c')};
 const binding={...principal,conversationId:uuid('1')};
 const selectedClientId=uuid('2');
 const configuration={origin,now,enabled:true,binding,selectedClientId,maxRequestMs,
  async fetchImpl(url,init){
   const path=new URL(url).pathname;state.calls.push({path});
   state.now+=state.advance;
   assert.equal(path,currentPath,'only /current is expected');
   // All fields must be well-formed to pass authority-http.mjs currentReceipt validation.
   const value={principal:structuredClone(principal),role:'standard_user',permissions:[],
    clientIds:[selectedClientId],identityRevision:SHA,membershipRevision:MEM,
    contextRevision:CTX,conversationId:binding.conversationId,selectedClientId,
    checkedAtMs:now(),expiresAtMs:now()+Math.max(1,coreExpiry)};
   state.mutate?.(value);return Response.json(value);
  }};
 const client=createNativeToolAuthorityClient(configuration);
 const request=()=>({credential:'SYNTHETIC_NATIVE',deadlineMs:now()+120000});
 return {state,now,principal,client,request,binding,selectedClientId};
}

// ── POSITIVE: Core receipt expiry must survive the HTTP acquisition window ───
test('network acquisition timeout does not shorten the actual Core receipt expiry',async()=>{
 // Core issues a 30s expiry. HTTP maxRequestMs=1000 (much shorter).
 // CURRENT BUG: expiresAtMs=Math.min(began+1000, r.expiresAtMs) = began+1000.
 // REQUIRED: expiresAtMs should be r.expiresAtMs = at+30000.
 const f=fixture({maxRequestMs:1000,coreExpiry:30000});
 const at=f.now();
 const out=await f.client.readCurrent(f.request());
 assert.equal(out.expiresAtMs,at+30000,'receipt expiry must equal Core-issued value, not HTTP cutoff');
 assert.ok(out.expiresAtMs>at+1000,'must exceed the HTTP maxRequestMs budget of 1s');
});

test('caller deadline still caps receipt expiry when shorter than Core expiry',async()=>{
 // Caller passes deadlineMs=now+5000; Core issues 60s. Result must be bounded to caller deadline.
 const f=fixture({maxRequestMs:3000,coreExpiry:60000});
 const at=f.now();
 const out=await f.client.readCurrent({...f.request(),deadlineMs:at+5000});
 assert.equal(out.expiresAtMs,at+5000,'caller deadline must cap the authority expiry');
});

test('Core receipt expiry shorter than caller deadline is preserved exactly',async()=>{
 // Core issues 10s; caller deadline=120s; maxRequestMs=3s. Result must be 10s.
 const f=fixture({maxRequestMs:3000,coreExpiry:10000});
 const at=f.now();
 const out=await f.client.readCurrent(f.request());
 assert.equal(out.expiresAtMs,at+10000,'Core receipt expiry preserved when it is the minimum');
});

test('HTTP fetch signal is aborted within maxRequestMs even with long Core expiry',async()=>{
 // Build a hanging fetch to confirm the HTTP signal fires within maxRequestMs.
 const state={now:1800000000000},now=()=>state.now;
 const principal={tenantId:uuid('b'),actorId:uuid('c')};
 const binding={...principal,conversationId:uuid('1')};
 const selectedClientId=uuid('2');
 let capturedSignal,signalAbortedAtMs;
 const hanging=createNativeToolAuthorityClient({
  origin,now,enabled:true,binding,selectedClientId,maxRequestMs:100,
  async fetchImpl(url,init){
   capturedSignal=init.signal;
   return new Promise((_,reject)=>{
    init.signal.addEventListener('abort',()=>{signalAbortedAtMs=Date.now();reject(Object.assign(Error('aborted'),{name:'AbortError'}));},{once:true});
   });
  }});
 // Suppress unhandled rejection while we wait for the signal
 const work=hanging.readCurrent({credential:'SYNTHETIC_NATIVE',deadlineMs:now()+120000});
 work.catch(()=>{});
 await new Promise(resolve=>setTimeout(resolve,250));
 assert.ok(capturedSignal,'fetchImpl must have been called');
 assert.equal(capturedSignal.aborted,true,'HTTP fetch signal must be aborted within maxRequestMs (100ms)');
 await assert.rejects(work);
});

// ── POSITIVE: bill/SAM slow source has enough window with genuine Core expiry ─
test('slow source within genuine Core expiry has long enough window',async()=>{
 // Core issues 30s expiry, maxRequestMs=1000 (HTTP acquisition only).
 // After the fix: owner.observe gets native.expiresAtMs=30s allowing slow sources to complete.
 // Semantic embed ~4s + DB ~8s = 12s total; 30s window is sufficient; 1s was not.
 const f=fixture({maxRequestMs:1000,coreExpiry:30000});
 const at=f.now();
 const out=await f.client.readCurrent(f.request());
 assert.ok(out.expiresAtMs>=at+10000,'authority window must accommodate slow sources (>=10s)');
 assert.equal(out.expiresAtMs,at+30000,'must equal the genuine Core receipt expiry');
});

// ── NEGATIVE: genuinely expired Core receipt must still refuse ──────────────
test('assertNativeToolAuthority properly refuses receipt expired relative to now',async()=>{
 // Verifies the clocks() guard on the returned receipt.
 // Since authority-http.mjs currentReceipt validates expiresAtMs>checkedAtMs in the JSON,
 // we test the assertion function directly with a receipt whose expiresAtMs<=at.
 const now=()=>1800000000010; // advanced clock
 const began=1800000000000;
 const v={principal:{tenantId:uuid('b'),actorId:uuid('c')},identityRevision:SHA,
  actorRole:'standard_user',membershipRevision:MEM,clientIds:[uuid('2')],
  checkedAtMs:began+5,expiresAtMs:began+9}; // expiresAtMs(009) < now(010) → expired
 assert.throws(()=>assertNativeToolAuthority(v,{started:began,now}),{message:'ACCESS_DENIED'});
});

test('authority cannot be renewed by local timestamps: once expired the original receipt is final',async()=>{
 // Even if a second readCurrent() call would return a longer expiry,
 // the callers get the original expiresAtMs — no caching or renewal loop.
 // Verified by checking call count = 1 for a normal (non-expired) successful read.
 const f=fixture({maxRequestMs:3000,coreExpiry:30000});
 const at=f.now();
 const out=await f.client.readCurrent(f.request());
 assert.equal(f.state.calls.length,1,'exactly one Core call per readCurrent');
 assert.equal(out.expiresAtMs,at+30000,'receipt expiry is the original, not renewed');
});

// ── NEGATIVE: revocation and binding checks still enforced ──────────────────
// Use uuid('d')/uuid('e') — valid hex-only UUIDs that pass currentReceipt JSON validation
// but differ from the bound values, so core-client's binding check fires ACCESS_DENIED.
test('changed tenant in Core receipt is refused',async()=>{
 const f=fixture();f.state.mutate=v=>{v.principal.tenantId=uuid('d');};
 await assert.rejects(f.client.readCurrent(f.request()),{message:'ACCESS_DENIED'});
});

test('changed actor in Core receipt is refused',async()=>{
 const f=fixture();f.state.mutate=v=>{v.principal.actorId=uuid('d');};
 await assert.rejects(f.client.readCurrent(f.request()),{message:'ACCESS_DENIED'});
});

test('Core receipt with mismatched conversationId is refused',async()=>{
 // uuid('d') is a valid hex UUID accepted by currentReceipt but differs from bound conversationId.
 const f=fixture();f.state.mutate=v=>{v.conversationId=uuid('d');};
 await assert.rejects(f.client.readCurrent(f.request()),{message:'ACCESS_DENIED'});
});

test('Core receipt with mismatched selectedClientId is refused',async()=>{
 // Use a valid UUID that differs from the bound selectedClientId.
 const f=fixture();f.state.mutate=v=>{v.selectedClientId=uuid('e');v.clientIds=[uuid('e')];};
 await assert.rejects(f.client.readCurrent(f.request()),{message:'ACCESS_DENIED'});
});

// ── assertNativeToolAuthority: malformed/expired receipt still enforced ─────
test('assertNativeToolAuthority rejects receipt with expiresAtMs in the past',()=>{
 const now=()=>1800000000000;
 const v={principal:{tenantId:uuid('b'),actorId:uuid('c')},identityRevision:SHA,
  actorRole:'standard_user',membershipRevision:MEM,checkedAtMs:now()-1,expiresAtMs:now()-1};
 assert.throws(()=>assertNativeToolAuthority(v,{started:now()-2,now}),{message:'ACCESS_DENIED'});
});

test('assertNativeToolAuthority rejects future checkedAtMs',()=>{
 const now=()=>1800000000000;
 const v={principal:{tenantId:uuid('b'),actorId:uuid('c')},identityRevision:SHA,
  actorRole:'standard_user',membershipRevision:MEM,checkedAtMs:now()+1,expiresAtMs:now()+60000};
 assert.throws(()=>assertNativeToolAuthority(v,{started:now()-1,now}),{message:'ACCESS_DENIED'});
});

test('assertNativeToolAuthority rejects non-integer expiresAtMs',()=>{
 const now=()=>1800000000000;
 const v={principal:{tenantId:uuid('b'),actorId:uuid('c')},identityRevision:SHA,
  actorRole:'standard_user',membershipRevision:MEM,checkedAtMs:now()-1,expiresAtMs:NaN};
 // NaN is rejected by data() validation before the clocks check — any error is correct behavior
 assert.throws(()=>assertNativeToolAuthority(v,{started:now()-2,now}));
});

test('assertNativeToolAuthority rejects non-SHA256 identityRevision',()=>{
 const now=()=>1800000000000;
 const v={principal:{tenantId:uuid('b'),actorId:uuid('c')},identityRevision:'NOT_A_SHA256',
  actorRole:'standard_user',membershipRevision:MEM,checkedAtMs:now()-1,expiresAtMs:now()+60000};
 assert.throws(()=>assertNativeToolAuthority(v,{started:now()-2,now}),{message:'ACCESS_DENIED'});
});
