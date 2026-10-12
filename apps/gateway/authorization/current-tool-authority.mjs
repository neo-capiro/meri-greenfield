/** Fresh trusted-port composition; no signature, membership or policy adapter. */
import { validateShape, canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { assertSubject } from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import { deny, exactKeys, parseRawJson } from '../dispatch/operation-result.mjs';

const PORTS = ['verifyCapability', 'currentRun', 'authorizeBusiness', 'authorizeSources'];
const same = (a, b) => canonicalSha256(a) === canonicalSha256(b);
const freeze = value => {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

export function createCurrentToolAuthority({ ports, now, maxFactBytes }) {
  if (!ports || PORTS.some(name => typeof ports[name] !== 'function') ||
      typeof now !== 'function' || !Number.isSafeInteger(maxFactBytes) || maxFactBytes < 1) deny('GATEWAY_CONFIGURATION');
  async function identify({ credential, signal }) {
    if (typeof credential !== 'string' || credential.length < 1 || credential.length > 8192 || signal?.aborted) deny('ACCESS_DENIED');
    const started = now();
    const fresh = stamp => {
      if (!Number.isSafeInteger(stamp) || stamp < started || stamp > now() || signal?.aborted) deny('ACCESS_DENIED');
    };
    try {
      const claims = parseRawJson(await ports.verifyCapability(credential, { signal }), maxFactBytes, 'ACCESS_DENIED');
      validateShape('CapabilityClaims', claims);
      if (claims.audience !== 'meri-gateway' || !claims.actions.includes('tool.read') ||
          Date.parse(claims.issuedAt) > now() || Date.parse(claims.expiresAt) <= now() ||
          claims.scopes.some(scope => scope.tenantId !== claims.binding.tenantId || scope.policyRevision !== claims.policyRevision)) deny('ACCESS_DENIED');
      const run = parseRawJson(await ports.currentRun(claims.binding, { signal }), maxFactBytes, 'ACCESS_DENIED');
      exactKeys(run, ['binding', 'policyRevision', 'deadlineMs', 'checkedAtMs'], 'ACCESS_DENIED');
      validateShape('RunBinding', run.binding); fresh(run.checkedAtMs);
      if (!same(run.binding, claims.binding) || run.policyRevision !== claims.policyRevision ||
          !Number.isSafeInteger(run.deadlineMs) || run.deadlineMs <= now()) deny('ACCESS_DENIED');
      return freeze({ claims, run, started });
    } catch { deny('ACCESS_DENIED'); }
  }
  async function check({ credential, descriptor, input, signal }) {
    try {
      const { claims, run, started } = await identify({ credential, signal });
      const fresh = stamp => {
        if (!Number.isSafeInteger(stamp) || stamp < started || stamp > now() || signal?.aborted) deny('ACCESS_DENIED');
      };
      const policy = parseRawJson(await ports.authorizeBusiness({ claims, operation: descriptor.operation,
        requiredGrants: descriptor.requiredGrants, input, signal }), maxFactBytes, 'ACCESS_DENIED');
      exactKeys(policy, ['decision', 'subject', 'grants'], 'ACCESS_DENIED');
      validateShape('AuthorizationDecision', policy.decision); assertSubject(policy.subject, claims.binding);
      const decision = policy.decision;
      if (decision.decision !== 'allowed' || decision.operation !== `${descriptor.operation.id}@${descriptor.operation.version}` ||
          !same(decision.actor, { tenantId: claims.binding.tenantId, actorId: claims.binding.actorId }) ||
          decision.policyRevision !== claims.policyRevision || policy.subject.policyRevision !== claims.policyRevision ||
          policy.subject.authorizationDecisionId !== decision.decisionId || !same(decision.scopes, policy.subject.scopes) ||
          !Array.isArray(policy.grants) || policy.grants.some(grant => typeof grant !== 'string') ||
          descriptor.requiredGrants.some(grant => !policy.grants.includes(grant)) ||
          policy.subject.scopes.some(scope => !claims.scopes.some(candidate => same(candidate, scope)))) deny('ACCESS_DENIED');
      fresh(Date.parse(decision.evaluatedAt));
      const sources = parseRawJson(await ports.authorizeSources({ claims, subject: policy.subject,
        sourceRequirements: descriptor.sourceRequirements, signal }), maxFactBytes, 'ACCESS_DENIED');
      exactKeys(sources, ['sourceIds', 'enabled', 'policyRevision', 'checkedAtMs'], 'ACCESS_DENIED');
      fresh(sources.checkedAtMs);
      if (sources.enabled !== true || sources.policyRevision !== claims.policyRevision ||
          !Array.isArray(sources.sourceIds) || sources.sourceIds.some(id => typeof id !== 'string') ||
          new Set(sources.sourceIds).size !== sources.sourceIds.length ||
          sources.sourceIds.length !== new Set(descriptor.sourceRequirements.map(source => source.sourceId)).size ||
          descriptor.sourceRequirements.some(source => !sources.sourceIds.includes(source.sourceId))) deny('ACCESS_DENIED');
      const finalRun = parseRawJson(await ports.currentRun(claims.binding, { signal }), maxFactBytes, 'ACCESS_DENIED');
      exactKeys(finalRun, ['binding', 'policyRevision', 'deadlineMs', 'checkedAtMs'], 'ACCESS_DENIED');
      fresh(finalRun.checkedAtMs);
      if (!same(finalRun.binding, run.binding) || finalRun.policyRevision !== run.policyRevision ||
          finalRun.deadlineMs !== run.deadlineMs) deny('ACCESS_DENIED');
      if (Date.parse(claims.expiresAt) <= now() || run.deadlineMs <= now() || signal?.aborted) deny('ACCESS_DENIED');
      return freeze({ binding: claims.binding, policyRevision: claims.policyRevision,
        subject: policy.subject, decision, claims, sourceIds: sources.sourceIds,
        deadlineMs: Math.min(run.deadlineMs, Date.parse(claims.expiresAt)) });
    } catch { deny('ACCESS_DENIED'); }
  }
  return Object.freeze({ identify, check });
}
