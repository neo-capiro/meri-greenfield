/** Exact conversation scope data. Null is usable only after Core proves an explicitly bootstrapped General conversation.
 * A private-user scope never grants access to every client or every record in the tenant. */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
export const isConversationClient=value=>value===null||typeof value==='string'&&uuid.test(value);
export function conversationScopes(binding,selectedClientId,policyRevision){
 if(!isConversationClient(selectedClientId)||typeof binding?.tenantId!=='string'||!binding.tenantId||typeof binding?.actorId!=='string'||!binding.actorId||typeof policyRevision!=='string'||!policyRevision)throw Error('CONVERSATION_SCOPE_REFUSED');
 return [{kind:selectedClientId===null?'private-user':'client',tenantId:binding.tenantId,resourceId:selectedClientId===null?binding.actorId:selectedClientId,policyRevision}];
}
export function conversationScopeMatches(scopes,binding,selectedClientId,policyRevision=scopes?.[0]?.policyRevision){
 if(!Array.isArray(scopes)||scopes.length!==1||!isConversationClient(selectedClientId))return false;
 const s=scopes[0];return s!==null&&typeof s==='object'&&Object.keys(s).length===4&&s.tenantId===binding.tenantId&&s.policyRevision===policyRevision&&typeof policyRevision==='string'&&!!policyRevision&&s.kind===(selectedClientId===null?'private-user':'client')&&s.resourceId===(selectedClientId===null?binding.actorId:selectedClientId);
}
/** Undefined is malformed; null is the exact private actor scope. */
export function conversationClientFromScopes(scopes,binding){
 const selected=scopes?.[0]?.kind==='private-user'?null:scopes?.[0]?.resourceId;
 return conversationScopeMatches(scopes,binding,selected)?selected:undefined;
}
/** Existing client authorization can include multiple permitted scopes. General is deliberately stricter: one exact private actor
 * scope. This helper extends nullable selection without changing the existing selected-client membership rule. */
export function conversationAuthorityIncludes(scopes,binding,selectedClientId,policyRevision=scopes?.[0]?.policyRevision){
 return selectedClientId===null?conversationScopeMatches(scopes,binding,null,policyRevision):
  isConversationClient(selectedClientId)&&Array.isArray(scopes)&&scopes.some(s=>s.kind==='client'&&s.tenantId===binding.tenantId&&s.resourceId===selectedClientId);
}
