// @ts-check
/** Pure resolution of the effective capability policy for one user's run (product decision, 15 Oct 2026):
 *
 *   effective = platform maximum ∧ tenant settings (platform defaults, overridden only inside the maximum)
 *               ∧ platform role ceiling ∧ optional tenant narrowing of that role ceiling
 *
 * Capiro owns the platform record (maximum, defaults and role ceilings). Tenant admins may enable or restrict
 * capabilities inside the maximum and may only narrow a role ceiling; a tenant value that would widen either is
 * refused with a stable code, never clipped silently. Flags AND, allowlists intersect, `maxParallelSubagents`
 * takes the minimum. No I/O, clock or authority: the control owner (Core) supplies all three inputs from its own
 * trusted records and the user's server-side role, and passes the result beside `run` to the worker. */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertCapabilityPolicy,POLICY_KEYS,POLICY_FLAGS} from './policy.mjs';
/** @typedef {import('./policy.mjs').CapabilityPolicy} CapabilityPolicy */
/** Platform-owned limits. Every member is a full CapabilityPolicy input (omitted fields take policy defaults).
 * @typedef {{maximum:unknown,defaults:unknown,roleCeilings:Record<string,unknown>}} PlatformCapabilityLimitsInput */
/** Tenant-admin record. `capabilities` overrides platform defaults field by field; `roles[role]` narrows that role's
 * platform ceiling field by field. Omitted fields inherit; both members are optional.
 * @typedef {{capabilities?:Record<string,unknown>,roles?:Record<string,Record<string,unknown>>}} TenantCapabilitySettingsInput */
/** @typedef {{maximum:CapabilityPolicy,defaults:CapabilityPolicy,roleCeilings:Readonly<Record<string,CapabilityPolicy>>}} PlatformCapabilityLimits */
/** @typedef {{capabilities:CapabilityPolicy,roles:Readonly<Record<string,CapabilityPolicy>>}} TenantCapabilitySettings */
export const ROLE_NAME=/^[a-z][a-z0-9_-]{0,63}$/u;
const MAX_ROLES=32;
/** @param {string} code @param {string} [field] @returns {never} */
const fail=(code,field)=>{throw Object.assign(Error(field?`${code}:${field}`:code),{code,...(field?{field}:{})});};
/** True when `pattern` admits `host` under the sandbox allowlist syntax (`*.d` covers sub-domains, not the apex). */
const covers=(/** @type {string} */pattern,/** @type {string} */host)=>pattern===host||pattern.startsWith('*.')&&host.endsWith(pattern.slice(1));
/** Field-wise ⊆. @param {keyof CapabilityPolicy} key @param {CapabilityPolicy} candidate @param {CapabilityPolicy} ceiling */
function fieldWithin(key,candidate,ceiling){
 const c=candidate[key],m=ceiling[key];
 if(typeof c==='boolean')return !c||m===true;
 if(key==='maxParallelSubagents')return /** @type {number} */(c)<=/** @type {number} */(m);
 if(key==='skillNames')return m===null||c!==null&&/** @type {readonly string[]} */(c).every(n=>/** @type {readonly string[]} */(m).includes(n));
 if(key==='sandboxNetworkDomains')return /** @type {readonly string[]} */(c).every(h=>/** @type {readonly string[]} */(m).some(p=>covers(p,h)));
 return /** @type {readonly string[]} */(c).every(n=>/** @type {readonly string[]} */(m).includes(n));
}
/** First field of `candidate` (restricted to `keys`) that exceeds `ceiling`, or undefined.
 * @param {CapabilityPolicy} candidate @param {CapabilityPolicy} ceiling @param {readonly string[]} [keys] */
export function wideningField(candidate,ceiling,keys=POLICY_KEYS){
 return keys.find(key=>!fieldWithin(/** @type {keyof CapabilityPolicy} */(key),candidate,ceiling));
}
/** A flag is on only while what it scopes is non-empty; subagent progress needs subagents. Narrowing only.
 * @param {Record<string,unknown>} raw */
function normalize(raw){
 const n={...raw},nonEmpty=(/** @type {unknown} */v)=>!Array.isArray(v)||v.length>0;
 n.subagents=n.subagents===true&&nonEmpty(n.subagentTypes);n.subagentProgress=n.subagentProgress===true&&n.subagents;
 n.workspaceTools=n.workspaceTools===true&&nonEmpty(n.workspaceToolNames);n.skillPlugin=n.skillPlugin===true&&nonEmpty(n.skillNames);
 n.generalReads=n.generalReads===true&&nonEmpty(n.readFamilies);
 return n;
}
/** Intersection of two validated policies; list order follows the first operand, so `intersect(p,p)` is `p`.
 * @param {CapabilityPolicy} a @param {CapabilityPolicy} b @returns {CapabilityPolicy} */
