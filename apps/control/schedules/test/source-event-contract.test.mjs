// The closed producer contract: one finite event per request, no unknown keys, no smuggled
// prompt/scope-grant/destination/budget/run selector, and an identity that excludes the bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOURCE_EVENT_FORBIDDEN_KEYS, SOURCE_EVENT_PATH, SOURCE_EVENT_PRODUCERS, SOURCE_EVENT_PROTOCOL,
  sourceEventFactHash, sourceEventIdentity, sourceEventKey, snapshotSourceEvent, snapshotSourceEventReceipt,
} from '../source-event-contract.mjs';
import {custodyReceipt, ids, sourceEvent, NOW} from './source-event-fixture.mjs';

const invalid = (body, ...codes) => {
  const wanted = codes.length === 0 ? ['SOURCE_EVENT_INVALID'] : codes;
  return assert.rejects(async () => snapshotSourceEvent(body), error => wanted.includes(error.code));
};

test('one finite event per request: the closed envelope is accepted and frozen exactly once', () => {
  const event = snapshotSourceEvent(sourceEvent());
  assert.equal(event.producer, SOURCE_EVENT_PRODUCERS[0]);
  assert.equal(event.schemaVersion, 1);
  assert.equal(event.eventHash, sourceEventFactHash({tenantId: event.tenantId, alert: event.alert, source: event.source}));
  assert.ok(Object.isFrozen(event) && Object.isFrozen(event.alert));
  assert.equal(SOURCE_EVENT_PATH, '/v1/internal/routines/source-events');
  assert.equal(SOURCE_EVENT_PROTOCOL, 'meri.routines.source-event/1');
});

test('an event carries no prompt, scope grant, destination selector, budget or run identifier', async () => {
  for (const key of SOURCE_EVENT_FORBIDDEN_KEYS) await invalid({...sourceEvent(), [key]: 'anything'});
  for (const key of SOURCE_EVENT_FORBIDDEN_KEYS) await invalid({...sourceEvent(), routine: {...sourceEvent().routine, [key]: 'x'}});
  // Nested smuggling is refused too: the identity, routine, source and alert objects are closed.
  await invalid({...sourceEvent(), alert: {...sourceEvent().alert, prompt: 'x'}});
  await invalid({...sourceEvent(), source: {...sourceEvent().source, destination: 'x'}});
});

test('unknown, symbolic, accessor and proxy members are refused without invoking a getter', async () => {
  await invalid({...sourceEvent(), extra: 1});
  await assert.rejects(async () => snapshotSourceEvent({...sourceEvent(), [Symbol('s')]: 1}), error => error.code === 'SOURCE_EVENT_INVALID');
  let getters = 0;
  const hostile = {...sourceEvent()};
  Object.defineProperty(hostile, 'eventId', {get() { getters++; return ids.event; }});
  await invalid(hostile);
  assert.equal(getters, 0);
  await invalid(new Proxy(sourceEvent(), {}));
  for (const body of [null, undefined, 1, 'x', [], new Date()]) await invalid(body);
});

test('the producer allowlist and the schema version are closed', async () => {
  await invalid({...sourceEvent(), producer: 'bizdev.other.v1'}, 'SOURCE_EVENT_PRODUCER');
  await invalid({...sourceEvent(), producer: 'bizdev.watch.alert.v2'}, 'SOURCE_EVENT_PRODUCER');
  await invalid({...sourceEvent(), schemaVersion: 2});
  await invalid({...sourceEvent(), source: {sourceFamily: 'not_a_family', recordId: 'r', sourceRevision: null}});
  await invalid({...sourceEvent(), occurredAt: '2026-10-15T12:00:00.000Z '});
  assert.equal(snapshotSourceEvent(sourceEvent({source: {sourceRevision: null}})).source.sourceRevision, null);
});

test('an envelope must be self-consistent about its own bytes before any Core round-trip', async () => {
  const event = sourceEvent();
  await invalid({...event, eventHash: 'd'.repeat(64)}, 'SOURCE_EVENT_HASH');
  await invalid({...event, alert: {...event.alert, fingerprint: 'e'.repeat(64)}}, 'SOURCE_EVENT_HASH');
});

test('identity is producer + tenant + event id only, so changed bytes stay the SAME identity', () => {
  const first = snapshotSourceEvent(sourceEvent());
  const changed = snapshotSourceEvent(sourceEvent({alert: {fingerprint: 'f'.repeat(64)}}));
  assert.notEqual(first.eventHash, changed.eventHash);
  assert.equal(sourceEventKey(first), sourceEventKey(changed));
  assert.deepEqual(sourceEventIdentity(first), {protocol: SOURCE_EVENT_PROTOCOL, producer: first.producer, tenantId: first.tenantId, eventId: first.eventId});
  const other = snapshotSourceEvent(sourceEvent({eventId: ids.otherEvent}));
  assert.notEqual(sourceEventKey(first), sourceEventKey(other));
});

test('the canonical Core receipt is validated closed, with an explicit membership/client/source/consent vocabulary', () => {
  const event = snapshotSourceEvent(sourceEvent());
  const receipt = snapshotSourceEventReceipt(custodyReceipt(event));
  assert.equal(receipt.watch.status, 'active');
  assert.equal(receipt.consent.expiresAtMs, NOW + 60000);
  assert.deepEqual(Object.keys(receipt.watch), ['ownerActorId', 'status', 'membership', 'clientId', 'sourceState']);
  const cases = [
    {watch: {...custodyReceipt(event).watch, status: 'deleted'}},
    {watch: {...custodyReceipt(event).watch, clientId: 42}},
    {watch: {...custodyReceipt(event).watch, clientId: ''}},
    {consent: {consentId: ids.consent, state: 'withdrawn', expiresAtMs: NOW}},
    {alert: {...custodyReceipt(event).alert, sourceFamily: 'unknown_family'}},
    {unexpected: true},
  ];
  for (const changes of cases)
    assert.throws(() => snapshotSourceEventReceipt(custodyReceipt(event, changes)), error => error.code === 'SOURCE_EVENT_RECEIPT');
});
