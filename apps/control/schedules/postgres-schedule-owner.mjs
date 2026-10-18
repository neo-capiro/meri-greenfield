import {canonicalSha256, frozenScheduleData, denySchedule,scheduleErrorCode} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {snapshotScheduledJobSelection} from './scheduled-job-lineage.mjs';

// Borrow a pg 8.23.1-compatible pool configured by its owner with finite
// connectionTimeoutMillis/query_timeout. Source cancellation is not wire cancellation.
export function createPostgresScheduleOwner({pool}) {
  if(!pool||typeof pool.connect!=='function')denySchedule('SCHEDULE_POOL');
  async function transaction(body,check) {
    let client,begun=false,committing=false,reusable=false,result,failure;
    try {
      check();client=await pool.connect();check();await client.query('BEGIN');begun=true;check();
      await client.query("SET LOCAL statement_timeout = '5s'");check();
      await client.query("SET LOCAL lock_timeout = '2s'");check();
      result=await body(client);check();committing=true;await client.query('COMMIT');reusable=true;check();
    } catch(error) {
      failure=Object.assign(new Error(committing?'SCHEDULE_COMMIT_UNKNOWN':'SCHEDULE_STORE_UNAVAILABLE'),{code:committing?'SCHEDULE_COMMIT_UNKNOWN':scheduleErrorCode(error)??'SCHEDULE_STORE_UNAVAILABLE'});
      if(begun&&!committing)try{await client.query('ROLLBACK');reusable=true;}catch{}
    } finally {
      if(client)try{client.release(reusable?undefined:failure);}catch{failure??=Object.assign(new Error('SCHEDULE_RELEASE_UNKNOWN'),{code:'SCHEDULE_RELEASE_UNKNOWN'});}
    }
    if(failure)throw failure;return result;
  }
  async function claim(binding,check) {
    const b=frozenScheduleData(binding),i=b.intent,p=i.projection,t=p.owner.tenantId;
    return transaction(async c=>{
      // Transaction advisory lock also serializes concurrent creation of a missing row.
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${t}:${p.scheduleId}`]);check();
      if((await c.query('SELECT intent_id FROM meri_schedules.intents WHERE tenant_id=$1 AND intent_id=$2',[t,i.intentId])).rows.length)denySchedule('SCHEDULE_REPLAY');check();
      const old=(await c.query('SELECT * FROM meri_schedules.projections WHERE tenant_id=$1 AND schedule_id=$2 FOR UPDATE',[t,p.scheduleId])).rows[0];check();
      if(i.operation==='schedule_task') {
        if(old)denySchedule('SCHEDULE_EXISTS');
        await c.query('INSERT INTO meri_schedules.projections(tenant_id,schedule_id,temporal_schedule_id,owner_actor_id,generation,projection,projection_sha256,active_intent) VALUES($1,$2,$3,$4,0,$5,$6,$7)',[t,p.scheduleId,p.temporalScheduleId,p.owner.actorId,p,canonicalSha256(p),i.intentId]);check();
      } else {
        if(!old||old.active_intent!==null||Number(old.generation)!==i.expectedGeneration||old.projection_sha256!==i.previousProjectionSha256||old.temporal_schedule_id!==p.temporalScheduleId||old.owner_actor_id!==p.owner.actorId||old.projection.createdAt!==p.createdAt)denySchedule('SCHEDULE_STALE');
        await c.query('UPDATE meri_schedules.projections SET active_intent=$3 WHERE tenant_id=$1 AND schedule_id=$2',[t,p.scheduleId,i.intentId]);check();
      }
      await c.query("INSERT INTO meri_schedules.intents(tenant_id,intent_id,schedule_id,intent_sha256,binding_sha256,intent,state) VALUES($1,$2,$3,$4,$5,$6,'CLAIMED')",[t,i.intentId,p.scheduleId,canonicalSha256(i),b.bindingSha256,i]);check();
      return {intentId:i.intentId,bindingSha256:b.bindingSha256,state:'CLAIMED'};
    },check);
  }
  async function transition(binding,state,check) {
    const b=frozenScheduleData(binding),i=b.intent,t=i.projection.owner.tenantId;
    return transaction(async c=>{
      const row=(await c.query('SELECT * FROM meri_schedules.intents WHERE tenant_id=$1 AND intent_id=$2 FOR UPDATE',[t,i.intentId])).rows[0];check();
      if(!row||row.binding_sha256!==b.bindingSha256||row.intent_sha256!==canonicalSha256(i)||!(state==='DISPATCHING'?['CLAIMED']:['DISPATCHING']).includes(row.state))denySchedule('SCHEDULE_TRANSITION');
      await c.query('UPDATE meri_schedules.intents SET state=$3,updated_at=clock_timestamp() WHERE tenant_id=$1 AND intent_id=$2',[t,i.intentId,state]);check();
      if(state==='ACKNOWLEDGED')await acknowledgeProjection(c,i,check);
      return {intentId:i.intentId,bindingSha256:b.bindingSha256,state};
    },check);
  }
  async function acknowledgeProjection(c,i,check) {
    const p=i.projection,changed=await c.query('UPDATE meri_schedules.projections SET generation=$4,projection=$5,projection_sha256=$6,active_intent=NULL WHERE tenant_id=$1 AND schedule_id=$2 AND active_intent=$3 AND generation=$7',[p.owner.tenantId,p.scheduleId,i.intentId,i.generation,p,canonicalSha256(p),i.expectedGeneration]);check();
    if(changed.rowCount!==1)denySchedule('SCHEDULE_STALE');
  }
  function storedIntent(row) {
    if(!row||canonicalSha256(row.intent)!==row.intent_sha256||row.intent.intentId!==row.intent_id||!['CLAIMED','DISPATCHING','ACKNOWLEDGED','UNKNOWN'].includes(row.state))denySchedule('SCHEDULE_CORRUPT');
    return row;
  }
  /** Firing facts for one schedule: its current projection/generation, any unresolved intent, and the acknowledged intent that
   * produced the current generation (its configuration names the task and its instruction digest). Read only; no authority. */
  async function readFiring(selection,check) {
    const s=frozenScheduleData(selection);
    return transaction(async c=>{
      const rows=(await c.query("SELECT p.projection,p.projection_sha256,p.generation,p.active_intent,i.intent_id,i.intent,i.intent_sha256,i.state FROM meri_schedules.projections p LEFT JOIN meri_schedules.intents i ON i.tenant_id=p.tenant_id AND i.schedule_id=p.schedule_id AND i.state='ACKNOWLEDGED' AND (i.intent->>'generation')::bigint=p.generation WHERE p.tenant_id=$1 AND p.schedule_id=$2",[s.tenantId,s.scheduleId])).rows;check();
      if(!rows.length)return null;
      const r=rows[0],generation=Number(r.generation);
      if(rows.length!==1||canonicalSha256(r.projection)!==r.projection_sha256||r.projection.scheduleId!==s.scheduleId||r.projection.owner.tenantId!==s.tenantId||!Number.isSafeInteger(generation))denySchedule('SCHEDULE_CORRUPT');
      if(r.intent_id!==null&&(storedIntent(r).intent.generation!==generation||canonicalSha256(r.intent.projection)!==r.projection_sha256))denySchedule('SCHEDULE_CORRUPT');
      return frozenScheduleData({projection:r.projection,generation,activeIntent:r.active_intent,intent:r.intent_id===null?null:r.intent});
    },check);
  }
  async function readIntent(selection,check) {
    const s=frozenScheduleData(selection);
    return transaction(async c=>{
      const row=(await c.query('SELECT intent_id,intent,intent_sha256,state FROM meri_schedules.intents WHERE tenant_id=$1 AND intent_id=$2',[s.tenantId,s.intentId])).rows[0];check();
      if(!row)return null;storedIntent(row);
      if(row.intent.projection.owner.tenantId!==s.tenantId)denySchedule('SCHEDULE_CORRUPT');
      return frozenScheduleData({intent:row.intent,intentSha256:row.intent_sha256,state:row.state});
    },check);
  }
  /** Reconciliation records provider evidence that a dispatched or uncertain intent's exact effect is present. CLAIMED never
   * dispatched and is refused here; the generation/projection fence is the same one commitKnown uses. */
  async function acknowledgeReconciled(selection,check) {
    const s=frozenScheduleData(selection);
    return transaction(async c=>{
      const row=(await c.query('SELECT intent_id,intent,intent_sha256,state FROM meri_schedules.intents WHERE tenant_id=$1 AND intent_id=$2 FOR UPDATE',[s.tenantId,s.intentId])).rows[0];check();
      if(!row||storedIntent(row).intent_sha256!==s.intentSha256||!['DISPATCHING','UNKNOWN'].includes(row.state))denySchedule('SCHEDULE_TRANSITION');
      await c.query("UPDATE meri_schedules.intents SET state='ACKNOWLEDGED',updated_at=clock_timestamp() WHERE tenant_id=$1 AND intent_id=$2",[s.tenantId,s.intentId]);check();
      await acknowledgeProjection(c,row.intent,check);
      return {intentId:s.intentId,state:'ACKNOWLEDGED'};
    },check);
  }
  /** Durable occurrence barrier (proposed table meri_schedules.occurrences, migration request P-R4-1): one row per scheduled
   * occurrence, written before its first effect, binds the occurrence to the exact conversation run and native workflow it may
   * issue. While any occurrence of a schedule is OPEN, no other occurrence of that schedule may open; this outlives the dispatch
   * workflow's run timeout. Only the dispatch's own evidence settles a row (DISPATCHED: its run's start observed; REFUSED). */
  const OCCURRENCE_COLUMNS='SELECT occurrence_key,schedule_id,occurrence,effect,effect_sha256,state FROM meri_schedules.occurrences';
  function storedOccurrence(row) {
    if(!row||canonicalSha256(row.effect)!==row.effect_sha256||!['OPEN','DISPATCHED','REFUSED'].includes(row.state))denySchedule('SCHEDULE_CORRUPT');
    return frozenScheduleData({occurrenceKey:row.occurrence_key,scheduleId:row.schedule_id,occurrence:row.occurrence,effect:row.effect,effectSha256:row.effect_sha256,state:row.state});
  }
  function originOccurrence(row,tenantId) {
    const record=storedOccurrence(row),{occurrence,effect,identity}=snapshotScheduledJobSelection({occurrence:record.occurrence,effect:record.effect});
    if(row.tenant_id!==tenantId||Number(row.generation)!==occurrence.generation||record.scheduleId!==occurrence.projection.scheduleId||
      record.occurrenceKey!==identity.occurrenceKey||effect.binding.tenantId!==tenantId)denySchedule('SCHEDULE_CORRUPT');
    return frozenScheduleData({...record,occurrence,effect});
  }
  /** Positive local conversation-origin proof. Absence is distinct from corrupt/ambiguous custody; neither a UUID pattern nor
   * failure of another authority source establishes scheduled origin. No current projection join: historical output survives
   * later schedule updates/cancellation, subject to the reader's current native membership and client wall. */
  async function readOccurrenceForConversation(selection,check) {
    const s=frozenScheduleData(selection);
    if(!s||Object.keys(s).length!==2||typeof s.tenantId!=='string'||!s.tenantId||s.tenantId.length>128||
      typeof s.conversationId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(s.conversationId))denySchedule('SCHEDULE_OCCURRENCE');
    return transaction(async c=>{
      const rows=(await c.query("SELECT tenant_id,generation,occurrence_key,schedule_id,occurrence,effect,effect_sha256,state FROM meri_schedules.occurrences WHERE tenant_id=$1 AND effect->'binding'->>'conversationId'=$2 LIMIT 2",[s.tenantId,s.conversationId])).rows;check();
      if(!Array.isArray(rows)||rows.length>1)denySchedule('SCHEDULE_CORRUPT');
      if(!rows.length)return null;
      const record=originOccurrence(rows[0],s.tenantId);
      if(record.effect.binding.conversationId!==s.conversationId)denySchedule('SCHEDULE_CORRUPT');
      return record;
    },check);
  }
  /** Same immutable custody facet for cancellation of the one OPEN occurrence; no mutation or current generation inference. */
  async function readOpenOccurrenceForSchedule(selection,check) {
    const s=frozenScheduleData(selection);
    if(!s||Object.keys(s).length!==2||typeof s.tenantId!=='string'||!s.tenantId||s.tenantId.length>128||
      typeof s.scheduleId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(s.scheduleId))denySchedule('SCHEDULE_OCCURRENCE');
    return transaction(async c=>{
      const rows=(await c.query("SELECT tenant_id,generation,occurrence_key,schedule_id,occurrence,effect,effect_sha256,state FROM meri_schedules.occurrences WHERE tenant_id=$1 AND schedule_id=$2 AND state='OPEN' LIMIT 2",[s.tenantId,s.scheduleId])).rows;check();
      if(!Array.isArray(rows)||rows.length>1)denySchedule('SCHEDULE_CORRUPT');
      if(!rows.length)return null;
      const record=originOccurrence(rows[0],s.tenantId);
      if(record.scheduleId!==s.scheduleId||record.state!=='OPEN')denySchedule('SCHEDULE_CORRUPT');
      return record;
    },check);
  }
  async function openOccurrence(record,check) {
    const r=frozenScheduleData(record),effectSha256=canonicalSha256(r.effect);
    return transaction(async c=>{
      // The same transaction lock as intent claims for this schedule serializes concurrent openers.
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${r.tenantId}:${r.scheduleId}`]);check();
      const same=(await c.query(`${OCCURRENCE_COLUMNS} WHERE tenant_id=$1 AND occurrence_key=$2 FOR UPDATE`,[r.tenantId,r.occurrenceKey])).rows[0];check();
      if(same){const o=storedOccurrence(same);if(o.scheduleId!==r.scheduleId||o.effectSha256!==effectSha256)denySchedule('SCHEDULE_OCCURRENCE_CONFLICT');return frozenScheduleData({state:o.state,blocking:null});}
      const open=(await c.query(`${OCCURRENCE_COLUMNS} WHERE tenant_id=$1 AND schedule_id=$2 AND state='OPEN' LIMIT 1`,[r.tenantId,r.scheduleId])).rows[0];check();
      if(open)return frozenScheduleData({state:'BLOCKED',blocking:storedOccurrence(open)});
      await c.query("INSERT INTO meri_schedules.occurrences(tenant_id,occurrence_key,schedule_id,generation,occurrence,effect,effect_sha256,state) VALUES($1,$2,$3,$4,$5,$6,$7,'OPEN')",[r.tenantId,r.occurrenceKey,r.scheduleId,r.generation,r.occurrence,r.effect,effectSha256]);check();
      return frozenScheduleData({state:'OPEN',blocking:null});
    },check);
  }
  // OPEN settles to DISPATCHED or REFUSED; a refused occurrence whose run is later observed started becomes DISPATCHED. Nothing
  // reopens. A missing row (no barrier was ever written) is reported, not created.
  async function settleOccurrence(selection,check) {
    const s=frozenScheduleData(selection);
    if(!['DISPATCHED','REFUSED'].includes(s.state))denySchedule('SCHEDULE_TRANSITION');
    return transaction(async c=>{
      const row=(await c.query(`${OCCURRENCE_COLUMNS} WHERE tenant_id=$1 AND occurrence_key=$2 FOR UPDATE`,[s.tenantId,s.occurrenceKey])).rows[0];check();
      if(!row)return frozenScheduleData({state:'ABSENT'});
      const o=storedOccurrence(row);
      if(o.effectSha256!==s.effectSha256)denySchedule('SCHEDULE_OCCURRENCE_CONFLICT');
      if(o.state===s.state)return frozenScheduleData({state:o.state});
      if(o.state!=='OPEN'&&!(o.state==='REFUSED'&&s.state==='DISPATCHED'))denySchedule('SCHEDULE_TRANSITION');
      await c.query('UPDATE meri_schedules.occurrences SET state=$3,updated_at=clock_timestamp() WHERE tenant_id=$1 AND occurrence_key=$2',[s.tenantId,s.occurrenceKey,s.state]);check();
      return frozenScheduleData({state:s.state});
    },check);
  }
  async function list(selection,check) {
    const s=frozenScheduleData(selection);
    return transaction(async c=>{
      const rows=(await c.query('SELECT projection,generation,active_intent FROM meri_schedules.projections WHERE tenant_id=$1 AND owner_actor_id=$2 AND ($3::uuid IS NULL OR schedule_id>$3::uuid) ORDER BY schedule_id LIMIT $4',[s.owner.tenantId,s.owner.actorId,s.afterScheduleId,s.limit+1])).rows;check();
      return frozenScheduleData({rows:rows.slice(0,s.limit).map(r=>({projection:r.projection,generation:Number(r.generation),unresolved:r.active_intent!==null})),hasMore:rows.length>s.limit});
    },check);
  }
  /** Option B read consent reference (lane RD, migration 0004): the consent Core holds for this schedule's reads, as Meri last saw
   * it, beside the projection digest it was approved for. A reference and a state only: never authority, never a credential. */
  const READ_CONSENT_STATES=['active','paused','revoked'],READ_CONSENT_KEYS=['consentId','state','createdAtMs','expiresAtMs','scheduleProjectionSha256','operationsDigest'];
  const uuidText=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,shaText=/^[a-f0-9]{64}$/u;
  function storedReadConsent(value) {
    const r=frozenScheduleData(value);
    if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==READ_CONSENT_KEYS.length||READ_CONSENT_KEYS.some(key=>!Object.hasOwn(r,key))||
      !uuidText.test(r.consentId)||!READ_CONSENT_STATES.includes(r.state)||!Number.isSafeInteger(r.createdAtMs)||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=r.createdAtMs||
      !shaText.test(r.scheduleProjectionSha256)||!shaText.test(r.operationsDigest))denySchedule('SCHEDULE_READ_CONSENT');
    return r;
  }
  async function readReadConsent(selection,check) {
    const s=frozenScheduleData(selection);
    if(typeof s?.tenantId!=='string'||!s.tenantId||!uuidText.test(s.scheduleId??''))denySchedule('SCHEDULE_READ_CONSENT');
    return transaction(async c=>{
      const row=(await c.query('SELECT read_consent FROM meri_schedules.projections WHERE tenant_id=$1 AND schedule_id=$2',[s.tenantId,s.scheduleId])).rows[0];check();
      if(!row||row.read_consent===null||row.read_consent===undefined)return null;
      return storedReadConsent(row.read_consent);
    },check);
  }
  /** Recorded against the acknowledged generation only (the same fence commitKnown used); a stale write is refused. */
  async function recordReadConsent(selection,check) {
    const s=frozenScheduleData(selection),consent=storedReadConsent(s.consent);
    if(typeof s.tenantId!=='string'||!s.tenantId||!uuidText.test(s.scheduleId??'')||!Number.isSafeInteger(s.generation)||s.generation<1)denySchedule('SCHEDULE_READ_CONSENT');
    return transaction(async c=>{
      const changed=await c.query('UPDATE meri_schedules.projections SET read_consent=$4 WHERE tenant_id=$1 AND schedule_id=$2 AND generation=$3',[s.tenantId,s.scheduleId,s.generation,consent]);check();
      if(changed.rowCount!==1)denySchedule('SCHEDULE_STALE');
      return frozenScheduleData({scheduleId:s.scheduleId,generation:s.generation,consentId:consent.consentId,state:consent.state});
    },check);
  }
  return Object.freeze({claim,markDispatching:(b,c)=>transition(b,'DISPATCHING',c),commitKnown:(b,c)=>transition(b,'ACKNOWLEDGED',c),markUnknown:(b,c)=>transition(b,'UNKNOWN',c),list,readFiring,readIntent,acknowledgeReconciled,openOccurrence,settleOccurrence,readOccurrenceForConversation,readOpenOccurrenceForSchedule,readReadConsent,recordReadConsent});
}
