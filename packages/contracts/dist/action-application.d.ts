// Generated from canonical action receiving schema. No authorization implied.

export type ActionApplicationEnvelope =
  ActionQueryResponse | ActionDraftResponse | ActionPrepareResponse | ActionExecuteResponse | ActionErrorResponse;
export type Canonical_UIEvent_1691B714 =
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: Canonical_RunBinding_84F2304C;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
      type: 'run.status';
      data: {
        state:
          'queued' | 'starting' | 'running' | 'waiting-for-approval' | 'paused' | 'completed' | 'failed' | 'cancelled';
        reasonCode: string | null;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: Canonical_RunBinding_84F2304C;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
      type: 'message.delta';
      data: {
        messageId: string;
        text: string;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: Canonical_RunBinding_84F2304C;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
      type: 'tool.started';
      data: {
        requestId: string;
        tool: string;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: Canonical_RunBinding_84F2304C;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
      type: 'tool.completed';
      data: {
        requestId: string;
        resultReference: string;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: Canonical_RunBinding_84F2304C;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
      type: 'source.available';
      data: Canonical_SourceEvidenceD9008775;
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: Canonical_RunBinding_84F2304C;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
      type: 'approval.required';
      data: {
        proposalId: string;
        commandSha256: string;
        expiresAt: string;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: Canonical_RunBinding_84F2304C;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
      type: 'artifact.available';
      data: {
        artifactId: string;
        versionId: string;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: Canonical_RunBinding_84F2304C;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
      type: 'checkpoint.verified';
      data: {
        checkpointId: string;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: Canonical_RunBinding_84F2304C;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
      type: 'usage.recorded';
      data: {
        usageId: string;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: Canonical_RunBinding_84F2304C;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
      type: 'run.error';
      data: {
        code: string;
        retryable: boolean;
        message: string;
      };
    };
export type Canonical_NormalizedWindowE50Ec0Ed =
  | {
      basis: 'calendar-week' | 'calendar-month' | 'calendar-year' | 'relative-duration' | 'explicit';
      startInclusive: string;
      endExclusive: string;
      timezone: string;
      weekStartsOn: ('monday' | 'sunday') | null;
    }
  | {
      basis: 'fiscal-year';
      year: number;
      calendarId: string;
      stage: 'requested' | 'authorized' | 'appropriated' | 'obligated' | 'actual' | 'outlay';
      revisionId: string;
      startInclusive: string;
      endExclusive: string;
      timezone: string;
    }
  | {
      basis: 'unbounded';
    };
/**
 * @minItems 0
 * @maxItems 4096
 */
export type CanonicalAppliedFilters_13Ba99B6 = {
  name: string;
  valueSha256: string;
}[];
export type Canonical_ActionStatus_21422Bf6 =
  | 'new'
  | 'triaged'
  | 'assigned'
  | 'drafting'
  | 'ready_for_review'
  | 'sent_to_client'
  | 'outreach_completed'
  | 'monitoring'
  | 'dismissed'
  | 'archived';
export type Canonical_ActionSortCe05E4A0 = 'deadline' | 'priority';
export type Canonical_ActionTypeB0113Df0 =
  | 'protect_funding'
  | 'restore_cut'
  | 'add_report_language'
  | 'oppose_restriction'
  | 'district_one_pager'
  | 'monitor_procurement'
  | 'client_alert'
  | 'schedule_outreach'
  | 'escalate_uncertainty'
  | 'update_compliance_notes';
export type Canonical_DeadlineSourceC0Cee855 = 'sam_response' | 'markup_window' | 'hearing' | 'manual';
export type Canonical_ConfidenceBand_1337A6D6 = 'high' | 'medium' | 'low';
export type ActionExecuteResponse =
  | {
      status: 'observed';
      outcome: {
        receipt: Canonical_CommandReceiptAc49Ee1E;
        result: Canonical_TaskCreateResult_0501C509;
      };
    }
  | {
      status: 'indeterminate';
      outcome: null;
    };

export interface ActionQueryResponse {
  lookupId: string;
  resultReference: string;
  resultSha256: string;
  classification: 'recommendations';
  acceptedTasks: false;
  /**
   * @minItems 2
   * @maxItems 2
   */
  events: [Canonical_UIEvent_1691B714, Canonical_UIEvent_1691B714];
  observation: {
    binding: Canonical_RunBinding_84F2304C;
    subject: Canonical_ResolvedSubject_470B2Bbc;
    operation: {
      id: 'actions.query';
      version: '0.2.0';
    };
    argumentsSha256: string;
    result: Canonical_ActionItemClientScopedPage_872C93Ea;
  };
}
export interface Canonical_RunBinding_84F2304C {
  tenantId: string;
  actorId: string;
  conversationId: string;
  runId: string;
  attemptId: string;
  workerId: string;
  writerFence: number;
}
export interface Canonical_ScopeF882Edb5 {
  tenantId: string;
  kind: 'tenant' | 'client' | 'mailbox' | 'memory' | 'document' | 'private-user' | 'public';
  resourceId: string;
  policyRevision: string;
}
export interface Canonical_SourceEvidenceD9008775 {
  sourceId: string;
  recordId: string;
  sourceVersionId: string;
  observedAt: string;
  sourceUpdatedAt: string | null;
  citationId: string;
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  contentSha256: string;
  authorizationDecisionId: string;
}
export interface Canonical_ResolvedSubject_470B2Bbc {
  kind: 'client' | 'portfolio' | 'personal' | 'entity';
  entityType:
    | 'client'
    | 'person'
    | 'organization'
    | 'program-element'
    | 'bill'
    | 'docket'
    | 'funding-opportunity'
    | 'research-portfolio'
    | 'prospect'
    | 'user';
  /**
   * @minItems 1
   * @maxItems 4096
   */
  entityIds: [string, ...string[]];
  tenantId: string;
  actorId: string;
  authorizationDecisionId: string;
  policyRevision: string;
  /**
   * @minItems 1
   * @maxItems 4096
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  rosterVersionId: string | null;
}
export interface Canonical_ActionItemClientScopedPage_872C93Ea {
  kind: 'action-item-client-scoped-page';
  contractVersion: '0.2.0';
  operation: {
    id: 'query_action_items';
    version: '0.2.0';
  };
  requestId: string;
  traceId: string;
  binding: Canonical_RunBinding_84F2304C;
  subject: Canonical_ResolvedSubject_470B2Bbc;
  window: Canonical_NormalizedWindowE50Ec0Ed;
  argumentsSha256: string;
  appliedFilters: CanonicalAppliedFilters_13Ba99B6;
  generatedAt: string;
  /**
   * @minItems 1
   * @maxItems 4096
   */
  sources: [Canonical_SourceState_466075C2, ...Canonical_SourceState_466075C2[]];
  coverage: Canonical_CoverageA7C3Afed;
  selection: Canonical_ActionItemClientScopedSelection_8Ef7E563;
  order:
    | 'deadline-asc_nulls-last_priority-desc_id-asc-owner-unconfirmed'
    | 'priority-desc_deadline-asc_nulls-last_id-asc-owner-unconfirmed';
  snapshotVersionId: null;
  clientId: string;
  scope: Canonical_ActionItemReadScope_71B651A0;
  total: number;
  returned: number;
  /**
   * @minItems 0
   * @maxItems 50
   */
  actions: Canonical_ActionItemReadRow_387D1C2E[];
  pageCoverage: Canonical_ActionItemClientScopedPageCoverage_2Ed597E6;
  continuation: CanonicalContinuationC9F32Bf1;
  evidenceReady: false;
  negativeAssertion: {
    kind: 'none';
  };
}
export interface Canonical_SourceState_466075C2 {
  sourceId: string;
  authority: 'authoritative' | 'derived' | 'approved-memory';
  snapshotVersionId: string | null;
  adapterVersion: string;
  status: 'checked' | 'partial' | 'unavailable' | 'denied';
  synchronizedAt: string | null;
  asOf: string | null;
  retrievedAt: string;
  freshness: 'fresh' | 'stale' | 'unknown';
}
export interface Canonical_CoverageA7C3Afed {
  /**
   * @minItems 1
   * @maxItems 4096
   */
  sourcesRequested: [string, ...string[]];
  /**
   * @minItems 0
   * @maxItems 4096
   */
  sourcesChecked: string[];
  /**
   * @minItems 0
   * @maxItems 4096
   */
  sourcesUnavailable: string[];
  enumeration: 'complete' | 'partial' | 'unknown';
  enumerableTotal: number | null;
  returnedCount: number;
  truncated: boolean;
  historySupport: 'supported' | 'bounded' | 'unsupported';
  /**
   * @minItems 0
   * @maxItems 4096
   */
  limitations: string[];
}
export interface Canonical_ActionItemClientScopedSelection_8Ef7E563 {
  clientId: string;
  actionItemId: string | null;
  status: Canonical_ActionStatus_21422Bf6 | null;
  sort: Canonical_ActionSortCe05E4A0;
  page: 1 | null;
  limit: number;
  cursorApplied: boolean;
}
export interface Canonical_ActionItemReadScope_71B651A0 {
  actionItemId: string | null;
  status: Canonical_ActionStatus_21422Bf6 | null;
  sort: Canonical_ActionSortCe05E4A0;
  page: number;
  limit: number;
  cursorApplied: boolean;
}
export interface Canonical_ActionItemReadRow_387D1C2E {
  id: string;
  districtKey: string | null;
  clientId: string;
  clientName: string | null;
  peCode: string | null;
  programId: string | null;
  deltaId: string | null;
  actionType: Canonical_ActionTypeB0113Df0;
  issueTitle: string;
  whatChanged: string;
  whyItMatters: string;
  recommendedAction: string;
  /**
   * @minItems 0
   * @maxItems 4096
   */
  targetAudience: Canonical_AudienceMember_2989A346[];
  suggestedArtifactType: string | null;
  deadline: string | null;
  deadlineSource: Canonical_DeadlineSourceC0Cee855 | null;
  ownerUserId: string | null;
  priority: number;
  confidence: Canonical_ConfidenceBandsD8Ce0F28;
  uncertainty: string | null;
  /**
   * @minItems 0
   * @maxItems 4096
   */
  evidence: Canonical_EvidenceRef_213Ffa01[];
  status: Canonical_ActionStatus_21422Bf6;
  dismissalReason: string | null;
  outcome: string | null;
  createdAt: string;
  updatedAt: string;
  title: string;
  body: string;
  recordKind: 'action_recommendation';
  recommendation: true;
  acceptedAsTask: false;
  nativeCompletion: Canonical_ActionItemNativeCompletion_98Af041C;
  sourceProof: Canonical_ActionItemSourceProof_83D56046;
}
export interface Canonical_AudienceMember_2989A346 {
  kind: 'committee' | 'office' | 'person_role';
  id: string;
  label: string;
  contactUse?: string;
  outreachEligible?: boolean;
}
export interface Canonical_ConfidenceBandsD8Ce0F28 {
  delta?: Canonical_ConfidenceBand_1337A6D6;
  programMatch?: Canonical_ConfidenceBand_1337A6D6;
  peopleMatch?: Canonical_ConfidenceBand_1337A6D6;
  clientRelevance?: Canonical_ConfidenceBand_1337A6D6;
}
export interface Canonical_EvidenceRef_213Ffa01 {
  kind: 'source' | 'delta' | 'provision' | 'opportunity' | 'program_match';
  sourceDocumentId?: string;
  page?: number;
  deltaId?: string;
  provisionId?: string;
  programId?: string;
  opportunityId?: string;
  note?: string;
}
export interface Canonical_ActionItemNativeCompletion_98Af041C {
  completed: false;
  evidence: 'recommendation_outcome_only' | null;
  establishesDeliveryOrAcceptance: false;
  note: string;
}
export interface Canonical_ActionItemSourceProof_83D56046 {
  version: 1;
  owner: 'action_recommendation';
  sourceRecordId: string;
  currentClientId: string;
  sourceVersion: string;
  contentSha256: string;
  /**
   * @minItems 0
   * @maxItems 4096
   */
  linkedSources: Canonical_ActionItemLinkedSourceProofFf2Dc401[];
}
export interface Canonical_ActionItemLinkedSourceProofFf2Dc401 {
  owner: 'source_document';
  sourceRecordId: string;
  sourceVersion: string;
  contentSha256: string;
}
export interface Canonical_ActionItemClientScopedPageCoverage_2Ed597E6 {
  sourceStatus: 'healthy' | 'degraded';
  sourceReason: string | null;
  complete: boolean;
  partial: boolean;
  paginationComplete: boolean;
  hasMore: boolean;
  nextCursor: string | null;
  totalIsExactForScope: true;
  absenceSupported: boolean;
  note: string;
}
export interface CanonicalContinuationC9F32Bf1 {
  cursor: string | null;
  /**
   * @minItems 0
   * @maxItems 4096
   */
  requiredReads: string[];
  /**
   * @minItems 0
   * @maxItems 4096
   */
  remainingSources: string[];
}
export interface ActionDraftResponse {
  status: 'draft';
  source: {
    resultReference: string;
    resultSha256: string;
    actionId: string;
    lookupId: string;
    actionSha256: string;
    originalBinding: Canonical_RunBinding_84F2304C;
    clientId: string;
  };
  recommendation: Canonical_ActionItemReadRow_387D1C2E;
  task: Canonical_TaskCreateArguments_1202C301;
  draftSha256: string;
}
export interface Canonical_TaskCreateArguments_1202C301 {
  title: string;
  clientId: string | null;
  dueDate: string | null;
}
export interface ActionPrepareResponse {
  status: 'approval_required';
  draft: ActionDraftResponse;
  proposal: Canonical_ApprovalProposalD1A3E74F;
}
export interface Canonical_ApprovalProposalD1A3E74F {
  proposalId: string;
  command: Canonical_Command_2099E1Ba;
  commandSha256: string;
  createdAt: string;
  expiresAt: string;
  requiredApprover: Canonical_IdentityAba0A4E9;
}
export interface Canonical_Command_2099E1Ba {
  contractVersion: '0.1.0';
  commandId: string;
  binding: Canonical_RunBinding_84F2304C;
  action: 'memory.propose' | 'task.create' | 'artifact.file';
  arguments: {};
  attachments: Canonical_ObjectReferenceA099Bd1C[];
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  idempotencyKey: string;
}
export interface Canonical_ObjectReferenceA099Bd1C {
  objectId: string;
  versionId: string;
  sha256: string;
  bytes: number;
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
}
export interface Canonical_IdentityAba0A4E9 {
  tenantId: string;
  actorId: string;
}
export interface Canonical_CommandReceiptAc49Ee1E {
  receiptId: string;
  commandId: string;
  commandSha256: string;
  idempotencyKey: string;
  binding: Canonical_RunBinding_84F2304C;
  outcome: 'succeeded' | 'denied' | 'failed' | 'indeterminate';
  sourceTransactionId: string | null;
  completedAt: string;
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  authorizationDecisionId: string;
}
export interface Canonical_TaskCreateResult_0501C509 {
  id: string;
  title: string;
  status: 'todo';
  dueDate: string | null;
  clientId: string | null;
  createdAt: string;
}
export interface ActionErrorResponse {
  error: {
    code:
      | 'ACCESS_DENIED'
      | 'APPLICATION_CLOCK'
      | 'APPLICATION_CONFIGURATION'
      | 'CANCELLED'
      | 'COMMAND_APPROVAL_REFUSED'
      | 'COMMAND_AUTHORITY_REFUSED'
      | 'COMMAND_COMMIT_UNCERTAIN'
      | 'COMMAND_OUTCOME_UNKNOWN'
      | 'COMMAND_PREPARATION_REFUSED'
      | 'COMMAND_REFUSED'
      | 'DEADLINE'
      | 'EXECUTION_AUTHORITY_REFUSED'
      | 'INVALID_BODY'
      | 'INVALID_CONTENT_LENGTH'
      | 'INVALID_JSON'
      | 'INVALID_REQUEST'
      | 'LOOKUP_REPLAY'
      | 'LOOKUP_UNAVAILABLE'
      | 'METHOD_NOT_ALLOWED'
      | 'NOT_FOUND'
      | 'REQUEST_FAILED'
      | 'REQUEST_TOO_LARGE'
      | 'RESPONSE_TOO_LARGE'
      | 'RESULT_CORRELATION_REFUSED'
      | 'SESSION_SCOPE_REFUSED'
      | 'UNAUTHENTICATED'
      | 'UNAVAILABLE'
      | 'UNSUPPORTED_CONTENT_ENCODING'
      | 'UNSUPPORTED_MEDIA_TYPE';
    outcome:
      'NOT_DISPATCHED' | 'UNKNOWN' | 'RESULT_NOT_RELEASED' | 'STORED_NOT_RELEASED' | 'NOT_STORED' | 'READ_UNAVAILABLE';
  };
}

export type ActionRoute = 'query' | 'draft' | 'prepare' | 'execute';
export interface ActionResponseMap { query: ActionQueryResponse; draft: ActionDraftResponse; prepare: ActionPrepareResponse; execute: ActionExecuteResponse; }
export type ActionResponse<R extends ActionRoute> = ActionResponseMap[R] | ActionErrorResponse;
export declare class ActionResponseError extends Error { readonly code: string; }
export declare function receiveActionResponse<R extends ActionRoute>(route:R,httpStatus:number,jsonText:unknown):Promise<ActionResponse<R>>;
