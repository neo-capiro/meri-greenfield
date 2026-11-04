import type {ConversationSubmitRequest} from '@capiro/meri-contracts/conversation-application';
import type {DocumentContentRequest,DocumentCreatedResponse,DocumentInspectionResponse,DocumentErrorResponse,DocumentReceipt} from '@capiro/meri-contracts/document-application';
export type CanvasSelection=NonNullable<ConversationSubmitRequest['documentRevision']>;
export type DocumentCanvasContent=Extract<DocumentContentRequest,{operation:'create_word';format:'docx'|'txt'}>;
export type CanvasRoute='canvas-read'|'canvas-save';
export interface CanvasReadRequest {selection:CanvasSelection;}
export interface CanvasSaveRequest {selection:CanvasSelection;deliveryId:string;request:DocumentCanvasContent;}
export type DocumentCanvasSource=Exclude<DocumentInspectionResponse,{kind:'native-file'}>&{request:DocumentCanvasContent;headVersionId:string};
export interface CanvasRequestMap {'canvas-read':CanvasReadRequest;'canvas-save':CanvasSaveRequest;}
declare const admittedCanvasRequest:unique symbol;
export type AdmittedCanvasRequest<R extends CanvasRoute>=Readonly<CanvasRequestMap[R]>&{readonly [admittedCanvasRequest]:R};
export interface CanvasResponseMap {'canvas-read':DocumentReceipt<DocumentCanvasSource>;'canvas-save':DocumentReceipt<DocumentCreatedResponse>;}
export type CanvasResponse<R extends CanvasRoute>=CanvasResponseMap[R]|DocumentErrorResponse;
export declare const DOCUMENT_CANVAS_SCHEMA:'meri.document-canvas/1';
export declare const DOCUMENT_CANVAS_PATHS:Readonly<Record<CanvasRoute,string>>;
export declare class CanvasResponseError extends Error {readonly code:string;}
export declare function receiveCanvasRequest<R extends CanvasRoute>(route:R,bytes:Uint8Array):AdmittedCanvasRequest<R>;
export declare function receiveCanvasResponse<R extends CanvasRoute>(route:R,status:number,bytes:Uint8Array,request:AdmittedCanvasRequest<R>):Promise<CanvasResponse<R>>;
