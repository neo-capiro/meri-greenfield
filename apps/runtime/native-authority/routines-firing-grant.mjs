/** Meri's verifier for Core's UNATTENDED routine firing grant (wire C, D016-A item 5). The grant is Core's per-check proof that
 * the routine owner's signed-in approval (the consent, ≤ 30 days, renewable only by a live login) still stands for exactly this
 * schedule generation and occurrence, with the owner's current membership and scopes. Core issues it to Meri's schedule service
 * under the service identity alone (no user session: the owner is not present), and refuses once the owner pauses or deletes the
 * routine, loses membership, or the client/scope wall changes. Meri re-checks the schedule's own state and generation beside it
 * (routines-firing-authority.mjs), so the grant is a ceiling on authority, never a substitute for the schedule owner's fence.
 *
 * Shape (the Meri consumer's contract for Core's route, proposed; Core's route does not exist at 32cf3ca7):
 *  - EdDSA compact JWS, header `{"alg":"EdDSA","typ":"capiro-meri-routine-fire+jwt","kid":<pinned kid>}`, pinned issuer, aud
 *    `meri-schedule-firing`, iat = nbf ≤ now < exp, exp − iat ≤ 30 s (one check lease; Meri's request bound), jti UUIDv4;
 *  - `fire: {tenantId, ownerActorId, scheduleId, generation, intentSha256, projectionSha256, occurrenceKey, phase, scopes,
 *    membershipRevision, consentId, consentIssuedAtS, consentExpiresAtS, limits:{maxCostMicrousd,maxRuntimeSeconds,retryLimit}}`
 *    with consentExpiresAtS − consentIssuedAtS ≤ 30 days and exp ≤ consentExpiresAtS.
 * The firing purpose pins its own key and kid, never the cancellation proof's. */
import {record,routineTrust,verifyRoutineJws} from './routines-cancellation-proof.mjs';
import {exactMatch} from './routines-configuration.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';

export const ROUTINE_FIRE_TOKEN_TYPE='capiro-meri-routine-fire+jwt';
export const ROUTINE_FIRE_AUDIENCE='meri-schedule-firing';
export const ROUTINE_FIRE_MAX_TTL_SECONDS=30;
/** D016-A item 5: the signed-in consent lasts at most 30 days. */
export const ROUTINE_CONSENT_MAX_SECONDS=30*86400;
/** The phases a grant may be issued for: the dispatch owner's two, and the unattended stop of an occurrence's own run. */
export const ROUTINE_FIRE_PHASES=Object.freeze(['before_admission','before_start','before_stop']);
const LIMIT_KEYS=['maxCostMicrousd','maxRuntimeSeconds','retryLimit'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,HEX64=/^[a-f0-9]{64}$/u;
const text=(value,max)=>typeof value==='string'&&value.length>=1&&value.length<=max,seconds=value=>Number.isSafeInteger(value)&&value>=0;
const fault=()=>Object.assign(Error('ROUTINE_FIRING_GRANT_REFUSED'),{code:'ROUTINE_FIRING_GRANT_REFUSED'});
const refuse=()=>{throw fault();};

/** The pinned trust record from configuration `routines.core.unattendedGrant`. */
export const routineFiringTrust=pin=>routineTrust(pin,ROUTINE_FIRE_TOKEN_TYPE);
function fireClaims(raw){
 const c=record(raw,['tenantId','ownerActorId','scheduleId','generation','intentSha256','projectionSha256','occurrenceKey','phase','scopes','membershipRevision','consentId','consentIssuedAtS','consentExpiresAtS','limits']);
 if(!text(c.tenantId,256)||!text(c.ownerActorId,256)||!exactMatch(UUID,c.scheduleId)||!Number.isSafeInteger(c.generation)||c.generation<1||!exactMatch(HEX64,c.intentSha256)||
  !exactMatch(HEX64,c.projectionSha256)||!exactMatch(HEX64,c.occurrenceKey)||!ROUTINE_FIRE_PHASES.includes(c.phase)||!text(c.membershipRevision,256)||!exactMatch(UUID,c.consentId)||
  !seconds(c.consentIssuedAtS)||!seconds(c.consentExpiresAtS)||c.consentExpiresAtS<=c.consentIssuedAtS||c.consentExpiresAtS-c.consentIssuedAtS>ROUTINE_CONSENT_MAX_SECONDS)refuse();
 if(!Array.isArray(c.scopes)||c.scopes.length<1||c.scopes.length>100)refuse();
 for(const scope of c.scopes){validateShape('Scope',scope);if(scope.tenantId!==c.tenantId)refuse();}
 if(new Set(c.scopes.map(hash)).size!==c.scopes.length||new Set(c.scopes.map(s=>s.policyRevision)).size!==1)refuse();
 const l=record(c.limits,LIMIT_KEYS);if(LIMIT_KEYS.some(key=>!Number.isSafeInteger(l[key])||l[key]<(key==='retryLimit'?0:1)))refuse();
 return c;
}
/** Returns deep-frozen `{issuer, kid, jti, iat, exp, claims, proofSha256}` or throws ROUTINE_FIRING_GRANT_REFUSED. The grant's own
 * window must also sit inside its consent (exp ≤ consentExpiresAtS). */
export function verifyRoutineFiringGrant(token,{trust,nowMs}={}){
 const v=verifyRoutineJws(token,{trust,nowMs,typ:ROUTINE_FIRE_TOKEN_TYPE,aud:ROUTINE_FIRE_AUDIENCE,maxTtlSeconds:ROUTINE_FIRE_MAX_TTL_SECONDS,claimsKey:'fire',parseClaims:fireClaims,fault});
 if(v.exp>v.claims.consentExpiresAtS)refuse();return v;
}
