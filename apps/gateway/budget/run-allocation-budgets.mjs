/** Read-only: one run's admitted allocation budgets, for the worker's early read ledger. The source is the budget owner's own
 * `tool_run_allocations` row, the same row createPostgresAdmittedRunOwner verifies; it is read in a REPEATABLE READ READ ONLY
 * transaction with no lock and no write (control already holds SELECT on it). The row is parsed by the canonical `allocation()`
 * and must match its own sha256 and call count. Null while the run has no installed allocation yet. Never spending authority:
 * the durable allocation still reserves and settles every call. */
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {PostgresBudgetStore,BudgetStateDenied,refuse} from './postgres-budget-store.mjs';
import {allocation} from './tool-budget-binding.mjs';
import {isGeneralReadManifest} from './general-read-manifest.mjs';

export function createRunAllocationBudgetReader(configuration){
 const c=own(configuration,['pool'],['namespace','now','maxRequestMs']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??1000;
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000)refuse('RUN_BUDGETS_CONFIGURATION');
 const store=new PostgresBudgetStore(c.pool,{namespace:c.namespace??'product'});
 async function read(value){
  const v=own(value,['binding'],['signal']),binding=data(v.binding);nativeSignal(v.signal);validateShape('RunBinding',binding);
  const life=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,signal:v.signal,errorFactory:()=>new BudgetStateDenied('RUN_BUDGETS_UNAVAILABLE')});
  try{
   const rows=(await life.run(()=>store.transact(client=>client.query(`SELECT allocation,allocation_sha256,max_tool_calls FROM ${store.tables.tool_run_allocations} WHERE run_id=$1`,[binding.runId]),()=>life.check(),undefined,true))).rows;
   life.check();if(!rows.length)return null;if(rows.length!==1)refuse('RUN_BUDGETS_REFUSED');
   const row=rows[0],a=allocation(JSON.stringify(row.allocation));
   if(row.allocation_sha256!==canonicalSha256(a)||String(row.max_tool_calls)!==String(a.budgets.maxToolCalls)||
    ['tenantId','actorId','conversationId','runId'].some(key=>a.run[key]!==binding[key]))refuse('RUN_BUDGETS_REFUSED');
   return Object.freeze({maxToolCalls:a.budgets.maxToolCalls,maxOutputBytes:a.budgets.maxOutputBytes,
    ...(isGeneralReadManifest(a.manifest)?{maxAggregateOutputBytes:a.manifest.maxAggregateOutputBytes}:{})});
  }finally{life.close();}
 }
 return Object.freeze({read});
}
