// @ts-check
/** Closed result texts for `meri_reads` tools. Every failure is `isError:true` with one fixed text per gateway code
 * (gateway and native source-publication codes), followed by the read's own fixed next-step guidance where
 * `guidance.mjs` owns one; none carries source detail, and no failure is ever rendered as a successful or empty result.
 * The texts are written for the model to relay: no code word, no SDK tool name and no source identifier, because the
 * model repeats what it reads to the user (the 1 November "UNAVAILABLE" and tool-name leaks). The model already knows
 * which call failed from the tool-use id; the closed code is `failureCode(error)`, never parsed back out of the text.
 * Successful SQL, memory and mail pages get one short orientation notice (counts, continuation, what an empty page
 * means, stale mailbox); the canonical result bytes and their hashes are never touched, and mail candidate pages and
 * query results reach the model as a compact view of them (`modelResultText`). */
import {readGuidance,MAIL_COVERAGE_REASONS,MAIL_COVERAGE_UNKNOWN} from './guidance.mjs';
import {SQL_TOOL_IDS} from './tools.mjs';
const NOTHING='No evidence, absence or completeness is established.';
/** Closes every SQL refusal notice: the 2 November acceptance saw a refusal's statement and names reach the user verbatim. */
const REFUSAL_FOR_MODEL='This notice is for correcting the request, never for the user: show them neither the statement nor this message, codes or data set and column names; if the request cannot be corrected, say in plain words which data could not be queried.';
/** @type {Readonly<Record<string,string>>} */
const TEXTS=Object.freeze({
 UNAVAILABLE:`This source cannot be read in this conversation right now: it is not connected, not enabled or not served for this request (not a permission refusal and not an empty result). This may be temporary. Tell the user plainly that it could not be read right now and suggest trying again in a minute, unless a more specific next step follows. ${NOTHING}`,
 SOURCE_UNAVAILABLE:`This source is served but did not answer this call (an outage, overload, a refusal by the source or an upstream timeout). This is not an empty result: tell the user it is not reachable right now and to try again in a minute. ${NOTHING}`,
 ACCESS_DENIED:`This read is not permitted for this user, client or conversation now (not permitted, not absent data). ${NOTHING}`,
 DEADLINE:`This read did not finish within its time limit. ${NOTHING}`,
 CANCELLED:`This read was cancelled before it finished. ${NOTHING}`,
 INVALID_ARGUMENTS:`These arguments were refused; supply literal arguments matching the input schema. ${NOTHING}`,
 BUDGET_UNCERTAIN:`This read could not be accounted for in this run; do not repeat this call. ${NOTHING}`,
 SOURCE_PUBLICATION_UNKNOWN:`This read finished but saving the source could not be confirmed; do not repeat this call. ${NOTHING}`,
 SOURCE_PUBLICATION_CONFLICT:`This read reused a saved delivery identity with a different result; do not repeat this call. ${NOTHING}`,
 INVALID_RESULT:`This read returned a result that failed validation and was withheld. ${NOTHING}`,
 RESOURCE_LIMIT:`This read reached a call, size or read limit for this run. ${NOTHING}`,
 GATEWAY_CONFIGURATION:`This read is not configured for this conversation. ${NOTHING}`,
 INTERNAL_ERROR:`This read failed. ${NOTHING}`,
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
const RECONNECT='the user can reconnect it or run Sync now (or Retry sync) under Capiro Settings > Integrations';
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
const MAIL_PREVIEW_VIEW_MAX=400,MAIL_TO_VIEW_MAX=3;
/** Messages a period summary reads before it says it covers only the newest ones and offers the rest (two 50-row pages). */
export const MAIL_SUMMARY_MAX=100;
/** @param {any} p a mail participant {name, email} @returns {string|null} */
const person=p=>{const name=typeof p?.name==='string'&&p.name?p.name:null,email=typeof p?.email==='string'&&p.email?p.email:null;return name&&email?`${name} <${email}>`:name??email;};
/** What the model reads of a canonical mail candidate page (list or search): the fields a summary or a follow-up read needs,
 * one compact row per message. The canonical page stays the result of record (receipt hash, output accounting); its per-message
 * provenance (scopes, read handles, citation, mailbox and record ids) made a 50-message page about 82,000 characters, past the
 * SDK's tool-result limit, so the 2 November "summarize yesterday's email" run read the spilled file with Read/Grep until it
 * exhausted its turns. A thread page is returned unchanged. @param {any} page */
export function mailCandidateView(page){
 const messages=Array.isArray(page.messages)?page.messages:[];
 return {kind:page.kind,window:{fromInclusive:page.queryScope?.effectiveStartInclusive??null,asOf:page.queryScope?.asOfInclusive??null},
  totalMatches:page.totalMatches,hasMore:page.hasMore,nextOffset:page.nextOffset,threads:new Set(messages.map(m=>m?.threadId)).size,
  messages:messages.map(m=>{const preview=typeof m?.preview?.text==='string'?m.preview.text:null,to=Array.isArray(m?.to)?m.to.map(p=>p?.name||p?.email).filter(Boolean):[];
   const more=to.length-MAIL_TO_VIEW_MAX+(m?.toTruncated===true?1:0);
   return {threadId:m?.threadId,messageId:m?.messageId,...(m?.receivedAt?{receivedAt:m.receivedAt}:{}),...(m?.sentAt?{sentAt:m.sentAt}:{}),from:person(m?.from),
    to:more>0?[...to.slice(0,MAIL_TO_VIEW_MAX),'and others']:to,...(Array.isArray(m?.cc)&&m.cc.length?{ccCount:m.cc.length+(m.ccTruncated===true?'+':'')}:{}),subject:m?.subjectText??null,
    preview:preview!==null&&preview.length>MAIL_PREVIEW_VIEW_MAX?`${preview.slice(0,MAIL_PREVIEW_VIEW_MAX)}...`:preview,
    ...(typeof m?.clientId==='string'?{clientId:m.clientId}:{}),...(m?.connectionStatus&&m.connectionStatus!=='connected'?{connectionStatus:m.connectionStatus}:{})};})};
}
/** Rows, characters and characters per text value of one query result the model reads: about 10,000 tokens at most,
 * well inside the SDK's 25,000-token tool-result limit together with the notice. */
export const SQL_VIEW_ROWS_MAX=100,SQL_VIEW_CHARS_MAX=40000,SQL_VIEW_CELL_MAX=300;
/** What the model reads of a successful query_capiro_data result: the column names once, each row as an array in that order,
 * and the columns whose value is the same in every row (for example count(*) OVER () or max(observed_at) OVER ()) once.
 * Up to SQL_VIEW_ROWS_MAX rows are shown; a result still over SQL_VIEW_CHARS_MAX has its long text values, folded ones
 * included, cut to SQL_VIEW_CELL_MAX characters and then shows fewer rows (at least one); shownRows and cutCells say so. The canonical
 * result stays the result of record (receipt hash, output accounting). Its envelope (binding, per-relation limitations
 * repeated from describe) and row objects repeating every column name made the 2 November "which government forecasts
 * have a window in the next two quarters" result spill past the SDK's tool-result limit into a file, which the model then
 * narrated reading with Read and a shell command. @param {any} page */
export function sqlQueryView(page){
 const names=page.columns.map((/** @type {{name:string}} */c)=>c.name);
 const all=page.rows.map((/** @type {Record<string,unknown>} */row)=>names.map((/** @type {string} */name)=>row[name]??null));
 const same=all.length>2?names.flatMap((/** @type {string} */_,/** @type {number} */i)=>all.every((/** @type {unknown[]} */row)=>row[i]===all[0][i])?[i]:[]):[];
 const kept=names.flatMap((/** @type {string} */_,/** @type {number} */i)=>same.includes(i)?[]:[i]);
 const units=page.columns.filter((/** @type {{unit?:unknown}} */c)=>typeof c.unit==='string');
 const folded=Object.fromEntries(same.map(i=>[names[i],all[0][i]]));
 const head=(/** @type {Record<string,unknown>} */sameInEveryRow)=>({generatedAt:page.generatedAt,columns:kept.map(i=>names[i]),
  ...(same.length?{sameInEveryRow}:{}),
  ...(units.length?{units:Object.fromEntries(units.map((/** @type {{name:string,unit:string}} */c)=>[c.name,c.unit]))}:{}),
  rowCount:page.rowCount,rowLimitReached:page.rowLimitReached,byteTruncated:page.byteTruncated});
 /** @type {unknown[][]} */
 let rows=all.slice(0,SQL_VIEW_ROWS_MAX).map((/** @type {unknown[]} */row)=>kept.map(i=>row[i]));
 let top=head(folded),cutCells=0;
 // The size check reserves the two optional counters at their largest spelling.
 const size=(/** @type {object} */h,/** @type {unknown[][]} */r)=>JSON.stringify({...h,rows:r,shownRows:SQL_VIEW_ROWS_MAX,cutCells:all.length*names.length}).length;
 if(size(top,rows)>SQL_VIEW_CHARS_MAX){
  const long=(/** @type {unknown} */v)=>typeof v==='string'&&v.length>SQL_VIEW_CELL_MAX,cut=(/** @type {unknown} */v)=>long(v)?`${String(v).slice(0,SQL_VIEW_CELL_MAX)}...`:v;
  top=head(Object.fromEntries(Object.entries(folded).map(([name,v])=>[name,cut(v)])));
  let used=size(top,[]),shown=0;
  for(const row of rows){used+=JSON.stringify(row.map(cut)).length+1;if(used>SQL_VIEW_CHARS_MAX&&shown>0)break;shown++;}
  rows=rows.slice(0,shown);
  // Only values the model is shown count as cut: the folded ones and those in the rows kept.
  cutCells=[...Object.values(folded),...rows.flat()].filter(long).length;
  rows=rows.map(row=>row.map(cut));
 }
 return {...top,rows,...(rows.length<page.rowCount?{shownRows:rows.length}:{}),...(cutCells?{cutCells}:{})};
}
const sqlSuccess=(/** @type {{id:string}} */operation,/** @type {any} */page)=>operation.id==='query_capiro_data'&&page?.ok===true&&Array.isArray(page.columns)&&Array.isArray(page.rows);
/** The text the model receives for a successful read: the canonical result, except a mail candidate page and a query
 * result, which it reads as `mailCandidateView` and `sqlQueryView`. @param {{id:string}} operation @param {string} result @param {any} parsed */
export const modelResultText=(operation,result,parsed)=>MAIL_TOOLS.has(operation.id)&&parsed?.kind==='mail-candidate-source-page'?JSON.stringify(mailCandidateView(parsed))
 :sqlSuccess(operation,parsed?.result)?JSON.stringify(sqlQueryView(parsed.result)):result;
/** One orientation line for a canonical mail page: counts, continuation, preview incompleteness and a stale mailbox.
 * @param {any} page */
function mailNotice(page){
 if(page?.kind==='mail-candidate-source-page'){
  const messages=Array.isArray(page.messages)?page.messages:[],n=messages.length;
  const threads=new Set(messages.map(m=>m?.threadId)).size;
  const more=page.hasMore===true&&Number.isInteger(page.nextOffset)?page.nextOffset<MAIL_SUMMARY_MAX
   ?`; more exist: continue with the same arguments, offset ${page.nextOffset} and asOf ${page.queryScope?.asOfInclusive} to summarize the whole period (up to ${MAIL_SUMMARY_MAX} messages) or when the question needs them, otherwise tell the user how many more match and offer to show them`
   :`; more exist: stop here, say the answer covers the newest ${page.nextOffset} and how many more match, and offer to show them`:'';
  const parts=[`${n} stored message candidate(s)${n?` in ${threads} thread(s)`:''}${Number.isInteger(page.totalMatches)?` of ${page.totalMatches} matching`:''}${more}${more?', never mentioning offsets or pages':''}.`];
  parts.push(n===0?'An empty page is absence within this subject, folder, window and filter only, not proof that no email exists; widen withinDays or the folder, or search by from or participant.'
   :'Summarize from these senders, subjects, dates and previews and say the summary is based on previews; previews are incomplete excerpts, so read a thread with mail_read_thread only to quote it or when one message\'s full content changes the answer, a few threads at most.');
  parts.push(...coverageReasons(page));const stale=staleness(page,messages);if(stale!==null)parts.push(stale);
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
  parts.push(...coverageReasons(page));const stale=staleness(page,messages);if(stale!==null)parts.push(stale);
  return parts.join(' ');
 }
 return null;
}
/** Core's per-mailbox coverage reasons, carried in coverage.limitations as "Mailbox <address> has incomplete mail coverage:
 * <reason>.", rendered as the closed user sentences; an unknown reason is reported without echoing its code. @param {any} page */
function coverageReasons(page){
 const limitations=Array.isArray(page?.coverage?.limitations)?page.coverage.limitations:[],sentences=new Set();
 for(const limitation of limitations){
  const reason=typeof limitation==='string'?/incomplete mail coverage: ([a-z_]+)\.?$/u.exec(limitation)?.[1]:undefined;
  if(reason!==undefined)sentences.add(Object.hasOwn(MAIL_COVERAGE_REASONS,reason)?MAIL_COVERAGE_REASONS[reason]:MAIL_COVERAGE_UNKNOWN);
 }
 return sentences.size?["Mail coverage: "+[...sentences].join(" ")]:[];
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
  [notice('Notice: update_client_profile is not available in Meri. Do not propose or claim a client profile change. You may offer to prepare a task request for the user\'s approval instead.')]:[];
 const connected=connectedAppNotice(operation,parsed?.result);
 if(connected!==null)return [notice(`Notice: ${connected}`)];
 if(MAIL_TOOLS.has(operation.id)){const text=mailNotice(parsed);return text===null?[]:[notice(`Notice: ${text}`)];}
 if(operation.id==='search_memory'){const text=memoryNotice(parsed?.result);return text===null?[]:[notice(`Notice: ${text}`)];}
 if(!SQL_TOOL_IDS.has(operation.id))return [];
 const page=parsed?.result;
 if(page?.ok===false){
  const code=page.error?.code,refusals=readGuidance(operation.id)?.refusals??{},guidance=Object.hasOwn(refusals,code)?` ${refusals[code]}`:'';
  const diagnostics=page.error&&typeof page.error==='object'?sqlDiagnostics(page.error,code):null;
  return [notice(`Notice: ${operation.id} refused this request with ${code}.${guidance}${diagnostics===null?'':` ${diagnostics}`} ${REFUSAL_FOR_MODEL} ${NOTHING}`)];
 }
 if(operation.id==='describe_capiro_data'){
  if(page?.ok!==true||!Array.isArray(page.relations))return [];
  const names=page.relations.map(r=>r?.name).filter(name=>typeof name==='string');
  // 2 November acceptance: "the data freshness date is not recorded" although government_forecasts.observed_at is the source check time.
  // A public data set's freshness field is that check time; a private one (updated_at, created_at) is when a record changed.
  const fresh=(/** @type {boolean} */pub)=>page.relations.filter(r=>typeof r?.name==='string'&&typeof r?.freshness?.field==='string'&&(r.coverage?.basis==='ingested_public_records')===pub).map(r=>`${r.name}.${r.freshness.field}`);
  const checked=fresh(true),changed=fresh(false);
  return [notice(`Notice: ${names.length} ${page.scope?.kind??'public'} data set(s) described: ${names.join(', ')}. Spell data set and column names exactly as listed, filter enum columns by their listed values, join on the listed relationships, and respect each data set's grain and limitations; rowLimit default ${page.limits?.defaultRowLimit}, max ${page.limits?.maxRowLimit}.${checked.length?` Freshness fields: ${checked.join(', ')}. The latest value of a freshness field is when Capiro last checked or synchronized that source: when the answer depends on how current the data is, or the user asks, select its max (for example max(observed_at) OVER () AS source_checked_at in the listing query, with the edition where the data set has one) and state it as the data's as-of time; never say a data set's freshness is not recorded when it lists a freshness field.`:''}${changed.length?` Record change fields: ${changed.join(', ')}. Each is when a record was last edited or created, not a source check: state its latest value as the latest record change, and these records as current at generatedAt (the query time).`:''} These names are for writing queries, never for the user: when no described data set holds the subject asked about, tell the user in plain words that this data is not available for structured queries yet and offer what is (for example a search by topic).`)];
 }
 if(!sqlSuccess(operation,page))return [];
 const view=sqlQueryView(page);
 const lines=[`Notice: ${page.rowCount} row(s) returned of rowLimit ${page.limits?.rowLimit} from ${(page.relationsUsed??[]).join(', ')}${page.rowCount?`; each row lists its values in the order of columns${view.sameInEveryRow?', and sameInEveryRow gives once the columns whose value is the same in every row':''}`:''}.`];
 if(view.shownRows!==undefined)lines.push(`Only the first ${view.shownRows} row(s) are shown; the rest are kept for the record. For a list answer name about 20 representative rows from these with the total and offer the rest; for counts, totals or trends aggregate in SQL instead of reading rows; continue by keyset after the last row shown when the user wants more.`);
 if(view.cutCells)lines.push(`${view.cutCells} long text value(s) are cut to ${SQL_VIEW_CELL_MAX} characters and end with "...": to quote one whole, select substr(column, 1, 20000) for that row.`);
 if(page.rowLimitReached)lines.push('rowLimitReached: more rows matched; to say how many, count them (count(*) OVER () AS total_matching in the same query), or narrow the filters, aggregate, or page by keyset (ORDER BY the full key, WHERE key > $n).');
 if(page.byteTruncated)lines.push('byteTruncated: whole rows were dropped at the 256 KiB output budget; select fewer columns or lower rowLimit.');
 if(page.rowCount===0)lines.push('Zero rows is not proof of absence: check parameter values, ILIKE wildcards (%) and the data set coverage limitations before concluding.');
 return [notice(lines.join(' '))];
}
/** Closed code of a failure: the gateway's own code (carried as `code` or as the message of a `GatewayDenied`) when it
 * is in the closed set, otherwise INTERNAL_ERROR. @param {unknown} error @returns {string} */
export function failureCode(error){
 const e=/** @type {{code?:unknown,message?:unknown}|null} */(error!==null&&typeof error==='object'?error:null);
 const code=typeof e?.code==='string'?e.code:e?.message;
 return typeof code==='string'&&Object.hasOwn(TEXTS,code)?code:'INTERNAL_ERROR';
}
/** @param {string} code @param {string} tool the SDK tool name, which selects the read's own guidance and never appears in the text */
export function failureResult(code,tool){
 const closed=Object.hasOwn(TEXTS,code)?TEXTS[code]:TEXTS.INTERNAL_ERROR,hint=readGuidance(tool)?.failures[code];
 // The read's fixed guidance sits between the closed text and the evidence sentence, so every failure keeps the same
 // closed head for its code and the same honest tail.
 const text=hint===undefined?closed:`${closed.slice(0,-NOTHING.length)}${hint} ${NOTHING}`;
 return {isError:true,content:[{type:/** @type {const} */('text'),text}]};
}
