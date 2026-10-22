/** C11 review follow-up: the extra continuity read during postdeploy acceptance is refuse-only and binds checkpoint identity to
 * the actual source run. Scripted SQL protocol evidence; no native PostgreSQL or deployed compatibility claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {binding,id,versions} from './lifecycle-fixture.mjs';
import {fixture} from './next-run-recovery-fixture.mjs';
import {hash} from '../boundary.mjs';

test('C11 postdeploy accept refuses a rehashed checkpoint identity belonging to another run without accepting the target',async()=>{
 const x=await fixture();try{
  await x.first();await x.complete(binding);await x.retire(binding);const selected=await x.select();
  x.deploy({...versions,imageDigest:'sha256:'+'5'.repeat(64)});
  const key=[binding.tenantId,binding.conversationId,binding.runId].join(':'),saved=structuredClone(x.f.state.completions.get(key));
  for(const change of [b=>b.runId=id(990),b=>b.actorId='foreign-actor',b=>b.writerFence++]){
   const row=structuredClone(saved);change(row.identity.binding);row.identity_sha256=hash(row.identity);x.f.state.completions.set(key,row);
   const before={runs:x.f.state.runs.size,events:x.f.state.events.size,reservation:structuredClone([...x.f.state.nextRuns.values()])};
   await assert.rejects(x.accept(selected.binding),/STORE_CORRUPT/);
   assert.equal(x.f.state.runs.size,before.runs);assert.equal(x.f.state.events.size,before.events);
   assert.deepEqual([...x.f.state.nextRuns.values()],before.reservation);
  }
  x.f.state.completions.set(key,saved);const accepted=await x.accept(selected.binding);
  assert.equal(accepted.replayed,false);assert.deepEqual(accepted.run.binding,selected.binding);
 }finally{x.f.close();}
});
