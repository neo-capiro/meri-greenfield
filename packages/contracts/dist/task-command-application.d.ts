// Generated additive task-command contract from canonical schemas. No authorization implied.

export type TaskCommandApplicationEnvelope =
  | Canonical_TaskUpdateRaw_549267Ce
  | Canonical_TaskUpdateArguments_48509A7A
  | Canonical_TaskUpdateApprovalProposal_1F70E582
  | Canonical_TaskUpdateResult_029549A8
  | TaskCommandPrepareRequest
  | TaskCommandExecuteRequest
  | TaskCommandPrepareResponse
  | TaskCommandExecuteResponse
  | TaskCommandErrorResponse
  | TaskCommandExpectedBinding
  | Canonical_TaskUpdateContext_90C41Ed0
  | Canonical_TaskUpdateCommandB73E3Ce0
  | Canonical_RunBinding_84F2304C;
export type TaskCommandExecuteResponse =
  | {
      status: 'observed';
      outcome: {
        receipt: Canonical_CommandReceiptAc49Ee1E;
        result: Canonical_TaskUpdateResult_029549A8;
      };
    }
  | {
      status: 'indeterminate';
      outcome: null;
    };

export interface Canonical_TaskUpdateRaw_549267Ce {
  taskId: string;
  title?: string | null;
  status?: string | null;
  dueDate?: string | null;
}
export interface Canonical_TaskUpdateArguments_48509A7A {
  taskId: string;
  mode: 'unconditional_patch';
  patch: {
    title?: string;
    status?: 'todo' | 'in_progress' | 'done' | 'blocked' | 'canceled';
    dueDate?: string;
  };
}
export interface Canonical_TaskUpdateApprovalProposal_1F70E582 {
  proposalId: string;
  command: Canonical_TaskUpdateCommandB73E3Ce0;
  commandSha256: string;
  createdAt: string;
  expiresAt: string;
  requiredApprover: Canonical_IdentityAba0A4E9;
}
export interface Canonical_TaskUpdateCommandB73E3Ce0 {
  contractVersion: '0.2.0';
  commandId: string;
  binding: Canonical_RunBinding_84F2304C;
  action: 'task.update';
  arguments: Canonical_TaskUpdateArguments_48509A7A;
  /**
   * @maxItems 0
   */
  attachments: [];
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
export interface Canonical_TaskUpdateResult_029549A8 {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done' | 'blocked' | 'canceled';
  dueDate: string | null;
  clientId: string | null;
  updatedAt: string;
}
export interface TaskCommandPrepareRequest {
  arguments: Canonical_TaskUpdateRaw_549267Ce;
}
export interface TaskCommandExecuteRequest {
  proposal: Canonical_TaskUpdateApprovalProposal_1F70E582;
}
export interface TaskCommandPrepareResponse {
  status: 'approval_required';
  proposal: Canonical_TaskUpdateApprovalProposal_1F70E582;
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
export interface TaskCommandErrorResponse {
  error: {
    code:
      | 'ACCESS_DENIED'
      | 'APPLICATION_CLOCK'
      | 'APPLICATION_CONFIGURATION'
      | 'CANCELLED'
      | 'COMMAND_APPROVAL_REFUSED'
      | 'COMMAND_AUTHORITY_REFUSED'
      | 'COMMAND_COMMIT_UNCERTAIN'
      | 'COMMAND_OUTCOME_UNKNOWN'
      | 'COMMAND_PREPARATION_REFUSED'
      | 'COMMAND_REFUSED'
      | 'DEADLINE'
      | 'EXECUTION_AUTHORITY_REFUSED'
      | 'INVALID_BODY'
      | 'INVALID_CONTENT_LENGTH'
      | 'INVALID_JSON'
      | 'INVALID_REQUEST'
      | 'INVALID_UTF8'
      | 'LOOKUP_REPLAY'
      | 'LOOKUP_UNAVAILABLE'
      | 'METHOD_NOT_ALLOWED'
      | 'NOT_FOUND'
      | 'REQUEST_FAILED'
      | 'REQUEST_TOO_LARGE'
      | 'RESPONSE_TOO_LARGE'
      | 'SESSION_SCOPE_REFUSED'
      | 'TASK_COMMAND_UNAVAILABLE'
      | 'UNAUTHENTICATED'
      | 'UNAVAILABLE'
      | 'UNSUPPORTED_CONTENT_ENCODING'
      | 'UNSUPPORTED_MEDIA_TYPE';
    outcome:
      'NOT_DISPATCHED' | 'UNKNOWN' | 'RESULT_NOT_RELEASED' | 'STORED_NOT_RELEASED' | 'NOT_STORED' | 'READ_UNAVAILABLE';
  };
}
export interface TaskCommandExpectedBinding {
  tenantId: string;
  actorId: string;
  conversationId: string;
  runId: string;
}
export interface Canonical_TaskUpdateContext_90C41Ed0 {
  binding: Canonical_RunBinding_84F2304C;
}

export type TaskCommandRoute='prepare'|'execute';
export interface TaskCommandRequestMap {prepare:TaskCommandPrepareRequest;execute:TaskCommandExecuteRequest;}
export interface TaskCommandResponseMap {prepare:TaskCommandPrepareResponse;execute:TaskCommandExecuteResponse;}
export interface TaskCommandExpectationMap {prepare:{binding:Readonly<TaskCommandExpectedBinding>;request:TaskCommandPrepareRequest};execute:{binding:Readonly<TaskCommandExpectedBinding>;proposal:TaskUpdateApprovalProposal};}
export type TaskCommandResponse<R extends TaskCommandRoute>=TaskCommandResponseMap[R]|TaskCommandErrorResponse;
export declare class TaskCommandResponseError extends Error {readonly code:string;}
export declare const taskCommandVersion:'0.1.0';
export declare const taskCommandPaths:Readonly<{prepare:'/api/task-commands/prepare';execute:'/api/task-commands/execute'}>;
export declare const taskCommandMetadata:{
  "contractVersion": "0.1.0",
  "schemaId": "urn:meri:task-command-application:0.1.0",
  "routes": {
    "prepare": {
      "method": "POST",
      "path": "/api/task-commands/prepare",
      "response": "json"
    },
    "execute": {
      "method": "POST",
      "path": "/api/task-commands/execute",
      "response": "json"
    }
  },
  "authentication": {
    "scheme": "Bearer",
    "authority": "trusted session resolution and current server approval/command owners",
    "expectedContext": "independently authenticated tenantId, actorId, conversationId and runId"
  },
  "limits": {
    "requestBytes": 16777216,
    "responseBytes": 16777216,
    "jsonNodes": 100000,
    "jsonDepth": 64
  },
  "errorStatuses": {
    "ACCESS_DENIED": 403,
    "APPLICATION_CLOCK": 500,
    "APPLICATION_CONFIGURATION": 500,
    "CANCELLED": 499,
    "COMMAND_APPROVAL_REFUSED": 409,
    "COMMAND_AUTHORITY_REFUSED": 502,
    "COMMAND_COMMIT_UNCERTAIN": 502,
    "COMMAND_OUTCOME_UNKNOWN": 502,
    "COMMAND_PREPARATION_REFUSED": 502,
    "COMMAND_REFUSED": 502,
    "DEADLINE": 408,
    "EXECUTION_AUTHORITY_REFUSED": 403,
    "INVALID_BODY": 400,
    "INVALID_CONTENT_LENGTH": 400,
    "INVALID_JSON": 400,
    "INVALID_REQUEST": 400,
    "INVALID_UTF8": 400,
    "LOOKUP_REPLAY": 409,
    "LOOKUP_UNAVAILABLE": 502,
    "METHOD_NOT_ALLOWED": 405,
    "NOT_FOUND": 404,
    "REQUEST_FAILED": 502,
    "REQUEST_TOO_LARGE": 413,
    "RESPONSE_TOO_LARGE": 413,
    "SESSION_SCOPE_REFUSED": 403,
    "TASK_COMMAND_UNAVAILABLE": 503,
    "UNAUTHENTICATED": 401,
    "UNAVAILABLE": 502,
    "UNSUPPORTED_CONTENT_ENCODING": 415,
    "UNSUPPORTED_MEDIA_TYPE": 415
  },
  "errorOutcomes": [
    "NOT_DISPATCHED",
    "UNKNOWN",
    "RESULT_NOT_RELEASED",
    "STORED_NOT_RELEASED",
    "NOT_STORED",
    "READ_UNAVAILABLE"
  ],
  "semantics": {
    "preparation": "approval_required is an immutable proposal, never approval",
    "execution": "observed requires a succeeded receipt and matching task result; indeterminate is not success",
    "expiry": "caller checks createdAt/expiresAt against a fresh clock before display and execution; server rechecks current authority",
    "resume": "attemptId, workerId and writerFence may change within the same stable tenant/actor/conversation/run binding"
  }
};
export declare function receiveTaskCommandRequest<R extends TaskCommandRoute>(route:R,jsonText:unknown):Promise<TaskCommandRequestMap[R]>;
export declare function receiveTaskCommandResponse<R extends TaskCommandRoute>(route:R,httpStatus:number,jsonText:unknown,expectation:TaskCommandExpectationMap[R]):Promise<TaskCommandResponse<R>>;
