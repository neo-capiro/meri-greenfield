// Generated from canonical document receiving schema. No authorization implied.

export type DocumentApplicationEnvelope =
  | DocumentCreateRequest
  | DocumentReviseRequest
  | DocumentInspectRequest
  | DocumentDownloadRequest
  | DocumentCreatedResponse
  | DocumentInspectionResponse
  | DocumentErrorResponse;
export type DocumentContentRequest =
  | {
      operation: 'create_word';
      format: 'docx';
      title: string;
      content: Canonical_WordContent_58F3Dc3C;
    }
  | {
      operation: 'create_word';
      format: 'txt';
      title: string;
      content: {
        text: string;
      };
    }
  | {
      operation: 'create_excel';
      format: 'xlsx';
      title: string;
      content: Canonical_Workbook_470B7491;
    };
export type Canonical_ScalarFf4415F1 = string | number | boolean | null;
export type DocumentVersion = Canonical_ArtifactVersionD54B8Ac9 & {
  generationStatus?: 'draft';
  previewStatus?: 'pending';
  filename?: string;
  mimeType?:
    | 'text/plain; charset=utf-8'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
};

export interface DocumentCreateRequest {
  deliveryId: string;
  request: DocumentContentRequest;
}
export interface Canonical_WordContent_58F3Dc3C {
  /**
   * @minItems 1
   * @maxItems 1000
   */
  blocks: [
    (
      | Canonical_ParagraphA313D7Be
      | Canonical_Table_02Fd45F0
      | Canonical_Image_1Ed45A41
      | {
          kind: 'chart';
          chart: Canonical_ChartB9B96B0E;
        }
    ),
    ...(
      | Canonical_ParagraphA313D7Be
      | Canonical_Table_02Fd45F0
      | Canonical_Image_1Ed45A41
      | {
          kind: 'chart';
          chart: Canonical_ChartB9B96B0E;
        }
    )[]
  ];
}
export interface Canonical_ParagraphA313D7Be {
  kind: 'paragraph';
  /**
   * @minItems 1
   * @maxItems 100
   */
  runs: [Canonical_Run_4453Fced, ...Canonical_Run_4453Fced[]];
  style?: 'Normal' | 'Title' | 'Heading 1' | 'Heading 2' | 'List Bullet';
}
export interface Canonical_Run_4453Fced {
  text: string;
  bold?: boolean;
  italic?: boolean;
}
export interface Canonical_Table_02Fd45F0 {
  kind: 'table';
  /**
   * @minItems 1
   * @maxItems 1000
   */
  rows: [[string, ...string[]], ...[string, ...string[]][]];
}
export interface Canonical_Image_1Ed45A41 {
  kind: 'image';
  assetId: string;
  widthInches: number;
  heightInches: number;
}
export interface Canonical_ChartB9B96B0E {
  kind: 'bar' | 'line';
  title: string;
  /**
   * @minItems 1
   * @maxItems 100
   */
  categories: [string, ...string[]];
  /**
   * @minItems 1
   * @maxItems 10
   */
  series:
    | [
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        }
      ]
    | [
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        }
      ]
    | [
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        }
      ]
    | [
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        }
      ]
    | [
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        }
      ]
    | [
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        }
      ]
    | [
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        }
      ]
    | [
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        }
      ]
    | [
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        }
      ]
    | [
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        },
        {
          name: string;
          /**
           * @minItems 1
           * @maxItems 100
           */
          values: [number, ...number[]];
        }
      ];
}
export interface Canonical_Workbook_470B7491 {
  /**
   * @minItems 1
   * @maxItems 30
   */
  sheets: [Canonical_SheetE618D686, ...Canonical_SheetE618D686[]];
}
export interface Canonical_SheetE618D686 {
  name: string;
  /**
   * @minItems 0
   * @maxItems 10000
   */
  rows: Canonical_CellEd8Ea525[][];
  /**
   * @minItems 0
   * @maxItems 10
   */
  charts?:
    | []
    | [Canonical_ChartB9B96B0E]
    | [Canonical_ChartB9B96B0E, Canonical_ChartB9B96B0E]
    | [Canonical_ChartB9B96B0E, Canonical_ChartB9B96B0E, Canonical_ChartB9B96B0E]
    | [Canonical_ChartB9B96B0E, Canonical_ChartB9B96B0E, Canonical_ChartB9B96B0E, Canonical_ChartB9B96B0E]
    | [
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E
      ]
    | [
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E
      ]
    | [
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E
      ]
    | [
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E
      ]
    | [
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E
      ]
    | [
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E,
        Canonical_ChartB9B96B0E
      ];
  /**
   * @minItems 0
   * @maxItems 10
   */
  images?:
    | []
    | [Canonical_Image_1Ed45A41]
    | [Canonical_Image_1Ed45A41, Canonical_Image_1Ed45A41]
    | [Canonical_Image_1Ed45A41, Canonical_Image_1Ed45A41, Canonical_Image_1Ed45A41]
    | [Canonical_Image_1Ed45A41, Canonical_Image_1Ed45A41, Canonical_Image_1Ed45A41, Canonical_Image_1Ed45A41]
    | [
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41
      ]
    | [
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41
      ]
    | [
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41
      ]
    | [
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41
      ]
    | [
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41
      ]
    | [
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41,
        Canonical_Image_1Ed45A41
      ];
}
export interface Canonical_CellEd8Ea525 {
  value?: Canonical_ScalarFf4415F1;
  formula?: string;
  numberFormat?: string;
}
export interface DocumentReviseRequest {
  deliveryId: string;
  baseVersionId: string;
  request: DocumentContentRequest;
}
export interface DocumentInspectRequest {
  versionId: string;
}
export interface DocumentDownloadRequest {
  versionId: string;
}
export interface DocumentCreatedResponse {
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
      };
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
export interface Canonical_ArtifactExecution_28C65A3E {
  requestSha256: string;
  authorizationReceiptId: string;
  budgetTicketId: string;
  objectCommitted: true;
  versionCommitted: true;
  nativeQualified: false;
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
      };
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

