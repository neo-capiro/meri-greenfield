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
// Independent tenant usage-overview wire2. Run-level attempts and conversation threads, never complete jobs.

export type UsageOverviewEnvelope2 = UsageOverviewRequest2 | UsageOverviewResponse2;

export interface UsageOverviewRequest2 {
  schemaVersion: 'meri.usage-overview/2';
}
export interface UsageOverviewResponse2 {
  schemaVersion: 'meri.usage-overview/2';
  observedAt: string;
  timezone: 'UTC';
  currency: 'USD';
  countersCoverage: 'recorded-runs-only';
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
      recorded: {
        queued: number;
        starting: number;
        running: number;
        'waiting-for-approval': number;
        paused: number;
        completed: number;
        failed: number;
        cancelled: number;
      };
      conversationThreads: {
        status: 'measured' | 'unavailable';
        basis: 'distinct-conversation-id-by-run-created-at';
        threads: number | null;
        attempts: number | null;
      };
      completedAttempts: {
        status: 'estimated' | 'unavailable';
        chargeBasis: 'sdk-list-estimate';
        jobIdentity: 'not-a-job-denominator';
        attempts: number;
        knownChargeMicroUsd: number;
        microUsdPerCompletedAttempt: number | null;
        attemptsWithoutRecordedUsage: number;
      };
      partialOrFailed: {
        status: 'estimated' | 'unavailable';
        chargeBasis: 'sdk-list-estimate';
        failedAttempts: number;
        cancelledAttempts: number;
        recordedAttempts: number;
        knownChargeMicroUsd: number;
        microUsdPerRecordedAttempt: number | null;
      };
      liability: {
        chargeBasis: 'sdk-list-estimate';
        recordedAttempts: number;
        knownChargeMicroUsd: number;
        microUsdPerRecordedAttempt: number | null;
        unavailableAttempts: number;
        notRecordedAttempts: number;
      };
      lineage: {
        basis: 'sdk_usage.parentRunId plus the run binding writerFence: absent parent = root thread start; writerFence 1 = fork into a separate logical thread; writerFence 2 or more = resume continuation of the same thread';
        root: {
          attempts: number;
          chargeMicroUsd: number;
        };
        fork: {
          attempts: number;
          chargeMicroUsd: number;
        };
        resume: {
          attempts: number;
          chargeMicroUsd: number;
        };
        'unknown-lineage': {
          attempts: number;
          chargeMicroUsd: number;
        };
      };
      counters: {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens: number;
        cacheCreationInputTokens: number;
        webSearchRequests: number;
        toolInvocations: number;
        toolFailures: number;
      };
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
      recorded: {
        queued: number;
        starting: number;
        running: number;
        'waiting-for-approval': number;
        paused: number;
        completed: number;
        failed: number;
        cancelled: number;
      };
      conversationThreads: {
        status: 'measured' | 'unavailable';
        basis: 'distinct-conversation-id-by-run-created-at';
        threads: number | null;
        attempts: number | null;
      };
      completedAttempts: {
        status: 'estimated' | 'unavailable';
        chargeBasis: 'sdk-list-estimate';
        jobIdentity: 'not-a-job-denominator';
        attempts: number;
        knownChargeMicroUsd: number;
        microUsdPerCompletedAttempt: number | null;
        attemptsWithoutRecordedUsage: number;
      };
      partialOrFailed: {
        status: 'estimated' | 'unavailable';
        chargeBasis: 'sdk-list-estimate';
        failedAttempts: number;
        cancelledAttempts: number;
        recordedAttempts: number;
        knownChargeMicroUsd: number;
        microUsdPerRecordedAttempt: number | null;
      };
      liability: {
        chargeBasis: 'sdk-list-estimate';
        recordedAttempts: number;
        knownChargeMicroUsd: number;
        microUsdPerRecordedAttempt: number | null;
        unavailableAttempts: number;
        notRecordedAttempts: number;
      };
      lineage: {
        basis: 'sdk_usage.parentRunId plus the run binding writerFence: absent parent = root thread start; writerFence 1 = fork into a separate logical thread; writerFence 2 or more = resume continuation of the same thread';
        root: {
          attempts: number;
          chargeMicroUsd: number;
        };
        fork: {
          attempts: number;
          chargeMicroUsd: number;
        };
        resume: {
          attempts: number;
          chargeMicroUsd: number;
        };
        'unknown-lineage': {
          attempts: number;
          chargeMicroUsd: number;
        };
      };
      counters: {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens: number;
        cacheCreationInputTokens: number;
        webSearchRequests: number;
        toolInvocations: number;
        toolFailures: number;
      };
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
      recorded: {
        queued: number;
        starting: number;
        running: number;
        'waiting-for-approval': number;
        paused: number;
        completed: number;
        failed: number;
        cancelled: number;
      };
      conversationThreads: {
        status: 'measured' | 'unavailable';
        basis: 'distinct-conversation-id-by-run-created-at';
        threads: number | null;
        attempts: number | null;
      };
      completedAttempts: {
        status: 'estimated' | 'unavailable';
        chargeBasis: 'sdk-list-estimate';
        jobIdentity: 'not-a-job-denominator';
        attempts: number;
        knownChargeMicroUsd: number;
        microUsdPerCompletedAttempt: number | null;
        attemptsWithoutRecordedUsage: number;
      };
      partialOrFailed: {
        status: 'estimated' | 'unavailable';
        chargeBasis: 'sdk-list-estimate';
        failedAttempts: number;
        cancelledAttempts: number;
        recordedAttempts: number;
        knownChargeMicroUsd: number;
        microUsdPerRecordedAttempt: number | null;
      };
      liability: {
        chargeBasis: 'sdk-list-estimate';
        recordedAttempts: number;
        knownChargeMicroUsd: number;
        microUsdPerRecordedAttempt: number | null;
        unavailableAttempts: number;
        notRecordedAttempts: number;
      };
      lineage: {
        basis: 'sdk_usage.parentRunId plus the run binding writerFence: absent parent = root thread start; writerFence 1 = fork into a separate logical thread; writerFence 2 or more = resume continuation of the same thread';
        root: {
          attempts: number;
          chargeMicroUsd: number;
        };
        fork: {
          attempts: number;
          chargeMicroUsd: number;
        };
        resume: {
          attempts: number;
          chargeMicroUsd: number;
        };
        'unknown-lineage': {
          attempts: number;
          chargeMicroUsd: number;
        };
      };
      counters: {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens: number;
        cacheCreationInputTokens: number;
        webSearchRequests: number;
        toolInvocations: number;
        toolFailures: number;
      };
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
    chargeBasis: 'sdk-list-estimate';
    providerBilledMicroUsd: null;
    completeJobCost: 'estimated';
  };
  denominators: {
    attempts: 'run rows in the ledger; one run is one attempt or turn, never a job';
    conversationThreads: 'distinct conversation_id with at least one run created in the period; a thread may host several attempts';
    sustainedJobs: 'canonical ROOT Work/Delegate objectives: the run whose stored request carries request.work with entry start-work|delegate, together with every run that continues it through the persisted continuation custody. A child assignment, conversation thread, SDK attempt or one completed run is never a job';
  };
  jobIdentity: {
    status: 'measured';
    definition: 'one whole job is the canonical ROOT Work/Delegate objective across its continuations and current goal revision; it is never a child assignment, conversation thread, SDK attempt or one completed run';
    lineage: 'a run continues another objective only when the canonical continuation owner verifies that run stored continuation envelope in the same transaction and that envelope is a resume naming that source run stored request, so its source request digest equals the source run request_sha256; a fork and a run without that verified custody each start a new objective, because the canonical prompt identity owner makes a fork and a next prompt new logical prompts';
    closure: 'the existing completion producer decides. successful = every current revision is completed and carries a PUBLISHED native-session completion capture whose identity pins that revision, with no unresolved successor and no unsettled child receipt; failed = every current revision reached failed; cancelled = every current revision reached cancelled; partial = a current revision is still in flight, or terminal revisions carry mixed outcomes; unclosed = a current revision is terminal without that closure proof, or a continuation control is unresolved (not APPLIED, or its successor revision is outside this read window), or a child receipt is unresolved';
    owner: 'the existing lifecycle completion producer (meri_conversations.completion_checkpoints) read over the existing run and control lineage; no second store, ledger, scheduler or table is created';
    /**
     * @minItems 5
     * @maxItems 5
     */
    states: [
      'successful' | 'partial' | 'failed' | 'cancelled' | 'unclosed',
      'successful' | 'partial' | 'failed' | 'cancelled' | 'unclosed',
      'successful' | 'partial' | 'failed' | 'cancelled' | 'unclosed',
      'successful' | 'partial' | 'failed' | 'cancelled' | 'unclosed',
      'successful' | 'partial' | 'failed' | 'cancelled' | 'unclosed'
    ];
  };
  wholeJobs: {
    basis: 'canonical ROOT Work/Delegate objectives: the run whose stored request carries request.work with entry start-work|delegate, together with every run that continues it through the persisted continuation custody. A child assignment, conversation thread, SDK attempt or one completed run is never a job';
    window: 'root revision created within the admitted month window';
    states: {
      successful: {
        jobs: number;
        attempts: number;
        knownChargeMicroUsd: number;
      };
      partial: {
        jobs: number;
        attempts: number;
        knownChargeMicroUsd: number;
      };
      failed: {
        jobs: number;
        attempts: number;
        knownChargeMicroUsd: number;
      };
      cancelled: {
        jobs: number;
        attempts: number;
        knownChargeMicroUsd: number;
      };
      unclosed: {
        jobs: number;
        attempts: number;
        knownChargeMicroUsd: number;
      };
    };
    jobs: number;
    attempts: number;
    revisions: number;
    steerRevisions: number;
    tails: number;
    settledRevisions: number;
    closurePending: number;
    unresolvedSuccessors: number;
    unsettledChildren: number;
    knownChargeMicroUsd: number;
    microUsdPerSuccessfulJob: number | null;
    coverage: {
      jobsWithRecordedUsage: number;
      jobsWithUnavailableUsage: number;
      revisionsWithRootOutsideWindow: number;
      chargeAttribution: 'whole-job-lineage-at-root-revision-window';
      windowEdge: 'a revision created after the window is not read, so a job whose continuation falls outside the window is reported from the revisions inside it only, and a continuation whose root revision is outside the window is excluded and counted';
      providerBilledMicroUsd: null;
      completeJobCost: 'estimated';
    };
  };
  categories: {
    inputTokens: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    outputTokens: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    reasoningTokens: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    cacheReadInputTokens: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    cacheCreationInputTokens: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    webSearchRequests: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    toolInvocations: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    toolOutcomes: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    cost: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    providerBilledMicroUsd: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    subagentCost: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    compactionCost: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    verificationCost: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    infrastructureCost: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    retryCost: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    fallbackCost: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    extractionCost: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
    activityCapacity: 'measured' | 'estimated' | 'inside-another-counter' | 'unresolved' | 'unavailable';
  };
  occupiedCapacity: {
    status: 'unavailable';
    reason: string;
  };
}

