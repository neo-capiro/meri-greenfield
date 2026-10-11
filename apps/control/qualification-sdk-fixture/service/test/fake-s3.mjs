// Test-only command simulator. No AWS client or credential is constructed.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

export const bucket = 'meri-greenfield-qual-checkpoint-967807252336-us-east-1';
export const kmsKeyArn = 'arn:aws:kms:us-east-1:967807252336:key/00000000-0000-4000-8000-000000000001';
export const checksum = bytes => createHash('sha256').update(bytes).digest('base64');

export function fakeS3() {
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
