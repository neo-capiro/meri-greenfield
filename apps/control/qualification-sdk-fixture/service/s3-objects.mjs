// Trusted, bounded object I/O for the private interruption fixture only.
// The service owns its bucket, key prefix, KMS key and credentials. Workers
// never receive this client or choose an S3 location.
import { createHash } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { validateShape, nativeEvidenceKinds } from '../../../../packages/contracts/qualification-sdk/validate.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA = /^[0-9a-f]{64}$/;
const STORED_KINDS = new Set(['bundle', 'sentinel', 'receipt']);
const EVIDENCE_KINDS = new Set(nativeEvidenceKinds);
const EVIDENCE_PATHS = new Set([...EVIDENCE_KINDS].map(kind => `evidence/${kind}`));
const evidenceLimit = 64 * 1024;
const fail = () => { throw new Error('FIXTURE_OBJECT_IO_REFUSED'); };
const sha = bytes => createHash('sha256').update(bytes).digest();
const checksum = bytes => sha(bytes).toString('base64');
const hex = bytes => sha(bytes).toString('hex');
const version = value => typeof value === 'string' && value.length > 0 &&
  value.length <= 256 && value !== 'null';

function identity(runUuid, kind, objectId, allowedKinds = STORED_KINDS) {
  if (!UUID.test(runUuid) || !allowedKinds.has(kind) || !UUID.test(objectId)) fail();
  return `qualification-sdk/fixture/runs/${runUuid}/${kind}/${objectId}`;
}

async function boundedBody(body, maxBytes) {
  if (!body || typeof body[Symbol.asyncIterator] !== 'function') fail();
  const chunks = [];
  let total = 0;
  for await (const chunk of body) {
    if (!(chunk instanceof Uint8Array) || chunk.length > maxBytes - total) fail();
    total += chunk.length;
    chunks.push(Buffer.from(chunk));
  }
  if (total === 0) fail();
  return Buffer.concat(chunks, total);
}

