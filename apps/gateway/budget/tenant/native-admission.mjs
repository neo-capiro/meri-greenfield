/** Tenant policy in the canonical native admission transaction. Global budget lock is already held by the caller. */
import {tenantBudgetGate} from './gate.mjs';
import {createPostgresTenantBudgetTransaction} from './postgres-store.mjs';
import {storedMicroUsd} from './policy.mjs';
import {refuse} from '../postgres-budget-store.mjs';
export function nativeTenantBudget({client,binding,nowMs,allocation,signal,check}){
 const gate=tenantBudgetGate({store:createPostgresTenantBudgetTransaction({client}),now:()=>nowMs}),key={tenantId:binding.tenantId,runId:binding.runId,signal};
 return Object.freeze({
  async admit(){await gate.admit({...key,holdMicroUSD:allocation.budgets.maxCostMicroUSD});check();},
  async revoke(){
   // Pre-0002 runs have no tenant hold. Missing legacy metadata must never prevent canonical grant revocation.
   // This is cleanup compatibility only: new admission above always requires the tenant policy and reservation tables.
   const installed=(await client.query("SELECT to_regclass('meri_product_budget.tenant_run_reservations') AS reservations")).rows;
   check();if(installed.length!==1)refuse('TENANT_BUDGET_STATE');if(installed[0].reservations===null)return;
   const held=(await client.query('SELECT 1 FROM meri_product_budget.tenant_run_reservations WHERE tenant_id=$1 AND run_id=$2',[binding.tenantId,binding.runId])).rows;
   check();if(held.length===0)return;if(held.length!==1)refuse('TENANT_BUDGET_STATE');
   await gate.release(key);check();
   // Revoked grants cannot arm another request while this same global lock is held. UNKNOWN is never refunded.
   const rows=(await client.query("SELECT count(*) FILTER (WHERE state='UNKNOWN') AS unresolved, COALESCE(sum(consumed_micro_usd),0) AS consumed FROM meri_product_budget.budget_liabilities WHERE run_id=$1",[binding.runId])).rows;
   check();if(rows.length!==1)refuse('TENANT_BUDGET_STATE');
   const unresolved=storedMicroUsd(rows[0].unresolved),measuredMicroUSD=storedMicroUsd(rows[0].consumed);
   if(unresolved===0){await gate.settle({...key,measuredMicroUSD});check();}
  },
 });
}