export function intersectCapabilityPolicies(a,b){
 const pa=assertCapabilityPolicy(a),pb=assertCapabilityPolicy(b);
 /** @type {Record<string,unknown>} */
 const raw=Object.fromEntries(POLICY_FLAGS.map(flag=>[flag,pa[/** @type {keyof CapabilityPolicy} */(flag)]===true&&pb[/** @type {keyof CapabilityPolicy} */(flag)]===true]));
 const both=(/** @type {readonly string[]} */x,/** @type {readonly string[]} */y)=>x.filter(v=>y.includes(v));
 raw.subagentTypes=both(pa.subagentTypes,pb.subagentTypes);raw.workspaceToolNames=both(pa.workspaceToolNames,pb.workspaceToolNames);raw.readFamilies=both(pa.readFamilies,pb.readFamilies);
 raw.skillNames=pa.skillNames===null?pb.skillNames:pb.skillNames===null?pa.skillNames:both(pa.skillNames,pb.skillNames);
 const fromA=pa.sandboxNetworkDomains.filter(h=>pb.sandboxNetworkDomains.some(p=>covers(p,h)));
 raw.sandboxNetworkDomains=[...fromA,...pb.sandboxNetworkDomains.filter(h=>!fromA.includes(h)&&pa.sandboxNetworkDomains.some(p=>covers(p,h)))];
 raw.maxParallelSubagents=Math.min(pa.maxParallelSubagents,pb.maxParallelSubagents);
 return assertCapabilityPolicy(normalize(raw));
}
/** Plain own-data object keyed by role names. @param {unknown} value @param {string} code @returns {Record<string,unknown>} */
function roleMap(value,code){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail(code);
 const entries=Object.entries(Object.getOwnPropertyDescriptors(value));
 if(entries.length>MAX_ROLES||entries.some(([k,d])=>!ROLE_NAME.test(k)||!d.enumerable||!Object.hasOwn(d,'value')))fail(code);
 return /** @type {Record<string,unknown>} */(value);
}
/** Platform record validation: defaults and every role ceiling must sit inside the maximum.
 * @param {unknown} value @returns {PlatformCapabilityLimits} */
export function assertPlatformCapabilityLimits(value){
 const p=own(value,['maximum','defaults','roleCeilings']),maximum=assertCapabilityPolicy(p.maximum),defaults=assertCapabilityPolicy(p.defaults);
 const exceeded=wideningField(defaults,maximum);if(exceeded)fail('CAPABILITY_PLATFORM_LIMITS_REFUSED',`defaults.${exceeded}`);
 const raw=roleMap(p.roleCeilings,'CAPABILITY_PLATFORM_LIMITS_REFUSED');if(!Object.keys(raw).length)fail('CAPABILITY_PLATFORM_LIMITS_REFUSED','roleCeilings');
 /** @type {Record<string,CapabilityPolicy>} */
 const roleCeilings={};
 for(const [role,ceiling] of Object.entries(raw)){const c=assertCapabilityPolicy(ceiling),field=wideningField(c,maximum);if(field)fail('CAPABILITY_PLATFORM_LIMITS_REFUSED',`roleCeilings.${role}.${field}`);roleCeilings[role]=c;}
 return Object.freeze({maximum,defaults,roleCeilings:Object.freeze(roleCeilings)});
}
/** Applies a partial override to a base policy; every overridden field must stay within `ceiling`.
 * @param {CapabilityPolicy} base @param {unknown} partial @param {CapabilityPolicy} ceiling @param {string} code */
function override(base,partial,ceiling,code){
 const fields=own(partial,[],[...POLICY_KEYS]),keys=Object.keys(fields);
 const merged=assertCapabilityPolicy(normalize({...base,...fields}));
 const field=wideningField(merged,ceiling,keys);if(field)fail(code,field);
 return merged;
}
/** Tenant record validation against the platform record, independent of which user asks, so an admin save can be
 * refused at write time with the same codes the resolver uses.
 * @param {unknown} value @param {PlatformCapabilityLimits} platform @returns {TenantCapabilitySettings} */
export function assertTenantCapabilitySettings(value,platform){
 const t=own(value,[],['capabilities','roles']);
 const capabilities=t.capabilities===undefined?platform.defaults:override(platform.defaults,t.capabilities,platform.maximum,'CAPABILITY_TENANT_WIDENING_REFUSED');
 /** @type {Record<string,CapabilityPolicy>} */
 const roles={};
 if(t.roles!==undefined){
  for(const [role,partial] of Object.entries(roleMap(t.roles,'CAPABILITY_TENANT_SETTINGS_REFUSED'))){
   if(!Object.hasOwn(platform.roleCeilings,role))fail('CAPABILITY_ROLE_UNKNOWN',role);
   const ceiling=/** @type {CapabilityPolicy} */(platform.roleCeilings[role]);roles[role]=override(ceiling,partial,ceiling,'CAPABILITY_ROLE_WIDENING_REFUSED');}}
 return Object.freeze({capabilities,roles:Object.freeze(roles)});
}
/** Effective policy for one user. `role` is the user's role from the control owner's trusted identity record.
 * @param {{platform:unknown,tenant?:unknown,role:unknown}} input @returns {CapabilityPolicy} */
export function resolveCapabilityPolicy(input){
 const i=own(input,['platform','role'],['tenant']),platform=assertPlatformCapabilityLimits(i.platform);
 const tenant=assertTenantCapabilitySettings(i.tenant??{},platform);
 if(typeof i.role!=='string'||!ROLE_NAME.test(i.role)||!Object.hasOwn(platform.roleCeilings,i.role))fail('CAPABILITY_ROLE_UNKNOWN');
 const roleCeiling=/** @type {CapabilityPolicy} */(platform.roleCeilings[i.role]),tenantRole=/** @type {CapabilityPolicy} */(Object.hasOwn(tenant.roles,i.role)?tenant.roles[i.role]:roleCeiling);
 // List order follows the tenant's own setting; each further operand can only remove entries.
 return [platform.maximum,roleCeiling,tenantRole].reduce(intersectCapabilityPolicies,tenant.capabilities);
}
