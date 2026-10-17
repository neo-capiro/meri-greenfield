// @ts-check
/** Bash only inside the Claude Agent SDK's built-in sandbox on Meri's disposable worker (product decision,
 * 15 Oct 2026). Nothing here is a sandbox: it configures the SDK's own `sandbox` settings and decides admission.
 *
 * Bash is admitted to `tools` only when the effective policy allows it AND the runtime preparation owner attests
 * that the SDK sandbox started on this worker host (`sandbox-readiness/`). Run data never supplies that fact.
 * The settings reach the CLI twice: through `Options.sandbox` (merged by the SDK into the `--settings` flag tier,
 * which honours `strictAllowlist` and holds `allowUnsandboxedCommands:false` against lower tiers), and as
 * restrictive-only locks in `Options.managedSettings` (the parent policy tier). `settingSources: []` loads no
 * user/project/local file, so nothing writable by a sandboxed command can widen them.
 *
 * Network (lane 8, 17 Oct 2026). With an empty `sandboxNetworkDomains` the sandbox has no network at all and sandboxed
 * commands are auto-allowed. With a non-empty list, Bash is admitted only when the runtime preparation owner also
 * supplies (a) the `bashEgress` fact: Meri's own egress proxy (`../egress/bash-egress.mjs`) is listening on loopback for
 * this run with a grant for exactly these domains, so the sandbox's `httpProxyPort`/`socksProxyPort` route every
 * connection through it (the CLI's own proxy matches names only and never checks resolved addresses, so it would let an
 * allowlisted name that resolves to a private or metadata address through); and (b) an approval port, because a
 * networked command can reach an external system: auto-allow is then off and every call is decided before it runs
 * (`bash-approval.mjs`). Missing either, Bash stays out of `tools`. */
import {posix} from 'node:path';
const {isAbsolute,resolve}=posix;
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {isSandboxNetworkDomain,MAX_SANDBOX_NETWORK_DOMAINS} from './policy.mjs';
import {bashEgressDomainsSha256,BASH_EGRESS_SCHEMA} from '../egress/bash-egress.mjs';
import {createBashApprovalGate,isApprovalPort} from './bash-approval.mjs';
export const BASH_TOOL='Bash';
const SDK_VERSION='0.3.295',CLI_VERSION='2.1.295';
/** Every credential the worker CLI process may hold, plus the cloud/database names the launch gate already
 * refuses (defence in depth). `deny` unsets each for sandboxed commands. ANTHROPIC_AUTH_TOKEN is the task-bound
 * proxy capability the worker really holds; ANTHROPIC_BASE_URL is not secret but has no use inside the sandbox. */
export const SANDBOX_DENIED_ENV=Object.freeze(['ANTHROPIC_AUTH_TOKEN','ANTHROPIC_BASE_URL','ANTHROPIC_API_KEY','CLAUDE_CODE_OAUTH_TOKEN','ANTHROPIC_AWS_BEARER_TOKEN',
 'AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','AWS_CONTAINER_CREDENTIALS_RELATIVE_URI','AWS_CONTAINER_CREDENTIALS_FULL_URI','AWS_CONTAINER_AUTHORIZATION_TOKEN','AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE','AWS_WEB_IDENTITY_TOKEN_FILE','AWS_ROLE_ARN','ECS_CONTAINER_METADATA_URI','ECS_CONTAINER_METADATA_URI_V4',
 'DATABASE_URL','PGPASSWORD','TEMPORAL_API_KEY','MERI_NATIVE_ADMIN_TOKEN']);
/** CLI environment additions when Bash is admitted: scrub inherited credentials from every CLI subprocess. */
export const BASH_SANDBOX_ENV=Object.freeze({CLAUDE_CODE_SUBPROCESS_ENV_SCRUB:'1'});
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(Error(code),{code});};
const absolute=(/** @type {unknown} */p)=>typeof p==='string'&&isAbsolute(p)&&!p.includes('\0')&&!p.endsWith('/')&&resolve(p)===p;
/** @typedef {{available:boolean,sdk:string,cli:string,weakerNestedSandbox:boolean,outerIsolationBoundary:boolean,readinessSha256?:string}} BashSandboxAttestation */
/** Trusted runtime fact from the runtime preparation owner. `weakerNestedSandbox` (no fresh /proc inside bubblewrap)
 * is accepted only when the same owner attests that the outer disposable worker is the isolation boundary.
 * @param {unknown} value @returns {BashSandboxAttestation} */
