/** Composes the enabled browser fragment for the conversation's single SDK query: MCP server, pre-approved
 * non-interaction tools, PreToolUse permission gate, composable canUseTool approval bound to the page origin,
 * PostToolUse receipts and page tracking, download port and verified disposal. Module-internal: callers outside this
 * directory use `createBrowserCapability` (index.mjs), which validates the binding/workspace/policy and applies the
 * activation gate first. Tests exercise the open path here because the shipped gate is held. */
import {BROWSER_SERVER_NAME,playwrightServerConfig,validateBrowserInstallation} from './server.mjs';
import {createReceiptHook} from './receipts.mjs';
import {createDownloadPort,validateSourceScopes} from './downloads.mjs';
import {createPermissionGate} from './permissions.mjs';
import {browserPaths,disposeBrowserState} from './workspace.mjs';
import {createPageContext,createPageContextHooks} from './page-context.mjs';
import {BROWSER_TOOLS,browserStatus} from './policy.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
/** Core tools Playwright MCP 0.0.83 exposes without `--caps` that Meri never admits (README "Core automation"). */
export const EXPOSED_UNADMITTED_TOOLS=Object.freeze(['browser_console_messages','browser_drag','browser_drop','browser_emulate_media','browser_evaluate','browser_file_upload','browser_find','browser_network_request','browser_network_requests','browser_resize','browser_run_code_unsafe']);
const fail=()=>{throw Object.assign(new Error('BROWSER_CONFIGURATION'),{code:'BROWSER_CONFIGURATION'});};
/** `binding`, `cwd` and `policy` must already be validated (an enabled `validateBrowserPolicy` result). Installation
 * and source scopes are trusted runtime facts; receipts are always required, artifacts only when downloads are on,
 * approvals only for interaction tools (without it every interaction is denied). `approvalDeadlineMs` is an optional
 * trusted runtime setting inside APPROVAL_DEADLINE_MS (default 120 s). */
export function buildOpenBrowserFragment({binding,cwd,policy,installation:rawInstallation,sourceScopes:rawScopes,artifacts,receipts,approvals,approvalDeadlineMs,now}){
 const installation=validateBrowserInstallation(rawInstallation,binding);
 if(policy?.enabled!==true||typeof receipts?.record!=='function'||policy.downloads.enabled&&typeof artifacts?.ingest!=='function')fail();
 const sourceScopes=policy.downloads.enabled?validateSourceScopes(rawScopes,binding):Object.freeze([]),paths=browserPaths(cwd);
 const name=t=>`mcp__${BROWSER_SERVER_NAME}__${t}`,policySha256=canonicalSha256(policy),pages=createPageContext();
 const gate=createPermissionGate({binding,policy,policySha256,server:BROWSER_SERVER_NAME,approvals,pages,now,approvalDeadlineMs});
 const tracking=createPageContextHooks(pages,`mcp__${BROWSER_SERVER_NAME}__`);
 const unadmitted=[...EXPOSED_UNADMITTED_TOOLS,...BROWSER_TOOLS.filter(t=>!policy.tools.includes(t))];
 const matcher=`mcp__${BROWSER_SERVER_NAME}__.*`;
 return Object.freeze({enabled:true,activation:'open',policy,policySha256,paths,status:Object.freeze({...browserStatus(policy),activation:'open'}),
  mcpServers:Object.freeze({[BROWSER_SERVER_NAME]:playwrightServerConfig(policy,installation,paths)}),
  allowedTools:Object.freeze(gate.preApproved.map(name)),
  disallowedTools:Object.freeze(unadmitted.map(name)),
  canUseTool:gate.canUseTool,
  hooks:Object.freeze({
   PreToolUse:Object.freeze([Object.freeze({matcher,hooks:Object.freeze([gate.preToolUse])})]),
   PostToolUse:Object.freeze([Object.freeze({matcher,hooks:Object.freeze([createReceiptHook({binding,paths,cwd,server:BROWSER_SERVER_NAME,tools:policy.tools,receipts,now}),tracking.post])})]),
   PostToolUseFailure:Object.freeze([Object.freeze({matcher,hooks:Object.freeze([tracking.failure])})])}),
  downloads:createDownloadPort({binding,policy,policySha256,sourceScopes,paths,artifacts,receipts,now}),
  dispose:options=>disposeBrowserState(paths,options)});
}
