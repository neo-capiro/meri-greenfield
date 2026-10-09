// Meri W02-02 offline policy tests (repaired).
//
// Fully offline: no socket, no AWS/model/proxy/DB, synthetic keys/identity/
// events/pricing only. These tests exercise the local reference model and prove
// NOTHING about deployed proxy or authentication behaviour.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DENY, MODEL_ALIAS, MESSAGES_ROUTE, QUALIFICATION_CEILING_MICROUSD,
  admitMessagesFeatures, admitModelRequest, attemptBudgetReset, committedMicrousd,
  createCredentialRegistry, createLedger, estimateCostMicrousd, expireReservations,
  isParsedMessagesRequest, parseAnthropicMessagesRequest, reconcileBudget,
  reserveBudget, settleBudget, validateStream,
} from '../offline-policy.mjs';
import { validateShape } from '../../../../packages/contracts/validate.mjs';

const fixture = JSON.parse(readFileSync(new URL('../policy.fixture.json', import.meta.url), 'utf8'));
const NOW = '2026-10-09T22:00:00Z';
const registry = createCredentialRegistry(fixture.credentialRegistry);

const identity = (over = {}) => ({ ...structuredClone(fixture.trustedIdentity), ...over });
const run = (over = {}) => ({ state: 'active', policyRevision: fixture.policyRevision, binding: structuredClone(fixture.binding), ...over });
const raw = (over = {}) => {
  const base = structuredClone(fixture.rawMessages);
  return { ...base, ...over, headers: { ...base.headers, ...(over.headers ?? {}) }, body: { ...base.body, ...(over.body ?? {}) } };
};
const admit = (over = {}) => admitModelRequest({
  now: NOW, registry, credentialId: 'synthetic-key-1', trustedIdentity: identity(), run: run(),
  raw: raw(), requestId: crypto.randomUUID(), ledger: createLedger(), pricing: fixture.pricing,
  allowedBetas: fixture.allowedBetas, ...over,
});

test('fixture binding, budgets and every registry grant conform to the frozen 0.1.0 shapes', () => {
  validateShape('RunBinding', fixture.binding);
  validateShape('Budgets', fixture.budgets);
  for (const entry of fixture.credentialRegistry) validateShape('RunBinding', entry.grant.binding);
  assert.equal(fixture.budgets.maxCostMicrousd, QUALIFICATION_CEILING_MICROUSD);
  assert.equal(fixture.nativeTeamMaxBudgetUsd, 10);
});

test('admits a well-formed request and reserves worst-case cost', () => {
  const result = admit();
  assert.equal(result.allowed, true, JSON.stringify(result));
  assert.ok(Number.isSafeInteger(result.reservedMicrousd) && result.reservedMicrousd > 0);
});

test('denies absent, unknown, revoked and expired registry keys', () => {
  assert.equal(admit({ credentialId: '' }).reasonCode, DENY.MISSING_KEY);
  assert.equal(admit({ credentialId: 'not-registered' }).reasonCode, DENY.UNKNOWN_KEY);
  assert.equal(admit({ credentialId: 'synthetic-key-revoked' }).reasonCode, DENY.KEY_REVOKED);
  assert.equal(admit({ credentialId: 'synthetic-key-expired' }).reasonCode, DENY.KEY_EXPIRED);
});

test('denies malformed grants, identities and run bindings instead of throwing or passing', () => {
  const badGrant = createCredentialRegistry([{ keyId: 'bad-grant', grant: { keyId: 'bad-grant', model: MODEL_ALIAS, allowedRoutes: [MESSAGES_ROUTE], state: 'active', expiresAt: '2099-01-01T00:00:00Z', policyRevision: 'policy-synthetic-1', binding: { tenantId: 'x' } } }]);
  assert.equal(admit({ registry: badGrant, credentialId: 'bad-grant' }).reasonCode, DENY.MALFORMED_GRANT);
  assert.equal(admit({ trustedIdentity: { source: 'broker' } }).reasonCode, DENY.MALFORMED_IDENTITY);
  assert.equal(admit({ run: run({ binding: {} }) }).reasonCode, DENY.MALFORMED_BINDING);
});

test('denies empty or wildcard model/route grants', () => {
  assert.equal(admit({ credentialId: 'synthetic-key-wildcard' }).reasonCode, DENY.MODEL_NOT_ALLOWED);
  const noRoute = createCredentialRegistry([{ keyId: 'no-route', grant: { keyId: 'no-route', model: MODEL_ALIAS, allowedRoutes: [], state: 'active', expiresAt: '2099-01-01T00:00:00Z', policyRevision: 'policy-synthetic-1', binding: fixture.binding } }]);
  assert.equal(admit({ registry: noRoute, credentialId: 'no-route' }).reasonCode, DENY.ROUTE_NOT_ALLOWED);
});

