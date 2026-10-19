/** Focused owner-bound observation checks; synthetic authority only, with no network or database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createActionSessionOwner,authenticatedCurrentState} from './owner.mjs';
import {createActionSessionApplication} from './http.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture(t){
 const state={now:Date.now(),calls:[],hook:null};
 const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const scopes=[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'policy'}];
 const principal={tenantId:'tenant',actorId:'actor',role:'standard_user',permissions:[],clientIds:[id(5)],membershipRevision:'member'};
 const observe=async(stage,value,call)=>{state.calls.push({stage,call});await state.hook?.(stage,value,call);return value;};
 const owner=createActionSessionOwner({mode:'process-local',now:()=>state.now,limits:{maxSessions:4,maxRequestMs:1000,maxTtlMs:10000,maxFactBytes:65536},
  verifyIdentity:call=>observe('identity',{principal:{tenantId:'tenant',actorId:'actor'},identityRevision:'identity',checkedAtMs:state.now,expiresAtMs:state.now+60000},call),
  resolveContext:call=>observe('context',{identitySha256:hash(call.identity),binding:structuredClone(binding),scopes:structuredClone(scopes),selectedClientId:id(5),contextRevision:'context',checkedAtMs:state.now,expiresAtMs:state.now+60000},call),
  membership:{admit:call=>observe('admit',{principal:structuredClone(principal),expiresAtMs:state.now+60000},call),
   recheck:call=>observe('member',structuredClone(principal),call)}});
 t.after(()=>owner.close());
 return {owner,state,binding,scopes,read:authenticatedCurrentState(owner),async issue(){const issued=await owner.issue({identityCredential:'native'});state.calls=[];return issued;}};
}

test('one fresh owner observation correlates both immutable receipts and preserves the public session port',async t=>{
 const f=fixture(t),issued=await f.issue();
 assert.deepEqual(Object.keys(f.owner).sort(),['issue','authenticateSession','readCurrentState','verifyTransition','nativeCredentialFor','revoke','close','status'].sort());
 assert.deepEqual(Object.getOwnPropertySymbols(f.owner),[]);
 assert.doesNotThrow(()=>createActionSessionApplication({owner:f.owner}));
 let traps=0;const proxy=new Proxy(f.owner,{get(){traps++;throw Error('must not inspect');}});
 for(const unknown of [{...f.owner},{},proxy,null,undefined])assert.equal(authenticatedCurrentState(unknown),undefined);
 assert.equal(traps,0);
 const pair=await f.read({credential:issued.credential});
 assert.deepEqual(f.state.calls.map(c=>c.stage),['identity','member','context','member']);
 assert.deepEqual(pair.current.binding,f.binding);assert.deepEqual(pair.current.scopes,f.scopes);
 assert.equal(pair.current.authenticationSha256,hash(pair.authentication));
 assert.equal(pair.authentication.expiresAtMs,issued.expiresAtMs);assert.equal(pair.current.expiresAtMs,issued.expiresAtMs);
 assert.ok(Object.isFrozen(pair)&&Object.isFrozen(pair.authentication)&&Object.isFrozen(pair.current));
 f.state.now++;f.state.calls=[];
 const next=await f.read({credential:issued.credential});
 assert.deepEqual(f.state.calls.map(c=>c.stage),['identity','member','context','member'],'a second call has no cached authority');
 assert.ok(next.authentication.checkedAtMs>pair.authentication.checkedAtMs);
 f.state.calls=[];
 await f.owner.readCurrentState({authentication:pair.authentication});
 assert.equal(f.state.calls.length,4,'the combined authentication is registered and standalone current still resolves afresh');
});

test('separate authentication and current methods each retain their complete fresh observations',async t=>{
 const f=fixture(t),issued=await f.issue(),authentication=await f.owner.authenticateSession({credential:issued.credential});
 const current=await f.owner.readCurrentState({authentication});
 assert.equal(current.authenticationSha256,hash(authentication));
 assert.deepEqual(f.state.calls.map(c=>c.stage),['identity','member','context','member','identity','member','context','member']);
});

test('forged credentials and cross-session receipts cannot use the combined observation',async t=>{
 const f=fixture(t),a=await f.issue(),b=await f.issue();
 await assert.rejects(f.read({credential:'native'}),/SESSION_REFUSED/u);assert.equal(f.state.calls.length,0);
 const one=await f.read({credential:a.credential}),two=await f.read({credential:b.credential});
 f.state.calls=[];
 await assert.rejects(f.owner.readCurrentState({authentication:{...one.authentication,principal:{...one.authentication.principal,sessionId:two.authentication.principal.sessionId}}}),/SESSION_REFUSED/u);
 assert.equal(f.state.calls.length,0);
});

for(const [name,stage,mutate] of [
 ['identity revision','identity',v=>{v.identityRevision='other';}],
 ['identity tenant','identity',v=>{v.principal.tenantId='other';}],
 ['identity actor','identity',v=>{v.principal.actorId='other';}],
 ['context revision','context',v=>{v.contextRevision='other';}],
 ['context tenant','context',v=>{v.binding.tenantId='other';}],
 ['selected client','context',v=>{v.selectedClientId=id(99);}],
 ['scope policy','context',v=>{v.scopes[0].policyRevision='other';}],
 ['membership revision','member',v=>{v.membershipRevision='other';}],
 ['membership selected client','member',v=>{v.clientIds=[];}],
 ['identity stale fact','identity',v=>{v.checkedAtMs--;}],
 ['identity future fact','identity',v=>{v.checkedAtMs++;}],
 ['identity expired fact','identity',v=>{v.expiresAtMs=v.checkedAtMs;}],
 ['context stale fact','context',v=>{v.checkedAtMs--;}],
 ['context future fact','context',v=>{v.checkedAtMs++;}],
 ['context expired fact','context',v=>{v.expiresAtMs=v.checkedAtMs;}],
])test(`combined observation refuses ${name} and invalidates the session`,async t=>{
 const f=fixture(t),issued=await f.issue();f.state.hook=(at,value)=>{if(at===stage)mutate(value);};
 await assert.rejects(f.read({credential:issued.credential}),/SESSION_REFUSED/u);
 assert.equal(f.owner.status().sessions,0);
});

for(const stage of ['identity','context','member'])for(const action of ['revoke','close'])test(`${action} while ${stage} is pending prevents combined receipt release`,async t=>{
 const f=fixture(t),issued=await f.issue(),entered=Promise.withResolvers(),release=Promise.withResolvers();
 f.state.hook=async at=>{if(at===stage){entered.resolve();await release.promise;}};
 const pending=f.read({credential:issued.credential});pending.catch(()=>{});
 await entered.promise;action==='revoke'?f.owner.revoke(issued.credential):f.owner.close();release.resolve();
 await assert.rejects(pending,/SESSION_REFUSED/u);assert.equal(f.owner.status().sessions,0);
});

test('membership revocation after context still prevents combined receipt release',async t=>{
 const f=fixture(t),issued=await f.issue();let pastContext=false;
 f.state.hook=(stage,v)=>{if(stage==='context')pastContext=true;if(stage==='member'&&pastContext)v.clientIds=[];};
 await assert.rejects(f.read({credential:issued.credential}),/SESSION_REFUSED/u);
 assert.deepEqual(f.state.calls.map(c=>c.stage),['identity','member','context','member']);
 assert.equal(f.owner.status().sessions,0);
});

test('expired sessions refuse before authority reads and caller cutoffs reach every observation port',async t=>{
 const f=fixture(t),issued=await f.issue(),deadlineMs=f.state.now+25;
 await f.read({credential:issued.credential,deadlineMs});
 assert.ok(f.state.calls.every(({call})=>call.deadlineMs<=deadlineMs));
 f.state.calls=[];f.state.now=issued.expiresAtMs;
 await assert.rejects(f.read({credential:issued.credential}),/SESSION_REFUSED/u);assert.equal(f.state.calls.length,0);
});

test('deadline expiry and cancellation during context cannot release combined authority',async t=>{
 for(const action of ['deadline','cancel']){
  const f=fixture(t),issued=await f.issue(),abort=new AbortController(),deadlineMs=f.state.now+25;
  f.state.hook=stage=>{if(stage==='context'){if(action==='deadline')f.state.now=deadlineMs;else abort.abort();}};
  await assert.rejects(f.read({credential:issued.credential,deadlineMs,signal:abort.signal}),/SESSION_REFUSED/u);
  assert.equal(f.owner.status().sessions,0);
 }
});
