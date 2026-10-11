import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { canonicalSha256 } from '../../../../../packages/contracts/validate.mjs';
import { fixtureReceiptIdentity, publicSchemaSha256 } from '../../../../../packages/contracts/qualification-sdk/validate.mjs';
import { CommitUncertain, StateDenied } from '../errors.mjs';
import { FixtureRegistry } from '../registry.mjs';
import { PostgresStore } from '../store.mjs';

// These tests require a newly migrated, isolated qualification database. They
// deliberately do not create, reset, or delete database state.
const port = Number(process.env.MERI_FIXTURE_TEST_PORT);
const database = process.env.MERI_FIXTURE_TEST_DATABASE;
if (!Number.isInteger(port) || !database) throw new Error('ISOLATED_TEST_DATABASE_REQUIRED');
const config = { host: '127.0.0.1', port, database, user: process.env.MERI_FIXTURE_TEST_USER };
const store = new PostgresStore(config);
const registry = new FixtureRegistry(store);
const salt = randomBytes(5).readUIntBE(0, 5);
const id = n => `00000000-0000-4000-8000-${(salt + n).toString(16).padStart(12, '0')}`;
const hash = raw => createHash('sha256').update(raw).digest('hex');
const clone = value => structuredClone(value);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const peerA = Object.freeze({ peerId: 'synthetic-task-a', credentialId: 'synthetic-credential-a' });
const peerB = Object.freeze({ peerId: 'synthetic-task-b', credentialId: 'synthetic-credential-b' });
const scope = () => ({ tenantId: 'synthetic', kind: 'tenant', resourceId: 'synthetic', policyRevision: 'd'.repeat(64) });
const object = (n, bytes = 9, sha256 = 'e'.repeat(64)) =>
  ({ objectId: id(n), versionId: `immutable-${n}`, bytes, sha256, scopes: [scope()] });
const file = (path, raw) => ({ path, bytes: raw.length, sha256: hash(raw), base64: raw.toString('base64') });

function fixture(seed, { expiresAtMs = null } = {}) {
  const t0 = Date.now() - 5000;
  const profile = { channelVersion: 'sdk-fixture/1', profile: 'sdk-interruption-fixture-v1' };
  const runUuid = id(seed), sessionId = id(seed + 1);
  function context(phase) {
    const b = phase === 'resume';
    return { ...profile, runUuid, phase,
      namespace: { sessionId, cwd: '/workspace/conversation', projectKey: '-workspace-conversation' },
      identity: { mappingId: id(seed + (b ? 12 : 11)), grantId: id(seed + (b ? 22 : 21)),
        admittedAtMs: t0 + (b ? 3000 : 0), expiresAtMs: expiresAtMs ?? t0 + 720000,
        taskArn: `arn:aws:ecs:us-east-1:967807252336:task/qualification/${(b ? '2' : '1').repeat(32)}`,
        attempt: b ? 2 : 1, fence: b ? 2 : 1, policyRevision: 'd'.repeat(64),
        canonical: { tenantId: 'synthetic', actorId: 'actor', conversationId: id(seed + 2),
          runId: id(seed + 3), attemptId: id(seed + (b ? 32 : 31)),
          workerId: id(seed + (b ? 42 : 41)), writerFence: b ? 2 : 1 } },
      clock: { t0Ms: t0, deadlineMs: t0 + 720000, cleanupDeadlineMs: t0 + 900000 },
      pins: { sourceCommit: 'a'.repeat(40), imageDigest: `sha256:${'b'.repeat(64)}`,
        sdkVersion: '0.3.295', cliVersion: '2.1.295', contractsVersion: '0.1.0',
        contractsSchemaSha256: publicSchemaSha256, skillsManifestSha256: 'c'.repeat(64) } };
  }
  const producer = context('interrupt'), current = context('resume');
  const bundle = { format: 'meri-native-session-files-v1', sdk: '0.3.295', cli: '2.1.295',
    binding: clone(producer.namespace), directories: [sessionId, `${sessionId}/subagents`],
    files: [file(`${sessionId}.jsonl`, Buffer.from('opaque compaction and unknown fields\n')),
      file(`${sessionId}/subagents/agent-a.jsonl`, Buffer.from('opaque child\n'))], totalBytes: 0 };
  bundle.totalBytes = bundle.files.reduce((n, f) => n + f.bytes, 0);
  const fixtureFile = file('qualification/continuity.txt', Buffer.from('SYNTHETIC-CONTINUITY\n'));
  const evidence = { init: object(seed + 61), interrupt: object(seed + 62),
    exit: object(seed + 63), drain: object(seed + 64) };
  const workspace = { contractVersion: '0.1.0', manifestId: id(seed + 51),
    binding: clone(producer.identity.canonical), logicalCwd: '/workspace/conversation',
    entries: [{ path: fixtureFile.path, kind: 'file', executable: false,
      object: object(seed + 52, fixtureFile.bytes, fixtureFile.sha256) }],
    scopes: [scope()], createdAt: new Date(t0 + 1000).toISOString() };
  const bundleRef = object(seed + 53);
  const receipt = { ...profile, completeRecoveryCheckpoint: false, sessionStoreQualified: false,
    receiptId: id(seed + 54), producer,
    coverage: { native: 'declared-transcript-tree', workspace: 'one-synthetic-sentinel' },
    bundle: bundleRef,
    nativeInventory: { format: bundle.format, directories: clone(bundle.directories),
      files: bundle.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
      totalBytes: bundle.totalBytes },
    workspace, workspaceSha256: canonicalSha256(workspace), evidence,
    commit: { commitId: id(seed + 55), publisherId: 'trusted-fixture-broker',
      committedAtMs: t0 + 2000, publication: 'CURRENT_FENCE_COMMITTED', publicationFence: 1,
      bundleReadback: clone(bundleRef), workspaceReadbackSha256: canonicalSha256(workspace) } };
  const reference = fixtureReceiptIdentity(receipt);
  const readback = { verified: true, verifierId: 'trusted-object-store-reread',
    bundleReadback: clone(bundleRef), workspaceReadbackSha256: receipt.workspaceSha256 };
  const presented = context => ({ runUuid: context.runUuid, sessionId: context.namespace.sessionId,
    attempt: context.identity.attempt, fence: context.identity.fence,
    policyRevision: context.identity.policyRevision, grantId: context.identity.grantId,
    mappingId: context.identity.mappingId, taskArn: context.identity.taskArn,
    attemptId: context.identity.canonical.attemptId, workerId: context.identity.canonical.workerId });
  return { producer, current, receipt, reference, readback, presented };
}

