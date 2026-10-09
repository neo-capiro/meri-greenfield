// Meri W02-02 offline admission / budget policy reference (repaired).
//
// PURPOSE AND HONEST SCOPE
// ------------------------
// PURE, OFFLINE, DETERMINISTIC reference for the *missing application-level
// invariants* LiteLLM's native virtual-key auth does NOT supply: authenticated
// task/run binding, current-run/fence/policy checks, a strict raw Messages
// classifier, safe-integer microUSD worst-case budget holds, and synthetic
// stream validation. It is a TEST REFERENCE ONLY.
//
// It is NOT a deployed auth service, broker, token issuer, ledger or gateway, and
// NOT a production HTTP/SSE/provider translator. It opens no socket, contacts no
// AWS/model/proxy/DB and holds no secret. Passing its tests establishes NOTHING
// about deployed proxy behaviour or real authentication.
//
// `trustedIdentity.source === 'broker'` is FIXTURE PROVENANCE ONLY: the string is
// not an authenticator. In production the trusted task observation must arrive
// over an authenticated channel from the broker; caller headers and the
// caller-supplied key object are attribution only and are never treated as the
// grant. Cost figures are SYNTHETIC and explicitly NOT current Bedrock prices.

import { validateShape } from '../../../packages/contracts/validate.mjs';

export const QUALIFICATION_CEILING_MICROUSD = 10_000_000; // $10 aggregate, all tasks/attempts/resumes/concurrent
export const NATIVE_TEAM_MAX_BUDGET_USD = 10; // one non-resetting LiteLLM team budget covering every task key
export const MODEL_ALIAS = 'meri-sonnet-qualification';
export const MESSAGES_ROUTE = '/v1/messages';
export const MESSAGES_METHOD = 'POST';
export const NATIVE_MODEL_ID = 'us.anthropic.claude-sonnet-4-6';
export const UPSTREAM_MODEL = 'bedrock/invoke/us.anthropic.claude-sonnet-4-6';
export const AWS_REGION = 'us-east-1';

