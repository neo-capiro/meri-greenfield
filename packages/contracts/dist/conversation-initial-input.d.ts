// Generated allocation schema. Validation grants no authority or dispatch permission.

export type ConversationInitialInputEnvelope =
  ConversationInitialInputAllocatedResponse | ConversationInitialInputErrorResponse;

export interface ConversationInitialInputAllocatedResponse {
  allocation: ConversationInitialInputAllocation;
  state: 'RESERVED' | 'ACCEPTED';
  created: boolean;
}
export interface ConversationInitialInputAllocation {
  binding: Canonical_RunBinding_84F2304C;
  /**
   * @minItems 1
   * @maxItems 100
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  versions: Canonical_RuntimeVersions_7Edb8Efc;
  selectedClientId: string;
  requestId: string;
  inputSha256: string;
  requestSha256: string;
  allocatedAtMs: number;
  expiresAtMs: number;
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
export interface Canonical_ScopeF882Edb5 {
  tenantId: string;
  kind: 'tenant' | 'client' | 'mailbox' | 'memory' | 'document' | 'private-user' | 'public';
  resourceId: string;
  policyRevision: string;
}
export interface Canonical_RuntimeVersions_7Edb8Efc {
  imageDigest: string;
  sdk: string;
  cli: string;
  contracts: '0.1.0';
  skillsDigest: string;
  checkpointFormat: '0.1.0';
}
export interface ConversationInitialInputErrorResponse {
  error: {
    code:
      | 'NOT_FOUND'
      | 'METHOD_NOT_ALLOWED'
      | 'INVALID_REQUEST'
      | 'SESSION_REFUSED'
      | 'SCOPE_REFUSED'
      | 'SESSION_CHANGED'
      | 'STALE_WRITER'
      | 'INITIAL_INPUT_CONFLICT'
      | 'INITIAL_INPUT_ALREADY_EXISTS'
      | 'INITIAL_INPUT_EXPIRED'
      | 'DEADLINE'
      | 'CANCELLED'
      | 'INITIAL_INPUT_REQUIRED'
      | 'INITIAL_INPUT_CORRUPT'
      | 'INITIAL_INPUT_UNAVAILABLE'
      | 'REQUEST_TOO_LARGE'
      | 'UNSUPPORTED_MEDIA_TYPE';
    outcome: 'NOT_DISPATCHED' | 'UNKNOWN';
  };
}

import type {AdmittedConversationInputRequest,AdmittedConversationInputReceipt,ConversationInputErrorResponse,ConversationInputExpectedContext} from '@capiro/meri-contracts/conversation-input';
export type ConversationInitialInputRequest=Pick<AdmittedConversationInputRequest,'requestId'|'prompt'|'skill'|'windowRequest'>;
export type ConversationInitialInputExpectedContext=ConversationInputExpectedContext;
export type ConversationInitialInputBinding=AdmittedConversationInputReceipt['run']['binding'];
export type ConversationInitialInputScope=AdmittedConversationInputReceipt['run']['scopes'][number];
export type ConversationInitialInputVersions=AdmittedConversationInputReceipt['run']['versions'];
declare const initialInputRequest:unique symbol;
declare const initialInputReceipt:unique symbol;
export type AdmittedConversationInitialInputRequest=AdmittedConversationInputRequest&{readonly [initialInputRequest]:true};
export type AdmittedConversationInitialInputReceipt=Readonly<ConversationInitialInputAllocatedResponse>&{readonly [initialInputReceipt]:true};
export declare class ConversationInitialInputResponseError extends Error {readonly code:string;}
export declare const conversationInitialInputMetadata: {
  "packageVersion": "0.1.9",
  "initialInputVersion": "1.0.0",
  "schemaId": "urn:meri:conversation-initial-input:1.0.0",
  "routes": {
    "allocate": {
      "method": "POST",
      "path": "/api/conversations/input/allocate",
      "response": "json"
    }
  },
  "authentication": {
    "header": "authorization",
    "scheme": "Bearer",
    "owner": "current authenticated opaque session",
    "validationGrantsAuthority": false,
    "expectedContext": "independently authenticated tenant, actor, conversation, run and selected client"
  },
  "limits": {
    "requestBytes": 131072,
    "responseBytes": 131072,
    "maxRequestMs": 12000
  },
  "bridge": {
    "owner": "accepted conversation-input receiver",
    "responseBytes": 2097152,
    "viewOwner": "conversationInputView"
  },
  "recovery": "only the exact retained immutable request with its genuine allocation proof; digests, UNKNOWN and absence do not create input authority",
  "errorOutcomes": [
    "NOT_DISPATCHED",
    "UNKNOWN"
  ],
  "errorOutcomeByCode": {
    "NOT_FOUND": "NOT_DISPATCHED",
    "METHOD_NOT_ALLOWED": "NOT_DISPATCHED",
    "INVALID_REQUEST": "NOT_DISPATCHED",
    "SESSION_REFUSED": "NOT_DISPATCHED",
    "SCOPE_REFUSED": "NOT_DISPATCHED",
    "SESSION_CHANGED": "NOT_DISPATCHED",
    "STALE_WRITER": "NOT_DISPATCHED",
    "INITIAL_INPUT_CONFLICT": "NOT_DISPATCHED",
    "INITIAL_INPUT_ALREADY_EXISTS": "NOT_DISPATCHED",
    "INITIAL_INPUT_EXPIRED": "NOT_DISPATCHED",
    "DEADLINE": "UNKNOWN",
    "CANCELLED": "UNKNOWN",
    "INITIAL_INPUT_REQUIRED": "UNKNOWN",
    "INITIAL_INPUT_CORRUPT": "UNKNOWN",
    "INITIAL_INPUT_UNAVAILABLE": "UNKNOWN",
    "REQUEST_TOO_LARGE": "NOT_DISPATCHED",
    "UNSUPPORTED_MEDIA_TYPE": "NOT_DISPATCHED"
  },
  "errorStatuses": {
    "NOT_FOUND": [
      404
    ],
    "METHOD_NOT_ALLOWED": [
      405
    ],
    "INVALID_REQUEST": [
      400
    ],
    "SESSION_REFUSED": [
      401,
      403
    ],
    "SCOPE_REFUSED": [
      403
    ],
    "SESSION_CHANGED": [
      403
    ],
    "STALE_WRITER": [
      403
    ],
    "INITIAL_INPUT_CONFLICT": [
      409
    ],
    "INITIAL_INPUT_ALREADY_EXISTS": [
      409
    ],
    "INITIAL_INPUT_EXPIRED": [
      408
    ],
    "DEADLINE": [
      408
    ],
    "CANCELLED": [
      408
    ],
    "INITIAL_INPUT_REQUIRED": [
      503
    ],
    "INITIAL_INPUT_CORRUPT": [
      503
    ],
    "INITIAL_INPUT_UNAVAILABLE": [
      503
    ],
    "REQUEST_TOO_LARGE": [
      413
    ],
    "UNSUPPORTED_MEDIA_TYPE": [
      415
    ]
  }
};
export declare const conversationInitialInputVersion:'1.0.0';
export declare const conversationInitialInputPath:'/api/conversations/input/allocate';
export declare function receiveConversationInitialInputRequest(utf8Bytes:Uint8Array):AdmittedConversationInitialInputRequest;
export declare function receiveConversationInitialInputResponse(httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationInitialInputRequest,expectedContext:Readonly<ConversationInitialInputExpectedContext>):Promise<AdmittedConversationInitialInputReceipt|ConversationInitialInputErrorResponse>;
export declare function receiveAllocatedConversationInputResponse(httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationInitialInputRequest,expectedContext:Readonly<ConversationInitialInputExpectedContext>,allocation:AdmittedConversationInitialInputReceipt):Promise<AdmittedConversationInputReceipt|ConversationInputErrorResponse>;
