import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {ActionSessionError,createActionSessionOwner} from './owner.mjs';
import {createConversationService} from '../../conversations/service.mjs';
import {createConversationEventSource} from '../../conversations/events.mjs';
import {binding,scopes,versions,id} from '../../conversations/test/store-fixture.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';

const NOW=1791840000000;
const methods=['authenticateSession','readCurrentState'];
function gate(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}

async function fixture(t){
 const state={now:NOW,identityRevision:'identity-1',contextRevision:'context-1',membershipRevision:'membership-1',hooks:{},calls:{identity:0,context:0,membership:0}};
 const now=()=>state.now;
 const principal=()=>({tenantId:binding.tenantId,actorId:binding.actorId,role:'standard_user',permissions:[],clientIds:[id(5)],membershipRevision:state.membershipRevision});
 const receipt=(port,value,call)=>{state.calls[port]++;return state.hooks[port]?.(value,call)??value;};
 const owner=createActionSessionOwner({mode:'process-local',now,limits:{maxSessions:4,maxRequestMs:1000,maxTtlMs:10000,maxFactBytes:65536},
  verifyIdentity(call){return receipt('identity',{principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:state.identityRevision,checkedAtMs:now(),expiresAtMs:NOW+20000},call);},
  resolveContext(call){return receipt('context',{identitySha256:canonicalSha256(call.identity),binding,scopes,selectedClientId:id(5),contextRevision:state.contextRevision,checkedAtMs:now(),expiresAtMs:NOW+20000},call);},
  membership:{admit(){return {principal:principal(),expiresAtMs:NOW+20000};},recheck(call){return receipt('membership',principal(),call);}},
 });
 t.after(()=>owner.close());
 const issued=await owner.issue({identityCredential:'synthetic-native'});
 const authentication=await owner.authenticateSession({credential:issued.credential});
 const invoke=(method,extra={})=>owner[method]({...((method==='authenticateSession')?{credential:issued.credential}:{authentication}),...extra});
 return {owner,state,now,issued,authentication,invoke};
}

function park(t,f,port){
 const entered=gate(),release=gate();let signal;
 f.state.hooks[port]=async(value,call)=>{signal=call.signal;entered.resolve();await release.promise;return value;};
 t.after(()=>release.resolve());
 return {entered:entered.promise,release:()=>release.resolve(),signal:()=>signal};
}

for(const method of methods)for(const port of ['identity','context','membership']){
 test(`${method}: request cancellation during ${port} preserves the live session and rejects late release`,async t=>{
  const f=await fixture(t),blocked=park(t,f,port),abort=new AbortController();let released=0;
  const pending=f.invoke(method,{signal:abort.signal}).then(value=>{released++;return value;});
  const rejected=assert.rejects(pending,{code:'SESSION_REFUSED'});
  await blocked.entered;
  delete f.state.hooks[port];
  // The parked request shares this record with another independently authorized reader.
  const concurrent=await f.owner.authenticateSession({credential:f.issued.credential});
  assert.equal(concurrent.sessionRevision,f.authentication.sessionRevision);
  abort.abort();await rejected;assert.equal(blocked.signal().aborted,true);
  blocked.release();await nextTurn();
  assert.equal(released,0);
  assert.equal(f.owner.status().sessions,1,'a cancelled read must not revoke the shared live session');
  const before={...f.state.calls};
  const fresh=await f.owner.authenticateSession({credential:f.issued.credential});
  const current=await f.owner.readCurrentState({authentication:fresh});
  assert.deepEqual(fresh.principal,f.authentication.principal);
  assert.equal(fresh.sessionRevision,f.authentication.sessionRevision);
  assert.equal(fresh.expiresAtMs,f.issued.expiresAtMs);
  assert.equal(current.expiresAtMs,f.issued.expiresAtMs);
  assert.deepEqual(current.binding,binding);
  for(const name of ['identity','context','membership'])assert.ok(f.state.calls[name]>before[name],`${name} must be checked again`);
 });
}

for(const method of methods)for(const mutation of ['expiry','revocation','invalid clock','identity','context','membership']){
 test(`${method}: request cancellation cannot preserve ${mutation} invalidation`,async t=>{
  const f=await fixture(t),blocked=park(t,f,'identity'),abort=new AbortController();
  const rejected=assert.rejects(f.invoke(method,{signal:abort.signal}),{code:'SESSION_REFUSED'});
  await blocked.entered;
  if(mutation==='expiry')f.state.now=f.issued.expiresAtMs;
  else if(mutation==='revocation')f.owner.revoke(f.issued.credential);
  else if(mutation==='invalid clock')f.state.now=NaN;
  abort.abort();await rejected;
  delete f.state.hooks.identity;blocked.release();await nextTurn();
  if(mutation==='identity')f.state.identityRevision='identity-2';
  if(mutation==='context')f.state.contextRevision='context-2';
  if(mutation==='membership')f.state.membershipRevision='membership-2';
  await assert.rejects(f.owner.authenticateSession({credential:f.issued.credential}),{code:'SESSION_REFUSED'});
  assert.equal(f.owner.status().sessions,0);
 });
}

for(const method of methods)for(const failure of ['unknown','AbortError','CANCELLED','DEADLINE']){
 test(`${method}: ${failure} without a cancelled request still invalidates`,async t=>{
  const f=await fixture(t),abort=new AbortController();
  f.state.hooks.identity=()=>{throw Object.assign(Error(failure),{name:failure,code:failure});};
  await assert.rejects(f.invoke(method,{signal:abort.signal}),{code:'SESSION_REFUSED'});
  assert.equal(abort.signal.aborted,false);
  assert.equal(f.owner.status().sessions,0);
 });
}

