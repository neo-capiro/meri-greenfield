/** Pure per-tenant budget rules shared by every store. A store owns atomicity (its tenant lock); this module owns the decision. */
import {refuse} from '../postgres-budget-store.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
export const MONTH=/^[0-9]{4}-(0[1-9]|1[0-2])$/u;
export const states=Object.freeze(['HELD','RELEASED','SETTLED']);
export function tenantId(value){if(typeof value!=='string'||value.length<1||value.length>128)refuse('TENANT_BUDGET_INPUT');return value;}
export function runId(value){if(typeof value!=='string'||!UUID.test(value))refuse('TENANT_BUDGET_INPUT');return value;}
/** Micro-USD amounts and counts are exact safe integers at every boundary. */
export function microUsd(value,min=0){if(!Number.isSafeInteger(value)||value<min)refuse('TENANT_BUDGET_INPUT');return value;}
/** Stored PostgreSQL bigint/count columns arrive as decimal strings; only row decoding admits that form. */
export function storedMicroUsd(value,min=0){return microUsd(typeof value==='string'&&/^(0|[1-9][0-9]*)$/u.test(value)?Number(value):value,min);}
export function month(value){if(typeof value!=='string'||!MONTH.test(value))refuse('TENANT_BUDGET_INPUT');return value;}
/** Calendar month of a UTC instant: the accounting period of a reservation is fixed when it is made. */
export function monthOf(ms){if(!Number.isSafeInteger(ms)||ms<0)refuse('TENANT_BUDGET_CLOCK');return new Date(ms).toISOString().slice(0,7);}
export function policy(value){
 const p=data(own(value,['tenantId','monthlyCapMicroUSD','maxConcurrentRuns']));tenantId(p.tenantId);microUsd(p.monthlyCapMicroUSD,1);
 if(!Number.isSafeInteger(p.maxConcurrentRuns)||p.maxConcurrentRuns<1||p.maxConcurrentRuns>10000)refuse('TENANT_BUDGET_INPUT');return p;
}
/** Admission against the current locked tenant state. Reaching the cap exactly is admitted; exceeding it by one micro-USD is not. */
export function admitReservation(current,{holdMicroUSD}){
 const c=own(current,['policy','activeRuns','heldMicroUSD','settledMicroUSD']),p=policy(c.policy);
 if(!Number.isSafeInteger(c.activeRuns)||c.activeRuns<0)refuse('TENANT_BUDGET_STATE');microUsd(c.heldMicroUSD);microUsd(c.settledMicroUSD);microUsd(holdMicroUSD,1);
 if(c.activeRuns>=p.maxConcurrentRuns)refuse('TENANT_CONCURRENCY_EXCEEDED');
 if(BigInt(c.heldMicroUSD)+BigInt(c.settledMicroUSD)+BigInt(holdMicroUSD)>BigInt(p.monthlyCapMicroUSD))refuse('TENANT_BUDGET_EXCEEDED');
}
export function reservationRow(value){
 const r=data(own(value,['tenantId','runId','month','holdMicroUSD','settledMicroUSD','state']));tenantId(r.tenantId);runId(r.runId);month(r.month);microUsd(r.holdMicroUSD,1);
 if(!states.includes(r.state)||(r.state==='SETTLED')!==(r.settledMicroUSD!==null))refuse('TENANT_BUDGET_STATE');if(r.settledMicroUSD!==null)microUsd(r.settledMicroUSD);return r;
}
/** Exact replay of an existing reservation returns it; a different hold or an already terminal run is a conflict, never a second slot. */
export function replayReservation(existing,{holdMicroUSD}){
 const r=reservationRow(existing);if(r.state!=='HELD'||r.holdMicroUSD!==microUsd(holdMicroUSD,1))refuse('TENANT_RESERVATION_CONFLICT');return r;
}
/** Terminal state without measured usage: the concurrency slot and the conservative hold are released; replay is a no-op. */
export function releaseTransition(existing){const r=reservationRow(existing);return r.state==='HELD'?{...r,state:'RELEASED'}:r;}
/** Measured usage settles the run's charge for its reservation month, from HELD or after a release (settle-after-cancel). */
export function settleTransition(existing,measuredMicroUSD){
 const r=reservationRow(existing),measured=microUsd(measuredMicroUSD);
 if(r.state==='SETTLED'){if(r.settledMicroUSD!==measured)refuse('TENANT_SETTLEMENT_CONFLICT');return r;}
 return {...r,state:'SETTLED',settledMicroUSD:measured};
}
export function aggregate(policyValue,rows,period){
 const p=policy(policyValue);let activeRuns=0,held=0n,settled=0n;
 for(const raw of rows){const r=reservationRow(raw);if(r.tenantId!==p.tenantId)refuse('TENANT_BUDGET_STATE');
  if(r.state==='HELD'){activeRuns++;if(r.month===period)held+=BigInt(r.holdMicroUSD);}else if(r.state==='SETTLED'&&r.month===period)settled+=BigInt(r.settledMicroUSD);}
 return Object.freeze({policy:p,activeRuns,heldMicroUSD:storedMicroUsd(held.toString()),settledMicroUSD:storedMicroUsd(settled.toString())});
}
export function budgetView(current,period){
 const c=current,remaining=BigInt(c.policy.monthlyCapMicroUSD)-BigInt(c.heldMicroUSD)-BigInt(c.settledMicroUSD);
 return Object.freeze({tenantId:c.policy.tenantId,month:month(period),monthlyCapMicroUSD:c.policy.monthlyCapMicroUSD,maxConcurrentRuns:c.policy.maxConcurrentRuns,activeRuns:c.activeRuns,heldMicroUSD:c.heldMicroUSD,settledMicroUSD:c.settledMicroUSD,remainingMicroUSD:remaining<0n?0:Number(remaining)});
}
