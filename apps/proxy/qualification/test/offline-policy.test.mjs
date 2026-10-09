// Meri W02-02 offline policy tests (repaired v3).
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
  createCredentialRegistry, createLedger, createTrustedCountObservation,
  estimateCostMicrousd, expireReservations, isParsedMessagesRequest,
  parseAnthropicMessagesRequest, reconcileBudget, reserveBudget, settleBudget, validateStream,
} from '../offline-policy.mjs';
import { validateShape } from '../../../../packages/contracts/validate.mjs';

const fixture = JSON.parse(readFileSync(new URL('../policy.fixture.json', import.meta.url), 'utf8'));
const NOW = '2026-10-09T22:00:00Z';
const REV = fixture.pricing.revision;
const INPUT_TOKENS = 1000; // synthetic trusted count-observation value
const registry = createCredentialRegistry(fixture.credentialRegistry);

const identity = (over = {}) => ({ ...structuredClone(fixture.trustedIdentity), ...over });
const run = (over = {}) => ({ state: 'active', policyRevision: fixture.policyRevision, binding: structuredClone(fixture.binding), ...over });
const rawWith = (over = {}) => {
  const base = structuredClone(fixture.rawMessages);
  return { ...base, ...over, headers: { ...base.headers, ...(over.headers ?? {}) }, body: { ...base.body, ...(over.body ?? {}) } };
};
const obsFor = (raw, over = {}) => createTrustedCountObservation(raw, { inputTokens: INPUT_TOKENS, pricingRevision: REV, ...over });
const admit = (over = {}) => {
  const raw = over.raw ?? rawWith();
  const observation = over.observation ?? obsFor(raw);
  const { raw: _r, observation: _o, ...rest } = over;
  return admitModelRequest({
    now: NOW, registry, credentialId: 'synthetic-key-1', trustedIdentity: identity(), run: run(),
    raw, requestId: crypto.randomUUID(), ledger: createLedger(), pricing: fixture.pricing,
    observation, allowedBetas: fixture.allowedBetas, ...rest,
  });
};

test('fixture binding, budgets and every registry grant conform to the frozen 0.1.0 shapes', () => {
  validateShape('RunBinding', fixture.binding);
  validateShape('Budgets', fixture.budgets);
  for (const entry of fixture.credentialRegistry) validateShape('RunBinding', entry.grant.binding);
  assert.equal(fixture.budgets.maxCostMicrousd, QUALIFICATION_CEILING_MICROUSD);
  assert.equal(fixture.nativeTeamMaxBudgetUsd, 10);
});

test('parsed DTO is deep-frozen and its provenance is private (forged copies lose the brand)', () => {
  const raw = rawWith();
  const parsed = parseAnthropicMessagesRequest(raw, { allowedBetas: [], pricingRevision: REV });
  assert.equal(parsed.allowed, true);
  const dto = parsed.request;
  assert.equal(Object.isFrozen(dto), true);
  assert.equal(isParsedMessagesRequest(dto), true);
  assert.throws(() => { dto.maxOutputTokens = 1; });
  assert.throws(() => { dto.messages.push({ role: 'user', content: 'x' }); });
  const forged = { ...dto };
  assert.equal(isParsedMessagesRequest(forged), false);
  assert.equal(estimateCostMicrousd({ pricing: fixture.pricing, request: forged, observation: obsFor(raw) }).reasonCode, DENY.UNPARSED_DTO);
  assert.equal(admitMessagesFeatures(forged).reasonCode, DENY.UNPARSED_DTO);
});

