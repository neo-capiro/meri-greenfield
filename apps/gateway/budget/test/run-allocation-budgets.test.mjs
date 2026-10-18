/** The read-only allocation-budget reader: one SELECT of the budget owner's own row in a READ ONLY transaction, parsed by the canonical
 * allocation() and checked against its own sha256, call count and run. Scripted pool; no database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {composeGeneralReadAllocation} from '../general-read-allocation.mjs';
import {GENERAL_READ_DEFAULT_RUN_BUDGETS} from '../general-read-manifest.mjs';
import {createRunAllocationBudgetReader} from '../run-allocation-budgets.mjs';
import {binding} from '../../../control/conversations/test/store-fixture.mjs';

const run={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId};
const general=composeGeneralReadAllocation({run,operations:[{id:'search_tracked_bills',version:'0.2.0'}],runBudgets:{...GENERAL_READ_DEFAULT_RUN_BUDGETS,maxToolCalls:40},
 catalogSha256:'c'.repeat(64),scheduleRevision:'d'.repeat(64),expiresAt:'2026-10-18T06:00:00.000Z'}).allocation;
function pool(rows){const queries=[];return {queries,async connect(){return {async query(sql,args=[]){queries.push({sql,args});
 if(sql.startsWith('SELECT allocation'))return {rows:structuredClone(rows)};return {rows:[]};},release(){}};}};}
const row=a=>({allocation:a,allocation_sha256:canonicalSha256(a),max_tool_calls:String(a.budgets.maxToolCalls)});
const code=expected=>error=>error.message===expected;

test('the run\'s admitted budgets come from one read-only SELECT of its own allocation row',async()=>{
 const p=pool([row(general)]),reader=createRunAllocationBudgetReader({pool:p});
 assert.deepEqual({...await reader.read({binding})},{maxToolCalls:40,maxOutputBytes:1048576,maxAggregateOutputBytes:2097152});
 assert.equal(p.queries[0].sql,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const select=p.queries.filter(q=>q.sql.startsWith('SELECT'));assert.equal(select.length,1);assert.match(select[0].sql,/FROM meri_product_budget\.tool_run_allocations WHERE run_id=\$1$/u);assert.deepEqual(select[0].args,[binding.runId]);
 assert.ok(p.queries.every(q=>!/FOR UPDATE|INSERT|UPDATE |DELETE/u.test(q.sql)),'no lock or write');
});

test('no installed allocation yet answers null',async()=>{assert.equal(await createRunAllocationBudgetReader({pool:pool([])}).read({binding}),null);});

test('a row that disagrees with its own sha256, call count or run is refused',async()=>{
 for(const bad of [{...row(general),allocation_sha256:'0'.repeat(64)},{...row(general),max_tool_calls:'41'},row({...general,run:{...general.run,runId:'99999999-9999-4999-8999-999999999999'}})]){
  await assert.rejects(createRunAllocationBudgetReader({pool:pool([bad])}).read({binding}),code('RUN_BUDGETS_REFUSED'));
 }
 await assert.rejects(createRunAllocationBudgetReader({pool:pool([row(general),row(general)])}).read({binding}),code('RUN_BUDGETS_REFUSED'));
});