test('denies missing or untrusted caller identity; never trusts headers or self-asserted metadata', () => {
  assert.equal(admit({ trustedIdentity: null }).reasonCode, DENY.MISSING_TRUSTED_IDENTITY);
  assert.equal(admit({ trustedIdentity: identity({ source: 'headers' }) }).reasonCode, DENY.UNTRUSTED_IDENTITY_SOURCE);
  assert.equal(admit({ raw: raw({ headers: { 'x-run-id': 'attacker' } }) }).reasonCode, DENY.UNKNOWN_HEADER);
});

test('denies inactive runs and tenant/run mismatch', () => {
  assert.equal(admit({ run: run({ state: 'cancelled' }) }).reasonCode, DENY.RUN_NOT_ACTIVE);
  assert.equal(admit({ run: run({ state: 'inactive' }) }).reasonCode, DENY.RUN_NOT_ACTIVE);
  assert.equal(admit({ trustedIdentity: identity({ tenantId: 'other' }) }).reasonCode, DENY.BINDING_MISMATCH);
  assert.equal(admit({ trustedIdentity: identity({ runId: crypto.randomUUID() }) }).reasonCode, DENY.BINDING_MISMATCH);
});

test('old key with a NEW genuine identity is denied (grant is authoritative)', () => {
  const newAttempt = crypto.randomUUID();
  const newWorker = crypto.randomUUID();
  const advanced = run({ binding: { ...fixture.binding, attemptId: newAttempt, workerId: newWorker, writerFence: 2 } });
  const newIdentity = identity({ attemptId: newAttempt, workerId: newWorker, writerFence: 2 });
  assert.equal(admit({ run: advanced, trustedIdentity: newIdentity, credentialId: 'synthetic-key-old' }).reasonCode, DENY.STALE_ATTEMPT);
});

test('copied key on another genuine current task is denied (stable run mismatch)', () => {
  const otherRunId = crypto.randomUUID();
  const otherRun = run({ binding: { ...fixture.binding, runId: otherRunId } });
  const otherIdentity = identity({ runId: otherRunId });
  assert.equal(admit({ run: otherRun, trustedIdentity: otherIdentity, credentialId: 'synthetic-key-1' }).reasonCode, DENY.BINDING_MISMATCH);
});

test('replacement: a new key authorizes only after the authoritative fence update', () => {
  const newAttempt = crypto.randomUUID();
  const newWorker = crypto.randomUUID();
  const advanced = run({ binding: { ...fixture.binding, attemptId: newAttempt, workerId: newWorker, writerFence: 2 } });
  const newIdentity = identity({ attemptId: newAttempt, workerId: newWorker, writerFence: 2 });
  const key2 = createCredentialRegistry([{ keyId: 'synthetic-key-2', grant: { ...fixture.credentialRegistry[0].grant, keyId: 'synthetic-key-2', binding: advanced.binding } }]);
  assert.equal(admit({ run: advanced, trustedIdentity: newIdentity, credentialId: 'synthetic-key-1' }).reasonCode, DENY.STALE_ATTEMPT);
  assert.equal(admit({ run: advanced, trustedIdentity: newIdentity, registry: key2, credentialId: 'synthetic-key-2' }).allowed, true);
});

test('fails closed on state lookup failure', () => {
  assert.equal(admit({ store: { failure: true } }).reasonCode, DENY.STATE_LOOKUP_FAILURE);
});

test('raw classifier accepts the supported synthetic text + local tool subset', () => {
  const parsed = parseAnthropicMessagesRequest(fixture.rawMessages, { allowedBetas: fixture.allowedBetas, pricingRevision: fixture.pricing.revision });
  assert.equal(parsed.allowed, true, JSON.stringify(parsed));
  assert.equal(isParsedMessagesRequest(parsed.request), true);
  assert.equal(admitMessagesFeatures(parsed.request).allowed, true);
  assert.ok(parsed.request.approxInputTokens > 0);
});