for(const method of methods){
 test(`${method}: owner-only timeout invalidates despite a still-live request`,async t=>{
  const f=await fixture(t),blocked=park(t,f,'identity'),abort=new AbortController();
  const rejected=assert.rejects(f.invoke(method,{signal:abort.signal,deadlineMs:NOW+20}),{code:'SESSION_REFUSED'});
  await blocked.entered;await rejected;
  assert.equal(abort.signal.aborted,false);
  assert.equal(f.owner.status().sessions,0);
  blocked.release();await nextTurn();
  assert.equal(f.owner.status().sessions,0);
 });
}

for(const method of methods)for(const port of ['identity','context','membership'])for(const kind of ['unknown','authority refusal']){
 test(`${method}: ${port} ${kind} winning before caller abort still invalidates`,async t=>{
  const f=await fixture(t),abort=new AbortController();
  const failure=kind==='unknown'?Error('synthetic upstream failure'):new ActionSessionError('SESSION_REFUSED');
  f.state.hooks[port]=()=>{
   // Let the synchronous port rejection win the work race, then abort before its awaiting continuation.
   queueMicrotask(()=>queueMicrotask(()=>abort.abort()));
   throw failure;
  };
  await assert.rejects(f.invoke(method,{signal:abort.signal}),{code:'SESSION_REFUSED'});
  assert.equal(abort.signal.aborted,true);
  assert.equal(f.owner.status().sessions,0,'a later caller abort must not disguise the prior port failure');
 });
}

for(const method of methods){
 test(`${method}: owner deadline winning before caller abort still invalidates`,async t=>{
  const f=await fixture(t),abort=new AbortController(),entered=gate(),release=gate();
  t.after(()=>release.resolve());
  f.state.hooks.identity=async(value,call)=>{
   call.signal.addEventListener('abort',()=>abort.abort(),{once:true});entered.resolve();
   await release.promise;return value;
  };
  const rejected=assert.rejects(f.invoke(method,{signal:abort.signal,deadlineMs:NOW+20}),{code:'SESSION_REFUSED'});
  await entered.promise;await rejected;
  assert.equal(abort.signal.aborted,true);
  assert.equal(f.owner.status().sessions,0,'the winning owner deadline must remain invalidating');
  release.resolve();await nextTurn();
  assert.equal(f.owner.status().sessions,0);
 });
}

for(const boundary of ['request abort','subscription deadline'])test(`event ${boundary} reconnects with the same credential and accepted cursor`,async t=>{
 const f=await fixture(t),abort=new AbortController(),entered=gate(),release=gate();
 t.after(()=>release.resolve());
 const events=[1,2].map(sequence=>({contractVersion:'0.1.0',eventId:id(30+sequence),binding,sequence,createdAt:new Date(NOW).toISOString(),scopes,type:'run.status',data:{state:sequence===1?'queued':'running',reasonCode:null}}));
 let runState='running';const seenCursors=[];
 const service=createConversationService({sessions:f.owner,now:f.now,versions,maxRequestMs:1000,
  dispatcher:{async start(){throw Error('unexpected dispatch');},async cancel(){throw Error('unexpected durable cancellation');}},
  store:{async accept(){throw Error('unexpected write');},async append(){throw Error('unexpected write');},async read(_binding,{after,limit}){seenCursors.push(after);return {run:{binding,scopes,state:runState,createdAt:new Date(NOW).toISOString(),policyRevision:'policy1',versions},request:{requestId:id(6),prompt:'Synthetic',skill:null,window:null,windowRequest:null},events:events.filter(event=>event.sequence>after).slice(0,limit),lastSequence:2};}},
 });
 let identityReads=0;
 f.state.hooks.identity=async value=>{if(++identityReads===5){entered.resolve();await release.promise;}return value;};
 const source=createConversationEventSource({service,credential:f.issued.credential,signal:abort.signal,now:f.now,maxSubscriptionMs:boundary==='subscription deadline'?100:30000}),reader=source.getReader();
 t.after(()=>reader.releaseLock());
 const first=await reader.read();assert.equal(first.value.sequence,1);const cursor=first.value.sequence;
 const pending=reader.read(),rejected=assert.rejects(pending,/SUBSCRIPTION_UNAVAILABLE/);
 await entered.promise;if(boundary==='request abort')abort.abort();await rejected;
 delete f.state.hooks.identity;release.resolve();await nextTurn();
 // Use the actual preflight owner, then the actual event source, with the prior accepted cursor.
 const preflight=await service.history({credential:f.issued.credential,after:cursor,limit:1});
 assert.equal(preflight.events[0].sequence,2);
 runState='completed';
 const reconnected=createConversationEventSource({service,credential:f.issued.credential,after:cursor,now:f.now}).getReader();
 t.after(()=>reconnected.releaseLock());
 assert.equal((await reconnected.read()).value.sequence,2);
 assert.equal((await reconnected.read()).done,true);
 assert.deepEqual(seenCursors,[0,1,1]);
 assert.equal(f.owner.status().sessions,1);
 const fresh=await f.owner.authenticateSession({credential:f.issued.credential});
 assert.equal(fresh.sessionRevision,f.authentication.sessionRevision);
 assert.equal(fresh.expiresAtMs,f.issued.expiresAtMs);
});
