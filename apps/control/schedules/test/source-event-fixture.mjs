// Synthetic composition for the MB-05 source-event receiver: the REAL schedule owner, the REAL
// scheduled dispatch/dispatcher/run-evidence owners and the REAL receiver run over scripted SQL
// and a scripted Core custody port. The scripted pool implements the 0007 protocol faithfully
// (primary key, ON CONFLICT DO NOTHING, the state-guarded UPDATE and the hash comparison) but
// makes NO claim about PostgreSQL concurrency, locking, permissions or crash durability, and it
// does not qualify the 0007 DDL. No model, provider, network, browser or database is contacted.
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createPostgresSourceEventStore} from '../source-event-store.mjs';
import {createSourceEventBinding} from '../source-event-binding.mjs';
import {createPostgresScheduleOwner} from '../postgres-schedule-owner.mjs';
import {createSourceEventReceiver} from '../source-event-receiver.mjs';
import {sourceEventFactHash, snapshotSourceEvent, sourceEventKey} from '../source-event-contract.mjs';
import {occurrenceIdentity, sourceEventOccurrence, sourceEventWorkflowId} from '../scheduled-occurrence.mjs';
import {workflowId} from '../../conversations/temporal-dispatch.mjs';
import {harness,createIntent,updateIntent,configuration,ownerBinding as ownerBindingOf,check,ids as harnessIds,instruction,projection} from './scheduled-dispatch-harness.mjs';

export {harnessIds, instruction};
export const NOW = Date.parse('2026-10-15T12:00:01.000Z');
// The client Core reports for this watch is the client the APPROVED projection scopes name: the
// agreement check is between the stored approval and Core's current answer, so the synthetic
// receipt uses the approved scope's own resource id rather than an invented client.
export const approvedClientId = projection().scopes.find(scope => scope.kind !== 'private-user')?.resourceId ?? null;
export const ids = Object.freeze({
  watch: '0f1e2d3c-4b5a-4978-8899-aabbccddeeff',
  alert: '1a2b3c4d-5e6f-4788-9a0b-c1d2e3f40516',
  prospect: '2b3c4d5e-6f70-4819-8a1b-c2d3e4f50617',
  event: '3c4d5e6f-7081-492a-9b2c-d3e4f5061728',
  otherEvent: '4d5e6f70-8192-4a3b-8c3d-e4f506172839',
  thirdEvent: '5f6a7b8c-9d0e-4f1a-8b2c-d3e4f5061728',
  consent: '5e6f7081-92a3-4b4c-9d4e-f5061728394a',
});
/** A pair the fixture's schedule is explicitly NOT approved for. */
export const otherResourceKey = '8b9c0d1e-2f30-4b4c-8d5e-6f708192a3b4';
/**
 * The APPROVED source trigger: the closed field the parent/M5 public contract must accept on an
 * approved routine's intent. It is part of the intent the binding pins (intent_sha256), so a
 * change to it is a new generation/approval — never a silent edit of an approved binding.
 */
export const sourceTrigger = Object.freeze({
  producer: 'bizdev.watch.alert.v1', sourceFamily: 'federal_award', resourceKey: ids.watch,
});
/**
 * A SOURCE-ONLY time policy: the closed trigger and no calendar/interval/cron/skip/jitter and no
 * immediate run — exactly what the 0.3 lifecycle owner admits for an event-triggered routine, and
 * what the binding derives its approval from.
 */
export const sourceOnlyConfiguration = (trigger, changes = {}) => configuration({
  spec: {...configuration().spec, calendars: [], intervals: [], cronExpressions: [], skip: [], startAt: null, endAt: null, jitterMs: 0},
  runNow: false, ...(trigger ? {sourceTrigger: trigger} : {}), ...changes,
});
/** An explicitly approved generation carrying the closed trigger on its own configuration. */
export const approvedIntent = (changes = {}) => ({...createIntent(), configuration: sourceOnlyConfiguration(sourceTrigger), ...changes});
/** An approved generation with NO trigger: an ordinary cron, which is never a source approval. */
export const unapprovedIntent = (changes = {}) => ({...createIntent(), ...changes});
/** An approved generation whose trigger names a different resource: a mismatch, never a match. */
export const mismatchedIntent = (changes = {}) => ({...createIntent(), configuration: sourceOnlyConfiguration({...sourceTrigger, resourceKey: otherResourceKey}), ...changes});
/** An approved generation whose trigger is widened past the closed field set: refused, never ignored. */
export const widenedIntent = (changes = {}) => ({...createIntent(), configuration: sourceOnlyConfiguration({...sourceTrigger, scope: 'client-a'}), ...changes});
/** An approved generation that UPDATES the routine while keeping the same source trigger. */
export const sourceApprovedUpdate = (changes = {}) => ({...updateIntent(), configuration: sourceOnlyConfiguration(sourceTrigger), ...changes});

