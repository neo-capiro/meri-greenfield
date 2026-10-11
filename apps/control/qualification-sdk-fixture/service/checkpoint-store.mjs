// Partial SDK fixture persistence. Registry publication is a separate,
// current-fence transaction; orphaned create-only objects are never authority.
import { randomUUID, createHash } from 'node:crypto';
import canonicalize from 'canonicalize';
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { assertFixtureRequest, assertFixtureReceipt, fixtureReceiptIdentity }
  from '../../../../packages/contracts/qualification-sdk/validate.mjs';
import { assertVerifiedReadback } from '../state/receipt.mjs';

const fail = () => { throw new Error('FIXTURE_CHECKPOINT_STORE_REFUSED'); };
const bundleLimit = 48 * 1024 * 1024;
const sentinelLimit = 64 * 1024;
const receiptLimit = 1024 * 1024;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => canonicalSha256(a) === canonicalSha256(b);
const reference = (record, scopes) => Object.freeze({ ...record, scopes });
const inventory = bundle => ({ format: bundle.format, directories: bundle.directories,
  files: bundle.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
  totalBytes: bundle.totalBytes });

function canonicalBytes(value) {
  const serialized = canonicalize(value);
  if (typeof serialized !== 'string') fail();
  return Buffer.from(serialized, 'utf8');
}

function parsedCanonical(bytes) {
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch { fail(); }
  if (!canonicalBytes(value).equals(bytes)) fail();
  return value;
}

function scopeOf(producer) {
  const tenantId = producer.identity.canonical.tenantId;
  return [{ tenantId, kind: 'tenant', resourceId: tenantId,
    policyRevision: producer.identity.policyRevision }];
}

function assertClock(now) {
  const at = now();
  if (!Number.isSafeInteger(at) || at < 1) fail();
  return at;
}

/**
 * `objects` is create-only S3 I/O with exact-version readback. `evidenceInspector`
 * is a separate trusted capability that must read the four referenced native
 * evidence objects and prove fixture quiescence; refs/booleans from a worker
 * do not satisfy this dependency.
 */
