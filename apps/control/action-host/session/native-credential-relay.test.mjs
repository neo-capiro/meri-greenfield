import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createActionSessionOwner,issuedCurrentState} from './owner.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const limits={maxSessions:4,maxRequestMs:1000,maxTtlMs:10000,maxFactBytes:65536};
function fixture(){
 const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},scopes=[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'policy'}];let clock=Date.now();
 const verifyIdentity=async call=>{if(!String(call.credential).startsWith('native-'))throw Error('private denial');return {principal:{tenantId:'tenant',actorId:'actor'},identityRevision:'identity',checkedAtMs:clock,expiresAtMs:clock+20000};};
 const resolveContext=async({identity})=>({identitySha256:canonicalSha256(identity),binding,scopes,selectedClientId:id(5),contextRevision:'revision',checkedAtMs:clock,expiresAtMs:clock+20000});
 const owner=createActionSessionOwner({mode:'process-local',verifyIdentity,resolveContext,now:()=>clock,limits});
 return {owner,binding,advance:ms=>{clock+=ms;}};
}
const code=c=>e=>e?.code===c;
test('the relay returns the live session credential only for the exact run and selected client',async()=>{
 const f=fixture();try{
  await f.owner.issue({identityCredential:'native-identity'});
  const got=f.owner.nativeCredentialFor({binding:{...f.binding,attemptId:id(9)},selectedClientId:id(5)});
  assert.equal(got.credential,'native-identity');assert.ok(Object.isFrozen(got));assert.ok(got.expiresAtMs>Date.now()-1);
  for(const binding of [{...f.binding,runId:id(7)},{...f.binding,conversationId:id(7)},{...f.binding,actorId:'other'},{...f.binding,tenantId:'other'}])
   assert.throws(()=>f.owner.nativeCredentialFor({binding,selectedClientId:id(5)}),code('SESSION_UNAVAILABLE'));
  assert.throws(()=>f.owner.nativeCredentialFor({binding:f.binding,selectedClientId:id(6)}),code('SESSION_UNAVAILABLE'));
 }finally{f.owner.close();}
});
test('the freshest matching session wins; expiry, revocation and close refuse',async()=>{
 const f=fixture();try{
  const a=await f.owner.issue({identityCredential:'native-a'});f.advance(1000);await f.owner.issue({identityCredential:'native-b'});
  assert.equal(f.owner.nativeCredentialFor({binding:f.binding,selectedClientId:id(5)}).credential,'native-b');
  f.advance(9500);assert.equal(f.owner.nativeCredentialFor({binding:f.binding,selectedClientId:id(5)}).credential,'native-b');
  f.advance(2000);assert.throws(()=>f.owner.nativeCredentialFor({binding:f.binding,selectedClientId:id(5)}),code('SESSION_UNAVAILABLE'));
  const c=await f.owner.issue({identityCredential:'native-c'});f.owner.revoke(c.credential);
  assert.throws(()=>f.owner.nativeCredentialFor({binding:f.binding,selectedClientId:id(5)}),code('SESSION_UNAVAILABLE'));
  void a;await f.owner.issue({identityCredential:'native-d'});f.owner.close();
  assert.throws(()=>f.owner.nativeCredentialFor({binding:f.binding,selectedClientId:id(5)}),code('SESSION_REFUSED'));
 }finally{f.owner.close();}
});
test('malformed requests refuse before any session is inspected',()=>{
 const f=fixture();
 for(const input of [undefined,{},{binding:f.binding},{binding:null,selectedClientId:id(5)},{binding:{...f.binding,runId:'x'},selectedClientId:id(5)},{binding:f.binding,selectedClientId:'client'},{binding:f.binding,selectedClientId:id(5),extra:1}])
  assert.throws(()=>f.owner.nativeCredentialFor(input),e=>e?.name==='ActionSessionError'||e instanceof Error);
 f.owner.close();
});

test('derived sessions cannot keep a revoked original session alive in the native relay',async()=>{
 const f=fixture();try{
  const original=await f.owner.issue({identityCredential:'native-original'});
  f.advance(1000);const derived=await f.owner.issueDerived({identityCredential:'native-derived'});
  assert.equal(f.owner.nativeCredentialFor({binding:f.binding,selectedClientId:id(5)}).credential,'native-original');
  await f.owner.authenticateSession({credential:derived.credential});
  f.owner.revoke(original.credential);
  assert.throws(()=>f.owner.nativeCredentialFor({binding:f.binding,selectedClientId:id(5)}),code('SESSION_UNAVAILABLE'));
  assert.equal(f.owner.status().sessions,1);
  f.owner.revoke(derived.credential);assert.equal(f.owner.status().sessions,0);
 }finally{f.owner.close();}
});
// The merged issuance (PR190 relay eligibility + candidate C3 current-state issuance): the private current-state issuer worker-http
// uses is still served and its session feeds the relay; a derived session (artifact intent preparers) never does, even when fresher.
test('the current-state issuance is still served and relay-eligible; a derived session never reaches the relay',async()=>{
 const f=fixture();try{
  const issueCurrent=issuedCurrentState(f.owner);assert.equal(typeof issueCurrent,'function');
  const derived=await f.owner.issueDerived({identityCredential:'native-derived'});
  assert.throws(()=>f.owner.nativeCredentialFor({binding:f.binding,selectedClientId:id(5)}),code('SESSION_UNAVAILABLE'),'a derived session alone gives the relay nothing');
  f.advance(1000);const issued=await issueCurrent({identityCredential:'native-current'});
  assert.deepEqual(issued.current.binding,f.binding);assert.equal(issued.current.selectedClientId,id(5));assert.match(issued.receipt.credential,/^action_session_/u);
  assert.equal(f.owner.nativeCredentialFor({binding:f.binding,selectedClientId:id(5)}).credential,'native-current');
  f.advance(1000);await f.owner.issueDerived({identityCredential:'native-derived-fresher'});
  assert.equal(f.owner.nativeCredentialFor({binding:f.binding,selectedClientId:id(5)}).credential,'native-current','a fresher derived session does not displace it');
  await f.owner.authenticateSession({credential:derived.credential});
 }finally{f.owner.close();}
});
