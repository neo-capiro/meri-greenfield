/** In-memory tenant budget store: the contract/test adapter with the same port as the PostgreSQL adapter. Every write runs under
 * one store-wide mutex so concurrent reservations observe each other exactly as a locked tenant row would. */
import {refuse} from '../postgres-budget-store.mjs';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {policy,tenantId,runId,month,microUsd,admitReservation,replayReservation,releaseTransition,settleTransition,notDispatchedTransition,aggregate,budgetView} from './policy.mjs';
const key=(tenant,run)=>`${tenant}:${run}`;
export function createMemoryTenantBudgetStore({policies=[]}={}){
 if(!Array.isArray(policies))refuse('TENANT_BUDGET_CONFIGURATION');
 const configured=new Map();for(const p of policies){const v=policy(p);if(configured.has(v.tenantId))refuse('TENANT_BUDGET_CONFIGURATION');configured.set(v.tenantId,v);}
 const rows=new Map();let tail=Promise.resolve();
 /** The optional caller signal is honoured like the PostgreSQL adapter's: a cancelled operation refuses before it mutates. */
 const locked=(signal,fn)=>{nativeSignal(signal);const guarded=()=>{if(signal?.aborted)refuse('TENANT_BUDGET_CANCELLED');return fn();};const run=tail.then(guarded,guarded);tail=run.then(()=>{},()=>{});return run;};
 const current=(tenant,period)=>{const p=configured.get(tenant);if(!p)refuse('TENANT_BUDGET_UNCONFIGURED');return aggregate(p,[...rows.values()].filter(r=>r.tenantId===tenant),period);};
 const store=(row)=>{rows.set(key(row.tenantId,row.runId),row);return data(row);};
 const existing=(tenant,run)=>{const row=rows.get(key(tenant,run));if(!row)refuse('TENANT_RESERVATION_UNKNOWN');return row;};
 return Object.freeze({
  async readTenantBudget(input){const i=own(input,['tenantId','month'],['signal']);return locked(i.signal,()=>budgetView(current(tenantId(i.tenantId),month(i.month)),i.month));},
  async reserve(input){const i=own(input,['tenantId','runId','month','holdMicroUSD'],['signal']);tenantId(i.tenantId);runId(i.runId);month(i.month);microUsd(i.holdMicroUSD,1);
   return locked(i.signal,()=>{const state=current(i.tenantId,i.month),row=rows.get(key(i.tenantId,i.runId));
    if(row)return data({...replayReservation(row,i),replayed:true});
    admitReservation(state,i);return {...store({tenantId:i.tenantId,runId:i.runId,month:i.month,holdMicroUSD:i.holdMicroUSD,settledMicroUSD:null,state:'HELD'}),replayed:false};});},
  async release(input){const i=own(input,['tenantId','runId'],['signal']);tenantId(i.tenantId);runId(i.runId);return locked(i.signal,()=>store(releaseTransition(existing(i.tenantId,i.runId))));},
  async settle(input){const i=own(input,['tenantId','runId','measuredMicroUSD'],['signal']);tenantId(i.tenantId);runId(i.runId);microUsd(i.measuredMicroUSD);return locked(i.signal,()=>store(settleTransition(existing(i.tenantId,i.runId),i.measuredMicroUSD)));},
  async recordNotDispatched(input){const i=own(input,['tenantId','runId'],['signal']);tenantId(i.tenantId);runId(i.runId);return locked(i.signal,()=>store(notDispatchedTransition(existing(i.tenantId,i.runId))));},
  /** Test-only inspection of the rows a PostgreSQL adapter would hold. */
  rows:()=>[...rows.values()].map(r=>data(r)),
 });
}
