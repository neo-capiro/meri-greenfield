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
      operation: 'create_word';
      format: 'xml';
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
export type DocumentVersion = Canonical_ArtifactVersion_7F9C56Fa & {
  generationStatus?: 'draft';
  previewStatus?: 'pending';
  filename?: string;
  mimeType?:
    | 'text/plain; charset=utf-8'
    | 'application/xml; charset=utf-8'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
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
export type Canonical_ArtifactExecution_28C65A3E =
  Canonical_LegacyArtifactExecution_4Afe1663 | Canonical_NativeArtifactExecution_26204926;
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
          };
    }
  | {
      kind: 'native-file';
      version: Canonical_NativeArtifactFileMetadataF90C3Fee;
      integrity: CanonicalIntegrity_52Ed1E31;
    };
export type CanonicalObjectId_9E74Be34 = string;
export type CanonicalManifestIdD0D1Dc64 = string;
export type CanonicalPath_79796D02 = string;
/**
 * @minItems 1
 */
export type CanonicalScopes_4A25Bf0D = [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
export type CanonicalCreatedAtEde7C864 = string;
export type CanonicalSha256A23D638D = string;

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
  quoteDepth?: number;
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
  strike?: boolean;
  underline?: boolean;
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

export type DocumentRoute = 'create' | 'revise' | 'inspect' | 'download';
declare const admittedRequest: unique symbol;
declare const admittedVersion: unique symbol;
export interface DocumentRequestMap { create:DocumentCreateRequest; revise:DocumentReviseRequest; inspect:DocumentInspectRequest; download:DocumentDownloadRequest; }
export type AdmittedDocumentRequest<R extends DocumentRoute> = Readonly<DocumentRequestMap[R]> & {readonly [admittedRequest]:R};
export type NativeArtifactFileMetadata = Extract<DocumentInspectionResponse,{kind:'native-file'}>['version'];
export type AdmittedDocumentVersion = Readonly<DocumentVersion|NativeArtifactFileMetadata> & {readonly [admittedVersion]:true};
export type DocumentReceipt<T> = T extends {version:infer V} ? Omit<T,'version'> & {readonly version:Readonly<V> & {readonly [admittedVersion]:true}} : never;
export interface DocumentResponseMap {create:DocumentReceipt<DocumentCreatedResponse>; revise:DocumentReceipt<DocumentCreatedResponse>; inspect:DocumentReceipt<DocumentInspectionResponse>; download:never;}
export type DocumentResponse<R extends DocumentRoute> = DocumentResponseMap[R] | DocumentErrorResponse;
export interface DocumentDownload<V extends AdmittedDocumentVersion = AdmittedDocumentVersion> {readonly version:V; readonly bytes:Uint8Array<ArrayBuffer>;}
export interface DocumentDownloadOptions {maxBytes?:number; timeoutMs?:number; signal?:AbortSignal;}
export declare class DocumentResponseError extends Error {readonly code:string;}
export declare function receiveDocumentRequest<R extends DocumentRoute>(route:R,utf8Bytes:Uint8Array):AdmittedDocumentRequest<R>;
export declare function receiveDocumentResponse<R extends DocumentRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedDocumentRequest<R>):Promise<DocumentResponse<R>>;
export declare function receiveDocumentDownload<V extends AdmittedDocumentVersion>(response:Response,version:V,options?:DocumentDownloadOptions):Promise<DocumentDownload<V>>;
