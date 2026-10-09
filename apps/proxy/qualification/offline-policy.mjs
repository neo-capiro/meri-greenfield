// Meri W02-02 offline admission / budget policy reference.
//
// PURPOSE AND HONEST SCOPE
// ------------------------
// This module is a PURE, OFFLINE, DETERMINISTIC reference for the *missing
// application-level invariants* that LiteLLM's native virtual-key auth does NOT
// supply: authenticated task/run binding, current-run/fence/policy checks, and a
// safe-integer microUSD worst-case budget hold. It is a TEST REFERENCE ONLY.
//
// It is NOT a deployed auth service, NOT a replacement for LiteLLM's auth engine,
// NOT a production broker/token issuer/ledger, and NOT a gateway. It opens no
// socket, contacts no AWS/model/proxy/DB, and holds no secret. Passing its tests
// establishes NOTHING about deployed proxy behaviour or real authentication.
//
// It references the frozen contract shapes (RunBinding / Budgets, contracts 0.1.0)
// by structure only. It does NOT add actions, audiences or fields to
// CapabilityClaims, and a virtual key here is an attribution/expiry control, not
// proof of caller identity or current authorization.
//
// Cost figures used by callers are SYNTHETIC and are explicitly NOT current
// Bedrock prices. The authoritative application ceiling is safe integer microUSD
// (10000000 = the $10 aggregate qualification ceiling), never a floating dollar.

export const QUALIFICATION_CEILING_MICROUSD = 10_000_000; // $10 aggregate, all tasks/attempts/resumes/concurrent
export const NATIVE_TEAM_MAX_BUDGET_USD = 10; // one non-resetting LiteLLM team budget covering every task key
export const MODEL_ALIAS = 'meri-sonnet-qualification';
export const MESSAGES_ROUTE = '/v1/messages';
export const MESSAGES_METHOD = 'POST';
export const NATIVE_MODEL_ID = 'us.anthropic.claude-sonnet-4-6';
export const UPSTREAM_MODEL = 'bedrock/invoke/us.anthropic.claude-sonnet-4-6';
export const AWS_REGION = 'us-east-1';

// ---------------------------------------------------------------------------
// Reason codes. Every denial is explicit and visible; nothing fails open.
// ---------------------------------------------------------------------------
export const DENY = Object.freeze({
  MISSING_KEY: 'missing_key',
  UNKNOWN_KEY: 'unknown_key',
  KEY_EXPIRED: 'key_expired',
  KEY_REVOKED: 'key_revoked',
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
  UNSUPPORTED_BETA: 'unsupported_beta_header',
  UNSUPPORTED_CONTEXT_MANAGEMENT: 'unsupported_context_management',
  UNSUPPORTED_STRUCTURED_OUTPUT: 'unsupported_structured_output',
  UNSUPPORTED_SPEED: 'unsupported_speed_feature',
  UNSUPPORTED_CONTAINER: 'unsupported_container',
  UNSUPPORTED_SERVER_TOOL: 'unsupported_server_tool',
  UNSUPPORTED_PROXY_MCP: 'unsupported_proxy_mcp',
  ROUTING_OVERRIDE: 'routing_or_credential_override',
  UNAPPROVED_HELPER_MODEL: 'unapproved_helper_model',
  STREAM_ERROR_AFTER_200: 'stream_error_after_http200',
  STREAM_MISSING_TERMINAL: 'stream_missing_terminal_event',
  STREAM_MISSING_START: 'stream_missing_message_start',
  STREAM_OUT_OF_ORDER: 'stream_out_of_order_event',
  STREAM_MISSING_USAGE: 'stream_missing_usage',
  STREAM_TOOL_DELTA_BEFORE_BLOCK: 'tool_input_delta_before_completed_block',
  STREAM_CANCELLED: 'stream_cancelled',
});

const OK = (extra = {}) => ({ allowed: true, reasonCode: null, ...extra });
const NO = (reasonCode, extra = {}) => ({ allowed: false, reasonCode, ...extra });

const isSafeMicroUsd = (v) => Number.isSafeInteger(v) && v >= 0;
const isPositiveSafeMicroUsd = (v) => Number.isSafeInteger(v) && v > 0;

// ---------------------------------------------------------------------------
// Budget ledger: safe integer microUSD, in-memory, TTL-bound. Not durable.
// consumed  = settled actual spend
// outstanding = live reservations (in-flight)
// unresolved = holds retained for ambiguous charges (unknown usage / process loss)
// committed = consumed + outstanding + unresolved
// ---------------------------------------------------------------------------
export function createLedger() {
  return {
    revision: 0,
    consumedMicrousd: 0,
    reservations: new Map(), // requestId -> { amountMicrousd, state, createdAt, ttlTurns }
  };
}

