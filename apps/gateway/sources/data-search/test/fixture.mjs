/** Synthetic governed-retrieval DTOs and correlated credential ports; no Core or source qualification. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createDataSearchHandlers} from '../handler.mjs';

export const id='search_capiro_data',ids=[id];
export const request={query:'synthetic work',domains:['strategies_work','mail'],pageSize:2};
export const continuation='SYNTHETIC_OPAQUE_SOURCE_CURSOR:page-2';

export function storedPage(input,at){
 const domains=input.domains,first=domains[0],stamp=new Date(at).toISOString();
 const sources=domains.map((domain,index)=>({
  domain,sourceStatus:index===0?'healthy':'unavailable',returned:index===0?1:0,recordsEvaluated:index===0?3:0,
  requestedEntityCount:0,searchedEntityCount:0,pagesRead:index===0?1:0,hasMore:index===0,truncated:false,
  paginationComplete:false,coverageComplete:false,...(index===0?{nextCursor:continuation,lastSyncAt:stamp}:{}),
  stopReason:index===0?'page_size_reached':'mailbox_not_connected',
 }));
 return {tool:id,records:[{
  domain:first,recordId:'synthetic-record-1',occurredAt:stamp,updatedAt:null,
  payload:{title:'Synthetic source record',nested:{values:[1,'two',false,null]}},
  provenance:{source:'synthetic-source',recordId:'synthetic-record-1',lineage:{opaque:['stored',1]}},
 }],coverage:{
  requestedDomains:domains,searchedDomains:[first],requestedEntityCount:0,searchedEntityCount:0,
  recordsEvaluated:3,recordsReturned:1,paginationComplete:false,unavailableSources:domains.slice(1),sources,
  complete:false,stopReason:'source_coverage_incomplete',
 },observability:{
  queryClass:input.queryClass,requestedDomains:domains,queriedDatasets:[...domains],requestedEntityCount:0,queriedEntityCount:0,
  pagesByDomain:Object.fromEntries(sources.map(source=>[source.domain,source.pagesRead])),
  sourceHealth:Object.fromEntries(sources.map(source=>[source.domain,source.sourceStatus])),
  freshnessByDomain:Object.fromEntries(domains.map((domain,index)=>[domain,index===0?stamp:null])),
  coverageComplete:false,stopReason:'source_coverage_incomplete',
 }};
}

export function storedCase(selected=id,options={}){
 if(selected!==id)throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext={};
 const {authority,state,now,wire}=scene,original=options.request??request,input=contract.normalizeInput(original,{}).input;
 authority.decision.operation=`${id}@0.2.0`;
 authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const page=options.page??storedPage(input,now()),transport={...scene.transport,async fetchImpl(url,configuration){
  wire.push({url,options:configuration,body:JSON.parse(configuration.body)});
  const value=structuredClone(state.page??page);state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();
  return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');
  return JSON.stringify({...proof,context:{},checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(args=original,current=authority,context={})=>{
  const normalized=contract.normalizeInput(args,context);
  return {request:args,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};
 };
 return {...scene,family:'data-search',operation,contract,arguments:original,normalizationContext,transport,page,nativeReadContextPorts,call,
  handler:(changes={})=>createDataSearchHandlers({...transport,now,...changes},[operation])[0].execute};
}