declare const admittedUsageOverviewRequest2:unique symbol;
export type AdmittedUsageOverviewRequest2=Readonly<UsageOverviewRequest2>&{readonly [admittedUsageOverviewRequest2]:true};
export type UsageOverviewErrorCodeV2="INVALID_REQUEST"|"UNAUTHENTICATED"|"ACCESS_DENIED"|"MEMBERSHIP_REVOKED"|"NOT_FOUND"|"METHOD_NOT_ALLOWED"|"DEADLINE"|"MEMBERSHIP_CHANGED"|"REQUEST_TOO_LARGE"|"UNSUPPORTED_MEDIA_TYPE"|"CANCELLED"|"PRODUCT_UNAVAILABLE"|"USAGE_OVERVIEW_REQUEST_INVALID"|"USAGE_OVERVIEW_CORRUPT"|"USAGE_OVERVIEW_UNAVAILABLE";
export interface UsageOverviewErrorResponse2 {
  error: {
    code: UsageOverviewErrorCodeV2;
    outcome?: 'UNKNOWN';
  };
}
export declare const USAGE_OVERVIEW_SCHEMA_V2:'meri.usage-overview/2';
export declare const usageOverviewMetadataV2:{
  "schemaId": "urn:meri:usage-overview:2.0.0",
  "version": "2.0.0",
  "path": "/api/conversations/usage-overview",
  "method": "POST",
  "requestBytes": 1024,
  "responseBytes": 32768,
  "authentication": "current native tenant membership, rechecked before release",
  "scope": "tenant aggregate numbers only; no conversation, client or other member identifiers",
  "currency": "USD",
  "money": "integer micro-USD of known recorded SDK estimates; missing or unavailable accounting is not zero cost",
  "periods": "UTC day, ISO Monday week and calendar month; attempt cohorts and conversation threads use run.createdAt, whole jobs use the root revision createdAt, admission cap uses sdk_usage_recorded_at",
  "limits": "current canonical SDK limits and tenant admission cap; no reservations or budget editing",
  "capacity": "recorded durable states only; no physical worker concurrency or available capacity observation",
  "economics": "attempts, conversation threads and canonical root Work/Delegate objectives with successful/partial/failed/cancelled/unclosed separated; the charge is an SDK list-price estimate; provider billing and physical capacity are unavailable"
};
export declare function receiveUsageOverviewRequestV2(bytes:Uint8Array):AdmittedUsageOverviewRequest2;
export declare function receiveUsageOverviewResponseV2(status:number,bytes:Uint8Array,request:AdmittedUsageOverviewRequest2):UsageOverviewResponse2|UsageOverviewErrorResponse2;
