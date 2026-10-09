// Meri W02-02 offline admission / budget policy reference (repaired v3).
//
// PURPOSE AND HONEST SCOPE
// ------------------------
// PURE, OFFLINE, DETERMINISTIC reference for the *missing application-level
// invariants* LiteLLM's native virtual-key auth does NOT supply: authenticated
// task/run binding, current-run/fence/policy checks, a strict raw Messages
// classifier with immutable provenance, safe-integer microUSD worst-case budget
// holds, and synthetic stream validation. It is a TEST REFERENCE ONLY.
//
// It is NOT a deployed auth service, broker, token issuer, ledger or gateway, and
// NOT a production HTTP/SSE/provider translator. It opens no socket, contacts no
// AWS/model/proxy/DB and holds no secret. Passing its tests establishes NOTHING
// about deployed proxy behaviour or real authentication.
//
// `trustedIdentity.source === 'broker'` and every count-observation `source` are
// FIXTURE PROVENANCE ONLY; the strings are not authenticators. In production the
// trusted task observation and the token-count bound must arrive over an
// authenticated channel. Cost figures are SYNTHETIC and explicitly NOT current
// Bedrock prices. No shared CapabilityClaims action/audience is added.

import { validateShape, canonicalSha256 } from '../../../packages/contracts/validate.mjs';

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
  MISSING_COUNT_OBSERVATION: 'missing_trusted_count_observation',
  COUNT_BOUND_MISMATCH: 'count_observation_mismatch',
  UNTRUSTED_COUNT_SOURCE: 'untrusted_count_observation_source',
  MALFORMED_REQUEST: 'malformed_request',
  UNKNOWN_FIELD: 'unknown_request_field',
  UNKNOWN_HEADER: 'unknown_request_header',
  UNSUPPORTED_BETA: 'unsupported_beta_header',
  UNSUPPORTED_CACHE_CONTROL: 'unsupported_cache_control',
  UNSUPPORTED_CONTEXT_MANAGEMENT: 'unsupported_context_management',
  UNSUPPORTED_STRUCTURED_OUTPUT: 'unsupported_structured_output',
  UNSUPPORTED_SPEED: 'unsupported_speed_feature',
  UNSUPPORTED_CONTAINER: 'unsupported_container',
  UNSUPPORTED_SERVER_TOOL: 'unsupported_server_tool',
  UNSUPPORTED_PROXY_MCP: 'unsupported_proxy_mcp',
  UNSUPPORTED_THINKING: 'unsupported_thinking_block',
  ROUTING_OVERRIDE: 'routing_or_credential_override',
  UNAPPROVED_HELPER_MODEL: 'unapproved_helper_model',
  UNPARSED_DTO: 'unparsed_or_forged_request_dto',
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
const isFiniteNonNegative = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const RUN_BINDING_FIELDS = ['tenantId', 'actorId', 'conversationId', 'runId', 'attemptId', 'workerId', 'writerFence'];
const hasAll = (obj, fields) => isPlainObject(obj) && fields.every((f) => Object.prototype.hasOwnProperty.call(obj, f));
const shapeOk = (name, value) => { try { validateShape(name, value); return true; } catch { return false; } };

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

