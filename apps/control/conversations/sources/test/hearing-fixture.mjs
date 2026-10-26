import {hash as digest} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import schema from '../../../../../packages/contracts/retrieval-0.2/public-domain-hearings.schema.json' with {type:'json'};
import {storedPage} from '../../../../gateway/sources/public-domain-hearings/test/fixture.mjs';
import {captureHearingClientSelection} from '../../../../gateway/sources/public-domain-hearings/request-context.mjs';
import {binding,scopes,at} from './fixture.mjs';
import {projectHearingSource,hearingReferenceId} from '../hearing-record.mjs';
export const operation={id:'search_committee_hearings',version:'0.2.0'},jsonHash=value=>digest('sha256',JSON.stringify(value),'hex');
export function hearingProof({view='published',part=0,large=false,ascii=false,wireOnly=false,text='Synthetic public record ',asOf=null,selectedScopes=scopes,clientId=view==='briefs'?scopes[0].resourceId:null,deliveryId='synthetic-hearing-source',mutate,args}={}){
 const padding=ascii?'x'.repeat(10000):'😀'.repeat(5000);
 let payload={id:'record',hash:'opaque revision',evidence:{text:text+(large?padding:'')},observed:at,date:'provider raw date',billId:null,kind:'official_transcript',current:true,eventId:'h',historical:asOf!==null,authority:'Published source version; bill agenda membership alone does not establish hearing occurrence'};
 if(view==='briefs'){
  const packet={schema:'legiwatch.published-record-brief.v1',label:'Brief based on published records',author:'Capiro',title:'Assessment',eventId:'h',runId:'run',clientId,folders:[],sourceHash:'opaque',cutoff:at,claims:[],records:[],observation:null,coverage:[],selectedObservationIds:[],provenance:{promptVersion:'published-record-brief-v1',clientContext:'applied'}};
  payload={kind:'capiro_published_record_brief',id:'record',seriesId:'series',version:1,createdAt:at,contentHash:jsonHash(packet),payload:packet,current:true,approvedAt:at,status:'reviewed',historical:asOf!==null,authority:'Capiro assessment; source citations retain separate publisher authority'};
 }
 if(view==='reconciliation')payload={kind:'capiro_record_reconciliation',id:'record',inputHash:'input',payload:{schema:'legiwatch.record-reconciliation.v1',event:{id:'h',title:'Hearing',jurisdiction:null,session:null,date:'2026-10-26',body:null,revision:0},records:[],sourceHash:'hash',claims:[],originalClaims:[],observation:null,cutoff:at,coverage:[],sourceSelections:[]},current:true,createdAt:at,assessments:[],historical:asOf!==null,authority:'Capiro assessment of the preserved captured account'};
 if(view!=='published'){
  const references=[{id:'source-record',hash:'source-hash',locator:'evidence.text'}];
  payload.payload.records=[{id:'source-record',billId:null,kind:'official_transcript',hash:'source-hash',identity:'Synthetic source',date:null,observedAt:at,evidence:{text:'Owner passage'},association:'explicit_event'}];
  payload.payload.claims=[{id:'owner-claim',text:'Owner passage',kind:'quote',scope:'hearing_event',billId:null,references}];
  if(large)payload.payload.records[0].evidence.text+=padding;
  if(view==='briefs')payload.contentHash=jsonHash(payload.payload);
  else payload.assessments=[{id:'assessment',claimId:'owner-claim',claimHash:jsonHash(payload.payload.claims[0]),outcome:'needs_review',rationale:'Owner assessment',supported:[],unresolved:['Review required'],references,requiresReview:true,ruleVersion:'synthetic-owner-rule',reviews:[{id:'review',createdAt:at,outcome:'needs_review',rationale:'Owner review',references,reviewer:'Synthetic owner'}]}];
 }
 const whole=structuredClone(payload),json=JSON.stringify(payload),contentHash=jsonHash(payload),key=view+':record';
 const cursor=n=>'hearing:'+Buffer.from(JSON.stringify({key,part:n,hash:contentHash})).toString('base64url');
 if(json.length>6500){const start=part*2000,end=Math.min(start+2000,json.length);payload={kind:'hearing_evidence_json_chunk',originalKind:whole.kind,id:'record',title:'Hearing evidence',sourceUrl:null,contentFormat:'json_fragment',text:json.slice(start,end),characterStart:start,characterEnd:end,totalCharacters:json.length,chunk:part+1,chunkCount:Math.ceil(json.length/2000),contentHash,note:schema.$defs.HearingJsonFragment.properties.note.const};}
 const record={domain:'hearings',recordId:`${key}:${contentHash}:${part}`,occurredAt:null,updatedAt:null,payload,provenance:{adapter:'hearings',sourceTable:view==='published'?'published_legislative_record':`intel_hearing_record_${view}`,sourceRecordId:'record',hearingId:'h',contentHash,historical:asOf!==null,...(view==='published'?{}:{tenantId:binding.tenantId})}};
 const more=payload.kind==='hearing_evidence_json_chunk'&&payload.characterEnd<json.length;
 const result=storedPage([record],{hasMore:more,requestedEntityCount:clientId?1:0,stopReason:more?'exact_version_continues':'exact_selected_version_complete_publisher_coverage_not_asserted'});
 if(more)result.coverage.sources[0].nextCursor=cursor(part+1);mutate?.(result);
 const arguments_=args??{recordsView:view,hearingId:'h',recordId:'record',...(clientId?{clientId}:{}),...(asOf?{asOf}:{}),...(part?{cursor:cursor(part)}:{})};
 const normalized=resolveOperationContract(operation).normalizeInput(arguments_,{tenantId:binding.tenantId,clientResolution:captureHearingClientSelection(arguments_)});
 const request={schemaVersion:'meri-native-general-reads/1',binding,operation,arguments:arguments_,deliveryId,installationId:'synthetic',executionCatalogSha256:'c'.repeat(64)};
 if(wireOnly)return {request,result,whole};
 const envelope={binding,subject:{tenantId:binding.tenantId,actorId:binding.actorId,scopes:selectedScopes,policyRevision:'policy1'},operation,argumentsSha256:normalized.argumentsSha256,result};
 const response={inputSha256:hash(request),resultSha256:hash(envelope),resultJson:JSON.stringify(envelope),executionSha256:'e'.repeat(64),policyRevision:'policy1'};
 const data=projectHearingSource({request,response,scopes:selectedScopes}),event=data===null?null:{contractVersion:'0.1.0',eventId:hearingReferenceId(binding,deliveryId),binding,sequence:4,createdAt:at,scopes:selectedScopes,type:'source.native-hearing-record',data};
 return {request,response,result,event,whole};
}
