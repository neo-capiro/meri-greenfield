/** Playwright MCP 0.0.83 stdio server configuration. The SDK invokes only the per-run native shim; the trusted
 * isolated-host supervisor owns the fixed Node/CLI command, environment and pre-exec placement. */
import {posix} from 'node:path';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {PLAYWRIGHT_MCP_VERSION} from './policy.mjs';
import {PLATFORM_BLOCKED_ORIGINS} from './public-web.mjs';
export const BROWSER_SERVER_NAME='meri_browser';
const fail=()=>{throw Object.assign(new Error('BROWSER_CONFIGURATION'),{code:'BROWSER_CONFIGURATION'});};
const path=v=>typeof v==='string'&&posix.isAbsolute(v)&&posix.resolve(v)===v&&!v.includes('\0')&&v.length<=4096;
const HOST_SOCKET=/^\/run\/meri-launch\/([0-9a-f]{64})\.sock$/u;
const NONCE=/^[0-9a-f]{64}$/u;
/** The host egress control listens on loopback in the same isolated unit as the browser. A remote proxy endpoint
 * would escape the run's local grant/revocation owner, even if supplied as a trusted installation mistake. */
const proxyEndpoint=v=>{let u;try{u=new URL(v);}catch{return false;}return u.protocol==='http:'&&['127.0.0.1','[::1]'].includes(u.hostname)&&!!u.port&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash&&v===u.origin;};
/** Trusted run preparation supplies image-pinned paths and a one-shot broker descriptor for this exact RunBinding.
 * A socket pathname or nonce is a rendezvous value, never authority: the native broker authenticates the peer,
 * pins the command and namespace, and consumes the descriptor once. */
export function validateBrowserInstallation(raw,binding){
 let i,launch;try{i=own(raw,['nodePath','cliPath','browsersPath','version','egressProxy','launch']);
  launch=own(i.launch,['shimPath','socketPath','nonce']);validateShape('RunBinding',binding);}catch{fail();}
 const match=typeof launch.socketPath==='string'?HOST_SOCKET.exec(launch.socketPath):null;
 if(![i.nodePath,i.cliPath,i.browsersPath].every(path)||i.version!==PLAYWRIGHT_MCP_VERSION||!proxyEndpoint(i.egressProxy)||
  launch.shimPath!=='/opt/meri/bin/meri-mcp-shim'||!match||launch.socketPath.length>107||
  match[1]!==canonicalSha256(binding)||!NONCE.test(launch.nonce))fail();
 return Object.freeze({...i,launch:Object.freeze(launch)});
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
/** Fixed Playwright command consumed only by the trusted host broker, never copied into SDK MCP configuration. */
export function playwrightHostCommand(policy,installation,paths){
 const {timeouts:t}=policy,i=installation;
 const origins=['--allowed-origins',(policy.allowedOrigins.length?policy.allowedOrigins:[NO_DESTINATION_ORIGIN]).join(';'),'--blocked-origins',PLATFORM_BLOCKED_ORIGINS.join(';')];
 return Object.freeze({command:i.nodePath,
  args:Object.freeze([i.cliPath,'--headless','--browser','chromium','--sandbox','--user-data-dir',paths.profile,'--output-dir',paths.output,
   '--proxy-server',i.egressProxy,...origins,'--block-service-workers','--no-webmcp','--timeout-action',String(t.actionMs),'--timeout-navigation',String(t.navigationMs)]),
  env:Object.freeze({PLAYWRIGHT_BROWSERS_PATH:i.browsersPath,HOME:paths.home})});
}
/** The SDK sees only the one-shot native shim; it cannot select Chromium flags, Node paths or a network namespace. */
export function playwrightServerConfig(policy,installation,paths){
 const {launch}=installation;
 playwrightHostCommand(policy,installation,paths);
 return Object.freeze({type:'stdio',command:launch.shimPath,args:Object.freeze([launch.socketPath,launch.nonce]),
  env:Object.freeze({}),timeout:policy.timeouts.navigationMs+policy.timeouts.actionMs});
}
