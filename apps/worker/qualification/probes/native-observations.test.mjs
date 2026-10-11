// Synthetic keys/process/namespace data only. No SDK, process, or cloud runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { fixture, T0 } from '../../../control/qualification-sdk-fixture/ingress/test/fixture-data.mjs';
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { nativeCaptureBinding, nativeEvidenceSigningBytes } from
  '../../../../packages/contracts/qualification-sdk/native-evidence.mjs';
import { createNativeEvidenceObserver } from './native-observations.mjs';
import { ACTIVE_MARKER } from './sdk-interruption-options.mjs';

const observerId = '12f14997-e592-4c4e-8fbb-7dc6fd896f15';
const instanceId = '6139a2e5-cc87-4891-bb20-64fdf82f239d';
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const keyId = createHash('sha256').update(publicKey.export({ format: 'der', type: 'spki' })).digest('hex');
const empty = createHash('sha256').update('').digest('hex');
function setup(change = {}) {
  const f = fixture(); let clock = T0 + 100;
  const process = { instanceId, pid: 123, startedAtMs: T0 + 50 };
  const init = { type: 'system', subtype: 'init', session_id: f.producer.namespace.sessionId };
  const activeEvent = { type: 'stream_event', session_id: init.session_id,
    event: { type: 'content_block_delta', delta: { type: 'text_delta', text: ACTIVE_MARKER } } };
  const args = { producer: f.producer, observerId, keyId, privateKey, now: () => clock,
    inspectNamespace: async () => ({ method: 'linux-proc', observedAtMs: clock,
      pidNamespace: 'pid:[4026532000]', observerPid: 1, otherPids: [] }), ...change };
  const observer = createNativeEvidenceObserver(args);
  const stream = { bytes: 0, sha256: empty, endObserved: true, closed: true, error: false };
  return { f, args, process, init, activeEvent, observer,
    tick: value => { clock = value; },
    begin() { observer.started(process); observer.initialized(init); clock += 10;
      observer.interrupted({ activeEvent, requestedAtMs: clock - 5,
        acknowledgedAtMs: clock, receipt: { still_queued: [] } }); clock += 10; },
    exit: () => observer.exited({ process, exitCode: 0, signal: null, forced: false, exitedAtMs: clock }),
    drain: change => observer.drained({ process, eventStreamExhausted: true,
      stdout: stream, stderr: { ...stream, overflow: false }, bundle: f.bundle, fixtureFile: f.sentinel, ...change }) };
}
test('signed records bind exact producer, process, actual events and captured bytes', async () => {
  const s = setup(); s.begin(); await s.exit(); s.drain();
  const records = s.observer.records;
  assert.deepEqual(records.map(row => row.kind), ['init', 'interrupt', 'exit', 'drain']);
  assert.deepEqual(records.map(row => row.sequence), [0, 1, 2, 3]);
  for (const row of records) {
    assert.equal(verify(null, nativeEvidenceSigningBytes(row), publicKey,
      Buffer.from(row.signature.value, 'base64')), true);
    assert.deepEqual(row.producer, s.f.producer); assert.deepEqual(row.process, s.process);
  }
  assert.equal(records[0].facts.initMessageSha256, canonicalSha256(s.init));
  assert.equal(records[1].facts.activeEventSha256, canonicalSha256(s.activeEvent));
  assert.deepEqual(records[3].facts.capture, nativeCaptureBinding({ producer: s.f.producer,
    bundle: s.f.bundle, fixtureFile: s.f.sentinel, nowMs: records[3].observedAtMs }));
  assert.equal(Object.isFrozen(records[0].facts), true);
  assert.throws(() => { records[0].producer.identity.fence = 99; }, TypeError);
});
test('observer requires injected private Ed25519 identity and namespace capability', () => {
  const s = setup();
  for (const change of [{ keyId: 'a'.repeat(64) }, { privateKey: publicKey },
    { privateKey: 'model-supplied-key' }, { inspectNamespace: undefined }, { observerId: 'not-a-uuid' }]) {
    assert.throws(() => createNativeEvidenceObserver({ ...s.args, ...change }), /NATIVE_OBSERVER_COMPOSITION|NATIVE_OBSERVER_KEY_BINDING/);
  }
});
test('observations require one real process instance and ordered lifecycle calls', () => {
  const missing = setup();
  assert.throws(() => missing.observer.initialized(missing.init), /NATIVE_OBSERVATION_ORDER/);
  assert.throws(() => missing.observer.started(missing.process), /NATIVE_OBSERVER_REFUSED/);
  for (const change of [{ pid: undefined }, { pid: 0 }, { instanceId: 'missing' }, { extra: true }]) {
    const s = setup();
    assert.throws(() => s.observer.started({ ...s.process, ...change }), /NATIVE_PROCESS_REQUIRED/);
    assert.throws(() => s.observer.started(s.process), /NATIVE_OBSERVER_REFUSED/);
  }
  for (const operation of [s => s.observer.started(s.process), s => s.observer.initialized(s.init), s => s.drain()]) {
    const s = setup(); s.begin();
    assert.throws(() => operation(s), /NATIVE_OBSERVATION_ORDER/);
    assert.throws(() => s.drain(), /NATIVE_OBSERVER_REFUSED/);
  }
});
test('foreign init/active event cannot produce accepted records', () => {
  const s = setup(); s.observer.started(s.process);
  assert.throws(() => s.observer.initialized({ ...s.init, session_id: observerId }), /NATIVE_INIT_REQUIRED/);
  assert.throws(() => s.observer.initialized(s.init), /NATIVE_OBSERVER_REFUSED/);
  const fresh = setup(); fresh.observer.started(fresh.process); fresh.observer.initialized(fresh.init); fresh.tick(T0 + 110);
  assert.throws(() => fresh.observer.interrupted({ activeEvent: { ...fresh.activeEvent, session_id: observerId },
    requestedAtMs: T0 + 105, acknowledgedAtMs: T0 + 110, receipt: { still_queued: [] } }), /NATIVE_ACTIVE_EVENT_REQUIRED/);
  assert.equal(fresh.observer.records.length, 1);
});
test('queued messages and impossible interrupt times cannot be signed', () => {
  for (const change of [{ receipt: { still_queued: [observerId] } },
    { requestedAtMs: T0 + 90 }, { requestedAtMs: T0 + 112 }, { acknowledgedAtMs: T0 + 111 }]) {
    const s = setup(); s.observer.started(s.process); s.observer.initialized(s.init); s.tick(T0 + 110);
    assert.throws(() => s.observer.interrupted({ activeEvent: s.activeEvent,
      requestedAtMs: T0 + 105, acknowledgedAtMs: T0 + 110, receipt: { still_queued: [] }, ...change }),
    /NATIVE_EVIDENCE_REFUSED|NATIVE_INTERRUPT_CLOCK/);
    assert.equal(s.observer.records.length, 1);
  }
});
test('forced, unknown, failed or foreign process exit cannot establish quiescence', async () => {
  for (const change of [{ forced: true }, { exitCode: null }, { exitCode: 1 },
    { signal: 'SIGKILL', exitCode: null }, { process: { instanceId, pid: 124, startedAtMs: T0 + 50 } },
    { exitedAtMs: T0 + 109 }]) {
    const s = setup(); s.begin();
    await assert.rejects(s.observer.exited({ process: s.process, exitCode: 0, signal: null,
      forced: false, exitedAtMs: T0 + 120, ...change }), /NATIVE_EXIT_REQUIRED|NATIVE_FOREIGN_PROCESS|NATIVE_EXIT_CLOCK/);
    assert.equal(s.observer.records.length, 2);
  }
});
test('trusted namespace requires actual fields, no surviving writers and ordered time', async () => {
  for (const namespace of [true, undefined, { method: 'linux-proc', observedAtMs: T0 + 120,
    pidNamespace: 'pid:[4026532000]', observerPid: 1, otherPids: [123] },
    { method: 'linux-proc', observedAtMs: T0 + 119, pidNamespace: 'pid:[4026532000]', observerPid: 1, otherPids: [] }]) {
    const s = setup({ inspectNamespace: async () => namespace }); s.begin();
    await assert.rejects(s.exit(), /NATIVE_EVIDENCE_REFUSED|NATIVE_NAMESPACE_CLOCK/);
    assert.equal(s.observer.records.length, 2);
    await assert.rejects(Promise.resolve().then(() => s.exit()), /NATIVE_OBSERVER_REFUSED/);
  }
});
test('incomplete stream observation and absent/mismatched capture refuse drain', async () => {
  for (const change of [{ eventStreamExhausted: false }, { stdout: { bytes: 0, sha256: empty,
    endObserved: false, closed: true, error: false } }, { fixtureFile: undefined },
    { fixtureFile: { ...fixture().sentinel, sha256: 'a'.repeat(64) } },
    { bundle: { ...fixture().bundle, totalBytes: 1 } }]) {
    const s = setup(); s.begin(); await s.exit();
    assert.throws(() => s.drain(change), /NATIVE_EVIDENCE_REFUSED/);
    assert.equal(s.observer.records.length, 3);
    assert.throws(() => s.drain(), /NATIVE_OBSERVER_REFUSED/);
  }
});
test('clock rollback and concurrent observations fail closed', async () => {
  let release;
  const s = setup({ inspectNamespace: () => new Promise(resolve => { release = resolve; }) });
  s.begin(); const exit = s.exit();
  assert.throws(() => s.drain(), /NATIVE_OBSERVATION_ORDER/);
  release({ method: 'linux-proc', observedAtMs: T0 + 120,
    pidNamespace: 'pid:[4026532000]', observerPid: 1, otherPids: [] });
  await assert.rejects(exit, /NATIVE_OBSERVER_REFUSED/);
  assert.equal(s.observer.records.length, 2);
  const rollback = setup(); rollback.begin(); await rollback.exit(); rollback.tick(T0 + 119);
  assert.throws(() => rollback.drain(), /NATIVE_OBSERVER_CLOCK/);
});

test('namespace errors permanently refuse the collector without issuing later signatures', async () => {
  const s = setup({ inspectNamespace: async () => { throw new Error('NAMESPACE_READ_FAILED'); } });
  s.begin(); await assert.rejects(s.exit(), /NAMESPACE_READ_FAILED/);
  await assert.rejects(Promise.resolve().then(() => s.exit()), /NATIVE_OBSERVER_REFUSED/);
  assert.throws(() => s.drain(), /NATIVE_OBSERVER_REFUSED/);
  assert.equal(s.observer.records.length, 2);
});
test('getter-backed process and producer are rejected without invoking getters', () => {
  const s = setup(); let reads = 0;
  const process = { ...s.process };
  Object.defineProperty(process, 'pid', { enumerable: true, get() { reads++; return 123; } });
  assert.throws(() => s.observer.started(process), /NATIVE_PROCESS_REQUIRED/);
  const producer = { ...s.f.producer };
  Object.defineProperty(producer, 'phase', { enumerable: true, get() { reads++; return 'interrupt'; } });
  assert.throws(() => createNativeEvidenceObserver({ ...s.args, producer }), /FIXTURE_JSON_ONLY/);
  assert.equal(reads, 0);
});
