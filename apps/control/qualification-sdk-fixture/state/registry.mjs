// Trusted control-layer registry for the partial sdk-interruption-fixture-v1
// experiment.
//
// Owns exactly: durable current run/grant/fence/policy state for one run, the
// atomic publication of a previously verified immutable receipt identity, and the
// load/verify binding of that committed original receipt to the current
// replacement grant. It does not own TLS transport, HTTP ingress, object storage
// or readback, native process evidence, SDK orchestration, SessionStore or the
// product Checkpoint, and it never accepts a worker-selected object key, storage
// URL or storage privilege.
//
// Every operation is one PostgreSQL transaction. The run and grant rows are locked,
// then database time is read, so expiry and
// currentness are decided after the lock wait rather than in a pre-lock snapshot.
import { randomUUID } from 'node:crypto';
import {
  assertAdmissionContext, assertCommitBinding, assertCommittedReference, assertLoadInput,
  assertPresentedBinding, assertPublicationInput, assertReplacement, assertRestoredDigests,
  assertTrustedPeer, decideAuthorization, trustedBindingFromContext, trustedBindingFromRow,
} from './binding.mjs';
import { fail } from './errors.mjs';
import { publicationRow, sameIdentity } from './receipt.mjs';

const RUN_COLUMNS = ['run_uuid', 'session_id', 't0_ms', 'deadline_ms', 'cleanup_deadline_ms',
  'canonical_tenant_id', 'canonical_actor_id', 'canonical_conversation_id', 'canonical_run_id',
  'source_commit', 'image_digest', 'sdk_version', 'cli_version', 'contracts_version',
  'contracts_schema_sha256', 'skills_manifest_sha256', 'policy_revision', 'current_attempt',
  'current_fence', 'current_grant_id', 'current_mapping_id', 'current_task_arn', 'current_attempt_id',
  'current_worker_id', 'current_peer_id', 'current_credential_id', 'current_admitted_at_ms',
  'current_expires_at_ms'].join(', ');
const COMMIT_IDENTITY_COLUMNS = 'commit_id, receipt_id, receipt_sha256, committed_at_ms, ' +
  'bundle_object_id, bundle_version_id, bundle_sha256, bundle_bytes, workspace_sha256, ' +
  'workspace_readback_sha256, verifier_id';
const INTEGER = /^-?\d+$/;

function integer(value) {
  const parsed = typeof value === 'string' && INTEGER.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(parsed)) fail('FIXTURE_ROW_INTEGER');
  return parsed;
}

async function databaseNow(client) {
  const result = await client.query('SELECT clock_timestamp() AS now');
  const now = result.rows[0]?.now;
  if (!(now instanceof Date)) fail('DATABASE_TIME_UNAVAILABLE');
  return now.getTime();
}

async function lockRun(client, runUuid) {
  const result = await client.query(
    `SELECT ${RUN_COLUMNS} FROM meri_qualification_sdk_fixture.runs WHERE run_uuid = $1 FOR UPDATE`,
    [runUuid]);
  return result.rows[0] ?? null;
}

async function lockGrant(client, grantId) {
  const result = await client.query(
    'SELECT grant_id, run_uuid, session_id, attempt, fence, phase, mapping_id, task_arn, ' +
    'attempt_id, worker_id, peer_id, credential_id, policy_revision, state, expires_at_ms ' +
    'FROM meri_qualification_sdk_fixture.grants ' +
    'WHERE grant_id = $1 FOR UPDATE', [grantId]);
  return result.rows[0] ?? null;
}

const grantView = row => Object.freeze({ grantId: row.grant_id, state: row.state,
  expiresAtMs: integer(row.expires_at_ms) });

const receiptIdentityOf = row => ({ receiptId: row.receipt_id, receiptSha256: row.receipt_sha256 });

export class FixtureRegistry {
  #store;

  constructor(store) {
    if (store === null || typeof store !== 'object' || typeof store.transact !== 'function') {
      fail('FIXTURE_STORE_REQUIRED');
    }
    this.#store = store;
  }

