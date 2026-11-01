// @ts-check
/** Shape of the `meri_reads` SDK options fragment and its merge with the selected-skill mount, for `options.mjs`.
 * Own keys only. The two servers may never expose the same operation in one run: a read tool whose operation name
 * `meri_original_reads` already lists is refused. */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {chainPermissions,mergeHookSets} from '../capabilities/fragment.mjs';
import {READ_SERVER_NAME,READ_TOOL_PREFIX} from './tools.mjs';
const SKILL_PREFIX='mcp__meri_original_reads__',NAME=/^mcp__meri_reads__[a-z0-9_]{1,128}$/u,MAX_TOOLS=128;
const fail=()=>{throw Error('RUNTIME_CONFIGURATION');};
/** @typedef {{mcpServers:Record<string,any>,allowedTools:string[],canUseTool:import('@anthropic-ai/claude-agent-sdk').CanUseTool,hooks:Record<string,import('@anthropic-ai/claude-agent-sdk').HookCallbackMatcher[]>}} ReadOptions */
/** @param {unknown} value @returns {ReadOptions} */
export function assertReadOptions(value){
 const r=own(value,['mcpServers','allowedTools','canUseTool','hooks']);own(r.mcpServers,[READ_SERVER_NAME]);const server=r.mcpServers[READ_SERVER_NAME];
 if(server?.type!=='sdk'||server.name!==READ_SERVER_NAME||typeof server.instance?.close!=='function'||typeof r.canUseTool!=='function'||!Array.isArray(r.allowedTools)||!r.allowedTools.length||r.allowedTools.length>MAX_TOOLS||
  new Set(r.allowedTools).size!==r.allowedTools.length||r.allowedTools.some(t=>typeof t!=='string'||!NAME.test(t)))fail();
 own(r.hooks,['PreToolUse']);const pre=r.hooks.PreToolUse;
 if(!Array.isArray(pre)||pre.length!==1||pre[0].matcher!==`${READ_TOOL_PREFIX}.*`||!Array.isArray(pre[0].hooks)||pre[0].hooks.length!==1||typeof pre[0].hooks[0]!=='function')fail();
 return /** @type {ReadOptions} */(r);
}
/** @param {Record<string,any>} mounted the validated selected-skill options, or `{}` @param {ReadOptions} reads */
export function mergeReadOptions(mounted,reads){
 const skillOperations=new Set((mounted.allowedTools??[]).filter((/** @type {string} */t)=>t.startsWith(SKILL_PREFIX)).map((/** @type {string} */t)=>t.slice(SKILL_PREFIX.length)));
 if(reads.allowedTools.some(t=>skillOperations.has(t.slice(READ_TOOL_PREFIX.length))))fail();
 return {...mounted,mcpServers:{...(mounted.mcpServers??{}),...reads.mcpServers},allowedTools:[...(mounted.allowedTools??[]),...reads.allowedTools],
  hooks:mergeHookSets([mounted.hooks??{},reads.hooks]),canUseTool:mounted.canUseTool===undefined?reads.canUseTool:chainPermissions([mounted.canUseTool,reads.canUseTool])};
}
/** Guidance follows the mounted tools; it cannot widen the profile or a selected skill.
 * @param {boolean} mounted @param {readonly string[]} [tools] */
export function readPromptSentence(mounted,tools=[]){
 if(!mounted)return 'No institutional source tool is enabled for this activity.';
 const has=(/** @type {string} */name)=>tools.includes(READ_TOOL_PREFIX+name);
 const guidance=['Only the read-only institutional source tools listed for this activity are enabled; every other institutional source is unavailable.'];
 if(has('describe_capiro_data')&&has('query_capiro_data'))guidance.push('Use text-to-SQL as the primary retrieval path for structured Capiro questions covered by the published relations. describe_capiro_data first supplies the available relations, fields, keys and coverage; then author SELECT SQL for query_capiro_data with bound parameters using its returned contract grammar and limits when present, otherwise the sql argument guidance. Public data is the default. For saved client business records use source client_records, preserving the current conversation scope; clientId only narrows access and never grants it. Join on full declared relationship keys and page by keyset on the complete ordered key. Keep integer and decimal strings exact, preserve nulls, and report rowLimitReached, byteTruncated and authored LIMIT separately. Query coverage is not source-universe completeness. Keep canonical IDs and source locators; derived SQL rows and aggregates are not immutable source passages. Use retained decisive readers for bill text, report excerpts and consolidated PE funding. The legacy global query tools still cover twelve datasets that the SQL relations do not replace.');
 if(has('describe_capiro_data')&&has('query_capiro_data'))guidance.push('Before querying, clarify any ambiguity that changes the answer: client, jurisdiction, measure, fiscal versus calendar period, currency or units. Use declared grains and full join keys; aggregate parent amounts before joining child rows. An INVALID_QUERY, UNSUPPORTED_SQL, UNKNOWN_RELATION, UNKNOWN_FIELD or PARAMETER_MISMATCH refusal names the correction: rewrite the SQL within the stated grammar and run it again. A denied, unavailable, timed-out or invalid SQL query is not an empty result and must not trigger broader or unscoped retrieval; explain the failure without switching sources to evade it. Use another enabled authorized reader only when the described relations do not cover the question or original document/web evidence is needed, and disclose that coverage boundary. Ground totals in the returned rows and exact query parameters; preserve canonical IDs, source locators and truncation. generatedAt is query time, not source freshness; missing sourceAsOf/sourceVersion stays unknown.');
 if(has('read_saved_record'))guidance.push('Use read_saved_record for saved document/version/comment, newsletter, HillDay and LegiWatch records through their current owners. Selected-client mode permits only kinds with an authoritative matching client selector; a General-only kind must be refused in that mode, never silently broadened. Saved records do not trigger fresh research or semantic indexing.');
 if(has('read_saved_strategy_records'))guidance.push('Use read_saved_strategy_records for saved Strategy/planner/history records with the exact client and parent selector. Follow its cursor and disclose bounded coverage; saved history is not a command to regenerate, restore or execute work.');
 return guidance.join(' ');
}
