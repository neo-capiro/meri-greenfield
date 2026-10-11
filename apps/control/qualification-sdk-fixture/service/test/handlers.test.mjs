import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureServiceHandlers } from '../handlers.mjs';
import { liveFixture, requestFor } from './fixture.mjs';

const peerA = Object.freeze({ peerId: 'synthetic-task-a', credentialId: 'synthetic-credential-a' });
const peerB = Object.freeze({ peerId: 'synthetic-task-b', credentialId: 'synthetic-credential-b' });

function composition(f, overrides = {}) {
  const calls = { prepared: 0, loaded: 0, verified: 0, reconciled: 0 };
  const publication = { outcome: 'LOADED', receiptId: f.reference.receiptId,
    receiptSha256: f.reference.receiptSha256, bundleObjectId: f.receipt.bundle.objectId,
    bundleVersionId: f.receipt.bundle.versionId, bundleSha256: f.receipt.bundle.sha256,
    bundleBytes: f.receipt.bundle.bytes, workspaceSha256: f.receipt.workspaceSha256 };
  const registry = {
    authorize: async () => ({ decision: 'AUTHORIZED', checkedAtMs: Date.now() }),
    publishCommit: async () => ({ outcome: 'COMMITTED', identity: f.reference }),
    readPublication: async () => { calls.reconciled++; return { outcome: 'COMMITTED', identity: f.reference }; },
    loadCheckpoint: async () => publication,
    verifyCheckpoint: async () => { calls.verified++; return { outcome: 'VERIFIED', ...f.reference }; },
    ...overrides.registry,
  };
  const checkpointStore = {
    prepareCommit: async () => { calls.prepared++; return { receipt: f.receipt, readback: f.readback }; },
    load: async () => { calls.loaded++; return { receipt: f.receipt, bundle: f.bundle,
      fixtureFile: f.sentinel, readback: f.readback }; },
    ...overrides.checkpointStore,
  };
  return { calls, handlers: createFixtureServiceHandlers({ registry, checkpointStore }) };
}

const call = (f, operation, request) => ({ peer: operation === 'commitFixtureCheckpoint' ? peerA : peerB,
  context: f.current, producer: f.producer, request: request ?? requestFor(f, operation),
  signal: new AbortController().signal });

test('fixed handlers correlate committed A receipt and loaded/verified B bytes', async () => {
  const f = liveFixture(), { handlers, calls } = composition(f);
  const committed = await handlers.commitFixtureCheckpoint(call(f, 'commitFixtureCheckpoint'));
  assert.equal(committed.status, 'COMMITTED');
  const loaded = await handlers.loadFixtureCheckpoint(call(f, 'loadFixtureCheckpoint'));
  assert.equal(loaded.status, 'LOADED');
  assert.deepEqual(loaded.bundle, f.bundle);
  const verified = await handlers.verifyFixtureCheckpoint(call(f, 'verifyFixtureCheckpoint'));
  assert.equal(verified.status, 'VERIFIED');
  assert.deepEqual(calls, { prepared: 1, loaded: 2, verified: 1, reconciled: 0 });
});

test('a lost publication acknowledgement is reconciled to the exact receipt once', async () => {
  const f = liveFixture();
  const { CommitUncertain } = await import('../../state/errors.mjs');
  const { handlers, calls } = composition(f, { registry: {
    publishCommit: async () => { throw new CommitUncertain(); },
  } });
  assert.equal((await handlers.commitFixtureCheckpoint(call(f, 'commitFixtureCheckpoint'))).status,
    'COMMITTED');
  assert.equal(calls.prepared, 1);
  assert.equal(calls.reconciled, 1);
});

test('substituted stored publication bytes and uncertain foreign receipts refuse', async () => {
  const f = liveFixture();
  const badBundle = structuredClone(f.bundle);
  badBundle.files[0].base64 = Buffer.from('substituted').toString('base64');
  const first = composition(f, { checkpointStore: {
    load: async () => ({ receipt: f.receipt, bundle: badBundle,
      fixtureFile: f.sentinel, readback: f.readback }),
  } });
  await assert.rejects(first.handlers.loadFixtureCheckpoint(call(f, 'loadFixtureCheckpoint')));
  const { CommitUncertain } = await import('../../state/errors.mjs');
  const second = composition(f, { registry: {
    publishCommit: async () => { throw new CommitUncertain(); },
    readPublication: async () => ({ outcome: 'COMMITTED',
      identity: { ...f.reference, receiptSha256: 'f'.repeat(64) } }),
  } });
  await assert.rejects(second.handlers.commitFixtureCheckpoint(call(f, 'commitFixtureCheckpoint')),
    /FIXTURE_SERVICE_REFUSED/);
});

test('a stale A commit is refused before object preparation', async () => {
  const f = liveFixture();
  const { handlers, calls } = composition(f, { registry: {
    authorize: async () => ({ decision: 'DENIED_STALE_BINDING', checkedAtMs: Date.now() }),
  } });
  await assert.rejects(handlers.commitFixtureCheckpoint(call(f, 'commitFixtureCheckpoint')),
    /FIXTURE_SERVICE_REFUSED/);
  assert.equal(calls.prepared, 0);
});

test('a disconnected commit leaves prepared objects uncommitted', async () => {
  const f = liveFixture(), controller = new AbortController();
  let publications = 0, preparations = 0;
  const { handlers } = composition(f, { registry: {
    publishCommit: async () => { publications++; throw new Error('unexpected publication'); },
  }, checkpointStore: {
    prepareCommit: async () => {
      preparations++;
      controller.abort();
      return { receipt: f.receipt, readback: f.readback };
    },
  } });
  await assert.rejects(handlers.commitFixtureCheckpoint({
    ...call(f, 'commitFixtureCheckpoint'), signal: controller.signal,
  }), /FIXTURE_SERVICE_REFUSED/);
  assert.equal(preparations, 1);
  assert.equal(publications, 0);
});

test('a B grant revoked during object read refuses before returning loaded bytes', async () => {
  const f = liveFixture();
  let reads = 0;
  const { handlers, calls } = composition(f, { registry: {
    loadCheckpoint: async () => {
      if (++reads === 1) return { outcome: 'LOADED', receiptId: f.reference.receiptId,
        receiptSha256: f.reference.receiptSha256, bundleObjectId: f.receipt.bundle.objectId,
        bundleVersionId: f.receipt.bundle.versionId, bundleSha256: f.receipt.bundle.sha256,
        bundleBytes: f.receipt.bundle.bytes, workspaceSha256: f.receipt.workspaceSha256 };
      throw new Error('FIXTURE_GRANT_REVOKED');
    },
  } });
  await assert.rejects(handlers.loadFixtureCheckpoint(call(f, 'loadFixtureCheckpoint')),
    /FIXTURE_GRANT_REVOKED/);
  assert.equal(calls.loaded, 1);
  assert.equal(reads, 2);
});
