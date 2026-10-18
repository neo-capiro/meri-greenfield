/** Settings surface routes for `createProductApplication`. */
import {closed} from '../product-access/shape.mjs';
export const SETTINGS_ERROR_STATUSES=Object.freeze({SETTINGS_REQUEST_INVALID:400,SETTINGS_DOCUMENT_INVALID:400,SETTINGS_FIELD_INVALID:400,
 SETTINGS_CLIENT_REFUSED:403,SETTINGS_ADMIN_REQUIRED:403,SETTINGS_REVISION_CONFLICT:409,
 CAPABILITY_TENANT_WIDENING_REFUSED:422,CAPABILITY_ROLE_WIDENING_REFUSED:422,CAPABILITY_ROLE_UNKNOWN:422,CAPABILITY_POLICY_REFUSED:422,CAPABILITY_TENANT_SETTINGS_REFUSED:422,
 SETTINGS_PLATFORM_UNAVAILABLE:503,SETTINGS_STORE_UNAVAILABLE:503,SETTINGS_STORE_STATE:500,SETTINGS_COMMIT_UNKNOWN:503,SETTINGS_UNAVAILABLE:503});
const empty=body=>closed(body,[],[],'SETTINGS_REQUEST_INVALID');
export function createSettingsRoutes({service}){
 const route=(handle,effect=false)=>Object.freeze({handle,errors:SETTINGS_ERROR_STATUSES,effect});
 return Object.freeze({
  '/api/settings/user/read':route(({principal,body,signal})=>{empty(body);return service.readUser({principal,signal});}),
  '/api/settings/user/save':route(({principal,body,signal,recheckMembership})=>service.saveUser({principal,body,signal,recheckMembership}),true),
  '/api/settings/tenant/read':route(({principal,body,signal})=>{empty(body);return service.readTenant({principal,signal});}),
  '/api/settings/tenant/save':route(({principal,body,signal})=>service.saveTenant({principal,body,signal}),true),
  '/api/settings/tenant/audit':route(({principal,body,signal})=>service.readAudit({principal,body,signal})),
 });
}