export const DENY = Object.freeze({
  MISSING_KEY: 'missing_key',
  UNKNOWN_KEY: 'unknown_key',
  KEY_EXPIRED: 'key_expired',
  KEY_REVOKED: 'key_revoked',
  MALFORMED_GRANT: 'malformed_grant',
  MALFORMED_IDENTITY: 'malformed_identity',
  MALFORMED_BINDING: 'malformed_binding',
  MISSING_TRUSTED_IDENTITY: 'missing_trusted_identity',
  UNTRUSTED_IDENTITY_SOURCE: 'untrusted_identity_source',
  BINDING_MISMATCH: 'binding_mismatch',
  RUN_NOT_ACTIVE: 'run_not_active',
  STALE_POLICY_REVISION: 'stale_policy_revision',
  STALE_ATTEMPT: 'stale_attempt',
  STALE_WORKER: 'stale_worker',
  STALE_FENCE: 'stale_fence',
  MODEL_NOT_ALLOWED: 'model_not_allowed',
  ROUTE_NOT_ALLOWED: 'route_not_allowed',
  STATE_LOOKUP_FAILURE: 'state_lookup_failure',
  UNKNOWN_COST: 'unknown_cost_estimate',
  MISSING_OUTPUT_BOUND: 'missing_output_bound',
  OVERSIZE_INPUT: 'oversize_input',
  OVERSIZE_OUTPUT: 'oversize_output',
  DUPLICATE_REQUEST: 'duplicate_request_id',
  STALE_PRICING: 'stale_pricing',
  OVER_BUDGET: 'over_budget',
  STORE_UNAVAILABLE: 'reservation_store_unavailable',
  RESET_FORBIDDEN: 'budget_reset_forbidden',
  UNSAFE_AMOUNT: 'unsafe_micro_usd_amount',
  INVALID_STATE: 'invalid_settlement_state',
  OVER_RESERVED_BOUND: 'actual_exceeds_reserved_bound',
  RECONCILIATION_REQUIRED: 'reconciliation_evidence_required',
  LEDGER_BREACHED: 'ledger_breached',
  OVERFLOW: 'arithmetic_overflow',
  // raw Messages classifier
  MALFORMED_REQUEST: 'malformed_request',
  UNKNOWN_FIELD: 'unknown_request_field',
  UNKNOWN_HEADER: 'unknown_request_header',
  UNSUPPORTED_BETA: 'unsupported_beta_header',
  UNSUPPORTED_CONTEXT_MANAGEMENT: 'unsupported_context_management',
  UNSUPPORTED_STRUCTURED_OUTPUT: 'unsupported_structured_output',
  UNSUPPORTED_SPEED: 'unsupported_speed_feature',
  UNSUPPORTED_CONTAINER: 'unsupported_container',
  UNSUPPORTED_SERVER_TOOL: 'unsupported_server_tool',
  UNSUPPORTED_PROXY_MCP: 'unsupported_proxy_mcp',
  UNSUPPORTED_THINKING: 'unsupported_thinking_block',
  ROUTING_OVERRIDE: 'routing_or_credential_override',
  UNAPPROVED_HELPER_MODEL: 'unapproved_helper_model',
  UNPARSED_DTO: 'unparsed_request_dto',
  // streams
  STREAM_MISSING_START: 'stream_missing_message_start',
  STREAM_OUT_OF_ORDER: 'stream_out_of_order_event',
  STREAM_DUPLICATE_INDEX: 'stream_duplicate_block_index',
  STREAM_MISMATCH: 'stream_block_identity_mismatch',
  STREAM_OPEN_BLOCK: 'stream_open_block_before_final_delta',
  STREAM_MISSING_TERMINAL: 'stream_missing_terminal_event',
  STREAM_DUPLICATE_TERMINAL: 'stream_duplicate_terminal_event',
  STREAM_EVENT_AFTER_TERMINAL: 'stream_event_after_terminal',
  STREAM_MISSING_USAGE: 'stream_missing_usage',
  STREAM_INVALID_USAGE: 'stream_invalid_usage',
  STREAM_TOOL_INPUT_INCOMPLETE_JSON: 'stream_tool_input_incomplete_json',
  STREAM_ERROR_AFTER_200: 'stream_error_after_http200',
  STREAM_CANCELLED: 'stream_cancelled',
});

const OK = (extra = {}) => ({ allowed: true, reasonCode: null, ...extra });
const NO = (reasonCode, extra = {}) => ({ allowed: false, reasonCode, ...extra });
const isSafeMicroUsd = (v) => Number.isSafeInteger(v) && v >= 0;
const isPositiveSafeMicroUsd = (v) => Number.isSafeInteger(v) && v > 0;
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmptyString = (v) => typeof v === 'string' && v.length > 0;
const RUN_BINDING_FIELDS = ['tenantId', 'actorId', 'conversationId', 'runId', 'attemptId', 'workerId', 'writerFence'];
const hasAll = (obj, fields) => isPlainObject(obj) && fields.every((f) => Object.prototype.hasOwnProperty.call(obj, f));
const shapeOk = (name, value) => { try { validateShape(name, value); return true; } catch { return false; } };

// ---------------------------------------------------------------------------
// 1. Trusted credential registry: keyId -> immutable opaque grant. The grant is
//    server-side state, NOT the caller's key object or headers.
// ---------------------------------------------------------------------------
export function createCredentialRegistry(entries = []) {
  const byId = new Map(entries.map((e) => [e.keyId, e.grant]));
  return { lookup: (keyId) => (byId.has(keyId) ? byId.get(keyId) : null) };
}

// ---------------------------------------------------------------------------
// 2. Strict raw Messages classifier. The returned DTO is the ONLY trusted
//    request shape; it carries a brand that admitMessagesFeatures enforces, so a
//    caller cannot hand-build a DTO that merely asserts dangerous fields absent.
// ---------------------------------------------------------------------------
const PARSED = Symbol('meri.parsedMessagesRequest');
export const isParsedMessagesRequest = (x) => isPlainObject(x) && x[PARSED] === true;

