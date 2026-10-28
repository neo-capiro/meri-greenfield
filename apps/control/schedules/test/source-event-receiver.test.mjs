// MB-05 receiver boundary: the REAL source-event receiver over the REAL schedule owner and the
// REAL scheduled dispatch owner, with Core custody and SQL scripted. No live model, provider,
// database, network or browser is contacted, and this suite is not a PostgreSQL qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {custodyReceipt, ids, otherResourceKey, sourceEvent, sourceEventFixture, sourceTrigger, harnessIds} from './source-event-fixture.mjs';
import {cancelIntent, createIntent, ownerBinding, updateIntent} from './scheduled-dispatch-harness.mjs';
import {SOURCE_EVENT_PATH} from '../source-event-contract.mjs';
import {createSourceEventReceiver} from '../source-event-receiver.mjs';

const pick = result => ({disposition: result.disposition, code: result.code});
const bind = (h, changes = {}) => h.binding.bind({
  tenantId: 'tenant-a', scheduleId: harnessIds.schedule, producer: 'bizdev.watch.alert.v1',
  sourceFamily: 'federal_award', resourceKey: ids.watch, ...changes,
});
const ready = async () => {
  const h = await sourceEventFixture();
  await bind(h);
  return h;
};
const occurrenceRows = h => [...h.schedules.state.occurrences.values()];
const unresolved = h => h.store.unresolved({tenantId: 'tenant-a', producer: 'bizdev.watch.alert.v1', limit: 10}, () => {});

test('a canonical producer event is durably accepted before dispatch and settles one exact occurrence', async () => {
  const h = await ready();
  const event = sourceEvent();
  h.authorize(event);
  const result = await h.receive(event);
  assert.deepEqual({...pick(result), accepted: result.accepted, dispatched: result.dispatched},
    {disposition: 'DISPATCHED', code: null, accepted: true, dispatched: true});
  // Durability: the accepted row was written before the effect and names the exact occurrence.
  const row = h.eventRow(ids.event);
  assert.equal(row.state, 'DISPATCHED');
  assert.equal(row.schedule_id, harnessIds.schedule);
  assert.equal(Number(row.generation), 1);
  assert.equal(row.occurrence_key, result.occurrenceKey);
  assert.equal(row.event_hash, event.eventHash);
  // Causality event -> occurrence -> run/attempt, with explicitly partial history.
  assert.equal(result.causality.occurrenceKey, result.occurrenceKey);
  assert.match(result.causality.conversationId, /^[0-9a-f-]{36}$/u);
  assert.match(result.causality.runId, /^[0-9a-f-]{36}$/u);
  assert.match(result.causality.attemptId, /^[0-9a-f-]{36}$/u);
  assert.equal(result.causality.continuation, null);
  assert.equal(result.causality.historyComplete, false);
  // One effect only: one barrier row, one conversation run, one native workflow start.
  assert.deepEqual(occurrenceRows(h).map(o => o.state), ['DISPATCHED']);
  assert.equal(h.runCount(), 1);
  assert.equal(h.temporal.calls.start, 1);
  assert.equal(h.workflowCount(), 1);
  // The instruction came from the approved routine, never from the event.
  // The instruction read carries the existing dispatcher's own operation signal; the event can
  // neither supply nor suppress it, and it is not part of what the event selects.
  const instructionCall = h.instructions.calls.at(-1);
  assert.deepEqual({...instructionCall, signal: undefined}, {tenantId: 'tenant-a', scheduleId: harnessIds.schedule, generation: 1,
    task: {taskId: '33333333-3333-4333-8333-333333333333', manifestSha256: 'a'.repeat(64), version: 2},
    instructionSha256: h.hash(h.instructions.text), signal: undefined});
  assert.ok(instructionCall.signal instanceof AbortSignal);
});

