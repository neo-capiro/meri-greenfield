import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {allocation} from '../tool-budget-binding.mjs';
import {assertOccurrenceCostScope,readOccurrenceCost} from '../occurrence-cost-scope.mjs';
import {BudgetCommitUncertain} from '../postgres-budget-store.mjs';
import {budgetTables} from '../namespace.mjs';
import {occurrenceCostFixture,id,NOW} from './occurrence-cost-scope-fixture.mjs';
const clone=v=>structuredClone(v),scopeQueries=f=>f.queries.filter(q=>q.sql.startsWith('SELECT run_id,allocation,allocation_sha256'));
const total=s=>[...s.requests.values()].reduce((n,r)=>n+BigInt(r.state==='UNKNOWN'?r.hold_micro_usd:r.actual_micro_usd),0n)+[...s.tools.values()].reduce((n,r)=>n+BigInt(r.state==='UNKNOWN'?r.hold_micro_usd:r.charged_micro_usd),0n);

test('private scope validation preserves the exact manifest and canonical allocation hash',async()=>{
 const f=occurrenceCostFixture(),one=await f.attempt(1),parsed=allocation(one.config.allocationJson);
 assert.deepEqual(parsed.occurrenceCostScope,f.scope);assert.deepEqual(parsed.manifest.budgets,parsed.budgets);
 assert.equal(parsed.manifestSha256,hash(parsed.manifest));assert.equal(Object.isFrozen(parsed.occurrenceCostScope.originBinding),true);
 const original=parsed.manifest;assert.deepEqual(allocation(JSON.stringify({...one.a,occurrenceCostScope:undefined})).manifest,original);
});
for(const [name,edit]of [
 ['version',s=>s.version=2],['kind',s=>s.kind='run'],['key',s=>s.occurrenceKey='x'.repeat(64)],['origin fence',s=>s.originBinding.writerFence=2],
 ['tenant',s=>s.originBinding.tenantId='foreign'],['actor',s=>s.originBinding.actorId='foreign'],['conversation',s=>s.originBinding.conversationId=id(99)],
 ['cap zero',s=>s.maxCostMicroUSD=0],['cap fraction',s=>s.maxCostMicroUSD=1.5],['cap overflow',s=>s.maxCostMicroUSD=Number.MAX_SAFE_INTEGER+1],
 ['extra',s=>s.pendingApproval=true],['origin extra',s=>s.originBinding.scheduleId=id(99)]
])test(`private scope rejects ${name} before SQL`,async()=>{
 const f=occurrenceCostFixture(),scope=clone(f.scope);edit(scope);
 assert.throws(()=>assertOccurrenceCostScope(scope,{tenantId:'tenant-a',actorId:'actor-a',conversationId:id(1),runId:id(101)}));
 await assert.rejects(f.attempt(1,{costScope:scope}));assert.equal(f.queries.length,0);
});
test('scope rejects accessors, proxies and custom prototypes without evaluating them',()=>{
 const f=occurrenceCostFixture(),run={tenantId:'tenant-a',actorId:'actor-a',conversationId:id(1),runId:id(101)};
 const getter={...f.scope};Object.defineProperty(getter,'maxCostMicroUSD',{enumerable:true,get(){assert.fail('accessor evaluated');}});
 for(const s of [getter,new Proxy(f.scope,{}),Object.assign(Object.create({custom:true}),f.scope)])assert.throws(()=>assertOccurrenceCostScope(s,run));
 const hostile={...run};Object.defineProperty(hostile,'tenantId',{enumerable:true,get(){assert.fail('target accessor evaluated');}});
 assert.throws(()=>assertOccurrenceCostScope(f.scope,hostile));
});

test('two distinct actual native allocations retain one occurrence cap across settled tools and model holds',async()=>{
 const f=occurrenceCostFixture(),one=await f.attempt(1),two=await f.attempt(2);
 assert.equal(f.state().allocations.size,2);const tool=await one.tool('first');await tool.owner.settle({reservationId:tool.reservationId,outcome:'completed',outputBytes:1});
 await two.model.reserve(two.request('model_second'));assert.equal(total(f.state()),44n);
 await assert.rejects(one.tool('third'),/BUDGET_EXHAUSTED/);assert.equal(f.state().tools.size,1);assert.equal(f.state().requests.size,1);
 assert.equal(f.state().budget.consumed_micro_usd,'20');assert.equal([...f.state().requests.values()][0].state,'UNKNOWN');
 assert.ok(scopeQueries(f).every(q=>q.params[0]==='tenant-a'&&q.params[1]===f.scope.occurrenceKey));
 assert.ok(f.queries.some(q=>q.sql.includes('run_id=ANY')&&q.params[0].includes(one.binding.runId)&&q.params[0].includes(two.binding.runId)));
});

