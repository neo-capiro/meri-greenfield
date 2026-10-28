/** Actual lifecycle journal/session/service → actual activity, using no provider. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createConversationActivity} from '../activity.mjs';
import {createLifecycleRunOwner} from '../../../control/conversations/lifecycle/worker-owner.mjs';
import {SDK_MODEL_CONFIGURATION} from '../../../control/conversations/usage.mjs';
import {lifecycleFixture,binding,versions,id,allocateOriginal,settleInvocation} from '../../../control/conversations/test/lifecycle-fixture.mjs';
const stopped=()=>Promise.withResolvers(),success={type:'result',subtype:'success',is_error:false};
for(const intent of ['pause','approval.wait'])test('actual authenticated journal/activity '+intent+' retains exact checkpoint then resumes in a fresh session',async t=>{
 const f=await lifecycleFixture();t.after(()=>f.close());await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});await allocateOriginal(f.store,binding);
 let credential=f.credential,calls=0,closes=0,interrupts=0,targetOptions,targetPrompt;const stop=stopped(),interrupted=stopped();
 const runOwner=createLifecycleRunOwner({service:f.service,credentialForBinding:async()=>credential});
 // A native-session continuation carries its own SDK session lineage, so resume carries no reconstructed restore receipt
 // (options.mjs refuses one); the accepted lifecycle-activity.test.mjs wires prepareRuntime the same way.
 const runtime=async({binding:target})=>({binding:target,versions,cwd:`/workspace/conversations/${target.conversationId}`,...SDK_MODEL_CONFIGURATION,providerEnvironment:{},sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+3000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024});
 // The native capture proof is the fixture's own; the durable checkpoint receipt is the real lifecycle owner's
 // recordCheckpoint answer, exactly as the accepted hold composition wires it (lifecycle-hold-harness.mjs).
 const captureCheckpoint=async()=>{await f.capture();};
 const execute=createConversationActivity({runOwner,prepareRuntime:runtime,lifecycle:{captureCheckpoint,pollMs:5},query(args){calls++;return {async *[Symbol.asyncIterator](){
  yield {type:'system',subtype:'init',session_id:id(223)};const input=args.prompt[Symbol.asyncIterator]();assert.equal((await input.next()).value.uuid,f.input.requestId);
  await f.control({controlId:id(600),intent:'steer',text:'Exact supplemental direction'});const user=(await input.next()).value;assert.equal(user.uuid,id(600));assert.equal(user.message.content,'Exact supplemental direction');yield {...user,session_id:id(223)};
  await f.control({controlId:id(601),intent,...(intent==='approval.wait'?{proposalId:f.proposal.proposalId}:{})});await interrupted.promise;
  // An interrupted SDK turn still ends with its terminal result, and the hold drains that result before closing the query.
  // native-lifecycle-activity.test.mjs is the supported boundary for this ordering.
  yield {type:'result',subtype:'error_during_execution',is_error:true,session_id:id(223)};await stop.promise;
 },async interrupt(){interrupts++;interrupted.resolve();return {still_queued:[]};},close(){closes++;stop.resolve();}};}});
 const held=await execute({binding});assert.equal(held.state,intent==='pause'?'paused':'waiting-for-approval');assert.equal(calls,1);assert.equal(closes,1);assert.equal(interrupts,1);
 // The runtime records the settled invocation separately from the capture, and the durable proof is the one the journal
 // retains for this checkpoint — exactly the read-back the fixture's own checkpoint() helper performs (lifecycle-fixture.mjs).
 await settleInvocation(f.store,binding);
 const {proof}=await f.store.lifecycle.readSessionCapture({binding,scopes:(await f.store.read(binding,{after:0,limit:1},()=>{})).run.scopes,selectedClientId:id(5),checkpointId:binding.runId},()=>{});f.proofs.set(binding.runId,proof);
 assert.equal((await f.control({controlId:id(600),intent:'steer',text:'Exact supplemental direction'})).state,'APPLIED');
 const original=await f.service.history({credential}),p=f.proofs.get(binding.runId);assert.equal(original.run.state,held.state);assert.equal(p.sourceRequestSha256,f.state.runs.values().next().value.request_sha256);
 const resumed=await f.control({controlId:id(602),intent:'resume',checkpointId:p.checkpointId,checkpointSha256:p.checkpointSha256});assert.equal(resumed.state,'APPLIED');assert.equal(f.state.retirements,1);assert.equal(f.state.continued,1);
 await assert.rejects(f.service.loadForExecution({credential,binding:resumed.targetBinding}));f.state.context.binding=resumed.targetBinding;credential=(await f.sessions.issue({identityCredential:'synthetic-fresh-native'})).credential;
 const targetActivity=createConversationActivity({runOwner,prepareRuntime:runtime,lifecycle:{captureCheckpoint,pollMs:5},query(args){calls++;targetOptions=args.options;return {async *[Symbol.asyncIterator](){yield {type:'system',subtype:'init',session_id:id(223)};const user=(await args.prompt[Symbol.asyncIterator]().next()).value;targetPrompt=user.message.content;assert.notEqual(user.uuid,f.input.requestId);yield success;},async interrupt(){throw Error('unexpected target interrupt');},close(){closes++;}};}});
 assert.deepEqual(await targetActivity({binding:resumed.targetBinding}),{state:'completed'});const h=await f.service.history({credential});assert.equal(h.run.state,'completed');assert.equal(targetOptions.resume,id(223));assert.equal(targetPrompt,f.input.prompt);assert.deepEqual(h.request.window,original.request.window);assert.deepEqual(h.request.skill,original.request.skill);assert.equal(calls,2);assert.equal(closes,2);
 assert.equal([...f.state.runs.values()].find(r=>r.run_id===binding.runId).projection.state,held.state);assert.equal(f.state.runs.size,2);
});
