/** Closed intent failures. `effect` records what the failed attempt may have left behind for the replay journal:
 * `none` (no owner effect: the delivery settles FAILED and replays the same refusal) or `unknown` (a proposal, draft or
 * claim may exist: the delivery stays UNKNOWN and is never prepared again). */
/** `detail` (INVALID_ARGUMENTS only): the canonical schema's bounded account of which field was refused, so the model can
 * correct the call; it names paths and keywords, never values, and it is advisory beside the closed code. */
export const INTENT_DETAIL_MAX=400;
export const intentFault=(code,effect,detail)=>Object.assign(Error(code),{code,...(effect?{effect}:{}),...(typeof detail==='string'&&detail.length?{detail:detail.slice(0,INTENT_DETAIL_MAX)}:{})});
export const INTENT_FAILURE_CODES=Object.freeze(['UNAVAILABLE','ACCESS_DENIED','REFUSED','INVALID_ARGUMENTS','DEADLINE','CANCELLED','CONFLICT','UNKNOWN']);
