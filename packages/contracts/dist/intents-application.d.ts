// Generated additive intents contract from its canonical HTTP/approval owners. No authority implied.

export type IntentsApplicationEnvelope =
  | IntentsConversationId
  | IntentsDeliveryId
  | IntentsOperation
  | IntentsListRequest
  | IntentsDecideRequest
  | IntentsNativeProposal
  | IntentsProposal
  | Canonical_ClientRecordProposalB620B25B
  | Canonical_LegiwatchProposal_1F841734
  | Canonical_BizdevProposalA770314C
  | Canonical_WatchProposal_14Eddeec
  | Canonical_ResearchShareProposal_1Cdbd32E
  | Canonical_ResearchActionProposal_081Cad69
  | Canonical_ApprovalDecision_5E8Bdbcf
  | Canonical_TaskCreateArguments_1202C301
  | Canonical_TaskUpdateArguments_48509A7A
  | Canonical_MailSendArguments_016B3776
  | Canonical_MailSendContext_7D8B78F1
  | Canonical_MailSendCommand_981E52Ba
  | IntentsMailSendResult
  | IntentsNativeMailOutcome
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
  | IntentsLegislativeDocumentItem
  | IntentsWithheldLegislativeDocumentItem
  | IntentsClientRecordItem
  | IntentsWithheldLegiwatchItem
  | IntentsWithheldClientRecordItem
  | IntentsBizdevItem
  | IntentsWithheldBizdevItem
  | IntentsWatchItem
  | IntentsWithheldWatchItem
  | IntentsResearchActionItem
  | IntentsWithheldResearchActionItem
  | IntentsResearchShareItem
  | IntentsSavedNoteItem
  | IntentsWithheldSavedNoteItem
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
  | Canonical_MailSendApprovalProposalC6Ab2C41
  | Canonical_DocumentDraftApprovalProposal_834C2460;
export type IntentsProposal =
  | IntentsNativeProposal
  | Canonical_ResearchShareProposal_1Cdbd32E
  | Canonical_ResearchActionProposal_081Cad69
  | Canonical_LegiwatchProposal_1F841734
  | Canonical_WatchProposal_14Eddeec
  | Canonical_ClientRecordProposalB620B25B
  | Canonical_BizdevProposalA770314C
  | Canonical_LegislativeDocumentProposal_3D80036F;
export type Canonical_LegiwatchRequest_5Cff194F =
  Canonical_SuggestionLegiwatchRequestD59A433F | Canonical_RelevanceRequest_3250901F;
export type Canonical_WatchRequest_1E607664 = {
  family: 'legiwatch_keyword' | 'business_development_prospect' | 'defense_budget_target' | 'client_watchlist';
  clientId: string | null;
  targetKind: string;
  targetKey: string;
  operation: 'subscribe' | 'pause' | 'resume' | 'unsubscribe' | 'set_delivery';
  expectedVersion: number;
  sourceRevision: string | null;
  reason: string | null;
  enabled: boolean | null;
  requestKey: string;
};
export type Canonical_ClientRecordRequestE2A54772 =
  | {
      operation: 'create_client';
      input: Canonical_CreateClientInputC55F4423;
    }
  | {
      operation: 'update_client_profile';
      input: Canonical_UpdateClientProfileInput_8Caec89E;
    };
export type IntentsMailSendResult =
  | {
      state: 'failed';
      intentId: string;
      requestKey: string;
      retryable: false;
    }
  | {
      state: 'accepted';
      intentId: string;
      requestKey: string;
      retryable: false;
      threadId: string;
      messageId: string;
      provider: 'gmail' | 'microsoft_graph';
      senderConnectionId: string;
      senderEmail: string;
      mode: 'send' | 'reply' | 'reply_all' | 'forward';
      original: {
        threadId: string;
        messageId: string;
        updatedAt: string;
        bodySha256: string | null;
      } | null;
      signaturePolicy: 'actor';
      signatureAppended: boolean;
      mailboxConfirmation: null | 'pending' | 'confirmed';
    };
export type IntentsExecutionOutcome =
  | {
      receipt: Canonical_CommandReceiptAc49Ee1E;
      result: Canonical_TaskCreateResult_0501C509;
    }
  | IntentsNativeTaskOutcome
  | IntentsNativeMailOutcome
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
export type Canonical_LegiwatchReceipt_706F9465 =
  Canonical_SuggestionLegiwatchReceiptD2466C8D | Canonical_RelevanceReceiptEf963586;
