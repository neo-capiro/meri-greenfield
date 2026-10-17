import {receiveUserPreferencesRequest,receiveUserPreferencesResponse,USER_PREFERENCE_DEFAULTS,USER_PREFERENCE_THEMES,userPreferencesPaths,userPreferencesMetadata,type UserPreferences,type UserPreferencesOwner,type UserPreferencesSaveRequest,type UserPreferencesResponse,type UserPreferencesErrorResponse} from '@capiro/meri-contracts/user-preferences-application';
const owner:UserPreferencesOwner={tenantId:'tenant',actorId:'actor'},preferences:UserPreferences=structuredClone(USER_PREFERENCE_DEFAULTS);
preferences.theme='dark';const request:UserPreferencesSaveRequest=await receiveUserPreferencesRequest('save',JSON.stringify({expectedRevision:0,preferences}));
const result=await receiveUserPreferencesResponse('save',200,'{}',{owner,request}),exact:UserPreferencesResponse|UserPreferencesErrorResponse=result;void exact;
const read=await receiveUserPreferencesRequest('read','{}');await receiveUserPreferencesResponse('read',200,'{}',{owner});void read;
if(!('error'in result)){const revision:number=result.revision,theme:'system'|'light'|'dark'=result.preferences.theme;void revision;void theme;}
const path:'/api/settings/user/read'=userPreferencesPaths.read,limit:8192=userPreferencesMetadata.limits.requestBytes,themes:readonly ['system','light','dark']=USER_PREFERENCE_THEMES;void path;void limit;void themes;
// @ts-expect-error independent current Core owner is mandatory
await receiveUserPreferencesResponse('read',200,'{}');
// @ts-expect-error save requires exact captured request
await receiveUserPreferencesResponse('save',200,'{}',{owner});
// @ts-expect-error read accepts only its owner expectation
await receiveUserPreferencesResponse('read',200,'{}',{owner,request});
// @ts-expect-error fixed user routes do not expose tenant changes
await receiveUserPreferencesRequest('tenant-save','{}');
// @ts-expect-error canonical enum is closed
preferences.theme='neon';
// @ts-expect-error complete document has required fields
const incomplete:UserPreferences={theme:'dark'};void incomplete;
// @ts-expect-error canonical error code vocabulary is closed
const wrong:UserPreferencesErrorResponse={error:{code:'UNKNOWN_ERROR'}};void wrong;
// @ts-expect-error unsupported uncertainty vocabulary is rejected
const uncertainty:UserPreferencesErrorResponse={error:{code:'SETTINGS_COMMIT_UNKNOWN',outcome:'NOT_DISPATCHED'}};void uncertainty;
