/** Internal product model hold. The host must authenticate and count the actual
 * native request in `observe`; this module exposes no worker or HTTP operation.
 */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createPostgresAdmittedRunOwner} from './admitted-run-owner.mjs';
import {parseAdmittedGrantSet} from './admitted-run-binding.mjs';
import {digest,same} from './tool-budget-binding.mjs';
import {refuse} from './postgres-budget-store.mjs';

const slot=/^[A-Za-z0-9_-]{1,128}$/u;
const decimal=/^(0|[1-9][0-9]*)$/u;
const maxBigint=(1n<<63n)-1n;
function money(value){
 if(!(typeof value==='string'&&decimal.test(value)||Number.isSafeInteger(value)&&value>=0))refuse('PRODUCT_MODEL_STORED_MONEY');
 const amount=BigInt(value);if(amount>maxBigint)refuse('PRODUCT_MODEL_STORED_MONEY');return amount;
}
function positive(value,maximum){if(!Number.isSafeInteger(value)||value<1||value>maximum)refuse('PRODUCT_MODEL_CONFIGURATION');return value;}
function pricingPin(value){
 const p=data(own(value,['modelId','profileId','revision','validUntilMs','actualInputMicroUSDPerK','reserveInputMicroUSDPerK','outputMicroUSDPerK','maxInputTokens','maxOutputTokens']));
 if(typeof p.modelId!=='string'||!p.modelId||typeof p.profileId!=='string'||!p.profileId||!Number.isSafeInteger(p.validUntilMs)||p.validUntilMs<1)refuse('PRODUCT_MODEL_CONFIGURATION');
 digest(p.revision);
 positive(p.actualInputMicroUSDPerK,1_000_000_000);positive(p.reserveInputMicroUSDPerK,1_000_000_000);positive(p.outputMicroUSDPerK,1_000_000_000);
 if(p.actualInputMicroUSDPerK>p.reserveInputMicroUSDPerK)refuse('PRODUCT_MODEL_CONFIGURATION');
 positive(p.maxInputTokens,8192);positive(p.maxOutputTokens,256);
 return p;
}
function observation(value,selected,pricing){
 // This validates a trusted callback's result; the fields alone prove neither
 // peer identity nor a real provider count. Never expose this as a public DTO.
 const v=data(own(value,['binding','taskArn','capabilitySha256','nativeBodySha256','rawRequestSha256','modelId','profileId','maxOutputTokens','count']));
 const count=own(v.count,['nativeBodySha256','modelId','inputTokens']);
 digest(v.capabilitySha256);digest(v.nativeBodySha256);digest(v.rawRequestSha256);digest(count.nativeBodySha256);
 if(!same(v.binding,selected.binding)||v.taskArn!==selected.qualificationBinding.workerArn||v.capabilitySha256!==selected.capabilitySha256||v.modelId!==pricing.modelId||v.profileId!==pricing.profileId||count.modelId!==pricing.modelId||count.nativeBodySha256!==v.nativeBodySha256)refuse('PRODUCT_MODEL_OBSERVATION_REFUSED');
 if(!Number.isSafeInteger(count.inputTokens)||count.inputTokens<1||count.inputTokens>pricing.maxInputTokens||!Number.isSafeInteger(v.maxOutputTokens)||v.maxOutputTokens<1||v.maxOutputTokens>pricing.maxOutputTokens)refuse('PRODUCT_MODEL_TOKEN_BOUND');
 const hold=(BigInt(pricing.reserveInputMicroUSDPerK)*BigInt(count.inputTokens)+BigInt(pricing.outputMicroUSDPerK)*BigInt(v.maxOutputTokens)+999n)/1000n;
 if(hold<1n||hold>maxBigint)refuse('PRODUCT_MODEL_HOLD_BOUND');
 return {...v,count,hold};
}

/** `observe` is a compiled host callback, not request JSON or an origin string.
 * It must independently authenticate the proxy bearer and task peer, inspect the
 * final native body, and return a CountTokens result bound to those exact bytes.
 */
