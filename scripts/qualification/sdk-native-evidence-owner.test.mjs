// Synthetic keys, process/namespace observations, authorization and S3 only.
// These tests never run an SDK, native child, database, listener or AWS client.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { decodeFixtureRequest } from
  '../../packages/contracts/qualification-sdk/wire.mjs';
import { fixtureReceiptIdentity } from '../../packages/contracts/qualification-sdk/validate.mjs';
import { fixture, NOW, wire } from
  '../../apps/control/qualification-sdk-fixture/ingress/test/fixture-data.mjs';
import { bucket, kmsKeyArn, fakeS3 } from
  '../../apps/control/qualification-sdk-fixture/service/test/fake-s3.mjs';
import { createS3FixtureObjects, createS3NativeEvidenceObjects } from
  '../../apps/control/qualification-sdk-fixture/service/s3-objects.mjs';
import { createNativeEvidenceInspector } from
  '../../apps/control/qualification-sdk-fixture/service/native-evidence.mjs';
import { createS3CheckpointStore } from
  '../../apps/control/qualification-sdk-fixture/service/checkpoint-store.mjs';
import { createFixtureChannel } from
  '../../apps/worker/qualification/checkpoint/fixture-channel.mjs';
import { ACTIVE_MARKER } from
  '../../apps/worker/qualification/probes/sdk-interruption-options.mjs';
import { createNativeEvidenceOwner } from './sdk-native-evidence-owner.mjs';

const observerId = '12f14997-e592-4c4e-8fbb-7dc6fd896f15';
const instanceId = '6139a2e5-cc87-4891-bb20-64fdf82f239d';
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const keyId = createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex');
const empty = createHash('sha256').update('').digest('hex');
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const driver = full => ({ runUuid: full.runUuid, sessionId: full.namespace.sessionId,
  attempt: full.identity.attempt, fence: full.identity.fence, operation: full.phase,
  deadlineMs: full.clock.deadlineMs });

function setup(change = {}) {
  const f = fixture(), s3 = fakeS3(), decisions = [];
  let clock = NOW, ids = 500;
  const authorize = async input => { decisions.push(input); return true; };
  const objects = createS3NativeEvidenceObjects({ bucket, kmsKeyArn, client: s3.client, authorize });
  const admission = { producer: f.producer, observerId, keyId, publicKey };
  const options = { producer: f.producer, admission, privateKey, objects, authorize,
    phaseDeadlineMs: NOW + 10000, now: () => clock, id: () => id(ids++),
    inspectNamespace: async () => ({ method: 'linux-proc', observedAtMs: clock,
      pidNamespace: 'pid:[4026532000]', observerPid: 1, otherPids: [] }), ...change };
  const owner = createNativeEvidenceOwner(options);
  const process = { instanceId, pid: 123, startedAtMs: NOW - 10 };
  const init = { type: 'system', subtype: 'init', session_id: f.producer.namespace.sessionId };
  const activeEvent = { type: 'stream_event', session_id: init.session_id,
    event: { type: 'content_block_delta', delta: { type: 'text_delta', text: ACTIVE_MARKER } } };
  const stream = { bytes: 0, sha256: empty, endObserved: true, closed: true, error: false };
  const controller = new AbortController();
  return { f, s3, options, owner, decisions, controller,
    now: () => clock, tick: value => { clock = value; },
    input: () => ({ producer: f.producer, context: f.producer, bundle: f.bundle,
      fixtureFile: f.sentinel, deadlineMs: options.phaseDeadlineMs, signal: controller.signal }),
    begin() {
      owner.nativeObserver.started(process); owner.nativeObserver.initialized(init);
      clock = NOW + 10;
      owner.nativeObserver.interrupted({ activeEvent, requestedAtMs: NOW + 5,
        acknowledgedAtMs: clock, receipt: { still_queued: [] } });
    },
    async exit() {
      clock = NOW + 20;
      await owner.nativeObserver.exited({ process, exitCode: 0, signal: null,
        forced: false, exitedAtMs: clock });
    },
    drain() {
      clock = NOW + 30;
      owner.nativeObserver.drained({ process, eventStreamExhausted: true,
        stdout: stream, stderr: { ...stream, overflow: false },
        bundle: f.bundle, fixtureFile: f.sentinel });
    } };
}

async function complete(s) { s.begin(); await s.exit(); s.drain(); }
const puts = s => s.s3.calls.filter(call => call.type === 'PutObjectCommand');

