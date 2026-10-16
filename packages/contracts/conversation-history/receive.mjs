import {parseBytes} from '../document-application/boundary.mjs';
import {validateListRequest,validateTranscriptRequest,validateNextTurnRequest,validateListResponse,validateTranscriptResponse,validateNextTurnResponse,validateError} from './generated-validator.mjs';
import {normalizeHistoryRequest,assertHistoryResponseSemantics,fail,ConversationHistoryResponseError} from './semantics.mjs';
import {conversationHistoryMetadata,historyErrorStatuses} from './protocol.mjs';
export {conversationHistoryMetadata,conversationHistoryVersion,HISTORY_PATHS,DISCOVERY_SCHEMA,HISTORY_SCHEMA,TURN_SCHEMA} from './protocol.mjs';
export {ConversationHistoryResponseError};
const requests=new WeakMap(),requestValidators={list:validateListRequest,transcript:validateTranscriptRequest,nextTurn:validateNextTurnRequest},responseValidators={list:validateListResponse,transcript:validateTranscriptResponse,nextTurn:validateNextTurnResponse};
const parse=(bytes,cap)=>{try{return parseBytes(bytes,cap);}catch(error){fail(error.code??'INVALID_BYTES');}};
function routeValidator(route){if(typeof route!=='string'||!Object.hasOwn(requestValidators,route))fail('INVALID_ROUTE');return requestValidators[route];}
export function receiveConversationHistoryRequest(route,utf8Bytes){const validate=routeValidator(route),request=parse(utf8Bytes,conversationHistoryMetadata.limits.requestBytes),normalized=normalizeHistoryRequest(route,request);if(!validate(request))fail('CONVERSATION_REQUEST_INVALID');requests.set(request,{route,normalized});return request;}
export async function receiveConversationHistoryResponse(route,httpStatus,utf8Bytes,request){
 routeValidator(route);const admitted=requests.get(request);if(admitted?.route!==route)fail('UNADMITTED_REQUEST');if(!Number.isInteger(httpStatus)||httpStatus<100||httpStatus>599)fail('INVALID_STATUS');
 const result=parse(utf8Bytes,conversationHistoryMetadata.limits.responseBytes);
 if(httpStatus!==200){if(!validateError(result)||!historyErrorStatuses[result.error.code].includes(httpStatus)||httpStatus===502&&result.error.field!==undefined)fail('INVALID_ERROR_RESPONSE');
  const {code,outcome}=result.error;if(route!=='nextTurn'&&outcome!==undefined&&!(code==='CONVERSATION_UNAVAILABLE'&&httpStatus===503&&outcome==='NOT_DISPATCHED'))fail('INVALID_ERROR_RESPONSE');
  if(outcome==='UNKNOWN'&&!['DEADLINE','CANCELLED','CONVERSATION_UNAVAILABLE','PRODUCT_UNAVAILABLE'].includes(code))fail('INVALID_ERROR_RESPONSE');return result;
 }
 if(!responseValidators[route](result))fail('INVALID_RESPONSE');return assertHistoryResponseSemantics(route,admitted.normalized,result);
}
/** Convenience byte validators; callers needing typed admitted bodies use the receivers above. */
export function validateConversationHistoryRequest(route,utf8Bytes){try{receiveConversationHistoryRequest(route,utf8Bytes);return true;}catch{return false;}}
export async function validateConversationHistoryResponse(route,status,utf8Bytes,request){try{await receiveConversationHistoryResponse(route,status,utf8Bytes,request);return true;}catch{return false;}}
