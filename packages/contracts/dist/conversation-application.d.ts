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
  | ConversationErrorResponse;
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
export type ConversationEvent =
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

export interface ConversationSubmitRequest {
  requestId: string;
  prompt: string;
  windowRequest?: Canonical_WindowRequestF314F340;
  skill?: {
    skillId: CanonicalSkillId_31E12E8E;
    skillVersion: CanonicalSkillVersion_7E2Af095;
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
  events: ConversationEvent[];
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
      | 'CONVERSATION_UNAVAILABLE';
  };
}

export type ConversationRoute = 'submit' | 'history' | 'cancel' | 'events';
declare const admittedRequest: unique symbol;
declare const admittedView: unique symbol;
declare const admittedCursor: unique symbol;
export interface ConversationRequestMap { submit:ConversationSubmitRequest; history:ConversationHistoryRequest; cancel:ConversationCancelRequest; events:ConversationEventsRequest; }
export type AdmittedConversationRequest<R extends ConversationRoute> = Readonly<ConversationRequestMap[R]> & {readonly [admittedRequest]:R};
export type AdmittedConversationView = Readonly<ConversationSubmittedResponse | ConversationHistoryResponse> & {readonly [admittedView]:true};
export interface ConversationResponseMap {submit:Readonly<ConversationSubmittedResponse> & {readonly [admittedView]:true}; history:Readonly<ConversationHistoryResponse> & {readonly [admittedView]:true}; cancel:Readonly<ConversationCancelledResponse>; events:never;}
export type ConversationResponse<R extends ConversationRoute> = ConversationResponseMap[R] | ConversationErrorResponse;
export interface ConversationCursor {readonly conversationId:string; readonly after:number; readonly [admittedCursor]:true;}
export declare class ConversationResponseError extends Error {readonly code:string;}
export declare const conversationApplicationMetadata: {
  "packageVersion": "0.1.3",
  "schemaId": "urn:meri:conversation-application:0.1.0",
  "wireContractVersion": "0.1.0",
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
    ]
  }
};
export declare function receiveConversationRequest<R extends ConversationRoute>(route:R,utf8Bytes:Uint8Array):AdmittedConversationRequest<R>;
export declare function receiveConversationResponse<R extends ConversationRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationRequest<R>,currentView?:AdmittedConversationView):Promise<ConversationResponse<R>>;
export declare function createConversationCursor(view:AdmittedConversationView,after?:number):ConversationCursor;
export declare function receiveConversationEvent(utf8Bytes:Uint8Array,cursor:ConversationCursor):Readonly<{event:ConversationEvent;cursor:ConversationCursor}>;
export declare function conversationReconnect(cursor:ConversationCursor):Readonly<{method:'GET';path:string;headers:Readonly<{'x-meri-resume-sequence':string}>}>;
