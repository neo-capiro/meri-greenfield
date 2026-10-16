// Generated from accepted history schema; frozen canonical shapes unchanged. No authorization implied.

export type ConversationHistoryEnvelope =
  | ConversationHistoryListRequest
  | ConversationHistoryTranscriptRequest
  | ConversationHistoryNextTurnRequest
  | ConversationHistoryListResponse
  | ConversationHistoryTranscriptResponse
  | ConversationHistoryNextTurnResponse
  | ConversationHistoryErrorResponse;
export type CanonicalRequestId_32De93Cd = string;
export type CanonicalPrompt_7Bf1Da21 = string;
export type CanonicalSkillBa3B01C2 = Canonical_ConversationSkillAssetPin_338818F9 | null;
export type Canonical_CanonicalSkillId_31E12E8ECae56271 =
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
export type Canonical_CanonicalSkillVersion_7E2Af095_7F0F4343 = string;
export type CanonicalWindow_97Bd6970 = Canonical_Canonical_NormalizedWindowE50Ec0Ed_8A69A7E3 | null;
export type Canonical_Canonical_NormalizedWindowE50Ec0Ed_8A69A7E3 =
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
export type CanonicalWindowRequest_19242Ce9 = Canonical_Canonical_WindowRequestF314F340_6Bb8C023 | null;
export type Canonical_Canonical_WindowRequestF314F340_6Bb8C023 =
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
export type ConversationPromptLineage =
  | {
      kind: 'submission';
      logicalRequestId: string;
      sourceBinding: null;
      sourceRequestId: null;
    }
  | {
      kind: 'resume' | 'fork';
      logicalRequestId: string;
      sourceBinding: Canonical_RunBinding_84F2304C;
      sourceRequestId: string;
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

export interface ConversationHistoryListRequest {
  before?: ConversationHistoryBefore | null;
  limit?: number;
}
export interface ConversationHistoryBefore {
  createdAt: string;
  conversationId: string;
}
export interface ConversationHistoryTranscriptRequest {
  conversationId: string;
  after?: number;
  limit?: number;
}
export interface ConversationHistoryNextTurnRequest {
  conversationId: string;
  sourceRunId: string;
}
export interface ConversationHistoryListResponse {
  schema: 'meri.conversation-list/1';
  /**
   * @maxItems 100
   */
  conversations: Canonical_Conversation_8B5174A8[];
  nextBefore: ConversationHistoryBefore | null;
}
export interface Canonical_Conversation_8B5174A8 {
  conversationId: string;
  owner: Canonical_IdentityAba0A4E9;
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  createdAt: string;
  policyRevision: string;
}
export interface Canonical_IdentityAba0A4E9 {
  tenantId: string;
  actorId: string;
}
export interface Canonical_ScopeF882Edb5 {
  tenantId: string;
  kind: 'tenant' | 'client' | 'mailbox' | 'memory' | 'document' | 'private-user' | 'public';
  resourceId: string;
  policyRevision: string;
}
export interface ConversationHistoryTranscriptResponse {
  schema: 'meri.conversation-transcript/1';
  conversation: Canonical_Conversation_8B5174A8;
  latestRun: Canonical_RunAeee1939;
  latestSequenceBase: number;
  /**
   * @maxItems 100
   */
  turns: ConversationHistoryTurn[];
  /**
   * @maxItems 100
   */
  events: ConversationHistoryEvent[];
  nextSequence: number;
  lastSequence: number;
  hasMore: boolean;
  pendingTurn: ConversationHistoryPendingTurn | null;
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
export interface Canonical_RuntimeVersions_7Edb8Efc {
  imageDigest: string;
  sdk: string;
  cli: string;
  contracts: '0.1.0';
  skillsDigest: string;
  checkpointFormat: '0.1.0';
}
export interface ConversationHistoryTurn {
  run: Canonical_RunAeee1939;
  request: ConversationHistoryStoredRequest;
  promptLineage: ConversationPromptLineage;
  sequenceBase: number;
  sequenceEnd: number | null;
  lastSequence: number;
}
export interface ConversationHistoryStoredRequest {
  requestId: CanonicalRequestId_32De93Cd;
  prompt: CanonicalPrompt_7Bf1Da21;
  skill: CanonicalSkillBa3B01C2;
  window: CanonicalWindow_97Bd6970;
  windowRequest?: CanonicalWindowRequest_19242Ce9;
}
export interface Canonical_ConversationSkillAssetPin_338818F9 {
  skillId: Canonical_CanonicalSkillId_31E12E8ECae56271;
  skillVersion: Canonical_CanonicalSkillVersion_7E2Af095_7F0F4343;
  manifestSha256: string;
  proseSha256: string;
  catalogSha256: string;
}
export interface ConversationHistoryEvent {
  sequence: number;
  event: Canonical_UIEvent_1691B714;
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
export interface ConversationHistoryPendingTurn {
  sourceBinding: Canonical_RunBinding_84F2304C;
  targetBinding: Canonical_RunBinding_84F2304C;
  state: 'RESERVED';
}
export interface ConversationHistoryNextTurnResponse {
  schema: 'meri.conversation-turn/1';
  sourceBinding: Canonical_RunBinding_84F2304C;
  targetBinding: Canonical_RunBinding_84F2304C;
  state: 'RESERVED' | 'ACCEPTED';
  replayed: boolean;
}
export interface ConversationHistoryErrorResponse {
  error: {
    code:
      | 'INVALID_REQUEST'
      | 'UNAUTHENTICATED'
      | 'ACCESS_DENIED'
      | 'MEMBERSHIP_REVOKED'
      | 'NOT_FOUND'
      | 'METHOD_NOT_ALLOWED'
      | 'DEADLINE'
      | 'MEMBERSHIP_CHANGED'
      | 'REQUEST_TOO_LARGE'
      | 'UNSUPPORTED_MEDIA_TYPE'
      | 'CANCELLED'
      | 'PRODUCT_UNAVAILABLE'
      | 'CONVERSATION_REQUEST_INVALID'
      | 'CONVERSATION_CURSOR_INVALID'
      | 'CONVERSATION_NOT_FOUND'
      | 'CONVERSATION_TURN_CONFLICT'
      | 'CONVERSATION_STORE_CORRUPT'
      | 'CONVERSATION_TURN_UNAVAILABLE'
      | 'CONVERSATION_UNAVAILABLE';
    outcome?: 'NOT_DISPATCHED' | 'UNKNOWN' | 'RESULT_NOT_RELEASED';
    field?: string;
  };
}

export type ConversationHistoryRoute='list'|'transcript'|'nextTurn';
declare const admittedHistoryRequest:unique symbol;
export interface ConversationHistoryRequestMap {list:ConversationHistoryListRequest;transcript:ConversationHistoryTranscriptRequest;nextTurn:ConversationHistoryNextTurnRequest;}
export type AdmittedConversationHistoryRequest<R extends ConversationHistoryRoute>=Readonly<ConversationHistoryRequestMap[R]>&{readonly [admittedHistoryRequest]:R};
export interface ConversationHistoryResponseMap {list:Readonly<ConversationHistoryListResponse>;transcript:Readonly<ConversationHistoryTranscriptResponse>;nextTurn:Readonly<ConversationHistoryNextTurnResponse>;}
export type ConversationHistoryResponse<R extends ConversationHistoryRoute>=ConversationHistoryResponseMap[R]|ConversationHistoryErrorResponse;
export declare class ConversationHistoryResponseError extends Error {readonly code:string;}
export declare const conversationHistoryMetadata: {
  "packageVersion": "0.1.6",
  "historyVersion": "1.0.0",
  "schemaId": "urn:meri:conversation-history:1.0.0",
  "routes": {
    "list": {
      "method": "POST",
      "path": "/api/conversations/list"
    },
    "transcript": {
      "method": "POST",
      "path": "/api/conversations/transcript"
    },
    "nextTurn": {
      "method": "POST",
      "path": "/api/conversations/next-turn"
    }
  },
  "authentication": {
    "owner": "native identity and current Core membership",
    "header": "authorization",
    "scheme": "Bearer",
    "serverSideCredentialOnly": true,
    "validationGrantsAuthority": false
  },
  "limits": {
    "requestBytes": 131072,
    "responseBytes": 2097152,
    "pageItems": 100
  },
  "defaults": {
    "limit": 50,
    "after": 0,
    "before": null
  },
  "cursor": {
    "transcript": "conversation sequence",
    "runLocal": "UIEvent.sequence",
    "translation": "conversation sequence = sequenceBase + UIEvent.sequence"
  },
  "promptIdentity": "conversationId + promptLineage.logicalRequestId",
  "turnRecovery": "same sourceRunId returns same targetBinding; retain exact submit requestId/prompt",
  "errorOutcomes": [
    "NOT_DISPATCHED",
    "UNKNOWN",
    "RESULT_NOT_RELEASED"
  ],
  "errorStatuses": {
    "INVALID_REQUEST": [
      400
    ],
    "UNAUTHENTICATED": [
      401
    ],
    "ACCESS_DENIED": [
      403
    ],
    "MEMBERSHIP_REVOKED": [
      403
    ],
    "NOT_FOUND": [
      404
    ],
    "METHOD_NOT_ALLOWED": [
      405
    ],
    "DEADLINE": [
      408
    ],
    "MEMBERSHIP_CHANGED": [
      409
    ],
    "REQUEST_TOO_LARGE": [
      413
    ],
    "UNSUPPORTED_MEDIA_TYPE": [
      415
    ],
    "CANCELLED": [
      499
    ],
    "PRODUCT_UNAVAILABLE": [
      502
    ],
    "CONVERSATION_REQUEST_INVALID": [
      400
    ],
    "CONVERSATION_CURSOR_INVALID": [
      400
    ],
    "CONVERSATION_NOT_FOUND": [
      404
    ],
    "CONVERSATION_TURN_CONFLICT": [
      409
    ],
    "CONVERSATION_STORE_CORRUPT": [
      500
    ],
    "CONVERSATION_TURN_UNAVAILABLE": [
      503
    ],
    "CONVERSATION_UNAVAILABLE": [
      503
    ]
  }
};
export declare const conversationHistoryVersion:'1.0.0';
export declare const HISTORY_PATHS: {
  "list": "/api/conversations/list",
  "transcript": "/api/conversations/transcript",
  "nextTurn": "/api/conversations/next-turn"
};
export declare const DISCOVERY_SCHEMA:'meri.conversation-list/1',HISTORY_SCHEMA:'meri.conversation-transcript/1',TURN_SCHEMA:'meri.conversation-turn/1';
export declare function receiveConversationHistoryRequest<R extends ConversationHistoryRoute>(route:R,utf8Bytes:Uint8Array):AdmittedConversationHistoryRequest<R>;
export declare function receiveConversationHistoryResponse<R extends ConversationHistoryRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationHistoryRequest<R>):Promise<ConversationHistoryResponse<R>>;
export declare function validateConversationHistoryRequest(route:ConversationHistoryRoute,utf8Bytes:Uint8Array):boolean;
export declare function validateConversationHistoryResponse<R extends ConversationHistoryRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationHistoryRequest<R>):Promise<boolean>;
