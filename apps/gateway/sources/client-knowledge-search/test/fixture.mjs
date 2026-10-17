/** Synthetic semantic/graph DTOs across JSON HTTP; no installed bridge, SQL, embedding or provider. */
import schema from '../../../../../packages/contracts/retrieval-0.2/client-knowledge-search.schema.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {deny} from '../../../dispatch/operation-result.mjs';
import {createClientKnowledgeSearchHandlers} from '../handler.mjs';

export const id='query_knowledge_graph',clientId='99999999-9999-4999-8999-999999999999';
export const searchId='search_client_knowledge',ids=Object.freeze([searchId,id]);
export const asOf='2026-10-17T12:34:56.789Z';
export const graphErrors=schema.$defs.KnowledgeGraphOutput.oneOf[0].properties.error.enum;
export const emptyGraph=()=>({summary:schema.$defs.KnowledgeGraphOutput.oneOf[1].properties.summary.const,nodes:[],edges:[]});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
export function storedSearchPage(input,observedAt,{empty=false,unavailable=false,results}={}){
 const base={tool:searchId,generatedAt:observedAt,results:[]};
 if(!input.clientId)return {...base,note:'No client is linked to this conversation. Ask the user which client, or pass clientId.'};
 const selected={...base,clientId:input.clientId,clientName:'Synthetic client',query:input.query};
 if(unavailable)return {...selected,note:'Knowledge-base search is temporarily unavailable; fall back to get_client_context.'};
 const snippet='Synthetic stored knowledge with opaque <source> text.';
 return {...selected,results:results??(empty?[]:[{kind:input.kind??'client_doc_chunk',id:'opaque:synthetic/chunk',title:snippet.slice(0,110),snippet,score:0.75}])};
}
export const semanticPage=storedSearchPage;
export function storedCase(selected=id,options={}){
 if(!ids.includes(selected))throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const semantic=selected===searchId,request=options.request??(semantic?{query:' policy ',clientId}:{}),page=options.page;
 const scene=billTextCase(),operation={id:selected,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext=semantic?{asOf:options.asOf??asOf}:{};
 const {authority,state,now,wire}=scene,input=contract.normalizeInput(request,normalizationContext).input,visibleClientIds=input.clientId&&uuid.test(input.clientId)?[input.clientId.toLowerCase()]:[];
 if(visibleClientIds.length){const scope={tenantId:authority.binding.tenantId,kind:'client',resourceId:visibleClientIds[0],policyRevision:authority.policyRevision};
  Object.assign(authority.subject,{kind:'client',entityType:'client',entityIds:[visibleClientIds[0]],scopes:[scope]});authority.claims.scopes=[scope];authority.decision.scopes=[scope];}
 authority.decision.operation=`${selected}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const nodes=[{id:`client:${input.clientId??clientId}`,type:'client',label:'Synthetic client'},{id:'bill:synthetic-bill',type:'bill',label:'Synthetic bill'}];
 const received=page??(semantic?storedSearchPage(input,normalizationContext.asOf):input.clientId&&!uuid.test(input.clientId)?{error:graphErrors[0]}:
  input.clientId&&input.seed?.startsWith('client:')&&input.seed!==`client:${input.clientId}`?{error:graphErrors[1]}:
  {summary:`2 nodes, 1 connections${input.seed?` within ${input.depth} hop(s) of ${input.seed}`:''}. Edges tagged [fact]=from firm data, [mention]=from analyst notes.`,nodes,
   connections:['Synthetic client (client) --tracks[fact]--> Synthetic bill (bill)']});
 const {getCredentials,...passive}=scene.transport;
 const transport={...passive,...(semantic?{credentialsForCall(selected,originalCall){
  state.credentialOwnerCalls??=[];state.credentialOwnerCalls.push({operation:selected,call:originalCall});if(state.resourceDenied)deny('ACCESS_DENIED');return getCredentials;
 }}:{getCredentials}),async fetchImpl(url,options){
  wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??received);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();
  return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');
  return JSON.stringify({...proof,context:normalizationContext,checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(raw=request,current=authority,context=normalizationContext)=>{const normalized=contract.normalizeInput(raw,context);return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};};
 return {...scene,family:'client-knowledge-search',operation,contract,arguments:request,normalizationContext,transport,page:received,call,visibleClientIds,nativeReadContextPorts,
  handler:(changes={})=>createClientKnowledgeSearchHandlers({...transport,now,...changes},[operation])[0].execute};
}
