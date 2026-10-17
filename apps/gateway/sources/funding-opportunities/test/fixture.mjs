/** Synthetic funding source DTOs over actual JSON HTTP bytes; no current backend, provider or native qualification. */
import schema from '../../../../../packages/contracts/retrieval-0.2/funding-opportunities.schema.json' with {type:'json'};
import {FUNDING_OPPORTUNITY_OPERATION_IDS} from '../../../../../packages/contracts/retrieval-0.2/funding-opportunities-validation.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../../dispatch/operation-result.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createFundingOpportunitiesHandlers} from '../handler.mjs';
export const ids=FUNDING_OPPORTUNITY_OPERATION_IDS;
export const clientId='a1234567-b123-4c12-8d12-e123456789ab',recordId='b1234567-b123-4c12-8d12-e123456789ab';
export const requests=Object.fromEntries(ids.map(id=>[id,[ids[0],ids[3]].includes(id)?{clientId}:{clientId,source:'sam_gov',sourceRecordId:recordId}]));
const counts=()=>({activeGrants:0,activeContracts:1,saved:null,pursuing:null,dismissed:null,deadlinesIn30Days:null});
export function brief(source='sam_gov',selectedRecord=recordId){return {ref:{source,sourceRecordId:selectedRecord},title:'Synthetic stored solicitation',agency:null,
 kind:'solicitation',isActive:true,isPursuable:true,responseDeadline:null,responseDeadlineNote:null,relevanceScore:null,
 eligibility:{state:'unknown',reason:'Not assessed'},recommendation:null,humanDecision:null,workflowStatus:null,sourceUrl:null,sourceUpdatedAt:null};}
