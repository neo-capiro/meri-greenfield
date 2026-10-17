/** Complete search and retained reference slice; native ResearchService owns folder/member and evidence checks. */
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {ownFields} from '../source-admission.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {assertLegalSearchRequest,assertLegalSliceRequest,legalSliceContext,assertResearchClientSubject} from './request-context.mjs';
const SEARCH='search_legislative_research',UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;

const ROUTES=Object.freeze({
 search_legislative_research:'/api/clio/tools/search_legislative_research',
 get_legal_reference:'/api/clio/tools/get_legal_reference',
});
export function createResearchLegalLegislationHandlers(configuration,operations){
 const handlers=createStoredNativeReadHandlers(configuration,operations,{family:'research-legal-legislation',routes:ROUTES,
  requirePerCall:current=>current.operation.id===SEARCH&&Boolean(current.normalizationContext.clientResolution&&!UUID.test(current.normalizationContext.clientResolution.reference)),
  requestBody(current){
   const search=current.operation.id===SEARCH,expected=legalSliceContext(current.operation,current.request,search?current.normalizationContext.clientResolution:undefined);
   if(hash(current.normalizationContext)!==hash(expected))deny('ACCESS_DENIED');
   assertResearchClientSubject(current.authority,expected.clientResolution);
   if(search&&expected.clientResolution&&!UUID.test(expected.clientResolution.reference))return {...current.request,clientId:expected.clientResolution.clientId};
   return current.request;
  },
 });
 return handlers.map(handler=>({operation:handler.operation,async execute(call){try{
  const fields=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']);
  if(handler.operation.id===SEARCH)assertLegalSearchRequest(handler.operation,fields.request);
  else assertLegalSliceRequest(handler.operation,fields.request);
  return await handler.execute(call);
 }catch(error){throw safeFailure(error);}}}));
}
