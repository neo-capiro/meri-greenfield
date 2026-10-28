// The REAL composed control route for MB-05 producer events: the production composer
// (`composeSourceEventMount`) — the same call startControl makes — mounted through the real
// private/public route boundary, over the real receiver, binding, source-event store and the real
// canonical scheduled-dispatch owner. Scripted SQL, scripted Core custody and scripted Temporal are
// the resources (the repo's usual composition standard); no model, provider, database, network or
// browser is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlRouteApplications} from '../control-route-boundary.mjs';
import {composeSourceEventMount} from '../source-event-application.mjs';
import {sourceEventFixture, harnessIds, ids, sourceEvent, NOW} from '../../control/schedules/test/source-event-fixture.mjs';
import {SOURCE_EVENT_PATH, SOURCE_EVENT_BINDING_PATH} from '../../control/schedules/source-event-contract.mjs';
import {coreSigner} from '../native-authority/test/routines-core-fixture.mjs';

const SECRET = 'synthetic-service-secret';
const PAIR = Object.freeze({
  tenantId: 'tenant-a', scheduleId: harnessIds.schedule, producer: 'bizdev.watch.alert.v1',
  sourceFamily: 'federal_award', resourceKey: ids.watch,
});

/**
 * The composed client is the real custody client; only its socket is local. It answers exactly one
 * route — Core's canonical custody read — with the fact set for the event it was asked about, and
 * nothing else, so the receiver's own agreement checks run against a real canonical receipt.
 */
function custodyFetch(h) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const path = new URL(url).pathname;
    calls.push({path, body: JSON.parse(init.body), secret: init.headers['x-internal-service-secret'], authorization: init.headers.authorization ?? null});
    if (path !== '/api/internal/routines/source-events/current') return new Response('', {status: 404});
    if (init.headers['x-internal-service-secret'] !== SECRET) return new Response('', {status: 401});
    const asked = JSON.parse(init.body);
    const event = {producer: asked.producer, tenantId: asked.tenantId, eventId: asked.eventId, eventHash: asked.eventHash,
      alert: {alertId: ids.alert, watchId: ids.watch, prospectId: ids.prospect, dedupeKey: `federal_award:rec-1:${'b'.repeat(64)}`, fingerprint: 'c'.repeat(64)},
      source: {sourceFamily: 'federal_award', recordId: 'rec-1', sourceRevision: 'rev-1'}};
    return Response.json(h.custodyReceipt(event));
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

async function composed({bind = true, noPrivateListener = false, routines = true, template = true} = {}) {
  const h = await sourceEventFixture();
  if (bind) await h.binding.bind(PAIR);
  const signer = coreSigner();
  const configuration = {
    privateHttp: noPrivateListener ? undefined : {},
    limits: {requestMs: 5000},
    models: {},
    temporal: {taskQueue: 'meri-conversations'},
    versions: {imageDigest: `sha256:${'a'.repeat(64)}`, sdk: '0.3.295', cli: '2.1.295', contracts: '0.1.0'},
    routines: routines
      ? {enabled: true, core: {origin: 'https://core.synthetic.invalid', serviceSecretFile: '/synthetic/routines-service', unattendedGrant: signer.pin}}
      : {enabled: false},
  };
  const custody = custodyFetch(h);
  const sourceEvents = composeSourceEventMount({
    configuration, pool: h.pool, client: h.temporal.client,
    candidate: {routinesOccurrenceOwners: template ? {template: {synthetic: true}, async retirement() {}} : undefined},
    // The schedule-domain dispatch owner is the REAL createScheduledDispatch owner the harness
    // composed over the scripted resources — supplied exactly as the sibling composer borrows owners.
    ports: {owners: {dispatch: h.scheduled}},
    // The Core custody transport is scripted at the HTTP boundary exactly as the sibling composer's
    // trusted seam does: the composed client is the real one, only its socket is local. The clock is
    // the fixture's frozen clock, so the receipt's own validity window is exercised for real.
    now: () => NOW,
    transport: {readSecret: async () => Buffer.from(SECRET, 'utf8'), fetchImpl: custody},
  });
  const reached = {assembly: 0, candidate: 0};
  const boundary = createControlRouteApplications({
    assembly: {async handle() { reached.assembly += 1; return null; }},
    candidate: {async handle() { reached.candidate += 1; return null; }},
    sourceEvents,
  });
  const post = (path, body, headers = {}) => boundary.private.handle(new Request(`https://meri.internal${path}`, {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-internal-service-secret': SECRET, ...headers},
    body: JSON.stringify(body),
  }));
  const json = response => response.json();
  return {h, sourceEvents, boundary, post, json, reached, custody};
}

