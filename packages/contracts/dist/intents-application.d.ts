// Generated additive intents contract from its canonical HTTP/approval owners. No authority implied.

export type IntentsApplicationEnvelope =
  | IntentsConversationId
  | IntentsDeliveryId
  | IntentsOperation
  | IntentsListRequest
  | IntentsDecideRequest
  | Canonical_ApprovalProposalD1A3E74F
  | Canonical_ApprovalDecision_5E8Bdbcf
  | Canonical_TaskCreateArguments_1202C301
  | IntentsExecutionOutcome
  | IntentsExecution
  | IntentsPendingItem
  | IntentsUnknownItem
  | IntentsFailedItem
  | IntentsDraftItem
  | IntentsWithheldDraftItem
  | IntentsScheduleProposalItem
  | IntentsWithheldProposalItem
  | IntentsProposalItem
  | IntentsItem
  | IntentsListResponse
  | IntentsDecideResponse
  | IntentsErrorResponse;
export type IntentsConversationId = string;
export type IntentsDeliveryId = string;
export type IntentsExecution =
  | {
      state: 'executing';
    }
  | {
      state: 'unknown';
    }
  | {
      state: 'completed';
      outcome: IntentsExecutionOutcome;
    };
export type IntentsItem =
  | IntentsPendingItem
  | IntentsUnknownItem
  | IntentsFailedItem
  | IntentsDraftItem
  | IntentsWithheldDraftItem
  | IntentsScheduleProposalItem
  | IntentsWithheldProposalItem
  | IntentsProposalItem;
export type IntentsDecideResponse =
  | {
      status: 'rejected';
      deliveryId: IntentsDeliveryId;
      proposalId: string;
      decision: Canonical_ApprovalDecision_5E8Bdbcf;
    }
  | {
      status: 'executed';
      deliveryId: IntentsDeliveryId;
      proposalId: string;
      decision: Canonical_ApprovalDecision_5E8Bdbcf;
      outcome: IntentsExecutionOutcome;
    }
  | {
      status: 'indeterminate';
      deliveryId: IntentsDeliveryId;
      proposalId: string;
      decision: Canonical_ApprovalDecision_5E8Bdbcf;
    };

