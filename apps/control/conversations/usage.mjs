/** Content-free SDK result accounting. The run row owns idempotency; this module has no effects.
 * modelUsage includes subagents/compaction and is cumulative across resume/fork. `usage` does not.
 * A missing/reset baseline is unavailable, never a zero-cost run. Thinking is already in outputTokens.
 */
import {assertSdkUsageSnapshot,projectSdkUsage} from '../../../packages/contracts/runtime-0.2/usage.mjs';
import {assertModelSelection,HISTORICAL_MODEL_SELECTION,MODEL_PROVIDERS} from '../../../packages/contracts/model-selection.mjs';

const COUNTERS=Object.freeze(['inputTokens','outputTokens','cacheReadInputTokens','cacheCreationInputTokens']);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const count=value=>Number.isSafeInteger(value)&&value>=0;
const dollars=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER/1e6;
const invalid=()=>{throw Error('SDK_USAGE_INVALID');};
// Both SDK estimates cover the full query pipeline. Allow floating-point summation
// error across at most 32 model entries, not a missing or contradictory model charge.
const consistentEstimate=value=>{
 const sum=Object.values(value.models).reduce((total,model)=>total+model.sdkEstimateUsd,0);
 return Math.abs(sum-value.sdkEstimateUsd)<=64*Number.EPSILON*Math.max(1,sum,value.sdkEstimateUsd);
};
export const SDK_USAGE_BASIS=Object.freeze({sdk:'0.3.295',cli:'2.1.295',provider:'bedrock',cacheWriteTtl:'5m',priceRevision:'sdk-list-estimate-0.3.295'});
const sameBasis=(value,historical=false)=>object(value)&&Object.keys(value).length===5&&value.sdk===SDK_USAGE_BASIS.sdk&&value.cli===SDK_USAGE_BASIS.cli&&MODEL_PROVIDERS.includes(value.provider)&&value.cacheWriteTtl==='5m'&&(value.priceRevision===SDK_USAGE_BASIS.priceRevision||historical&&value.provider==='bedrock'&&value.priceRevision==='bedrock-us-sonnet-4-6-2026-10-23');

/** Native projection is shared; application-owned pricing/configuration stays here. */
export const sdkUsageSnapshot=(result,basis=SDK_USAGE_BASIS)=>projectSdkUsage(result,basis);
/** Per-message output ceiling handed to the SDK (CLAUDE_CODE_MAX_OUTPUT_TOKENS). Thinking shares it with visible text, so
 * the old 4096 cut answers off mid-brief; Sonnet 4.6 on Bedrock serves 64k, and 32k leaves room for a complete answer. */
export const SDK_MAX_OUTPUT_TOKENS=32000;
/** Compatibility fixtures use the immutable pre-selection model, never the deployment's current default. */
export const SDK_MODEL_CONFIGURATION=Object.freeze({model:HISTORICAL_MODEL_SELECTION.modelId,region:'us-east-1',maxOutputTokens:SDK_MAX_OUTPUT_TOKENS,usageBasis:SDK_USAGE_BASIS});
/** Selection was validated against the deployment catalog at admission and load. No key/ARN crosses this port. */
export function resolveSdkModelConfiguration(selection,modelPolicy){
 try{selection=assertModelSelection(selection);}catch{throw Error('SDK_MODEL_CONFIGURATION_REFUSED');}
 if(!object(modelPolicy)||!Number.isSafeInteger(modelPolicy.maxTurns)||modelPolicy.maxTurns<1||modelPolicy.maxTurns>100||!Number.isSafeInteger(modelPolicy.maxBudgetMicroUsd)||modelPolicy.maxBudgetMicroUsd<1)throw Error('SDK_MODEL_CONFIGURATION_REFUSED');
 return {provider:selection.provider,model:selection.modelId,effort:selection.effort,region:'us-east-1',maxOutputTokens:SDK_MAX_OUTPUT_TOKENS,usageBasis:{...SDK_USAGE_BASIS,provider:selection.provider},maxTurns:modelPolicy.maxTurns,maxCostMicroUSD:modelPolicy.maxBudgetMicroUsd};
}

function snapshot(value){
 assertSdkUsageSnapshot(value);
 if(!object(value)||!uuid(value.sessionId)||!object(value.models)||!dollars(value.sdkEstimateUsd))invalid();
 // Reuse the projection's validator for persisted baselines. No response-derived parent identity is accepted.
 return sdkUsageSnapshot({type:'result',session_id:value.sessionId,total_cost_usd:value.sdkEstimateUsd,
  modelUsage:Object.fromEntries(Object.entries(value.models).map(([key,m])=>[key,{...m,costUSD:m.sdkEstimateUsd}]))},value.basis);
}