const TOP_LEVEL_FIELDS = new Set([
  'model', 'max_tokens', 'messages', 'system', 'tools', 'tool_choice', 'stream',
  'metadata', 'stop_sequences', 'temperature', 'top_p', 'top_k',
]);
const OVERRIDE_FIELDS = new Set([
  'api_base', 'base_url', 'api_key', 'provider', 'custom_llm_provider', 'model_id',
  'model_name', 'aws_region_name', 'litellm_params', 'auth', 'proxy', 'redirect',
]);
const UNSUPPORTED_FEATURE_FIELDS = {
  context_management: DENY.UNSUPPORTED_CONTEXT_MANAGEMENT,
  output_format: DENY.UNSUPPORTED_STRUCTURED_OUTPUT,
  structured_output: DENY.UNSUPPORTED_STRUCTURED_OUTPUT,
  speed: DENY.UNSUPPORTED_SPEED,
  container: DENY.UNSUPPORTED_CONTAINER,
  mcp_servers: DENY.UNSUPPORTED_PROXY_MCP,
  thinking: DENY.UNSUPPORTED_THINKING,
};
const SERVER_TOOL_PREFIXES = ['web_search', 'computer_', 'bash_', 'text_editor_', 'code_execution', 'memory_'];
const OVERRIDE_HEADERS = new Set([
  'x-api-base', 'x-litellm-api-base', 'x-litellm-model', 'x-litellm-model-id', 'x-litellm-provider',
  'anthropic-base-url', 'x-anthropic-base-url', 'x-api-key-override', 'x-provider', 'x-model',
]);
const ALLOWED_HEADERS = new Set(['content-type', 'anthropic-version', 'anthropic-beta', 'accept', 'authorization', 'x-api-key', 'user-agent', 'content-length']);

function parseMessagesBlocks(content, where) {
  if (typeof content === 'string') return OK({ value: content });
  if (!Array.isArray(content)) return NO(DENY.MALFORMED_REQUEST, { where });
  for (const block of content) {
    if (!isPlainObject(block) || !nonEmptyString(block.type)) return NO(DENY.MALFORMED_REQUEST, { where });
    if (block.type === 'text') {
      if (typeof block.text !== 'string') return NO(DENY.MALFORMED_REQUEST, { where });
    } else if (block.type === 'tool_use') {
      if (!nonEmptyString(block.id) || !nonEmptyString(block.name) || !isPlainObject(block.input)) return NO(DENY.MALFORMED_REQUEST, { where });
    } else if (block.type === 'tool_result') {
      if (!nonEmptyString(block.tool_use_id)) return NO(DENY.MALFORMED_REQUEST, { where });
    } else {
      return NO(DENY.UNSUPPORTED_SERVER_TOOL, { where, type: block.type });
    }
  }
  return OK({ value: content });
}