/** One-shot writes and exact-version reads in a dedicated versioned bucket. */
function createObjectTransport({ bucket, kmsKeyArn, region = 'us-east-1', client } = {}) {
  if (bucket !== 'meri-greenfield-qual-checkpoint-967807252336-us-east-1' ||
      typeof kmsKeyArn !== 'string' ||
      !/^arn:aws:kms:us-east-1:967807252336:key\/[0-9a-f-]{36}$/.test(kmsKeyArn) ||
      region !== 'us-east-1') fail();
  const owned = client === undefined;
  const s3 = client ?? new S3Client({ region, maxAttempts: 1 });
  if (!s3 || typeof s3.send !== 'function') fail();

  async function put({ runUuid, kind, objectId, bytes, maxBytes, signal }, allowedKinds = STORED_KINDS) {
    const key = identity(runUuid, kind, objectId, allowedKinds);
    if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > maxBytes ||
        !Number.isSafeInteger(maxBytes) || maxBytes < 1 || signal?.aborted) fail();
    const expected = checksum(bytes);
    const result = await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key,
      Body: bytes, ContentLength: bytes.length, IfNoneMatch: '*',
      ChecksumSHA256: expected, ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: kmsKeyArn }), { abortSignal: signal });
    if (!version(result?.VersionId) || result.ChecksumSHA256 !== expected ||
        result.ServerSideEncryption !== 'aws:kms' || result.SSEKMSKeyId !== kmsKeyArn) fail();
    return Object.freeze({ objectId, versionId: result.VersionId,
      sha256: hex(bytes), bytes: bytes.length });
  }

  async function readObject({ runUuid, kind, objectId, versionId, expectedSha256,
    expectedBytes, maxBytes, signal }, allowedKinds) {
    const key = identity(runUuid, kind, objectId, allowedKinds);
    if ((versionId !== undefined && !version(versionId)) || !SHA.test(expectedSha256) ||
        (expectedBytes !== undefined && (!Number.isSafeInteger(expectedBytes) || expectedBytes < 1)) ||
        !Number.isSafeInteger(maxBytes) || maxBytes < 1 || signal?.aborted) fail();
    const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key,
      ...(versionId === undefined ? {} : { VersionId: versionId }), ChecksumMode: 'ENABLED' }),
    { abortSignal: signal });
    if (!version(result?.VersionId) || (versionId !== undefined && result.VersionId !== versionId) ||
        !Number.isSafeInteger(result.ContentLength) || result.ContentLength < 1 ||
        result.ContentLength > maxBytes ||
        (expectedBytes !== undefined && result.ContentLength !== expectedBytes) ||
        result.ServerSideEncryption !== 'aws:kms' || result.SSEKMSKeyId !== kmsKeyArn) fail();
    const bytes = await boundedBody(result.Body, maxBytes);
    if (signal?.aborted || bytes.length !== result.ContentLength || hex(bytes) !== expectedSha256 ||
        result.ChecksumSHA256 !== checksum(bytes)) fail();
    return Object.freeze({ bytes, versionId: result.VersionId });
  }

  function read(input) { return readObject(input, STORED_KINDS); }

  function readEvidence({ producer, kind, reference, signal } = {}) {
    if (!producer || !UUID.test(producer.runUuid) ||
        !producer.identity || !producer.identity.canonical ||
        !EVIDENCE_KINDS.has(kind) || !reference ||
        !Array.isArray(reference.scopes) || reference.scopes.length !== 1) fail();
    const scope = reference.scopes[0], producerIdentity = producer.identity;
    if (!scope || scope.kind !== 'tenant' ||
        scope.tenantId !== producerIdentity.canonical.tenantId ||
        scope.resourceId !== scope.tenantId ||
        scope.policyRevision !== producerIdentity.policyRevision ||
        !UUID.test(reference.objectId) || !version(reference.versionId) ||
        !SHA.test(reference.sha256) ||
        !Number.isSafeInteger(reference.bytes) ||
        reference.bytes < 1 || reference.bytes > evidenceLimit) fail();
    return readObject({ runUuid: producer.runUuid, kind: `evidence/${kind}`,
      objectId: reference.objectId, versionId: reference.versionId,
      expectedSha256: reference.sha256, expectedBytes: reference.bytes,
      maxBytes: evidenceLimit, signal }, EVIDENCE_PATHS);
  }

  return Object.freeze({ put, read, readEvidence, readObject,
    close: () => { if (owned) s3.destroy(); } });
}

/** Ordinary worker/checkpoint object API: evidence is read-only here. */
export function createS3FixtureObjects(options = {}) {
  const io = createObjectTransport(options);
  return Object.freeze({ put: input => io.put(input), read: io.read, readEvidence: io.readEvidence, close: io.close });
}

/** Trusted publisher API. Every actual S3 effect rechecks owner currentness. */
export function createS3NativeEvidenceObjects({ authorize, ...options } = {}) {
  if (typeof authorize !== 'function') fail();
  const io = createObjectTransport(options);
  async function current(producer, signal) {
    if (signal?.aborted) fail();
    let decision;
    try { decision = await authorize({ producer, signal }); } catch { fail(); }
    if (decision !== true || signal?.aborted) fail();
  }
  async function putEvidence({ producer, kind, objectId, bytes, signal } = {}) {
    validateShape('FixtureContext', producer);
    if (!EVIDENCE_KINDS.has(kind) || !UUID.test(objectId) || !Buffer.isBuffer(bytes) ||
        bytes.length < 1 || bytes.length > evidenceLimit) fail();
    // Copy before awaiting authorization: a caller cannot change the admitted bytes.
    const raw = Buffer.from(bytes), runUuid = producer.runUuid;
    const owner = structuredClone(producer);
    await current(owner, signal);
    const reference = await io.put({ runUuid, kind: `evidence/${kind}`, objectId,
      bytes: raw, maxBytes: evidenceLimit, signal }, EVIDENCE_PATHS);
    await current(owner, signal);
    const readback = await io.readObject({ runUuid, kind: `evidence/${kind}`, objectId,
      versionId: reference.versionId, expectedSha256: reference.sha256,
      expectedBytes: reference.bytes, maxBytes: evidenceLimit, signal }, EVIDENCE_PATHS);
    if (!readback.bytes.equals(raw)) fail();
    return reference;
  }
  return Object.freeze({ putEvidence, close: io.close });
}
