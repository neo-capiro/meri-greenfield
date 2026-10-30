/** The lifecycle owner's same-client APPLIED/no-return read: the one defect the facts projection cannot
 * express (a control whose browserReturn is set still reports phase browser-held before any successor). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserCustodyJournal} from '../lifecycle/browser-custody.mjs';

const NOW=1700000000000;
const binding={tenantId:'tenant',actorId:'actor',conversationId:'22222222-2222-4222-8222-222222222222',
 runId:'33333333-3333-4333-8333-333333333333',attemptId:'44444444-4444-4444-8444-444444444444',
 workerId:'55555555-5555-4555-8555-555555555555',writerFence:7};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:'66666666-6666-4666-8666-666666666666',policyRevision:'p1'}];
const allocation={hostId:'11111111-1111-4111-8111-111111111111',generation:3};
const custody={schema:'meri-browser-custody/1',binding,controlId:'88888888-8888-4888-8888-888888888888',
 ownerInstanceId:'77777777-7777-4777-8777-777777777777',hostId:allocation.hostId,generation:allocation.generation,
 leaseEpoch:2,policySha256:'f'.repeat(64),expiresAtMs:NOW+60000};
function setup({control={},run={}}={}){
 const saves=[];
 const row={projection:{state:'paused',scopes},sequence_end:null,hold_control_id:custody.controlId,...run};
 const stored={input:{intent:'takeover.begin',controlId:custody.controlId},state:'APPLIED',sourceBinding:binding,browserCustody:custody,
  proof:{checkpointSha256:'9'.repeat(64)},checkpointId:binding.runId,...control};
 const journal=createBrowserCustodyJournal({tx:async(_binding,_check,effect)=>effect({}),rowRun:value=>value,
  verifyRun:async()=>row,lookup:async()=>stored,pins:()=>{},save:async(...args)=>saves.push(args),
  now:()=>NOW,latestRun:async()=>row,readExecution:async()=>null});
 return {journal,saves,stored,row};
}
const call=(f,allocationOverride=allocation)=>f.journal.heldApplied({}, {binding,scopes,
 selectedClientId:scopes[0].resourceId,allocation:allocationOverride},()=>{});

test('an APPLIED, unreturned takeover in the exact allocation is verified with no lifecycle write',async()=>{
 const f=setup();
 const result=await call(f);
 assert.deepEqual(result.custody,custody);
 assert.equal(result.controlId,custody.controlId);
 assert.equal(result.checkpointSha256,'9'.repeat(64));
 assert.equal(f.saves.length,0,'read-only: nothing is saved');
});

test('a returned control is refused even though the run still reports browser-held',async()=>{
 // The exact defect: browserReturn set, no successor yet, phase would still read browser-held.
 const f=setup({control:{browserReturn:{ownerInstanceId:custody.ownerInstanceId,leaseEpoch:custody.leaseEpoch+1,
  snapshotSha256:'a'.repeat(64)}}});
 await assert.rejects(call(f),{message:'BROWSER_CUSTODY_REFUSED'});
});

test('pending, non-APPLIED, missing checkpoint, foreign host and expired custody all refuse',async()=>{
 // A staged (PENDING/DISPATCHING) control is not APPLIED; a broken stored record is STORE_CORRUPT.
 for(const [control,expected] of [[{state:'PENDING'},'BROWSER_CUSTODY_REFUSED'],
  [{state:'DISPATCHING'},'BROWSER_CUSTODY_REFUSED'],[{proof:null},'BROWSER_CUSTODY_REFUSED'],[{checkpointId:null},'STORE_CORRUPT']]){
  const f=setup({control});
  await assert.rejects(call(f),{message:expected});
 }
 const foreign=setup();
 await assert.rejects(call(foreign,{hostId:allocation.hostId,generation:allocation.generation+1}),
  {message:'BROWSER_CUSTODY_REFUSED'});
 const expired=setup({control:{browserCustody:{...custody,expiresAtMs:NOW}}});
 await assert.rejects(call(expired),{message:'BROWSER_CUSTODY_EXPIRED'});
});
