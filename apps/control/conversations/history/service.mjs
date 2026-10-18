/** Membership-authorized read/admission facade. The caller supplies the canonical product gate's principal, never a UI identity. */
import {ProductError,asProductError,productFailure,refuse} from '../../product-access/errors.mjs';
import {TURN_SCHEMA} from './protocol.mjs';
import {terminal} from '../boundary.mjs';
export function createConversationHistoryService({store,nextRunOwner,gate,retention}){
 if(['list','transcript'].some(k=>typeof store?.history?.[k]!=='function')||typeof gate?.recheck!=='function'||retention!==undefined&&['assertServable','withRelease'].some(k=>typeof retention[k]!=='function'))refuse('PRODUCT_CONFIGURATION');
 const guard=fn=>async value=>{try{return await fn(value);}catch(error){throw asProductError(error,'CONVERSATION_UNAVAILABLE');}};
 const check=signal=>()=>signal?.throwIfAborted();
 async function servable(principal,conversationId){if(retention)await retention.assertServable({tenantId:principal.tenantId,kind:'conversation',subjectId:conversationId});}
 async function current(recheckConversation,conversation){if(typeof recheckConversation!=='function')refuse('CONVERSATION_UNAVAILABLE');await recheckConversation({conversationId:conversation.conversationId,scopes:conversation.scopes});}
 async function transcript({principal,request,signal,recheckConversation}){
  // Subject ownership/client authorization precedes subject-specific retention observations.
  const result=await store.history.transcript({principal,...request},check(signal));
  await servable(principal,request.conversationId);await current(recheckConversation,result.conversation);
  // Core currentness is awaited: suppression can take effect while that authorization check is in flight.
  await servable(principal,request.conversationId);return result;
 }
 return Object.freeze({
  list:guard(async({principal,request,signal,recheckConversation})=>{
   const result=await store.history.list({principal,...request},check(signal)),authorized=[],visible=[];
   for(const c of result.conversations){try{await servable(principal,c.conversationId);}catch(error){if(error?.code==='RETENTION_SUPPRESSED')continue;throw error;}
    // Core's current context wire does not distinguish archive from outage; withhold the whole page on either failure.
    await current(recheckConversation,c);authorized.push(c);}
   // Recheck every authorized row after all awaited Core reads, before releasing the saved page.
   for(const c of authorized){try{await servable(principal,c.conversationId);}catch(error){if(error?.code==='RETENTION_SUPPRESSED')continue;throw error;}visible.push(c);}
   return {...result,conversations:visible};
  }),
  transcript:guard(transcript),
  // One fence spans ALL subjects, final native membership/Core checks and response serialization.
  recheckRelease:guard(async({principal,request,result,operation,signal,deadlineMs,recheckMembership,recheckConversation,publish})=>{
   if(typeof recheckMembership!=='function'||typeof publish!=='function')refuse('PRODUCT_CONFIGURATION');
   let conversations=operation==='list'?result.conversations:[result.conversation];
   // Turn receipts do not carry scopes: re-read the trusted saved owner record for release authorization.
   if(operation==='nextTurn'){const saved=await store.history.transcript({principal,conversationId:request.conversationId,after:0,limit:1},check(signal));conversations=[saved.conversation];}
   const subjects=conversations.map(c=>({tenantId:principal.tenantId,kind:'conversation',subjectId:c.conversationId}));
   const release=async fenceSignal=>{
    check(signal)();await recheckMembership();
    for(const conversation of conversations)await current(recheckConversation,conversation);
    if(operation==='list'){const visible=[];
     for(const conversation of conversations){try{await servable(principal,conversation.conversationId);}catch(error){if(error?.code==='RETENTION_SUPPRESSED')continue;throw error;}visible.push(conversation);}
     check(signal)();check(fenceSignal)();return publish({...result,conversations:visible});
    }
    await servable(principal,request.conversationId);check(signal)();check(fenceSignal)();return publish(result);
   };
   return retention?retention.withRelease(subjects,release,{signal,deadlineMs}):release();
  }),
  nextTurn:guard(async({principal,request,signal,deadlineMs,recheckMembership,recheckConversation})=>{
   if(typeof nextRunOwner?.admitTurn!=='function')refuse('CONVERSATION_TURN_UNAVAILABLE','NOT_DISPATCHED');
   let saved;try{saved=await transcript({principal,request:{conversationId:request.conversationId,after:0,limit:1},signal,recheckConversation});}
   catch(error){throw new ProductError(productFailure(error)?.code??'CONVERSATION_UNAVAILABLE','NOT_DISPATCHED');}
   if(saved.latestRun.binding.runId===request.sourceRunId&&!terminal(saved.latestRun.state))refuse('CONVERSATION_TURN_CONFLICT','NOT_DISPATCHED');
   try{if(recheckMembership)await recheckMembership();else await gate.recheck({principal,signal,deadlineMs});}
   catch(error){throw new ProductError(productFailure(error)?.code??'CONVERSATION_UNAVAILABLE','NOT_DISPATCHED');}
   try{await current(recheckConversation,saved.conversation);await servable(principal,request.conversationId);}catch(error){throw new ProductError(productFailure(error)?.code??'CONVERSATION_UNAVAILABLE','NOT_DISPATCHED');}
   let admitted;try{admitted=await nextRunOwner.admitTurn({principal:{tenantId:principal.tenantId,actorId:principal.actorId},...request,signal});}
   // A source not yet settled (or still live) refuses before any reservation write: a definite, retryable conflict, never UNKNOWN.
   catch(error){if(['NEXT_RUN_SOURCE_UNSETTLED','NEXT_RUN_SOURCE_NOT_TERMINAL'].includes(error?.code))throw new ProductError('CONVERSATION_TURN_CONFLICT','NOT_DISPATCHED');throw asProductError(error,'CONVERSATION_UNAVAILABLE','UNKNOWN');}
   try{await servable(principal,request.conversationId);await current(recheckConversation,saved.conversation);await servable(principal,request.conversationId);}catch(error){throw new ProductError(productFailure(error)?.code??'CONVERSATION_UNAVAILABLE','RESULT_NOT_RELEASED');}
   return {schema:TURN_SCHEMA,...admitted};
  }),
 });
}
