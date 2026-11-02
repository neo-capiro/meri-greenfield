/** Core owns metadata/receipts; this owner serializes them with canonical run
 * admission and the existing retention transition. No cross-service journal. */
import {ProductError,productFailure,refuse} from '../../product-access/errors.mjs';
import {derivedConversationTitle,UNNAMED_CONVERSATION_TITLE} from './conversation-title.mjs';
const reason=requestId=>'conversation-trash:'+requestId;
/** Core names every bootstrapped chat with this placeholder (apps/api meri-conversation-bootstrap). A summary shows the first
 * prompt instead until the person renames the chat; a rename reaches Core through `manage` and then wins here. */
const CORE_PLACEHOLDER_TITLE='New Meri session';
const summaryTitle=(metadata,state)=>metadata.title===CORE_PLACEHOLDER_TITLE?derivedConversationTitle(state.firstPrompt)??UNNAMED_CONVERSATION_TITLE:metadata.title;
const check=signal=>()=>signal?.throwIfAborted();
export function assertManagedScope(principal,metadata,conversation){
 if(conversation===null)return;
 const clients=conversation.scopes.filter(s=>s.kind==='client');
 if(metadata.clientId===null?conversation.scopes.length!==1||conversation.scopes[0].kind!=='private-user'||conversation.scopes[0].resourceId!==principal.actorId:clients.length!==1||clients[0].resourceId!==metadata.clientId)refuse('CONVERSATION_UNAVAILABLE');
}
const sameScope=assertManagedScope;
export function createConversationManagementService({store,suppression}){
 if(['inspect','withConversation','register'].some(k=>typeof store?.management?.[k]!=='function'))refuse('PRODUCT_CONFIGURATION');
 const required=core=>{if(['metadata','read','apply','registration','summaries'].some(k=>typeof core?.[k]!=='function'))refuse('CONVERSATION_UNAVAILABLE');};
 async function summaries({principal,request,management:core,signal}){required(core);const result=await core.summaries(request),conversations=[];
  for(const metadata of result.conversations){check(signal)();const state=await store.management.inspect({principal,conversationId:metadata.conversationId},check(signal));sameScope(principal,metadata,state.conversation);
   conversations.push({...metadata,title:summaryTitle(metadata,state),hasTranscript:state.hasTranscript,canManage:metadata.scopeKind!=='research_portfolio'&&state.canManage});}
  return {...result,conversations};
 }
 async function manage({principal,request,management:core,signal}){required(core);
  if(typeof suppression?.withTransition!=='function')refuse('CONVERSATION_UNAVAILABLE','NOT_DISPATCHED');
  const key={principal,conversationId:request.conversationId},subject={tenantId:principal.tenantId,kind:'conversation',subjectId:request.conversationId};
  // Registration is a real owned Core bootstrap, not a fabricated first run.
  const first=await core.read(request),saved=await store.management.inspect(key,check(signal));sameScope(principal,first.current,saved.conversation);
  if(!saved.conversation){const registration=await core.registration(first.current);await store.management.register({principal,...registration},check(signal));}
  return suppression.withTransition({principal:{tenantId:principal.tenantId,actorId:principal.actorId},subject},retained=>store.management.withConversation(key,async state=>{
   const before=await core.read(request);sameScope(principal,before.current,state.conversation);
   const settle=async outcome=>{if(!outcome.receipt)refuse('CONVERSATION_UNAVAILABLE','UNKNOWN');
    if(outcome.releaseRetention){const current=await retained.current();
     if(current?.state==='SUPPRESSED'&&current.reason===reason(outcome.suppressionRequestId))await retained.release({reason:'conversation-restore:'+request.requestId});
     else if(current?.state!=='RELEASED')refuse('CONVERSATION_UNAVAILABLE','RESULT_NOT_RELEASED');
    }
    return outcome.receipt;
   };
   if(before.receipt)return settle(before);
   if(request.operation!=='rename'&&!state.canManage)refuse('CONVERSATION_MANAGEMENT_CONFLICT','NOT_DISPATCHED');
   let retainedState=await retained.current();
   if(request.operation==='trash'){
    if(before.current.status==='trashed')refuse('CONVERSATION_MANAGEMENT_CONFLICT','NOT_DISPATCHED');
    if(retainedState&&retainedState.state!=='RELEASED'&&retainedState.reason!==reason(request.requestId))refuse('CONVERSATION_UNAVAILABLE','NOT_DISPATCHED');
    // Do not suppress a request already known to have lost CAS.
    if(before.current.revision!==request.expectedRevision){
     if(retainedState?.state==='SUPPRESSED'&&retainedState.reason===reason(request.requestId)&&BigInt(before.current.revision)>BigInt(request.expectedRevision))await retained.release({reason:'conversation-conflict:'+request.requestId});
     refuse('CONVERSATION_MANAGEMENT_CONFLICT','NOT_DISPATCHED');
    }
    retainedState=await retained.suppress({reason:reason(request.requestId),signal});
   }else if(retainedState&&retainedState.state!=='RELEASED'&&!(request.operation==='restore'&&before.current.status==='trashed'))refuse('CONVERSATION_UNAVAILABLE','NOT_DISPATCHED');
   let outcome;
   try{outcome=await core.apply(request);}catch(error){
    // A readback may find the actual receipt. Absence after timeout is UNKNOWN:
    // retry applies the SAME command; an old request could still arrive at Core.
    let back;try{back=await core.read(request);}catch{throw new ProductError('CONVERSATION_UNAVAILABLE','UNKNOWN');}
    if(back.receipt)return settle(back);
    const conflict=BigInt(back.current.revision)>BigInt(request.expectedRevision);
    if(conflict&&request.operation==='trash'&&back.current.status!=='trashed'){
     const current=await retained.current();if(current?.state==='SUPPRESSED'&&current.reason===reason(request.requestId))await retained.release({reason:'conversation-conflict:'+request.requestId});
    }
    if(conflict)throw new ProductError('CONVERSATION_MANAGEMENT_CONFLICT','NOT_DISPATCHED');
    // Core's database-clock expiry is terminal. A fresh exact readback above
    // has no committed receipt; retain Trash but let the UI clear this refusal.
    const failure=productFailure(error);
    if(request.operation==='restore'&&back.current.status==='trashed'&&failure?.code==='CONVERSATION_RESTORE_EXPIRED'&&failure.outcome==='NOT_DISPATCHED')throw error;
    throw new ProductError('CONVERSATION_UNAVAILABLE','UNKNOWN');
   }
   return settle(outcome);
  },check(signal),retained.databaseLease));
 }
 return Object.freeze({summaries,manage});
}
