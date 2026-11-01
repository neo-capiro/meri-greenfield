/* Generated from canonical schemas. */

/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalCompilerSource".
 *
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalDraftCompilerSource_449cfb6a".
 */
export type FederalCompilerSource =
  | {
      documentId: string;
      publisher: string;
      sourceVersion: string;
      sourceUrl: string;
      publishedAt: string | null;
      parserVersion: "federal-plain-text/1";
      sha256: string;
      text: string;
      coverage: {
        complete: boolean;
        /**
         * @minItems 1
         * @maxItems 32
         */
        limitations: [string, ...string[]];
      };
      /**
       * @minItems 1
       * @maxItems 128
       */
      scopes: [
        {
          id: string;
          label: string;
          start: number;
          end: number;
          sha256: string;
        },
        ...{
          id: string;
          label: string;
          start: number;
          end: number;
          sha256: string;
        }[]
      ];
    }
  | {
      documentId: string;
      publisher: string;
      sourceVersion: string;
      sourceUrl: string;
      publishedAt: string | null;
      parserVersion: "federal-scoped-text/2";
      sha256: string;
      text: string;
      coverage: {
        complete: boolean;
        /**
         * @minItems 1
         * @maxItems 32
         */
        limitations: [string, ...string[]];
      };
      /**
       * @minItems 1
       * @maxItems 128
       */
      scopes: [
        {
          id: string;
          label: string;
          start: number;
          end: number;
          sha256: string;
          /**
           * @maxItems 127
           */
          ancestorPath: string[];
        },
        ...{
          id: string;
          label: string;
          start: number;
          end: number;
          sha256: string;
          /**
           * @maxItems 127
           */
          ancestorPath: string[];
        }[]
      ];
    }
  | {
      documentId: string;
      publisher: string;
      sourceVersion: string;
      sourceUrl: string;
      publishedAt: string | null;
      parserVersion: "federal-uslm-xml/1";
      sha256: string;
      text: string;
      coverage: {
        complete: boolean;
        /**
         * @minItems 1
         * @maxItems 32
         */
        limitations: [string, ...string[]];
      };
      /**
       * @minItems 1
       * @maxItems 1024
       */
      scopes: [
        {
          id: string;
          label: string;
          start: number;
          end: number;
          sha256: string;
          /**
           * @maxItems 127
           */
          ancestorPath: string[];
        },
        ...{
          id: string;
          label: string;
          start: number;
          end: number;
          sha256: string;
          /**
           * @maxItems 127
           */
          ancestorPath: string[];
        }[]
      ];
    };
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "ArtifactVersion_7f9c56fa".
 */
export type ArtifactVersion_7F9C56Fa = ArtifactVersionD54B8Ac9 | NativeArtifactVersionFf97D150;
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "artifactId_cc9f299e".
 */
export type ArtifactIdCc9F299E = string;
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "versionId_e4470a54".
 */
export type VersionIdE4470A54 = string;
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "parentVersionId_116435a5".
 */
export type ParentVersionId_116435A5 = string | null;
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "filename_f09421cc".
 */
export type FilenameF09421Cc = string;
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "mimeType_0837eb6f".
 */
export type MimeType_0837Eb6F = string;
/**
 * @minItems 1
 *
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "scopes_3d363e5b".
 */
export type Scopes_3D363E5B = [ScopeF882Edb5, ...ScopeF882Edb5[]];
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "sourceId_fa5f0f45".
 */
export type SourceIdFa5F0F45 = string;
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "recordId_1173860d".
 */
export type RecordId_1173860D = string;
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "sourceVersionId_a5aa4b63".
 */
export type SourceVersionIdA5Aa4B63 = string;
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "observedAt_fc731620".
 */
export type ObservedAtFc731620 = string;
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "sourceUpdatedAt_4a76a197".
 */
export type SourceUpdatedAt_4A76A197 = string | null;
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "citationId_ae4e145b".
 */
export type CitationIdAe4E145B = string;
/**
 * @minItems 1
 *
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "scopes_78e0eb49".
 */
export type Scopes_78E0Eb49 = [ScopeF882Edb5, ...ScopeF882Edb5[]];
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "contentSha256_6b70d9f7".
 */
export type ContentSha256_6B70D9F7 = string;
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "generationStatus_0b8d37a9".
 */
export type GenerationStatus_0B8D37A9 = "draft" | "validated" | "published" | "failed";
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "previewStatus_fe162158".
 */
export type PreviewStatusFe162158 = "pending" | "validated" | "unsupported" | "failed";
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "createdAt_38444d79".
 */
