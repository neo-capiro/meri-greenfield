// @ts-check
/** Durable pending-question port for the native `AskUserQuestion` gate (`capabilities/questions.mjs`).
 *
 * The gate asks for clarification and suspends the tool call; this owner is what makes the wait resumable instead of
 * process-local. It records the exact question-set as a durable request bound to the run binding, keeps the pending
 * entry readable so a reconnect/refresh/restart can recover the same question, and resolves the suspended callback only
 * with an answer that arrives for that exact request. It never invents an answer: a cancellation or shutdown drops the
 * entry, and an answer that arrives afterwards is refused as stale rather than replayed into a different call.
 *
 * Identity comes from the server side of the call, never from the answer payload: the caller supplies the selected
 * labels or typed text for the questions it was shown, and this owner stamps the run binding, the question id and the
 * subject digest that the gate then checks. A duplicate reply is therefore idempotent to detect (one pending entry, one
 * resolution) and an answer for another run, conversation, actor or tenant cannot match.
 *
 * `journal` is the durable owner. Its two operations are deliberately small so the existing conversation store can
 * back it without a new table or migration: `record(entry)` persists one immutable record, `read(questionId)` returns
 * the latest record for that id (or null). A control plane that stores run events satisfies both with its existing
 * append/read-by-id path. This module owns no storage, authority or model loop of its own.
 */
export const QUESTION_PENDING_RECORD='question.pending';
export const QUESTION_ANSWERED_RECORD='question.answered';
export const QUESTION_CANCELLED_RECORD='question.cancelled';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(Error(code),{code});};
/** @param {unknown} value */
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
/** @param {unknown} journal */
export const isQuestionJournal=journal=>typeof /** @type {{record?:unknown}} */(journal)?.record==='function'&&
 typeof /** @type {{read?:unknown}} */(journal)?.read==='function';
/** @param {{journal:object,now:()=>number}} input */
export function createQuestionRegistry({journal,now=Date.now}){
 if(!isQuestionJournal(journal)||typeof now!=='function')fail('USER_QUESTION_CONFIGURATION');
 /** Pending questions in this worker: one entry per asked question-set. @type {Map<string,{request:object,resolve:(answer:object)=>void}>} */
 const pending=new Map();
 /** Questions seen only through recovery: they were answered in a process that no longer exists. */
 const recovered=new Set();
 /** Answered question ids stay known so a duplicate reply is refused instead of re-running the tool. */
 const answered=new Set();
 const cancelled=new Set();
 async function persist(type,data){
  try{await journal.record({type,data,recordedAtMs:now()});}catch{fail('USER_QUESTION_PERSISTENCE_FAILED');}
 }
 /** Recovery: the durable record of an unanswered question.
  *
  * It returns the record with `resumable:false`. Recovery can re-expose what was asked, but it cannot rebuild the
  * suspended native callback of a process that is gone: an answer submitted to a recovered question is refused as
  * unrecoverable and the run must ask again. A journal owner that has no read refuses outright. */
 async function recover(questionId){
  if(typeof questionId!=='string'||!UUID.test(questionId))fail('USER_QUESTION_INVALID');
  let latest;
  try{latest=await journal.read(questionId);}catch(error){fail(error?.code==='USER_QUESTION_RECOVERY_UNAVAILABLE'?'USER_QUESTION_RECOVERY_UNAVAILABLE':'USER_QUESTION_INVALID');}
  if(!record(latest)||!record(latest.data)||latest.data.questionId!==questionId)fail('USER_QUESTION_INVALID');
  recovered.add(questionId);
  return Object.freeze({type:latest.type,request:latest.data.request,resumable:false});
 }
 /** The gate's port: record durably, then wait. A stop drops the entry and records the cancellation; it never answers. */
 async function ask(request,{signal}={}){
  if(!record(request)||!record(request.subject)||typeof request.subject.questionId!=='string'||!UUID.test(request.subject.questionId)||
   typeof request.subject.toolUseId!=='string'||!Array.isArray(request.questions)||!request.questions.length)fail('USER_QUESTION_INVALID');
  const questionId=request.subject.questionId;
  if(pending.has(questionId)||answered.has(questionId))fail('USER_QUESTION_DUPLICATE');
  await persist(QUESTION_PENDING_RECORD,{questionId,request});
  if(signal?.aborted){await persist(QUESTION_CANCELLED_RECORD,{questionId,reasonCode:'USER_QUESTION_CANCELLED'});cancelled.add(questionId);return null;}
  return await new Promise(resolve=>{
   const settle=answer=>{if(!pending.has(questionId))return;pending.delete(questionId);signal?.removeEventListener('abort',stop);resolve(answer);};
   const stop=()=>{settle(null);cancelled.add(questionId);
    // An elapsed answer window ends the wait like a cancellation, but the durable record says which one happened.
    const reasonCode=signal?.reason?.message==='USER_QUESTION_EXPIRED'?'USER_QUESTION_EXPIRED':'USER_QUESTION_CANCELLED';
    persist(QUESTION_CANCELLED_RECORD,{questionId,reasonCode}).catch(()=>{});};
   pending.set(questionId,{request,resolve:settle});
   signal?.addEventListener('abort',stop,{once:true});
  });
 }
 /** Deliver one authenticated answer to the suspended call.
  *
  * `answers` is the user's selection (labels, or their own text). The run binding, subject digest and answer time are
  * taken from this owner, so a client cannot answer for another run or forge an identity. Returns a stable outcome:
  * 'ANSWERED', 'STALE' (no such pending question), 'REPLAY' (already answered), 'CANCELLED', or a refusal code. */
 async function deliver({questionId,answers,binding}){
  if(typeof questionId!=='string'||!UUID.test(questionId))return 'USER_QUESTION_INVALID';
  // One answer per pending question: a repeat reply is refused, never applied twice.
  if(answered.has(questionId))return 'REPLAY';
  if(cancelled.has(questionId))return 'CANCELLED';
  // A recovered question has no suspended callback left to answer: refuse it instead of pretending to resume it.
  if(recovered.has(questionId))return 'USER_QUESTION_UNRECOVERABLE';
  const entry=pending.get(questionId);
  if(!entry)return 'STALE';
  const request=entry.request;
  if(!record(binding)||binding.tenantId!==request.subject.binding.tenantId||binding.actorId!==request.subject.binding.actorId||
   binding.conversationId!==request.subject.binding.conversationId||binding.runId!==request.subject.binding.runId)return 'USER_QUESTION_ANSWER_MISMATCH';
  if(!record(answers)||!Object.keys(answers).length)return 'USER_QUESTION_ANSWER_DENIED';
  if(now()>request.expiresAtMs){pending.delete(questionId);await persist(QUESTION_CANCELLED_RECORD,{questionId,reasonCode:'USER_QUESTION_EXPIRED'});return 'EXPIRED';}
  // The answer record is stamped here, from the pending request and the run binding — never from the reply payload.
  const answer={schema:'meri-user-question-answer/1',questionId,subjectSha256:request.subjectSha256,
   binding:structuredClone(request.subject.binding),answers:structuredClone(answers),answeredAtMs:now()};
  answered.add(questionId);
  await persist(QUESTION_ANSWERED_RECORD,{questionId,answer});
  // Resolving last hands the answer to the suspended callback, which removes its own pending entry.
  entry.resolve(answer);
  return 'ANSWERED';
 }
 /** Questions still waiting in this worker (reconnect/refresh recovery for the conversation owner). */
 const outstanding=()=>Object.freeze([...pending.values()].map(entry=>structuredClone(entry.request)));
 return Object.freeze({ask,deliver,recover,outstanding});
}
