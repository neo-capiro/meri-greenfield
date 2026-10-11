import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fixture, NOW } from '../../../apps/control/qualification-sdk-fixture/ingress/test/fixture-data.mjs';
import { canonicalSha256 } from '../validate.mjs';
import { assertNativeEvidenceRecord, decodeNativeEvidenceRecord, encodeNativeEvidenceRecord,
  nativeEvidenceSigningBytes, nativeCaptureBinding,
  nativeEvidenceKinds as canonicalKinds } from '../qualification-sdk/native-evidence.mjs';
import { syntheticNativeEvidence, nativeEvidenceKinds, syntheticEvidenceBytes } from './native-evidence-fixture.mjs';

const copy = value => structuredClone(value);
const refused = operation => assert.throws(operation, /^Error: NATIVE_EVIDENCE_REFUSED$/);
function setup() {
  const f = fixture();
  return { f, s: syntheticNativeEvidence({ producer: f.producer,
    bundle: f.bundle, fixtureFile: f.sentinel, nowMs: NOW }) };
}

test('schema owns the immutable four-kind lifecycle vocabulary', () => {
  assert.deepEqual(canonicalKinds, ['init', 'interrupt', 'exit', 'drain']);
  assert.deepEqual(canonicalKinds, nativeEvidenceKinds);
  assert.equal(Object.isFrozen(canonicalKinds), true);
  assert.throws(() => canonicalKinds.push('replacement'), TypeError);
});

test('inconsistent base64 refuses before allocating a decoded file buffer', () => {
  const { f } = setup(), invalid = 'A'.repeat(8192);
  f.bundle.files[0].base64 = invalid;
  const original = Buffer.from; let decoded = false;
  Buffer.from = function(value, ...args) {
    if (value === invalid) decoded = true;
    return original.call(this, value, ...args);
  };
  try { refused(() => nativeCaptureBinding({ producer: f.producer,
    bundle: f.bundle, fixtureFile: f.sentinel, nowMs: NOW })); }
  finally { Buffer.from = original; }
  assert.equal(decoded, false);
});

test('four canonical signed observation records round-trip without altering opaque capture', () => {
  const { f, s } = setup();
  for (const [sequence, kind] of nativeEvidenceKinds.entries()) {
    assert.deepEqual(decodeNativeEvidenceRecord(s.bytes[kind]), s.records[kind]);
    assert.deepEqual(encodeNativeEvidenceRecord(s.records[kind]), s.bytes[kind]);
    assert.equal(assertNativeEvidenceRecord(s.records[kind]), s.records[kind]);
    assert.equal(s.records[kind].sequence, sequence);
  }
  const capture = nativeCaptureBinding({ producer: f.producer,
    bundle: f.bundle, fixtureFile: f.sentinel, nowMs: NOW });
  assert.equal(capture.bundleSha256, canonicalSha256(f.bundle));
  assert.equal(capture.sentinel.sha256, f.sentinel.sha256);
  assert.equal(capture.bundleBytes, Buffer.byteLength(syntheticEvidenceBytes(f.bundle)));
});

test('signing bytes omit only signature and support strictly validated unsigned input', () => {
  const { s } = setup(), full = s.records.init;
  const unsigned = copy(full); delete unsigned.signature;
  assert.deepEqual(nativeEvidenceSigningBytes(full), nativeEvidenceSigningBytes(unsigned));
  const reordered = Object.fromEntries(Object.entries(unsigned).reverse());
  assert.deepEqual(nativeEvidenceSigningBytes(unsigned), nativeEvidenceSigningBytes(reordered));
  unsigned.facts.initMessageSha256 = 'f'.repeat(64);
  assert.notDeepEqual(nativeEvidenceSigningBytes(full), nativeEvidenceSigningBytes(unsigned));
  refused(() => assertNativeEvidenceRecord(unsigned));
});

