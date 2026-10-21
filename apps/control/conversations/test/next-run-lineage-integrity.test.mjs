// The next-run lineage's integrity and both enforcement points (adj-b's candidate 11 review probes, adopted): the chosen checkpoint is
// re-verified against its own run, the lineage is as of the source, policy and scopes are the source's, the target fence is source + 1,
// the reservation's checkpoint fact is the recomputed lineage, and the worker independently refuses an SDK change, an unpinned SDK/CLI,
// a checkpoint that does not precede the target and a checkpoint that is the target itself. IDs are the review's (adj-b-review-c11.md §3).
import test from 'node:test';import assert from 'node:assert/strict';
import {binding,scopes,id,versions} from './lifecycle-fixture.mjs';
import {fixture,check,at} from './next-run-recovery-fixture.mjs';
import {hash} from '../boundary.mjs';
import {buildNextTurnOptions} from '../../../worker/conversation/continuation/next-turn-options.mjs';
import {canonicalSha256 as whash} from '../../../../packages/contracts/validate.mjs';
const completed=async x=>{await x.first();const done=await x.complete(binding);await x.retire(binding);return done;};
const rowOf=x=>[...x.f.state.completions.values()][0];
const failedTurn2=async(x,tamper=()=>{})=>{const second=(await x.select()).binding;await x.accept(second);await x.allocate(second);await x.running(second);tamper(second);
 await x.f.store.append(second,x.status('failed','EXECUTION_FAILED'),check);await x.retire(second);return second;};

// The chosen checkpoint is verified against its own run: tampering with the stored identity or proof is STORE_CORRUPT.
test('P1a a tampered stored identity of the lineage checkpoint is STORE_CORRUPT',async()=>{const x=await fixture();try{
 await completed(x);const row=rowOf(x);row.identity.sourceRequest={...row.identity.sourceRequest,prompt:'tampered after publication'};
 await assert.rejects(x.select(),/STORE_CORRUPT/);
}finally{x.f.close();}});
test('P1b a stored proof tampered consistently inside, but not in its stored hash, is STORE_CORRUPT',async()=>{const x=await fixture();try{
 await completed(x);const row=rowOf(x),cp=row.proof.checkpoint;cp.workspace.logicalCwd='/workspace/elsewhere';cp.workspaceSha256=hash(cp.workspace);row.proof.checkpointSha256=hash(cp);
 await assert.rejects(x.select(),/STORE_CORRUPT/);
}finally{x.f.close();}});
// The lineage is as of the source: a later published checkpoint never changes an earlier target's lineage.
test('P2 execution of an earlier target still names its own lineage after a later turn published',async()=>{const x=await fixture();try{
 await completed(x);const second=(await x.select()).binding;await x.accept(second);await x.allocate(second);const d2=await x.complete(second);await x.retire(second);
 const third=(await x.select()).binding;await x.accept(third);
 assert.equal((await x.lineage(third)).nextTurn.checkpoint.checkpointId,d2.checkpointId);
 await x.allocate(third);await x.complete(third);
 assert.equal((await x.lineage(third)).nextTurn.checkpoint.checkpointId,d2.checkpointId,'a checkpoint published at the target\'s own fence is not its lineage');
}finally{x.f.close();}});
// Policy: a checkpoint taken under another policy revision is never continued.
test('P3 a policy change between turn 1 and a failed turn 2 refuses the next turn (reserve), and a direct reserve cannot launder it',async()=>{const x=await fixture();try{
 const done=await completed(x);
 const second=await failedTurn2(x,b=>{const row=[...x.f.state.runs.values()].find(r=>r.run_id===b.runId);
  row.projection.scopes=row.projection.scopes.map(s=>({...s,policyRevision:'policy2'}));row.projection.policyRevision='policy2';row.projection_sha256=hash(row.projection);});
 await assert.rejects(x.select(),/NEXT_RUN_SCOPE_REFUSED/);assert.equal(x.f.state.nextRuns.size,1,"only turn 2 own reservation exists; none was added");
 const sha=rowOf(x).proof_sha256,call=over=>x.f.store.nextRuns.reserve({source:second,target:{...second,runId:id(960),attemptId:id(961),workerId:id(962),writerFence:3},
  facts:{checkpoint:{checkpointId:done.checkpointId,proofSha256:sha},retirement:{physicalStopProven:true},revocation:{receiptSha256:'f'.repeat(64),grantIds:[id(240)]}},scopes,versions,policyRevision:'policy1',reservedAt:at,...over},check);
 // caller-supplied scopes equal to the lineage's, not the latest run's: the source's own scopes must still match
 await assert.rejects(call({}),/NEXT_RUN_SCOPE_REFUSED/);assert.equal(x.f.state.nextRuns.size,1);
}finally{x.f.close();}});
test('P4 reserve refuses a target fence that is not source + 1, and caller scopes or policy that are not the source\'s',async()=>{const x=await fixture();try{
 const done=await completed(x),sha=rowOf(x).proof_sha256;
 const call=(over={},target={})=>x.f.store.nextRuns.reserve({source:binding,target:{...binding,runId:id(960),attemptId:id(961),workerId:id(962),writerFence:2,...target},
  facts:{checkpoint:{checkpointId:done.checkpointId,proofSha256:sha},retirement:{physicalStopProven:true},revocation:{receiptSha256:'f'.repeat(64),grantIds:[id(240)]}},scopes,versions,policyRevision:'policy1',reservedAt:at,...over},check);
 await assert.rejects(call({},{writerFence:3}),/NEXT_RUN_TARGET_REFUSED/);
 await assert.rejects(call({},{writerFence:1,runId:id(963)}),/NEXT_RUN_TARGET_REFUSED/);
 await assert.rejects(call({scopes:[{...scopes[0],resourceId:id(6)}]}),/NEXT_RUN_SCOPE_REFUSED/);
 await assert.rejects(call({policyRevision:'policy9'}),/NEXT_RUN_SCOPE_REFUSED/);
 assert.equal(x.f.state.nextRuns.size,0);await call();assert.equal(x.f.state.nextRuns.size,1);
}finally{x.f.close();}});
test('P5 a reservation whose checkpoint fact was changed after the fact is STORE_CORRUPT at execution',async()=>{const x=await fixture();try{
 await completed(x);const second=(await x.select()).binding;await x.accept(second);
 const r=[...x.f.state.nextRuns.values()][0];r.reservation.facts.checkpoint={checkpointId:id(999),proofSha256:'a'.repeat(64)};r.reservation_sha256=hash(r.reservation);
 await assert.rejects(x.lineage(second),/STORE_CORRUPT/);
}finally{x.f.close();}});