const denied = code => error => error instanceof StateDenied && error.code === code;

test('committed A remains immutable; B gets a fresh grant and exact original receipt', async () => {
  const f = fixture(100);
  assert.equal((await registry.admitRun({ context: f.producer, peer: peerA })).outcome, 'ADMITTED');
  assert.equal((await registry.authorize({ presented: f.presented(f.producer), peer: peerA })).decision, 'AUTHORIZED');
  assert.equal((await registry.publishCommit({ context: f.producer, peer: peerA,
    receipt: f.receipt, readback: f.readback })).outcome, 'COMMITTED');
  assert.equal((await registry.publishCommit({ context: f.producer, peer: peerA,
    receipt: f.receipt, readback: f.readback })).outcome, 'ALREADY_COMMITTED');
  assert.equal((await registry.readPublication({ runUuid: f.producer.runUuid })).identity.receiptSha256,
    f.reference.receiptSha256);
  assert.equal((await registry.replaceRun({ context: f.current, peer: peerB })).outcome, 'REPLACED');
  const stale = await registry.authorize({ presented: f.presented(f.producer), peer: peerA });
  assert.equal(stale.decision, 'DENIED_STALE_BINDING');
  assert.equal(stale.current.grantId, f.current.identity.grantId);
  await assert.rejects(registry.authorize({ presented: f.presented(f.producer), peer: peerB }),
    denied('FIXTURE_AUTHORIZATION_DENIED'));
  assert.equal((await registry.authorize({ presented: f.presented(f.current), peer: peerB })).decision,
    'AUTHORIZED');
  await assert.rejects(registry.publishCommit({ context: f.producer, peer: peerA,
    receipt: f.receipt, readback: f.readback }), denied('FIXTURE_STALE_PUBLICATION'));
  assert.equal((await registry.loadCheckpoint({ context: f.current, peer: peerB,
    reference: f.reference })).bundleVersionId, f.receipt.bundle.versionId);
  await assert.rejects(registry.loadCheckpoint({ context: f.current, peer: peerB,
    reference: { ...f.reference, receiptSha256: 'f'.repeat(64) } }),
  denied('FIXTURE_RECEIPT_REFERENCE_MISMATCH'));
  assert.equal((await registry.verifyCheckpoint({ context: f.current, peer: peerB,
    reference: f.reference, bundleSha256: f.receipt.bundle.sha256,
    workspaceSha256: f.receipt.workspaceSha256 })).outcome, 'VERIFIED');
  await assert.rejects(registry.verifyCheckpoint({ context: f.current, peer: peerB,
    reference: f.reference, bundleSha256: 'f'.repeat(64),
    workspaceSha256: f.receipt.workspaceSha256 }), denied('FIXTURE_RESTORED_DIGEST_MISMATCH'));
});