test('alternate JSON, duplicate keys, trailing bytes, corrupt UTF-8 and oversized inputs refuse', () => {
  const { s } = setup(), raw = s.bytes.init;
  const value = raw.toString('utf8');
  for (const bytes of [Buffer.from(`${value}\n`), Buffer.from(JSON.stringify(s.records.init, null, 2)),
    Buffer.from(value.replace('"kind":"init"', '"kind":"init","kind":"init"')),
    Buffer.concat([Buffer.from([0xff]), raw]), Buffer.alloc(65537), Buffer.alloc(0)]) {
    refused(() => decodeNativeEvidenceRecord(bytes));
  }
  refused(() => decodeNativeEvidenceRecord(value));
});

test('closed grammar refuses added authority, missing facts and kind/sequence confusion', () => {
  const { s } = setup();
  for (const mutate of [r => r.publicKey = 'worker-supplied', r => r.observer.publicKey = 'foreign',
    r => r.evidenceVersion = 'sdk-native-evidence/2', r => r.sequence = 1,
    r => r.kind = 'drain', r => delete r.facts.initMessageSha256,
    r => r.producer.phase = 'resume', r => r.facts.sdkVersion = 'other']) {
    const record = copy(s.records.init); mutate(record);
    refused(() => assertNativeEvidenceRecord(record));
  }
});

test('nonempty interrupt queues and unsuccessful quiescence/stream flags refuse', () => {
  const { s } = setup();
  const changes = [
    ['interrupt', r => r.facts.receipt.still_queued.push('queued')],
    ['interrupt', r => r.facts.receipt.cancelled.push('cancelled')],
    ['exit', r => r.facts.forced = true],
    ['exit', r => r.facts.namespace.otherPids.push(43)],
    ['drain', r => r.facts.eventStreamExhausted = false],
    ['drain', r => r.facts.stdout.endObserved = false],
    ['drain', r => r.facts.stderr.overflow = true],
    ['drain', r => r.facts.stdout.error = true],
  ];
  for (const [kind, mutate] of changes) {
    const record = copy(s.records[kind]); mutate(record);
    refused(() => assertNativeEvidenceRecord(record));
  }
});

test('safe integer bounds, accessors, cycles and noncanonical signatures refuse without getter reads', () => {
  const { s } = setup();
  for (const mutate of [r => r.observedAtMs = Number.MAX_SAFE_INTEGER + 1,
    r => r.process.pid = 0, r => r.process.startedAtMs = r.observedAtMs + 1,
    r => r.observedAtMs = r.producer.identity.expiresAtMs,
    r => r.signature.value = 'A'.repeat(85) + 'B==',
    r => r.signature.algorithm = 'RSA']) {
    const record = copy(s.records.init); mutate(record);
    refused(() => assertNativeEvidenceRecord(record));
  }
  let read = 0; const accessor = copy(s.records.init);
  Object.defineProperty(accessor, 'facts', { enumerable: true, get() { read++; return {}; } });
  refused(() => assertNativeEvidenceRecord(accessor)); assert.equal(read, 0);
  const cycle = copy(s.records.init); cycle.facts.loop = cycle;
  refused(() => assertNativeEvidenceRecord(cycle));
});

test('capture refuses altered raw bytes, sentinel hashes, foreign namespace and unsafe paths', () => {
  const { f } = setup();
  for (const mutate of [b => b.binding.sessionId = '00000000-0000-4000-9000-000000000fff',
    b => b.files[0].base64 += '\n', b => b.files[0].path = '../foreign',
    b => b.files[0].sha256 = 'f'.repeat(64), b => b.totalBytes++]) {
    const bundle = copy(f.bundle); mutate(bundle);
    refused(() => nativeCaptureBinding({ producer: f.producer, bundle, fixtureFile: f.sentinel, nowMs: NOW }));
  }
  const file = copy(f.sentinel); file.sha256 = createHash('sha256').update('different').digest('hex');
  refused(() => nativeCaptureBinding({ producer: f.producer, bundle: f.bundle, fixtureFile: file, nowMs: NOW }));
});
