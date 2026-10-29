/** Effective run policy uses the canonical tenant settings and the current Core role supplied by the trusted runtime owner.
 * Platform maximum ∧ tenant settings ∧ role ceiling ∧ tenant role narrowing remains owned by policy-resolution.mjs.
 * No role or policy is cached across decisions; a missing settings row inherits platform defaults, while failed/corrupt reads refuse. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {POLICY_FLAGS,SUBAGENT_TYPES,WORKSPACE_TOOLS,MAX_PARALLEL_SUBAGENTS} from '../../worker/conversation/capabilities/policy.mjs';
import {assertPlatformCapabilityLimits,resolveCapabilityPolicy} from '../../worker/conversation/capabilities/policy-resolution.mjs';
import {READ_FAMILY_IDS} from '../../worker/conversation/reads/families.mjs';
import {createPostgresSettingsStore} from '../../control/settings/postgres-store.mjs';
const fault=code=>Object.assign(new Error(code),{code});
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn)&&!types.isGeneratorFunction(fn);
const text=(v,max)=>typeof v==='string'&&v.length>=1&&v.length<=max;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
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
 subagentProgress:true,auditHooks:true,compactionHooks:true,bash:true,userQuestions:true,sandboxNetworkDomains:[]};
/** PROPOSED preview platform record, pending the owner's decision. It is NOT a default: it takes effect only when rendered verbatim as
 * `configuration.capabilityPlatform`. Defaults and every Core role ceiling equal the maximum, so the preview tenant restricts nothing
 * further until saved tenant settings narrow it. Bash is eligibility only: the runtime still requires the SDK sandbox attestation,
 * so it stays unavailable on Fargate. `userQuestions` admits the native AskUserQuestion card: the runtime still needs its
 * durable question owner, and a tenant/role that turns it off narrows it away through the normal intersection.
 * Workspace tools are confined by the SDK's `blockReadsOutsideWorkingDirectories`
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
 return async function readTenantSettings({tenantId,signal}){
  const saved=await read({kind:'tenant',tenantId,signal});if(saved===null)return {};
  try{return data(own(saved.document.capabilityPolicy,[],['capabilities','roles']));}catch{throw fault('CAPABILITY_TENANT_SETTINGS_REFUSED');}
 };
}

/** Project an already verified Core/job observation without extending its original authority window. No I/O or identity authority. */
export function projectCapabilityRole({role,checkedAtMs,expiresAtMs},{started,now}){
 if(!CORE_ROLES.includes(role))throw fault('CAPABILITY_ROLE_UNKNOWN');
 if(!Number.isSafeInteger(checkedAtMs)||checkedAtMs<started||checkedAtMs>now||!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=now)throw fault('CAPABILITY_AUTHORITY_REFUSED');
 return Object.freeze({actorRole:role,checkedAtMs,expiresAtMs});
}
export function createRunCapabilityPolicy(options){
 let platform,readTenant;
 try{
  const o=own(options,['platform','readTenantSettings']);
  platform=assertPlatformCapabilityLimits(o.platform);
  if(!ordinary(o.readTenantSettings))throw Error();readTenant=o.readTenantSettings;
 }catch{throw fault('CAPABILITY_PRODUCER_CONFIGURATION');}
 function input(value){
  const i=own(value,['tenantId','actorId','conversationId'],['actorRole','signal']);nativeSignal(i.signal);
  if(!text(i.tenantId,128)||!text(i.actorId,128)||typeof i.conversationId!=='string'||!UUID.test(i.conversationId))throw fault('CAPABILITY_POLICY_REQUEST');
  if(!CORE_ROLES.includes(i.actorRole))throw fault('CAPABILITY_ROLE_UNKNOWN');
  i.signal?.throwIfAborted();return i;
 }
 return Object.freeze({
  /** The validated policy for this decision, or null when every capability is disabled. */
  async forRun(value){
   const i=input(value),tenant=await readTenant({tenantId:i.tenantId,signal:i.signal});i.signal?.throwIfAborted();
   if(tenant===null||tenant===undefined)throw fault('CAPABILITY_TENANT_SETTINGS_REFUSED');
   const policy=resolveCapabilityPolicy({platform,tenant,role:i.actorRole});
   return POLICY_FLAGS.some(flag=>policy[flag]===true)?policy:null;
  },
 });
}
/** Both load and read discovery use the same canonical settings store/resolver composition over the borrowed control pool. */
export function createConfiguredRunCapabilityPolicy(configuration,{pool}){
 return createRunCapabilityPolicy({platform:compileCapabilityPlatform(configuration),readTenantSettings:tenantCapabilitySettingsReader(createPostgresSettingsStore({pool}))});
}