const bump = () => new Date(NOW).toISOString();

/** One closed producer envelope whose hash is derived exactly as the contract requires. */
export function sourceEvent(changes = {}) {
  const alert = {alertId: ids.alert, watchId: ids.watch, prospectId: ids.prospect,
    dedupeKey: `federal_award:rec-1:${'b'.repeat(64)}`, fingerprint: 'c'.repeat(64)};
  const source = {sourceFamily: 'federal_award', recordId: 'rec-1', sourceRevision: 'rev-1'};
  const {source: sourceChange, alert: alertChange, ...rest} = changes;
  const merged = {
    schemaVersion: 1, producer: 'bizdev.watch.alert.v1', tenantId: 'tenant-a', eventId: ids.event,
    eventHash: null, occurredAt: bump(), routine: {scheduleId: harnessIds.schedule, generation: 1},
    ...rest, source: {...source, ...(sourceChange ?? {})}, alert: {...alert, ...(alertChange ?? {})},
  };
  if (changes.eventHash === undefined)
    merged.eventHash = sourceEventFactHash({tenantId: merged.tenantId, alert: merged.alert, source: merged.source});
  return merged;
}

/** The canonical Core custody receipt for one event; every field may be overridden per case. */
export function custodyReceipt(event, changes = {}) {
  return {
    schemaVersion: 1, producer: event.producer, tenantId: event.tenantId, eventId: event.eventId, eventHash: event.eventHash,
    alert: {...event.alert, ...event.source},
    watch: {ownerActorId: 'owner-a', status: 'active', membership: 'active', clientId: approvedClientId, sourceState: 'current'},
    consent: {consentId: ids.consent, state: 'active', expiresAtMs: NOW + 60000},
    checkedAtMs: NOW, expiresAtMs: NOW + 30000,
    ...changes,
  };
}

/** Scripted Core custody port: authoritative answers only, plus explicit unavailability. */
export function custodyFixture(initial = null) {
  const state = {receipt: initial, mode: 'ok', calls: [], faults: []};
  const port = {
    async readSourceEvent(body) {
      state.calls.push(structuredClone(body));
      const fault = state.faults.shift();
      if (fault) throw Object.assign(Error('synthetic core transport'), {code: fault});
      if (state.mode === 'unavailable') throw Object.assign(Error('synthetic core unavailable'), {code: 'ROUTE_UNAVAILABLE'});
      if (state.mode === 'malformed') return {unexpected: true};
      return structuredClone(state.receipt);
    },
  };
  return {state, port};
}

const key = (...parts) => parts.join('\u0000');
const rowView = r => ({event_key: r.event_key, event_hash: r.event_hash, state: r.state, code: r.code,
  occurrence_key: r.occurrence_key, schedule_id: r.schedule_id, generation: r.generation});

