// Generated from the canonical document receiving schema (all artifact formats). No authorization implied.

export type DocumentAccessApplicationEnvelope =
  | DocumentInspectRequest
  | DocumentDownloadRequest
  | DocumentHistoryRequest
  | DocumentListRequest
  | DocumentInspectionResponse
  | DocumentHistoryResponse
  | DocumentListResponse
  | DocumentErrorResponse
  | DocumentPreviewRequest
  | DocumentPreviewPublication;
export type DocumentInspectionResponse =
  | {
      version: DocumentVersion;
      inspection:
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
            currentBytesVerified: true;
          }
        | {
            sha256: string;
            bytes: number;
            format: 'xml';
            nativeOpened: false;
            rendered: false;
            recalculated: false;
            /**
             * @maxItems 0
             */
            members: [];
            details: {
              encoding: 'UTF-8';
              whitespace: 'unchanged';
              wellFormed: true;
            };
            currentBytesVerified: true;
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
            currentBytesVerified: true;
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
            currentBytesVerified: true;
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
            currentBytesVerified: true;
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
            currentBytesVerified: true;
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
            currentBytesVerified: true;
          };
    }
  | {
      kind: 'native-file';
      version: Canonical_NativeArtifactFileMetadataF90C3Fee;
      integrity: CanonicalIntegrity_52Ed1E31;
    };
export type DocumentVersion = Canonical_ArtifactVersion_7F9C56Fa & {
  generationStatus?: 'draft';
  previewStatus?: 'pending';
  filename?: string;
  mimeType?:
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'text/plain; charset=utf-8'
    | 'application/xml; charset=utf-8'
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    | 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    | 'application/pdf'
    | 'application/zip';
};
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
export type CanonicalObjectId_9E74Be34 = string;
export type CanonicalManifestIdD0D1Dc64 = string;
export type CanonicalPath_79796D02 = string;
/**
 * @minItems 1
 */
