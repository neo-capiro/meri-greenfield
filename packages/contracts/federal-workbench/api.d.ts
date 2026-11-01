export type FederalRoute='federal-prepare'|'federal-load'|'federal-publish'|'federal-import'|'federal-approve'|'federal-history';
export type FederalCompilerSource=FederalRetainedPreparation['draft']['source'];
export type FederalRequest<R extends FederalRoute>=R extends 'federal-import'?FederalImportRequest:R extends 'federal-prepare'?FederalPrepareRequest:R extends 'federal-load'?FederalLoadRequest:R extends 'federal-approve'?FederalApproveRequest:R extends 'federal-history'?FederalHistoryRequest:FederalPublishRequest;
declare const federalRequest:unique symbol;
declare const federalReview:unique symbol;
export type AdmittedFederalRequest<R extends FederalRoute>=Readonly<FederalRequest<R>>&{readonly[federalRequest]:R};
export type AdmittedFederalReview=Readonly<FederalReview>&{readonly[federalReview]:true};
export type FederalResponse<R extends FederalRoute>=(R extends 'federal-import'?Readonly<FederalImportResult>:R extends 'federal-publish'?Readonly<FederalPublication>:R extends 'federal-history'?Readonly<FederalHistory>:AdmittedFederalReview)|Readonly<FederalError>;
export declare const federalWorkbenchVersion:'1.7.0';
export declare function receiveFederalSource(bytes:Uint8Array):Promise<Readonly<FederalCompilerSource>>;
export declare function receiveFederalRequest<R extends FederalRoute>(route:R,bytes:Uint8Array):AdmittedFederalRequest<R>;
export declare function receiveFederalResponse<R extends FederalRoute>(route:R,status:number,bytes:Uint8Array,request:AdmittedFederalRequest<R>,review?:AdmittedFederalReview):Promise<FederalResponse<R>>;
export type FederalXmlRunKind='text'|'cdata';
export interface FederalXmlRunSpan {kind:'literal'|'entity'|'newline';rawStart:number;rawEnd:number;decodedStart:number;decodedEnd:number;}
export interface FederalXmlTextRun {kind:FederalXmlRunKind;decoded:string;spans:FederalXmlRunSpan[];}
/** Pure lexical projection only; these helpers do not authenticate a source, validate XSD or authorize an edit. */
export declare function decodeXmlTextRun(raw:string,kind?:FederalXmlRunKind,expectedDecoded?:string):FederalXmlTextRun;
export declare function mapDecodedRange(raw:string,kind:FederalXmlRunKind,start:number,end:number):{start:number;end:number};
export declare function encodeDecodedText(text:string,kind?:FederalXmlRunKind):string;
export declare function applyDecodedXmlEdit(raw:string,kind:FederalXmlRunKind,op:{kind:'replace'|'insert'|'delete';expectedText:string;text?:string;position?:'before'|'after'}):{text:string;start:number;end:number;replacement:string;textRun:FederalXmlTextRun};