export function assertBashSandboxAttestation(value){
 const a=own(value,['available','sdk','cli','weakerNestedSandbox','outerIsolationBoundary'],['readinessSha256']);
 if(typeof a.available!=='boolean'||a.sdk!==SDK_VERSION||a.cli!==CLI_VERSION||typeof a.weakerNestedSandbox!=='boolean'||typeof a.outerIsolationBoundary!=='boolean'||a.weakerNestedSandbox&&!a.outerIsolationBoundary||a.readinessSha256!==undefined&&!/^[0-9a-f]{64}$/u.test(String(a.readinessSha256)))fail('BASH_SANDBOX_ATTESTATION_REFUSED');
 return Object.freeze(/** @type {BashSandboxAttestation} */({...a}));
}
/** @typedef {{schema:string,httpProxyPort:number,socksProxyPort:number,domainsSha256:string}} BashEgressFact */
const port=(/** @type {unknown} */p)=>Number.isSafeInteger(p)&&/** @type {number} */(p)>=1024&&/** @type {number} */(p)<=65535;
/** Trusted runtime fact from the runtime preparation owner (`startBashEgress`): the run's egress proxy ports and the
 * digest of the exact domain list its grant enforces. A fact for another list is refused, never ignored.
 * @param {unknown} value @param {readonly string[]} domains @returns {BashEgressFact} */
export function assertBashEgressFact(value,domains){
 const e=own(value,['schema','httpProxyPort','socksProxyPort','domainsSha256']);
 if(e.schema!==BASH_EGRESS_SCHEMA||!port(e.httpProxyPort)||!port(e.socksProxyPort)||e.httpProxyPort===e.socksProxyPort||e.domainsSha256!==bashEgressDomainsSha256(domains))fail('BASH_EGRESS_FACT_REFUSED');
 return Object.freeze(/** @type {BashEgressFact} */({...e}));
}
/** Explicit `bash` eligibility in the effective policy AND an available attestation; with network domains also the
 * run's egress fact and an approval port. Nothing else admits Bash.
 * @param {import('./policy.mjs').CapabilityPolicy} policy @param {unknown} attestation @param {{egress?:unknown,approvals?:unknown}} [network] */
export function admitBash(policy,attestation,{egress,approvals}={}){
 if(policy.bash!==true||attestation===undefined)return false;
 if(!assertBashSandboxAttestation(attestation).available)return false;
 if(!policy.sandboxNetworkDomains.length)return true;
 if(egress===undefined||!isApprovalPort(approvals))return false;
 assertBashEgressFact(egress,policy.sandboxNetworkDomains);return true;
}
/** @typedef {{sdkConfigDirectory?:string,sdkSecureStorageDirectory?:string}} ProtectedPaths */
/** The SDK sandbox settings for one task. Also used verbatim by the readiness check, so the host is qualified with
 * the settings the product will run. With domains, `egress` (the run's egress fact) is required: its ports replace
 * the CLI's own proxy and auto-allow is off (every networked call is approved first).
 * @param {{cwd:string,domains:readonly string[],weakerNestedSandbox:boolean,protectedPaths?:ProtectedPaths,egress?:BashEgressFact}} input */
