/** Composable browser fragment for the conversation's single SDK query: MCP server, tool allowlist, receipt hook and download port. Default disabled. */
import {isAbsolute} from 'node:path';
import {validateShape} from '../../../../packages/contracts/validate.mjs';
import {validateBrowserPolicy,DEFAULT_BROWSER_POLICY} from './policy.mjs';
import {BROWSER_SERVER_NAME,browserPaths,playwrightServerConfig} from './server.mjs';
import {createReceiptHook} from './receipts.mjs';
import {createDownloadPort,disabledDownloads} from './downloads.mjs';
const fail=()=>{throw Object.assign(new Error('BROWSER_CONFIGURATION'),{code:'BROWSER_CONFIGURATION'});};
const DISABLED=Object.freeze({enabled:false,mcpServers:Object.freeze({}),allowedTools:Object.freeze([]),hooks:Object.freeze({}),downloads:disabledDownloads});
export function createBrowserCapability({binding,cwd,policy=DEFAULT_BROWSER_POLICY,artifacts,receipts,now}){
 try{validateShape('RunBinding',binding);}catch{fail();}
 if(typeof cwd!=='string'||!isAbsolute(cwd)||!cwd.endsWith(`/${binding.conversationId}`)||cwd.includes('/../')||cwd.includes('\0')||typeof now!=='function')fail();
 const p=validateBrowserPolicy(policy,binding);
 if(!p.enabled)return DISABLED;
 if(typeof receipts?.record!=='function'||p.downloads.enabled&&typeof artifacts?.ingest!=='function')fail();
 const paths=browserPaths(cwd),tools=p.tools;
 return Object.freeze({enabled:true,paths,
  mcpServers:Object.freeze({[BROWSER_SERVER_NAME]:playwrightServerConfig(p,paths)}),
  allowedTools:Object.freeze(tools.map(t=>`mcp__${BROWSER_SERVER_NAME}__${t}`)),
  hooks:Object.freeze({PostToolUse:Object.freeze([Object.freeze({matcher:`mcp__${BROWSER_SERVER_NAME}__.*`,hooks:Object.freeze([createReceiptHook({binding,paths,cwd,server:BROWSER_SERVER_NAME,tools,receipts,now})])})])}),
  downloads:createDownloadPort({binding,policy:p,paths,artifacts,receipts,now})});
}
