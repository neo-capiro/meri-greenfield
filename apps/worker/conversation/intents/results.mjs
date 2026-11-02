// @ts-check
/** Closed result texts for `meri_intents` tools. Memory submission is pending review, never publication; every
 * failure is `isError:true` with one fixed text per closed code and no owner detail. UNKNOWN is never rendered as a
 * failure that may be retried: the preparation may exist, and repeating the request is refused by the replay journal. */
const UNCHANGED='Nothing has been changed.';
/** @type {Readonly<Record<string,(tool:string,reason?:string)=>string>>} */
const TEXTS=Object.freeze({
 UNAVAILABLE:(tool,reason='is not available in this conversation')=>`UNAVAILABLE: ${tool} ${reason}. ${UNCHANGED}`,
 ACCESS_DENIED:tool=>`ACCESS_DENIED: ${tool} is not permitted for this user, client or conversation now. ${UNCHANGED}`,
 REFUSED:tool=>`REFUSED: ${tool} was refused by its owner (arguments, permissions or current state). ${UNCHANGED}`,
 INVALID_ARGUMENTS:(tool,detail)=>`INVALID_ARGUMENTS: ${tool} refused these arguments${detail===undefined?'':` (${detail})`}; correct the named fields and supply literal arguments matching its input schema. ${UNCHANGED}`,
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
/** `reason`: for UNAVAILABLE a closed phrase replacing the default one (e.g. that the run's offer could not be checked); for
 * INVALID_ARGUMENTS the owner's bounded field-path detail (never values) naming what to correct. Ignored for every other code.
 * @param {string} code @param {string} tool @param {string} [reason] */
export function intentFailureResult(code,tool,reason){
 const known=Object.hasOwn(TEXTS,code)?code:'INTERNAL_ERROR';
 const explained=(known==='UNAVAILABLE'||known==='INVALID_ARGUMENTS')&&typeof reason==='string'?reason:undefined;
 // A memory failure after the port was reached stays uncertain; an unchecked offer never reached it, so the plain reason applies.
 if(tool.endsWith('propose_memory')&&!(known==='UNAVAILABLE'&&explained!==undefined))return {isError:true,content:[{type:/** @type {const} */('text'),text:`${known}: the memory proposal result was not released; do not repeat the request. Check the original conversation request. This is not confirmation of submission or active memory.`}]};
 return {isError:true,content:[{type:/** @type {const} */('text'),text:TEXTS[known](tool,explained)}]};
}
/** The prepared result exactly as the owner returned it, then one fixed instruction block.
 * @param {string} json @param {'approval_required'|'draft'|'analysis_pending'|'review_pending'|'read'} status @param {string} [operation] */
export function preparedResult(json,status,operation){
 const notice=operation==='save_memory'&&status==='approval_required'
  ?'PREPARED MEMORY PROPOSAL: review this exact text and destination scope. No memory candidate has been submitted and no memory has been published. Approve this exact proposal in Meri to submit a pending candidate; publication requires a later Core review result.'
  :status==='read'
  ?'READ RESULT: this is current owner data. No proposal or change was created; no approval is needed.'
  :status==='review_pending'
  ?'SUBMITTED FOR REVIEW: a memory candidate is pending governed Core review. It has not been saved or published as memory. Do not ask for a task approval or say the memory was saved.'
  :status==='analysis_pending'
  ?'ANALYSIS OUTPUTS PENDING: the admitted analysis owner returned durable output references. Inspection and publication remain pending; do not say these outputs are published or filed.'
  :status==='draft'
  ?'PREPARED DRAFT: an immutable draft version was created for the user to review. Nothing else has been changed; filing or sharing it is a separate request.'
  :'PREPARED PROPOSAL: nothing has been changed. The user must approve this exact proposal in Meri\'s approval control before anything happens, and current permissions are checked again then. Do not say it is done.';
 return {content:[{type:/** @type {const} */('text'),text:json},{type:/** @type {const} */('text'),text:notice}]};
}
