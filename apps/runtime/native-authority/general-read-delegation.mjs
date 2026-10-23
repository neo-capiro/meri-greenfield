/** One narrow delegation check owned by the existing native authority boundary. This creates no credential or public token.
 * Client evidence retains its actual client scope; the task's immutable private actor scope stays unchanged. */
import {conversationScopeMatches} from '../../../packages/contracts/conversation-scope.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {nativeReadFault} from '../../../packages/contracts/runtime-0.2/reads.mjs';
const refuse=()=>{throw nativeReadFault('ACCESS_DENIED');};
export function isGeneralTask(binding,scopes,policyRevision){return conversationScopeMatches(scopes,binding,null,policyRevision);}
/** Shape precheck is not authorization. The context and roster must be fresh owner-validated Core receipts. */
export function generalClientSelection({binding,scopes,policyRevision,subject}){
 if(!isGeneralTask(binding,scopes,policyRevision)||subject?.tenantId!==binding.tenantId||subject.actorId!==binding.actorId||subject.policyRevision!==policyRevision||subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds?.length!==1||!conversationScopeMatches(subject.scopes,binding,subject.entityIds[0],policyRevision))refuse();
 return subject.entityIds[0];
}
export function assertGeneralClientDelegation({binding,scopes,policyRevision,subject,native,conversation}){
 const clientId=generalClientSelection({binding,scopes,policyRevision,subject});
 if(conversation?.conversationId!==binding.conversationId||conversation.selectedClientId!==null||conversation.principal?.tenantId!==binding.tenantId||conversation.principal.actorId!==binding.actorId||native?.principal?.tenantId!==binding.tenantId||native.principal.actorId!==binding.actorId||conversation.identityRevision!==native.identityRevision||typeof conversation.contextRevision!=='string'||!conversation.contextRevision||!Array.isArray(native.clientIds)||!native.clientIds.includes(clientId))refuse();
 return Object.freeze({clientId,identityRevision:native.identityRevision,membershipRevision:native.membershipRevision,contextRevision:conversation.contextRevision,subjectSha256:hash(subject)});
}
