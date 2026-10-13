/** Actual current session, private facade, canonical SQL owner; synthetic ports only. */
import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;assert.ok(root);
const {lifecycleFixture,binding,id}=await import(pathToFileURL(root+'/apps/control/conversations/test/lifecycle-fixture.mjs'));
async function paused(){const f=await lifecycleFixture();await f.running();await f.control({controlId:id(600),intent:'pause'});await f.claim(id(600));await f.checkpoint(id(600));return f;}
test('Current resume releases a fresh target, keeps exact original request and prevents old credential use',async()=>{
 const f=await paused();try{const p=f.proofs.get(id(220)),result=await f.control({controlId:id(601),intent:'resume',checkpointId:id(220),checkpointSha256:p.checkpointSha256});
  assert.equal(result.state,'APPLIED');assert.equal(f.state.retirements,1);assert.equal(f.state.admissions,1);assert.equal(f.state.continued,1);
  assert.equal(result.targetBinding.conversationId,binding.conversationId);assert.ok(result.targetBinding.writerFence>binding.writerFence);
  await assert.rejects(f.service.loadForExecution({credential:f.credential,binding:result.targetBinding}));
 }finally{f.close();}
});
test('Authenticated source cancellation during native admission cannot create or start a resume target',async()=>{
 const f=await paused(),entered=Promise.withResolvers(),release=Promise.withResolvers();const original=f.nativeAdmission.admit;
 f.nativeAdmission.admit=async function(args){const result=await original.call(this,args);entered.resolve();await release.promise;return result;};
 let observed,error;try{const p=f.proofs.get(id(220));const pending=f.control({controlId:id(602),intent:'resume',checkpointId:id(220),checkpointSha256:p.checkpointSha256}).then(v=>{observed=v;},e=>{error=e;});
  await entered.promise;const cancelled=await f.service.cancel({credential:f.credential});assert.equal(cancelled.state,'cancelled');
  release.resolve();await pending;
  console.log(JSON.stringify({case:'resume cancelled while native admit parked',releasedReceipt:observed,error:error?.message,runs:f.state.runs.size,starts:f.state.starts,continued:f.state.continued,cancels:f.state.cancels}));
  assert.ok(error,'Resume must refuse the cancelled source');assert.equal(observed,undefined);assert.equal(f.state.runs.size,1);assert.equal(f.state.starts,1);assert.equal(f.state.continued,0);
 }finally{release.resolve();f.close();}
});
test('Durable concurrent worker claims permit one attempt and never return UNKNOWN for redispatch',async()=>{
 const f=await lifecycleFixture();try{await f.running();const input={controlId:id(603),intent:'steer',text:'Only once'};await f.control(input);
  const page=await f.service.nextControls({credential:f.credential,binding}),item=page.controls[0];
  const claims=await Promise.all([1,2].map(()=>f.service.claimControl({credential:f.credential,binding,input:{controlId:input.controlId,commandSha256:item.commandSha256}})));
  assert.equal(claims.filter(c=>c.claimed).length,1);await f.service.ackControl({credential:f.credential,binding,input:{controlId:input.controlId,commandSha256:item.commandSha256,outcome:'UNKNOWN'}});
  assert.deepEqual((await f.service.nextControls({credential:f.credential,binding,after:0})).controls,[]);
  assert.equal((await f.control(input)).state,'UNKNOWN');assert.equal(f.state.signals,1);
 }finally{f.close();}
});
test('Held worker cannot fabricate cancellation, authenticated cancellation still reaches Temporal owner',async()=>{
 const f=await lifecycleFixture();try{await f.running();await f.control({controlId:id(604),intent:'pause'});
  await assert.rejects(f.service.publish({credential:f.credential,binding,event:{eventId:id(605),createdAt:new Date().toISOString(),type:'run.status',data:{state:'cancelled',reasonCode:'USER_CANCELLED'}}}));
  assert.equal((await f.service.cancel({credential:f.credential})).state,'cancelled');assert.equal(f.state.cancels,1);await assert.rejects(f.claim(id(604)));
 }finally{f.close();}
});
