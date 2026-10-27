// Generated from canonical conversation receiving schema. No authorization implied.

export type ConversationApplicationEnvelope =
  | ConversationSubmitRequest
  | ConversationHistoryRequest
  | ConversationCancelRequest
  | ConversationEventsRequest
  | ConversationSubmittedResponse
  | ConversationHistoryResponse
  | ConversationCancelledResponse
  | ConversationEvent
  | ConversationErrorResponse
  | ConversationFeedbackRequest
  | ConversationFeedbackReadRequest
  | ConversationFeedbackResponse
  | ConversationFeedbackReadResponse;
export type Canonical_WindowRequestF314F340 =
  | {
      basis: 'calendar-week';
      offset: -1 | 0;
      timezone: string;
      weekStartsOn: 'monday' | 'sunday';
    }
  | {
      basis: 'calendar-month';
      offset: -1 | 0;
      timezone: string;
    }
  | {
      basis: 'calendar-year';
      offset: -1 | 0;
      timezone: string;
    }
  | {
      basis: 'relative-duration';
      days: number;
      anchorAt: string;
      timezone: string;
    }
  | {
      basis: 'explicit';
      startInclusive: string;
      endExclusive: string;
      timezone: string;
    }
  | {
      basis: 'fiscal-year';
      year: number;
      calendarId: string;
      stage: 'requested' | 'authorized' | 'appropriated' | 'obligated' | 'actual' | 'outlay';
      revisionId: string;
      timezone: string;
    }
  | {
      basis: 'unbounded';
    };
export type CanonicalSkillId_31E12E8E =
  | 'quick_skill.research_company'
  | 'quick_skill.relationship_brief'
  | 'quick_skill.client_changes'
  | 'quick_skill.portfolio_changes'
  | 'quick_skill.portfolio_overlap'
  | 'quick_skill.mail_history'
  | 'quick_skill.meeting_prep'
  | 'quick_skill.commitments_audit'
  | 'quick_skill.funding_opportunity_match'
  | 'quick_skill.pe_deep_dive'
  | 'quick_skill.bill_watch'
  | 'quick_skill.hearing_watch'
  | 'quick_skill.representation_lookup'
  | 'quick_skill.regulatory_docket_brief';
export type CanonicalSkillVersion_7E2Af095 = string;
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
export type ConversationEvent =
  | Canonical_UIEvent_1691B714
  | Canonical_NativeBillTextSourceEvent_8E4E610B
  | Canonical_NativeHearingSourceEvent_685F6175;
export type ConversationFeedbackTarget =
  | {
      kind: 'message';
      runId: string;
      throughSequence: number;
      messageId: string;
    }
  | {
      kind: 'artifact';
      runId: string;
      throughSequence: number;
      artifactId: string;
      versionId: string;
    };
export type ConversationFeedbackSignal =
  | {
      kind: 'preference';
      value: 'helpful' | 'not_helpful';
      note: string | null;
    }
  | {
      kind: 'factual_correction';
      proposedCorrection: string;
    }
  | {
      kind: 'recommendation';
      recommendation: string;
    };

