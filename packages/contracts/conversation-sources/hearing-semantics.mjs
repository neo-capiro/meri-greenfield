import {fail,safeSourceLocator} from './semantics.mjs';
export const HEARING_SOURCE_EVENT='source.native-hearing-record';
// Compare JSON data without depending on JSONB object-key order.
const same=(a,b)=>a===b||a!==null&&b!==null&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
export function hearingLocation(payload){
 const fragment=payload.kind==='hearing_evidence_json_chunk',length=JSON.stringify(payload).length;
 return {part:fragment?payload.chunk-1:0,format:fragment?'json_fragment':'json',characterStart:fragment?payload.characterStart:0,
  characterEnd:fragment?payload.characterEnd:length,totalCharacters:fragment?payload.totalCharacters:length,contentComplete:!fragment};
}
export function assertHearingSourceEventSemantics(event){
 const {selection,source,page,coverage,policyRevision}=event.data,p=source.provenance;
 const table=selection.recordsView==='published'?'published_legislative_record':`intel_hearing_record_${selection.recordsView}`;
 if(event.type!==HEARING_SOURCE_EVENT||event.scopes.some(s=>s.tenantId!==event.binding.tenantId||s.policyRevision!==policyRevision)||
  p.hearingId!==selection.hearingId||p.sourceRecordId!==selection.recordId||p.sourceTable!==table||Object.hasOwn(p,'sourceKey')||p.historical!==(selection.asOf!==null)||
  (selection.recordsView==='published'?Object.hasOwn(p,'tenantId'):p.tenantId!==event.binding.tenantId)||
  source.recordId!==`${selection.recordsView}:${selection.recordId}:${p.contentHash}:${page.part}`)fail('INVALID_SOURCE_EVENT');
 if(selection.clientId!==null&&event.scopes.some(s=>s.kind==='client'&&s.resourceId!==selection.clientId))fail('INVALID_SOURCE_EVENT');
 if(page.characterStart>page.characterEnd||page.characterEnd>page.totalCharacters||page.contentComplete!==(page.format==='json')||
  (page.contentComplete?(page.part!==0||page.characterStart!==0||page.characterEnd!==page.totalCharacters||page.totalCharacters>6500):
   (page.totalCharacters<=6500||page.characterStart!==page.part*2000||page.characterEnd!==Math.min(page.characterStart+2000,page.totalCharacters))))fail('INVALID_SOURCE_EVENT');
 // Validate the admitted Core cursor, never manufacture a continuation token.
 if(page.part===0){if(selection.cursor!==null)fail('INVALID_SOURCE_EVENT');}
 else {try{if(!selection.cursor?.startsWith('hearing:'))fail('INVALID_SOURCE_EVENT');
   const bytes=Uint8Array.from(atob(selection.cursor.slice(8).replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
   const cursor=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(cursor.key!==`${selection.recordsView}:${selection.recordId}`||cursor.hash!==p.contentHash||cursor.part!==page.part)fail('INVALID_SOURCE_EVENT');
  }catch{fail('INVALID_SOURCE_EVENT');}}
 const c=coverage.sources[0],more=page.characterEnd<page.totalCharacters;
 if(coverage.complete!==false||coverage.recordsReturned!==1||c.returned!==1||c.sourceStatus!=='degraded'||c.coverageComplete!==false||c.hasMore!==more||c.paginationComplete===more||coverage.paginationComplete===more)fail('INVALID_SOURCE_EVENT');
 return event;
}
export function assertHearingSourceReadSemantics(response,request){
 const event=assertHearingSourceEventSemantics(response.event),d=event.data,current=response.current,result=current.result,record=result.records[0];
 if(request.schemaVersion!=='meri.hearing-source-read/1'||event.eventId!==request.referenceId||event.binding.conversationId!==request.conversationId||event.binding.runId!==request.runId)fail('SOURCE_REQUEST_MISMATCH');
 const {payloadSha256,...location}=d.page;
 if(result.records.length!==1||!same({recordId:record.recordId,provenance:record.provenance},d.source)||!same(hearingLocation(record.payload),location)||!same(result.coverage,d.coverage))fail('SOURCE_PAGE_MISMATCH');
 if(current.linkStatus==='available'?current.sourceLocator===null||safeSourceLocator(current.sourceLocator)!==current.sourceLocator:current.sourceLocator!==null)fail('UNSAFE_SOURCE_URL');
 return response;
}
