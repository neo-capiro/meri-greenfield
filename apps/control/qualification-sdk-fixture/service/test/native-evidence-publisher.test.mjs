import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createS3FixtureObjects, createS3NativeEvidenceObjects } from '../s3-objects.mjs';
import { liveFixture } from './fixture.mjs';
import { bucket, kmsKeyArn, checksum, fakeS3 } from './fake-s3.mjs';

const raw = Buffer.from('{"observation":"synthetic-only"}');
const objectId = '00000000-0000-4000-8000-000000000041';

test('ordinary adapter refuses evidence writes including an attempted allowed-kind override', async () => {
  const f = liveFixture(), s3 = fakeS3();
  const objects = createS3FixtureObjects({ bucket, kmsKeyArn, client: s3.client });
  await assert.rejects(objects.put({ runUuid: f.producer.runUuid,
    kind: 'evidence/init', objectId, bytes: raw, maxBytes: 65536 }, new Set(['evidence/init'])),
  /FIXTURE_OBJECT_IO_REFUSED/);
  assert.equal(s3.calls.length, 0);
});

test('trusted evidence storage is create-only, producer-scoped, exact-version read back and authorizes both effects', async () => {
  const f = liveFixture(), s3 = fakeS3(), decisions = [];
  const objects = createS3NativeEvidenceObjects({ bucket, kmsKeyArn, client: s3.client,
    authorize: async ({ producer, signal }) => { decisions.push(producer); assert.equal(signal, undefined); return true; } });
  assert.equal(objects.put, undefined);
  const reference = await objects.putEvidence({ producer: f.producer, kind: 'init', objectId, bytes: raw });
  assert.equal(reference.bytes, raw.length);
  assert.equal(reference.sha256, createHash('sha256').update(raw).digest('hex'));
  assert.equal(decisions.length, 2);
  assert.equal(s3.calls.length, 2);
  assert.equal(s3.calls[0].input.Key, `qualification-sdk/fixture/runs/${f.producer.runUuid}/evidence/init/${objectId}`);
  assert.equal(s3.calls[1].input.VersionId, reference.versionId);
  await assert.rejects(objects.putEvidence({ producer: f.producer, kind: 'bundle', objectId, bytes: raw }), /REFUSED/);
  assert.equal(s3.calls.length, 2);
});