export function parseAnthropicMessagesRequest({ method, path, headers, body }, { allowedBetas = [], pricingRevision = null } = {}) {
  if (method !== MESSAGES_METHOD || path !== MESSAGES_ROUTE) return NO(DENY.ROUTE_NOT_ALLOWED);
  if (!isPlainObject(headers) || !isPlainObject(body)) return NO(DENY.MALFORMED_REQUEST);

  for (const [name, value] of Object.entries(headers)) {
    const lower = String(name).toLowerCase();
    if (OVERRIDE_HEADERS.has(lower)) return NO(DENY.ROUTING_OVERRIDE, { header: lower });
    if (!ALLOWED_HEADERS.has(lower)) return NO(DENY.UNKNOWN_HEADER, { header: lower });
    if (lower === 'anthropic-beta') {
      const betas = String(value).split(',').map((s) => s.trim()).filter(Boolean);
      for (const b of betas) if (!allowedBetas.includes(b)) return NO(DENY.UNSUPPORTED_BETA, { beta: b });
    }
  }
  const ct = Object.entries(headers).find(([n]) => String(n).toLowerCase() === 'content-type');
  if (ct && !String(ct[1]).toLowerCase().startsWith('application/json')) return NO(DENY.MALFORMED_REQUEST, { header: 'content-type' });

  for (const key of Object.keys(body)) {
    if (OVERRIDE_FIELDS.has(key)) return NO(DENY.ROUTING_OVERRIDE, { field: key });
    if (Object.prototype.hasOwnProperty.call(UNSUPPORTED_FEATURE_FIELDS, key)) return NO(UNSUPPORTED_FEATURE_FIELDS[key], { field: key });
    if (!TOP_LEVEL_FIELDS.has(key)) return NO(DENY.UNKNOWN_FIELD, { field: key });
  }
  if (body.model !== MODEL_ALIAS) return NO(DENY.MODEL_NOT_ALLOWED);
  if (!isPositiveSafeMicroUsd(body.max_tokens)) return NO(DENY.MISSING_OUTPUT_BOUND);
  if (!Array.isArray(body.messages) || body.messages.length === 0) return NO(DENY.MALFORMED_REQUEST, { field: 'messages' });

  let approxChars = 0;
  for (const msg of body.messages) {
    if (!isPlainObject(msg) || !['user', 'assistant'].includes(msg.role)) return NO(DENY.MALFORMED_REQUEST, { field: 'messages.role' });
    const blocks = parseMessagesBlocks(msg.content, 'messages.content');
    if (!blocks.allowed) return blocks;
    approxChars += JSON.stringify(msg.content).length;
  }
  if (body.system != null) {
    if (typeof body.system !== 'string' && !Array.isArray(body.system)) return NO(DENY.MALFORMED_REQUEST, { field: 'system' });
    approxChars += JSON.stringify(body.system).length;
  }
  const tools = [];
  if (body.tools != null) {
    if (!Array.isArray(body.tools)) return NO(DENY.MALFORMED_REQUEST, { field: 'tools' });
    for (const tool of body.tools) {
      if (!isPlainObject(tool) || !nonEmptyString(tool.name)) return NO(DENY.MALFORMED_REQUEST, { field: 'tools' });
      if (tool.type != null) {
        const isServer = typeof tool.type === 'string' && SERVER_TOOL_PREFIXES.some((p) => tool.type.startsWith(p));
        return NO(isServer ? DENY.UNSUPPORTED_SERVER_TOOL : DENY.MALFORMED_REQUEST, { field: 'tools.type', type: tool.type });
      }
      if (!isPlainObject(tool.input_schema)) return NO(DENY.MALFORMED_REQUEST, { field: 'tools.input_schema' });
      tools.push({ name: tool.name, description: tool.description ?? null, input_schema: tool.input_schema });
      approxChars += JSON.stringify(tool).length;
    }
  }
  if (body.tool_choice != null) {
    const tc = body.tool_choice;
    if (!isPlainObject(tc) || !['auto', 'any', 'tool'].includes(tc.type)) return NO(DENY.MALFORMED_REQUEST, { field: 'tool_choice' });
    if (tc.type === 'tool' && !nonEmptyString(tc.name)) return NO(DENY.MALFORMED_REQUEST, { field: 'tool_choice.name' });
  }

  const request = {
    [PARSED]: true,
    route: MESSAGES_ROUTE,
    method: MESSAGES_METHOD,
    model: MODEL_ALIAS,
    // pricingRevision is stamped from TRUSTED server-side policy, never from the
    // caller's HTTP body.
    pricingRevision,
    maxOutputTokens: body.max_tokens,
    stream: body.stream === true,
    messages: body.messages,
    tools,
    toolChoice: body.tool_choice ?? null,
    // Approximate, deterministic, char/4 estimate. Clearly a bound input, not a
    // caller claim, and not a verified provider token count.
    approxInputTokens: Math.max(1, Math.ceil(approxChars / 4)),
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    thinkingTokens: 0,
  };
  return OK({ request });
}

export function admitMessagesFeatures(request) {
  if (!isParsedMessagesRequest(request)) return NO(DENY.UNPARSED_DTO);
  return OK();
}