export function facts(input,summary='Stored \u{1f680} notice'){
 const source=input.source??'sam_gov',sam=source==='sam_gov',offset=Math.min(input.summaryOffset??0,summary.length),text=summary.slice(offset,offset+(input.summaryLimit??1200)),end=offset+text.length;
 return {...brief(source,input.sourceRecordId??recordId),clientId:input.clientId,sourceReference:null,subAgency:null,office:null,status:null,kindRaw:null,baseKind:null,
  closeOrArchiveDate:null,postedDate:null,summary:text,summaryIsLink:false,naicsCodes:[],pscCodes:[],setAside:null,setAsideCode:null,setAsideDescription:null,
  eligibleApplicantTypes:[],fundingInstrument:null,category:null,assistanceListings:[],grantFunding:sam?null:{estimatedProgramFunding:null,awardFloor:null,awardCeiling:null,expectedAwardCount:null,costSharingRequired:null},
  contractValue:sam?{estimatedValue:null,basis:'not_stated_by_source'}:null,placeOfPerformance:null,acquisitionPosition:null,missingProfileFields:null,matchedSignals:[],districtKey:null,districtBasis:null,
  evidence:{recordRef:`${source}:${input.sourceRecordId??recordId}`,recommendationConfidence:null,confidenceMeaning:schema.$defs.FundingEvidence.properties.confidenceMeaning.const,
   disqualifiers:[],missingFields:['sourceUrl','sourceUpdatedAt','responseDeadline','placeOfPerformance',...(!sam?['eligibleApplicantTypes']:[]),...(!summary?['noticeText']:[])],
   requirements:{state:sam?'not_requested':'notice_body',tool:sam?ids[1]:ids[2]}},
  summaryRead:{state:summary?'available':'missing',offset,totalCharacters:summary.length,returnedCharacters:text.length,truncated:offset>0||end<summary.length,nextOffset:end<summary.length?end:null,sourceUpdatedAt:null}};
}
export function storedPage(id,input,asOf,generatedAt){
 const envelope=data=>({tool:id,state:'available',explanation:'Synthetic stored source report; no current producer qualification.',asOf,data});
 if(id===ids[0]){
  const sources=input.source?[input.source]:['grants_gov','sam_gov'],criteria={schemaVersion:2,mode:'matched',clientId:input.clientId,query:input.query,keywordTerms:[],sources,
   lifecycle:input.activeState==='all'?['active','closed','post_award']:[input.activeState],deadlineWindow:'any',deadlineFrom:null,deadlineTo:null,sort:'deadline',direction:'asc',page:input.page,pageSize:input.pageSize};
  for(const key of ['types','agencies','sectors','naicsCodes','pscCodes','setAsideCodes','eligibility','posted','geography','applicantTypes','funding','costShare','methods','disbursement','grantPrerequisites','codes'])criteria[key]=[];
  return envelope({clientId:input.clientId,counts:counts(),freshness:[],emptyReason:null,emptyExplanation:null,missingProfileFields:null,criteria,total:1,totalIsCapped:false,
   page:input.page,pageSize:input.pageSize,generatedAt,opportunities:[facts(input)],hasMore:false,nextPage:null,
   coverage:{sources,pageCoversMatchedResults:input.page===1,totalIsCapped:false,explanation:'Only canonical matched-page coverage; not the opportunity universe.',procurementForecasts:{state:'separate_tool',tool:'search_procurement_forecasts'}}});
 }
 if(id===ids[1])return envelope({source:input.source,sourceRecordId:input.sourceRecordId,
  requirements:[{id:'synthetic-requirement',attachmentId:null,requirementType:'submission',statement:'Synthetic reported condition',sourceExcerpt:'A\u{1f680}B',excerptStart:10,excerptEnd:14,
   sourcePage:null,fileName:null,extractionMethod:'model',extractionModel:'synthetic-extractor',confidence:'low',reviewStatus:'pending',supersededAt:null}],
  coverage:'available',coverageExplanation:'Reported extraction and tenant review remain separate.',documentTextStatus:[{fileName:null,status:'available',explanation:'Synthetic stored text'}],generatedAt:asOf,
  pagination:{offset:input.offset,limit:input.limit,total:input.offset+1,hasMore:false,nextOffset:null}});
 if(id===ids[2])return envelope(facts(input));
 if(id===ids[3])return envelope({clientId:input.clientId,counts:counts(),freshness:[],emptyReason:null,emptyExplanation:null,missingProfileFields:null,nextDeadline:null,topGrants:[],topContracts:[brief()]});
 if(id===ids[4])return envelope({fingerprint:'a'.repeat(64),coverage:{available:1,wired:3,declared:11},sources:schema.$defs.FundingLandscapeSource.enum.map(source=>({source,
  state:source==='program_element'?'available':['client_facility','congressional_district'].includes(source)?'empty':'not_wired',itemCount:source==='program_element'?1:0,explanation:'Synthetic source coverage'})),
  items:[{source:'program_element',sourceId:'synthetic-pe',label:'Stored inferred link',basis:'inferred',matchedOn:'Synthetic match',evidenceRef:null,asOf:null}]});
 throw Error('SYNTHETIC_OPERATION_MISMATCH');
}
export function storedCase(id=ids[0],options={}){
 if(!ids.includes(id))throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),{authority,state,now,wire}=scene;
 const normalizationContext={asOf:options.asOf??new Date(now()-1234).toISOString()},request=options.request??requests[id];
 const scope={tenantId:authority.binding.tenantId,kind:'client',resourceId:clientId,policyRevision:authority.policyRevision};
 Object.assign(authority.subject,{kind:'client',entityType:'client',entityIds:[clientId],scopes:[scope]});
 authority.claims.scopes=[scope];authority.decision.scopes=[scope];authority.decision.operation=`${id}@0.2.0`;
 authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const normalized=contract.normalizeInput(request,normalizationContext),page=storedPage(id,normalized.input,normalizationContext.asOf,new Date(now()-60000).toISOString());
 const {getCredentials,...passive}=scene.transport;
 const transport={...passive,credentialsForCall(selected,originalCall){state.credentialOwnerCalls??=[];state.credentialOwnerCalls.push({operation:selected,call:originalCall});
  if(state.resourceDenied)deny('ACCESS_DENIED');return getCredentials;
 },async fetchImpl(url,options){wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??page);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const call=(raw=request,current=authority,context=normalizationContext)=>{const normalized=contract.normalizeInput(raw,context);
  return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){if(signal?.aborted)throw Error('CANCELLED');
  return JSON.stringify({...proof,context:normalizationContext,checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 return {...scene,family:'funding-opportunities',operation,contract,arguments:request,normalizationContext,transport,page,call,nativeReadContextPorts,visibleClientIds:[clientId],
  handler:(changes={})=>createFundingOpportunitiesHandlers({...transport,now,...changes},[operation])[0].execute};
}
