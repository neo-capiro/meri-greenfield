import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { liveFixture, requestFor } from '../../../../../apps/control/qualification-sdk-fixture/service/test/fixture.mjs';

const root = process.env.G1_REVIEW_SOURCE_ROOT ?? resolve('.');
const { CommitUncertain } = await import(pathToFileURL(resolve(root,
  'apps/control/qualification-sdk-fixture/state/errors.mjs')));
const { createFixtureServiceHandlers } = await import(pathToFileURL(resolve(root,
  'apps/control/qualification-sdk-fixture/service/handlers.mjs')));

function setup(readback, beforeUnknown = () => {}) {
  const f = liveFixture(), controller = new AbortController(), events = [];
  const unknown = new CommitUncertain();
  let clock = Date.now();
  const control = { f, controller, unknown, events,
    expire() { clock = f.producer.identity.expiresAtMs; } };
  const registry = {
    async authorize() { events.push('authorize'); return { decision: 'AUTHORIZED', checkedAtMs: clock }; },
    async publishCommit() { events.push('publish'); beforeUnknown(control); throw unknown; },
    async readPublication() { events.push('read'); return readback(control); },
    async loadCheckpoint() { throw new Error('unexpected load'); },
    async verifyCheckpoint() { throw new Error('unexpected verify'); }
  };
  const checkpointStore = {
    async prepareCommit() { events.push('prepare'); return { receipt: f.receipt, readback: f.readback }; },
    async load() { throw new Error('unexpected object read'); }
  };
  const handlers = createFixtureServiceHandlers({ registry, checkpointStore, now: () => clock });
  control.run = () => handlers.commitFixtureCheckpoint({
    peer: { peerId: 'synthetic-task-a', credentialId: 'synthetic-credential-a' },
    producer: f.producer, context: f.producer,
    request: requestFor(f, 'commitFixtureCheckpoint'), signal: controller.signal
  });
  return control;
}

test('independent canceled unknown publication preserves original error without readback', async () => {
  const c = setup(() => assert.fail('readback forbidden'), c => c.controller.abort());
  await assert.rejects(c.run(), error => error === c.unknown);
  assert.deepEqual(c.events, ['authorize', 'prepare', 'publish']);
});

for (const change of ['abort', 'expiry']) test(`independent ${change} during parked readback preserves original uncertain liability`, async () => {
  let entered, release;
  const started = new Promise(r => { entered = r; });
  const c = setup(async c => {
    entered();
    await new Promise(r => { release = r; });
    return { outcome: 'COMMITTED', identity: c.f.reference };
  });
  const pending = c.run();
  await started;
  if (change === 'abort') c.controller.abort(); else c.expire();
  release();
  await assert.rejects(pending, error => error === c.unknown);
  assert.deepEqual(c.events, ['authorize', 'prepare', 'publish', 'read']);
});

test('independent readback outage retains original unknown commit, without retry', async () => {
  const c = setup(() => { throw new Error('synthetic read unavailable'); });
  await assert.rejects(c.run(), error => error === c.unknown);
  assert.deepEqual(c.events, ['authorize', 'prepare', 'publish', 'read']);
});

for (const outcome of ['foreign', 'absent', 'malformed']) test(`independent ${outcome} readback remains typed uncertain with content-free refusal`, async () => {
  const c = setup(c => outcome === 'malformed' ? null : outcome === 'absent'
    ? { outcome: 'NOT_COMMITTED' }
    : { outcome: 'COMMITTED', identity: { ...c.f.reference, receiptSha256: 'e'.repeat(64) } });
  await assert.rejects(c.run(), error => error instanceof CommitUncertain && error.code === 'FIXTURE_SERVICE_REFUSED');
  assert.deepEqual(c.events, ['authorize', 'prepare', 'publish', 'read']);
});

test('independent current exact immutable readback resolves uncertainty and releases canonical receipt', async () => {
  const c = setup(c => ({ outcome: 'COMMITTED', identity: c.f.reference }));
  const result = await c.run();
  assert.equal(result.status, 'COMMITTED');
  assert.deepEqual(result.receipt, c.f.receipt);
  assert.equal(result.completeRecoveryCheckpoint, false);
  assert.deepEqual(c.events, ['authorize', 'prepare', 'publish', 'read']);
});
