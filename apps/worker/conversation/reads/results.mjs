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
/** Fixed correction guidance per Core SQL refusal code (the closed `CapiroDataError` set). The refusal itself, with Core's
 * message, stays in the canonical result bytes; the notice tells the model what to change so it self-corrects in the same run. */
export const SQL_REFUSAL_GUIDANCE=Object.freeze({
 INVALID_QUERY:'rowLimit must be an integer 1-1000 and sql 1-16384 UTF-8 bytes; correct the request and run it again.',
 UNSUPPORTED_SQL:'Rewrite within the accepted grammar: one SELECT (optional non-recursive CTEs) naming every column with lowercase unquoted identifiers; INNER JOIN or LEFT JOIN ... ON key equality only, other filters in WHERE; predicates from =, <>, <, <=, >, >=, AND, OR, ILIKE, IS NULL, IS NOT NULL; COUNT/SUM/AVG/MIN/MAX(...) AS name; GROUP BY base columns; ORDER BY ASC/DESC; LIMIT 0-1000 only on the final SELECT; every text, date, UUID and decimal value bound as $n. No string literals, SELECT *, IN, BETWEEN, NOT, LIKE, CASE, COALESCE, casts, arithmetic, functions, window or FILTER clauses, subqueries, OFFSET, UNION or NULLS LAST.',
 UNKNOWN_RELATION:'Use a relation name exactly as describe_capiro_data lists it (lowercase, unqualified); client projections need source client_records on both calls.',
 UNKNOWN_FIELD:'Use column names exactly as describe_capiro_data lists them, qualified by the relation alias when two relations share a name; GROUP BY and WHERE take base columns, ORDER BY may use output names. Re-read the relation with describe_capiro_data relations:[...] when unsure.',
 PARAMETER_MISMATCH:'parameters must bind $1..$n contiguously with every entry referenced; use strings for exact decimals, large integers, dates and UUIDs and numbers only for safe integers.',
 SOURCE_UNAVAILABLE:'The data source is unavailable now; this is not an empty result and must not trigger broader or unscoped retrieval.',
 QUERY_TIMEOUT:'The query exceeded its time budget; add selective WHERE filters, join fewer relations, aggregate instead of listing or lower LIMIT, then run it again.',
 OUTPUT_LIMIT:'The result exceeded the 256 KiB output budget; select fewer columns, aggregate, or lower rowLimit and page by keyset.',
});
const SQL_TOOLS=new Set(['describe_capiro_data','query_capiro_data']);
const notice=(/** @type {string} */text)=>({type:/** @type {const} */('text'),text});
/** Separate model guidance; canonical source bytes and their hashes remain untouched.
 * @param {{id:string}} operation @param {string} result the canonical result text @param {any} parsed its parsed envelope */
export function readNotices(operation,result,parsed){
 if(operation.id==='find_contacts')return result.includes('update_client_profile')?
  [notice('Notice: update_client_profile is not available in Meri. Do not propose or claim a client profile change. You may offer a governed task proposal instead.')]:[];
 if(!SQL_TOOLS.has(operation.id))return [];
 const page=parsed?.result;
 if(page?.ok===false){
  const code=page.error?.code,guidance=Object.hasOwn(SQL_REFUSAL_GUIDANCE,code)?` ${SQL_REFUSAL_GUIDANCE[/** @type {keyof typeof SQL_REFUSAL_GUIDANCE} */(code)]}`:'';
  return [notice(`Notice: ${operation.id} refused this request with ${code}.${guidance} ${NOTHING}`)];
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