test('raw classifier denies dangerous fields from their actual raw representation', () => {
  const cases = [
    [{ body: { api_base: 'https://attacker.invalid' } }, DENY.ROUTING_OVERRIDE],
    [{ body: { model_id: 'other' } }, DENY.ROUTING_OVERRIDE],
    [{ headers: { 'x-litellm-model': 'attacker' } }, DENY.ROUTING_OVERRIDE],
    [{ body: { context_management: { edits: [{ type: 'unqualified' }] } } }, DENY.UNSUPPORTED_CONTEXT_MANAGEMENT],
    [{ body: { tools: [{ type: 'web_search_20250305', name: 'web_search' }] } }, DENY.UNSUPPORTED_SERVER_TOOL],
    [{ body: { thinking: { type: 'enabled', budget_tokens: 1024 } } }, DENY.UNSUPPORTED_THINKING],
    [{ body: { output_format: { type: 'json_schema' } } }, DENY.UNSUPPORTED_STRUCTURED_OUTPUT],
    [{ body: { speed: 'fast' } }, DENY.UNSUPPORTED_SPEED],
    [{ body: { container: 'c1' } }, DENY.UNSUPPORTED_CONTAINER],
    [{ body: { mcp_servers: [] } }, DENY.UNSUPPORTED_PROXY_MCP],
    [{ body: { unknown_field: 1 } }, DENY.UNKNOWN_FIELD],
    [{ headers: { 'anthropic-beta': 'context-1m-2025-08-07' } }, DENY.UNSUPPORTED_BETA],
    [{ headers: { 'content-type': 'text/plain' } }, DENY.MALFORMED_REQUEST],
  ];
  for (const [over, code] of cases) {
    const result = parseAnthropicMessagesRequest(raw(over), { allowedBetas: fixture.allowedBetas });
    assert.equal(result.allowed, false, JSON.stringify({ over, result }));
    assert.equal(result.reasonCode, code, JSON.stringify(over));
  }
});

test('raw classifier denies model/route/bounds violations and unbranded DTOs', () => {
  assert.equal(parseAnthropicMessagesRequest(raw({ body: { model: 'claude-sonnet-4-6' } }), { allowedBetas: [] }).reasonCode, DENY.MODEL_NOT_ALLOWED);
  assert.equal(parseAnthropicMessagesRequest(raw({ path: '/v1/messages/' }), { allowedBetas: [] }).reasonCode, DENY.ROUTE_NOT_ALLOWED);
  assert.equal(parseAnthropicMessagesRequest(raw({ method: 'GET' }), { allowedBetas: [] }).reasonCode, DENY.ROUTE_NOT_ALLOWED);
  const noMax = raw(); delete noMax.body.max_tokens;
  assert.equal(parseAnthropicMessagesRequest(noMax, { allowedBetas: [] }).reasonCode, DENY.MISSING_OUTPUT_BOUND);
  assert.equal(admitMessagesFeatures({ model: MODEL_ALIAS }).reasonCode, DENY.UNPARSED_DTO);
  assert.equal(estimateCostMicrousd({ pricing: fixture.pricing, request: { model: MODEL_ALIAS, maxOutputTokens: 1, approxInputTokens: 1, pricingRevision: fixture.pricing.revision } }).reasonCode, DENY.UNPARSED_DTO);
});

test('budget: two near-ceiling concurrent reservations cannot both cross the cap', () => {
  const ledger = createLedger();
  assert.equal(reserveBudget(ledger, 'req-a', 6_000_000).allowed, true);
  const second = reserveBudget(ledger, 'req-b', 5_000_000);
  assert.equal(second.allowed, false);
  assert.equal(second.reasonCode, DENY.OVER_BUDGET);
  assert.equal(committedMicrousd(ledger), 6_000_000);
});

test('budget: unknown/nonpositive estimates, duplicate IDs, stale pricing, failed store', () => {
  const ledger = createLedger();
  assert.equal(reserveBudget(ledger, 'req-x', 0).reasonCode, DENY.UNKNOWN_COST);
  assert.equal(reserveBudget(ledger, 'req-y', Number.NaN).reasonCode, DENY.UNKNOWN_COST);
  assert.equal(reserveBudget(ledger, 'req-dup', 1).allowed, true);
  assert.equal(reserveBudget(ledger, 'req-dup', 1).reasonCode, DENY.DUPLICATE_REQUEST);
  assert.equal(reserveBudget(ledger, 'req-store', 1, { store: { failure: true } }).reasonCode, DENY.STORE_UNAVAILABLE);
  const staleReq = parseAnthropicMessagesRequest(fixture.rawMessages, { allowedBetas: [], pricingRevision: 'old' }).request;
  assert.equal(estimateCostMicrousd({ pricing: fixture.pricing, request: staleReq }).reasonCode, DENY.STALE_PRICING);
});