test('a tenant or event identity Core does not custody is refused, and an absent route is UNAVAILABLE', async () => {
  const h = await ready();
  const event = sourceEvent();
  h.authorize(event);
  assert.equal((await h.receive(event)).disposition, 'DISPATCHED');
  const stranger = sourceEvent({eventId: ids.otherEvent});
  h.authorize(stranger);
  h.core.state.receipt = {...h.core.state.receipt, eventId: ids.event};
  assert.equal((await h.receive(stranger)).code, 'SOURCE_EVENT_IDENTITY');
  h.authorize(stranger);
  h.core.state.receipt = {...h.core.state.receipt, tenantId: 'tenant-b'};
  assert.equal((await h.receive(stranger)).code, 'SOURCE_EVENT_IDENTITY');
  // The proposed Core route is not composed yet: that is UNAVAILABLE, never a silent acceptance.
  h.core.state.mode = 'unavailable';
  await assert.rejects(async () => h.receive(sourceEvent()), error => error.code === 'SOURCE_EVENT_UNAVAILABLE');
  h.core.state.mode = 'malformed';
  await assert.rejects(async () => h.receive(sourceEvent()), error => error.code === 'SOURCE_EVENT_RECEIPT');
  assert.equal(h.temporal.calls.start, 1);
  assert.equal(h.runCount(), 1);
});

test('canonical fact disagreement with Core is a hash refusal, including a fabricated alert', async () => {
  const h = await ready();
  const event = sourceEvent();
  h.authorize(event);
  // A fresh identity whose claimed bytes Core custody does not corroborate: hash refusal, and
  // nothing is accepted, queued, dispatched or counted. Core answers for the SAME identity with
  // the canonical facts, which is exactly what a fabricated fingerprint cannot satisfy.
  const fabricated = sourceEvent({eventId: ids.otherEvent, alert: {fingerprint: 'e'.repeat(64)}});
  h.authorize(event, {eventId: ids.otherEvent});
  assert.deepEqual(pick(await h.receive(fabricated)), {disposition: 'REFUSED', code: 'SOURCE_EVENT_HASH'});
  // A wholly unknown alert id cannot be smuggled past the canonical read either.
  const unknown = sourceEvent({eventId: ids.thirdEvent, alert: {alertId: '7a8b9c0d-1e2f-4a5b-8c6d-7e8f90011223'}});
  h.authorize(event, {eventId: ids.thirdEvent});
  assert.equal((await h.receive(unknown)).code, 'SOURCE_EVENT_HASH');
  assert.equal(h.rows().size, 2);
  assert.deepEqual(occurrenceRows(h), []);
  // The canonical event itself still dispatches exactly once.
  h.authorize(event);
  assert.equal((await h.receive(event)).disposition, 'DISPATCHED');
  assert.equal(h.temporal.calls.start, 1);
  assert.equal(h.runCount(), 1);
});

test('the same event identity cannot silently alias a second occurrence or routine', async () => {
  const h = await ready();
  const event = sourceEvent();
  h.authorize(event);
  const first = await h.receive(event);
  assert.equal(first.disposition, 'DISPATCHED');
  // Same identity and same producer facts, different event instant: the occurrence derived from
  // the instant differs, so the durable record wins and this is a conflict — never a second effect.
  const shifted = sourceEvent({occurredAt: '2026-10-15T12:00:30.000Z'});
  h.authorize(shifted);
  assert.deepEqual(pick(await h.receive(shifted)), {disposition: 'CONFLICT', code: 'SOURCE_EVENT_IDENTITY_CONFLICT'});
  assert.equal(h.rows().size, 1);
  assert.equal(h.eventRow(ids.event).occurrence_key, first.occurrenceKey);
  assert.equal(h.temporal.calls.start, 1);
  assert.equal(h.runCount(), 1);
  assert.equal(occurrenceRows(h).length, 1);
});

