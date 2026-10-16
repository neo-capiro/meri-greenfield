/** Closed intent failures. `effect` records what the failed attempt may have left behind for the replay journal:
 * `none` (no owner effect: the delivery settles FAILED and replays the same refusal) or `unknown` (a proposal, draft or
 * claim may exist: the delivery stays UNKNOWN and is never prepared again). */
export const intentFault=(code,effect)=>Object.assign(Error(code),{code,...(effect?{effect}:{})});
export const INTENT_FAILURE_CODES=Object.freeze(['UNAVAILABLE','ACCESS_DENIED','REFUSED','INVALID_ARGUMENTS','DEADLINE','CANCELLED','CONFLICT','UNKNOWN']);