// Worker layer (the second enforcement point, run inside the runtime): each rule rejects on its own.
async function lineageFixture(){const x=await fixture();await completed(x);const second=(await x.select()).binding;await x.accept(second);
 const lin=(await x.lineage(second)).nextTurn,saved=await x.f.store.read(second,{after:0,limit:1},check);
 return {x,second,lin,target:{binding:second,versions:saved.run.versions,scopes,request:saved.request,sourceRequest:lin.sourceRequest}};}
const withCp=(lin,edit)=>{const c=structuredClone(lin);edit(c.checkpoint,c);c.checkpointSha256=whash(c.checkpoint);return c;};
test('W0 baseline: the worker accepts the control-verified lineage',async()=>{const {x,lin,target}=await lineageFixture();try{
 assert.ok(buildNextTurnOptions(lin,target));
}finally{x.f.close();}});
test('W1 the worker refuses a checkpoint whose sdk differs from the target even when the target pin holds (continuesSession)',async()=>{const {x,lin,target}=await lineageFixture();try{
 const older=withCp(lin,cp=>{cp.versions={...cp.versions,sdk:'0.3.294'};});
 assert.throws(()=>buildNextTurnOptions(older,target),/NEXT_TURN_REFUSED/);
}finally{x.f.close();}});
test('W2 the worker refuses any target whose sdk or cli is not the pinned pair, even when the checkpoint matches it',async()=>{const {x,lin,target}=await lineageFixture();try{
 const moved=withCp(lin,cp=>{cp.versions={...cp.versions,sdk:'0.3.296'};});
 assert.throws(()=>buildNextTurnOptions(moved,{...target,versions:{...target.versions,sdk:'0.3.296'}}),/NEXT_TURN_REFUSED/);
 const cli=withCp(lin,cp=>{cp.versions={...cp.versions,cli:'2.1.296'};});
 assert.throws(()=>buildNextTurnOptions(cli,{...target,versions:{...target.versions,cli:'2.1.296'}}),/NEXT_TURN_REFUSED/);
}finally{x.f.close();}});
test('W3 the worker refuses a checkpoint that does not precede the target fence',async()=>{const {x,lin,target}=await lineageFixture();try{
 const same={...lin.checkpoint.binding,runId:id(970),attemptId:id(971),workerId:id(972)};
 const equalFence={...lin,targetBinding:same};
 assert.throws(()=>buildNextTurnOptions(equalFence,{...target,binding:same}),/NEXT_TURN_REFUSED/);
}finally{x.f.close();}});
test('W4 the worker refuses a lineage whose checkpoint is the target run itself',async()=>{const {x,lin,target}=await lineageFixture();try{
 const self={...lin.checkpoint.binding,writerFence:lin.checkpoint.binding.writerFence+5};
 assert.throws(()=>buildNextTurnOptions({...lin,targetBinding:self},{...target,binding:self}),/NEXT_TURN_REFUSED/);
}finally{x.f.close();}});
