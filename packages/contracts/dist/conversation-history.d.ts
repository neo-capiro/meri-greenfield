// Generated from accepted history schema; frozen canonical shapes unchanged. No authorization implied.

export type ConversationHistoryEnvelope =
  | ConversationHistoryExportRequest
  | ConversationHistoryExportResponse
  | ConversationHistoryListRequest
  | ConversationHistoryTranscriptRequest
  | ConversationHistoryNextTurnRequest
  | ConversationHistoryListResponse
  | ConversationHistoryTranscriptResponse
  | ConversationHistoryNextTurnResponse
  | ConversationHistoryErrorResponse
  | ConversationHistorySummariesRequest
  | ConversationHistoryManageRequest
  | ConversationHistorySummariesResponse
  | ConversationHistoryManageResponse
  | ConversationHistoryDeletionsRequest
  | ConversationHistoryDeletionsResponse
  | ConversationHistoryDeletionStatusRequest
  | ConversationHistoryDeletionStatusResponse;
export type ConversationHistoryStoredRequest = {
  requestId: CanonicalRequestIdF00D75C2;
  prompt: CanonicalPrompt_4E4Fccab;
  skill: CanonicalSkillD201841F;
  window: CanonicalWindow_3B75900D;
  windowRequest?: CanonicalWindowRequest_73910A80;
  modelSelection?: CanonicalModelSelection_5559383C;
  documentRevision?: CanonicalDocumentRevision_8F3517C7;
  uploads?: CanonicalUploadsB71278F4;
  procedure?: CanonicalProcedureE155666F;
  siteWorkflow?: CanonicalSiteWorkflow_095F758C;
  work?: CanonicalWorkFa33081C;
};
export type CanonicalRequestIdF00D75C2 = string;
export type CanonicalPrompt_4E4Fccab = string;
export type CanonicalSkillD201841F = Canonical_ConversationSkillAssetPin_3Ccfc6Bb | null;
export type Canonical_CanonicalSkillId_31E12E8E_20420Fe7 =
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
export type Canonical_CanonicalSkillVersion_7E2Af095_7B29E661 = string;
export type CanonicalWindow_3B75900D = Canonical_Canonical_NormalizedWindowE50Ec0EdBabbab24 | null;
export type Canonical_Canonical_NormalizedWindowE50Ec0EdBabbab24 =
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
export type CanonicalWindowRequest_73910A80 = Canonical_Canonical_WindowRequestF314F340_6D73F042 | null;
export type Canonical_Canonical_WindowRequestF314F340_6D73F042 =
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
/**
 * @minItems 1
 * @maxItems 8
 */
export type CanonicalUploadsB71278F4 =
  | [
      {
        uploadId: string;
        sha256: string;
      }
    ]
  | [
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      }
    ]
  | [
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      }
    ]
  | [
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      }
    ]
  | [
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      }
    ]
  | [
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      }
    ]
  | [
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      }
    ]
  | [
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      },
      {
        uploadId: string;
        sha256: string;
      }
    ];