export interface IntentsOperation {
  id: string;
  version: '0.2.0';
}
export interface IntentsListRequest {
  conversationId: IntentsConversationId;
  after?: IntentsDeliveryId | null;
  limit?: number;
}
export interface IntentsDecideRequest {
  conversationId: IntentsConversationId;
  deliveryId: IntentsDeliveryId;
  proposalId: string;
  commandSha256: string;
  decision: 'approved' | 'rejected';
}
export interface Canonical_ApprovalProposalD1A3E74F {
  proposalId: string;
  command: Canonical_Command_2099E1Ba;
  commandSha256: string;
  createdAt: string;
  expiresAt: string;
  requiredApprover: Canonical_IdentityAba0A4E9;
}
export interface Canonical_Command_2099E1Ba {
  contractVersion: '0.1.0';
  commandId: string;
  binding: Canonical_RunBinding_84F2304C;
  action: 'memory.propose' | 'task.create' | 'artifact.file';
  arguments: {};
  attachments: Canonical_ObjectReferenceA099Bd1C[];
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  idempotencyKey: string;
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
export interface Canonical_IdentityAba0A4E9 {
  tenantId: string;
  actorId: string;
}
export interface Canonical_ApprovalDecision_5E8Bdbcf {
  proposalId: string;
  commandSha256: string;
  decision: 'approved' | 'rejected';
  decidedAt: string;
  expiresAt: string;
  approver: Canonical_IdentityAba0A4E9;
  policyRevision: string;
}
export interface Canonical_TaskCreateArguments_1202C301 {
  title: string;
  clientId: string | null;
  dueDate: string | null;
}
export interface IntentsExecutionOutcome {
  receipt: Canonical_CommandReceiptAc49Ee1E;
  result: Canonical_TaskCreateResult_0501C509;
}
export interface Canonical_CommandReceiptAc49Ee1E {
  receiptId: string;
  commandId: string;
  commandSha256: string;
  idempotencyKey: string;
  binding: Canonical_RunBinding_84F2304C;
  outcome: 'succeeded' | 'denied' | 'failed' | 'indeterminate';
  sourceTransactionId: string | null;
  completedAt: string;
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  authorizationDecisionId: string;
}
export interface Canonical_TaskCreateResult_0501C509 {
  id: string;
  title: string;
  status: 'todo';
  dueDate: string | null;
  clientId: string | null;
  createdAt: string;
}
export interface IntentsPendingItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'pending';
}
export interface IntentsUnknownItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'unknown';
}
export interface IntentsFailedItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'failed';
  code:
    | 'UNAVAILABLE'
    | 'ACCESS_DENIED'
    | 'REFUSED'
    | 'INVALID_ARGUMENTS'
    | 'DEADLINE'
    | 'CANCELLED'
    | 'CONFLICT'
    | 'UNKNOWN';
}
export interface IntentsDraftItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'draft';
  versionId: string;
}
export interface IntentsWithheldDraftItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'draft';
  withheld: true;
}
export interface IntentsScheduleProposalItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'schedule_proposal';
  proposalId: string | null;
}
export interface IntentsWithheldProposalItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'proposal';
  withheld: true;
}
export interface IntentsProposalItem {
  deliveryId: IntentsDeliveryId;
  createdAt: string;
  operation: IntentsOperation;
  state: 'prepared';
  kind: 'proposal';
  proposal: Canonical_ApprovalProposalD1A3E74F;
  decision: Canonical_ApprovalDecision_5E8Bdbcf | null | 'unavailable';
  execution: IntentsExecution | null | 'unavailable';
  phase:
    | 'awaiting_approval'
    | 'approved'
    | 'rejected'
    | 'expired'
    | 'executing'
    | 'completed'
    | 'unknown'
    | 'unknown_decision';
}
export interface IntentsListResponse {
  conversationId: IntentsConversationId;
  /**
   * @maxItems 50
   */
  intents: IntentsItem[];
  next: IntentsDeliveryId | null;
}
export interface IntentsErrorResponse {
  error: {
    code:
      | 'INVALID_REQUEST'
      | 'UNAUTHENTICATED'
      | 'ACCESS_DENIED'
      | 'MEMBERSHIP_REVOKED'
      | 'NOT_FOUND'
      | 'METHOD_NOT_ALLOWED'
      | 'DEADLINE'
      | 'MEMBERSHIP_CHANGED'
      | 'REQUEST_TOO_LARGE'
      | 'UNSUPPORTED_MEDIA_TYPE'
      | 'CANCELLED'
      | 'PRODUCT_UNAVAILABLE'
      | 'INTENT_APPROVALS_DISABLED'
      | 'INTENT_NOT_FOUND'
      | 'INTENT_NOT_PREPARED'
      | 'INTENT_NOT_APPROVABLE'
      | 'INTENT_MISMATCH'
      | 'INTENT_EXPIRED'
      | 'INTENT_SCOPE_WITHHELD'
      | 'APPROVER_REFUSED'
      | 'APPROVAL_OWNER_UNAVAILABLE'
      | 'APPROVAL_DECISION_REFUSED'
      | 'APPROVAL_DECISION_UNKNOWN'
      | 'EXECUTION_OWNER_UNAVAILABLE'
      | 'EXECUTION_AUTHORITY_REFUSED'
      | 'INTENT_CROSS_RUN'
      | 'COMMAND_APPROVAL_REFUSED'
      | 'COMMAND_AUTHORITY_REFUSED'
      | 'COMMAND_PREPARATION_REFUSED'
      | 'COMMAND_REFUSED'
      | 'COMMAND_OUTCOME_UNKNOWN'
      | 'INTENT_RESULT_NOT_RELEASED'
      | 'INTENT_EXECUTION_UNKNOWN'
      | 'INTENT_JOURNAL_UNAVAILABLE'
      | 'INTENT_REQUEST_INVALID';
    outcome?: 'NOT_DISPATCHED' | 'UNKNOWN' | 'RESULT_NOT_RELEASED';
    field?: string;
  };
}

