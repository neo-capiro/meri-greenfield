/** Exact UTF-16 sections of a retained message. Preview and partial text never become evidence. */
import {createHash} from 'node:crypto';
import {same,fail} from './source.mjs';
export const sha=value=>createHash('sha256').update(value).digest('hex');
const identity=row=>({sourceId:row.sourceId,mailboxId:row.mailboxId,threadId:row.threadId,messageId:row.messageId,recordVersionId:row.recordVersionId,citationId:row.citationId,contentSha256:row.contentSha256,scopes:row.scopes,totalCodeUnits:row.section.totalCodeUnits,bodyCompleteness:row.bodyCompleteness});
export async function readBody(candidate,collection,limits){
 let offset=0,pinned,body='',last;const sections=[];
 while(offset<=limits.maxBodyCodeUnits){
  const request={subject:collection.subjectRequest,threadId:candidate.threadId,messageId:candidate.messageId,limit:1,bodyOffset:offset,maxCharacters:limits.bodySectionCodeUnits};
  const got=await collection.read('mail.read_thread',request);if(got.unavailable)return {candidate,status:'body-unavailable',reason:got.reason,sections,text:null,evidence:null};
  const page=got.result,row=page.messages[0];
  if(page.messages.length!==1)return {candidate,status:'body-missing',sections,text:null,evidence:null};
  if(row.mailboxId!==candidate.mailboxId||row.threadId!==candidate.threadId||row.messageId!==candidate.messageId||!same(row.scopes,candidate.scopes))fail('MAIL_HISTORY_BODY_IDENTITY');
  sections.push({pageSha256:sha(Buffer.from(JSON.stringify(page))),start:row.section.start,end:row.section.endExclusive,version:row.recordVersionId,sha256:row.contentSha256,citationId:row.citationId,authorizationDecisionId:page.subject.authorizationDecisionId});
  const pin=identity(row);
  if(pinned&&!same(pinned,pin))return {candidate,status:'conflicting-body-sections',reason:'Version/hash/citation/scope/length changed during pagination.',sections,text:null,evidence:null};pinned??=pin;
  if(row.bodyCompleteness!=='full'||row.recordVersionId===null||row.citationId===null||row.contentSha256===null||row.section.text===null||row.section.totalCodeUnits===null||row.section.totalCodeUnits>limits.maxBodyCodeUnits)return {candidate,status:'body-incomplete-or-unversioned',reason:row.section.totalCodeUnits>limits.maxBodyCodeUnits?'BODY_CODE_UNIT_CAP':'Missing full body, immutable version, citation, hash or known size.',sections,text:null,evidence:null};
  if(row.section.start!==offset||row.section.endExclusive<=offset&&row.section.totalCodeUnits!==0)fail('MAIL_HISTORY_BODY_CONTIGUITY');
  body+=row.section.text;offset=row.section.endExclusive;last=page;
  if(row.section.hasMore===false){
   if(offset!==row.section.totalCodeUnits||body.length!==offset||!body.isWellFormed()||sha(Buffer.from(body))!==row.contentSha256)fail('MAIL_HISTORY_BODY_HASH');
   const source=page.sources[0];return {candidate,status:'bound-full-body',sections,text:body,evidence:{sourceId:'mail',recordId:row.messageId,sourceVersionId:row.recordVersionId,citationId:row.citationId,authorizationDecisionId:page.subject.authorizationDecisionId,contentSha256:row.contentSha256,scopes:row.scopes,observedAt:source.retrievedAt,sourceUpdatedAt:null},source};
  }
 }
 return {candidate,status:'body-limit',sections,text:null,evidence:null};
}