export type CanonicalProcedureE155666F =
  | {
      source: 'firm';
      recordId: string;
      version: number;
      manifestDigest: string;
    }
  | {
      source: 'builtin';
      id: 'briefing' | 'draft' | 'bill_analysis' | 'hearing_prep' | 'coalition_letter' | 'amendment_tracker';
      version: number;
      manifestDigest: string;
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
export type ConversationHistoryManageRequest =
  | {
      version: 'meri.conversation-management.v1';
      requestId: string;
      conversationId: string;
      expectedRevision: string;
      operation: 'rename';
      title: string;
    }
  | {
      version: 'meri.conversation-management.v1';
      requestId: string;
      conversationId: string;
      expectedRevision: string;
      operation: 'archive' | 'restore' | 'trash';
    };

export interface ConversationHistoryExportRequest {
  conversationId: string;
}
export interface ConversationHistoryExportResponse {
  schema: 'meri.conversation-export/1';
  conversation: Canonical_Conversation_8B5174A8;
  throughSequence: number;
  exportedAt: string;
  expiresAt: string;
  /**
   * @minItems 1
   * @maxItems 1000
   */
  turns: [
    {
      runId: string;
      prompt: string | null;
      /**
       * @maxItems 2000
       */
      messages: {
        messageId: string;
        text: string;
      }[];
    },
    ...{
      runId: string;
      prompt: string | null;
      /**
       * @maxItems 2000
       */
      messages: {
        messageId: string;
        text: string;
      }[];
    }[]
  ];
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
export interface Canonical_ConversationSkillAssetPin_3Ccfc6Bb {
  skillId: Canonical_CanonicalSkillId_31E12E8E_20420Fe7 | 'quick_skill.cited_report';
  skillVersion: Canonical_CanonicalSkillVersion_7E2Af095_7B29E661;
  manifestSha256: string;
  proseSha256: string;
  catalogSha256: string;
}
export interface CanonicalModelSelection_5559383C {
  provider: 'bedrock' | 'claude-api';
  modelId: string;
  effort: null | ('low' | 'medium' | 'high' | 'xhigh' | 'max');
}
export interface CanonicalDocumentRevision_8F3517C7 {
  artifactId: string;
  versionId: string;
  objectSha256: string;
}
export interface CanonicalSiteWorkflow_095F758C {
  siteId: string;
  workflowId: string;
  version: number;
  manifestSha256: string;
}
export interface CanonicalWorkFa33081C {
  entry: 'start-work' | 'delegate';
  jobKind: 'research' | 'deliverable' | 'audit' | 'scheduled';
  /**
   * @maxItems 20
   */
  deliverables:
    | []
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string, string, string]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ];
  /**
   * @maxItems 20
   */
  dependencies:
    | []
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string, string, string]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ];
}
export interface ConversationHistoryEvent {
  sequence: number;
  event:
    | Canonical_UIEvent_1691B714
    | Canonical_NativeBillTextSourceEvent_8E4E610B
    | Canonical_NativeHearingSourceEvent_685F6175
    | Canonical_NativeUploadSourceEventC1E88004
    | Canonical_NativeUserQuestionEvent_2718130F
    | Canonical_NativeUserQuestionAnsweredEventA7D02B8B;
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
export interface Canonical_NativeUploadSourceEventC1E88004 {
  contractVersion: '0.1.0';
  eventId: string;
  binding: Canonical_RunBinding_84F2304C;
  sequence: number;
  createdAt: string;
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  type: 'source.native-upload';
  data: Canonical_NativeUploadSourceE432Dc7B;
}
export interface Canonical_NativeUploadSourceE432Dc7B {
  schemaVersion: 'meri.native-upload-source/1';
  deliveryId: string;
  operation: {
    id: 'read_upload_source';
    version: '0.2.0';
  };
  requestSha256: string;
  argumentsSha256: string;
  resultSha256: string;
  executionSha256: string;
  policyRevision: string;
  source: {
    authoritativeOwner: 'upload_custody';
    uploadId: string;
    sha256: string;
    versionId: string;
    filename: string;
    mimeType: string;
    bytes: number;
    extractedSourceSha256: string;
    extractionStatus: 'available' | 'partial';
    /**
     * @maxItems 16
     */
    limitations:
      | []
      | [string]
      | [string, string]
      | [string, string, string]
      | [string, string, string, string]
      | [string, string, string, string, string]
      | [string, string, string, string, string, string]
      | [string, string, string, string, string, string, string]
      | [string, string, string, string, string, string, string, string]
      | [string, string, string, string, string, string, string, string, string]
      | [string, string, string, string, string, string, string, string, string, string]
      | [string, string, string, string, string, string, string, string, string, string, string]
      | [string, string, string, string, string, string, string, string, string, string, string, string]
      | [string, string, string, string, string, string, string, string, string, string, string, string, string]
      | [string, string, string, string, string, string, string, string, string, string, string, string, string, string]
      | [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string
        ]
      | [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string
        ];
  };
  page: {
    number: number;
    count: number;
    sha256: string;
    nextPage: number | null;
    fragmentCount: number;
    extractionStatus: 'available' | 'partial';
    /**
     * @maxItems 16
     */
    limitations:
      | []
      | [string]
      | [string, string]
      | [string, string, string]
      | [string, string, string, string]
      | [string, string, string, string, string]
      | [string, string, string, string, string, string]
      | [string, string, string, string, string, string, string]
      | [string, string, string, string, string, string, string, string]
      | [string, string, string, string, string, string, string, string, string]
      | [string, string, string, string, string, string, string, string, string, string]
      | [string, string, string, string, string, string, string, string, string, string, string]
      | [string, string, string, string, string, string, string, string, string, string, string, string]
      | [string, string, string, string, string, string, string, string, string, string, string, string, string]
      | [string, string, string, string, string, string, string, string, string, string, string, string, string, string]
      | [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string
        ]
      | [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string
        ];
  };
}
export interface Canonical_NativeUserQuestionEvent_2718130F {
  contractVersion: '0.1.0';
  eventId: string;
  binding: Canonical_RunBinding_84F2304C;
  sequence: number;
  createdAt: string;
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  type: 'question.pending';
  data: Canonical_NativeUserQuestion_8Ac258Ce;
}
export interface Canonical_NativeUserQuestion_8Ac258Ce {
  questionId: string;
  toolUseId: string;
  questionsSha256: string;
  expiresAt: string;
  /**
   * @minItems 1
   * @maxItems 4
   */
  questions:
    | [
        {
          question: string;
          header: string;
          /**
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ];
          multiSelect: boolean;
        }
      ]
    | [
        {
          question: string;
          header: string;
          /**
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ];
          multiSelect: boolean;
        },
        {
          question: string;
          header: string;
          /**
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ];
          multiSelect: boolean;
        }
      ]
    | [
        {
          question: string;
          header: string;
          /**
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ];
          multiSelect: boolean;
        },
        {
          question: string;
          header: string;
          /**
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ];
          multiSelect: boolean;
        },
        {
          question: string;
          header: string;
          /**
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ];
          multiSelect: boolean;
        }
      ]
    | [
        {
          question: string;
          header: string;
          /**
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ];
          multiSelect: boolean;
        },
        {
          question: string;
          header: string;
          /**
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ];
          multiSelect: boolean;
        },
        {
          question: string;
          header: string;
          /**
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ];
          multiSelect: boolean;
        },
        {
          question: string;
          header: string;
          /**
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ]
            | [
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                },
                {
                  label: string;
                  description: string;
                }
              ];
          multiSelect: boolean;
        }
      ];
}
export interface Canonical_NativeUserQuestionAnsweredEventA7D02B8B {
  contractVersion: '0.1.0';
  eventId: string;
  binding: Canonical_RunBinding_84F2304C;
  sequence: number;
  createdAt: string;
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  type: 'question.answered';
  data: Canonical_NativeUserQuestionOutcome_255F6E68;
}
export interface Canonical_NativeUserQuestionOutcome_255F6E68 {
  questionId: string;
  outcome: 'answered' | 'cancelled';
  reasonCode: string | null;
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
      | 'CONVERSATION_EXPORT_TOO_LARGE'
      | 'CONVERSATION_REQUEST_INVALID'
      | 'CONVERSATION_CURSOR_INVALID'
      | 'CONVERSATION_NOT_FOUND'
      | 'CONVERSATION_TURN_CONFLICT'
      | 'CONVERSATION_MANAGEMENT_CONFLICT'
      | 'CONVERSATION_RESTORE_EXPIRED'
      | 'CONVERSATION_STORE_CORRUPT'
      | 'CONVERSATION_TURN_UNAVAILABLE'
      | 'CONVERSATION_UNAVAILABLE';
    outcome?: 'NOT_DISPATCHED' | 'UNKNOWN' | 'RESULT_NOT_RELEASED';
    field?: string;
  };
}
export interface ConversationHistorySummariesRequest {
  version: 'meri.conversation-management.v1';
  status: 'active' | 'archived' | 'trashed';
  title: string;
  before: ConversationSummaryBefore | null;
}
export interface ConversationSummaryBefore {
  updatedAt: string;
  conversationId: string;
}
export interface ConversationHistorySummariesResponse {
  version: 'meri.conversation-management.v1';
  /**
   * @maxItems 20
   */
  conversations:
    | []
    | [ConversationSummary]
    | [ConversationSummary, ConversationSummary]
    | [ConversationSummary, ConversationSummary, ConversationSummary]
    | [ConversationSummary, ConversationSummary, ConversationSummary, ConversationSummary]
    | [ConversationSummary, ConversationSummary, ConversationSummary, ConversationSummary, ConversationSummary]
    | [
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary
      ]
    | [
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary
      ]
    | [
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary
      ]
    | [
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary
      ]
    | [
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary
      ]
    | [
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary
      ]
    | [
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary
      ]
    | [
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary
      ]
    | [
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary
      ]
    | [
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary
      ]
    | [
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary
      ]
    | [
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary
      ]
    | [
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary
      ]
    | [
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary
      ]
    | [
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary,
        ConversationSummary
      ];
  nextBefore: ConversationSummaryBefore | null;
}
export interface ConversationSummary {
  conversationId: string;
  title: string;
  status: 'active' | 'archived' | 'trashed';
  revision: string;
  scopeKind: 'client' | 'general';
  clientId: string | null;
  updatedAt: string;
  archivedAt: string | null;
  trashedAt: string | null;
  restoreUntil: string | null;
  hasTranscript: boolean;
  canManage: boolean;
}
export interface ConversationHistoryManageResponse {
  version: 'meri.conversation-management.v1';
  requestId: string;
  conversation: ConversationMetadata;
}
export interface ConversationMetadata {
  conversationId: string;
  title: string;
  status: 'active' | 'archived' | 'trashed';
  revision: string;
  scopeKind: 'client' | 'general';
  clientId: string | null;
  updatedAt: string;
  archivedAt: string | null;
  trashedAt: string | null;
  restoreUntil: string | null;
}
export interface ConversationHistoryDeletionsRequest {
  version: 'meri.conversation-management.v1';
  before: ConversationDeletionBefore | null;
}
export interface ConversationDeletionBefore {
  createdAt: string;
  requestId: string;
}
export interface ConversationHistoryDeletionsResponse {
  version: 'meri.conversation-management.v1';
  /**
   * @maxItems 20
   */
  requests:
    | []
    | [ConversationDeletionReference]
    | [ConversationDeletionReference, ConversationDeletionReference]
    | [ConversationDeletionReference, ConversationDeletionReference, ConversationDeletionReference]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ]
    | [
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference,
        ConversationDeletionReference
      ];
  olderRequestsUnavailable: boolean;
  nextBefore: ConversationDeletionBefore | null;
}
export interface ConversationDeletionReference {
  requestId: string;
  createdAt: string;
  conversationId: string;
  revision: string;
  restoreUntil: string;
}
export interface ConversationHistoryDeletionStatusRequest {
  version: 'meri.conversation-management.v1';
  requestId: string;
}
export interface ConversationHistoryDeletionStatusResponse {
  version: 'meri.conversation-management.v1';
  requestId: string;
  createdAt: string;
  conversationId: string;
  revision: string;
  restoreUntil: string;
  state: 'pending' | 'blocked' | 'unknown' | 'completed' | 'superseded';
  /**
   * @maxItems 9
   */
  reasons:
    | []
    | [
        | 'restore_period'
        | 'legal_hold'
        | 'object_lock'
        | 'shared_reference'
        | 'policy'
        | 'cleanup_pending'
        | 'verification_unavailable'
        | 'cleanup_disabled'
      ]
    | [
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        )
      ]
    | [
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        )
      ]
    | [
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        )
      ]
    | [
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        )
      ]
    | [
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        )
      ]
    | [
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        )
      ]
    | [
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        )
      ]
    | [
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        ),
        (
          | 'restore_period'
          | 'legal_hold'
          | 'object_lock'
          | 'shared_reference'
          | 'policy'
          | 'cleanup_pending'
          | 'verification_unavailable'
          | 'cleanup_disabled'
        )
      ];
  checkedAtMs: number;
  retainedSharedCopies: boolean;
}

