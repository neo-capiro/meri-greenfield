/**
 * MB-05 durable source-event owner: additive storage over the schedule schema for the approved
 * binding and for inbound event acceptance/dedup/causal lineage.
 *
 * This store borrows a pool exactly like the schedule owner (pg-compatible, finite
 * connectionTimeoutMillis/query_timeout, caller-owned). It is NOT an effect journal and NOT an
 * authority grant: the existing intent/occurrence/Temporal owners remain the sole dispatch
 * authority. Only metadata and hashes are retained — the event payload content is never stored.
 */
import {snapshotOperationData} from '../../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {refuse} from './source-event-contract.mjs';

const HEX64 = /^[a-f0-9]{64}$/u;
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/u;
const RETRYABLE = Object.freeze(['ACCEPTED', 'QUEUED']);
const STATES = Object.freeze(['ACCEPTED', 'QUEUED', 'DISPATCHED', 'SKIPPED', 'REFUSED', 'UNKNOWN']);
const frozen = value => {
  const snapshot = snapshotOperationData(value);
  const walk = node => {
    if (node && typeof node === 'object') { Object.values(node).forEach(walk); Object.freeze(node); }
    return node;
  };
  return walk(snapshot);
};
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('\u0000');
const hex64 = value => typeof value === 'string' && HEX64.test(value);

function storedBinding(row) {
  if (!row) return null;
  const generation = Number(row.generation);
  if (!text(row.schedule_id, 64) || !Number.isSafeInteger(generation) || generation < 1 || !hex64(row.intent_sha256) ||
      !hex64(row.projection_sha256) || !text(row.temporal_schedule_id, 256) || !text(row.owner_actor_id, 256) ||
      !row.task || typeof row.task !== 'object' || !Array.isArray(row.scopes))
    refuse('SOURCE_EVENT_CORRUPT');
  return frozen({
    scheduleId: row.schedule_id, generation, intentSha256: row.intent_sha256, projectionSha256: row.projection_sha256,
    temporalScheduleId: row.temporal_schedule_id, ownerActorId: row.owner_actor_id,
    task: {taskId: row.task.taskId, manifestSha256: row.task.manifestSha256, version: Number(row.task.version)},
    scopes: row.scopes,
  });
}

