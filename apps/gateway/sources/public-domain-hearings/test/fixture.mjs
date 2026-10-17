/** Synthetic complete hearing carrier across actual HTTP JSON. No ContextPlane, SQL or provider calls. */
import {createHash} from 'node:crypto';
import schema from '../../../../../packages/contracts/retrieval-0.2/public-domain-hearings.schema.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {captureHearingClientSelection} from '../request-context.mjs';
import {createPublicDomainHearingsHandlers} from '../handler.mjs';

export const id='search_committee_hearings',clientId='99999999-9999-4999-8999-999999999999',at='2026-10-12T12:00:00.000Z';
export const jsonHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const continuation='SYNTHETIC_OPAQUE_HEARING_CURSOR';
export function payload(kind='hearing'){
 if(kind==='hearing')return {kind,id:'synthetic-hearing',title:'Synthetic hearing',committee:'Committee',chamber:'House',congress:119,date:'2026-10-12',startsAt:null,timezone:'America/New_York',eventStatus:'stored',coverageStatus:'partial',sourceUrl:null,witnesses:[],sourceRevision:1,lastOfficialUpdateAt:null,syncedAt:at};
 if(kind==='official_transcript_chunk')return {kind,id:'synthetic-official',hearingId:'synthetic-hearing',title:'Synthetic transcript',date:'2026-10-12',congress:119,chamber:'House',sourceUrl:'https://evidence.example.invalid/official',publishedAt:null,fetchedAt:at,text:'😀A',characterStart:0,characterEnd:2,totalCharacters:2,chunkCount:1,textIsCompleteChunk:true,isOfficialTranscript:true};
 if(kind==='machine_transcript_segment')return {kind,id:'synthetic-segment',hearingId:'synthetic-hearing',captureId:'synthetic-capture',sequence:1,startMs:0,endMs:1000,text:'Synthetic segment',speakerLabel:null,speakerConfidence:null,transcriptionConfidence:null,hasGapBefore:true,revision:1,sourceUrl:null,isOfficialTranscript:false,captureStatus:'stored',transcriptGapSeconds:2};
 if(kind==='hearing_intelligence')return {kind,id:'synthetic-insight',hearingId:'synthetic-hearing',segmentId:'synthetic-segment',startMs:0,endMs:1000,insightType:'stored',title:'Synthetic assessment',summary:'Assessment',evidenceText:null,speakerName:null,confidence:null,preliminary:true,entities:null,sourceUrl:null,derivedFromMachineTranscript:true};
 return {kind:'client_hearing_relevance',id:'synthetic-relevance',clientId,hearingId:'synthetic-hearing',insightId:'synthetic-insight',score:0.75,matchedOn:null,rationale:'Synthetic assessment',updatedAt:at};
}
const sources={hearing:['committee_hearing','event'],official_transcript_chunk:['official_hearing_transcript','official'],machine_transcript_segment:['public_hearing_transcript_segment','segment'],hearing_intelligence:['public_hearing_insight','insight'],client_hearing_relevance:['tenant_hearing_relevance','relevance']};
function canonicalTenant(value,old,seen=new Set()){
 if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
 for(const [key,next] of Object.entries(value))if(next===old)value[key]='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';else canonicalTenant(next,old,seen);
}
export function record(value=payload(),tenantId){
 const [sourceTable,prefix]=sources[value.kind],sourceKey=`${prefix}:${value.id}${value.kind==='official_transcript_chunk'?':0000000000':''}`;
 return {domain:'hearings',recordId:sourceKey,occurredAt:null,updatedAt:at,payload:value,provenance:{adapter:'hearings',sourceTable,sourceRecordId:value.id,hearingId:value.kind==='hearing'?value.id:value.hearingId,contentHash:jsonHash(value),sourceKey,...(value.kind==='client_hearing_relevance'?{tenantId}:{})}};
}
export function fragmentRecord(){
 const contentHash='a'.repeat(64),sourceKey='event:synthetic-hearing',value={kind:'hearing_evidence_json_chunk',originalKind:'hearing',id:'synthetic-hearing',title:'Synthetic hearing',sourceUrl:null,contentFormat:'json_fragment',text:'x'.repeat(1999)+'\ud83d',characterStart:0,characterEnd:2000,totalCharacters:7000,chunk:1,chunkCount:4,contentHash,note:schema.$defs.HearingJsonFragment.properties.note.const};
 return {domain:'hearings',recordId:`hearing:${createHash('sha256').update(sourceKey).digest('hex').slice(0,16)}:${contentHash.slice(0,12)}:0`,occurredAt:null,updatedAt:at,payload:value,provenance:{adapter:'hearings',sourceTable:'committee_hearing',sourceRecordId:value.id,hearingId:value.id,contentHash,sourceKey}};
}
export function storedPage(records=[],{sourceStatus='degraded',hasMore=false,requestedEntityCount=0,stopReason}={}){
 const unavailable=['unavailable','unauthorized','unsupported','error'].includes(sourceStatus),pagesRead=unavailable?0:1,paginationComplete=!hasMore&&!unavailable;
 const source={domain:'hearings',sourceStatus,returned:records.length,recordsEvaluated:records.length,pagesRead,requestedEntityCount,searchedEntityCount:unavailable?0:requestedEntityCount,hasMore,...(hasMore?{nextCursor:continuation}:{}),truncated:hasMore,paginationComplete,coverageComplete:false,
  stopReason:stopReason??(unavailable?'source_unavailable':hasMore?'page_boundary_reached_browser_session_rail_not_supported':'stored_public_and_official_hearings_complete_browser_session_rail_not_supported')};
 const reason=unavailable?'source_unavailable_or_unsupported':hasMore?'pagination_incomplete':'source_degraded',searchedDomains=pagesRead?['hearings']:[];
 return {tool:id,records,coverage:{requestedDomains:['hearings'],searchedDomains,requestedEntityCount,searchedEntityCount:source.searchedEntityCount,recordsEvaluated:source.recordsEvaluated,recordsReturned:records.length,paginationComplete,unavailableSources:unavailable?['hearings']:[],sources:[source],complete:false,stopReason:reason},
  observability:{queryClass:'lookup',requestedDomains:['hearings'],queriedDatasets:searchedDomains,requestedEntityCount,queriedEntityCount:source.searchedEntityCount,pagesByDomain:{hearings:pagesRead},sourceHealth:{hearings:sourceStatus},freshnessByDomain:{hearings:null},coverageComplete:false,stopReason:reason},note:schema.$defs.PublicDomainHearingsOutput.properties.note.const};
}
export function storedCase(selected=id,options={}){
 if(selected!==id)throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),request=options.request??{},resolution=options.context?.clientResolution??captureHearingClientSelection(request);
 canonicalTenant(scene,scene.binding.tenantId);
 const {authority,state,now,wire}=scene,normalizationContext=options.context??{tenantId:authority.binding.tenantId,clientResolution:resolution},visibleClientIds=resolution?[resolution.clientId]:[];
 if(resolution){const scope={tenantId:authority.binding.tenantId,kind:'client',resourceId:resolution.clientId,policyRevision:authority.policyRevision};Object.assign(authority.subject,{kind:'client',entityType:'client',entityIds:[resolution.clientId],scopes:[scope]});authority.claims.scopes=[scope];authority.decision.scopes=[scope];}
 authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const page=options.page??storedPage([record(payload(),authority.binding.tenantId)],{requestedEntityCount:resolution?1:0});
 const transport={...scene.transport,async fetchImpl(url,configuration){wire.push({url,options:configuration,body:JSON.parse(configuration.body)});const value=structuredClone(state.page??page);state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);}};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){if(signal?.aborted)throw Error('CANCELLED');return JSON.stringify({...proof,context:normalizationContext,checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});}};
 const call=(raw=request,current=authority,context=normalizationContext)=>{const normalized=contract.normalizeInput(raw,context);return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};};
 return {...scene,family:'public-domain-hearings',operation,contract,arguments:request,normalizationContext,transport,page,call,visibleClientIds,nativeReadContextPorts,handler:(changes={})=>createPublicDomainHearingsHandlers({...transport,now,...changes},[operation])[0].execute};
}
