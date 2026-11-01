/** Membership-authorized read/admission facade. The caller supplies the canonical product gate's principal, never a UI identity. */
import {ProductError,asProductError,productFailure,refuse} from '../../product-access/errors.mjs';
import {exportConversationMessages} from './export.mjs';
import {createConversationDeletionService} from './deletions.mjs';
import {TURN_SCHEMA} from './protocol.mjs';
import {terminal} from '../boundary.mjs';
import {createConversationManagementService,assertManagedScope} from './management.mjs';
import {sameResearchContext} from '../../action-host/application-adapters/research-context.mjs';
// Core currentness rows are independent reads; this many run at once on a released page.
const CURRENTNESS_CONCURRENCY=4;
export function createConversationHistoryService({store,nextRunOwner,gate,retention,suppression,deletionStatus}){
 if(['list','transcript'].some(k=>typeof store?.history?.[k]!=='function')||typeof gate?.recheck!=='function'||retention!==undefined&&['assertServable','withRelease'].some(k=>typeof retention[k]!=='function'))refuse('PRODUCT_CONFIGURATION');
 const guard=fn=>async value=>{try{return await fn(value);}catch(error){throw asProductError(error,'CONVERSATION_UNAVAILABLE');}};
 const check=signal=>()=>signal?.throwIfAborted();
 const deletions=createConversationDeletionService({status:deletionStatus});
 const management=store.management?createConversationManagementService({store,suppression}):null;
 async function servable(principal,conversationId){if(retention)await retention.assertServable({tenantId:principal.tenantId,kind:'conversation',subjectId:conversationId});}
 async function current(recheckConversation,conversation,readScheduleOriginRows){if(typeof recheckConversation!=='function')refuse('CONVERSATION_UNAVAILABLE');await recheckConversation({conversationId:conversation.conversationId,scopes:conversation.scopes},readScheduleOriginRows);}
 // Every row is still checked; the first refusal withholds the page once the reads already started have settled.
 async function readAll(conversations,read){let next=0,failure;const results=[];
  const worker=async()=>{while(!failure&&next<conversations.length){const index=next++,conversation=conversations[index];try{results[index]=await read(conversation);}catch(error){failure??={error};}}};
  await Promise.all(Array.from({length:Math.min(CURRENTNESS_CONCURRENCY,conversations.length)},worker));if(failure)throw failure.error;return results;}
 const currentAll=(recheckConversation,conversations,readScheduleOriginRows)=>readAll(conversations,c=>current(recheckConversation,c,readScheduleOriginRows));
 async function transcript({principal,request,signal,recheckConversation},deferCurrentness=false){
  // Subject ownership/client authorization precedes subject-specific retention observations.
  const result=await store.history.transcript({principal,...request},check(signal));
  await servable(principal,request.conversationId);if(!deferCurrentness)await current(recheckConversation,result.conversation);
  // Keep both local retention observations; final fenced release checks retention again after its fresh Core read.
  await servable(principal,request.conversationId);return result;
 }
 return Object.freeze({
  deletions:guard(deletions.list),deletionStatus:guard(deletions.read),
  summaries:guard(call=>{if(!management)refuse('CONVERSATION_UNAVAILABLE');return management.summaries(call);}),
  manage:guard(call=>{if(!management)refuse('CONVERSATION_UNAVAILABLE','NOT_DISPATCHED');return management.manage(call);}),
  // A page is released only through recheckRelease, which checks Core currentness for every row inside the serving fence after
  // the final membership recheck. Checking it here as well would only repeat those reads, so the list keeps the retention filter.
  list:guard(async({principal,request,signal})=>{
   const result=await store.history.list({principal,...request},check(signal)),visible=[];
   for(const c of result.conversations){try{await servable(principal,c.conversationId);}catch(error){if(error?.code==='RETENTION_SUPPRESSED')continue;throw error;}visible.push(c);}
   return {...result,conversations:visible};
  }),
  // Read-only transcript releases only through the final serving fence, like list; nextTurn keeps every early/fresh check.
  transcript:guard(call=>transcript(call,true)),
  export:guard(call=>exportConversationMessages({call,read:value=>transcript(value,true)})),
  // One fence spans ALL subjects, final native membership/Core checks and response serialization.
  recheckRelease:guard(async({principal,request,result,operation,signal,deadlineMs,recheckMembership,recheckConversation,recheckMetadata,management:core,publish})=>{
   if(typeof recheckMembership!=='function'||typeof publish!=='function')refuse('PRODUCT_CONFIGURATION');
   if(operation==='deletions'){await recheckMembership();check(signal)();return publish(result);}
   if(operation==='deletionStatus')return deletions.release({principal,request,result,signal,deadlineMs,recheckMembership,management:core,publish});
   // Management returns metadata only, including intentionally suppressed Trash.
   // Its transition already settled under the exclusive fence; no content is released.
   if(operation==='manage'||operation==='summaries'){await recheckMembership();
    const rows=operation==='manage'?[result.conversation]:result.conversations;
    for(const row of rows){const current=await core.metadata(row.conversationId);if(current.scopeKind!==row.scopeKind||current.clientId!==row.clientId||
     row.scopeKind==='research_portfolio'&&!sameResearchContext(current,row))refuse('CONVERSATION_UNAVAILABLE');}
    check(signal)();return publish(result);
   }
   let conversations=operation==='list'?result.conversations:[result.conversation];
   // Turn receipts do not carry scopes: re-read the trusted saved owner record for release authorization.
   if(operation==='nextTurn'){const saved=await store.history.transcript({principal,conversationId:request.conversationId,after:0,limit:1},check(signal));conversations=[saved.conversation];}
   const subjects=conversations.map(c=>({tenantId:principal.tenantId,kind:'conversation',subjectId:c.conversationId}));
   const release=async(fenceSignal,assertReleaseServable,readScheduleOriginRows)=>{
    if(retention&&typeof assertReleaseServable!=='function')refuse('PRODUCT_CONFIGURATION');
    const releaseServable=conversationId=>retention?assertReleaseServable({tenantId:principal.tenantId,kind:'conversation',subjectId:conversationId}):Promise.resolve();
    check(signal)();await recheckMembership();
    // Any Core refusal or outage withholds the whole page; no refused row is skipped.
    if(core&&operation!=='nextTurn'){
     if(typeof recheckMetadata!=='function')refuse('CONVERSATION_UNAVAILABLE');
     const metadata=await readAll(conversations,c=>recheckMetadata(c,readScheduleOriginRows));
     conversations=conversations.filter((conversation,index)=>{const m=metadata[index];if(m===null)return true;
      assertManagedScope(principal,m,conversation);if(operation==='list'&&m.status!=='active')return false;
      // The separate run-index v1 General selector has no Research subject.
      // Private-user storage must not make a Research run eligible for it.
      if(operation==='list'&&request.scope?.kind==='general'&&m.scopeKind==='research_portfolio')return false;
      if(m.status==='trashed')refuse('CONVERSATION_NOT_FOUND');return true;});
    }else await currentAll(recheckConversation,conversations,readScheduleOriginRows);
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
   let admitted;try{admitted=await nextRunOwner.admitTurn({principal:{tenantId:principal.tenantId,actorId:principal.actorId},...request,signal,assertActive:()=>current(recheckConversation,saved.conversation)});}
   // A source not yet settled (or still live) refuses before any reservation write: a definite, retryable conflict, never UNKNOWN.
   catch(error){if(['NEXT_RUN_SOURCE_UNSETTLED','NEXT_RUN_SOURCE_NOT_TERMINAL'].includes(error?.code))throw new ProductError('CONVERSATION_TURN_CONFLICT','NOT_DISPATCHED');throw asProductError(error,'CONVERSATION_UNAVAILABLE','UNKNOWN');}
   try{await servable(principal,request.conversationId);await current(recheckConversation,saved.conversation);await servable(principal,request.conversationId);}catch(error){throw new ProductError(productFailure(error)?.code??'CONVERSATION_UNAVAILABLE','RESULT_NOT_RELEASED');}
   return {schema:TURN_SCHEMA,...admitted};
  }),
 });
}