export function createS3CheckpointStore({ objects, evidenceInspector,
  now = Date.now, id = randomUUID, publisherId = 'meri-sdk-fixture-store' } = {}) {
  if (!objects || typeof objects.put !== 'function' || typeof objects.read !== 'function' ||
      !evidenceInspector || typeof evidenceInspector.verify !== 'function' ||
      typeof now !== 'function' || typeof id !== 'function' ||
      typeof publisherId !== 'string' || publisherId.length < 1 || publisherId.length > 128) fail();
  let lastClock = 0;
  const clock = () => {
    const at = assertClock(now);
    if (at < lastClock) fail();
    lastClock = at;
    return at;
  };

  async function putAndRead({ producer, kind, objectId, bytes, maxBytes, signal }) {
    const runUuid = producer.runUuid;
    const stored = await objects.put({ runUuid, kind, objectId, bytes, maxBytes, signal });
    const read = await objects.read({ runUuid, kind, objectId,
      versionId: stored.versionId, expectedSha256: stored.sha256,
      expectedBytes: stored.bytes, maxBytes, signal });
    if (!read.bytes.equals(bytes)) fail();
    return stored;
  }

  async function prepareCommit({ producer, bundle, fixtureFile, evidence, signal }) {
    const startedAtMs = clock();
    assertFixtureRequest({ channelVersion: 'sdk-fixture/1', profile: 'sdk-interruption-fixture-v1',
      operation: 'commitFixtureCheckpoint', requestId: id(), context: producer,
      bundle, fixtureFile, evidence }, { nowMs: startedAtMs });
    if (signal?.aborted) fail();
    if (await evidenceInspector.verify({ producer, evidence, signal }) !== true) fail();
    if (signal?.aborted) fail();

    const scopes = scopeOf(producer);
    const bundleBytes = canonicalBytes(bundle);
    const sentinelBytes = Buffer.from(fixtureFile.base64, 'base64');
    const bundleObject = reference(await putAndRead({ producer, kind: 'bundle',
      objectId: id(), bytes: bundleBytes, maxBytes: bundleLimit, signal }), scopes);
    const sentinelObject = reference(await putAndRead({ producer, kind: 'sentinel',
      objectId: id(), bytes: sentinelBytes, maxBytes: sentinelLimit, signal }), scopes);
    if (sentinelObject.sha256 !== fixtureFile.sha256 || sentinelObject.bytes !== fixtureFile.bytes ||
        bundleObject.sha256 !== sha(bundleBytes)) fail();

    const createdAtMs = clock();
    const workspace = { contractVersion: '0.1.0', manifestId: id(),
      binding: producer.identity.canonical, logicalCwd: '/workspace/conversation',
      entries: [{ path: fixtureFile.path, kind: 'file', executable: false,
        object: sentinelObject }], scopes, createdAt: new Date(createdAtMs).toISOString() };
    const workspaceSha256 = canonicalSha256(workspace);
    const committedAtMs = clock();
    const receipt = { channelVersion: 'sdk-fixture/1', profile: 'sdk-interruption-fixture-v1',
      completeRecoveryCheckpoint: false, sessionStoreQualified: false,
      receiptId: id(), producer,
      coverage: { native: 'declared-transcript-tree', workspace: 'one-synthetic-sentinel' },
      bundle: bundleObject, nativeInventory: inventory(bundle), workspace,
      workspaceSha256, evidence,
      commit: { commitId: id(), publisherId, committedAtMs,
        publication: 'CURRENT_FENCE_COMMITTED', publicationFence: producer.identity.fence,
        bundleReadback: bundleObject, workspaceReadbackSha256: workspaceSha256 } };
    const identity = fixtureReceiptIdentity(receipt);
    assertFixtureReceipt(receipt, { producer, reference: identity, nowMs: committedAtMs });
    const receiptBytes = canonicalBytes(receipt);
    if (receiptBytes.length > receiptLimit) fail();
    await putAndRead({ producer, kind: 'receipt', objectId: receipt.receiptId,
      bytes: receiptBytes, maxBytes: receiptLimit, signal });
    const readback = { verified: true, verifierId: publisherId,
      bundleReadback: bundleObject, workspaceReadbackSha256: workspaceSha256 };
    assertVerifiedReadback(readback, receipt);
    return Object.freeze({ receipt, readback });
  }

  async function load({ publication, producer, signal }) {
    if (!publication || publication.outcome !== 'LOADED' || signal?.aborted) fail();
    const receiptBytes = await objects.read({ runUuid: producer.runUuid, kind: 'receipt',
      objectId: publication.receiptId, expectedSha256: publication.receiptSha256,
      maxBytes: receiptLimit, signal });
    const receipt = parsedCanonical(receiptBytes.bytes);
    const expected = { receiptId: publication.receiptId,
      receiptSha256: publication.receiptSha256 };
    assertFixtureReceipt(receipt, { producer, reference: expected, nowMs: clock() });
    if (receipt.bundle.objectId !== publication.bundleObjectId ||
        receipt.bundle.versionId !== publication.bundleVersionId ||
        receipt.bundle.sha256 !== publication.bundleSha256 ||
        receipt.bundle.bytes !== publication.bundleBytes ||
        receipt.workspaceSha256 !== publication.workspaceSha256) fail();
    const bundleObject = receipt.bundle;
    const storedBundle = await objects.read({ runUuid: producer.runUuid, kind: 'bundle',
      objectId: bundleObject.objectId, versionId: bundleObject.versionId,
      expectedSha256: bundleObject.sha256, expectedBytes: bundleObject.bytes,
      maxBytes: bundleLimit, signal });
    const bundle = parsedCanonical(storedBundle.bytes);
    if (!same(inventory(bundle), receipt.nativeInventory) ||
        !same(bundle.binding, producer.namespace)) fail();
    const sentinelObject = receipt.workspace.entries[0].object;
    const storedSentinel = await objects.read({ runUuid: producer.runUuid, kind: 'sentinel',
      objectId: sentinelObject.objectId, versionId: sentinelObject.versionId,
      expectedSha256: sentinelObject.sha256, expectedBytes: sentinelObject.bytes,
      maxBytes: sentinelLimit, signal });
    const fixtureFile = { path: receipt.workspace.entries[0].path,
      bytes: storedSentinel.bytes.length, sha256: sha(storedSentinel.bytes),
      base64: storedSentinel.bytes.toString('base64') };
    if (canonicalSha256(receipt.workspace) !== publication.workspaceSha256 ||
        receipt.workspace.entries[0].object.sha256 !== fixtureFile.sha256) fail();
    const readback = { verified: true, verifierId: publisherId,
      bundleReadback: bundleObject, workspaceReadbackSha256: publication.workspaceSha256 };
    assertVerifiedReadback(readback, receipt);
    return Object.freeze({ receipt, readback, bundle, fixtureFile });
  }

  return Object.freeze({ prepareCommit, load });
}
