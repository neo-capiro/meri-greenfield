/** Event-stream recheck cost and cadence against the actual service and event source, with counted session ports. */
import test from 'node:test';import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createConversationService} from '../service.mjs';
import {createConversationEventSource} from '../events.mjs';
import {binding,scopes,versions,id} from './store-fixture.mjs';

function fixture(){
 const state={visible:0,runState:'running',rechecks:0,reads:0,revoked:false};
 const events=Array.from({length:120},(_,i)=>({contractVersion:'0.1.0',eventId:id(100+i),binding,sequence:i+1,createdAt:new Date().toISOString(),scopes,type:'message.delta',data:{messageId:id(9),text:'x'}}));
 const receipt=()=>({checkedAtMs:Date.now(),expiresAtMs:Date.now()+60000});
 const sessions={
  async authenticateSession(){state.rechecks++;if(state.revoked)throw Object.assign(Error('SESSION_REFUSED'),{code:'SESSION_REFUSED'});
   return {principal:{sessionId:id(8),tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId},...receipt()};},
  async readCurrentState({authentication}){return {authenticationSha256:canonicalSha256(authentication),binding,scopes,selectedClientId:id(5),...receipt()};},
 };
 const run=()=>({binding,scopes,state:state.runState,createdAt:new Date().toISOString(),policyRevision:'policy1',versions});
 const store={async accept(){throw Error('unexpected write');},async append(){throw Error('unexpected write');},
  async read(_binding,{after,limit}){state.reads++;return {run:run(),request:{requestId:id(6),prompt:'Synthetic',skill:null,window:null,windowRequest:null},events:events.filter(e=>e.sequence>after&&e.sequence<=state.visible).slice(0,limit),lastSequence:state.visible};}};
 const service=createConversationService({sessions,store,versions,maxRequestMs:1000,dispatcher:{async start(){throw Error('unexpected dispatch');},async cancel(){throw Error('unexpected cancel');}}});
 const open=(options={})=>createConversationEventSource({service,credential:'action-session',pollMs:10,...options}).getReader();
 return {state,open,service};
}
const take=async(reader,n)=>{const out=[];while(out.length<n){const next=await reader.read();assert.equal(next.done,false);out.push(next.value.sequence);}return out;};

test('a burst is released one page per recheck and idle polls make no authority calls',async()=>{
 const f=fixture();f.state.visible=5;const reader=f.open();
 try{assert.deepEqual(await take(reader,5),[1,2,3,4,5]);assert.equal(f.state.rechecks,2,'one window check and one release check for the whole page');
  const reads=f.state.reads;await sleep(150);assert.ok(f.state.reads>reads+3,'the window kept polling');assert.equal(f.state.rechecks,2,'idle polls read only the store');
  f.state.visible=120;assert.equal((await take(reader,115)).at(-1),120);assert.equal(f.state.rechecks,4,'100-event and 15-event pages, one recheck each');
  f.state.runState='completed';assert.equal((await reader.read()).done,true);}finally{reader.releaseLock();}
});
test('an idle window rechecks at the idle cadence and a refusal there ends it without a release',async()=>{
 const f=fixture();f.state.visible=1;const reader=f.open({idleRecheckMs:40});
 try{assert.deepEqual(await take(reader,1),[1]);const before=f.state.rechecks;await sleep(200);
  const idle=f.state.rechecks-before;assert.ok(idle>=2&&idle<=6,`idle rechecks were bounded by the cadence (${idle})`);
  f.state.revoked=true;await assert.rejects(reader.read(),/SUBSCRIPTION_UNAVAILABLE/);}finally{reader.releaseLock();}
});
test('a page read after revocation is never released, however long the idle cadence',async()=>{
 const f=fixture();f.state.visible=1;const reader=f.open({idleRecheckMs:30000});
 try{assert.deepEqual(await take(reader,1),[1]);f.state.revoked=true;f.state.visible=3;
  await assert.rejects(reader.read(),/SUBSCRIPTION_UNAVAILABLE/);}finally{reader.releaseLock();}
});

/** The same window through the real action-session owner, counting its Core authority ports (identity, context, membership).
 * One fresh recheck costs eight Core calls; the window check plus one release check per page is the whole cost. */