// ---------------------------------------------------------------------------
// 3. Cost estimation: safe integer microUSD, charges the highest applicable
//    tier. pricing is synthetic fixture data, explicitly NOT Bedrock prices.
// ---------------------------------------------------------------------------
export function estimateCostMicrousd({ pricing, request }) {
  if (!isParsedMessagesRequest(request)) return NO(DENY.UNPARSED_DTO);
  const model = pricing?.models?.[request.model];
  if (!model) return NO(DENY.UNKNOWN_COST);
  if (pricing.revision !== request.pricingRevision) return NO(DENY.STALE_PRICING);
  const input = request.approxInputTokens;
  const output = request.maxOutputTokens;
  if (!isPositiveSafeMicroUsd(input) || !isPositiveSafeMicroUsd(output)) return NO(DENY.UNKNOWN_COST);
  if (input > model.maxInputTokens) return NO(DENY.OVERSIZE_INPUT);
  if (output > model.maxOutputTokens) return NO(DENY.OVERSIZE_OUTPUT);
  const raw = input * model.inputPerMTok + output * model.outputPerMTok;
  const costMicrousd = Math.ceil(raw);
  if (!isPositiveSafeMicroUsd(costMicrousd)) return NO(DENY.UNKNOWN_COST);
  return OK({ costMicrousd, worstCaseInputOnlyMicrousd: Math.ceil(input * model.inputPerMTok) });
}

// ---------------------------------------------------------------------------
// 4. Budget ledger: safe integer microUSD, in-memory, TTL-bound. Not durable.
// ---------------------------------------------------------------------------
export function createLedger() {
  return { revision: 0, consumedMicrousd: 0, breached: false, reservations: new Map() };
}

export function committedMicrousd(ledger) {
  let total = ledger.consumedMicrousd;
  for (const r of ledger.reservations.values()) if (r.state === 'outstanding' || r.state === 'unresolved') total += r.amountMicrousd;
  return total;
}

export function reserveBudget(ledger, requestId, amountMicrousd, { store = {} } = {}) {
  if (store.failure) return NO(DENY.STORE_UNAVAILABLE);
  if (ledger.breached) return NO(DENY.LEDGER_BREACHED);
  if (!nonEmptyString(requestId)) return NO(DENY.DUPLICATE_REQUEST);
  if (ledger.reservations.has(requestId)) return NO(DENY.DUPLICATE_REQUEST);
  if (!isPositiveSafeMicroUsd(amountMicrousd)) return NO(DENY.UNKNOWN_COST);
  const committed = committedMicrousd(ledger);
  const after = committed + amountMicrousd;
  if (!Number.isSafeInteger(after)) return NO(DENY.OVERFLOW);
  if (after > QUALIFICATION_CEILING_MICROUSD) return NO(DENY.OVER_BUDGET, { committedMicrousd: committed, attemptedMicrousd: amountMicrousd });
  ledger.reservations.set(requestId, { amountMicrousd, state: 'outstanding' });
  ledger.revision += 1;
  return OK({ reservationId: requestId, committedAfterMicrousd: after });
}

// Settle. Never clamps real liability, never fabricates a safe result, never
// releases an unresolved hold without explicit trustworthy reconciliation.
export function settleBudget(ledger, requestId, { actualCostMicrousd = null, outcome } = {}) {
  const r = ledger.reservations.get(requestId);
  if (!r) return NO(DENY.UNKNOWN_KEY);
  if (r.state !== 'outstanding') return NO(DENY.INVALID_STATE, { state: r.state });

  if (outcome === 'pre_dispatch_rejection') {
    ledger.reservations.set(requestId, { ...r, amountMicrousd: 0, state: 'released' });
    ledger.revision += 1;
    return OK({ state: 'released' });
  }
  if (outcome === 'success' || outcome === 'cancelled') {
    if (!isSafeMicroUsd(actualCostMicrousd)) {
      ledger.reservations.set(requestId, { ...r, state: 'unresolved' });
      ledger.revision += 1;
      return NO(DENY.RECONCILIATION_REQUIRED, { state: 'unresolved' });
    }
    const nextConsumed = ledger.consumedMicrousd + actualCostMicrousd;
    if (!Number.isSafeInteger(nextConsumed)) {
      ledger.reservations.set(requestId, { ...r, state: 'unresolved' });
      return NO(DENY.OVERFLOW, { state: 'unresolved' });
    }
    ledger.consumedMicrousd = nextConsumed;
    ledger.reservations.set(requestId, { ...r, amountMicrousd: 0, state: 'settled' });
    ledger.revision += 1;
    if (nextConsumed > QUALIFICATION_CEILING_MICROUSD) {
      ledger.breached = true;
      return NO(DENY.LEDGER_BREACHED, { state: 'settled', consumedMicrousd: nextConsumed });
    }
    if (actualCostMicrousd > r.amountMicrousd) {
      // Real liability above the reservation bound: surface it, do not clamp.
      ledger.breached = true;
      return NO(DENY.OVER_RESERVED_BOUND, { state: 'settled', consumedMicrousd: nextConsumed, reservedMicrousd: r.amountMicrousd });
    }
    return OK({ state: 'settled', consumedMicrousd: nextConsumed });
  }
  // error_after_dispatch, unknown, HTTP200-with-error, missing usage: keep hold.
  ledger.reservations.set(requestId, { ...r, state: 'unresolved' });
  ledger.revision += 1;
  return NO(DENY.RECONCILIATION_REQUIRED, { state: 'unresolved' });
}

