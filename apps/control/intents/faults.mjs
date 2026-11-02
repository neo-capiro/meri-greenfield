/** Closed intent failures. `effect` records what the failed attempt may have left behind for the replay journal:
 * `none` (no owner effect: the delivery settles FAILED and replays the same refusal) or `unknown` (a proposal, draft or
 * claim may exist: the delivery stays UNKNOWN and is never prepared again). */
/** `detail`: one bounded line of plain words beside the closed code — for INVALID_ARGUMENTS the canonical schema's account
 * of which field was refused (paths and keywords, never values) so the model can correct the call; for any other code who
 * refused or did not answer, in the user's terms. It is advisory, never a constant, and may reach the model.
 * `reason`: the refusing owner's own closed constant (`SESSION_UNAVAILABLE`, `ROUTINES_STALE`, `ECONNREFUSED`, `HTTP_404`,
 * `PREVIEW_ROUTE_NOT_FOUND`), for control's log line only; it never reaches the model or the journal.
 * Only a fault made here carries either: readers take them from nothing else (`intentFaultDetail`, `intentFaultReason`). */
export const INTENT_DETAIL_MAX=400;
const REASON=/^[A-Z][A-Z0-9_]{1,62}$/u,faults=new WeakSet();
export const intentFault=(code,effect,detail,reason)=>{
 const fault=Object.assign(Error(code),{code,...(effect?{effect}:{}),...(typeof detail==='string'&&detail.length?{detail:detail.slice(0,INTENT_DETAIL_MAX)}:{}),...(typeof reason==='string'&&REASON.test(reason)?{reason}:{})});
 faults.add(fault);return fault;
};
export const isIntentFault=error=>error!==null&&typeof error==='object'&&faults.has(error);
/** A trusted owner port's own refusal that left no effect (`effect: 'none'`, made here). A preparer that has already called its
 * owner passes it through unchanged, so the delivery settles FAILED with the owner's code and detail; anything else from the
 * owner stays UNKNOWN. */
export const definiteRefusal=error=>isIntentFault(error)&&error.effect==='none'?error:undefined;
export const intentFaultDetail=error=>isIntentFault(error)&&typeof error.detail==='string'?error.detail:undefined;
export const intentFaultReason=error=>isIntentFault(error)&&typeof error.reason==='string'?error.reason:undefined;
export const INTENT_FAILURE_CODES=Object.freeze(['UNAVAILABLE','ACCESS_DENIED','REFUSED','INVALID_ARGUMENTS','DEADLINE','CANCELLED','CONFLICT','UNKNOWN']);
