import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createS3FixtureObjects } from '../s3-objects.mjs';
import { createS3CheckpointStore } from '../checkpoint-store.mjs';
import { createNativeEvidenceInspector } from '../native-evidence.mjs';
import { syntheticNativeEvidence } from '../../../../../packages/contracts/test/native-evidence-fixture.mjs';
import { fixtureReceiptIdentity } from '../../../../../packages/contracts/qualification-sdk/validate.mjs';
import { liveFixture } from './fixture.mjs';
import { bucket, kmsKeyArn, checksum, fakeS3 } from './fake-s3.mjs';

test('create-only S3 bundle/sentinel/receipt versions are reread and bound to publication', async () => {
  const f = liveFixture(), s3 = fakeS3();
  const objects = createS3FixtureObjects({ bucket, kmsKeyArn, client: s3.client });
  let inspections = 0;
  const store = createS3CheckpointStore({ objects, evidenceInspector: {
    verify: async ({ producer, evidence, bundle, fixtureFile }) => {
      assert.deepEqual(producer, f.producer);
      assert.deepEqual(evidence, f.evidence);
      assert.deepEqual(bundle, f.bundle);
      assert.deepEqual(fixtureFile, f.sentinel);
      inspections++;
      return true;
    },
  } });
  const prepared = await store.prepareCommit({ producer: f.producer, bundle: f.bundle,
    fixtureFile: f.sentinel, evidence: f.evidence });
  assert.equal(inspections, 1);
  assert.equal(prepared.receipt.completeRecoveryCheckpoint, false);
  assert.equal(prepared.receipt.sessionStoreQualified, false);
  assert.equal(s3.objects.size, 3);
  assert.equal(s3.calls.filter(c => c.type === 'PutObjectCommand').length, 3);
  assert.equal(s3.calls.filter(c => c.type === 'GetObjectCommand').length, 3);
  const identity = fixtureReceiptIdentity(prepared.receipt);
  const b = prepared.receipt.bundle;
  const loaded = await store.load({ producer: f.producer, current: f.current,
    publication: { outcome: 'LOADED', ...identity, bundleObjectId: b.objectId,
      bundleVersionId: b.versionId, bundleSha256: b.sha256, bundleBytes: b.bytes,
      workspaceSha256: prepared.receipt.workspaceSha256 } });
  assert.deepEqual(loaded.bundle, f.bundle);
  assert.deepEqual(loaded.fixtureFile, f.sentinel);
  assert.deepEqual(loaded.receipt, prepared.receipt);
  const reads = s3.calls.filter(c => c.type === 'GetObjectCommand').slice(-3);
  assert.equal(reads[0].input.VersionId, undefined); // Receipt hash is selected by the registry.
  assert.equal(reads[1].input.VersionId, b.versionId);
  assert.equal(reads[2].input.VersionId, prepared.receipt.workspace.entries[0].object.versionId);
  assert(s3.calls.every(c => c.input.Key.startsWith(`qualification-sdk/fixture/runs/${f.producer.runUuid}/`)));
});

test('evidence refusal makes no S3 write; altered readback and foreign publication refuse', async () => {
  const f = liveFixture(), s3 = fakeS3();
  const objects = createS3FixtureObjects({ bucket, kmsKeyArn, client: s3.client });
  const denied = createS3CheckpointStore({ objects, evidenceInspector: { verify: async () => false } });
  await assert.rejects(denied.prepareCommit({ producer: f.producer, bundle: f.bundle,
    fixtureFile: f.sentinel, evidence: f.evidence }), /FIXTURE_CHECKPOINT_STORE_REFUSED/);
  assert.equal(s3.calls.length, 0);
  const store = createS3CheckpointStore({ objects,
    evidenceInspector: { verify: async () => true } });
  const prepared = await store.prepareCommit({ producer: f.producer, bundle: f.bundle,
    fixtureFile: f.sentinel, evidence: f.evidence });
  const identity = fixtureReceiptIdentity(prepared.receipt), b = prepared.receipt.bundle;
  const publication = { outcome: 'LOADED', ...identity, bundleObjectId: b.objectId,
    bundleVersionId: b.versionId, bundleSha256: b.sha256, bundleBytes: b.bytes,
    workspaceSha256: prepared.receipt.workspaceSha256 };
  await assert.rejects(store.load({ publication: { ...publication,
    receiptSha256: 'f'.repeat(64) }, producer: f.producer }));
  s3.alter();
  await assert.rejects(store.load({ publication, producer: f.producer }),
    /FIXTURE_OBJECT_IO_REFUSED/);
});

