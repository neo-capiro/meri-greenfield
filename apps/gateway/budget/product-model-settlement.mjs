/** Historical product model accounting. A trusted host owns complete native
 * response observation; callers can identify an original slot, never supply
 * usage or turn an incomplete stream into a charge/no-dispatch decision.
 */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {parseAdmittedGrantSet,integer,dbTime,assertRun} from './admitted-run-binding.mjs';
import {digest,same,allocation} from './tool-budget-binding.mjs';
import {PostgresBudgetStore,refuse} from './postgres-budget-store.mjs';
import {readOccurrenceCost} from './occurrence-cost-scope.mjs';

const slot=/^[A-Za-z0-9_-]{1,128}$/u;
const decimal=/^(0|[1-9][0-9]*)$/u;
const maxBigint=(1n<<63n)-1n;
const tokenLimit=2_147_483_647;
const requestId=value=>{if(typeof value!=='string'||!slot.test(value))refuse('PRODUCT_MODEL_REQUEST_REFUSED');return value;};
function money(value){
 if(!(typeof value==='string'&&decimal.test(value)||Number.isSafeInteger(value)&&value>=0))refuse('PRODUCT_MODEL_STORED_MONEY');
 const amount=BigInt(value);if(amount>maxBigint)refuse('PRODUCT_MODEL_STORED_MONEY');return amount;
}
function positive(value,maximum){if(!Number.isSafeInteger(value)||value<1||value>maximum)refuse('PRODUCT_MODEL_CONFIGURATION');return value;}
function price(value){
 const p=data(own(value,['modelId','profileId','revision','validUntilMs','reserveInputMicroUSDPerK','actualInputMicroUSDPerK','outputMicroUSDPerK','maxInputTokens','maxOutputTokens']));
 if(typeof p.modelId!=='string'||!p.modelId||typeof p.profileId!=='string'||!p.profileId||!Number.isSafeInteger(p.validUntilMs)||p.validUntilMs<1)refuse('PRODUCT_MODEL_CONFIGURATION');
 digest(p.revision);
 positive(p.reserveInputMicroUSDPerK,1_000_000_000);positive(p.actualInputMicroUSDPerK,1_000_000_000);positive(p.outputMicroUSDPerK,1_000_000_000);
 positive(p.maxInputTokens,8192);positive(p.maxOutputTokens,256);
 if(p.actualInputMicroUSDPerK>p.reserveInputMicroUSDPerK)refuse('PRODUCT_MODEL_CONFIGURATION');
 return p;
}
function tokens(value){if(!Number.isSafeInteger(value)||value<0||value>tokenLimit)refuse('PRODUCT_MODEL_USAGE_REFUSED');return value;}
const charge=(input,output,p)=>{
 const amount=(BigInt(p.actualInputMicroUSDPerK)*BigInt(input)+BigInt(p.outputMicroUSDPerK)*BigInt(output)+999n)/1000n;
 if(amount>maxBigint)refuse('PRODUCT_MODEL_USAGE_REFUSED');return amount;
};
function completed(value,requested,selected,p){
 // A boolean is checked but is not authentication. Only the configured host
 // observer may produce this object after it has parsed a complete native wire
 // response and final EOF for the original slot.
 const v=data(own(value,['requestId','binding','taskArn','capabilitySha256','nativeBodySha256','rawRequestSha256','modelId','profileId','pricingRevision','evidenceSha256','httpStatus','complete','eof','usage']));
 const usage=own(v.usage,['inputTokens','outputTokens']);
 requestId(v.requestId);for(const x of [v.capabilitySha256,v.nativeBodySha256,v.rawRequestSha256,v.pricingRevision,v.evidenceSha256])digest(x);
 if(v.requestId!==requested||!same(v.binding,selected.binding)||v.taskArn!==selected.qualificationBinding.workerArn||v.capabilitySha256!==selected.capabilitySha256||v.modelId!==p.modelId||v.profileId!==p.profileId||v.pricingRevision!==p.revision||v.httpStatus!==200||v.complete!==true||v.eof!==true)refuse('PRODUCT_MODEL_COMPLETION_REFUSED');
 tokens(usage.inputTokens);tokens(usage.outputTokens);
 return {...v,usage};
}

/** No HTTP entrypoint or provider client. `observeComplete` must be a trusted,
 * retained response owner, not a wrapper around caller JSON or an origin label.
 */