test('an event for a pair the routine is NOT approved for is refused durably, and cannot be bound', async () => {
  const h = await sourceEventFixture();
  // The fixture's schedule IS approved — for its own watch. This event claims a watch the approval does not name.
  const event = sourceEvent({alert: {watchId: otherResourceKey}});
  h.authorize(event, {alert: {...event.alert, ...event.source}});
  const result = await h.receive(event);
  assert.deepEqual({...pick(result), accepted: result.accepted},
    {disposition: 'REFUSED', code: 'SOURCE_EVENT_BINDING_ABSENT', accepted: false});
  assert.equal(h.eventRow(ids.event).state, 'REFUSED');
  assert.equal(h.eventRow(ids.event).schedule_id, null);
  // A pair this schedule is NOT approved for can never be bound by claiming it: the claim is checked against the
  // schedule's own acknowledged configuration, so a different resource stays unauthorised and no row appears for it.
  await assert.rejects(() => bind(h, {resourceKey: otherResourceKey}),
    error => error.code === 'SOURCE_EVENT_TRIGGER_UNAPPROVED');
  // The only row that can ever exist is the schedule's OWN approved pair, derived from its acknowledged intent.
  assert.equal(h.fixture.bindings.size, 1);
  assert.equal(h.bindingRow().resource_key, ids.watch);
  assert.equal((await h.receive(event)).code, 'SOURCE_EVENT_BINDING_ABSENT');
  assert.equal(h.temporal.calls.start, 0);
});

test('an approved generation whose binding row was never written is DERIVED from the acknowledged generation', async () => {
  // Historical rows from before the atomic binding integration remain recoverable without changing approval.
  const h = await sourceEventFixture();
  h.fixture.bindings.clear();
  assert.equal(h.bindingRow(), null);
  const event = sourceEvent();
  h.authorize(event);
  assert.equal((await h.receive(event)).disposition, 'DISPATCHED');
  assert.equal(h.bindingRow().generation, '1');
  assert.equal(h.bindingRow().resource_key, ids.watch);
  // The derived row is the canonical one: a second event reuses it, never a second approval.
  const second = sourceEvent({eventId: ids.otherEvent});
  h.authorize(second, {eventId: ids.otherEvent});
  assert.equal((await h.receive(second)).disposition, 'DISPATCHED');
  assert.equal(h.fixture.bindings.size, 1);
});

test('the ACKNOWLEDGED transition itself creates the binding from the acknowledged intent (real caller)', async () => {
  const h = await sourceEventFixture();
  const row = h.bindingRow();
  assert.equal(row.generation, '1');
  assert.equal(row.producer, sourceTrigger.producer);
  assert.equal(row.source_family, sourceTrigger.sourceFamily);
  assert.equal(row.resource_key, sourceTrigger.resourceKey);
  // No pair argument existed anywhere on that path: it is the acknowledged intent's own configuration.
  assert.equal((await h.binding.lookup({tenantId: 'tenant-a', ...sourceTrigger})).generation, 1);
});

test('an ordinary cron acknowledgement writes no source-event binding', async () => {
  const h = await sourceEventFixture({approval: 'absent'});
  assert.equal(h.bindingRow(), null);
  assert.equal(h.fixture.bindings.size, 0);
  const event = sourceEvent();
  h.authorize(event);
  assert.deepEqual({disposition: (await h.receive(event)).disposition, code: (await h.receive(event)).code},
    {disposition: 'REFUSED', code: 'SOURCE_EVENT_BINDING_ABSENT'});
});

test('binding insertion failure rolls back ACK and the existing reconciliation retries both atomically', async () => {
  const h = await sourceEventFixture({acknowledgeInitial: false});
  h.fixture.failOnce = 'INSERT INTO meri_schedules.source_event_bindings';
  await assert.rejects(() => h.acknowledge(createIntent()), {code: 'SCHEDULE_STORE_UNAVAILABLE'});
  const pending = await h.scheduleOwner.readIntent({tenantId: 'tenant-a', intentId: createIntent().intentId}, () => {});
  assert.equal(pending.state, 'DISPATCHING');
  assert.equal((await h.scheduleOwner.readFiring({tenantId: 'tenant-a', scheduleId: harnessIds.schedule}, () => {})).generation, 0);
  assert.equal(await h.binding.lookup({tenantId: 'tenant-a', ...sourceTrigger}), null);
  assert.equal(h.fixture.bindings.size, 0);
  await h.scheduleOwner.acknowledgeReconciled({tenantId: 'tenant-a', intentId: pending.intent.intentId, intentSha256: pending.intentSha256}, () => {});
  assert.equal((await h.binding.lookup({tenantId: 'tenant-a', ...sourceTrigger})).generation, 1);
  assert.equal(h.fixture.bindings.size, 1);
  assert.equal(h.temporal.calls.start, 0);
});

