// @ts-check
/** The per-run journal adapter that gives the pending question real durability through the existing run-event owner.
 *
 * Every record the registry keeps becomes one run event appended through `runOwner.append` — the same durable,
 * ordered, replayable journal the conversation already uses. That is what makes the question survive a reconnect, a
 * refresh or a restart: the client re-reads its own run events and finds the pending question (and, once the run ends,
 * its outcome) instead of an in-memory map. The registry's shape is mapped here, once, so neither module has to know the
 * other's vocabulary. The worker never reads its own journal: a suspended native `canUseTool` callback does not survive
 * the process that was suspended in it, so recovery is the client/control readback of these events.
 */
import {QUESTION_PENDING_RECORD,QUESTION_ANSWERED_RECORD,QUESTION_CANCELLED_RECORD} from './registry.mjs';
export const USER_QUESTION_PENDING_EVENT='question.pending';
export const USER_QUESTION_ANSWERED_EVENT='question.answered';
/** @param {{runOwner:object,binding:object,now:()=>number,newId:()=>string}} input */
export function createQuestionEventJournal({runOwner,binding,now,newId}){
 if(typeof runOwner?.append!=='function'||typeof now!=='function'||typeof newId!=='function'||!binding)
  throw Object.assign(Error('USER_QUESTION_CONFIGURATION'),{code:'USER_QUESTION_CONFIGURATION'});
 /** One registry record, as the run event the conversation already stores and streams. */
 async function record(entry){
  const event=toEvent(entry);
  if(event===null)return;
  await runOwner.append({binding,event:{eventId:newId(),createdAt:new Date(now()).toISOString(),...event}});
 }
 return Object.freeze({record});
}
/** @param {{type:string,data:object}} entry */
function toEvent(entry){
 const data=entry?.data;
 if(entry?.type===QUESTION_PENDING_RECORD){
  const request=data?.request;
  if(!request?.subject)return null;
  return {type:USER_QUESTION_PENDING_EVENT,data:{questionId:data.questionId,toolUseId:request.subject.toolUseId,
   questionsSha256:request.subject.questionsSha256,expiresAt:new Date(request.expiresAtMs).toISOString(),questions:request.questions}};
 }
 if(entry?.type===QUESTION_ANSWERED_RECORD)return {type:USER_QUESTION_ANSWERED_EVENT,data:{questionId:data.questionId,outcome:'answered',reasonCode:null}};
 if(entry?.type===QUESTION_CANCELLED_RECORD)return {type:USER_QUESTION_ANSWERED_EVENT,data:{questionId:data.questionId,outcome:'cancelled',reasonCode:data.reasonCode}};
 return null;
}
