import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { fixture, NOW } from '../../ingress/test/fixture-data.mjs';
import { syntheticNativeEvidence } from '../../../../../packages/contracts/test/native-evidence-fixture.mjs';
import { createNativeEvidenceInspector, verifyNativeEvidenceRecords } from '../native-evidence.mjs';
import { createS3CheckpointStore } from '../checkpoint-store.mjs';

const copy = value => structuredClone(value);
const error = /^Error: NATIVE_EVIDENCE_REFUSED$/;
function setup() {
  const f = fixture();
  const s = syntheticNativeEvidence({ producer: f.producer, bundle: f.bundle,
    fixtureFile: f.sentinel, nowMs: NOW });
  const input = { producer: f.producer, evidence: s.evidence, bundle: f.bundle, fixtureFile: f.sentinel };
  const options = { objects: s.objects, admission: s.admission, now: () => NOW };
  return { f, s, input, options };
}

test('inspector reads all four exact immutable refs and verifies admitted signed capture', async () => {
  const { f, s, input, options } = setup();
  assert.equal(await createNativeEvidenceInspector(options).verify(input), true);
  assert.deepEqual(s.reads.map(read => read.kind), ['init', 'interrupt', 'exit', 'drain']);
  for (const read of s.reads) {
    assert.deepEqual(read.producer, f.producer);
    assert.deepEqual(read.reference, s.evidence[read.kind]);
  }
  assert.equal(verifyNativeEvidenceRecords({ records: s.records, producer: f.producer,
    admission: s.admission, bundle: f.bundle, fixtureFile: f.sentinel, nowMs: NOW }), true);
});

test('foreign admitted task, fence, session, image or policy refuses before any object read', async () => {
  for (const mutate of [p => p.identity.taskArn = p.identity.taskArn.replace(/1{32}$/, '2'.repeat(32)),
    p => { p.identity.fence++; p.identity.canonical.writerFence++; },
    p => p.namespace.sessionId = '00000000-0000-4000-9000-000000000fff',
    p => p.pins.imageDigest = `sha256:${'f'.repeat(64)}`,
    p => p.identity.policyRevision = 'f'.repeat(64)]) {
    const { s, input, options } = setup();
    input.producer = copy(input.producer); mutate(input.producer);
    await assert.rejects(createNativeEvidenceInspector(options).verify(input), error);
    assert.equal(s.reads.length, 0);
  }
});

test('re-signed foreign record producer, observer and process cannot rewrite owner admission', async () => {
  for (const mutate of [r => r.producer.pins.imageDigest = `sha256:${'f'.repeat(64)}`,
    r => r.producer.identity.policyRevision = 'f'.repeat(64),
    r => r.observer.observerId = '00000000-0000-4000-9000-000000000fff',
    r => r.process.instanceId = '00000000-0000-4000-9000-000000000fff']) {
    const { s, input, options } = setup();
    const record = copy(s.records.drain); mutate(record); s.replace('drain', record);
    await assert.rejects(createNativeEvidenceInspector(options).verify(input), error);
  }
});

test('wrong signer, modified signed facts and descriptor/public-key mismatch refuse', async () => {
  const { s, input, options } = setup();
  const record = copy(s.records.init); record.facts.initMessageSha256 = 'f'.repeat(64);
  s.replace('init', record, { resign: false });
  await assert.rejects(createNativeEvidenceInspector(options).verify(input), error);
  const foreign = generateKeyPairSync('ed25519').publicKey;
  assert.throws(() => createNativeEvidenceInspector({ ...options,
    admission: { ...s.admission, publicKey: foreign } }), error);
  const wrong = { ...s.admission, publicKey: foreign,
    keyId: createHash('sha256').update(foreign.export({ type: 'spki', format: 'der' })).digest('hex') };
  await assert.rejects(createNativeEvidenceInspector({ ...options, admission: wrong }).verify(input), error);
});

test('reordered refs, impossible times, future observations and unexplained process failure refuse', async () => {
  for (const mutate of [s => s.replace('init', s.records.interrupt),
    s => { const r = copy(s.records.interrupt); r.facts.requestedAtMs = s.records.init.observedAtMs - 1; s.replace('interrupt', r); },
    s => { const r = copy(s.records.init); r.observedAtMs = NOW + 1; s.replace('init', r); },
    s => { const r = copy(s.records.exit); r.facts.exitCode = 1; s.replace('exit', r); },
    s => { const r = copy(s.records.exit); r.facts.namespace.observerPid = r.process.pid; s.replace('exit', r); }]) {
    const { s, input, options } = setup(); mutate(s);
    await assert.rejects(createNativeEvidenceInspector(options).verify(input), error);
  }
});

test('documented intentional termination is distinguished from unknown/forced exit', async () => {
  for (const [signal, exitCode] of [['SIGTERM', null], ['SIGTERM', 143], ['SIGINT', 130]]) {
    const { s, input, options } = setup();
    const r = copy(s.records.exit); Object.assign(r.facts, { signal, exitCode }); s.replace('exit', r);
    assert.equal(await createNativeEvidenceInspector(options).verify(input), true);
  }
  for (const [signal, exitCode] of [[null, null], ['SIGTERM', 0], ['SIGINT', 143]]) {
    const { s, input, options } = setup();
    const r = copy(s.records.exit); Object.assign(r.facts, { signal, exitCode }); s.replace('exit', r);
    await assert.rejects(createNativeEvidenceInspector(options).verify(input), error);
  }
});