test('budget: settlement never clamps real liability above the reserved bound', () => {
  const ledger = createLedger();
  reserveBudget(ledger, 'req-over', 100);
  const result = settleBudget(ledger, 'req-over', { outcome: 'success', actualCostMicrousd: 10000001 });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, DENY.LEDGER_BREACHED);
  assert.equal(ledger.consumedMicrousd, 10000001, 'real liability preserved, not clamped');
  assert.equal(ledger.breached, true);
  assert.equal(reserveBudget(ledger, 'req-later', 1).reasonCode, DENY.LEDGER_BREACHED);
});

test('budget: success above the reservation but under the ceiling surfaces OVER_RESERVED_BOUND and denies later dispatch', () => {
  const ledger = createLedger();
  reserveBudget(ledger, 'req-b', 1000);
  const result = settleBudget(ledger, 'req-b', { outcome: 'success', actualCostMicrousd: 5000 });
  assert.equal(result.reasonCode, DENY.OVER_RESERVED_BOUND);
  assert.equal(ledger.consumedMicrousd, 5000);
  assert.equal(reserveBudget(ledger, 'req-next', 1).reasonCode, DENY.LEDGER_BREACHED);
});

test('budget: an unresolved hold cannot later be released by an inconsistent outcome', () => {
  const ledger = createLedger();
  reserveBudget(ledger, 'req-u', 1000);
  assert.equal(settleBudget(ledger, 'req-u', { outcome: 'error_after_dispatch' }).reasonCode, DENY.RECONCILIATION_REQUIRED);
  assert.equal(committedMicrousd(ledger), 1000, 'unresolved hold retained');
  assert.equal(settleBudget(ledger, 'req-u', { outcome: 'pre_dispatch_rejection' }).reasonCode, DENY.INVALID_STATE);
  assert.equal(committedMicrousd(ledger), 1000, 'hold not silently released to zero');
});

test('budget: only explicit trustworthy reconciliation releases an unresolved hold', () => {
  const ledger = createLedger();
  reserveBudget(ledger, 'req-r', 1000);
  settleBudget(ledger, 'req-r', { outcome: 'unknown' });
  assert.equal(reconcileBudget(ledger, 'req-r', { evidence: { source: 'caller_label', actualCostMicrousd: 0 } }).reasonCode, DENY.RECONCILIATION_REQUIRED);
  assert.equal(reconcileBudget(ledger, 'req-r', { evidence: { source: 'provider_reconciliation', actualCostMicrousd: 400 } }).allowed, true);
  assert.equal(ledger.consumedMicrousd, 400);
  assert.equal(committedMicrousd(ledger), 400);
});

test('budget: duplicate settlement, process loss/TTL and reset attempts fail closed', () => {
  const ledger = createLedger();
  reserveBudget(ledger, 'req-d', 1000);
  settleBudget(ledger, 'req-d', { outcome: 'success', actualCostMicrousd: 700 });
  assert.equal(settleBudget(ledger, 'req-d', { outcome: 'success', actualCostMicrousd: 700 }).reasonCode, DENY.INVALID_STATE);
  reserveBudget(ledger, 'req-abandoned', 2_000_000);
  const before = committedMicrousd(ledger);
  assert.equal(expireReservations(ledger).expired, 1);
  assert.equal(committedMicrousd(ledger), before, 'TTL/process loss keeps the worst-case hold');
  assert.equal(settleBudget(ledger, 'req-abandoned', { outcome: 'success', actualCostMicrousd: 0 }).reasonCode, DENY.INVALID_STATE);
  assert.equal(attemptBudgetReset().reasonCode, DENY.RESET_FORBIDDEN);
});

test('budget: a resume with prior spend is bounded by the same aggregate ceiling', () => {
  const ledger = createLedger();
  ledger.consumedMicrousd = 9_500_000;
  const resumed = admit({ ledger, raw: raw({ body: { max_tokens: 64000 } }) });
  assert.equal(resumed.allowed, false);
  assert.equal(resumed.reasonCode, DENY.OVER_BUDGET);
});

test('stream: a valid synthetic sequence is the only success', () => {
  const good = [
    { type: 'message_start', usage: { input_tokens: 10 } },
    { type: 'content_block_start', index: 0, blockKind: 'text' },
    { type: 'content_block_delta', index: 0, deltaType: 'text_delta' },
    { type: 'content_block_stop', index: 0, blockKind: 'text' },
    { type: 'content_block_start', index: 1, blockKind: 'tool_use', name: 'local_echo', id: 'toolu_1' },
    { type: 'content_block_delta', index: 1, deltaType: 'input_json_delta', partial_json: '{"text":"hi"}' },
    { type: 'content_block_stop', index: 1, blockKind: 'tool_use' },
    { type: 'message_delta', usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  ];
  const result = validateStream(good);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.success, true);
  assert.deepEqual(result.completedToolBlocks, [1]);
});

