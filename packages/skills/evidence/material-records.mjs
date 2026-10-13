/** Finite native body projections. Candidate metadata never becomes a material record. */
export function materialSections(result,sourceId,subject) {
 const out=[];
 const add=(value)=>out.push({...value,sourceId,scopes:value.scopes??subject.scopes});
 if(sourceId==='mail'&&result.kind==='mail-thread-source-page')for(const row of result.messages??[]){
  if(row.bodyCompleteness!=='full'||!row.recordVersionId||!row.contentSha256||!row.citationId||row.section?.text===null||row.section?.totalCodeUnits===null)continue;
  add({recordId:row.messageId,recordVersionId:row.recordVersionId,contentSha256:row.contentSha256,citationId:row.citationId,scopes:row.scopes,text:row.section.text,start:row.section.start,end:row.section.endExclusive,total:row.section.totalCodeUnits,metadata:{mailboxId:row.mailboxId,threadId:row.threadId,materialKind:'mail-body',citationKind:'source',versionKind:'source-version'}});
 }
 if(sourceId==='meetings'){
  if(result.kind==='meeting-source-body-page'&&result.source){const row=result.source,p=row.provenance,b=row.bodyCoverage;
   if(row.availability==='available'&&p?.sourceVersion&&p.bodySha256&&b?.totalCharacters!==null&&typeof row.body==='string')add({recordId:row.sourceId,recordVersionId:p.sourceVersion,contentSha256:p.bodySha256,citationId:`meetings:${row.sourceId}:${p.sourceVersion}`,text:row.body,start:b.characterStart,end:b.characterEnd,total:b.totalCharacters,metadata:{meetingId:row.meetingId,sourceKind:row.sourceKind,sourceUpdatedAt:row.updatedAt,materialKind:'meeting-source',citationKind:'derived-locator',versionKind:'source-version'}});
  }
  if(result.kind==='debrief-source-page')for(const row of result.debriefs??[]){const p=row.provenance,b=row.bodyCoverage;
   if(p?.sourceVersion&&p.bodySha256&&b?.totalCharacters!==null&&typeof row.body==='string')add({recordId:p.sourceRecordId,recordVersionId:p.sourceVersion,contentSha256:p.bodySha256,citationId:`meetings:${p.sourceRecordId}:${p.sourceVersion}`,text:row.body,start:b.characterStart,end:b.characterEnd,total:b.totalCharacters,metadata:{meetingId:row.meetingId,sourceKind:'debrief',sourceUpdatedAt:row.updatedAt,materialKind:'meeting-debrief',citationKind:'derived-locator',versionKind:'source-version'}});
  }
 }
 if(sourceId==='client_documents'&&result.data?.coverage?.sectionCharacters!==undefined){const d=result.data,c=d.coverage;
  for(const row of d.records??[]){const p=row.provenance,b=row.payload;
   if(!p?.contentHash||!p.sectionHash||typeof b?.text!=='string'||c.sectionCharacters===null)continue;
   // Original file bytes and extracted text are different hashes. This is a disclosed
   // content-addressed extraction identity, never an invented native revision ID.
   add({recordId:`${p.sourceRecordId}:section:${p.section}`,recordVersionId:`extraction:${p.contentHash}:${p.sectionHash}:${p.section}`,contentSha256:p.sectionHash,citationId:row.recordId,text:b.text,start:p.characterStart,end:p.characterEnd,total:c.sectionCharacters,metadata:{documentId:p.sourceRecordId,section:p.section,originalDocumentSha256:p.contentHash,materialKind:'stored-extracted-section',citationKind:'source-range-locator',versionKind:'content-addressed-extraction',visualCoverage:false,trust:p.trust}});
  }
 }
 return out;
}