test('valid different transcript or sentinel bytes refuse without checkpoint writes', async () => {
  for (const target of ['bundle', 'file']) {
    const { f, s, input, options } = setup();
    const raw = Buffer.from('different exact submitted bytes\n');
    const changed = { bytes: raw.length, base64: raw.toString('base64'),
      sha256: createHash('sha256').update(raw).digest('hex') };
    if (target === 'bundle') {
      input.bundle = copy(f.bundle); Object.assign(input.bundle.files[0], changed);
      input.bundle.totalBytes = input.bundle.files.reduce((n, row) => n + row.bytes, 0);
    } else input.fixtureFile = { ...f.sentinel, ...changed };
    let writes = 0;
    const store = createS3CheckpointStore({ now: () => NOW, objects: {
      put: async () => { writes++; throw new Error('unexpected write'); }, read: async () => {},
    }, evidenceInspector: createNativeEvidenceInspector(options) });
    await assert.rejects(store.prepareCommit(input), error);
    assert.equal(s.reads.length, 4); assert.equal(writes, 0);
  }
});

test('corrupt/noncanonical bytes, version/hash substitution and oversized refs refuse', async () => {
  for (const alter of [s => s.bytes.init = Buffer.concat([s.bytes.init, Buffer.from('\n')]),
    s => s.bytes.init = Buffer.from([0xff]),
    s => s.evidence.init.versionId = 'null',
    s => s.evidence.init.bytes = 65537]) {
    const { s, input, options } = setup(); alter(s);
    await assert.rejects(createNativeEvidenceInspector(options).verify(input), error);
  }
  const { s, input, options } = setup();
  const objects = { readEvidence: async request => ({ ...(await s.objects.readEvidence(request)), versionId: 'other' }) };
  await assert.rejects(createNativeEvidenceInspector({ ...options, objects }).verify(input), error);
});

test('cancellation before or during reads refuses; dependency errors have fixed bounded output', async () => {
  const { s, input, options } = setup(); const controller = new AbortController(); controller.abort();
  await assert.rejects(createNativeEvidenceInspector(options).verify({ ...input, signal: controller.signal }), error);
  assert.equal(s.reads.length, 0);
  const during = new AbortController();
  const objects = { readEvidence: async request => { const read = await s.objects.readEvidence(request); during.abort(); return read; } };
  await assert.rejects(createNativeEvidenceInspector({ ...options, objects }).verify({ ...input, signal: during.signal }), error);
  assert.equal(s.reads.length, 1);
  const broken = { readEvidence: async () => { throw new Error('secret-provider-details'); } };
  await assert.rejects(createNativeEvidenceInspector({ ...options, objects: broken }).verify(input), error);
});

test('construction is read-only and refuses omitted trust, expired clock and accessor admission', () => {
  const { s, options } = setup();
  createNativeEvidenceInspector(options); assert.equal(s.reads.length, 0);
  assert.throws(() => createNativeEvidenceInspector({ objects: s.objects }), error);
  assert.throws(() => createNativeEvidenceInspector({ ...options, now: () => s.admission.producer.identity.expiresAtMs }), error);
  let calls = 0; const admission = { ...s.admission };
  Object.defineProperty(admission, 'keyId', { enumerable: true, get() { calls++; return 'bad'; } });
  assert.throws(() => createNativeEvidenceInspector({ ...options, admission }), error);
  assert.equal(calls, 0);
});

test('inspector snapshots capture and references before any asynchronous read', async () => {
  const { s, input, options } = setup();
  const original = copy(input);
  const objects = { readEvidence: async request => {
    assert(Object.isFrozen(request.producer.pins));
    const read = await s.objects.readEvidence(request);
    if (request.kind === 'init') {
      input.producer.pins.imageDigest = `sha256:${'f'.repeat(64)}`;
      input.bundle.files[0].sha256 = 'f'.repeat(64);
      input.fixtureFile.path = 'altered'; input.evidence.drain.versionId = 'changed';
    }
    return { bytes: read.bytes, versionId: request.reference.versionId };
  } };
  assert.equal(await createNativeEvidenceInspector({ ...options, objects }).verify(input), true);
  assert.notDeepEqual(input, original);
  assert.equal(s.reads.at(-1).reference.versionId, original.evidence.drain.versionId);
});

test('accessor object read results refuse without invoking getters', async () => {
  const { s, input, options } = setup(); let calls = 0;
  const objects = { readEvidence: async () => {
    const result = { versionId: s.evidence.init.versionId };
    Object.defineProperty(result, 'bytes', { enumerable: true, get() { calls++; return s.bytes.init; } });
    return result;
  } };
  await assert.rejects(createNativeEvidenceInspector({ ...options, objects }).verify(input), error);
  assert.equal(calls, 0);
});
