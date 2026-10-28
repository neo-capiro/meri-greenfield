/** Synthetic (scripted SQL protocol fixture): Stop/failure/crash → next prompt through the canonical next-run owner and journal,
 * lifecycle store and run reconciler. The Runtime stop response is synthetic; logical execution state is real owner code. */
import test from 'node:test';import assert from 'node:assert/strict';
import {binding,scopes,id,versions} from './lifecycle-fixture.mjs';
import {fixture,check} from './next-run-recovery-fixture.mjs';
import {hash} from '../boundary.mjs';
for(const [label,end] of Object.entries({
 'failed (EXECUTION_FAILED)':async x=>{await x.running(binding);await x.f.store.append(binding,x.status('failed','EXECUTION_FAILED'),check);},
 'cancelled by Stop':async x=>{await x.running(binding);await x.f.service.cancel({credential:x.f.credential});},
 'cancelled while still queued':async x=>{await x.f.service.cancel({credential:x.f.credential});}
}))test(`${label} → an explicit next prompt is admitted only after execution settlement (no turn has completed)`,async()=>{const x=await fixture();try{
 await x.first();await end(x);assert(['failed','cancelled'].includes(await x.state()));
 await assert.rejects(x.select(),/NEXT_RUN_EXECUTION_UNSETTLED/,'the unsettled invocation is a barrier');assert.equal(x.f.state.nextRuns.size,0);
 await x.settle(binding);const selected=await x.select();assert.equal(selected.reserved,true);assert.equal(selected.binding.writerFence,2);
 const accepted=await x.accept(selected.binding,'try again');assert.equal(accepted.replayed,false);assert.equal(await x.lineage(selected.binding),null,'no checkpoint lineage: a fresh SDK session');
 const list=await x.f.store.nextRuns.listRuns({tenantId:binding.tenantId,conversationId:binding.conversationId},check);assert.equal(list.runs.length,2);assert.equal(list.runs[1].sequenceBase,list.runs[0].sequenceEnd);
 await assert.rejects(x.f.store.append(binding,x.status('failed','LATE'),check),/RUN_RANGE_CLOSED|RUN_TRANSITION_REFUSED/);}finally{x.f.close();}});
test('failed with unknown invocation or changed settlement facts is refused by the journal',async()=>{const x=await fixture();try{
 await x.first();await x.running(binding);await x.f.store.append(binding,x.status('failed','EXECUTION_FAILED'),check);
 await x.f.store.executions.record({binding,executionId:hash(binding),phase:'unknown',native:null},check);
 await assert.rejects(x.select(),/NEXT_RUN_EXECUTION_UNSETTLED/);await assert.rejects(x.reserveWith(binding,null),/NEXT_RUN_EXECUTION_UNSETTLED/,'the journal checks the invocation itself');
 assert.equal(x.f.state.nextRuns.size,0);}finally{x.f.close();}
 const y=await fixture();try{await y.first();await y.running(binding);await y.f.store.append(binding,y.status('failed','EXECUTION_FAILED'),check);await y.settle(binding);
  const row=y.f.state.executions.get([binding.tenantId,binding.conversationId,binding.runId].join(':'));row.record.native.state='completed';row.record_sha256=hash(row.record);
  await assert.rejects(y.select(),/NEXT_RUN_EXECUTION_UNSETTLED/);assert.equal(y.f.state.nextRuns.size,0);}finally{y.f.close();}});
test('HOLD_CHECKPOINT_FAILED → next prompt after retirement; the UNKNOWN hold stays a barrier on the source and is never delivered',async()=>{const x=await fixture();try{
 await x.first();await x.running(binding);await x.f.control({controlId:id(780),intent:'pause'});await x.f.store.append(binding,x.status('failed','HOLD_CHECKPOINT_FAILED'),check);
 const control=async()=>(await x.f.store.lifecycle.get({binding,scopes,selectedClientId:id(5),controlId:id(780)},check)).state;assert.equal(await control(),'UNKNOWN');
 await x.settle(binding);const selected=await x.select();await x.accept(selected.binding);assert.equal(await x.lineage(selected.binding),null);
 assert.equal(await control(),'UNKNOWN');const held=await x.f.store.lifecycle.get({binding,scopes,selectedClientId:id(5),controlId:id(780)},check);
 await assert.rejects(x.f.store.lifecycle.claim({binding,scopes,selectedClientId:id(5),controlId:id(780),commandSha256:held.commandSha256},check),/LIFECYCLE_STATE_REFUSED/);assert.equal(await control(),'UNKNOWN');}finally{x.f.close();}});
test('crash mid-run: the live run is not replaced; reconciliation retires and settles it, then a next prompt is admitted',async()=>{const x=await fixture();try{
 await x.first();await x.running(binding);
 const live=await x.select();assert.deepEqual(live,{binding,reserved:false});await assert.rejects(x.owner.admitTurn({principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId,sourceRunId:binding.runId}),/NEXT_RUN_SOURCE_NOT_TERMINAL/);
 assert.deepEqual(await x.reconciler.reconcile({binding}),{outcome:'reconciled',state:'failed',reasonCode:'ATTEMPT_LOST'});
 const selected=await x.select();assert.equal(selected.reserved,true);await x.accept(selected.binding);assert.equal(await x.lineage(selected.binding),null);
 assert.deepEqual(await x.reconciler.reconcile({binding}),{outcome:'settled',state:'failed'});}finally{x.f.close();}});
