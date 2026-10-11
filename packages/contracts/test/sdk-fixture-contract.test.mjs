import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';
import { canonicalSha256, validateShape as publicShape } from '../validate.mjs';
import { validateShape, publicSchemaSha256, assertFixtureContext, fixtureReceiptIdentity,
  assertFixtureReceipt, assertFixtureRequest, assertFixtureResponse } from '../qualification-sdk/validate.mjs';

// Fixed synthetic DATA, never admitted identities or an allocated runtime clock.
const id = n => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const T = 1000000, NOW = T + 20000;
const profile = { channelVersion: 'sdk-fixture/1', profile: 'sdk-interruption-fixture-v1' };
const partial = { completeRecoveryCheckpoint: false, sessionStoreQualified: false };
const hash = raw => createHash('sha256').update(raw).digest('hex');
const copy = value => structuredClone(value);
const scope = () => ({ tenantId: 'synthetic', kind: 'tenant', resourceId: 'synthetic', policyRevision: 'd'.repeat(64) });
const object = (n, bytes = 9, sha256 = 'e'.repeat(64)) => ({ objectId: id(n), versionId: `immutable-${n}`, bytes, sha256, scopes: [scope()] });
function context(phase = 'interrupt') {
  const b = phase === 'resume';
  return { ...profile, runUuid: id(1), phase,
    namespace: { sessionId: id(2), cwd: '/workspace/conversation', projectKey: '-workspace-conversation' },
    identity: { mappingId: id(b ? 12 : 11), grantId: id(b ? 22 : 21), admittedAtMs: T + (b ? 15000 : 0), expiresAtMs: T + 720000,
      taskArn: `arn:aws:ecs:us-east-1:967807252336:task/qualification/${(b ? '2' : '1').repeat(32)}`,
      attempt: b ? 2 : 1, fence: b ? 2 : 1, policyRevision: 'd'.repeat(64),
      canonical: { tenantId: 'synthetic', actorId: 'actor', conversationId: id(3), runId: id(4),
        attemptId: id(b ? 32 : 31), workerId: id(b ? 42 : 41), writerFence: b ? 2 : 1 } },
    clock: { t0Ms: T, deadlineMs: T + 720000, cleanupDeadlineMs: T + 900000 },
    pins: { sourceCommit: 'a'.repeat(40), imageDigest: `sha256:${'b'.repeat(64)}`, sdkVersion: '0.3.295', cliVersion: '2.1.295',
      contractsVersion: '0.1.0', contractsSchemaSha256: publicSchemaSha256, skillsManifestSha256: 'c'.repeat(64) } };
}
function file(path, raw) { return { path, bytes: raw.length, sha256: hash(raw), base64: raw.toString('base64') }; }
function fixture() {
  const producer = context(), current = context('resume');
  const bundle = { format: 'meri-native-session-files-v1', sdk: '0.3.295', cli: '2.1.295', binding: copy(producer.namespace),
    directories: [id(2), `${id(2)}/subagents`], files: [file(`${id(2)}.jsonl`, Buffer.from('opaque compaction and unknown fields\n')),
      file(`${id(2)}/subagents/agent-a.jsonl`, Buffer.from('opaque child\n'))], totalBytes: 0 };
  bundle.totalBytes = bundle.files.reduce((n, f) => n + f.bytes, 0);
  const fixtureFile = file('qualification/continuity.txt', Buffer.from('SYNTHETIC-CONTINUITY\n'));
  const evidence = { init: object(61), interrupt: object(62), exit: object(63), drain: object(64) };
  const workspace = { contractVersion: '0.1.0', manifestId: id(51), binding: copy(producer.identity.canonical),
    logicalCwd: '/workspace/conversation', entries: [{ path: fixtureFile.path, kind: 'file', executable: false,
      object: object(52, fixtureFile.bytes, fixtureFile.sha256) }], scopes: [scope()], createdAt: new Date(T + 10000).toISOString() };
  const bundleRef = object(53, Buffer.byteLength(canonicalize(bundle)), canonicalSha256(bundle));
  const receipt = { ...profile, ...partial, receiptId: id(54), producer, coverage: { native: 'declared-transcript-tree', workspace: 'one-synthetic-sentinel' },
    bundle: bundleRef, nativeInventory: { format: bundle.format, directories: copy(bundle.directories),
      files: bundle.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })), totalBytes: bundle.totalBytes },
    workspace, workspaceSha256: canonicalSha256(workspace), evidence,
    commit: { commitId: id(55), publisherId: 'trusted-fixture-broker', committedAtMs: T + 11000,
      publication: 'CURRENT_FENCE_COMMITTED', publicationFence: 1, bundleReadback: copy(bundleRef), workspaceReadbackSha256: canonicalSha256(workspace) } };
  return { producer, current, receipt, bundle, fixtureFile, evidence, reference: fixtureReceiptIdentity(receipt) };
}
function request(f, operation) {
  return { ...profile, operation, requestId: id(70), context: copy(operation === 'commitFixtureCheckpoint' || operation === 'authorizeFixturePhase' ? f.producer : f.current),
    ...(operation === 'commitFixtureCheckpoint' ? { bundle: copy(f.bundle), fixtureFile: copy(f.fixtureFile), evidence: copy(f.evidence) } : {}),
    ...(['loadFixtureCheckpoint', 'verifyFixtureCheckpoint'].includes(operation) ? { reference: copy(f.reference) } : {}),
    ...(operation === 'verifyFixtureCheckpoint' ? { bundle: copy(f.bundle), fixtureFile: copy(f.fixtureFile) } : {}) };
}
function response(f, req) {
  return { ...profile, operation: req.operation, requestId: req.requestId, context: copy(req.context),
    ...(req.operation === 'authorizeFixturePhase' ? { status: 'AUTHORIZED', decisionId: id(71), checkedAtMs: NOW } :
      { ...partial, status: { commitFixtureCheckpoint: 'COMMITTED', loadFixtureCheckpoint: 'LOADED', verifyFixtureCheckpoint: 'VERIFIED' }[req.operation], receipt: copy(f.receipt) }),
    ...(req.operation === 'loadFixtureCheckpoint' ? { bundle: copy(f.bundle), fixtureFile: copy(f.fixtureFile) } : {}) };
}
const options = f => ({ producer: f.producer, nowMs: NOW });

