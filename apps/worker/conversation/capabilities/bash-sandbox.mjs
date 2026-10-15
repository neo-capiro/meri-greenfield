// @ts-check
/** Bash only inside the Claude Agent SDK's built-in sandbox on Meri's disposable worker (product decision,
 * 15 Oct 2026). Nothing here is a sandbox: it configures the SDK's own `sandbox` settings and decides admission.
 *
 * Bash is admitted to `tools` only when the effective policy allows it AND the runtime preparation owner attests
 * that the SDK sandbox started on this worker host (`sandbox-readiness/`). Run data never supplies that fact.
 * The settings reach the CLI twice: through `Options.sandbox` (merged by the SDK into the `--settings` flag tier,
 * which honours `strictAllowlist` and holds `allowUnsandboxedCommands:false` against lower tiers), and as
 * restrictive-only locks in `Options.managedSettings` (the parent policy tier). `settingSources: []` loads no
 * user/project/local file, so nothing writable by a sandboxed command can widen them. */
import {isAbsolute,resolve} from 'node:path';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {isSandboxNetworkDomain,MAX_SANDBOX_NETWORK_DOMAINS} from './policy.mjs';
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
/** Explicit `bash` eligibility in the effective policy AND an available attestation; nothing else admits Bash.
 * @param {import('./policy.mjs').CapabilityPolicy} policy @param {unknown} attestation */
export function admitBash(policy,attestation){
 if(policy.bash!==true||attestation===undefined)return false;
 return assertBashSandboxAttestation(attestation).available;
}
/** @typedef {{sdkConfigDirectory?:string,sdkSecureStorageDirectory?:string}} ProtectedPaths */
/** The SDK sandbox settings for one task. Also used verbatim by the readiness check, so the host is qualified with
 * the settings the product will run. @param {{cwd:string,domains:readonly string[],weakerNestedSandbox:boolean,protectedPaths?:ProtectedPaths}} input */
export function buildBashSandboxSettings({cwd,domains,weakerNestedSandbox,protectedPaths={}}){
 const {sdkConfigDirectory,sdkSecureStorageDirectory}=protectedPaths;
 if(!absolute(cwd)||[sdkConfigDirectory,sdkSecureStorageDirectory].some(p=>p!==undefined&&!absolute(p)))fail('BASH_SANDBOX_CONFIGURATION');
 const denyRead=sdkSecureStorageDirectory!==undefined&&sdkSecureStorageDirectory!==sdkConfigDirectory?[sdkSecureStorageDirectory]:[];
 return {enabled:true,failIfUnavailable:true,autoAllowBashIfSandboxed:true,allowUnsandboxedCommands:false,
  network:{allowedDomains:[...domains],strictAllowlist:true,allowAllUnixSockets:false,allowLocalBinding:false},
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
 fixed(s,{enabled:true,failIfUnavailable:true,autoAllowBashIfSandboxed:true,allowUnsandboxedCommands:false});if(typeof s.enableWeakerNestedSandbox!=='boolean')fail('CAPABILITY_FRAGMENT_REFUSED');
 const n=own(s.network,['allowedDomains','strictAllowlist','allowAllUnixSockets','allowLocalBinding']);fixed(n,{strictAllowlist:true,allowAllUnixSockets:false,allowLocalBinding:false});
 if(!Array.isArray(n.allowedDomains)||n.allowedDomains.length>MAX_SANDBOX_NETWORK_DOMAINS||new Set(n.allowedDomains).size!==n.allowedDomains.length||!n.allowedDomains.every(isSandboxNetworkDomain))fail('CAPABILITY_FRAGMENT_REFUSED');
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
 * `tools` and is listed in `disallowedTools` by the composer). The permission callback denies every Bash call that
 * reaches it: admitted calls are auto-allowed by the SDK only because they run sandboxed.
 * @param {import('./policy.mjs').CapabilityPolicy} policy @param {{cwd:string,attestation:unknown,protectedPaths?:ProtectedPaths}} facts */
export function createBashSandbox(policy,{cwd,attestation,protectedPaths}){
 if(!admitBash(policy,attestation))return undefined;
 const {weakerNestedSandbox}=assertBashSandboxAttestation(attestation);
 return Object.freeze({tools:[BASH_TOOL],allowedTools:[],
  sandbox:buildBashSandboxSettings({cwd,domains:policy.sandboxNetworkDomains,weakerNestedSandbox,...(protectedPaths===undefined?{}:{protectedPaths})}),
  managedSettings:{sandbox:buildBashSandboxLocks(weakerNestedSandbox)},env:{...BASH_SANDBOX_ENV},
  /** @type {import('@anthropic-ai/claude-agent-sdk').CanUseTool} */
  canUseTool:async()=>({behavior:'deny',message:'Bash runs only inside the SDK sandbox'})});
}