  /** Initial trusted admission: attempt 1, the original interrupt phase. */
  async admitRun({ context, peer }) {
    return this.#store.transact(async client => {
      const binding = trustedBindingFromContext(context, peer);
      if (await lockRun(client, binding.runUuid) !== null) fail('FIXTURE_RUN_ALREADY_ADMITTED');
      const nowMs = await databaseNow(client);
      assertAdmissionContext(context, nowMs, { phase: 'interrupt' });
      await client.query(
        `INSERT INTO meri_qualification_sdk_fixture.runs (run_uuid, session_id, t0_ms, deadline_ms, ` +
        'cleanup_deadline_ms, canonical_tenant_id, canonical_actor_id, canonical_conversation_id, ' +
        'canonical_run_id, source_commit, image_digest, sdk_version, cli_version, contracts_version, ' +
        'contracts_schema_sha256, skills_manifest_sha256, policy_revision, current_attempt, ' +
        'current_fence, current_grant_id, current_mapping_id, current_task_arn, current_attempt_id, ' +
        'current_worker_id, current_peer_id, current_credential_id, current_admitted_at_ms, ' +
        'current_expires_at_ms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,' +
        '$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)',
        [binding.runUuid, binding.sessionId, binding.t0Ms, binding.deadlineMs, binding.cleanupDeadlineMs,
          binding.tenantId, binding.actorId, binding.conversationId, binding.runId,
          binding.pins.sourceCommit, binding.pins.imageDigest, binding.pins.sdkVersion,
          binding.pins.cliVersion, binding.pins.contractsVersion, binding.pins.contractsSchemaSha256,
          binding.pins.skillsManifestSha256, binding.policyRevision, binding.attempt, binding.fence,
          binding.grantId, binding.mappingId, binding.taskArn, binding.attemptId, binding.workerId,
          binding.peerId, binding.credentialId, binding.admittedAtMs, binding.expiresAtMs]);
      await this.#insertGrant(client, binding, 'ACTIVE');
      return Object.freeze({ outcome: 'ADMITTED', binding });
    });
  }

  /**
   * Replacement admission. Advances attempt and fence, requires a distinct
   * task/grant/mapping/worker, keeps the original T0/D/C and revokes the original
   * grant in the same transaction. After this commits, a late original commit can
   * no longer bind the current run row.
   */
  async replaceRun({ context, peer }) {
    return this.#store.transact(async client => {
      const next = trustedBindingFromContext(context, peer);
      const row = await lockRun(client, next.runUuid);
      if (row === null) fail('FIXTURE_REPLACEMENT_UNKNOWN_RUN');
      const previous = trustedBindingFromRow(row);
      const original = await lockGrant(client, previous.grantId);
      if (original === null || original.state !== 'ACTIVE') fail('FIXTURE_REPLACEMENT_GRANT_STATE');
      const nowMs = await databaseNow(client);
      assertAdmissionContext(context, nowMs, { phase: 'resume' });
      const committed = await client.query(
        'SELECT committed_at_ms FROM meri_qualification_sdk_fixture.commits WHERE run_uuid = $1',
        [next.runUuid]);
      if (committed.rowCount !== 1) fail('FIXTURE_REPLACEMENT_WITHOUT_COMMIT');
      assertReplacement(previous, next, { committedAtMs: integer(committed.rows[0].committed_at_ms), nowMs });
      const revoked = await client.query(
        "UPDATE meri_qualification_sdk_fixture.grants SET state = 'REVOKED', revoked_at = " +
        "clock_timestamp() WHERE grant_id = $1 AND state = 'ACTIVE'", [previous.grantId]);
      if (revoked.rowCount !== 1) fail('FIXTURE_REPLACEMENT_GRANT_STATE');
      await this.#insertGrant(client, next, 'ACTIVE');
      await client.query(
        'UPDATE meri_qualification_sdk_fixture.runs SET current_attempt = $2, current_fence = $3, ' +
        'current_grant_id = $4, current_mapping_id = $5, current_task_arn = $6, current_attempt_id = $7, ' +
        'current_worker_id = $8, current_peer_id = $9, current_credential_id = $10, ' +
        'current_admitted_at_ms = $11, current_expires_at_ms = $12, updated_at = clock_timestamp() ' +
        'WHERE run_uuid = $1',
        [next.runUuid, next.attempt, next.fence, next.grantId, next.mappingId, next.taskArn,
          next.attemptId, next.workerId, next.peerId, next.credentialId, next.admittedAtMs,
          next.expiresAtMs]);
      return Object.freeze({ outcome: 'REPLACED', binding: next });
    });
  }

  /**
   * Authorization decision under the current row lock. The only non-throwing
   * outcomes are AUTHORIZED and an explicit stale denial naming the distinct fresh
   * current replacement; every other case refuses.
   */
  async authorize({ presented, peer }) {
    return this.#store.transact(async client => {
      assertTrustedPeer(peer);
      assertPresentedBinding(presented);
      const row = await lockRun(client, presented.runUuid);
      if (row === null) fail('FIXTURE_AUTHORIZATION_UNKNOWN_RUN');
      const current = trustedBindingFromRow(row);
      const grant = await lockGrant(client, current.grantId);
      if (grant === null) fail('FIXTURE_GRANT_REVOKED');
      const staleGrant = presented.grantId === current.grantId ? null :
        await lockGrant(client, presented.grantId);
      const nowMs = await databaseNow(client);
      const decision = decideAuthorization({ current, grant: grantView(grant), staleGrant,
        peer, presented, nowMs });
      return Object.freeze({ ...decision, checkedAtMs: nowMs });
    });
  }

  /**
   * Publishes one immutable commit row for a previously verified receipt. The
   * caller must supply an independently verified readback of the exact immutable
   * bundle and workspace versions; this registry never selects, reads or grants
   * access to a storage location.
   */
  async publishCommit({ context, peer, receipt, readback }) {
    return this.#store.transact(async client => {
      assertTrustedPeer(peer);
      const row = await lockRun(client, context.runUuid);
      if (row === null) fail('FIXTURE_PUBLICATION_UNKNOWN_RUN');
      const current = trustedBindingFromRow(row);
      const grant = await lockGrant(client, current.grantId);
      if (grant === null) fail('FIXTURE_GRANT_REVOKED');
      const nowMs = await databaseNow(client);
      const { identity, readback: verified } = assertPublicationInput({ context, peer, receipt, readback, nowMs });
      assertCommitBinding({ current, grant: grantView(grant), peer, receipt, nowMs });
      const existing = await client.query(
        `SELECT ${COMMIT_IDENTITY_COLUMNS} FROM meri_qualification_sdk_fixture.commits WHERE run_uuid = $1`,
        [context.runUuid]);
      if (existing.rowCount > 0) {
        return this.#duplicatePublication(existing.rows[0], identity);
      }
      const values = publicationRow({ commitId: randomUUID(), identity, receipt, readback: verified,
        binding: current, recordedAt: new Date(nowMs) });
      const columns = Object.keys(values);
      const inserted = await client.query(
        `INSERT INTO meri_qualification_sdk_fixture.commits (${columns.join(', ')}) VALUES (` +
        `${columns.map((_, index) => `$${index + 1}`).join(',')}) ON CONFLICT (receipt_id) DO NOTHING ` +
        'RETURNING commit_id', columns.map(column => values[column]));
      if (inserted.rowCount !== 1) {
        const reread = await client.query(
          `SELECT ${COMMIT_IDENTITY_COLUMNS} FROM meri_qualification_sdk_fixture.commits WHERE run_uuid = $1`,
          [context.runUuid]);
        if (reread.rowCount !== 1) fail('FIXTURE_RUN_ALREADY_PUBLISHED');
        return this.#duplicatePublication(reread.rows[0], identity);
      }
      return Object.freeze({ outcome: 'COMMITTED', identity, commitId: values.commit_id,
        committedAtMs: integer(receipt.commit.committedAtMs) });
    });
  }

  /**
   * Reconciliation read after a lost commit acknowledgement. It reports what the
   * database actually holds and never accepts a second commit: an identical
   * existing row is an already-committed receipt, a different row refuses.
   */
  async readPublication({ runUuid }) {
    return this.#store.transact(async client => {
      const result = await client.query(
        `SELECT ${COMMIT_IDENTITY_COLUMNS} FROM meri_qualification_sdk_fixture.commits WHERE run_uuid = $1`,
        [runUuid]);
      if (result.rowCount === 0) return Object.freeze({ outcome: 'NOT_COMMITTED' });
      if (result.rowCount !== 1) fail('FIXTURE_COMMIT_CARDINALITY');
      const row = result.rows[0];
      return Object.freeze({ outcome: 'COMMITTED', identity: Object.freeze(receiptIdentityOf(row)),
        commitId: row.commit_id, committedAtMs: integer(row.committed_at_ms),
        bundleSha256: row.bundle_sha256, workspaceSha256: row.workspace_sha256,
        verifierId: row.verifier_id });
    });
  }

  /**
   * Load binding for the current replacement. The registry returns only the
   * committed original receipt identity and immutable version references; the
   * exact bytes come from the trusted object store under its own authorization.
   */
  async loadCheckpoint({ context, peer, reference }) {
    const committed = await this.#authorizedCommit({ context, peer, reference });
    return Object.freeze({ outcome: 'LOADED', receiptId: committed.receipt_id,
      receiptSha256: committed.receipt_sha256, bundleObjectId: committed.bundle_object_id,
      bundleVersionId: committed.bundle_version_id, bundleSha256: committed.bundle_sha256,
      bundleBytes: integer(committed.bundle_bytes), workspaceSha256: committed.workspace_sha256,
      committedAtMs: integer(committed.committed_at_ms), verifierId: committed.verifier_id });
  }

  /** Verify binding: restored bytes must match the committed digests exactly. */
  async verifyCheckpoint({ context, peer, reference, bundleSha256, workspaceSha256 }) {
    const committed = await this.#authorizedCommit({ context, peer, reference });
    assertRestoredDigests(committed, { bundleSha256, workspaceSha256 });
    return Object.freeze({ outcome: 'VERIFIED', receiptId: committed.receipt_id,
      receiptSha256: committed.receipt_sha256 });
  }

  async #authorizedCommit({ context, peer, reference }) {
    return this.#store.transact(async client => {
      const presented = trustedBindingFromContext(context, peer);
      const row = await lockRun(client, presented.runUuid);
      if (row === null) fail('FIXTURE_LOAD_UNKNOWN_RUN');
      const current = trustedBindingFromRow(row);
      const grant = await lockGrant(client, current.grantId);
      if (grant === null) fail('FIXTURE_GRANT_REVOKED');
      const nowMs = await databaseNow(client);
      assertLoadInput({ context, peer, reference, nowMs });
      const decision = decideAuthorization({ current, grant: grantView(grant), peer, presented, nowMs });
      if (decision.decision !== 'AUTHORIZED') fail('FIXTURE_LOAD_DENIED');
      const result = await client.query(
        `SELECT ${COMMIT_IDENTITY_COLUMNS} FROM meri_qualification_sdk_fixture.commits WHERE run_uuid = $1`,
        [presented.runUuid]);
      if (result.rowCount !== 1) fail('FIXTURE_RECEIPT_UNKNOWN');
      return assertCommittedReference(result.rows[0], reference);
    });
  }

  #duplicatePublication(row, identity) {
    if (!sameIdentity(receiptIdentityOf(row), identity)) fail('FIXTURE_RUN_ALREADY_PUBLISHED');
    return Object.freeze({ outcome: 'ALREADY_COMMITTED', identity: Object.freeze(receiptIdentityOf(row)),
      commitId: row.commit_id, committedAtMs: integer(row.committed_at_ms) });
  }

  #insertGrant(client, binding, state) {
    return client.query(
      'INSERT INTO meri_qualification_sdk_fixture.grants (grant_id, run_uuid, session_id, attempt, ' +
      'fence, phase, mapping_id, task_arn, attempt_id, worker_id, peer_id, credential_id, ' +
      'policy_revision, admitted_at_ms, expires_at_ms, state) VALUES ' +
      '($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',
      [binding.grantId, binding.runUuid, binding.sessionId, binding.attempt, binding.fence,
        binding.phase, binding.mappingId, binding.taskArn,
        binding.attemptId, binding.workerId, binding.peerId, binding.credentialId,
        binding.policyRevision, binding.admittedAtMs, binding.expiresAtMs, state]);
  }
}