test('credential registry is an immutable snapshot, not a caller reference', () => {
  const entries = structuredClone(fixture.credentialRegistry);
  const reg = createCredentialRegistry(entries);
  entries[0].grant.model = 'evil-model';
  entries[0].grant.binding.writerFence = 99;
  const grant = reg.lookup('synthetic-key-1');
  assert.equal(grant.model, MODEL_ALIAS);
  assert.equal(grant.binding.writerFence, 1);
  assert.equal(Object.isFrozen(grant), true);
  assert.equal(reg.lookup('not-registered'), null);
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

test('denies malformed grants/identities/bindings and fails closed on lookup failure', () => {
  const badGrant = createCredentialRegistry([{ keyId: 'bad-grant', grant: { keyId: 'bad-grant', model: MODEL_ALIAS, allowedRoutes: [MESSAGES_ROUTE], state: 'active', expiresAt: '2099-01-01T00:00:00Z', policyRevision: REV, binding: { tenantId: 'x' } } }]);
  assert.equal(admit({ registry: badGrant, credentialId: 'bad-grant' }).reasonCode, DENY.MALFORMED_GRANT);
  assert.equal(admit({ trustedIdentity: { source: 'broker' } }).reasonCode, DENY.MALFORMED_IDENTITY);
  assert.equal(admit({ run: run({ binding: {} }) }).reasonCode, DENY.MALFORMED_BINDING);
  assert.equal(admit({ store: { failure: true } }).reasonCode, DENY.STATE_LOOKUP_FAILURE);
  const throwing = { lookup() { throw new Error('store down'); } };
  assert.equal(admit({ registry: throwing }).reasonCode, DENY.STATE_LOOKUP_FAILURE);
});

test('denies empty, wildcard and mixed-route grants', () => {
  assert.equal(admit({ credentialId: 'synthetic-key-wildcard' }).reasonCode, DENY.MODEL_NOT_ALLOWED);
  const mk = (routes) => createCredentialRegistry([{ keyId: 'k', grant: { keyId: 'k', model: MODEL_ALIAS, allowedRoutes: routes, state: 'active', expiresAt: '2099-01-01T00:00:00Z', policyRevision: REV, binding: fixture.binding } }]);
  assert.equal(admit({ registry: mk([]), credentialId: 'k' }).reasonCode, DENY.ROUTE_NOT_ALLOWED);
  assert.equal(admit({ registry: mk([MESSAGES_ROUTE, '/v1/chat/completions']), credentialId: 'k' }).reasonCode, DENY.ROUTE_NOT_ALLOWED);
  assert.equal(admit({ registry: mk(['/v1/*']), credentialId: 'k' }).reasonCode, DENY.ROUTE_NOT_ALLOWED);
});

test('denies missing/untrusted caller identity and unknown headers; never trusts headers', () => {
  assert.equal(admit({ trustedIdentity: null }).reasonCode, DENY.MISSING_TRUSTED_IDENTITY);
  assert.equal(admit({ trustedIdentity: identity({ source: 'headers' }) }).reasonCode, DENY.UNTRUSTED_IDENTITY_SOURCE);
  assert.equal(admit({ raw: rawWith({ headers: { 'x-run-id': 'attacker' } }) }).reasonCode, DENY.UNKNOWN_HEADER);
});

test('denies inactive runs and stable-identity mismatch', () => {
  assert.equal(admit({ run: run({ state: 'cancelled' }) }).reasonCode, DENY.RUN_NOT_ACTIVE);
  assert.equal(admit({ trustedIdentity: identity({ tenantId: 'other' }) }).reasonCode, DENY.BINDING_MISMATCH);
  assert.equal(admit({ trustedIdentity: identity({ runId: crypto.randomUUID() }) }).reasonCode, DENY.BINDING_MISMATCH);
});

test('old key with a NEW genuine identity is denied; copied key on another task is denied', () => {
  const newAttempt = crypto.randomUUID();
  const newWorker = crypto.randomUUID();
  const advanced = run({ binding: { ...fixture.binding, attemptId: newAttempt, workerId: newWorker, writerFence: 2 } });
  const newIdentity = identity({ attemptId: newAttempt, workerId: newWorker, writerFence: 2 });
  assert.equal(admit({ run: advanced, trustedIdentity: newIdentity, credentialId: 'synthetic-key-old' }).reasonCode, DENY.STALE_ATTEMPT);
  const otherRunId = crypto.randomUUID();
  assert.equal(admit({ run: run({ binding: { ...fixture.binding, runId: otherRunId } }), trustedIdentity: identity({ runId: otherRunId }) }).reasonCode, DENY.BINDING_MISMATCH);
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

test('raw classifier accepts the supported text + local tool subset and treats tool payload as data', () => {
  const raw = rawWith({
    body: {
      messages: [
        { role: 'user', content: 'hello' },
        // coincidental dangerous field names inside LOCAL tool data must pass as data
        { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'local_echo', input: { api_base: 'x', type: 'thinking', cache_control: { type: 'ephemeral' } } }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'hi' }] },
      ],
      tools: [{ name: 'local_echo', input_schema: { type: 'object', properties: { api_base: { type: 'string' } } } }],
    },
  });
  const parsed = parseAnthropicMessagesRequest(raw, { allowedBetas: [], pricingRevision: REV });
  assert.equal(parsed.allowed, true, JSON.stringify(parsed));
  assert.equal(admitMessagesFeatures(parsed.request).allowed, true);
});

test('raw classifier denies nested thinking/cache/routing from their actual representation', () => {
  const cases = [
    [{ body: { system: [{ type: 'thinking', thinking: 'hidden', signature: 'invalid' }] } }, DENY.UNSUPPORTED_THINKING],
    [{ body: { system: [{ type: 'text', text: 'x', cache_control: { type: 'ephemeral', ttl: '1h' } }] } }, DENY.UNSUPPORTED_CACHE_CONTROL],
    [{ body: { tools: [{ name: 'local_echo', input_schema: { type: 'object' }, cache_control: { type: 'ephemeral' } }] } }, DENY.UNSUPPORTED_CACHE_CONTROL],
    [{ body: { messages: [{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: [{ type: 'thinking', thinking: 'x' }] }] }] } }, DENY.UNSUPPORTED_THINKING],
    [{ body: { messages: [{ role: 'user', content: [{ type: 'text', text: 'x', cache_control: { type: 'ephemeral' } }] }] } }, DENY.UNSUPPORTED_CACHE_CONTROL],
    [{ body: { messages: [{ role: 'user', api_base: 'https://attacker.invalid', content: 'x' }] } }, DENY.ROUTING_OVERRIDE],
    [{ body: { messages: [{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'ok', routing_override: true }] }] } }, DENY.ROUTING_OVERRIDE],
    [{ body: { messages: [{ role: 'user', content: [{ type: 'text', text: 'x', unknown: 1 }] }] } }, DENY.UNKNOWN_FIELD],
    [{ body: { tools: [{ name: 'web_search', type: 'web_search_20250305' }] } }, DENY.UNSUPPORTED_SERVER_TOOL],
    [{ body: { thinking: { type: 'enabled', budget_tokens: 1024 } } }, DENY.UNSUPPORTED_THINKING],
    [{ body: { context_management: { edits: [{ type: 'x' }] } } }, DENY.UNSUPPORTED_CONTEXT_MANAGEMENT],
    [{ body: { unknown_field: 1 } }, DENY.UNKNOWN_FIELD],
    [{ body: { tool_choice: { type: 'auto', cache_control: {} } } }, DENY.UNKNOWN_FIELD],
    [{ headers: { 'anthropic-beta': 'context-1m-2025-08-07' } }, DENY.UNSUPPORTED_BETA],
    [{ body: { metadata: { tenant: 'x' } } }, DENY.UNKNOWN_FIELD],
  ];
  for (const [over, code] of cases) {
    const result = parseAnthropicMessagesRequest(rawWith(over), { allowedBetas: [], pricingRevision: REV });
    assert.equal(result.allowed, false, JSON.stringify({ over, result }));
    assert.equal(result.reasonCode, code, JSON.stringify(over));
  }
});

