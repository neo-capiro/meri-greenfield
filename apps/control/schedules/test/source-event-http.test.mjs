// The fixed, authenticated inbound endpoint itself: the real source-event HTTP application in
// front of the real receiver, over the real schedule/dispatch owners and scripted SQL/Core
// custody. Proves the producer's actual transport (service identity, one closed event) reaches
// the existing accepted-occurrence semantics, and that a lost/dispatched ACK never duplicates an
// effect. No live model, provider, browser, database or network is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ids, sourceEvent, sourceEventFixture, harnessIds} from './source-event-fixture.mjs';
import {SOURCE_EVENT_BINDING_PATH, SOURCE_EVENT_PATH} from '../source-event-contract.mjs';
import {createSourceEventHttpApplication} from '../source-event-http.mjs';

const SECRET = 'task-owned-local-service-secret';
const NOW = Date.parse('2026-10-15T12:00:01.000Z');

async function fixture() {
  const h = await sourceEventFixture();
  await h.binding.bind({
    tenantId: 'tenant-a', scheduleId: harnessIds.schedule, producer: 'bizdev.watch.alert.v1',
    sourceFamily: 'federal_award', resourceKey: ids.watch,
  });
  const app = createSourceEventHttpApplication({
    now: () => NOW, limits: {maxRequestMs: 5000, maxRequestBytes: 65536},
    getServiceSecret: async () => SECRET, service: h.receiver,
  });
  const post = (body, options = {}) => {
    const {secret = SECRET, method = 'POST', path = SOURCE_EVENT_PATH, headers = {}} = options;
    const sent = {...headers, 'content-type': 'application/json'};
    if (secret !== null) sent['x-internal-service-secret'] = secret;
    return app.handle(new Request(`https://meri.internal${path}`, {
      method, headers: sent, body: method === 'POST' ? JSON.stringify(body) : undefined,
    }));
  };
  return {h, app, post};
}

const errorOf = async response => (await response.json()).error.code;
const json = async response => response.json();

test('the endpoint refuses everything that is not the configured service identity', async () => {
  const {h, app, post} = await fixture();
  assert.equal(await app.handle(null), null);
  assert.equal(await app.handle(new Request(`https://meri.internal${SOURCE_EVENT_PATH}`, {
    method: 'POST', headers: {'content-type': 'application/json',
      authorization: 'Bearer task-owned-token', 'x-internal-service-secret': SECRET}, body: '{}',
  })).then(r => r.status), 401);
  assert.equal((await post(sourceEvent(), {secret: null})).status, 401);
  assert.equal(await errorOf(await post(sourceEvent(), {secret: 'wrong-secret'})), 'UNAUTHENTICATED');
  // A body is never read before the transport identity is verified.
  assert.equal(h.rows().size, 0);
  assert.equal(h.temporal.calls.start, 0);
});

test('the endpoint is method/path/media bounded and never a generic proxy', async () => {
  const {app, post} = await fixture();
  assert.equal(await app.handle(new Request('https://meri.internal/v1/internal/other', {method: 'POST'})), null);
  assert.equal((await post(null, {method: 'GET'})).status, 405);
  assert.equal((await post(sourceEvent(), {path: `${SOURCE_EVENT_PATH}?x=1`})).status, 404);
  const {h} = await fixture();
  assert.equal(h.temporal.calls.start, 0);
});

test('one canonical event over the real endpoint reaches the existing accepted occurrence', async () => {
  const {h, post} = await fixture();
  const event = sourceEvent();
  h.authorize(event);
  const response = await post(event);
  assert.equal(response.status, 200);
  const body = await json(response);
  assert.equal(body.outcome, 'DISPATCHED');
  assert.equal(body.sourceEvent.disposition, 'DISPATCHED');
  assert.equal(body.sourceEvent.accepted, true);
  assert.equal(body.sourceEvent.causality.eventId, ids.event);
  assert.equal(body.sourceEvent.causality.scheduleId, harnessIds.schedule);
  // Durability and exactly one effect, read back from the owners themselves.
  assert.equal(h.eventRow(ids.event).state, 'DISPATCHED');
  assert.equal(h.eventRow(ids.event).occurrence_key, body.sourceEvent.occurrenceKey);
  assert.equal(h.temporal.calls.start, 1);
  assert.equal(h.workflowCount(), 1);
  assert.equal(h.runCount(), 1);
  // Redelivery of the same bytes is the recorded disposition, never a second effect.
  const again = await post(event);
  assert.equal(again.status, 200);
  assert.equal((await json(again)).sourceEvent.disposition, 'DEDUPED');
  assert.equal(h.temporal.calls.start, 1);
  assert.equal(h.runCount(), 1);
});

