// Generated from browser-viewer/api.d.ts.
import type {RunBinding} from './contracts.js';
export declare const BROWSER_VIEWER_SCHEMA:'meri.browser-viewer/1';
export declare const BROWSER_VIEWER_ROUTES:readonly ['read','ticket','connect','frame','input','release'];
export type BrowserViewerRoute=typeof BROWSER_VIEWER_ROUTES[number];
export declare const BROWSER_VIEWER_LIMITS:Readonly<{requestBytes:number;responseBytes:number;pngBytes:number;ticketMs:number;maxPages:number}>;
export declare const BROWSER_VIEWER_ERRORS:Readonly<Record<'INVALID_REQUEST'|'UNAUTHENTICATED'|'ACCESS_DENIED'|'NOT_FOUND'|'METHOD_NOT_ALLOWED'|'CONFLICT'|'EXPIRED'|'TOO_LARGE'|'UNSUPPORTED_MEDIA_TYPE'|'UNAVAILABLE'|'REFUSED',number>>;
export type BrowserViewerContext=Readonly<{tenantId:string;actorId:string;conversationId:string;runId:string;selectedClientId:string|null}>;
export type BrowserViewerEvent=Readonly<
 {type:'mouse';action:'move';x:number;y:number}|{type:'mouse';action:'down'|'up';button:'left'|'middle'|'right';x:number;y:number}|
 {type:'wheel';x:number;y:number;deltaX:number;deltaY:number}|{type:'key';action:'down'|'up';key:string;shift:boolean}|{type:'text';text:string}>;
type RequestBase={readonly schema:typeof BROWSER_VIEWER_SCHEMA};
type RequestOwner=RequestBase&{readonly requestId:string;readonly ownerId:string};
type RequestLease=RequestOwner&{readonly viewerId:string;readonly leaseEpoch:number};
export type BrowserViewerRequestMap={
 read:RequestBase;ticket:RequestBase&{readonly requestId:string};connect:RequestBase&{readonly requestId:string;readonly ticket:string};
 frame:RequestLease&{readonly pageId:string};input:RequestLease&{readonly pageId:string;readonly frameId:string;readonly events:readonly BrowserViewerEvent[]};release:RequestLease;
};
export type BrowserViewerLease=Readonly<{viewerId:string;leaseEpoch:number;expiresAtMs:number;connectRequestId:string}>;
export type BrowserViewerPage=Readonly<{pageId:string;origin:string}>;
export type BrowserViewerFrame=Readonly<{frameId:string;pageId:string;width:number;height:number;image:Readonly<{mimeType:'image/png';data:string}>}>;
type ResponseBase={readonly schema:typeof BROWSER_VIEWER_SCHEMA;readonly context:BrowserViewerContext;readonly ownerId:string};
type ResponseLease=ResponseBase&{readonly requestId:string;readonly viewerId:string;readonly leaseEpoch:number};
export type BrowserViewerResponseMap={
 read:Omit<ResponseBase,'ownerId'>&{readonly ownerId:string|null;readonly binding:Readonly<RunBinding>;readonly checkpoint:Readonly<{checkpointId:string;checkpointSha256:string}>|null;readonly state:'unavailable'|'agent'|'taking'|'user'|'returning'|'ended';readonly lease:BrowserViewerLease|null;readonly pages:readonly BrowserViewerPage[]};
 ticket:ResponseBase&{readonly requestId:string;readonly ticket:string;readonly expiresAtMs:number};
 connect:ResponseBase&{readonly requestId:string;readonly state:'user';readonly lease:BrowserViewerLease};
 frame:ResponseLease&{readonly frame:BrowserViewerFrame};input:ResponseLease&{readonly accepted:true};release:ResponseLease&{readonly state:'returning'};
};
export type BrowserViewerFailure=Readonly<{schema:typeof BROWSER_VIEWER_SCHEMA;error:Readonly<{code:keyof typeof BROWSER_VIEWER_ERRORS;outcome:'NOT_DISPATCHED'|'UNKNOWN'|'READ_UNAVAILABLE'}>}>;
export declare function receiveBrowserViewerRequest<R extends BrowserViewerRoute>(route:R,bytes:Uint8Array):BrowserViewerRequestMap[R];
export declare function receiveBrowserViewerResponse<R extends BrowserViewerRoute>(route:R,status:number,bytes:Uint8Array,request:BrowserViewerRequestMap[R],expected:BrowserViewerContext):BrowserViewerResponseMap[R]|BrowserViewerFailure;
export declare function sameBrowserViewerContext(a:BrowserViewerContext,b:BrowserViewerContext):boolean;
export declare function browserViewerPng(frame:BrowserViewerFrame):Uint8Array;
export declare function browserTakeoverBinding(value:BrowserViewerResponseMap['read']):Readonly<RunBinding>;
