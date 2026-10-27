// Generated recorded usage projection. No authority, billing, external-effect or row-correlation claim.

export type ConversationUsageEnvelope = ConversationUsageRequest | ConversationUsageResponse;

export interface ConversationUsageRequest {
  schemaVersion: 'meri.conversation-usage/1';
  conversationId: string;
  runId: string;
}
export interface ConversationUsageResponse {
  schemaVersion: 'meri.conversation-usage/1';
  conversationId: string;
  runId: string;
  recording: 'not-recorded' | 'recorded';
  usage: RecordedUsage | null;
  toolAudit: RecordedToolAudit | null;
}
export interface RecordedUsage {
  status: 'recorded' | 'unavailable';
  reason:
    | (
        | 'configuration_mismatch'
        | 'result_unavailable'
        | 'baseline_mismatch'
        | 'baseline_unavailable'
        | 'baseline_configuration_mismatch'
        | 'lineage_unavailable'
        | 'counters_reset'
        | 'estimate_mismatch'
        | 'rates_unavailable'
        | 'amount_out_of_range'
      )
    | null;
  currency: 'USD';
  runDelta: UsageRunDelta | null;
  cumulative: UsageCumulative | null;
  providerBilledUsd: null;
}
export interface UsageRunDelta {
  sdkEstimateUsd: number;
  /**
   * @minItems 1
   * @maxItems 32
   */
  modelCounters: [UsageModelCounters, ...UsageModelCounters[]];
}
export interface UsageModelCounters {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
}
export interface UsageCumulative {
  sdkEstimateUsd: number;
  basis: UsageBasis;
  /**
   * @minItems 1
   * @maxItems 32
   */
  models: [UsageModelEstimate, ...UsageModelEstimate[]];
}
export interface UsageBasis {
  sdk: string;
  cli: string;
  provider: 'bedrock' | 'claude-api';
  cacheWriteTtl: '5m' | '1h';
  priceRevision: string;
}
export interface UsageModelEstimate {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  sdkEstimateUsd: number;
  provider: 'bedrock' | 'firstParty' | 'unknown';
  costBasis: 'list' | 'unknown';
}
export interface RecordedToolAudit {
  coverage: 'recorded-hooks-only';
  partial: boolean;
  omitted: number;
  /**
   * @maxItems 128
   */
  tools: RecordedToolOutcome[];
}
export interface RecordedToolOutcome {
  name: string;
  executionOutcome: 'completed' | 'failed';
  durationMs: number | null;
}

declare const admittedUsageRequest:unique symbol;
export type AdmittedConversationUsageRequest=Readonly<ConversationUsageRequest>&{readonly [admittedUsageRequest]:true};
export interface ConversationUsageErrorResponse {error:{code:string};}
export declare class ConversationUsageResponseError extends Error {readonly code:string;}
export declare const CONVERSATION_USAGE_SCHEMA:'meri.conversation-usage/1',CONVERSATION_USAGE_PATH:'/api/conversations/usage';
export declare const conversationUsageMetadata:{
  "version": "1.0.0",
  "packageVersion": "0.1.15",
  "schemaId": "urn:meri:conversation-usage:1.0.0",
  "path": "/api/conversations/usage",
  "method": "POST",
  "requestBytes": 4096,
  "responseBytes": 131072,
  "maxModels": 32,
  "maxTools": 128,
  "authentication": "current native product bearer and Core access",
  "currency": "USD",
  "money": "recorded SDK estimate; provider billing unavailable",
  "counters": "original token/cache-token counts and web-search request counts",
  "durationUnit": "milliseconds; null means unknown",
  "cumulativeScope": "SDK query pipeline including subagents/compaction and prior resumed/forked usage",
  "runScope": "existing accounting run delta",
  "tools": "recorded post-tool execution outcomes only; not external-effect confirmation",
  "coverage": "recorded hooks only; omitted count is explicit",
  "correlation": "none with UI tool.call requestId, source references or other rows",
  "identifiers": "bounded inert text; never links, commands or authority"
};
export declare const conversationUsageErrors:Readonly<Record<string,readonly number[]>>;
export declare const usageCounterNames:readonly ["inputTokens","outputTokens","cacheReadInputTokens","cacheCreationInputTokens","webSearchRequests"];
export declare const usageUnavailableReasons:readonly ["configuration_mismatch","result_unavailable","baseline_mismatch","baseline_unavailable","baseline_configuration_mismatch","lineage_unavailable","counters_reset","estimate_mismatch","rates_unavailable","amount_out_of_range"];
export declare function receiveConversationUsageRequest(bytes:Uint8Array):AdmittedConversationUsageRequest;
export declare function receiveConversationUsageResponse(status:number,bytes:Uint8Array,request:AdmittedConversationUsageRequest):ConversationUsageResponse|ConversationUsageErrorResponse;
// Independent tenant usage-overview wire1. No execution authority or complete-job economics claim.

export type UsageOverviewEnvelope = UsageOverviewRequest | UsageOverviewResponse;