/** Internal wire carries only the already-projected native counters. Revalidate it before pricing. */
export function accountSdkSnapshot(value,context){
 if(value===null)return accountSdkUsage({...context,result:null});
 const s=assertSdkUsageSnapshot(value);
 return accountSdkUsage({...context,basis:s.basis,result:{type:'result',session_id:s.sessionId,total_cost_usd:s.sdkEstimateUsd,
  modelUsage:Object.fromEntries(Object.entries(s.models).map(([name,m])=>[name,{...m,costUSD:m.sdkEstimateUsd}]))}});
}

/** mode/parentSessionId come from the canonical run lineage, not the result. A fork charges its delta only. */
export function accountSdkUsage({result,mode,parentSessionId=null,baseline=null,basis=SDK_USAGE_BASIS}){
 let cumulative=null,delta=null,sdkEstimateUsd=null;
 const unavailable=reason=>({status:'unavailable',reason,cumulative,delta,sdkEstimateUsd,chargeMicroUsd:null,priceRevision:SDK_USAGE_BASIS.priceRevision});
 if(!sameBasis(basis))return unavailable('configuration_mismatch');
 try{cumulative=sdkUsageSnapshot(result,basis);}catch{return unavailable('result_unavailable');}
 let previous;
 if(mode==='new'){
  if(parentSessionId!==null||baseline!==null)return unavailable('baseline_mismatch');
 }else if(mode==='resume'||mode==='fork'){
  if(!uuid(parentSessionId)||baseline===null)return unavailable('baseline_unavailable');
  if(!sameBasis(baseline.basis,true))return unavailable('baseline_configuration_mismatch');
  try{previous=snapshot(baseline);}catch{return unavailable('baseline_unavailable');}
  if(previous.sessionId!==parentSessionId||(mode==='resume'?cumulative.sessionId!==parentSessionId:cumulative.sessionId===parentSessionId))return unavailable('baseline_mismatch');
 }else return unavailable('lineage_unavailable');
 const models={};
 for(const name of Object.keys(previous?.models??{}))if(!Object.hasOwn(cumulative.models,name))return unavailable('counters_reset');
 for(const [name,current] of Object.entries(cumulative.models)){
  const old=previous?.models[name];
  if(old&&(old.provider!==current.provider||old.costBasis!==current.costBasis))return unavailable('baseline_mismatch');
  if(current.sdkEstimateUsd<(old?.sdkEstimateUsd??0))return unavailable('counters_reset');
  const difference=Object.fromEntries([...COUNTERS,'webSearchRequests'].map(key=>[key,current[key]-(old?.[key]??0)]));
  if(Object.values(difference).some(n=>!count(n)))return unavailable('counters_reset');
  models[name]=difference;
 }
 const estimate=cumulative.sdkEstimateUsd-(previous?.sdkEstimateUsd??0);
 if(estimate<0)return unavailable('counters_reset');
 if(!consistentEstimate(cumulative)||previous&&!consistentEstimate(previous))return unavailable('estimate_mismatch');
 // SDK decimal USD is an estimate; preserve it separately from integer application accounting.
 sdkEstimateUsd=Number(estimate.toFixed(12));delta=models;
 for(const evidence of Object.values(cumulative.models))if(!['bedrock','firstParty'].includes(evidence.provider)||evidence.costBasis!=='list')return unavailable('rates_unavailable');
 // A resumed SDK snapshot includes historical providers. Only unchanged history may
 // differ from this turn's provider; any new entry, cost or counter must match it.
 const provider=basis.provider==='claude-api'?'firstParty':'bedrock';
 for(const [name,current] of Object.entries(cumulative.models)){
  const old=previous?.models[name],advanced=!old||current.sdkEstimateUsd>old.sdkEstimateUsd||Object.values(models[name]).some(n=>n>0);
  if(advanced&&current.provider!==provider)return unavailable('configuration_mismatch');
 }
 // Native cost includes model-specific cache/tool pricing and subagents. It is an
 // estimate for the existing cap, never an invoice or a second token-price catalog.
 const charge=Math.ceil(Number((sdkEstimateUsd*1e6).toFixed(6)));
 if(!Number.isSafeInteger(charge))return unavailable('amount_out_of_range');
 return {status:'recorded',reason:null,cumulative,delta,sdkEstimateUsd,chargeMicroUsd:charge,priceRevision:SDK_USAGE_BASIS.priceRevision};
}
