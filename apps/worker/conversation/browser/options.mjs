// @ts-check
/** Composition of the browser fragment into the conversation's fully built SDK options (`../options.mjs` calls this
 * last, after the skill, general-read and capability mounts, so nothing merged later can change what it set).
 *
 * - Server ownership: `meri_browser` and every `mcp__meri_browser__*` name belong to the browser fragment alone. Any
 *   other mount that names them in `allowedTools`, `tools`, permission allow rules or `mcpServers` is refused.
 * - Permission routing, not "first allow wins": a browser tool is decided only by the browser gate, every other tool
 *   only by the existing decider chain, so a more permissive decider can never allow a browser call and the browser
 *   gate never decides another server's tools (meri_original_reads, meri_reads, meri_intents, built-ins).
 * - Hooks merge by event: the browser PreToolUse gate and PostToolUse/PostToolUseFailure hooks are appended to the
 *   existing ones; every matching hook still runs and an SDK `deny` or `ask` from the browser gate stands.
 * - `allowedTools` and `disallowedTools` are unions; nothing disallowed by another mount is re-enabled.
 * - `permissionMode` must stay `'default'`.
 * A held or disabled fragment contributes nothing and the options are returned unchanged. */
import {mergeHookSets} from '../capabilities/fragment.mjs';
import {BROWSER_SERVER_NAME} from './server.mjs';
export const BROWSER_TOOL_PREFIX=`mcp__${BROWSER_SERVER_NAME}__`;
const BROWSER_EVENTS=Object.freeze(['PreToolUse','PostToolUse','PostToolUseFailure']);
/** @returns {never} */
const fail=()=>{throw Object.assign(Error('BROWSER_COMPOSITION_REFUSED'),{code:'BROWSER_COMPOSITION_REFUSED'});};
/** @type {import('@anthropic-ai/claude-agent-sdk').PermissionResult} */
const DENY=Object.freeze({behavior:'deny',message:'Tool unavailable'});
/** @param {unknown} name */
const browserName=name=>typeof name==='string'&&(name===BROWSER_SERVER_NAME||name.includes(`mcp__${BROWSER_SERVER_NAME}`));
/** Routes each permission request to the one decider that owns the tool.
 * @param {import('@anthropic-ai/claude-agent-sdk').CanUseTool} browser @param {import('@anthropic-ai/claude-agent-sdk').CanUseTool} others
 * @returns {import('@anthropic-ai/claude-agent-sdk').CanUseTool} */
export function routeBrowserPermissions(browser,others){
 return async(name,input,options)=>typeof name==='string'&&name.startsWith(BROWSER_TOOL_PREFIX)?(await browser(name,input,options))??DENY:others(name,input,options);
}
/** @param {any} fragment */
function assertOpenFragment(fragment){
 const servers=Object.keys(fragment.mcpServers??{});
 if(servers.length!==1||servers[0]!==BROWSER_SERVER_NAME||fragment.mcpServers[BROWSER_SERVER_NAME]?.type!=='stdio'||typeof fragment.canUseTool!=='function')fail();
 for(const key of ['allowedTools','disallowedTools'])if(!Array.isArray(fragment[key])||fragment[key].some((/** @type {unknown} */t)=>typeof t!=='string'||!t.startsWith(BROWSER_TOOL_PREFIX)))fail();
 const events=Object.keys(fragment.hooks??{});
 if(!events.includes('PreToolUse')||events.some(e=>!BROWSER_EVENTS.includes(e)))fail();
 for(const event of events)for(const m of fragment.hooks[event])if(m.matcher!==`${BROWSER_TOOL_PREFIX}.*`||!Array.isArray(m.hooks)||!m.hooks.length||m.hooks.some((/** @type {unknown} */h)=>typeof h!=='function'))fail();
}
/** @param {Record<string,any>} options the fully built conversation options @param {any} fragment `createBrowserCapability` output
 * @returns {Record<string,any>} */
export function composeBrowserOptions(options,fragment){
 if(fragment?.enabled!==true||fragment.activation!=='open'){
  if(fragment?.enabled!==false||Object.keys(fragment.mcpServers??{}).length||fragment.allowedTools?.length||Object.keys(fragment.hooks??{}).length||fragment.canUseTool!==undefined)fail();
  return options;
 }
 assertOpenFragment(fragment);
 if(options.permissionMode!=='default'||typeof options.canUseTool!=='function')fail();
 const foreign=[...Object.keys(options.mcpServers??{}),...(options.allowedTools??[]),...(options.tools??[]),...(options.settings?.permissions?.allow??[])];
 if(foreign.some(browserName))fail();
 return {...options,
  mcpServers:{...(options.mcpServers??{}),...fragment.mcpServers},
  allowedTools:[...(options.allowedTools??[]),...fragment.allowedTools],
  disallowedTools:[...new Set([...(options.disallowedTools??[]),...fragment.disallowedTools])],
  hooks:mergeHookSets([options.hooks??{},fragment.hooks]),
  canUseTool:routeBrowserPermissions(fragment.canUseTool,options.canUseTool),
  permissionMode:'default'};
}
