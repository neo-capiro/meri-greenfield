// @ts-check
/** Closed result texts for `meri_reads` tools. Every failure is `isError:true` with one fixed text per gateway code
 * (gateway and native source-publication codes), followed by the read's own fixed next-step guidance where
 * `guidance.mjs` owns one; none carries source detail, and no failure is ever rendered as a successful or empty result.
 * Successful SQL, memory and mail pages get one short orientation notice (counts, continuation, what an empty page
 * means, stale mailbox); the canonical result bytes and their hashes are never touched. */
import {readGuidance} from './guidance.mjs';
import {SQL_TOOL_IDS} from './tools.mjs';
const NOTHING='No evidence, absence or completeness is established.';
/** @type {Readonly<Record<string,(tool:string)=>string>>} */
const TEXTS=Object.freeze({
 UNAVAILABLE:tool=>`UNAVAILABLE: ${tool} is not enabled, installed or served for this request in this conversation (an unsupported operation or a source-side refusal that is neither a denied scope nor an outage). ${NOTHING}`,
 SOURCE_UNAVAILABLE:tool=>`SOURCE_UNAVAILABLE: ${tool} is served, but its source did not answer this call (outage, overload, a refusal by the source or an upstream timeout). This is not an empty result. ${NOTHING}`,
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
/** Refusals whose message is PostgreSQL's own report of the model's statement. SOURCE_UNAVAILABLE and QUERY_TIMEOUT
 * carry a SQLSTATE with a fixed sanitized message, and the gate's own refusals carry no SQLSTATE at all. */
const POSTGRES_REFUSALS=new Set(['INVALID_QUERY','UNKNOWN_RELATION','UNKNOWN_FIELD']);
/** PostgreSQL's own diagnostics on a refusal (message with 1-based character position, hint, SQLSTATE and the nearest
 * published names), one short line for the model; absent on the gate's own refusals and on the pre-362 envelope.
 * @param {{message?:unknown,position?:unknown,hint?:unknown,sqlstate?:unknown,candidates?:unknown}} error @param {unknown} code */
function sqlDiagnostics(error,code){
 const position=Number.isInteger(error.position)?error.position:null,hint=typeof error.hint==='string'?error.hint:null;
 const candidates=Array.isArray(error.candidates)?error.candidates.filter(name=>typeof name==='string'):[];
 const postgres=typeof error.sqlstate==='string'&&typeof code==='string'&&POSTGRES_REFUSALS.has(code);
 if(position===null&&hint===null&&!candidates.length&&!postgres)return null;
 const sentence=text=>/[.!?]$/u.test(text)?text:`${text}.`;
 // Core's translateDatabaseError already replaces permission and missing-schema text with the name the model wrote or none.
 const text=typeof error.message==='string'?error.message:'query failed';
 const parts=[sentence(`PostgreSQL${typeof error.sqlstate==='string'?` ${error.sqlstate}`:''}: ${position===null?text:`${text.replace(/\.$/u,'')} at character ${position}`}`)];
 if(hint!==null)parts.push(sentence(`Hint: ${hint}`));
 if(candidates.length)parts.push(`Did you mean: ${candidates.join(', ')}.`);
 return parts.join(' ');
}
/** The mail handler returns the canonical page itself, not a `{result}` envelope. */
const MAIL_TOOLS=new Set(['mail.list_messages','mail.search_messages','mail.read_thread']);
const RECONNECT='the user can reconnect the mailbox in Capiro\'s mail integration settings';
const notice=(/** @type {string} */text)=>({type:/** @type {const} */('text'),text});
/** Mailbox connection states other than connected among the returned messages. @param {any[]} messages */
const staleStatuses=messages=>[...new Set(messages.map(m=>m?.connectionStatus).filter(s=>typeof s==='string'&&s!=='connected'))];
/** One orientation line for a canonical memory page: how many approved items, what an empty page means, and how to
 * attribute or complete the content. The Core argument error is a closed enum text. @param {any} page */
function memoryNotice(page){
 if(typeof page?.error==='string')return `search_memory refused the arguments: ${page.error} Pass the topic or client as query text; clientId only in a selected-client conversation.`;
 if(page?.tool!=='search_memory'||!Array.isArray(page.results))return null;
 const n=page.results.length,size=Number.isSafeInteger(page.effectivePageSize)?` of a page of ${page.effectivePageSize}`:'';
 const parts=[`${n} approved memory item(s) returned${size}${typeof page.nextCursor==='string'?'; nextCursor continues':''}; contentStatus ${page.contentStatus}.`];
 // An empty page means three different things; only `empty` is an honest "nothing matched".
 if(n===0)parts.push(page.contentStatus==='empty'?'Pending proposals and retired items are never recall, so this is not proof that nothing was saved or proposed: say that no approved memory matched.'
  :page.contentStatus==='unavailable_or_ineligible'?'The requested item could not be read: it is unavailable or no longer eligible for this user. This is not absence; tell the user that saved memory item could not be read.'
  :'Recall did not complete: the memory source was unavailable or incomplete for this search. This is not absence; tell the user saved memory could not be read right now and do not say nothing matched.');
 else parts.push('Attribute each item as saved memory by its title, scope and approvedAt from records[].payload; it records what was approved, not a fact verified now, and nothing here saves or changes memory.');
 if(page.contentStatus==='metadata_only'||page.contentTruncated===true)parts.push('Content is partial: read an item\'s complete text with memoryItemId and the contentCursor from content.nextRead before quoting it.');
 return parts.join(' ');
}
/** One orientation line for a canonical mail page: counts, continuation, preview incompleteness and a stale mailbox.
 * @param {any} page */
function mailNotice(page){
 if(page?.kind==='mail-candidate-source-page'){
  const messages=Array.isArray(page.messages)?page.messages:[],n=messages.length;
  const parts=[`${n} stored message candidate(s)${Number.isInteger(page.totalMatches)?` of ${page.totalMatches} matching`:''}${page.hasMore===true&&Number.isInteger(page.nextOffset)?`; more exist, continue with offset ${page.nextOffset}`:''}.`];
  parts.push(n===0?'An empty page is absence within this subject, folder, window and filter only, not proof that no email exists; widen withinDays or the folder, or search by from or participant.'
   :'Previews are incomplete excerpts: read a thread with mail_read_thread before quoting or summarizing its content.');
  const stale=staleness(page,messages);if(stale!==null)parts.push(stale);
  return parts.join(' ');
 }
 if(page?.kind==='mail-thread-source-page'){
  const messages=Array.isArray(page.messages)?page.messages:[];
  // Only a body that exists but was cut (preview, truncated, or a section with more) can be continued; a missing or unknown body cannot.
  const partial=messages.filter(m=>['preview','truncated'].includes(m?.bodyCompleteness)||m?.bodyCompleteness==='full'&&m?.section?.hasMore===true).length;
  const absent=messages.filter(m=>['missing','unknown'].includes(m?.bodyCompleteness)).length;
  const parts=[`${messages.length} message(s) of ${Number.isInteger(page.totalMessages)?page.totalMessages:'an unknown number'} in this thread${page.hasMoreMessages===true&&Number.isInteger(page.nextMessageOffset)?`; more follow at messageOffset ${page.nextMessageOffset}`:''}.`];
  if(partial)parts.push(`${partial} body section(s) are incomplete: continue with the listed nextBodyOffsets before quoting, and say what was not read.`);
  if(absent)parts.push(`${absent} message body(ies) are not available in stored mail (missing or unknown): report that the body could not be read; nothing continues them.`);
  const stale=staleness(page,messages);if(stale!==null)parts.push(stale);
  return parts.join(' ');
 }
 return null;
}
/** One staleness sentence for a mail page, with the reconnect hint once: the contract's SourceState (freshness,
 * synchronizedAt), which an empty page carries too, and the mailbox connection states of the messages actually returned.
 * @param {any} page @param {any[]} messages */
function staleness(page,messages){
 const source=(Array.isArray(page.sources)?page.sources:[]).find(s=>s?.freshness==='stale'),statuses=staleStatuses(messages);
 if(!source&&!statuses.length)return null;
 const sourceText=source?`The mail source reports its stored mail as stale (last synchronized ${typeof source.synchronizedAt==='string'?source.synchronizedAt:'at an unknown time'})`:null;
 if(sourceText&&statuses.length)return `${sourceText}, and the mailbox connection status is ${statuses.join(', ')}; ${RECONNECT}.`;
 return `${sourceText??`Mailbox connection status ${statuses.join(', ')}: stored mail up to the last synchronization, possibly stale`}; ${RECONNECT}.`;
}
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
 if(MAIL_TOOLS.has(operation.id)){const text=mailNotice(parsed);return text===null?[]:[notice(`Notice: ${text}`)];}
 if(operation.id==='search_memory'){const text=memoryNotice(parsed?.result);return text===null?[]:[notice(`Notice: ${text}`)];}
 if(!SQL_TOOL_IDS.has(operation.id))return [];
 const page=parsed?.result;
 if(page?.ok===false){
  const code=page.error?.code,refusals=readGuidance(operation.id)?.refusals??{},guidance=Object.hasOwn(refusals,code)?` ${refusals[code]}`:'';
  const diagnostics=page.error&&typeof page.error==='object'?sqlDiagnostics(page.error,code):null;
  return [notice(`Notice: ${operation.id} refused this request with ${code}.${guidance}${diagnostics===null?'':` ${diagnostics}`} ${NOTHING}`)];
 }
 if(operation.id==='describe_capiro_data'){
  if(page?.ok!==true||!Array.isArray(page.relations))return [];
  const names=page.relations.map(r=>r?.name).filter(name=>typeof name==='string');
  return [notice(`Notice: ${names.length} ${page.scope?.kind??'public'} relation(s) described: ${names.join(', ')}. Spell relation and column names exactly as listed, filter enum columns by their listed values, join on the listed relationships, and respect each relation's grain and limitations; rowLimit default ${page.limits?.defaultRowLimit}, max ${page.limits?.maxRowLimit}.`)];
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
