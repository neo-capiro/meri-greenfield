/** Explicit synthetic HTTP and authority ports; no real Core source or provider is exercised. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {uuid} from '../../../test/fixtures.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createResearchLegalCandidatesHandlers} from '../handler.mjs';
import {researchCandidatesContext} from '../request-context.mjs';

export const operation=Object.freeze({id:'search_research_sources',version:'0.2.0'});
export const clientId=uuid('a'),otherClientId=uuid('c');

export function storedCase({request={query:'priority'},resolution,page}={}){
 const scene=billTextCase(),contract=resolveOperationContract(operation),context=researchCandidatesContext(operation,request,resolution);
 const {authority,state,now,wire,credentialCalls}=scene;
 authority.decision.operation=`${operation.id}@${operation.version}`;
 authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const visibleClientIds=context.clientResolution?[context.clientResolution.clientId]:[];
 if(visibleClientIds.length){
  const scope={tenantId:authority.binding.tenantId,kind:'client',resourceId:visibleClientIds[0],policyRevision:authority.policyRevision};
  Object.assign(authority.subject,{kind:'client',entityType:'client',entityIds:[visibleClientIds[0]],scopes:[scope]});
  authority.claims.scopes=[scope];authority.decision.scopes=[scope];
 }
 const input=contract.normalizeInput(request,context).input;
 const sourcePage=page??{tool:operation.id,query:input.query,generatedAt:new Date(now()).toISOString(),results:[
  {type:'meeting',id:uuid('b'),clientId:input.clientId,title:'Synthetic source',snippet:'Stored candidate excerpt',occurredAt:new Date(now()).toISOString()},
  {type:'directory_contact_note',id:uuid('d'),clientId:null,title:'Synthetic shared directory note',snippet:'Candidate excerpt',occurredAt:new Date(now()-1).toISOString(),metadata:{directoryContactId:'synthetic-directory'}},
 ]};
 const {getCredentials,...baseTransport}=scene.transport;
 const transport={...baseTransport,credentialsForCall(){state.factories=(state.factories??0)+1;return getCredentials;},
  async fetchImpl(url,configuration){
   wire.push({url,options:configuration,body:JSON.parse(configuration.body)});
   const value=structuredClone(state.page??sourcePage);state.resultMutator?.(value);state.afterSource?.();
   return state.responseFactory?state.responseFactory(value):Response.json(value);
  },
 };
 const call=(raw=request,current=authority,normalizationContext=researchCandidatesContext(operation,raw,context.clientResolution))=>{
  const normalized=contract.normalizeInput(raw,normalizationContext);
  return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext,authority:current};
 };
 const nativeReadContextPorts={async readCurrent({request:raw,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');
  return JSON.stringify({...proof,context:researchCandidatesContext(operation,raw,context.clientResolution),checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 return {...scene,family:'research-legal-candidates',operation,contract,arguments:request,normalizationContext:context,page:sourcePage,
  visibleClientIds,transport,call,nativeReadContextPorts,handler:changes=>createResearchLegalCandidatesHandlers({...transport,now,...changes},[operation])[0].execute};
}
