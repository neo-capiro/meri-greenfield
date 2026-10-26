// Generated from the canonical CONTROL session receipt. No authority.

export type ConversationSessionEnvelope = ConversationSessionReceipt | ConversationSessionExpectedContext;
export type ConversationSessionExpectedContext =
  | {
      tenantId: string;
      actorId: string;
      conversationId?: string;
      runId?: string;
      selectedClientId: string;
      scopeKind: 'client';
    }
  | {
      tenantId: string;
      actorId: string;
      conversationId: string;
      runId?: string;
      selectedClientId: null;
      scopeKind: 'general';
    };

export interface ConversationSessionReceipt {
  credential: string;
  expiresAtMs: number;
  context: {
    tenantId: string;
    actorId: string;
    conversationId: string;
    runId: string;
    selectedClientId: string | null;
  };
  initialRunRebind?: {
    sourceRunId: string;
    targetRunId: string;
  };
}

export declare const conversationSessionVersion:'1.0.0';
export declare const conversationSessionMetadata:Readonly<{packageVersion:'0.1.12';sessionVersion:'1.0.0';responseBytes:4096;scopeSource:string;authority:string}>;
export declare class ConversationSessionResponseError extends Error {readonly code:'CONVERSATION_SESSION_REFUSED';}
export declare function receiveConversationSessionReceipt(utf8Bytes:Uint8Array,expectedContextBytes:Uint8Array,at:number):Readonly<ConversationSessionReceipt>;
