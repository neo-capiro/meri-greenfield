/** Exact mail-page continuation records in the existing immutable context relation. */
import {assertSubject,assertMailCandidateSourcePage,validateShape as readShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {bounded,hash,same,fail,own,validateShape} from './boundary.mjs';
const refuse=()=>fail('MAIL_CONTEXT_REFUSED');
export const isMailContext=key=>['mail.list_messages','mail.search_messages'].includes(key?.operation?.id)&&key.operation.version==='0.2.0';
export function mailContextKey(raw,task){
 const key=bounded(raw,16384);own(key,['binding','operation','policyRevision','subject','selection']);
 validateShape('RunBinding',key.binding);assertSubject(key.subject,key.binding);
 if(!isMailContext(key)||!same(key.binding,task.binding)||key.policyRevision!==task.policyRevision||key.subject.policyRevision!==task.policyRevision)refuse();
 const selected=key.subject;if(selected.entityIds.length!==1)refuse();
 if(task.clientId===null?selected.kind!=='personal'||selected.entityType!=='user'||selected.entityIds[0]!==task.binding.actorId:
  selected.kind!=='client'||selected.entityType!=='client'||selected.entityIds[0]!==task.clientId)refuse();
 if(!selected.scopes.some(scope=>scope.kind==='mailbox'))refuse();
 readShape(key.operation.id==='mail.list_messages'?'MailListSelection':'MailSearchSelection',key.selection);
 if(key.selection.offset<1||key.selection.asOf===null||key.selection.subject.kind!==selected.kind||
  selected.kind==='client'&&key.selection.subject.entityId!==task.clientId)refuse();
 return key;
}
export function mailContextRecord(raw,task,{at,predecessor,inventory=false}={}){
 const record=bounded(raw,1048576);own(record,['key','previousPage','previousSha256','recordedAtMs','expiresAtMs']);
 const key=mailContextKey(record.key,task),page=record.previousPage;
 readShape('MailCandidateSourcePage',page);
 if(hash(page)!==record.previousSha256||!same(page.binding,key.binding)||!same(page.subject,key.subject)||!same(page.operation,key.operation)||
  !Number.isSafeInteger(record.recordedAtMs)||record.recordedAtMs<1||!Number.isSafeInteger(record.expiresAtMs)||record.expiresAtMs<=record.recordedAtMs||
  !same({...page.selection,offset:page.nextOffset,asOf:page.queryScope.asOfInclusive},key.selection)||page.hasMore!==true||page.messages.length<1)refuse();
 if(!inventory){
  if(record.recordedAtMs>at||record.expiresAtMs<=at||record.expiresAtMs>task.expiresAtMs||
   (page.selection.offset===0?predecessor!==null:predecessor===null))refuse();
  try{assertMailCandidateSourcePage(page,Object.fromEntries(Object.entries(page.selection).filter(([,value])=>value!==null)),key.operation.id,{nowMs:at,...(predecessor===null?{}:{previousPage:predecessor.previousPage})});}catch{refuse();}
 }
 return record;
}
export function mailPredecessorKey(record){
 const page=record.previousPage;
 if(page?.selection?.offset===0)return null;
 return {...record.key,selection:{...page.selection,asOf:page.queryScope.asOfInclusive}};
}