test('four fixed operations round-trip while retaining original producer and partial flags', () => {
  const f = fixture(), original = canonicalSha256(f.receipt);
  for (const operation of ['authorizeFixturePhase', 'commitFixtureCheckpoint', 'loadFixtureCheckpoint', 'verifyFixtureCheckpoint']) {
    const req = request(f, operation), res = response(f, req);
    assert.equal(assertFixtureRequest(req, { nowMs: NOW }), req);
    assert.equal(assertFixtureResponse(req, res, options(f)), res.status);
    if (res.receipt) { assert.equal(res.receipt.producer.identity.attempt, 1); assert.equal(res.receipt.completeRecoveryCheckpoint, false); }
  }
  assert.equal(canonicalSha256(f.receipt), original);
});

test('fixture receipt is rejected by product Checkpoint and absent from public package exports', async () => {
  assert.throws(() => publicShape('Checkpoint', fixture().receipt));
  await assert.rejects(import('@capiro/meri-contracts/qualification-sdk'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
});

test('partial flags, closed profile and object-storage URLs cannot be upgraded or supplied', () => {
  for (const mutate of [r => r.completeRecoveryCheckpoint = true, r => r.sessionStoreQualified = true,
    r => r.profile = 'product', r => r.bundle.url = 'https://foreign.invalid/object', r => r.bundle.key = 'foreign']) {
    const f = fixture(); mutate(f.receipt); assert.throws(() => assertFixtureReceipt(f.receipt, { ...options(f), reference: f.reference }));
  }
});

test('reference binds every receipt field; rehashed foreign producer still refuses', () => {
  for (const mutate of [r => r.bundle.versionId = 'changed', r => r.commit.publisherId = 'foreign', r => r.evidence.drain.sha256 = 'd'.repeat(64)]) {
    const f = fixture(); mutate(f.receipt);
    assert.throws(() => assertFixtureReceipt(f.receipt, { ...options(f), reference: f.reference }), /RECEIPT_BINDING/);
  }
  const f = fixture(); f.receipt.producer = copy(f.producer); f.receipt.producer.identity.canonical.actorId = 'foreign';
  assert.throws(() => assertFixtureReceipt(f.receipt, { ...options(f), reference: fixtureReceiptIdentity(f.receipt) }), /RECEIPT_BINDING/);
});

test('original D720/C900 and current grant lifetime are exact and never reset', () => {
  for (const mutate of [c => c.clock.deadlineMs++, c => c.clock.cleanupDeadlineMs++, c => c.clock.t0Ms = NOW + 1,
    c => c.identity.expiresAtMs = NOW, c => c.identity.admittedAtMs = NOW + 1, c => c.clock.t0Ms = Number.MAX_SAFE_INTEGER,
    c => c.identity.fence = true, c => c.identity.canonical.writerFence = 2, c => c.identity.policyRevision = 'unqualified-label',
    c => c.identity.taskArn = c.identity.taskArn.replace('967807252336', '123456789012'),
    c => { c.identity.fence = 2147483648; c.identity.canonical.writerFence = 2147483648; }]) {
    const c = context(); mutate(c); assert.throws(() => assertFixtureContext(c, NOW));
  }
  assert.throws(() => assertFixtureContext(context(), T + 720000), /CLOCK/);
});

test('replacement must be fresh, different and fully mapped with higher fence', () => {
  const changes = [c => c.identity.taskArn = context().identity.taskArn, c => c.identity.mappingId = context().identity.mappingId,
    c => c.identity.grantId = context().identity.grantId, c => c.identity.canonical.workerId = context().identity.canonical.workerId,
    c => c.identity.canonical.attemptId = context().identity.canonical.attemptId,
    c => { c.identity.fence = 1; c.identity.canonical.writerFence = 1; }, c => c.identity.admittedAtMs = T + 11000,
    c => c.identity.policyRevision = 'foreign', c => c.identity.canonical.tenantId = 'foreign',
    c => c.pins.skillsManifestSha256 = 'f'.repeat(64), c => c.pins.imageDigest = `sha256:${'f'.repeat(64)}`,
    c => c.namespace.sessionId = id(100), c => c.clock.t0Ms++];
  for (const mutate of changes) {
    const f = fixture(), req = request(f, 'loadFixtureCheckpoint'); mutate(req.context);
    const res = response(f, req); assert.throws(() => assertFixtureResponse(req, res, options(f)));
  }
});

test('expired producer grant can remain provenance; replacement current grant cannot expire', () => {
  const f = fixture(); f.producer.identity.expiresAtMs = T + 12000; f.receipt.producer = copy(f.producer); f.reference = fixtureReceiptIdentity(f.receipt);
  const req = request(f, 'loadFixtureCheckpoint'); assert.equal(assertFixtureResponse(req, response(f, req), options(f)), 'LOADED');
  req.context.identity.expiresAtMs = NOW; assert.throws(() => assertFixtureResponse(req, response(f, req), options(f)), /EXPIRY/);
});

test('missing/foreign/duplicate native members and file-parent ambiguities refuse', () => {
  for (const mutate of [b => b.files.shift(), b => b.files[0].path = `${id(100)}.jsonl`, b => b.files.push(copy(b.files[0])),
    b => b.directories.pop(), b => b.files[1].path = `${id(2)}/../foreign`, b => b.files[1].path = `${id(2)}/CON`,
    b => b.files[1].path = `${id(2)}/e\u0301`, b => b.files[1].path = `${id(2)}/x\\y`, b => b.totalBytes++]) {
    const f = fixture(), req = request(f, 'commitFixtureCheckpoint'); mutate(req.bundle);
    assert.throws(() => assertFixtureRequest(req, { nowMs: NOW }));
  }
});

test('opaque bytes survive; changed bytes, hash, size and noncanonical base64 refuse', () => {
  const f = fixture(); assertFixtureRequest(request(f, 'commitFixtureCheckpoint'), { nowMs: NOW });
  for (const mutate of [r => r.bundle.files[0].base64 += '\n', r => r.bundle.files[0].sha256 = '0'.repeat(64),
    r => r.bundle.files[0].bytes++, r => r.fixtureFile.base64 = Buffer.from('foreign').toString('base64'),
    r => r.bundle.files[0].bytes = 8388609, r => r.bundle.files = Array(257).fill(r.bundle.files[0])]) {
    const req = request(f, 'commitFixtureCheckpoint'); mutate(req); assert.throws(() => assertFixtureRequest(req, { nowMs: NOW }));
  }
});

test('stored object version/hash/readback/inventory substitution refuses after transfer', () => {
  for (const mutate of [r => r.bundle.sha256 = 'a'.repeat(64), r => r.bundle.bytes++,
    r => r.nativeInventory.files[1].sha256 = 'b'.repeat(64), r => r.commit.bundleReadback.versionId = 'foreign']) {
    const f = fixture(), req = request(f, 'commitFixtureCheckpoint'), res = response(f, req); mutate(res.receipt);
    assert.throws(() => assertFixtureResponse(req, res, options(f)));
  }
  const f = fixture(), req = request(f, 'verifyFixtureCheckpoint'); req.bundle.files[0] = file(req.bundle.files[0].path, Buffer.from('altered'));
  req.bundle.totalBytes = req.bundle.files.reduce((n, row) => n + row.bytes, 0);
  assert.throws(() => assertFixtureResponse(req, response(f, req), options(f)), /STORED_BYTES/);
});

test('workspace is exactly one safe synthetic nonexecutable sentinel with producer binding', () => {
  for (const mutate of [r => r.workspace.entries.push(copy(r.workspace.entries[0])), r => r.workspace.entries[0].path = '../secret',
    r => r.workspace.entries[0].executable = true, r => r.workspace.binding.workerId = id(100),
    r => r.workspace.entries[0].object.bytes = 65537, r => r.workspace.createdAt = new Date(T - 1).toISOString()]) {
    const f = fixture(); mutate(f.receipt); f.receipt.workspaceSha256 = canonicalSha256(f.receipt.workspace);
    f.receipt.commit.workspaceReadbackSha256 = f.receipt.workspaceSha256;
    assert.throws(() => assertFixtureReceipt(f.receipt, { ...options(f), reference: fixtureReceiptIdentity(f.receipt) }));
  }
});

test('evidence and storage scopes require exact original tenant/policy and positive bounded bytes', () => {
  for (const mutate of [r => r.evidence.init.scopes[0].tenantId = 'foreign', r => r.bundle.scopes[0].policyRevision = 'foreign',
    r => r.evidence.exit.bytes = 0, r => r.evidence.drain.bytes = 48 * 1024 * 1024 + 1,
    r => r.evidence.interrupt.versionId = 'v'.repeat(257), r => r.commit.publicationFence = 2,
    r => r.commit.committedAtMs = NOW + 1, r => r.commit.publication = 'STAGED']) {
    const f = fixture(); mutate(f.receipt);
    assert.throws(() => assertFixtureReceipt(f.receipt, { ...options(f), reference: fixtureReceiptIdentity(f.receipt) }));
  }
});

test('only explicit validated stale denial is a denial witness; unknown/errors never return false', () => {
  const f = fixture(), req = request(f, 'authorizeFixturePhase');
  const res = { ...response(f, req), status: 'DENIED_STALE_BINDING', currentContext: copy(f.current) };
  assert.equal(assertFixtureResponse(req, res, options(f)), 'STALE_BINDING_DENIED');
  assert.notEqual(assertFixtureResponse(req, res, options(f)), false);
  for (const code of ['TIMEOUT', 'INDETERMINATE', 'UNAVAILABLE', 'REVOKED', 'INVALID_REQUEST']) {
    const err = { ...profile, operation: req.operation, requestId: req.requestId, context: copy(req.context), status: 'ERROR', code };
    assert.throws(() => assertFixtureResponse(req, err, options(f)), new RegExp(`CHANNEL_${code}`));
  }
  for (const status of ['UNKNOWN', false, 'DENIED', 'STALE']) {
    const err = { ...response(f, req), status }; assert.throws(() => assertFixtureResponse(req, err, options(f)));
  }
  res.currentContext = copy(f.producer); assert.throws(() => assertFixtureResponse(req, res, options(f)));
});

test('authorization decisions are correlated, time bounded and not accepted for another producer', () => {
  for (const mutate of [r => r.requestId = id(100), r => r.checkedAtMs = NOW + 1, r => r.checkedAtMs = NOW - 30001,
    r => r.context.identity.policyRevision = 'foreign', r => r.authorized = true]) {
    const f = fixture(), req = request(f, 'authorizeFixturePhase'), res = response(f, req); mutate(res);
    assert.throws(() => assertFixtureResponse(req, res, options(f)));
  }
  const f = fixture(), req = request(f, 'authorizeFixturePhase'); req.context.identity.canonical.actorId = 'foreign';
  assert.throws(() => assertFixtureResponse(req, response(f, req), options(f)), /STABLE/);
});

test('unknown operations, phase confusion and missing product-incomplete flags refuse', () => {
  for (const mutate of [r => r.operation = 'session.persist', r => r.context.phase = 'resume', r => r.storageUrl = 'https://foreign.invalid']) {
    const f = fixture(), req = request(f, 'commitFixtureCheckpoint'); mutate(req); assert.throws(() => assertFixtureRequest(req, { nowMs: NOW }));
  }
  const f = fixture(), req = request(f, 'loadFixtureCheckpoint'), res = response(f, req); delete res.sessionStoreQualified;
  assert.throws(() => assertFixtureResponse(req, res, options(f)));
});

test('nonfinite numbers, cycles, accessors and sparse arrays refuse without reading getters', () => {
  for (const value of [Infinity, NaN]) { const c = context(); c.clock.t0Ms = value; assert.throws(() => assertFixtureContext(c, NOW)); }
  const cycle = {}; cycle.self = cycle; assert.throws(() => validateShape('FixtureContext', cycle), /JSON_ONLY/);
  let called = 0; const c = context(); Object.defineProperty(c, 'phase', { enumerable: true, get() { called++; return 'interrupt'; } });
  assert.throws(() => assertFixtureContext(c, NOW), /JSON_ONLY/); assert.equal(called, 0);
  const f = fixture(), req = request(f, 'commitFixtureCheckpoint'); delete req.bundle.files[0];
  assert.throws(() => assertFixtureRequest(req, { nowMs: NOW }), /JSON_ONLY/);
});
