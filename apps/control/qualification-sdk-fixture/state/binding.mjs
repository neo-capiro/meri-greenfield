// Trusted admission, authorization and publication predicates.
//
// Pure decisions: no driver, no I/O, no clock of its own. Every argument is trusted
// control-plane output (canonical context after real peer/actor resolution, an
// independently verified readback) or a row read under the current row lock. No
// worker request field is ever an authority input, and the canonical private
// validator used here supplies shape/integrity only - never authentication.
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { assertFixtureContext, assertFixtureReceipt, validateShape as validateFixtureShape }
  from '../../../../packages/contracts/qualification-sdk/validate.mjs';
import { fail } from './errors.mjs';
import { assertReceiptReference, assertVerifiedReadback, publicationIdentity } from './receipt.mjs';

export const ORIGINAL_DEADLINE_OFFSET_MS = 720000;
export const CLEANUP_DEADLINE_OFFSET_MS = 900000;
export const MAX_FENCE = 2147483647;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const TASK_ARN = /^arn:aws:ecs:us-east-1:967807252336:task\/[A-Za-z0-9_-]{1,255}\/[0-9a-f]{32}$/;
const PEER_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/;
const CREDENTIAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/;
const IDENTITY_KEYS = Object.freeze(['peerId', 'credentialId']);
const AUTHORIZATION_KEYS = Object.freeze(['runUuid', 'sessionId', 'attempt', 'fence', 'policyRevision',
  'grantId', 'mappingId', 'taskArn', 'attemptId', 'workerId']);
const STABLE_KEYS = Object.freeze(['runUuid', 'sessionId', 'tenantId', 'actorId', 'conversationId',
  'runId', 'policyRevision']);
const DISTINCT_KEYS = Object.freeze(['grantId', 'mappingId', 'taskArn', 'attemptId', 'workerId']);
const INTEGER = /^-?\d+$/;
const same = (left, right) => canonicalSha256(left) === canonicalSha256(right);

// bigint columns arrive as decimal strings from the driver; coerce explicitly
// instead of trusting a driver-level parser or a global type override.
function ms(value) {
  const parsed = typeof value === 'string' && INTEGER.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(parsed)) fail('FIXTURE_BINDING_ROW_REQUIRED');
  return parsed;
}

/** Peer identity resolved by the ingress from an authenticated credential. */
export function assertTrustedPeer(peer) {
  if (peer === null || typeof peer !== 'object' || Array.isArray(peer) ||
      Object.getPrototypeOf(peer) !== Object.prototype ||
      Reflect.ownKeys(peer).length !== IDENTITY_KEYS.length ||
      !IDENTITY_KEYS.every(key => Object.hasOwn(peer, key)) ||
      typeof peer.peerId !== 'string' || !PEER_ID.test(peer.peerId) ||
      typeof peer.credentialId !== 'string' || !CREDENTIAL_ID.test(peer.credentialId)) {
    fail('FIXTURE_TRUSTED_PEER_REQUIRED');
  }
  return Object.freeze({ peerId: peer.peerId, credentialId: peer.credentialId });
}

function pinsFromContext(context) {
  return Object.freeze({ sourceCommit: context.pins.sourceCommit, imageDigest: context.pins.imageDigest,
    sdkVersion: context.pins.sdkVersion, cliVersion: context.pins.cliVersion,
    contractsVersion: context.pins.contractsVersion,
    contractsSchemaSha256: context.pins.contractsSchemaSha256,
    skillsManifestSha256: context.pins.skillsManifestSha256 });
}