export type ConversationHistoryRoute='export'|'list'|'transcript'|'nextTurn'|'summaries'|'manage'|'deletions'|'deletionStatus';
declare const admittedHistoryRequest:unique symbol;
export interface ConversationHistoryRequestMap {export:ConversationHistoryExportRequest;list:ConversationHistoryListRequest;transcript:ConversationHistoryTranscriptRequest;nextTurn:ConversationHistoryNextTurnRequest;summaries:ConversationHistorySummariesRequest;manage:ConversationHistoryManageRequest;deletions:ConversationHistoryDeletionsRequest;deletionStatus:ConversationHistoryDeletionStatusRequest;}
export type AdmittedConversationHistoryRequest<R extends ConversationHistoryRoute>=Readonly<ConversationHistoryRequestMap[R]>&{readonly [admittedHistoryRequest]:R};
export interface ConversationHistoryResponseMap {export:Readonly<ConversationHistoryExportResponse>;list:Readonly<ConversationHistoryListResponse>;transcript:Readonly<ConversationHistoryTranscriptResponse>;nextTurn:Readonly<ConversationHistoryNextTurnResponse>;summaries:Readonly<ConversationHistorySummariesResponse>;manage:Readonly<ConversationHistoryManageResponse>;deletions:Readonly<ConversationHistoryDeletionsResponse>;deletionStatus:Readonly<ConversationHistoryDeletionStatusResponse>;}
export type ConversationHistoryResponse<R extends ConversationHistoryRoute>=ConversationHistoryResponseMap[R]|ConversationHistoryErrorResponse;
export declare class ConversationHistoryResponseError extends Error {readonly code:string;}
export declare const conversationHistoryMetadata: {
  "packageVersion": "0.1.34",
  "historyVersion": "1.6.0",
  "schemaId": "urn:meri:conversation-history:1.6.0",
  "routes": {
    "export": {
      "method": "POST",
      "path": "/api/conversations/export"
    },
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
    },
    "summaries": {
      "method": "POST",
      "path": "/api/conversations/summaries"
    },
    "manage": {
      "method": "POST",
      "path": "/api/conversations/manage"
    },
    "deletions": {
      "method": "POST",
      "path": "/api/conversations/deletions/list"
    },
    "deletionStatus": {
      "method": "POST",
      "path": "/api/conversations/deletions/status"
    }
  },
  "authentication": {
    "owner": "native identity and current Core membership",
    "header": "authorization",
    "scheme": "Bearer",
    "serverSideCredentialOnly": true,
    "validationGrantsAuthority": false
  },
  "export": {
    "events": 10000,
    "turns": 1000,
    "messages": 2000,
    "textBytes": 1048576,
    "lifetimeMs": 60000
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
    "CONVERSATION_EXPORT_TOO_LARGE": [
      413
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
    "CONVERSATION_MANAGEMENT_CONFLICT": [
      409
    ],
    "CONVERSATION_RESTORE_EXPIRED": [
      410
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
export declare const conversationHistoryVersion:'1.6.0';
export declare const EXPORT_SCHEMA:'meri.conversation-export/1';
export declare const MANAGEMENT_VERSION:'meri.conversation-management.v1';
export declare const HISTORY_PATHS: {
  "export": "/api/conversations/export",
  "list": "/api/conversations/list",
  "transcript": "/api/conversations/transcript",
  "nextTurn": "/api/conversations/next-turn",
  "summaries": "/api/conversations/summaries",
  "manage": "/api/conversations/manage",
  "deletions": "/api/conversations/deletions/list",
  "deletionStatus": "/api/conversations/deletions/status"
};
export declare const DISCOVERY_SCHEMA:'meri.conversation-list/1',HISTORY_SCHEMA:'meri.conversation-transcript/1',TURN_SCHEMA:'meri.conversation-turn/1';
export declare function receiveConversationHistoryRequest<R extends ConversationHistoryRoute>(route:R,utf8Bytes:Uint8Array):AdmittedConversationHistoryRequest<R>;
export declare function receiveConversationHistoryResponse<R extends ConversationHistoryRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationHistoryRequest<R>):Promise<ConversationHistoryResponse<R>>;
export declare function validateConversationHistoryRequest(route:ConversationHistoryRoute,utf8Bytes:Uint8Array):boolean;
export declare function validateConversationHistoryResponse<R extends ConversationHistoryRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationHistoryRequest<R>):Promise<boolean>;
// Independent run-index wire1; no execution authority.

export type RunIndexEnvelope =
  RunIndexListRequest | RunIndexDetailRequest | RunIndexListResponse | RunIndexDetailResponse | RunIndexErrorResponse;

export interface RunIndexListRequest {
  schemaVersion: 'meri.run-index/1';
  scope:
    | {
        kind: 'all' | 'general';
      }
    | {
        kind: 'client';
        clientId: string;
      };
  status: 'all' | 'active' | 'terminal';
  cursor: string | null;
  limit: number;
}
export interface RunIndexDetailRequest {
  schemaVersion: 'meri.run-detail/1';
  conversationId: string;
  runId: string;
}
export interface RunIndexListResponse {
  schemaVersion: 'meri.run-index/1';
  observedAt: string;
  scope:
    | {
        kind: 'all' | 'general';
      }
    | {
        kind: 'client';
        clientId: string;
      };
  status: 'all' | 'active' | 'terminal';
  /**
   * @maxItems 20
   */
  runs:
    | []
    | [RunIndexSummary]
    | [RunIndexSummary, RunIndexSummary]
    | [RunIndexSummary, RunIndexSummary, RunIndexSummary]
    | [RunIndexSummary, RunIndexSummary, RunIndexSummary, RunIndexSummary]
    | [RunIndexSummary, RunIndexSummary, RunIndexSummary, RunIndexSummary, RunIndexSummary]
    | [RunIndexSummary, RunIndexSummary, RunIndexSummary, RunIndexSummary, RunIndexSummary, RunIndexSummary]
    | [
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary
      ]
    | [
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary
      ]
    | [
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary
      ]
    | [
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary
      ]
    | [
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary
      ]
    | [
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary
      ]
    | [
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary
      ]
    | [
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary
      ]
    | [
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary
      ]
    | [
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary
      ]
    | [
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary
      ]
    | [
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary
      ]
    | [
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary
      ]
    | [
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary,
        RunIndexSummary
      ];
  nextCursor: string | null;
  coverage: {
    kind: 'current-authorized-durable-runs';
    complete: boolean;
    snapshot: false;
  };
}
export interface RunIndexSummary {
  conversationId: string;
  runId: string;
  createdAt: string;
  state: 'queued' | 'starting' | 'running' | 'waiting-for-approval' | 'paused' | 'completed' | 'failed' | 'cancelled';
  statusAt: string;
  lastSequence: number;
  /**
   * @maxItems 4096
   */
  clientIds: string[];
  usage: {
    recording: 'not-recorded' | 'recorded' | 'unavailable';
    sdkEstimateUsd: number | null;
    providerBilledUsd: null;
  };
  references: {
    conversationId: string;
    runId: string;
  };
}
export interface RunIndexDetailResponse {
  schemaVersion: 'meri.run-detail/1';
  observedAt: string;
  run: RunIndexSummary;
  continuation: {
    kind: 'conversation-owner';
    physicalStopVerified: false;
  };
}
export interface RunIndexErrorResponse {
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
      | 'CONVERSATION_EXPORT_TOO_LARGE'
      | 'CONVERSATION_REQUEST_INVALID'
      | 'CONVERSATION_CURSOR_INVALID'
      | 'CONVERSATION_NOT_FOUND'
      | 'CONVERSATION_TURN_CONFLICT'
      | 'CONVERSATION_MANAGEMENT_CONFLICT'
      | 'CONVERSATION_RESTORE_EXPIRED'
      | 'CONVERSATION_STORE_CORRUPT'
      | 'CONVERSATION_TURN_UNAVAILABLE'
      | 'CONVERSATION_UNAVAILABLE'
      | 'RUN_INDEX_REQUEST_INVALID'
      | 'RUN_INDEX_CURSOR_INVALID'
      | 'RUN_INDEX_NOT_FOUND'
      | 'RUN_INDEX_CORRUPT'
      | 'RUN_INDEX_UNAVAILABLE';
  };
}

