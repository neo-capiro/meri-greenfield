/** Existing canonical synthetic source fixtures; no real source or model request. */
import {sourcePage as mailPage,corpus,lateQuote,mailboxId,uid,sourceVersionId,unitContext,NOW} from '../../mail-history/test/fixtures.mjs';
import {meetingFixture} from '../../../../gateway/sources/meetings/test/fixtures.mjs';
import {clientEvidenceFixture,clientId as documentFixtureClientId} from '../../../../gateway/sources/client-evidence/test/fixtures.mjs';
import {createClientKnowledgeFixture} from '../../../../gateway/sources/client-knowledge/test/fixtures.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {asset} from '../source.mjs';
export {corpus,lateQuote,mailboxId,uid,sourceVersionId,unitContext,NOW};
export const selection=context=>({subject:{kind:'client',entityType:'client',entityIds:[context.scopes.find(s=>s.kind==='client').resourceId],
 tenantId:context.binding.tenantId,actorId:context.binding.actorId,authorizationDecisionId:uid(72),policyRevision:context.scopes[0].policyRevision,
 scopes:context.scopes,rosterVersionId:null},window:{basis:'unbounded'},mondayBoardIds:['101']});
export function makeInput(asOf=new Date(NOW).toISOString()){
 const passage={sourceId:'mail',recordId:uid(74),recordVersionId:sourceVersionId,start:corpus.indexOf(lateQuote),end:corpus.indexOf(lateQuote)+lateQuote.length,quote:lateQuote};
 return {skill:asset.pin,title:'Synthetic Commitments Audit',asOf,target:{query:'briefing'},observations:[
  {id:'promise',kind:'promise',relatedPromiseId:null,owner:'Ana',dueDate:'2026-10-20',passage},
  {id:'same-original-conflicting-owner',kind:'promise',relatedPromiseId:null,owner:'Bo',dueDate:'2026-10-21',passage},
  {id:'claimed-delivery',kind:'delivery-claim',relatedPromiseId:'promise',owner:null,dueDate:null,passage}]};
}
export function sourcePage(call){
 if(call.operation.id.startsWith('mail.'))return mailPage({...call,normalizationContext:{...call.normalizationContext,nowMs:call.normalizationContext.nowMs??Date.parse(call.request.asOf??new Date(NOW).toISOString())}});
 if(call.operation.id.startsWith('meeting.')){const f=meetingFixture(call.operation,call.request),page=f.page;page.binding=call.binding;page.subject=call.subject;page.window=call.window;if(page.debriefs)for(const row of page.debriefs){row.id=call.request.debriefId??uid(88);row.provenance.sourceRecordId=row.id;}return page;}
 if(call.operation.id==='read_client_documents'){const f=clientEvidenceFixture(call.operation,{...call.request,clientId:documentFixtureClientId}),page=JSON.parse(JSON.stringify(f.page).replaceAll(documentFixtureClientId,call.request.clientId));page.binding=call.binding;page.subject=call.subject;
  if(page.data.documents){page.data.documents[0].usable=true;page.data.documents[0].blockedReason=null;}return page;}
 if(call.operation.id==='read_monday_client_boards'){const f=createClientKnowledgeFixture(call.operation.id),n=f.contract.normalizeInput(call.request,{}),page=f.page(n.input);
  page.records[0].payload.sourceActorUserId=call.binding.actorId;return {binding:call.binding,subject:call.subject,operation:call.operation,argumentsSha256:n.argumentsSha256,result:page};}
 throw Object.assign(new Error('UNAVAILABLE'),{code:'UNAVAILABLE'});
}
