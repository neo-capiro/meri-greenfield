import canonicalize from 'canonicalize';
import {validators} from './generated-validator.mjs';
import {userPreferencesDocument} from './document.mjs';
import {userPreferencesMetadata,userPreferencesPaths} from './generated-protocol.mjs';
import {parseText,expectedData,fail} from './boundary.mjs';
export {UserPreferencesResponseError} from './boundary.mjs';
export {userPreferencesVersion} from './protocol.mjs';
export {userPreferencesMetadata,userPreferencesPaths};
export {USER_PREFERENCE_DEFAULTS,USER_PREFERENCE_THEMES,USER_PREFERENCE_DENSITIES,USER_PREFERENCE_NOTIFICATIONS} from './document.mjs';
const routes=Object.freeze({read:'UserPreferencesReadRequest',save:'UserPreferencesSaveRequest'});
const selected=route=>{if(typeof route!=='string'||!Object.hasOwn(routes,route))fail('USER_PREFERENCES_ROUTE');return routes[route];};
const check=(name,value)=>{if(!validators[name](value))fail('USER_PREFERENCES_SHAPE');};
const same=(a,b)=>canonicalize(a)===canonicalize(b);
function document(value){try{if(!same(value,userPreferencesDocument(value)))fail('USER_PREFERENCES_DOCUMENT');}catch{fail('USER_PREFERENCES_DOCUMENT');}}
/** The complete JSON document is schema/semantically canonical, not an authority or membership grant. */
export async function receiveUserPreferencesRequest(route,jsonText){
 const name=selected(route),value=parseText(jsonText,userPreferencesMetadata.limits.requestBytes);check(name,value);if(route==='save')document(value.preferences);return value;
}
/** Read Response.text(). The independent owner must be captured with the request and still current at display time. */
export async function receiveUserPreferencesResponse(route,httpStatus,jsonText,expected){
 const name=selected(route);if(!Number.isInteger(httpStatus))fail('USER_PREFERENCES_STATUS');
 const expectation=expectedData(expected,userPreferencesMetadata.limits.requestBytes),keys=Object.keys(expectation??{}),required=route==='save'?['owner','request']:['owner'];
 if(keys.length!==required.length||required.some(key=>!keys.includes(key)))fail('USER_PREFERENCES_EXPECTATION');check('UserPreferencesOwner',expectation.owner);
 if(route==='save'){check(name,expectation.request);document(expectation.request.preferences);}
 const value=parseText(jsonText,userPreferencesMetadata.limits.responseBytes);
 if(httpStatus!==200){check('UserPreferencesErrorResponse',value);if(userPreferencesMetadata.errorStatuses[value.error.code]!==httpStatus||httpStatus===502&&Object.hasOwn(value.error,'field'))fail('USER_PREFERENCES_STATUS');return value;}
 check('UserPreferencesResponse',value);document(value.preferences);
 if(!same(value.owner,expectation.owner)||route==='save'&&(value.revision!==expectation.request.expectedRevision+1||!same(value.preferences,expectation.request.preferences)))fail('USER_PREFERENCES_CORRELATION');return value;
}
