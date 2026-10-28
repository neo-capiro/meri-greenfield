/** Explicit legacy source selector; current run and legacy source never share an inferred namespace. */
import {deny} from '../../dispatch/operation-result.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
export function attachmentSelection(request,subject,binding){
 if(typeof request?.conversationId!=='string'||!UUID.test(request.conversationId))deny('INVALID_ARGUMENTS');
 let selectedClientId=null;
 if(subject.kind==='client'||subject.entityType==='client'){
  if(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds.length!==1||!UUID.test(subject.entityIds[0])||!subject.scopes.some(s=>s.kind==='client'&&s.resourceId===subject.entityIds[0]))deny('ACCESS_DENIED');selectedClientId=subject.entityIds[0];
 }else if(subject.kind!=='personal'||subject.entityType!=='user'||subject.entityIds.length!==1||subject.entityIds[0]!==binding.actorId)deny('ACCESS_DENIED');
 return {sourceConversationId:request.conversationId,selectedClientId};
}
export function attachmentReadEnvelope(current){
 const {sourceConversationId,selectedClientId}=attachmentSelection(current.request,current.authority.subject,current.authority.binding),{asOf,scope}=current.normalizationContext;
 if(scope.conversationId!==sourceConversationId||scope.clientId!==selectedClientId||scope.tenantId!==current.authority.binding.tenantId||scope.userId!==current.authority.binding.actorId||current.deadlineMs>Date.parse(asOf)+30000)deny('ACCESS_DENIED');
 return {version:2,currentTurn:{conversationId:current.authority.binding.conversationId,selectedClientId},source:{kind:'clio_conversation',conversationId:sourceConversationId,conversationVersion:scope.conversationVersion},
  observation:{asOf,expiresAtMs:current.deadlineMs},input:current.request};
}