export type CanonicalScopes_4A25Bf0D = [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
export type CanonicalCreatedAtEde7C864 = string;
export type CanonicalSha256A23D638D = string;

export interface DocumentInspectRequest {
  versionId: string;
}
export interface DocumentDownloadRequest {
  versionId: string;
}
export interface DocumentHistoryRequest {
  versionId: string;
  limit: number;
  cursor: null | string;
}
export interface DocumentListRequest {
  scope: 'conversation' | 'client' | 'owner';
  limit: number;
  cursor: null | string;
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
export interface Canonical_NativeArtifactFileMetadataF90C3Fee {
  versionId: CanonicalObjectId_9E74Be34;
  binding: Canonical_RunBinding_84F2304C;
  manifestId: CanonicalManifestIdD0D1Dc64;
  path: CanonicalPath_79796D02;
  object: Canonical_ObjectReferenceA099Bd1C & {
    bytes?: number;
  };
  scopes: CanonicalScopes_4A25Bf0D;
  createdAt: CanonicalCreatedAtEde7C864;
}
export interface CanonicalIntegrity_52Ed1E31 {
  sha256: CanonicalSha256A23D638D;
  bytes: number;
  currentBytesVerified: true;
}
export interface DocumentHistoryResponse {
  anchorVersionId: string;
  artifactId: string;
  headVersionId: string;
  /**
   * @minItems 1
   * @maxItems 100
   */
  versions: [DocumentVersion, ...DocumentVersion[]];
  nextCursor: null | string;
}
export interface DocumentListResponse {
  scope: 'conversation' | 'client' | 'owner';
  /**
   * @minItems 0
   * @maxItems 100
   */
  versions: DocumentVersion[];
  nextCursor: null | string;
}
export interface DocumentErrorResponse {
  error: {
    code:
      | 'ACCESS_DENIED'
      | 'ARTIFACT_BUDGET_RESERVATION_UNKNOWN'
      | 'ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN'
      | 'ARTIFACT_CANCELLED'
      | 'ARTIFACT_DEADLINE'
      | 'ARTIFACT_EFFECT_UNKNOWN'
      | 'ARTIFACT_HISTORY_CURSOR'
      | 'ARTIFACT_LIBRARY_CURSOR'
      | 'ARTIFACT_PREVIEW_PENDING'
      | 'ARTIFACT_PREVIEW_UNSUPPORTED'
      | 'ARTIFACT_RENDERER_UNAVAILABLE'
      | 'ARTIFACT_STALE_PARENT'
      | 'CANCELLED'
      | 'CONFLICT'
      | 'DEADLINE'
      | 'DOCUMENT_CLOCK'
      | 'DOCUMENT_CONFIGURATION'
      | 'DOCUMENT_REFUSED'
      | 'DOCUMENT_RESPONSE_LIMIT'
      | 'DOCUMENT_RESULT_REFUSED'
      | 'INVALID_BODY'
      | 'INVALID_CONTENT_LENGTH'
      | 'INVALID_JSON'
      | 'INVALID_REQUEST'
      | 'METHOD_NOT_ALLOWED'
      | 'NOT_FOUND'
      | 'PREVIEW_UNAVAILABLE'
      | 'REQUEST_FAILED'
      | 'REQUEST_TOO_LARGE'
      | 'SESSION_REFUSED'
      | 'UNAUTHENTICATED'
      | 'UNAVAILABLE'
      | 'UNSUPPORTED_DOCUMENT_FORMAT'
      | 'UNSUPPORTED_MEDIA_TYPE';
    outcome: 'NOT_DISPATCHED' | 'UNKNOWN' | 'RESULT_NOT_RELEASED' | 'READ_UNAVAILABLE';
  };
}
export interface DocumentPreviewRequest {
  versionId: string;
}
export interface DocumentPreviewPublication {
  status: 'existing' | 'published';
  preview: DocumentPreviewRecord;
}
export interface DocumentPreviewRecord {
  recordVersion: 'meri.artifact-preview.proposal-1';
  previewId: string;
  versionId: string;
  artifactId: string;
  tenantId: string;
  conversationId: string;
  source: {
    sha256: string;
    bytes: number;
    mimeType: string;
  };
  preview: {
    object: Canonical_ObjectReferenceA099Bd1C;
    mimeType: 'application/pdf';
    pages: number;
  };
  conversion: {
    method: 'source-pdf' | 'office-pdf';
    inputSha256: string;
    outputSha256: string;
    qualificationId: null | string;
    imageDigest: null | string;
  };
  status: 'published';
  nativeQualified: false;
  createdAt: string;
}

export type DocumentAccessRoute = 'inspect' | 'download' | 'history' | 'list';
declare const admittedRequest: unique symbol;
declare const admittedVersion: unique symbol;
export interface DocumentAccessRequestMap { inspect:DocumentInspectRequest; download:DocumentDownloadRequest; history:DocumentHistoryRequest; list:DocumentListRequest; }
export type AdmittedDocumentRequest<R extends DocumentAccessRoute> = Readonly<DocumentAccessRequestMap[R]> & {readonly [admittedRequest]:R};
export type NativeArtifactFileMetadata = Extract<DocumentInspectionResponse,{kind:'native-file'}>['version'];
export type AdmittedDocumentVersion = Readonly<DocumentVersion|NativeArtifactFileMetadata> & {readonly [admittedVersion]:true};
export type DocumentReceipt<T> = T extends {version:infer V} ? Omit<T,'version'> & {readonly version:Readonly<V> & {readonly [admittedVersion]:true}} : never;
export interface DocumentAccessResponseMap {inspect:DocumentReceipt<DocumentInspectionResponse>; download:never; history:DocumentHistoryResponse; list:DocumentListResponse;}
export type DocumentResponse<R extends DocumentAccessRoute> = DocumentAccessResponseMap[R] | DocumentErrorResponse;
export interface DocumentDownload<V extends AdmittedDocumentVersion = AdmittedDocumentVersion> {readonly version:V; readonly bytes:Uint8Array<ArrayBuffer>;}
export interface DocumentDownloadOptions {maxBytes?:number; timeoutMs?:number; signal?:AbortSignal;}
// Additive v1 native-result discovery receiver. Separately named and outside DocumentAccessRoute0.2: it admits no
// version for inspect or download, carries no recorded bytes and describes only workspace-entry metadata.
export declare const nativeResultsVersion: '1.0.0';
export declare const NATIVE_RESULTS_MAX: 32;
export declare const nativeResultsMetadata: Readonly<{contractVersion:'1.0.0'; route:Readonly<{method:'POST'; path:'/api/documents/results'; response:'json'}>; maxResults:32; semantics:Readonly<Record<string,string>>}>;
export interface NativeResultSelector {readonly versionId:string; readonly path:string; readonly bytes:number; readonly sha256:string; readonly executable:boolean;}
export interface NativeResultsSnapshot {readonly manifestId:string; readonly capturedAt:string; readonly results:readonly NativeResultSelector[]; readonly truncated:boolean;}
export declare function receiveNativeResultsRequest(utf8Bytes:Uint8Array):Readonly<{route:'results'}>;
export declare function receiveNativeResultsResponse(httpStatus:number,utf8Bytes:Uint8Array,request:Readonly<{route:'results'}>):Readonly<NativeResultsSnapshot & {route:'results'}>;
export declare class DocumentResponseError extends Error {readonly code:string;}
export declare const documentAccessVersion:'0.2.0';
export declare const documentAccessMetadata:{
  "contractVersion": "0.2.0",
  "schemaId": "urn:meri:document-access-application:0.2.0",
  "routes": {
    "inspect": {
      "method": "POST",
      "path": "/api/documents/inspect",
      "response": "json"
    },
    "download": {
      "method": "POST",
      "path": "/api/documents/download",
      "response": "bytes"
    },
    "history": {
      "method": "POST",
      "path": "/api/documents/history",
      "response": "json"
    },
    "list": {
      "method": "POST",
      "path": "/api/documents/list",
      "response": "json"
    }
  },
  "formats": [
    "docx",
    "txt",
    "xml",
    "xlsx",
    "pptx",
    "pdf",
    "zip"
  ],
  "mimeTypes": {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain; charset=utf-8",
    "xml": "application/xml; charset=utf-8",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "pdf": "application/pdf",
    "zip": "application/zip"
  },
  "previewFormats": [
    "docx",
    "xlsx",
    "pptx",
    "pdf"
  ],
  "operationFormats": {
    "create_word": [
      "docx",
      "txt",
      "xml"
    ],
    "create_word_with_pdf": [
      "docx",
      "txt",
      "xml",
      "pdf"
    ],
    "create_excel": [
      "xlsx"
    ],
    "create_powerpoint": [
      "pptx"
    ],
    "run_analysis": [
      "zip"
    ]
  },
  "errorStatuses": {
    "ACCESS_DENIED": 403,
    "ARTIFACT_BUDGET_RESERVATION_UNKNOWN": 502,
    "ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN": 502,
    "ARTIFACT_CANCELLED": 499,
    "ARTIFACT_DEADLINE": 408,
    "ARTIFACT_EFFECT_UNKNOWN": 502,
    "ARTIFACT_HISTORY_CURSOR": 409,
    "ARTIFACT_LIBRARY_CURSOR": 409,
    "ARTIFACT_PREVIEW_PENDING": 409,
    "ARTIFACT_PREVIEW_UNSUPPORTED": 422,
    "ARTIFACT_RENDERER_UNAVAILABLE": 503,
    "ARTIFACT_STALE_PARENT": 409,
    "CANCELLED": 499,
    "CONFLICT": 409,
    "DEADLINE": 408,
    "DOCUMENT_CLOCK": 500,
    "DOCUMENT_CONFIGURATION": 500,
    "DOCUMENT_REFUSED": 502,
    "DOCUMENT_RESPONSE_LIMIT": 413,
    "DOCUMENT_RESULT_REFUSED": 502,
    "INVALID_BODY": 400,
    "INVALID_CONTENT_LENGTH": 400,
    "INVALID_JSON": 400,
    "INVALID_REQUEST": 400,
    "METHOD_NOT_ALLOWED": 405,
    "NOT_FOUND": 404,
    "PREVIEW_UNAVAILABLE": 503,
    "REQUEST_FAILED": 502,
    "REQUEST_TOO_LARGE": 413,
    "SESSION_REFUSED": 403,
    "UNAUTHENTICATED": 401,
    "UNAVAILABLE": 503,
    "UNSUPPORTED_DOCUMENT_FORMAT": 422,
    "UNSUPPORTED_MEDIA_TYPE": 415
  },
  "semantics": {
    "nativeFiles": "native-file identifies a committed workspace path and immutable object with currently verified bytes; it makes no format, rendering, generation-status or preview-status claim",
    "inspection": "structural facts about one exact stored version; nativeOpened, rendered and recalculated are always false, pptx visualInspection and pdf renderInspection are always pending, so no inspection describes a rendered or visually checked file",
    "download": "a download is admitted only for a version this receiver admitted from an inspect answer in the same session of use; inspect first, never a link or bytes alone",
    "history": "currently authorized metadata for one immutable artifact chain, newest first, with an anchor-correlated response and a context/query/head-bound opaque continuation; it verifies no object bytes and admits no version for download; history is not cross-conversation library discovery",
    "list": "currently authorized original head metadata for the same owner in conversation, selected client, or owner scope; each origin requires fresh Core access and retention before release; a bounded candidate window may yield an empty page with nextCursor, without totals or hidden counts; cursors select a context/query/snapshot-bound page and convey no authority; versions are not admitted for download",
    "preview": "previewFormats are the only formats the artifact preview owner will render (any other format answers ARTIFACT_PREVIEW_UNSUPPORTED); every previewFormat except pdf also needs a qualified converter or answers ARTIFACT_RENDERER_UNAVAILABLE; this contract carries no preview route and no renderer qualification",
    "statuses": "the document application releases only generationStatus draft and previewStatus pending, so previewStatus never reports unsupported or validated here",
    "composition": "a document application instance is composed with one operation descriptor (operationFormats) and answers DOCUMENT_RESULT_REFUSED for versions of formats outside it; which descriptor serves a conversation is a composition fact this contract cannot assert",
    "integration": "isolated source contract; mounting, Core authority wiring and renderer qualification remain handoff work"
  }
};
export declare function receiveDocumentRequest<R extends DocumentAccessRoute>(route:R,utf8Bytes:Uint8Array):AdmittedDocumentRequest<R>;
export declare function receiveDocumentResponse<R extends DocumentAccessRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedDocumentRequest<R>):Promise<DocumentResponse<R>>;
export declare function receiveDocumentDownload<V extends AdmittedDocumentVersion>(response:Response,version:V,options?:DocumentDownloadOptions):Promise<DocumentDownload<V>>;
export declare const documentPreviewVersion:'0.1.0';
export declare const documentPreviewMetadata:Readonly<{contractVersion:'0.1.0';publish:Readonly<{method:'POST';path:'/api/documents/preview-publish';response:'json';effect:'write'}>;read:Readonly<{method:'POST';path:'/api/documents/preview';response:'bytes';effect:'read'}>;maxBytes:8388608;maxPages:500;nativeQualified:false}>;
declare const admittedPreviewRequest:unique symbol;
export type DocumentPreviewAction='publish'|'read';
export type AdmittedDocumentPreviewRequest<A extends DocumentPreviewAction>=Readonly<DocumentPreviewRequest>&{readonly[admittedPreviewRequest]:A};
export type AdmittedGeneratedDocumentVersion=Readonly<DocumentVersion>&{readonly[admittedVersion]:true};
export interface DocumentPreview<V extends AdmittedGeneratedDocumentVersion=AdmittedGeneratedDocumentVersion>{readonly version:V;readonly bytes:Uint8Array<ArrayBuffer>;readonly preview:Readonly<{previewId:string;sourceVersionId:string;sourceSha256:string;sha256:string;pages:number;recordSha256:string;nativeQualified:false}>;}
export declare function receiveDocumentPreviewRequest<A extends DocumentPreviewAction>(action:A,utf8Bytes:Uint8Array):AdmittedDocumentPreviewRequest<A>;
export declare function receiveDocumentPreviewPublication(httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedDocumentPreviewRequest<'publish'>,version:AdmittedGeneratedDocumentVersion):DocumentPreviewPublication|DocumentErrorResponse;
export declare function receiveDocumentPreview<V extends AdmittedGeneratedDocumentVersion>(response:Response,version:V,options?:DocumentDownloadOptions):Promise<DocumentPreview<V>>;