test('stale, aborted or malformed trusted publication cannot produce an S3 effect', async () => {
  const f = liveFixture(), s3 = fakeS3();
  const objects = createS3NativeEvidenceObjects({ bucket, kmsKeyArn, client: s3.client,
    authorize: async () => false });
  await assert.rejects(objects.putEvidence({ producer: f.producer, kind: 'init', objectId, bytes: raw }), /REFUSED/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(objects.putEvidence({ producer: f.producer, kind: 'init', objectId, bytes: raw,
    signal: controller.signal }), /REFUSED/);
  await assert.rejects(objects.putEvidence({ producer: f.producer, kind: 'init', objectId, bytes: Buffer.alloc(65537) }), /REFUSED/);
  assert.equal(s3.calls.length, 0);
});

test('revocation after PUT forbids readback and uncertain writes are never retried', async () => {
  const f = liveFixture(), s3 = fakeS3(); let checks = 0;
  const objects = createS3NativeEvidenceObjects({ bucket, kmsKeyArn, client: s3.client,
    authorize: async () => ++checks === 1 });
  await assert.rejects(objects.putEvidence({ producer: f.producer, kind: 'exit', objectId, bytes: raw }), /REFUSED/);
  assert.equal(s3.calls.length, 1);
  assert.equal(s3.calls[0].type, 'PutObjectCommand');
  let sends = 0;
  const uncertain = createS3NativeEvidenceObjects({ bucket, kmsKeyArn, authorize: async () => true,
    client: { send: async () => { sends++; throw new Error('UNCERTAIN_PRIVATE'); } } });
  await assert.rejects(uncertain.putEvidence({ producer: f.producer, kind: 'drain', objectId, bytes: raw }));
  assert.equal(sends, 1);
});

test('trusted adapter rejects wrong KMS, version, size and checksum on readback', async () => {
  const f = liveFixture();
  for (const mutation of ['kms', 'version', 'size', 'checksum', 'body']) {
    let sends = 0;
    const objects = createS3NativeEvidenceObjects({ bucket, kmsKeyArn, authorize: async () => true,
      client: { send: async command => {
        sends++;
        const result = { VersionId: 'immutable-version', ChecksumSHA256: checksum(raw),
          ServerSideEncryption: 'aws:kms', SSEKMSKeyId: kmsKeyArn };
        if (command instanceof PutObjectCommand) return result;
        assert(command instanceof GetObjectCommand);
        Object.assign(result, { ContentLength: raw.length, Body: (async function* () { yield mutation === 'body' ? Buffer.from('wrong') : raw; })() });
        if (mutation === 'kms') result.SSEKMSKeyId = kmsKeyArn.replace('000001', '000002');
        if (mutation === 'version') result.VersionId = 'different-version';
        if (mutation === 'size') result.ContentLength++;
        if (mutation === 'checksum') result.ChecksumSHA256 = checksum(Buffer.from('wrong'));
        return result;
      } } });
    await assert.rejects(objects.putEvidence({ producer: f.producer, kind: 'init', objectId, bytes: raw }), /REFUSED/);
    assert.equal(sends, 2);
  }
});

// These keys and observations are synthetic. Passing these tests establishes
// source contract behavior, not trusted ECS identity or native lifecycle proof.
import { syntheticNativeEvidence } from '../../../../../packages/contracts/test/native-evidence-fixture.mjs';
import { createNativeEvidencePublisher } from '../native-evidence-publisher.mjs';
import { createNativeEvidenceInspector } from '../native-evidence.mjs';
import { nativeEvidenceLimit } from '../../../../../packages/contracts/qualification-sdk/native-evidence.mjs';

function publicationSetup(extra = {}) {
  const f = liveFixture(), nowMs = f.producer.identity.admittedAtMs + 6000;
  const native = syntheticNativeEvidence({ producer: f.producer, bundle: f.bundle,
    fixtureFile: f.sentinel, nowMs });
  const s3 = fakeS3(); let ids = 50, authorizations = 0;
  const authorize = async () => { authorizations++; return true; };
  const objects = createS3NativeEvidenceObjects({ bucket, kmsKeyArn, client: s3.client, authorize });
  const publisher = createNativeEvidencePublisher({ objects, producer: f.producer,
    admission: native.admission, authorize, now: () => nowMs,
    id: () => `00000000-0000-4000-8000-${String(ids++).padStart(12, '0')}`, ...extra });
  return { f, native, s3, publisher, nowMs, authorizations: () => authorizations,
    input: { records: native.bytes, bundle: f.bundle, fixtureFile: f.sentinel } };
}

test('publisher refuses oversized observations before copying or authorizing', async () => {
  const s = publicationSetup(), oversized = new Uint8Array(nativeEvidenceLimit + 1);
  s.input.records = { ...s.input.records, init: oversized };
  const original = Buffer.from; let copied = false;
  Buffer.from = function(value, ...args) {
    if (value === oversized) copied = true;
    return original.call(this, value, ...args);
  };
  try { await assert.rejects(s.publisher.publish(s.input), /PUBLICATION_REFUSED/); }
  finally { Buffer.from = original; }
  assert.equal(copied, false);
  assert.equal(s.authorizations(), 0);
  assert.equal(s.s3.calls.length, 0);
});

test('publisher refuses inconsistent capture without cloning bulk input', async () => {
  const s = publicationSetup(); s.input.bundle.totalBytes++;
  const original = globalThis.structuredClone; let copied = false;
  globalThis.structuredClone = function(value, ...args) {
    if (value === s.input.bundle) copied = true;
    return original(value, ...args);
  };
  try { await assert.rejects(s.publisher.publish(s.input), /PUBLICATION_REFUSED/); }
  finally { globalThis.structuredClone = original; }
  assert.equal(copied, false);
  assert.equal(s.authorizations(), 0);
  assert.equal(s.s3.calls.length, 0);
});

test('publisher returns four scoped immutable references verified again by the independent inspector', async () => {
  const s = publicationSetup();
  assert.equal(s.s3.calls.length, 0);
  const evidence = await s.publisher.publish(s.input);
  assert.deepEqual(Object.keys(evidence), ['init', 'interrupt', 'exit', 'drain']);
  assert.equal(Object.isFrozen(evidence), true);
  assert.equal(s.s3.calls.filter(call => call.type === 'PutObjectCommand').length, 4);
  assert.equal(s.s3.calls.filter(call => call.type === 'GetObjectCommand').length, 4);
  for (const reference of Object.values(evidence)) {
    assert.deepEqual(reference.scopes, [{ kind: 'tenant', tenantId: s.f.producer.identity.canonical.tenantId,
      resourceId: s.f.producer.identity.canonical.tenantId, policyRevision: s.f.producer.identity.policyRevision }]);
  }
  const inspector = createNativeEvidenceInspector({ admission: s.native.admission,
    objects: createS3FixtureObjects({ bucket, kmsKeyArn, client: s.s3.client }), now: () => s.nowMs });
  assert.equal(await inspector.verify({ producer: s.f.producer, bundle: s.f.bundle,
    fixtureFile: s.f.sentinel, evidence }), true);
  await assert.rejects(s.publisher.publish(s.input), /PUBLICATION_REFUSED/);
  assert.equal(s.s3.calls.filter(call => call.type === 'PutObjectCommand').length, 4);
});

test('publisher refuses stale currentness, foreign signed records and mismatched capture before writes', async () => {
  const denied = publicationSetup({ authorize: async () => false });
  await assert.rejects(denied.publisher.publish(denied.input), /PUBLICATION_REFUSED/);
  assert.equal(denied.s3.calls.length, 0);
  for (const mutation of ['signature', 'producer', 'capture', 'unknown']) {
    const s = publicationSetup();
    if (mutation === 'unknown') s.input.records = { ...s.input.records, other: Buffer.from('{}') };
    else if (mutation === 'capture') {
      const changed = structuredClone(s.f.sentinel);
      const bytes = Buffer.from('different complete workspace sentinel');
      changed.base64 = bytes.toString('base64'); changed.bytes = bytes.length;
      changed.sha256 = createHash('sha256').update(bytes).digest('hex');
      s.input.fixtureFile = changed;
    } else {
      const record = structuredClone(s.native.records.init);
      if (mutation === 'signature') record.signature.value = Buffer.alloc(64).toString('base64');
      else { record.producer.identity.canonical.actorId = '00000000-0000-4000-8000-000000000099'; }
      s.native.replace('init', record, { resign: mutation !== 'signature' });
      s.input.records = s.native.bytes;
    }
    await assert.rejects(s.publisher.publish(s.input), /PUBLICATION_REFUSED/);
    assert.equal(s.s3.calls.length, 0);
    assert.equal(s.authorizations(), 0);
  }
});

test('publisher rejects foreign admission, invalid IDs, accessors and cancellation without effects', async () => {
  let seen = 0;
  const s = publicationSetup();
  const hostile = { ...s.input.records };
  Object.defineProperty(hostile, 'init', { enumerable: true, get() { seen++; throw new Error('PRIVATE'); } });
  await assert.rejects(s.publisher.publish({ ...s.input, records: hostile }), /PUBLICATION_REFUSED/);
  assert.equal(seen, 0); assert.equal(s.s3.calls.length, 0);
  const badId = publicationSetup({ id: () => 'bad-id' });
  await assert.rejects(badId.publisher.publish(badId.input), /PUBLICATION_REFUSED/);
  assert.equal(badId.s3.calls.length, 0);
  const foreign = publicationSetup();
  foreign.native.admission.keyId = '0'.repeat(64);
  const publisher = createNativeEvidencePublisher({ objects: { putEvidence: () => { seen++; } },
    producer: foreign.f.producer, admission: foreign.native.admission,
    authorize: async () => true, now: () => foreign.nowMs });
  await assert.rejects(publisher.publish(foreign.input), /PUBLICATION_REFUSED/);
  assert.equal(seen, 0);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(s.publisher.publish({ ...s.input, signal: abort.signal }), /PUBLICATION_REFUSED/);
  assert.equal(s.s3.calls.length, 0);
});

test('publisher quarantines after an uncertain first object and rejects fabricated references', async () => {
  for (const mode of ['uncertain', 'reference']) {
    let writes = 0;
    const s = publicationSetup({ objects: { putEvidence: async () => {
      writes++;
      if (mode === 'uncertain') throw new Error('PRIVATE_UNCERTAIN');
      return { objectId, versionId: 'fake', sha256: '0'.repeat(64), bytes: 1 };
    } } });
    await assert.rejects(s.publisher.publish(s.input), /PUBLICATION_REFUSED/);
    await assert.rejects(s.publisher.publish(s.input), /PUBLICATION_REFUSED/);
    assert.equal(writes, 1);
  }
});

test('concurrent publications cannot both cross a pending authorization barrier', async () => {
  let release, authorizationCalls = 0;
  const barrier = new Promise(resolve => { release = resolve; });
  const s = publicationSetup({ authorize: async () => { authorizationCalls++; await barrier; return true; } });
  const first = s.publisher.publish(s.input);
  await assert.rejects(s.publisher.publish(s.input), /PUBLICATION_REFUSED/);
  assert.equal(authorizationCalls, 1);
  assert.equal(s.s3.calls.length, 0);
  release();
  await first;
  assert.equal(s.s3.calls.filter(call => call.type === 'PutObjectCommand').length, 4);
});
