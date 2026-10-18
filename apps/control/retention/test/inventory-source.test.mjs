import test from 'node:test';
import assert from 'node:assert/strict';
import {createRetentionInventoryFor} from '../inventory-source.mjs';
import {recomputePlan} from '../purge.mjs';
import {policy,snapshot,subjectOf} from './fixture.mjs';

const row=(runId,keySha256)=>({runId,keySha256});
function fixture(kind='conversation'){
 const subject=subjectOf(kind),base=snapshot(subject),{memoryContinuations:discard,...nonContinuation}=base,
  complete={...nonContinuation,schedules:[],receipts:[],memoryProposals:[],budgetRuns:[]};
 let generation=4,reads=0,rowReads=0;
 const journal={async get(){reads++;return {state:'SUPPRESSED',ledgerSequence:generation,
  entrySha256:String(generation).repeat(64)};}};
 const rows=kind==='conversation'?[row(base.runs[0].runId,'a'.repeat(64)),row(base.runs[0].runId,'b'.repeat(64))]:[];
 const memoryProposalContexts={async inventoryForConversation(request){rowReads++;
  assert.deepEqual(request,{tenantId:subject.tenantId,conversationId:subject.subjectId});return rows;}};
 return {subject,complete,journal,memoryProposalContexts,rows,counts:()=>({reads,rowReads}),
  changeGeneration:()=>{generation++;}};
}

test('complete trusted snapshot receives exact store-owned continuation rows under one suppression generation',async()=>{
 const f=fixture(),inventoryFor=createRetentionInventoryFor({snapshotFor:async()=>f.complete,
  memoryProposalContexts:f.memoryProposalContexts,journal:f.journal});
 const result=await inventoryFor(f.subject);
 assert.deepEqual(result.rowTargets.filter(target=>target.table==='memory_proposal_contexts'),
  f.rows.map(value=>({className:'conversation',table:'memory_proposal_contexts',...value}))
   .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 assert.deepEqual(f.counts(),{reads:2,rowReads:1});
});

test('missing active class, spoofed continuation source and wrong subject refuse without producing a plan',async()=>{
 const f=fixture();
 for(const base of [
  (({uploads:discard,...rest})=>rest)(f.complete),
  (({receipts:discard,...rest})=>rest)(f.complete),
  (({memoryProposals:discard,...rest})=>rest)(f.complete),
  (({budgetRuns:discard,...rest})=>rest)(f.complete),
  (({schedules:discard,...rest})=>rest)(f.complete),
  {...f.complete,memoryContinuations:[]},
  {...f.complete,subject:subjectOf()},
 ]){
  const inventoryFor=createRetentionInventoryFor({snapshotFor:async()=>base,
   memoryProposalContexts:f.memoryProposalContexts,journal:f.journal});
  await assert.rejects(inventoryFor(f.subject),/RETENTION_AUTHORITY_UNAVAILABLE/);
 }
});

test('release and new suppression during snapshot collection refuse the old generation',async()=>{
 const f=fixture(),inventoryFor=createRetentionInventoryFor({snapshotFor:async()=>{
  f.changeGeneration();return f.complete;},memoryProposalContexts:f.memoryProposalContexts,journal:f.journal});
 await assert.rejects(inventoryFor(f.subject),/RETENTION_AUTHORITY_UNAVAILABLE/);
});

test('artifact inventory truthfully has no conversation continuation rows',async()=>{
 const f=fixture('artifact'),inventoryFor=createRetentionInventoryFor({snapshotFor:async()=>f.complete,
  memoryProposalContexts:f.memoryProposalContexts,journal:f.journal});
 const result=await inventoryFor(f.subject);
 assert.equal(result.rowTargets.some(target=>target.table==='memory_proposal_contexts'),false);
 assert.deepEqual(f.counts(),{reads:2,rowReads:0});
});

test('canonical plan recomputation receives every continuation target through facts.inventoryFor',async()=>{
 const f=fixture(),inventoryFor=createRetentionInventoryFor({snapshotFor:async()=>f.complete,
  memoryProposalContexts:f.memoryProposalContexts,journal:f.journal});
 const nowMs=1_800_000_000_000,days=86400000,
  state={state:'SUPPRESSED',suppressedAtMs:nowMs-8*days,ledgerSequence:4,entrySha256:'4'.repeat(64)},
  facts={inventoryFor,policy:async()=>policy(),sharedFor:async()=>[],
   holds:()=>({objectLockRetainUntilMs:null,legalHold:false}),liabilities:async()=>[],
   lastActivityFor:async()=>nowMs-30*days};
 const plan=await recomputePlan(facts,f.subject,state,nowMs);
 assert.deepEqual(plan.rowSteps.filter(step=>step.target.table==='memory_proposal_contexts')
  .map(step=>step.target).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
  f.rows.map(value=>({className:'conversation',table:'memory_proposal_contexts',...value}))
   .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
});
