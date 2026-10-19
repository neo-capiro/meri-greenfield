// Generated from the canonical document receiving schema (all artifact formats). No authorization implied.

export type DocumentAccessApplicationEnvelope =
  DocumentInspectRequest | DocumentDownloadRequest | DocumentInspectionResponse | DocumentErrorResponse;
export type DocumentVersion = Canonical_ArtifactVersionD54B8Ac9 & {
  generationStatus?: 'draft';
  previewStatus?: 'pending';
  filename?: string;
  mimeType?:
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'text/plain; charset=utf-8'
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    | 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    | 'application/pdf'
    | 'application/zip';
};

export interface DocumentInspectRequest {
  versionId: string;
}
export interface DocumentDownloadRequest {
  versionId: string;
}
export interface DocumentInspectionResponse {
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
export interface DocumentErrorResponse {
  error: {
    code:
      | 'ACCESS_DENIED'
      | 'ARTIFACT_BUDGET_RESERVATION_UNKNOWN'
      | 'ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN'
      | 'ARTIFACT_CANCELLED'
      | 'ARTIFACT_DEADLINE'
      | 'ARTIFACT_EFFECT_UNKNOWN'
      | 'ARTIFACT_PREVIEW_PENDING'
      | 'ARTIFACT_PREVIEW_UNSUPPORTED'
      | 'ARTIFACT_RENDERER_UNAVAILABLE'
      | 'CANCELLED'
      | 'DEADLINE'
      | 'DOCUMENT_CLOCK'
      | 'DOCUMENT_CONFIGURATION'
      | 'DOCUMENT_READ_BUDGET_REFUSED'
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

export type DocumentAccessRoute = 'inspect' | 'download';
declare const admittedRequest: unique symbol;
declare const admittedVersion: unique symbol;
export interface DocumentAccessRequestMap { inspect:DocumentInspectRequest; download:DocumentDownloadRequest; }
export type AdmittedDocumentRequest<R extends DocumentAccessRoute> = Readonly<DocumentAccessRequestMap[R]> & {readonly [admittedRequest]:R};
export type AdmittedDocumentVersion = Readonly<DocumentVersion> & {readonly [admittedVersion]:true};
export type DocumentReceipt<T> = Omit<T,'version'> & {readonly version:AdmittedDocumentVersion};
export interface DocumentAccessResponseMap {inspect:DocumentReceipt<DocumentInspectionResponse>; download:never;}
export type DocumentResponse<R extends DocumentAccessRoute> = DocumentAccessResponseMap[R] | DocumentErrorResponse;
export interface DocumentDownload {readonly version:AdmittedDocumentVersion; readonly bytes:Uint8Array<ArrayBuffer>;}
export interface DocumentDownloadOptions {maxBytes?:number; timeoutMs?:number; signal?:AbortSignal;}
export declare class DocumentResponseError extends Error {readonly code:string;}
export declare const documentAccessVersion:'0.1.0';
export declare const documentAccessMetadata:{
  "contractVersion": "0.1.0",
  "schemaId": "urn:meri:document-access-application:0.1.0",
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
    }
  },
  "formats": [
    "docx",
    "txt",
    "xlsx",
    "pptx",
    "pdf",
    "zip"
  ],
  "mimeTypes": {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain; charset=utf-8",
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
      "txt"
    ],
    "create_word_with_pdf": [
      "docx",
      "txt",
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
    "ARTIFACT_PREVIEW_PENDING": 409,
    "ARTIFACT_PREVIEW_UNSUPPORTED": 422,
    "ARTIFACT_RENDERER_UNAVAILABLE": 503,
    "CANCELLED": 499,
    "DEADLINE": 408,
    "DOCUMENT_CLOCK": 500,
    "DOCUMENT_CONFIGURATION": 500,
    "DOCUMENT_READ_BUDGET_REFUSED": 500,
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
    "inspection": "structural facts about one exact stored version; nativeOpened, rendered and recalculated are always false, pptx visualInspection and pdf renderInspection are always pending, so no inspection describes a rendered or visually checked file",
    "download": "a download is admitted only for a version this receiver admitted from an inspect answer in the same session of use; inspect first, never a link or bytes alone",
    "preview": "previewFormats are the only formats the artifact preview owner will render (any other format answers ARTIFACT_PREVIEW_UNSUPPORTED); every previewFormat except pdf also needs a qualified converter or answers ARTIFACT_RENDERER_UNAVAILABLE; this contract carries no preview route and no renderer qualification",
    "statuses": "the document application releases only generationStatus draft and previewStatus pending, so previewStatus never reports unsupported or validated here",
    "composition": "a document application instance is composed with one operation descriptor (operationFormats) and answers DOCUMENT_RESULT_REFUSED for versions of formats outside it; which descriptor serves a conversation is a composition fact this contract cannot assert",
    "integration": "isolated source contract; mounting, Core authority wiring and renderer qualification remain handoff work"
  }
};
export declare function receiveDocumentRequest<R extends DocumentAccessRoute>(route:R,utf8Bytes:Uint8Array):AdmittedDocumentRequest<R>;
export declare function receiveDocumentResponse<R extends DocumentAccessRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedDocumentRequest<R>):Promise<DocumentResponse<R>>;
export declare function receiveDocumentDownload(response:Response,version:AdmittedDocumentVersion,options?:DocumentDownloadOptions):Promise<DocumentDownload>;
