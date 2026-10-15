/** PostgreSQL tenant budget store over the proposed `meri_product_budget.tenant_budgets` / `tenant_run_reservations` tables
 * (docs/coordination/proposals/FABLE-MIGRATION-REQUEST-TENANT-BUDGETS-20261015.md; no migration ID is allocated or applied here).
 * Each operation is one owned transaction of the canonical budget store: the tenant row is locked first, the reservation row second;
 * the rule itself is the shared policy kernel. The pool is borrowed and never ended. */
import {PostgresBudgetStore,refuse} from '../postgres-budget-store.mjs';
import {own,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {tenantId,runId,month,microUsd,storedMicroUsd,admitReservation,replayReservation,releaseTransition,settleTransition,budgetView} from './policy.mjs';
const schema='meri_product_budget',tables=Object.freeze({budgets:`${schema}.tenant_budgets`,reservations:`${schema}.tenant_run_reservations`});
const fromRow=row=>({tenantId:row.tenant_id,runId:row.run_id,month:row.month,holdMicroUSD:storedMicroUsd(row.hold_micro_usd,1),settledMicroUSD:row.settled_micro_usd===null?null:storedMicroUsd(row.settled_micro_usd),state:row.state});
export function createPostgresTenantBudgetStore({pool}){
 const store=new PostgresBudgetStore(pool,{namespace:'product'});
 const check=signal=>()=>{if(signal?.aborted)refuse('TENANT_BUDGET_CANCELLED');};
 async function lockedCurrent(client,tenant,period){
  const budget=(await client.query(`SELECT * FROM ${tables.budgets} WHERE tenant_id=$1 FOR UPDATE`,[tenant])).rows[0];if(!budget)refuse('TENANT_BUDGET_UNCONFIGURED');
  const sums=(await client.query(`SELECT count(*) FILTER (WHERE state='HELD') AS active, COALESCE(sum(hold_micro_usd) FILTER (WHERE state='HELD' AND month=$2),0) AS held, COALESCE(sum(settled_micro_usd) FILTER (WHERE state='SETTLED' AND month=$2),0) AS settled FROM ${tables.reservations} WHERE tenant_id=$1`,[tenant,period])).rows[0];
  if(!sums)refuse('TENANT_BUDGET_STATE');
  return {policy:{tenantId:budget.tenant_id,monthlyCapMicroUSD:storedMicroUsd(budget.monthly_cap_micro_usd,1),maxConcurrentRuns:storedMicroUsd(budget.max_concurrent_runs,1)},activeRuns:storedMicroUsd(sums.active),heldMicroUSD:storedMicroUsd(sums.held),settledMicroUSD:storedMicroUsd(sums.settled)};
 }
 async function lockedReservation(client,tenant,run){
  await client.query(`SELECT 1 FROM ${tables.budgets} WHERE tenant_id=$1 FOR UPDATE`,[tenant]);
  const row=(await client.query(`SELECT * FROM ${tables.reservations} WHERE tenant_id=$1 AND run_id=$2 FOR UPDATE`,[tenant,run])).rows[0];if(!row)refuse('TENANT_RESERVATION_UNKNOWN');return fromRow(row);
 }
 async function write(client,before,after){
  if(after.state===before.state)return after;
  const column=after.state==='RELEASED'?'released_at':'settled_at';
  const result=await client.query(`UPDATE ${tables.reservations} SET state=$3, settled_micro_usd=$4, ${column}=clock_timestamp() WHERE tenant_id=$1 AND run_id=$2 AND state=$5`,[after.tenantId,after.runId,after.state,after.settledMicroUSD,before.state]);
  if(result.rowCount!==1)refuse('TENANT_BUDGET_STATE');return after;
 }
 return Object.freeze({
  async readTenantBudget(input){const i=own(input,['tenantId','month'],['signal']);tenantId(i.tenantId);month(i.month);nativeSignal(i.signal);
   return store.transact(async client=>budgetView(await lockedCurrent(client,i.tenantId,i.month),i.month),check(i.signal));},
  async reserve(input){const i=own(input,['tenantId','runId','month','holdMicroUSD'],['signal']);tenantId(i.tenantId);runId(i.runId);month(i.month);microUsd(i.holdMicroUSD,1);nativeSignal(i.signal);
   return store.transact(async client=>{
    const current=await lockedCurrent(client,i.tenantId,i.month);
    const existing=(await client.query(`SELECT * FROM ${tables.reservations} WHERE tenant_id=$1 AND run_id=$2 FOR UPDATE`,[i.tenantId,i.runId])).rows[0];
    if(existing)return Object.freeze({...replayReservation(fromRow(existing),i),replayed:true});
    admitReservation(current,i);
    await client.query(`INSERT INTO ${tables.reservations}(tenant_id,run_id,month,hold_micro_usd,state) VALUES($1,$2,$3,$4,'HELD')`,[i.tenantId,i.runId,i.month,i.holdMicroUSD]);
    return Object.freeze({tenantId:i.tenantId,runId:i.runId,month:i.month,holdMicroUSD:i.holdMicroUSD,settledMicroUSD:null,state:'HELD',replayed:false});
   },check(i.signal));},
  async release(input){const i=own(input,['tenantId','runId'],['signal']);tenantId(i.tenantId);runId(i.runId);nativeSignal(i.signal);
   return store.transact(async client=>{const before=await lockedReservation(client,i.tenantId,i.runId);return Object.freeze(await write(client,before,releaseTransition(before)));},check(i.signal));},
  async settle(input){const i=own(input,['tenantId','runId','measuredMicroUSD'],['signal']);tenantId(i.tenantId);runId(i.runId);microUsd(i.measuredMicroUSD);nativeSignal(i.signal);
   return store.transact(async client=>{const before=await lockedReservation(client,i.tenantId,i.runId);return Object.freeze(await write(client,before,settleTransition(before,i.measuredMicroUSD)));},check(i.signal));},
  tables,
 });
}
