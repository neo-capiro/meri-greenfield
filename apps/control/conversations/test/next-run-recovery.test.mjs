/** Synthetic (scripted SQL protocol fixture): Stop/failure/crash → next prompt through the canonical next-run owner and journal,
 * lifecycle store and run reconciler. Retirement/revocation ports read the canonical allocation journal and a synthetic receipt. */
import test from 'node:test';import assert from 'node:assert/strict';
import {binding,scopes,id} from './lifecycle-fixture.mjs';
import {recordRetired} from './terminal-settlement-harness.mjs';
import {fixture,check} from './next-run-recovery-fixture.mjs';
import {hash} from '../boundary.mjs';
for(const [label,end] of Object.entries({
 'failed (EXECUTION_FAILED)':async x=>{await x.running(binding);await x.f.store.append(binding,x.status('failed','EXECUTION_FAILED'),check);},
 'cancelled by Stop':async x=>{await x.running(binding);await x.f.service.cancel({credential:x.f.credential});},
 'cancelled while still queued':async x=>{await x.f.service.cancel({credential:x.f.credential});}
}))test(`${label} → an explicit next prompt is admitted only after retirement and revocation, from a fresh session (no turn has completed)`,async()=>{const x=await fixture();try{
 await x.first();await end(x);assert(['failed','cancelled'].includes(await x.state()));
 await assert.rejects(x.select(),/NEXT_RUN_RETIREMENT_REQUIRED/,'the unretired original is a barrier');assert.equal(x.f.state.nextRuns.size,0);
 await x.retire(binding);const selected=await x.select();assert.equal(selected.reserved,true);assert.equal(selected.binding.writerFence,2);
 const accepted=await x.accept(selected.binding,'try again');assert.equal(accepted.replayed,false);assert.equal(await x.lineage(selected.binding),null,'no checkpoint lineage: a fresh SDK session');
 const list=await x.f.store.nextRuns.listRuns({tenantId:binding.tenantId,conversationId:binding.conversationId},check);assert.equal(list.runs.length,2);assert.equal(list.runs[1].sequenceBase,list.runs[0].sequenceEnd);
 await assert.rejects(x.f.store.append(binding,x.status('failed','LATE'),check),/RUN_RANGE_CLOSED|RUN_TRANSITION_REFUSED/);}finally{x.f.close();}});
test('failed with retirement UNKNOWN or missing revocation is refused; forged retirement facts are refused by the journal',async()=>{const x=await fixture();try{
 await x.first();await x.running(binding);await x.f.store.append(binding,x.status('failed','EXECUTION_FAILED'),check);
 await x.f.store.allocations.record({binding,allocationKey:hash(binding),state:'UNKNOWN',resource:null},check);
 await assert.rejects(x.select(),/NEXT_RUN_RETIREMENT_REQUIRED/);await assert.rejects(x.reserveWith(binding,null),/NEXT_RUN_RETIREMENT_REQUIRED/,'the journal checks the allocation itself, not the port');
 assert.equal(x.f.state.nextRuns.size,0);}finally{x.f.close();}
 const y=await fixture();try{await y.first();await y.running(binding);await y.f.store.append(binding,y.status('failed','EXECUTION_FAILED'),check);await recordRetired(y.f.store,{key:{binding,allocationKey:hash(binding)},resource:(await y.f.store.allocations.read({binding,allocationKey:hash(binding)},check)).record.resource});
  await assert.rejects(y.select(),/NEXT_RUN_REVOCATION_REQUIRED/);assert.equal(y.f.state.nextRuns.size,0);}finally{y.f.close();}});
test('HOLD_CHECKPOINT_FAILED → next prompt after retirement; the UNKNOWN hold stays a barrier on the source and is never delivered',async()=>{const x=await fixture();try{
 await x.first();await x.running(binding);await x.f.control({controlId:id(780),intent:'pause'});await x.f.store.append(binding,x.status('failed','HOLD_CHECKPOINT_FAILED'),check);
 const control=async()=>(await x.f.store.lifecycle.get({binding,scopes,selectedClientId:id(5),controlId:id(780)},check)).state;assert.equal(await control(),'UNKNOWN');
 await x.retire(binding);const selected=await x.select();await x.accept(selected.binding);assert.equal(await x.lineage(selected.binding),null);
 assert.equal(await control(),'UNKNOWN');const held=await x.f.store.lifecycle.get({binding,scopes,selectedClientId:id(5),controlId:id(780)},check);
 await assert.rejects(x.f.store.lifecycle.claim({binding,scopes,selectedClientId:id(5),controlId:id(780),commandSha256:held.commandSha256},check),/LIFECYCLE_STATE_REFUSED/);assert.equal(await control(),'UNKNOWN');}finally{x.f.close();}});
