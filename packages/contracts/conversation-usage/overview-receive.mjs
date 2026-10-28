import {parseBytes} from '../document-application/boundary.mjs';
import {validateOverviewRequest,validateOverviewResponse} from './generated-overview-validator.mjs';
import {assertUsageOverviewSemantics,overviewFail} from './overview-semantics.mjs';
import {usageOverviewMetadata,usageOverviewErrors} from './overview-protocol.mjs';
export {UsageOverviewResponseError} from './overview-semantics.mjs';
export {USAGE_OVERVIEW_SCHEMA,USAGE_OVERVIEW_PATH,usageOverviewMetadata} from './overview-protocol.mjs';
const requests=new WeakSet();
function parse(bytes,limit){try{return parseBytes(bytes,limit);}catch{overviewFail('INVALID_BYTES');}}
export function receiveUsageOverviewRequest(bytes){const value=parse(bytes,usageOverviewMetadata.requestBytes);if(!validateOverviewRequest(value))overviewFail('USAGE_OVERVIEW_REQUEST_INVALID');requests.add(value);return value;}
export function receiveUsageOverviewResponse(status,bytes,request){
 if(!requests.has(request))overviewFail('UNADMITTED_REQUEST');const value=parse(bytes,usageOverviewMetadata.responseBytes);
 if(status!==200){const error=value?.error;
  if(!Number.isInteger(status)||!value||Object.keys(value).length!==1||!error||!Object.hasOwn(usageOverviewErrors,error.code)||!usageOverviewErrors[error.code].includes(status)||
   Object.keys(error).some(key=>!['code','outcome'].includes(key))||Object.hasOwn(error,'outcome')&&(error.code!=='USAGE_OVERVIEW_UNAVAILABLE'||error.outcome!=='UNKNOWN'))overviewFail('INVALID_ERROR_RESPONSE');return value;}
 if(!validateOverviewResponse(value))overviewFail('INVALID_USAGE_OVERVIEW');return assertUsageOverviewSemantics(value);
}
