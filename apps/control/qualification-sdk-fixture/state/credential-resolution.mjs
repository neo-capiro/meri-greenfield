// Pure reconstruction of the closed private context from trusted registry rows.
// A certificate fingerprint is one admitted grant, never a worker body claim.
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { validateShape } from '../../../../packages/contracts/qualification-sdk/validate.mjs';
import { assertTrustedPeer } from './binding.mjs';
import { fail } from './errors.mjs';

const INTEGER = /^-?\d+$/;
const same = (left, right) => canonicalSha256(left) === canonicalSha256(right);
function integer(value) {
  const n = typeof value === 'string' && INTEGER.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(n)) fail('FIXTURE_CREDENTIAL_ROW');
  return n;
}

function contextOf(run, grant) {
  const context = {
    channelVersion: 'sdk-fixture/1', profile: 'sdk-interruption-fixture-v1',
    runUuid: run.run_uuid, phase: grant.phase,
    namespace: { sessionId: run.session_id, cwd: '/workspace/conversation',
      projectKey: '-workspace-conversation' },
    identity: {
      mappingId: grant.mapping_id, grantId: grant.grant_id,
      admittedAtMs: integer(grant.admitted_at_ms),
      expiresAtMs: integer(grant.expires_at_ms), taskArn: grant.task_arn,
      attempt: integer(grant.attempt), fence: integer(grant.fence),
      policyRevision: grant.policy_revision,
      canonical: { tenantId: run.canonical_tenant_id, actorId: run.canonical_actor_id,
        conversationId: run.canonical_conversation_id, runId: run.canonical_run_id,
        attemptId: grant.attempt_id, workerId: grant.worker_id,
        writerFence: integer(grant.fence) },
    },
    clock: { t0Ms: integer(run.t0_ms), deadlineMs: integer(run.deadline_ms),
      cleanupDeadlineMs: integer(run.cleanup_deadline_ms) },
    pins: { sourceCommit: run.source_commit, imageDigest: run.image_digest,
      sdkVersion: run.sdk_version, cliVersion: run.cli_version,
      contractsVersion: run.contracts_version,
      contractsSchemaSha256: run.contracts_schema_sha256,
      skillsManifestSha256: run.skills_manifest_sha256 },
  };
  validateShape('FixtureContext', context);
  return context;
}

/** Return exactly the authenticated grant's audience, with original A lineage. */
export function resolveCredentialRows({ run, grants, fingerprintSha256 }) {
  if (!run || !Array.isArray(grants) || grants.length < 1 || grants.length > 2 ||
      typeof fingerprintSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprintSha256)) {
    fail('FIXTURE_CREDENTIAL_ROW');
  }
  const originals = grants.filter(g => integer(g.attempt) === 1 && g.phase === 'interrupt');
  const active = grants.filter(g => g.grant_id === run.current_grant_id && g.state === 'ACTIVE');
  const matching = grants.filter(g => g.credential_id === fingerprintSha256);
  if (originals.length !== 1 || active.length !== 1 || matching.length !== 1 ||
      grants.some(g => g.run_uuid !== run.run_uuid || g.session_id !== run.session_id ||
        g.policy_revision !== run.policy_revision ||
        !['ACTIVE', 'REVOKED'].includes(g.state)) ||
      integer(active[0].attempt) !== integer(run.current_attempt) ||
      integer(active[0].fence) !== integer(run.current_fence) ||
      active[0].mapping_id !== run.current_mapping_id ||
      active[0].task_arn !== run.current_task_arn ||
      active[0].attempt_id !== run.current_attempt_id ||
      active[0].worker_id !== run.current_worker_id ||
      active[0].peer_id !== run.current_peer_id ||
      active[0].credential_id !== run.current_credential_id ||
      integer(active[0].admitted_at_ms) !== integer(run.current_admitted_at_ms) ||
      integer(active[0].expires_at_ms) !== integer(run.current_expires_at_ms) ||
      (grants.length === 2 && (originals[0].state !== 'REVOKED' ||
        integer(active[0].attempt) !== 2 || active[0].phase !== 'resume')) ||
      (grants.length === 1 && (originals[0].state !== 'ACTIVE' ||
        integer(active[0].attempt) !== 1))) fail('FIXTURE_CREDENTIAL_ROW');
  const producer = contextOf(run, originals[0]);
  const context = contextOf(run, active[0]);
  const audience = contextOf(run, matching[0]);
  if (!same(producer.clock, context.clock) || !same(producer.pins, context.pins) ||
      !same(producer.namespace, context.namespace)) fail('FIXTURE_CREDENTIAL_ROW');
  const peer = assertTrustedPeer({ peerId: matching[0].peer_id,
    credentialId: matching[0].credential_id });
  return Object.freeze({ peer, context, producer, audience: Object.freeze([audience]) });
}