function sourceEventSql(fixture, sql, p) {
  if (fixture.failOnce && sql.startsWith(fixture.failOnce)) {
    fixture.failOnce = null;
    throw Error('synthetic store failure');
  }
  if (sql.startsWith('INSERT INTO meri_schedules.source_event_bindings')) {
    const [tenant_id, schedule_id, generation, intent_sha256, projection_sha256, temporal_schedule_id,
      owner_actor_id, producer, source_family, resource_key, task, scopes] = p;
    // scopes is jsonb: the driver must bind JSON text. A raw JS array is sent as a Postgres array
    // literal and the real column refuses it (22P02), so this scripted store refuses it too.
    if (Array.isArray(scopes)) throw Object.assign(Error('invalid input syntax for type json'), {code: '22P02'});
    // Append-only historical generations of each schedule may share a producer pair.
    const k = key(tenant_id, producer, source_family, resource_key, schedule_id, String(generation));
    if (fixture.bindings.has(k)) return {rows: [], rowCount: 0};
    fixture.bindings.set(k, {tenant_id, schedule_id, generation: String(generation), intent_sha256, projection_sha256,
      temporal_schedule_id, owner_actor_id, producer, source_family, resource_key,
      // Read back exactly what the jsonb column would return: the parsed scope list.
      task: structuredClone(task), scopes: JSON.parse(scopes)});
    return {rows: [], rowCount: 1};
  }
  if (sql.startsWith('SELECT schedule_id,generation,intent_sha256,projection_sha256,temporal_schedule_id,owner_actor_id,task,scopes FROM meri_schedules.source_event_bindings')) {
    // 4 params: every generation for the pair. 6 params: the exact schedule/generation readback.
    const rows = [...fixture.bindings.values()]
      .filter(r => r.tenant_id === p[0] && r.producer === p[1] && r.source_family === p[2] && r.resource_key === p[3])
      .filter(r => p.length === 4 || r.generation === String(p[4]))
      .filter(r => p.length === 4 || r.schedule_id === p[5])
      .sort((a, b) => Number(b.generation) - Number(a.generation))
      .map(r => structuredClone(r));
    return {rows};
  }
  if (sql.startsWith('INSERT INTO meri_schedules.source_events')) {
    const [tenant_id, producer, event_id, event_key, event_hash, state, code, occurred_at, schedule_id, generation, occurrence_key] = p;
    const k = key(tenant_id, producer, event_id);
    if (fixture.rows.has(k)) return {rows: [], rowCount: 0};
    fixture.rows.set(k, {tenant_id, producer, event_id, event_key, event_hash, state, code,
      occurred_at, schedule_id, generation: generation === null ? null : String(generation), occurrence_key,
      accepted_at: new Date(NOW).toISOString()});
    return {rows: [], rowCount: 1};
  }
  if (sql.startsWith('SELECT event_key,event_hash,state,code,occurrence_key,schedule_id,generation FROM meri_schedules.source_events')) {
    const r = fixture.rows.get(key(p[0], p[1], p[2]));
    return {rows: r ? [rowView(structuredClone(r))] : []};
  }
  if (sql.startsWith('UPDATE meri_schedules.source_events SET state=$4')) {
    const r = fixture.rows.get(key(p[0], p[1], p[2]));
    if (!r || r.event_hash !== p[6] || !['ACCEPTED', 'QUEUED'].includes(r.state)) return {rows: [], rowCount: 0};
    r.state = p[3]; r.code = p[4];
    if (p[5] !== null) r.occurrence_key = p[5];
    return {rows: [], rowCount: 1};
  }
  if (sql.startsWith('SELECT event_id,event_key,state,code,occurred_at FROM meri_schedules.source_events')) {
    return {rows: [...fixture.rows.values()]
      .filter(r => r.tenant_id === p[0] && r.producer === p[1] && ['ACCEPTED', 'QUEUED', 'UNKNOWN'].includes(r.state))
      .slice(0, p[2])
      .map(r => ({event_id: r.event_id, event_key: r.event_key, state: r.state, code: r.code, occurred_at: r.occurred_at}))};
  }
  return null;
}

/** Wraps the schedule fixture pool: source-event SQL is answered here, everything else delegates. */
function sourceEventPool(schedules, fixture) {
  let tail = Promise.resolve();
  return {
    async connect() {
      let release; const previous = tail; tail = new Promise(r => (release = r)); await previous;
      let snapshot, accepting = false, bindingWritten = false;
      const inner = await schedules.pool.connect();
      return {
        async query(sql, p = []) {
          if (sql === 'BEGIN') { snapshot = structuredClone({bindings: fixture.bindings, rows: fixture.rows}); accepting = false; bindingWritten = false; }
          if (sql === 'ROLLBACK') { Object.assign(fixture, snapshot); return inner.query(sql, p); }
          if (sql === 'COMMIT') {
            // A lost acknowledgement is committed-but-unreported: the durable write HAPPENED and
            // the caller must discover that by reading back, never by assuming it did not. It is
            // injected on the ACCEPTANCE commit specifically (a read-only transaction commits fine).
            if ((fixture.commitFaultOnce && accepting) || (fixture.bindingCommitFaultOnce && bindingWritten)) {
              fixture.commitFaultOnce = false; fixture.bindingCommitFaultOnce = false; await inner.query(sql, p); throw Error('synthetic acknowledgement lost');
            }
            return inner.query(sql, p);
          }
          if (sql.startsWith('INSERT INTO meri_schedules.source_events')) accepting = true;
          if (sql.startsWith('INSERT INTO meri_schedules.source_event_bindings')) bindingWritten = true;
          const handled = sourceEventSql(fixture, sql, p);
          return handled ?? inner.query(sql, p);
        },
        release() { try { inner.release(); } finally { release(); } },
      };
    },
  };
}

