import test from 'node:test';import assert from 'node:assert/strict';
import {createScheduledJobLineage,snapshotScheduledJobSelection} from '../scheduled-job-lineage.mjs';
import {scheduledJobFixture,id,hash} from './scheduled-job-fixture.mjs';
import {createNextRunOwner} from '../../conversations/next-run.mjs';
const check=()=>{};
test('actual original input names one immutable job origin and expiry, including after expiry',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);const reader=createScheduledJobLineage({store:h.store});
 const before=await reader.read(h.selection,check);assert.deepEqual(before.bindings,[h.identity.binding]);assert.equal(before.occupiedReason,null);assert.equal(before.run.state,'queued');
 h.advance(120000);const after=await reader.read(h.selection,check);assert.equal(after.expiresAtMs,before.expiresAtMs);assert(Object.isFrozen(after.bindings));assert(Object.isFrozen(after.currentBinding));
});
test('actual checkpoint and APPLIED resume follow only the same-work target through canonical continuation reader',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();await h.pause();const target=await h.resume();
 const saved=await createScheduledJobLineage({store:h.store}).read(h.selection,check);assert.equal(saved.occupiedReason,null);assert.deepEqual(saved.bindings,[h.identity.binding,target]);assert.deepEqual(saved.currentBinding,target);assert.equal(saved.run.state,'queued');
});
for(const state of ['PENDING','DISPATCHING','UNKNOWN'])test(`unresolved ${state} resume never presents a settled/current executable lineage`,async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();await h.pause();await h.resume();
 const row=[...h.conversations.state.controls.values()].find(r=>r.projection.input.intent==='resume');row.projection.state=state;row.projection_sha256=hash(row.projection);
 const saved=await createScheduledJobLineage({store:h.store}).read(h.selection,check);assert.equal(saved.occupiedReason,'SCHEDULE_JOB_CONTROL_UNRESOLVED');assert.deepEqual(saved.currentBinding,state==='PENDING'?h.identity.binding:row.projection.target.binding);assert.equal(saved.cleanupReady,state!=='PENDING');
});
test('a coherently retargeted continuation envelope is refused by the existing canonical reader',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();await h.pause();const target=await h.resume(),row=h.row(target);row.continuation.continuation.contextSha256='f'.repeat(64);row.continuation_sha256=hash(row.continuation);
 await assert.rejects(createScheduledJobLineage({store:h.store}).read(h.selection,check));
});
test('a fork control stays outside scheduled same-work lineage even when its receipt is APPLIED',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();await h.pause();await h.resume();
 const row=[...h.conversations.state.controls.values()].find(r=>r.projection.input.intent==='resume');row.projection.input.intent='fork';row.projection.target.binding.conversationId=id(880);row.projection.target.binding.writerFence=1;row.projection.target.targetSessionId=id(881);row.projection.retirement=null;row.projection.inputSha256=hash(row.projection.input);row.projection_sha256=hash(row.projection);
 const saved=await createScheduledJobLineage({store:h.store}).read(h.selection,check);assert.equal(saved.occupiedReason,'SCHEDULE_JOB_CONTROL_UNRESOLVED');assert.equal(saved.bindings.length,1);
});
test('stored effect identity rejects wrapper IDs, foreign bindings and accessor inputs without invocation',()=>{
 const effect={};let getters=0;assert.throws(()=>snapshotScheduledJobSelection({get occurrence(){getters++;return {};},effect}));assert.equal(getters,0);
});
test('confirmed original absence stays explicitly occupied and cannot manufacture a current binding',async t=>{
 const h=await scheduledJobFixture({admit:false});t.after(h.close);const saved=await createScheduledJobLineage({store:h.store}).read(h.selection,check);assert.equal(saved.currentBinding,null);assert.equal(saved.expiresAtMs,null);assert.equal(saved.occupiedReason,'SCHEDULE_JOB_NOT_ADMITTED');
});
test('an actual fresh next-prompt reservation is never adopted as scheduled same-work continuation',async t=>{
 const h=await scheduledJobFixture({allocated:false});t.after(h.close);await h.cancel();let sequence=4000;
 const next=createNextRunOwner({store:h.store,retirement:{verifyRetired(){throw Error('not used for foreclosure');}},revocation:{verifyRevoked(){throw Error('not used for foreclosure');}},versions:h.template.versions,now:h.now,newId:()=>id(sequence++)});
 await next.selectRun({principal:h.template.principal,conversationId:h.identity.binding.conversationId});
 const saved=await createScheduledJobLineage({store:h.store}).read(h.selection,check);assert.equal(saved.occupiedReason,'SCHEDULE_JOB_NEW_PROMPT');assert.deepEqual(saved.currentBinding,h.identity.binding);
});
test('an ambiguous coherently hashed second resume cannot nominate a successor',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();await h.pause();await h.resume();
 const row=structuredClone([...h.conversations.state.controls.values()].find(r=>r.projection.input.intent==='resume'));
 row.control_id=id(4500);row.control_sequence+=100;row.projection.input.controlId=row.control_id;row.projection.inputSha256=hash(row.projection.input);row.projection_sha256=hash(row.projection);h.conversations.state.controls.set(`${row.tenant_id}:${row.control_id}`,row);
 await assert.rejects(createScheduledJobLineage({store:h.store}).read(h.selection,check));
});
