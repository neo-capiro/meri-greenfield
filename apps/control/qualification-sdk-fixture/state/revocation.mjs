// Trusted owner revocation predicates. Historical integrity is not current
// operation authority; this module grants no operation and performs no I/O.
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { assertFixtureContext, snapshotFixtureData } from
  '../../../../packages/contracts/qualification-sdk/validate.mjs';
import { trustedBindingFromContext } from './binding.mjs';
import { fail } from './errors.mjs';

const GRANT_BINDING = Object.freeze({ grant_id: 'grantId', run_uuid: 'runUuid',
  session_id: 'sessionId', attempt: 'attempt', fence: 'fence', phase: 'phase',
  mapping_id: 'mappingId', task_arn: 'taskArn', attempt_id: 'attemptId', worker_id: 'workerId',
  peer_id: 'peerId', credential_id: 'credentialId', policy_revision: 'policyRevision' });

function integer(value) {
  const n = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(n)) fail('FIXTURE_REVOCATION_GRANT');
  return n;
}

/** Detach both authority inputs before entering a transaction or awaiting locks. */
export function revocationBinding(context, peer) {
  const snapshot = snapshotFixtureData({ context, peer });
  // Validate at the original admission instant, not a fabricated present instant.
  // Expired current authority may be revoked, but cannot authorize another use.
  assertFixtureContext(snapshot.context, snapshot.context.identity?.admittedAtMs);
  return trustedBindingFromContext(snapshot.context, snapshot.peer);
}

/** Rows are trusted database results held under run -> grant locks. */
export function assertCurrentRevocation({ expected, current, grant, nowMs }) {
  if (!Number.isSafeInteger(nowMs) || nowMs < expected.admittedAtMs) {
    fail('FIXTURE_REVOCATION_CLOCK');
  }
  const { phase, ...binding } = expected;
  if (canonicalSha256(binding) !== canonicalSha256(current)) {
    fail('FIXTURE_REVOCATION_BINDING');
  }
  if (grant === null || typeof grant !== 'object' ||
      Object.entries(GRANT_BINDING).some(([column, key]) => grant[column] !== expected[key]) ||
      integer(grant.admitted_at_ms) !== expected.admittedAtMs ||
      integer(grant.expires_at_ms) !== expected.expiresAtMs ||
      !['ACTIVE', 'REVOKED'].includes(grant.state) ||
      (grant.state === 'ACTIVE' && grant.revoked_at !== null) ||
      (grant.state === 'REVOKED' && (!(grant.revoked_at instanceof Date) ||
        !Number.isSafeInteger(grant.revoked_at.getTime()) ||
        grant.revoked_at.getTime() < expected.admittedAtMs || grant.revoked_at.getTime() > nowMs))) {
    fail('FIXTURE_REVOCATION_GRANT');
  }
  return grant.state;
}
