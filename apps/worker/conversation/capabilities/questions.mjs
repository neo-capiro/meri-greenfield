// @ts-check
/** Native clarifying questions (`AskUserQuestion`) bound to the canonical user-input owner.
 *
 * The pinned SDK (0.3.295) exposes Claude's questions through `canUseTool` with `toolName: 'AskUserQuestion'` and an
 * input of `{questions:[{question,header,options:[{label,description}],multiSelect}]}`; the callback must answer with
 * `{behavior:'allow',updatedInput:{questions,answers}}` where each `answers` key is the asked question text and each
 * value is the chosen option's label, a free-text reply, or (multi-select only) the selected labels. This module owns
 * exactly that contract: the native count/option limits, single/multi selection, free text, and the mapping back to the
 * original questions. It substitutes for neither the SDK harness nor a second model.
 *
 * The questions themselves are the owner's (`questions.ask(request,{signal})`, symmetric with the Bash and browser
 * approval ports): it records the pending question durably, binds the answer to the run, verifies the answer against the
 * exact questions asked (`answerSelectionRefusal`, shared here) and resolves the wait once with that answer or with null
 * when it dropped the question. This gate therefore never invents or re-verifies an answer: an aborted run, an expired
 * window, a missing port or a dropped question refuse the call. A clarifying answer is not permission for any tool,
 * external effect or approval; the original tool still needs its own authority.
 */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
export const USER_QUESTION_TOOL='AskUserQuestion';
const USER_QUESTION_SUBJECT_SCHEMA='meri-user-question-subject/1',USER_QUESTION_REQUEST_SCHEMA='meri-user-question/1';
/** Documented native limits: 1-4 questions, 2-4 options each, header at most 12 characters. */
export const MAX_QUESTIONS=4;
const MIN_OPTIONS=2,MAX_OPTIONS=4,MAX_HEADER=12,MAX_QUESTION=1000,MAX_ANSWER=10000,MAX_LABEL=200,MAX_DESCRIPTION=1000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
/** How long one pending question may wait for an authenticated answer. The window bounds the suspended callback; it is
 * not a default answer: an elapsed window refuses the call. */
export const QUESTION_DEADLINE_MS=Object.freeze({default:900000,min:1000,max:3600000});
const EXPIRED=Symbol('user-question-expired'),CANCELLED=Symbol('user-question-cancelled');
/** Races the owner's answer against the run's AbortSignal and the bounded answer window. The port's own signal is
 * aborted on either stop so the owner can drop the pending question; an answer that arrives after the race settled is
 * ignored, and a stopped wait never becomes an answer. */