// Only explicit trustworthy provider reconciliation may release an unresolved
// hold. A caller label or a known-zero/partial cancellation estimate is not
// authoritative final billing proof.
export function reconcileBudget(ledger, requestId, { evidence } = {}) {
  const r = ledger.reservations.get(requestId);
  if (!r) return NO(DENY.UNKNOWN_KEY);
  if (r.state !== 'unresolved') return NO(DENY.INVALID_STATE, { state: r.state });
  if (!isPlainObject(evidence) || evidence.source !== 'provider_reconciliation' || !isSafeMicroUsd(evidence.actualCostMicrousd)) {
    return NO(DENY.RECONCILIATION_REQUIRED);
  }
  const nextConsumed = ledger.consumedMicrousd + evidence.actualCostMicrousd;
  if (!Number.isSafeInteger(nextConsumed)) return NO(DENY.OVERFLOW);
  ledger.consumedMicrousd = nextConsumed;
  ledger.reservations.set(requestId, { ...r, amountMicrousd: 0, state: 'settled' });
  ledger.revision += 1;
  if (nextConsumed > QUALIFICATION_CEILING_MICROUSD) { ledger.breached = true; return NO(DENY.LEDGER_BREACHED); }
  return OK({ state: 'settled', consumedMicrousd: nextConsumed });
}

export function expireReservations(ledger) {
  let expired = 0;
  for (const [id, r] of ledger.reservations) {
    if (r.state === 'outstanding') { ledger.reservations.set(id, { ...r, state: 'unresolved' }); expired += 1; }
  }
  if (expired > 0) ledger.revision += 1;
  return { expired };
}

export function attemptBudgetReset() {
  return NO(DENY.RESET_FORBIDDEN);
}

