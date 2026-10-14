/** One current run/grant/allocation predicate shared by snapshots and leased effects. */
import {refuse} from './postgres-budget-store.mjs';
import {same} from './tool-budget-binding.mjs';
import {integer,dbTime,assertRun} from './admitted-run-binding.mjs';
export async function readCurrentAdmission({c,store,client,life,check,locked=false,readOnly=false}){
 if(readOnly&&locked)refuse('ADMITTED_RUN_CONFIGURATION');
 const suffix=locked?' FOR UPDATE':'',t=store.tables;
 const budget=await (readOnly?store.read(client):store.lock(client));check();if(budget.quarantined!==false)refuse('ADMITTED_RUN_REFUSED');
 const run=(await client.query(`SELECT * FROM ${t.runs} WHERE run_id=$1${suffix}`,[c.binding.runId])).rows;
 if(run.length!==1)refuse('ADMITTED_RUN_REFUSED');assertRun(run[0],c.facts[0]);
 const allocations=(await client.query(`SELECT * FROM ${t.tool_run_allocations} WHERE run_id=$1${suffix}`,[c.binding.runId])).rows;
 const installed=allocations[0];
 if(allocations.length!==1||installed.run_id!==c.binding.runId||installed.allocation_sha256!==c.allocationSha256||!same(installed.allocation,c.a)||integer(installed.max_tool_calls)!==c.a.budgets.maxToolCalls||integer(installed.max_cost_micro_usd)!==c.a.budgets.maxCostMicroUSD)refuse('ADMITTED_RUN_REFUSED');
 const began=dbTime(installed.started_at),databaseNow=dbTime(budget.now);if(began>databaseNow)refuse('ADMITTED_RUN_REFUSED');
 let deadline=Math.min(began+c.a.budgets.maxRuntimeSeconds*1000,Date.parse(c.a.schedule.expiresAt));
 if(!Number.isSafeInteger(deadline)||deadline<=databaseNow)refuse('ADMITTED_RUN_REFUSED');life.limitDeadline(deadline);check();
 async function grant(f){
  const grants=(await client.query(`SELECT * FROM ${t.grants} WHERE grant_id=$1${suffix}`,[f.grantId])).rows,g=grants[0];
  if(grants.length!==1)refuse('ADMITTED_RUN_REFUSED');assertRun(g,f);
  if(g.grant_id!==f.grantId||g.state!=='ACTIVE'||g.capability_sha256!==f.capabilitySha256)refuse('ADMITTED_RUN_REFUSED');
  deadline=Math.min(deadline,dbTime(g.expires_at));if(deadline<=databaseNow)refuse('ADMITTED_RUN_REFUSED');life.limitDeadline(deadline);check();
 }
 async function binding(f){
  const rows=(await client.query(`SELECT * FROM ${t.tool_grant_bindings} WHERE grant_id=$1${suffix}`,[f.grantId])).rows,b=rows[0];
  if(rows.length!==1||b.grant_id!==f.grantId||b.run_id!==c.binding.runId||!same(b.facts,f))refuse('ADMITTED_RUN_REFUSED');
 }
 if(locked){const facts=[...c.facts].sort((a,b)=>a.grantId.localeCompare(b.grantId));for(const f of facts)await grant(f);for(const f of facts)await binding(f);}
 else for(const f of c.facts){await grant(f);await binding(f);}
 const finalNow=dbTime((await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now);
 if(!Number.isSafeInteger(deadline)||finalNow<databaseNow||deadline<=finalNow||deadline<=c.now())refuse('ADMITTED_RUN_REFUSED');
 life.limitDeadline(deadline);check();return deadline;
}