test('bad readback, policy and original clock continuity refuse without publication', async () => {
  const f = fixture(200);
  await registry.admitRun({ context: f.producer, peer: peerA });
  await assert.rejects(registry.publishCommit({ context: f.producer, peer: peerB,
    receipt: f.receipt, readback: f.readback }), denied('FIXTURE_PEER_BINDING'));
  await assert.rejects(registry.publishCommit({ context: f.producer, peer: peerA,
    receipt: f.receipt, readback: { ...f.readback,
      bundleReadback: { ...f.readback.bundleReadback, objectId: id(999) } } }),
  denied('FIXTURE_READBACK_MISMATCH'));
  await assert.rejects(registry.publishCommit({ context: f.producer, peer: peerA,
    receipt: f.receipt, readback: { ...f.readback, workspaceReadbackSha256: 'f'.repeat(64) } }),
  denied('FIXTURE_READBACK_MISMATCH'));
  assert.equal((await registry.readPublication({ runUuid: f.producer.runUuid })).outcome, 'NOT_COMMITTED');
  await assert.rejects(registry.authorize({ presented: { ...f.presented(f.producer),
    policyRevision: 'f'.repeat(64) }, peer: peerA }), denied('FIXTURE_POLICY_MISMATCH'));
  await registry.publishCommit({ context: f.producer, peer: peerA,
    receipt: f.receipt, readback: f.readback });
  const reset = clone(f.current);
  reset.clock.t0Ms += 1;
  reset.clock.deadlineMs += 1;
  reset.clock.cleanupDeadlineMs += 1;
  await assert.rejects(registry.replaceRun({ context: reset, peer: peerB }),
    denied('FIXTURE_REPLACEMENT_CLOCK'));
  assert.equal((await registry.authorize({ presented: f.presented(f.producer), peer: peerA })).decision,
    'AUTHORIZED');
});

test('lost COMMIT acknowledgement reconciles to one original receipt', async () => {
  const f = fixture(300);
  await registry.admitRun({ context: f.producer, peer: peerA });
  const ambiguous = new FixtureRegistry(new PostgresStore(config, {
    afterCommit: () => { throw new Error('synthetic lost acknowledgement'); },
  }));
  await assert.rejects(ambiguous.publishCommit({ context: f.producer, peer: peerA,
    receipt: f.receipt, readback: f.readback }), error => error instanceof CommitUncertain);
  const record = await registry.readPublication({ runUuid: f.producer.runUuid });
  assert.equal(record.outcome, 'COMMITTED');
  assert.deepEqual(record.identity, f.reference);
});

test('database time after run lock wait refuses an expired grant', async () => {
  const f = fixture(400, { expiresAtMs: Date.now() + 600 });
  await registry.admitRun({ context: f.producer, peer: peerA });
  const blocker = new Client(config);
  await blocker.connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT run_uuid FROM meri_qualification_sdk_fixture.runs WHERE run_uuid = $1 FOR UPDATE',
      [f.producer.runUuid]);
    const waiting = registry.authorize({ presented: f.presented(f.producer), peer: peerA });
    await sleep(800);
    await blocker.query('COMMIT');
    await assert.rejects(waiting, denied('FIXTURE_GRANT_EXPIRED'));
  } finally {
    await blocker.query('ROLLBACK').catch(() => {});
    await blocker.end();
  }
});

test('database guards prevent commit, grant and stable run rebinding', async () => {
  const f = fixture(500);
  await registry.admitRun({ context: f.producer, peer: peerA });
  await registry.publishCommit({ context: f.producer, peer: peerA,
    receipt: f.receipt, readback: f.readback });
  const client = new Client(config);
  await client.connect();
  try {
    await assert.rejects(client.query(
      'UPDATE meri_qualification_sdk_fixture.commits SET receipt_sha256 = $2 WHERE run_uuid = $1',
      [f.producer.runUuid, 'f'.repeat(64)]), error => error.code === 'P0001');
    await assert.rejects(client.query(
      'UPDATE meri_qualification_sdk_fixture.grants SET peer_id = $2 WHERE grant_id = $1',
      [f.producer.identity.grantId, 'wrong-peer']), error => error.code === 'P0001');
    await assert.rejects(client.query(
      'DELETE FROM meri_qualification_sdk_fixture.grants WHERE grant_id = $1',
      [f.producer.identity.grantId]), error => error.code === 'P0001');
    await assert.rejects(client.query(
      'UPDATE meri_qualification_sdk_fixture.runs SET policy_revision = $2 WHERE run_uuid = $1',
      [f.producer.runUuid, 'f'.repeat(64)]), error => error.code === 'P0001');
  } finally {
    await client.end();
  }
});