export type Canonical_LegislativeDocumentStatus_63289936 =
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
export type Canonical_LegislativeDocumentEffect_69D4Cb58 = 'complete' | 'selection_only' | 'unknown';
export type Canonical_ClientRecordStatus_58565696 =
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
export type Canonical_ClientRecordReceipt_8A925D68 =
  | {
      request: Canonical_ClientRecordRequestE2A54772;
      outcome: 'created';
      created: true;
      client: {
        id: string;
        name: string;
        website: string | null;
      };
      ldaMatch: {
        ldaClientId: number;
        name: string;
        totalFilings: number;
        latestFilingYear: number | null;
      } | null;
    }
  | {
      request: Canonical_ClientRecordRequestE2A54772;
      outcome: 'updated' | 'partially_updated' | 'not_updated' | 'unchanged';
      tool: 'update_client_profile';
      updated: true;
      clientId: string;
      clientName: string;
      /**
       * @maxItems 13
       */
      fieldsWritten:
        | []
        | [
            | 'name'
            | 'website'
            | 'description'
            | 'productDescription'
            | 'primaryContactName'
            | 'primaryContactEmail'
            | 'primaryContactPhone'
            | 'sectorTag'
            | 'uei'
            | 'cageCode'
            | 'issueCodes'
            | 'naicsCodes'
            | 'pscCodes'
          ]
        | [
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            )
          ]
        | [
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            )
          ]
        | [
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            )
          ]
        | [
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            )
          ]
        | [
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            )
          ]
        | [
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            )
          ]
        | [
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            )
          ]
        | [
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            )
          ]
        | [
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            )
          ]
        | [
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            )
          ]
        | [
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            )
          ]
        | [
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            ),
            (
              | 'name'
              | 'website'
              | 'description'
              | 'productDescription'
              | 'primaryContactName'
              | 'primaryContactEmail'
              | 'primaryContactPhone'
              | 'sectorTag'
              | 'uei'
              | 'cageCode'
              | 'issueCodes'
              | 'naicsCodes'
              | 'pscCodes'
            )
          ];
      /**
       * @maxItems 150
       */
      facilitiesCreated: string[];
      /**
       * @maxItems 150
       */
      capabilitiesCreated: string[];
      /**
       * @maxItems 150
       */
      peopleCreated: string[];
      /**
       * @maxItems 150
       */
      peopleUpdated: string[];
      /**
       * @maxItems 150
       */
      skipped: string[];
      /**
       * @maxItems 150
       */
      rowErrors: string[];
    };
export type Canonical_BizdevStatusFbac340B =
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
export type Canonical_WatchStatus_828649Ac =
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
export type Canonical_ResearchActionProposalStatusBca9B5Cd =
  | 'proposed'
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
  | IntentsSavedNoteItem
  | IntentsWithheldSavedNoteItem
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
  | IntentsResearchActionItem
  | IntentsWithheldResearchActionItem
  | IntentsLegiwatchItem
  | IntentsWithheldLegiwatchItem
  | IntentsWatchItem
  | IntentsWithheldWatchItem
  | IntentsClientRecordItem
  | IntentsWithheldClientRecordItem
  | IntentsBizdevItem
  | IntentsWithheldBizdevItem
  | IntentsLegislativeDocumentItem
  | IntentsWithheldLegislativeDocumentItem;
