/** Pure resolution of the effective browser policy for one user's run, mirroring the SDK capability resolver
 * (`capabilities/policy-resolution.mjs` on the parallel capability lane) with the same record shapes and code style:
 *
 *   effective = platform maximum ∧ tenant settings (platform defaults, overridden only inside the maximum)
 *               ∧ platform role ceiling ∧ optional tenant narrowing of that role ceiling
 *
 * Capiro owns the platform record (maximum, defaults, role ceilings) and supplies it as trusted configuration. Its
 * `maximum.allowedOrigins` is the platform-approved destination set; `defaults.allowedOrigins` is the subset enabled
 * for a tenant that has not chosen. Tenant admins may disable or narrow, or enable approved origins the default left
 * out, but only inside the maximum, and may only narrow a role ceiling; a value that would widen either refuses with a
 * stable code and is never clipped silently. `enabled` ANDs, `tools` and `allowedOrigins` intersect, timeouts and
 * limits take the minimum. An empty effective allowlist leaves the capability on with no destination. The platform
 * security limits (`public-web.mjs`) apply to every record and cannot be removed by any of them.
 * No I/O, clock or authority: the control owner (Core) supplies all inputs from trusted records and the user's
 * server-side role. */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertFullBrowserPolicy,validateBrowserPolicy,BROWSER_POLICY_KEYS} from './policy.mjs';
export const ROLE_NAME=/^[a-z][a-z0-9_-]{0,63}$/u;
const MAX_ROLES=32;
const fail=(code,field)=>{throw Object.assign(new Error(field?`${code}:${field}`:code),{code,...(field?{field}:{})});};
/** Field-wise ⊆ for one top-level key. */
function fieldWithin(key,c,m){
 switch(key){
  case 'enabled':return !c.enabled||m.enabled;
  case 'tools':return c.tools.every(t=>m.tools.includes(t));
  case 'allowedOrigins':return c.allowedOrigins.every(o=>m.allowedOrigins.includes(o));
  case 'timeouts':return c.timeouts.actionMs<=m.timeouts.actionMs&&c.timeouts.navigationMs<=m.timeouts.navigationMs;
  case 'downloads':return (!c.downloads.enabled||m.downloads.enabled)&&c.downloads.formats.every(f=>m.downloads.formats.includes(f))&&c.downloads.maxBytes<=m.downloads.maxBytes&&c.downloads.maxFiles<=m.downloads.maxFiles;
 }
 return false;
}
/** First key of `candidate` (restricted to `keys`) that exceeds `ceiling`, or undefined. */
export function browserWideningField(candidate,ceiling,keys=BROWSER_POLICY_KEYS){return keys.find(k=>!fieldWithin(k,candidate,ceiling));}
/** Narrowing-only normalization of an already type-valid record: a flag is on only while what it scopes is non-empty. */
function normalize(raw){
 const n={...raw,downloads:{...raw.downloads}};
 n.enabled=n.enabled===true&&n.tools.length>0;
 n.downloads.enabled=n.downloads.enabled===true&&n.downloads.formats.length>0;
 return n;
}
/** Intersection of two complete policies; list order follows the first operand, so `intersect(p,p)` is `p`. */
export function intersectBrowserPolicies(a,b){
 const pa=assertFullBrowserPolicy(a),pb=assertFullBrowserPolicy(b),both=(x,y)=>x.filter(v=>y.includes(v));
 return assertFullBrowserPolicy(normalize({enabled:pa.enabled&&pb.enabled,tools:both(pa.tools,pb.tools),allowedOrigins:both(pa.allowedOrigins,pb.allowedOrigins),
  timeouts:{actionMs:Math.min(pa.timeouts.actionMs,pb.timeouts.actionMs),navigationMs:Math.min(pa.timeouts.navigationMs,pb.timeouts.navigationMs)},
  downloads:{enabled:pa.downloads.enabled&&pb.downloads.enabled,formats:both(pa.downloads.formats,pb.downloads.formats),maxBytes:Math.min(pa.downloads.maxBytes,pb.downloads.maxBytes),maxFiles:Math.min(pa.downloads.maxFiles,pb.downloads.maxFiles)}}));
}
/** Plain own-data object keyed by role names. */
function roleMap(value,code){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail(code);
 const entries=Object.entries(Object.getOwnPropertyDescriptors(value));
 if(entries.length>MAX_ROLES||entries.some(([k,d])=>!ROLE_NAME.test(k)||!d.enumerable||!Object.hasOwn(d,'value')))fail(code);
 return value;
}
/** Record validation that keeps the stable code of a platform security limit and otherwise reports the record's own code. */
const full=(value,code,field)=>{try{return assertFullBrowserPolicy(typeof value==='function'?value():value);}catch(e){fail(e.code==='BROWSER_PLATFORM_LIMIT'?e.code:code,field);}};
/** Platform record validation: defaults and every role ceiling must sit inside the maximum. */
export function assertPlatformBrowserLimits(value){
 let p;try{p=own(value,['maximum','defaults','roleCeilings']);}catch{fail('BROWSER_PLATFORM_LIMITS_REFUSED');}
 const maximum=full(p.maximum,'BROWSER_PLATFORM_LIMITS_REFUSED','maximum'),defaults=full(p.defaults,'BROWSER_PLATFORM_LIMITS_REFUSED','defaults');
 const exceeded=browserWideningField(defaults,maximum);if(exceeded)fail('BROWSER_PLATFORM_LIMITS_REFUSED',`defaults.${exceeded}`);
 const raw=roleMap(p.roleCeilings,'BROWSER_PLATFORM_LIMITS_REFUSED');if(!Object.keys(raw).length)fail('BROWSER_PLATFORM_LIMITS_REFUSED','roleCeilings');
 const roleCeilings={};
 for(const [role,ceiling] of Object.entries(raw)){const c=full(ceiling,'BROWSER_PLATFORM_LIMITS_REFUSED',`roleCeilings.${role}`),field=browserWideningField(c,maximum);if(field)fail('BROWSER_PLATFORM_LIMITS_REFUSED',`roleCeilings.${role}.${field}`);roleCeilings[role]=c;}
 return Object.freeze({maximum,defaults,roleCeilings:Object.freeze(roleCeilings)});
}
/** Raw field types a partial tenant/role record may carry, checked BEFORE any merge or normalization so that a value
 * of the wrong type (for example `enabled:'yes'`) refuses instead of being coerced. Value ranges, vocabularies and
 * widening are checked afterwards on the merged complete record. */