test('raw classifier denies model/route/bounds and malformed scalars', () => {
  assert.equal(parseAnthropicMessagesRequest(rawWith({ body: { model: 'claude-sonnet-4-6' } }), { allowedBetas: [], pricingRevision: REV }).reasonCode, DENY.MODEL_NOT_ALLOWED);
  assert.equal(parseAnthropicMessagesRequest(rawWith({ path: '/v1/messages/' }), { allowedBetas: [], pricingRevision: REV }).reasonCode, DENY.ROUTE_NOT_ALLOWED);
  const noMax = rawWith(); delete noMax.body.max_tokens;
  assert.equal(parseAnthropicMessagesRequest(noMax, { allowedBetas: [], pricingRevision: REV }).reasonCode, DENY.MISSING_OUTPUT_BOUND);
  assert.equal(parseAnthropicMessagesRequest(rawWith({ body: { temperature: 2 } }), { allowedBetas: [], pricingRevision: REV }).reasonCode, DENY.MALFORMED_REQUEST);
  assert.equal(parseAnthropicMessagesRequest(rawWith({ body: { stream: 'yes' } }), { allowedBetas: [], pricingRevision: REV }).reasonCode, DENY.MALFORMED_REQUEST);
});

test('trusted count observation is required and bound to the exact classified raw request', () => {
  const raw = rawWith();
  const parsed = parseAnthropicMessagesRequest(raw, { allowedBetas: [], pricingRevision: REV });
  const request = parsed.request;
  const direct = (over = {}) => admitModelRequest({
    now: NOW, registry, credentialId: 'synthetic-key-1', trustedIdentity: identity(), run: run(),
    raw, requestId: crypto.randomUUID(), ledger: createLedger(), pricing: fixture.pricing, ...over,
  });
  assert.equal(direct({ observation: undefined }).reasonCode, DENY.MISSING_COUNT_OBSERVATION);
  assert.equal(estimateCostMicrousd({ pricing: fixture.pricing, request, observation: obsFor(raw, { source: 'wire_claim' }) }).reasonCode, DENY.UNTRUSTED_COUNT_SOURCE);
  assert.equal(estimateCostMicrousd({ pricing: fixture.pricing, request, observation: obsFor(rawWith({ headers: { 'anthropic-version': '2024-01-01' } })) }).reasonCode, DENY.COUNT_BOUND_MISMATCH);
  assert.equal(estimateCostMicrousd({ pricing: fixture.pricing, request, observation: obsFor(raw, { pricingRevision: 'old' }) }).reasonCode, DENY.STALE_PRICING);
  const boundMismatch = obsFor(rawWith({ body: { max_tokens: 999 } }));
  assert.equal(estimateCostMicrousd({ pricing: fixture.pricing, request, observation: boundMismatch }).reasonCode, DENY.COUNT_BOUND_MISMATCH);
  assert.equal(estimateCostMicrousd({ pricing: fixture.pricing, request, observation: obsFor(raw, { inputTokens: 999999 }) }).reasonCode, DENY.OVERSIZE_INPUT);
  const bigOut = parseAnthropicMessagesRequest(rawWith({ body: { max_tokens: 100000 } }), { allowedBetas: [], pricingRevision: REV }).request;
  assert.equal(estimateCostMicrousd({ pricing: fixture.pricing, request: bigOut, observation: obsFor(rawWith({ body: { max_tokens: 100000 } })) }).reasonCode, DENY.OVERSIZE_OUTPUT);
  const badRates = { ...fixture.pricing, models: { [MODEL_ALIAS]: { ...fixture.pricing.models[MODEL_ALIAS], inputPerMTok: -1 } } };
  assert.equal(estimateCostMicrousd({ pricing: badRates, request, observation: obsFor(raw) }).reasonCode, DENY.UNKNOWN_COST);
  assert.equal(estimateCostMicrousd({ pricing: fixture.pricing, request, observation: obsFor(raw) }).allowed, true);
});

