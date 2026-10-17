/** Strict settings documents (LOCAL PROPOSAL settings 0.1-proposal). Every document is a complete closed object: unknown fields,
 * wrong types and out-of-range values refuse with a field-named code. Capability-policy validation is the canonical
 * `policy-resolution.mjs` owner, so a tenant value that would widen the platform maximum or a role ceiling refuses with its codes. */
import {assertTenantCapabilitySettings} from '../../worker/conversation/capabilities/policy-resolution.mjs';
import {ProductError,refuse} from '../product-access/errors.mjs';
import {closed} from '../product-access/shape.mjs';
import {USER_PREFERENCE_FIELDS,USER_PREFERENCE_DEFAULTS,userPreferencesDocument,userPreferencesTimezone,userPreferencesDocumentFailure} from '../../../packages/contracts/user-preferences-application/document.mjs';
export {USER_PREFERENCE_DEFAULTS};
const documentCall=operation=>{try{return operation();}catch(error){const failure=userPreferencesDocumentFailure(error);if(failure)refuse(failure.code,null,failure.field);throw error;}};
export const timezone=(value,name)=>documentCall(()=>userPreferencesTimezone(value,name===undefined?null:name));
/** User preferences. `timezone:null` follows the tenant default. `defaultClientId` must be one of the member's current clients. */
export function userPreferences(value,principal){
 const input=closed(value,USER_PREFERENCE_FIELDS,[],'SETTINGS_DOCUMENT_INVALID'),preferences=documentCall(()=>userPreferencesDocument(input));
 if(preferences.defaultClientId!==null&&!principal.clientIds.includes(preferences.defaultClientId))refuse('SETTINGS_CLIENT_REFUSED');return preferences;
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
