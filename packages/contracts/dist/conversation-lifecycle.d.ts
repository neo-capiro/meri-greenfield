// Generated from canonical lifecycle receiving schema. No authorization implied.

export type ConversationLifecycleEnvelope =
  | ConversationLifecycleControlRequest
  | ConversationLifecycleControlReceipt
  | ConversationCheckpointInspectionRequest
  | ConversationCheckpointInspectionReceipt
  | ConversationLifecycleErrorResponse;
export type ConversationLifecycleControlRequest =
  | {
      controlId: string;
      intent: 'steer';
      text: string;
    }
  | {
      controlId: string;
      intent: 'pause';
    }
  | {
      controlId: string;
      intent: 'approval.wait';
      proposalId: string;
    }
  | {
      controlId: string;
      intent: 'resume';
      checkpointId: string;
      checkpointSha256: string;
    }
  | {
      controlId: string;
      intent: 'fork';
      checkpointId: string;
      checkpointSha256: string;
    };

export interface ConversationLifecycleControlReceipt {
  controlId: string;
  intent: 'steer' | 'pause' | 'approval.wait' | 'resume' | 'fork';
  sourceBinding: Canonical_RunBinding_84F2304C;
  inputSha256: string;
  state: 'PENDING' | 'DISPATCHING' | 'APPLIED' | 'UNKNOWN';
  checkpointId: string | null;
  targetBinding: Canonical_RunBinding_84F2304C | null;
  admissionReceiptId: string | null;
  retirementReceiptId: string | null;
  replayed: boolean;
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
export interface ConversationCheckpointInspectionRequest {
  checkpointId: string;
}
export interface ConversationCheckpointInspectionReceipt {
  checkpointId: string;
  checkpointSha256: string;
  sourceBinding: Canonical_RunBinding_84F2304C;
  lastEventSequence: number;
}
export interface ConversationLifecycleErrorResponse {
  error: {
    code:
      | 'NOT_FOUND'
      | 'METHOD_NOT_ALLOWED'
      | 'SESSION_REFUSED'
      | 'UNSUPPORTED_MEDIA_TYPE'
      | 'LIFECYCLE_INPUT_REFUSED'
      | 'REQUEST_TOO_LARGE'
      | 'SESSION_CHANGED'
      | 'SCOPE_REFUSED'
      | 'STALE_WRITER'
      | 'LIFECYCLE_REPLAY_REFUSED'
      | 'LIFECYCLE_STATE_REFUSED'
      | 'CHECKPOINT_REFUSED'
      | 'APPROVAL_REFUSED'
      | 'CANCELLED'
      | 'DEADLINE'
      | 'LIFECYCLE_EFFECT_UNKNOWN';
    outcome: 'NOT_DISPATCHED' | 'UNKNOWN';
  };
}

import type {AdmittedConversationView} from './conversation-application.js';
export type ConversationLifecycleRoute='control'|'inspect';
declare const admittedLifecycleRequest:unique symbol;
export interface ConversationLifecycleRequestMap {control:ConversationLifecycleControlRequest;inspect:ConversationCheckpointInspectionRequest;}
export type AdmittedConversationLifecycleRequest<R extends ConversationLifecycleRoute>=Readonly<ConversationLifecycleRequestMap[R]>&{readonly [admittedLifecycleRequest]:R};
export interface ConversationLifecycleResponseMap {control:Readonly<ConversationLifecycleControlReceipt>;inspect:Readonly<ConversationCheckpointInspectionReceipt>;}
export type ConversationLifecycleResponse<R extends ConversationLifecycleRoute>=ConversationLifecycleResponseMap[R]|ConversationLifecycleErrorResponse;
export declare class ConversationLifecycleResponseError extends Error {readonly code:string;}
export declare const conversationLifecycleMetadata: {
  "packageVersion": "0.1.4",
  "schemaId": "urn:meri:conversation-lifecycle:0.1.0",
  "wireContractVersion": "0.1.0",
  "routes": {
    "control": {
      "method": "POST",
      "path": "/api/conversations/control"
    },
    "inspect": {
      "method": "POST",
      "path": "/api/conversations/checkpoints/inspect"
    }
  },
  "authentication": {
    "owner": "same current authenticated opaque session",
    "header": "authorization",
    "scheme": "Bearer",
    "validationGrantsAuthority": false
  },
  "control": {
    "idempotency": "exact immutable controlId/input/source binding",
    "unknown": "do not automatically resend SDK messages; current owner reconciliation required",
    "resume": "new run/attempt/worker, same conversation, higher fence",
    "fork": "new conversation/run/attempt/worker, independent positive fence; original preserved",
    "target": "receipt is a selector; obtain a fresh existing-owner session"
  },
  "inspection": {
    "projection": [
      "checkpointId",
      "checkpointSha256",
      "sourceBinding",
      "lastEventSequence"
    ],
    "authority": "current owner reads retained APPLIED checkpoint and verifies exact trusted immutable readback",
    "view": "refresh admitted history before inspecting a later checkpoint"
  },
  "approval": {
    "wait": "references existing immutable proposal; existing action approval routes retain authority",
    "continuation": "inherited approval is context only; target mutation requires fresh proposal/current approval"
  },
  "existingOwners": {
    "cancel": "/api/conversations/cancel",
    "events": "/api/conversations/events",
    "reconnect": "/api/conversations/events/{conversationId}/stream",
    "approval": "existing action-application"
  },
  "limits": {
    "requestBytes": 131072,
    "responseBytes": 131072
  },
  "errorStatuses": {
    "NOT_FOUND": [
      404
    ],
    "METHOD_NOT_ALLOWED": [
      405
    ],
    "SESSION_REFUSED": [
      401,
      403
    ],
    "UNSUPPORTED_MEDIA_TYPE": [
      415
    ],
    "LIFECYCLE_INPUT_REFUSED": [
      400
    ],
    "REQUEST_TOO_LARGE": [
      413
    ],
    "SESSION_CHANGED": [
      403
    ],
    "SCOPE_REFUSED": [
      403
    ],
    "STALE_WRITER": [
      403
    ],
    "LIFECYCLE_REPLAY_REFUSED": [
      409
    ],
    "LIFECYCLE_STATE_REFUSED": [
      409
    ],
    "CHECKPOINT_REFUSED": [
      409
    ],
    "APPROVAL_REFUSED": [
      409
    ],
    "CANCELLED": [
      408
    ],
    "DEADLINE": [
      408
    ],
    "LIFECYCLE_EFFECT_UNKNOWN": [
      502
    ]
  }
};
export declare function receiveConversationLifecycleRequest<R extends ConversationLifecycleRoute>(route:R,utf8Bytes:Uint8Array):AdmittedConversationLifecycleRequest<R>;
export declare function receiveConversationLifecycleResponse<R extends ConversationLifecycleRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationLifecycleRequest<R>,currentView:AdmittedConversationView):Promise<ConversationLifecycleResponse<R>>;
