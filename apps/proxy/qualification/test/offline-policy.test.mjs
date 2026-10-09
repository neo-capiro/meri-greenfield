// Meri W02-02 offline policy tests.
//
// Fully offline: no socket, no AWS/model/proxy/DB, synthetic keys/identity/
// events/pricing only. These tests exercise the local reference model and prove
// NOTHING about deployed proxy or authentication behaviour.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DENY,
  MODEL_ALIAS,
  MESSAGES_ROUTE,
  QUALIFICATION_CEILING_MICROUSD,
  admitMessagesFeatures,
  admitModelRequest,
  attemptBudgetReset,
  committedMicrousd,
  createLedger,
  estimateCostMicrousd,
  expireReservations,
  reserveBudget,
  settleBudget,
  validateStream,
} from '../offline-policy.mjs';
import { validateShape } from '../../../../packages/contracts/validate.mjs';

const fixture = JSON.parse(readFileSync(new URL('../policy.fixture.json', import.meta.url), 'utf8'));
const NOW = '2026-10-09T20:00:00Z';

const key = (over = {}) => ({ ...structuredClone(fixture.key), ...over });
const identity = (over = {}) => ({ ...structuredClone(fixture.trustedIdentity), ...over });
const run = (over = {}) => ({
  state: 'active',
  policyRevision: fixture.policyRevision,
  binding: structuredClone(fixture.binding),
  ...over,
});
const request = (over = {}) => ({ ...structuredClone(fixture.request), requestId: crypto.randomUUID(), ...over });

const admit = (over = {}) => admitModelRequest({
  now: NOW,
  key: key(),
  trustedIdentity: identity(),
  run: run(),
  request: request(),
  ledger: createLedger(),
  pricing: fixture.pricing,
  allowedBetas: fixture.allowedBetas,
  ...over,
});

test('fixture binding and budgets conform to the frozen 0.1.0 contract shapes', () => {
  validateShape('RunBinding', fixture.binding);
  validateShape('Budgets', fixture.budgets);
  // The grant references those shapes only; it adds no action, audience or field.
  assert.equal(fixture.budgets.maxCostMicrousd, QUALIFICATION_CEILING_MICROUSD);
  assert.equal(fixture.nativeTeamMaxBudgetUsd, 10);
});

test('admits a well-formed request and reserves worst-case cost', () => {
  const result = admit();
  assert.equal(result.allowed, true, JSON.stringify(result));
  assert.ok(Number.isSafeInteger(result.reservedMicrousd) && result.reservedMicrousd > 0);
});

test('denies absent, unknown, expired and revoked keys', () => {
  assert.equal(admit({ key: null }).reasonCode, DENY.MISSING_KEY);
  assert.equal(admit({ key: key({ state: 'unknown' }) }).reasonCode, DENY.UNKNOWN_KEY);
  assert.equal(admit({ key: key({ expiresAt: '2026-10-09T19:59:59Z' }) }).reasonCode, DENY.KEY_EXPIRED);
  assert.equal(admit({ key: key({ revoked: true }) }).reasonCode, DENY.KEY_REVOKED);
});

test('denies missing trusted identity and never trusts caller headers', () => {
  assert.equal(admit({ trustedIdentity: null }).reasonCode, DENY.MISSING_TRUSTED_IDENTITY);
  // A stolen key plus matching, self-asserted header metadata cannot authorize.
  assert.equal(admit({ trustedIdentity: identity({ source: 'headers' }) }).reasonCode, DENY.UNTRUSTED_IDENTITY_SOURCE);
});

