import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {lifecycleFixture,binding,scopes,id} from './lifecycle-fixture.mjs';
import {browserSessionAccess,authenticatedCurrentState} from '../../action-host/session/owner.mjs';
import {BROWSER_CUSTODY_SCHEMA} from '../lifecycle/browser-custody.mjs';
const check=()=>{},begin=id(930),end=id(931);
beforeEach(t=>t.mock.timers.enable({apis:['Date','setTimeout'],now:Date.now()}));
async function fixture(){
 const f=await lifecycleFixture({browserSessions:true});await f.running();
 f.state.checkCurrentBinding=b=>f.store.nextRuns.current(b,check);
 const custody={schema:BROWSER_CUSTODY_SCHEMA,binding,controlId:begin,ownerInstanceId:id(932),hostId:id(933),generation:1,
  leaseEpoch:1,policySha256:'a'.repeat(64),expiresAtMs:Date.now()+60000};
 const read=()=>f.service.readTakeover({credential:f.credential});
 const hold=async()=>{await f.control({controlId:begin,intent:'takeover.begin'});await f.claim(begin);return f.checkpoint(begin,custody);};
 return {...f,custody,read,hold};
}
test('canonical takeover pending/APPLIED read recovers the same custody; explicit end retires source once',async()=>{
 const f=await fixture();try{
  assert.equal((await f.read()).state,'unavailable','an unadmitted browser is not advertised');
  await f.control({controlId:begin,intent:'takeover.begin'});assert.equal((await f.read()).state,'pending');
  await f.claim(begin);assert.equal((await f.read()).state,'pending');
  const held=await f.checkpoint(begin,f.custody);assert.equal(held.state,'APPLIED');
  const first=await f.read();assert.equal(first.state,'held');assert.equal(first.selectedClientId,id(5));
  assert.deepEqual(first.sourceBinding,binding);assert.deepEqual(first.custody,f.custody);
  const ordinary=await f.sessions.issue({identityCredential:'synthetic-native',hints:{conversationId:binding.conversationId,runId:binding.runId,clientId:id(5)}});
  assert.deepEqual((await authenticatedCurrentState(f.sessions)({credential:ordinary.credential})).current.binding,binding,'APPLIED custody retains ordinary source reads and exact renewal');
  assert.deepEqual(await f.read(),first,'a lost read answer never issues another control or lease');
  const returned={ownerInstanceId:f.custody.ownerInstanceId,leaseEpoch:2,snapshotSha256:'b'.repeat(64)};
  await f.service.returnTakeover({credential:f.credential,returned});
  await f.service.returnTakeover({credential:f.credential,returned});assert.equal((await f.read()).state,'released');
  const result=await f.control({controlId:end,intent:'takeover.end',checkpointId:first.checkpointId,checkpointSha256:first.checkpointSha256});
  assert.equal(result.state,'APPLIED');assert.equal(f.state.retirements,1);assert.equal(f.state.admissions,1);
  assert.equal(f.state.runs.size,2);assert.equal(f.state.continued,1);
  const execution=await f.store.lifecycle.execution({binding:result.targetBinding,scopes,selectedClientId:id(5)},check);
  assert.equal(execution.continuation.mode,'resume');assert.deepEqual(execution.browserHandoff,{custody:f.custody,returned,targetBinding:result.targetBinding,controlId:end});
  await assert.rejects(f.read(),/SESSION_REFUSED/,'source viewer authority ends when successor becomes current');
 }finally{f.close();}
});
for(const mode of ['resume','fork','takeover.end'])test(`takeover custody refuses ${mode} before verified hand-back`,async()=>{
 const f=await fixture();try{await f.hold();const held=await f.read();
  await assert.rejects(f.control({controlId:end,intent:mode,checkpointId:held.checkpointId,checkpointSha256:held.checkpointSha256}));
  assert.equal(f.state.runs.size,1);assert.equal(f.state.retirements,0);assert.equal(f.state.admissions,0);
 }finally{f.close();}
});
test('custody rejects wrong owner/epoch, expires, and browser sessions cannot borrow ordinary action authority',async t=>{
 const f=await fixture();try{await f.hold();
  for(const returned of [{ownerInstanceId:id(934),leaseEpoch:2,snapshotSha256:'b'.repeat(64)},
   {ownerInstanceId:f.custody.ownerInstanceId,leaseEpoch:1,snapshotSha256:'b'.repeat(64)}])
   await assert.rejects(f.service.returnTakeover({credential:f.credential,returned}),/BROWSER_CUSTODY_REFUSED/);
  const facet=browserSessionAccess(f.sessions),issued=await facet.issue({identityCredential:'synthetic-native',hints:{conversationId:binding.conversationId,runId:binding.runId,clientId:id(5)}});
  const credential=issued.receipt.credential;
  assert.equal((await f.service.readTakeover({credential})).state,'held');
  await assert.rejects(authenticatedCurrentState(f.sessions)({credential}),/SESSION_REFUSED/);
  assert.equal((await f.service.readTakeover({credential})).state,'held','ordinary-operation refusal cannot expand browser authority');
  f.state.revoked=true;await assert.rejects(f.service.readTakeover({credential}),/SESSION_REFUSED/);
  t.mock.timers.tick(60001);
  const expired=await f.store.lifecycle.browserCustody.read({binding,scopes,selectedClientId:id(5)},check);
  assert.equal(expired.state,'unavailable');assert.equal(expired.custody,null);
 }finally{f.close();}
});


test('physical browser scope follows only its canonical takeover successor while old source remains stale',async()=>{
 const f=await fixture();try{await f.hold();
  const allocation={hostId:f.custody.hostId,generation:1,leaseDeadlineMs:f.custody.expiresAtMs};
  const current=async change=>{const client=await f.pool.connect();try{await client.query('BEGIN');
   const result=await f.store.lifecycle.browserCustody.currentHost(client,{binding,scopes,selectedClientId:id(5),allocation,...change},check);await client.query('COMMIT');return result;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}};
  assert.equal((await current()).phase,'browser-held');
  const first=await f.read();await f.service.returnTakeover({credential:f.credential,returned:{ownerInstanceId:f.custody.ownerInstanceId,leaseEpoch:2,snapshotSha256:'b'.repeat(64)}});
  const resumed=await f.control({controlId:end,intent:'takeover.end',checkpointId:first.checkpointId,checkpointSha256:first.checkpointSha256});
  const result=await current();assert.equal(result.phase,'browser-successor');assert.deepEqual(result.binding,binding);
  assert.deepEqual(result.browserSuccessor.binding,resumed.targetBinding);assert.deepEqual(result.browserSuccessor.handoff.custody,f.custody);assert.equal(result.browserSuccessor.handoff.controlId,end);assert.equal(result.sdkAdmitted,false);assert.equal(result.bashAdmitted,false);
  await assert.rejects(f.store.nextRuns.current(binding,check),/NEXT_RUN_NOT_LATEST/);
  await assert.rejects(current({allocation:{...allocation,generation:2}}),/BROWSER_CUSTODY_REFUSED/);
  await assert.rejects(current({binding:{...binding,actorId:id(945)}}));
  await f.store.append(resumed.targetBinding,{eventId:id(946),createdAt:new Date().toISOString(),type:'run.status',data:{state:'cancelled',reasonCode:'USER_CANCELLED'}},check);
  await assert.rejects(current(),/BROWSER_CUSTODY_REFUSED/);
 }finally{f.close();}
});
