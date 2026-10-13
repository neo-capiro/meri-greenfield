/** Synthetic canonical pages, with explicitly late decisive UTF-16 body material. */
import {createHash} from 'node:crypto';
import {createMailFixture} from '../../../../gateway/sources/mail/test/fixtures.mjs';
import {artifactValidators as v,resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {asset} from '../source.mjs';
export const uid=n=>`71000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const mailboxId=uid(71),NOW=Date.parse('2026-10-13T12:00:00.000Z');
export const lateQuote='I will send the revised briefing on Friday. This is a quoted source statement, not verified delivery.';
export const corpus='Synthetic correspondence for local review. '+('Background material describing the meeting and source limitations. '.repeat(35))+lateQuote+' 😀';
export const sha=text=>createHash('sha256').update(Buffer.from(text)).digest('hex');
export function selected(context){return {subject:{kind:'client',entityType:'client',entityIds:[context.scopes.find(s=>s.kind==='client').resourceId],tenantId:context.binding.tenantId,actorId:context.binding.actorId,authorizationDecisionId:uid(72),policyRevision:context.scopes[0].policyRevision,scopes:context.scopes,rosterVersionId:null},window:{basis:'unbounded'}};}
export function unitContext(){return {binding:{tenantId:'mail-history-test',actorId:'reader',conversationId:uid(1),runId:uid(2),attemptId:uid(3),workerId:uid(4),writerFence:1},scopes:[{tenantId:'mail-history-test',kind:'client',resourceId:uid(5),policyRevision:'test-policy'},{tenantId:'mail-history-test',kind:'mailbox',resourceId:mailboxId,policyRevision:'test-policy'}],evidence:[],assets:[],deadlineMs:NOW+5000,maxBytes:1048576};}
export function makeInput(asOf=new Date(NOW).toISOString()){return {skill:asset.pin,title:'Synthetic Mail History brief',target:{query:'Morgan',participant:'morgan@example.invalid'},asOf,quotes:[{mailboxId,threadId:uid(73),messageId:uid(74),sourceVersionId:'synthetic-message-v1',start:corpus.indexOf(lateQuote),end:corpus.indexOf(lateQuote)+lateQuote.length,text:lateQuote,url:'https://example.invalid/mail/locator-only'}],interpretations:['Morgan appears to have promised a revised briefing. This interpretation requires human verification.']};}
export function sourcePage(call){
 const {operation,request,binding,subject,window,normalizationContext}=call,contract=resolveOperationContract(operation),normalized=contract.normalizeInput(request,normalizationContext),stamp=new Date(normalizationContext.nowMs??Date.parse('2026-10-13T12:00:00.000Z')).toISOString();
 if(operation.id==='resolve_entity')return {binding,subject,operation,argumentsSha256:normalized.argumentsSha256,result:{tool:'resolve_entity',generatedAt:stamp,matchesFound:0,matches:[],note:`No canonical entity matched "${normalized.input.query}". Say so explicitly — do NOT fabricate a member, committee, or bill identifier.`}};
 if(operation.id==='find_contacts')return {binding,subject,operation,argumentsSha256:normalized.argumentsSha256,result:{tool:'find_contacts',generatedAt:stamp,clientId:normalized.input.clientId,clientName:normalized.input.clientId?'Synthetic client':null,matchedOn:{domain:normalized.input.domain,query:normalized.input.query,linkedClient:normalized.input.clientId!==null},contacts:[],note:normalized.input.clientId?'0 correspondent(s) found; 0 not yet on the People tab. These come from synced mail and calendar — cite them as such. Propose only the missing ones via update_client_profile people[].':'0 correspondent(s) found from synced mail and calendar.'}};
 const f=createMailFixture(operation.id,{client:true});f.state.total=1;
 const authority={...f.authority,binding,subject},page=f.page(normalized.input,authority);page.binding=binding;page.subject=subject;page.window=window;page.argumentsSha256=normalized.argumentsSha256;
 if(operation.id==='mail.read_thread'){
  const row=page.messages[0],start=Math.min(normalized.input.bodyOffset,corpus.length),end=Math.min(corpus.length,start+normalized.input.maxCharacters);
  Object.assign(row,{mailboxId,threadId:uid(73),messageId:request.messageId,recordVersionId:'synthetic-message-v1',citationId:uid(75),contentSha256:sha(corpus),scopes:subject.scopes,readHandle:'synthetic-full-body',section:{start,endExclusive:end,totalCodeUnits:corpus.length,unit:'utf16-code-unit',text:corpus.slice(start,end),hasMore:end<corpus.length}});
  page.nextBodyOffsets=end<corpus.length?[{messageId:row.messageId,bodyOffset:end}]:[];page.continuation.requiredReads=['synthetic-full-body'];page.coverage.truncated=end<corpus.length;
 }else{
  const row=page.messages[0],date=new Date(Date.parse(request.asOf)-1000).toISOString();Object.assign(row,{mailboxId,threadId:uid(73),messageId:uid(74),scopes:subject.scopes,clientId:subject.entityIds[0],receivedAt:date,sentAt:null,createdAt:date,effectiveAt:date,subjectText:'Revised briefing discussion',from:{name:'Morgan',email:'morgan@example.invalid'},to:[{name:'Meri owner',email:'owner@example.invalid'}],readHandle:'synthetic-candidate-preview'});
  page.continuation.requiredReads=[row.readHandle];if(operation.id==='mail.list_messages')page.threadGroups=[{mailboxId,threadId:uid(73),messageIds:[uid(74)]}];
 }
 page.sources[0].retrievedAt=request.asOf??new Date(normalizationContext.nowMs).toISOString();return page;
}
/** Canonical bounded multi-page corpus for cap/continuation regressions. */
export function manySourcePage(call,total=15){
 if(!call.operation.id.startsWith('mail.'))return sourcePage(call);
 if(call.operation.id==='mail.read_thread'){
  const page=sourcePage(call),row=page.messages[0],full='Synthetic full source body.';
  const start=Math.min(call.request.bodyOffset,full.length),end=Math.min(full.length,start+call.request.maxCharacters);
  row.citationId=uid(600+Number(call.request.messageId.split('-').at(-1)));row.contentSha256=sha(full);row.section={start,endExclusive:end,totalCodeUnits:full.length,unit:'utf16-code-unit',text:full.slice(start,end),hasMore:end<full.length};page.nextBodyOffsets=end<full.length?[{messageId:row.messageId,bodyOffset:end}]:[];page.coverage.truncated=end<full.length;return page;
 }
 const request={...call.request,offset:0},base=sourcePage({...call,request,normalizationContext:{nowMs:call.normalizationContext.nowMs}}),contract=resolveOperationContract(call.operation),normalized=contract.normalizeInput(call.request,{nowMs:call.normalizationContext.nowMs}).input;
 const template=base.messages[0],count=Math.min(normalized.limit,Math.max(0,total-normalized.offset));
 base.selection=normalized;base.argumentsSha256=v.hash(normalized);base.filterSha256=v.hash({...normalized,offset:0,asOf:null});
 base.messages=Array.from({length:count},(_,n)=>{const ordinal=normalized.offset+n,date=new Date(Date.parse(call.request.asOf)-1000-ordinal*1000).toISOString(),messageId=uid(100+total-ordinal);return {...structuredClone(template),messageId,readHandle:'synthetic-handle-'+messageId,internetMessageId:`<synthetic-${ordinal}@example.invalid>`,receivedAt:date,createdAt:date,effectiveAt:date};});
 base.totalMatches=total;base.hasMore=normalized.offset+count<total;base.nextOffset=base.hasMore?normalized.offset+count:null;base.coverage.returnedCount=count;base.coverage.enumerableTotal=total;base.coverage.truncated=base.hasMore;base.continuation.requiredReads=base.messages.map(m=>m.readHandle);
 if(call.operation.id==='mail.list_messages'){base.threadGroups=[{mailboxId,threadId:uid(73),messageIds:base.messages.map(m=>m.messageId)}];base.returnedThreadGroupCount=1;}return base;
}
