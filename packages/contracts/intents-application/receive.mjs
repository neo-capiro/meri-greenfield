import {validators} from './generated-validator.mjs';
import {intentsMetadata,intentsPaths} from './generated-protocol.mjs';
import {parseText,expectedData,fail} from './boundary.mjs';
import * as semantics from './semantics.mjs';
export {IntentsResponseError} from './boundary.mjs';
export {intentsVersion} from './protocol.mjs';
export {intentsMetadata,intentsPaths};
export {routinesPaths,routinesMetadata,receiveRoutinesRequest,receiveRoutinesResponse,routineManagementSessionPath,receiveRoutineManagementSessionRequest,receiveRoutineManagementSessionReceipt} from './routines.mjs';
const requests=Object.freeze({list:'IntentsListRequest',inbox:'IntentsInboxRequest',inboxCount:'IntentsInboxCountRequest',decide:'IntentsDecideRequest'}),responses=Object.freeze({list:'IntentsListResponse',inbox:'IntentsInboxResponse',inboxCount:'IntentsInboxCountResponse',decide:'IntentsDecideResponse'});
/** The context each route is answered against: the captured request, and for decide also the proposal admitted from an earlier list answer. */
const expectationKeys=Object.freeze({list:['request'],inbox:['request'],inboxCount:['request'],decide:['proposal','request']});
const selected=(table,route)=>{if(typeof route!=='string'||!Object.hasOwn(table,route))fail('INTENTS_ROUTE');return table[route];};
const check=(name,value)=>{if(!validators[name](value))fail('INTENTS_SHAPE');return value;};
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
/** The caller's own request text, validated before it is sent. It carries no identity; the server takes that only from its admission. */
export async function receiveIntentsRequest(route,jsonText){
 const name=selected(requests,route),value=parseText(jsonText,intentsMetadata.limits.requestBytes);check(name,value);return freeze(value);
}
/** Read Response.text(). The captured context is mandatory: a response is only admitted as the answer to exactly that request. */
export async function receiveIntentsResponse(route,httpStatus,jsonText,expected){
 const request=selected(requests,route),response=selected(responses,route);
 if(!Number.isInteger(httpStatus))fail('INTENTS_STATUS');
 const expectation=expectedData(expected,intentsMetadata.limits.responseBytes),keys=Object.keys(expectation??{}).sort();
 if(keys.length!==expectationKeys[route].length||keys.some((key,index)=>key!==expectationKeys[route][index]))fail('INTENTS_EXPECTATION');
 check(request,expectation.request);if(route==='decide')check('IntentsProposal',expectation.proposal);
 const value=parseText(jsonText,intentsMetadata.limits.responseBytes);
 if(httpStatus!==200){
  check('IntentsErrorResponse',value);
  if(intentsMetadata.errorStatuses[value.error.code]!==httpStatus||httpStatus===502&&Object.hasOwn(value.error,'field'))fail('INTENTS_STATUS');
  return freeze(value);
 }
 check(response,value);
 return freeze(route==='list'?await semantics.list(value,expectation.request):route==='inbox'?semantics.inbox(value,expectation.request):route==='inboxCount'?value:await semantics.decide(value,expectation.request,expectation.proposal));
}
