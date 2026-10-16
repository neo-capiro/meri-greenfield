/** Strict settings documents (LOCAL PROPOSAL settings 0.1-proposal). Every document is a complete closed object: unknown fields,
 * wrong types and out-of-range values refuse with a field-named code. Capability-policy validation is the canonical
 * `policy-resolution.mjs` owner, so a tenant value that would widen the platform maximum or a role ceiling refuses with its codes. */
import {assertTenantCapabilitySettings} from '../../worker/conversation/capabilities/policy-resolution.mjs';
import {ProductError,refuse} from '../product-access/errors.mjs';
import {closed,lowerUuid} from '../product-access/shape.mjs';
const THEMES=['system','light','dark'],DENSITIES=['comfortable','compact'];
const NOTIFICATIONS=['runCompleted','approvalRequested','memoryReviewed'];
const field=name=>refuse('SETTINGS_FIELD_INVALID',null,name);
export function timezone(value,name){
 if(typeof value!=='string'||value.length>64)field(name);
 let resolved;try{resolved=new Intl.DateTimeFormat('en-US',{timeZone:value}).resolvedOptions().timeZone;}catch{field(name);}
 if(resolved!==value&&!(value==='UTC'&&resolved==='UTC'))field(name);
 return value;
}
export const USER_PREFERENCE_DEFAULTS=Object.freeze({theme:'system',density:'comfortable',timezone:null,notifications:Object.freeze({runCompleted:true,approvalRequested:true,memoryReviewed:true}),defaultClientId:null});
/** User preferences. `timezone:null` follows the tenant default. `defaultClientId` must be one of the member's current clients. */
export function userPreferences(value,principal){
 const p=closed(value,['theme','density','timezone','notifications','defaultClientId'],[],'SETTINGS_DOCUMENT_INVALID');
 if(!THEMES.includes(p.theme))field('theme');if(!DENSITIES.includes(p.density))field('density');
 const tz=p.timezone===null?null:timezone(p.timezone,'timezone');
 let n;try{n=closed(p.notifications,NOTIFICATIONS,[],'SETTINGS_FIELD_INVALID');}catch{field('notifications');}
 for(const k of NOTIFICATIONS)if(typeof n[k]!=='boolean')field(`notifications.${k}`);
 let client=null;
 if(p.defaultClientId!==null){try{client=lowerUuid(p.defaultClientId,'SETTINGS_FIELD_INVALID');}catch{field('defaultClientId');}if(!principal.clientIds.includes(client))refuse('SETTINGS_CLIENT_REFUSED');}
 return Object.freeze({theme:p.theme,density:p.density,timezone:tz,notifications:Object.freeze({...n}),defaultClientId:client});
}
/** Stored preferences as released now: a default client the member no longer holds is withheld rather than disclosed. */
export function releasedUserPreferences(stored,principal){
 return stored.defaultClientId!==null&&!principal.clientIds.includes(stored.defaultClientId)?Object.freeze({...stored,defaultClientId:null}):stored;
}
export const TENANT_SETTINGS_DEFAULTS=Object.freeze({defaultTimezone:'UTC',capabilityPolicy:Object.freeze({})});
/** Tenant settings, validated against the current platform record. Admins may enable or restrict inside the platform maximum and only
 * narrow role ceilings; widening refuses (CAPABILITY_TENANT_WIDENING_REFUSED / CAPABILITY_ROLE_WIDENING_REFUSED / CAPABILITY_ROLE_UNKNOWN). */
export function tenantSettings(value,platform){
 const t=closed(value,['defaultTimezone','capabilityPolicy'],[],'SETTINGS_DOCUMENT_INVALID');
 const defaultTimezone=timezone(t.defaultTimezone,'defaultTimezone');
 try{assertTenantCapabilitySettings(t.capabilityPolicy,platform);}
 catch(error){
  const code=typeof error?.code==='string'&&/^CAPABILITY_[A-Z_]+$/u.test(error.code)?error.code:'CAPABILITY_TENANT_SETTINGS_REFUSED';
  throw new ProductError(code,null,typeof error?.field==='string'?`capabilityPolicy.${error.field}`:'capabilityPolicy');
 }
 return Object.freeze({defaultTimezone,capabilityPolicy:t.capabilityPolicy});
}