test('checkpoint writes the exact verified immutable capture despite caller mutation after verification', async () => {
  const f = liveFixture(), s3 = fakeS3();
  const original = structuredClone({ producer: f.producer, bundle: f.bundle, fixtureFile: f.sentinel });
  const nowMs = Date.now();
  const signed = syntheticNativeEvidence({ producer: f.producer, bundle: f.bundle,
    fixtureFile: f.sentinel, nowMs });
  const actual = createNativeEvidenceInspector({ objects: signed.objects,
    admission: signed.admission, now: () => nowMs });
  const objects = createS3FixtureObjects({ bucket, kmsKeyArn, client: s3.client });
  const store = createS3CheckpointStore({ objects, now: () => nowMs,
    evidenceInspector: { verify: input => {
      assert(Object.isFrozen(input.bundle.files[0]));
      const pending = actual.verify(input);
      pending.then(() => {
        const raw = Buffer.from('different bytes after trusted verification');
        Object.assign(f.bundle.files[0], { base64: raw.toString('base64'), bytes: raw.length,
          sha256: createHash('sha256').update(raw).digest('hex') });
        f.bundle.totalBytes = f.bundle.files.reduce((n, file) => n + file.bytes, 0);
        f.producer.pins.imageDigest = `sha256:${'f'.repeat(64)}`;
        f.sentinel.path = 'changed'; signed.evidence.init.sha256 = 'f'.repeat(64);
      });
      return pending;
    } } });
  const prepared = await store.prepareCommit({ producer: f.producer, bundle: f.bundle,
    fixtureFile: f.sentinel, evidence: signed.evidence });
  assert.notDeepEqual(f.bundle, original.bundle);
  assert.deepEqual(prepared.receipt.producer, original.producer);
  assert.equal(s3.objects.size, 3);
  const stored = [...s3.objects.entries()].find(([key]) => key.includes('/bundle/'))[1];
  assert.deepEqual(JSON.parse(stored.bytes.toString('utf8')), original.bundle);
  assert.equal(prepared.receipt.workspace.entries[0].path, original.fixtureFile.path);
  assert.notEqual(prepared.receipt.evidence.init.sha256, signed.evidence.init.sha256);
});

test('S3 adapter refuses a missing version and a stream beyond the read ceiling', async () => {
  const f = liveFixture(), raw = Buffer.from('synthetic-object');
  const missingVersion = createS3FixtureObjects({ bucket, kmsKeyArn, client: {
    send: async command => {
      assert(command instanceof PutObjectCommand);
      return { VersionId: 'null', ChecksumSHA256: checksum(raw),
        ServerSideEncryption: 'aws:kms', SSEKMSKeyId: kmsKeyArn };
    },
  } });
  await assert.rejects(missingVersion.put({ runUuid: f.producer.runUuid,
    kind: 'bundle', objectId: f.receipt.bundle.objectId, bytes: raw, maxBytes: 64 }),
  /FIXTURE_OBJECT_IO_REFUSED/);

  const overlong = createS3FixtureObjects({ bucket, kmsKeyArn, client: {
    send: async command => {
      assert(command instanceof GetObjectCommand);
      return { VersionId: 'immutable-test', ContentLength: 1,
        ChecksumSHA256: checksum(raw), ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: kmsKeyArn,
        Body: (async function* () { yield Buffer.alloc(65); })() };
    },
  } });
  await assert.rejects(overlong.read({ runUuid: f.producer.runUuid,
    kind: 'bundle', objectId: f.receipt.bundle.objectId,
    versionId: 'immutable-test', expectedSha256: createHash('sha256').update(raw).digest('hex'),
    maxBytes: 64 }), /FIXTURE_OBJECT_IO_REFUSED/);
});

test('native evidence reads only the producer-scoped immutable version and cannot be written through this adapter', async () => {
  const f = liveFixture(), s3 = fakeS3();
  const objects = createS3FixtureObjects({ bucket, kmsKeyArn, client: s3.client });
  const raw = Buffer.from('{"kind":"init","observation":"synthetic"}');
  const reference = { ...f.evidence.init, bytes: raw.length,
    sha256: createHash('sha256').update(raw).digest('hex') };
  const key = `qualification-sdk/fixture/runs/${f.producer.runUuid}/evidence/init/${reference.objectId}`;
  s3.objects.set(key, { bytes: raw, versionId: reference.versionId });
  const observed = await objects.readEvidence({ producer: f.producer, kind: 'init', reference });
  assert.deepEqual(observed.bytes, raw);
  assert.equal(observed.versionId, reference.versionId);
  assert.equal(s3.calls.length, 1);
  assert.equal(s3.calls[0].input.Key, key);
  assert.equal(s3.calls[0].input.VersionId, reference.versionId);

  const foreign = { ...reference, scopes: [{ ...reference.scopes[0], tenantId: 'foreign' }] };
  assert.throws(() => objects.readEvidence({ producer: f.producer, kind: 'init', reference: foreign }),
    /FIXTURE_OBJECT_IO_REFUSED/);
  assert.throws(() => objects.readEvidence({ producer: f.producer, kind: 'unknown', reference }),
    /FIXTURE_OBJECT_IO_REFUSED/);
  assert.throws(() => objects.readEvidence({ producer: f.producer, kind: 'init',
    reference: { ...reference, bytes: 65537 } }), /FIXTURE_OBJECT_IO_REFUSED/);
  assert.throws(() => objects.readEvidence({ producer: f.producer, kind: 'init',
    reference: { ...reference, versionId: undefined } }), /FIXTURE_OBJECT_IO_REFUSED/);
  assert.equal(s3.calls.length, 1);
  await assert.rejects(objects.put({ runUuid: f.producer.runUuid, kind: 'evidence/init',
    objectId: reference.objectId, bytes: raw, maxBytes: 65536 }), /FIXTURE_OBJECT_IO_REFUSED/);
  assert.equal(s3.calls.length, 1);

  const wrongVersion = createS3FixtureObjects({ bucket, kmsKeyArn, client: {
    send: async command => {
      assert(command instanceof GetObjectCommand);
      return { VersionId: 'other-version', ContentLength: raw.length,
        ChecksumSHA256: checksum(raw), ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: kmsKeyArn, Body: (async function* () { yield raw; })() };
    },
  } });
  await assert.rejects(wrongVersion.readEvidence({ producer: f.producer, kind: 'init', reference }),
    /FIXTURE_OBJECT_IO_REFUSED/);
  s3.alter();
  await assert.rejects(objects.readEvidence({ producer: f.producer, kind: 'init', reference }),
    /FIXTURE_OBJECT_IO_REFUSED/);
});