export type CreatedAt_38444D79 = string;
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "ArtifactInspection_3ae45145".
 */
export type ArtifactInspection_3Ae45145 =
  | {
      sha256: string;
      bytes: number;
      format: "txt";
      nativeOpened: false;
      rendered: false;
      recalculated: false;
      /**
       * @maxItems 5000
       */
      members: string[];
      details: {
        encoding: "UTF-8";
        whitespace: "unchanged";
      };
    }
  | {
      sha256: string;
      bytes: number;
      format: "docx";
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
      format: "xlsx";
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
          "unverified-zero-placeholder; recalculation required" | "removed/unverified; recalculation required";
        revisionMethod?: "openpyxl typed-cell replacement";
      };
    }
  | {
      sha256: string;
      bytes: number;
      format: "pptx";
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
        visualInspection: "pending";
      };
    }
  | {
      sha256: string;
      bytes: number;
      format: "zip";
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
      format: "pdf";
      nativeOpened: false;
      rendered: false;
      recalculated: false;
      /**
       * @maxItems 5000
       */
      members: string[];
      details: {
        conversionCompleted: true;
        renderInspection: "pending";
        sourceDocxSha256: string;
      };
    };
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "ArtifactExecution_28c65a3e".
 */
export type ArtifactExecution_28C65A3E = LegacyArtifactExecution_4Afe1663 | NativeArtifactExecution_26204926;

