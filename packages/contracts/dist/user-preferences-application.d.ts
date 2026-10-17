// Generated from canonical schema by installed json-schema-to-ts and TypeScript. No authorization implied.
export type UserPreferences = { notifications: { runCompleted: boolean; approvalRequested: boolean; memoryReviewed: boolean; }; theme: "system" | "light" | "dark"; density: "compact" | "comfortable"; timezone: string | null; defaultClientId: string | null; };
export type UserPreferencesOwner = { tenantId: string; actorId: string; };
export type UserPreferencesReadRequest = {};
export type UserPreferencesSaveRequest = { expectedRevision: number; preferences: { notifications: { runCompleted: boolean; approvalRequested: boolean; memoryReviewed: boolean; }; theme: "system" | "light" | "dark"; density: "compact" | "comfortable"; timezone: string | null; defaultClientId: string | null; }; };
export type UserPreferencesResponse = { preferences: { notifications: { runCompleted: boolean; approvalRequested: boolean; memoryReviewed: boolean; }; theme: "system" | "light" | "dark"; density: "compact" | "comfortable"; timezone: string | null; defaultClientId: string | null; }; owner: { tenantId: string; actorId: string; }; revision: number; };
export type UserPreferencesErrorResponse = { error: { field?: string | undefined; outcome?: "UNKNOWN" | "RESULT_NOT_RELEASED" | undefined; code: "INVALID_REQUEST" | "UNAUTHENTICATED" | "ACCESS_DENIED" | "MEMBERSHIP_REVOKED" | "NOT_FOUND" | "METHOD_NOT_ALLOWED" | "DEADLINE" | "MEMBERSHIP_CHANGED" | "REQUEST_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE" | "CANCELLED" | "PRODUCT_UNAVAILABLE" | "SETTINGS_REQUEST_INVALID" | "SETTINGS_DOCUMENT_INVALID" | "SETTINGS_FIELD_INVALID" | "SETTINGS_CLIENT_REFUSED" | "SETTINGS_REVISION_CONFLICT" | "SETTINGS_STORE_UNAVAILABLE" | "SETTINGS_STORE_STATE" | "SETTINGS_COMMIT_UNKNOWN" | "SETTINGS_UNAVAILABLE" | "USER_PREFERENCES_UNAVAILABLE"; }; };

export type UserPreferencesRoute='read'|'save';
export interface UserPreferencesRequestMap {read:UserPreferencesReadRequest;save:UserPreferencesSaveRequest;}
export interface UserPreferencesExpectationMap {read:{owner:Readonly<UserPreferencesOwner>};save:{owner:Readonly<UserPreferencesOwner>;request:UserPreferencesSaveRequest};}
export declare class UserPreferencesResponseError extends Error {readonly code:string;}
export declare const userPreferencesVersion:'0.1.0';
export declare const userPreferencesPaths:Readonly<{"read":"/api/settings/user/read","save":"/api/settings/user/save"}>;
export declare const userPreferencesMetadata:{
  "contractVersion": "0.1.0",
  "schemaId": "urn:meri:user-preferences-application:0.1.0",
  "routes": {
    "read": {
      "method": "POST",
      "path": "/api/settings/user/read",
      "response": "json"
    },
    "save": {
      "method": "POST",
      "path": "/api/settings/user/save",
      "response": "json"
    }
  },
  "authentication": {
    "scheme": "Bearer",
    "expectedOwner": "independently current Core tenantId and actorId; never response owner or Clerk identity"
  },
  "limits": {
    "requestBytes": 8192,
    "responseBytes": 16384,
    "requestMs": 10000,
    "jsonDepth": 64,
    "jsonNodes": 100000
  },
  "errorStatuses": {
    "INVALID_REQUEST": 400,
    "UNAUTHENTICATED": 401,
    "ACCESS_DENIED": 403,
    "MEMBERSHIP_REVOKED": 403,
    "NOT_FOUND": 404,
    "METHOD_NOT_ALLOWED": 405,
    "DEADLINE": 408,
    "MEMBERSHIP_CHANGED": 409,
    "REQUEST_TOO_LARGE": 413,
    "UNSUPPORTED_MEDIA_TYPE": 415,
    "CANCELLED": 499,
    "PRODUCT_UNAVAILABLE": 502,
    "SETTINGS_REQUEST_INVALID": 400,
    "SETTINGS_DOCUMENT_INVALID": 400,
    "SETTINGS_FIELD_INVALID": 400,
    "SETTINGS_CLIENT_REFUSED": 403,
    "SETTINGS_REVISION_CONFLICT": 409,
    "SETTINGS_STORE_UNAVAILABLE": 503,
    "SETTINGS_STORE_STATE": 500,
    "SETTINGS_COMMIT_UNKNOWN": 503,
    "SETTINGS_UNAVAILABLE": 503,
    "USER_PREFERENCES_UNAVAILABLE": 503
  },
  "errorOutcomes": [
    "UNKNOWN",
    "RESULT_NOT_RELEASED"
  ],
  "semantics": {
    "document": "complete canonical user preferences; unknown fields refuse",
    "save": "captured expectedRevision plus one and exact captured document",
    "uncertainty": "UNKNOWN and RESULT_NOT_RELEASED require read-only reconciliation; never blind retry",
    "membership": "server owns current membership and default-client eligibility",
    "integration": "isolated source contract; runtime mounting and persistence qualification remain handoff work"
  }
};
export declare const USER_PREFERENCE_DEFAULTS:Readonly<UserPreferences>;
export declare const USER_PREFERENCE_THEMES:readonly ["system","light","dark"];
export declare const USER_PREFERENCE_DENSITIES:readonly ["comfortable","compact"];
export declare const USER_PREFERENCE_NOTIFICATIONS:readonly ["runCompleted","approvalRequested","memoryReviewed"];
export declare function receiveUserPreferencesRequest<R extends UserPreferencesRoute>(route:R,jsonText:unknown):Promise<UserPreferencesRequestMap[R]>;
export declare function receiveUserPreferencesResponse<R extends UserPreferencesRoute>(route:R,httpStatus:number,jsonText:unknown,expectation:UserPreferencesExpectationMap[R]):Promise<UserPreferencesResponse|UserPreferencesErrorResponse>;
