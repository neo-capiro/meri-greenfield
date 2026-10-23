/** Meri's management fence, composed with the canonical Core metadata owner. No title store, metadata cache or purge owner. */
import {own,bounded,uuid,fail} from './boundary.mjs';
import {isConversationClient} from '../../../packages/contracts/conversation-scope.mjs';
const operations=new Set(['rename','archive','restore','trash']);
export function managementCommand(raw){
 const v=own(bounded(raw),['version','principal','conversationId','requestId','operation','expectedRevision'],['title']),p=own(v.principal,['tenantId','actorId']);
 uuid(v.conversationId);uuid(v.requestId);
 if(v.version!=='meri.conversation-management.v1'||!operations.has(v.operation)||typeof v.expectedRevision!=='string'||!/^(0|[1-9][0-9]{0,17})$/u.test(v.expectedRevision)||
  [p.tenantId,p.actorId].some(x=>typeof x!=='string'||!x)||Object.hasOwn(v,'title')!==(v.operation==='rename')||v.operation==='rename'&&(typeof v.title!=='string'||v.title!==v.title.trim()||!v.title||v.title.length>200))fail('CONVERSATION_MANAGEMENT_REFUSED');
 return v;
}
/** The caller supplies Core's owner-authorized metadata reader. It must only read Core metadata, never reacquire Meri's lock. */
export function createConversationAdmissionGuard({readMetadata}){
 if(typeof readMetadata!=='function')fail('CONVERSATION_MANAGEMENT_UNAVAILABLE');
 return async function assertAdmission(_client,binding,check){
  check();let current;
  try{current=bounded(await readMetadata({principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId}));}
  catch{fail('CONVERSATION_MANAGEMENT_UNAVAILABLE');}
  check();
  if(current?.conversationId!==binding.conversationId||!['client','general'].includes(current.scopeKind)||!isConversationClient(current.clientId)||
   (current.scopeKind==='general')!==(current.clientId===null)||typeof current.revision!=='string'||!/^(0|[1-9][0-9]{0,17})$/u.test(current.revision))fail('CONVERSATION_MANAGEMENT_UNAVAILABLE');
  if(current.status!=='active')fail('CONVERSATION_NOT_ACTIVE');
 };
}
/** Transition exclusion precedes the conversation exclusion, matching history. Core owns transaction/CAS/request replay and invokes
 * suppress before Trash commit, release after Restore commit. Unknown Core outcomes therefore remain suppressed. */
export function createConversationManagementPort({store,suppression}){
 if(typeof store?.management?.withTerminalConversation!=='function'||store.management.available!==true||
  ['withTransition','suppress','release','isSuppressed'].some(key=>typeof suppression?.[key]!=='function'))fail('CONVERSATION_MANAGEMENT_UNAVAILABLE');
 async function withTerminalConversation(raw,work){
  const command=managementCommand(raw);if(typeof work!=='function')fail('CONVERSATION_MANAGEMENT_REFUSED');
  const subject={tenantId:command.principal.tenantId,kind:'conversation',subjectId:command.conversationId,ownerActorId:command.principal.actorId};
  const selection={principal:command.principal,subject};
  return suppression.withTransition(selection,()=>store.management.withTerminalConversation(command,async()=>{
   let active=true;
   const check=(input,operation,reason)=>{const v=own(bounded(input),['reason','requestId'],operation==='trash'?['restoreUntil']:[]);
    if(!active||command.operation!==operation||v.reason!==reason||v.requestId!==command.requestId)fail('CONVERSATION_MANAGEMENT_REFUSED');return v;};
   const fence=Object.freeze({
    async suppress(input){const v=check(input,'trash','conversation-trash');
     if(typeof v.restoreUntil!=='string'||!Number.isFinite(Date.parse(v.restoreUntil)))fail('CONVERSATION_MANAGEMENT_REFUSED');
     return suppression.suppress({...selection,reason:'conversation-trash'});},
    async release(input){check(input,'restore','conversation-restore');
     // Core only invokes this after commit, including an exact stored-request replay whose revision is still current.
     // Releasing an already released projection is an idempotent transport recovery, not a second metadata decision.
     if(!await suppression.isSuppressed(subject))return;
     return suppression.release({...selection,reason:'conversation-restore'});},
   });
   try{return await work(fence);}finally{active=false;}
  }));
 }
 return Object.freeze({withTerminalConversation});
}
