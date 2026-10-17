/** Source-shaped synthetic legal JSON; no ResearchService, provider, SQL or actual citation parser execution. */
import schema from '../../../../../packages/contracts/retrieval-0.2/research-legal-legislation.schema.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createResearchLegalLegislationHandlers} from '../handler.mjs';
import {legalSliceContext} from '../request-context.mjs';

export const ids=['search_legislative_research','get_legal_reference'];
export const requests={search_legislative_research:{sessionKey:'2026'},get_legal_reference:{view:'rules',noticeId:'synthetic-notice'}};
export const authorityNote=schema.$defs.ResearchLegalLegislationSearchOutput.properties.authority.const;
export const searchMessage=qualified=>schema.$defs.ResearchLegalSearchResult.properties.message.enum[qualified?0:1];
export const compilation=query=>({raw:query,parserVersion:'legiwatch-query-v1',status:'supported',
 ast:{kind:'term',value:query,wildcard:'none'},reasons:[],interpretation:query});
export function version(input,at,id='synthetic-document-a'){
 return {id,billId:input.billId??input.billIds?.[0]??'synthetic-bill',jurisdiction:input.scope.jurisdiction,
  sessionKey:input.scope.sessionKey,revision:'synthetic-revision',contentHash:'synthetic-content-hash',extractorVersion:'synthetic-extractor',
  sourceUrl:'https://source.example.invalid/document',kind:'text',publishedDate:'2026-01-01',observedAt:new Date(at).toISOString(),
  complete:false,title:'Synthetic retained source',isCurrent:true};
}
export function referenceRow(input,at){
 return {id:input.referenceId||'FL:statute:section:1:1.10',jurisdiction:input.scope.jurisdiction,code_kind:input.code||'statute',
  reference_kind:'section',chapter:'1',section:'1.10',subdivisions:[],identity:{source:'synthetic'},created_at:new Date(at).toISOString(),
  revision_id:null,edition:null,title:null,source_url:null,content_hash:null,extraction_hash:null,parser_version:null,sections:null,
  history_text:null,complete:null,coverage:null,observed_at:null};
}
export function storedPage(id,input,at){
 const scope=input.scope,stamp=new Date(at).toISOString();let result;
 if(id==='search_legislative_research'){
  const queried=input.query!=='',evidence={start:0,end:input.query.length,quote:input.query,expression:input.query};
  result={scope,items:[{...version(input,at),billTitle:'Synthetic bill',billIdentifier:'HB 1',sponsor:null,chamber:input.chamber||null,
   lastAction:null,versionType:input.versionStage==='all'?null:input.versionStage,
   excerpt:queried?evidence:{start:0,end:0,quote:''},evaluation:queried?{outcome:'match',complete:false,evidence:[evidence]}:null}],
   interpretedQuery:queried?compilation(input.query):null,versionPolicy:input.versionPolicy,searchedKinds:input.kind,scanned:1,cursor:null,
   coverage:{complete:false,reason:input.referenceId?'LEGAL_REFERENCE_CLASSIFICATION_NOT_QUALIFIED':'SOURCE_DOCUMENT_INVENTORY_NOT_QUALIFIED',
    manifestId:null,billIds:input.billIds,retainedVersionsOnly:true},message:searchMessage(false)};
  if(input.kind!=='all')result.items[0].kind=input.kind;
 }else if(input.view==='versions')result={scope,versions:[version(input,at)],complete:true,order:'source_identity_not_legislative_sequence'};
 else if(input.view==='rules')result={scope,rows:[{id:'synthetic-notice-revision',notice_id:input.noticeId||'synthetic-notice',
  payload:{stored:['opaque',null]},source_url:'https://source.example.invalid/notice',content_hash:'synthetic-hash',observed_at:stamp}],
  adopted:[],coverage:{complete:false,reason:'SELECTED_NOTICES_AND_HISTORY_ONLY'}};
 else result={scope,referenceId:input.referenceId,edition:input.edition,rows:[referenceRow(input,at)],related:[],
  coverage:{complete:false,reason:'SELECTED_INGESTED_REFERENCES_ONLY'}};
 return {tool:id,generatedAt:stamp,result,authority:authorityNote};
}
export function storedCase(id=ids[0],options={}){
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation);
 const {authority,state,now,wire}=scene,request=options.request??requests[id],normalizationContext=legalSliceContext(operation,request),normalized=contract.normalizeInput(request,normalizationContext);
 const visibleClientIds=normalizationContext.clientResolution?[normalizationContext.clientResolution.clientId]:[];
 if(visibleClientIds.length){const scope={tenantId:authority.binding.tenantId,kind:'client',resourceId:visibleClientIds[0],policyRevision:authority.policyRevision};
  Object.assign(authority.subject,{kind:'client',entityType:'client',entityIds:[visibleClientIds[0]],scopes:[scope]});authority.claims.scopes=[scope];authority.decision.scopes=[scope];}
 authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const page=options.page??storedPage(id,normalized.input,now()),transport={...scene.transport,async fetchImpl(url,configuration){
  wire.push({url,options:configuration,body:JSON.parse(configuration.body)});const value=structuredClone(state.page??page);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const nativeReadContextPorts={async readCurrent({request:raw,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');return JSON.stringify({...proof,context:legalSliceContext(operation,raw),checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(args=request,current=authority,context=legalSliceContext(operation,args))=>{
  const selected=contract.normalizeInput(args,context);
  return {request:args,input:selected.input,argumentsSha256:selected.argumentsSha256,normalizationContext:context,authority:current};
 };
 return {...scene,family:'research-legal-legislation',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,visibleClientIds,
  handler:(changes={})=>createResearchLegalLegislationHandlers({...transport,now,...changes},[operation])[0].execute};
}
