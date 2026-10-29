import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {compose,subjectOf,snapshot} from './fixture.mjs';
import {enumerateReferences} from '../inventory.mjs';
import {subjectKey} from '../boundary.mjs';
import {createRecoveryReconciler} from '../reconciliation.mjs';
import {createPurgeExecutor} from '../purge.mjs';

async function fixture(){
 const f=compose(),subject=subjectOf(),requestId=randomUUID(),key=subjectKey(subject);
 const at=f.clock.now(),trash={requestId,revision:'1',trashedAtMs:at,restoreUntilMs:at+30*86400000};
 const inventory=enumerateReferences(snapshot(subject));f.current.inventories.set(key,inventory);f.rows.seed(key,inventory);
 for(const object of inventory.objects)f.store.put(f.keyFor(object),object.versionId);
 await f.suppression.suppress({principal:f.principal,subject,reason:'conversation-trash:'+requestId});
 f.clock.advance(31*86400000);
 const facts={...f.facts,trashFor:async()=>({...trash,checkedAtMs:f.clock.now()})};
 let completions=0;
 const purge=createPurgeExecutor({...f,facts,now:f.clock.now,enabled:true,async finalize(){completions++;}});
 await purge.sweepSubject(subject);
 return {...f,subject,key,trash,facts,purge,completions:()=>completions,
  current:()=>f.journal.get(key),reconcile:verifyCore=>createRecoveryReconciler({...f,facts,verifyCore,now:f.clock.now}).reconcile()};
}

test('recovery retains completion only after current Core absence readback, without replaying deletion',async()=>{
 const f=await fixture();let reads=0;
 const verify=async(subject,trash)=>{assert.deepEqual(subject,f.subject);assert.deepEqual(trash,f.trash);reads++;return true;};
 await f.reconcile(verify);assert.equal((await f.current()).purge.coreFinalized,true);
 await f.reconcile(verify);assert.equal(reads,2);assert.equal(f.completions(),1);
});

for(const [name,verify] of [
 ['restored Core copies',async()=>false],['unavailable Core',async()=>{throw Error('offline');}],['missing verifier',null],
 ['malformed readback',async()=>({erased:true})],
])test(name+' removes the old completion claim and leaves the canonical sweep resumable',async()=>{
 const f=await fixture();
 await f.reconcile(verify);
 assert.notEqual((await f.current()).purge.coreFinalized,true);
 const latest=(await f.ledger.latest()).get(f.key);
 assert.equal(latest.state,'PURGE_UNKNOWN');assert.equal(latest.facts.coreFinalized,false);
 assert.equal(latest.reason,'CORE_COMPLETION_UNVERIFIED');assert.equal(f.completions(),1,'recovery never deletes');
 assert.equal((await f.current()).state,'SUPPRESSED');
 await f.purge.sweepSubject(f.subject);assert.equal(f.completions(),2);
 assert.equal((await f.current()).purge.coreFinalized,true);
});
