/** Content-free SDK result accounting. The run row owns idempotency; this module has no effects.
 * modelUsage includes subagents/compaction and is cumulative across resume/fork. `usage` does not.
 * A missing/reset baseline is unavailable, never a zero-cost run. Thinking is already in outputTokens.
 */
import prices from './model-prices.json' with {type:'json'};
import {assertSdkUsageSnapshot,projectSdkUsage} from '../../../packages/contracts/runtime-0.2/usage.mjs';

const COUNTERS=Object.freeze(['inputTokens','outputTokens','cacheReadInputTokens','cacheCreationInputTokens']);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const count=value=>Number.isSafeInteger(value)&&value>=0;
const dollars=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER/1e6;
const invalid=()=>{throw Error('SDK_USAGE_INVALID');};
export const SDK_USAGE_BASIS=Object.freeze({sdk:'0.3.295',cli:'2.1.295',provider:'bedrock',cacheWriteTtl:'5m',priceRevision:prices.revision});
const sameBasis=value=>object(value)&&Object.keys(value).length===Object.keys(SDK_USAGE_BASIS).length&&Object.entries(SDK_USAGE_BASIS).every(([key,v])=>value[key]===v);

/** Native projection is shared; application-owned pricing/configuration stays here. */
export const sdkUsageSnapshot=(result,basis=SDK_USAGE_BASIS)=>projectSdkUsage(result,basis);
export const SDK_MODEL_CONFIGURATION=Object.freeze({model:'us.anthropic.claude-sonnet-4-6',region:'us-east-1',maxOutputTokens:4096,usageBasis:SDK_USAGE_BASIS});

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
 const unavailable=reason=>({status:'unavailable',reason,cumulative,delta,sdkEstimateUsd,chargeMicroUsd:null,priceRevision:prices.revision});
 if(!sameBasis(basis))return unavailable('configuration_mismatch');
 try{cumulative=sdkUsageSnapshot(result,basis);}catch{return unavailable('result_unavailable');}
 let previous;
 if(mode==='new'){
  if(parentSessionId!==null||baseline!==null)return unavailable('baseline_mismatch');
 }else if(mode==='resume'||mode==='fork'){
  if(!uuid(parentSessionId)||baseline===null)return unavailable('baseline_unavailable');
  if(!sameBasis(baseline.basis))return unavailable('baseline_configuration_mismatch');
  try{previous=snapshot(baseline);}catch{return unavailable('baseline_unavailable');}
  if(previous.sessionId!==parentSessionId||(mode==='resume'?cumulative.sessionId!==parentSessionId:cumulative.sessionId===parentSessionId))return unavailable('baseline_mismatch');
 }else return unavailable('lineage_unavailable');
 const models={};
 for(const name of Object.keys(previous?.models??{}))if(!Object.hasOwn(cumulative.models,name))return unavailable('counters_reset');
 for(const [name,current] of Object.entries(cumulative.models)){
  const old=previous?.models[name];
  if(old&&(old.provider!==current.provider||old.costBasis!==current.costBasis))return unavailable('baseline_mismatch');
  const difference=Object.fromEntries([...COUNTERS,'webSearchRequests'].map(key=>[key,current[key]-(old?.[key]??0)]));
  if(Object.values(difference).some(n=>!count(n)))return unavailable('counters_reset');
  models[name]=difference;
 }
 const estimate=cumulative.sdkEstimateUsd-(previous?.sdkEstimateUsd??0);
 if(estimate<0)return unavailable('counters_reset');
 // SDK decimal USD is an estimate; preserve it separately from integer application accounting.
 sdkEstimateUsd=Number(estimate.toFixed(12));delta=models;
 let thousandths=0n;
 for(const [name,usage] of Object.entries(models)){
  const rate=prices.models[name],evidence=cumulative.models[name];
  if(!rate||evidence.provider!==rate.provider||evidence.costBasis!=='list'||usage.webSearchRequests!==0)return unavailable('rates_unavailable');
  // The trusted SDK options bind both native TTL settings to 5m. The saved parent carries
  // the identical basis; this is not inferred from main-loop usage or SDK dollar estimates.
  thousandths+=BigInt(usage.cacheCreationInputTokens)*BigInt(rate.cacheCreation5mTokens);
  for(const key of ['inputTokens','outputTokens','cacheReadInputTokens'])thousandths+=BigInt(usage[key])*BigInt(rate[key]);
 }
 const charge=(thousandths+999n)/1000n;
 if(charge>BigInt(Number.MAX_SAFE_INTEGER))return unavailable('amount_out_of_range');
 return {status:'recorded',reason:null,cumulative,delta,sdkEstimateUsd,chargeMicroUsd:Number(charge),priceRevision:prices.revision};
}
