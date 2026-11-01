/** Model-visible browser refusals: the closed set of codes the session owner may surface to the model, with one fixed,
 * content-free text each. Every other failure collapses to BROWSER_CALL_REFUSED, so page prose, upstream error text,
 * dialog text and host detail never reach the model, while the model can still tell "refused before any page effect"
 * from "the user holds the browser", "the result was withheld because the page changed hands" and "the effect is
 * unknown". A refusal is rendered as an `isError` text result whose head is `CODE: ` so the SDK audit records the
 * failure and the text stays parseable. */
const TEXTS=Object.freeze({
 BROWSER_CALL_REFUSED:'the browser call was refused before it reached the page (tool, arguments, transport or configuration); no page effect happened.',
 BROWSER_CALL_TIMEOUT:'the browser call did not complete within its time limit before any page effect; you may retry it once.',
 BROWSER_SESSION_ENDING:'the browser session is ending or has ended for this run; no further browser calls are possible.',
 BROWSER_SESSION_BUSY:'another browser call is still running; wait for its result before calling again.',
 BROWSER_TOOL_REFUSED:'this tool is not admitted by the browser policy of this run.',
 BROWSER_IMAGES_WITHHELD:'screenshots are not delivered to the model; use browser_snapshot to read the page state.',
 BROWSER_AUTHORITY_REFUSED:'the browser authorization for this run is no longer current (revoked, expired or changed); the browser session is being destroyed and no further browser calls are possible.',
 BROWSER_REVOKED:'browser access was revoked for this conversation; no further browser calls are possible.',
 BROWSER_USER_IN_CONTROL:'the user holds the browser (takeover); agent calls are refused until the user hands it back and the run resumes.',
 BROWSER_STALE_RESULT:'the browser changed hands while this call ran, so its result was withheld; take a fresh browser_snapshot before acting.',
 BROWSER_ACTION_OUTCOME_UNKNOWN:'the action may or may not have taken effect (timeout or transport loss after dispatch); the browser session is being destroyed and this request must not be repeated.',
 BROWSER_RESET_REQUIRED:'the browser could not be drained and is unavailable until it is reset; no further browser calls are possible in this session.',
 BROWSER_SENSITIVE_PAGE:'the current page is a sign-in or identity-provider page; its content is withheld from the model.',
 BROWSER_OUTPUT_UNFILTERABLE:'the page state could not be filtered for the model and was withheld; no page effect happened.',
});
/** Closed set, in a fixed order. */
export const BROWSER_MODEL_REFUSALS=Object.freeze(Object.keys(TEXTS));
/** Internal codes that the session owner reports under a model-visible one. */
const ALIASES=Object.freeze({TAKEOVER_DRAIN_UNKNOWN:'BROWSER_RESET_REQUIRED'});
/** The model-visible code for an error raised at the single execution point, or BROWSER_CALL_REFUSED. A DEADLINE or
 * CANCELLED lifetime expiry is a timeout only when the caller says no page effect was dispatched. */
export function browserRefusalCode(error,{dispatched=false}={}){
 const code=error!==null&&typeof error==='object'&&typeof error.code==='string'?error.code:typeof error?.message==='string'?error.message:'';
 if(Object.hasOwn(ALIASES,code))return ALIASES[code];
 if(code==='DEADLINE'||code==='CANCELLED')return dispatched?'BROWSER_ACTION_OUTCOME_UNKNOWN':'BROWSER_CALL_TIMEOUT';
 return Object.hasOwn(TEXTS,code)?code:'BROWSER_CALL_REFUSED';
}
export const isBrowserRefusalCode=code=>typeof code==='string'&&Object.hasOwn(TEXTS,code);
/** One `isError` text result for the model: `CODE: fixed text`. */
export function browserRefusalResult(code){
 const fixed=Object.hasOwn(TEXTS,code)?code:'BROWSER_CALL_REFUSED';
 return Object.freeze({isError:true,content:Object.freeze([Object.freeze({type:'text',text:`${fixed}: ${TEXTS[fixed]}`})])});
}
/** True when `result` is exactly a refusal rendered here (so transports can pass it through unchanged). */
export function isBrowserRefusalResult(result){
 return result?.isError===true&&Array.isArray(result.content)&&result.content.length===1&&result.content[0]?.type==='text'&&
  typeof result.content[0].text==='string'&&BROWSER_MODEL_REFUSALS.some(code=>result.content[0].text===`${code}: ${TEXTS[code]}`);
}