test('budget: two near-ceiling concurrent reservations cannot both cross the cap', () => {
  const ledger = createLedger();
  assert.equal(reserveBudget(ledger, 'req-a', 6_000_000).allowed, true);
  const second = reserveBudget(ledger, 'req-b', 5_000_000);
  assert.equal(second.allowed, false);
  assert.equal(second.reasonCode, DENY.OVER_BUDGET);
  assert.equal(committedMicrousd(ledger), 6_000_000);
});

test('budget: reconciliation compares real actual to reservation AND combined committed (repro)', () => {
  const ledger = createLedger();
  reserveBudget(ledger, 'first', 5_000_000);
  reserveBudget(ledger, 'second', 5_000_000);
  assert.equal(settleBudget(ledger, 'first', { outcome: 'error_after_dispatch' }).reasonCode, DENY.RECONCILIATION_REQUIRED);
  const rec = reconcileBudget(ledger, 'first', { evidence: { source: 'provider_reconciliation', actualCostMicrousd: 6_000_000 } });
  assert.equal(rec.allowed, false);
  assert.equal(rec.reasonCode, DENY.LEDGER_BREACHED);
  assert.equal(ledger.breached, true);
  assert.equal(committedMicrousd(ledger), 11_000_000, 'real liability preserved (6M consumed + 5M hold)');
  assert.equal(reserveBudget(ledger, 'later', 1).reasonCode, DENY.LEDGER_BREACHED);
});

