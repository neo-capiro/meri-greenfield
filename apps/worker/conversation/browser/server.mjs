/** Playwright MCP 0.0.83 stdio server configuration: explicit Chromium sandbox, per-conversation profile and output
 * under the conversation workspace, no pre-loaded credentials or storage state. Origin flags are defence in depth only. */
import {isAbsolute} from 'node:path';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {PLAYWRIGHT_MCP_VERSION} from './policy.mjs';
import {PLATFORM_BLOCKED_ORIGINS} from './public-web.mjs';
export const BROWSER_SERVER_NAME='meri_browser';
const fail=()=>{throw Object.assign(new Error('BROWSER_CONFIGURATION'),{code:'BROWSER_CONFIGURATION'});};
const path=v=>typeof v==='string'&&isAbsolute(v)&&!v.includes('/../')&&!v.includes('\0')&&v.length<=4096;
/** Trusted deployment fact from runtime preparation (never from policy): absolute installation paths and exact version. */
export function validateBrowserInstallation(raw){
 let i;try{i=own(raw,['nodePath','cliPath','browsersPath','version']);}catch{fail();}
 if(![i.nodePath,i.cliPath,i.browsersPath].every(path)||i.version!==PLAYWRIGHT_MCP_VERSION)fail();
 return Object.freeze(i);
}
/** Upstream treats an empty or absent `--allowed-origins` as "allow all", so an empty effective allowlist is passed as
 * this single reserved-TLD origin (RFC 6761 `.invalid` never resolves) to keep upstream request routing deny-by-default. */
export const NO_DESTINATION_ORIGIN='https://no-destination.invalid';
/** `--allowed-origins` mirrors the effective destination allowlist; `--blocked-origins` adds the platform
 * loopback/metadata entries, which upstream evaluates first. Neither list follows redirects or constitutes a security
 * boundary (upstream 0.0.83 README); the binding enforcement is the browser host's egress controls. */
export function playwrightServerConfig(policy,installation,paths){
 const {timeouts:t}=policy,i=installation;
 const origins=['--allowed-origins',(policy.allowedOrigins.length?policy.allowedOrigins:[NO_DESTINATION_ORIGIN]).join(';'),'--blocked-origins',PLATFORM_BLOCKED_ORIGINS.join(';')];
 return Object.freeze({type:'stdio',command:i.nodePath,
  args:Object.freeze([i.cliPath,'--headless','--browser','chromium','--sandbox','--user-data-dir',paths.profile,'--output-dir',paths.output,
   ...origins,'--block-service-workers','--no-webmcp','--timeout-action',String(t.actionMs),'--timeout-navigation',String(t.navigationMs)]),
  env:Object.freeze({PLAYWRIGHT_BROWSERS_PATH:i.browsersPath,HOME:paths.home}),
  timeout:t.navigationMs+t.actionMs});
}
