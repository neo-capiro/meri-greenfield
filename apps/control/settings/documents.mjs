/** Strict settings documents (LOCAL PROPOSAL settings 0.1-proposal). Every document is a complete closed object: unknown fields,
 * wrong types and out-of-range values refuse with a field-named code. Capability-policy validation is the canonical
 * `policy-resolution.mjs` owner, so a tenant value that would widen the platform maximum or a role ceiling refuses with its codes. */
import {assertTenantCapabilitySettings} from '../../worker/conversation/capabilities/policy-resolution.mjs';
import {assertTenantBrowserSettings} from '../../worker/conversation/browser/resolution.mjs';
import {ProductError,refuse} from '../product-access/errors.mjs';
import {closed} from '../product-access/shape.mjs';
import {USER_PREFERENCE_FIELDS,USER_PREFERENCE_DEFAULTS,userPreferencesDocument,storedUserPreferencesDocument,userPreferencesTimezone,userPreferencesDocumentFailure} from '../../../packages/contracts/user-preferences-application/document.mjs';
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
 stored=documentCall(()=>storedUserPreferencesDocument(stored));
 return stored.defaultClientId!==null&&!principal.clientIds.includes(stored.defaultClientId)?Object.freeze({...stored,defaultClientId:null}):stored;
}
export const TENANT_SETTINGS_DEFAULTS=Object.freeze({defaultTimezone:'UTC',capabilityPolicy:Object.freeze({})});
// Tenant execution limits are independent of catalog availability; model rows/defaults belong to the deployment policy.
export const DEFAULT_MODEL_LIMITS=Object.freeze({maxTurns:20,maxBudgetMicroUsd:2000000});
/** Explicit admin input cannot clear a configured cap. A missing persisted cap refuses run admission. */
export function modelSettings(value){
 const m=closed(value,['monthlyCapMicroUsd','maxTurns','maxBudgetMicroUsd'],[],'SETTINGS_MODEL_INVALID');
 for(const key of ['monthlyCapMicroUsd','maxBudgetMicroUsd'])if(!Number.isSafeInteger(m[key])||m[key]<1)refuse('SETTINGS_MODEL_INVALID',null,`model.${key}`);
 if(!Number.isSafeInteger(m.maxTurns)||m.maxTurns<1||m.maxTurns>100)refuse('SETTINGS_MODEL_INVALID',null,'model.maxTurns');
 return Object.freeze({...m});
}
/** Existing typed columns are nullable only for the never-configured monthly cap. */
export function storedModelSettings(row){
 const monthlyCapMicroUsd=row.monthly_cap_micro_usd==null?null:Number(row.monthly_cap_micro_usd);
 const limits={maxTurns:Number(row.sdk_max_turns??DEFAULT_MODEL_LIMITS.maxTurns),maxBudgetMicroUsd:Number(row.sdk_max_budget_micro_usd??DEFAULT_MODEL_LIMITS.maxBudgetMicroUsd)};
 modelSettings({monthlyCapMicroUsd:monthlyCapMicroUsd??1,...limits});return Object.freeze({monthlyCapMicroUsd,...limits});
}
/** Tenant settings, validated against the current platform record. Admins may enable or restrict inside the platform maximum and only
 * narrow role ceilings; widening refuses (CAPABILITY_TENANT_WIDENING_REFUSED / CAPABILITY_ROLE_WIDENING_REFUSED / CAPABILITY_ROLE_UNKNOWN). */
export function tenantSettings(value,platform,browserPlatform){
 const t=closed(value,['defaultTimezone','capabilityPolicy'],['model','browserPolicy'],'SETTINGS_DOCUMENT_INVALID');
 const defaultTimezone=timezone(t.defaultTimezone,'defaultTimezone');
 try{assertTenantCapabilitySettings(t.capabilityPolicy,platform);}
 catch(error){
  const code=typeof error?.code==='string'&&/^CAPABILITY_[A-Z_]+$/u.test(error.code)?error.code:'CAPABILITY_TENANT_SETTINGS_REFUSED';
  throw new ProductError(code,null,typeof error?.field==='string'?`capabilityPolicy.${error.field}`:'capabilityPolicy');
 }
 if(t.browserPolicy!==undefined){
  if(browserPlatform===undefined)refuse('SETTINGS_PLATFORM_UNAVAILABLE');
  try{assertTenantBrowserSettings(t.browserPolicy,browserPlatform);}
  catch(error){
   const code=typeof error?.code==='string'&&/^BROWSER_[A-Z_]+$/u.test(error.code)?error.code:'BROWSER_TENANT_SETTINGS_REFUSED';
   throw new ProductError(code,null,typeof error?.field==='string'?`browserPolicy.${error.field}`:'browserPolicy');
  }
 }
 return Object.freeze({defaultTimezone,capabilityPolicy:t.capabilityPolicy,...(t.browserPolicy===undefined?{}:{browserPolicy:t.browserPolicy}),...(t.model===undefined?{}:{model:modelSettings(t.model)})});
}
