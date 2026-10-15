/** Three synthetic tenants with unique sentinels. Nothing here is a real tenant, actor or client. */
import {createHash} from 'node:crypto';
import {syntheticPrincipal} from '../offline-targets/conversation-application.mjs';
const DEFINITIONS=Object.freeze([{tenantId:'tenant-alpha',tag:'a1fa'},{tenantId:'tenant-beta',tag:'be7a'},{tenantId:'tenant-gamma',tag:'6a3a'}]);
export const CASE_SEED='meri-isolation-2026-10-15';
export function syntheticTenants(seed=CASE_SEED){
 return DEFINITIONS.map(({tenantId,tag})=>{const nonce=createHash('sha256').update(`${seed}:${tenantId}`).digest('hex').slice(0,12);
  return Object.freeze({tenantId,tag,principal:syntheticPrincipal({tenantId,actorId:`actor-${tag}`,tag}),promptSentinel:`PROMPT-SENTINEL-${tag}-${nonce}`,artifactSentinel:`ARTIFACT-SENTINEL-${tag}-${nonce}`});});
}
/** Ordered attacker/victim pairs; every tenant attacks every other tenant. */
export const tenantPairs=tenants=>tenants.flatMap(attacker=>tenants.filter(victim=>victim!==attacker).map(victim=>({attacker,victim})));
