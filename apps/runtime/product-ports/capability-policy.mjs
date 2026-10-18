/** G2: the run capability-policy producer and the trusted static platform record (decision N3: Capiro, the platform owner, sets the
 * maximum; tenant admins can only narrow it).
 *
 *   effective(run) = platform maximum ∧ tenant settings ∧ role ceiling ∧ tenant role narrowing   (policy-resolution.mjs)
 *
 * The platform record is configuration, never a request value: `configuration.capabilityPlatform` is exactly the resolver's
 * `{maximum, defaults, roleCeilings}` and is validated by `assertPlatformCapabilityLimits` (defaults and every role ceiling inside the
 * maximum). Absent, the record is NO_CAPABILITY_PLATFORM: nothing is enabled for any role, so the producer answers `null` and a run
 * keeps first-chat behaviour.
 *
 * Gate G3 (one SDK-options pin). Every run's SDK options must project to ONE measured template hash, so every preview run must resolve
 * to the same capability profile. The producer is therefore deterministic per configuration:
 *  - Without `readRole`, the role term is the intersection over EVERY platform role ceiling (with each tenant role narrowing), so the
 *    result never widens any member and does not depend on who asks. There is no trusted per-run role at load time today (the run
 *    binding carries no role and Core membership needs the user's bearer), so this is the production form.
 *  - Without `readTenantSettings`, the tenant term is the platform defaults. With both readers absent the profile is computed once at
 *    construction and every `forRun` returns the same frozen object; `profileSha256` is the value the in-image measurement pins.
 *  - Either reader makes the profile vary per tenant or member, so construction then REQUIRES `pinnedProfiles` (the keys of a
 *    profile→pin map) and any other resolved profile refuses CAPABILITY_PROFILE_UNPINNED instead of running unmeasured options.
 * A resolved profile with no capability flag on is reported as `null` (absent), never as an all-off record. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {POLICY_FLAGS,SUBAGENT_TYPES,WORKSPACE_TOOLS,MAX_PARALLEL_SUBAGENTS} from '../../worker/conversation/capabilities/policy.mjs';
import {assertPlatformCapabilityLimits,intersectCapabilityPolicies,resolveCapabilityPolicy} from '../../worker/conversation/capabilities/policy-resolution.mjs';
import {READ_FAMILY_IDS} from '../../worker/conversation/reads/families.mjs';
const fault=code=>Object.assign(new Error(code),{code});
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn)&&!types.isGeneratorFunction(fn);
const text=(v,max)=>typeof v==='string'&&v.length>=1&&v.length<=max;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,HEX64=/^[a-f0-9]{64}$/u;
/** The roles Core's membership owner admits (`product-access/core-membership.mjs`). */
export const CORE_ROLES=Object.freeze(['standard_user','user_admin','capiro_admin']);
/** Default platform record: nothing enabled for any admitted role. */
export const NO_CAPABILITY_PLATFORM=freeze({maximum:{},defaults:{},roleCeilings:Object.fromEntries(CORE_ROLES.map(role=>[role,{}]))});
/** SDK-loadable originals of `packages/skills` (`describeSkillPlugin().skills`). The 14th original, `quick_skill.bill_watch`, has no SDK
 * frontmatter and is excluded by the plugin itself, so naming it would refuse SKILL_PLUGIN_NAME_REFUSED at run time. */
export const PLUGIN_SKILL_NAMES=Object.freeze(['meri-client-changes','meri-commitments-audit','meri-funding-opportunity-match','meri-hearing-watch','meri-mail-history',
 'meri-meeting-prep','meri-pe-deep-dive','meri-portfolio-changes','meri-portfolio-overlap','meri-regulatory-docket-brief','meri-relationship-brief',
 'meri-representation-lookup','meri-research-company','meri-bill-watch']);
const PREVIEW_PROFILE={generalReads:true,readFamilies:[...READ_FAMILY_IDS],governedIntents:true,skillPlugin:true,skillNames:[...PLUGIN_SKILL_NAMES],
 workspaceTools:true,workspaceToolNames:[...WORKSPACE_TOOLS],subagents:true,subagentTypes:[...SUBAGENT_TYPES],maxParallelSubagents:MAX_PARALLEL_SUBAGENTS,
 subagentProgress:true,auditHooks:true,compactionHooks:true,bash:true,sandboxNetworkDomains:[]};
/** PROPOSED preview platform record, pending the owner's decision. It is NOT a default: it takes effect only when rendered verbatim as
 * `configuration.capabilityPlatform`. Defaults and every Core role ceiling equal the maximum, so the preview tenant restricts nothing
 * further and every run resolves to one profile (G3). Bash is eligibility only: the runtime still requires the SDK sandbox attestation,
 * so it stays unavailable on Fargate. Workspace tools are confined by the SDK's `blockReadsOutsideWorkingDirectories`
 * (`capabilities/workspace-tools.mjs`). The browser keeps its own product policy (`browser/policy.mjs`), unaffected by this record. */
