/** Synthetic (scripted SQL protocol fixture, whose transactions are serialized like the store's conversation advisory lock and whose
 * allocation rows enforce the primary key): failure or Stop before any allocation claim → next prompt, through the canonical lifecycle
 * store, run reconciler, allocation journal and next-run owner/journal. The no-authority evidence is the foreclosure row the store
 * writes with the queued run's own terminal transition; a missing row is never accepted. */
import test from 'node:test';import assert from 'node:assert/strict';
import {binding,scopes,id,versions} from './lifecycle-fixture.mjs';
import {fixture,check,at} from './next-run-recovery-fixture.mjs';
import {hash} from '../boundary.mjs';
const row=(x,b)=>x.f.state.allocations.get([b.tenantId,b.conversationId,b.runId].join(':'));
const submit=x=>x.f.service.submit({credential:x.f.credential,input:x.f.input});
const history=x=>x.f.store.read(binding,{after:0,limit:100},check);
const reserveFacts=(x,source,facts,n=1)=>x.f.store.nextRuns.reserve({source,target:{...source,runId:id(960+n),attemptId:id(970+n),workerId:id(980+n),writerFence:source.writerFence+1},facts,scopes,versions,policyRevision:'policy1',reservedAt:at},check);
const turns=async n=>{for(let i=0;i<n;i++)await new Promise(resolve=>setImmediate(resolve));};
async function admittedOnEvidence(x,terminal){
 // Before the repair this selection failed NEXT_RUN_RETIREMENT_REQUIRED and a later claim NATIVE_PREPARATION_STATE_REFUSED.
 const selected=await x.select();assert.equal(selected.reserved,true);assert.equal(selected.binding.writerFence,2);
 const evidence=row(x,binding),last=(await history(x)).events.at(-1);
 assert.equal(evidence.record.state,'FORECLOSED','the terminal transition recorded the no-authority evidence');assert.deepEqual(evidence.record.foreclosure,{eventId:last.eventId,eventSha256:hash(last),state:terminal});
 await assert.rejects(x.f.store.allocations.record({binding,allocationKey:hash(binding),state:'RETIRED',resource:null},check),/NATIVE_PREPARATION_REFUSED/,'the evidence is immutable');
 assert.deepEqual([...x.f.state.nextRuns.values()][0].reservation.facts,{checkpoint:null,noAuthority:{foreclosureSha256:evidence.record_sha256}});
 assert.equal((await x.accept(selected.binding,'try again')).replayed,false);assert.equal(await x.lineage(selected.binding),null,'a fresh SDK session; earlier model context is not restored');
 await assert.rejects(x.allocate(binding),/NATIVE_PREPARATION_STATE_REFUSED/,'the foreclosed attempt can never be claimed');
 await x.allocate(selected.binding);assert.equal(row(x,selected.binding).record.state,'ALLOCATED','the successor is not blocked by the foreclosed attempt');}
test('review reproduction: a queued run with no allocation reconciled to failed/ATTEMPT_LOST admits the next prompt on its explicit no-authority evidence',async()=>{const x=await fixture();try{
 await submit(x);assert.deepEqual(await x.reconciler.reconcile({binding}),{outcome:'reconciled',state:'failed',reasonCode:'ATTEMPT_LOST'});
 await admittedOnEvidence(x,'failed');}finally{x.f.close();}});
test('review reproduction: Stop of a queued run with no allocation (cancelled/USER_CANCELLED) admits the next prompt on its explicit no-authority evidence',async()=>{const x=await fixture();try{
 await submit(x);await x.f.service.cancel({credential:x.f.credential});assert.deepEqual((await history(x)).events.at(-1).data,{state:'cancelled',reasonCode:'USER_CANCELLED'});
 await admittedOnEvidence(x,'cancelled');}finally{x.f.close();}});
