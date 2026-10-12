// Immutable receipt identity and independently verified readback binding.
//
// This module owns exactly one responsibility: derive the canonical correlation
// identity of a *previously verified* receipt and refuse a publication whose
// caller-supplied readback does not describe the same immutable object versions.
// It performs no I/O and holds no storage privilege: the object store reread that
// produced the readback is a separate trusted capability that this module cannot
// and does not perform.
import { validateShape as validatePublicShape } from '../../../../packages/contracts/validate.mjs';
import { fixtureReceiptIdentity, validateShape as validateFixtureShape }
  from '../../../../packages/contracts/qualification-sdk/validate.mjs';
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { fail } from './errors.mjs';

const SHA256 = /^[0-9a-f]{64}$/;
const VERIFIER = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/;
const READBACK_KEYS = Object.freeze(['verified', 'verifierId', 'bundleReadback', 'workspaceReadbackSha256']);

/** Correlation data only; a receipt identity never authenticates a receipt. */
export function publicationIdentity(receipt) {
  return Object.freeze(fixtureReceiptIdentity(receipt));
}

export function assertReceiptReference(reference) {
  validateFixtureShape('FixtureReceiptIdentity', reference);
  return reference;
}

export function sameIdentity(left, right) {
  return left.receiptId === right.receiptId && left.receiptSha256 === right.receiptSha256;
}

/**
 * The readback is trusted control-plane output produced by an object store that
 * independently reread the exact immutable versions. `verified:true` is a claim by
 * that trusted caller, not something this module can establish; what this module
 * does enforce is that the claim describes the same object identity, version,
 * digest, size and scopes as the receipt, so a substituted or stale reference is
 * refused rather than published.
 */
export function assertVerifiedReadback(readback, receipt) {
  if (readback === null || typeof readback !== 'object' || Array.isArray(readback) ||
      Object.getPrototypeOf(readback) !== Object.prototype ||
      Reflect.ownKeys(readback).length !== READBACK_KEYS.length ||
      !READBACK_KEYS.every(key => Object.hasOwn(readback, key)) ||
      readback.verified !== true || typeof readback.verifierId !== 'string' ||
      !VERIFIER.test(readback.verifierId)) fail('FIXTURE_READBACK_REQUIRED');
  validatePublicShape('ObjectReference', readback.bundleReadback);
  if (typeof readback.workspaceReadbackSha256 !== 'string' ||
      !SHA256.test(readback.workspaceReadbackSha256)) fail('FIXTURE_READBACK_REQUIRED');
  const stored = readback.bundleReadback, bundle = receipt.bundle;
  if (stored.objectId !== bundle.objectId || stored.versionId !== bundle.versionId ||
      stored.sha256 !== bundle.sha256 || stored.bytes !== bundle.bytes ||
      canonicalSha256(stored.scopes) !== canonicalSha256(bundle.scopes)) fail('FIXTURE_READBACK_MISMATCH');
  if (readback.workspaceReadbackSha256 !== receipt.workspaceSha256 ||
      receipt.commit.workspaceReadbackSha256 !== receipt.workspaceSha256) fail('FIXTURE_READBACK_MISMATCH');
  return readback;
}

/** Column values for the single immutable commit row of a run. */
export function publicationRow({ commitId, identity, receipt, readback, binding, recordedAt }) {
  return Object.freeze({
    commit_id: commitId,
    receipt_id: identity.receiptId,
    receipt_sha256: identity.receiptSha256,
    run_uuid: binding.runUuid,
    grant_id: binding.grantId,
    attempt: receipt.producer.identity.attempt,
    fence: receipt.commit.publicationFence,
    phase: receipt.producer.phase,
    task_arn: receipt.producer.identity.taskArn,
    policy_revision: receipt.producer.identity.policyRevision,
    bundle_object_id: receipt.bundle.objectId,
    bundle_version_id: receipt.bundle.versionId,
    bundle_sha256: receipt.bundle.sha256,
    bundle_bytes: receipt.bundle.bytes,
    workspace_sha256: receipt.workspaceSha256,
    workspace_readback_sha256: readback.workspaceReadbackSha256,
    committed_at_ms: receipt.commit.committedAtMs,
    recorded_at: recordedAt,
    verifier_id: readback.verifierId,
  });
}
