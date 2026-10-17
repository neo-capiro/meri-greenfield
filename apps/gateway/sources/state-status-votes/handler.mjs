/** Full native status/vote delegation; Core retains designation resolution, quota, cache and ingestion. */
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {ownFields} from '../source-admission.mjs';
import {retainedCall} from '../retained-reads/call-context.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {assertStoredStateRequest} from './request-context.mjs';

const ROUTES=Object.freeze({
 get_state_bill_status:'/api/clio/tools/get_state_bill_status',
 search_state_floor_votes:'/api/clio/tools/search_state_floor_votes',
});
export function createStateStatusVotesHandlers(configuration,operations){
 const handlers=createStoredNativeReadHandlers(configuration,operations,{family:'state-status-votes',routes:ROUTES,
  requestBody:current=>assertStoredStateRequest(current.operation,current.request),
 }),now=configuration.now;
 return handlers.map(handler=>({operation:handler.operation,async execute(call){try{
  const fields=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']);
  try{resolveOperationContract(handler.operation).normalizeInput(fields.request,fields.normalizationContext);}catch{deny('INVALID_ARGUMENTS');}
  const current=retainedCall(handler.operation,call,now);
  assertStoredStateRequest(handler.operation,current.request);
  return await handler.execute(call);
 }catch(error){throw safeFailure(error);}}}));
}
