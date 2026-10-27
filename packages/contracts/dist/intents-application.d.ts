// Generated additive intents contract from its canonical HTTP/approval owners. No authority implied.

export type IntentsApplicationEnvelope =
  | IntentsConversationId
  | IntentsDeliveryId
  | IntentsOperation
  | IntentsListRequest
  | IntentsDecideRequest
  | IntentsNativeProposal
  | IntentsProposal
  | Canonical_LegiwatchProposal_1F841734
  | Canonical_ResearchShareProposal_1Cdbd32E
  | Canonical_ApprovalDecision_5E8Bdbcf
  | Canonical_TaskCreateArguments_1202C301
  | Canonical_TaskUpdateArguments_48509A7A
  | Canonical_ArtifactFileArguments_6F2B3978
  | IntentsNativeTaskOutcome
  | IntentsNativeArtifactFileOutcome
  | IntentsExecutionOutcome
  | IntentsExecution
  | IntentsPendingItem
  | IntentsUnknownItem
  | IntentsFailedItem
  | IntentsDraftItem
  | IntentsWithheldDraftItem
  | IntentsMemoryReview
  | IntentsMemoryReviewItem
  | IntentsWithheldMemoryReviewItem
  | IntentsScheduleProposalItem
  | IntentsScheduleReviewItem
  | IntentsWithheldScheduleItem
  | IntentsWithheldProposalItem
  | IntentsLegiwatchItem
  | IntentsWithheldLegiwatchItem
  | IntentsResearchShareItem
  | IntentsWithheldResearchShareItem
  | IntentsProposalItem
  | IntentsItem
  | IntentsListResponse
  | IntentsDecideResponse
  | IntentsErrorResponse
  | RoutinesMutationRequest
  | Canonical_PendingProposal_8E88D951
  | RoutinesPrepareRequest
  | RoutinesPrepareResponse
  | RoutinesApproveRequest
  | Canonical_Acknowledged_1Fa14Cd2
  | RoutinesReconcileRequest
  | RoutinesReconcileResponse
  | Canonical_ListScheduledTasksRequest_294Adc6C
  | Canonical_ListScheduledTasksOutputD1De26C2
  | RoutinesErrorResponse;
export type IntentsConversationId = string;
export type IntentsDeliveryId = string;
export type IntentsNativeProposal =
  | Canonical_ApprovalProposalD1A3E74F
  | Canonical_TaskUpdateApprovalProposal_1F70E582
  | Canonical_DocumentDraftApprovalProposal_834C2460;
export type IntentsProposal =
  IntentsNativeProposal | Canonical_ResearchShareProposal_1Cdbd32E | Canonical_LegiwatchProposal_1F841734;
export type IntentsExecutionOutcome =
  | {
      receipt: Canonical_CommandReceiptAc49Ee1E;
      result: Canonical_TaskCreateResult_0501C509;
    }
  | IntentsNativeTaskOutcome
  | IntentsNativeArtifactFileOutcome
  | Canonical_ArtifactCreatedResult_183A755E;
export type Canonical_ArtifactVersion_7F9C56Fa =
  Canonical_ArtifactVersionD54B8Ac9 | Canonical_NativeArtifactVersionFf97D150;
export type CanonicalArtifactIdCc9F299E = string;
export type CanonicalVersionIdE4470A54 = string;
export type CanonicalParentVersionId_116435A5 = string | null;
export type CanonicalFilenameF09421Cc = string;
export type CanonicalMimeType_0837Eb6F = string;
/**
 * @minItems 1
 */