export interface ConversationSubmitRequest {
  requestId: string;
  prompt: string;
  windowRequest?: Canonical_WindowRequestF314F340;
  skill?: {
    skillId: CanonicalSkillId_31E12E8E;
    skillVersion: CanonicalSkillVersion_7E2Af095;
  };
  modelSelection?: {
    provider: 'bedrock' | 'claude-api';
    modelId: string;
    effort: null | ('low' | 'medium' | 'high' | 'xhigh' | 'max');
  };
  documentRevision?: {
    artifactId: string;
    versionId: string;
    objectSha256: string;
  };
}
export interface ConversationHistoryRequest {
  after?: number;
  limit?: number;
}
export interface ConversationCancelRequest {}
export interface ConversationEventsRequest {
  command: {
    conversationId: string;
    intent: 'view.subscribe';
  };
}
export interface ConversationSubmittedResponse {
  run: Canonical_RunAeee1939;
  requestId: string;
  lastSequence: number;
  replayed: boolean;
}
export interface Canonical_RunAeee1939 {
  binding: Canonical_RunBinding_84F2304C;
  state: 'queued' | 'starting' | 'running' | 'waiting-for-approval' | 'paused' | 'completed' | 'failed' | 'cancelled';
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  createdAt: string;
  policyRevision: string;
  versions: Canonical_RuntimeVersions_7Edb8Efc;
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
export interface Canonical_RuntimeVersions_7Edb8Efc {
  imageDigest: string;
  sdk: string;
  cli: string;
  contracts: '0.1.0';
  skillsDigest: string;
  checkpointFormat: '0.1.0';
}
export interface ConversationHistoryResponse {
  run: Canonical_RunAeee1939;
  request: ConversationStoredRequest;
  /**
   * @maxItems 100
   */
  events: (
    | Canonical_UIEvent_1691B714
    | Canonical_NativeBillTextSourceEvent_8E4E610B
    | Canonical_NativeHearingSourceEvent_685F6175
  )[];
  nextSequence: number;
  hasMore: boolean;
  lastSequence: number;
}
export interface ConversationStoredRequest {
  requestId: string;
  prompt: string;
  skill: ConversationSkillAssetPin | null;
  window: Canonical_NormalizedWindowE50Ec0Ed | null;
  windowRequest: Canonical_WindowRequestF314F340 | null;
  modelSelection?: {
    provider: 'bedrock' | 'claude-api';
    modelId: string;
    effort: null | ('low' | 'medium' | 'high' | 'xhigh' | 'max');
  };
  documentRevision?: {
    artifactId: string;
    versionId: string;
    objectSha256: string;
  };
}
export interface ConversationSkillAssetPin {
  skillId: CanonicalSkillId_31E12E8E;
  skillVersion: CanonicalSkillVersion_7E2Af095;
  manifestSha256: string;
  proseSha256: string;
  catalogSha256: string;
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
export interface Canonical_NativeBillTextSourceEvent_8E4E610B {
  contractVersion: '0.1.0';
  eventId: string;
  binding: Canonical_RunBinding_84F2304C;
  sequence: number;
  createdAt: string;
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  type: 'source.native-bill-text';
  data: Canonical_NativeBillTextSource_4D549Cac;
}
export interface Canonical_NativeBillTextSource_4D549Cac {
  schemaVersion: 'meri.native-bill-text-source/1';
  deliveryId: string;
  operation: {
    id: 'read_bill_text';
    version: '0.2.0';
  };
  requestSha256: string;
  argumentsSha256: string;
  resultSha256: string;
  executionSha256: string;
  policyRevision: string;
  source: {
    authoritativeOwner: 'federal_evidence_current';
    billId: string;
    versionCode: string;
    revisionId: string;
    packageId: string;
    provider: string;
    lineageKey: string;
    versionHash: string;
    textHash: string;
  };
  page: {
    offset: number;
    endOffset: number;
    totalCharacters: number;
    textSha256: string;
    pageComplete: true;
    contentComplete: boolean;
    paginationComplete: boolean;
    truncated: boolean;
  };
}
export interface Canonical_NativeHearingSourceEvent_685F6175 {
  contractVersion: '0.1.0';
  eventId: string;
  binding: Canonical_RunBinding_84F2304C;
  sequence: number;
  createdAt: string;
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  type: 'source.native-hearing-record';
  data: Canonical_NativeHearingSourceF31B5A94;
}
export interface Canonical_NativeHearingSourceF31B5A94 {
  schemaVersion: 'meri.native-hearing-source/1';
  deliveryId: string;
  operation: {
    id: 'search_committee_hearings';
    version: '0.2.0';
  };
  requestSha256: string;
  argumentsSha256: string;
  resultSha256: string;
  executionSha256: string;
  policyRevision: string;
  source: {
    recordId: string;
    provenance: Canonical_HearingProvenanceBf0528Dd;
  };
  page: {
    part: number;
    format: 'json' | 'json_fragment';
    characterStart: number;
    characterEnd: number;
    totalCharacters: number;
    contentComplete: boolean;
    payloadSha256: string;
  };
  selection: {
    recordsView: 'published' | 'briefs' | 'reconciliation';
    hearingId: string;
    recordId: string;
    clientId: string | null;
    asOf: string | null;
    cursor: string | null;
  };
  coverage: Canonical_HearingCoverageCe9Cf8B6;
}
export interface Canonical_HearingProvenanceBf0528Dd {
  adapter: 'hearings';
  sourceTable:
    | 'committee_hearing'
    | 'official_hearing_transcript'
    | 'public_hearing_transcript_segment'
    | 'public_hearing_insight'
    | 'tenant_hearing_relevance'
    | 'published_legislative_record'
    | 'intel_hearing_record_briefs'
    | 'intel_hearing_record_reconciliation';
  sourceRecordId: string;
  hearingId: string | null;
  contentHash: string;
  sourceKey?: string;
  tenantId?: string;
  historical?: boolean;
}
export interface Canonical_HearingCoverageCe9Cf8B6 {
  requestedDomains: ['hearings'];
  /**
   * @maxItems 1
   */
  searchedDomains: [] | ['hearings'];
  requestedEntityCount: number;
  searchedEntityCount: number;
  recordsEvaluated: number;
  recordsReturned: number;
  paginationComplete: boolean;
  /**
   * @maxItems 1
   */
  unavailableSources: [] | ['hearings'];
  /**
   * @minItems 1
   * @maxItems 1
   */
  sources: [Canonical_HearingSourceCoverage_0301Fc6C];
  complete: false;
  stopReason: string;
}
export interface Canonical_HearingSourceCoverage_0301Fc6C {
  domain: 'hearings';
  sourceStatus: 'healthy' | 'degraded' | 'unavailable' | 'unauthorized' | 'unsupported' | 'error';
  total?: number;
  returned: number;
  recordsEvaluated: number;
  requestedEntityCount: number;
  searchedEntityCount: number;
  pagesRead: number;
  hasMore: boolean;
  nextCursor?: string;
  truncated: boolean;
  paginationComplete: boolean;
  coverageComplete: false;
  lastSyncAt?: string;
  stopReason: string;
}
export interface ConversationCancelledResponse {
  state: 'completed' | 'failed' | 'cancelled';
}
export interface ConversationErrorResponse {
  error: {
    code:
      | 'NOT_FOUND'
      | 'METHOD_NOT_ALLOWED'
      | 'SESSION_REFUSED'
      | 'UNSUPPORTED_MEDIA_TYPE'
      | 'INVALID_REQUEST'
      | 'INVALID_CURSOR'
      | 'REQUEST_REPLAY_REFUSED'
      | 'SCOPE_REFUSED'
      | 'SESSION_CHANGED'
      | 'STALE_WRITER'
      | 'CONVERSATION_SELECTOR_REFUSED'
      | 'DEADLINE'
      | 'CANCELLED'
      | 'REQUEST_TOO_LARGE'
      | 'CONVERSATION_UNAVAILABLE'
      | 'MODEL_SELECTION_UNAVAILABLE'
      | 'MODEL_SETTINGS_UNAVAILABLE'
      | 'FEEDBACK_TARGET_REFUSED'
      | 'FEEDBACK_SOURCE_REFUSED'
      | 'FEEDBACK_REVISION_CHANGED'
      | 'FEEDBACK_REPLAY_REFUSED'
      | 'FEEDBACK_LIMIT'
      | 'FEEDBACK_WRITE_UNKNOWN';
  };
}
export interface ConversationFeedbackRequest {
  requestId: string;
  target: ConversationFeedbackTarget;
  sourceEventId: string | null;
  signal: ConversationFeedbackSignal;
}
export interface ConversationFeedbackReadRequest {
  runId: string;
}
export interface ConversationFeedbackResponse {
  receipt: ConversationFeedbackReceipt;
  replayed: boolean;
}
export interface ConversationFeedbackReceipt {
  feedbackId: string;
  requestId: string;
  conversationId: string;
  actorId: string;
  recordedAt: string;
  target: ConversationFeedbackTarget;
  signal: ConversationFeedbackSignal;
  revision: {
    sha256: string;
    artifact:
      | {
          status: 'bound';
          artifactId: string;
          versionId: string;
        }
      | {
          status: 'not_applicable';
          reason: 'message_target';
        };
  };
  sourceRevision:
    | {
        status: 'bound';
        eventId: string;
        eventSha256: string;
      }
    | {
        status: 'not_applicable';
        reason: 'no_source_selected';
      };
  taskRevision: {
    status: 'not_applicable';
    reason: 'no_native_task_revision_on_target';
  };
  execution:
    | {
        status: 'recorded';
        basis: 'run_sdk_usage';
        usageSha256: string;
        sessionId: string;
        /**
         * @minItems 1
         * @maxItems 32
         */
        models: [string, ...string[]];
        attribution: 'run_including_subagents';
      }
    | {
        status: 'unavailable';
        reason: 'usage_not_recorded' | 'run_model_delta_unavailable';
      };
  disposition: {
    status: 'recorded';
    review: 'not_reviewed';
    effect: 'none';
  };
  /**
   * @maxItems 100
   */
  linkedReceipts: {
    kind: 'approval_request' | 'completion';
    eventId: string;
    eventSha256: string;
  }[];
}
export interface ConversationFeedbackReadResponse {
  runId: string;
  /**
   * @maxItems 50
   */
  receipts: ConversationFeedbackReceipt[];
}

export type ConversationRoute = 'submit' | 'history' | 'cancel' | 'events' | 'feedback' | 'feedback-read';
/** Canonical immutable choices; runtime authorization and availability are decided by the server. */
export interface ConversationSkillDescriptor {readonly skillId:NonNullable<ConversationSubmitRequest['skill']>['skillId'];readonly version:string;readonly displayName:string;readonly subjectKinds:readonly ('client'|'entity'|'personal'|'portfolio')[];readonly windowBases:readonly NonNullable<ConversationSubmitRequest['windowRequest']>['basis'][];readonly manifestSha256:string;readonly proseSha256:string;}
export declare const CONVERSATION_SKILLS:readonly ConversationSkillDescriptor[];
declare const admittedRequest: unique symbol;
declare const admittedView: unique symbol;
declare const admittedCursor: unique symbol;
export interface ConversationRequestMap { submit:ConversationSubmitRequest; history:ConversationHistoryRequest; cancel:ConversationCancelRequest; events:ConversationEventsRequest; feedback:ConversationFeedbackRequest; 'feedback-read':ConversationFeedbackReadRequest; }
export type AdmittedConversationRequest<R extends ConversationRoute> = Readonly<ConversationRequestMap[R]> & {readonly [admittedRequest]:R};
export type AdmittedConversationView = Readonly<ConversationSubmittedResponse | ConversationHistoryResponse> & {readonly [admittedView]:true};
export interface ConversationResponseMap {submit:Readonly<ConversationSubmittedResponse> & {readonly [admittedView]:true}; history:Readonly<ConversationHistoryResponse> & {readonly [admittedView]:true}; cancel:Readonly<ConversationCancelledResponse>; events:never; feedback:ConversationFeedbackResponse; 'feedback-read':ConversationFeedbackReadResponse;}
export type ConversationResponse<R extends ConversationRoute> = ConversationResponseMap[R] | ConversationErrorResponse;
export interface ConversationCursor {readonly conversationId:string; readonly after:number; readonly [admittedCursor]:true;}
export declare class ConversationResponseError extends Error {readonly code:string;}
export declare const conversationApplicationMetadata: {
  "packageVersion": "0.1.15",
  "schemaId": "urn:meri:conversation-application:0.2.0",
  "wireContractVersion": "0.2.0",
  "routes": {
    "submit": {
      "method": "POST",
      "path": "/api/conversations/submit",
      "response": "json"
    },
    "history": {
      "method": "POST",
      "path": "/api/conversations/history",
      "response": "json"
    },
    "cancel": {
      "method": "POST",
      "path": "/api/conversations/cancel",
      "response": "json",
      "body": {},
      "effect": "durable run cancellation"
    },
    "feedback": {
      "method": "POST",
      "path": "/api/conversations/feedback",
      "response": "json",
      "effect": "records feedback only"
    },
    "feedback-read": {
      "method": "POST",
      "path": "/api/conversations/feedback-read",
      "response": "json",
      "effect": "none"
    },
    "events": {
      "method": "POST",
      "path": "/api/conversations/events",
      "response": "ai-sdk-ui-message-stream",
      "intent": "view.subscribe"
    },
    "reconnect": {
      "method": "GET",
      "path": "/api/conversations/events/{conversationId}/stream",
      "response": "ai-sdk-ui-message-stream",
      "cursorHeader": "x-meri-resume-sequence"
    }
  },
  "authentication": {
    "header": "authorization",
    "scheme": "Bearer",
    "owner": "current authenticated opaque session",
    "validationGrantsAuthority": false
  },
  "cursor": {
    "minimum": 0,
    "maximum": 9007199254740991,
    "meaning": "last acknowledged event sequence",
    "progression": "contiguous after + 1",
    "queryAllowed": false,
    "lastEventIdAllowed": false
  },
  "stream": {
    "dataPart": "data-meri-event",
    "transient": true,
    "completion": "subscription ended; durable run state comes from run.status",
    "abort": "subscription cleanup only; use cancel route for durable cancellation"
  },
  "limits": {
    "requestBytes": 131072,
    "responseBytes": 2097152,
    "eventBytes": 2097152,
    "cursorEventIds": 10000
  },
  "errorStatuses": {
    "NOT_FOUND": [
      404
    ],
    "METHOD_NOT_ALLOWED": [
      405
    ],
    "SESSION_REFUSED": [
      401,
      403
    ],
    "UNSUPPORTED_MEDIA_TYPE": [
      415
    ],
    "INVALID_REQUEST": [
      400
    ],
    "INVALID_CURSOR": [
      400
    ],
    "REQUEST_REPLAY_REFUSED": [
      400
    ],
    "SCOPE_REFUSED": [
      403
    ],
    "SESSION_CHANGED": [
      403
    ],
    "STALE_WRITER": [
      403
    ],
    "CONVERSATION_SELECTOR_REFUSED": [
      403
    ],
    "DEADLINE": [
      408
    ],
    "CANCELLED": [
      408
    ],
    "REQUEST_TOO_LARGE": [
      413
    ],
    "CONVERSATION_UNAVAILABLE": [
      502
    ],
    "MODEL_SELECTION_UNAVAILABLE": [
      409
    ],
    "MODEL_SETTINGS_UNAVAILABLE": [
      503
    ],
    "FEEDBACK_TARGET_REFUSED": [
      403
    ],
    "FEEDBACK_SOURCE_REFUSED": [
      403
    ],
    "FEEDBACK_REVISION_CHANGED": [
      409
    ],
    "FEEDBACK_REPLAY_REFUSED": [
      409
    ],
    "FEEDBACK_LIMIT": [
      409
    ],
    "FEEDBACK_WRITE_UNKNOWN": [
      503
    ]
  }
};
export declare function receiveConversationRequest<R extends ConversationRoute>(route:R,utf8Bytes:Uint8Array):AdmittedConversationRequest<R>;
export declare function receiveConversationResponse<R extends ConversationRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationRequest<R>,currentView?:AdmittedConversationView):Promise<ConversationResponse<R>>;
export declare function createConversationCursor(view:AdmittedConversationView,after?:number):ConversationCursor;
export declare function receiveConversationEvent(utf8Bytes:Uint8Array,cursor:ConversationCursor):Readonly<{event:ConversationEvent;cursor:ConversationCursor}>;
export declare function conversationReconnect(cursor:ConversationCursor):Readonly<{method:'GET';path:string;headers:Readonly<{'x-meri-resume-sequence':string}>}>;
