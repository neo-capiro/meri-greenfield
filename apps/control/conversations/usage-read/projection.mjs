/** Read-only projection of the existing immutable accounting record. Never prices, subtracts or correlates tool rows. */
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertUsageInput} from '../../../../packages/contracts/runtime-0.2/usage.mjs';
import {assertConversationUsageResponse} from '../../../../packages/contracts/conversation-usage/validate.mjs';
import {CONVERSATION_USAGE_SCHEMA,usageCounterNames,usageUnavailableReasons} from '../../../../packages/contracts/conversation-usage/protocol.mjs';
import {ProductError} from '../../product-access/errors.mjs';
const count=value=>Number.isSafeInteger(value)&&value>=0;
const money=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER/1e6;
const corrupt=()=>{throw new ProductError('USAGE_RECORD_CORRUPT');};
export function projectRecordedUsage(raw,request){
 try{
  const identity={schemaVersion:CONVERSATION_USAGE_SCHEMA,conversationId:request.conversationId,runId:request.runId};
  if(raw===null)return assertConversationUsageResponse({...identity,recording:'not-recorded',usage:null,toolAudit:null},request);
  const record=data(own(raw,['status','reason','cumulative','delta','sdkEstimateUsd','chargeMicroUsd','priceRevision','parentRunId','inputSha256','toolsUsed']));
  const input=assertUsageInput({usage:record.cumulative,toolsUsed:record.toolsUsed});
  if(!['recorded','unavailable'].includes(record.status)||typeof record.inputSha256!=='string'||!/^[a-f0-9]{64}$/u.test(record.inputSha256)||
   typeof record.priceRevision!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_:\-./]{0,199}$/u.test(record.priceRevision)||
   record.parentRunId!==null&&(typeof record.parentRunId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(record.parentRunId)))corrupt();
  if(record.status==='recorded'){
   if(record.reason!==null||record.cumulative===null||record.delta===null||!money(record.sdkEstimateUsd)||!count(record.chargeMicroUsd))corrupt();
  }else if(!usageUnavailableReasons.includes(record.reason)||record.chargeMicroUsd!==null)corrupt();
  if(record.delta===null?record.sdkEstimateUsd!==null:!money(record.sdkEstimateUsd))corrupt();
  let modelCounters=null;
  if(record.delta!==null){
   if(record.cumulative===null)corrupt();const models=own(record.delta,Object.keys(record.cumulative.models));
   modelCounters=Object.entries(models).map(([model,raw])=>{const counters=own(raw,usageCounterNames);if(!usageCounterNames.every(key=>count(counters[key])))corrupt();return {model,...counters};});
  }
  const cumulative=record.cumulative===null?null:{sdkEstimateUsd:record.cumulative.sdkEstimateUsd,basis:record.cumulative.basis,
   models:Object.entries(record.cumulative.models).map(([model,value])=>({model,...value}))};
  const response={...identity,recording:'recorded',usage:{status:record.status,reason:record.reason,currency:'USD',
   runDelta:modelCounters===null?null:{sdkEstimateUsd:record.sdkEstimateUsd,modelCounters},cumulative,providerBilledUsd:null},
   toolAudit:{coverage:'recorded-hooks-only',partial:input.toolsUsed.omitted>0,omitted:input.toolsUsed.omitted,
    tools:input.toolsUsed.tools.map(tool=>({name:tool.tool,executionOutcome:tool.outcome,durationMs:tool.durationMs}))}};
  return assertConversationUsageResponse(response,request);
 }catch{corrupt();}
}
