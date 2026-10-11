// Translation between canonical private contexts and the trusted registry row.
// The worker-presented context remains a claim; the registry decides authority.
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { assertFixtureContext } from '../../../../packages/contracts/qualification-sdk/validate.mjs';
import { trustedBindingFromContext } from '../state/binding.mjs';

const fail = () => { throw new Error('FIXTURE_SERVICE_BINDING'); };

export function presentedBinding(context) {
  const { identity } = context;
  return Object.freeze({ runUuid: context.runUuid, sessionId: context.namespace.sessionId,
    attempt: identity.attempt, fence: identity.fence, policyRevision: identity.policyRevision,
    grantId: identity.grantId, mappingId: identity.mappingId, taskArn: identity.taskArn,
    attemptId: identity.canonical.attemptId, workerId: identity.canonical.workerId });
}

/** A stale denial may disclose only the full current context matching the locked registry row. */
export function assertCurrentContext(context, current, checkedAtMs) {
  assertFixtureContext(context, checkedAtMs);
  if (context.phase !== 'resume') fail();
  const mapped = trustedBindingFromContext(context, {
    peerId: current.peerId, credentialId: current.credentialId,
  });
  const { phase: ignored, ...withoutPhase } = mapped;
  if (canonicalSha256(withoutPhase) !== canonicalSha256(current)) fail();
  return context;
}
