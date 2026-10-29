import test from 'node:test';
import assert from 'node:assert/strict';
import {compose,subjectOf,snapshot,planFrom} from './fixture.mjs';
import {enumerateReferences} from '../inventory.mjs';
import {createPurgeExecutor} from '../purge.mjs';
import {createRecoveryReconciler} from '../reconciliation.mjs';
import {subjectKey} from '../boundary.mjs';

async function fixture(kind='artifact'){
 const f=compose(),subject=subjectOf(kind),key=subjectKey(subject);
 const inventory=enumerateReferences(snapshot(subject));
 for(const object of inventory.objects)f.store.put(f.keyFor(object),object.versionId);
 const state=await f.suppression.suppress({principal:f.principal,subject,reason:'Synthetic Office disposal'});
 f.clock.advance(31*86400000);
 const plan=planFrom(f,subject,state,{inventory}),custody={fenced:false,active:1,retireCalls:0,mode:'ok'};
 const office={async retire(){custody.retireCalls++;
  if(custody.mode==='unavailable')throw Error('Core unavailable');
  custody.fenced=true;
  if(custody.mode==='partial')return {fenced:true,remaining:true};
  custody.active=0;
  if(custody.mode==='lost')throw Error('acknowledgement lost');
  return {fenced:true,remaining:false};},
  async verify(){if(custody.mode==='unavailable')throw Error('Core unavailable');return custody.fenced&&custody.active===0;}};
 const args={storage:f.storage,ledger:f.ledger,journal:f.journal,keyFor:f.keyFor,facts:f.facts,serving:f.serving,rows:f.rows,office,now:f.clock.now};
 return {...f,subject,key,plan,custody,office,executor:createPurgeExecutor({...args,enabled:true}),
  recovery:()=>createRecoveryReconciler(args).reconcile()};
}
test('zero local targets still require Core disposal before execution can complete',async()=>{
 const f=await fixture();assert.equal(f.plan.steps.length,0);assert.equal(f.plan.rowSteps.length,0);
 f.custody.mode='partial';
 const pending=await f.executor.execute(f.plan);assert.equal(pending.state,'UNKNOWN');assert.equal(pending.officeRetired,false);
 f.custody.mode='ok';const done=await f.executor.execute(f.plan);
 assert.equal(done.state,'EXECUTED');assert.equal(done.officeRetired,true);assert.equal(f.custody.retireCalls,2);
 assert.equal((await f.ledger.latest()).get(f.key).facts.officeRetired,true);
});
test('lost Core acknowledgement reconciles by current readback without a second retirement',async()=>{
 const f=await fixture();f.custody.mode='lost';
 await assert.rejects(f.executor.execute(f.plan),/acknowledgement lost/);
 assert.equal((await f.journal.get(f.key)).purge.state,'UNKNOWN');
 const result=await f.executor.execute(f.plan);
 assert.equal(result.state,'EXECUTED');assert.equal(result.officeRetired,true);assert.equal(f.custody.retireCalls,1);
});
test('an unreachable Core cannot complete cleanup even when no local rows remain',async()=>{
 const f=await fixture();f.custody.mode='unavailable';
 await assert.rejects(f.executor.execute(f.plan),/Core unavailable/);
 assert.equal((await f.journal.get(f.key)).purge.state,'UNKNOWN');
 const report=await f.recovery();assert.ok(report.unknown.includes(f.key));
 assert.equal((await f.journal.get(f.key)).purge.state,'UNKNOWN');
});
test('restored bytes or a lost disposal marker withdraw completed cleanup during recovery',async()=>{
 for(const restored of ['bytes','marker']){
  const f=await fixture();assert.equal((await f.executor.execute(f.plan)).state,'EXECUTED');
  if(restored==='bytes')f.custody.active=1;else f.custody.fenced=false;
  const report=await f.recovery();assert.ok(report.unknown.includes(f.key));
  assert.equal((await f.journal.get(f.key)).purge.officeRetired,false);
  assert.equal(f.custody.retireCalls,1,'recovery reads but never erases');
  const result=await f.executor.execute(f.plan);assert.equal(result.state,'EXECUTED');
  assert.equal(f.custody.retireCalls,2);
 }
});
test('Core disposal failure leaves conversation objects and row targets untouched',async()=>{
 const f=await fixture('conversation');f.custody.mode='unavailable';
 const before=f.rows.remaining(f.key);
 await assert.rejects(f.executor.execute(f.plan));
 assert.deepEqual(f.rows.remaining(f.key),before);
 for(const object of f.plan.steps)assert.equal(f.store.has(f.keyFor(object),object.versionId),true);
});