test('a smaller approved cap than the immutable manifest is enforced for both kinds of request',async()=>{
 const f=occurrenceCostFixture();f.scope.maxCostMicroUSD=19;const one=await f.attempt(1);
 assert.equal(one.a.budgets.maxCostMicroUSD,1000);
 await assert.rejects(one.tool('too_large'),/BUDGET_EXHAUSTED/);await assert.rejects(one.model.reserve(one.request('too_large')),/PRODUCT_MODEL_BUDGET_EXHAUSTED/);
 assert.equal(f.state().tools.size,0);assert.equal(f.state().requests.size,0);
});
test('exact occurrence cap is admitted and the next micro-USD is not available',async()=>{
 const f=occurrenceCostFixture();f.scope.maxCostMicroUSD=44;const one=await f.attempt(1),two=await f.attempt(2);
 await one.tool('first');await two.model.reserve(two.request('exact'));assert.equal(total(f.state()),44n);
 await assert.rejects(two.tool('over'),/BUDGET_EXHAUSTED/);assert.equal(total(f.state()),44n);
});
test('UNKNOWN holds survive grant revocation and prevent a later attempt from resetting the cap',async()=>{
 const f=occurrenceCostFixture();f.scope.maxCostMicroUSD=40;const one=await f.attempt(1);await one.model.reserve(one.request('uncertain'));
 await one.native.revoke({taskArn:one.taskArn});const two=await f.attempt(2);
 await assert.rejects(two.tool('no_refund'),/BUDGET_EXHAUSTED/);await assert.rejects(two.model.reserve(two.request('retry')),/PRODUCT_MODEL_BUDGET_EXHAUSTED/);
 assert.equal(f.state().requests.get('uncertain').state,'UNKNOWN');assert.equal(total(f.state()),24n);
 assert.equal(f.state().tenantReservations.get(`tenant-a:${one.binding.runId}`).state,'RELEASED');
});
test('same-run attempt/worker rebinding cannot create another installed budget allocation',async()=>{
 const f=occurrenceCostFixture(),one=await f.attempt(1),before=clone(f.state());
 const changed={...one.config,binding:{...one.binding,attemptId:id(900),workerId:id(901)}};
 const {createNativeAllocationAdmission}=await import('../native-allocation-admission.mjs');
 await assert.rejects(createNativeAllocationAdmission(changed).admit({taskArn:one.taskArn}));assert.deepEqual(f.state(),before);
});

for(const [name,edit]of [['cap',s=>s.maxCostMicroUSD=60],['origin',s=>s.originBinding.runId=id(999)]])test(`same tenant/key with a conflicting ${name} rolls back the whole new native admission`,async()=>{
 const f=occurrenceCostFixture();await f.attempt(1);const scope=clone(f.scope);edit(scope);const before=clone(f.state());
 await assert.rejects(f.attempt(2,{costScope:scope}),/OCCURRENCE_COST_CONFLICT/);assert.deepEqual(f.state(),before);
 assert.equal(f.state().allocations.size,1);assert.equal(f.state().grants.size,2);assert.equal(f.state().tenantReservations.size,1);
});
test('sibling allocation corruption fails closed, while canonical retirement remains available',async()=>{
 const f=occurrenceCostFixture(),one=await f.attempt(1),two=await f.attempt(2);
 f.state().allocations.get(one.binding.runId).allocation_sha256='f'.repeat(64);
 await assert.rejects(two.tool('corrupt_sibling'),/OCCURRENCE_COST_CONFLICT/);await assert.rejects(two.model.reserve(two.request('corrupt_sibling')),/OCCURRENCE_COST_CONFLICT/);
 assert.equal(f.state().tools.size,0);assert.equal(f.state().requests.size,0);
 assert.equal((await two.native.revoke({taskArn:two.taskArn})).revocationProven,true);
});

