/** Scripted SQL composition. Assessment and admission share the canonical execution journal; no provider/database claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {binding,id,versions} from './lifecycle-fixture.mjs';
import {fixture,check} from './next-run-recovery-fixture.mjs';
import {hash} from '../boundary.mjs';
import {createNextRunOwner} from '../next-run.mjs';

const principal={tenantId:binding.tenantId,actorId:binding.actorId};
const query=(source=binding)=>({principal,conversationId:source.conversationId,sourceRunId:source.runId});
const key=b=>[b.tenantId,b.conversationId,b.runId].join(':');
function prepared(x,release=versions){
 return {owner:createNextRunOwner({store:x.f.store,versions:release})};
}
const durable=x=>structuredClone(Object.fromEntries(['runs','events','executions','nextRuns','completions','controls'].map(k=>[k,x.f.state[k]])));
async function readOnly(x,p,source=binding,over={}){
 const before=durable(x),offset=x.f.state.calls.length;
 try{return await p.owner.assessNextTurn({...query(source),...over});}
 finally{assert.deepEqual(durable(x),before,'assessment cannot mutate any durable lifecycle row');
  assert.ok(x.f.state.calls.slice(offset).every(sql=>!/^(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/u.test(sql)),'assessment issues no mutating SQL');}
}
async function completed(x){await x.first();const checkpoint=await x.complete(binding);await x.settle(binding);return checkpoint;}
const ready={admissible:true,reason:null};

test('X1 completed history remains unavailable until retirement; assessment then agrees with one admitted successor without effects',async()=>{
 const x=await fixture();try{await x.first();await x.complete(binding);const p=prepared(x);
  assert.deepEqual(await readOnly(x,p),{admissible:false,reason:'NEXT_RUN_SOURCE_UNSETTLED'});
  await assert.rejects(p.owner.admitTurn(query()),/NEXT_RUN_SOURCE_UNSETTLED/);
  await x.settle(binding);assert.deepEqual(await readOnly(x,p),ready);assert.equal(x.f.state.nextRuns.size,0);
  const admitted=await p.owner.admitTurn(query());assert.equal(admitted.state,'RESERVED');assert.equal(x.f.state.nextRuns.size,1);
  await x.accept(admitted.targetBinding);
  assert.deepEqual(await readOnly(x,p),{admissible:false,reason:'NEXT_RUN_NOT_LATEST'});
 }finally{x.f.close();}
});

for(const state of ['failed','cancelled'])test(`X1 ${state} source remains held while Stop is incomplete and becomes admissible after exact retirement`,async()=>{
 const x=await fixture();try{await x.first();await x.running(binding);await x.f.store.append(binding,x.status(state,state==='failed'?'EXECUTION_FAILED':'USER_CANCELLED'),check);
  const p=prepared(x);assert.deepEqual(await readOnly(x,p),{admissible:false,reason:'NEXT_RUN_SOURCE_UNSETTLED'});
  await assert.rejects(p.owner.admitTurn(query()),/NEXT_RUN_SOURCE_UNSETTLED/);await x.settle(binding);
  assert.deepEqual(await readOnly(x,p),ready);const admitted=await p.owner.admitTurn(query());await x.accept(admitted.targetBinding);
  assert.equal(await x.lineage(admitted.targetBinding),null,'no completed turn means no invented checkpoint');
 }finally{x.f.close();}
});

test('X1 live and paused work are not next-turn admissible, including a settled paused invocation',async()=>{
 const x=await fixture();try{await x.first();await x.running(binding);await assert.rejects(x.settle(binding),/EXECUTION_SETTLEMENT_REFUSED/);const p=prepared(x);
  assert.deepEqual(await readOnly(x,p),{admissible:false,reason:'NEXT_RUN_SOURCE_NOT_TERMINAL'});
  await assert.rejects(p.owner.admitTurn(query()),/NEXT_RUN_SOURCE_NOT_TERMINAL/);
  await x.f.store.append(binding,x.status('paused'),check);await x.settle(binding);
  assert.deepEqual(await readOnly(x,p),{admissible:false,reason:'NEXT_RUN_SOURCE_NOT_TERMINAL'});
 }finally{x.f.close();}
});

test('X1 queued cancellation without an invocation claim is safe; the canonical terminal fence forbids a late claim',async()=>{
 const x=await fixture();try{await x.f.service.allocateInput({credential:x.f.credential,input:x.f.input});await x.f.service.submit({credential:x.f.credential,input:x.f.input});
  await x.f.service.cancel({credential:x.f.credential});const p=prepared(x);assert.equal(x.f.state.executions.size,0);assert.deepEqual(await readOnly(x,p),ready);
  await assert.rejects(x.allocate(binding),/EXECUTION_NOT_QUEUED/);const admitted=await p.owner.admitTurn(query());assert.equal(admitted.state,'RESERVED');assert.equal(x.f.state.executions.size,0);
 }finally{x.f.close();}
});

test('X1 malformed execution identity and unconfirmed stopping refuse without cleanup effects',async()=>{
 const x=await fixture();try{await completed(x);const p=prepared(x),original=structuredClone(x.f.state.executions.get(key(binding)).record);
  for(const change of [r=>{r.phase='stopping';r.native=null;},r=>r.runtimeSessionId='invalid',r=>r.binding.actorId='foreign']){
   const row=x.f.state.executions.get(key(binding));row.record=structuredClone(original);change(row.record);row.record_sha256=hash(row.record);
   assert.deepEqual(await readOnly(x,p),{admissible:false,reason:'NEXT_RUN_SOURCE_UNSETTLED'});
   await assert.rejects(p.owner.admitTurn(query()),/NEXT_RUN_SOURCE_UNSETTLED/);
  }
 }finally{x.f.close();}
});

test('X1 fresh tenant and actor selection cannot read eligibility for a foreign source',async()=>{
 const x=await fixture();try{await completed(x);const p=prepared(x);
  for(const principal of [{tenantId:binding.tenantId,actorId:'foreign'},{tenantId:'foreign',actorId:binding.actorId}]){
   await assert.rejects(readOnly(x,p,binding,{principal}),/NEXT_RUN_OWNER_REFUSED/);
   await assert.rejects(p.owner.admitTurn({...query(),principal}),/NEXT_RUN_OWNER_REFUSED/);
  }
  const controller=new AbortController();controller.abort();await assert.rejects(readOnly(x,p,binding,{signal:controller.signal}),/NEXT_RUN_CANCELLED/);
 }finally{x.f.close();}
});

test('X1 image-only restart is admissible, while SDK CLI and format changes refuse before successor reservation',async()=>{
 const x=await fixture();try{await completed(x);
  // The current contract fixes checkpointFormat: a new format is refused even before an owner can assess or admit.
  assert.throws(()=>prepared(x,{...versions,checkpointFormat:'checkpoint-v2'}),/RuntimeVersions/);
  for(const change of [{sdk:'0.3.296'},{cli:'2.1.296'}]){
   const p=prepared(x,{...versions,...change}),reason='NEXT_TURN_SDK_CHANGED';
   assert.deepEqual(await readOnly(x,p),{admissible:false,reason});await assert.rejects(p.owner.admitTurn(query()),{code:reason});assert.equal(x.f.state.nextRuns.size,0);
  }
  const release={...versions,imageDigest:'sha256:'+'5'.repeat(64),skillsDigest:'c'.repeat(64)},p=prepared(x,release);x.deploy(release);
  assert.deepEqual(await readOnly(x,p),ready);const admitted=await p.owner.admitTurn(query());await x.accept(admitted.targetBinding);
  assert.deepEqual((await x.lineage(admitted.targetBinding)).nextTurn.checkpoint.versions,versions);
 }finally{x.f.close();}
});

test('X1 a predeploy reservation stays read-only and image compatible; an SDK change cannot claim it is sendable',async()=>{
 const x=await fixture();try{await completed(x);const reserved=await x.select(),before=structuredClone([...x.f.state.nextRuns.values()]);
  const changed={...versions,sdk:'0.3.296'};x.deploy(changed);
  assert.deepEqual(await readOnly(x,prepared(x,changed)),{admissible:false,reason:'NEXT_TURN_SDK_CHANGED'});
  await assert.rejects(x.accept(reserved.binding),/NEXT_TURN_SDK_CHANGED/);assert.deepEqual([...x.f.state.nextRuns.values()],before);
  const release={...versions,imageDigest:'sha256:'+'6'.repeat(64)};x.deploy(release);const p=prepared(x,release);
  assert.deepEqual(await readOnly(x,p),ready);assert.deepEqual([...x.f.state.nextRuns.values()],before);
  const replay=await p.owner.admitTurn(query());assert.deepEqual(replay.targetBinding,reserved.binding);assert.equal(replay.replayed,true);
  await x.accept(replay.targetBinding);
 }finally{x.f.close();}
});

test('X1 a failed later turn assesses and admits using the older published checkpoint, preserving its policy and scopes',async()=>{
 const x=await fixture();try{const done=await completed(x),second=(await x.select()).binding;await x.accept(second);
  await x.f.store.append(second,x.status('failed','EXECUTION_FAILED'),check);const p=prepared(x);assert.deepEqual(await readOnly(x,p,second),ready);
  const row=x.f.state.runs.get(key(second)),original=structuredClone(row.projection);
  row.projection.scopes=row.projection.scopes.map(s=>({...s,policyRevision:'policy2'}));row.projection.policyRevision='policy2';row.projection_sha256=hash(row.projection);
  assert.deepEqual(await readOnly(x,p,second),{admissible:false,reason:'NEXT_RUN_SCOPE_REFUSED'});
  await assert.rejects(p.owner.admitTurn(query(second)),/NEXT_RUN_SCOPE_REFUSED/);
  const restored=x.f.state.runs.get(key(second));restored.projection=original;restored.projection_sha256=hash(original);
  const admitted=await p.owner.admitTurn(query(second));await x.accept(admitted.targetBinding);
  assert.equal((await x.lineage(admitted.targetBinding)).nextTurn.checkpoint.checkpointId,done.checkpointId);
 }finally{x.f.close();}
});

test('X1 incomplete checkpoint custody, altered reservation facts and storage nonanswers never become ready',async()=>{
 const x=await fixture();try{await completed(x);const p=prepared(x),cp=x.f.state.completions.get(key(binding));
  x.f.state.completions.delete(key(binding));assert.deepEqual(await readOnly(x,p),{admissible:false,reason:'NEXT_RUN_SOURCE_UNSETTLED'});
  await assert.rejects(p.owner.admitTurn(query()),/NEXT_RUN_SOURCE_UNSETTLED/);x.f.state.completions.set(key(binding),cp);
  await x.select();const r=[...x.f.state.nextRuns.values()][0];r.reservation.facts.execution.recordSha256='f'.repeat(64);r.reservation_sha256=hash(r.reservation);
  assert.deepEqual(await readOnly(x,p),{admissible:false,reason:'NEXT_RUN_REPLAY_REFUSED'});
  x.f.state.commitUnknown=true;await assert.rejects(readOnly(x,p),/STORE_COMMIT_UNKNOWN/);x.f.state.commitUnknown=false;
 }finally{x.f.close();}
});
