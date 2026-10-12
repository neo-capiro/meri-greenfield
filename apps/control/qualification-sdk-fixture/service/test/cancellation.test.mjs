import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSha256 } from '../../../../../packages/contracts/validate.mjs';
import { createFixtureServiceHandlers } from '../handlers.mjs';
import { CommitUncertain } from '../../state/errors.mjs';
import { liveFixture, requestFor } from './fixture.mjs';

const operations = ['authorizeFixturePhase', 'commitFixtureCheckpoint', 'loadFixtureCheckpoint', 'verifyFixtureCheckpoint'];
function setup(behavior = () => {}, adjust = () => {}) {
  const f = liveFixture(), controller = new AbortController(), calls = [];
  let nowMs = Date.now(); adjust(f, nowMs);
  const publication = { outcome: 'LOADED', receiptId: f.reference.receiptId,
    receiptSha256: f.reference.receiptSha256, bundleObjectId: f.receipt.bundle.objectId,
    bundleVersionId: f.receipt.bundle.versionId, bundleSha256: f.receipt.bundle.sha256,
    bundleBytes: f.receipt.bundle.bytes, workspaceSha256: f.receipt.workspaceSha256 };
  const port = async (name, value) => { calls.push(name); await behavior(name, { controller, f,
    expire: () => { nowMs = f.current.identity.expiresAtMs; } }); return value; };
  const handlers = createFixtureServiceHandlers({ now: () => nowMs, registry: {
    authorize: () => port('authorize', { decision: 'AUTHORIZED', checkedAtMs: nowMs }),
    publishCommit: () => port('publish', { outcome: 'COMMITTED', identity: f.reference }),
    readPublication: () => port('reconcile', { outcome: 'COMMITTED', identity: f.reference }),
    loadCheckpoint: () => port('registry-load', publication),
    verifyCheckpoint: () => port('verify', { outcome: 'VERIFIED', ...f.reference }),
  }, checkpointStore: {
    prepareCommit: () => port('prepare', { receipt: f.receipt, readback: f.readback }),
    load: () => port('objects', { receipt: f.receipt, readback: f.readback, bundle: f.bundle, fixtureFile: f.sentinel }),
  } });
  const invoke = operation => handlers[operation]({ peer: { peerId: 'synthetic', credentialId: 'synthetic' },
    context: f.current, producer: f.producer, request: requestFor(f, operation), signal: controller.signal });
  return { invoke, calls, controller };
}
for (const operation of operations) test(`pre-aborted ${operation} does not start any port`, async () => {
  const h = setup(); h.controller.abort(); await assert.rejects(h.invoke(operation));
  assert.deepEqual(h.calls, []);
});
for (const [operation, final] of [['authorizeFixturePhase', 'authorize'],
  ['commitFixtureCheckpoint', 'publish'], ['loadFixtureCheckpoint', 'registry-load'],
  ['verifyFixtureCheckpoint', 'verify']]) test(`cancelled ${operation} final response is refused`, async () => {
  let n = 0;
  const h = setup((name, { controller }) => {
    if (name === final && (final !== 'registry-load' || ++n === 2)) controller.abort();
  });
  await assert.rejects(h.invoke(operation)); assert.equal(h.calls.at(-1), final);
});
test('expiry after object preparation prevents publication', async () => {
  const h = setup((name, { expire }) => { if (name === 'prepare') expire(); });
  await assert.rejects(h.invoke('commitFixtureCheckpoint'));
  assert.deepEqual(h.calls, ['authorize', 'prepare']);
});
test('abort during late ambiguous publish propagates ambiguity without starting reconciliation', async () => {
  const error = new CommitUncertain();
  const h = setup((name, { controller }) => { if (name === 'publish') { controller.abort(); throw error; } });
  await assert.rejects(h.invoke('commitFixtureCheckpoint'), e => e === error);
  assert.deepEqual(h.calls, ['authorize', 'prepare', 'publish']);
});
test('expiry during ambiguity readback refuses a successful response', async () => {
  const h = setup((name, { expire }) => {
    if (name === 'publish') throw new CommitUncertain();
    if (name === 'reconcile') expire();
  });
  await assert.rejects(h.invoke('commitFixtureCheckpoint'));
  assert.deepEqual(h.calls, ['authorize', 'prepare', 'publish', 'reconcile']);
});
test('expired historical A does not block current B load or verification', async () => {
  const h = setup(undefined, (f, nowMs) => {
    f.producer.identity.expiresAtMs = nowMs - 1;
    f.receipt.producer = structuredClone(f.producer);
    f.reference.receiptSha256 = canonicalSha256(f.receipt);
  });
  assert.equal((await h.invoke('loadFixtureCheckpoint')).status, 'LOADED');
  assert.equal((await h.invoke('verifyFixtureCheckpoint')).status, 'VERIFIED');
});
for (const change of ['abort', 'expiry', 'rejection']) test(`parked ambiguity readback ${change} preserves original uncertainty`, async () => {
  const uncertain = new CommitUncertain();
  let entered, release;
  const enteredPromise = new Promise(resolve => { entered = resolve; });
  const parked = new Promise(resolve => { release = resolve; });
  const h = setup(async (name, controls) => {
    if (name === 'publish') throw uncertain;
    if (name === 'reconcile') {
      entered(); await parked;
      if (change === 'abort') controls.controller.abort();
      if (change === 'expiry') controls.expire();
      if (change === 'rejection') throw new Error('synthetic-readback-unavailable');
    }
  });
  const pending = h.invoke('commitFixtureCheckpoint');
  await enteredPromise; release();
  await assert.rejects(pending, error => error === uncertain);
  assert.deepEqual(h.calls, ['authorize', 'prepare', 'publish', 'reconcile']);
});
test('foreign ambiguity readback preserves typed uncertainty and original refusal code', async () => {
  const h = setup((name, { f }) => {
    if (name === 'publish') throw new CommitUncertain();
    if (name === 'reconcile') f.reference.receiptSha256 = 'f'.repeat(64);
  });
  await assert.rejects(h.invoke('commitFixtureCheckpoint'), error =>
    error instanceof CommitUncertain && error.code === 'FIXTURE_SERVICE_REFUSED');
});
