// The next-run lineage's guards (adj-b's candidate 11 review probes, adopted): over the next-run owner and journal and the repository's
// scripted PostgreSQL protocol fixture. The lineage belongs to the session's own conversation, client, scopes and actor; only a published
// checkpoint of the latest completed turn is continued; an SDK change is never resumed, and the continuity rule counts only the SDK,
// CLI, contract and checkpoint formats. IDs are the review's (adj-b-review-c11.md §3, F3).
import test from 'node:test';import assert from 'node:assert/strict';
import {binding,scopes,id,versions} from './lifecycle-fixture.mjs';
import {fixture,check} from './next-run-recovery-fixture.mjs';
import {hash} from '../boundary.mjs';
import {sessionDiscontinuity,continuesSession} from '../../../../packages/contracts/session-continuity.mjs';
const completed=async x=>{await x.first();const done=await x.complete(binding);await x.settle(binding);return done;};

// Q1: ownership of the lineage.
test('I1 the lineage is bound to the session\'s client, scopes and actor',async()=>{const x=await fixture();try{
 await completed(x);const second=(await x.select()).binding;await x.accept(second);
 assert.ok((await x.lineage(second)).nextTurn);
 await assert.rejects(x.f.store.nextRuns.execution({binding:second,scopes,selectedClientId:id(6)},check),/STORE_CORRUPT/);
 await assert.rejects(x.f.store.nextRuns.execution({binding:second,scopes:[{...scopes[0],resourceId:id(6)}],selectedClientId:id(5)},check),/STALE_WRITER/);
 await assert.rejects(x.f.store.nextRuns.execution({binding:{...second,actorId:'actor-b'},scopes,selectedClientId:id(5)},check),/STALE_WRITER|STORE_CORRUPT/);
}finally{x.f.close();}});
test('I2 a published checkpoint of another conversation or tenant is never the lineage',async()=>{const x=await fixture();try{
 const done=await completed(x);const row=[...x.f.state.completions.values()][0];
 const plant=(patch,name)=>{const c=structuredClone(row);Object.assign(c,patch);x.f.state.completions.set(`planted:${name}`,c);};
 plant({conversation_id:id(77),run_id:id(78),checkpoint_id:id(79)},'conversation');
 plant({tenant_id:'tenant-b',conversation_id:id(77),run_id:id(78),checkpoint_id:id(80)},'tenant');
 plant({conversation_id:id(77)},'conversation-same-run');
 const second=(await x.select()).binding;await x.accept(second);assert.equal((await x.lineage(second)).nextTurn.checkpoint.checkpointId,done.checkpointId);
}finally{x.f.close();}});
test('U1 a failed turn with an unpublished capture never supplies the lineage',async()=>{const x=await fixture();try{
 const done=await completed(x);const second=(await x.select()).binding;await x.accept(second);await x.allocate(second);await x.running(second);
 await x.f.store.completions.begin({binding:second,scopes,selectedClientId:id(5),completionId:id(950),checkpointId:id(951)},check);
 await x.f.store.append(second,x.status('failed','EXECUTION_FAILED'),check);await x.settle(second);
 const third=(await x.select()).binding;await x.accept(third);assert.equal((await x.lineage(third)).nextTurn.checkpoint.checkpointId,done.checkpointId);
}finally{x.f.close();}});
test('S1 an older but valid checkpoint is refused once a later one is published',async()=>{const x=await fixture();try{
 const d1=await completed(x);const second=(await x.select()).binding;await x.accept(second);await x.allocate(second);await x.complete(second);await x.settle(second);
 const sha1=x.f.state.completions.get([binding.tenantId,binding.conversationId,binding.runId].join(':')).proof_sha256;
 await assert.rejects(x.reserveWith(second,{checkpointId:d1.checkpointId,proofSha256:sha1}),/NEXT_RUN_CHECKPOINT_REFUSED/);
 await assert.rejects(x.reserveWith(binding,{checkpointId:d1.checkpointId,proofSha256:sha1}),/NEXT_RUN_NOT_LATEST/,'a stale writer source');
}finally{x.f.close();}});

// Q3/Q4: a forged reservation cannot carry an SDK change past execution.
test('E1 execution refuses an sdk change even if a forged reservation got past reserve',async()=>{const x=await fixture();try{
 await completed(x);const second=(await x.select()).binding;
 const r=[...x.f.state.nextRuns.values()][0];r.reservation.versions={...versions,sdk:'0.3.296'};r.reservation_sha256=hash(r.reservation);
 x.deploy({...versions,sdk:'0.3.296'});await x.accept(second,'forged');
 await assert.rejects(x.lineage(second),/STORE_CORRUPT/);
}finally{x.f.close();}});
test('E2 a RESERVED turn replayed after an sdk bump refuses (named code at reserve, never a resume)',async()=>{const x=await fixture();try{
 await completed(x);await x.select();x.deploy({...versions,sdk:'0.3.296'});
 const again=await x.select();
 await assert.rejects(x.accept(again.binding,'after the bump'));
}finally{x.f.close();}});

test('T1 sessionDiscontinuity: only sdk/cli/contracts/checkpointFormat count, and unknown fails closed',()=>{
 for(const v of [{imageDigest:'sha256:'+'9'.repeat(64)},{skillsDigest:'d'.repeat(64)},{imageDigest:'sha256:'+'9'.repeat(64),skillsDigest:'d'.repeat(64)}])assert.equal(sessionDiscontinuity(versions,{...versions,...v}),null);
 assert.equal(sessionDiscontinuity(versions,{...versions,sdk:'0.3.296'}),'NEXT_TURN_SDK_CHANGED');
 assert.equal(sessionDiscontinuity(versions,{...versions,cli:'2.1.296'}),'NEXT_TURN_SDK_CHANGED');
 assert.equal(sessionDiscontinuity(versions,{...versions,contracts:'0.2.0'}),'NEXT_TURN_FORMAT_CHANGED');
 assert.equal(sessionDiscontinuity(versions,{...versions,checkpointFormat:'0.2.0'}),'NEXT_TURN_FORMAT_CHANGED');
 assert.equal(sessionDiscontinuity(versions,{...versions,sdk:'0.3.296',contracts:'0.2.0'}),'NEXT_TURN_SDK_CHANGED');
 const {sdk,...noSdk}=versions;assert.equal(sessionDiscontinuity(versions,noSdk),'NEXT_TURN_SDK_CHANGED');assert.equal(sessionDiscontinuity(noSdk,noSdk),'NEXT_TURN_SDK_CHANGED');
 assert.equal(sessionDiscontinuity(versions,{...versions,sdk:295}),'NEXT_TURN_SDK_CHANGED');assert.equal(sessionDiscontinuity({},{}),'NEXT_TURN_SDK_CHANGED');
 assert.equal(continuesSession(versions,{...versions,extra:'x'}),true);assert.equal(continuesSession(versions,{...versions,cli:'2.1.296'}),false);
});