export type CanonicalScopes_3D363E5B = [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
export type CanonicalSourceIdFa5F0F45 = string;
export type CanonicalRecordId_1173860D = string;
export type CanonicalSourceVersionIdA5Aa4B63 = string;
export type CanonicalObservedAtFc731620 = string;
export type CanonicalSourceUpdatedAt_4A76A197 = string | null;
export type CanonicalCitationIdAe4E145B = string;
/**
 * @minItems 1
 */
export type CanonicalScopes_78E0Eb49 = [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
export type CanonicalContentSha256_6B70D9F7 = string;
export type CanonicalGenerationStatus_0B8D37A9 = 'draft' | 'validated' | 'published' | 'failed';
export type CanonicalPreviewStatusFe162158 = 'pending' | 'validated' | 'unsupported' | 'failed';
export type CanonicalCreatedAt_38444D79 = string;
export type Canonical_ArtifactInspection_3Ae45145 =
  | {
      sha256: string;
      bytes: number;
      format: 'txt';
      nativeOpened: false;
      rendered: false;
      recalculated: false;
      /**
       * @maxItems 5000
       */
      members: string[];
      details: {
        encoding: 'UTF-8';
        whitespace: 'unchanged';
      };
    }
  | {
      sha256: string;
      bytes: number;
      format: 'docx';
      nativeOpened: false;
      rendered: false;
      recalculated: false;
      /**
       * @maxItems 5000
       */
      members: string[];
      details: {
        paragraphs: number;
        tables: number;
        pictures: number;
      };
    }
  | {
      sha256: string;
      bytes: number;
      format: 'xlsx';
      nativeOpened: false;
      rendered: false;
      recalculated: false;
      /**
       * @maxItems 5000
       */
      members: string[];
      details: {
        /**
         * @maxItems 30
         */
        sheets: string[];
        formulas: number;
        formulaCache:
          'unverified-zero-placeholder; recalculation required' | 'removed/unverified; recalculation required';
        revisionMethod?: 'openpyxl typed-cell replacement';
      };
    }
  | {
      sha256: string;
      bytes: number;
      format: 'pptx';
      nativeOpened: false;
      rendered: false;
      recalculated: false;
      /**
       * @maxItems 5000
       */
      members: string[];
      details: {
        slides: number;
        editable: true;
        visualInspection: 'pending';
      };
    }
  | {
      sha256: string;
      bytes: number;
      format: 'zip';
      nativeOpened: false;
      rendered: false;
      recalculated: false;
      /**
       * @maxItems 5000
       */
      members: string[];
      details: {
        rows: number;
        /**
         * @maxItems 200
         */
        columns: string[];
        chart: boolean;
      };
    }
  | {
      sha256: string;
      bytes: number;
      format: 'pdf';
      nativeOpened: false;
      rendered: false;
      recalculated: false;
      /**
       * @maxItems 5000
       */
      members: string[];
      details: {
        conversionCompleted: true;
        renderInspection: 'pending';
        sourceDocxSha256: string;
      };
    };
export type Canonical_ArtifactExecution_28C65A3E =
  Canonical_LegacyArtifactExecution_4Afe1663 | Canonical_NativeArtifactExecution_26204926;
export type IntentsExecution =
  | {
      state: 'executing';
    }
  | {
      state: 'unknown';
    }
  | {
      state: 'completed';
      outcome: IntentsExecutionOutcome;
    };
export type RoutinesMutationRequest =
  | Canonical_ScheduleTaskRequest_84A62196
  | Canonical_UpdateScheduledTaskRequestE7C2F9Fc
  | Canonical_CancelScheduledTaskRequestFe53799C;
export type CanonicalOverlapD8587B68 =
  'SKIP' | 'BUFFER_ONE' | 'BUFFER_ALL' | 'CANCEL_OTHER' | 'TERMINATE_OTHER' | 'ALLOW_ALL';
export type CanonicalCatchupWindowMsCac01906 = number;
export type CanonicalPauseOnFailure_5504Ab8F = boolean;
export type CanonicalRemainingActions_8581F2B6 = number | null;
export type CanonicalPausedD039Baf5 = boolean;
export type CanonicalNoteDd1Ff52E = string;
export type CanonicalRunNowF623A22B = boolean;
export type CanonicalRunNowOverlapD809D83B = 'ALLOW_ALL';
export type CanonicalMaxCostMicrousdC937E3Cc = number;
export type CanonicalMaxRuntimeSecondsBdcb8952 = number;
export type CanonicalRetryLimitD4C050B5 = number;
export type CanonicalModeB1919E3A = 'pause' | 'delete';
export type CanonicalNoteEa218E7C = string;
export type CanonicalRunning_59Ac543B = 'leave' | 'request_cancel';
/**
 * @maxItems 10
 */
export type CanonicalRuns_0Ce2594A =
  | []
  | [Canonical_Run_8D674B59]
  | [Canonical_Run_8D674B59, Canonical_Run_8D674B59]
  | [Canonical_Run_8D674B59, Canonical_Run_8D674B59, Canonical_Run_8D674B59]
  | [Canonical_Run_8D674B59, Canonical_Run_8D674B59, Canonical_Run_8D674B59, Canonical_Run_8D674B59]
  | [
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59
    ]
  | [
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59
    ]
  | [
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59
    ]
  | [
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59
    ]
  | [
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59
    ]
  | [
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59,
      Canonical_Run_8D674B59
    ];
export type Canonical_LegiwatchStatusCbe9731F =
  | 'proposed'
  | 'approved'
  | 'executing'
  | 'succeeded'
  | 'failed_retryable'
  | 'failed_terminal'
  | 'outcome_unknown'
  | 'blocked'
  | 'dismissed'
  | 'expired';
export type Canonical_ResearchShareProposalStatus_9Aaf7F45 =
  | 'proposed'
  | 'executing'
  | 'succeeded'
  | 'failed_retryable'
  | 'failed_terminal'
  | 'outcome_unknown'
  | 'blocked'
  | 'dismissed'
  | 'expired';
export type IntentsItem =
  | IntentsPendingItem
  | IntentsUnknownItem
  | IntentsFailedItem
  | IntentsDraftItem
  | IntentsWithheldDraftItem
  | IntentsMemoryReviewItem
  | IntentsWithheldMemoryReviewItem
  | IntentsScheduleProposalItem
  | IntentsScheduleReviewItem
  | IntentsWithheldScheduleItem
  | IntentsWithheldProposalItem
  | IntentsProposalItem
  | IntentsResearchShareItem
  | IntentsWithheldResearchShareItem
  | IntentsLegiwatchItem
  | IntentsWithheldLegiwatchItem;
export type IntentsDecideResponse =
  | {
      status: 'legiwatch_decided';
      deliveryId: IntentsDeliveryId;
      proposalId: string;
      result: Canonical_LegiwatchCoreResultC5Ab3126;
    }
  | {
      status: 'rejected';
      deliveryId: IntentsDeliveryId;
      proposalId: string;
      decision: Canonical_ApprovalDecision_5E8Bdbcf;
    }
  | {
      status: 'executed';
      deliveryId: IntentsDeliveryId;
      proposalId: string;
      decision: Canonical_ApprovalDecision_5E8Bdbcf;
      outcome: IntentsExecutionOutcome;
    }
  | {
      status: 'indeterminate';
      deliveryId: IntentsDeliveryId;
      proposalId: string;
      decision: Canonical_ApprovalDecision_5E8Bdbcf;
    }
  | {
      status: 'research_share_decided';
      deliveryId: IntentsDeliveryId;
      proposalId: string;
      proposalStatus: Canonical_ResearchShareProposalStatus_9Aaf7F45;
      oneTimeResult?: Canonical_ResearchShareOneTimeResult_9258E7D0;
    };
export type RoutinesPrepareRequest =
  | {
      requestId: string;
      operation: 'schedule_task';
      request: Canonical_ScheduleTaskRequest_84A62196;
    }
  | {
      requestId: string;
      operation: 'update_scheduled_task';
      request: Canonical_UpdateScheduledTaskRequestE7C2F9Fc;
    }
  | {
      requestId: string;
      operation: 'cancel_scheduled_task';
      request: Canonical_CancelScheduledTaskRequestFe53799C;
    };
export type RoutinesApproveRequest =
  | {
      operation: 'schedule_task';
      request: Canonical_ScheduleTaskRequest_84A62196;
      proposalId: string;
      intentSha256: string;
      decision: 'approved';
    }
  | {
      operation: 'update_scheduled_task';
      request: Canonical_UpdateScheduledTaskRequestE7C2F9Fc;
      proposalId: string;
      intentSha256: string;
      decision: 'approved';
    }
  | {
      operation: 'cancel_scheduled_task';
      request: Canonical_CancelScheduledTaskRequestFe53799C;
      proposalId: string;
      intentSha256: string;
      decision: 'approved';
    };
export type RoutinesReconcileRequest =
  | {
      operation: 'schedule_task';
      request: Canonical_ScheduleTaskRequest_84A62196;
      proposalId: string;
      intentSha256: string;
    }
  | {
      operation: 'update_scheduled_task';
      request: Canonical_UpdateScheduledTaskRequestE7C2F9Fc;
      proposalId: string;
      intentSha256: string;
    }
  | {
      operation: 'cancel_scheduled_task';
      request: Canonical_CancelScheduledTaskRequestFe53799C;
      proposalId: string;
      intentSha256: string;
    };

export interface IntentsOperation {
  id: string;
  version: '0.2.0';
}
export interface IntentsListRequest {
  conversationId: IntentsConversationId;
  after?: IntentsDeliveryId | null;
  limit?: number;
}
export interface IntentsDecideRequest {
  conversationId: IntentsConversationId;
  deliveryId: IntentsDeliveryId;
  proposalId: string;
  commandSha256: string;
  decision: 'approved' | 'rejected';
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
export interface Canonical_RunBinding_84F2304C {
  tenantId: string;
  actorId: string;
  conversationId: string;
  runId: string;
  attemptId: string;
  workerId: string;
  writerFence: number;
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
export interface Canonical_ScopeF882Edb5 {
  tenantId: string;
  kind: 'tenant' | 'client' | 'mailbox' | 'memory' | 'document' | 'private-user' | 'public';
  resourceId: string;
  policyRevision: string;
}
export interface Canonical_IdentityAba0A4E9 {
  tenantId: string;
  actorId: string;
}
export interface Canonical_TaskUpdateApprovalProposal_1F70E582 {
  proposalId: string;
  command: Canonical_TaskUpdateCommandB73E3Ce0;
  commandSha256: string;
  createdAt: string;
  expiresAt: string;
  requiredApprover: Canonical_IdentityAba0A4E9;
}
export interface Canonical_TaskUpdateCommandB73E3Ce0 {
  contractVersion: '0.2.0';
  commandId: string;
  binding: Canonical_RunBinding_84F2304C;
  action: 'task.update';
  arguments: Canonical_TaskUpdateArguments_48509A7A;
  /**
   * @maxItems 0
   */
  attachments: [];
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  idempotencyKey: string;
}
export interface Canonical_TaskUpdateArguments_48509A7A {
  taskId: string;
  mode: 'unconditional_patch';
  patch: {
    title?: string;
    status?: 'todo' | 'in_progress' | 'done' | 'blocked' | 'canceled';
    dueDate?: string;
  };
}
export interface Canonical_DocumentDraftApprovalProposal_834C2460 {
  proposalId: string;
  command: Canonical_DocumentDraftCommand_7Eb6C44C;
  commandSha256: string;
  createdAt: string;
  expiresAt: string;
  requiredApprover: Canonical_IdentityAba0A4E9;
}
export interface Canonical_DocumentDraftCommand_7Eb6C44C {
  contractVersion: '0.2.0';
  commandId: string;
  binding: Canonical_RunBinding_84F2304C;
  action: 'document.draft';
  arguments: Canonical_DocumentDraftArgumentsDeaaba57;
  /**
   * @maxItems 0
   */
  attachments: [];
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  idempotencyKey: string;
}
export interface Canonical_DocumentDraftArgumentsDeaaba57 {
  preparationSha256: string;
  artifactRequestSha256: string;
  sourceContextSha256: string;
  baseVersionId: string | null;
  title: string;
  format: 'docx';
}
export interface Canonical_ResearchShareProposal_1Cdbd32E {
  kind: 'research_share';
  proposalId: string;
  commandSha256: string;
  binding: Canonical_RunBinding_84F2304C;
  /**
   * @minItems 1
   * @maxItems 1
   */
  scopes: [Canonical_ScopeF882Edb5];
  operation: 'publish_research_portfolio_share_link' | 'revoke_research_portfolio_share_link';
  request: Canonical_ResearchSharePublishBound_63909893 | Canonical_ResearchShareRevokeInputB01195Fc;
  preview: {
    label: 'Publish client share link' | 'Revoke client share link';
    clientName?: string;
    portfolioId?: string;
  };
  createdAt: string;
  expiresAt: string;
}
export interface Canonical_ResearchSharePublishBound_63909893 {
  conversationId: string;
  snapshotId: string;
  designId: string;
  clientId: string;
  branding: boolean;
  operationKey: string;
  previewHash: string;
  expectedDesignVersion: number;
}
export interface Canonical_ResearchShareRevokeInputB01195Fc {
  conversationId: string;
  linkId: string;
}
export interface Canonical_LegiwatchProposal_1F841734 {
  kind: 'legiwatch_action';
  binding: Canonical_RunBinding_84F2304C;
  /**
   * @minItems 1
   * @maxItems 1
   */
  scopes: [Canonical_ScopeF882Edb5];
  operation: 'apply_legiwatch_suggestion';
  proposalId: string;
  request: Canonical_LegiwatchRequest_5Cff194F;
  context: Canonical_LegiwatchContextA906D964;
  createdAt: string;
  expiresAt: string;
  commandSha256: string;
}
export interface Canonical_LegiwatchRequest_5Cff194F {
  clientId: string | null;
  folderId: string;
  jurisdiction: string;
  sessionKey: string;
  suggestionId: string;
  expectedVersion: number;
  action: 'add' | 'dismiss' | 'exclude' | 'restore' | 'undo';
  requestKey: string;
}
export interface Canonical_LegiwatchContextA906D964 {
  conversationId: string;
  selectedClientId: string | null;
  identityRevision: string;
  membershipRevision: string;
  contextRevision: string;
}
export interface Canonical_ApprovalDecision_5E8Bdbcf {
  proposalId: string;
  commandSha256: string;
  decision: 'approved' | 'rejected';
  decidedAt: string;
  expiresAt: string;
  approver: Canonical_IdentityAba0A4E9;
  policyRevision: string;
}
export interface Canonical_TaskCreateArguments_1202C301 {
  title: string;
  clientId: string | null;
  dueDate: string | null;
}
export interface Canonical_ArtifactFileArguments_6F2B3978 {
  clientId: string;
  conversationId: string;
}
export interface IntentsNativeTaskOutcome {
  execution: {
    kind: 'native-task';
    proposalId: string;
    commandSha256: string;
    idempotencyKey: string;
    binding: Canonical_RunBinding_84F2304C;
    completedAt: string;
    approvalDecisionSha256: string;
  };
  result: Canonical_TaskCreateResult_0501C509 | Canonical_TaskUpdateResult_029549A8;
}
export interface Canonical_TaskCreateResult_0501C509 {
  id: string;
  title: string;
  status: 'todo';
  dueDate: string | null;
  clientId: string | null;
  createdAt: string;
}
export interface Canonical_TaskUpdateResult_029549A8 {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done' | 'blocked' | 'canceled';
  dueDate: string | null;
  clientId: string | null;
  updatedAt: string;
}
export interface IntentsNativeArtifactFileOutcome {
  execution: {
    kind: 'native-artifact-file';
    proposalId: string;
    commandSha256: string;
    idempotencyKey: string;
    binding: Canonical_RunBinding_84F2304C;
    completedAt: string;
    approvalDecisionSha256: string;
  };
  result: Canonical_ArtifactFileResult_88Dad64B;
}
export interface Canonical_ArtifactFileResult_88Dad64B {
  commandSha256: string;
  /**
   * @minItems 1
   * @maxItems 10
   */
  files:
    | [Canonical_ArtifactFileObservation_2028832D]
    | [Canonical_ArtifactFileObservation_2028832D, Canonical_ArtifactFileObservation_2028832D]
    | [
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D
      ]
    | [
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D
      ]
    | [
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D
      ]
    | [
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D
      ]
    | [
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D
      ]
    | [
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D
      ]
    | [
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D
      ]
    | [
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D,
        Canonical_ArtifactFileObservation_2028832D
      ];
}
export interface Canonical_ArtifactFileObservation_2028832D {
  object: Canonical_ObjectReferenceA099Bd1C;
  status: 'saved' | 'pending' | 'failed';
  fileName: string | null;
  documentId?: string;
  location?: string;
  reason?: string;
  indexingStatus?: 'pending' | 'indexed' | 'not_indexed';
  reused?: boolean;
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
export interface Canonical_ArtifactCreatedResult_183A755E {
  version: Canonical_ArtifactVersion_7F9C56Fa;
  inspection: Canonical_ArtifactInspection_3Ae45145;
  execution: Canonical_ArtifactExecution_28C65A3E;
}
export interface Canonical_ArtifactVersionD54B8Ac9 {
  contractVersion: '0.1.0';
  artifactId: string;
  versionId: string;
  parentVersionId: string | null;
  binding: Canonical_RunBinding_84F2304C;
  object: Canonical_ObjectReferenceA099Bd1C;
  filename: string;
  mimeType: string;
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  evidence: Canonical_SourceEvidenceD9008775[];
  generationStatus: 'draft' | 'validated' | 'published' | 'failed';
  previewStatus: 'pending' | 'validated' | 'unsupported' | 'failed';
  createdAt: string;
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
export interface Canonical_NativeArtifactVersionFf97D150 {
  contractVersion: '0.2.0';
  artifactId: CanonicalArtifactIdCc9F299E;
  versionId: CanonicalVersionIdE4470A54;
  parentVersionId: CanonicalParentVersionId_116435A5;
  binding: Canonical_RunBinding_84F2304C;
  object: Canonical_ObjectReferenceA099Bd1C;
  filename: CanonicalFilenameF09421Cc;
  mimeType: CanonicalMimeType_0837Eb6F;
  scopes: CanonicalScopes_3D363E5B;
  evidence: Canonical_NativeSourceEvidenceCb9E6Ba4[];
  generationStatus: CanonicalGenerationStatus_0B8D37A9;
  previewStatus: CanonicalPreviewStatusFe162158;
  createdAt: CanonicalCreatedAt_38444D79;
}
export interface Canonical_NativeSourceEvidenceCb9E6Ba4 {
  sourceId: CanonicalSourceIdFa5F0F45;
  recordId: CanonicalRecordId_1173860D;
  sourceVersionId: CanonicalSourceVersionIdA5Aa4B63;
  observedAt: CanonicalObservedAtFc731620;
  sourceUpdatedAt: CanonicalSourceUpdatedAt_4A76A197;
  citationId: CanonicalCitationIdAe4E145B;
  scopes: CanonicalScopes_78E0Eb49;
  contentSha256: CanonicalContentSha256_6B70D9F7;
  binding: Canonical_RunBinding_84F2304C;
}
export interface Canonical_LegacyArtifactExecution_4Afe1663 {
  requestSha256: string;
  authorizationReceiptId: string;
  budgetTicketId: string;
  objectCommitted: true;
  versionCommitted: true;
  nativeQualified: false;
}
export interface Canonical_NativeArtifactExecution_26204926 {
  kind: 'native-document';
  invocationId: string;
  requestSha256: string;
  authorizationReceiptId: string;
  objectCommitted: true;
  versionCommitted: true;
  nativeQualified: false;
}
export interface IntentsPendingItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'pending';
}
export interface IntentsUnknownItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'unknown';
}
export interface IntentsFailedItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'failed';
  code:
    | 'UNAVAILABLE'
    | 'ACCESS_DENIED'
    | 'REFUSED'
    | 'INVALID_ARGUMENTS'
    | 'DEADLINE'
    | 'CANCELLED'
    | 'CONFLICT'
    | 'UNKNOWN';
}
export interface IntentsDraftItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'draft';
  versionId: string;
}
export interface IntentsWithheldDraftItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'draft';
  withheld: true;
}
export interface IntentsMemoryReview {
  status: 'review_pending';
  binding: Canonical_RunBinding_84F2304C;
  /**
   * @minItems 1
   * @maxItems 1
   */
  scopes: [Canonical_ScopeF882Edb5];
  result: Canonical_MemoryProposeResultD7A216E1;
}
export interface Canonical_MemoryProposeResultD7A216E1 {
  candidateId: string;
  commandSha256: string;
  status: 'pending';
}
export interface IntentsMemoryReviewItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'memory_review';
  review: IntentsMemoryReview;
}
export interface IntentsWithheldMemoryReviewItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'memory_review';
  withheld: true;
}
export interface IntentsScheduleProposalItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'schedule_proposal';
  proposalId: string | null;
}
export interface IntentsScheduleReviewItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'schedule_proposal';
  binding: Canonical_RunBinding_84F2304C;
  request: RoutinesMutationRequest;
  proposal: Canonical_PendingProposal_8E88D951;
}
export interface Canonical_ScheduleTaskRequest_84A62196 {
  taskInstruction: string;
  policy: Canonical_PolicyBe301B7B;
  destinationReference: string;
  requestedLimits: Canonical_LimitsB978E650;
}
export interface Canonical_PolicyBe301B7B {
  spec: Canonical_SpecE2455537;
  overlap: CanonicalOverlapD8587B68;
  catchupWindowMs: CanonicalCatchupWindowMsCac01906;
  pauseOnFailure: CanonicalPauseOnFailure_5504Ab8F;
  remainingActions: CanonicalRemainingActions_8581F2B6;
  paused: CanonicalPausedD039Baf5;
  note: CanonicalNoteDd1Ff52E;
  runNow: CanonicalRunNowF623A22B;
  runNowOverlap: CanonicalRunNowOverlapD809D83B;
}
export interface Canonical_SpecE2455537 {
  /**
   * @maxItems 100
   */
  calendars: Canonical_Calendar_9A4Acbe7[];
  /**
   * @maxItems 100
   */
  intervals: {
    every: number;
    offset: number;
  }[];
  /**
   * @maxItems 100
   */
  cronExpressions: string[];
  /**
   * @maxItems 100
   */
  skip: Canonical_Calendar_9A4Acbe7[];
  startAt: string | null;
  endAt: string | null;
  jitterMs: number;
  timezone: string;
}
export interface Canonical_Calendar_9A4Acbe7 {
  second:
    | '*'
    | {
        start: number;
        end: number;
        step: number;
      }[];
  minute:
    | '*'
    | {
        start: number;
        end: number;
        step: number;
      }[];
  hour:
    | '*'
    | {
        start: number;
        end: number;
        step: number;
      }[];
  dayOfMonth:
    | '*'
    | {
        start: number;
        end: number;
        step: number;
      }[];
  month:
    | '*'
    | {
        start:
          | 'JANUARY'
          | 'FEBRUARY'
          | 'MARCH'
          | 'APRIL'
          | 'MAY'
          | 'JUNE'
          | 'JULY'
          | 'AUGUST'
          | 'SEPTEMBER'
          | 'OCTOBER'
          | 'NOVEMBER'
          | 'DECEMBER';
        end:
          | 'JANUARY'
          | 'FEBRUARY'
          | 'MARCH'
          | 'APRIL'
          | 'MAY'
          | 'JUNE'
          | 'JULY'
          | 'AUGUST'
          | 'SEPTEMBER'
          | 'OCTOBER'
          | 'NOVEMBER'
          | 'DECEMBER';
        step: number;
      }[];
  year:
    | '*'
    | {
        start: number;
        end: number;
        step: number;
      }[];
  dayOfWeek:
    | '*'
    | {
        start: 'SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';
        end: 'SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';
        step: number;
      }[];
  comment: string;
}
export interface Canonical_LimitsB978E650 {
  maxCostMicrousd: CanonicalMaxCostMicrousdC937E3Cc;
  maxRuntimeSeconds: CanonicalMaxRuntimeSecondsBdcb8952;
  retryLimit: CanonicalRetryLimitD4C050B5;
}
export interface Canonical_UpdateScheduledTaskRequestE7C2F9Fc {
  scheduleId: string;
  taskInstruction: string;
  policy: Canonical_PolicyBe301B7B;
  destinationReference: string;
  requestedLimits: Canonical_LimitsB978E650;
}
export interface Canonical_CancelScheduledTaskRequestFe53799C {
  scheduleId: string;
  mode: CanonicalModeB1919E3A;
  note: CanonicalNoteEa218E7C;
  running: CanonicalRunning_59Ac543B;
  runs: CanonicalRuns_0Ce2594A;
}
export interface Canonical_Run_8D674B59 {
  workflowId: string;
  runId: string;
}
export interface Canonical_PendingProposal_8E88D951 {
  operation: 'schedule_task' | 'update_scheduled_task' | 'cancel_scheduled_task';
  status: 'approval_required';
  proposalId: string;
  intentSha256: string;
  taskInstruction: string | null;
  projection: Canonical_ScheduleProjection_607C4A02;
  policy: Canonical_PolicyBe301B7B | null;
  cancel: Canonical_Cancel_18A6890B | null;
}
export interface Canonical_ScheduleProjection_607C4A02 {
  scheduleId: string;
  owner: Canonical_IdentityAba0A4E9;
  temporalScheduleId: string;
  timezone: string;
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  state: 'active' | 'paused' | 'cancelled';
  maxCostMicrousd: number;
  maxRuntimeSeconds: number;
  retryLimit: number;
  destinationId: string;
  createdAt: string;
}
export interface Canonical_Cancel_18A6890B {
  mode: 'pause' | 'delete';
  note: string;
  running: 'leave' | 'request_cancel';
  /**
   * @maxItems 10
   */
  runs:
    | []
    | [Canonical_Run_8D674B59]
    | [Canonical_Run_8D674B59, Canonical_Run_8D674B59]
    | [Canonical_Run_8D674B59, Canonical_Run_8D674B59, Canonical_Run_8D674B59]
    | [Canonical_Run_8D674B59, Canonical_Run_8D674B59, Canonical_Run_8D674B59, Canonical_Run_8D674B59]
    | [
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59
      ]
    | [
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59
      ]
    | [
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59
      ]
    | [
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59
      ]
    | [
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59
      ]
    | [
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59,
        Canonical_Run_8D674B59
      ];
}
export interface IntentsWithheldScheduleItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'schedule_proposal';
  withheld: true;
}
export interface IntentsWithheldProposalItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'proposal';
  withheld: true;
}
export interface IntentsLegiwatchItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'legiwatch_action';
  proposal: Canonical_LegiwatchProposal_1F841734;
  result: Canonical_LegiwatchCoreResultC5Ab3126 | 'unavailable';
}
export interface Canonical_LegiwatchCoreResultC5Ab3126 {
  version: '0.1.0';
  proposalId: string;
  request: Canonical_LegiwatchRequest_5Cff194F;
  context: Canonical_LegiwatchContextA906D964;
  createdAt: string;
  expiresAt: string;
  status: Canonical_LegiwatchStatusCbe9731F;
  receipt: Canonical_LegiwatchReceipt_706F9465 | null;
}
export interface Canonical_LegiwatchReceipt_706F9465 {
  request: Canonical_LegiwatchRequest_5Cff194F;
  outcome:
    'added' | 'already_present' | 'dismissed' | 'excluded' | 'pending' | 'stale' | 'undone' | 'undo_conflict' | 'held';
  payload: {
    binding: string;
    suggestionId: string;
    decisionId: string | null;
    version: number;
    action: 'add' | 'dismiss' | 'exclude' | 'restore' | 'undo';
  };
}
export interface IntentsWithheldLegiwatchItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'legiwatch_action';
  withheld: true;
}
export interface IntentsResearchShareItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'research_share';
  proposal: Canonical_ResearchShareProposal_1Cdbd32E;
  proposalStatus: Canonical_ResearchShareProposalStatus_9Aaf7F45 | 'unavailable';
}
export interface IntentsWithheldResearchShareItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'research_share';
  withheld: true;
}
export interface IntentsProposalItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'proposal';
  proposal: IntentsNativeProposal;
  decision: Canonical_ApprovalDecision_5E8Bdbcf | null | 'unavailable';
  execution: IntentsExecution | null | 'unavailable';
  phase:
    | 'awaiting_approval'
    | 'approved'
    | 'rejected'
    | 'expired'
    | 'executing'
    | 'completed'
    | 'unknown'
    | 'unknown_decision';
}
export interface IntentsListResponse {
  conversationId: IntentsConversationId;
  /**
   * @maxItems 50
   */
  intents: IntentsItem[];
  next: IntentsDeliveryId | null;
}
export interface Canonical_ResearchShareOneTimeResult_9258E7D0 {
  sharePath: string;
  shownOnce: true;
}
export interface IntentsErrorResponse {
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
      | 'INTENT_APPROVALS_DISABLED'
      | 'INTENT_NOT_FOUND'
      | 'INTENT_NOT_PREPARED'
      | 'INTENT_NOT_APPROVABLE'
      | 'INTENT_MISMATCH'
      | 'INTENT_EXPIRED'
      | 'INTENT_SCOPE_WITHHELD'
      | 'APPROVER_REFUSED'
      | 'APPROVAL_OWNER_UNAVAILABLE'
      | 'APPROVAL_DECISION_REFUSED'
      | 'APPROVAL_DECISION_UNKNOWN'
      | 'EXECUTION_OWNER_UNAVAILABLE'
      | 'EXECUTION_AUTHORITY_REFUSED'
      | 'INTENT_CROSS_RUN'
      | 'COMMAND_APPROVAL_REFUSED'
      | 'COMMAND_AUTHORITY_REFUSED'
      | 'COMMAND_PREPARATION_REFUSED'
      | 'COMMAND_REFUSED'
      | 'COMMAND_OUTCOME_UNKNOWN'
      | 'INTENT_RESULT_NOT_RELEASED'
      | 'INTENT_EXECUTION_UNKNOWN'
      | 'INTENT_JOURNAL_UNAVAILABLE'
      | 'INTENT_REQUEST_INVALID';
    outcome?: 'NOT_DISPATCHED' | 'UNKNOWN' | 'RESULT_NOT_RELEASED';
    field?: string;
  };
}
export interface RoutinesPrepareResponse {
  status: 'approval_required';
  proposal: Canonical_PendingProposal_8E88D951;
}
export interface Canonical_Acknowledged_1Fa14Cd2 {
  operation: 'schedule_task' | 'update_scheduled_task' | 'cancel_scheduled_task';
  status: 'acknowledged';
  receipt: {
    operation: 'schedule_task' | 'update_scheduled_task' | 'cancel_scheduled_task';
    intentId: string;
    generation: number;
    projection: Canonical_ScheduleProjection_607C4A02;
    outcome: 'ACKNOWLEDGED';
    physicalStopProven: false;
  };
}
export interface RoutinesReconcileResponse {
  intentId: string;
  operation: 'schedule_task' | 'update_scheduled_task' | 'cancel_scheduled_task';
  generation: number;
  outcome: 'ACKNOWLEDGED' | 'UNRESOLVED';
  code:
    | null
    | (
        | 'SCHEDULE_INTENT_NEVER_DISPATCHED'
        | 'SCHEDULE_INTENT_EFFECT_NOT_COMPARABLE'
        | 'SCHEDULE_INTENT_EFFECT_NOT_OBSERVED'
      );
  reconciled: boolean;
}
export interface Canonical_ListScheduledTasksRequest_294Adc6C {
  afterScheduleId?: string | null;
  limit?: number;
  historyLimit?: number;
}
export interface Canonical_ListScheduledTasksOutputD1De26C2 {
  operation: 'list_scheduled_tasks';
  status: 'listed';
  page: Canonical_ListPageBb45Ad34;
}
export interface Canonical_ListPageBb45Ad34 {
  operation: 'list_scheduled_tasks';
  /**
   * @maxItems 20
   */
  rows:
    | []
    | [Canonical_ListRow_3D1B7Bed]
    | [Canonical_ListRow_3D1B7Bed, Canonical_ListRow_3D1B7Bed]
    | [Canonical_ListRow_3D1B7Bed, Canonical_ListRow_3D1B7Bed, Canonical_ListRow_3D1B7Bed]
    | [Canonical_ListRow_3D1B7Bed, Canonical_ListRow_3D1B7Bed, Canonical_ListRow_3D1B7Bed, Canonical_ListRow_3D1B7Bed]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ]
    | [
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed,
        Canonical_ListRow_3D1B7Bed
      ];
  hasMore: boolean;
  nextAfterScheduleId: string | null;
  originalRuns: Canonical_OriginalRuns_073C32E6;
  coverage: {
    complete: false;
    currentRetryVerified: false;
  };
}
export interface Canonical_ListRow_3D1B7Bed {
  projection: Canonical_ScheduleProjection_607C4A02;
  generation: number;
  unresolved: boolean;
  inspection: Canonical_ScheduleInspectionOutput_10F44301 | null;
  inspectionState: 'unavailable' | 'observed';
}
export interface Canonical_ScheduleInspectionOutput_10F44301 {
  projection: Canonical_ScheduleProjection_607C4A02;
  projectionSha256: string;
  observedAt: string;
  temporal: {
    scheduleId: string;
    paused: boolean;
    remainingActions: number | null;
    createdAt: string;
    lastUpdatedAt: string | null;
    numActionsTaken: number;
    numActionsMissedCatchupWindow: number;
    numActionsSkippedOverlap: number;
    /**
     * @maxItems 100
     */
    nextActionTimes: string[];
    /**
     * @maxItems 100
     */
    recentActions: Canonical_ScheduleRecentActionE3Bcac7F[];
    /**
     * @maxItems 100
     */
    runningActions: Canonical_ScheduleOriginalRun_83689F88[];
  };
  coverage: {
    historyComplete: false;
    currentRunIdentityVerified: false;
    nextActions: Canonical_ScheduleInspectionWindowD6C325Bc;
    recentActions: Canonical_ScheduleInspectionWindowD6C325Bc;
    runningActions: Canonical_ScheduleInspectionWindowD6C325Bc;
  };
}
export interface Canonical_ScheduleRecentActionE3Bcac7F {
  scheduledAt: string;
  takenAt: string;
  workflow: Canonical_ScheduleOriginalRun_83689F88;
}
export interface Canonical_ScheduleOriginalRun_83689F88 {
  workflowId: string;
  firstExecutionRunId: string;
}
export interface Canonical_ScheduleInspectionWindowD6C325Bc {
  observed: number;
  returned: number;
  omitted: number;
}
export interface Canonical_OriginalRuns_073C32E6 {
  /**
   * @maxItems 10
   */
  executions:
    | []
    | [Canonical_Execution_2B847724]
    | [Canonical_Execution_2B847724, Canonical_Execution_2B847724]
    | [Canonical_Execution_2B847724, Canonical_Execution_2B847724, Canonical_Execution_2B847724]
    | [
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724
      ]
    | [
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724
      ]
    | [
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724
      ]
    | [
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724
      ]
    | [
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724
      ]
    | [
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724
      ]
    | [
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724,
        Canonical_Execution_2B847724
      ];
  coverage: {
    observedReferences: number;
    returned: number;
    omitted: number;
    historyComplete: false;
    currentRetryVerified: false;
  };
}
export interface Canonical_Execution_2B847724 {
  workflowId: string;
  runId: string;
  status: {
    name: string;
    code: number;
  };
  historyLength: number;
  startTime: string;
  closeTime: string | null;
}
export interface RoutinesErrorResponse {
  error: {
    code: string;
    outcome?: 'NOT_DISPATCHED' | 'UNKNOWN' | 'ACKNOWLEDGED_NOT_RELEASED' | 'UNRESOLVED';
  };
}