export type IntentsDecideResponse =
  | {
      status: 'legislative_document_decided';
      deliveryId: IntentsDeliveryId;
      proposalId: string;
      result: Canonical_LegislativeDocumentCoreResult_05815D48;
    }
  | {
      status: 'legiwatch_decided';
      deliveryId: IntentsDeliveryId;
      proposalId: string;
      result: Canonical_LegiwatchCoreResultC5Ab3126;
    }
  | {
      status: 'client_record_decided';
      deliveryId: IntentsDeliveryId;
      proposalId: string;
      result: Canonical_ClientRecordCoreResultCb1Df09E;
    }
  | {
      status: 'bizdev_decided';
      deliveryId: IntentsDeliveryId;
      proposalId: string;
      result: Canonical_BizdevCoreResultF44012F2;
    }
  | {
      status: 'watch_decided';
      deliveryId: IntentsDeliveryId;
      proposalId: string;
      result: Canonical_WatchCoreResult_1C60295E;
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
      status: 'research_action_decided';
      deliveryId: IntentsDeliveryId;
      proposalId: string;
      proposalStatus: Canonical_ResearchActionProposalStatusBca9B5Cd;
      resultSummary?: Canonical_ResearchActionResultSummary_40527Cb3;
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
export interface Canonical_MailSendApprovalProposalC6Ab2C41 {
  proposalId: string;
  command: Canonical_MailSendCommand_981E52Ba;
  commandSha256: string;
  createdAt: string;
  expiresAt: string;
  requiredApprover: Canonical_IdentityAba0A4E9;
}
export interface Canonical_MailSendCommand_981E52Ba {
  contractVersion: '0.2.0';
  commandId: string;
  binding: Canonical_RunBinding_84F2304C;
  action: 'mail.send';
  arguments: Canonical_MailSendArguments_016B3776;
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
export interface Canonical_MailSendArguments_016B3776 {
  mode: 'send' | 'reply' | 'reply_all' | 'forward';
  clientId: string | null;
  senderConnectionId: string;
  senderEmail: string;
  /**
   * @minItems 1
   * @maxItems 50
   */
  to: [string, ...string[]];
  /**
   * @maxItems 10
   */
  cc:
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
    | [string, string, string, string, string, string, string, string, string, string];
  /**
   * @maxItems 10
   */
  bcc:
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
    | [string, string, string, string, string, string, string, string, string, string];
  subject: string;
  bodyHtml: string;
  /**
   * @maxItems 5
   */
  files:
    | []
    | [
        {
          attachmentId: string;
          fileName: string;
          contentType: string;
          bytes: number;
          sha256: string;
        }
      ]
    | [
        {
          attachmentId: string;
          fileName: string;
          contentType: string;
          bytes: number;
          sha256: string;
        },
        {
          attachmentId: string;
          fileName: string;
          contentType: string;
          bytes: number;
          sha256: string;
        }
      ]
    | [
        {
          attachmentId: string;
          fileName: string;
          contentType: string;
          bytes: number;
          sha256: string;
        },
        {
          attachmentId: string;
          fileName: string;
          contentType: string;
          bytes: number;
          sha256: string;
        },
        {
          attachmentId: string;
          fileName: string;
          contentType: string;
          bytes: number;
          sha256: string;
        }
      ]
    | [
        {
          attachmentId: string;
          fileName: string;
          contentType: string;
          bytes: number;
          sha256: string;
        },
        {
          attachmentId: string;
          fileName: string;
          contentType: string;
          bytes: number;
          sha256: string;
        },
        {
          attachmentId: string;
          fileName: string;
          contentType: string;
          bytes: number;
          sha256: string;
        },
        {
          attachmentId: string;
          fileName: string;
          contentType: string;
          bytes: number;
          sha256: string;
        }
      ]
    | [
        {
          attachmentId: string;
          fileName: string;
          contentType: string;
          bytes: number;
          sha256: string;
        },
        {
          attachmentId: string;
          fileName: string;
          contentType: string;
          bytes: number;
          sha256: string;
        },
        {
          attachmentId: string;
          fileName: string;
          contentType: string;
          bytes: number;
          sha256: string;
        },
        {
          attachmentId: string;
          fileName: string;
          contentType: string;
          bytes: number;
          sha256: string;
        },
        {
          attachmentId: string;
          fileName: string;
          contentType: string;
          bytes: number;
          sha256: string;
        }
      ];
  original: {
    threadId: string;
    messageId: string;
    updatedAt: string;
    bodySha256: string | null;
  } | null;
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
export interface Canonical_ResearchActionProposal_081Cad69 {
  kind: 'research_action';
  proposalId: string;
  commandSha256: string;
  binding: Canonical_RunBinding_84F2304C;
  /**
   * @minItems 1
   * @maxItems 1
   */
  scopes: [Canonical_ScopeF882Edb5];
  operation:
    | 'manage_research_portfolio'
    | 'create_research_portfolio_snapshot'
    | 'request_research_portfolio_output'
    | 'save_research_portfolio_output_to_client'
    | 'watch_research_portfolio'
    | 'update_research_portfolio_change_state'
    | 'create_research_portfolio_bookmark'
    | 'add_research_portfolio_review_note'
    | 'prepare_research_portfolio_brief'
    | 'prepare_research_portfolio_meeting';
  request:
    | Canonical_ResearchActionManageBound_8B5450A3
    | Canonical_ResearchActionSnapshotBound_3E932D2D
    | Canonical_ResearchActionOutputBound_43Ec0527
    | Canonical_ResearchActionSaveOutputBoundD0981E39
    | Canonical_ResearchActionWatchBound_39Fddaa7
    | Canonical_ResearchActionChangeStateBoundB09Be19C
    | Canonical_ResearchActionBookmarkBound_22B0A591
    | Canonical_ResearchActionReviewNoteBound_10F0C889
    | Canonical_ResearchActionBriefBound_1468Baf3
    | Canonical_ResearchActionMeetingBoundAa72483C;
  preview: Canonical_ResearchActionPreview_7B7Dfa31;
  createdAt: string;
  expiresAt: string;
}
export interface Canonical_ResearchActionManageBound_8B5450A3 {
  conversationId: string;
  action:
    | 'portfolio_create'
    | 'portfolio_update'
    | 'portfolio_archive'
    | 'portfolio_restore'
    | 'grants_list'
    | 'client_links_list'
    | 'members_list'
    | 'grant_upsert'
    | 'grant_delete'
    | 'client_link_create'
    | 'client_link_delete'
    | 'member_create'
    | 'members_decide'
    | 'member_resolve'
    | 'rule_preview'
    | 'rule_publish'
    | 'review_assign'
    | 'review_decide'
    | 'reviews_bulk_decide'
    | 'annual_review_get'
    | 'annual_review_refresh'
    | 'annual_review_reopen'
    | 'import_create'
    | 'import_action'
    | 'subscriptions_list'
    | 'deliveries_list'
    | 'subscription_update'
    | 'bookmark_update'
    | 'bookmark_delete'
    | 'fit_refresh'
    | 'watch_conversion_preview'
    | 'watch_conversion_apply'
    | 'output_get'
    | 'output_cancel'
    | 'output_retry'
    | 'output_reconcile'
    | 'snapshots_list'
    | 'snapshot_get'
    | 'taxonomy_get'
    | 'templates_list'
    | 'template_version_get'
    | 'operation_reconcile'
    | 'comparison_list'
    | 'comparison_get'
    | 'comparison_create'
    | 'comparison_revise'
    | 'comparison_archive'
    | 'comparison_restore'
    | 'comparison_add_selection';
  /**
   * Parameters of the selected Core management action, validated by Core against that action’s own schema; the idempotent key is derived by Meri, never supplied.
   */
  parameters: {};
  confirmed: true;
}
export interface Canonical_ResearchActionSnapshotBound_3E932D2D {
  conversationId: string;
  name: string;
  expectedRevision: number;
  operationKey: string;
}
export interface Canonical_ResearchActionOutputBound_43Ec0527 {
  conversationId: string;
  snapshotId?: string;
  operationKey: string;
}
export interface Canonical_ResearchActionSaveOutputBoundD0981E39 {
  conversationId: string;
  outputId: string;
  clientId: string;
  operationKey: string;
}
export interface Canonical_ResearchActionWatchBound_39Fddaa7 {
  conversationId: string;
}
export interface Canonical_ResearchActionChangeStateBoundB09Be19C {
  conversationId: string;
  eventId: string;
  action: 'seen' | 'acknowledged' | 'dismissed' | 'undo';
  expectedRevision?: number;
}
export interface Canonical_ResearchActionBookmarkBound_22B0A591 {
  conversationId: string;
  targetKind: 'member' | 'snapshot' | 'evidence' | 'review' | 'import' | 'output' | 'other';
  targetId: string;
  label?: string | null;
  note?: string | null;
  operationKey: string;
}
export interface Canonical_ResearchActionReviewNoteBound_10F0C889 {
  conversationId: string;
  reviewId: string;
  body: string;
  expectedRevision: number;
  operationKey: string;
}
export interface Canonical_ResearchActionBriefBound_1468Baf3 {
  conversationId: string;
  confirmed: true;
  operationKey: string;
}
export interface Canonical_ResearchActionMeetingBoundAa72483C {
  conversationId: string;
  confirmed: true;
  meetingId?: string;
  /**
   * @maxItems 20
   */
  selectedReviewIds?:
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
  operationKey: string;
}
export interface Canonical_ResearchActionPreview_7B7Dfa31 {
  label: string;
  portfolioId?: string;
  clientName?: string;
  fields?: {
    [k: string]: string | number | boolean | null;
  };
}
export interface Canonical_LegiwatchProposal_1F841734 {
  kind: 'legiwatch_action';
  binding: Canonical_RunBinding_84F2304C;
  /**
   * @minItems 1
   * @maxItems 1
   */
  scopes: [Canonical_ScopeF882Edb5];
  operation: 'apply_legiwatch_suggestion' | 'save_legiwatch_relevance';
  proposalId: string;
  request: Canonical_LegiwatchRequest_5Cff194F;
  context: Canonical_LegiwatchContextA906D964;
  createdAt: string;
  expiresAt: string;
  commandSha256: string;
}
export interface Canonical_SuggestionLegiwatchRequestD59A433F {
  clientId: string | null;
  folderId: string;
  jurisdiction: string;
  sessionKey: string;
  suggestionId: string;
  expectedVersion: number;
  action: 'add' | 'dismiss' | 'exclude' | 'restore' | 'undo';
  requestKey: string;
}
export interface Canonical_RelevanceRequest_3250901F {
  clientId: string | null;
  folderId: string;
  jurisdiction: string;
  sessionKey: string;
  /**
   * @minItems 1
   * @maxItems 3
   */
  fields:
    | ['title' | 'bill_text' | 'amendment_text']
    | ['title' | 'bill_text' | 'amendment_text', 'title' | 'bill_text' | 'amendment_text']
    | [
        'title' | 'bill_text' | 'amendment_text',
        'title' | 'bill_text' | 'amendment_text',
        'title' | 'bill_text' | 'amendment_text'
      ];
  billId: string;
  explanation: string;
  documentId: string;
  start: number;
  end: number;
  quote: string;
  previewHash: string;
  requestKey: string;
}
export interface Canonical_LegiwatchContextA906D964 {
  conversationId: string;
  selectedClientId: string | null;
  identityRevision: string;
  membershipRevision: string;
  contextRevision: string;
}
export interface Canonical_WatchProposal_14Eddeec {
  kind: 'watch_action';
  binding: Canonical_RunBinding_84F2304C;
  /**
   * @minItems 1
   * @maxItems 1
   */
  scopes: [Canonical_ScopeF882Edb5];
  operation: 'watch_action';
  proposalId: string;
  request: Canonical_WatchRequest_1E607664;
  context: Canonical_WatchContextE72A3A40;
  createdAt: string;
  expiresAt: string;
  commandSha256: string;
}
export interface Canonical_WatchContextE72A3A40 {
  conversationId: string;
  selectedClientId: string | null;
  identityRevision: string;
  membershipRevision: string;
  contextRevision: string;
}
export interface Canonical_ClientRecordProposalB620B25B {
  kind: 'client_record_action';
  binding: Canonical_RunBinding_84F2304C;
  /**
   * @minItems 1
   * @maxItems 1
   */
  scopes: [Canonical_ScopeF882Edb5];
  operation: 'create_client' | 'update_client_profile';
  proposalId: string;
  request: Canonical_ClientRecordRequestE2A54772;
  context: Canonical_ClientRecordContext_6Cea2055;
  createdAt: string;
  expiresAt: string;
  commandSha256: string;
}
export interface Canonical_CreateClientInputC55F4423 {
  name: string;
  website?: string;
  description?: string;
  sectorTag?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  ldaClientId?: number;
  skipLdaCheck?: boolean;
}
export interface Canonical_UpdateClientProfileInput_8Caec89E {
  name?: string;
  website?: string;
  description?: string;
  sectorTag?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  clientId: string;
  productDescription?: string;
  uei?: string;
  cageCode?: string;
  /**
   * @maxItems 100
   */
  issueCodes?: string[];
  /**
   * @maxItems 100
   */
  naicsCodes?: string[];
  /**
   * @maxItems 100
   */
  pscCodes?: string[];
  provenance?: {
    name?: {
      sourceUrl: string;
      confidence: 'high' | 'medium' | 'low';
    };
    website?: {
      sourceUrl: string;
      confidence: 'high' | 'medium' | 'low';
    };
    description?: {
      sourceUrl: string;
      confidence: 'high' | 'medium' | 'low';
    };
    productDescription?: {
      sourceUrl: string;
      confidence: 'high' | 'medium' | 'low';
    };
    primaryContactName?: {
      sourceUrl: string;
      confidence: 'high' | 'medium' | 'low';
    };
    primaryContactEmail?: {
      sourceUrl: string;
      confidence: 'high' | 'medium' | 'low';
    };
    primaryContactPhone?: {
      sourceUrl: string;
      confidence: 'high' | 'medium' | 'low';
    };
    sectorTag?: {
      sourceUrl: string;
      confidence: 'high' | 'medium' | 'low';
    };
    uei?: {
      sourceUrl: string;
      confidence: 'high' | 'medium' | 'low';
    };
    cageCode?: {
      sourceUrl: string;
      confidence: 'high' | 'medium' | 'low';
    };
    issueCodes?: {
      sourceUrl: string;
      confidence: 'high' | 'medium' | 'low';
    };
    naicsCodes?: {
      sourceUrl: string;
      confidence: 'high' | 'medium' | 'low';
    };
    pscCodes?: {
      sourceUrl: string;
      confidence: 'high' | 'medium' | 'low';
    };
  };
  /**
   * @maxItems 50
   */
  facilities?: {
    name: string;
    addressLine?: string;
    city?: string;
    state?: string;
    zip?: string;
    congressionalDistrict?: string;
    notes?: string;
    employeeCount?: number;
  }[];
  /**
   * @maxItems 50
   */
  capabilities?: {
    name: string;
    type?: string;
    description?: string;
    sector?: string;
    notes?: string;
  }[];
  /**
   * @maxItems 50
   */
  people?: {
    name: string;
    title?: string;
    email?: string;
    phone?: string;
    role?: string;
    lastContact?: string;
    notes?: string;
  }[];
}
export interface Canonical_ClientRecordContext_6Cea2055 {
  conversationId: string;
  selectedClientId: string | null;
  identityRevision: string;
  membershipRevision: string;
  contextRevision: string;
}
export interface Canonical_BizdevProposalA770314C {
  kind: 'bizdev_action';
  binding: Canonical_RunBinding_84F2304C;
  /**
   * @minItems 1
   * @maxItems 1
   */
  scopes: [Canonical_ScopeF882Edb5];
  operation: 'save_business_development_brief';
  proposalId: string;
  request: Canonical_BizdevRequest_377Bb4Ab;
  context: Canonical_BizdevContext_894Be03E;
  createdAt: string;
  expiresAt: string;
  commandSha256: string;
}
export interface Canonical_BizdevRequest_377Bb4Ab {
  conversationId: string;
  expectedVersionNumber: number;
  title?: string;
  sections: Canonical_BizdevSectionsB2A43546;
  requestKey: string;
}
export interface Canonical_BizdevSectionsB2A43546 {
  companyAndFirmImplication: Canonical_BizdevSection_433874A1;
  verifiedEvidence: Canonical_BizdevSection_433874A1;
  judgment: Canonical_BizdevSection_433874A1;
  practicalAction: Canonical_BizdevSection_433874A1;
  missingInformation: Canonical_BizdevSection_433874A1;
}
export interface Canonical_BizdevSection_433874A1 {
  text: string;
  citationIndexes: number[];
}
export interface Canonical_BizdevContext_894Be03E {
  conversationId: string;
  prospectId: string;
  prospectName: string;
  canonicalOrganizationId: string | null;
  linkedClientId: string | null;
  scopeVersion: string;
}
export interface Canonical_LegislativeDocumentProposal_3D80036F {
  kind: 'legislative_document_action';
  binding: Canonical_RunBinding_84F2304C;
  /**
   * @minItems 1
   * @maxItems 1
   */
  scopes: [Canonical_ScopeF882Edb5];
  operation: 'prepare_legiwatch_briefing' | 'save_legislative_research';
  proposalId: string;
  request:
    Canonical_LegislativeDocumentBriefingRequest_9E6E443D | Canonical_LegislativeDocumentResearchRequest_80582Baa;
  context: Canonical_LegislativeDocumentContext_6C736Cef;
  createdAt: string;
  expiresAt: string;
  commandSha256: string;
}
export interface Canonical_LegislativeDocumentBriefingRequest_9E6E443D {
  clientId: string | null;
  folderId: string;
  jurisdiction?: string;
  sessionKey?: string;
  template: 'research_update' | 'daily_legislative_brief' | 'morning_news_brief';
  title: string;
  analysis: string;
  cutoff: string;
  timezone: string;
  /**
   * @maxItems 50
   */
  sources: Canonical_LegislativeDocumentSourceD053De86[];
  /**
   * @minItems 1
   * @maxItems 150
   */
  citations: [Canonical_LegislativeDocumentCitationC039Aff7, ...Canonical_LegislativeDocumentCitationC039Aff7[]];
  requestKey: string;
}
export interface Canonical_LegislativeDocumentSourceD053De86 {
  kind: string;
  id: string;
  revision: string;
}
export interface Canonical_LegislativeDocumentCitationC039Aff7 {
  kind: string;
  id: string;
  revision: string;
  locator: string;
  start: number;
  end: number;
  quote: string;
}
export interface Canonical_LegislativeDocumentResearchRequest_80582Baa {
  clientId: string | null;
  folderId: string | null;
  jurisdiction: string;
  sessionKey: string;
  title: string;
  analysis: string;
  /**
   * @minItems 1
   * @maxItems 10
   */
  documents:
    | [
        {
          id: string;
          revision: string;
          sessionKey?: string;
        }
      ]
    | [
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        }
      ]
    | [
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        }
      ]
    | [
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        }
      ]
    | [
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        }
      ]
    | [
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        }
      ]
    | [
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        }
      ]
    | [
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        }
      ]
    | [
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        }
      ]
    | [
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        },
        {
          id: string;
          revision: string;
          sessionKey?: string;
        }
      ];
  /**
   * @minItems 1
   * @maxItems 100
   */
  citations: [
    Canonical_LegislativeDocumentSelectionCitationD6E0702C,
    ...Canonical_LegislativeDocumentSelectionCitationD6E0702C[]
  ];
  allowCrossBill?: boolean;
  rightSessionKey?: string;
  requestKey: string;
}
export interface Canonical_LegislativeDocumentSelectionCitationD6E0702C {
  documentId: string;
  revision: string;
  locator: string;
  start: number;
  end: number;
  quote: string;
}
export interface Canonical_LegislativeDocumentContext_6C736Cef {
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
export interface Canonical_MailSendContext_7D8B78F1 {
  binding: Canonical_RunBinding_84F2304C;
}
export interface IntentsNativeMailOutcome {
  execution: {
    kind: 'native-mail';
    proposalId: string;
    commandSha256: string;
    idempotencyKey: string;
    binding: Canonical_RunBinding_84F2304C;
    approvalDecisionSha256: string;
  };
  result: IntentsMailSendResult;
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
export interface Canonical_SuggestionLegiwatchReceiptD2466C8D {
  request: Canonical_SuggestionLegiwatchRequestD59A433F;
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
export interface Canonical_RelevanceReceiptEf963586 {
  request: Canonical_RelevanceRequest_3250901F;
  outcome: 'suggested';
  payload: {
    binding: string;
    suggestionId: string;
    version: number;
    origin: 'semantic';
    state: 'pending';
  };
}
export interface IntentsLegislativeDocumentItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'legislative_document_action';
  proposal: Canonical_LegislativeDocumentProposal_3D80036F;
  result: Canonical_LegislativeDocumentCoreResult_05815D48 | 'unavailable';
}
export interface Canonical_LegislativeDocumentCoreResult_05815D48 {
  version: '0.1.0';
  proposalId: string;
  status: Canonical_LegislativeDocumentStatus_63289936;
  operation: 'prepare_legiwatch_briefing' | 'save_legislative_research';
  request:
    Canonical_LegislativeDocumentBriefingRequest_9E6E443D | Canonical_LegislativeDocumentResearchRequest_80582Baa;
  context: Canonical_LegislativeDocumentContext_6C736Cef;
  createdAt: string;
  expiresAt: string;
  receipt: Canonical_LegislativeDocumentReceipt_70F3Ce37 | null;
  effect: Canonical_LegislativeDocumentEffect_69D4Cb58 | null;
}
export interface Canonical_LegislativeDocumentReceipt_70F3Ce37 {
  state: 'complete' | 'selection_only';
  selectionId: string | null;
  documentId: string | null;
  location: string | null;
  reused: boolean;
  request:
    Canonical_LegislativeDocumentBriefingRequest_9E6E443D | Canonical_LegislativeDocumentResearchRequest_80582Baa;
}
export interface IntentsWithheldLegislativeDocumentItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'legislative_document_action';
  withheld: true;
}
export interface IntentsClientRecordItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'client_record_action';
  proposal: Canonical_ClientRecordProposalB620B25B;
  result: Canonical_ClientRecordCoreResultCb1Df09E | 'unavailable';
}
export interface Canonical_ClientRecordCoreResultCb1Df09E {
  version: '0.1.0';
  proposalId: string;
  request: Canonical_ClientRecordRequestE2A54772;
  context: Canonical_ClientRecordContext_6Cea2055;
  createdAt: string;
  expiresAt: string;
  status: Canonical_ClientRecordStatus_58565696;
  receipt: Canonical_ClientRecordReceipt_8A925D68 | null;
}
export interface IntentsWithheldLegiwatchItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'legiwatch_action';
  withheld: true;
}
export interface IntentsWithheldClientRecordItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'client_record_action';
  withheld: true;
}
export interface IntentsBizdevItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'bizdev_action';
  proposal: Canonical_BizdevProposalA770314C;
  result: Canonical_BizdevCoreResultF44012F2 | 'unavailable';
}
export interface Canonical_BizdevCoreResultF44012F2 {
  version: '0.1.0';
  proposalId: string;
  request: Canonical_BizdevRequest_377Bb4Ab;
  context: Canonical_BizdevContext_894Be03E;
  createdAt: string;
  expiresAt: string;
  status: Canonical_BizdevStatusFbac340B;
  receipt: Canonical_BizdevReceiptDbab7Eca | null;
}
export interface Canonical_BizdevReceiptDbab7Eca {
  request: Canonical_BizdevRequest_377Bb4Ab;
  binding: string;
  tool: 'save_business_development_brief';
  status: 'saved';
  generatedAt: string;
  brief: {
    id: string;
    title: string;
    status: 'draft' | 'archived';
    currentVersionNumber: number;
    updatedAt: string;
  };
  version: {
    id: string;
    versionNumber: number;
    createdAt: string;
    citationCount: number;
  };
  reused: boolean;
  prospectName: string;
}
export interface IntentsWithheldBizdevItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'bizdev_action';
  withheld: true;
}
export interface IntentsWatchItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'watch_action';
  proposal: Canonical_WatchProposal_14Eddeec;
  result: Canonical_WatchCoreResult_1C60295E | 'unavailable';
}
export interface Canonical_WatchCoreResult_1C60295E {
  version: '0.1.0';
  proposalId: string;
  request: Canonical_WatchRequest_1E607664;
  context: Canonical_WatchContextE72A3A40;
  createdAt: string;
  expiresAt: string;
  status: Canonical_WatchStatus_828649Ac;
  receipt: Canonical_WatchReceiptF63Ece6D | null;
}
export interface Canonical_WatchReceiptF63Ece6D {
  request: Canonical_WatchRequest_1E607664;
  owner: 'legiwatch_keyword' | 'business_development_prospect' | 'defense_budget_target' | 'client_watchlist';
  binding: string;
  operation: 'subscribe' | 'pause' | 'resume' | 'unsubscribe' | 'set_delivery';
  targetKey: string;
  identity: string;
  state: 'active' | 'paused' | 'needs_review' | 'ended' | 'unsubscribed';
  version: number | null;
  deliveryEnabled: boolean | null;
  eventId: string | null;
  alreadyInState: boolean;
}
export interface IntentsWithheldWatchItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'watch_action';
  withheld: true;
}
export interface IntentsResearchActionItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'research_action';
  proposal: Canonical_ResearchActionProposal_081Cad69;
  result: Canonical_ResearchActionDecided_2D61F0Bf | 'unavailable';
}
export interface Canonical_ResearchActionDecided_2D61F0Bf {
  proposalStatus: Canonical_ResearchActionProposalStatusBca9B5Cd;
  resultSummary?: Canonical_ResearchActionResultSummary_40527Cb3;
}
export interface Canonical_ResearchActionResultSummary_40527Cb3 {
  client?: {
    id?: string;
    name?: string;
  };
  [k: string]:
    | string
    | number
    | boolean
    | null
    | {
        id?: string;
        name?: string;
      }
    | undefined;
}
export interface IntentsWithheldResearchActionItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'research_action';
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
export interface IntentsSavedNoteItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'saved_note';
  result: Canonical_SavedNoteResult_85Af7219;
}
export interface Canonical_SavedNoteResult_85Af7219 {
  status: 'saved' | 'withheld' | 'blocked' | 'unknown' | 'failed';
  operation: 'save_note';
  binding: Canonical_RunBinding_84F2304C;
  /**
   * @minItems 1
   * @maxItems 1
   */
  scopes: [Canonical_ScopeF882Edb5];
  destination?: ('meeting' | 'client_document' | 'general') | null;
  noteId?: string | null;
  meetingNoteId?: string | null;
  documentId?: string | null;
  location?: string | null;
  indexingStatus?: ('indexed' | 'pending' | 'not_indexed') | null;
  readiness?: ('ready' | 'indexing' | 'indexed' | 'private' | 'scanning' | 'unavailable') | null;
  reused?: boolean | null;
  bodyHash: string;
  bodyLength: number;
  proposalId: string;
  policyOutcome: 'PASS' | 'WARN' | 'BLOCK';
  createdAt: string;
  expiresAt: string;
  recordedAt: string;
  generatedAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}
export interface IntentsWithheldSavedNoteItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'saved_note';
  withheld: true;
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

export type IntentsWatchProposal=Canonical_WatchProposal_14Eddeec;
export type IntentsLegiwatchProposal=Canonical_LegiwatchProposal_1F841734;
export type IntentsBizdevProposal=Canonical_BizdevProposalA770314C;
export type IntentsResearchShareProposal=Canonical_ResearchShareProposal_1Cdbd32E;
export type IntentsResearchActionProposal=Canonical_ResearchActionProposal_081Cad69;
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
    "artifact.file",
    "mail.send"
  ],
  "semantics": {
    "list": "read-only durable history of this conversation's prepared intents; next is the last returned deliveryId when more remain, otherwise null",
    "decision": "approved or rejected is recorded by the canonical decision owner for exactly the named proposal, command hash and approver; display, stream or model text never approves",
    "execution": "only actions in approvableActions execute; any other prepared proposal answers INTENT_NOT_APPROVABLE and stays prepared",
    "executed": "status executed returns the actual owner outcome: Core native task.create/task.update execution and result, a historical task.create receipt/result, document.draft ArtifactCreatedResult after publication, or native mail accepted/failed durable attempt (provider acceptance is not delivery); approval alone remains approved or indeterminate",
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