test('lost ACK commit response remains UNKNOWN while exact readback discovers both committed records', async () => {
  const h = await sourceEventFixture({acknowledgeInitial: false});
  h.fixture.bindingCommitFaultOnce = true;
  await assert.rejects(() => h.acknowledge(createIntent()), {code: 'SCHEDULE_COMMIT_UNKNOWN'});
  const stored = await h.scheduleOwner.readIntent({tenantId: 'tenant-a', intentId: createIntent().intentId}, () => {});
  assert.equal(stored.state, 'ACKNOWLEDGED');
  assert.equal((await h.binding.lookup({tenantId: 'tenant-a', ...sourceTrigger})).generation, 1);
  assert.equal(h.fixture.bindings.size, 1);
  assert.equal(h.temporal.calls.start, 0);
});

test('a binding for another routine generation cannot authorise this event', async () => {
  const h = await sourceEventFixture();
  await h.acknowledge(updateIntent());
  await bind(h, {generation: 2});
  const event = sourceEvent();
  h.authorize(event);
  assert.deepEqual(pick(await h.receive(event)), {disposition: 'REFUSED', code: 'SOURCE_EVENT_BINDING_STALE'});
  assert.equal(h.temporal.calls.start, 0);
});

test('a superseding generation refuses the bound generation instead of dispatching stale work', async () => {
  const h = await ready();
  const event = sourceEvent();
  h.authorize(event);
  await h.acknowledge(updateIntent());
  assert.deepEqual(pick(await h.receive(event)), {disposition: 'REFUSED', code: 'SOURCE_EVENT_BINDING_STALE'});
  // Historical pre-atomic rows may lack the latest binding, but the current generation still fences dispatch.
  for (const [key, row] of h.fixture.bindings) if (Number(row.generation) === 2) h.fixture.bindings.delete(key);
  const historical = sourceEvent({eventId: ids.otherEvent});
  h.authorize(historical);
  assert.deepEqual(pick(await h.receive(historical)), {disposition: 'REFUSED', code: 'SOURCE_EVENT_SUPERSEDED'});
  assert.equal(h.temporal.calls.start, 0);
  assert.equal(h.runCount(), 0);
  assert.deepEqual(occurrenceRows(h), []);
});

test('a disabled routine and an unresolved in-flight intent are refused before any effect', async () => {
  const paused = await ready();
  const event = sourceEvent();
  paused.authorize(event);
  await paused.acknowledge(cancelIntent({mode: 'pause'}));
  assert.deepEqual(pick(await paused.receive(event)), {disposition: 'REFUSED', code: 'SOURCE_EVENT_ROUTINE_INACTIVE'});
  assert.equal(paused.temporal.calls.start, 0);
  assert.equal(paused.runCount(), 0);

  const inFlight = await ready();
  const second = sourceEvent({eventId: ids.otherEvent});
  inFlight.authorize(second);
  const claimed = ownerBinding(updateIntent());
  await inFlight.scheduleOwner.claim(claimed, () => {});
  await inFlight.scheduleOwner.markDispatching(claimed, () => {});
  assert.deepEqual(pick(await inFlight.receive(second)), {disposition: 'REFUSED', code: 'SOURCE_EVENT_ROUTINE_UNRESOLVED'});
  assert.equal(inFlight.temporal.calls.start, 0);
});

