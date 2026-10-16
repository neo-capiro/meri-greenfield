// @ts-check
/** Closed result texts for `meri_intents` tools. A prepared result always says that nothing has changed yet; every
 * failure is `isError:true` with one fixed text per closed code and no owner detail. UNKNOWN is never rendered as a
 * failure that may be retried: the preparation may exist, and repeating the request is refused by the replay journal. */
const UNCHANGED='Nothing has been changed.';
/** @type {Readonly<Record<string,(tool:string)=>string>>} */
const TEXTS=Object.freeze({
 UNAVAILABLE:tool=>`UNAVAILABLE: ${tool} is not available in this conversation. ${UNCHANGED}`,
 ACCESS_DENIED:tool=>`ACCESS_DENIED: ${tool} is not permitted for this user, client or conversation now. ${UNCHANGED}`,
 REFUSED:tool=>`REFUSED: ${tool} was refused by its owner (arguments, permissions or current state). ${UNCHANGED}`,
 INVALID_ARGUMENTS:tool=>`INVALID_ARGUMENTS: ${tool} refused these arguments; supply literal arguments matching its input schema. ${UNCHANGED}`,
 DEADLINE:tool=>`DEADLINE: ${tool} did not finish preparing within its time limit and nothing was prepared. ${UNCHANGED}`,
 CANCELLED:tool=>`CANCELLED: ${tool} was cancelled before anything was prepared. ${UNCHANGED}`,
 CONFLICT:tool=>`CONFLICT: ${tool} was already requested with different content in this call. ${UNCHANGED}`,
 UNKNOWN:tool=>`UNKNOWN: whether ${tool} prepared a proposal or draft is not known. Do not repeat this request; tell the user to check their pending approvals and drafts. Nothing has been applied.`,
 RESOURCE_LIMIT:tool=>`RESOURCE_LIMIT: ${tool} reached the write-request limit for this run. ${UNCHANGED}`,
 INVALID_RESULT:tool=>`INVALID_RESULT: ${tool} returned a result that was not a prepared proposal or draft, so it was withheld. Nothing has been applied.`,
 INTERNAL_ERROR:tool=>`INTERNAL_ERROR: ${tool} failed. ${UNCHANGED}`,
});
export const INTENT_FAILURE_CODES=Object.freeze(Object.keys(TEXTS));
/** @param {unknown} error @returns {string} */
export function intentFailureCode(error){
 const e=/** @type {{code?:unknown,message?:unknown}|null} */(error!==null&&typeof error==='object'?error:null);
 const code=typeof e?.code==='string'?e.code:e?.message;
 return typeof code==='string'&&Object.hasOwn(TEXTS,code)?code:'INTERNAL_ERROR';
}
/** @param {string} code @param {string} tool */
export function intentFailureResult(code,tool){
 return {isError:true,content:[{type:/** @type {const} */('text'),text:(Object.hasOwn(TEXTS,code)?TEXTS[code]:TEXTS.INTERNAL_ERROR)(tool)}]};
}
/** The prepared result exactly as the owner returned it, then one fixed instruction block.
 * @param {string} json @param {'approval_required'|'draft'} status */
export function preparedResult(json,status){
 const notice=status==='draft'
  ?'PREPARED DRAFT: an immutable draft version was created for the user to review. Nothing else has been changed; filing or sharing it is a separate request.'
  :'PREPARED PROPOSAL: nothing has been changed. The user must approve this exact proposal in Meri\'s approval control before anything happens, and current permissions are checked again then. Do not say it is done.';
 return {content:[{type:/** @type {const} */('text'),text:json},{type:/** @type {const} */('text'),text:notice}]};
}
