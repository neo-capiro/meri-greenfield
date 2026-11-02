/** Issuance status semantics: Core not answering is 503 SESSION_AUTHORITY_UNAVAILABLE; every refusal stays 401 SESSION_REFUSED. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {markAuthorityUnavailable} from '../../../../packages/runtime/authority-availability.mjs';
import {createActionSessionOwner} from './owner.mjs';
import {createActionSessionApplication} from './http.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const limits={maxSessions:4,maxRequestMs:1000,maxTtlMs:10000,maxFactBytes:65536};
function fixture({identity=null,membership=null,context=null}={}){
 let clock=1791840000000;const now=()=>clock,state={identity,membership,context,calls:0,hook:null};
 const owner=createActionSessionOwner({mode:'process-local',now,limits,refusals:()=>{},
  verifyIdentity:async call=>{state.calls++;if(state.hook)await state.hook(call);if(state.identity)throw state.identity();if(call.credential!=='native-identity')throw Error('private denial');return {principal:{tenantId:'tenant',actorId:'actor'},identityRevision:'identity',checkedAtMs:clock,expiresAtMs:clock+20000};},
  membership:{admit:async()=>{if(state.membership)throw state.membership();return {principal:{tenantId:'tenant',actorId:'actor',role:'standard_user',permissions:[],clientIds:[id(5)],membershipRevision:'m1'},expiresAtMs:clock+20000};},recheck:async({principal})=>principal},
  resolveContext:async({identity})=>{if(state.context)throw state.context();return {identitySha256:canonicalSha256(identity),binding,scopes:[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'policy'}],selectedClientId:id(5),contextRevision:'context',checkedAtMs:clock,expiresAtMs:clock+20000};}});
 const app=createActionSessionApplication({owner,now,maxRequestMs:200});
 const request=(path='session',auth='native-identity',extra={})=>new Request(`http://127.0.0.1/api/action-followthrough/${path}`,{method:'POST',headers:{authorization:`Bearer ${auth}`,'content-type':'application/json'},body:'{}',...extra});
 return {owner,app,state,request,advance:ms=>{clock+=ms;}};
}
const unanswered=code=>()=>markAuthorityUnavailable(Object.assign(Error(code),{code}));
const refused=code=>()=>Object.assign(Error(code),{code});

test('an identity, membership or context owner that did not answer makes issuance 503 and creates no session',async()=>{
 for(const port of ['identity','membership','context']){
  const f=fixture({[port]:unanswered('NATIVE_AUTHORITY_UNAVAILABLE')});
  try{
   const response=await f.app.handle(f.request());
   assert.equal(response.status,503,port);assert.deepEqual(await response.json(),{error:{code:'SESSION_AUTHORITY_UNAVAILABLE'}});
   assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(f.owner.status().sessions,0);
   assert.equal(f.state.calls,port==='identity'?1:1,'one native verification per issuance');
  }finally{f.owner.close();}
 }
});

test('an actual refusal by the same owners stays 401 SESSION_REFUSED, content-free',async()=>{
 for(const [port,failure] of [['identity',refused('secret native denial')],['membership',refused('MEMBERSHIP_REVOKED')],['context',refused('APPLICATION_CONTEXT_REFUSED')]]){
  const f=fixture({[port]:failure});
  try{
   const response=await f.app.handle(f.request());
   assert.equal(response.status,401,port);assert.deepEqual(await response.json(),{error:{code:'SESSION_REFUSED'}});assert.equal(f.owner.status().sessions,0);
  }finally{f.owner.close();}
 }
 const f=fixture();
 try{
  assert.equal((await f.app.handle(f.request('session','wrong-secret'))).status,401,'a foreign credential is refused, never unavailable');
  const text=await (await f.app.handle(f.request('session','wrong-secret'))).text();assert.doesNotMatch(text,/wrong-secret|private|denial/u);
  assert.equal((await f.app.handle(f.request())).status,200,'the same owners still issue');
 }finally{f.owner.close();}
});

test('the route budget running out while Core is parked is 503; a caller cancellation stays 401',async()=>{
 const f=fixture();
 try{
  f.state.hook=async()=>{f.advance(5000);};
  const timedOut=await f.app.handle(f.request());
  assert.equal(timedOut.status,503);assert.deepEqual(await timedOut.json(),{error:{code:'SESSION_AUTHORITY_UNAVAILABLE'}});assert.equal(f.owner.status().sessions,0);
  const controller=new AbortController();f.state.hook=async()=>{controller.abort();};
  const cancelled=await f.app.handle(f.request('session','native-identity',{signal:controller.signal}));
  assert.equal(cancelled.status,401);assert.deepEqual(await cancelled.json(),{error:{code:'SESSION_REFUSED'}});assert.equal(f.owner.status().sessions,0);
 }finally{f.owner.close();}
});

test('browser-only issuance and transport refusals keep their own statuses',async()=>{
 const f=fixture({identity:unanswered('NATIVE_AUTHORITY_UNAVAILABLE')});
 const browser=createActionSessionApplication({owner:{issue:f.owner.issue},sessionPath:'/api/action-followthrough/browser-session',maxRequestMs:200});
 try{
  assert.equal((await browser.handle(f.request('browser-session'))).status,503);
  assert.equal((await f.app.handle(new Request('http://127.0.0.1/api/action-followthrough/session',{method:'GET'}))).status,405);
  assert.equal((await f.app.handle(new Request('http://127.0.0.1/api/action-followthrough/session',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}))).status,401,'a missing bearer is refused before any owner');
  assert.equal((await f.app.handle(f.request('session','native-identity',{body:'{"tenantId":"forged"}'}))).status,400);
  assert.equal(f.state.calls,1,'transport refusals reach no owner');
 }finally{f.owner.close();}
});
