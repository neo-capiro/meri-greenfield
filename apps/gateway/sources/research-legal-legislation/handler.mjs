/** PARTIAL_INPUT: native ResearchService retains feature/member enforcement and exact legal evidence ownership. */
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {ownFields} from '../source-admission.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {assertUnscopedLegalRequest} from './request-context.mjs';

const ROUTES=Object.freeze({
 search_legislative_research:'/api/clio/tools/search_legislative_research',
 get_legal_reference:'/api/clio/tools/get_legal_reference',
});
export function createResearchLegalLegislationHandlers(configuration,operations){
 const handlers=createStoredNativeReadHandlers(configuration,operations,{family:'research-legal-legislation',routes:ROUTES,
  requestBody(current){
   const context=ownFields(current.normalizationContext,['clientResolution','citationResolution']);
   if(context.clientResolution!==null||context.citationResolution!==null)deny('ACCESS_DENIED');
   assertUnscopedLegalRequest(current.operation,current.request);return current.request;
  },
 });
 return handlers.map(handler=>({operation:handler.operation,async execute(call){try{
  const fields=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']);
  assertUnscopedLegalRequest(handler.operation,fields.request);
  return await handler.execute(call);
 }catch(error){throw safeFailure(error);}}}));
}