// ---------------------------------------------------------------------------
// 5. Full admission for one model request.
// ---------------------------------------------------------------------------
export function admitModelRequest({ now, registry, credentialId, trustedIdentity, run, raw, requestId, ledger, pricing, store = {}, allowedBetas = [] }) {
  if (store.failure) return NO(DENY.STATE_LOOKUP_FAILURE);

  const parsed = parseAnthropicMessagesRequest(raw, { allowedBetas, pricingRevision: pricing?.revision ?? null });
  if (!parsed.allowed) return parsed;
  const request = parsed.request;

  if (!nonEmptyString(credentialId)) return NO(DENY.MISSING_KEY);
  const grant = registry?.lookup?.(credentialId) ?? null;
  if (!grant) return NO(DENY.UNKNOWN_KEY);
  if (!nonEmptyString(grant.model) || !Array.isArray(grant.allowedRoutes) || !shapeOk('RunBinding', grant.binding) || !nonEmptyString(grant.policyRevision)) {
    return NO(DENY.MALFORMED_GRANT);
  }
  if (grant.state !== 'active') return NO(grant.state === 'revoked' ? DENY.KEY_REVOKED : DENY.UNKNOWN_KEY);
  if (!nonEmptyString(grant.expiresAt) || !(Date.parse(grant.expiresAt) > Date.parse(now))) return NO(DENY.KEY_EXPIRED);
  if (grant.model !== MODEL_ALIAS) return NO(DENY.MODEL_NOT_ALLOWED);
  if (grant.allowedRoutes.length === 0 || !grant.allowedRoutes.includes(MESSAGES_ROUTE)) return NO(DENY.ROUTE_NOT_ALLOWED);

  if (!trustedIdentity) return NO(DENY.MISSING_TRUSTED_IDENTITY);
  if (trustedIdentity.source !== 'broker') return NO(DENY.UNTRUSTED_IDENTITY_SOURCE);
  if (!hasAll(trustedIdentity, [...RUN_BINDING_FIELDS, 'policyRevision']) || !shapeOk('RunBinding', pick(trustedIdentity, RUN_BINDING_FIELDS))) {
    return NO(DENY.MALFORMED_IDENTITY);
  }
  if (!isPlainObject(run) || !shapeOk('RunBinding', run.binding) || !nonEmptyString(run.policyRevision)) return NO(DENY.MALFORMED_BINDING);
  if (run.state !== 'active') return NO(DENY.RUN_NOT_ACTIVE);

  for (const f of ['tenantId', 'actorId', 'conversationId', 'runId']) {
    if (grant.binding[f] !== run.binding[f]) return NO(DENY.BINDING_MISMATCH, { field: f, from: 'grant' });
    if (trustedIdentity[f] !== run.binding[f]) return NO(DENY.BINDING_MISMATCH, { field: f, from: 'identity' });
  }
  if (grant.binding.attemptId !== run.binding.attemptId) return NO(DENY.STALE_ATTEMPT, { from: 'grant' });
  if (grant.binding.workerId !== run.binding.workerId) return NO(DENY.STALE_WORKER, { from: 'grant' });
  if (grant.binding.writerFence !== run.binding.writerFence) return NO(DENY.STALE_FENCE, { from: 'grant' });
  if (trustedIdentity.attemptId !== run.binding.attemptId) return NO(DENY.STALE_ATTEMPT, { from: 'identity' });
  if (trustedIdentity.workerId !== run.binding.workerId) return NO(DENY.STALE_WORKER, { from: 'identity' });
  if (trustedIdentity.writerFence !== run.binding.writerFence) return NO(DENY.STALE_FENCE, { from: 'identity' });
  if (grant.policyRevision !== run.policyRevision || trustedIdentity.policyRevision !== run.policyRevision) return NO(DENY.STALE_POLICY_REVISION);

  const estimate = estimateCostMicrousd({ pricing, request });
  if (!estimate.allowed) return estimate;
  const reservation = reserveBudget(ledger, requestId, estimate.costMicrousd, { store });
  if (!reservation.allowed) return reservation;
  return OK({ reservationId: reservation.reservationId, reservedMicrousd: estimate.costMicrousd });
}

const pick = (obj, fields) => Object.fromEntries(fields.map((f) => [f, obj[f]]));