export type DocumentRoute = 'create' | 'revise' | 'inspect' | 'download';
declare const admittedRequest: unique symbol;
declare const admittedVersion: unique symbol;
export interface DocumentRequestMap { create:DocumentCreateRequest; revise:DocumentReviseRequest; inspect:DocumentInspectRequest; download:DocumentDownloadRequest; }
export type AdmittedDocumentRequest<R extends DocumentRoute> = Readonly<DocumentRequestMap[R]> & {readonly [admittedRequest]:R};
export type AdmittedDocumentVersion = Readonly<DocumentVersion> & {readonly [admittedVersion]:true};
export type DocumentReceipt<T> = Omit<T,'version'> & {readonly version:AdmittedDocumentVersion};
export interface DocumentResponseMap {create:DocumentReceipt<DocumentCreatedResponse>; revise:DocumentReceipt<DocumentCreatedResponse>; inspect:DocumentReceipt<DocumentInspectionResponse>; download:never;}
export type DocumentResponse<R extends DocumentRoute> = DocumentResponseMap[R] | DocumentErrorResponse;
export interface DocumentDownload {readonly version:AdmittedDocumentVersion; readonly bytes:Uint8Array;}
export interface DocumentDownloadOptions {maxBytes?:number; timeoutMs?:number; signal?:AbortSignal;}
export declare class DocumentResponseError extends Error {readonly code:string;}
export declare function receiveDocumentRequest<R extends DocumentRoute>(route:R,utf8Bytes:Uint8Array):AdmittedDocumentRequest<R>;
export declare function receiveDocumentResponse<R extends DocumentRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedDocumentRequest<R>):Promise<DocumentResponse<R>>;
export declare function receiveDocumentDownload(response:Response,version:AdmittedDocumentVersion,options?:DocumentDownloadOptions):Promise<DocumentDownload>;
