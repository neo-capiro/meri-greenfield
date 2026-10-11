import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createS3FixtureObjects } from '../s3-objects.mjs';
import { createS3CheckpointStore } from '../checkpoint-store.mjs';
import { fixtureReceiptIdentity } from '../../../../../packages/contracts/qualification-sdk/validate.mjs';
import { liveFixture } from './fixture.mjs';

const bucket = 'meri-greenfield-qual-checkpoint-967807252336-us-east-1';
const kmsKeyArn = 'arn:aws:kms:us-east-1:967807252336:key/00000000-0000-4000-8000-000000000001';
const checksum = bytes => createHash('sha256').update(bytes).digest('base64');

function fakeS3() {
  const objects = new Map(), calls = [];
  let altered = false;
  const client = { async send(command) {
    const input = command.input;
    calls.push({ type: command.constructor.name, input });
    assert.equal(input.Bucket, bucket);
    if (command instanceof PutObjectCommand) {
      assert.equal(input.IfNoneMatch, '*');
      assert.equal(input.ServerSideEncryption, 'aws:kms');
      assert.equal(input.SSEKMSKeyId, kmsKeyArn);
      assert.equal(input.ChecksumSHA256, checksum(input.Body));
      if (objects.has(input.Key)) throw new Error('S3_PRECONDITION_FAILED');
      const versionId = `test-version-${objects.size + 1}`;
      objects.set(input.Key, { bytes: Buffer.from(input.Body), versionId });
      return { VersionId: versionId, ChecksumSHA256: checksum(input.Body),
        ServerSideEncryption: 'aws:kms', SSEKMSKeyId: kmsKeyArn };
    }
    assert(command instanceof GetObjectCommand);
    assert.equal(input.ChecksumMode, 'ENABLED');
    const saved = objects.get(input.Key);
    if (!saved) throw new Error('S3_NO_SUCH_KEY');
    if (input.VersionId) assert.equal(input.VersionId, saved.versionId);
    const body = altered ? Buffer.from('altered') : saved.bytes;
    return { VersionId: saved.versionId, ContentLength: body.length,
      ChecksumSHA256: checksum(saved.bytes), ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: kmsKeyArn, Body: (async function* () { yield body; })() };
  } };
  return { client, calls, objects, alter: () => { altered = true; } };
}

test('create-only S3 bundle/sentinel/receipt versions are reread and bound to publication', async () => {
  const f = liveFixture(), s3 = fakeS3();
  const objects = createS3FixtureObjects({ bucket, kmsKeyArn, client: s3.client });
  let inspections = 0;
  const store = createS3CheckpointStore({ objects, evidenceInspector: {
    verify: async ({ producer, evidence }) => {
      assert.deepEqual(producer, f.producer);
      assert.deepEqual(evidence, f.evidence);
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
