/** Synthetic (scripted SQL protocol fixture): Stop/failure/crash → next prompt through the canonical next-run owner and journal,
 * lifecycle store and run reconciler. Retirement/revocation ports read the canonical allocation journal and a synthetic receipt. */
import test from 'node:test';import assert from 'node:assert/strict';
import {lifecycleFixture,binding,scopes,id,versions} from './lifecycle-fixture.mjs';
import {allocateOriginal,recordRetired} from './terminal-settlement-harness.mjs';
import {createNextRunOwner} from '../next-run.mjs';import {createRunReconciler} from '../run-reconciler.mjs';import {hash} from '../boundary.mjs';
const check=()=>{},at='2026-10-15T12:00:00.000Z';
async function fixture(){const f=await lifecycleFixture();let serial=900;const revoked=new Map(),allocations=new Map();
 const status=(state,reasonCode=null)=>({eventId:id(serial++),createdAt:at,type:'run.status',data:{state,reasonCode}});
 const retirement={async verifyRetired({binding:b}){const r=await f.store.allocations.read({binding:b,allocationKey:hash(b)},check);return {physicalStopProven:r.record?.state==='RETIRED'&&r.record.resource?.physicalStopProven===true};}};
 const revocation={async verifyRevoked({binding:b}){const r=revoked.get(b.runId);if(!r)throw Error('NEXT_RUN_REVOCATION_REQUIRED');return r;}};
 const owner=createNextRunOwner({store:f.store,versions,newId:()=>id(serial++),retirement,revocation});
 async function allocate(b){const a=await allocateOriginal(f.store,b);allocations.set(b.runId,a);return a;}
 // The native stop owner's effect: physical stop and grant revocation recorded in the canonical journal.
 async function retire(b){const a=allocations.get(b.runId);await recordRetired(f.store,a);revoked.set(b.runId,{grantIds:[id(240)],receiptSha256:hash({retired:a.key})});}
 const reconciler=createRunReconciler({store:f.store,retirement:{retire:({binding:b})=>retire(b)}});
 async function running(b){for(const state of ['starting','running'])await f.store.append(b,status(state),check);}
 async function complete(b){await running(b);const k={binding:b,scopes,selectedClientId:id(5)},p=await f.store.completions.begin({...k,completionId:id(serial++),checkpointId:id(serial++)},check),proof=structuredClone(await f.capture(p.checkpointId));proof.checkpoint.binding=b;proof.checkpoint.workspace.binding=b;proof.checkpoint.workspaceSha256=hash(proof.checkpoint.workspace);proof.checkpoint.lastEventSequence=p.captureSequence;proof.checkpointSha256=hash(proof.checkpoint);proof.sourceRequestSha256=p.sourceRequestSha256;proof.contextSha256=p.contextSha256;
  await f.store.completions.publish({...k,completionId:p.completionId,proof,events:[{contractVersion:'0.1.0',eventId:p.verifiedEventId,createdAt:at,type:'checkpoint.verified',data:{checkpointId:p.checkpointId}},{contractVersion:'0.1.0',eventId:p.completedEventId,createdAt:at,type:'run.status',data:{state:'completed',reasonCode:null}}]},check);return p;}
 const select=()=>owner.selectRun({principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId});
 function accept(b,prompt='next prompt',requestId=id(serial++)){const conversation={conversationId:b.conversationId,owner:{tenantId:b.tenantId,actorId:b.actorId},scopes,createdAt:at,policyRevision:'policy1'},run={binding:b,state:'queued',scopes,createdAt:at,policyRevision:'policy1',versions},request={requestId,prompt,skill:null,window:null,windowRequest:null},event={contractVersion:'0.1.0',...status('queued'),binding:b,scopes,sequence:1};return f.store.nextRuns.accept({conversation,run,request,event},check);}
 const lineage=b=>f.store.nextRuns.execution({binding:b,scopes,selectedClientId:id(5)},check);
 const reserveWith=(source,checkpoint)=>f.store.nextRuns.reserve({source,target:{...source,runId:id(serial++),attemptId:id(serial++),workerId:id(serial++),writerFence:source.writerFence+1},facts:{checkpoint,retirement:{physicalStopProven:true},revocation:{receiptSha256:'f'.repeat(64),grantIds:[id(240)]}},scopes,versions,policyRevision:'policy1',reservedAt:at},check);
 const first=async()=>{await f.service.submit({credential:f.credential,input:f.input});await allocate(binding);};
 return {f,status,owner,reconciler,allocate,retire,running,complete,select,accept,lineage,reserveWith,first,state:()=>f.store.read(binding,{after:0,limit:1},check).then(r=>r.run.state)};}
for(const [label,end] of Object.entries({
 'failed (EXECUTION_FAILED)':async x=>{await x.running(binding);await x.f.store.append(binding,x.status('failed','EXECUTION_FAILED'),check);},
 'cancelled by Stop':async x=>{await x.running(binding);await x.f.service.cancel({credential:x.f.credential});},
 'cancelled while still queued':async x=>{await x.f.service.cancel({credential:x.f.credential});}
}))test(`${label} → an explicit next prompt is admitted only after retirement and revocation, from a fresh session`,async()=>{const x=await fixture();try{
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
test('a stale checkpoint is never resumed: after completed → failed the next run has no lineage and forged checkpoint facts are refused',async()=>{const x=await fixture();try{
 await x.first();const done=await x.complete(binding);await x.retire(binding);const second=(await x.select()).binding;await x.accept(second,'second');assert.equal((await x.lineage(second)).nextTurn.checkpoint.checkpointId,done.checkpointId,'a completed source still seeds its verified checkpoint');
 await x.allocate(second);await x.running(second);await x.f.store.append(second,x.status('failed','EXECUTION_FAILED'),check);await x.retire(second);
 await assert.rejects(x.reserveWith(second,{checkpointId:done.checkpointId,proofSha256:'a'.repeat(64)}),/NEXT_RUN_CHECKPOINT_REFUSED/);
 const third=(await x.owner.selectRun({principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId})).binding;await x.accept(third,'third');assert.equal(await x.lineage(third),null);
 assert.equal([...x.f.state.nextRuns.values()].find(r=>r.target_run_id===third.runId).reservation.facts.checkpoint,null);}finally{x.f.close();}
 const y=await fixture();try{await y.first();await y.complete(binding);await y.retire(binding);await assert.rejects(y.reserveWith(binding,null),/NEXT_RUN_CHECKPOINT_REQUIRED/);}finally{y.f.close();}});