export interface FederalWorkbench {
  [k: string]: unknown;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalNativeSelection".
 *
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalDraftSourceInput_dec6989a".
 */
export interface FederalNativeSelection {
  billId: string;
  versionCode: string;
  revisionId: string;
  versionHash: string;
  textHash: string;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalSourceEnvelope".
 */
export interface FederalSourceEnvelope {
  schema: "meri.federal-source.v1";
  selection: FederalNativeSelection;
  source: FederalCompilerSource;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalImportRequest".
 */
export interface FederalImportRequest {
  selection: FederalNativeSelection;
  deliveryId: string;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalImportResult".
 */
export interface FederalImportResult {
  schema: "meri.federal-source.v1";
  selection: FederalNativeSelection;
  source: FederalCompilerSource;
  publication: ArtifactCreatedResult_183A755E;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "ArtifactCreatedResult_183a755e".
 */
export interface ArtifactCreatedResult_183A755E {
  version: ArtifactVersion_7F9C56Fa;
  inspection: ArtifactInspection_3Ae45145;
  execution: ArtifactExecution_28C65A3E;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "ArtifactVersion_d54b8ac9".
 */
export interface ArtifactVersionD54B8Ac9 {
  contractVersion: "0.1.0";
  artifactId: string;
  versionId: string;
  parentVersionId: string | null;
  binding: RunBinding_84F2304C;
  object: ObjectReferenceA099Bd1C;
  filename: string;
  mimeType: string;
  /**
   * @minItems 1
   */
  scopes: [ScopeF882Edb5, ...ScopeF882Edb5[]];
  evidence: SourceEvidenceD9008775[];
  generationStatus: "draft" | "validated" | "published" | "failed";
  previewStatus: "pending" | "validated" | "unsupported" | "failed";
  createdAt: string;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "RunBinding_84f2304c".
 *
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "binding_ad882dea".
 */
export interface RunBinding_84F2304C {
  tenantId: string;
  actorId: string;
  conversationId: string;
  runId: string;
  attemptId: string;
  workerId: string;
  writerFence: number;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "ObjectReference_a099bd1c".
 *
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "object_a3973f47".
 */
export interface ObjectReferenceA099Bd1C {
  objectId: string;
  versionId: string;
  sha256: string;
  bytes: number;
  /**
   * @minItems 1
   */
  scopes: [ScopeF882Edb5, ...ScopeF882Edb5[]];
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "Scope_f882edb5".
 */
export interface ScopeF882Edb5 {
  tenantId: string;
  kind: "tenant" | "client" | "mailbox" | "memory" | "document" | "private-user" | "public";
  resourceId: string;
  policyRevision: string;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "SourceEvidence_d9008775".
 */
export interface SourceEvidenceD9008775 {
  sourceId: string;
  recordId: string;
  sourceVersionId: string;
  observedAt: string;
  sourceUpdatedAt: string | null;
  citationId: string;
  /**
   * @minItems 1
   */
  scopes: [ScopeF882Edb5, ...ScopeF882Edb5[]];
  contentSha256: string;
  authorizationDecisionId: string;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "NativeArtifactVersion_ff97d150".
 */
export interface NativeArtifactVersionFf97D150 {
  contractVersion: "0.2.0";
  artifactId: ArtifactIdCc9F299E;
  versionId: VersionIdE4470A54;
  parentVersionId: ParentVersionId_116435A5;
  binding: RunBinding_84F2304C;
  object: ObjectReferenceA099Bd1C;
  filename: FilenameF09421Cc;
  mimeType: MimeType_0837Eb6F;
  scopes: Scopes_3D363E5B;
  evidence: NativeSourceEvidenceCb9E6Ba4[];
  generationStatus: GenerationStatus_0B8D37A9;
  previewStatus: PreviewStatusFe162158;
  createdAt: CreatedAt_38444D79;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "NativeSourceEvidence_cb9e6ba4".
 */
export interface NativeSourceEvidenceCb9E6Ba4 {
  sourceId: SourceIdFa5F0F45;
  recordId: RecordId_1173860D;
  sourceVersionId: SourceVersionIdA5Aa4B63;
  observedAt: ObservedAtFc731620;
  sourceUpdatedAt: SourceUpdatedAt_4A76A197;
  citationId: CitationIdAe4E145B;
  scopes: Scopes_78E0Eb49;
  contentSha256: ContentSha256_6B70D9F7;
  binding: RunBinding_84F2304C;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "LegacyArtifactExecution_4afe1663".
 */
export interface LegacyArtifactExecution_4Afe1663 {
  requestSha256: string;
  authorizationReceiptId: string;
  budgetTicketId: string;
  objectCommitted: true;
  versionCommitted: true;
  nativeQualified: false;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "NativeArtifactExecution_26204926".
 */
export interface NativeArtifactExecution_26204926 {
  kind: "native-document";
  invocationId: string;
  requestSha256: string;
  authorizationReceiptId: string;
  objectCommitted: true;
  versionCommitted: true;
  nativeQualified: false;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalSelection".
 */
export interface FederalSelection {
  versionId: string;
  expectedArtifactSha256: string;
  /**
   * @minItems 1
   * @maxItems 64
   */
  operations: [FederalDraftOperationEcfa206F, ...FederalDraftOperationEcfa206F[]];
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalDraftOperation_ecfa206f".
 */
export interface FederalDraftOperationEcfa206F {
  id: string;
  kind: "replace" | "insert" | "delete";
  scopeId: string;
  expectedScopeSha256: string;
  expectedText: string;
  expectedTextSha256: string;
  /**
   * @minItems 0
   * @maxItems 64
   */
  dependsOn: string[];
  text?: string;
  position?: "before" | "after";
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalSourceArtifact".
 */
export interface FederalSourceArtifact {
  versionId: string;
  sha256: string;
  specSha256: string;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalPrepareRequest".
 */
export interface FederalPrepareRequest {
  selection: FederalSelection;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalLoadRequest".
 */
export interface FederalLoadRequest {
  versionId: string;
  expectedArtifactSha256: string;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalPublishRequest".
 */
export interface FederalPublishRequest {
  selection: FederalSelection;
  revisionSha256: string;
  output: "draft" | "operative" | "consolidated" | "redline" | "docx";
  deliveryId: string;
  baseVersionId: string | null;
  baseRevisionSha256: string | null;
  reviewVersionId?: string | null;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalApproveRequest".
 */
export interface FederalApproveRequest {
  versionId: string;
  expectedArtifactSha256: string;
  revisionSha256: string;
  deliveryId: string;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalHistoryRequest".
 */
export interface FederalHistoryRequest {
  versionId: string;
  limit: number;
  cursor: string | null;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalRetainedPreparation".
 */
export interface FederalRetainedPreparation {
  sourceArtifact: FederalSourceArtifact;
  draft: FederalDraftCompilation_66Ff9248;
  revisionSha256: string;
  approval: "unapproved";
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalDraftCompilation_66ff9248".
 */
export interface FederalDraftCompilation_66Ff9248 {
  parserVersion: "federal-plain-text/1" | "federal-scoped-text/2" | "federal-uslm-xml/1";
  source: FederalCompilerSource;
  /**
   * @minItems 1
   * @maxItems 64
   */
  operations: [FederalDraftOperationEcfa206F, ...FederalDraftOperationEcfa206F[]];
  outputs: {
    operative: string;
    consolidated: string;
    redline: string;
    /**
     * @minItems 1
     * @maxItems 512
     */
    segments: [FederalDraftSegmentE752Af1D, ...FederalDraftSegmentE752Af1D[]];
  };
  /**
   * @minItems 1
   * @maxItems 70
   */
  findings: [
    {
      category:
        "source-integrity" | "exact-target" | "numbering" | "cross-references" | "arithmetic" | "substantive-law";
      status: "passed" | "unresolved";
      location: string;
      severity: "info" | "review-required";
      operationId?: string;
    },
    ...{
      category:
        "source-integrity" | "exact-target" | "numbering" | "cross-references" | "arithmetic" | "substantive-law";
      status: "passed" | "unresolved";
      location: string;
      severity: "info" | "review-required";
      operationId?: string;
    }[]
  ];
  outputHashes: {
    operative: string;
    consolidated: string;
    redline: string;
  };
  revisionSha256: string;
  approval: "unapproved";
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalDraftSegment_e752af1d".
 */
export interface FederalDraftSegmentE752Af1D {
  kind: "unchanged" | "delete" | "insert";
  text: string;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalApproval".
 */
export interface FederalApproval {
  revisionSha256: string;
  reviewVersionId: string;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalReview".
 */
export interface FederalReview {
  schema: "meri.federal-review.v1";
  selection: FederalSelection;
  prepared: FederalRetainedPreparation;
  savedDraft: ArtifactVersion_7F9C56Fa | null;
  approval: FederalApproval | null;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalPublication".
 */
export interface FederalPublication {
  schema: "meri.federal-review.v1";
  sourceArtifact: FederalSourceArtifact;
  revisionSha256: string;
  output: "draft" | "operative" | "consolidated" | "redline" | "docx";
  review: "unapproved" | "confirmed-for-export" | "approved";
  approval: FederalApproval | null;
  publication: ArtifactCreatedResult_183A755E;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalHistoryEntry".
 */
export interface FederalHistoryEntry {
  version: ArtifactVersion_7F9C56Fa;
  revisionSha256: string;
  sourceArtifact: FederalSourceArtifact;
  approval: FederalApproval | null;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalHistory".
 */
export interface FederalHistory {
  schema: "meri.federal-review.v1";
  artifactId: string;
  anchorVersionId: string;
  headVersionId: string;
  /**
   * @minItems 1
   * @maxItems 100
   */
  revisions: [FederalHistoryEntry, ...FederalHistoryEntry[]];
  nextCursor: string | null;
}
/**
 * This interface was referenced by `FederalWorkbench`'s JSON-Schema
 * via the `definition` "FederalError".
 */
export interface FederalError {
  error: {
    code: string;
    outcome: "NOT_DISPATCHED" | "READ_UNAVAILABLE" | "UNKNOWN" | "RESULT_NOT_RELEASED";
    operationId?: string | null;
  };
}

export type FederalRoute='federal-prepare'|'federal-load'|'federal-publish'|'federal-import'|'federal-approve'|'federal-history';
export type FederalCompilerSource=FederalRetainedPreparation['draft']['source'];
export type FederalRequest<R extends FederalRoute>=R extends 'federal-import'?FederalImportRequest:R extends 'federal-prepare'?FederalPrepareRequest:R extends 'federal-load'?FederalLoadRequest:R extends 'federal-approve'?FederalApproveRequest:R extends 'federal-history'?FederalHistoryRequest:FederalPublishRequest;
declare const federalRequest:unique symbol;
declare const federalReview:unique symbol;
export type AdmittedFederalRequest<R extends FederalRoute>=Readonly<FederalRequest<R>>&{readonly[federalRequest]:R};
export type AdmittedFederalReview=Readonly<FederalReview>&{readonly[federalReview]:true};
export type FederalResponse<R extends FederalRoute>=(R extends 'federal-import'?Readonly<FederalImportResult>:R extends 'federal-publish'?Readonly<FederalPublication>:R extends 'federal-history'?Readonly<FederalHistory>:AdmittedFederalReview)|Readonly<FederalError>;
export declare const federalWorkbenchVersion:'1.3.0';
export declare function receiveFederalSource(bytes:Uint8Array):Promise<Readonly<FederalCompilerSource>>;
export declare function receiveFederalRequest<R extends FederalRoute>(route:R,bytes:Uint8Array):AdmittedFederalRequest<R>;
export declare function receiveFederalResponse<R extends FederalRoute>(route:R,status:number,bytes:Uint8Array,request:AdmittedFederalRequest<R>,review?:AdmittedFederalReview):Promise<FederalResponse<R>>;
