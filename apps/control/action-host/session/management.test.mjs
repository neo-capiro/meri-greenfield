import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {markAuthorityUnavailable} from '../../../../packages/runtime/authority-availability.mjs';
import {createActionSessionOwner,routineManagementSessions,borrowedRunSession} from './owner.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
function fixture(){
 let at=Date.now();const state={member:'a'.repeat(64),denied:false,unavailable:false,calls:0,executionCalls:0,mutate:null,hold:null};
 const owner=createActionSessionOwner({mode:'process-local',now:()=>at,refusals:()=>{},limits:{maxSessions:2,maxRequestMs:1000,maxTtlMs:10000,maxFactBytes:65536},
  verifyIdentity:async()=>{state.executionCalls++;throw Error('must not resolve conversation identity');},resolveContext:async()=>{state.executionCalls++;throw Error('must not select run');},
  management:{versions,policyRevision:'policy',async readCurrent(call){state.calls++;assert.equal(call.policyRevision,'policy');assert.equal(call.credential,'native-identity');
   if(state.hold)await state.hold();if(state.unavailable)throw markAuthorityUnavailable(Error('unavailable'));if(state.denied)throw Error('denied');
   const current={kind:'routine-management',principal:{tenantId:'tenant',actorId:'actor'},scopes:[{kind:call.clientId===null?'private-user':'client',tenantId:'tenant',resourceId:call.clientId??'actor',policyRevision:'policy'}],selectedClientId:call.clientId,membershipRevision:state.member};
   const receipt={...current,contextRevision:hash(current),checkedAtMs:at,expiresAtMs:at+20000};state.mutate?.(receipt);return receipt;
  }}});
 return {owner,management:routineManagementSessions(owner),state,now:()=>at,advance:ms=>at+=ms};
}
for(const clientId of [null,id(1)])test(`cold ${clientId===null?'General':'client'} session uses current scope only and cannot be borrowed for execution`,async()=>{
 const f=fixture();try{const issued=await f.management.issue({identityCredential:'native-identity',clientId});
  assert.deepEqual(issued.context,{tenantId:'tenant',actorId:'actor',selectedClientId:clientId});assert.equal(issued.kind,'routine-management');
  const {authentication,current}=await f.management.authenticate({credential:issued.credential});assert.equal(current.authenticationSha256,hash(authentication));assert.deepEqual(current.versions,versions);
  assert.deepEqual(f.management.nativeCredentialFor({authentication}),{credential:'native-identity',expiresAtMs:issued.expiresAtMs});
  assert.equal(f.state.executionCalls,0);assert.equal(f.state.calls,2);assert.equal(current.binding,undefined);assert.equal(authentication.principal.runId,undefined);
  await assert.rejects(f.owner.authenticateSession({credential:issued.credential}));await assert.rejects(f.owner.readCurrentState({authentication}));
  const binding={tenantId:'tenant',actorId:'actor',conversationId:id(2),runId:id(3),attemptId:id(4),workerId:id(5),writerFence:1};
  assert.throws(()=>f.owner.nativeCredentialFor({binding,selectedClientId:clientId}));assert.throws(()=>borrowedRunSession(f.owner)({binding,selectedClientId:clientId}));
  assert.throws(()=>f.management.nativeCredentialFor({authentication:{...authentication,sessionRevision:'forged'}}));
 }finally{f.owner.close();}
});
test('explicit scope, freshness, wall and exact membership revision precede a management release',async()=>{
 for(const mutate of [r=>r.selectedClientId=id(9),r=>r.scopes[0].resourceId=id(9),r=>r.scopes[0].policyRevision='new',r=>r.contextRevision='0'.repeat(64),r=>r.expiresAtMs=r.checkedAtMs,r=>r.checkedAtMs--]){
  const f=fixture();try{f.state.mutate=mutate;await assert.rejects(f.management.issue({identityCredential:'native-identity',clientId:null}));assert.equal(f.owner.status().sessions,0);}finally{f.owner.close();}
 }
 const f=fixture();try{for(const value of [{},{clientId:undefined},{clientId:null,runId:id(2)}])await assert.rejects(f.management.issue({identityCredential:'native-identity',...value}));
  const issued=await f.management.issue({identityCredential:'native-identity',clientId:null});f.state.member='b'.repeat(64);await assert.rejects(f.management.authenticate({credential:issued.credential}));assert.equal(f.owner.status().sessions,0);
 }finally{f.owner.close();}
});
test('management shares capacity, expiry and revoke with the original bounded owner',async()=>{
 const f=fixture();try{const issued=await f.management.issue({identityCredential:'native-identity',clientId:null});await f.management.issue({identityCredential:'native-identity',clientId:id(1)});
  await assert.rejects(f.management.issue({identityCredential:'native-identity',clientId:null}),/SESSION_CAPACITY/);
  f.advance(100);assert.equal((await f.management.authenticate({credential:issued.credential})).authentication.expiresAtMs,issued.expiresAtMs);
  f.owner.revoke(issued.credential);await assert.rejects(f.management.authenticate({credential:issued.credential}));f.advance(10000);assert.equal((await f.management.issue({identityCredential:'native-identity',clientId:null})).context.selectedClientId,null);
 }finally{f.owner.close();}await assert.rejects(f.management.issue({identityCredential:'native-identity',clientId:null}));
});
test('temporary owner absence keeps pins but a real refusal revokes; in-flight revoke releases no receipt',async()=>{
 const f=fixture();try{const issued=await f.management.issue({identityCredential:'native-identity',clientId:null});f.state.unavailable=true;
  await assert.rejects(f.management.authenticate({credential:issued.credential}),/SESSION_AUTHORITY_UNAVAILABLE/);assert.equal(f.owner.status().sessions,1);f.state.unavailable=false;
  await f.management.authenticate({credential:issued.credential});let resume,reached;const ready=new Promise(r=>reached=r);f.state.hold=()=>{reached();return new Promise(r=>resume=r);};
  const pending=f.management.authenticate({credential:issued.credential});await ready;f.owner.revoke(issued.credential);resume();await assert.rejects(pending);assert.equal(f.owner.status().sessions,0);
 }finally{f.owner.close();}
});
