import {parseBytes} from '../document-application/boundary.mjs';
import {validateRunListRequest,validateRunDetailRequest,validateRunListResponse,validateRunDetailResponse,validateRunError} from './generated-run-validator.mjs';
import {assertRunIndexSemantics,runIndexFail,RunIndexResponseError} from './run-semantics.mjs';
import {runIndexMetadata,runIndexErrorStatuses} from './run-protocol.mjs';
export {RunIndexResponseError};
export {RUN_INDEX_SCHEMA,RUN_DETAIL_SCHEMA,RUN_INDEX_PATHS,runIndexMetadata} from './run-protocol.mjs';
const requests=new WeakMap(),requestValidators={list:validateRunListRequest,detail:validateRunDetailRequest},responseValidators={list:validateRunListResponse,detail:validateRunDetailResponse};
function parse(bytes,limit){try{return parseBytes(bytes,limit);}catch{runIndexFail('INVALID_BYTES');}}
function validateRoute(route){if(typeof route!=='string'||!Object.hasOwn(requestValidators,route))runIndexFail('INVALID_ROUTE');}
export function receiveRunIndexRequest(route,bytes){validateRoute(route);const request=parse(bytes,runIndexMetadata.requestBytes);if(!requestValidators[route](request))runIndexFail('RUN_INDEX_REQUEST_INVALID');requests.set(request,route);return request;}
export function receiveRunIndexResponse(route,status,bytes,request){
 validateRoute(route);if(requests.get(request)!==route)runIndexFail('UNADMITTED_REQUEST');if(!Number.isInteger(status))runIndexFail('INVALID_STATUS');
 const value=parse(bytes,runIndexMetadata.responseBytes);
 if(status!==200){if(!validateRunError(value)||!runIndexErrorStatuses[value.error.code]?.includes(status))runIndexFail('INVALID_ERROR_RESPONSE');return value;}
 if(!responseValidators[route](value))runIndexFail('INVALID_RESPONSE');return assertRunIndexSemantics(route,request,value);
}
