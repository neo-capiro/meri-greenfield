import {parseBytes} from '../document-application/boundary.mjs';
export {receiveUsageOverviewRequest,receiveUsageOverviewResponse,receiveUsageOverviewRequestV2,receiveUsageOverviewResponseV2,UsageOverviewResponseError,USAGE_OVERVIEW_SCHEMA,USAGE_OVERVIEW_SCHEMA_V2,USAGE_OVERVIEW_PATH,usageOverviewMetadata,usageOverviewMetadataV2} from './overview-receive.mjs';
import {validateRequest,validateResponse} from './generated-validator.mjs';
import {conversationUsageMetadata,conversationUsageErrors} from './protocol.mjs';
import {assertUsageResponseSemantics,fail} from './semantics.mjs';
export * from './protocol.mjs';
export {ConversationUsageResponseError} from './semantics.mjs';
const admitted=new WeakMap();
const parse=(bytes,cap)=>{try{return parseBytes(bytes,cap);}catch(error){fail(error.code??'INVALID_BYTES');}};
export function receiveConversationUsageRequest(bytes){const value=parse(bytes,conversationUsageMetadata.requestBytes);
 if(!validateRequest(value))fail('USAGE_REQUEST_INVALID');admitted.set(value,structuredClone(value));return value;
}
export function receiveConversationUsageResponse(status,bytes,request){
 const expected=admitted.get(request);if(!expected)fail('UNADMITTED_REQUEST');const value=parse(bytes,conversationUsageMetadata.responseBytes);
 if(status!==200){
  if(!Number.isInteger(status)||!value||Object.keys(value).length!==1||!value.error||Object.keys(value.error).length!==1||
   typeof value.error.code!=='string'||!Object.hasOwn(conversationUsageErrors,value.error.code)||!conversationUsageErrors[value.error.code].includes(status))fail('INVALID_ERROR_RESPONSE');
  return value;
 }
 if(!validateResponse(value))fail('INVALID_USAGE_RESPONSE');return assertUsageResponseSemantics(value,expected);
}