export function committedMicrousd(ledger) {
  let total = ledger.consumedMicrousd;
  for (const r of ledger.reservations.values()) {
    if (r.state === 'outstanding' || r.state === 'unresolved') total += r.amountMicrousd;
  }
  return total;
}

// Reserve worst-case cost before dispatch. Denies unknown/nonpositive amounts
// (native strict mode still skips these, so admission must deny explicitly),
// duplicate request IDs, and any reservation that would cross the ceiling.
export function reserveBudget(ledger, requestId, amountMicrousd) {
  if (typeof requestId !== 'string' || requestId.length === 0) return NO(DENY.DUPLICATE_REQUEST);
  if (ledger.reservations.has(requestId)) return NO(DENY.DUPLICATE_REQUEST);
  if (!isPositiveSafeMicroUsd(amountMicrousd)) return NO(DENY.UNKNOWN_COST);
  const after = committedMicrousd(ledger) + amountMicrousd;
  if (!Number.isSafeInteger(after) || after > QUALIFICATION_CEILING_MICROUSD) {
    return NO(DENY.OVER_BUDGET, { committedMicrousd: committedMicrousd(ledger), attemptedMicrousd: amountMicrousd });
  }
  ledger.reservations.set(requestId, { amountMicrousd, state: 'outstanding', createdAt: null, ttlTurns: null });
  ledger.revision += 1;
  return OK({ reservationId: requestId, committedAfterMicrousd: after });
}

// Settle a reservation. This reference deliberately RETAINS a worst-case hold for
// ambiguous outcomes instead of trusting the upstream refund/TTL: only an explicit
// pre-dispatch rejection releases, and a settled success without actual_cost keeps
// the reserved upper bound as an unresolved hold.
export function settleBudget(ledger, requestId, { actualCostMicrousd = null, outcome } = {}) {
  const r = ledger.reservations.get(requestId);
  if (!r) return NO(DENY.UNKNOWN_KEY);
  if (r.state === 'settled' || r.state === 'released') return NO(DENY.DUPLICATE_REQUEST);
  switch (outcome) {
    case 'pre_dispatch_rejection':
      // Native cleanup may release to zero; nothing was dispatched, nothing billed.
      ledger.reservations.set(requestId, { ...r, amountMicrousd: 0, state: 'released' });
      break;
    case 'success':
      if (isSafeMicroUsd(actualCostMicrousd)) {
        ledger.consumedMicrousd += actualCostMicrousd;
        ledger.reservations.set(requestId, { ...r, amountMicrousd: 0, state: 'settled' });
      } else {
        // Missing actual_cost reconciles as zero natively; the reference keeps the
        // reserved upper bound as an unresolved hold instead of releasing it.
        ledger.reservations.set(requestId, { ...r, state: 'unresolved' });
      }
      break;
    case 'cancelled':
      if (isSafeMicroUsd(actualCostMicrousd)) {
        // Native cancellation settles estimated input and releases worst-case output.
        ledger.consumedMicrousd += actualCostMicrousd;
        ledger.reservations.set(requestId, { ...r, amountMicrousd: 0, state: 'settled' });
      } else {
        ledger.reservations.set(requestId, { ...r, state: 'unresolved' });
      }
      break;
    default:
      // error_after_dispatch, unknown, missing usage, HTTP200-with-error: retain hold.
      ledger.reservations.set(requestId, { ...r, state: 'unresolved' });
      break;
  }
  ledger.revision += 1;
  return OK({ state: ledger.reservations.get(requestId).state });
}

// TTL/process-loss: an abandoned outstanding reservation becomes an unresolved
// hold (retained), never silently dropped, so the worst case still counts.
export function expireReservations(ledger) {
  let expired = 0;
  for (const [id, r] of ledger.reservations) {
    if (r.state === 'outstanding') {
      ledger.reservations.set(id, { ...r, state: 'unresolved' });
      expired += 1;
    }
  }
  if (expired > 0) ledger.revision += 1;
  return { expired };
}

// No automatic retries or fresh-budget resets. A reset attempt is refused.
export function attemptBudgetReset() {
  return NO(DENY.RESET_FORBIDDEN);
}