export type IntentsRoute='list'|'decide';
export interface IntentsRequestMap {list:IntentsListRequest;decide:IntentsDecideRequest;}
export interface IntentsResponseMap {list:IntentsListResponse;decide:IntentsDecideResponse;}
export type IntentsProposal = IntentsProposalItem['proposal'];
export interface IntentsExpectationMap {list:{request:IntentsListRequest};decide:{request:IntentsDecideRequest;proposal:IntentsProposal};}
export type IntentsResponse<R extends IntentsRoute>=IntentsResponseMap[R]|IntentsErrorResponse;
export declare class IntentsResponseError extends Error {readonly code:string;}
export declare const intentsVersion:'0.1.0';
export declare const intentsPaths:Readonly<{"list":"/api/conversations/intents/list","decide":"/api/conversations/intents/decide"}>;
export declare const intentsMetadata:{
  "contractVersion": "0.1.0",
  "schemaId": "urn:meri:intents-application:0.1.0",
  "routes": {
    "list": {
      "method": "POST",
      "path": "/api/conversations/intents/list",
      "response": "json"
    },
    "decide": {
      "method": "POST",
      "path": "/api/conversations/intents/decide",
      "response": "json"
    }
  },
  "authentication": {
    "scheme": "Bearer",
    "authority": "native session admitted by Core membership on every request; tenant, actor and clients come only from that admission, never from a body or a response"
  },
  "limits": {
    "requestBytes": 4096,
    "responseBytes": 16777216,
    "requestMs": 30000,
    "listLimitDefault": 20,
    "listLimitMax": 50,
    "jsonDepth": 64,
    "jsonNodes": 100000
  },
  "errorStatuses": {
    "INVALID_REQUEST": 400,
    "UNAUTHENTICATED": 401,
    "ACCESS_DENIED": 403,
    "MEMBERSHIP_REVOKED": 403,
    "NOT_FOUND": 404,
    "METHOD_NOT_ALLOWED": 405,
    "DEADLINE": 408,
    "MEMBERSHIP_CHANGED": 409,
    "REQUEST_TOO_LARGE": 413,
    "UNSUPPORTED_MEDIA_TYPE": 415,
    "CANCELLED": 499,
    "PRODUCT_UNAVAILABLE": 502,
    "INTENT_APPROVALS_DISABLED": 503,
    "INTENT_NOT_FOUND": 404,
    "INTENT_NOT_PREPARED": 409,
    "INTENT_NOT_APPROVABLE": 409,
    "INTENT_MISMATCH": 409,
    "INTENT_EXPIRED": 409,
    "INTENT_SCOPE_WITHHELD": 403,
    "APPROVER_REFUSED": 403,
    "APPROVAL_OWNER_UNAVAILABLE": 503,
    "APPROVAL_DECISION_REFUSED": 409,
    "APPROVAL_DECISION_UNKNOWN": 502,
    "EXECUTION_OWNER_UNAVAILABLE": 503,
    "EXECUTION_AUTHORITY_REFUSED": 403,
    "INTENT_CROSS_RUN": 409,
    "COMMAND_APPROVAL_REFUSED": 409,
    "COMMAND_AUTHORITY_REFUSED": 403,
    "COMMAND_PREPARATION_REFUSED": 409,
    "COMMAND_REFUSED": 409,
    "COMMAND_OUTCOME_UNKNOWN": 502,
    "INTENT_RESULT_NOT_RELEASED": 502,
    "INTENT_EXECUTION_UNKNOWN": 502,
    "INTENT_JOURNAL_UNAVAILABLE": 503,
    "INTENT_REQUEST_INVALID": 400
  },
  "errorOutcomes": [
    "NOT_DISPATCHED",
    "UNKNOWN",
    "RESULT_NOT_RELEASED"
  ],
  "failureCodes": [
    "UNAVAILABLE",
    "ACCESS_DENIED",
    "REFUSED",
    "INVALID_ARGUMENTS",
    "DEADLINE",
    "CANCELLED",
    "CONFLICT",
    "UNKNOWN"
  ],
  "approvableActions": [
    "task.create"
  ],
  "semantics": {
    "list": "read-only durable history of this conversation's prepared intents; next is the last returned deliveryId when more remain, otherwise null",
    "decision": "approved or rejected is recorded by the canonical decision owner for exactly the named proposal, command hash and approver; display, stream or model text never approves",
    "execution": "only actions in approvableActions execute; any other prepared proposal answers INTENT_NOT_APPROVABLE and stays prepared",
    "executed": "status executed returns the observed receipt and task result; the receiver admits it only as the executor's own outcome for the retained task.create command (its hash, id, idempotency key, scopes and stable binding, a succeeded receipt with no source transaction, and a result equal to the immutable arguments)",
    "correlation": "a list answer is admitted against its captured list request; a decide answer is admitted against the captured decide request and the proposal admitted from an earlier list answer; rejected and indeterminate replies carry no conversation or command of their own, so only that retained proposal binds them to the request's conversation and approver",
    "uncertainty": "UNKNOWN and RESULT_NOT_RELEASED mean a decision or effect may exist: repeat the identical decide request or read list; never prepare a second proposal",
    "withheld": "withheld items carry no content because the caller no longer sees a client scope of the retained command",
    "expiry": "the caller compares proposal.expiresAt with a fresh clock before presenting a decision; the server rechecks current authority",
    "phase": "phase is a reading of the durable decision and execution owners, never a decision",
    "integration": "isolated source contract; route mounting, Core decision-owner wiring and runtime qualification remain handoff work"
  }
};
export declare function receiveIntentsRequest<R extends IntentsRoute>(route:R,jsonText:unknown):Promise<IntentsRequestMap[R]>;
export declare function receiveIntentsResponse<R extends IntentsRoute>(route:R,httpStatus:number,jsonText:unknown,expectation:IntentsExpectationMap[R]):Promise<IntentsResponse<R>>;
