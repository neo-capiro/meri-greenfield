/** Execute pinned pure policy helpers without publishing private implementation. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { posix } from 'node:path';
import assert from 'node:assert/strict';

const repository = process.env.MEMORY_POLICY_REFERENCE_REPO ?? '/workspace/capirov2';
const ref = 'fd8765ec01d292013758606204f2c9d886cd31c1';
const prefix = 'apps/api/src/memory/';
const identities = {
  'memory-review-admin-policy.ts': 'ce7d9b36b52b7b63d1a8bdcaf0bab2acf3c57187dedc5752a80f8e95f733adc3',
  'memory-authorization.helpers.ts': 'a0c2ece14a7d8164d3a7c7a2f028ffe75a486c91f6fdda8b11fa48cab66c60e7',
  'memory-candidate-rules.ts': '17f48ff5ca477057ed622afca0412481e0ba9220c6891df12d21bf5f1c87ceaf',
  '../meri/memory-confidence.helpers.ts': '18a1482d11df9f98a66d3d106de2400956f5c092e2a91723b3e37814c681ed6c',
};
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const read = name => {
  const bytes = execFileSync('git', ['-C', repository, 'show', `${ref}:${posix.join(prefix, name)}`], { maxBuffer: 1024 * 1024 });
  assert.equal(createHash('sha256').update(bytes).digest('hex'), identities[name]);
  return stripTypeScriptTypes(bytes.toString('utf8'));
};

try {
  const adminUrl = url(read('memory-review-admin-policy.ts'));
  const unqualified = url('export function memoryGovernanceSelectedForCurrentTenant(){throw Error("UNQUALIFIED_DEPENDENCY");}');
  const helperSource = read('memory-authorization.helpers.ts')
    .replace('./memory-review-admin-policy.js', adminUrl)
    .replace('./memory-governance-tenant-scope.js', unqualified);
  const policy = await import(url(helperSource));
  const admin = await import(adminUrl);
  const rules = await import(url(read('memory-candidate-rules.ts')
    .replace('../meri/memory-confidence.helpers.js', url(read('../meri/memory-confidence.helpers.ts')))));
  const roles = ['standard_user', 'user_admin', 'capiro_admin', 'client_portal_user'];
  const rows = [];
  for (const role of roles) for (const memoryClass of ['institutional_authoritative', 'client_steering', 'user_preference', 'episodic_working'])
    for (const scope of ['firm', 'client', 'user_private']) for (const self of [true, false]) {
      const base = { userId: 'synthetic-reviewer', role, operation: 'approve',
        subject: { memoryClass, scope, ownerUserId: 'synthetic-reviewer', clientId: scope === 'client' ? 'synthetic-client' : null,
          status: 'pending', proposedByUserId: self ? 'synthetic-reviewer' : 'synthetic-proposer' },
        ethicalWallAllowed: true, clientStatus: 'active', grantPermissions: ['approve', 'review'] };
      rows.push({ role, memoryClass, scope, self, decision: policy.evaluateGovernedMemoryAuthorization(base) });
    }
  const base = { userId: 'synthetic-reviewer', role: 'user_admin', operation: 'approve',
    subject: { memoryClass: 'institutional_authoritative', scope: 'client', ownerUserId: null,
      clientId: 'synthetic-client', status: 'pending', proposedByUserId: 'synthetic-reviewer' },
    ethicalWallAllowed: true, clientStatus: 'active', grantPermissions: [] };
  const variants = [
    ['admin-self-client', {}], ['blocked-wall', { ethicalWallAllowed: false }], ['archived-client', { clientStatus: 'archived' }],
    ['suspended-client', { clientStatus: 'suspended' }], ['missing-client-status', { clientStatus: null }],
    ['admin-impersonating-standard', { impersonating: true, actorRole: 'standard_user' }],
    ['standard-impersonating-admin', { role: 'standard_user', impersonating: true, actorRole: 'capiro_admin' }],
    ['impersonation-missing-actor', { impersonating: true, actorRole: null }],
    ['ordinary-other-no-grants', { role: 'standard_user', subject: { ...base.subject, proposedByUserId: 'synthetic-other' } }],
    ['ordinary-other-approve-grant', { role: 'standard_user', grantPermissions: ['approve'], subject: { ...base.subject, proposedByUserId: 'synthetic-other' } }],
    ['ordinary-self-approve-grant', { role: 'standard_user', grantPermissions: ['approve'] }],
    ['revoked-candidate', { subject: { ...base.subject, status: 'revoked' } }],
  ].map(([scenario, changes]) => ({ scenario, decision: policy.evaluateGovernedMemoryAuthorization({ ...base, ...changes }) }));
  const proposals = [];
  for (const scope of ['personal', 'firm', 'client']) for (const isAdmin of [true, false])
    for (const sourceKind of ['manual', 'model_extraction', 'learning_signal']) {
      const { outcome, ruleId } = rules.evaluateMemoryCandidate({ scope, isAdmin, sourceKind });
      proposals.push({ scope, isAdmin, sourceKind, outcome, ruleId });
    }
  console.log(JSON.stringify({ schema: 'meri-pinned-policy-helper-characterization/1', ref, identities,
    limits: 'Pure helper only; tenant-selection dependency deliberately throws if used; no service/DB/auth/runtime qualification.',
    adminRoles: roles.map(role => ({ role, admin: admin.isMemoryReviewAdminRole(role) })), rows, variants, proposals }, null, 2));
} catch (error) {
  // Never emit a data-URL stack or private source body on harness failure.
  console.error(JSON.stringify({ status: 'HARNESS_FAILURE', errorType: error?.name ?? 'unknown', code: error?.code ?? null }));
  process.exitCode = 1;
}
