import test from 'node:test';
import assert from 'node:assert/strict';
import {tenantBudgetGate} from '../gate.mjs';
import {createMemoryTenantBudgetStore} from '../memory-store.mjs';
import {admitReservation,monthOf,settleTransition} from '../policy.mjs';
import {BudgetStateDenied} from '../../postgres-budget-store.mjs';

const NOW=Date.UTC(2026,9,15,12,0,0),run=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`,tenant='tenant-a';
function fixture({monthlyCapMicroUSD=1000,maxConcurrentRuns=2,policies}={}){
 let clock=NOW;const store=createMemoryTenantBudgetStore({policies:policies??[{tenantId:tenant,monthlyCapMicroUSD,maxConcurrentRuns}]});
 return {store,gate:tenantBudgetGate({store,now:()=>clock}),clock:value=>{clock=value;}};
}
const refused=(promise,code)=>assert.rejects(promise,error=>error instanceof BudgetStateDenied&&error.message===code);

test('monthly cap boundary: reaching the cap exactly is admitted, one micro-USD more is TENANT_BUDGET_EXCEEDED',async()=>{
 const f=fixture({monthlyCapMicroUSD:1000,maxConcurrentRuns:10});
 const first=await f.gate.admit({tenantId:tenant,runId:run(1),holdMicroUSD:600});assert.equal(first.state,'HELD');assert.equal(first.replayed,false);
 await refused(f.gate.admit({tenantId:tenant,runId:run(2),holdMicroUSD:401}),'TENANT_BUDGET_EXCEEDED');
 const second=await f.gate.admit({tenantId:tenant,runId:run(2),holdMicroUSD:400});assert.equal(second.month,'2026-10');
 assert.deepEqual(await f.gate.read({tenantId:tenant}),{tenantId:tenant,month:'2026-10',monthlyCapMicroUSD:1000,maxConcurrentRuns:10,activeRuns:2,heldMicroUSD:1000,settledMicroUSD:0,remainingMicroUSD:0});
 await refused(f.gate.admit({tenantId:tenant,runId:run(3),holdMicroUSD:1}),'TENANT_BUDGET_EXCEEDED');
 // Settled usage below the hold frees the difference; settled usage above the hold is charged in full.
 await f.gate.settle({tenantId:tenant,runId:run(1),measuredMicroUSD:100});await f.gate.settle({tenantId:tenant,runId:run(2),measuredMicroUSD:450});
 assert.equal((await f.gate.read({tenantId:tenant})).remainingMicroUSD,450);
 await refused(f.gate.admit({tenantId:tenant,runId:run(3),holdMicroUSD:451}),'TENANT_BUDGET_EXCEEDED');assert.equal((await f.gate.admit({tenantId:tenant,runId:run(3),holdMicroUSD:450})).state,'HELD');
});
test('a new calendar month starts a fresh cap while open holds still count against concurrency',async()=>{
 const f=fixture({monthlyCapMicroUSD:100,maxConcurrentRuns:2});
 await f.gate.admit({tenantId:tenant,runId:run(1),holdMicroUSD:100});await refused(f.gate.admit({tenantId:tenant,runId:run(2),holdMicroUSD:1}),'TENANT_BUDGET_EXCEEDED');
 f.clock(Date.UTC(2026,10,1));assert.equal(monthOf(Date.UTC(2026,10,1)),'2026-11');
 const next=await f.gate.admit({tenantId:tenant,runId:run(2),holdMicroUSD:100});assert.equal(next.month,'2026-11');
 await refused(f.gate.admit({tenantId:tenant,runId:run(3),holdMicroUSD:1}),'TENANT_CONCURRENCY_EXCEEDED');
 assert.equal((await f.gate.read({tenantId:tenant,month:'2026-10'})).heldMicroUSD,100);assert.equal((await f.gate.read({tenantId:tenant})).activeRuns,2);
});
test('concurrent reservations admit exactly the configured slots and refuse the rest atomically',async()=>{
 const f=fixture({monthlyCapMicroUSD:1000000,maxConcurrentRuns:3});
 const outcomes=await Promise.allSettled(Array.from({length:12},(_,n)=>f.gate.admit({tenantId:tenant,runId:run(n+1),holdMicroUSD:10})));
 assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,3);
 assert.ok(outcomes.filter(o=>o.status==='rejected').every(o=>o.reason instanceof BudgetStateDenied&&o.reason.message==='TENANT_CONCURRENCY_EXCEEDED'));
 assert.equal(f.store.rows().filter(r=>r.state==='HELD').length,3);
 // Concurrent cap races: with 25 remaining, two 20-holds cannot both be admitted.
 const g=fixture({monthlyCapMicroUSD:45,maxConcurrentRuns:10});await g.gate.admit({tenantId:tenant,runId:run(1),holdMicroUSD:20});
 const race=await Promise.allSettled([g.gate.admit({tenantId:tenant,runId:run(2),holdMicroUSD:20}),g.gate.admit({tenantId:tenant,runId:run(3),holdMicroUSD:20})]);
 assert.deepEqual(race.map(o=>o.status).sort(),['fulfilled','rejected']);assert.equal((await g.gate.read({tenantId:tenant})).heldMicroUSD,40);
});
test('exact replay of a held reservation is idempotent; a different hold or a terminal run conflicts',async()=>{
 const f=fixture();const first=await f.gate.admit({tenantId:tenant,runId:run(1),holdMicroUSD:10});
 const replay=await f.gate.admit({tenantId:tenant,runId:run(1),holdMicroUSD:10});assert.equal(replay.replayed,true);assert.equal((await f.gate.read({tenantId:tenant})).activeRuns,1);assert.equal(first.holdMicroUSD,replay.holdMicroUSD);
 await refused(f.gate.admit({tenantId:tenant,runId:run(1),holdMicroUSD:11}),'TENANT_RESERVATION_CONFLICT');
 await f.gate.release({tenantId:tenant,runId:run(1)});await refused(f.gate.admit({tenantId:tenant,runId:run(1),holdMicroUSD:10}),'TENANT_RESERVATION_CONFLICT');
});
test('release on failure frees the slot and the hold; release is idempotent and never undoes a settlement',async()=>{
 const f=fixture({monthlyCapMicroUSD:100,maxConcurrentRuns:1});
 await f.gate.admit({tenantId:tenant,runId:run(1),holdMicroUSD:100});
 await refused(f.gate.admit({tenantId:tenant,runId:run(2),holdMicroUSD:1}),'TENANT_CONCURRENCY_EXCEEDED');
 const released=await f.gate.release({tenantId:tenant,runId:run(1)});assert.equal(released.state,'RELEASED');assert.equal(released.settledMicroUSD,null);
 assert.deepEqual(await f.gate.release({tenantId:tenant,runId:run(1)}),released);
 assert.equal((await f.gate.read({tenantId:tenant})).remainingMicroUSD,100);assert.equal((await f.gate.admit({tenantId:tenant,runId:run(2),holdMicroUSD:100})).state,'HELD');
 const settled=await f.gate.settle({tenantId:tenant,runId:run(2),measuredMicroUSD:30});assert.equal((await f.gate.release({tenantId:tenant,runId:run(2)})).state,'SETTLED');assert.equal(settled.settledMicroUSD,30);
 await refused(f.gate.release({tenantId:tenant,runId:run(9)}),'TENANT_RESERVATION_UNKNOWN');
});
test('settle after cancel charges the measured usage to the reservation month; a conflicting second settlement refuses',async()=>{
 const f=fixture({monthlyCapMicroUSD:100,maxConcurrentRuns:1});
 await f.gate.admit({tenantId:tenant,runId:run(1),holdMicroUSD:60});await f.gate.release({tenantId:tenant,runId:run(1)});
 f.clock(Date.UTC(2026,10,2));
 const settled=await f.gate.settle({tenantId:tenant,runId:run(1),measuredMicroUSD:70});assert.equal(settled.state,'SETTLED');assert.equal(settled.month,'2026-10');
 assert.equal((await f.gate.read({tenantId:tenant,month:'2026-10'})).settledMicroUSD,70);assert.equal((await f.gate.read({tenantId:tenant,month:'2026-11'})).settledMicroUSD,0);
 assert.equal((await f.gate.settle({tenantId:tenant,runId:run(1),measuredMicroUSD:70})).state,'SETTLED');
 await refused(f.gate.settle({tenantId:tenant,runId:run(1),measuredMicroUSD:71}),'TENANT_SETTLEMENT_CONFLICT');
 await refused(f.gate.settle({tenantId:tenant,runId:run(5),measuredMicroUSD:1}),'TENANT_RESERVATION_UNKNOWN');
 assert.equal(settleTransition({tenantId:tenant,runId:run(1),month:'2026-10',holdMicroUSD:1,settledMicroUSD:null,state:'HELD'},0).settledMicroUSD,0);
});
test('unconfigured tenants, hostile inputs and unknown store receipts refuse without admitting a slot',async()=>{
 const f=fixture();
 await refused(f.gate.admit({tenantId:'tenant-b',runId:run(1),holdMicroUSD:1}),'TENANT_BUDGET_UNCONFIGURED');
 for(const input of [{tenantId:'',runId:run(1),holdMicroUSD:1},{tenantId:tenant,runId:'run-1',holdMicroUSD:1},{tenantId:tenant,runId:run(1),holdMicroUSD:0},{tenantId:tenant,runId:run(1),holdMicroUSD:1.5},{tenantId:tenant,runId:run(1),holdMicroUSD:'1'}])await refused(f.gate.admit(input),'TENANT_BUDGET_INPUT');
 await assert.rejects(f.gate.admit({tenantId:tenant,runId:run(1),holdMicroUSD:1,extra:true}));
 assert.throws(()=>admitReservation({policy:{tenantId:tenant,monthlyCapMicroUSD:10,maxConcurrentRuns:1},activeRuns:0,heldMicroUSD:0,settledMicroUSD:0},{holdMicroUSD:11}),/TENANT_BUDGET_EXCEEDED/u);
 assert.throws(()=>admitReservation({policy:{tenantId:tenant,monthlyCapMicroUSD:10,maxConcurrentRuns:1},activeRuns:1,heldMicroUSD:0,settledMicroUSD:0},{holdMicroUSD:1}),/TENANT_CONCURRENCY_EXCEEDED/u);
 assert.throws(()=>createMemoryTenantBudgetStore({policies:[{tenantId:tenant,monthlyCapMicroUSD:1,maxConcurrentRuns:1},{tenantId:tenant,monthlyCapMicroUSD:2,maxConcurrentRuns:1}]}),/TENANT_BUDGET_CONFIGURATION/u);
 const lying={async readTenantBudget(){},async reserve(){return {tenantId:'tenant-b',runId:run(1),month:'2026-10',holdMicroUSD:1,settledMicroUSD:null,state:'HELD'};},async release(){},async settle(){}};
 await refused(tenantBudgetGate({store:lying,now:()=>NOW}).admit({tenantId:tenant,runId:run(1),holdMicroUSD:1}),'TENANT_BUDGET_STATE');
 assert.throws(()=>tenantBudgetGate({store:{reserve(){}}}),/TENANT_BUDGET_CONFIGURATION/u);assert.equal(f.store.rows().length,0);
});
test('the caller signal reaches the memory store: a live signal is accepted and an aborted one refuses before any slot is taken',async()=>{
 const f=fixture({maxConcurrentRuns:1}),live=new AbortController(),dead=new AbortController();dead.abort();
 await refused(f.gate.admit({tenantId:tenant,runId:run(1),holdMicroUSD:10,signal:dead.signal}),'TENANT_BUDGET_CANCELLED');assert.equal(f.store.rows().length,0);
 assert.equal((await f.gate.admit({tenantId:tenant,runId:run(1),holdMicroUSD:10,signal:live.signal})).state,'HELD');
 assert.equal((await f.gate.read({tenantId:tenant,signal:live.signal})).activeRuns,1);
 await refused(f.gate.release({tenantId:tenant,runId:run(1),signal:dead.signal}),'TENANT_BUDGET_CANCELLED');
 assert.equal((await f.gate.settle({tenantId:tenant,runId:run(1),measuredMicroUSD:7,signal:live.signal})).state,'SETTLED');
});
