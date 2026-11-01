// @ts-check
/** Durable pending-question port for the native `AskUserQuestion` gate (`capabilities/questions.mjs`).
 *
 * The gate asks for clarification and suspends the tool call; this owner is what makes the wait resumable instead of
 * process-local. It records the exact question-set as a durable request bound to the run binding, keeps the pending
 * entry answerable while the suspended call lives, verifies each answer against the exact questions asked, records the
 * outcome and only then resolves the suspended callback. It never invents an answer: a cancellation, the run ending or
 * an elapsed window drops the entry with a durable cancelled outcome, and an answer that arrives afterwards is refused as
 * stale rather than replayed into a different call.
 *
 * Identity comes from the server side of the call, never from the answer payload: the caller supplies the selected
 * labels or typed text for the questions it was shown; the run binding was pinned when the question was asked, the
 * control that carries the answer is pinned to the same run by the control journal and refused by the worker pump
 * otherwise, and this owner is per run. A duplicate reply is idempotent to detect (one pending entry, one resolution).
 *
 * `journal` is the durable owner: `record(entry)` persists one immutable record, which the conversation already stores
 * as its own run events (`events.mjs`), so a reconnect, refresh or restart re-reads the pending question from the run
 * history. This module owns no storage, authority or model loop of its own.
 */
import {answerSelectionRefusal} from '../capabilities/questions.mjs';
export const QUESTION_PENDING_RECORD='question.pending';
export const QUESTION_ANSWERED_RECORD='question.answered';
export const QUESTION_CANCELLED_RECORD='question.cancelled';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(Error(code),{code});};
/** @param {unknown} value */
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
/** @param {unknown} journal */
export const isQuestionJournal=journal=>typeof /** @type {{record?:unknown}} */(journal)?.record==='function';
/** @param {{journal:object,now:()=>number}} input */
export function createQuestionRegistry({journal,now=Date.now}){
 if(!isQuestionJournal(journal)||typeof now!=='function')fail('USER_QUESTION_CONFIGURATION');
 /** Pending questions in this worker: one entry per asked question-set. @type {Map<string,{request:object,resolve:(answer:object|null)=>void,stop:()=>void,recorded:Promise<void>}>} */
 const pending=new Map();
 /** Answered question ids stay known so a duplicate reply is refused instead of re-running the tool. */
 const answered=new Set();
 const cancelled=new Set();
 /** Cancellation records still being written; `close()` awaits them so a worker exit never drops a durable outcome. */
 const settling=new Set();
 let closed=false;
 async function persist(type,data){
  try{await journal.record({type,data,recordedAtMs:now()});}catch{fail('USER_QUESTION_PERSISTENCE_FAILED');}
 }
 /** One durable cancelled outcome per question, written once and tracked until it is acknowledged. */
 function cancel(questionId,reasonCode){
  if(cancelled.has(questionId))return;cancelled.add(questionId);
  const write=persist(QUESTION_CANCELLED_RECORD,{questionId,reasonCode});settling.add(write);
  write.catch(()=>{}).finally(()=>settling.delete(write));return write;
 }
 /** The gate's port: record durably, then wait. A stop drops the entry and records the cancellation; it never answers. */
 async function ask(request,{signal}={}){
  if(!record(request)||!record(request.subject)||typeof request.subject.questionId!=='string'||!UUID.test(request.subject.questionId)||
   typeof request.subject.toolUseId!=='string'||!Array.isArray(request.questions)||!request.questions.length)fail('USER_QUESTION_INVALID');
  const questionId=request.subject.questionId;
  if(pending.has(questionId)||answered.has(questionId))fail('USER_QUESTION_DUPLICATE');
  if(closed||signal?.aborted){await persist(QUESTION_PENDING_RECORD,{questionId,request});await cancel(questionId,'USER_QUESTION_CANCELLED');return null;}
  // The entry is answerable from the moment its record can be seen: it is registered before the record is written, and a
  // delivery waits for that record (deliver) so the journal never holds an answer ahead of its question.
  const recorded=Promise.withResolvers();recorded.promise.catch(()=>{});// a refused record is reported by the ask itself, not as an unhandled rejection
  const wait=new Promise(resolve=>{
   const settle=answer=>{if(!pending.has(questionId))return;pending.delete(questionId);signal?.removeEventListener('abort',stop);resolve(answer);};
   // An elapsed answer window ends the wait like a cancellation, but the durable record says which one happened.
   const stop=()=>{settle(null);cancel(questionId,signal?.reason?.message==='USER_QUESTION_EXPIRED'?'USER_QUESTION_EXPIRED':'USER_QUESTION_CANCELLED');};
   pending.set(questionId,{request,resolve:settle,stop,recorded:recorded.promise});
   signal?.addEventListener('abort',stop,{once:true});
  });
  try{await persist(QUESTION_PENDING_RECORD,{questionId,request});recorded.resolve();}
  catch(error){recorded.reject(error);const entry=pending.get(questionId);if(entry){pending.delete(questionId);signal?.removeEventListener('abort',entry.stop);}throw error;}
  return await wait;
 }
 /** The run is ending: every question still waiting is cancelled (never answered), its durable cancelled outcome is written and
  * every cancellation still in flight is awaited. Later asks are refused the same way. Idempotent. */
 async function close(){
  closed=true;
  for(const entry of [...pending.values()])entry.stop();
  const results=await Promise.allSettled([...settling]);
  const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;
 }
 /** Deliver one answer to the suspended call.
  *
  * `answers` is the user's selection (labels, or their own text) for the questions they were shown. Returns a stable
  * outcome: 'ANSWERED', 'STALE' (no such pending question), 'REPLAY' (already answered), 'CANCELLED', 'EXPIRED', or a
  * selection refusal code, in which case the question stays pending and answerable. */
 async function deliver({questionId,answers}){
  if(typeof questionId!=='string'||!UUID.test(questionId))return 'USER_QUESTION_INVALID';
  // One answer per pending question: a repeat reply is refused, never applied twice.
  if(answered.has(questionId))return 'REPLAY';
  if(cancelled.has(questionId))return 'CANCELLED';
  const entry=pending.get(questionId);
  if(!entry)return 'STALE';
  // A question whose record could not be written was never asked durably: its entry is gone by the time this settles.
  try{await entry.recorded;}catch{return 'STALE';}
  if(!pending.has(questionId))return cancelled.has(questionId)?'CANCELLED':'STALE';
  const request=entry.request;
  // The window elapsed before the gate's own timer fired: the wait ends now, as the gate would end it, and the record says so.
  if(now()>request.expiresAtMs){entry.resolve(null);await cancel(questionId,'USER_QUESTION_EXPIRED');return 'EXPIRED';}
  // The exact asked questions decide whether this is an answer at all: an array on a single-select question, a missing
  // answer, an extra key or a label that was never offered is refused here, before anything is recorded or the suspended
  // callback is resolved. A malformed answer therefore leaves the question pending and answerable.
  const refusal=answerSelectionRefusal(request.questions,answers);
  if(refusal!==null)return refusal;
  // Durable first: a record that could not be written leaves the question pending and answerable, never answered in memory
  // only. Once written, the id is answered for good and the suspended callback is resolved exactly once with the answer.
  const answer={questionId,answers:structuredClone(answers),answeredAtMs:now()};
  await persist(QUESTION_ANSWERED_RECORD,{questionId,answer});
  answered.add(questionId);
  entry.resolve(answer);
  return 'ANSWERED';
 }
 return Object.freeze({ask,deliver,close});
}
