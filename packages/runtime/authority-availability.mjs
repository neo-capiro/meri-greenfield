/** One owner for "the authority dependency did not answer": a Core/Clerk round trip that ran out of its own request budget,
 * failed in the network, or answered 408, 429 or 5xx. Only errors marked here are transient; every other failure, including
 * every explicit refusal, mismatch, malformed answer and expiry, stays definitive. A mark never grants anything: callers still
 * refuse the request that met it and must obtain a fresh, successful answer before acting. */
const unavailable=new WeakSet();
/** Marks `error` as transient and returns it; the error's own code and message are unchanged. */
export function markAuthorityUnavailable(error){if(error!==null&&typeof error==='object')unavailable.add(error);return error;}
export const isAuthorityUnavailable=error=>error!==null&&typeof error==='object'&&unavailable.has(error);
/** For a layer that replaces `cause` with its own `error`: keeps the transient mark, never adds one. */
export const carryAuthorityUnavailable=(cause,error)=>isAuthorityUnavailable(cause)?markAuthorityUnavailable(error):error;
/** HTTP statuses that report a dependency that could not answer, never a decision. */
export const isUnavailableStatus=status=>status===408||status===429||Number.isSafeInteger(status)&&status>=500&&status<=599;