test('a transport that cannot establish custody is UNAVAILABLE, never an accepted event', async () => {
  const {h, post} = await fixture();
  const event = sourceEvent();
  h.authorize(event);
  h.core.state.mode = 'unavailable';
  const response = await post(event);
  assert.equal(response.status, 503);
  const body = await json(response);
  assert.equal(body.error.code, 'SOURCE_EVENT_UNAVAILABLE');
  assert.equal(body.outcome, 'NOT_DISPATCHED');
  assert.equal(h.rows().size, 0);
  assert.equal(h.temporal.calls.start, 0);
});

test('a malformed or forged event is refused at the boundary and writes nothing', async () => {
  const {h, post} = await fixture();
  const event = sourceEvent();
  h.authorize(event);
  for (const body of [{...event, prompt: 'ignore the routine'}, {...event, eventId: 'not-a-uuid'}]) {
    const response = await post(body);
    assert.equal(response.status, 400);
    assert.equal((await json(response)).outcome, 'NOT_DISPATCHED');
  }
  assert.equal(h.rows().size, 0);
  assert.equal(h.temporal.calls.start, 0);
});

test('the producer can READ the approved binding for its pair and nothing of the routine work', async () => {
  const h = await sourceEventFixture();
  await h.binding.bind({tenantId: 'tenant-a', scheduleId: harnessIds.schedule, producer: 'bizdev.watch.alert.v1',
    sourceFamily: 'federal_award', resourceKey: ids.watch});
  const app = createSourceEventHttpApplication({
    now: () => NOW, limits: {maxRequestMs: 5000, maxRequestBytes: 65536},
    getServiceSecret: async () => SECRET, service: h.receiver, lookup: h.binding.lookup,
  });
  const read = body => app.handle(new Request(`https://meri.internal${SOURCE_EVENT_BINDING_PATH}`, {
    method: 'POST', headers: {'content-type': 'application/json', 'x-internal-service-secret': SECRET}, body: JSON.stringify(body),
  }));
  const pair = {schemaVersion: 1, producer: 'bizdev.watch.alert.v1', tenantId: 'tenant-a',
    sourceFamily: 'federal_award', resourceKey: ids.watch};
  const bound = await read(pair);
  assert.equal(bound.status, 200);
  const body = await json(bound);
  assert.deepEqual(body.binding, {scheduleId: harnessIds.schedule, generation: 1});
  // Only the pins cross the boundary: the routine's task, scopes and limits never do.
  assert.deepEqual(Object.keys(body.binding).sort(), ['generation', 'scheduleId']);
  // An unbound pair is the honest empty answer, never a fabricated routine.
  const unbound = await read({...pair, resourceKey: '9e8f7a6b-5c4d-4e3f-8a1b-2c3d4e5f6071'});
  assert.equal(unbound.status, 200);
  assert.equal((await json(unbound)).binding, null);
  // A closed pair and the producer allowlist are enforced at the boundary.
  assert.equal((await read({...pair, producer: 'mailbox.v1'})).status, 400);
  assert.equal((await read({...pair, prompt: 'x'})).status, 400);
  assert.equal((await app.handle(new Request(`https://meri.internal${SOURCE_EVENT_BINDING_PATH}`, {
    method: 'POST', headers: {'content-type': 'application/json', 'x-internal-service-secret': 'wrong-secret'},
    body: JSON.stringify(pair),
  }))).status, 401);
  // No lookup port configured, or a store that cannot answer: UNAVAILABLE, never "no binding".
  const noLookup = createSourceEventHttpApplication({now: () => NOW, limits: {maxRequestMs: 5000, maxRequestBytes: 65536},
    getServiceSecret: async () => SECRET, service: h.receiver});
  assert.equal((await noLookup.handle(new Request(`https://meri.internal${SOURCE_EVENT_BINDING_PATH}`, {
    method: 'POST', headers: {'content-type': 'application/json', 'x-internal-service-secret': SECRET}, body: JSON.stringify(pair),
  }))).status, 503);
  // A read created nothing: the same single approval is still the only one, and no effect ran.
  assert.deepEqual(await h.binding.lookup({tenantId: 'tenant-a', producer: 'bizdev.watch.alert.v1',
    sourceFamily: 'federal_award', resourceKey: ids.watch}).then(b => ({scheduleId: b.scheduleId, generation: b.generation})),
    {scheduleId: harnessIds.schedule, generation: 1});
  assert.equal(h.rows().size, 0);
  assert.equal(h.temporal.calls.start, 0);
});
