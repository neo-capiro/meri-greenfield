/** Fresh read-only currentRun over the existing canonical admission and budget records. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {PostgresBudgetStore,BudgetStateDenied,refuse} from './postgres-budget-store.mjs';
import {same} from './tool-budget-binding.mjs';
import {admittedConfiguration,currentInput,integer,dbTime,assertRun} from './admitted-run-binding.mjs';
export function createPostgresAdmittedRunOwner(configuration){
 const c=admittedConfiguration(configuration),store=new PostgresBudgetStore(c.pool);
 async function currentRun(value,options){
  const input=currentInput(value,options);
  if(!same(input.binding,c.binding))refuse('ADMITTED_RUN_REFUSED');
  const started=c.now();if(!Number.isSafeInteger(started)||started<0)refuse('ADMITTED_RUN_REFUSED');
  const life=createOperationLifetime({deadlineMs:started+c.limits.maxRequestMs,now:c.now,signal:input.signal,errorFactory:()=>new BudgetStateDenied('ADMITTED_RUN_STOPPED')});
  const check=()=>{life.check();if(input.signal?.aborted)refuse('ADMITTED_RUN_STOPPED');};
  try{
   const result=await life.run(()=>store.transact(async raw=>{
    const client={async query(...args){check();const result=await raw.query(...args);check();return result;}};
    const budget=await store.lock(client);check();if(budget.quarantined!==false)refuse('ADMITTED_RUN_REFUSED');
    const run=(await client.query('SELECT * FROM meri_qualification.runs WHERE run_id=$1',[c.binding.runId])).rows;
    if(run.length!==1)refuse('ADMITTED_RUN_REFUSED');assertRun(run[0],c.facts[0]);
    const allocations=(await client.query('SELECT * FROM meri_qualification.tool_run_allocations WHERE run_id=$1',[c.binding.runId])).rows;
    const installed=allocations[0];
    if(allocations.length!==1||installed.run_id!==c.binding.runId||installed.allocation_sha256!==c.allocationSha256||!same(installed.allocation,c.a)||integer(installed.max_tool_calls)!==c.a.budgets.maxToolCalls||integer(installed.max_cost_micro_usd)!==c.a.budgets.maxCostMicroUSD)refuse('ADMITTED_RUN_REFUSED');
    const began=dbTime(installed.started_at),databaseNow=dbTime(budget.now);
    if(began>databaseNow)refuse('ADMITTED_RUN_REFUSED');
    let deadline=Math.min(began+c.a.budgets.maxRuntimeSeconds*1000,Date.parse(c.a.schedule.expiresAt));
    for(const f of c.facts){
     const grants=(await client.query('SELECT * FROM meri_qualification.grants WHERE grant_id=$1',[f.grantId])).rows;
     const grant=grants[0];if(grants.length!==1)refuse('ADMITTED_RUN_REFUSED');assertRun(grant,f);
     if(grant.grant_id!==f.grantId||grant.state!=='ACTIVE'||grant.capability_sha256!==f.capabilitySha256)refuse('ADMITTED_RUN_REFUSED');
     const bindings=(await client.query('SELECT * FROM meri_qualification.tool_grant_bindings WHERE grant_id=$1',[f.grantId])).rows,bound=bindings[0];
     if(bindings.length!==1||bound.grant_id!==f.grantId||bound.run_id!==c.binding.runId||!same(bound.facts,f))refuse('ADMITTED_RUN_REFUSED');
     deadline=Math.min(deadline,dbTime(grant.expires_at));
    }
    const finalNow=dbTime((await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now);
    if(!Number.isSafeInteger(deadline)||finalNow<databaseNow||deadline<=finalNow||deadline<=c.now())refuse('ADMITTED_RUN_REFUSED');
    life.limitDeadline(deadline);check();return deadline;
   },check));
   const checkedAtMs=c.now();check();if(!Number.isSafeInteger(checkedAtMs)||checkedAtMs<started||checkedAtMs>=result)refuse('ADMITTED_RUN_REFUSED');
   return JSON.stringify({binding:c.binding,policyRevision:c.policyRevision,deadlineMs:result,checkedAtMs});
  }finally{life.close();}
 }
 return Object.freeze({currentRun});
}
