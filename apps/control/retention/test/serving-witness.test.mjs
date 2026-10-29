import test from 'node:test';
import assert from 'node:assert/strict';
import {createRetentionWitnessApplication, RETENTION_WITNESS_PATH} from '../serving-witness.mjs';
import {createRetentionStartup} from '../startup.mjs';
import {createControlRouteApplications} from '../../../runtime/control-route-boundary.mjs';
import {composeStartup, subjectOf, ownership} from './fixture.mjs';

const credential = 'synthetic-retention-service-secret';
const request = (suffix = '', init = {}) => new Request('https://control.invalid' + RETENTION_WITNESS_PATH + suffix,
  {headers: {'x-internal-service-secret': credential}, ...init});
const application = (startup, options = {}) => createRetentionWitnessApplication({startup, getServiceSecret: async () => credential, ...options});

test('mounted witness is private-only, content-free, current, and absent without its owner', async () => {
  const f = composeStartup(); await f.startup.start();
  const absent = {handle() { throw Error('must not fall through'); }};
  const routes = createControlRouteApplications({assembly: absent, candidate: absent, retentionWitness: application(f.startup)});
  assert.equal((await routes.public.handle(request())).status, 404);
  assert.equal((await createControlRouteApplications({assembly: absent, candidate: absent}).private.handle(request())).status, 404);
  const first = await routes.private.handle(request());
  assert.equal(first.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await first.json(), {schemaVersion: 1, sequence: 0, entrySha256: null});
  await f.startup.suppression.suppress({principal: f.principal, subject: subjectOf(), reason: 'synthetic suppression'});
  const second = await routes.private.handle(request());
  assert.deepEqual(await second.json(), {schemaVersion: 1, ...await f.startup.ledger.head()});
  assert.equal(f.rowPurges.length, 0); assert.equal(f.deletes.length, 0);
});

test('startup and restored-away suppression refuse until canonical readiness recovers; witness never recovers itself', async () => {
  const f = composeStartup(), app = application(f.startup);
  assert.equal((await app.handle(request())).status, 503);
  await f.startup.start(); const saved = f.backup();
  const reader = createRetentionStartup({journal: f.journal, watermark: f.watermark, ledgerSink: f.sink, ownership, purge: {enabled: false}, now: f.clock.now});
  await reader.start();
  await f.startup.suppression.suppress({principal: f.principal, subject: subjectOf(), reason: 'unseen suppression'});
  f.restore(saved);
  const independent = application(reader);
  assert.equal((await independent.handle(request())).status, 503);
  assert.equal((await f.watermark.read()).sequence, 0, 'request did not reconcile or write the restored database');
  assert.equal((await independent.handle(request())).status, 503, 'a closed fence stays closed');
  await reader.ensureServing();
  assert.deepEqual(await (await independent.handle(request())).json(), {schemaVersion: 1, ...await reader.ledger.head()});
  assert.equal((await f.watermark.read()).sequence, 1);
});

test('missing dependencies, unreadable external ledger and mismatched database proofs do not issue a witness', async () => {
  for (const options of [{ledger: false}, {watermark: false}]) {
    const f = composeStartup(options);
    assert.equal((await application(f.startup).handle(request())).status, 503);
  }
  const f = composeStartup(); let failed = false;
  const startup = createRetentionStartup({journal: f.journal, watermark: f.watermark, ledgerSink: {
    append: f.sink.append, read: () => { if (failed) throw Error('private storage details'); return f.sink.read(); },
  }, purge: {enabled: false}, now: f.clock.now});
  await startup.start(); failed = true;
  assert.deepEqual(await (await application(startup).handle(request())).json(), {error: {code: 'RETENTION_WITNESS_UNAVAILABLE'}});
  const g = composeStartup(); await g.startup.start();
  await g.watermark.record({sequence: 1, entrySha256: null});
  assert.equal((await application(g.startup).handle(request())).status, 503);
});

test('only the current transport secret can read; a bearer or query cannot select identity or widen the route', async () => {
  let reads = 0, current = credential;
  const app = application({readServingWitness() { reads++; return {sequence: 0, entrySha256: null}; }}, {getServiceSecret: async () => current});
  for (const headers of [{}, {authorization: 'Bearer ' + credential}, {'x-internal-service-secret': 'x'.repeat(credential.length)}])
    assert.equal((await app.handle(request('', {headers}))).status, 503);
  assert.equal(reads, 0);
  assert.equal((await app.handle(request())).status, 200); current = 'rotated-synthetic-service-secret';
  assert.equal((await app.handle(request())).status, 503); assert.equal(reads, 1);
  for (const value of [request('?tenantId=synthetic'), request('', {method: 'POST', body: '{}'}), request('', {headers: {'content-length': '1'}})])
    assert.equal((await app.handle(value)).status, 400);
  assert.equal(await app.handle(request('/extra')), null);
});

test('deadline and disconnect discard late results without changing canonical recovery ownership', async () => {
  for (const disconnect of [false, true]) {
    const pending = Promise.withResolvers(), entered = Promise.withResolvers(), controller = new AbortController();
    const app = application({readServingWitness() { entered.resolve(); return pending.promise; }}, {maxRequestMs: 30});
    const result = app.handle(request('', {signal: controller.signal}));
    await entered.promise; if (disconnect) controller.abort();
    assert.equal((await result).status, 503);
    pending.resolve({sequence: 0, entrySha256: null});
  }
});

test('suppression followed by release changes the witness even when the subject is readable again', async () => {
  const f = composeStartup(), subject = subjectOf(); await f.startup.start();
  const before = await f.startup.readServingWitness();
  await f.startup.suppression.suppress({principal: f.principal, subject, reason: 'synthetic suppression'});
  await f.startup.suppression.release({principal: f.principal, subject, reason: 'synthetic permitted restore'});
  await f.startup.gate.assertServable(subject);
  const after = await f.startup.readServingWitness();
  assert.equal(before.sequence, 0); assert.equal(after.sequence, 2);
  assert.notDeepEqual(before, after, 'Core can detect an intervening suppression/release, not only the final readable state');
});