// ---------------------------------------------------------------------------
// Cost estimation: safe integer microUSD, charges the highest applicable tier.
// pricing is synthetic fixture data, explicitly NOT current Bedrock prices.
// ---------------------------------------------------------------------------
export function estimateCostMicrousd({ pricing, request }) {
  const model = pricing?.models?.[request.model];
  if (!model) return NO(DENY.UNKNOWN_COST);
  if (pricing.revision !== request.pricingRevision) return NO(DENY.STALE_PRICING);

  const input = request.inputTokens;
  const output = request.maxOutputTokens;
  if (!isPositiveSafeMicroUsd(input) || !isPositiveSafeMicroUsd(output)) {
    return NO(output == null ? DENY.MISSING_OUTPUT_BOUND : DENY.UNKNOWN_COST);
  }
  if (input > model.maxInputTokens) return NO(DENY.OVERSIZE_INPUT);
  if (output > model.maxOutputTokens) return NO(DENY.OVERSIZE_OUTPUT);

  const thinking = request.thinkingTokens ?? 0;
  const cacheWrite = request.cacheWriteTokens ?? 0;
  const cacheRead = request.cacheReadTokens ?? 0;
  for (const v of [thinking, cacheWrite, cacheRead]) {
    if (!isSafeMicroUsd(v)) return NO(DENY.UNKNOWN_COST);
  }
  if (thinking > output) return NO(DENY.UNKNOWN_COST);

  // perMTok is dollars-per-million-tokens == microUSD-per-token, so integer
  // microUSD = tokens * perMTok. Thinking is charged at the higher output tier.
  const outputTier = Math.max(model.outputPerMTok, model.thinkingOutputPerMTok);
  const raw =
    input * model.inputPerMTok +
    (output - thinking) * model.outputPerMTok +
    thinking * outputTier +
    cacheWrite * model.cacheWritePerMTok +
    cacheRead * model.cacheReadPerMTok;
  const costMicrousd = Math.ceil(raw);
  if (!isPositiveSafeMicroUsd(costMicrousd)) return NO(DENY.UNKNOWN_COST);
  return OK({ costMicrousd, worstCaseInputOnlyMicrousd: Math.ceil(input * model.inputPerMTok) });
}

// ---------------------------------------------------------------------------
// Feature admission: freeze the supported Messages subset BEFORE translation.
// The Bedrock adapter silently drops unmapped betas / context_management /
// unsupported top-level fields, so silent loss must be prevented by admission.
// ---------------------------------------------------------------------------
export function admitMessagesFeatures(request, { allowedBetas = [] } = {}) {
  const betas = request.betas ?? [];
  for (const b of betas) {
    if (!allowedBetas.includes(b)) return NO(DENY.UNSUPPORTED_BETA, { beta: b });
  }
  if (request.hasContextManagement) return NO(DENY.UNSUPPORTED_CONTEXT_MANAGEMENT);
  if (request.hasStructuredOutput) return NO(DENY.UNSUPPORTED_STRUCTURED_OUTPUT);
  if (request.speed) return NO(DENY.UNSUPPORTED_SPEED);
  if (request.container) return NO(DENY.UNSUPPORTED_CONTAINER);
  if (Array.isArray(request.serverTools) && request.serverTools.length > 0) return NO(DENY.UNSUPPORTED_SERVER_TOOL);
  if (request.proxyMcp) return NO(DENY.UNSUPPORTED_PROXY_MCP);
  if (request.routingOverride || request.apiBaseOverride || request.credentialOverride || request.modelIdOverride) {
    return NO(DENY.ROUTING_OVERRIDE);
  }
  if (request.helperModel != null && request.helperModel !== MODEL_ALIAS) return NO(DENY.UNAPPROVED_HELPER_MODEL);
  return OK();
}