// ---------------------------------------------------------------------------
// 6. Synthetic stream validation (pure; not a wire/SSE translator).
// ---------------------------------------------------------------------------
export function validateStream(events = []) {
  const base = { ok: false, success: false, reasonCode: null, terminalSeen: false, usageSeen: false, completedToolBlocks: [] };
  if (!Array.isArray(events) || events.length === 0 || !isPlainObject(events[0]) || events[0].type !== 'message_start') {
    return { ...base, reasonCode: DENY.STREAM_MISSING_START };
  }
  if (!validStartUsage(events[0].usage)) return { ...base, reasonCode: DENY.STREAM_INVALID_USAGE };

  const blocks = new Map();
  let phase = 'in_message';
  let deltaSeen = false;
  for (let i = 1; i < events.length; i++) {
    const e = events[i];
    if (!isPlainObject(e) || !nonEmptyString(e.type)) return { ...base, reasonCode: DENY.STREAM_OUT_OF_ORDER };
    if (phase === 'terminal') return { ...base, reasonCode: e.type === 'message_stop' ? DENY.STREAM_DUPLICATE_TERMINAL : DENY.STREAM_EVENT_AFTER_TERMINAL };

    switch (e.type) {
      case 'content_block_start': {
        if (deltaSeen) return { ...base, reasonCode: DENY.STREAM_OUT_OF_ORDER };
        if (!Number.isSafeInteger(e.index) || e.index < 0 || blocks.has(e.index)) return { ...base, reasonCode: DENY.STREAM_DUPLICATE_INDEX };
        if (!['text', 'tool_use'].includes(e.blockKind)) return { ...base, reasonCode: DENY.STREAM_MISMATCH };
        if (e.blockKind === 'tool_use' && (!nonEmptyString(e.name) || !nonEmptyString(e.id))) return { ...base, reasonCode: DENY.STREAM_MISMATCH };
        blocks.set(e.index, { kind: e.blockKind, name: e.name ?? null, id: e.id ?? null, json: '', closed: false });
        break;
      }
      case 'content_block_delta': {
        const b = blocks.get(e.index);
        if (!b || b.closed) return { ...base, reasonCode: DENY.STREAM_OUT_OF_ORDER };
        if (e.deltaType === 'text_delta') {
          if (b.kind !== 'text') return { ...base, reasonCode: DENY.STREAM_MISMATCH };
        } else if (e.deltaType === 'input_json_delta') {
          if (b.kind !== 'tool_use') return { ...base, reasonCode: DENY.STREAM_MISMATCH };
          if (typeof e.partial_json !== 'string') return { ...base, reasonCode: DENY.STREAM_OUT_OF_ORDER };
          b.json += e.partial_json;
        } else return { ...base, reasonCode: DENY.STREAM_OUT_OF_ORDER };
        break;
      }
      case 'content_block_stop': {
        const b = blocks.get(e.index);
        if (!b || b.closed) return { ...base, reasonCode: DENY.STREAM_OUT_OF_ORDER };
        if (e.blockKind != null && e.blockKind !== b.kind) return { ...base, reasonCode: DENY.STREAM_MISMATCH };
        if (b.kind === 'tool_use') {
          let parsed;
          try { parsed = JSON.parse(b.json); } catch { return { ...base, reasonCode: DENY.STREAM_TOOL_INPUT_INCOMPLETE_JSON }; }
          if (!isPlainObject(parsed)) return { ...base, reasonCode: DENY.STREAM_TOOL_INPUT_INCOMPLETE_JSON };
          base.completedToolBlocks.push(e.index);
        }
        b.closed = true;
        break;
      }
      case 'message_delta': {
        if (deltaSeen) return { ...base, reasonCode: DENY.STREAM_OUT_OF_ORDER };
        if ([...blocks.values()].some((b) => !b.closed)) return { ...base, reasonCode: DENY.STREAM_OPEN_BLOCK };
        if (!validDeltaUsage(e.usage)) return { ...base, reasonCode: DENY.STREAM_INVALID_USAGE };
        base.usageSeen = true;
        deltaSeen = true;
        break;
      }
      case 'message_stop': {
        if (!deltaSeen) return { ...base, reasonCode: DENY.STREAM_MISSING_USAGE };
        base.terminalSeen = true;
        phase = 'terminal';
        break;
      }
      case 'error':
        return { ...base, reasonCode: DENY.STREAM_ERROR_AFTER_200 };
      case 'cancelled':
        return { ...base, reasonCode: DENY.STREAM_CANCELLED };
      default:
        return { ...base, reasonCode: DENY.STREAM_OUT_OF_ORDER };
    }
  }
  if (!base.terminalSeen) return { ...base, reasonCode: DENY.STREAM_MISSING_TERMINAL };
  if (!base.usageSeen) return { ...base, reasonCode: DENY.STREAM_MISSING_USAGE };
  return { ...base, ok: true, success: true, reasonCode: null };
}

const validStartUsage = (u) => isPlainObject(u) && Number.isSafeInteger(u.input_tokens) && u.input_tokens >= 0;
const validDeltaUsage = (u) => isPlainObject(u) && Number.isSafeInteger(u.output_tokens) && u.output_tokens > 0;

export const RECONCILE = Object.freeze({
  SUCCESS: 'success',
  PRE_DISPATCH_REJECTION: 'pre_dispatch_rejection',
  ERROR_AFTER_DISPATCH: 'error_after_dispatch',
  CANCELLED: 'cancelled',
  UNKNOWN: 'unknown',
});