const PARTIAL_TYPES=Object.freeze({enabled:v=>typeof v==='boolean',tools:Array.isArray,allowedOrigins:Array.isArray});
const NESTED_TYPES=Object.freeze({
 timeouts:Object.freeze({actionMs:Number.isSafeInteger,navigationMs:Number.isSafeInteger}),
 downloads:Object.freeze({enabled:v=>typeof v==='boolean',formats:Array.isArray,maxBytes:Number.isSafeInteger,maxFiles:Number.isSafeInteger})});
/** Returns the partial with nested records copied as own data, or refuses with the first mistyped field. */
function typedPartial(fields){
 const typed={};
 for(const [key,value] of Object.entries(fields)){
  if(Object.hasOwn(PARTIAL_TYPES,key)){if(!PARTIAL_TYPES[key](value))fail('BROWSER_TENANT_SETTINGS_REFUSED',key);typed[key]=value;continue;}
  let nested;try{nested=own(value,[],Object.keys(NESTED_TYPES[key]));}catch{fail('BROWSER_TENANT_SETTINGS_REFUSED',key);}
  for(const [name,v] of Object.entries(nested))if(!NESTED_TYPES[key][name](v))fail('BROWSER_TENANT_SETTINGS_REFUSED',`${key}.${name}`);
  typed[key]=nested;
 }
 return typed;
}
/** Applies a partial tenant override to `base`; `timeouts`/`downloads` merge field by field. Raw field types are
 * validated first (`typedPartial`); only then are values merged and normalized. Every overridden key must stay
 * within `ceiling`. */
function override(base,partial,ceiling,code){
 let raw;try{raw=own(partial,[],[...BROWSER_POLICY_KEYS]);}catch{fail('BROWSER_TENANT_SETTINGS_REFUSED');}
 const fields=typedPartial(raw);
 const nested=key=>fields[key]===undefined?base[key]:{...base[key],...fields[key]};
 const merged=full(()=>normalize({...base,...fields,timeouts:nested('timeouts'),downloads:nested('downloads')}),'BROWSER_TENANT_SETTINGS_REFUSED');
 const field=browserWideningField(merged,ceiling,Object.keys(fields));if(field)fail(code,field);
 return merged;
}
/** Tenant record validation against the platform record, independent of which user asks, so an admin save can be
 * refused at write time with the same codes the resolver uses. Shape: `{browser?, roles?:{[role]:partial}}`. */
export function assertTenantBrowserSettings(value,platform){
 let t;try{t=own(value,[],['browser','roles']);}catch{fail('BROWSER_TENANT_SETTINGS_REFUSED');}
 const browser=t.browser===undefined?platform.defaults:override(platform.defaults,t.browser,platform.maximum,'BROWSER_TENANT_WIDENING_REFUSED');
 const roles={};
 if(t.roles!==undefined)for(const [role,partial] of Object.entries(roleMap(t.roles,'BROWSER_TENANT_SETTINGS_REFUSED'))){
  if(!Object.hasOwn(platform.roleCeilings,role))fail('BROWSER_ROLE_UNKNOWN',role);
  const ceiling=platform.roleCeilings[role];roles[role]=override(ceiling,partial,ceiling,'BROWSER_ROLE_WIDENING_REFUSED');}
 return Object.freeze({browser,roles:Object.freeze(roles)});
}
/** Effective worker-facing browser policy for one user (`validateBrowserPolicy` output: complete when on,
 * `{enabled:false}` when off). `role` is the user's role from the control owner's trusted identity record. */
export function resolveBrowserPolicy(input){
 let i;try{i=own(input,['platform','role'],['tenant']);}catch{fail('BROWSER_POLICY_INPUT_REFUSED');}
 const platform=assertPlatformBrowserLimits(i.platform),tenant=assertTenantBrowserSettings(i.tenant??{},platform);
 if(typeof i.role!=='string'||!ROLE_NAME.test(i.role)||!Object.hasOwn(platform.roleCeilings,i.role))fail('BROWSER_ROLE_UNKNOWN');
 const roleCeiling=platform.roleCeilings[i.role],tenantRole=Object.hasOwn(tenant.roles,i.role)?tenant.roles[i.role]:roleCeiling;
 return validateBrowserPolicy([tenant.browser,roleCeiling,tenantRole].reduce(intersectBrowserPolicies,platform.maximum));
}