export function buildBashSandboxSettings({cwd,domains,weakerNestedSandbox,protectedPaths={},egress}){
 const {sdkConfigDirectory,sdkSecureStorageDirectory}=protectedPaths;
 if(!absolute(cwd)||[sdkConfigDirectory,sdkSecureStorageDirectory].some(p=>p!==undefined&&!absolute(p)))fail('BASH_SANDBOX_CONFIGURATION');
 const networked=domains.length>0;if(networked!==(egress!==undefined))fail('BASH_SANDBOX_CONFIGURATION');
 const proxy=networked?assertBashEgressFact(egress,domains):undefined;
 const denyRead=sdkSecureStorageDirectory!==undefined&&sdkSecureStorageDirectory!==sdkConfigDirectory?[sdkSecureStorageDirectory]:[];
 return {enabled:true,failIfUnavailable:true,autoAllowBashIfSandboxed:!networked,allowUnsandboxedCommands:false,
  network:{allowedDomains:[...domains],strictAllowlist:true,allowAllUnixSockets:false,allowLocalBinding:false,...(proxy?{httpProxyPort:proxy.httpProxyPort,socksProxyPort:proxy.socksProxyPort}:{})},
  filesystem:{allowWrite:[cwd],denyRead,disabled:false},
  credentials:{envVars:SANDBOX_DENIED_ENV.map(name=>({name,mode:/** @type {const} */('deny')})),files:[{path:`${sdkConfigDirectory??'~/.claude'}/.credentials.json`,mode:/** @type {const} */('deny')}]},
  enableWeakerNestedSandbox:weakerNestedSandbox};
}
/** Restrictive-only locks for the parent policy tier; every value is one the SDK lists as the restrictive direction.
 * @param {boolean} weakerNestedSandbox */
export function buildBashSandboxLocks(weakerNestedSandbox){
 return {enabled:true,failIfUnavailable:true,allowUnsandboxedCommands:false,...(weakerNestedSandbox?{}:{enableWeakerNestedSandbox:false}),
  network:{strictAllowlist:true,allowAllUnixSockets:false,allowLocalBinding:false},filesystem:{disabled:false},
  credentials:{envVars:SANDBOX_DENIED_ENV.map(name=>({name,mode:/** @type {const} */('deny')}))}};
}
const fixed=(/** @type {Record<string,unknown>} */o,/** @type {Record<string,unknown>} */expected)=>{for(const [k,v] of Object.entries(expected))if(o[k]!==v)fail('CAPABILITY_FRAGMENT_REFUSED');};
/** @param {unknown} value */
function deniedEnv(value){
 if(!Array.isArray(value)||value.length!==SANDBOX_DENIED_ENV.length)fail('CAPABILITY_FRAGMENT_REFUSED');
 value.forEach((entry,i)=>{const e=own(entry,['name','mode']);if(e.name!==SANDBOX_DENIED_ENV[i]||e.mode!=='deny')fail('CAPABILITY_FRAGMENT_REFUSED');});
}
/** Closed shape of `Options.sandbox`: every escape hatch (unsandboxed commands, unix sockets, local binding, own proxy
 * ports, excluded commands, ignored violations, disabled filesystem isolation, custom binaries) is absent or locked.
 * @param {unknown} value */