async function askWithin(port,request,signal,deadlineMs){
 const expiry=new AbortController(),portSignal=signal?AbortSignal.any([signal,expiry.signal]):expiry.signal;
 let timer,onAbort;
 const stopped=new Promise(resolve=>{
  timer=setTimeout(()=>{expiry.abort(new Error('USER_QUESTION_EXPIRED'));resolve(EXPIRED);},deadlineMs);
  timer.unref?.();// the answer window never keeps the worker alive on its own
  if(signal){onAbort=()=>resolve(CANCELLED);signal.addEventListener('abort',onAbort,{once:true});}
 });
 const answer=Promise.resolve().then(()=>port.ask(request,{signal:portSignal}));
 answer.catch(()=>{});// a rejection after the race is settled is ignored, not unhandled
 try{return await Promise.race([answer,stopped]);}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
}
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(Error(code),{code});};
/** @param {unknown} value @returns {value is Record<string,unknown>} */
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
/** @param {unknown} value @param {number} max */
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&value.isWellFormed();
/** Shape check of one native question set; returns the exact questions the answer must map back onto. @param {unknown} value */
export function assertUserQuestionInput(value){
 let input;try{input=own(value,['questions']);}catch{fail('USER_QUESTION_INVALID');}
 const {questions}=/** @type {{questions:unknown}} */(input);
 if(!Array.isArray(questions)||questions.length<1||questions.length>MAX_QUESTIONS)fail('USER_QUESTION_INVALID');
 const seen=new Set();
 const normalized=questions.map(raw=>{
  let q;try{q=own(raw,['question','header','options','multiSelect']);}catch{fail('USER_QUESTION_INVALID');}
  const {question,header,multiSelect}=/** @type {{question:unknown,header:unknown,multiSelect:unknown,options:unknown}} */(q);
  if(!text(question,MAX_QUESTION)||seen.has(question))fail('USER_QUESTION_INVALID');seen.add(question);
  if(!text(header,MAX_HEADER)||typeof multiSelect!=='boolean')fail('USER_QUESTION_INVALID');
  if(!Array.isArray(q.options)||q.options.length<MIN_OPTIONS||q.options.length>MAX_OPTIONS)fail('USER_QUESTION_INVALID');
  const labels=new Set();
  const options=q.options.map(rawOption=>{
   let option;try{option=own(rawOption,['label','description']);}catch{fail('USER_QUESTION_INVALID');}
   const {label,description}=/** @type {{label:unknown,description:unknown}} */(option);
   if(!text(label,MAX_LABEL)||!text(description,MAX_DESCRIPTION)||labels.has(label))fail('USER_QUESTION_INVALID');
   labels.add(label);return Object.freeze({label,description});
  });
  return Object.freeze({question,header,options:Object.freeze(options),multiSelect});
 });
 return Object.freeze(normalized);
}
/** @param {unknown} port */
export const isQuestionPort=port=>typeof /** @type {{ask?:unknown}} */(port)?.ask==='function';
/** Everything one answer resolves: the full run binding, the tool-use id, the question-set id and the digest of the
 * exact questions Claude asked. @param {{binding:object,toolUseId:string,questionId:string,questions:readonly object[]}} facts */
function userQuestionSubject({binding,toolUseId,questionId,questions}){
 return Object.freeze({schema:USER_QUESTION_SUBJECT_SCHEMA,binding:structuredClone(binding),tool:USER_QUESTION_TOOL,toolUseId,questionId,
  questionsSha256:canonicalSha256(questions)});
}
/** The request presented to the owner: the subject, its digest, the original questions and the answer window. */
function userQuestionRequest({subject,questions,requestedAtMs,expiresAtMs}){
 return Object.freeze({schema:USER_QUESTION_REQUEST_SCHEMA,subject:structuredClone(subject),subjectSha256:canonicalSha256(subject),
  questions:structuredClone(questions),requestedAtMs,expiresAtMs});
}
/** Semantic refusal of one answer selection against the exact questions that were asked, or null when it is answerable.
 *
 * This is the single place the pending-question owner decides what a valid answer is: every question answered once, no
 * answer to a question that was not asked, an array only for a multi-select question with distinct offered labels, and a
 * non-empty string (an offered label or the user's own text) otherwise. The owner applies it before anything is recorded
 * or the suspended callback is resolved; the gate consumes the verified answer as is. */
export function answerSelectionRefusal(questions,answers){
 if(!record(answers))return 'USER_QUESTION_ANSWER_DENIED';
 const asked=new Set(questions.map(question=>question.question));
 for(const key of Object.keys(answers))if(!asked.has(key))return 'USER_QUESTION_ANSWER_MISMATCH';
 if(Object.keys(answers).length!==asked.size)return 'USER_QUESTION_ANSWER_MISMATCH';
 for(const question of questions){
  const value=answers[question.question],labels=question.options.map(option=>option.label);
  if(Array.isArray(value)){
   if(!question.multiSelect||!value.length||value.length>question.options.length||new Set(value).size!==value.length||value.some(label=>typeof label!=='string'||!labels.includes(label)))return 'USER_QUESTION_ANSWER_MISMATCH';
   continue;
  }
  if(typeof value!=='string'||!text(value,MAX_ANSWER))return 'USER_QUESTION_ANSWER_DENIED';
 }
 return null;
}
/** The native answers record: arrays become the comma-separated string the pinned SDK announces for multi-select
 * (sdk-tools.d.ts AskUserQuestionInput.answers). @param {Record<string,string|string[]>} answers */