export type IntentsLegiwatchProposal=Canonical_LegiwatchProposal_1F841734;
export type IntentsResearchShareProposal=Canonical_ResearchShareProposal_1Cdbd32E;
export type RoutinesProposal=Canonical_PendingProposal_8E88D951;
export type RoutinesApproveResponse=Canonical_Acknowledged_1Fa14Cd2;
export type RoutinesListRequest=Canonical_ListScheduledTasksRequest_294Adc6C;
export type RoutinesListResponse=Canonical_ListScheduledTasksOutputD1De26C2;
export type RoutinesRoute='prepare'|'approve'|'list'|'reconcile';
export interface RoutinesRequestMap {prepare:RoutinesPrepareRequest;approve:RoutinesApproveRequest;list:RoutinesListRequest;reconcile:RoutinesReconcileRequest;}
export interface RoutinesResponseMap {prepare:RoutinesPrepareResponse;approve:RoutinesApproveResponse;list:RoutinesListResponse;reconcile:RoutinesReconcileResponse;}
export interface RoutinesExpectationMap {prepare:{request:RoutinesPrepareRequest};approve:{request:RoutinesApproveRequest;proposal:RoutinesProposal};list:{request:RoutinesListRequest};reconcile:{request:RoutinesReconcileRequest;proposal:RoutinesProposal};}
export type RoutinesResponse<R extends RoutinesRoute>=RoutinesResponseMap[R]|RoutinesErrorResponse;
export declare const routinesPaths:Readonly<{prepare:'/api/routines/prepare';approve:'/api/routines/approve';list:'/api/routines/list';reconcile:'/api/routines/reconcile'}>;
export declare const routinesMetadata:Readonly<{version:'0.1.0';routes:typeof routinesPaths;limits:{requestBytes:131072;responseBytes:2097152}}>;
export declare function receiveRoutinesRequest<R extends RoutinesRoute>(route:R,jsonText:unknown):Promise<RoutinesRequestMap[R]>;
export declare function receiveRoutinesResponse<R extends RoutinesRoute>(route:R,httpStatus:number,jsonText:unknown,expectation:RoutinesExpectationMap[R]):Promise<RoutinesResponse<R>>;
export type IntentsRoute='list'|'decide';
export interface IntentsRequestMap {list:IntentsListRequest;decide:IntentsDecideRequest;}
export interface IntentsResponseMap {list:IntentsListResponse;decide:IntentsDecideResponse;}
export interface IntentsExpectationMap {list:{request:IntentsListRequest};decide:{request:IntentsDecideRequest;proposal:IntentsProposal};}
export type IntentsResponse<R extends IntentsRoute>=IntentsResponseMap[R]|IntentsErrorResponse;
export declare class IntentsResponseError extends Error {readonly code:string;}
export declare const intentsVersion:'0.1.0';
export declare const intentsPaths:Readonly<{"list":"/api/conversations/intents/list","decide":"/api/conversations/intents/decide"}>;
export declare const intentsMetadata:{
  "contractVersion": "0.1.0",
  "schemaId": "urn:meri:intents-application:0.1.0",
  "routes": {
    "list": {
      "method": "POST",
      "path": "/api/conversations/intents/list",
      "response": "json"
    },
    "decide": {
      "method": "POST",
      "path": "/api/conversations/intents/decide",
      "response": "json"
    }
  },
  "authentication": {
    "scheme": "Bearer",
    "authority": "native session admitted by Core membership on every request; tenant, actor and clients come only from that admission, never from a body or a response"
  },
  "limits": {
    "requestBytes": 4096,
    "responseBytes": 16777216,
    "requestMs": 30000,
    "listLimitDefault": 20,
    "listLimitMax": 50,
    "jsonDepth": 64,
    "jsonNodes": 100000
  },
  "errorStatuses": {
    "INVALID_REQUEST": 400,
    "UNAUTHENTICATED": 401,
    "ACCESS_DENIED": 403,
    "MEMBERSHIP_REVOKED": 403,
    "NOT_FOUND": 404,
    "METHOD_NOT_ALLOWED": 405,
    "DEADLINE": 408,
    "MEMBERSHIP_CHANGED": 409,
    "REQUEST_TOO_LARGE": 413,
    "UNSUPPORTED_MEDIA_TYPE": 415,
    "CANCELLED": 499,
    "PRODUCT_UNAVAILABLE": 502,
    "INTENT_APPROVALS_DISABLED": 503,
    "INTENT_NOT_FOUND": 404,
    "INTENT_NOT_PREPARED": 409,
    "INTENT_NOT_APPROVABLE": 409,
    "INTENT_MISMATCH": 409,
    "INTENT_EXPIRED": 409,
    "INTENT_SCOPE_WITHHELD": 403,
    "APPROVER_REFUSED": 403,
    "APPROVAL_OWNER_UNAVAILABLE": 503,
    "APPROVAL_DECISION_REFUSED": 409,
    "APPROVAL_DECISION_UNKNOWN": 502,
    "EXECUTION_OWNER_UNAVAILABLE": 503,
    "EXECUTION_AUTHORITY_REFUSED": 403,
    "INTENT_CROSS_RUN": 409,
    "COMMAND_APPROVAL_REFUSED": 409,
    "COMMAND_AUTHORITY_REFUSED": 403,
    "COMMAND_PREPARATION_REFUSED": 409,
    "COMMAND_REFUSED": 409,
    "COMMAND_OUTCOME_UNKNOWN": 502,
    "INTENT_RESULT_NOT_RELEASED": 502,
    "INTENT_EXECUTION_UNKNOWN": 502,
    "INTENT_JOURNAL_UNAVAILABLE": 503,
    "INTENT_REQUEST_INVALID": 400
  },
  "errorOutcomes": [
    "NOT_DISPATCHED",
    "UNKNOWN",
    "RESULT_NOT_RELEASED"
  ],
  "failureCodes": [
    "UNAVAILABLE",
    "ACCESS_DENIED",
    "REFUSED",
    "INVALID_ARGUMENTS",
    "DEADLINE",
    "CANCELLED",
    "CONFLICT",
    "UNKNOWN"
  ],
  "approvableActions": [
    "task.create",
    "task.update",
    "document.draft",
    "artifact.file"
  ],
  "semantics": {
    "list": "read-only durable history of this conversation's prepared intents; next is the last returned deliveryId when more remain, otherwise null",
    "decision": "approved or rejected is recorded by the canonical decision owner for exactly the named proposal, command hash and approver; display, stream or model text never approves",
    "execution": "only actions in approvableActions execute; any other prepared proposal answers INTENT_NOT_APPROVABLE and stays prepared",
    "executed": "status executed returns the actual owner outcome: Core native task.create/task.update execution and result, a historical task.create receipt/result, or document.draft ArtifactCreatedResult after publication; approval alone remains approved or indeterminate",
    "correlation": "a list answer is admitted against its captured list request; a decide answer is admitted against the captured decide request and the proposal admitted from an earlier list answer; rejected and indeterminate replies carry no conversation or command of their own, so only that retained proposal binds them to the request's conversation and approver",
    "uncertainty": "UNKNOWN and RESULT_NOT_RELEASED mean a decision or effect may exist: repeat the identical decide request or read list; never prepare a second proposal",
    "withheld": "withheld items carry no content because the caller no longer sees a client scope of the retained command",
    "expiry": "the caller compares proposal.expiresAt with a fresh clock before presenting a decision; the server rechecks current authority",
    "phase": "phase is a reading of the durable decision and execution owners, never a decision",
    "integration": "isolated source contract; route mounting, Core decision-owner wiring and runtime qualification remain handoff work"
  }
};
export declare function receiveIntentsRequest<R extends IntentsRoute>(route:R,jsonText:unknown):Promise<IntentsRequestMap[R]>;
export declare function receiveIntentsResponse<R extends IntentsRoute>(route:R,httpStatus:number,jsonText:unknown,expectation:IntentsExpectationMap[R]):Promise<IntentsResponse<R>>;
