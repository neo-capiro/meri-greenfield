/** Explicit synthetic ports; no production adapter, identity or source. */
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { normalizeFederalMarketInput, validateFederalMarketShape } from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import { createCurrentToolAuthority } from '../authorization/current-tool-authority.mjs';
import { createToolDispatch } from '../dispatch/tool-dispatch.mjs';
import { exactKeys } from '../dispatch/operation-result.mjs';

export const NOW = Date.parse('2026-10-12T01:00:00Z');
export const uuid = digit => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
export const limits = { maxRequestBytes: 65536, maxResponseBytes: 65536, maxRequestMs: 2000, maxCleanupMs: 100 };
export const operation = { id: 'search_federal_contract_awards', version: '0.2.0' };
export const requestJson = JSON.stringify({ operation, arguments: {} });

export function fixture() {
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
  const descriptor = { operation, requiredGrants: ['test.read'], sourceRequirements: [{ sourceId: 'synthetic-source', authority: 'authoritative', purpose: 'enumeration' }] };
  const ports = {
    async verifyCapability() { calls.push('capability'); if (state.revoked) throw Error('private denial detail'); return JSON.stringify(claims); },
    async currentRun() { calls.push('fence'); return JSON.stringify({ binding: { ...binding, writerFence: state.fence },
      policyRevision: scope.policyRevision, deadlineMs: NOW+10000, checkedAtMs: state.now }); },
    async authorizeBusiness() { calls.push('policy'); return JSON.stringify({ decision: {
      decisionId: uuid('6'), actor: { tenantId: binding.tenantId, actorId: binding.actorId },
      operation: `${operation.id}@${operation.version}`, scopes: [scope], policyRevision: scope.policyRevision,
      evaluatedAt: new Date(state.now).toISOString(), decision: 'allowed', reasonCode: 'SYNTHETIC_ONLY' }, subject, grants: state.grants }); },
    async authorizeSources() { calls.push('source-policy'); return JSON.stringify({ sourceIds: ['synthetic-source'],
      enabled: state.sourceEnabled, policyRevision: scope.policyRevision, checkedAtMs: state.now }); },
  };
  const budget = {
    async reserve({ reservationId }) { calls.push('reserve'); return JSON.stringify({ reservationId, decision: 'reserved' }); },
    async settle({ reservationId }) { calls.push('settle'); return JSON.stringify({ reservationId, decision: 'settled' }); },
    async markUncertain() { calls.push('uncertain'); },
  };
  const data = { items: [], total: 0, page: 1, pageSize: 10, source: 'synthetic', asOf: new Date(NOW).toISOString(),
    generatedAt: new Date(NOW).toISOString(), hasMore: false, nextPage: null, paginationLimitReached: false, tool: operation.id };
  const contract = {
    normalizeInput(args) { const result = normalizeFederalMarketInput(operation.id, args);
      return { request: args, input: result.query, metadata: result, argumentsSha256: canonicalSha256(result.query) }; },
    // Internal lifecycle carrier only; not a registered or published DTO.
    assertOutput(value) { exactKeys(value, ['binding', 'subject', 'data'], 'INVALID_RESULT');
      return validateFederalMarketShape('SearchFederalContractAwardsOutput', value.data); },
  };
  const output = { binding, subject, data };
  const entry = { descriptor, contract, async execute(call) { calls.push('handler'); state.handlerCall = call; return JSON.stringify(output); } };
  const authority = createCurrentToolAuthority({ ports, now: () => state.now, maxFactBytes: 65536 });
  const catalog = { entry: () => entry, discoverable: () => [entry] };
  const create = changes => createToolDispatch({ catalog, authority, budget, limits, now: () => state.now,
    newId: () => uuid('7'), sourceEnabled: true, ...changes });
  return { state, calls, ports, budget, claims, binding, subject, descriptor, contract, entry, authority, create, output, data };
}