export const PROPOSED_PREVIEW_CAPABILITY_PLATFORM=freeze({maximum:structuredClone(PREVIEW_PROFILE),defaults:structuredClone(PREVIEW_PROFILE),
 roleCeilings:Object.fromEntries(CORE_ROLES.map(role=>[role,structuredClone(PREVIEW_PROFILE)]))});

/** The control's validated platform record from its closed configuration; absent means NO_CAPABILITY_PLATFORM. Also the config.mjs
 * validator for the `capabilityPlatform` key (no I/O, no clock). */
export function compileCapabilityPlatform(configuration){
 const raw=configuration?.capabilityPlatform;
 try{return assertPlatformCapabilityLimits(raw===undefined?NO_CAPABILITY_PLATFORM:data(raw));}catch{throw fault('CAPABILITY_PLATFORM_CONFIGURATION');}
}
/** `readPlatformLimits` for `createSettingsService`: the trusted static record. No producer of it existed; this is that producer. */
export function createStaticPlatformLimits(platform){
 const limits=assertPlatformCapabilityLimits(platform);
 return async function readPlatformLimits({signal}={}){nativeSignal(signal);signal?.throwIfAborted();return limits;};
}
/** Tenant capability record from the canonical settings store (`apps/control/settings/postgres-store.mjs` read), for `readTenantSettings`. */
export function tenantCapabilitySettingsReader(store){
 if(!store||typeof store.read!=='function')throw fault('CAPABILITY_PRODUCER_CONFIGURATION');
 const read=store.read.bind(store);
 return async function readTenantSettings({tenantId,signal}){const saved=await read({kind:'tenant',tenantId,signal});return saved?.document?.capabilityPolicy??{};};
}

export function createRunCapabilityPolicy(options){
 let platform,readTenant=null,readRole=null,pinned=null;
 try{
  const o=own(options,['platform'],['readTenantSettings','readRole','pinnedProfiles']);
  platform=assertPlatformCapabilityLimits(o.platform);
  if(o.readTenantSettings!==undefined){if(!ordinary(o.readTenantSettings))throw Error();readTenant=o.readTenantSettings;}
  if(o.readRole!==undefined){if(!ordinary(o.readRole))throw Error();readRole=o.readRole;}
  if(o.pinnedProfiles!==undefined){
   if(!Array.isArray(o.pinnedProfiles)||!o.pinnedProfiles.length||o.pinnedProfiles.length>64||o.pinnedProfiles.some(v=>typeof v!=='string'||!HEX64.test(v)))throw Error();
   pinned=new Set(o.pinnedProfiles);if(pinned.size!==o.pinnedProfiles.length)throw Error();
  }
 }catch{throw fault('CAPABILITY_PRODUCER_CONFIGURATION');}
 // G3: a per-tenant or per-member profile without a profile→pin map would run options the measurement never pinned.
 if((readTenant||readRole)&&!pinned)throw fault('CAPABILITY_PRODUCER_CONFIGURATION');
 const roles=Object.freeze(Object.keys(platform.roleCeilings).sort());
 const resolve=(tenant,role)=>role===null?roles.map(r=>resolveCapabilityPolicy({platform,tenant,role:r})).reduce(intersectCapabilityPolicies):resolveCapabilityPolicy({platform,tenant,role});
 const admitted=policy=>{
  if(!POLICY_FLAGS.some(flag=>policy[flag]===true))return null;
  if(pinned&&!pinned.has(canonicalSha256(policy)))throw fault('CAPABILITY_PROFILE_UNPINNED');
  return policy;
 };
 const fixed=readTenant||readRole?undefined:admitted(resolve({},null));
 function input(value){
  const i=own(value,['tenantId','actorId','conversationId'],['signal']);nativeSignal(i.signal);
  if(!text(i.tenantId,128)||!text(i.actorId,128)||typeof i.conversationId!=='string'||!UUID.test(i.conversationId))throw fault('CAPABILITY_POLICY_REQUEST');
  i.signal?.throwIfAborted();return i;
 }
 return Object.freeze({
  /** The single profile (and its canonical digest) when the producer is fixed; null when it varies or enables nothing. */
  profile:fixed??null,profileSha256:fixed?canonicalSha256(fixed):null,
  /** The validated CapabilityPolicy for one run, or null for "no capabilities" (the caller then attaches nothing). */
  async forRun(value){
   const i=input(value);if(fixed!==undefined)return fixed;
   const tenant=readTenant?await readTenant({tenantId:i.tenantId,signal:i.signal}):{};i.signal?.throwIfAborted();
   const role=readRole?await readRole({tenantId:i.tenantId,actorId:i.actorId,signal:i.signal}):null;i.signal?.throwIfAborted();
   if(readRole&&typeof role!=='string')throw fault('CAPABILITY_ROLE_UNKNOWN');
   return admitted(resolve(tenant??{},role));
  },
 });
}
/** The control's producer from its configuration: fixed per configuration (no readers), so it is safe under the single G3 pin. */
export function createConfiguredRunCapabilityPolicy(configuration){return createRunCapabilityPolicy({platform:compileCapabilityPlatform(configuration)});}
