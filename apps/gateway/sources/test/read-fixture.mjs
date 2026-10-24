/** Synthetic DTO values only. No authority, dispatcher, grant issuer or network port is constructed. */
export const NOW = Date.parse('2026-10-12T01:00:00Z');
export const uuid = digit => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
export const limits = { maxRequestBytes: 65536, maxResponseBytes: 65536, maxRequestMs: 2000, maxCleanupMs: 100 };
export const operation = { id: 'search_federal_contract_awards', version: '0.2.0' };
export const requestJson = JSON.stringify({ operation, arguments: {} });

export function fixture(){
  const calls = []; const state = { now: NOW, revoked: false, fence: 1, sourceEnabled: true, grants: ['test.read'] };
  const binding = { tenantId: 'synthetic-tenant', actorId: 'synthetic-actor', conversationId: uuid('1'),
    runId: uuid('2'), attemptId: uuid('3'), workerId: uuid('4'), writerFence: 1 };
  const scope = { tenantId: binding.tenantId, kind: 'tenant', resourceId: binding.tenantId, policyRevision: 'revision-1' };
  const claims = { capabilityId: uuid('5'), issuer: 'synthetic-issuer', audience: 'meri-gateway', binding,
    actions: ['tool.read'], scopes: [scope], issuedAt: new Date(NOW-1000).toISOString(), expiresAt: new Date(NOW+10000).toISOString(),
    policyRevision: scope.policyRevision, budgets: { maxTurns: 5, maxRuntimeSeconds: 10, maxCostMicrousd: 100, maxOutputBytes: 65536 } };
  const subject = { kind: 'personal', entityType: 'user', entityIds: [binding.actorId], tenantId: binding.tenantId,
    actorId: binding.actorId, authorizationDecisionId: uuid('6'), policyRevision: scope.policyRevision,
    scopes: [scope], rosterVersionId: null };
  return {state,claims,binding,subject};
}
