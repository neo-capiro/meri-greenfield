// @ts-check
/** Closed result texts for `meri_reads` tools. Every failure is `isError:true` with one fixed text per gateway code
 * (gateway and native source-publication codes), followed by the read's own fixed next-step guidance where
 * `guidance.mjs` owns one; none carries source detail, and no failure is ever rendered as a successful or empty result. */
import {readGuidance} from './guidance.mjs';
const NOTHING='No evidence, absence or completeness is established.';
/** @type {Readonly<Record<string,(tool:string)=>string>>} */
const TEXTS=Object.freeze({
 UNAVAILABLE:tool=>`UNAVAILABLE: ${tool} is not enabled, installed or served for this request in this conversation (an unsupported operation or a source-side refusal that is neither a denied scope nor an outage). ${NOTHING}`,
 SOURCE_UNAVAILABLE:tool=>`SOURCE_UNAVAILABLE: ${tool} is served, but its source did not answer this call (outage, overload or upstream timeout). This is not an empty result. ${NOTHING}`,
 ACCESS_DENIED:tool=>`ACCESS_DENIED: ${tool} is not permitted for this user, client or conversation now (denied scope, not absent data). ${NOTHING}`,
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
/** PostgreSQL's own diagnostics on a refusal (message with 1-based character position, hint, SQLSTATE and the nearest
 * published names), one short line for the model; absent on the gate's own refusals and on the pre-362 envelope.
 * @param {{message?:unknown,position?:unknown,hint?:unknown,sqlstate?:unknown,candidates?:unknown}} error */
function sqlDiagnostics(error){
 const position=Number.isInteger(error.position)?error.position:null,hint=typeof error.hint==='string'?error.hint:null;
 const candidates=Array.isArray(error.candidates)?error.candidates.filter(name=>typeof name==='string'):[];
 if(position===null&&hint===null&&!candidates.length)return null;
 const sentence=text=>/[.!?]$/u.test(text)?text:`${text}.`;
 const parts=[sentence(`PostgreSQL${typeof error.sqlstate==='string'?` ${error.sqlstate}`:''}: ${typeof error.message==='string'?error.message:'query failed'}${position===null?'':` at character ${position}`}`)];
 if(hint!==null)parts.push(sentence(`Hint: ${hint}`));
 if(candidates.length)parts.push(`Did you mean: ${candidates.join(', ')}.`);
 return parts.join(' ');
}
/** The reads whose source answers refusals as an ok:false envelope; their per-code guidance is owned by `guidance.mjs`. */
const SQL_TOOLS=new Set(['describe_capiro_data','query_capiro_data']);
const notice=(/** @type {string} */text)=>({type:/** @type {const} */('text'),text});
/** Precise, secret-free guidance for a connected app the model cannot read now: the user acts in Meri's Connected apps
 * settings; nothing here is retried, invented or widened. @param {{id:string}} operation @param {{status?:unknown}|undefined} page */
function connectedAppNotice(operation,page){
 if(operation.id==='list_connected_app_reads'&&page?.status==='unavailable')return 'No connected app is usable for this user right now. The user can connect or reconnect an app under Connected apps in Meri. Do not invent a connection or retry this call.';
 if(operation.id!=='read_connected_app')return null;
 if(page?.status==='disconnected')return 'This connected app is not connected for this user now (disconnected or still authorizing). Ask the user to connect it under Connected apps in Meri. Do not retry this call.';
 if(page?.status==='permission_required')return 'This connected app needs the user to reconnect it: its authorization expired or was revoked. Ask the user to reconnect it under Connected apps in Meri. Do not retry this call.';
 return null;
}
/** Separate model guidance; canonical source bytes and their hashes remain untouched.
 * @param {{id:string}} operation @param {string} result the canonical result text @param {any} parsed its parsed envelope */
export function readNotices(operation,result,parsed){
 if(operation.id==='find_contacts')return result.includes('update_client_profile')?
  [notice('Notice: update_client_profile is not available in Meri. Do not propose or claim a client profile change. You may offer a governed task proposal instead.')]:[];
 const connected=connectedAppNotice(operation,parsed?.result);
 if(connected!==null)return [notice(`Notice: ${connected}`)];
 if(!SQL_TOOLS.has(operation.id))return [];
 const page=parsed?.result;
 if(page?.ok===false){
  const code=page.error?.code,refusals=readGuidance(operation.id)?.refusals??{},guidance=Object.hasOwn(refusals,code)?` ${refusals[code]}`:'';
  const diagnostics=page.error&&typeof page.error==='object'?sqlDiagnostics(page.error):null;
  return [notice(`Notice: ${operation.id} refused this request with ${code}.${guidance}${diagnostics===null?'':` ${diagnostics}`} ${NOTHING}`)];
 }
 if(operation.id!=='query_capiro_data'||page?.ok!==true)return [];
 const lines=[`Notice: ${page.rowCount} row(s) returned of rowLimit ${page.limits?.rowLimit} from ${(page.relationsUsed??[]).join(', ')}.`];
 if(page.rowLimitReached)lines.push('rowLimitReached: more rows matched; narrow the filters, aggregate, or page by keyset (ORDER BY the full key, WHERE key > $n).');
 if(page.byteTruncated)lines.push('byteTruncated: whole rows were dropped at the 256 KiB output budget; select fewer columns or lower rowLimit.');
 if(page.rowCount===0)lines.push('Zero rows is not proof of absence: check parameter values, ILIKE wildcards (%) and the relation coverage limitations before concluding.');
 return [notice(lines.join(' '))];
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