async function coreFixture(total){
 const {createActionSessionOwner}=await import('../../action-host/session/owner.mjs');
 const calls={identity:0,context:0,membership:0},expiresAtMs=Date.now()+60000,principal=()=>({tenantId:binding.tenantId,actorId:binding.actorId,role:'standard_user',permissions:[],clientIds:[id(5)],membershipRevision:'membership-1'});
 const owner=createActionSessionOwner({mode:'process-local',now:Date.now,limits:{maxSessions:4,maxRequestMs:1000,maxTtlMs:60000,maxFactBytes:65536},
  verifyIdentity(){calls.identity++;return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'identity-1',checkedAtMs:Date.now(),expiresAtMs};},
  resolveContext(call){calls.context++;return {identitySha256:canonicalSha256(call.identity),binding,scopes,selectedClientId:id(5),contextRevision:'context-1',checkedAtMs:Date.now(),expiresAtMs};},
  membership:{admit(){return {principal:principal(),expiresAtMs};},recheck(){calls.membership++;return principal();}}});
 const issued=await owner.issue({identityCredential:'synthetic-native'});
 const events=Array.from({length:total},(_,i)=>({contractVersion:'0.1.0',eventId:id(300+i),binding,sequence:i+1,createdAt:new Date().toISOString(),scopes,type:'message.delta',data:{messageId:id(9),text:'x'}}));
 const state={visible:0};
 const store={async accept(){throw Error('unexpected write');},async append(){throw Error('unexpected write');},
  async read(_binding,{after,limit}){return {run:{binding,scopes,state:state.visible>=total?'completed':'running',createdAt:new Date().toISOString(),policyRevision:'policy1',versions},request:{requestId:id(6),prompt:'Synthetic',skill:null,window:null,windowRequest:null},events:events.filter(e=>e.sequence>after&&e.sequence<=state.visible).slice(0,limit),lastSequence:state.visible};}};
 const service=createConversationService({sessions:owner,store,versions,maxRequestMs:1000,dispatcher:{async start(){throw Error('unexpected dispatch');},async cancel(){throw Error('unexpected cancel');}}});
 for(const k of Object.keys(calls))calls[k]=0;
 return {state,calls,core:()=>calls.identity+calls.context+calls.membership,close:()=>owner.close(),reader:()=>createConversationEventSource({service,credential:issued.credential,pollMs:10}).getReader()};
}
const drain=async reader=>{const out=[];for(;;){const next=await reader.read();if(next.done)return out;out.push(next.value.sequence);}};
test('Core calls per delivered event: eight per page after the window check, not sixteen per event',async t=>{
 const one=await coreFixture(10);t.after(one.close);one.state.visible=1;const r1=one.reader();
 const got=[];while(got.length<10){const next=await r1.read();got.push(next.value.sequence);if(got.length<10)one.state.visible++;}
 assert.equal((await r1.read()).done,true);
 assert.equal(one.core(),8+10*8,'one event per page: the window check, then one release recheck per event (was 16 per event)');
 const burst=await coreFixture(120);t.after(burst.close);burst.state.visible=120;
 assert.equal((await drain(burst.reader())).length,120);
 assert.equal(burst.core(),8+2*8,'a 120-event backlog: the window check and one recheck for each 100- and 20-event page');
 assert.deepEqual(burst.calls,{identity:6,context:6,membership:12});
});
test('the subscription cap closes an idle window cleanly, and a reconnect resumes exactly after the accepted cursor',async()=>{
 const f=fixture();f.state.visible=1;const started=Date.now(),reader=f.open({maxSubscriptionMs:150});
 try{assert.deepEqual(await take(reader,1),[1]);
  // An idle window closes cleanly at its cap; the observer then resumes from its cursor.
  assert.equal((await reader.read()).done,true,'a clean close, not SUBSCRIPTION_UNAVAILABLE');assert.ok(Date.now()-started<1000,'ended by the cap, not by an unbounded wait');
 }finally{reader.releaseLock();}
 f.state.visible=3;const resumed=createConversationEventSource({service:f.service,credential:'action-session',after:1,pollMs:10}).getReader();
 try{assert.deepEqual(await take(resumed,2),[2,3]);}finally{resumed.releaseLock();}
});
test('idle windows end with a clean close at the cap every time, not with the lifetime deadline',async()=>{
 const f=fixture();f.state.visible=1;let clean=0;const windows=20;
 for(let i=0;i<windows;i++){const reader=f.open({maxSubscriptionMs:60+(i%7)});
  try{assert.deepEqual(await take(reader,1),[1]);clean+=await reader.read().then(next=>next.done?1:0,()=>0);}finally{reader.releaseLock();}}
 assert.equal(clean,windows,'every idle window closed cleanly (the lifetime timer used to win the race at the cap)');
});
