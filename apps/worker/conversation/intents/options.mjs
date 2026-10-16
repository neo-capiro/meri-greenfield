// @ts-check
/** Shape of the `meri_intents` SDK options fragment and its merge with the other mounted servers, for `options.mjs`.
 * Own keys only. Intent tools never share a name with another server's tool; permission callbacks are chained (each
 * server allows only its own exact names, everything else stays denied). */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {chainPermissions,mergeHookSets} from '../capabilities/fragment.mjs';
import {INTENT_ROWS,INTENT_SERVER_NAME,INTENT_TOOL_PREFIX,intentToolName} from './catalog.mjs';
const NAMES=new Set(INTENT_ROWS.map(r=>intentToolName(r.tool)));
const fail=()=>{throw Error('RUNTIME_CONFIGURATION');};
/** @typedef {{mcpServers:Record<string,any>,allowedTools:string[],canUseTool:import('@anthropic-ai/claude-agent-sdk').CanUseTool,hooks:Record<string,import('@anthropic-ai/claude-agent-sdk').HookCallbackMatcher[]>}} IntentOptions */
/** @param {unknown} value @returns {IntentOptions} */
export function assertIntentOptions(value){
 const r=own(value,['mcpServers','allowedTools','canUseTool','hooks']);own(r.mcpServers,[INTENT_SERVER_NAME]);const server=r.mcpServers[INTENT_SERVER_NAME];
 if(server?.type!=='sdk'||server.name!==INTENT_SERVER_NAME||typeof server.instance?.close!=='function'||typeof r.canUseTool!=='function'||!Array.isArray(r.allowedTools)||!r.allowedTools.length||
  new Set(r.allowedTools).size!==r.allowedTools.length||r.allowedTools.some(t=>typeof t!=='string'||!NAMES.has(t)))fail();
 own(r.hooks,['PreToolUse']);const pre=r.hooks.PreToolUse;
 if(!Array.isArray(pre)||pre.length!==1||pre[0].matcher!==`${INTENT_TOOL_PREFIX}.*`||!Array.isArray(pre[0].hooks)||pre[0].hooks.length!==1||typeof pre[0].hooks[0]!=='function')fail();
 return /** @type {IntentOptions} */(r);
}
/** @param {Record<string,any>} mounted the options merged so far, or `{}` @param {IntentOptions} intents */
export function mergeIntentOptions(mounted,intents){
 if(Object.hasOwn(mounted.mcpServers??{},INTENT_SERVER_NAME)||intents.allowedTools.some(t=>(mounted.allowedTools??[]).includes(t)))fail();
 return {...mounted,mcpServers:{...(mounted.mcpServers??{}),...intents.mcpServers},allowedTools:[...(mounted.allowedTools??[]),...intents.allowedTools],
  hooks:mergeHookSets([mounted.hooks??{},intents.hooks]),canUseTool:mounted.canUseTool===undefined?intents.canUseTool:chainPermissions([mounted.canUseTool,intents.canUseTool])};
}
/** PROPOSAL P-INT-3 (exact text pending owner review): the prompt sentence added only while `meri_intents` is mounted.
 * Unmounted, the default prompt is unchanged. @param {boolean} mounted */
export function intentPromptSentence(mounted){
 return mounted?' Write requests may only be prepared with the listed write-request tools, as proposals the user approves in Meri or as drafts; never say a change was made before it is approved and applied.':'';
}