/** Canonical trusted binding derived from a control-plane admitted context. */
export function trustedBindingFromContext(context, peer) {
  const trusted = assertTrustedPeer(peer), identity = context.identity, canonical = identity.canonical;
  return Object.freeze({ runUuid: context.runUuid, sessionId: context.namespace.sessionId,
    phase: context.phase,
    tenantId: canonical.tenantId, actorId: canonical.actorId, conversationId: canonical.conversationId,
    runId: canonical.runId, attempt: identity.attempt, fence: identity.fence,
    policyRevision: identity.policyRevision, grantId: identity.grantId, mappingId: identity.mappingId,
    taskArn: identity.taskArn, attemptId: canonical.attemptId, workerId: canonical.workerId,
    peerId: trusted.peerId, credentialId: trusted.credentialId, t0Ms: context.clock.t0Ms,
    deadlineMs: context.clock.deadlineMs, cleanupDeadlineMs: context.clock.cleanupDeadlineMs,
    admittedAtMs: identity.admittedAtMs, expiresAtMs: identity.expiresAtMs,
    pins: pinsFromContext(context) });
}

/** Canonical trusted binding derived from the authoritative run row. */
export function trustedBindingFromRow(row) {
  if (row === null || typeof row !== 'object') fail('FIXTURE_BINDING_ROW_REQUIRED');
  return Object.freeze({ runUuid: row.run_uuid, sessionId: row.session_id,
    tenantId: row.canonical_tenant_id, actorId: row.canonical_actor_id,
    conversationId: row.canonical_conversation_id, runId: row.canonical_run_id,
    attempt: row.current_attempt, fence: row.current_fence, policyRevision: row.policy_revision,
    grantId: row.current_grant_id, mappingId: row.current_mapping_id, taskArn: row.current_task_arn,
    attemptId: row.current_attempt_id, workerId: row.current_worker_id,
    peerId: row.current_peer_id, credentialId: row.current_credential_id, t0Ms: ms(row.t0_ms),
    deadlineMs: ms(row.deadline_ms), cleanupDeadlineMs: ms(row.cleanup_deadline_ms),
    admittedAtMs: ms(row.current_admitted_at_ms), expiresAtMs: ms(row.current_expires_at_ms),
    pins: Object.freeze({ sourceCommit: row.source_commit, imageDigest: row.image_digest,
      sdkVersion: row.sdk_version, cliVersion: row.cli_version,
      contractsVersion: row.contracts_version,
      contractsSchemaSha256: row.contracts_schema_sha256,
      skillsManifestSha256: row.skills_manifest_sha256 }) });
}

/**
 * A worker-visible phase request is validated here for shape and for the fact that
 * it is internally consistent; it is never an admission authority.
 */
export function assertPresentedBinding(presented) {
  if (presented === null || typeof presented !== 'object' || Array.isArray(presented) ||
      Object.getPrototypeOf(presented) !== Object.prototype ||
      !AUTHORIZATION_KEYS.every(key => Object.hasOwn(presented, key)) ||
      typeof presented.runUuid !== 'string' || !UUID.test(presented.runUuid) ||
      typeof presented.sessionId !== 'string' || !UUID.test(presented.sessionId) ||
      typeof presented.grantId !== 'string' || !UUID.test(presented.grantId) ||
      typeof presented.mappingId !== 'string' || !UUID.test(presented.mappingId) ||
      typeof presented.attemptId !== 'string' || !UUID.test(presented.attemptId) ||
      typeof presented.workerId !== 'string' || !UUID.test(presented.workerId) ||
      typeof presented.taskArn !== 'string' || !TASK_ARN.test(presented.taskArn) ||
      typeof presented.policyRevision !== 'string' || !SHA256.test(presented.policyRevision) ||
      !Number.isInteger(presented.attempt) || presented.attempt < 1 || presented.attempt > 2 ||
      !Number.isInteger(presented.fence) || presented.fence < 1 || presented.fence > MAX_FENCE) {
    fail('FIXTURE_AUTHORIZATION_INPUT');
  }
  return presented;
}

/**
 * Authorization compares the trusted authenticated peer, current grant, task,
 * attempt, fence, policy and database-time expiry under the current row lock. The
 * only non-throwing outcome other than AUTHORIZED is an explicit stale-binding
 * denial that names the distinct fresh current replacement.
 */
