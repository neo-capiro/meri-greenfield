import type {ConversationSessionReceipt} from './dist/conversation-session.js';
export interface OutreachGenerationStartRequest {generationJobId:string;itemId:string}
export interface OutreachGenerationStarted extends OutreachGenerationStartRequest {state:'requested';conversationId:string;requestId:string;session:ConversationSessionReceipt}
export interface OutreachGenerationStartFailure {error:{code:'OUTREACH_GENERATION_REFUSED'|'SESSION_REFUSED'|'OUTREACH_GENERATION_UNAVAILABLE'|'OUTREACH_GENERATION_UNKNOWN'}}
export declare const outreachGenerationStartMetadata:Readonly<{version:'1.0.0';path:'/api/outreach-generation/start';method:'POST';requestBytes:2048;responseBytes:8192}>;
export declare function requireOutreachGenerationStartRequest(value:unknown):Readonly<OutreachGenerationStartRequest>;
export declare function receiveOutreachGenerationStartResponse(status:number,jsonText:string,expected:OutreachGenerationStartRequest,at:number):Readonly<OutreachGenerationStarted|OutreachGenerationStartFailure>;