export type RunIndexRoute='list'|'detail';
declare const admittedRunIndexRequest:unique symbol;
export interface RunIndexRequestMap {list:RunIndexListRequest;detail:RunIndexDetailRequest;}
export interface RunIndexResponseMap {list:RunIndexListResponse;detail:RunIndexDetailResponse;}
export type AdmittedRunIndexRequest<R extends RunIndexRoute>=Readonly<RunIndexRequestMap[R]>&{readonly [admittedRunIndexRequest]:R};
export declare class RunIndexResponseError extends Error {readonly code:string;}
export declare const RUN_INDEX_SCHEMA:'meri.run-index/1',RUN_DETAIL_SCHEMA:'meri.run-detail/1';
export declare const RUN_INDEX_PATHS:{"list":"/api/conversations/runs/list","detail":"/api/conversations/runs/detail"};
export declare const runIndexMetadata:{"version":"1.0.0","schemaId":"urn:meri:run-index:1.0.0","requestBytes":4096,"responseBytes":131072,"pageItems":20,"order":"createdAt-desc/runId-desc/conversationId-desc","inventory":"current actor owned durable runs; current client access and retention","freshness":"current durable observation, not worker liveness or a cross-page snapshot","cursor":"opaque selection bound to current principal, membership revision and normalized query; never authority","usage":"exact existing accounting reference; missing is not zero; provider billing is unavailable"};
export declare function receiveRunIndexRequest<R extends RunIndexRoute>(route:R,bytes:Uint8Array):AdmittedRunIndexRequest<R>;
export declare function receiveRunIndexResponse<R extends RunIndexRoute>(route:R,status:number,bytes:Uint8Array,request:AdmittedRunIndexRequest<NoInfer<R>>):RunIndexResponseMap[R]|RunIndexErrorResponse;
