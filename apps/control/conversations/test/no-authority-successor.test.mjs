/** Scripted SQL: claim and terminal fencing share the canonical conversation transaction. No external execution. */
import test from 'node:test';import assert from 'node:assert/strict';
import {binding,scopes,id,versions} from './lifecycle-fixture.mjs';
import {fixture,check,at} from './next-run-recovery-fixture.mjs';
const row=(x,b)=>x.f.state.executions.get([b.tenantId,b.conversationId,b.runId].join(':'));
const submit=async x=>{await x.f.service.allocateInput({credential:x.f.credential,input:x.f.input});return x.f.service.submit({credential:x.f.credential,input:x.f.input});};
const reserveFacts=(x,facts)=>x.f.store.nextRuns.reserve({source:binding,target:{...binding,runId:id(961),attemptId:id(971),workerId:id(981),writerFence:2},facts,scopes,versions,policyRevision:'policy1',reservedAt:at},check);
for(const terminal of ['failed','cancelled'])test(`an unclaimed queued run fenced ${terminal} admits one successor and never a late original claim`,async()=>{const x=await fixture();try{
 await submit(x);if(terminal==='failed')assert.deepEqual(await x.reconciler.reconcile({binding}),{outcome:'reconciled',state:'failed',reasonCode:'ATTEMPT_LOST'});else await x.f.service.cancel({credential:x.f.credential});
 assert.equal(row(x,binding),undefined);const selected=await x.select();assert.equal(selected.binding.writerFence,2);assert.deepEqual([...x.f.state.nextRuns.values()][0].reservation.facts,{checkpoint:null,execution:null});
 await x.accept(selected.binding);assert.equal(await x.lineage(selected.binding),null);await assert.rejects(x.allocate(binding),/EXECUTION_NOT_QUEUED/);await x.allocate(selected.binding);assert.equal(row(x,selected.binding).record.phase,'launching');
 }finally{x.f.close();}});
test('caller-fabricated settlement and retired physical-stop facts cannot replace the actual execution',async()=>{const x=await fixture();try{
 await x.first();await x.f.service.cancel({credential:x.f.credential});
 await assert.rejects(reserveFacts(x,{checkpoint:null,execution:null}),/NEXT_RUN_EXECUTION_UNSETTLED/);
 await assert.rejects(reserveFacts(x,{checkpoint:null,execution:{recordSha256:'f'.repeat(64)}}),/NEXT_RUN_EXECUTION_UNSETTLED/);
 await assert.rejects(reserveFacts(x,{checkpoint:null,retirement:{physicalStopProven:true},revocation:{receiptSha256:'f'.repeat(64),grantIds:[id(240)]}}));assert.equal(x.f.state.nextRuns.size,0);
 }finally{x.f.close();}});
test('both claim/terminal lock orderings preserve the same no-redispatch rule',async()=>{
 for(const claimFirst of [true,false]){const x=await fixture();try{await submit(x);const claim=()=>x.allocate(binding),cancel=()=>x.f.store.append(binding,x.status('cancelled','USER_CANCELLED'),check);
  const first=claimFirst?claim():cancel(),second=claimFirst?cancel():claim();const results=await Promise.allSettled([first,second]);assert.equal(await x.state(),'cancelled');
  if(claimFirst){assert.equal(results[0].status,'fulfilled');assert.equal(row(x,binding).record.phase,'launching');await assert.rejects(x.select(),/NEXT_RUN_EXECUTION_UNSETTLED/);}
  else{assert.equal(results[1].status,'rejected');assert.match(results[1].reason.code,/EXECUTION_NOT_QUEUED/);assert.equal(row(x,binding),undefined);assert.equal((await x.select()).reserved,true);}
 }finally{x.f.close();}}
});
test('a claimed cancelled execution blocks successor until exact Stop settlement',async()=>{const x=await fixture();try{
 await x.first();await x.f.service.cancel({credential:x.f.credential});await assert.rejects(x.select(),/NEXT_RUN_EXECUTION_UNSETTLED/);await x.reconciler.reconcile({binding});assert.equal(row(x,binding).record.native.stopped,true);assert.equal((await x.select()).reserved,true);
 }finally{x.f.close();}});