test('denies tenant/actor/conversation/run mismatch and stale attempt/worker/fence/policy', () => {
  assert.equal(admit({ trustedIdentity: identity({ tenantId: 'other' }) }).reasonCode, DENY.BINDING_MISMATCH);
  assert.equal(admit({ trustedIdentity: identity({ runId: crypto.randomUUID() }) }).reasonCode, DENY.BINDING_MISMATCH);
  assert.equal(admit({ trustedIdentity: identity({ attemptId: crypto.randomUUID() }) }).reasonCode, DENY.STALE_ATTEMPT);
  assert.equal(admit({ trustedIdentity: identity({ workerId: crypto.randomUUID() }) }).reasonCode, DENY.STALE_WORKER);
  assert.equal(admit({ trustedIdentity: identity({ writerFence: 2 }) }).reasonCode, DENY.STALE_FENCE);
  assert.equal(admit({ trustedIdentity: identity({ policyRevision: 'policy-old' }) }).reasonCode, DENY.STALE_POLICY_REVISION);
});

test('denies inactive or cancelled runs', () => {
  assert.equal(admit({ run: run({ state: 'cancelled' }) }).reasonCode, DENY.RUN_NOT_ACTIVE);
  assert.equal(admit({ run: run({ state: 'inactive' }) }).reasonCode, DENY.RUN_NOT_ACTIVE);
});

test('denies alternate model/route variants and unknown routes', () => {
  assert.equal(admit({ request: request({ model: 'claude-sonnet-4-6' }) }).reasonCode, DENY.MODEL_NOT_ALLOWED);
  assert.equal(admit({ request: request({ route: '/v1/messages/' }) }).reasonCode, DENY.ROUTE_NOT_ALLOWED);
  assert.equal(admit({ request: request({ route: '/v1/messages%2F..%2Fkey/generate' }) }).reasonCode, DENY.ROUTE_NOT_ALLOWED);
  assert.equal(admit({ request: request({ method: 'GET' }) }).reasonCode, DENY.ROUTE_NOT_ALLOWED);
  assert.equal(admit({ request: request({ route: '/v1/chat/completions' }) }).reasonCode, DENY.ROUTE_NOT_ALLOWED);
  assert.equal(admit({ key: key({ allowedRoutes: [] }), request: request({ route: MESSAGES_ROUTE }) }).reasonCode, DENY.ROUTE_NOT_ALLOWED);
});

test('fails closed on state lookup failure', () => {
  assert.equal(admit({ store: { failure: true } }).reasonCode, DENY.STATE_LOOKUP_FAILURE);
});

test('replacement: new worker needs a new key after the authoritative fence update', () => {
  const newAttempt = crypto.randomUUID();
  const newWorker = crypto.randomUUID();
  // Old key + old identity still valid before TTL, but binding has advanced.
  const advanced = run({ binding: { ...fixture.binding, attemptId: newAttempt, workerId: newWorker, writerFence: 2 } });
  assert.equal(admit({ run: advanced, trustedIdentity: identity() }).reasonCode, DENY.STALE_ATTEMPT);
  // After the authoritative update the NEW identity + NEW key are admitted.
  const updated = admit({
    run: advanced,
    trustedIdentity: identity({ attemptId: newAttempt, workerId: newWorker, writerFence: 2 }),
    key: key({ keyId: 'synthetic-key-2' }),
  });
  assert.equal(updated.allowed, true, JSON.stringify(updated));
});

test('feature admission rejects unqualified Messages features before translation', () => {
  const base = request();
  assert.equal(admitMessagesFeatures({ ...base, betas: ['context-1m-2025-08-07'] }, { allowedBetas: [] }).reasonCode, DENY.UNSUPPORTED_BETA);
  assert.equal(admitMessagesFeatures({ ...base, hasContextManagement: true }).reasonCode, DENY.UNSUPPORTED_CONTEXT_MANAGEMENT);
  assert.equal(admitMessagesFeatures({ ...base, hasStructuredOutput: true }).reasonCode, DENY.UNSUPPORTED_STRUCTURED_OUTPUT);
  assert.equal(admitMessagesFeatures({ ...base, speed: 'fast' }).reasonCode, DENY.UNSUPPORTED_SPEED);
  assert.equal(admitMessagesFeatures({ ...base, container: 'c1' }).reasonCode, DENY.UNSUPPORTED_CONTAINER);
  assert.equal(admitMessagesFeatures({ ...base, serverTools: ['web_search'] }).reasonCode, DENY.UNSUPPORTED_SERVER_TOOL);
  assert.equal(admitMessagesFeatures({ ...base, proxyMcp: true }).reasonCode, DENY.UNSUPPORTED_PROXY_MCP);
  assert.equal(admitMessagesFeatures({ ...base, apiBaseOverride: true }).reasonCode, DENY.ROUTING_OVERRIDE);
  assert.equal(admitMessagesFeatures({ ...base, credentialOverride: true }).reasonCode, DENY.ROUTING_OVERRIDE);
  assert.equal(admitMessagesFeatures({ ...base, modelIdOverride: true }).reasonCode, DENY.ROUTING_OVERRIDE);
  assert.equal(admitMessagesFeatures({ ...base, helperModel: 'claude-haiku' }).reasonCode, DENY.UNAPPROVED_HELPER_MODEL);
  assert.equal(admitMessagesFeatures(base, { allowedBetas: [] }).allowed, true);
});

