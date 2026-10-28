import {parseBytes} from '../document-application/boundary.mjs';
import {validateOverviewRequest,validateOverviewResponse,validateOverviewRequest2,validateOverviewResponse2} from './generated-overview-validator.mjs';
import {assertUsageOverviewSemantics,assertUsageOverviewSemanticsV2,overviewFail} from './overview-semantics.mjs';
import {usageOverviewMetadata,usageOverviewMetadataV2,usageOverviewErrors} from './overview-protocol.mjs';
export {UsageOverviewResponseError} from './overview-semantics.mjs';
export {USAGE_OVERVIEW_SCHEMA,USAGE_OVERVIEW_SCHEMA_V2,USAGE_OVERVIEW_PATH,usageOverviewMetadata,usageOverviewMetadataV2} from './overview-protocol.mjs';
const requests=new WeakSet(),requestsV2=new WeakSet();
function parse(bytes,limit){try{return parseBytes(bytes,limit);}catch{overviewFail('INVALID_BYTES');}}
export function receiveUsageOverviewRequest(bytes){const value=parse(bytes,usageOverviewMetadata.requestBytes);if(!validateOverviewRequest(value))overviewFail('USAGE_OVERVIEW_REQUEST_INVALID');requests.add(value);return value;}
export function receiveUsageOverviewResponse(status,bytes,request){
 if(!requests.has(request))overviewFail('UNADMITTED_REQUEST');const value=parse(bytes,usageOverviewMetadata.responseBytes);
 if(status!==200){const error=value?.error;
  if(!Number.isInteger(status)||!value||Object.keys(value).length!==1||!error||!Object.hasOwn(usageOverviewErrors,error.code)||!usageOverviewErrors[error.code].includes(status)||
   Object.keys(error).some(key=>!['code','outcome'].includes(key))||Object.hasOwn(error,'outcome')&&(error.code!=='USAGE_OVERVIEW_UNAVAILABLE'||error.outcome!=='UNKNOWN'))overviewFail('INVALID_ERROR_RESPONSE');return value;}
 if(!validateOverviewResponse(value))overviewFail('INVALID_USAGE_OVERVIEW');return assertUsageOverviewSemantics(value);
}
// Successor source version on the same route. Its brand set is separate, so a request admitted for one
// wire version can never be settled by the other and an ordinary /1 body is refused here by construction.
export function receiveUsageOverviewRequestV2(bytes){const value=parse(bytes,usageOverviewMetadataV2.requestBytes);if(!validateOverviewRequest2(value))overviewFail('USAGE_OVERVIEW_REQUEST_INVALID');requestsV2.add(value);return value;}
export function receiveUsageOverviewResponseV2(status,bytes,request){
 if(!requestsV2.has(request))overviewFail('UNADMITTED_REQUEST');const value=parse(bytes,usageOverviewMetadataV2.responseBytes);
 if(status!==200){const error=value?.error;
  if(!Number.isInteger(status)||!value||Object.keys(value).length!==1||!error||!Object.hasOwn(usageOverviewErrors,error.code)||!usageOverviewErrors[error.code].includes(status)||
   Object.keys(error).some(key=>!['code','outcome'].includes(key))||Object.hasOwn(error,'outcome')&&(error.code!=='USAGE_OVERVIEW_UNAVAILABLE'||error.outcome!=='UNKNOWN'))overviewFail('INVALID_ERROR_RESPONSE');return value;}
 if(!validateOverviewResponse2(value))overviewFail('INVALID_USAGE_OVERVIEW');return assertUsageOverviewSemanticsV2(value);
}