export function decideAuthorization({ current, grant, staleGrant = null, peer, presented, nowMs }) {
  if (!Number.isSafeInteger(nowMs)) fail('FIXTURE_AUTHORIZATION_CLOCK');
  assertTrustedPeer(peer);
  assertPresentedBinding(presented);
  if (presented.runUuid !== current.runUuid || presented.sessionId !== current.sessionId) {
    fail('FIXTURE_AUTHORIZATION_UNKNOWN_RUN');
  }
  if (presented.policyRevision !== current.policyRevision) fail('FIXTURE_POLICY_MISMATCH');
  if (grant.state !== 'ACTIVE') fail('FIXTURE_GRANT_REVOKED');
  // Database time is evaluated after the lock wait, never before it.
  if (nowMs >= grant.expiresAtMs) fail('FIXTURE_GRANT_EXPIRED');
  if (nowMs >= current.deadlineMs) fail('FIXTURE_ORIGINAL_DEADLINE');
  const bound = AUTHORIZATION_KEYS.every(key => presented[key] === current[key]);
  if (bound) {
    if (peer.peerId !== current.peerId || peer.credentialId !== current.credentialId) {
      fail('FIXTURE_PEER_BINDING');
    }
    return Object.freeze({ decision: 'AUTHORIZED', current });
  }
  if (presented.attempt < current.attempt || presented.fence < current.fence) {
    if (staleGrant?.state === 'REVOKED' && staleGrant.run_uuid === current.runUuid &&
        staleGrant.session_id === presented.sessionId &&
        staleGrant.policy_revision === presented.policyRevision &&
        staleGrant.peer_id === peer.peerId && staleGrant.credential_id === peer.credentialId &&
        staleGrant.grant_id === presented.grantId &&
        staleGrant.attempt === presented.attempt && staleGrant.fence === presented.fence &&
        staleGrant.mapping_id === presented.mappingId && staleGrant.task_arn === presented.taskArn &&
        staleGrant.attempt_id === presented.attemptId && staleGrant.worker_id === presented.workerId) {
      return Object.freeze({ decision: 'DENIED_STALE_BINDING', current });
    }
  }
  fail('FIXTURE_AUTHORIZATION_DENIED');
}

export function assertAdmissionContext(context, nowMs, { phase }) {
  assertFixtureContext(context, nowMs);
  const expected = phase === 'interrupt' ? 1 : 2;
  if ((phase !== 'interrupt' && phase !== 'resume') || context.phase !== phase ||
      context.identity.attempt !== expected) fail('FIXTURE_ADMISSION_PHASE');
  return context;
}

/**
 * Replacement must advance attempt and fence, present a distinct task/grant/
 * mapping/worker, stay on the original T0/D/C and be admitted strictly after the
 * original trusted commit. Everything stable is compared, so a reset of the
 * original clock or a re-used identity is refused rather than absorbed.
 */
export function assertReplacement(previous, next, { committedAtMs, nowMs }) {
  if (!Number.isSafeInteger(committedAtMs) || !Number.isSafeInteger(nowMs)) {
    fail('FIXTURE_REPLACEMENT_CLOCK');
  }
  if (previous.runUuid !== next.runUuid) fail('FIXTURE_REPLACEMENT_UNKNOWN_RUN');
  if (STABLE_KEYS.some(key => previous[key] !== next[key]) || !same(previous.pins, next.pins)) {
    fail('FIXTURE_REPLACEMENT_STABLE_BINDING');
  }
  if (previous.t0Ms !== next.t0Ms || previous.deadlineMs !== next.deadlineMs ||
      previous.cleanupDeadlineMs !== next.cleanupDeadlineMs) fail('FIXTURE_REPLACEMENT_CLOCK');
  if (next.attempt !== previous.attempt + 1 || next.fence <= previous.fence || next.fence > MAX_FENCE) {
    fail('FIXTURE_REPLACEMENT_SEQUENCE');
  }
  if (DISTINCT_KEYS.some(key => previous[key] === next[key])) fail('FIXTURE_REPLACEMENT_IDENTITY');
  if (next.admittedAtMs <= committedAtMs) fail('FIXTURE_REPLACEMENT_COMMIT_ORDER');
  if (next.admittedAtMs < next.t0Ms || next.expiresAtMs > next.deadlineMs ||
      nowMs >= next.expiresAtMs || nowMs >= next.deadlineMs) fail('FIXTURE_REPLACEMENT_CLOCK');
  return next;
}