test('budget: settlement above the reservation but under the ceiling breaches and denies later dispatch', () => {
  const ledger = createLedger();
  reserveBudget(ledger, 'req-b', 100);
  const result = settleBudget(ledger, 'req-b', { outcome: 'success', actualCostMicrousd: 5000 });
  assert.equal(result.reasonCode, DENY.OVER_RESERVED_BOUND);
  assert.equal(ledger.consumedMicrousd, 5000);
  assert.equal(ledger.breached, true);
  assert.equal(reserveBudget(ledger, 'req-next', 1).reasonCode, DENY.LEDGER_BREACHED);
});

test('budget: safe-zero settlement is allowed and exact', () => {
  const ledger = createLedger();
  reserveBudget(ledger, 'req-zero', 100);
  const result = settleBudget(ledger, 'req-zero', { outcome: 'success', actualCostMicrousd: 0 });
  assert.equal(result.allowed, true, JSON.stringify(result));
  assert.equal(ledger.consumedMicrousd, 0);
  assert.equal(committedMicrousd(ledger), 0);
});

test('budget: overflow is refused and keeps the hold; duplicates and inconsistent outcomes fail closed', () => {
  const l1 = createLedger();
  reserveBudget(l1, 'req-o', 1);
  l1.consumedMicrousd = Number.MAX_SAFE_INTEGER;
  assert.equal(settleBudget(l1, 'req-o', { outcome: 'success', actualCostMicrousd: 1 }).reasonCode, DENY.OVERFLOW);
  assert.equal(l1.reservations.get('req-o').state, 'unresolved');
  const l2 = createLedger();
  reserveBudget(l2, 'req-d', 1000);
  settleBudget(l2, 'req-d', { outcome: 'success', actualCostMicrousd: 700 });
  assert.equal(settleBudget(l2, 'req-d', { outcome: 'success', actualCostMicrousd: 700 }).reasonCode, DENY.INVALID_STATE);
  const l3 = createLedger();
  reserveBudget(l3, 'req-u', 1000);
  assert.equal(settleBudget(l3, 'req-u', { outcome: 'error_after_dispatch' }).reasonCode, DENY.RECONCILIATION_REQUIRED);
  assert.equal(settleBudget(l3, 'req-u', { outcome: 'pre_dispatch_rejection' }).reasonCode, DENY.INVALID_STATE);
  assert.equal(committedMicrousd(l3), 1000, 'unresolved hold not released by an inconsistent outcome');
});

test('budget: only explicit trustworthy reconciliation releases a hold; TTL and resets fail closed', () => {
  const ledger = createLedger();
  reserveBudget(ledger, 'req-r', 1000);
  settleBudget(ledger, 'req-r', { outcome: 'unknown' });
  assert.equal(reconcileBudget(ledger, 'req-r', { evidence: { source: 'caller_label', actualCostMicrousd: 0 } }).reasonCode, DENY.RECONCILIATION_REQUIRED);
  assert.equal(reconcileBudget(ledger, 'req-r', { evidence: { source: 'provider_reconciliation', actualCostMicrousd: 400 } }).allowed, true);
  assert.equal(ledger.consumedMicrousd, 400);
  reserveBudget(ledger, 'req-abandoned', 2_000_000);
  const before = committedMicrousd(ledger);
  assert.equal(expireReservations(ledger).expired, 1);
  assert.equal(committedMicrousd(ledger), before, 'TTL/process loss keeps the worst-case hold');
  assert.equal(settleBudget(ledger, 'req-abandoned', { outcome: 'success', actualCostMicrousd: 0 }).reasonCode, DENY.INVALID_STATE);
  assert.equal(attemptBudgetReset().reasonCode, DENY.RESET_FORBIDDEN);
});

test('budget: unknown/nonpositive estimates, duplicate IDs, stale pricing and failed store', () => {
  const ledger = createLedger();
  assert.equal(reserveBudget(ledger, 'req-x', 0).reasonCode, DENY.UNKNOWN_COST);
  assert.equal(reserveBudget(ledger, 'req-y', Number.NaN).reasonCode, DENY.UNKNOWN_COST);
  assert.equal(reserveBudget(ledger, 'req-dup', 1).allowed, true);
  assert.equal(reserveBudget(ledger, 'req-dup', 1).reasonCode, DENY.DUPLICATE_REQUEST);
  assert.equal(reserveBudget(ledger, 'req-store', 1, { store: { failure: true } }).reasonCode, DENY.STORE_UNAVAILABLE);
});