test('budget: two near-ceiling concurrent reservations cannot both cross the cap', () => {
  const ledger = createLedger();
  assert.equal(reserveBudget(ledger, 'req-a', 6_000_000).allowed, true);
  const second = reserveBudget(ledger, 'req-b', 5_000_000);
  assert.equal(second.allowed, false);
  assert.equal(second.reasonCode, DENY.OVER_BUDGET);
  assert.equal(committedMicrousd(ledger), 6_000_000);
});

test('budget: unknown or nonpositive estimates never create a reservation', () => {
  const ledger = createLedger();
  assert.equal(reserveBudget(ledger, 'req-x', 0).reasonCode, DENY.UNKNOWN_COST);
  assert.equal(reserveBudget(ledger, 'req-y', Number.NaN).reasonCode, DENY.UNKNOWN_COST);
  assert.equal(committedMicrousd(ledger), 0);
  assert.equal(estimateCostMicrousd({ pricing: fixture.pricing, request: request({ model: 'unknown-model' }) }).reasonCode, DENY.UNKNOWN_COST);
});

test('budget: cache-write is charged above an input-only estimate', () => {
  const withCache = estimateCostMicrousd({
    pricing: fixture.pricing,
    request: request({ cacheWriteTokens: 2000 }),
  });
  assert.equal(withCache.allowed, true);
  assert.ok(withCache.costMicrousd > withCache.worstCaseInputOnlyMicrousd);
});

test('budget: missing output cap and oversize input/output are denied', () => {
  assert.equal(estimateCostMicrousd({ pricing: fixture.pricing, request: request({ maxOutputTokens: null }) }).reasonCode, DENY.MISSING_OUTPUT_BOUND);
  assert.equal(estimateCostMicrousd({ pricing: fixture.pricing, request: request({ inputTokens: 500000 }) }).reasonCode, DENY.OVERSIZE_INPUT);
  assert.equal(estimateCostMicrousd({ pricing: fixture.pricing, request: request({ maxOutputTokens: 100000 }) }).reasonCode, DENY.OVERSIZE_OUTPUT);
});

test('budget: duplicate request IDs and stale pricing are denied', () => {
  const ledger = createLedger();
  assert.equal(reserveBudget(ledger, 'req-dup', 1).allowed, true);
  assert.equal(reserveBudget(ledger, 'req-dup', 1).reasonCode, DENY.DUPLICATE_REQUEST);
  assert.equal(estimateCostMicrousd({ pricing: fixture.pricing, request: request({ pricingRevision: 'old' }) }).reasonCode, DENY.STALE_PRICING);
});

test('budget: a resume with prior spend is bounded by the same aggregate ceiling', () => {
  const ledger = createLedger();
  ledger.consumedMicrousd = 9_500_000; // prior attempts already spent
  const resumed = admit({ ledger, request: request({ inputTokens: 100000, maxOutputTokens: 64000 }) });
  assert.equal(resumed.allowed, false);
  assert.equal(resumed.reasonCode, DENY.OVER_BUDGET);
});

