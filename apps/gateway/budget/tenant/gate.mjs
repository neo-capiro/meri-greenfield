/** Tenant admission gate over a store port {readTenantBudget, reserve, release, settle}. It adds no deadline: the caller's existing run
 * deadlines, allocation and per-run accounting are unchanged. Intended call site: the trusted run admission owner
 * (`createNativeAllocationAdmission.admit`, which is the only writer that installs a run) reserves before installing the allocation,
 * settles from measured model/tool usage, and releases on every terminal state (`revoke`, failure, cancellation). See README.md. */
import {refuse} from '../postgres-budget-store.mjs';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {tenantId,runId,microUsd,month as monthKey,monthOf} from './policy.mjs';
const ports=['readTenantBudget','reserve','release','settle'];
export function tenantBudgetGate({store,now=Date.now}){
 if(!store||typeof store!=='object'||ports.some(name=>typeof store[name]!=='function')||typeof now!=='function')refuse('TENANT_BUDGET_CONFIGURATION');
 const bound=Object.fromEntries(ports.map(name=>[name,store[name].bind(store)]));
 const receipt=value=>{const r=data(value);own(r,['tenantId','runId','month','holdMicroUSD','settledMicroUSD','state'],['replayed']);return r;};
 return Object.freeze({
  /** Reserves a concurrency slot and a conservative hold for the calendar month of admission. Refusals: TENANT_CONCURRENCY_EXCEEDED,
   * TENANT_BUDGET_EXCEEDED, TENANT_BUDGET_UNCONFIGURED, TENANT_RESERVATION_CONFLICT. */
  async admit(input){const i=own(input,['tenantId','runId','holdMicroUSD'],['signal']);tenantId(i.tenantId);runId(i.runId);microUsd(i.holdMicroUSD,1);nativeSignal(i.signal);
   const month=monthOf(now());const r=receipt(await bound.reserve({tenantId:i.tenantId,runId:i.runId,month,holdMicroUSD:i.holdMicroUSD,...(i.signal?{signal:i.signal}:{})}));
   if(r.tenantId!==i.tenantId||r.runId!==i.runId||r.state!=='HELD'||r.holdMicroUSD!==i.holdMicroUSD)refuse('TENANT_BUDGET_STATE');return r;},
  /** Measured usage replaces the hold for the reservation's own month; accepted after a release so a cancelled run still pays. */
  async settle(input){const i=own(input,['tenantId','runId','measuredMicroUSD'],['signal']);tenantId(i.tenantId);runId(i.runId);microUsd(i.measuredMicroUSD);nativeSignal(i.signal);
   const r=receipt(await bound.settle({tenantId:i.tenantId,runId:i.runId,measuredMicroUSD:i.measuredMicroUSD,...(i.signal?{signal:i.signal}:{})}));
   if(r.tenantId!==i.tenantId||r.runId!==i.runId||r.state!=='SETTLED'||r.settledMicroUSD!==i.measuredMicroUSD)refuse('TENANT_BUDGET_STATE');return r;},
  /** Terminal state: frees the slot and the hold; idempotent, and never undoes a settlement. */
  async release(input){const i=own(input,['tenantId','runId'],['signal']);tenantId(i.tenantId);runId(i.runId);nativeSignal(i.signal);
   const r=receipt(await bound.release({tenantId:i.tenantId,runId:i.runId,...(i.signal?{signal:i.signal}:{})}));
   if(r.tenantId!==i.tenantId||r.runId!==i.runId||r.state==='HELD')refuse('TENANT_BUDGET_STATE');return r;},
  async read(input){const i=own(input,['tenantId'],['month','signal']);tenantId(i.tenantId);nativeSignal(i.signal);const month=i.month===undefined?monthOf(now()):monthKey(i.month);
   const v=data(await bound.readTenantBudget({tenantId:i.tenantId,month,...(i.signal?{signal:i.signal}:{})}));own(v,['tenantId','month','monthlyCapMicroUSD','maxConcurrentRuns','activeRuns','heldMicroUSD','settledMicroUSD','remainingMicroUSD']);
   if(v.tenantId!==i.tenantId||v.month!==month)refuse('TENANT_BUDGET_STATE');return v;},
 });
}
