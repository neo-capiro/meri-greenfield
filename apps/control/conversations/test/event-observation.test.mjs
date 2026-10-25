/** Event-stream recheck cost and cadence against the actual service and event source, with counted session ports. */
import test from 'node:test';import assert from 'node:assert/strict';
import {syncBuiltinESMExports} from 'node:module';
import {setTimeout as sleep,setImmediate as flush} from 'node:timers/promises';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createConversationService} from '../service.mjs';
import {createConversationEventSource} from '../events.mjs';
import {binding,scopes,versions,id} from './store-fixture.mjs';

function fixture(){
 const state={visible:0,runState:'running',rechecks:0,reads:0,revoked:false,passMs:0};
 const events=Array.from({length:120},(_,i)=>({contractVersion:'0.1.0',eventId:id(100+i),binding,sequence:i+1,createdAt:new Date().toISOString(),scopes,type:'message.delta',data:{messageId:id(9),text:'x'}}));
 const receipt=()=>({checkedAtMs:Date.now(),expiresAtMs:Date.now()+60000});
 const sessions={
  async authenticateSession({signal}){state.rechecks++;if(state.passMs)await sleep(state.passMs,undefined,{signal});if(state.revoked)throw Object.assign(Error('SESSION_REFUSED'),{code:'SESSION_REFUSED'});
   return {principal:{sessionId:id(8),tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId},...receipt()};},
  async readCurrentState({authentication}){return {authenticationSha256:canonicalSha256(authentication),binding,scopes,selectedClientId:id(5),...receipt()};},
 };
 const run=()=>({binding,scopes,state:state.runState,createdAt:new Date().toISOString(),policyRevision:'policy1',versions});
 const store={async accept(){throw Error('unexpected write');},async append(){throw Error('unexpected write');},
  async read(_binding,{after,limit}){state.reads++;const page={run:run(),request:{requestId:id(6),prompt:'Synthetic',skill:null,window:null,windowRequest:null},events:events.filter(e=>e.sequence>after&&e.sequence<=state.visible).slice(0,limit),lastSequence:state.visible};await state.afterRead?.(page);return page;}};
 const service=createConversationService({sessions,store,versions,maxRequestMs:1000,dispatcher:{async start(){throw Error('unexpected dispatch');},async cancel(){throw Error('unexpected cancel');}}});
 const open=(options={})=>createConversationEventSource({service,credential:'action-session',pollMs:10,...options}).getReader();
 return {state,open,service};
}
const take=async(reader,n)=>{const out=[];while(out.length<n){const next=await reader.read();assert.equal(next.done,false);out.push(next.value.sequence);}return out;};

test('empty reads back off to 250 ms, and a delivered page restores the prompt 100 ms poll', {timeout:3000},async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:Date.now()});syncBuiltinESMExports();
 t.after(()=>{t.mock.timers.reset();syncBuiltinESMExports();});
 const f=fixture(),reader=f.open({pollMs:100});
 const tick=async ms=>{t.mock.timers.tick(ms);await flush();};
 try{
  await flush();assert.equal(f.state.reads,1,'opening read is immediate');
  await tick(99);assert.equal(f.state.reads,1);await tick(1);assert.equal(f.state.reads,2);
  await tick(199);assert.equal(f.state.reads,2);await tick(1);assert.equal(f.state.reads,3);
  await tick(249);assert.equal(f.state.reads,3);await tick(1);assert.equal(f.state.reads,4);
  await tick(250);assert.equal(f.state.reads,5,'the idle delay remains capped');
  assert.equal(f.state.rechecks,1,'empty reads do not make session observations');
  f.state.visible=1;await tick(250);assert.deepEqual(await take(reader,1),[1]);
  assert.equal(f.state.reads,7,'drain immediately after delivery');assert.equal(f.state.rechecks,2);
  await tick(99);assert.equal(f.state.reads,7);await tick(1);assert.equal(f.state.reads,8,'active delay reset');
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
});

test('backoff wakes at the idle access deadline even when it falls between polls', {timeout:3000},async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:Date.now()});syncBuiltinESMExports();
 t.after(()=>{t.mock.timers.reset();syncBuiltinESMExports();});
 const f=fixture(),reader=f.open({pollMs:100,idleRecheckMs:180});
 try{
  await flush();t.mock.timers.tick(100);await flush();assert.equal(f.state.reads,2);
  f.state.revoked=true;const refused=assert.rejects(reader.read(),/SUBSCRIPTION_UNAVAILABLE/);
  t.mock.timers.tick(79);await flush();assert.equal(f.state.rechecks,1);
  t.mock.timers.tick(1);await flush();assert.equal(f.state.rechecks,2,'the next poll cannot delay the access recheck');await refused;
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
});

