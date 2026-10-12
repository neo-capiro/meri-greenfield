// Source-only full hearing projection. No source reads, decryption, parser,
// producer clock, cursor implementation or current authorization is installed.
import {createHash} from 'node:crypto';
import {snapshotOperationData} from './operation-contracts.mjs';
import {assertPublicDataInstant} from './public-data-deadlines.mjs';
const ID='search_committee_hearings',URN='urn:meri:retrieval:public-domain-hearings:0.2.0';
export const PUBLIC_DOMAIN_HEARINGS_OPERATION_IDS=Object.freeze([ID]);
const fail=m=>{throw Error(m);};
const hash=x=>createHash('sha256').update(x).digest('hex');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const instant=x=>{assertPublicDataInstant(x);return Date.parse(x);};
const ordinary=Object.freeze({committee_hearing:['hearing','event'],official_hearing_transcript:['official_transcript_chunk','official'],public_hearing_transcript_segment:['machine_transcript_segment','segment'],public_hearing_insight:['hearing_intelligence','insight'],tenant_hearing_relevance:['client_hearing_relevance','relevance']});
const attribution=['id','hearingId','captureId','segmentId','sequence','startMs','endMs','speakerLabel','speakerName','speakerConfidence','transcriptionConfidence','confidence','preliminary','isOfficialTranscript','derivedFromMachineTranscript','hasGapBefore','revision','date','publishedAt','fetchedAt','syncedAt'];
export function createPublicDomainHearingsValidators({validateShape,schema}){
 if(typeof validateShape!=='function'||schema?.$id!==URN||!schema.$defs)fail('Hearing validator configuration');
 const names=new Set(Object.keys(schema.$defs)),operation=id=>{if(id!==ID)fail('Unknown hearing operation');};
 function publicDomainHearingsInputDefinition(id){operation(id);return 'PublicDomainHearingsInput';}
 function publicDomainHearingsOutputDefinition(id){operation(id);return 'PublicDomainHearingsOutput';}
 function validatePublicDomainHearingsShape(name,value){if(typeof name!=='string'||!names.has(name))fail('Unknown hearing definition');const x=snapshotOperationData(value);validateShape(name,x);return x;}
 function selection(id,request,options){
  operation(id);const raw=validatePublicDomainHearingsShape('PublicDomainHearingsRequest',request),ctx=validatePublicDomainHearingsShape('PublicDomainHearingsContext',options);
  const str=(key,max)=>raw[key]?.trim().slice(0,max)||null;
  const selected=str('clientId',80)?.trim()||null,r=ctx.clientResolution;let clientId=null;
  if(selected===null){if(r!==null)fail('Absent hearing client cannot carry resolution');}
  else {if(r===null||r.reference!==selected||UUID.test(selected)&&selected.toLowerCase()!==r.clientId.toLowerCase())fail('Hearing client resolution differs');clientId=r.clientId.toLowerCase();}
  const recordsView=str('recordsView',32),asOf=str('asOf',60);
  if(recordsView!==null&&!['published','briefs','reconciliation'].includes(recordsView))fail('Unknown published hearing view');
  if(asOf!==null&&(recordsView===null||!Number.isFinite(Date.parse(asOf))))fail('Valid historical hearing timestamp required');
  const input={query:str('query',240)?.trim()||null,hearingId:str('hearingId',200),chamber:str('chamber',20),committeeName:str('committeeName',200)??str('committee',200),cursor:str('cursor',1024),clientId,recordsView,recordId:recordsView===null?null:str('recordId',200),asOf:asOf===null?null:new Date(asOf).toISOString()};
  validateShape('PublicDomainHearingsInput',input);return {input,ctx};
 }
 function normalizePublicDomainHearingsInput(id,request,options){const {input}=selection(id,request,options);return freeze({input,metadata:{sourceConnected:false,producerQualified:false,authorizationEstablished:false,coverageComplete:false,browserSessionMaterialSupported:false,cursorQualified:false,publishedContinuationQualified:false,absenceEvidence:false}});}
 function privatePayload(payload,input){
  const historical=input.asOf!==null;
  if(payload.historical!==historical)fail('Hearing historical projection differs');
  if(payload.kind==='capiro_published_record_brief'){
   if(payload.payload.eventId!==input.hearingId||payload.id!==input.recordId||input.clientId===null||payload.payload.clientId!==input.clientId)fail('Private hearing brief subject differs');
   if(payload.contentHash!==hash(JSON.stringify(payload.payload)))fail('Private brief declared JSON content hash differs');
   const created=instant(payload.createdAt),approved=instant(payload.approvedAt);
   if(historical){if(created>instant(input.asOf)||approved>instant(input.asOf))fail('Brief observation after selected cutoff');}
   else if(!payload.current||payload.status!=='reviewed')fail('Current reviewed brief projection required');
  }else{
   if(payload.id!==input.recordId||payload.payload.event.id!==input.hearingId)fail('Private reconciliation identity differs');
   const client=payload.payload.observation?.clientId;
   if(client&&client!==input.clientId)fail('Private observation subject differs');
   if(historical?instant(payload.createdAt)>instant(input.asOf):!payload.current)fail('Reconciliation current/cutoff differs');
   for(const assessment of payload.assessments)for(const review of assessment.reviews)if(historical&&instant(review.createdAt)>instant(input.asOf))fail('Review after historical cutoff');
  }
 }
 function assertPublicDomainHearingsOutput(id,value,request,options){
  const {input,ctx}=selection(id,request,options),page=validatePublicDomainHearingsShape('PublicDomainHearingsOutput',value),c=page.coverage,s=c.sources[0],o=page.observability;
  if(s.sourceStatus==='healthy'||s.returned!==page.records.length||c.recordsReturned!==s.returned||c.recordsEvaluated!==s.recordsEvaluated||c.requestedEntityCount!==s.requestedEntityCount||c.searchedEntityCount!==s.searchedEntityCount||c.paginationComplete!==s.paginationComplete)fail('Hearing coverage projection differs');
  const searched=s.pagesRead>0||s.recordsEvaluated>0,unavailable=['unavailable','unauthorized','unsupported','error'].includes(s.sourceStatus);
  if(JSON.stringify(c.searchedDomains)!==JSON.stringify(searched?['hearings']:[])||JSON.stringify(c.unavailableSources)!==JSON.stringify(unavailable?['hearings']:[]))fail('Hearing searched/unavailable domains differ');
  const reason=unavailable?'source_unavailable_or_unsupported':s.requestedEntityCount!==0&&s.searchedEntityCount<s.requestedEntityCount?'requested_entity_scope_incomplete':!s.paginationComplete?'pagination_incomplete':s.truncated||s.hasMore?'truncated':s.sourceStatus==='degraded'?'source_degraded':'coverage_not_proven';
  if(c.stopReason!==reason||o.stopReason!==reason||o.requestedEntityCount!==s.requestedEntityCount||o.queriedEntityCount!==s.searchedEntityCount||o.pagesByDomain.hearings!==s.pagesRead||o.sourceHealth.hearings!==s.sourceStatus||JSON.stringify(o.queriedDatasets)!==JSON.stringify(c.searchedDomains)||o.freshnessByDomain.hearings!==(s.lastSyncAt??null))fail('Hearing observability differs from coverage');
  if(s.hasMore&&(!s.nextCursor||s.paginationComplete)||!s.hasMore&&Object.hasOwn(s,'nextCursor'))fail('Hearing continuation envelope differs');
  if(unavailable&&page.records.length)fail('Unavailable hearing source cannot return records');
  for(const record of page.records){
   const p=record.payload,prov=record.provenance,fragment=p.kind==='hearing_evidence_json_chunk';
   for(const time of [record.occurredAt,record.updatedAt])if(time!==null)instant(time);
   if(s.sourceStatus!=='degraded'||s.pagesRead!==1)fail('Retained hearing records require degraded one-page observation');
   if(input.hearingId!==null&&prov.hearingId!==input.hearingId)fail('Hearing provenance event substitution');
   const privateSource=['tenant_hearing_relevance','intel_hearing_record_briefs','intel_hearing_record_reconciliation'].includes(prov.sourceTable);
   if(privateSource?prov.tenantId!==ctx.tenantId:Object.hasOwn(prov,'tenantId'))fail('Hearing declared tenant provenance differs');
   if(fragment){
    if(Object.hasOwn(p,'id')&&p.id!==prov.sourceRecordId)fail('Hearing fragment copied identity differs');
    if(p.contentHash!==prov.contentHash||p.text.length!==p.characterEnd-p.characterStart||p.characterStart!==(p.chunk-1)*2000||p.characterEnd!==Math.min(p.characterStart+2000,p.totalCharacters)||p.chunkCount!==Math.ceil(p.totalCharacters/2000)||p.chunk>p.chunkCount||p.title.length>240||p.originalKind!==null&&p.originalKind.length>80||p.sourceUrl!==null&&p.sourceUrl.length>1000)fail('Hearing JSON fragment bounds differ');
    for(const key of attribution)if(typeof p[key]==='string'&&p[key].length>240)fail('Hearing fragment attribution exceeds source bound');
   }else if(JSON.stringify(p).length>6500||hash(JSON.stringify(p))!==prov.contentHash)fail('Whole hearing JSON/hash projection differs');
   if(input.recordsView===null){
    if(!Object.hasOwn(ordinary,prov.sourceTable)||typeof prov.sourceKey!=='string'||Object.hasOwn(prov,'historical'))fail('Ordinary hearing provenance differs');
    const [kind,prefix]=ordinary[prov.sourceTable];
    if((fragment?p.originalKind:p.kind)!==kind||!prov.sourceKey.startsWith(prefix+':'))fail('Ordinary hearing payload/source family differs');
    if(p.id!==undefined&&p.id!==prov.sourceRecordId)fail('Hearing source record identity differs');
    if(!fragment){
     const expectedKey=prefix+':'+p.id+(p.kind==='official_transcript_chunk'?':'+String(p.characterStart/6000).padStart(10,'0'):'');
     if(prov.sourceKey!==expectedKey)fail('Whole hearing source key differs from projected identity');
     const hearing=p.kind==='hearing'?p.id:p.hearingId;if(hearing!==prov.hearingId)fail('Hearing payload event differs');
     if(p.kind==='client_hearing_relevance'&&input.clientId!==null&&p.clientId!==input.clientId)fail('Hearing relevance selected client differs');
     if(p.kind==='official_transcript_chunk'){
      if(p.characterStart%6000!==0||p.characterEnd!==Math.min(p.characterStart+6000,p.totalCharacters)||[...p.text].length!==p.characterEnd-p.characterStart||p.chunkCount!==Math.floor((p.totalCharacters+5999)/6000))fail('Official SQL-character chunk bounds differ');
     }
    }
    const part=fragment?p.chunk-1:undefined;
    const expected=part===undefined&&prov.sourceKey.length<=80?prov.sourceKey:`hearing:${hash(prov.sourceKey).slice(0,16)}:${prov.contentHash.slice(0,12)}:${part??0}`;
    if(record.recordId!==expected)fail('Hearing compact record identity differs');
   }else{
    const table=input.recordsView==='published'?'published_legislative_record':`intel_hearing_record_${input.recordsView}`;
    if(!input.hearingId||!input.recordId||prov.sourceTable!==table||prov.sourceRecordId!==input.recordId||Object.hasOwn(prov,'sourceKey')||prov.historical!==(input.asOf!==null)||record.occurredAt!==null||record.updatedAt!==null)fail('Exact hearing version provenance differs');
    const part=fragment?p.chunk-1:0,key=`${input.recordsView}:${input.recordId}`;
    if(record.recordId!==`${key}:${prov.contentHash}:${part}`)fail('Exact hearing version record identity differs');
    if(!fragment){
     if(input.recordsView==='published'){
      if(p.id!==input.recordId||p.eventId!==input.hearingId||p.historical!==(input.asOf!==null)||input.asOf===null&&!p.current||input.asOf!==null&&instant(p.observed)>instant(input.asOf))fail('Published hearing selected version differs');
     }else {const kind=input.recordsView==='briefs'?'capiro_published_record_brief':'capiro_record_reconciliation';if(p.kind!==kind)fail('Private hearing record branch differs');privatePayload(p,input);}
    }else if(input.recordsView!=='published'&&p.originalKind!==(input.recordsView==='briefs'?'capiro_published_record_brief':'capiro_record_reconciliation'))fail('Private hearing fragment branch differs');
   }
  }
  return page;
 }
 return Object.freeze({publicDomainHearingsSchemaId:URN,PUBLIC_DOMAIN_HEARINGS_OPERATION_IDS,publicDomainHearingsInputDefinition,publicDomainHearingsOutputDefinition,validatePublicDomainHearingsShape,normalizePublicDomainHearingsInput,assertPublicDomainHearingsOutput});
}
