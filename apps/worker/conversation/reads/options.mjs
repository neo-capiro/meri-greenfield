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
 // Routing only: each tool's own description states its arguments, result shape, SQL rules and refusal codes.
 if(has('describe_capiro_data')&&has('query_capiro_data'))guidance.push('Structured questions about Capiro data (counts, totals, rankings, trends and filters over federal bills, cosponsors, members, program elements and budget positions, or over the saved client records of source client_records) go to describe_capiro_data once per conversation and then query_capiro_data; public is the default source and clientId only narrows access. Before querying, settle any ambiguity that changes the answer (client, fiscal versus calendar period, units, budget cycle). A refusal names its correction: fix the SQL and run it again, and never switch to another source to evade a refusal or a timeout. Use a typed reader only when the described relations do not cover the question or original bill text, report passages or consolidated PE funding are needed, and say which path you used. Query results are query-bounded rows, not source completeness; generatedAt is query time, not source freshness.');
 if(has('search_memory'))guidance.push('Saved knowledge: when the user asks what Meri, they or the firm have saved, noted or remembered (including "what do we have on client X"), call search_memory first and attribute each item as saved memory by title, scope and approval date, then use SQL or typed readers for current records and say which came from memory. Saving or correcting memory is a write request that only prepares a proposal for the user\'s approval: never say a memory was saved or remembered.');
 if(['mail_list_messages','mail_search_messages','mail_read_thread'].some(has))guidance.push('Email: what someone emailed, the latest threads with a client, or an email\'s contents come from the mail tools, never from memory or SQL: mail_search_messages (from, participant or query words) or mail_list_messages (recent mail), then mail_read_thread for a thread\'s body before quoting it. Mail is stored mail of the connected mailbox up to its last synchronization, not the live inbox, and an empty page is not proof that no email exists.');
 if(has('read_saved_record'))guidance.push('Use read_saved_record for saved document/version/comment, newsletter, HillDay and LegiWatch records through their current owners. Selected-client mode permits only kinds with an authoritative matching client selector; a General-only kind must be refused in that mode, never silently broadened. Saved records do not trigger fresh research or semantic indexing.');
 if(has('read_saved_strategy_records'))guidance.push('Use read_saved_strategy_records for saved Strategy/planner/history records with the exact client and parent selector. Follow its cursor and disclose bounded coverage; saved history is not a command to regenerate, restore or execute work.');
 return guidance.join(' ');
}