test('construction is inert and exposes only borrowed observation/publication ports', () => {
  let disposed = 0;
  const s = setup({ objects: { putEvidence() { throw new Error('unexpected storage'); },
    close() { disposed++; } }, authorize() { throw new Error('unexpected authorization'); },
    inspectNamespace() { throw new Error('unexpected namespace I/O'); } });
  assert.deepEqual(Object.keys(s.owner), ['nativeObserver', 'evidenceProvider']);
  assert.equal(Object.isFrozen(s.owner), true);
  assert.equal(s.owner.nativeObserver.privateKey, undefined);
  assert.equal(s.owner.nativeObserver.objects, undefined);
  assert.equal(s.owner.privateKey, undefined); assert.equal(s.owner.objects, undefined);
  assert.equal(s.s3.calls.length, 0); assert.equal(s.decisions.length, 0);
  assert.equal(disposed, 0);
});

test('configuration rejects foreign admission, unsafe cutoff and accessors before capability calls', () => {
  const s = setup();
  for (const change of [{ phaseDeadlineMs: NOW }, { phaseDeadlineMs: NOW + 60001 },
    { producer: s.f.current }, { admission: { ...s.options.admission, producer: s.f.current } },
    { privateKey: publicKey }, { extra: true }]) {
    assert.throws(() => createNativeEvidenceOwner({ ...s.options, ...change }));
  }
  let reads = 0;
  const hostile = { ...s.options };
  Object.defineProperty(hostile, 'authorize', { enumerable: true, get() { reads++; } });
  assert.throws(() => createNativeEvidenceOwner(hostile), /SDK_NATIVE_OWNER_REFUSED/);
  const proxy = new Proxy(s.options, { getPrototypeOf() { reads++; throw new Error('PRIVATE'); } });
  assert.throws(() => createNativeEvidenceOwner(proxy), /SDK_NATIVE_OWNER_REFUSED/);
  assert.equal(reads, 0); assert.equal(s.decisions.length, 0); assert.equal(s.s3.calls.length, 0);
});

test('only four complete owner observations can produce canonical durable references', async () => {
  for (const stage of ['empty', 'interrupted', 'exited']) {
    const s = setup();
    if (stage !== 'empty') s.begin();
    if (stage === 'exited') await s.exit();
    await assert.rejects(s.owner.evidenceProvider(s.input()), /SDK_NATIVE_OWNER_REFUSED/);
    assert.equal(s.decisions.length, 0); assert.equal(s.s3.calls.length, 0);
  }
  const s = setup(); await complete(s);
  const evidence = await s.owner.evidenceProvider(s.input());
  assert.deepEqual(Object.keys(evidence), ['init', 'interrupt', 'exit', 'drain']);
  assert.equal(puts(s).length, 4); assert.equal(s.s3.calls.length, 8);
  const objects = createS3FixtureObjects({ bucket, kmsKeyArn, client: s.s3.client });
  const inspector = createNativeEvidenceInspector({ objects, admission: s.options.admission, now: s.now });
  assert.equal(await inspector.verify({ producer: s.f.producer, evidence,
    bundle: s.f.bundle, fixtureFile: s.f.sentinel }), true);
  await assert.rejects(s.owner.evidenceProvider(s.input()), /SDK_NATIVE_OWNER_REFUSED/);
  assert.equal(puts(s).length, 4);
});

test('canonical channel supplies exact owner protocol args before checkpoint persistence', async () => {
  const s = setup(); await complete(s);
  const objects = createS3FixtureObjects({ bucket, kmsKeyArn, client: s.s3.client });
  const inspector = createNativeEvidenceInspector({ objects, admission: s.options.admission, now: s.now });
  let ids = 800, supplied, committed;
  const store = createS3CheckpointStore({ objects, evidenceInspector: inspector,
    now: s.now, id: () => id(ids++) });
  const requests = [];
  const channel = createFixtureChannel({ producer: s.f.producer, current: s.f.producer,
    fixtureFile: s.f.sentinel, phaseDeadlineMs: s.options.phaseDeadlineMs,
    requestId: () => id(ids++), now: s.now,
    evidenceProvider: input => { supplied = input; return s.owner.evidenceProvider(input); },
    transport: async ({ requestBytes }) => {
      const request = decodeFixtureRequest(requestBytes, { nowMs: s.now() });
      requests.push(request.operation);
      const common = { channelVersion: request.channelVersion, profile: request.profile,
        operation: request.operation, requestId: request.requestId, context: request.context };
      let response;
      if (request.operation === 'authorizeFixturePhase') {
        response = { ...common, status: 'AUTHORIZED', decisionId: id(ids++), checkedAtMs: s.now() };
      } else {
        assert.equal(request.operation, 'commitFixtureCheckpoint');
        committed = await store.prepareCommit({ producer: request.context,
          bundle: request.bundle, fixtureFile: request.fixtureFile, evidence: request.evidence });
        response = { ...common, status: 'COMMITTED', completeRecoveryCheckpoint: false,
          sessionStoreQualified: false, receipt: committed.receipt };
      }
      return wire(response);
    } });
  const reference = await channel.checkpoint.commit({ context: driver(s.f.producer),
    bundle: s.f.bundle, fixtureFile: s.f.sentinel });
  assert.deepEqual(Object.keys(supplied), ['producer', 'context', 'bundle', 'fixtureFile', 'deadlineMs', 'signal']);
  assert.deepEqual(supplied.producer, s.f.producer); assert.deepEqual(supplied.context, s.f.producer);
  assert.equal(supplied.deadlineMs, s.options.phaseDeadlineMs);
  assert.equal(Object.isFrozen(supplied.bundle), true); assert.equal(Object.isFrozen(supplied.fixtureFile), true);
  assert.deepEqual(requests, ['authorizeFixturePhase', 'commitFixtureCheckpoint']);
  assert.deepEqual(reference, fixtureReceiptIdentity(committed.receipt));
  assert.equal(committed.receipt.completeRecoveryCheckpoint, false);
  assert.equal(committed.receipt.sessionStoreQualified, false);
  assert.equal(puts(s).length, 7); // Four observations, bundle, sentinel and receipt.
  assert.equal(s.s3.objects.size, 7);
  assert.deepEqual(committed.receipt.nativeInventory.files,
    s.f.bundle.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })));
  assert.equal(committed.receipt.workspace.entries[0].object.sha256, s.f.sentinel.sha256);
  await assert.rejects(channel.checkpoint.commit({ context: driver(s.f.producer), bundle: s.f.bundle }), /QUARANTINED/);
  assert.equal(puts(s).length, 7);
  // This test uses a scripted transport and synthetic authorization. Its
  // storage receipt is not a PostgreSQL publication or live current-fence proof.
});

