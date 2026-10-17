/** Synthetic retained source/personnel JSON; no publisher intake, actor database, source parser or live year observation. */
import schema from '../../../../../packages/contracts/retrieval-0.2/research-legal-news.schema.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createResearchLegalNewsHandlers} from '../handler.mjs';
import {newsSliceContext} from '../request-context.mjs';

export const ids=['search_legiwatch_news'];
export const requests={search_legiwatch_news:{view:'source',kind:'news',id:'synthetic-source'}};
export const authorityNote=schema.$defs.ResearchLegalNewsOutput.properties.authority.const;
export const personnelNotice=schema.$defs.ResearchLegalNewsPersonnelPage.properties.notice.const;
export function person(input,at,id='synthetic-person'){
 return {id,source_key:`source-${id}`,revision:'synthetic-revision',kind:input.kind,name:'Synthetic source name',branch:input.branch||null,
  registration_year:input.year,firm:null,principal:null,old_role:null,new_role:null,announced_date:null,effective_date:null,
  withdrawal_date:'Withdrawal wording only',confirmation:'Unconfirmed source wording',canonical_person_id:null,directory_url:null,
  source_url:'https://source.example.invalid/personnel',receipt_id:'synthetic-receipt',payload:null,observed_at:new Date(at).toISOString(),
  saved:false,tracking_version:null};
}
export function storedPage(id,input,at){
 const stamp=new Date(at).toISOString();let result;
 if(input.view==='personnel')result={items:[person(input,at)],nextOffset:null,year:input.year,notice:personnelNotice};
 else if(input.kind==='news')result={id:input.id,article_id:'synthetic-article',revision:'synthetic-revision',provider:'synthetic-provider',
  provider_id:null,original_url:'https://source.example.invalid/article',canonical_url:'https://source.example.invalid/article',publisher:'Synthetic publisher',
  author:null,provider_parsed_at:null,title:'Synthetic source title',summary:null,body:null,body_complete:false,language:null,publisher_country:null,
  article_geography:null,published_at:null,publication_precision:'source wording',observed_at:stamp,source_url:'https://source.example.invalid/article',
  rights:'headline_link',is_current:true,sourceUrl:'https://source.example.invalid/article',text:'Synthetic source title',observedAt:stamp,
  complete:false,authority:'Attributed publisher reporting'};
 else if(input.kind==='budget')result={id:input.id,publisher:'Synthetic fiscal publisher',source_url:'https://source.example.invalid/budget',
  content_hash:'synthetic-hash',title:'Synthetic budget source',fiscal_year:'2026-27',session_key:'2026',chamber:'stored',stage:'proposal',role:'stored',
  offer:null,publication_date:null,observed_at:stamp,receipt_id:'synthetic-receipt',sections:[{text:'First section'},{text:'Second section'}],metadata:null,
  complete:false,revision:'synthetic-hash',sourceUrl:'https://source.example.invalid/budget',text:'First section\nSecond section',observedAt:stamp,
  authority:'Florida fiscal source: proposal',rights:'full_text'};
 else if(input.kind==='personnel'){
  const {saved,tracking_version,...row}=person({...input,kind:'change',year:null},at,input.id);
  result={...row,title:row.name,sourceUrl:row.source_url,text:'',observedAt:stamp,complete:true,authority:row.confirmation,rights:'full_text'};
 }else result={id:input.id,billId:'synthetic-bill',revision:'synthetic-revision',title:null,sourceUrl:'',text:'Stored source text',
  sections:[{locator:'page1',text:'Stored source text',hash:'synthetic-hash'}],observedAt:stamp,complete:false,authority:'Published legislative record',rights:'full_text'};
 return {tool:id,generatedAt:stamp,result,authority:authorityNote};
}
export function storedCase(id=ids[0],options={}){
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),request=options.request??requests[id];
 const normalizationContext=options.context??newsSliceContext(operation,request),normalized=contract.normalizeInput(request,normalizationContext),{authority,state,now,wire}=scene;
 const visibleClientIds=normalizationContext.clientResolution?[normalizationContext.clientResolution.clientId]:[];
 if(visibleClientIds.length){const scope={tenantId:authority.binding.tenantId,kind:'client',resourceId:visibleClientIds[0],policyRevision:authority.policyRevision};
  Object.assign(authority.subject,{kind:'client',entityType:'client',entityIds:[visibleClientIds[0]],scopes:[scope]});authority.claims.scopes=[scope];authority.decision.scopes=[scope];}
 authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const page=options.page??storedPage(id,normalized.input,now()),transport={...scene.transport,async fetchImpl(url,configuration){
  wire.push({url,options:configuration,body:JSON.parse(configuration.body)});const value=structuredClone(state.page??page);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const nativeReadContextPorts={async readCurrent({request:raw,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');return JSON.stringify({...proof,context:newsSliceContext(operation,raw,normalizationContext.clientResolution),checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(args=request,current=authority,context=newsSliceContext(operation,args,normalizationContext.clientResolution))=>{
  const selected=contract.normalizeInput(args,context);
  return {request:args,input:selected.input,argumentsSha256:selected.argumentsSha256,normalizationContext:context,authority:current};
 };
 return {...scene,family:'research-legal-news',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,visibleClientIds,
  handler:(changes={})=>createResearchLegalNewsHandlers({...transport,now,...changes},[operation])[0].execute};
}