test('different occurrences and different tenants do not borrow each other’s cap',async()=>{
 const f=occurrenceCostFixture();f.scope.maxCostMicroUSD=24;const one=await f.attempt(1);await one.model.reserve(one.request('origin'));
 const secondScope={...clone(f.scope),occurrenceKey:'f'.repeat(64),originBinding:{...f.originBinding,conversationId:id(2),runId:id(102),attemptId:id(202),workerId:id(302)}};
 const two=await f.attempt(2,{costScope:secondScope,conversationId:id(2)});await two.model.reserve(two.request('different_occurrence'));
 const foreign={tenantId:'tenant-b',actorId:'actor-b'},foreignScope={...clone(f.scope),originBinding:{...f.originBinding,...foreign,runId:id(103),attemptId:id(203),workerId:id(303)}};
 const three=await f.attempt(3,{costScope:foreignScope,principal:foreign});await three.model.reserve(three.request('different_tenant'));
 assert.equal(total(f.state()),72n);assert.equal(f.state().requests.size,3);
});
test('same-tenant collision with another actor/conversation is a conflict, not an independent spend pool',async()=>{
 const f=occurrenceCostFixture();await f.attempt(1);const scope={...clone(f.scope),originBinding:{...f.originBinding,actorId:'actor-b',conversationId:id(2),runId:id(102)}};
 await assert.rejects(f.attempt(2,{costScope:scope,principal:{tenantId:'tenant-a',actorId:'actor-b'},conversationId:id(2)}),/OCCURRENCE_COST_CONFLICT/);
});

