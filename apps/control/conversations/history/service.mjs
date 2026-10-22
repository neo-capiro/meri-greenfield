/** Membership-authorized read/admission facade. The caller supplies the canonical product gate's principal, never a UI identity. */
import {ProductError,asProductError,productFailure,refuse} from '../../product-access/errors.mjs';
import {TURN_SCHEMA} from './protocol.mjs';
import {terminal} from '../boundary.mjs';
// Core currentness rows are independent reads; this many run at once on a released page.
const CURRENTNESS_CONCURRENCY=4;
export function createConversationHistoryService({store,nextRunOwner,gate,retention}){
 if(['list','transcript'].some(k=>typeof store?.history?.[k]!=='function')||typeof gate?.recheck!=='function'||retention!==undefined&&['assertServable','withRelease'].some(k=>typeof retention[k]!=='function'))refuse('PRODUCT_CONFIGURATION');
 const guard=fn=>async value=>{try{return await fn(value);}catch(error){throw asProductError(error,'CONVERSATION_UNAVAILABLE');}};
 const check=signal=>()=>signal?.throwIfAborted();
 async function servable(principal,conversationId){if(retention)await retention.assertServable({tenantId:principal.tenantId,kind:'conversation',subjectId:conversationId});}
 async function current(recheckConversation,conversation,readScheduleOriginRows){if(typeof recheckConversation!=='function')refuse('CONVERSATION_UNAVAILABLE');await recheckConversation({conversationId:conversation.conversationId,scopes:conversation.scopes},readScheduleOriginRows);}
 // Every row is still checked; the first refusal withholds the page once the reads already started have settled.
 async function currentAll(recheckConversation,conversations,readScheduleOriginRows){let next=0,failure;
  const worker=async()=>{while(!failure&&next<conversations.length){const conversation=conversations[next++];try{await current(recheckConversation,conversation,readScheduleOriginRows);}catch(error){failure??={error};}}};
  await Promise.all(Array.from({length:Math.min(CURRENTNESS_CONCURRENCY,conversations.length)},worker));if(failure)throw failure.error;}
 async function transcript({principal,request,signal,recheckConversation},deferCurrentness=false){
  // Subject ownership/client authorization precedes subject-specific retention observations.
  const result=await store.history.transcript({principal,...request},check(signal));
  await servable(principal,request.conversationId);if(!deferCurrentness)await current(recheckConversation,result.conversation);
  // Keep both local retention observations; final fenced release checks retention again after its fresh Core read.
  await servable(principal,request.conversationId);return result;
 }
 return Object.freeze({
  // A page is released only through recheckRelease, which checks Core currentness for every row inside the serving fence after
  // the final membership recheck. Checking it here as well would only repeat those reads, so the list keeps the retention filter.
  list:guard(async({principal,request,signal})=>{
   const result=await store.history.list({principal,...request},check(signal)),visible=[];
   for(const c of result.conversations){try{await servable(principal,c.conversationId);}catch(error){if(error?.code==='RETENTION_SUPPRESSED')continue;throw error;}visible.push(c);}
   return {...result,conversations:visible};
  }),
  // Read-only transcript releases only through the final serving fence, like list; nextTurn keeps every early/fresh check.
  transcript:guard(call=>transcript(call,true)),
  // One fence spans ALL subjects, final native membership/Core checks and response serialization.
  recheckRelease:guard(async({principal,request,result,operation,signal,deadlineMs,recheckMembership,recheckConversation,publish})=>{
   if(typeof recheckMembership!=='function'||typeof publish!=='function')refuse('PRODUCT_CONFIGURATION');
   let conversations=operation==='list'?result.conversations:[result.conversation];
   // Turn receipts do not carry scopes: re-read the trusted saved owner record for release authorization.
   if(operation==='nextTurn'){const saved=await store.history.transcript({principal,conversationId:request.conversationId,after:0,limit:1},check(signal));conversations=[saved.conversation];}
   const subjects=conversations.map(c=>({tenantId:principal.tenantId,kind:'conversation',subjectId:c.conversationId}));
   const release=async(fenceSignal,assertReleaseServable,readScheduleOriginRows)=>{
    if(retention&&typeof assertReleaseServable!=='function')refuse('PRODUCT_CONFIGURATION');
    const releaseServable=conversationId=>retention?assertReleaseServable({tenantId:principal.tenantId,kind:'conversation',subjectId:conversationId}):Promise.resolve();
    check(signal)();await recheckMembership();
    // Any Core refusal or outage withholds the whole page; no refused row is skipped.
    await currentAll(recheckConversation,conversations,readScheduleOriginRows);
    if(operation==='list'){const visible=[];
     for(const conversation of conversations){try{await releaseServable(conversation.conversationId);}catch(error){if(error?.code==='RETENTION_SUPPRESSED')continue;throw error;}visible.push(conversation);}
     check(signal)();check(fenceSignal)();return publish({...result,conversations:visible});
    }
    await releaseServable(request.conversationId);check(signal)();check(fenceSignal)();return publish(result);
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