for(const cancellation of ['signal','reader'])test(`${cancellation} cancellation settles an observer during a backed-off wait, including repeated cancellation`,{timeout:3000},async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:Date.now()});syncBuiltinESMExports();
 t.after(()=>{t.mock.timers.reset();syncBuiltinESMExports();});
 const f=fixture(),controller=new AbortController();let settled=false;
 const service={async observe(args){try{return await f.service.observe(args);}finally{settled=true;}}};
 const reader=createConversationEventSource({service,credential:'action-session',signal:controller.signal}).getReader();
 try{
  await flush();for(const ms of [100,200,250]){t.mock.timers.tick(ms);await flush();}
  assert.equal(f.state.reads,4);assert.equal(settled,false);
  let refused;
  if(cancellation==='signal'){refused=assert.rejects(reader.read(),/SUBSCRIPTION_UNAVAILABLE/);controller.abort();controller.abort();}
  else{await reader.cancel();await reader.cancel();}
  await flush();assert.equal(settled,true,'cancellation must settle without advancing the pending poll timer');
  await refused;
  const reads=f.state.reads;t.mock.timers.tick(1000);await flush();assert.equal(f.state.reads,reads,'no detached polling after cancellation');
 }finally{controller.abort();await reader.cancel().catch(()=>{});reader.releaseLock();}
});

test('revocation between a store read and page release refuses every new event', {timeout:3000},async()=>{
 const f=fixture();f.state.visible=120;f.state.afterRead=page=>{assert.equal(page.events.length,100);f.state.revoked=true;};
 const reader=f.open();
 try{await assert.rejects(reader.read(),/SUBSCRIPTION_UNAVAILABLE/);assert.equal(f.state.reads,1);assert.equal(f.state.rechecks,2);}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
});

