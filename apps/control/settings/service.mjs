/** Persisted user and tenant settings. Validation belongs to `documents.mjs` (and the canonical capability-policy resolver), persistence
 * and audit to the injected store, and the platform record to Capiro's platform owner (`readPlatformLimits`). Tenant writes require
 * Core's `tenant.settings.manage` membership permission; every save is revisioned and audited. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertPlatformCapabilityLimits,resolveCapabilityPolicy} from '../../worker/conversation/capabilities/policy-resolution.mjs';
import {ProductError,asProductError,refuse} from '../product-access/errors.mjs';
import {closed,intIn} from '../product-access/shape.mjs';
import {TENANT_SETTINGS_DEFAULTS,USER_PREFERENCE_DEFAULTS,releasedUserPreferences,tenantSettings,userPreferences} from './documents.mjs';
export const TENANT_SETTINGS_PERMISSION='tenant.settings.manage';
const UUID4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
/** Dotted paths (two levels) whose values differ; content-free, for the audit trail. */
export function changedFields(before,after){
 const out=[];
 for(const key of new Set([...Object.keys(before??{}),...Object.keys(after)])){
  const a=before?.[key],b=after[key];if(canonicalSha256(a??null)===canonicalSha256(b??null))continue;
  const nested=v=>v&&typeof v==='object'&&!Array.isArray(v);
  if(nested(a)||nested(b)){for(const sub of new Set([...Object.keys(a??{}),...Object.keys(b??{})]))if(canonicalSha256(a?.[sub]??null)!==canonicalSha256(b?.[sub]??null))out.push(`${key}.${sub}`);}
  else out.push(key);
 }
 return Object.freeze(out.sort());
}
const revisionOf=value=>{if(!intIn(value,0,Number.MAX_SAFE_INTEGER-1))refuse('SETTINGS_REQUEST_INVALID',null,'expectedRevision');return value;};
export function createSettingsService(options){
 const {store,readPlatformLimits,newId}=options??{};
 if(['read','save','listAudit'].some(k=>typeof store?.[k]!=='function')||typeof readPlatformLimits!=='function'||typeof newId!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
 const id=()=>{const v=newId();if(typeof v!=='string'||!UUID4.test(v))throw new ProductError('PRODUCT_CONFIGURATION');return v;};
 async function platform(signal){
  try{return assertPlatformCapabilityLimits(await readPlatformLimits({signal}));}catch{refuse('SETTINGS_PLATFORM_UNAVAILABLE');}
 }
 const admin=principal=>{if(!principal.permissions.includes(TENANT_SETTINGS_PERMISSION))refuse('SETTINGS_ADMIN_REQUIRED');};
 async function tenantRecord(principal,signal){
  const stored=await store.read({kind:'tenant',tenantId:principal.tenantId,signal});
  return {revision:stored?.revision??0,settings:stored?.document??TENANT_SETTINGS_DEFAULTS};
 }
 /** Effective capabilities for this member's role: platform maximum ∧ tenant settings ∧ role ceiling ∧ tenant role narrowing. A stored
  * tenant record that no longer fits a narrowed platform record yields no capabilities and names why, rather than being clipped. */
 function effective(limits,settings,principal){
  try{return {capabilityStatus:'resolved',effectiveCapabilities:resolveCapabilityPolicy({platform:limits,tenant:settings.capabilityPolicy,role:principal.role})};}
  catch(error){return {capabilityStatus:typeof error?.code==='string'&&/^CAPABILITY_[A-Z_]+$/u.test(error.code)?error.code:'CAPABILITY_UNRESOLVED',effectiveCapabilities:null};}
 }
 const guard=fn=>async(...args)=>{try{return await fn(...args);}catch(error){throw asProductError(error,'SETTINGS_UNAVAILABLE');}};
 return Object.freeze({
  readUser:guard(async({principal,signal})=>{
   const stored=await store.read({kind:'user',tenantId:principal.tenantId,actorId:principal.actorId,signal});
   return Object.freeze({revision:stored?.revision??0,preferences:releasedUserPreferences(stored?.document??USER_PREFERENCE_DEFAULTS,principal)});
  }),
  saveUser:guard(async({principal,body,signal})=>{
   const r=closed(body,['expectedRevision','preferences'],[],'SETTINGS_REQUEST_INVALID'),expectedRevision=revisionOf(r.expectedRevision);
   const preferences=userPreferences(r.preferences,principal);
   const stored=await store.read({kind:'user',tenantId:principal.tenantId,actorId:principal.actorId,signal});
   const saved=await store.save({kind:'user',tenantId:principal.tenantId,actorId:principal.actorId,expectedRevision,document:preferences,signal,
    audit:{auditId:id(),actorId:principal.actorId,platformSha256:null,changedFields:changedFields(stored?.document??USER_PREFERENCE_DEFAULTS,preferences)}});
   return Object.freeze({revision:saved.revision,preferences});
  }),
  /** Every member sees the tenant default timezone and their own effective capabilities; admins also see the record and platform limits. */
  readTenant:guard(async({principal,signal})=>{
   const limits=await platform(signal),{revision,settings}=await tenantRecord(principal,signal);
   const view={revision,defaultTimezone:settings.defaultTimezone,...effective(limits,settings,principal)};
   if(principal.permissions.includes(TENANT_SETTINGS_PERMISSION))Object.assign(view,{capabilityPolicy:settings.capabilityPolicy,platform:limits});
   return Object.freeze(view);
  }),
  saveTenant:guard(async({principal,body,signal})=>{
   admin(principal);
   const r=closed(body,['expectedRevision','settings'],[],'SETTINGS_REQUEST_INVALID'),expectedRevision=revisionOf(r.expectedRevision);
   const limits=await platform(signal),settings=tenantSettings(r.settings,limits);
   // The store's revision compare-and-set is the conflict owner; a concurrent save between this read and the write refuses there.
   const current=await tenantRecord(principal,signal);
   const saved=await store.save({kind:'tenant',tenantId:principal.tenantId,expectedRevision,document:settings,signal,
    audit:{auditId:id(),actorId:principal.actorId,platformSha256:canonicalSha256(limits),changedFields:changedFields(current.settings,settings)}});
   return Object.freeze({revision:saved.revision,defaultTimezone:settings.defaultTimezone,capabilityPolicy:settings.capabilityPolicy,...effective(limits,settings,principal)});
  }),
  readAudit:guard(async({principal,body,signal})=>{
   admin(principal);
   const r=closed(body,[],['beforeSequence','limit'],'SETTINGS_REQUEST_INVALID'),limit=r.limit??25,beforeSequence=r.beforeSequence??null;
   if(!intIn(limit,1,100))refuse('SETTINGS_REQUEST_INVALID',null,'limit');if(beforeSequence!==null&&!intIn(beforeSequence,1,Number.MAX_SAFE_INTEGER))refuse('SETTINGS_REQUEST_INVALID',null,'beforeSequence');
   const entries=await store.listAudit({tenantId:principal.tenantId,beforeSequence,limit:limit+1,signal});
   return Object.freeze({entries:entries.slice(0,limit),nextBeforeSequence:entries.length>limit?entries[limit-1].sequence:null});
  }),
 });
}