/**
 * Publication input. The canonical receipt and the caller-supplied independently
 * verified readback must describe the same immutable versions; the receipt is
 * revalidated against the trusted original producer, never against itself.
 */
export function assertPublicationInput({ context, peer, receipt, readback, nowMs }) {
  if (!Number.isSafeInteger(nowMs)) fail('FIXTURE_PUBLICATION_CLOCK');
  assertFixtureContext(context, nowMs);
  if (context.phase !== 'interrupt' || context.identity.attempt !== 1) fail('FIXTURE_PUBLICATION_CONTEXT');
  assertTrustedPeer(peer);
  validateFixtureShape('FixtureCheckpointReceipt', receipt);
  const identity = publicationIdentity(receipt);
  assertFixtureReceipt(receipt, { producer: context, reference: identity, nowMs });
  assertVerifiedReadback(readback, receipt);
  return Object.freeze({ identity, readback: Object.freeze({ verifierId: readback.verifierId,
    bundleReadback: readback.bundleReadback,
    workspaceReadbackSha256: readback.workspaceReadbackSha256 }) });
}

/**
 * The original producer must still be the current attempt/fence/grant of the run.
 * After a replacement admission this refuses, which is exactly what a late
 * original commit has to hit.
 */
export function assertCommitBinding({ current, grant, peer, receipt, nowMs }) {
  const identity = receipt.producer.identity;
  if (receipt.producer.phase !== 'interrupt' || identity.attempt !== 1) fail('FIXTURE_PUBLICATION_CONTEXT');
  if (receipt.producer.runUuid !== current.runUuid || identity.fence !== current.fence ||
      identity.grantId !== current.grantId || identity.mappingId !== current.mappingId ||
      identity.taskArn !== current.taskArn || identity.canonical.attemptId !== current.attemptId ||
      identity.canonical.workerId !== current.workerId ||
      identity.policyRevision !== current.policyRevision) fail('FIXTURE_STALE_PUBLICATION');
  if (peer.peerId !== current.peerId || peer.credentialId !== current.credentialId) {
    fail('FIXTURE_PEER_BINDING');
  }
  if (grant.state !== 'ACTIVE') fail('FIXTURE_GRANT_REVOKED');
  if (nowMs >= grant.expiresAtMs || nowMs >= current.deadlineMs) fail('FIXTURE_COMMIT_EXPIRED');
  return true;
}

export function assertLoadInput({ context, peer, reference, nowMs }) {
  if (!Number.isSafeInteger(nowMs)) fail('FIXTURE_LOAD_CLOCK');
  assertFixtureContext(context, nowMs);
  if (context.phase !== 'resume' || context.identity.attempt !== 2) fail('FIXTURE_LOAD_CONTEXT');
  assertTrustedPeer(peer);
  return assertReceiptReference(reference);
}

/** A load/verify reference must name the committed original receipt exactly. */
export function assertCommittedReference(committed, reference) {
  if (committed === null || committed === undefined) fail('FIXTURE_RECEIPT_UNKNOWN');
  assertReceiptReference(reference);
  if (committed.receipt_id !== reference.receiptId ||
      committed.receipt_sha256 !== reference.receiptSha256) fail('FIXTURE_RECEIPT_REFERENCE_MISMATCH');
  return committed;
}

/** Supplied restored bytes must match the committed digests. */
export function assertRestoredDigests(committed, { bundleSha256, workspaceSha256 }) {
  if (typeof bundleSha256 !== 'string' || !SHA256.test(bundleSha256) ||
      typeof workspaceSha256 !== 'string' || !SHA256.test(workspaceSha256)) {
    fail('FIXTURE_RESTORED_DIGEST_INPUT');
  }
  if (committed.bundle_sha256 !== bundleSha256 ||
      committed.workspace_sha256 !== workspaceSha256) fail('FIXTURE_RESTORED_DIGEST_MISMATCH');
  return true;
}