test('the private route delivers a real canonical receipt to the actual receiver and dispatches one occurrence', async () => {
  const {h, sourceEvents, post, json, reached, custody} = await composed();
  assert.deepEqual(sourceEvents.paths, [SOURCE_EVENT_PATH, SOURCE_EVENT_BINDING_PATH]);
  const event = sourceEvent();
  h.authorize(event);
  const response = await post(SOURCE_EVENT_PATH, event);
  assert.equal(response.status, 200);
  const body = await json(response);
  assert.equal(body.outcome, 'DISPATCHED');
  assert.equal(body.sourceEvent.dispatched, true);
  // The canonical Core custody read went over the composed service-identity transport: one call, on
  // the exact fixed Core route, with the shared service secret and never a bearer.
  assert.equal(custody.calls.length, 1);
  assert.deepEqual(custody.calls[0], {
    path: '/api/internal/routines/source-events/current', secret: SECRET, authorization: null,
    body: {schemaVersion: 1, producer: event.producer, tenantId: event.tenantId, eventId: event.eventId,
      eventHash: event.eventHash, scheduleId: harnessIds.schedule, generation: 1},
  });
  assert.equal(h.eventRow(ids.event).state, 'DISPATCHED');
  assert.equal(h.temporal.calls.start, 1);
  assert.equal(h.runCount(), 1);
  // The event route is answered by the mount: it never falls through to the candidate or assembly.
  assert.deepEqual(reached, {assembly: 0, candidate: 0});
});

test('a bearer and a public-listener request are denied before any dispatch', async () => {
  const {h, boundary, post, custody} = await composed();
  const event = sourceEvent();
  h.authorize(event);
  // An unattended producer never presents a user bearer, and it is refused rather than reinterpreted.
  assert.equal((await post(SOURCE_EVENT_PATH, event, {authorization: 'Bearer synthetic-session'})).status, 401);
  assert.equal((await post(SOURCE_EVENT_PATH, event, {'x-internal-service-secret': 'wrong-secret'})).status, 401);
  // The same fixed path on the public listener is not a route at all.
  const publicAttempt = await boundary.public.handle(new Request(`https://meri.internal${SOURCE_EVENT_PATH}`, {
    method: 'POST', headers: {'content-type': 'application/json', 'x-internal-service-secret': SECRET}, body: JSON.stringify(event),
  }));
  assert.equal(publicAttempt.status, 404);
  // Nothing was read from custody, written durably or dispatched.
  assert.equal(custody.calls.length, 0);
  assert.equal(h.rows().size, 0);
  assert.equal(h.temporal.calls.start, 0);
});

test('only the two exact fixed paths reach the mount; every other path stays foreign', async () => {
  const {h, boundary, post, json, reached} = await composed();
  const event = sourceEvent();
  h.authorize(event);
  // A neighbouring path under the same private prefix is NOT the event route.
  assert.equal((await post(`${SOURCE_EVENT_PATH}/other`, event)).status, 404);
  assert.equal(reached.candidate, 1);
  assert.equal(h.rows().size, 0);
  assert.equal(h.temporal.calls.start, 0);
  // A query or fragment is never a second identity for the route.
  assert.equal((await boundary.private.handle(new Request(`https://meri.internal${SOURCE_EVENT_PATH}?tenant=tenant-b`, {
    method: 'POST', headers: {'content-type': 'application/json', 'x-internal-service-secret': SECRET}, body: JSON.stringify(event),
  }))).status, 404);
  // A non-POST method on the exact path is refused by the route itself.
  assert.equal((await boundary.private.handle(new Request(`https://meri.internal${SOURCE_EVENT_PATH}`, {
    method: 'GET', headers: {'x-internal-service-secret': SECRET},
  }))).status, 405);
  // The binding read is the second exact path, and it exposes the pins and nothing of the routine work.
  const read = await post(SOURCE_EVENT_BINDING_PATH, {schemaVersion: 1, producer: PAIR.producer, tenantId: PAIR.tenantId, sourceFamily: PAIR.sourceFamily, resourceKey: PAIR.resourceKey});
  assert.equal(read.status, 200);
  const body = await json(read);
  assert.deepEqual(body, {outcome: 'BINDING_READ', binding: {scheduleId: harnessIds.schedule, generation: 1}});
  assert.equal(h.temporal.calls.start, 0);
});

test('a mount that cannot be composed leaves both fixed routes 404 instead of half-wiring', async () => {
  for (const options of [{noPrivateListener: true}, {routines: false}, {template: false}]) {
    const {sourceEvents, boundary, h} = await composed(options);
    assert.equal(sourceEvents, null);
    for (const path of [SOURCE_EVENT_PATH, SOURCE_EVENT_BINDING_PATH]) {
      const response = await boundary.private.handle(new Request(`https://meri.internal${path}`, {
        method: 'POST', headers: {'content-type': 'application/json', 'x-internal-service-secret': SECRET}, body: JSON.stringify(sourceEvent()),
      }));
      assert.equal(response.status, 404);
    }
    assert.equal(h.temporal.calls.start, 0);
    assert.equal(h.rows().size, 0);
  }
});