for(const pair of ['model-model','tool-model'])test(`concurrent ${pair} admission shares the actual global lock and cannot both spend a fresh cap`,async()=>{
 const f=occurrenceCostFixture();f.scope.maxCostMicroUSD=40;const one=await f.attempt(1),two=await f.attempt(2);
 const results=await Promise.allSettled([pair==='model-model'?one.model.reserve(one.request('concurrent_a')):one.tool('concurrent_a'),two.model.reserve(two.request('concurrent_b'))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 assert.ok(total(f.state())<=40n);assert.equal(f.state().tools.size+f.state().requests.size,1);
});

test('historical real model settlement counts the whole occurrence, retains other UNKNOWN holds and does not refund/retry',async()=>{
 const f=occurrenceCostFixture(),one=await f.attempt(1),two=await f.attempt(2);await one.tool('held');await two.model.reserve(two.request('settle'));
 await two.native.revoke({taskArn:two.taskArn});f.advance(70000);
 const settled=await two.settlement.settle({requestId:'settle'});assert.deepEqual(settled,{requestId:'settle',state:'SETTLED',actualMicroUSD:'20',quarantined:false});
 assert.equal([...f.state().tools.values()][0].state,'UNKNOWN');assert.equal(total(f.state()),40n);assert.equal(f.state().budget.consumed_micro_usd,'20');
 assert.deepEqual(await two.settlement.readOutcome({requestId:'settle'}),{requestId:'settle',state:'SETTLED',actualMicroUSD:'20'});
 assert.equal((await two.settlement.settle({requestId:'settle'})).actualMicroUSD,'20');assert.equal(f.state().budget.consumed_micro_usd,'20');
 const scopeRead=f.queries.find(q=>q.sql.includes('run_id=ANY')&&q.params[1]==='model'&&q.params[2]==='settle');assert.deepEqual(new Set(scopeRead.params[0]),new Set([one.binding.runId,two.binding.runId]));
});

test('model settlement quarantines a whole-occurrence overrun even when the settling run itself fits its manifest',async()=>{
 const f=occurrenceCostFixture(),one=await f.attempt(1),two=await f.attempt(2);await one.tool('historical');await two.model.reserve(two.request('settle'));
 // A historical ledger anomaly is intentionally seeded at the SQL boundary. The trusted observed completion is within its own
 // hold and per-run cap; settlement must still quarantine the combined occurrence instead of losing the other attempt's cost.
 const historical=[...f.state().tools.values()][0];Object.assign(historical,{state:'SETTLED',hold_micro_usd:'40',charged_micro_usd:'40',output_bytes:'1',settled_at:new Date(NOW)});f.state().budget.consumed_micro_usd='40';
 const result=await two.settlement.settle({requestId:'settle'});assert.equal(result.actualMicroUSD,'20');assert.equal(result.quarantined,true);
 assert.equal(f.state().budget.consumed_micro_usd,'60');assert.equal(f.state().requests.get('settle').state,'SETTLED');
 await assert.rejects(one.tool('after_quarantine'));assert.equal(f.state().tools.size,1);
});

for(const fault of ['commit','release'])test(`lost ${fault} acknowledgement retains UNKNOWN liabilities without a new spend window`,async()=>{
 const f=occurrenceCostFixture();f.scope.maxCostMicroUSD=40;const one=await f.attempt(1),two=await f.attempt(2);f.faults[fault]=true;
 await assert.rejects(one.model.reserve(one.request('uncertain')),BudgetCommitUncertain);assert.equal(f.state().requests.get('uncertain').state,'UNKNOWN');
 await assert.rejects(two.tool('next_attempt'),/BUDGET_EXHAUSTED/);assert.equal(total(f.state()),24n);assert.ok(f.releases.length>0);
});
test('scoped SQL failure or cancellation cannot insert a tool/model hold or release a receipt',async()=>{
 for(const mode of ['failure','cancel']){
  const f=occurrenceCostFixture(),one=await f.attempt(1),controller=new AbortController();
  f.faults.query=sql=>{if(sql.startsWith('SELECT run_id,allocation,allocation_sha256')){if(mode==='failure')throw Error('private SQL failure');controller.abort();}};
  await assert.rejects(one.model.reserve({...one.request('failed'),signal:controller.signal}));assert.equal(f.state().requests.size,0);
 }
});
test('native scope checks do not activate a new group already over its approved cap',async()=>{
 const f=occurrenceCostFixture(),one=await f.attempt(1);await one.tool('historical');
 const row=[...f.state().tools.values()][0];row.hold_micro_usd='51';const before=clone(f.state());
 await assert.rejects(f.attempt(2),/NATIVE_ADMISSION_REFUSED/);assert.deepEqual(f.state(),before);
});
test('legacy allocations without a scope retain independent per-run caps and issue no scope SQL',async()=>{
 const f=occurrenceCostFixture(),one=await f.attempt(1,{costScope:null}),two=await f.attempt(2,{costScope:null});
 await one.tool('legacy_tool');await two.model.reserve(two.request('legacy_model'));await two.tool('legacy_more');assert.equal(total(f.state()),64n);
 assert.equal(scopeQueries(f).length,0);assert.equal(await readOccurrenceCost({allocation:one.a}),null);
 assert.equal((await two.settlement.settle({requestId:'legacy_model'})).quarantined,false);assert.equal(scopeQueries(f).length,0);
});
test('helper admits only canonical fixed table identities and never substitutes absence for corrupt group evidence',async()=>{
 const f=occurrenceCostFixture(),one=await f.attempt(1);
 await assert.rejects(readOccurrenceCost({client:{query(){assert.fail('no SQL');}},tables:{...budgetTables('product')},allocation:one.a,parseAllocation:allocation}),/OCCURRENCE_COST_CONFIGURATION/);
 for(const rows of [[],null,[{run_id:'malformed'}]])await assert.rejects(readOccurrenceCost({client:{async query(){return {rows};}},tables:budgetTables('product'),allocation:one.a,parseAllocation:allocation}));
});
test('duplicate, omitted current and corrupted installed group rows fail before liability totals are trusted',async()=>{
 const f=occurrenceCostFixture(),one=await f.attempt(1),two=await f.attempt(2);
 const row=runId=>{const {run_id,allocation,allocation_sha256,max_tool_calls,max_cost_micro_usd}=f.state().allocations.get(runId);return clone({run_id,allocation,allocation_sha256,max_tool_calls,max_cost_micro_usd});};
 const original=row(one.binding.runId),sibling=row(two.binding.runId),badHash={...sibling,allocation_sha256:'0'.repeat(64)},badLimit={...sibling,max_cost_micro_usd:'1'};
 for(const rows of [[original,original],[sibling],[original,badHash],[original,badLimit]]){
  let calls=0;await assert.rejects(readOccurrenceCost({client:{async query(){calls++;return {rows};}},tables:budgetTables('product'),allocation:one.a,parseAllocation:allocation}));
  assert.equal(calls,1,'bad group metadata cannot reach an accounting total');
 }
});
test('scope totals use exact bigint money and refuse malformed database sums',async()=>{
 const f=occurrenceCostFixture(),one=await f.attempt(1),installed=f.state().allocations.get(one.binding.runId);
 const {run_id,allocation:stored,allocation_sha256,max_tool_calls,max_cost_micro_usd}=installed,row={run_id,allocation:stored,allocation_sha256,max_tool_calls,max_cost_micro_usd};
 const read=total=>readOccurrenceCost({client:{async query(sql){return {rows:sql.startsWith('SELECT run_id')?[row]:[{total}]};}},tables:budgetTables('product'),allocation:one.a,parseAllocation:allocation});
 assert.deepEqual(await read('9007199254740993'),{totalMicroUSD:9007199254740993n,maxCostMicroUSD:50n});
 for(const value of ['01','-1','1.5',null,Number.MAX_SAFE_INTEGER+1])await assert.rejects(read(value),/OCCURRENCE_COST_STATE/);
});