test('a terminal burst drains its final page immediately and stops polling', {timeout:3000},async()=>{
 const f=fixture();f.state.visible=120;f.state.runState='completed';const reader=f.open({pollMs:100});
 try{
  assert.deepEqual(await take(reader,120),Array.from({length:120},(_,i)=>i+1));assert.equal((await reader.read()).done,true);
  assert.equal(f.state.reads,2,'100 and 20 events, with no terminal empty-poll loop');assert.equal(f.state.rechecks,3);
  await sleep(300);assert.equal(f.state.reads,2,'terminal close leaves no observer polling');
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
});

test('default idle revocation refuses within 30 seconds including a slow session observation', {timeout:14000},async()=>{
 const f=fixture(),opened=Promise.withResolvers(),reader=f.open({pollMs:100,opened:opened.resolve});
 try{
  await opened.promise;const revokedAt=performance.now();f.state.passMs=200;f.state.revoked=true;
  await assert.rejects(reader.read(),/SUBSCRIPTION_UNAVAILABLE/);
  const elapsed=performance.now()-revokedAt;assert.ok(elapsed<12000,`10 s cadence plus 200 ms observation and timer margin: ${elapsed} ms`);
  assert.equal(f.state.rechecks,2);assert.ok(f.state.reads<=43,'idle backoff reduces store work across the real recheck interval');
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
});

test('an unavailable session recheck is bounded by the window while no new bytes escape', {timeout:3000},async()=>{
 const f=fixture();f.state.visible=1;const reader=f.open({pollMs:100,idleRecheckMs:100,maxSubscriptionMs:500});
 try{
  assert.deepEqual(await take(reader,1),[1]);f.state.passMs=2000;
  const started=performance.now();await assert.rejects(reader.read(),/SUBSCRIPTION_UNAVAILABLE/);
  assert.ok(performance.now()-started<800,'the slow access request cannot outlive the subscription');assert.equal(f.state.rechecks,3);
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
});

test('a burst is released one page per recheck and idle polls make no authority calls',async()=>{
 const f=fixture();f.state.visible=5;const reader=f.open();
 try{assert.deepEqual(await take(reader,5),[1,2,3,4,5]);assert.equal(f.state.rechecks,2,'one window check and one release check for the whole page');
  await sleep(150);assert.equal(f.state.rechecks,2,'idle polls read only the store; cadence is checked separately');
  f.state.visible=120;assert.equal((await take(reader,115)).at(-1),120);assert.equal(f.state.rechecks,4,'100-event and 15-event pages, one recheck each');
  f.state.runState='completed';assert.equal((await reader.read()).done,true);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
});
test('an idle window rechecks at the idle cadence and a refusal there ends it without a release',async()=>{
 const f=fixture();f.state.visible=1;const reader=f.open({idleRecheckMs:40});
 try{assert.deepEqual(await take(reader,1),[1]);const before=f.state.rechecks;await sleep(200);
  const idle=f.state.rechecks-before;assert.ok(idle>=2&&idle<=6,`idle rechecks were bounded by the cadence (${idle})`);
  f.state.revoked=true;await assert.rejects(reader.read(),/SUBSCRIPTION_UNAVAILABLE/);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
});
test('a page read after revocation is never released, however long the idle cadence',async()=>{
 const f=fixture();f.state.visible=1;const reader=f.open({idleRecheckMs:30000});
 try{assert.deepEqual(await take(reader,1),[1]);f.state.revoked=true;f.state.visible=3;
  await assert.rejects(reader.read(),/SUBSCRIPTION_UNAVAILABLE/);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
});

/** The same window through the real action-session owner, counting fixture ports (identity, context, membership).
 * These port calls are not network calls: the production identity adapter shares its canonical /current receipt within a pass. */
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
test('session fixture ports per delivered page: four after the window check (one fused observation per recheck)',async t=>{
 const one=await coreFixture(10);t.after(one.close);one.state.visible=1;const r1=one.reader();
 const got=[];while(got.length<10){const next=await r1.read();got.push(next.value.sequence);if(got.length<10)one.state.visible++;}
 assert.equal((await r1.read()).done,true);
 assert.equal(one.core(),4+10*4,'one event per page: the window check, then one release recheck per event (was 8 + 10 × 8)');
 const burst=await coreFixture(120);t.after(burst.close);burst.state.visible=120;
 assert.equal((await drain(burst.reader())).length,120);
 assert.equal(burst.core(),4+2*4,'a 120-event backlog: the window check and one recheck for each 100- and 20-event page');
 assert.deepEqual(burst.calls,{identity:3,context:3,membership:6});
});
test('the subscription cap closes an idle window cleanly, and a reconnect resumes exactly after the accepted cursor',async()=>{
 const f=fixture();f.state.visible=1;const started=Date.now(),reader=f.open({maxSubscriptionMs:150});
 try{assert.deepEqual(await take(reader,1),[1]);
  // An idle window closes cleanly at its cap; the observer then resumes from its cursor.
  assert.equal((await reader.read()).done,true,'a clean close, not SUBSCRIPTION_UNAVAILABLE');assert.ok(Date.now()-started<1000,'ended by the cap, not by an unbounded wait');
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 f.state.visible=3;const resumed=createConversationEventSource({service:f.service,credential:'action-session',after:1,pollMs:10}).getReader();
 try{assert.deepEqual(await take(resumed,2),[2,3]);}finally{await resumed.cancel().catch(()=>{});resumed.releaseLock();}
});
test('a recheck that could not finish before the window ends is not started: the window closes cleanly instead',async()=>{
 // Each recheck takes 200 ms; the window opens (0-200 ms) and releases the first page (200-400 ms). The idle recheck falls due
 // at about 850 ms, where it would still be running at the 1000 ms cap and end the window in SUBSCRIPTION_UNAVAILABLE.
 const f=fixture();f.state.visible=1;f.state.passMs=200;const reader=f.open({maxSubscriptionMs:1000,idleRecheckMs:450});
 try{assert.deepEqual(await take(reader,1),[1]);const rechecks=f.state.rechecks;
  assert.equal((await reader.read()).done,true,'a clean close, not SUBSCRIPTION_UNAVAILABLE');
  assert.equal(f.state.rechecks,rechecks,'the recheck that could not fit was not started');
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 f.state.passMs=0;f.state.visible=2;const resumed=createConversationEventSource({service:f.service,credential:'action-session',after:1,pollMs:10}).getReader();
 try{assert.deepEqual(await take(resumed,1),[2],'the reconnect resumes exactly after the accepted cursor');}finally{await resumed.cancel().catch(()=>{});resumed.releaseLock();}
});
test('idle windows end with a clean close at the cap every time, not with the lifetime deadline',async()=>{
 const f=fixture();f.state.visible=1;let clean=0;const windows=20;
 for(let i=0;i<windows;i++){const reader=f.open({maxSubscriptionMs:60+(i%7)});
  try{assert.deepEqual(await take(reader,1),[1]);clean+=await reader.read().then(next=>next.done?1:0,()=>0);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}}
 assert.equal(clean,windows,'every idle window closed cleanly (the lifetime timer used to win the race at the cap)');
});