test('crash mid-run: the live run is not replaced; reconciliation retires and settles it, then a next prompt is admitted',async()=>{const x=await fixture();try{
 await x.first();await x.running(binding);
 const live=await x.select();assert.deepEqual(live,{binding,reserved:false});await assert.rejects(x.reserveWith(binding,null),/NEXT_RUN_SOURCE_NOT_TERMINAL/);
 assert.deepEqual(await x.reconciler.reconcile({binding}),{outcome:'reconciled',state:'failed',reasonCode:'ATTEMPT_LOST'});
 const selected=await x.select();assert.equal(selected.reserved,true);await x.accept(selected.binding);assert.equal(await x.lineage(selected.binding),null);
 assert.deepEqual(await x.reconciler.reconcile({binding}),{outcome:'settled',state:'failed'});}finally{x.f.close();}});
test('duplicate and replayed next-prompt submissions produce one reservation and one run; two different prompts race to one winner',async()=>{const x=await fixture();try{
 await x.first();await x.running(binding);await x.f.store.append(binding,x.status('failed','EXECUTION_FAILED'),check);await x.retire(binding);
 const selected=await Promise.all([x.select(),x.select(),x.select()]);assert.equal(new Set(selected.map(s=>s.binding.runId)).size,1);assert.equal(x.f.state.nextRuns.size,1);
 const requestId=id(990),firstAccept=await x.accept(selected[0].binding,'same prompt',requestId),replay=await x.accept(selected[0].binding,'same prompt',requestId);assert.equal(firstAccept.replayed,false);assert.equal(replay.replayed,true);assert.equal(x.f.state.runs.size,2);
 await assert.rejects(x.accept(selected[0].binding,'a different prompt'),/NEXT_RUN_NOT_LATEST|REQUEST_REPLAY_REFUSED/);assert.equal(x.f.state.runs.size,2);}finally{x.f.close();}
 const y=await fixture();try{await y.first();await y.running(binding);await y.f.service.cancel({credential:y.f.credential});await y.retire(binding);const target=(await y.select()).binding;
  const outcomes=await Promise.allSettled([y.accept(target,'one'),y.accept(target,'two')]);assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);assert.equal(y.f.state.runs.size,2);}finally{y.f.close();}});
// O97 (2026-10-21): a stop or an error never erases what the conversation knows. The next prompt after a failed or cancelled turn
// continues the conversation's latest published checkpoint (the last completed turn's), never the failed or cancelled run's own.
for(const [label,end] of Object.entries({
 'fails':async(x,b)=>{await x.allocate(b);await x.running(b);await x.f.store.append(b,x.status('failed','EXECUTION_FAILED'),check);await x.retire(b);},
 'is cancelled by Stop':async(x,b)=>{await x.allocate(b);await x.running(b);await x.f.store.append(b,x.status('cancelled','USER_CANCELLED'),check);await x.retire(b);},
 'is cancelled before it claims an allocation':async(x,b)=>{await x.f.store.append(b,x.status('cancelled','USER_CANCELLED'),check);}
}))test(`turn 1 completes and turn 2 ${label}: turn 3 continues turn 1's checkpoint; turn 4 continues turn 3's`,async()=>{const x=await fixture();try{
 await x.first();const done=await x.complete(binding);await x.retire(binding);const firstRequest=(await x.f.store.read(binding,{after:0,limit:1},check)).request;
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
 await x.allocate(third);const later=await x.complete(third);await x.retire(third);const fourth=(await x.select()).binding;await x.accept(fourth,'fourth');
 assert.equal((await x.lineage(fourth)).nextTurn.checkpoint.checkpointId,later.checkpointId);}finally{x.f.close();}});
test('a completed source must name its own checkpoint',async()=>{const y=await fixture();try{await y.first();await y.complete(binding);await y.retire(binding);await assert.rejects(y.reserveWith(binding,null),/NEXT_RUN_CHECKPOINT_REQUIRED/);}finally{y.f.close();}});