test('foreign context/capture, renewed deadline and hostile data refuse before effects', async () => {
  for (const mutation of ['producer', 'context', 'bundle', 'sentinel', 'deadline', 'unknown', 'getter']) {
    const s = setup(); await complete(s);
    const input = s.input(); let reads = 0;
    if (mutation === 'producer') input.producer = s.f.current;
    if (mutation === 'context') input.context = s.f.current;
    if (mutation === 'bundle') input.bundle = { ...s.f.bundle, totalBytes: s.f.bundle.totalBytes + 1 };
    if (mutation === 'sentinel') {
      const raw = Buffer.from('different valid synthetic sentinel');
      input.fixtureFile = { path: s.f.sentinel.path, bytes: raw.length,
        base64: raw.toString('base64'), sha256: createHash('sha256').update(raw).digest('hex') };
    }
    if (mutation === 'deadline') input.deadlineMs++;
    if (mutation === 'unknown') input.writer = s.options.objects;
    if (mutation === 'getter') Object.defineProperty(input, 'bundle', {
      enumerable: true, get() { reads++; throw new Error('PRIVATE'); } });
    const original = JSON.parse; let copiedCapture = false;
    JSON.parse = function(value, ...args) {
      if (typeof value === 'string' && value.includes('"format":"meri-native-session-files-v1"')) copiedCapture = true;
      return original(value, ...args);
    };
    try { await assert.rejects(s.owner.evidenceProvider(input), /SDK_NATIVE_OWNER_REFUSED/); }
    finally { JSON.parse = original; }
    assert.equal(reads, 0); assert.equal(copiedCapture, false);
    assert.equal(s.decisions.length, 0); assert.equal(s.s3.calls.length, 0);
  }
});

test('admitted original cutoff and input snapshots survive caller mutation', async () => {
  const s = setup(); await complete(s);
  const input = structuredClone({ ...s.input(), signal: undefined }); input.signal = s.controller.signal;
  s.options.producer.identity.taskArn = 'foreign';
  s.options.admission.producer.identity.fence = 99;
  s.options.phaseDeadlineMs++;
  const evidence = await s.owner.evidenceProvider(input);
  assert.equal(puts(s).length, 4);
  for (const reference of Object.values(evidence)) {
    assert.equal(reference.scopes[0].tenantId, input.producer.identity.canonical.tenantId);
  }
});

