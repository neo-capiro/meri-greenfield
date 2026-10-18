/** Scripted product-namespace SQL for execution-capability grants: an ADMITTED run (runs, allocation, ACTIVE admitted grants and
 * their bindings) that `createExecutionGrantAdmission`, `createPostgresAdmittedRunOwner` and `createNativeAllocationAdmission`
 * read and write through the same statements they issue against PostgreSQL, plus the owned tool-invocation and reservation
 * statements of `createPostgresBudgetExecution` (so a document request can reach its authority check and reservation). Enforces
 * `grants.capability_sha256 UNIQUE` and `ON CONFLICT DO NOTHING`. No PostgreSQL, network or native call. */
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
export function executionGrantFixture({allocation,facts,expiresAtMs,tenantId,clock:initial}){
 const commands=[],binding=facts[0].binding,q=facts[0].qualificationBinding;let clock=initial,chain=Promise.resolve(),lose=false;
 const started=new Date(clock);
 let state={budget:{id:1,cap_micro_usd:'10000000',consumed_micro_usd:'0',quarantined:false},runs:new Map(),grants:new Map(),allocations:new Map(),bindings:new Map(),
  tenantPolicy:{tenant_id:tenantId??binding.tenantId,monthly_cap_micro_usd:'10000000',max_concurrent_runs:2},tenantReservations:new Map(),liabilities:[],produced:new Map(),reservations:new Map()};
 state.runs.set(binding.runId,{run_id:binding.runId,attempt:q.attempt,worker_arn:q.workerArn,fence:q.fence,policy_revision:q.policyRevision});
 state.allocations.set(binding.runId,{run_id:binding.runId,allocation_sha256:hash(allocation),allocation:structuredClone(allocation),max_tool_calls:String(allocation.budgets.maxToolCalls),max_cost_micro_usd:String(allocation.budgets.maxCostMicroUSD),started_at:started});
 for(const f of facts){
  state.grants.set(f.grantId,{grant_id:f.grantId,run_id:binding.runId,attempt:q.attempt,worker_arn:q.workerArn,fence:q.fence,policy_revision:q.policyRevision,capability_sha256:f.capabilitySha256,expires_at:new Date(expiresAtMs),state:'ACTIVE'});
  state.bindings.set(f.grantId,{grant_id:f.grantId,run_id:binding.runId,facts:structuredClone(f)});
 }
 const pool={async connect(){let local,unlock,readOnly=false;return{async query(sql,p=[]){
  commands.push({sql,p});const rows=v=>({rows:structuredClone(v),rowCount:v.length});
  if(sql.startsWith('BEGIN')){readOnly=sql.includes('READ ONLY');if(readOnly)local=structuredClone(state);return rows([]);}
  if(sql.startsWith('SET LOCAL'))return rows([]);
  if(sql==='COMMIT'){if(!readOnly)state=local;if(lose){lose=false;throw Error('lost acknowledged commit');}return rows([]);}
  if(sql==='ROLLBACK')return rows([]);
  if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(clock)}]);
  assert.equal(sql.includes('meri_qualification.'),false,'product owner must never issue qualification SQL');
  if(sql.includes('.budget WHERE')){if(!readOnly&&!local){const prior=chain;chain=new Promise(r=>unlock=r);await prior;local=structuredClone(state);}return rows([local.budget]);}
  if(sql.includes('to_regclass('))return rows([{reservations:'meri_product_budget.tenant_run_reservations'}]);
  if(sql.includes('.tenant_budgets WHERE'))return rows(local.tenantPolicy?[local.tenantPolicy]:[]);
  if(sql.startsWith('SELECT count(*) FILTER')){
   if(sql.includes('budget_liabilities'))return rows([{unresolved:'0',consumed:'0'}]);
   const reservations=[...local.tenantReservations.values()];return rows([{active:String(reservations.filter(r=>r.state==='HELD').length),held:'0',settled:'0'}]);
  }
  if(sql.includes('.tenant_run_reservations WHERE'))return rows(local.tenantReservations.has(p[1])?[local.tenantReservations.get(p[1])]:[]);
  if(sql.startsWith('INSERT INTO meri_product_budget.tenant_run_reservations')){local.tenantReservations.set(p[1],{tenant_id:p[0],run_id:p[1],month:p[2],hold_micro_usd:String(p[3]),settled_micro_usd:null,state:'HELD'});return rows([]);}
  if(sql.startsWith('UPDATE meri_product_budget.tenant_run_reservations')){const r=local.tenantReservations.get(p[1]);if(!r||r.state!==p[4])return {rows:[],rowCount:0};Object.assign(r,{state:p[2],settled_micro_usd:p[3]});return {rows:[],rowCount:1};}
  if(sql.startsWith('SELECT allocation,allocation_sha256 FROM meri_product_budget.tool_run_allocations'))return rows(local.allocations.has(p[0])?[{allocation:local.allocations.get(p[0]).allocation,allocation_sha256:local.allocations.get(p[0]).allocation_sha256}]:[]);
  // Owned tool invocations and reservations (product-scripted-fixture.mjs statements).
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_invocations'))return rows([...local.produced.values()].filter(r=>r.run_id===p[0]&&r.producer_key_sha256===p[1]));
  if(sql.startsWith('INSERT INTO meri_product_budget.tool_invocations')){local.produced.set(p[0],{invocation_id:p[0],run_id:p[1],producer_key_sha256:p[2],delivery:p[3],facts:p[4],raw_request_sha256:p[5],operation:p[6],deadline_ms:String(p[7]),created_at:new Date(clock),reservation_id:null,arguments_sha256:null,completion:null});return rows([]);}
  if(sql.startsWith('UPDATE meri_product_budget.tool_invocations SET')){const row=local.produced.get(p[0]);if(sql.includes('completion='))row.completion=p[1];else{row.reservation_id=p[1];row.arguments_sha256=p[2];}return rows([]);}
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_reservations'))return rows(local.reservations.has(p[0])?[local.reservations.get(p[0])]:[]);
  if(sql.startsWith('SELECT 1 FROM meri_product_budget.budget_liabilities'))return rows([...local.reservations.values()].filter(r=>r.grant_id===p[0]&&r.state==='UNKNOWN').map(()=>({one:1})));
  if(sql.includes(' AS run_total FROM meri_product_budget.budget_liabilities'))return rows([{held:String([...local.reservations.values()].filter(r=>r.state==='UNKNOWN').reduce((a,r)=>a+BigInt(r.hold_micro_usd),0n)),run_total:String([...local.reservations.values()].filter(r=>r.run_id===p[0]).reduce((a,r)=>a+BigInt(r.state==='UNKNOWN'?r.hold_micro_usd:r.charged_micro_usd),0n))}]);
  if(sql.startsWith('SELECT count(*) AS calls FROM meri_product_budget.tool_reservations'))return rows([{calls:String([...local.reservations.values()].filter(r=>r.run_id===p[0]).length)}]);
  if(sql.startsWith('INSERT INTO meri_product_budget.tool_reservations')){local.reservations.set(p[0],{invocation_id:p[0],reservation_id:p[1],grant_id:p[2],run_id:p[3],facts:p[4],operation:p[5],arguments_sha256:p[6],hold_micro_usd:String(p[7]),max_output_bytes:String(p[8]),state:'UNKNOWN',charged_micro_usd:null,output_bytes:null,created_at:new Date(clock),settled_at:null});return rows([]);}
  if(sql.startsWith('UPDATE meri_product_budget.budget SET consumed_micro_usd')){local.budget.consumed_micro_usd=String(BigInt(local.budget.consumed_micro_usd)+BigInt(p[0]));return rows([]);}
  if(sql.startsWith('UPDATE meri_product_budget.tool_reservations SET')){Object.assign(local.reservations.get(p[0]),{state:'SETTLED',charged_micro_usd:local.reservations.get(p[0]).hold_micro_usd,output_bytes:String(p[1]),settled_at:new Date(clock)});return rows([]);}
  if(sql.startsWith('SELECT * FROM meri_product_budget.')){
   const name=sql.match(/meri_product_budget\.([a-z_]+)/)[1],map={runs:local.runs,grants:local.grants,tool_run_allocations:local.allocations,tool_grant_bindings:local.bindings}[name];
   assert.ok(map,'known table '+name);
   if(name==='grants'&&sql.includes('WHERE run_id'))return rows([...map.values()].filter(g=>g.run_id===p[0]||p[1]?.includes(g.grant_id)).sort((a,b)=>a.grant_id.localeCompare(b.grant_id)));
   return rows(map.has(p[0])?[map.get(p[0])]:[]);
  }
  if(sql.startsWith('INSERT INTO meri_product_budget.')){
   const name=sql.match(/meri_product_budget\.([a-z_]+)/)[1];let row,map;
   if(name==='runs'){map=local.runs;row={run_id:p[0],attempt:p[1],worker_arn:p[2],fence:p[3],policy_revision:p[4]};}
   if(name==='tool_run_allocations'){map=local.allocations;row={run_id:p[0],allocation_sha256:p[1],allocation:p[2],max_tool_calls:String(p[3]),max_cost_micro_usd:String(p[4]),started_at:new Date(clock)};}
   if(name==='grants'){map=local.grants;row={grant_id:p[0],run_id:p[1],attempt:p[2],worker_arn:p[3],fence:p[4],policy_revision:p[5],capability_sha256:p[6],expires_at:p[7],state:p.length>8?p[8]:'PENDING'};
    // UNIQUE(capability_sha256) under ON CONFLICT DO NOTHING: a second grant with the same digest is silently not inserted.
    if([...map.values()].some(g=>g.capability_sha256===p[6]&&g.grant_id!==p[0]))return rows([]);}
   if(name==='tool_grant_bindings'){map=local.bindings;row={grant_id:p[0],run_id:p[1],facts:p[2]};}
   assert.ok(map,'known insert '+name);if(!map.has(p[0]))map.set(p[0],structuredClone(row));return rows([]);
  }
  if(sql.startsWith('UPDATE meri_product_budget.grants')){const g=local.grants.get(p[0]);if(sql.includes("state='REVOKED'")){if(g&&['ACTIVE','PENDING'].includes(g.state))g.state='REVOKED';}else if(g?.state==='PENDING')g.state='ACTIVE';return rows([]);}
  assert.fail('unsupported scripted SQL '+sql);
 },release(){unlock?.();}};}};
 /** The conversation store's `allocations` slot as the composition reads it: the ADMITTED record over the same admitted set. */
 const allocations={async read({binding:b,allocationKey}){assert.equal(allocationKey,hash(b));return {run:{},record:{state:'ADMITTED',binding:b,allocationSha256:hash(allocation),resource:{taskArn:q.workerArn,grantFactsJsons:facts.map(f=>JSON.stringify(f))}}};}};
 return {pool,allocations,commands,state:()=>state,now:()=>clock,setClock(value){clock=value;},loseCommit(){lose=true;},
  statements:()=>commands.map(c=>c.sql.split(/\s+/).slice(0,4).join(' '))};
}