export interface UsageOverviewRequest {
  schemaVersion: 'meri.usage-overview/1';
}
export interface UsageOverviewResponse {
  schemaVersion: 'meri.usage-overview/1';
  observedAt: string;
  timezone: 'UTC';
  policy:
    | {
        status: 'configured';
        revision: number;
        monthlyCapMicroUsd: number;
        maxTurns: number;
        maxBudgetMicroUsd: number;
      }
    | {
        status: 'unavailable';
        revision: null;
        monthlyCapMicroUsd: null;
        maxTurns: null;
        maxBudgetMicroUsd: null;
      };
  /**
   * @minItems 3
   * @maxItems 3
   */
  periods: [
    {
      kind: 'day' | 'week' | 'month';
      startInclusive: string;
      endExclusive: string;
      attempts: number;
      states: {
        queued: number;
        starting: number;
        running: number;
        'waiting-for-approval': number;
        paused: number;
        completed: number;
        failed: number;
        cancelled: number;
      };
      recording: {
        recorded: number;
        unavailable: number;
        notRecorded: number;
      };
      knownChargeMicroUsd: number;
      completedAttemptsWithRecordedUsage: number;
      completedAttemptKnownChargeMicroUsd: number;
    },
    {
      kind: 'day' | 'week' | 'month';
      startInclusive: string;
      endExclusive: string;
      attempts: number;
      states: {
        queued: number;
        starting: number;
        running: number;
        'waiting-for-approval': number;
        paused: number;
        completed: number;
        failed: number;
        cancelled: number;
      };
      recording: {
        recorded: number;
        unavailable: number;
        notRecorded: number;
      };
      knownChargeMicroUsd: number;
      completedAttemptsWithRecordedUsage: number;
      completedAttemptKnownChargeMicroUsd: number;
    },
    {
      kind: 'day' | 'week' | 'month';
      startInclusive: string;
      endExclusive: string;
      attempts: number;
      states: {
        queued: number;
        starting: number;
        running: number;
        'waiting-for-approval': number;
        paused: number;
        completed: number;
        failed: number;
        cancelled: number;
      };
      recording: {
        recorded: number;
        unavailable: number;
        notRecorded: number;
      };
      knownChargeMicroUsd: number;
      completedAttemptsWithRecordedUsage: number;
      completedAttemptKnownChargeMicroUsd: number;
    }
  ];
  monthlyAdmission: {
    startInclusive: string;
    knownChargeMicroUsd: number;
    unavailableRecordedAttempts: number;
    remainingKnownMicroUsd: number | null;
    reached: boolean | null;
  };
  queue: {
    basis: 'recorded-run-state';
    states: {
      queued: number;
      starting: number;
      running: number;
      'waiting-for-approval': number;
      paused: number;
      completed: number;
      failed: number;
      cancelled: number;
    };
    physicalConcurrency: null;
    availableCapacity: null;
    capacityStatus: 'unavailable';
  };
  coverage: {
    attemptPeriodBasis: 'run-created-at';
    admissionPeriodBasis: 'sdk-usage-recorded-at';
    chargeBasis: 'recorded-sdk-estimate';
    providerBilledMicroUsd: null;
    completeJobCost: 'unavailable';
  };
}

declare const admittedUsageOverviewRequest:unique symbol;
export type AdmittedUsageOverviewRequest=Readonly<UsageOverviewRequest>&{readonly [admittedUsageOverviewRequest]:true};
export interface UsageOverviewErrorResponse {error:{code:string;outcome?:'UNKNOWN'};}
export declare class UsageOverviewResponseError extends Error {readonly code:string;}
export declare const USAGE_OVERVIEW_SCHEMA:'meri.usage-overview/1',USAGE_OVERVIEW_PATH:'/api/conversations/usage-overview';
export declare const usageOverviewMetadata:{
  "schemaId": "urn:meri:usage-overview:1.0.0",
  "version": "1.0.0",
  "path": "/api/conversations/usage-overview",
  "method": "POST",
  "requestBytes": 1024,
  "responseBytes": 16384,
  "authentication": "current native tenant membership, rechecked before release",
  "scope": "tenant aggregate numbers only; no conversation, client or other member identifiers",
  "currency": "USD",
  "money": "integer micro-USD of known recorded SDK estimates; missing or unavailable accounting is not zero cost",
  "periods": "UTC day, ISO Monday week and calendar month; attempt cohorts use run.createdAt, admission cap uses sdk_usage_recorded_at",
  "limits": "current canonical SDK limits and tenant admission cap; no reservations or budget editing",
  "capacity": "recorded durable states only; no physical worker concurrency or available capacity observation",
  "economics": "attempts are not complete jobs; provider billing and complete-job economics unavailable"
};
export declare function receiveUsageOverviewRequest(bytes:Uint8Array):AdmittedUsageOverviewRequest;
export declare function receiveUsageOverviewResponse(status:number,bytes:Uint8Array,request:AdmittedUsageOverviewRequest):UsageOverviewResponse|UsageOverviewErrorResponse;