test('duplicate and replayed next-prompt submissions produce one reservation and one run; two different prompts race to one winner',async()=>{const x=await fixture();try{
 await x.first();await x.running(binding);await x.f.store.append(binding,x.status('failed','EXECUTION_FAILED'),check);await x.settle(binding);
 const selected=await Promise.all([x.select(),x.select(),x.select()]);assert.equal(new Set(selected.map(s=>s.binding.runId)).size,1);assert.equal(x.f.state.nextRuns.size,1);
 const requestId=id(990),firstAccept=await x.accept(selected[0].binding,'same prompt',requestId),replay=await x.accept(selected[0].binding,'same prompt',requestId);assert.equal(firstAccept.replayed,false);assert.equal(replay.replayed,true);assert.equal(x.f.state.runs.size,2);
 await assert.rejects(x.accept(selected[0].binding,'a different prompt'),/NEXT_RUN_NOT_LATEST|REQUEST_REPLAY_REFUSED/);assert.equal(x.f.state.runs.size,2);}finally{x.f.close();}
 const y=await fixture();try{await y.first();await y.running(binding);await y.f.service.cancel({credential:y.f.credential});await y.settle(binding);const target=(await y.select()).binding;
  const outcomes=await Promise.allSettled([y.accept(target,'one'),y.accept(target,'two')]);assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);assert.equal(y.f.state.runs.size,2);}finally{y.f.close();}});
// O97 (2026-10-21): a stop or an error never erases what the conversation knows. The next prompt after a failed or cancelled turn
// continues the conversation's latest published checkpoint (the last completed turn's), never the failed or cancelled run's own.
for(const [label,end] of Object.entries({
 'fails':async(x,b)=>{await x.allocate(b);await x.running(b);await x.f.store.append(b,x.status('failed','EXECUTION_FAILED'),check);await x.settle(b);},
 'is cancelled by Stop':async(x,b)=>{await x.allocate(b);await x.running(b);await x.f.store.append(b,x.status('cancelled','USER_CANCELLED'),check);await x.settle(b);},
 'is cancelled before it claims an allocation':async(x,b)=>{await x.f.store.append(b,x.status('cancelled','USER_CANCELLED'),check);}
}))test(`turn 1 completes and turn 2 ${label}: turn 3 continues turn 1's checkpoint; turn 4 continues turn 3's`,async()=>{const x=await fixture();try{
 await x.first();const done=await x.complete(binding);await x.settle(binding);const firstRequest=(await x.f.store.read(binding,{after:0,limit:1},check)).request;
 const second=(await x.select()).binding;await x.accept(second,'second');assert.equal((await x.lineage(second)).nextTurn.checkpoint.checkpointId,done.checkpointId);
 await end(x,second);
 // Only the latest published checkpoint is accepted: not a forged proof, and not a fresh session while one exists.
 await assert.rejects(x.reserveWith(second,{checkpointId:done.checkpointId,proofSha256:'a'.repeat(64)}),/NEXT_RUN_CHECKPOINT_REFUSED/);
 await assert.rejects(x.reserveWith(second,{checkpointId:id(999),proofSha256:'a'.repeat(64)}),/NEXT_RUN_CHECKPOINT_REFUSED/);
 await assert.rejects(x.reserveWith(second,null),/NEXT_RUN_CHECKPOINT_REQUIRED/);assert.equal(x.f.state.nextRuns.size,1);
 const third=(await x.select()).binding;assert.equal(third.writerFence,3);await x.accept(third,'third');
 const facts=[...x.f.state.nextRuns.values()].find(r=>r.target_run_id===third.runId).reservation.facts;
 assert.deepEqual(facts.checkpoint,{checkpointId:done.checkpointId,proofSha256:x.f.state.completions.get([binding.tenantId,binding.conversationId,binding.runId].join(':')).proof_sha256});
 const lineage=(await x.lineage(third)).nextTurn;
 assert.equal(lineage.checkpoint.checkpointId,done.checkpointId);assert.deepEqual(lineage.checkpoint.binding,binding,'turn 1 is the lineage, not the failed or cancelled turn');
 assert.deepEqual(lineage.sourceRequest,firstRequest,"turn 1's request is the source of the continued context");assert.deepEqual(lineage.targetBinding,third);
 // Once turn 3 completes, its own checkpoint is the latest.
 await x.allocate(third);const later=await x.complete(third);await x.settle(third);const fourth=(await x.select()).binding;await x.accept(fourth,'fourth');
 assert.equal((await x.lineage(fourth)).nextTurn.checkpoint.checkpointId,later.checkpointId);}finally{x.f.close();}});
