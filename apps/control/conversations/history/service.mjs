/** Membership-authorized read/admission facade. The caller supplies the canonical product gate's principal, never a UI identity. */
import {asProductError,refuse} from '../../product-access/errors.mjs';
import {TURN_SCHEMA} from './protocol.mjs';
import {terminal} from '../boundary.mjs';
export function createConversationHistoryService({store,nextRunOwner,gate,retention}){
 if(['list','transcript'].some(k=>typeof store?.history?.[k]!=='function')||typeof gate?.recheck!=='function'||retention!==undefined&&typeof retention.assertServable!=='function')refuse('PRODUCT_CONFIGURATION');
 const guard=fn=>async value=>{try{return await fn(value);}catch(error){throw asProductError(error,'CONVERSATION_UNAVAILABLE');}};
 const check=signal=>()=>signal?.throwIfAborted();
 async function servable(principal,conversationId){if(retention)await retention.assertServable({tenantId:principal.tenantId,kind:'conversation',subjectId:conversationId});}
 async function transcript({principal,request,signal}){
  await servable(principal,request.conversationId);const result=await store.history.transcript({principal,...request},check(signal));
  await servable(principal,request.conversationId);return result;
 }
 return Object.freeze({
  list:guard(async({principal,request,signal})=>{
   const result=await store.history.list({principal,...request},check(signal)),visible=[];
   for(const c of result.conversations){try{await servable(principal,c.conversationId);visible.push(c);}catch(error){if(error?.code!=='RETENTION_SUPPRESSED')throw error;}}
   return {...result,conversations:visible};
  }),
  transcript:guard(transcript),
  nextTurn:guard(async({principal,request,signal,deadlineMs})=>{
   if(typeof nextRunOwner?.admitTurn!=='function')refuse('CONVERSATION_TURN_UNAVAILABLE','NOT_DISPATCHED');
   const current=await transcript({principal,request:{conversationId:request.conversationId,after:0,limit:1},signal});
   if(current.latestRun.binding.runId===request.sourceRunId&&!terminal(current.latestRun.state))refuse('CONVERSATION_TURN_CONFLICT','NOT_DISPATCHED');
   await gate.recheck({principal,signal,deadlineMs});
   let admitted;try{admitted=await nextRunOwner.admitTurn({principal:{tenantId:principal.tenantId,actorId:principal.actorId},...request,signal});}
   catch(error){throw asProductError(error,'CONVERSATION_UNAVAILABLE','UNKNOWN');}
   try{await servable(principal,request.conversationId);}catch(error){throw asProductError(error,'CONVERSATION_UNAVAILABLE','RESULT_NOT_RELEASED');}
   return {schema:TURN_SCHEMA,...admitted};
  }),
 });
}
