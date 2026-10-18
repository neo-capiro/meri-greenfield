/** Playwright MCP 0.0.83 stdio server configuration: explicit Chromium sandbox, per-conversation profile and output
 * under the conversation workspace, no pre-loaded credentials or storage state, and every browser request sent to the
 * dedicated host's egress control (`--proxy-server`). Origin flags are defence in depth only. */
import {isAbsolute} from 'node:path';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {PLAYWRIGHT_MCP_VERSION} from './policy.mjs';
import {PLATFORM_BLOCKED_ORIGINS} from './public-web.mjs';
export const BROWSER_SERVER_NAME='meri_browser';
const fail=()=>{throw Object.assign(new Error('BROWSER_CONFIGURATION'),{code:'BROWSER_CONFIGURATION'});};
const path=v=>typeof v==='string'&&isAbsolute(v)&&!v.includes('/../')&&!v.includes('\0')&&v.length<=4096;
/** The host egress control listens on loopback in the same isolated unit as the browser. A remote proxy endpoint
 * would escape the run's local grant/revocation owner, even if supplied as a trusted installation mistake. */
const proxyEndpoint=v=>{let u;try{u=new URL(v);}catch{return false;}return u.protocol==='http:'&&['127.0.0.1','[::1]'].includes(u.hostname)&&!!u.port&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash&&v===u.origin;};
/** Trusted deployment fact from runtime preparation (never from policy): absolute installation paths, exact version
 * and that host's loopback egress-control proxy endpoint (`egressProxy`). */
export function validateBrowserInstallation(raw){
 let i;try{i=own(raw,['nodePath','cliPath','browsersPath','version','egressProxy']);}catch{fail();}
 if(![i.nodePath,i.cliPath,i.browsersPath].every(path)||i.version!==PLAYWRIGHT_MCP_VERSION||!proxyEndpoint(i.egressProxy))fail();
 return Object.freeze(i);
}
/** Upstream treats an empty or absent `--allowed-origins` as "allow all", so an empty effective allowlist is passed as
 * this single reserved-TLD origin (RFC 6761 `.invalid` never resolves) to keep upstream request routing deny-by-default. */
export const NO_DESTINATION_ORIGIN='https://no-destination.invalid';
/** `--proxy-server` sends every browser request to the host egress control (`egress-control.mjs`). No
 * `--proxy-bypass` is passed, so Playwright 1.64 adds `<-loopback>` to Chromium's bypass list and loopback is proxied
 * too (`shouldProxyLoopback`, playwright-core coreBundle.js, read from the pinned package). The proxy route is not
 * the boundary by itself: the host must also refuse any direct route (ACTIVATION-CHECKLIST.md).
 * `--allowed-origins` mirrors the effective destination allowlist; `--blocked-origins` adds the platform
 * loopback/metadata entries, which upstream evaluates first. Neither list follows redirects or constitutes a security
 * boundary (upstream 0.0.83 README); the binding enforcement is the browser host's egress controls. */
export function playwrightServerConfig(policy,installation,paths){
 const {timeouts:t}=policy,i=installation;
 const origins=['--allowed-origins',(policy.allowedOrigins.length?policy.allowedOrigins:[NO_DESTINATION_ORIGIN]).join(';'),'--blocked-origins',PLATFORM_BLOCKED_ORIGINS.join(';')];
 return Object.freeze({type:'stdio',command:i.nodePath,
  args:Object.freeze([i.cliPath,'--headless','--browser','chromium','--sandbox','--user-data-dir',paths.profile,'--output-dir',paths.output,
   '--proxy-server',i.egressProxy,...origins,'--block-service-workers','--no-webmcp','--timeout-action',String(t.actionMs),'--timeout-navigation',String(t.navigationMs)]),
  env:Object.freeze({PLAYWRIGHT_BROWSERS_PATH:i.browsersPath,HOME:paths.home}),
  timeout:t.navigationMs+t.actionMs});
}
