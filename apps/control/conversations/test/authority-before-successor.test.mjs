/** SYNTHETIC: actual lifecycle/session/store composition with scripted SQL and explicit authority/native ports. */
import test from 'node:test';import assert from 'node:assert/strict';
import {lifecycleFixture,binding,id,scopes} from './lifecycle-fixture.mjs';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {createConversationLifecycleService} from '../lifecycle/service.mjs';
for(const fault of ['denied','revoked','scope','actor','expired'])test(`fresh ${fault} authority refuses before successor insertion`,async()=>{
 const f=await lifecycleFixture();try{
  await f.running();await f.control({controlId:id(900),intent:'pause'});await f.claim(id(900));await f.checkpoint(id(900));
  let calls=0;const authority={async readCurrent({binding:b}){calls++;assert.deepEqual(b,binding,'source remains current until successor commit');
   if(['denied','revoked'].includes(fault))throw Error('synthetic denial');
   return {binding:fault==='actor'?{...b,actorId:'other'}:b,scopes:fault==='scope'?[]:scopes,selectedClientId:id(5),policyRevision:'policy1',checkedAtMs:Date.now(),expiresAtMs:Date.now()+(fault==='expired'?-1:30000)};
  }};
  const store=createPostgresConversationStore({pool:f.pool,transitionAuthority:authority});
  const service=createConversationLifecycleService({store,service:f.service,dispatcher:f.dispatcher,sessions:f.sessions,checkpoints:f.checkpoints,nativeAdmission:f.nativeAdmission,approvals:f.approvals});
  const before=f.state.starts,proof=f.proofs.get(id(220));
  await assert.rejects(service.control({credential:f.credential,input:{controlId:id(901),intent:'resume',checkpointId:id(220),checkpointSha256:proof.checkpointSha256}}),/LIFECYCLE_EFFECT_UNKNOWN/);
  assert.equal(calls,1);assert.equal(f.state.runs.size,1);assert.equal(f.state.starts,before);assert.equal(f.state.continued,0);
  assert.equal(f.state.runs.values().next().value.sequence_end,null);
  assert.equal([...f.state.controls.values()].find(r=>r.control_id===id(901)).projection.state,'UNKNOWN','native retirement/admission were attempted; uncertainty remains a barrier');
 }finally{f.close();}
});
