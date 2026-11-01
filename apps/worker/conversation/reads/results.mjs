// @ts-check
/** Closed result texts for `meri_reads` tools. Every failure is `isError:true` with one fixed text per gateway code
 * (gateway and native source-publication codes), followed by the read's own fixed next-step guidance where
 * `guidance.mjs` owns one; none carries source detail, and no failure is ever rendered as a successful or empty result. */
import {readGuidance} from './guidance.mjs';
const NOTHING='No evidence, absence or completeness is established.';
/** @type {Readonly<Record<string,(tool:string)=>string>>} */
const TEXTS=Object.freeze({
 UNAVAILABLE:tool=>`UNAVAILABLE: ${tool} is not available in this conversation. ${NOTHING}`,
 ACCESS_DENIED:tool=>`ACCESS_DENIED: ${tool} is not permitted for this user, client or conversation now. ${NOTHING}`,
 DEADLINE:tool=>`DEADLINE: ${tool} did not finish within its time limit. ${NOTHING}`,
 CANCELLED:tool=>`CANCELLED: ${tool} was cancelled before it finished. ${NOTHING}`,
 INVALID_ARGUMENTS:tool=>`INVALID_ARGUMENTS: ${tool} refused these arguments; supply literal arguments matching its input schema. ${NOTHING}`,
 BUDGET_UNCERTAIN:tool=>`BUDGET_UNCERTAIN: ${tool} could not be accounted for in this run; do not repeat this call. ${NOTHING}`,
 SOURCE_PUBLICATION_UNKNOWN:tool=>`SOURCE_PUBLICATION_UNKNOWN: ${tool} finished its read but saving the source could not be confirmed; do not repeat this call. ${NOTHING}`,
 SOURCE_PUBLICATION_CONFLICT:tool=>`SOURCE_PUBLICATION_CONFLICT: ${tool} reused a saved delivery identity with a different result; do not repeat this call. ${NOTHING}`,
 INVALID_RESULT:tool=>`INVALID_RESULT: ${tool} returned a result that failed validation and was withheld. ${NOTHING}`,
 RESOURCE_LIMIT:tool=>`RESOURCE_LIMIT: ${tool} reached a call, size or read limit for this run. ${NOTHING}`,
 GATEWAY_CONFIGURATION:tool=>`GATEWAY_CONFIGURATION: ${tool} is not configured for this conversation. ${NOTHING}`,
 INTERNAL_ERROR:tool=>`INTERNAL_ERROR: ${tool} failed. ${NOTHING}`,
});
export const READ_FAILURE_CODES=Object.freeze(Object.keys(TEXTS));
/** Separate model guidance; canonical source bytes and their hashes remain untouched. @param {{id:string}} operation @param {string} result */
export function readNotices(operation,result){
 return operation.id==='find_contacts'&&result.includes('update_client_profile')?
  [{type:/** @type {const} */('text'),text:'Notice: update_client_profile is not available in Meri. Do not propose or claim a client profile change. You may offer a governed task proposal instead.'}]:[];
}
/** Closed code of a failure: the gateway's own code (carried as `code` or as the message of a `GatewayDenied`) when it
 * is in the closed set, otherwise INTERNAL_ERROR. @param {unknown} error @returns {string} */
export function failureCode(error){
 const e=/** @type {{code?:unknown,message?:unknown}|null} */(error!==null&&typeof error==='object'?error:null);
 const code=typeof e?.code==='string'?e.code:e?.message;
 return typeof code==='string'&&Object.hasOwn(TEXTS,code)?code:'INTERNAL_ERROR';
}
/** @param {string} code @param {string} tool */
export function failureResult(code,tool){
 const closed=(Object.hasOwn(TEXTS,code)?TEXTS[code]:TEXTS.INTERNAL_ERROR)(tool),hint=readGuidance(tool)?.failures[code];
 // The read's fixed guidance sits between the closed code text and the evidence sentence, so every failure keeps
 // the same `CODE: tool ...` head and the same honest tail.
 const text=hint===undefined?closed:`${closed.slice(0,-NOTHING.length)}${hint} ${NOTHING}`;
 return {isError:true,content:[{type:/** @type {const} */('text'),text}]};
}
