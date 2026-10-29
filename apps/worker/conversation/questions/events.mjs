// @ts-check
/** The per-run journal adapter that gives the pending question real durability through the existing run-event owner.
 *
 * Every record the registry keeps becomes one run event appended through `runOwner.append` — the same durable,
 * ordered, replayable journal the conversation already uses. That is what makes the question survive a reconnect, a
 * refresh or a restart: the client re-reads its own run events and finds the pending question instead of an in-memory
 * map. The registry's shape is mapped here, once, so neither module has to know the other's vocabulary.
 *
 * `read` is deliberately the event owner's, not this adapter's: a worker does not re-read its own journal, and the
 * recovery path is the client/control readback of the same events. A caller that does need to re-read supplies its own
 * journal (tests do).
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
 /** The worker cannot read its own event journal: a suspended native `canUseTool` callback does not survive the process
  * that was suspended in it, and a display event is not a resumable SDK owner. This refuses explicitly instead of
  * returning an empty answer that a caller could mistake for "nothing pending". */
 async function read(){throw Object.assign(Error('USER_QUESTION_RECOVERY_UNAVAILABLE'),{code:'USER_QUESTION_RECOVERY_UNAVAILABLE'});}
 return Object.freeze({record,read});
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