test('current owner, client, watch, membership, source state and consent must all agree', async () => {
  const cases = [
    [{watch: {ownerActorId: 'someone-else'}}, 'REFUSED', 'SOURCE_EVENT_OWNER'],
    [{watch: {clientId: '9c0d1e2f-3041-4c5d-8e6f-708192a3b4c5'}}, 'REFUSED', 'SOURCE_EVENT_CLIENT'],
    [{watch: {clientId: null}}, 'REFUSED', 'SOURCE_EVENT_CLIENT'],
    [{watch: {status: 'paused'}}, 'SKIPPED', 'SOURCE_EVENT_WATCH_INACTIVE'],
    [{watch: {status: 'ended'}}, 'SKIPPED', 'SOURCE_EVENT_WATCH_INACTIVE'],
    [{watch: {membership: 'inactive'}}, 'SKIPPED', 'SOURCE_EVENT_MEMBERSHIP_INACTIVE'],
    [{watch: {sourceState: 'revoked'}}, 'SKIPPED', 'SOURCE_EVENT_SOURCE_STATE'],
    [{watch: {sourceState: 'deleted'}}, 'SKIPPED', 'SOURCE_EVENT_SOURCE_STATE'],
    [{watch: {sourceState: 'superseded'}}, 'SKIPPED', 'SOURCE_EVENT_SOURCE_STATE'],
    [{consent: {consentId: ids.consent, state: 'revoked', expiresAtMs: 0}}, 'SKIPPED', 'SOURCE_EVENT_CONSENT'],
    [{consent: {consentId: ids.consent, state: 'active', expiresAtMs: 0}}, 'SKIPPED', 'SOURCE_EVENT_CONSENT'],
    [{checkedAtMs: 0, expiresAtMs: 0}, 'REFUSED', 'SOURCE_EVENT_RECEIPT'],
  ];
  for (const [changes, disposition, code] of cases) {
    const h = await ready();
    const event = sourceEvent();
    h.authorize(event, changes);
    const result = await h.receive(event);
    assert.deepEqual(pick(result), {disposition, code}, JSON.stringify(changes));
    assert.equal(h.eventRow(ids.event).state, disposition, code);
    assert.equal(h.eventRow(ids.event).code, code);
    assert.equal(h.temporal.calls.start, 0, code);
    assert.equal(h.runCount(), 0, code);
    assert.deepEqual(occurrenceRows(h), [], code);
  }
});

test('a duplicate redelivery after settlement is deduped and never adds a second effect', async () => {
  const h = await ready();
  const event = sourceEvent();
  h.authorize(event);
  assert.equal((await h.receive(event)).disposition, 'DISPATCHED');
  const again = await h.receive(event);
  assert.deepEqual({disposition: again.disposition, recorded: again.recorded, dispatched: again.dispatched},
    {disposition: 'DEDUPED', recorded: 'DISPATCHED', dispatched: false});
  assert.equal(h.temporal.calls.start, 1);
  assert.equal(h.runCount(), 1);
  assert.equal(occurrenceRows(h).length, 1);
});

test('changed bytes under the same event identity conflict and write nothing new', async () => {
  const h = await ready();
  const event = sourceEvent();
  h.authorize(event);
  assert.equal((await h.receive(event)).disposition, 'DISPATCHED');
  const changed = sourceEvent({alert: {fingerprint: 'f'.repeat(64)}});
  h.authorize(changed);
  assert.deepEqual(pick(await h.receive(changed)), {disposition: 'CONFLICT', code: 'SOURCE_EVENT_IDENTITY_CONFLICT'});
  assert.equal(h.rows().size, 1);
  assert.equal(h.eventRow(ids.event).event_hash, event.eventHash);
  assert.equal(h.temporal.calls.start, 1);
  assert.equal(h.runCount(), 1);
});

test('an out-of-order event older than the approved catch-up window is refused by the routine\'s own window', async () => {
  const h = await ready();
  const event = sourceEvent({occurredAt: '2026-10-15T11:59:00.000Z'});
  h.authorize(event);
  assert.deepEqual(pick(await h.receive(event)), {disposition: 'REFUSED', code: 'SCHEDULE_OCCURRENCE_MISSED'});
  assert.equal(h.eventRow(ids.event).state, 'REFUSED');
  assert.equal(h.temporal.calls.start, 0);
  assert.equal(h.runCount(), 0);
});