test('settlement retains an unresolved hold for ambiguous outcomes', () => {
  const ledger = createLedger();
  reserveBudget(ledger, 'req-success', 1000);
  settleBudget(ledger, 'req-success', { outcome: 'success', actualCostMicrousd: 700 });
  assert.equal(ledger.consumedMicrousd, 700);
  assert.equal(committedMicrousd(ledger), 700);

  reserveBudget(ledger, 'req-no-cost', 1000);
  settleBudget(ledger, 'req-no-cost', { outcome: 'success', actualCostMicrousd: null });
  assert.equal(committedMicrousd(ledger), 1700, 'missing actual_cost keeps the reserved upper bound');

  reserveBudget(ledger, 'req-error', 1000);
  settleBudget(ledger, 'req-error', { outcome: 'error_after_dispatch' });
  assert.equal(committedMicrousd(ledger), 2700);

  reserveBudget(ledger, 'req-reject', 1000);
  settleBudget(ledger, 'req-reject', { outcome: 'pre_dispatch_rejection' });
  assert.equal(committedMicrousd(ledger), 2700, 'pre-dispatch rejection releases cleanly');
});

test('process loss / TTL expiry converts an outstanding hold into a retained unresolved hold', () => {
  const ledger = createLedger();
  reserveBudget(ledger, 'req-abandoned', 2_000_000);
  const before = committedMicrousd(ledger);
  const { expired } = expireReservations(ledger);
  assert.equal(expired, 1);
  assert.equal(ledger.reservations.get('req-abandoned').state, 'unresolved');
  assert.equal(committedMicrousd(ledger), before, 'the worst-case hold is not silently dropped');
});

test('a failed reservation store and an attempted budget reset both fail closed', () => {
  assert.equal(admit({ store: { failure: true } }).reasonCode, DENY.STATE_LOOKUP_FAILURE);
  assert.equal(attemptBudgetReset().allowed, false);
  assert.equal(attemptBudgetReset().reasonCode, DENY.RESET_FORBIDDEN);
});

test('stream: valid synthetic sequence is the only success', () => {
  const good = [
    { type: 'message_start' },
    { type: 'content_block_start', index: 0 },
    { type: 'content_block_delta', index: 0, deltaType: 'text_delta' },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, blockKind: 'tool_use' },
    { type: 'content_block_delta', index: 1, deltaType: 'input_json_delta', blockKind: 'tool_use' },
    { type: 'content_block_stop', index: 1, blockKind: 'tool_use' },
    { type: 'message_delta', usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  ];
  const result = validateStream(good);
  assert.equal(result.ok, true);
  assert.equal(result.success, true);
  assert.deepEqual(result.completedToolBlocks, [1]);
});

test('stream: semantic failures stay visible and never mark success', () => {
  const head = [{ type: 'message_start' }, { type: 'content_block_start', index: 0 }];
  assert.equal(validateStream([...head, { type: 'error' }]).reasonCode, DENY.STREAM_ERROR_AFTER_200);
  assert.equal(validateStream(head).reasonCode, DENY.STREAM_MISSING_TERMINAL);
  assert.equal(validateStream([{ type: 'content_block_delta', index: 0 }]).reasonCode, DENY.STREAM_MISSING_START);
  assert.equal(validateStream([...head, { type: 'content_block_delta', index: 9 }]).reasonCode, DENY.STREAM_OUT_OF_ORDER);
  assert.equal(validateStream([...head, { type: 'content_block_delta', index: 0, deltaType: 'input_json_delta', blockKind: 'text' }]).reasonCode, DENY.STREAM_TOOL_DELTA_BEFORE_BLOCK);
  assert.equal(validateStream([...head, { type: 'content_block_stop', index: 0 }, { type: 'message_stop' }]).reasonCode, DENY.STREAM_MISSING_USAGE);
  assert.equal(validateStream([...head, { type: 'cancelled' }]).reasonCode, DENY.STREAM_CANCELLED);
  for (const bad of [
    [...head, { type: 'error' }],
    head,
    [...head, { type: 'content_block_stop', index: 0 }, { type: 'message_stop' }],
  ]) {
    assert.equal(validateStream(bad).success, false);
  }
});
