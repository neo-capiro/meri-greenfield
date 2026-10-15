// @ts-check
/** Shape of the `meri_reads` SDK options fragment and its merge with the selected-skill mount, for `options.mjs`.
 * Own keys only. The two servers may never expose the same operation in one run: a read tool whose operation name
 * `meri_original_reads` already lists is refused. */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {chainPermissions,mergeHookSets} from '../capabilities/fragment.mjs';
import {READ_SERVER_NAME,READ_TOOL_PREFIX} from './tools.mjs';
const SKILL_PREFIX='mcp__meri_original_reads__',NAME=/^mcp__meri_reads__[a-z0-9_]{1,128}$/u,MAX_TOOLS=64;
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
/** PROPOSAL P12 (pending owner approval of the exact text): the default prompt's source sentence is conditional on
 * whether `meri_reads` is mounted. Unmounted, the existing sentence is unchanged and remains true.
 * @param {boolean} mounted */
export function readPromptSentence(mounted){
 return mounted?'Only the read-only institutional source tools listed for this activity are enabled; every other institutional source is unavailable.':'No institutional source tool is enabled for this activity.';
}