export function createProductModelSettlement(configuration){
 const c=own(configuration,['pool','allocationJson','grantFactsJsons','modelGrantId','pricing','observeComplete']);
 if(typeof c.observeComplete!=='function')refuse('PRODUCT_MODEL_CONFIGURATION');
 const {allocation:a,facts}=parseAdmittedGrantSet(c),selected=facts.find(f=>f.grantId===c.modelGrantId);
 if(!selected)refuse('PRODUCT_MODEL_GRANT_REFUSED');
 const p=price(c.pricing),store=new PostgresBudgetStore(c.pool,{namespace:'product'}),t=store.tables,allocationSha256=canonicalSha256(a);
 async function original(client,id){
  const rows=(await client.query(`SELECT * FROM ${t.requests} WHERE request_id=$1`,[id])).rows;
  if(rows.length!==1)refuse('PRODUCT_MODEL_ORIGINAL_REFUSED');
  const row=rows[0],q=selected.qualificationBinding;
  if(row.request_id!==id||row.grant_id!==selected.grantId||row.run_id!==selected.binding.runId||row.attempt!==q.attempt||row.worker_arn!==q.workerArn||row.fence!==q.fence||row.policy_revision!==q.policyRevision||row.model_id!==p.modelId||row.profile_id!==p.profileId||row.pricing_revision!==p.revision||dbTime(row.pricing_valid_until)!==p.validUntilMs)refuse('PRODUCT_MODEL_ORIGINAL_REFUSED');
  digest(row.native_body_sha256);digest(row.raw_request_sha256);
  const counted=integer(row.input_tokens),maximum=integer(row.max_output_tokens);
  if(counted<1||counted>p.maxInputTokens||maximum<1||maximum>p.maxOutputTokens)refuse('PRODUCT_MODEL_ORIGINAL_REFUSED');
  const expected=(BigInt(p.reserveInputMicroUSDPerK)*BigInt(counted)+BigInt(p.outputMicroUSDPerK)*BigInt(maximum)+999n)/1000n;
  if(money(row.hold_micro_usd)!==expected)refuse('PRODUCT_MODEL_ORIGINAL_REFUSED');
  const allocations=(await client.query(`SELECT * FROM ${t.tool_run_allocations} WHERE run_id=$1`,[selected.binding.runId])).rows;
  if(allocations.length!==1||allocations[0].run_id!==selected.binding.runId||allocations[0].allocation_sha256!==allocationSha256||!same(allocations[0].allocation,a)||integer(allocations[0].max_tool_calls)!==a.budgets.maxToolCalls||integer(allocations[0].max_cost_micro_usd)!==a.budgets.maxCostMicroUSD)refuse('PRODUCT_MODEL_ORIGINAL_REFUSED');
  const runs=(await client.query(`SELECT * FROM ${t.runs} WHERE run_id=$1`,[selected.binding.runId])).rows;
  if(runs.length!==1)refuse('PRODUCT_MODEL_ORIGINAL_REFUSED');
  assertRun(runs[0],selected);
  const grants=(await client.query(`SELECT * FROM ${t.grants} WHERE grant_id=$1`,[selected.grantId])).rows;
  if(grants.length!==1)refuse('PRODUCT_MODEL_ORIGINAL_REFUSED');
  assertRun(grants[0],selected);
  if(grants[0].grant_id!==selected.grantId||grants[0].capability_sha256!==selected.capabilitySha256)refuse('PRODUCT_MODEL_ORIGINAL_REFUSED');
  const bindings=(await client.query(`SELECT * FROM ${t.tool_grant_bindings} WHERE grant_id=$1`,[selected.grantId])).rows;
  if(bindings.length!==1||bindings[0].run_id!==selected.binding.runId||bindings[0].grant_id!==selected.grantId||!same(bindings[0].facts,selected))refuse('PRODUCT_MODEL_ORIGINAL_REFUSED');
  return row;
 }
 function outcome(row){
  if(!['UNKNOWN','SETTLED','NO_DISPATCH'].includes(row.state))refuse('PRODUCT_MODEL_ORIGINAL_REFUSED');
  const actual=row.actual_micro_usd===null?null:money(row.actual_micro_usd).toString();
  if((row.state==='UNKNOWN')!==(actual===null))refuse('PRODUCT_MODEL_ORIGINAL_REFUSED');
  if(row.state==='UNKNOWN'){
   if(row.evidence_sha256!==null||row.settled_at!==null)refuse('PRODUCT_MODEL_ORIGINAL_REFUSED');
  }else{digest(row.evidence_sha256);dbTime(row.settled_at);}
  return Object.freeze({requestId:row.request_id,state:row.state,actualMicroUSD:actual});
 }
 return Object.freeze({
  async settle(value){
   const id=requestId(own(value,['requestId']).requestId);
   const observed=completed(await c.observeComplete(Object.freeze({requestId:id,binding:selected.binding,grantId:selected.grantId})),id,selected,p);
   return store.transact(async client=>{
    const budget=await store.lock(client),row=await original(client,id);
    if(row.native_body_sha256!==observed.nativeBodySha256||row.raw_request_sha256!==observed.rawRequestSha256)refuse('PRODUCT_MODEL_COMPLETION_REFUSED');
    const actual=charge(observed.usage.inputTokens,observed.usage.outputTokens,p);
    if(row.state==='SETTLED'){
     if(money(row.actual_micro_usd)!==actual||row.evidence_sha256!==observed.evidenceSha256)refuse('PRODUCT_MODEL_SETTLEMENT_CONFLICT');
     return Object.freeze({requestId:id,state:'SETTLED',actualMicroUSD:actual.toString(),quarantined:budget.quarantined});
    }
    if(row.state!=='UNKNOWN')refuse('PRODUCT_MODEL_SETTLEMENT_CONFLICT');
    const remaining=(await client.query(`SELECT COALESCE(sum(hold_micro_usd),0) AS held FROM ${t.budget_liabilities} WHERE state='UNKNOWN' AND NOT (kind='model' AND slot=$1)`,[id])).rows;
    const runRemaining=(await client.query(`SELECT COALESCE(sum(CASE WHEN state='UNKNOWN' THEN hold_micro_usd ELSE consumed_micro_usd END),0) AS total FROM ${t.budget_liabilities} WHERE run_id=$1 AND NOT (kind='model' AND slot=$2)`,[selected.binding.runId,id])).rows;
    if(remaining.length!==1||runRemaining.length!==1)refuse('PRODUCT_MODEL_ACCOUNTING_REFUSED');
    const inconsistent=observed.usage.inputTokens!==integer(row.input_tokens)||observed.usage.outputTokens>integer(row.max_output_tokens);
    const occurrence=await readOccurrenceCost({client,tables:t,allocation:a,parseAllocation:allocation,exclude:{kind:'model',slot:id}});
    const quarantine=inconsistent||actual>money(row.hold_micro_usd)||money(budget.consumed_micro_usd)+money(remaining[0].held)+actual>money(budget.cap_micro_usd)||money(runRemaining[0].total)+actual>money(a.budgets.maxCostMicroUSD)||
     occurrence!==null&&occurrence.totalMicroUSD+actual>occurrence.maxCostMicroUSD;
    const budgetChange=await client.query(`UPDATE ${t.budget} SET consumed_micro_usd=consumed_micro_usd+$1,quarantined=quarantined OR $2 WHERE id=1`,[actual.toString(),quarantine]);
    if(budgetChange.rowCount!==1)refuse('PRODUCT_MODEL_ACCOUNTING_REFUSED');
    const requestChange=await client.query(`UPDATE ${t.requests} SET state='SETTLED',actual_micro_usd=$2,evidence_sha256=$3,settled_at=clock_timestamp() WHERE request_id=$1 AND state='UNKNOWN'`,[id,actual.toString(),observed.evidenceSha256]);
    if(requestChange.rowCount!==1)refuse('PRODUCT_MODEL_ACCOUNTING_REFUSED');
    return Object.freeze({requestId:id,state:'SETTLED',actualMicroUSD:actual.toString(),quarantined:budget.quarantined||quarantine});
   });
  },
  async readOutcome(value){
   const id=requestId(own(value,['requestId']).requestId);
   // Snapshot for uncertain-COMMIT reconciliation. ABSENT is refusal, never
   // positive no-dispatch proof or a reason to reissue inference.
   return store.transact(async client=>outcome(await original(client,id)),()=>{},undefined,true);
  },
 });
}
