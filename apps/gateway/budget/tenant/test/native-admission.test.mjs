/** SYNTHETIC: native tenant composition over scripted SQL in an already-owned transaction. No database/driver. */
import test from 'node:test';import assert from 'node:assert/strict';
import {nativeTenantBudget} from '../native-admission.mjs';
const runId='11111111-1111-4111-8111-111111111111',NOW=Date.UTC(2026,9,16),binding={tenantId:'tenant',runId};
function fixture(){
 const state={policy:{tenant_id:'tenant',monthly_cap_micro_usd:'100',max_concurrent_runs:1},row:null,unresolved:1,consumed:0,schema:true,sql:[]};
 const client={async query(sql,p=[]){state.sql.push(sql);const rows=r=>({rows:r,rowCount:r.length});
  if(sql.includes('.tenant_budgets WHERE'))return rows(state.policy?[state.policy]:[]);
  if(sql.includes('to_regclass('))return rows([{reservations:state.schema?'meri_product_budget.tenant_run_reservations':null}]);
  if(sql.startsWith('SELECT count(*) FILTER'))return rows(sql.includes('budget_liabilities')?[{unresolved:String(state.unresolved),consumed:String(state.consumed)}]:[{active:state.row?.state==='HELD'?'1':'0',held:['HELD','RELEASED'].includes(state.row?.state)?state.row.hold_micro_usd:'0',settled:state.row?.state==='SETTLED'?String(state.row.settled_micro_usd):'0'}]);
  if(sql.includes('.tenant_run_reservations WHERE'))return rows(state.row?[state.row]:[]);
  if(sql.startsWith('INSERT')){state.row={tenant_id:p[0],run_id:p[1],month:p[2],hold_micro_usd:String(p[3]),settled_micro_usd:null,state:'HELD'};return rows([]);}
  if(sql.startsWith('UPDATE')){assert.equal(state.row.state,p[4]);Object.assign(state.row,{state:p[2],settled_micro_usd:p[3]});return {rows:[],rowCount:1};}
  assert.fail('Unexpected SQL '+sql);
 }};
 const owner=({hold=100,signal,check=()=>{}}={})=>nativeTenantBudget({client,binding,nowMs:NOW,allocation:{budgets:{maxCostMicroUSD:hold}},signal,check});
 return {state,owner};
}
test('tenant reservation joins the caller transaction without another BEGIN, COMMIT, pool or client ownership',async()=>{
 const f=fixture();await f.owner().admit();assert.equal(f.state.row.state,'HELD');assert.equal(f.state.row.hold_micro_usd,'100');
 assert.equal(f.state.sql.some(sql=>/^(BEGIN|COMMIT|ROLLBACK)/u.test(sql)),false);assert.match(f.state.sql[0],/tenant_budgets.*FOR UPDATE/u);
 await f.owner().admit();assert.equal(f.state.sql.filter(sql=>sql.startsWith('INSERT')).length,1);
});
test('cancellation/revocation releases concurrency but UNKNOWN retains full liability; late exact settlement replaces hold',async()=>{
 const f=fixture();await f.owner().admit();await f.owner().revoke();assert.equal(f.state.row.state,'RELEASED');assert.equal(f.state.row.hold_micro_usd,'100');assert.equal(f.state.row.settled_micro_usd,null);
 f.state.unresolved=0;f.state.consumed=30;await f.owner().revoke();assert.equal(f.state.row.state,'SETTLED');assert.equal(f.state.row.settled_micro_usd,30);
 await f.owner().revoke();assert.equal(f.state.row.settled_micro_usd,30);
 f.state.consumed=31;await assert.rejects(f.owner().revoke(),/TENANT_SETTLEMENT_CONFLICT/u);
});
test('missing tenant policy and exhausted monthly cap refuse before any reservation',async()=>{
 const a=fixture();a.state.policy=null;await assert.rejects(a.owner().admit(),/TENANT_BUDGET_UNCONFIGURED/u);assert.equal(a.state.row,null);
 const b=fixture();await assert.rejects(b.owner({hold:101}).admit(),/TENANT_BUDGET_EXCEEDED/u);assert.equal(b.state.row,null);
});
test('aborted admission cannot mutate the caller transaction',async()=>{
 const f=fixture(),controller=new AbortController();controller.abort();await assert.rejects(f.owner({signal:controller.signal}).admit(),/TENANT_BUDGET_CANCELLED/u);assert.equal(f.state.row,null);assert.deepEqual(f.state.sql,[]);
});
test('legacy absent schema or absent reservation does not block grant cleanup or assert settlement',async()=>{
 for(const schema of [false,true]){const f=fixture();f.state.schema=schema;await f.owner().revoke();assert.equal(f.state.row,null);assert.equal(f.state.sql.some(sql=>sql.startsWith('UPDATE')),false);}
});