export function assertSandboxSettings(value){
 const s=own(value,['enabled','failIfUnavailable','autoAllowBashIfSandboxed','allowUnsandboxedCommands','network','filesystem','credentials','enableWeakerNestedSandbox']);
 fixed(s,{enabled:true,failIfUnavailable:true,allowUnsandboxedCommands:false});if(typeof s.enableWeakerNestedSandbox!=='boolean')fail('CAPABILITY_FRAGMENT_REFUSED');
 const n=own(s.network,['allowedDomains','strictAllowlist','allowAllUnixSockets','allowLocalBinding'],['httpProxyPort','socksProxyPort']);fixed(n,{strictAllowlist:true,allowAllUnixSockets:false,allowLocalBinding:false});
 if(!Array.isArray(n.allowedDomains)||n.allowedDomains.length>MAX_SANDBOX_NETWORK_DOMAINS||new Set(n.allowedDomains).size!==n.allowedDomains.length||!n.allowedDomains.every(isSandboxNetworkDomain))fail('CAPABILITY_FRAGMENT_REFUSED');
 // Networked Bash always routes through Meri's egress proxy and is never auto-allowed; network-less Bash has neither port.
 const networked=n.allowedDomains.length>0;
 if(s.autoAllowBashIfSandboxed!==!networked||(networked?!port(n.httpProxyPort)||!port(n.socksProxyPort)||n.httpProxyPort===n.socksProxyPort:n.httpProxyPort!==undefined||n.socksProxyPort!==undefined))fail('CAPABILITY_FRAGMENT_REFUSED');
 const f=own(s.filesystem,['allowWrite','denyRead','disabled']);fixed(f,{disabled:false});
 if(!Array.isArray(f.allowWrite)||f.allowWrite.length!==1||!absolute(f.allowWrite[0])||!Array.isArray(f.denyRead)||f.denyRead.length>1||!f.denyRead.every(absolute))fail('CAPABILITY_FRAGMENT_REFUSED');
 const c=own(s.credentials,['envVars','files']);deniedEnv(c.envVars);
 if(!Array.isArray(c.files)||c.files.length!==1)fail('CAPABILITY_FRAGMENT_REFUSED');const file=own(c.files[0],['path','mode']);if(file.mode!=='deny'||typeof file.path!=='string'||!/^~?\/(?:[^\0]*\/)?\.credentials\.json$/u.test(file.path)||file.path.includes('/../'))fail('CAPABILITY_FRAGMENT_REFUSED');
 return value;
}
/** Closed shape of the sandbox part of `Options.managedSettings`. @param {unknown} value */
export function assertSandboxLocks(value){
 const s=own(value,['enabled','failIfUnavailable','allowUnsandboxedCommands','network','filesystem','credentials'],['enableWeakerNestedSandbox']);
 fixed(s,{enabled:true,failIfUnavailable:true,allowUnsandboxedCommands:false});if(s.enableWeakerNestedSandbox!==undefined&&s.enableWeakerNestedSandbox!==false)fail('CAPABILITY_FRAGMENT_REFUSED');
 fixed(own(s.network,['strictAllowlist','allowAllUnixSockets','allowLocalBinding']),{strictAllowlist:true,allowAllUnixSockets:false,allowLocalBinding:false});
 fixed(own(s.filesystem,['disabled']),{disabled:false});deniedEnv(own(s.credentials,['envVars']).envVars);
 return value;
}
/** The Bash piece of the capability fragment, or `undefined` when Bash is not admitted (it then stays out of
 * `tools` and is listed in `disallowedTools` by the composer). Without network, the permission callback denies every
 * Bash call that reaches it: admitted calls are auto-allowed by the SDK only because they run sandboxed. With network,
 * auto-allow is off and the callback is the approval gate (`bash-approval.mjs`).
 * @param {import('./policy.mjs').CapabilityPolicy} policy
 * @param {{cwd:string,attestation:unknown,protectedPaths?:ProtectedPaths,egress?:unknown,approvals?:unknown,binding?:object,now?:()=>number,approvalDeadlineMs?:number}} facts */
export function createBashSandbox(policy,{cwd,attestation,protectedPaths,egress,approvals,binding,now,approvalDeadlineMs}){
 if(!admitBash(policy,attestation,{egress,approvals}))return undefined;
 const {weakerNestedSandbox}=assertBashSandboxAttestation(attestation),domains=policy.sandboxNetworkDomains,networked=domains.length>0;
 const sandbox=buildBashSandboxSettings({cwd,domains,weakerNestedSandbox,...(protectedPaths===undefined?{}:{protectedPaths}),...(networked?{egress:assertBashEgressFact(egress,domains)}:{})});
 if(networked&&(binding===undefined||typeof now!=='function'))fail('BASH_SANDBOX_CONFIGURATION');
 /** @type {import('@anthropic-ai/claude-agent-sdk').CanUseTool} */
 const canUseTool=networked?createBashApprovalGate({binding:/** @type {object} */(binding),approvals:/** @type {any} */(approvals),now:/** @type {()=>number} */(now),sandboxSha256:canonicalSha256(sandbox),domainsSha256:bashEgressDomainsSha256(domains),...(approvalDeadlineMs===undefined?{}:{approvalDeadlineMs})})
  :async()=>({behavior:'deny',message:'Bash runs only inside the SDK sandbox'});
 return Object.freeze({tools:[BASH_TOOL],allowedTools:[],sandbox,
  managedSettings:{sandbox:buildBashSandboxLocks(weakerNestedSandbox)},env:{...BASH_SANDBOX_ENV},canUseTool});
}