/** Pair lock precedes routine row locks on every event claim/ACK/recovery path. */
export async function lockSourceEventBinding(c, b, check) {
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${b.tenantId}:${b.producer}:${b.sourceFamily}:${b.resourceKey}`]); check();
}

/** Insert through the caller-owned transaction so schedule ACK and producer lookup commit together. */
export async function bindSourceEventInTransaction(c, record, check) {
  const b = frozen(record);
  if (!text(b.tenantId, 256) || !text(b.scheduleId, 64) || !Number.isSafeInteger(b.generation) || b.generation < 1 ||
      !hex64(b.intentSha256) || !hex64(b.projectionSha256) || !text(b.temporalScheduleId, 256) || !text(b.ownerActorId, 256) ||
      !text(b.producer, 128) || !text(b.sourceFamily, 32) || !text(b.resourceKey, 256) ||
      !b.task || typeof b.task !== 'object' || !text(b.task.taskId, 64) || !hex64(b.task.manifestSha256) ||
      !Number.isSafeInteger(b.task.version) || !Array.isArray(b.scopes))
    refuse('SOURCE_EVENT_INVALID');
  await lockSourceEventBinding(c, b, check);
  const inserted = await c.query('INSERT INTO meri_schedules.source_event_bindings(tenant_id,schedule_id,generation,intent_sha256,projection_sha256,temporal_schedule_id,owner_actor_id,producer,source_family,resource_key,task,scopes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (tenant_id,producer,source_family,resource_key,schedule_id,generation) DO NOTHING',
    // scopes is a jsonb column: the ordinary pg driver renders a JS array as a Postgres array
    // literal, which that column refuses (22P02). Bind JSON text, as the owner's projection
    // scopes parameter already does.
    [b.tenantId, b.scheduleId, b.generation, b.intentSha256, b.projectionSha256, b.temporalScheduleId, b.ownerActorId, b.producer, b.sourceFamily, b.resourceKey, b.task, JSON.stringify(b.scopes)]); check();
  // Read back the EXACT acknowledged generation: that row is this bind's acceptance evidence.
  // A later generation appends its own row (never a widening); the same generation with
  // different bytes is the conflict.
  // The pair advisory serializes insert/readback; the immutable trigger prevents row changes.
  // A row lock would unnecessarily require UPDATE privilege on this insert-only table.
  const row = storedBinding((await c.query('SELECT schedule_id,generation,intent_sha256,projection_sha256,temporal_schedule_id,owner_actor_id,task,scopes FROM meri_schedules.source_event_bindings WHERE tenant_id=$1 AND producer=$2 AND source_family=$3 AND resource_key=$4 AND generation=$5 AND schedule_id=$6',
    [b.tenantId, b.producer, b.sourceFamily, b.resourceKey, b.generation, b.scheduleId])).rows[0]); check();
  if (!row) refuse('SOURCE_EVENT_BINDING_ABSENT');
  if (inserted.rowCount !== 1 && canonicalSha256(row) !== canonicalSha256({
    scheduleId: b.scheduleId, generation: b.generation, intentSha256: b.intentSha256, projectionSha256: b.projectionSha256,
    temporalScheduleId: b.temporalScheduleId, ownerActorId: b.ownerActorId, task: b.task, scopes: b.scopes,
  })) refuse('SOURCE_EVENT_BINDING_CONFLICT');
  return Object.freeze({created: inserted.rowCount === 1, binding: row});
}

/** Same borrowed-pool transaction discipline as the schedule owner; no client is retained. */
export function createPostgresSourceEventStore({pool}) {
  if (!pool || typeof pool.connect !== 'function') refuse('SOURCE_EVENT_STORE_UNAVAILABLE');
  async function transaction(body, check) {
    let client, begun = false, committing = false, reusable = false, result, failure;
    try {
      check(); client = await pool.connect(); check(); await client.query('BEGIN'); begun = true; check();
      await client.query("SET LOCAL statement_timeout = '5s'"); check();
      await client.query("SET LOCAL lock_timeout = '2s'"); check();
      result = await body(client); check(); committing = true; await client.query('COMMIT'); reusable = true; check();
    } catch (error) {
      failure = Object.assign(new Error(committing ? 'SOURCE_EVENT_COMMIT_UNKNOWN' : 'SOURCE_EVENT_STORE_UNAVAILABLE'), {
        code: committing ? 'SOURCE_EVENT_COMMIT_UNKNOWN' : (typeof error?.code === 'string' && /^SOURCE_EVENT_[A-Z_]{1,48}$/u.test(error.code) ? error.code : 'SOURCE_EVENT_STORE_UNAVAILABLE'),
      });
      if (begun && !committing) try { await client.query('ROLLBACK'); reusable = true; } catch {}
    } finally {
      if (client) try { client.release(reusable ? undefined : failure); } catch { failure ??= Object.assign(new Error('SOURCE_EVENT_RELEASE_UNKNOWN'), {code: 'SOURCE_EVENT_RELEASE_UNKNOWN'}); }
    }
    if (failure) throw failure;
    return result;
  }

  function selection(value) {
    if (!value || typeof value !== 'object') refuse('SOURCE_EVENT_INVALID');
    const s = snapshotOperationData(value);
    if (!text(s.tenantId, 256) || !text(s.producer, 128) || !text(s.eventId, 64)) refuse('SOURCE_EVENT_INVALID');
    return s;
  }

  /** Store an exact approved binding through the same insert primitive used by schedule ACK. */
  async function bind(record, check) {
    return transaction(c => bindSourceEventInTransaction(c, record, check), check);
  }

  /** Every append-only binding row for the pair, newest generation first. The caller confirms
   *  which one is the schedule's CURRENT acknowledged generation through the canonical owner. */
  async function readBinding(value, check) {
    const s = frozen(value);
    if (!text(s.tenantId, 256) || !text(s.producer, 128) || !text(s.sourceFamily, 32) || !text(s.resourceKey, 256)) refuse('SOURCE_EVENT_INVALID');
    return transaction(async c => (await c.query('SELECT schedule_id,generation,intent_sha256,projection_sha256,temporal_schedule_id,owner_actor_id,task,scopes FROM meri_schedules.source_event_bindings WHERE tenant_id=$1 AND producer=$2 AND source_family=$3 AND resource_key=$4 ORDER BY generation DESC, created_at DESC',
      [s.tenantId, s.producer, s.sourceFamily, s.resourceKey])).rows.map(storedBinding), check);
  }

  /**
   * Durably record one inbound event before any dispatch. Identity is (tenant, producer, eventId)
   * and the stored hash is the byte contract, so the same identity with different bytes conflicts
   * instead of becoming a second accepted event.
   */
  async function accept(record, check) {
    const r = frozen(record);
    if (!text(r.tenantId, 256) || !text(r.producer, 128) || !text(r.eventId, 64) || !hex64(r.eventKey) || !hex64(r.eventHash) ||
        !text(r.occurredAt, 64) || !Number.isSafeInteger(Date.parse(r.occurredAt)) ||
        !STATES.includes(r.state) || !(r.code === null || (text(r.code, 64) && CODE.test(r.code))) ||
        !(r.scheduleId === null || text(r.scheduleId, 64)) || !(r.generation === null || (Number.isSafeInteger(r.generation) && r.generation >= 1)) ||
        !(r.occurrenceKey === null || hex64(r.occurrenceKey)))
      refuse('SOURCE_EVENT_INVALID');
    return transaction(async c => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${r.tenantId}:${r.producer}:${r.eventId}`]); check();
      const inserted = await c.query('INSERT INTO meri_schedules.source_events(tenant_id,producer,event_id,event_key,event_hash,state,code,occurred_at,schedule_id,generation,occurrence_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (tenant_id,producer,event_id) DO NOTHING',
        [r.tenantId, r.producer, r.eventId, r.eventKey, r.eventHash, r.state, r.code, r.occurredAt, r.scheduleId, r.generation, r.occurrenceKey]); check();
      const row = storedEvent((await c.query('SELECT event_key,event_hash,state,code,occurrence_key,schedule_id,generation FROM meri_schedules.source_events WHERE tenant_id=$1 AND producer=$2 AND event_id=$3 FOR UPDATE',
        [r.tenantId, r.producer, r.eventId])).rows[0], r.eventKey); check();
      if (!row) refuse('SOURCE_EVENT_STORE_UNAVAILABLE');
      if (row.eventHash !== r.eventHash) return Object.freeze({outcome: 'CONFLICT', row});
      // The same event identity may not silently alias a DIFFERENT accepted routine: when both
      // sides name routine pins and they disagree, the durable record wins and this is a conflict.
      if (r.scheduleId !== null && row.scheduleId !== null &&
          (row.scheduleId !== r.scheduleId || row.generation !== r.generation))
        return Object.freeze({outcome: 'CONFLICT', row});
      if (r.occurrenceKey !== null && row.occurrenceKey !== null && row.occurrenceKey !== r.occurrenceKey)
        return Object.freeze({outcome: 'CONFLICT', row});
      if (inserted.rowCount === 1) return Object.freeze({outcome: 'INSERTED', row});
      return Object.freeze({outcome: RETRYABLE.includes(row.state) ? 'REPLAY' : 'SETTLED', row});
    }, check);
  }

  /** Publish the post-dispatch disposition for an already-accepted event. Terminal rows are frozen. */
  async function settle(value, check) {
    const s = frozen(value);
    if (!text(s.tenantId, 256) || !text(s.producer, 128) || !text(s.eventId, 64) || !hex64(s.eventHash) ||
        !STATES.includes(s.state) || !(s.code === null || (text(s.code, 64) && CODE.test(s.code))) ||
        !(s.occurrenceKey === null || hex64(s.occurrenceKey)))
      refuse('SOURCE_EVENT_INVALID');
    return transaction(async c => {
      const updated = await c.query("UPDATE meri_schedules.source_events SET state=$4,code=$5,occurrence_key=COALESCE($6,occurrence_key),updated_at=clock_timestamp() WHERE tenant_id=$1 AND producer=$2 AND event_id=$3 AND event_hash=$7 AND state IN ('ACCEPTED','QUEUED')",
        [s.tenantId, s.producer, s.eventId, s.state, s.code, s.occurrenceKey, s.eventHash]); check();
      const row = storedEvent((await c.query('SELECT event_key,event_hash,state,code,occurrence_key,schedule_id,generation FROM meri_schedules.source_events WHERE tenant_id=$1 AND producer=$2 AND event_id=$3',
        [s.tenantId, s.producer, s.eventId])).rows[0], null); check();
      if (!row) refuse('SOURCE_EVENT_STORE_UNAVAILABLE');
      return Object.freeze({settled: updated.rowCount === 1, row});
    }, check);
  }

  async function read(value, check) {
    const s = selection(value);
    return transaction(async c => storedEvent((await c.query('SELECT event_key,event_hash,state,code,occurrence_key,schedule_id,generation FROM meri_schedules.source_events WHERE tenant_id=$1 AND producer=$2 AND event_id=$3',
      [s.tenantId, s.producer, s.eventId])).rows[0], null) ?? null, check);
  }

  /** Bounded view of accepted work that has not reached a terminal outcome. Never unbounded. */
  async function unresolved(value, check) {
    const s = frozen(value);
    if (!text(s.tenantId, 256) || !text(s.producer, 128) || !Number.isSafeInteger(s.limit) || s.limit < 1 || s.limit > 100) refuse('SOURCE_EVENT_INVALID');
    return transaction(async c => (await c.query("SELECT event_id,event_key,state,code,occurred_at FROM meri_schedules.source_events WHERE tenant_id=$1 AND producer=$2 AND state IN ('ACCEPTED','QUEUED','UNKNOWN') ORDER BY accepted_at LIMIT $3",
      [s.tenantId, s.producer, s.limit])).rows.map(row => frozen({eventId: row.event_id, eventKey: row.event_key, state: row.state, code: row.code ?? null, occurredAt: new Date(row.occurred_at).toISOString()})), check);
  }

  function storedEvent(row, expectedKey) {
    if (!row) return null;
    if (!hex64(row.event_key) || !hex64(row.event_hash) || !STATES.includes(row.state) ||
        !(row.code === null || row.code === undefined || (text(row.code, 64) && CODE.test(row.code))) ||
        !(row.occurrence_key === null || row.occurrence_key === undefined || hex64(row.occurrence_key)) ||
        (expectedKey !== null && row.event_key !== expectedKey))
      refuse('SOURCE_EVENT_CORRUPT');
    return frozen({
      eventKey: row.event_key, eventHash: row.event_hash, state: row.state, code: row.code ?? null,
      occurrenceKey: row.occurrence_key ?? null,
      scheduleId: row.schedule_id ?? null,
      generation: row.generation === null || row.generation === undefined ? null : Number(row.generation),
    });
  }

  return Object.freeze({bind, readBinding, accept, settle, read, unresolved});
}
