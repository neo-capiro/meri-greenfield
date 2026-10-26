import {usageCounterNames} from './protocol.mjs';
export class ConversationUsageResponseError extends Error {constructor(code){super(code);this.name='ConversationUsageResponseError';this.code=code;}}
export const fail=code=>{throw new ConversationUsageResponseError(code);};
/** All correlations use exact requested run identity; tool audit identifiers never become a join key. */
export function assertUsageResponseSemantics(value,request){
 if(value.conversationId!==request.conversationId||value.runId!==request.runId)fail('USAGE_REQUEST_MISMATCH');
 if(value.recording==='not-recorded'){
  if(value.usage!==null||value.toolAudit!==null)fail('INVALID_USAGE_RECORDING');
  return value;
 }
 const usage=value.usage,audit=value.toolAudit;
 if(usage===null||audit===null||audit.partial!==(audit.omitted>0))fail('INVALID_USAGE_RECORDING');
 if(usage.status==='recorded'?(usage.reason!==null||usage.runDelta===null||usage.cumulative===null):usage.reason===null)fail('INVALID_USAGE_STATUS');
 const cumulative=usage.cumulative?.models??[],delta=usage.runDelta?.modelCounters??[];
 for(const entries of [cumulative,delta])if(new Set(entries.map(m=>m.model)).size!==entries.length)fail('DUPLICATE_USAGE_MODEL');
 if(usage.runDelta!==null){
  // The existing accounting owner rounds its run estimate to twelve decimal places.
  if(usage.cumulative===null||delta.length!==cumulative.length||usage.runDelta.sdkEstimateUsd>usage.cumulative.sdkEstimateUsd+1e-12)fail('INVALID_USAGE_DELTA');
  for(const model of delta){const original=cumulative.find(m=>m.model===model.model);
   if(!original||usageCounterNames.some(key=>model[key]>original[key]))fail('INVALID_USAGE_DELTA');
  }
 }
 return value;
}