test('stream: unfinished tool block, invalid tool JSON and truncation never expose a partial command', () => {
  const head = [
    { type: 'message_start', usage: { input_tokens: 10 } },
    { type: 'content_block_start', index: 0, blockKind: 'tool_use', name: 'local_echo', id: 'toolu_1' },
    { type: 'content_block_delta', index: 0, deltaType: 'input_json_delta', partial_json: '{"text":"hi"' },
  ];
  assert.equal(validateStream(head).reasonCode, DENY.STREAM_MISSING_TERMINAL);
  const badJson = [...head, { type: 'content_block_stop', index: 0, blockKind: 'tool_use' }, { type: 'message_delta', usage: { output_tokens: 1 } }, { type: 'message_stop' }];
  const result = validateStream(badJson);
  assert.equal(result.reasonCode, DENY.STREAM_TOOL_INPUT_INCOMPLETE_JSON);
  assert.deepEqual(result.completedToolBlocks, []);
  assert.equal(result.success, false);
});

test('stream: lifecycle, index, identity, usage and terminal invariants are enforced', () => {
  const start = { type: 'message_start', usage: { input_tokens: 10 } };
  const openText = { type: 'content_block_start', index: 0, blockKind: 'text' };
  const badUsage = [start, openText, { type: 'content_block_stop', index: 0, blockKind: 'text' }, { type: 'message_delta', usage: {} }, { type: 'message_stop' }];
  assert.equal(validateStream(badUsage).reasonCode, DENY.STREAM_INVALID_USAGE);
  const terminalBeforeUsage = [start, openText, { type: 'content_block_stop', index: 0, blockKind: 'text' }, { type: 'message_stop' }];
  assert.equal(validateStream(terminalBeforeUsage).reasonCode, DENY.STREAM_MISSING_USAGE);
  const openBlock = [start, openText, { type: 'message_delta', usage: { output_tokens: 1 } }, { type: 'message_stop' }];
  assert.equal(validateStream(openBlock).reasonCode, DENY.STREAM_OPEN_BLOCK);
  const dupIndex = [start, openText, { type: 'content_block_start', index: 0, blockKind: 'text' }];
  assert.equal(validateStream(dupIndex).reasonCode, DENY.STREAM_DUPLICATE_INDEX);
  const mismatch = [start, openText, { type: 'content_block_delta', index: 0, deltaType: 'input_json_delta', partial_json: '{}' }];
  assert.equal(validateStream(mismatch).reasonCode, DENY.STREAM_MISMATCH);
  const goodTail = [start, openText, { type: 'content_block_stop', index: 0, blockKind: 'text' }, { type: 'message_delta', usage: { output_tokens: 1 } }, { type: 'message_stop' }];
  assert.equal(validateStream([...goodTail, { type: 'message_stop' }]).reasonCode, DENY.STREAM_DUPLICATE_TERMINAL);
  assert.equal(validateStream([...goodTail, { type: 'content_block_start', index: 1, blockKind: 'text' }]).reasonCode, DENY.STREAM_EVENT_AFTER_TERMINAL);
  assert.equal(validateStream([start, { type: 'error' }]).reasonCode, DENY.STREAM_ERROR_AFTER_200);
  assert.equal(validateStream([{ type: 'content_block_delta', index: 0 }]).reasonCode, DENY.STREAM_MISSING_START);
  assert.equal(validateStream([start, openText, { type: 'content_block_stop', index: 0, blockKind: 'text' }, { type: 'message_delta', usage: { output_tokens: -1 } }]).reasonCode, DENY.STREAM_INVALID_USAGE);
  assert.equal(validateStream([start, openText, { type: 'cancelled' }]).reasonCode, DENY.STREAM_CANCELLED);
});

test('proxy-config.json enables message/error/key redaction and leaves callbacks empty', () => {
  const config = JSON.parse(readFileSync(new URL('../proxy-config.json', import.meta.url), 'utf8'));
  assert.equal(config.litellm_settings.turn_off_message_logging, true);
  assert.equal(config.litellm_settings.redact_messages_in_exceptions, true);
  assert.equal(config.litellm_settings.redact_user_api_key_info, true);
  assert.deepEqual(config.litellm_settings.callbacks, []);
  assert.equal(config.general_settings.fail_closed_budget_enforcement, true);
  assert.equal(config.general_settings.disable_budget_reservation, false);
  assert.equal(config.router_settings.num_retries, 0);
  assert.deepEqual(config.router_settings.fallbacks, []);
});