// ---------------------------------------------------------------------------
// Full admission for one model request. Trusted task identity MUST come from an
// authenticated broker/channel observation (source === 'broker'); caller headers
// and self-asserted metadata are attribution only and cannot authorize.
// ---------------------------------------------------------------------------
export function admitModelRequest({ now, key, trustedIdentity, run, request, ledger, pricing, store = {}, allowedBetas = [] }) {
  // Fail closed on any state lookup failure.
  if (store.failure) return NO(DENY.STATE_LOOKUP_FAILURE);

  if (!key) return NO(DENY.MISSING_KEY);
  if (key.state !== 'active') return NO(DENY.UNKNOWN_KEY);
  if (key.revoked === true) return NO(DENY.KEY_REVOKED);
  if (typeof key.expiresAt !== 'string' || !(Date.parse(key.expiresAt) > Date.parse(now))) return NO(DENY.KEY_EXPIRED);

  if (!trustedIdentity) return NO(DENY.MISSING_TRUSTED_IDENTITY);
  if (trustedIdentity.source !== 'broker') return NO(DENY.UNTRUSTED_IDENTITY_SOURCE);
  if (!run || run.state !== 'active') return NO(DENY.RUN_NOT_ACTIVE);

  // Stable identity must match the run binding exactly.
  for (const f of ['tenantId', 'actorId', 'conversationId', 'runId']) {
    if (trustedIdentity[f] !== run.binding[f]) return NO(DENY.BINDING_MISMATCH, { field: f });
  }
  // Current attempt/worker/fence: stale executor is denied even if the stable
  // binding matches. New workers get a new key after the authoritative update.
  if (trustedIdentity.attemptId !== run.binding.attemptId) return NO(DENY.STALE_ATTEMPT);
  if (trustedIdentity.workerId !== run.binding.workerId) return NO(DENY.STALE_WORKER);
  if (trustedIdentity.writerFence !== run.binding.writerFence) return NO(DENY.STALE_FENCE);
  if (trustedIdentity.policyRevision !== run.policyRevision) return NO(DENY.STALE_POLICY_REVISION);

  // Exact model/route allowlist. No wildcard, alias, encoded/traversal variant or
  // unknown route. Key carries the single alias and the exact allowed route.
  if (request.model !== MODEL_ALIAS || key.model !== MODEL_ALIAS) return NO(DENY.MODEL_NOT_ALLOWED);
  if (request.route !== MESSAGES_ROUTE || request.method !== MESSAGES_METHOD) return NO(DENY.ROUTE_NOT_ALLOWED);
  if (Array.isArray(key.allowedRoutes) && !key.allowedRoutes.includes(request.route)) return NO(DENY.ROUTE_NOT_ALLOWED);

  const features = admitMessagesFeatures(request, { allowedBetas });
  if (!features.allowed) return features;

  const estimate = estimateCostMicrousd({ pricing, request });
  if (!estimate.allowed) return estimate;

  const reservation = reserveBudget(ledger, request.requestId, estimate.costMicrousd);
  if (!reservation.allowed) return reservation;

  return OK({ reservationId: reservation.reservationId, reservedMicrousd: estimate.costMicrousd });
}

// ---------------------------------------------------------------------------
// Synthetic stream validation. Semantic failures stay visible and can never mark
// a run successful, execute a partial tool command, refund unknown spend or
// trigger an automatic retry.
// ---------------------------------------------------------------------------
export function validateStream(events = []) {
  const result = { ok: false, success: false, reasonCode: null, terminalSeen: false, usageSeen: false, completedToolBlocks: [] };
  if (!Array.isArray(events) || events.length === 0) return { ...result, reasonCode: DENY.STREAM_MISSING_START };
  if (events[0].type !== 'message_start') return { ...result, reasonCode: DENY.STREAM_MISSING_START };

  const openBlocks = new Set();
  for (let i = 1; i < events.length; i++) {
    const e = events[i];
    switch (e.type) {
      case 'content_block_start':
        openBlocks.add(e.index);
        break;
      case 'content_block_delta':
        if (!openBlocks.has(e.index)) return { ...result, reasonCode: DENY.STREAM_OUT_OF_ORDER };
        if (e.deltaType === 'input_json_delta' && e.blockKind !== 'tool_use') {
          return { ...result, reasonCode: DENY.STREAM_TOOL_DELTA_BEFORE_BLOCK };
        }
        break;
      case 'content_block_stop':
        if (!openBlocks.has(e.index)) return { ...result, reasonCode: DENY.STREAM_OUT_OF_ORDER };
        openBlocks.delete(e.index);
        if (e.blockKind === 'tool_use') result.completedToolBlocks.push(e.index);
        break;
      case 'message_delta':
        if (e.usage != null) result.usageSeen = true;
        break;
      case 'message_stop':
        result.terminalSeen = true;
        break;
      case 'error':
        return { ...result, reasonCode: DENY.STREAM_ERROR_AFTER_200 };
      case 'cancelled':
        return { ...result, reasonCode: DENY.STREAM_CANCELLED };
      default:
        return { ...result, reasonCode: DENY.STREAM_OUT_OF_ORDER };
    }
  }
  if (!result.terminalSeen) return { ...result, reasonCode: DENY.STREAM_MISSING_TERMINAL };
  if (!result.usageSeen) return { ...result, reasonCode: DENY.STREAM_MISSING_USAGE };
  return { ...result, ok: true, success: true, reasonCode: null };
}

// Explicit negative-outcome labels for reconciliation evidence. Success,
// pre-dispatch rejection, provider error, post-dispatch timeout and unknown
// outcome must be distinguished, and none of them may auto-retry.
export const RECONCILE = Object.freeze({
  SUCCESS: 'success',
  PRE_DISPATCH_REJECTION: 'pre_dispatch_rejection',
  ERROR_AFTER_DISPATCH: 'error_after_dispatch',
  CANCELLED: 'cancelled',
  UNKNOWN: 'unknown',
});
