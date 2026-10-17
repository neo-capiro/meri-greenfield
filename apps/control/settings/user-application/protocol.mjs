/** User-only transport declarations. Existing owners retain settings and membership policy. */
import {PRODUCT_ERROR_STATUSES} from '../../product-access/http.mjs';
import {SETTINGS_ERROR_STATUSES} from '../routes.mjs';
export const USER_PREFERENCES_PATHS=Object.freeze({read:'/api/settings/user/read',save:'/api/settings/user/save'});
export const USER_PREFERENCES_LIMITS=Object.freeze({maxRequestMs:10000,maxRequestBytes:8192,maxResponseBytes:16384});
export const USER_PREFERENCES_ERROR_OUTCOMES=Object.freeze(['UNKNOWN','RESULT_NOT_RELEASED']);
const userCodes=['SETTINGS_REQUEST_INVALID','SETTINGS_DOCUMENT_INVALID','SETTINGS_FIELD_INVALID','SETTINGS_CLIENT_REFUSED',
 'SETTINGS_REVISION_CONFLICT','SETTINGS_STORE_UNAVAILABLE','SETTINGS_STORE_STATE','SETTINGS_COMMIT_UNKNOWN','SETTINGS_UNAVAILABLE'];
export const USER_PREFERENCES_DOMAIN_ERRORS=Object.freeze(Object.fromEntries(userCodes.map(code=>[code,SETTINGS_ERROR_STATUSES[code]])));
export const USER_PREFERENCES_ERROR_STATUSES=Object.freeze({...PRODUCT_ERROR_STATUSES,...USER_PREFERENCES_DOMAIN_ERRORS,USER_PREFERENCES_UNAVAILABLE:503});
export function userPreferencesUnavailable(){return Response.json({error:{code:'USER_PREFERENCES_UNAVAILABLE'}},{status:503,
 headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