test('budget: a resume with prior spend is bounded by the same aggregate ceiling', () => {
  const ledger = createLedger();
  ledger.consumedMicrousd = 9_500_000;
  const resumed = admit({ ledger, raw: rawWith({ body: { max_tokens: 64000 } }) });
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
  assert.deepEqual(result.completedToolBlocks, [1]);
});

test('stream: unfinished tool block and invalid tool JSON never expose a partial command', () => {
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
  const goodTail = [start, openText, { type: 'content_block_stop', index: 0, blockKind: 'text' }, { type: 'message_delta', usage: { output_tokens: 1 } }, { type: 'message_stop' }];
  assert.equal(validateStream([start, openText, { type: 'content_block_stop', index: 0, blockKind: 'text' }, { type: 'message_delta', usage: {} }, { type: 'message_stop' }]).reasonCode, DENY.STREAM_INVALID_USAGE);
  assert.equal(validateStream([start, openText, { type: 'content_block_stop', index: 0, blockKind: 'text' }, { type: 'message_stop' }]).reasonCode, DENY.STREAM_MISSING_USAGE);
  assert.equal(validateStream([start, openText, { type: 'message_delta', usage: { output_tokens: 1 } }, { type: 'message_stop' }]).reasonCode, DENY.STREAM_OPEN_BLOCK);
  assert.equal(validateStream([start, openText, { type: 'content_block_start', index: 0, blockKind: 'text' }]).reasonCode, DENY.STREAM_DUPLICATE_INDEX);
  assert.equal(validateStream([start, openText, { type: 'content_block_delta', index: 0, deltaType: 'input_json_delta', partial_json: '{}' }]).reasonCode, DENY.STREAM_MISMATCH);
  assert.equal(validateStream([...goodTail, { type: 'message_stop' }]).reasonCode, DENY.STREAM_DUPLICATE_TERMINAL);
  assert.equal(validateStream([...goodTail, { type: 'content_block_start', index: 1, blockKind: 'text' }]).reasonCode, DENY.STREAM_EVENT_AFTER_TERMINAL);
  assert.equal(validateStream([start, { type: 'error' }]).reasonCode, DENY.STREAM_ERROR_AFTER_200);
  assert.equal(validateStream([{ type: 'content_block_delta', index: 0 }]).reasonCode, DENY.STREAM_MISSING_START);
  assert.equal(validateStream([start, openText, { type: 'content_block_stop', index: 0, blockKind: 'text' }, { type: 'message_delta', usage: { output_tokens: -1 } }]).reasonCode, DENY.STREAM_INVALID_USAGE);
  assert.equal(validateStream([start, openText, { type: 'cancelled' }]).reasonCode, DENY.STREAM_CANCELLED);
});

test('stream: a completed tool stays private on later error, cancellation, truncation or invalid terminal', () => {
  const completed = [
    { type: 'message_start', usage: { input_tokens: 10 } },
    { type: 'content_block_start', index: 0, blockKind: 'tool_use', name: 'local_echo', id: 'toolu_1' },
    { type: 'content_block_delta', index: 0, deltaType: 'input_json_delta', partial_json: '{"text":"hi"}' },
    { type: 'content_block_stop', index: 0, blockKind: 'tool_use' },
  ];
  const terminal = [{ type: 'message_delta', usage: { output_tokens: 5 } }, { type: 'message_stop' }];
  for (const tail of [
    [{ type: 'error' }], [{ type: 'cancelled' }], [],
    [...terminal, { type: 'message_stop' }],
    [{ type: 'message_delta', usage: {} }, { type: 'message_stop' }],
  ]) {
    const result = validateStream([...completed, ...tail]);
    assert.equal(result.success, false, JSON.stringify(tail));
    assert.deepEqual(result.completedToolBlocks, [], JSON.stringify(tail));
  }
  assert.deepEqual(validateStream([...completed, ...terminal]).completedToolBlocks, [0]);
});

test('proxy-config.json enables redaction and leaves callbacks empty', () => {
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