test('malformed or foreign verification keys refuse before owner ports or observation', () => {
  const { publicKey: foreignKey } = generateKeyPairSync('ed25519');
  const { publicKey: ecKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  let inspections = 0;
  const s = setup({ inspectNamespace: () => { inspections++; throw new Error('unexpected inspection'); } });
  for (const invalidKey of [foreignKey, privateKey, ecKey, 'model-supplied-key', undefined]) {
    let exposed;
    assert.throws(() => {
      exposed = createNativeEvidenceOwner({ ...s.options,
        admission: { ...s.options.admission, publicKey: invalidKey } });
    }, /NATIVE_EVIDENCE_REFUSED/);
    assert.equal(exposed, undefined);
  }
  assert.equal(inspections, 0);
  assert.equal(s.decisions.length, 0); assert.equal(s.s3.calls.length, 0);
});

test('revocation and cancellation quarantine publication without retry', async () => {
  for (const mode of ['revoked', 'after-put', 'cancelled']) {
    let writes = 0, disposed = 0, authorizations = 0, abort;
    const s = setup({ authorize: async () => {
      authorizations++;
      return mode !== 'revoked' && (mode !== 'after-put' || writes === 0);
    }, objects: { putEvidence: async ({ objectId, bytes, signal }) => {
      writes++;
      if (mode === 'cancelled') abort();
      assert.equal(signal instanceof AbortSignal, true);
      return { objectId, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), versionId: 'synthetic-version' };
    }, close() { disposed++; } } });
    abort = () => s.controller.abort(); await complete(s);
    await assert.rejects(s.owner.evidenceProvider(s.input()), /SDK_NATIVE_OWNER_REFUSED/);
    await assert.rejects(s.owner.evidenceProvider(s.input()), /SDK_NATIVE_OWNER_REFUSED/);
    assert.equal(writes, mode === 'revoked' ? 0 : 1);
    assert.equal(disposed, 0);
    if (mode === 'revoked') assert.equal(authorizations, 1);
  }
});

test('pre-abort, cutoff expiry and clock rollback refuse without storage', async () => {
  for (const mode of ['abort', 'expired', 'rollback']) {
    const s = setup(); await complete(s);
    if (mode === 'abort') s.controller.abort();
    if (mode === 'expired') s.tick(s.options.phaseDeadlineMs);
    if (mode === 'rollback') s.tick(NOW + 29);
    await assert.rejects(s.owner.evidenceProvider(s.input()), /SDK_NATIVE_OWNER_REFUSED/);
    assert.equal(s.decisions.length, 0); assert.equal(s.s3.calls.length, 0);
  }
});

test('cancellation and original deadline are rechecked after pending authorization', async () => {
  let release, writes = 0, entered;
  const barrier = new Promise(resolve => { release = resolve; });
  const authorizing = new Promise(resolve => { entered = resolve; });
  const s = setup({ authorize: async () => { entered(); await barrier; return true; },
    objects: { putEvidence: async () => { writes++; throw new Error('unexpected write'); } } });
  await complete(s);
  const first = s.owner.evidenceProvider(s.input()); await authorizing;
  s.controller.abort();
  await assert.rejects(first, /SDK_NATIVE_OWNER_REFUSED/);
  release(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes, 0);
  await assert.rejects(s.owner.evidenceProvider(s.input()), /SDK_NATIVE_OWNER_REFUSED/);
  let late;
  const expired = setup({ authorize: async () => {
    expired.tick(expired.options.phaseDeadlineMs); return true;
  }, objects: { putEvidence: async input => { late = input; throw new Error('unexpected write'); } } });
  await complete(expired);
  await assert.rejects(expired.owner.evidenceProvider(expired.input()), /SDK_NATIVE_OWNER_REFUSED/);
  assert.equal(late, undefined);
});

test('uncertain writes and concurrent callers cannot publish a second set', async () => {
  let writes = 0;
  const uncertain = setup({ objects: { putEvidence: async () => { writes++; throw new Error('PRIVATE_LOST_ACK'); } } });
  await complete(uncertain);
  await assert.rejects(uncertain.owner.evidenceProvider(uncertain.input()), /SDK_NATIVE_OWNER_REFUSED/);
  await assert.rejects(uncertain.owner.evidenceProvider(uncertain.input()), /SDK_NATIVE_OWNER_REFUSED/);
  assert.equal(writes, 1);
  let release, checks = 0;
  const barrier = new Promise(resolve => { release = resolve; });
  const concurrent = setup({ authorize: async () => { checks++; await barrier; return true; } });
  await complete(concurrent);
  const first = concurrent.owner.evidenceProvider(concurrent.input());
  await assert.rejects(concurrent.owner.evidenceProvider(concurrent.input()), /SDK_NATIVE_OWNER_REFUSED/);
  assert.equal(checks, 1); assert.equal(puts(concurrent).length, 0);
  release(); await first;
  assert.equal(puts(concurrent).length, 4);
});

test('deadline aborts an unsettled borrowed write and keeps its attempt quarantined', async () => {
  let signal, release, writes = 0;
  const pending = new Promise(resolve => { release = resolve; });
  const s = setup({ phaseDeadlineMs: NOW + 80,
    objects: { putEvidence: async input => { signal = input.signal; writes++; await pending; return {}; } } });
  await complete(s);
  await assert.rejects(s.owner.evidenceProvider(s.input()), /SDK_NATIVE_OWNER_REFUSED/);
  assert.equal(signal.aborted, true); assert.equal(writes, 1);
  await assert.rejects(s.owner.evidenceProvider(s.input()), /SDK_NATIVE_OWNER_REFUSED/);
  assert.equal(writes, 1);
  release(); // Settle the owned test seam; abort is not physical service cleanup.
});