test('a lost accept acknowledgement keeps the accepted row and still yields exactly one effect', async () => {
  const h = await ready();
  const event = sourceEvent();
  h.authorize(event);
  h.fixture.commitFaultOnce = true;
  await assert.rejects(async () => h.receive(event), error => error.code === 'SOURCE_EVENT_COMMIT_UNKNOWN');
  // The acceptance was durably written before any dispatch.
  assert.equal(h.eventRow(ids.event).state, 'ACCEPTED');
  assert.equal(h.temporal.calls.start, 0);
  const retried = await h.receive(event);
  assert.equal(retried.disposition, 'DISPATCHED');
  assert.equal(h.eventRow(ids.event).state, 'DISPATCHED');
  assert.equal(h.temporal.calls.start, 1);
  assert.equal(h.runCount(), 1);
  assert.equal(occurrenceRows(h).length, 1);
});

test('a lost dispatch acknowledgement is recorded UNKNOWN, stays visible, and is never redispatched', async () => {
  const h = await ready();
  const event = sourceEvent();
  h.authorize(event);
  h.temporal.faults.start.push('lose');
  const result = await h.receive(event);
  assert.deepEqual({disposition: result.disposition, recorded: result.recorded}, {disposition: 'UNKNOWN', recorded: 'UNKNOWN'});
  assert.equal(h.eventRow(ids.event).state, 'UNKNOWN');
  assert.deepEqual((await unresolved(h)).map(v => v.state), ['UNKNOWN']);
  const again = await h.receive(event);
  assert.deepEqual({disposition: again.disposition, recorded: again.recorded}, {disposition: 'DEDUPED', recorded: 'UNKNOWN'});
  assert.equal(h.temporal.calls.start, 1);
  assert.equal(h.runCount(), 1);
});

test('an open occurrence is backpressure: accepted work queues, stays visible and can still dispatch later', async () => {
  const h = await ready();
  const first = sourceEvent();
  h.authorize(first);
  h.temporal.faults.start.push('before');
  assert.equal((await h.receive(first)).disposition, 'UNKNOWN');
  assert.equal(occurrenceRows(h)[0].state, 'OPEN');
  const second = sourceEvent({eventId: ids.otherEvent});
  h.authorize(second);
  const queued = await h.receive(second);
  assert.deepEqual({...pick(queued), accepted: queued.accepted},
    {disposition: 'QUEUED', code: 'SCHEDULE_OCCURRENCE_UNRESOLVED', accepted: true});
  assert.equal(h.eventRow(ids.otherEvent).state, 'QUEUED');
  assert.equal(h.temporal.calls.start, 1); // the queued event caused no new start attempt
  assert.equal(h.runCount(), 1);
  assert.deepEqual((await unresolved(h)).map(v => v.state).sort(), ['QUEUED', 'UNKNOWN']);
  // The predecessor's exact workflow becomes observable: the queued event proceeds, exactly once.
  h.temporal.workflows.set(h.effectWorkflowId(first), {workflowType: 'meriConversationLifecycleWorkflow', args: []});
  assert.equal((await h.receive(second)).disposition, 'DISPATCHED');
  assert.equal(h.temporal.calls.start, 2);
  assert.equal(h.runCount(), 2);
  assert.deepEqual(occurrenceRows(h).map(o => o.state).sort(), ['DISPATCHED', 'DISPATCHED']);
});

test('a worker restart over the same durable owners cannot redeliver into a second effect', async () => {
  const h = await ready();
  const event = sourceEvent();
  h.authorize(event);
  assert.equal((await h.receive(event)).disposition, 'DISPATCHED');
  const restarted = h.build(h.scheduled);
  const result = await restarted.receive({raw: event, check: () => {}});
  assert.equal(result.disposition, 'DEDUPED');
  assert.equal(result.occurrenceKey, h.eventRow(ids.event).occurrence_key);
  assert.equal(h.temporal.calls.start, 1);
  assert.equal(h.runCount(), 1);
  assert.equal(occurrenceRows(h).length, 1);
});

