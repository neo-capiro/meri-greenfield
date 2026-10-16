// @ts-check
/** Validated, default-off SDK capability policy. The policy is trusted run data read by the activity;
 * it names which supported SDK features this run may use and never carries paths, credentials or authority.
 * The effective policy is computed by `policy-resolution.mjs` (platform ∧ tenant ∧ role) before it reaches a run. */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {READ_FAMILY_IDS} from '../reads/families.mjs';
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(Error(code),{code});};
export const SUBAGENT_TYPES=Object.freeze(['research','analysis','artifact_production','verification']);
/** Built-in file tools. Bash is not among them: it needs its own explicit `bash` flag (and, at run time, the SDK
 * sandbox attestation), so enabling `workspaceTools` never makes Bash eligible. */
export const WORKSPACE_TOOLS=Object.freeze(['Read','Write','Edit','Glob','Grep']);
export const MAX_PARALLEL_SUBAGENTS=4;
export const MAX_SANDBOX_NETWORK_DOMAINS=32;
// PROPOSAL P8 (local fields pending dot): `generalReads` (default false) admits the general `meri_reads` server and
// `readFamilies` is its allowlist over the read families it can construct (`reads/families.mjs`).
// PROPOSAL P-INT-3 (local field pending dot): `governedIntents` (default false) admits the prepare-only `meri_intents`
// server (`intents/runtime.mjs`). It grants nothing: every preparation and later execution keeps its owner's checks.
export const POLICY_FLAGS=Object.freeze(['subagents','auditHooks','compactionHooks','skillPlugin','workspaceTools','subagentProgress','bash','generalReads','governedIntents']);
export const POLICY_LISTS=Object.freeze(['subagentTypes','workspaceToolNames','skillNames','sandboxNetworkDomains','readFamilies']);
export const POLICY_KEYS=Object.freeze([...POLICY_FLAGS,...POLICY_LISTS,'maxParallelSubagents']);
const SKILL_NAME=/^[a-z0-9][a-z0-9-]{0,63}$/u;
// Lower-case DNS names with an alphabetic TLD, optionally one leading `*.` label. IP literals, ports, schemes,
// `localhost`, `.local` and `.internal` names (cloud metadata) are refused: the allowlist names public hosts only.
const DOMAIN=/^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
/** @param {unknown} v @returns {v is string} */
export const isSandboxNetworkDomain=v=>typeof v==='string'&&v.length<=253&&DOMAIN.test(v)&&!/(?:^|\.)(?:localhost|internal|local)$/u.test(v);
/** @param {unknown} value @param {(v:unknown)=>boolean} member @param {number} max @returns {readonly string[]} */
function allowlist(value,member,max){
 if(!Array.isArray(value)||value.length>max||new Set(value).size!==value.length||value.some(v=>!member(v)))fail('CAPABILITY_POLICY_REFUSED');
 return Object.freeze([.../** @type {string[]} */(value)]);
}
/** @param {readonly string[]} universe */
const among=universe=>(/** @type {unknown} */v)=>typeof v==='string'&&universe.includes(v);
/** @typedef {{subagents:boolean,auditHooks:boolean,compactionHooks:boolean,skillPlugin:boolean,workspaceTools:boolean,subagentProgress:boolean,bash:boolean,generalReads:boolean,governedIntents:boolean,subagentTypes:readonly string[],maxParallelSubagents:number,workspaceToolNames:readonly string[],skillNames:readonly string[]|null,sandboxNetworkDomains:readonly string[],readFamilies:readonly string[]}} CapabilityPolicy */
/** Every flag defaults to false (`bash` is explicit eligibility for sandboxed Bash; `sandboxNetworkDomains` is the
 * sandboxed commands' network allowlist); every capability allowlist defaults to the bounded catalog (`skillNames: null` =
 * every original) and `sandboxNetworkDomains` defaults to none. An allowlist may be empty only while the flag it
 * scopes is off, so an empty platform/tenant/role intersection is representable without enabling anything.
 * Idempotent: a validated policy validates to itself. @param {unknown} value @returns {CapabilityPolicy} */
export function assertCapabilityPolicy(value){
 const p=own(value,[],[...POLICY_KEYS]);
 for(const flag of POLICY_FLAGS)if(p[flag]!==undefined&&typeof p[flag]!=='boolean')fail('CAPABILITY_POLICY_REFUSED');
 const parallel=p.maxParallelSubagents??2;if(!Number.isSafeInteger(parallel)||parallel<1||parallel>MAX_PARALLEL_SUBAGENTS)fail('CAPABILITY_POLICY_REFUSED');
 /** @type {CapabilityPolicy} */
 const policy={subagents:p.subagents===true,auditHooks:p.auditHooks===true,compactionHooks:p.compactionHooks===true,skillPlugin:p.skillPlugin===true,workspaceTools:p.workspaceTools===true,subagentProgress:p.subagentProgress===true,bash:p.bash===true,generalReads:p.generalReads===true,governedIntents:p.governedIntents===true,
  subagentTypes:p.subagentTypes===undefined?SUBAGENT_TYPES:allowlist(p.subagentTypes,among(SUBAGENT_TYPES),SUBAGENT_TYPES.length),maxParallelSubagents:parallel,
  workspaceToolNames:p.workspaceToolNames===undefined?WORKSPACE_TOOLS:allowlist(p.workspaceToolNames,among(WORKSPACE_TOOLS),WORKSPACE_TOOLS.length),
  skillNames:p.skillNames===undefined||p.skillNames===null?null:allowlist(p.skillNames,v=>typeof v==='string'&&SKILL_NAME.test(v),32),
  sandboxNetworkDomains:p.sandboxNetworkDomains===undefined?Object.freeze([]):allowlist(p.sandboxNetworkDomains,isSandboxNetworkDomain,MAX_SANDBOX_NETWORK_DOMAINS),
  readFamilies:p.readFamilies===undefined?READ_FAMILY_IDS:allowlist(p.readFamilies,among(READ_FAMILY_IDS),READ_FAMILY_IDS.length)};
 if(policy.subagentProgress&&!policy.subagents)fail('CAPABILITY_POLICY_REFUSED');
 if(policy.subagents&&!policy.subagentTypes.length||policy.workspaceTools&&!policy.workspaceToolNames.length||policy.skillPlugin&&policy.skillNames?.length===0||policy.generalReads&&!policy.readFamilies.length)fail('CAPABILITY_POLICY_REFUSED');
 return Object.freeze(policy);
}
/** Conservative reader: the saved execution record may carry `capabilities`; anything else means no capability.
 * The `Run` contract is closed, so the control owner supplies the policy beside `run`, never inside it.
 * @param {unknown} saved @returns {CapabilityPolicy|undefined} */
export function readCapabilityPolicy(saved){
 if(!saved||typeof saved!=='object'||!Object.hasOwn(saved,'capabilities'))return undefined;
 const value=/** @type {{capabilities:unknown}} */(saved).capabilities;
 return value===undefined?undefined:assertCapabilityPolicy(value);
}