test('a missing allocation row is never no-authority evidence: selection and the journal refuse it',async()=>{
 const x=await fixture();try{
  // Started without a claim (outside the native path) and then failed: no evidence is written for a run that left queued.
  await submit(x);await x.running(binding);await x.f.store.append(binding,x.status('failed','EXECUTION_FAILED'),check);assert.equal(row(x,binding),undefined);
  assert.equal(await x.f.store.nextRuns.foreclosure(binding,check),null);await assert.rejects(x.select(),/NEXT_RUN_RETIREMENT_REQUIRED/);
  await assert.rejects(reserveFacts(x,binding,{checkpoint:null,noAuthority:{foreclosureSha256:'f'.repeat(64)}}),/NEXT_RUN_RETIREMENT_REQUIRED/,'forged evidence names no row');assert.equal(x.f.state.nextRuns.size,0);}finally{x.f.close();}
 const y=await fixture();try{
  await submit(y);await y.f.service.cancel({credential:y.f.credential});const sha=row(y,binding).record_sha256;
  await assert.rejects(reserveFacts(y,binding,{checkpoint:null,noAuthority:{foreclosureSha256:'e'.repeat(64)}}),/NEXT_RUN_RETIREMENT_REQUIRED/,'evidence must match the row');
  await assert.rejects(reserveFacts(y,binding,{checkpoint:null,retirement:{physicalStopProven:true},revocation:{receiptSha256:'f'.repeat(64),grantIds:[id(240)]}}),/NEXT_RUN_RETIREMENT_REQUIRED/,'no forged retirement in place of the evidence');
  y.f.state.allocations.delete([binding.tenantId,binding.conversationId,binding.runId].join(':'));
  await assert.rejects(y.select(),/NEXT_RUN_RETIREMENT_REQUIRED/);await assert.rejects(reserveFacts(y,binding,{checkpoint:null,noAuthority:{foreclosureSha256:sha}}),/NEXT_RUN_RETIREMENT_REQUIRED/,'a removed row is a missing row');
  assert.equal(y.f.state.nextRuns.size,0);}finally{y.f.close();}});
test('a late claim racing the terminal transition: exactly one wins, and a terminal run never acquires an allocation',async()=>{const seen=new Set();
 for(let delay=0;delay<24;delay++){const x=await fixture();try{
  await submit(x);const claim=(async()=>{await turns(delay);return x.allocate(binding);})(),stop=x.f.service.cancel({credential:x.f.credential});
  const [claimed,stopped]=await Promise.allSettled([claim,stop]);assert.equal(stopped.status,'fulfilled');assert.equal(await x.state(),'cancelled');const r=row(x,binding);
  if(claimed.status==='fulfilled'){seen.add('claim');assert.equal(r.record.state,'ALLOCATED','the claim committed before the terminal transition: no evidence is written');
   await assert.rejects(x.select(),/NEXT_RUN_RETIREMENT_REQUIRED/,'existing authority still needs retirement');}
  else{seen.add('terminal');assert.match(String(claimed.reason?.code??claimed.reason?.message),/NATIVE_PREPARATION_STATE_REFUSED/);assert.equal(r.record.state,'FORECLOSED');
   await assert.rejects(x.allocate(binding),/NATIVE_PREPARATION_STATE_REFUSED/,'any later claim is refused');assert.equal(row(x,binding).record.state,'FORECLOSED');assert.equal((await x.select()).reserved,true);}
 }finally{x.f.close();}}
 assert.deepEqual([...seen].sort(),['claim','terminal'],'both interleavings were exercised');});
test('existing authority still requires retirement and revocation: a claim before Stop yields no evidence and forged evidence is refused',async()=>{const x=await fixture();try{
 await submit(x);await x.allocate(binding);await x.f.service.cancel({credential:x.f.credential});assert.equal(row(x,binding).record.state,'ALLOCATED');assert.equal(await x.f.store.nextRuns.foreclosure(binding,check),null);
 await assert.rejects(reserveFacts(x,binding,{checkpoint:null,noAuthority:{foreclosureSha256:row(x,binding).record_sha256}}),/NEXT_RUN_RETIREMENT_REQUIRED/);await assert.rejects(x.select(),/NEXT_RUN_RETIREMENT_REQUIRED/);
 await x.retire(binding);const selected=await x.select();assert.equal(selected.reserved,true);const facts=[...x.f.state.nextRuns.values()][0].reservation.facts;assert.deepEqual(Object.keys(facts).sort(),['checkpoint','retirement','revocation']);assert.deepEqual(facts.revocation.grantIds,[id(240)]);}finally{x.f.close();}});