test('poison and malformed events never advance the accepted cursor and never retry forever', async () => {
  const h = await ready();
  const event = sourceEvent();
  h.authorize(event);
  for (const body of [null, 7, 'text', [], {...event, eventId: 'not-a-uuid'}, {...event, extra: 'x'}, {...event, eventHash: 'z'.repeat(64)}])
    await assert.rejects(async () => h.receive(body), error => ['SOURCE_EVENT_INVALID', 'SOURCE_EVENT_HASH'].includes(error.code));
  assert.equal(h.rows().size, 0);
  assert.equal(h.temporal.calls.start, 0);
  // A refused event redelivered repeatedly reports its recorded refusal and never dispatches: the
  // first delivery is the fresh skip, every later one is the recorded skip.
  h.authorize(event, {watch: {status: 'ended'}});
  const skipped = await h.receive(event);
  assert.deepEqual({disposition: skipped.disposition, recorded: skipped.recorded}, {disposition: 'SKIPPED', recorded: null});
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await h.receive(event);
    assert.deepEqual({disposition: result.disposition, recorded: result.recorded}, {disposition: 'DEDUPED', recorded: 'SKIPPED'});
  }
  assert.equal(h.rows().size, 1);
  assert.equal(h.temporal.calls.start, 0);
});

test('a revoked source after acceptance refuses truthfully while the accepted work stays retained', async () => {
  const h = await ready();
  // An earlier event leaves the schedule's occurrence open, so this event is accepted but queued.
  const blocker = sourceEvent({occurredAt: '2026-10-15T12:00:00.000Z'});
  h.authorize(blocker);
  h.temporal.faults.start.push('before');
  assert.equal((await h.receive(blocker)).disposition, 'UNKNOWN');
  const event = sourceEvent({eventId: ids.otherEvent});
  h.authorize(event);
  assert.equal((await h.receive(event)).disposition, 'QUEUED');
  assert.equal(h.eventRow(ids.otherEvent).state, 'QUEUED');
  // The source is revoked after acceptance: redelivery reports it and does NOT discard the accepted row.
  h.authorize(event, {consent: {consentId: ids.consent, state: 'revoked', expiresAtMs: 0}});
  const refused = await h.receive(event);
  assert.deepEqual({...pick(refused), priorOutstanding: refused.priorOutstanding},
    {disposition: 'SKIPPED', code: 'SOURCE_EVENT_CONSENT', priorOutstanding: true});
  assert.equal(h.eventRow(ids.otherEvent).state, 'QUEUED');
  assert.equal(h.eventRow(ids.otherEvent).code, 'SCHEDULE_OCCURRENCE_UNRESOLVED');
  assert.deepEqual((await unresolved(h)).map(v => v.state).sort(), ['QUEUED', 'UNKNOWN']);
});

test('the receiver refuses an incomplete canonical port set without touching an owner', () => {
  const complete = () => ({
    store: {accept: async () => {}, settle: async () => {}, read: async () => null},
    binding: {read: async () => null}, scheduleOwner: {readFiring: async () => null},
    core: {readSourceEvent: async () => null}, dispatch: {dispatch: async () => ({})}, now: () => 0,
  });
  for (const missing of ['store', 'binding', 'scheduleOwner', 'core', 'dispatch']) {
    const ports = complete();
    delete ports[missing];
    assert.throws(() => createSourceEventReceiver(ports), error => error.code === 'SOURCE_EVENT_PORTS', missing);
  }
  for (const broken of [{...complete(), store: {accept: async () => {}, settle: async () => {}}},
    {...complete(), dispatch: {}}, {...complete(), core: new Proxy({}, {get: () => async () => null})}])
    assert.throws(() => createSourceEventReceiver(broken), error => error.code === 'SOURCE_EVENT_PORTS');
  assert.ok(Object.isFrozen(createSourceEventReceiver(complete())));
  assert.equal(SOURCE_EVENT_PATH, '/v1/internal/routines/source-events');
});