test('a completed source must name its own checkpoint',async()=>{const y=await fixture();try{await y.first();await y.complete(binding);await y.settle(binding);await assert.rejects(y.reserveWith(binding,null),/NEXT_RUN_CHECKPOINT_REQUIRED/);}finally{y.f.close();}});
// O102: a conversation survives a deploy. The successor is reserved under the current release's versions; a release that changes only
// the image or skills digest still continues the latest published checkpoint, an SDK or CLI change does not resume it.
test("a release between turns: turn 2 is reserved under the new versions and continues turn 1's checkpoint",async()=>{const x=await fixture();try{
 await x.first();const done=await x.complete(binding);await x.settle(binding);
 const released={...versions,imageDigest:'sha256:'+'5'.repeat(64),skillsDigest:'c'.repeat(64)};x.deploy(released);
 const second=(await x.select()).binding;await x.accept(second,'after the release');
 assert.deepEqual([...x.f.state.nextRuns.values()][0].reservation.versions,released);
 const lineage=(await x.lineage(second)).nextTurn;assert.equal(lineage.checkpoint.checkpointId,done.checkpointId);assert.deepEqual(lineage.checkpoint.versions,versions);
}finally{x.f.close();}});
test('a release that changes the SDK or CLI never resumes the earlier session: NEXT_TURN_SDK_CHANGED, nothing reserved',async()=>{
 for(const change of [{sdk:'0.3.296'},{cli:'2.1.296'}]){const x=await fixture();try{
  await x.first();await x.complete(binding);await x.settle(binding);x.deploy({...versions,...change});
  await assert.rejects(x.select(),/NEXT_TURN_SDK_CHANGED/);assert.equal(x.f.state.nextRuns.size,0);
 }finally{x.f.close();}}
});
// Liveness across a deploy (adj-b-review-c11.md F1, probe L1): a reservation written before an image-only release is still accepted after it.
test('L1 a RESERVED next turn written before an image-only deploy is accepted after it',async()=>{const x=await fixture();try{
 await x.first();await x.complete(binding);await x.settle(binding);const reserved=await x.select();assert.equal(reserved.reserved,true);
 x.deploy({...versions,imageDigest:'sha256:'+'5'.repeat(64),skillsDigest:'c'.repeat(64)});
 const again=await x.select();assert.equal(again.replayed,true);assert.deepEqual(again.binding,reserved.binding);
 await x.accept(again.binding,'after the release');
 assert.ok((await x.lineage(again.binding)).nextTurn.checkpoint.checkpointId);
}finally{x.f.close();}});
// The work selector crosses the successor fence through the actual service: it is stored on the successor run's own
// request, an identical replay re-releases that same run, and a changed or removed field is refused by the stored-request
// boundary (service.mjs REQUEST_REPLAY_REFUSED) before a second run can exist.
test('a successor turn retains the stored work selector, replays identically, and refuses any changed or removed field',async()=>{const x=await fixture();try{
 await x.first();await x.running(binding);await x.f.store.append(binding,x.status('failed','EXECUTION_FAILED'),check);await x.settle(binding);
 const selected=await x.select();assert.equal(selected.binding.writerFence,2);
 // A session is pinned to its run: the successor is entered through its own issued session, never a silent rebind.
 x.f.state.context.binding=selected.binding;const credential=(await x.f.sessions.issue({identityCredential:'synthetic-successor'})).credential;
 const requestId=id(970),prompt='continue with work',work={entry:'start-work',jobKind:'research',deliverables:['brief'],dependencies:[]};
 const accepted=await x.f.service.submit({credential,input:{requestId,prompt,work}});
 assert.equal(accepted.replayed,false);assert.deepEqual(accepted.run.binding,selected.binding);assert.equal(x.f.state.runs.size,2);
 const history=await x.f.service.history({credential});assert.deepEqual(history.run.binding,selected.binding);
 assert.deepEqual(history.request.work,work,'the successor run stores the exact submitted work selector');
 assert.deepEqual((await x.f.store.findRequest(selected.binding,requestId,check)).request.work,work);
 const replay=await x.f.service.submit({credential,input:{requestId,prompt,work}});
 assert.equal(replay.replayed,true);assert.deepEqual(replay.run.binding,selected.binding);assert.equal(x.f.state.runs.size,2,'an exact replay re-releases the same run');
 for(const changed of [{...work,jobKind:'audit'},{...work,deliverables:['other']},{...work,dependencies:['other']}])await assert.rejects(x.f.service.submit({credential,input:{requestId,prompt,work:changed}}),/REQUEST_REPLAY_REFUSED/,'a changed work field never becomes a second run');
 await assert.rejects(x.f.service.submit({credential,input:{requestId,prompt}}),/REQUEST_REPLAY_REFUSED/,'a removed work selector is refused by the stored request');
 await assert.rejects(x.f.service.submit({credential,input:{requestId,prompt,work:{entry:work.entry,jobKind:work.jobKind,deliverables:work.deliverables}}}),/INVALID_REQUEST/,'a work selector missing a member is malformed at the boundary');
 assert.equal(x.f.state.runs.size,2);
 assert.deepEqual((await x.f.store.findRequest(selected.binding,requestId,check)).request.work,work,'no refusal alters the stored selector');
}finally{x.f.close();}});
