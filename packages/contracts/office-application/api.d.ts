import type {DocumentInspectionResponse,DocumentVersion,DocumentDownloadOptions} from '@capiro/meri-contracts/document-access-application';
export declare const OFFICE_SCHEMA:'meri.office-application/1';
export type OfficeRoute='open'|'read'|'launch'|'renew'|'release'|'discard'|'publish'|'inspect'|'import';
export declare const OFFICE_ROUTES:readonly OfficeRoute[];
export declare const OFFICE_ERROR_STATUSES:Readonly<Record<OfficeErrorCode,number>>;
export type OfficeErrorCode='INVALID_REQUEST'|'UNAUTHENTICATED'|'ACCESS_DENIED'|'NOT_FOUND'|'METHOD_NOT_ALLOWED'|'DEADLINE'|'CONFLICT'|'PUBLISH_UNRESOLVED'|'IMPORT_UNRESOLVED'|'TOO_LARGE'|'UNSUPPORTED_MEDIA_TYPE'|'CANCELLED'|'REFUSED'|'UNAVAILABLE';
type Selection={readonly schema:typeof OFFICE_SCHEMA;readonly versionId:string;readonly draftId:string};
type EditorSelection={readonly editorId:string;readonly expectedEpoch:number};
export interface OfficeRequestMap {
 import:{readonly schema:typeof OFFICE_SCHEMA;readonly uploadId:string;readonly sha256:string;readonly operation:'import'|'recover'};
 open:Selection;read:Selection;discard:Selection;
 launch:Selection&EditorSelection&{readonly mode:'edit'|'view';readonly operation:'acquire'|'takeover'};
 renew:Selection&EditorSelection&{readonly mode:'edit'|'view'};
 release:Selection&EditorSelection;
 publish:Selection&{readonly sequence:number;readonly sha256:string};
 inspect:{readonly schema:typeof OFFICE_SCHEMA;readonly versionId:string};
}
declare const requestBrand:unique symbol,versionBrand:unique symbol;
export type AdmittedOfficeRequest<R extends OfficeRoute>=Readonly<OfficeRequestMap[R]>&{readonly [requestBrand]:R};
export type OfficeDraftState='draft'|'publish-pending'|'publish-unknown'|'publish-refused'|'conflict'|'published';
export interface OfficeDraft {
 readonly draftId:string;readonly conversationId:string;readonly artifactId:string;readonly baseVersionId:string;readonly baseSha256:string;
 readonly format:'docx'|'xlsx'|'pptx';readonly filename:string;readonly sequence:number;readonly sha256:string|null;readonly byteLength:number;
 readonly state:OfficeDraftState;readonly publishIntent:string|null;readonly publishedVersionId:string|null;readonly savedAt:string;readonly expiresAt:string;
}
export interface OfficeEditor {readonly editorId:string|null;readonly epoch:number;readonly expiresAt:string|null;}
export interface OfficeLaunch {
 readonly edition:'collabora-code';readonly editorOrigin:string;readonly actionUrl:string;readonly method:'POST';
 readonly fields:Readonly<{access_token:string;access_token_ttl:string}>;readonly expiresAtMs:number;
}
type CanonicalInspection=Extract<DocumentInspectionResponse,{inspection:unknown}>['inspection'];
type Excel=Extract<CanonicalInspection,{format:'xlsx'}>;
type NativeExcel=Omit<Excel,'details'>&{readonly details:Omit<Excel['details'],'formulaCache'|'revisionMethod'>&{readonly formulaCache:'editor-provided/unverified; recalculation required'}};
export type OfficeInspection=Extract<CanonicalInspection,{format:'docx'|'xlsx'|'pptx'}>|NativeExcel;
export type OfficeVersion=Readonly<DocumentVersion>&{readonly [versionBrand]:true};
export interface OfficeDocument {readonly version:OfficeVersion;readonly inspection:OfficeInspection;}
export interface OfficeSnapshot {readonly schema:typeof OFFICE_SCHEMA;readonly draft:OfficeDraft;readonly editor:OfficeEditor;readonly launch:OfficeLaunch|null;}
export interface OfficeResponseMap {
 import:{readonly schema:typeof OFFICE_SCHEMA;readonly uploadId:string;readonly sha256:string;readonly document:OfficeDocument};
 open:OfficeSnapshot;read:OfficeSnapshot;launch:OfficeSnapshot;renew:OfficeSnapshot;release:OfficeSnapshot;
 discard:{readonly schema:typeof OFFICE_SCHEMA;readonly discarded:true};
 publish:{readonly schema:typeof OFFICE_SCHEMA;readonly draft:OfficeDraft;readonly publication:OfficeDocument};
 inspect:{readonly schema:typeof OFFICE_SCHEMA;readonly document:OfficeDocument};
}
export interface OfficeFailure {readonly schema:typeof OFFICE_SCHEMA;readonly error:Readonly<{code:OfficeErrorCode;outcome:'NOT_DISPATCHED'|'UNKNOWN'|'RESULT_NOT_RELEASED'|'READ_UNAVAILABLE'}>;}
export declare class OfficeResponseError extends Error {readonly code:string;}
export declare function receiveOfficeRequest<R extends OfficeRoute>(route:R,bytes:Uint8Array):AdmittedOfficeRequest<R>;
export declare function receiveOfficeResponse<R extends OfficeRoute>(route:R,status:number,bytes:Uint8Array,request:AdmittedOfficeRequest<R>):Promise<OfficeResponseMap[R]|OfficeFailure>;
export declare function receiveOfficeDownload(response:Response,version:OfficeVersion,options?:DocumentDownloadOptions):Promise<Readonly<{version:OfficeVersion;bytes:Uint8Array<ArrayBuffer>}>>;
