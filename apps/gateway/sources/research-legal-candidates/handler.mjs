/** Six capped tenant candidate branches; Core remains the authoritative owner of source visibility and ownership. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {ownFields} from '../source-admission.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {assertResearchClientSubject} from '../research-legal-legislation/request-context.mjs';
import {researchCandidatesContext} from './request-context.mjs';

const routes=Object.freeze({search_research_sources:'/api/clio/tools/search_research_sources'});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;

function selectedContext(operation,request,normalizationContext,authority){
 const context=researchCandidatesContext(operation,request,normalizationContext?.clientResolution);
 if(hash(normalizationContext)!==hash(context))deny('ACCESS_DENIED');
 assertResearchClientSubject(authority,context.clientResolution);
 return context;
}

export function createResearchLegalCandidatesHandlers(configuration,operations){
 const handlers=createStoredNativeReadHandlers(configuration,operations,{family:'research-legal-candidates',routes,
  // Private multi-source reads must use the current per-call native credential owner.
  requirePerCall:()=>true,
  requestBody(current){
   const {clientResolution}=selectedContext(current.operation,current.request,current.normalizationContext,current.authority);
   return clientResolution&&!UUID.test(clientResolution.reference)?{...current.request,clientId:clientResolution.clientId}:current.request;
  },
 });
 return handlers.map(handler=>({operation:handler.operation,async execute(call){try{
  // Reject a model scope substitution before the credential factory or HTTP can run.
  const fields=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']);
  selectedContext(handler.operation,fields.request,fields.normalizationContext,fields.authority);
  return await handler.execute(call);
 }catch(error){throw safeFailure(error);}}}));
}
