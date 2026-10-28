// Generated upload integrity boundary. No authority, malware qualification or retry grant.

export type UploadEnvelope = UploadInitiateRequest | UploadIdRequest | UploadReceipt | UploadError;

export interface UploadInitiateRequest {
  requestId: string;
  filename: string;
  mimeType:
    | 'text/plain'
    | 'text/markdown'
    | 'application/pdf'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    | 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    | 'image/png'
    | 'image/jpeg';
  bytes: number;
  sha256: string;
}
export interface UploadIdRequest {
  uploadId: string;
}
export interface UploadReceipt {
  uploadId: string;
  requestId: string;
  original: UploadOriginal;
  storageStatus: 'awaiting_upload' | 'unknown' | 'stored' | 'removing' | 'removed';
  scanStatus: 'pending' | 'clean' | 'infected' | 'unavailable';
  scanReason: string | null;
  extraction: {
    status: 'pending' | 'available' | 'partial' | 'unavailable' | 'blocked';
    /**
     * @maxItems 17
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
        ];
  };
  originalBytesAvailable: boolean;
}
export interface UploadOriginal {
  filename: string;
  mimeType:
    | 'text/plain'
    | 'text/markdown'
    | 'application/pdf'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    | 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    | 'image/png'
    | 'image/jpeg';
  bytes: number;
  sha256: string;
  versionId: string | null;
}
export interface UploadError {
  error: {
    code:
      | 'UPLOAD_ID'
      | 'UPLOAD_FILENAME'
      | 'UPLOAD_FORMAT'
      | 'UPLOAD_HASH'
      | 'UPLOAD_ENCODING'
      | 'UPLOAD_MAGIC'
      | 'UPLOAD_IMAGE_LIMIT'
      | 'UPLOAD_ACTIVE_CONTENT'
      | 'UPLOAD_RELATIONSHIP'
      | 'UPLOAD_ORIGINAL_MISMATCH'
      | 'INVALID_COMMAND'
      | 'INVALID_JSON'
      | 'INVALID_BODY'
      | 'INVALID_CONTENT_LENGTH'
      | 'INVALID_UTF8'
      | 'UPLOAD_ACCESS_DENIED'
      | 'ACCESS_DENIED'
      | 'UPLOAD_NOT_FOUND'
      | 'NOT_FOUND'
      | 'METHOD_NOT_ALLOWED'
      | 'DEADLINE'
      | 'UPLOAD_EXPIRED'
      | 'UPLOAD_REQUEST_CONFLICT'
      | 'UPLOAD_CHANGED'
      | 'UPLOAD_NOT_CLEAN'
      | 'UPLOAD_NOT_STORED'
      | 'UPLOAD_REMOVAL_UNCERTAIN'
      | 'UPLOAD_REMOVAL_HELD'
      | 'UPLOAD_SIZE'
      | 'REQUEST_TOO_LARGE'
      | 'CANCELLED'
      | 'UPLOAD_UNAVAILABLE'
      | 'UPLOAD_PUT_UNKNOWN'
      | 'UPLOAD_COMMIT_UNKNOWN';
    outcome: 'NOT_DISPATCHED' | 'UNKNOWN' | 'READ_UNAVAILABLE';
  };
}

declare const uploadRequestBrand:unique symbol,uploadReceiptBrand:unique symbol;
export type UploadRoute="initiate"|"complete"|"status"|"inspect"|"read"|"remove";
export type AdmittedUploadRequest<R extends UploadRoute>=Readonly<R extends 'initiate'?UploadInitiateRequest:UploadIdRequest>&{readonly [uploadRequestBrand]:R};
export type AdmittedUploadReceipt=Readonly<UploadReceipt>&{readonly [uploadReceiptBrand]:true};
export declare class UploadResponseError extends Error {readonly code:string;}
export declare const uploadApplicationVersion:'1.0.0',UPLOAD_POLICY_VERSION:'upload-1';
export declare const uploadApplicationMetadata:{
  "version": "1.0.0",
  "schemaId": "urn:meri:uploads-application:1.0.0",
  "requestBytes": 8192,
  "responseBytes": 32768,
  "originalBytes": 10485760,
  "policyVersion": "upload-1"
};
export declare const UPLOAD_LIMITS:Readonly<{"originalBytes":10485760,"zipEntries":4096,"expandedBytes":67108864,"compressionRatio":100,"pdfPages":200,"slides":200,"sheets":50,"rows":100000,"columns":1024,"textCharacters":2000000,"imagePixels":40000000,"scanMs":30000,"parseMs":30000,"ocrMs":90000,"ocrPages":40,"lowConfidence":0.8}>;
export declare const UPLOAD_MIME:Readonly<{"txt":"text/plain","md":"text/markdown","pdf":"application/pdf","docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","xlsx":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","pptx":"application/vnd.openxmlformats-officedocument.presentationml.presentation","png":"image/png","jpg":"image/jpeg","jpeg":"image/jpeg"}>;
export declare const uploadRoutes:readonly UploadRoute[],uploadNotDispatchedErrors:readonly string[];
export declare const uploadErrorStatuses:Readonly<Record<string,number>>;
export declare function uploadDisposition(filename:string):string;
export declare function receiveUploadRequest<R extends UploadRoute>(route:R,bytes:Uint8Array):AdmittedUploadRequest<R>;
export declare function uploadRequestPath<R extends UploadRoute>(route:R,request:AdmittedUploadRequest<R>):string;
export declare function receiveUploadResponse<R extends UploadRoute>(route:R,status:number,bytes:Uint8Array,request:AdmittedUploadRequest<R>):AdmittedUploadReceipt|UploadError;
export declare function receiveUploadOriginal(bytes:Uint8Array,request:AdmittedUploadRequest<'complete'>,receipt:AdmittedUploadReceipt):Promise<Uint8Array>;
export declare function receiveUploadDownload(response:Response,request:AdmittedUploadRequest<'read'>,receipt:AdmittedUploadReceipt,options?:{timeoutMs?:number;signal?:AbortSignal}):Promise<Readonly<{receipt:AdmittedUploadReceipt;bytes:Uint8Array}>>;