// ---------------------------------------------------------------------------
// 1. Trusted credential registry: keyId -> immutable opaque grant. The grant is
//    a DEEP-FROZEN server-side snapshot; the caller's entry/grant object is
//    cloned and never retained by reference.
// ---------------------------------------------------------------------------
export function createCredentialRegistry(entries = []) {
  const byId = new Map();
  for (const entry of entries) {
    if (!isPlainObject(entry) || !nonEmptyString(entry.keyId)) continue;
    byId.set(entry.keyId, deepFreeze(structuredClone(entry.grant)));
  }
  return {
    lookup(keyId) {
      if (!nonEmptyString(keyId)) return null;
      return byId.has(keyId) ? byId.get(keyId) : null;
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Strict raw Messages classifier. The DTO is DEEP-FROZEN and its provenance
//    lives in a private WeakMap, so a spread/forged copy loses provenance and is
//    rejected. Nested message/system/block/tool/tool_choice/metadata nodes are
//    validated with strict allowed keys; arbitrary JSON inside a local tool's
//    input/input_schema is DATA and is NOT censored.
// ---------------------------------------------------------------------------
const provenance = new WeakMap();
export const isParsedMessagesRequest = (x) => isPlainObject(x) && provenance.has(x);
export const rawHashOf = (x) => (provenance.has(x) ? provenance.get(x).rawCanonicalSha256 : null);

const TOP_LEVEL_FIELDS = new Set([
  'model', 'max_tokens', 'messages', 'system', 'tools', 'tool_choice', 'stream',
  'metadata', 'stop_sequences', 'temperature', 'top_p', 'top_k',
]);
const OVERRIDE_FIELDS = new Set([
  'api_base', 'base_url', 'api_key', 'provider', 'custom_llm_provider', 'model_id',
  'model_name', 'aws_region_name', 'litellm_params', 'auth', 'proxy', 'redirect', 'routing_override',
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
const SERVER_TOOL_TYPES = new Set(['web_search_20250305', 'web_search_20250305_strict', 'computer_20250124', 'bash_20250124', 'text_editor_20250124', 'code_execution_20250522', 'server_tool_use']);
const OVERRIDE_HEADERS = new Set([
  'x-api-base', 'x-litellm-api-base', 'x-litellm-model', 'x-litellm-model-id', 'x-litellm-provider',
  'anthropic-base-url', 'x-anthropic-base-url', 'x-api-key-override', 'x-provider', 'x-model',
]);
const ALLOWED_HEADERS = new Set(['content-type', 'anthropic-version', 'anthropic-beta', 'accept', 'authorization', 'x-api-key', 'user-agent', 'content-length']);

const checkAllowedKeys = (obj, allowed, where) => {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      return OVERRIDE_FIELDS.has(key) ? NO(DENY.ROUTING_OVERRIDE, { where, field: key }) : NO(DENY.UNKNOWN_FIELD, { where, field: key });
    }
  }
  return OK();
};

function validateTextBlock(block, where) {
  if (!nonEmptyString(block.type)) return NO(DENY.MALFORMED_REQUEST, { where });
  const type = block.type;
  if (type === 'thinking' || type === 'redacted_thinking') return NO(DENY.UNSUPPORTED_THINKING, { where });
  if (SERVER_TOOL_TYPES.has(type)) return NO(DENY.UNSUPPORTED_SERVER_TOOL, { where, type });
  if (Object.prototype.hasOwnProperty.call(block, 'cache_control')) return NO(DENY.UNSUPPORTED_CACHE_CONTROL, { where });
  if (type === 'text') {
    const keys = checkAllowedKeys(block, ['type', 'text'], where);
    if (!keys.allowed) return keys;
    if (typeof block.text !== 'string') return NO(DENY.MALFORMED_REQUEST, { where, field: 'text' });
    return OK();
  }
  if (type === 'tool_use') {
    const keys = checkAllowedKeys(block, ['type', 'id', 'name', 'input'], where);
    if (!keys.allowed) return keys;
    if (!nonEmptyString(block.id) || !nonEmptyString(block.name) || !isPlainObject(block.input)) return NO(DENY.MALFORMED_REQUEST, { where });
    return OK();
  }
  if (type === 'tool_result') {
    const keys = checkAllowedKeys(block, ['type', 'tool_use_id', 'content', 'is_error'], where);
    if (!keys.allowed) return keys;
    if (!nonEmptyString(block.tool_use_id)) return NO(DENY.MALFORMED_REQUEST, { where, field: 'tool_use_id' });
    if (block.is_error != null && typeof block.is_error !== 'boolean') return NO(DENY.MALFORMED_REQUEST, { where, field: 'is_error' });
    if (block.content != null) {
      if (typeof block.content === 'string') return OK();
      if (!Array.isArray(block.content)) return NO(DENY.MALFORMED_REQUEST, { where, field: 'tool_result.content' });
      for (const inner of block.content) {
        if (!isPlainObject(inner)) return NO(DENY.MALFORMED_REQUEST, { where, field: 'tool_result.content' });
        if (inner.type === 'thinking' || inner.type === 'redacted_thinking') return NO(DENY.UNSUPPORTED_THINKING, { where });
        if (Object.prototype.hasOwnProperty.call(inner, 'cache_control')) return NO(DENY.UNSUPPORTED_CACHE_CONTROL, { where });
        if (inner.type !== 'text') return NO(DENY.UNSUPPORTED_SERVER_TOOL, { where, type: inner.type });
        const innerKeys = checkAllowedKeys(inner, ['type', 'text'], where);
        if (!innerKeys.allowed) return innerKeys;
        if (typeof inner.text !== 'string') return NO(DENY.MALFORMED_REQUEST, { where, field: 'tool_result.content.text' });
      }
    }
    return OK();
  }
  return NO(DENY.UNKNOWN_FIELD, { where, field: `block.type=${type}` });
}

function validateMessageContent(content, where) {
  if (typeof content === 'string') return OK();
  if (!Array.isArray(content)) return NO(DENY.MALFORMED_REQUEST, { where });
  for (const block of content) {
    if (!isPlainObject(block)) return NO(DENY.MALFORMED_REQUEST, { where });
    const result = validateTextBlock(block, where);
    if (!result.allowed) return result;
  }
  return OK();
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

  for (const msg of body.messages) {
    if (!isPlainObject(msg)) return NO(DENY.MALFORMED_REQUEST, { field: 'messages' });
    const msgKeys = checkAllowedKeys(msg, ['role', 'content'], 'messages');
    if (!msgKeys.allowed) {
      return msgKeys.reasonCode === DENY.UNKNOWN_FIELD && OVERRIDE_FIELDS.has(msgKeys.field) ? NO(DENY.ROUTING_OVERRIDE, { field: `messages.${msgKeys.field}` }) : msgKeys;
    }
    if (!['user', 'assistant'].includes(msg.role)) return NO(DENY.MALFORMED_REQUEST, { field: 'messages.role' });
    const content = validateMessageContent(msg.content, 'messages.content');
    if (!content.allowed) return content;
  }
  if (body.system != null) {
    if (typeof body.system === 'string') { /* ok */ } else if (Array.isArray(body.system)) {
      for (const block of body.system) {
        if (!isPlainObject(block)) return NO(DENY.MALFORMED_REQUEST, { field: 'system' });
        if (block.type === 'thinking' || block.type === 'redacted_thinking') return NO(DENY.UNSUPPORTED_THINKING, { field: 'system' });
        if (Object.prototype.hasOwnProperty.call(block, 'cache_control')) return NO(DENY.UNSUPPORTED_CACHE_CONTROL, { field: 'system' });
        const keys = checkAllowedKeys(block, ['type', 'text'], 'system');
        if (!keys.allowed) return keys;
        if (block.type !== 'text' || typeof block.text !== 'string') return NO(DENY.MALFORMED_REQUEST, { field: 'system' });
      }
    } else return NO(DENY.MALFORMED_REQUEST, { field: 'system' });
  }
  const tools = [];
  if (body.tools != null) {
    if (!Array.isArray(body.tools)) return NO(DENY.MALFORMED_REQUEST, { field: 'tools' });
    for (const tool of body.tools) {
      if (!isPlainObject(tool) || !nonEmptyString(tool.name)) return NO(DENY.MALFORMED_REQUEST, { field: 'tools' });
      if (Object.prototype.hasOwnProperty.call(tool, 'cache_control')) return NO(DENY.UNSUPPORTED_CACHE_CONTROL, { field: 'tools' });
      if (tool.type != null) return NO(SERVER_TOOL_TYPES.has(tool.type) ? DENY.UNSUPPORTED_SERVER_TOOL : DENY.MALFORMED_REQUEST, { field: 'tools.type', type: tool.type });
      const keys = checkAllowedKeys(tool, ['name', 'description', 'input_schema'], 'tools');
      if (!keys.allowed) return keys;
      if (!isPlainObject(tool.input_schema)) return NO(DENY.MALFORMED_REQUEST, { field: 'tools.input_schema' });
      tools.push({ name: tool.name, description: tool.description ?? null, input_schema: tool.input_schema });
    }
  }
  if (body.tool_choice != null) {
    const tc = body.tool_choice;
    if (!isPlainObject(tc)) return NO(DENY.MALFORMED_REQUEST, { field: 'tool_choice' });
    const keys = checkAllowedKeys(tc, ['type', 'name', 'disable_parallel_tool_use'], 'tool_choice');
    if (!keys.allowed) return keys;
    if (!['auto', 'any', 'tool', 'none'].includes(tc.type)) return NO(DENY.MALFORMED_REQUEST, { field: 'tool_choice.type' });
    if (tc.type === 'tool' && !nonEmptyString(tc.name)) return NO(DENY.MALFORMED_REQUEST, { field: 'tool_choice.name' });
    if (tc.disable_parallel_tool_use != null && typeof tc.disable_parallel_tool_use !== 'boolean') return NO(DENY.MALFORMED_REQUEST, { field: 'tool_choice.disable_parallel_tool_use' });
  }
  if (body.metadata != null) {
    if (!isPlainObject(body.metadata)) return NO(DENY.MALFORMED_REQUEST, { field: 'metadata' });
    const keys = checkAllowedKeys(body.metadata, ['user_id'], 'metadata');
    if (!keys.allowed) return keys;
    if (body.metadata.user_id != null && typeof body.metadata.user_id !== 'string') return NO(DENY.MALFORMED_REQUEST, { field: 'metadata.user_id' });
  }
  if (body.stream != null && typeof body.stream !== 'boolean') return NO(DENY.MALFORMED_REQUEST, { field: 'stream' });
  if (body.temperature != null && !(typeof body.temperature === 'number' && Number.isFinite(body.temperature) && body.temperature >= 0 && body.temperature <= 1)) return NO(DENY.MALFORMED_REQUEST, { field: 'temperature' });
  if (body.top_p != null && !(typeof body.top_p === 'number' && Number.isFinite(body.top_p) && body.top_p >= 0 && body.top_p <= 1)) return NO(DENY.MALFORMED_REQUEST, { field: 'top_p' });
  if (body.top_k != null && !(Number.isSafeInteger(body.top_k) && body.top_k > 0)) return NO(DENY.MALFORMED_REQUEST, { field: 'top_k' });
  if (body.stop_sequences != null && !(Array.isArray(body.stop_sequences) && body.stop_sequences.every((s) => typeof s === 'string'))) return NO(DENY.MALFORMED_REQUEST, { field: 'stop_sequences' });

  // Diagnostic-only rough size (NOT a verified token bound and never used for a
  // successful reservation; see createTrustedCountObservation).
  const approxInputChars = canonicalSha256(body).length; // stable, deterministic, diagnostic only

  const request = deepFreeze({
    route: MESSAGES_ROUTE,
    method: MESSAGES_METHOD,
    model: MODEL_ALIAS,
    pricingRevision,
    maxOutputTokens: body.max_tokens,
    stream: body.stream === true,
    messages: structuredClone(body.messages),
    system: body.system === undefined ? null : structuredClone(body.system),
    tools: deepFreeze(structuredClone(tools)),
    toolChoice: body.tool_choice === undefined ? null : structuredClone(body.tool_choice),
    approxInputChars,
  });
  provenance.set(request, { rawCanonicalSha256: canonicalSha256({ method, path, headers, body }) });
  return OK({ request });
}

export function admitMessagesFeatures(request) {
  if (!isParsedMessagesRequest(request)) return NO(DENY.UNPARSED_DTO);
  return OK();
}

// ---------------------------------------------------------------------------
// 3. Trusted token-count observation. This is a separate trusted internal
//    observation (FIXTURE PROVENANCE here), bound to the canonical hash of the
//    classified raw request and the model/pricing revision. Wire-body token
//    claims cannot supply it. char/4 is NOT a verified worst-case bound.
// ---------------------------------------------------------------------------
export function createTrustedCountObservation(raw, { inputTokens, pricingRevision, source = 'fixture_provenance' } = {}) {
  return deepFreeze({
    kind: 'trusted_count_observation',
    source,
    rawCanonicalSha256: canonicalSha256(raw),
    model: MODEL_ALIAS,
    pricingRevision,
    inputTokens,
    maxOutputTokensBound: isPlainObject(raw?.body) ? raw.body.max_tokens : undefined,
  });
}

export function estimateCostMicrousd({ pricing, request, observation }) {
  if (!isParsedMessagesRequest(request)) return NO(DENY.UNPARSED_DTO);
  if (!isPlainObject(observation) || observation.kind !== 'trusted_count_observation' || !Object.isFrozen(observation)) return NO(DENY.MISSING_COUNT_OBSERVATION);
  if (observation.source !== 'fixture_provenance') return NO(DENY.UNTRUSTED_COUNT_SOURCE);
  if (observation.rawCanonicalSha256 !== rawHashOf(request)) return NO(DENY.COUNT_BOUND_MISMATCH);
  if (observation.model !== request.model) return NO(DENY.COUNT_BOUND_MISMATCH);
  if (observation.pricingRevision !== pricing?.revision) return NO(DENY.STALE_PRICING);
  if (observation.maxOutputTokensBound !== request.maxOutputTokens) return NO(DENY.COUNT_BOUND_MISMATCH);

  const model = pricing?.models?.[request.model];
  if (!model) return NO(DENY.UNKNOWN_COST);
  for (const rate of ['inputPerMTok', 'outputPerMTok']) {
    if (!isFiniteNonNegative(model[rate])) return NO(DENY.UNKNOWN_COST, { field: rate });
  }
  if (!isPositiveSafeMicroUsd(model.maxInputTokens) || !isPositiveSafeMicroUsd(model.maxOutputTokens)) return NO(DENY.UNKNOWN_COST);
  const input = observation.inputTokens;
  const output = request.maxOutputTokens;
  if (!isPositiveSafeMicroUsd(input) || !isPositiveSafeMicroUsd(output)) return NO(DENY.UNKNOWN_COST);
  if (input > model.maxInputTokens) return NO(DENY.OVERSIZE_INPUT);
  if (output > model.maxOutputTokens) return NO(DENY.OVERSIZE_OUTPUT);
  const costMicrousd = Math.ceil(input * model.inputPerMTok + output * model.outputPerMTok);
  if (!isPositiveSafeMicroUsd(costMicrousd)) return NO(DENY.UNKNOWN_COST);
  return OK({ costMicrousd, inputTokens: input, outputBound: output });
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

// Apply a real actual cost against the ORIGINAL reservation, then re-check the
// COMBINED committed total (consumed + every remaining hold/unresolved). Real
// liability is preserved; over-bound or over-cap results quarantine the ledger.
function applyActual(ledger, requestId, r, actualCostMicrousd) {
  const nextConsumed = ledger.consumedMicrousd + actualCostMicrousd;
  if (!Number.isSafeInteger(nextConsumed)) {
    ledger.reservations.set(requestId, { ...r, state: 'unresolved' });
    return NO(DENY.OVERFLOW, { state: 'unresolved' });
  }
  ledger.consumedMicrousd = nextConsumed;
  ledger.reservations.set(requestId, { ...r, amountMicrousd: 0, state: 'settled' });
  ledger.revision += 1;
  const committed = committedMicrousd(ledger);
  if (!Number.isSafeInteger(committed)) { ledger.breached = true; return NO(DENY.OVERFLOW, { state: 'settled' }); }
  if (committed > QUALIFICATION_CEILING_MICROUSD) { ledger.breached = true; return NO(DENY.LEDGER_BREACHED, { state: 'settled', committedMicrousd: committed }); }
  if (actualCostMicrousd > r.amountMicrousd) { ledger.breached = true; return NO(DENY.OVER_RESERVED_BOUND, { state: 'settled', committedMicrousd: committed, reservedMicrousd: r.amountMicrousd }); }
  return OK({ state: 'settled', consumedMicrousd: nextConsumed, committedMicrousd: committed });
}

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
    return applyActual(ledger, requestId, r, actualCostMicrousd);
  }
  ledger.reservations.set(requestId, { ...r, state: 'unresolved' });
  ledger.revision += 1;
  return NO(DENY.RECONCILIATION_REQUIRED, { state: 'unresolved' });
}

// Only explicit trustworthy provider reconciliation may release an unresolved
// hold, and it applies the same real-liability + combined-committed checks.
export function reconcileBudget(ledger, requestId, { evidence } = {}) {
  const r = ledger.reservations.get(requestId);
  if (!r) return NO(DENY.UNKNOWN_KEY);
  if (r.state !== 'unresolved') return NO(DENY.INVALID_STATE, { state: r.state });
  if (!isPlainObject(evidence) || evidence.source !== 'provider_reconciliation' || !isSafeMicroUsd(evidence.actualCostMicrousd)) {
    return NO(DENY.RECONCILIATION_REQUIRED);
  }
  return applyActual(ledger, requestId, r, evidence.actualCostMicrousd);
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
export function admitModelRequest({ now, registry, credentialId, trustedIdentity, run, raw, requestId, ledger, pricing, observation, store = {}, allowedBetas = [] }) {
  let grant = null;
  try {
    if (store.failure) return NO(DENY.STATE_LOOKUP_FAILURE);
    grant = registry?.lookup?.(credentialId) ?? null;
  } catch {
    return NO(DENY.STATE_LOOKUP_FAILURE);
  }

  const parsed = parseAnthropicMessagesRequest(raw, { allowedBetas, pricingRevision: pricing?.revision ?? null });
  if (!parsed.allowed) return parsed;
  const request = parsed.request;

  if (!nonEmptyString(credentialId)) return NO(DENY.MISSING_KEY);
  if (!grant) return NO(DENY.UNKNOWN_KEY);
  if (!nonEmptyString(grant.model) || !Array.isArray(grant.allowedRoutes) || !shapeOk('RunBinding', grant.binding) || !nonEmptyString(grant.policyRevision)) {
    return NO(DENY.MALFORMED_GRANT);
  }
  if (grant.state !== 'active') return NO(grant.state === 'revoked' ? DENY.KEY_REVOKED : DENY.UNKNOWN_KEY);
  if (!nonEmptyString(grant.expiresAt) || !(Date.parse(grant.expiresAt) > Date.parse(now))) return NO(DENY.KEY_EXPIRED);
  if (grant.model !== MODEL_ALIAS) return NO(DENY.MODEL_NOT_ALLOWED);
  // Exact, single-route, non-wildcard allowlist: mixed or empty routes deny.
  if (grant.allowedRoutes.length !== 1 || grant.allowedRoutes[0] !== MESSAGES_ROUTE) return NO(DENY.ROUTE_NOT_ALLOWED);

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

  const estimate = estimateCostMicrousd({ pricing, request, observation });
  if (!estimate.allowed) return estimate;
  const reservation = reserveBudget(ledger, requestId, estimate.costMicrousd, { store });
  if (!reservation.allowed) return reservation;
  return OK({ reservationId: reservation.requestId ?? requestId, reservedMicrousd: estimate.costMicrousd });
}

const pick = (obj, fields) => Object.fromEntries(fields.map((f) => [f, obj[f]]));

// ---------------------------------------------------------------------------
// 6. Synthetic stream validation (pure; not a wire/SSE translator).
// ---------------------------------------------------------------------------
const validStartUsage = (u) => isPlainObject(u) && Number.isSafeInteger(u.input_tokens) && u.input_tokens >= 0;
const validDeltaUsage = (u) => isPlainObject(u) && Number.isSafeInteger(u.output_tokens) && u.output_tokens > 0;

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

export const RECONCILE = Object.freeze({
  SUCCESS: 'success',
  PRE_DISPATCH_REJECTION: 'pre_dispatch_rejection',
  ERROR_AFTER_DISPATCH: 'error_after_dispatch',
  CANCELLED: 'cancelled',
  UNKNOWN: 'unknown',
});