export function createProductModelReservation(configuration){
 const c=own(configuration,['pool','allocationJson','grantFactsJsons','modelGrantId','pricing','observe','now','limits']);
 if(typeof c.observe!=='function'||typeof c.now!=='function')refuse('PRODUCT_MODEL_CONFIGURATION');
 const {facts}=parseAdmittedGrantSet(c),selected=facts.find(f=>f.grantId===c.modelGrantId);
 if(!selected)refuse('PRODUCT_MODEL_GRANT_REFUSED');
 const pricing=pricingPin(c.pricing),admission=createPostgresAdmittedRunOwner({pool:c.pool,allocationJson:c.allocationJson,grantFactsJsons:c.grantFactsJsons,namespace:'product',now:c.now,limits:c.limits});
 return Object.freeze({async reserve(value){
  const v=own(value,['requestId','binding','deadlineMs'],['signal']);nativeSignal(v.signal);
  if(typeof v.requestId!=='string'||!slot.test(v.requestId)||!same(data(v.binding),selected.binding)||!Number.isSafeInteger(v.deadlineMs)||v.deadlineMs<=c.now()||v.signal?.aborted)refuse('PRODUCT_MODEL_REQUEST_REFUSED');
  // No SQL is borrowed until the host produces its own authenticated evidence.
  const observed=observation(await c.observe(Object.freeze({requestId:v.requestId,binding:selected.binding,deadlineMs:v.deadlineMs,signal:v.signal})),selected,pricing);
  if(v.signal?.aborted||v.deadlineMs<=c.now())refuse('PRODUCT_MODEL_REQUEST_STOPPED');
  return admission.withCurrentAllocation({binding:selected.binding,deadlineMs:v.deadlineMs,signal:v.signal},async({client,current},limitDeadline)=>{
   if(!same(current.binding,selected.binding)||current.policyRevision!==selected.qualificationBinding.policyRevision||current.allocationSha256!==selected.allocationSha256||!same(current.allocation.run,Object.fromEntries(Object.keys(current.allocation.run).map(k=>[k,selected.binding[k]]))))refuse('PRODUCT_MODEL_CURRENT_REFUSED');
   limitDeadline(pricing.validUntilMs);
   const budgetRows=(await client.query('SELECT cap_micro_usd,consumed_micro_usd,quarantined FROM meri_product_budget.budget WHERE id=1')).rows;
   const times=(await client.query('SELECT clock_timestamp() AS now')).rows;
   if(budgetRows.length!==1||times.length!==1||!(times[0].now instanceof Date)||!Number.isSafeInteger(times[0].now.getTime())||budgetRows[0].quarantined!==false||pricing.validUntilMs<=times[0].now.getTime())refuse('PRODUCT_MODEL_BUDGET_REFUSED');
   const budget=budgetRows[0];
   const existing=(await client.query("SELECT 1 FROM meri_product_budget.budget_liabilities WHERE (kind='model' AND slot=$1) OR (grant_id=$2 AND state='UNKNOWN')",[v.requestId,selected.grantId])).rows;
   if(existing.length)refuse('PRODUCT_MODEL_SLOT_USED');
   const totals=(await client.query("SELECT COALESCE(sum(CASE WHEN state='UNKNOWN' THEN hold_micro_usd ELSE 0 END),0) AS held, COALESCE(sum(CASE WHEN run_id=$1 THEN CASE WHEN state='UNKNOWN' THEN hold_micro_usd ELSE consumed_micro_usd END ELSE 0 END),0) AS run_total FROM meri_product_budget.budget_liabilities",[selected.binding.runId])).rows;
   if(totals.length!==1||money(budget.consumed_micro_usd)+money(totals[0].held)+observed.hold>money(budget.cap_micro_usd)||money(totals[0].run_total)+observed.hold>money(current.allocation.budgets.maxCostMicroUSD))refuse('PRODUCT_MODEL_BUDGET_EXHAUSTED');
   const q=selected.qualificationBinding;
   await client.query("INSERT INTO meri_product_budget.requests(request_id,grant_id,run_id,attempt,worker_arn,fence,policy_revision,native_body_sha256,raw_request_sha256,model_id,profile_id,pricing_revision,pricing_valid_until,input_tokens,max_output_tokens,hold_micro_usd,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'UNKNOWN')",[v.requestId,selected.grantId,selected.binding.runId,q.attempt,q.workerArn,q.fence,q.policyRevision,observed.nativeBodySha256,observed.rawRequestSha256,pricing.modelId,pricing.profileId,pricing.revision,new Date(pricing.validUntilMs),observed.count.inputTokens,observed.maxOutputTokens,observed.hold.toString()]);
   const finalTime=(await client.query('SELECT clock_timestamp() AS now')).rows;
   if(finalTime.length!==1||!(finalTime[0].now instanceof Date)||!Number.isSafeInteger(finalTime[0].now.getTime())||finalTime[0].now.getTime()>=pricing.validUntilMs)refuse('PRODUCT_MODEL_PRICING_EXPIRED');
   return Object.freeze({requestId:v.requestId,nativeBodySha256:observed.nativeBodySha256,state:'UNKNOWN'});
  });
 }});
}
