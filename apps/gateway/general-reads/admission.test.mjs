/** Retained-read admission controls: synthetic native receipts, fake HTTPS and scripted SQL; no native/DB qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {retainedCase} from './test/retained-cases.mjs';
import {durableFamilyFixture} from './test/durable-fixture.mjs';
const IDS=['get_research_portfolio','get_research_portfolio_changes','get_florida_budget_project'];
const unavailable=e=>e.message==='UNAVAILABLE';
for(const id of IDS){
 test(`synthetic ${id}: native receipt requires exact binding, scope, descriptor and measured handler`,async()=>{
  const mutations=[r=>{r.binding={...r.binding,writerFence:2};},r=>{r.scopes=[];},r=>{r.policyRevision='c'.repeat(64);},
   r=>{r.operations[0].qualificationReceiptId='not-a-native-receipt';},r=>{r.operations[0].descriptorSha256='0'.repeat(64);},
   r=>{r.operations[0].handlerSourceSha256='0'.repeat(64);},r=>{r.operations.push(structuredClone(r.operations[0]));},
   r=>{r.baseCatalogSha256='0'.repeat(64);},r=>{r.operations=[];}];
  for(const mutate of mutations){const f=await durableFamilyFixture(retainedCase(id));f.state.installationMutator=mutate;
   const before=f.state.connections;await assert.rejects(f.execute(),unavailable);
   assert.equal(f.wire.length,0);assert.equal(f.state.produced.size,0);assert.equal(f.state.connections,before);}
 });
 test(`synthetic ${id}: native execution digest and expiry cannot be substituted`,async()=>{
  const f=await durableFamilyFixture(retainedCase(id));f.state.executionDigestMutator=r=>{r.executionCatalogSha256='0'.repeat(64);};
  await assert.rejects(f.execute(),unavailable);assert.equal(f.wire.length,0);
  const stale=await durableFamilyFixture(retainedCase(id));stale.state.installationMutator=r=>{r.expiresAtMs=stale.now();};
  await assert.rejects(stale.execute(),unavailable);assert.equal(stale.state.produced.size,0);
 });
 test(`synthetic ${id}: native receipt scope change after source withholds release`,async()=>{
  const f=await durableFamilyFixture(retainedCase(id));
  f.state.afterSource=()=>{f.state.installationMutator=r=>{r.binding={...r.binding,writerFence:2};};};
  await assert.rejects(f.execute(),unavailable);assert.equal(f.wire.length,1);
  assert.equal([...f.state.reservations.values()][0].state,'SETTLED','withholding never refunds a completed effect');
 });
 test(`synthetic ${id}: allocation and installed operation must both admit the requested read`,async()=>{
  const f=await durableFamilyFixture(retainedCase(id));const other={id:IDS.find(x=>x!==id),version:'0.2.0'};
  await assert.rejects(f.mount().execute({operation:other,arguments:{},deliveryId:'outside-allocation'}),unavailable);
  assert.equal(f.wire.length,0);assert.equal(f.state.produced.size,0);
  const valid=JSON.parse(await f.execute());assert.deepEqual(valid.binding,f.binding);assert.equal(f.state.budget.consumed_micro_usd,1);
 });
}
test('ordinary no-skill allocation cannot be fabricated from catalog or native membership facts',async()=>{
 const f=await durableFamilyFixture(retainedCase(IDS[0])),allocation=JSON.parse(f.allocationJson),before=f.state.connections;
 const ordinary={run:allocation.run,allowedOperations:[f.operation],budgets:allocation.budgets,catalogSha256:allocation.catalogSha256,schedule:allocation.schedule};
 assert.throws(()=>f.mount({allocationJson:JSON.stringify(ordinary)}));
 const membership={tenantId:f.binding.tenantId,actorId:f.binding.actorId,status:'active',role:'admin',permissions:[],clientIds:[],
  membershipRevision:'synthetic-membership',checkedAtMs:f.now(),expiresAtMs:f.deadlineMs};
 await assert.rejects(f.mount({installationOwner:{handlers:f.installationOwner.handlers,async readCurrent(){return membership;}}}).readAvailability(),unavailable);
 assert.equal(f.state.connections,before);assert.equal(f.state.produced.size,0);assert.equal(f.wire.length,0);
});
test('a changed allocation digest cannot reuse the existing admitted durable grant',async()=>{
 const f=await durableFamilyFixture(retainedCase(IDS[0])),allocation=JSON.parse(f.allocationJson);
 allocation.schedule.revision='e'.repeat(64);
 const grant={...f.grant,allocationSha256:canonicalSha256(allocation)};
 await assert.rejects(f.mount({allocationJson:JSON.stringify(allocation),producerContext:grant}).execute({operation:f.operation,arguments:{},deliveryId:'other-allocation'}));
 assert.equal(f.wire.length,0);assert.equal(f.state.budget.consumed_micro_usd,0);
});
