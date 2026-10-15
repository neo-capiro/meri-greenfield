// @ts-check
/** Accounting for everything the readiness probe observes from one SDK startup, and the single verdict derived from
 * all of it. Pure: no SDK, timers or filesystem, so every ordering can be tested with scripted frames.
 *
 * The probe never sends a user message, so the only frames consistent with "the sandbox started and the CLI is idle"
 * are bookkeeping `system` frames. Every frame is validated and counted, every result frame's usage is summed, and
 * contrary evidence observed at ANY point (before or after initialisation, during the quiet window or during the
 * deliberate shutdown) outranks an earlier initialisation. `ready` is the residue when nothing contrary was seen,
 * initialisation completed and the deliberate shutdown was clean.
 *
 * Deliberate shutdown is the probe's own close after its observation window. After it begins, a normal end of the
 * stream or an `AbortError` from the iterator is that shutdown; any other iterator failure, a close() failure, an
 * unsettled consumer or an unremovable temporary directory is a failed shutdown, which is never `ready`. Before it
 * begins, the stream ending or failing for any reason is an unexpected startup failure. */
/** Bookkeeping `system` subtypes a CLI may emit while initialising with no user message. Anything else is refused. */
export const STARTUP_SYSTEM_SUBTYPES=Object.freeze(['init','status','hook_started','hook_progress','hook_response','plugin_install','commands_changed','worker_shutting_down']);
/** Frame types and `system` subtypes that exist only when a model request was made. */
export const MODEL_ACTIVITY_TYPES=Object.freeze(['assistant','user','stream_event','rate_limit_event','tool_progress','tool_use_summary','prompt_suggestion']);
export const MODEL_ACTIVITY_SYSTEM_SUBTYPES=Object.freeze(['api_retry','thinking_tokens','model_refusal_fallback','model_refusal_no_fallback','compact_boundary','memory_recall','permission_denied']);
/** Measured on CLI 2.1.295: with the sandbox enabled the CLI refuses to start when bwrap/socat are missing, and with
 * CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1 it exits even earlier because the scrub itself requires bubblewrap.
 * @param {string} text */
export const reasonOf=text=>/dependencies are missing|bubblewrap is required|not installed/iu.test(text)?'SANDBOX_DEPENDENCIES_MISSING':/sandbox required but unavailable/iu.test(text)?'SANDBOX_UNAVAILABLE':'SDK_STARTUP_FAILED';
const MAX_TEXTS=16,MAX_TEXT=4096;
const usage=(/** @type {unknown} */v)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const isAbort=(/** @type {unknown} */e)=>/** @type {{name?:unknown}} */(e)?.name==='AbortError';
/** @typedef {{status:'ready'|'refused'|'timeout',reasonCode:string|null,userMessagesSent:0,modelTurns:number,costUsd:number,messagesObserved:number,resultsObserved:number,initialized:boolean,shutdown:'clean'|'failed'}} StartupVerdict */
export function createStartupObservation(){
 let messages=0,results=0,modelTurns=0,costUsd=0,initialized=false,shuttingDown=false,timedOut=false;
 let modelActivity=false,malformed=false,startupFailed=false,unexpectedFrame=false,unexpectedResult=false,streamEnded=false;
 /** @type {string|undefined} */let cleanupFailure;
 /** SDK text only feeds the bounded reason code; it never leaves this module. @type {string[]} */const texts=[];
 const note=(/** @type {unknown} */t)=>{if(typeof t==='string'&&texts.length<MAX_TEXTS)texts.push(t.slice(0,MAX_TEXT));};
 const failCleanup=(/** @type {string} */code)=>{cleanupFailure??=code;};
 /** @param {any} m */
 function result(m){
  results++;
  if(!usage(m.num_turns)||!Number.isSafeInteger(m.num_turns)||!usage(m.total_cost_usd)){malformed=true;return;}
  modelTurns+=m.num_turns;costUsd+=m.total_cost_usd;if(m.num_turns>0||m.total_cost_usd>0)modelActivity=true;
  if(m.is_error!==false||m.subtype!=='success'){startupFailed=true;note(m.result);if(Array.isArray(m.errors))m.errors.forEach(note);}
  else unexpectedResult=true; // A success result means a turn ran to completion, which a readiness probe never asks for.
 }
 return {
  /** Every frame the consumer receives, in order. @param {unknown} frame */
  frame(frame){
   messages++;const m=/** @type {any} */(frame);
   if(m===null||typeof m!=='object'||Array.isArray(m)||typeof m.type!=='string'){malformed=true;return;}
   if(m.type==='result')result(m);
   else if(MODEL_ACTIVITY_TYPES.includes(m.type)||m.type==='system'&&MODEL_ACTIVITY_SYSTEM_SUBTYPES.includes(m.subtype))modelActivity=true;
   else if(m.type!=='system'||!STARTUP_SYSTEM_SUBTYPES.includes(m.subtype))unexpectedFrame=true;
  },
  initialized(){initialized=true;},
  /** `initializationResult()` rejected, or `query()` itself threw. @param {unknown} error */
  startupRefused(error){startupFailed=true;note(/** @type {Error} */(error)?.message);},
  /** The iterator threw. @param {unknown} error */
  streamFailed(error){if(shuttingDown&&isAbort(error))return;if(shuttingDown)failCleanup('SDK_SHUTDOWN_FAILED');else{startupFailed=true;note(/** @type {Error} */(error)?.message);}},
  streamEnded(){if(!shuttingDown)streamEnded=true;},
  timedOut(){timedOut=true;},
  beginShutdown(){shuttingDown=true;},
  /** @param {'SDK_CLOSE_FAILED'|'SDK_CLEANUP_TIMEOUT'|'READINESS_CLEANUP_FAILED'} code */
  cleanupFailed(code){failCleanup(code);},
  /** True once anything observed already forbids `ready`; ends the probe's waits early. */
  get contrary(){return modelActivity||malformed||startupFailed||unexpectedFrame||unexpectedResult||streamEnded;},
  /** The one verdict, in fixed precedence: model activity, malformed frames, startup errors, unexpected frames or
   * results, the stream ending on its own, timeout, missing initialisation, failed shutdown, then ready.
   * @returns {StartupVerdict} */
  verdict(){
   const reasonCode=modelActivity?'READINESS_MODEL_TURN_OBSERVED':malformed?'SDK_FRAME_MALFORMED':startupFailed?reasonOf(texts.join(' ')):
    unexpectedFrame?'SDK_UNEXPECTED_FRAME':unexpectedResult?'SDK_UNEXPECTED_RESULT':streamEnded?'SDK_STREAM_ENDED':timedOut?'SDK_STARTUP_TIMEOUT':
    !initialized?'SDK_STARTUP_FAILED':cleanupFailure??null;
   const status=reasonCode===null?'ready':reasonCode==='SDK_STARTUP_TIMEOUT'?'timeout':'refused';
   return {status,reasonCode,userMessagesSent:0,modelTurns,costUsd,messagesObserved:messages,resultsObserved:results,initialized,shutdown:cleanupFailure===undefined?'clean':'failed'};
  }};
}