function nativeAnswers(answers){
 /** @type {Record<string,string>} */
 const native={};
 for(const [question,value] of Object.entries(answers))native[question]=Array.isArray(value)?value.join(', '):value;
 return native;
}
/** `signal` is the run's own abort signal: a Stop or deadline ends the wait even when the SDK keeps the tool call's signal open.
 * @param {{binding:object,questions:object,now:()=>number,newId:()=>string,questionDeadlineMs?:number,signal?:AbortSignal}} input
 * @returns {import('@anthropic-ai/claude-agent-sdk').CanUseTool} */
export function createUserQuestionGate({binding,questions,now,newId,questionDeadlineMs=QUESTION_DEADLINE_MS.default,signal:runSignal}){
 try{validateShape('RunBinding',binding);}catch{fail('USER_QUESTION_CONFIGURATION');}
 if(!isQuestionPort(questions)||typeof now!=='function'||typeof newId!=='function'||runSignal!==undefined&&!(runSignal instanceof AbortSignal)||
  !Number.isSafeInteger(questionDeadlineMs)||questionDeadlineMs<QUESTION_DEADLINE_MS.min||questionDeadlineMs>QUESTION_DEADLINE_MS.max)fail('USER_QUESTION_CONFIGURATION');
 return async(name,input,options)=>{
  if(name!==USER_QUESTION_TOOL)return /** @type {any} */(undefined);
  const toolUseID=options?.toolUseID;
  /** @param {string} message @returns {import('@anthropic-ai/claude-agent-sdk').PermissionResult} */
  const deny=message=>({behavior:'deny',message,...(typeof toolUseID==='string'?{toolUseID}:{})});
  try{
   if(typeof toolUseID!=='string'||options?.signal?.aborted||runSignal?.aborted)return deny('USER_QUESTION_UNAVAILABLE');
   let questionsAsked;
   try{questionsAsked=assertUserQuestionInput(input);}catch{return deny('USER_QUESTION_INVALID');}
   const questionId=newId();
   if(typeof questionId!=='string'||!UUID.test(questionId))return deny('USER_QUESTION_UNAVAILABLE');
   const requestedAtMs=now();
   if(!Number.isSafeInteger(requestedAtMs))return deny('USER_QUESTION_UNAVAILABLE');
   const subject=userQuestionSubject({binding,toolUseId:toolUseID,questionId,questions:questionsAsked});
   const request=userQuestionRequest({subject,questions:questionsAsked,requestedAtMs,expiresAtMs:requestedAtMs+questionDeadlineMs});
   const signals=[options.signal,runSignal].filter(s=>s instanceof AbortSignal),signal=signals.length>1?AbortSignal.any(signals):signals[0];
   // The port gets its own copy: nothing it does can change the questions this call is answered against.
   const answer=await askWithin(questions,structuredClone(request),signal,questionDeadlineMs);
   if(answer===EXPIRED||now()>request.expiresAtMs)return deny('USER_QUESTION_EXPIRED');
   // The owner answers null when it dropped the question (run ending, owner closed): that is a cancellation, never an answer.
   if(answer===CANCELLED||answer===null||signal?.aborted)return deny('USER_QUESTION_CANCELLED');
   // The owner verified the selection against these exact questions and recorded it before resolving; it is passed back as is.
   return {behavior:'allow',updatedInput:{questions:questionsAsked,answers:nativeAnswers(answer.answers)},toolUseID};
  }catch{return deny('USER_QUESTION_UNAVAILABLE');}
 };
}
