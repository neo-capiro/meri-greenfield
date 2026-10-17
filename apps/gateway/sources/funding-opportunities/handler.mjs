/** Five fixed native funding producers. Trusted asOf travels privately; raw requests and source DTOs are preserved. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {safeFailure} from '../../dispatch/operation-result.mjs';
import {captureFundingClientSelection,assertFundingClientSubject} from './request-context.mjs';
const routes=Object.freeze({
 'search_funding_opportunities':'/api/clio/tools/search_funding_opportunities',
 'get_funding_opportunity_requirements':'/api/clio/tools/get_funding_opportunity_requirements',
 'get_funding_opportunity':'/api/clio/tools/get_funding_opportunity',
 'get_opportunity_client_context':'/api/clio/tools/get_opportunity_client_context',
 'get_opportunity_government_landscape':'/api/clio/tools/get_opportunity_government_landscape',
});

export function createFundingOpportunitiesHandlers(configuration,operations){
 const handlers=createStoredNativeReadHandlers(configuration,operations,{family:'funding-opportunities',routes,observation:'funding-asof'});
 return handlers.map(handler=>({operation:handler.operation,async execute(call){try{
  const {signal:ignored,...fields}=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']);
  const selection=captureFundingClientSelection(handler.operation,fields.request),data=frozenData(fields);
  assertFundingClientSubject(data.authority.subject,selection);
  // The shared observation path requires per-call current native credentials, bounded HTTP and exact receiving validation.
  return await handler.execute(call);
 }catch(error){throw safeFailure(error);}}}));
}
