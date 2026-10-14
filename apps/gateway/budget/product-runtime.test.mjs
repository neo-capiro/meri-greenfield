import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {productFixture,NOW} from './product-scripted-fixture.mjs';
import {createPostgresToolBudget} from './postgres-tool-budget.mjs';
import {createDurableToolDispatch} from './durable-tool-dispatch.mjs';
import {createPostgresAdmittedRunOwner} from './admitted-run-owner.mjs';
import {PostgresBudgetStore,BudgetCommitUncertain} from './postgres-budget-store.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {operation,requestJson,limits} from '../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';
async function setup(){
 const t=productFixture(),configuration={pool:t.pool,allocationJson:JSON.stringify(t.allocation),namespace:'product',now:t.now};
 const budget=createPostgresToolBudget(configuration);await budget.bindTrustedGrant(t.json());
 const admitted=createPostgresAdmittedRunOwner({...configuration,grantFactsJsons:[JSON.stringify(t.context())],limits:{maxRequestMs:1000,maxFactBytes:65536}});
 const gateway=createDurableToolDispatch({...configuration,authority:t.f.authority,catalog:{entry:()=>t.f.entry,discoverable:()=>[t.f.entry]},limits,sourceEnabled:true,newId:randomUUID});
 return{...t,budget,admitted,gateway};
}
test('explicit product namespace runs canonical bind/reserve/settle/completion with one ledger',async()=>{
 const t=await setup(),body=await t.gateway.executeOwned(requestJson,t.credential,t.delivery());
 const marker=await t.budget.readCompletion(t.delivery(),requestJson,{});
 assert.equal(marker.stage,'SETTLED');assert.equal(marker.resultSha256,canonicalSha256(JSON.parse(body)));assert.equal(marker.outputBytes,Buffer.byteLength(body));assert.deepEqual(marker.binding,t.f.binding);assert.equal(marker.allocationSha256,canonicalSha256(t.allocation));assert.equal(marker.rawRequestSha256,canonicalSha256(JSON.parse(requestJson)));assert.equal(marker.argumentsSha256,canonicalSha256({page:1,limit:10}));
 assert.equal(t.state().budget.consumed_micro_usd,'10');assert.equal(t.state().reservations.size,1);assert.equal(t.state().produced.size,1);assert.equal(t.commands.some(c=>c.sql.includes('meri_qualification.')),false);
 await assert.rejects(t.gateway.executeOwned(requestJson,t.credential,t.delivery()));assert.equal(t.state().reservations.size,1);
});
test('atomic leased callback sees immutable exact allocation and closed SQL port after commit',async()=>{
 const t=await setup();let borrowed;
 const result=await t.admitted.withCurrentAllocation({binding:t.f.binding},async({client,current})=>{borrowed=client;assert.equal(Object.isFrozen(current.allocation),true);assert.equal(current.allocationSha256,canonicalSha256(t.allocation));return(await client.query('SELECT synthetic_effect')).rows[0].value;});
 assert.equal(result,'owned SQL result');await assert.rejects(borrowed.query('SELECT synthetic_effect'),/ADMITTED_EFFECT_CLOSED/);
 const locks=t.commands.filter(c=>c.sql.endsWith('FOR UPDATE')).map(c=>c.sql);assert.ok(locks.some(s=>s.includes('.runs')));assert.ok(locks.some(s=>s.includes('.grants')));assert.ok(locks.some(s=>s.includes('.tool_grant_bindings')));
 assert.deepEqual(Object.keys(t.admitted),['currentRun','currentTaskRun','currentAllocation','withCurrentAllocation']);assert.deepEqual(Object.keys(JSON.parse(await t.admitted.currentRun(t.f.binding,{}))),['binding','policyRevision','deadlineMs','checkedAtMs']);
});
for(const [kind,sql,args] of [['grant','UPDATE meri_product_budget.grants SET state=$1 WHERE grant_id=$2',['REVOKED']],['fence','UPDATE meri_product_budget.runs SET fence=$1 WHERE run_id=$2',[2]]])test(`changed ${kind} during compiled effect refuses result and rolls back under same lease`,async()=>{
 const t=await setup();await assert.rejects(t.admitted.withCurrentAllocation({binding:t.f.binding},async({client})=>{await client.query(sql,[...args,kind==='grant'?t.invocation.grantId:t.f.binding.runId]);return'private result';}),/ADMITTED_RUN_REFUSED/);
 assert.equal(t.state().grant.state,'ACTIVE');assert.equal(t.state().run.fence,1);assert.ok(t.commands.some(c=>c.sql==='ROLLBACK'));
});
test('immutable allocation deadline cannot be refreshed by a later current call',async()=>{
 const t=await setup();t.setClock(NOW+9000);const first=JSON.parse(await t.admitted.currentAllocation(t.f.binding,{}));assert.equal(first.deadlineMs,NOW+10000);
 await assert.rejects(t.admitted.withCurrentAllocation({binding:t.f.binding},async()=>{t.setClock(NOW+10001);return'expired';}));
 await assert.rejects(t.admitted.currentAllocation(t.f.binding,{}));
});
test('lost leased COMMIT acknowledgement releases no result and does not retry effect',async()=>{
 const t=await setup();let effects=0;t.loseCommit();await assert.rejects(t.admitted.withCurrentAllocation({binding:t.f.binding},async()=>{effects++;return'unconfirmed';}),BudgetCommitUncertain);assert.equal(effects,1);assert.ok(t.releases.at(-1));
});
test('serialized effects share budget lock and second callback cannot overtake first',async()=>{
 const t=await setup(),gate=Promise.withResolvers(),entered=Promise.withResolvers();let second=false;
 const a=t.admitted.withCurrentAllocation({binding:t.f.binding},async()=>{entered.resolve();await gate.promise;return'a';});await entered.promise;
 const b=t.admitted.withCurrentAllocation({binding:t.f.binding},async()=>{second=true;return'b';});await new Promise(r=>setImmediate(r));assert.equal(second,false);gate.resolve();assert.deepEqual(await Promise.all([a,b]),['a','b']);
});
test('hostile binding/input and noncompiled callback refuse before SQL effects',async()=>{
 const t=await setup();t.commands.length=0;let touched=0;await assert.rejects(t.admitted.withCurrentAllocation({get binding(){touched++;return t.f.binding;}},async()=>{}));assert.equal(touched,0);await assert.rejects(t.admitted.withCurrentAllocation({binding:t.f.binding},{}));assert.equal(t.commands.length,0);
 const controller=new AbortController();controller.abort();await assert.rejects(t.admitted.withCurrentAllocation({binding:t.f.binding,signal:controller.signal},async()=>{throw Error('must not run');}));assert.equal(t.commands.length,0);
});
test('only two fixed server namespace choices are accepted before connection',()=>{
 let effects=0;for(const namespace of ['meri_product_budget','product;DROP SCHEMA','other',null])assert.throws(()=>new PostgresBudgetStore({connect(){effects++;}},{namespace}));assert.equal(effects,0);assert.equal(new PostgresBudgetStore({connect(){} }).tables.budget,'meri_qualification.budget');
});
for(const kind of ['revoked','fence','quarantine','unprepared','unknown'])test(`readCompletion refuses ${kind} without preparation, reconciliation or redispatch`,async()=>{
 const t=await setup();if(kind==='unknown')await t.gateway.prepareInvocation(t.delivery(),requestJson);else if(kind!=='unprepared')await t.gateway.executeOwned(requestJson,t.credential,t.delivery());
 if(kind==='revoked')t.state().grant.state='REVOKED';if(kind==='fence')t.state().run.fence=2;if(kind==='quarantine')t.state().budget.quarantined=true;
 const before={used:t.state().produced.size,reserved:t.state().reservations.size,charge:t.state().budget.consumed_micro_usd};
 await assert.rejects(t.budget.readCompletion(t.delivery(),requestJson,{}));assert.deepEqual({used:t.state().produced.size,reserved:t.state().reservations.size,charge:t.state().budget.consumed_micro_usd},before);
});
test('readCompletion wrong delivery/raw request and lost read COMMIT never yield marker',async()=>{
 const t=await setup();await t.gateway.executeOwned(requestJson,t.credential,t.delivery());await assert.rejects(t.budget.readCompletion(t.delivery('other'),requestJson,{}));await assert.rejects(t.budget.readCompletion(t.delivery(),JSON.stringify({operation,arguments:{page:2,limit:10}}),{}));t.loseCommit();await assert.rejects(t.budget.readCompletion(t.delivery(),requestJson,{}),BudgetCommitUncertain);
});
test('product migration is empty canonical structure, no seed/role/grant or fixed allowance',async()=>{
 const sql=await readFile(new URL('./migrations/0001_product_budget.sql',import.meta.url),'utf8');assert.match(sql,/CREATE SCHEMA meri_product_budget;/);assert.match(sql,/CREATE VIEW meri_product_budget.budget_liabilities/);assert.doesNotMatch(sql,/\b(?:INSERT|DROP|TRUNCATE|GRANT|CREATE ROLE|ALTER ROLE)\b/);assert.doesNotMatch(sql,/10000000|meri_qualification|IF NOT EXISTS/);assert.match(sql,/cap_micro_usd>0/);
});
