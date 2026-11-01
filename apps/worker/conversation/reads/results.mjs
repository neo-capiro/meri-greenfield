// @ts-check
/** Closed result texts for `meri_reads` tools. Every failure is `isError:true` with one fixed text per gateway code
 * (gateway and native source-publication codes); none carries source detail, and no failure is ever
 * rendered as a successful or empty result. */
const NOTHING='No evidence, absence or completeness is established.';
/** Fixed per-tool guidance appended to an argument refusal, so the model corrects the call instead of guessing. */
const ARGUMENT_HINTS=Object.freeze({
 mcp__meri_reads__meeting_read_client_meetings:'For a continued meeting list, restart without the cursor; if the continuation limit was reached, narrow the from/to time range and restart. ',
 mcp__meri_reads__describe_capiro_data:'describe_capiro_data takes optional relations (1-15 unique lowercase relation names), source ("public" or "client_records") and clientId (UUID, client_records only). ',
 mcp__meri_reads__query_capiro_data:'query_capiro_data takes sql (1-16384 bytes) and parameters (required; [] when nothing is bound; at most 64 strings, finite safe-integer numbers, booleans or nulls), plus optional rowLimit (integer 1-1000), source ("public" or "client_records") and clientId (UUID, client_records only). ',
});
/** @type {Readonly<Record<string,(tool:string)=>string>>} */
const TEXTS=Object.freeze({
 UNAVAILABLE:tool=>`UNAVAILABLE: ${tool} is not available in this conversation. ${NOTHING}`,
 ACCESS_DENIED:tool=>`ACCESS_DENIED: ${tool} is not permitted for this user, client or conversation now. ${NOTHING}`,
 DEADLINE:tool=>`DEADLINE: ${tool} did not finish within its time limit. ${NOTHING}`,
 CANCELLED:tool=>`CANCELLED: ${tool} was cancelled before it finished. ${NOTHING}`,
 INVALID_ARGUMENTS:tool=>`INVALID_ARGUMENTS: ${tool} refused these arguments; supply literal arguments matching its input schema. ${Object.hasOwn(ARGUMENT_HINTS,tool)?ARGUMENT_HINTS[/** @type {keyof typeof ARGUMENT_HINTS} */(tool)]:''}${NOTHING}`,
 BUDGET_UNCERTAIN:tool=>`BUDGET_UNCERTAIN: ${tool} could not be accounted for in this run; do not repeat this call. ${NOTHING}`,
 SOURCE_PUBLICATION_UNKNOWN:tool=>`SOURCE_PUBLICATION_UNKNOWN: ${tool} finished its read but saving the source could not be confirmed; do not repeat this call. ${NOTHING}`,
 SOURCE_PUBLICATION_CONFLICT:tool=>`SOURCE_PUBLICATION_CONFLICT: ${tool} reused a saved delivery identity with a different result; do not repeat this call. ${NOTHING}`,
 INVALID_RESULT:tool=>`INVALID_RESULT: ${tool} returned a result that failed validation and was withheld. ${NOTHING}`,
 RESOURCE_LIMIT:tool=>`RESOURCE_LIMIT: ${tool} reached a call, size or read limit for this run. ${NOTHING}`,
 GATEWAY_CONFIGURATION:tool=>`GATEWAY_CONFIGURATION: ${tool} is not configured for this conversation. ${NOTHING}`,
 INTERNAL_ERROR:tool=>`INTERNAL_ERROR: ${tool} failed. ${NOTHING}`,
});
export const READ_FAILURE_CODES=Object.freeze(Object.keys(TEXTS));
/** Fixed correction guidance per Core SQL refusal code (the closed `CapiroDataError` set). The refusal itself, with Core's
 * message, stays in the canonical result bytes; the notice tells the model what to change so it self-corrects in the same run.
 * The statement gate (capiro-backend#362) runs the model's SQL verbatim: INVALID_QUERY, UNKNOWN_RELATION and UNKNOWN_FIELD
 * are mostly PostgreSQL's own errors, rendered with their diagnostics by `sqlDiagnostics`; UNSUPPORTED_SQL and
 * PARAMETER_MISMATCH are the gate's own rules. */
export const SQL_REFUSAL_GUIDANCE=Object.freeze({
 INVALID_QUERY:'rowLimit must be an integer 1-1000 and sql 1-16384 UTF-8 bytes; a PostgreSQL syntax or type error names the character position to fix. Correct the SQL or the request and run it again.',
 UNSUPPORTED_SQL:'Send exactly one read-only SELECT or WITH ... SELECT: no second statement, SET, SHOW, COPY, LISTEN, EXPLAIN or transaction control, no INSERT, UPDATE, DELETE, MERGE (also inside a CTE) or SELECT INTO, and none of set_config, pg_sleep*, pg_terminate_backend, pg_cancel_backend, advisory locks, pg_notify, lo_*, pg_read_file, pg_ls_dir or dblink. Rewrite the statement and run it again.',
 UNKNOWN_RELATION:'Use a relation name exactly as describe_capiro_data lists it (lowercase, unqualified); one query reads one source, so client projections need source client_records on both calls and never mix with public relations.',
 UNKNOWN_FIELD:'Use column names exactly as describe_capiro_data lists them, qualified by the relation alias when two relations share a name. Re-read the relation with describe_capiro_data relations:[...] when unsure.',
 PARAMETER_MISMATCH:'parameters must bind $1..$n contiguously with every entry referenced; use strings for exact decimals, large integers, dates and UUIDs and numbers only for safe integers.',
 SOURCE_UNAVAILABLE:'The data source is unavailable now; this is not an empty result and must not trigger broader or unscoped retrieval.',
 QUERY_TIMEOUT:'The query exceeded its time budget; add selective WHERE filters, join fewer relations, aggregate instead of listing or lower LIMIT, then run it again.',
 OUTPUT_LIMIT:'The result exceeded the 256 KiB output budget; select fewer columns, aggregate, or lower rowLimit and page by keyset.',
});
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
  const code=page.error?.code,guidance=Object.hasOwn(SQL_REFUSAL_GUIDANCE,code)?` ${SQL_REFUSAL_GUIDANCE[/** @type {keyof typeof SQL_REFUSAL_GUIDANCE} */(code)]}`:'';
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
 const text=(Object.hasOwn(TEXTS,code)?TEXTS[code]:TEXTS.INTERNAL_ERROR)(tool);
 return {isError:true,content:[{type:/** @type {const} */('text'),text}]};
}