/** The real ACK path and receiver share the same transaction-capable schedule/source-event pool. */
export async function sourceEventFixture({custody = null, approval = 'approved', acknowledgeInitial = true} = {}) {
  const h = harness();
  const fixture = {bindings: new Map(), rows: new Map(), failOnce: null, commitFaultOnce: false, bindingCommitFaultOnce: false};
  const pool = sourceEventPool(h.schedules, fixture);
  const store = createPostgresSourceEventStore({pool});
  const ackOwner = createPostgresScheduleOwner({pool});
  const binding = createSourceEventBinding({scheduleOwner: ackOwner, store, now: () => NOW});
  // The schedule this fixture acknowledges carries the closed trigger on its approved INTENT'S OWN CONFIGURATION:
  // exactly as the 0.3 contract expresses it ('approved'), not at all (an ordinary cron, 'absent'), or approved for a
  // different pair ('mismatched'). Nothing else may become a binding.
  const approvedTrigger = approval === 'approved'
    ? sourceTrigger
    : approval === 'mismatched' ? {...sourceTrigger, resourceKey: otherResourceKey}
      : approval === 'widened' ? {...sourceTrigger, scope: 'client-a'} : null;
  const acknowledge = async intent => {
    const {sourceTrigger: _dropped, ...rest} = intent;
    // The approval lives on the intent's OWN configuration (intent.configuration.sourceTrigger) with a source-only time
    // policy — not on a top-level intent field and not on the frozen projection, which has no trigger slot at all.
    if (!rest.configuration || approvedTrigger === null) {
      const binding2 = ownerBindingOf(rest);
      await ackOwner.claim(binding2, check); await ackOwner.markDispatching(binding2, check); await ackOwner.commitKnown(binding2, check);
      return;
    }
    const next = {...rest,
      configuration: {...rest.configuration, sourceTrigger: approvedTrigger, runNow: false,
        spec: {...rest.configuration.spec, calendars: [], intervals: [], cronExpressions: [], skip: [], startAt: null, endAt: null, jitterMs: 0}}};
    const ownerBinding = ownerBindingOf(next);
    await ackOwner.claim(ownerBinding, check); await ackOwner.markDispatching(ownerBinding, check); await ackOwner.commitKnown(ownerBinding, check);
  };
  if (acknowledgeInitial) await acknowledge(createIntent());
  const core = custody ?? custodyFixture();
  const build = dispatch => createSourceEventReceiver({
    store, binding, scheduleOwner: h.scheduleOwner, core: core.port, dispatch, now: () => NOW,
  });
  const receiver = build(h.scheduled);
  const receive = (raw, extra = {}) => receiver.receive({raw, check: () => {}, ...extra});
  return {
    ...h, scheduleOwner: ackOwner, acknowledge, fixture, pool, store, binding, core, receiver, build, receive,
    sourceEvent, custodyReceipt,
    rows: () => fixture.rows,
    eventRow: (eventId, tenantId = 'tenant-a', producer = 'bizdev.watch.alert.v1') => fixture.rows.get(key(tenantId, producer, eventId)),
    /** Point the scripted Core custody at this event's canonical facts (optionally doctored). */
    authorize: (raw, changes = {}) => {
      const event = snapshotSourceEvent(raw);
      const base = custodyReceipt(event);
      // An override merges into its sub-object: a partial watch/consent change is a change to the
      // canonical receipt, not a truncation of it.
      const receipt = {...base, ...changes,
        watch: {...base.watch, ...(changes.watch ?? {})}, consent: {...base.consent, ...(changes.consent ?? {})}};
      core.state.receipt = receipt;
      return receipt;
    },
    bindingRow: () => [...fixture.bindings.values()][0] ?? null,
    occurrenceFor: (event, generation = 1) => {
      const snapshot = snapshotSourceEvent(event);
      const key64 = sourceEventKey(snapshot);
      return {key64, workflowId: sourceEventWorkflowId(key64, harnessIds.schedule, generation)};
    },
    occurrenceRow: occurrenceValue => {
      const identity = occurrenceIdentity(sourceEventOccurrence(occurrenceValue));
      return h.schedules.state.occurrences.get(`tenant-a:${identity.occurrenceKey}`);
    },
    /** The exact native workflow an accepted event of this generation would name (test evidence only). */
    effectWorkflowId: (event, generation = 1) => {
      const snapshot = snapshotSourceEvent(event);
      const key64 = sourceEventKey(snapshot);
      const occurrence = sourceEventOccurrence({
        projection: projection(), generation, task: configuration().task, eventKey: key64,
        occurredAt: snapshot.occurredAt, workflowId: sourceEventWorkflowId(key64, harnessIds.schedule, generation),
      });
      return workflowId(occurrenceIdentity(occurrence).binding);
    },
    hash: canonicalSha256,
  };
}
