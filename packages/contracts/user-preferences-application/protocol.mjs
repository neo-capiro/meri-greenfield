/** Receiving metadata describes isolated source routes; it is not deployment or membership evidence. */
import {USER_PREFERENCES_SCHEMA_ID} from './schema.mjs';
export const userPreferencesVersion='0.1.0';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const createUserPreferencesMetadata=({paths,limits,errorStatuses,errorOutcomes})=>freeze({contractVersion:userPreferencesVersion,schemaId:USER_PREFERENCES_SCHEMA_ID,
 routes:Object.fromEntries(Object.entries(paths).map(([route,path])=>[route,{method:'POST',path,response:'json'}])),
 authentication:{scheme:'Bearer',expectedOwner:'independently current Core tenantId and actorId; never response owner or Clerk identity'},
 limits:{requestBytes:limits.maxRequestBytes,responseBytes:limits.maxResponseBytes,requestMs:limits.maxRequestMs,jsonDepth:64,jsonNodes:100000},errorStatuses,errorOutcomes,
 semantics:{document:'complete canonical user preferences; unknown fields refuse',save:'captured expectedRevision plus one and exact captured document',uncertainty:'UNKNOWN and RESULT_NOT_RELEASED require read-only reconciliation; never blind retry',membership:'server owns current membership and default-client eligibility',integration:'isolated source contract; runtime mounting and persistence qualification remain handoff work'}});
