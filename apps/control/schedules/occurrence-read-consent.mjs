/** Current local consent facts for one persisted, dispatched occurrence. Core owns and rechecks the consent itself; this
 * mapper only joins Meri's last recorded reference to the immutable occurrence and current schedule projection. */
import {canonicalSha256,frozenScheduleData,denySchedule} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const SHA=/^[a-f0-9]{64}$/u;
const CONSENT_KEYS=['consentId','state','createdAtMs','expiresAtMs','scheduleProjectionSha256','operationsDigest'];
const CONSENT_STATES=['active','paused','revoked'];
const refuse=()=>denySchedule('SCHEDULE_READ_CONSENT');

export function storedReadConsent(value){
 if(value===null||value===undefined)refuse();
 const r=frozenScheduleData(value);
 if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==CONSENT_KEYS.length||CONSENT_KEYS.some(key=>!Object.hasOwn(r,key))||
   !UUID.test(r.consentId)||!CONSENT_STATES.includes(r.state)||!Number.isSafeInteger(r.createdAtMs)||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=r.createdAtMs||
   !SHA.test(r.scheduleProjectionSha256)||!SHA.test(r.operationsDigest))refuse();
 return r;
}

function occurrenceStart(value){
 // pg returns timestamptz as Date. Accept an exact ISO string as well for alternate pg parsers and synthetic stores.
 const startedAtMs=value instanceof Date?Date.prototype.getTime.call(value):
  typeof value==='string'&&Number.isSafeInteger(Date.parse(value))&&new Date(value).toISOString()===value?Date.parse(value):NaN;
 if(!Number.isSafeInteger(startedAtMs))refuse();
 return startedAtMs;
}

/** `record` has already passed the occurrence owner's digest and derived-binding checks. The joined projection must still be
 * the very projection that was approved for this occurrence; an absent or changed row is a refusal, never attended fallback. */
export function occurrenceReadConsentFacts(record,row){
 const {occurrence,effect}=record,projection=occurrence.projection,binding=effect.binding;
 if(record.state!=='DISPATCHED'||row.current_tenant_id!==binding.tenantId||row.current_schedule_id!==record.scheduleId||
   row.current_owner_actor_id!==binding.actorId||Number(row.current_generation)!==occurrence.generation||
   row.current_active_intent!==null||!row.current_projection||typeof row.current_projection!=='object'||Array.isArray(row.current_projection)||
   row.current_projection_sha256!==canonicalSha256(row.current_projection)||
   row.current_projection_sha256!==canonicalSha256(projection)||row.current_projection.state!=='active')refuse();
 const consent=storedReadConsent(row.read_consent),scopes=projection.scopes;
 if(consent.state!=='active'||consent.scheduleProjectionSha256!==row.current_projection_sha256||
   !Array.isArray(scopes)||scopes.length!==1||scopes[0].kind!=='client'||scopes[0].tenantId!==binding.tenantId||
   !UUID.test(scopes[0].resourceId)||!SHA.test(scopes[0].policyRevision))refuse();
 return frozenScheduleData({consentId:consent.consentId,consentState:consent.state,
  consentExpiresAtMs:consent.expiresAtMs,consentCreatedAtMs:consent.createdAtMs,
  scheduleId:record.scheduleId,occurrenceKey:record.occurrenceKey,startedAtMs:occurrenceStart(row.created_at),
  clientId:scopes[0].resourceId,operationsDigest:consent.operationsDigest,policyRevision:scopes[0].policyRevision,
  runBinding:binding});
}
