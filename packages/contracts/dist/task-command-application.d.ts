// Generated from canonical schema by installed json-schema-to-ts and TypeScript. No authorization implied.
export type TaskUpdateRaw = { title?: string | null | undefined; status?: string | null | undefined; dueDate?: string | null | undefined; taskId: string; };
export type TaskUpdateArguments = { taskId: string; mode: "unconditional_patch"; patch: { title?: string | undefined; status?: "canceled" | "done" | "blocked" | "todo" | "in_progress" | undefined; dueDate?: string | undefined; }; };
export type TaskUpdateApprovalProposal = { proposalId: string; command: { action: "task.update"; arguments: { taskId: string; mode: "unconditional_patch"; patch: { title?: string | undefined; status?: "canceled" | "done" | "blocked" | "todo" | "in_progress" | undefined; dueDate?: string | undefined; }; }; contractVersion: "0.2.0"; commandId: string; binding: { tenantId: string; actorId: string; conversationId: string; runId: string; attemptId: string; workerId: string; writerFence: number; }; attachments: unknown[]; scopes: { tenantId: string; kind: "client" | "public" | "document" | "memory" | "tenant" | "mailbox" | "private-user"; resourceId: string; policyRevision: string; }[]; idempotencyKey: string; }; commandSha256: string; createdAt: string; expiresAt: string; requiredApprover: { tenantId: string; actorId: string; }; };
export type TaskUpdateResult = { id: string; title: string; status: "canceled" | "done" | "blocked" | "todo" | "in_progress"; dueDate: string | null; clientId: string | null; updatedAt: string; };
export type TaskCommandPrepareRequest = { arguments: { title?: string | null | undefined; status?: string | null | undefined; dueDate?: string | null | undefined; taskId: string; }; };
export type TaskCommandExecuteRequest = { proposal: { proposalId: string; command: { action: "task.update"; arguments: { taskId: string; mode: "unconditional_patch"; patch: { title?: string | undefined; status?: "canceled" | "done" | "blocked" | "todo" | "in_progress" | undefined; dueDate?: string | undefined; }; }; contractVersion: "0.2.0"; commandId: string; binding: { tenantId: string; actorId: string; conversationId: string; runId: string; attemptId: string; workerId: string; writerFence: number; }; attachments: unknown[]; scopes: { tenantId: string; kind: "client" | "public" | "document" | "memory" | "tenant" | "mailbox" | "private-user"; resourceId: string; policyRevision: string; }[]; idempotencyKey: string; }; commandSha256: string; createdAt: string; expiresAt: string; requiredApprover: { tenantId: string; actorId: string; }; }; };
export type TaskCommandPrepareResponse = { status: "approval_required"; proposal: { proposalId: string; command: { action: "task.update"; arguments: { taskId: string; mode: "unconditional_patch"; patch: { title?: string | undefined; status?: "canceled" | "done" | "blocked" | "todo" | "in_progress" | undefined; dueDate?: string | undefined; }; }; contractVersion: "0.2.0"; commandId: string; binding: { tenantId: string; actorId: string; conversationId: string; runId: string; attemptId: string; workerId: string; writerFence: number; }; attachments: unknown[]; scopes: { tenantId: string; kind: "client" | "public" | "document" | "memory" | "tenant" | "mailbox" | "private-user"; resourceId: string; policyRevision: string; }[]; idempotencyKey: string; }; commandSha256: string; createdAt: string; expiresAt: string; requiredApprover: { tenantId: string; actorId: string; }; }; };
export type TaskCommandExecuteResponse = { status: "observed"; outcome: { result: { id: string; title: string; status: "canceled" | "done" | "blocked" | "todo" | "in_progress"; dueDate: string | null; clientId: string | null; updatedAt: string; }; receipt: { outcome: "failed" | "succeeded" | "denied" | "indeterminate"; commandId: string; binding: { tenantId: string; actorId: string; conversationId: string; runId: string; attemptId: string; workerId: string; writerFence: number; }; scopes: { tenantId: string; kind: "client" | "public" | "document" | "memory" | "tenant" | "mailbox" | "private-user"; resourceId: string; policyRevision: string; }[]; idempotencyKey: string; commandSha256: string; receiptId: string; sourceTransactionId: string | null; completedAt: string; authorizationDecisionId: string; }; }; } | { status: "indeterminate"; outcome: null; };
export type TaskCommandErrorResponse = { error: { code: "ACCESS_DENIED" | "APPLICATION_CLOCK" | "APPLICATION_CONFIGURATION" | "CANCELLED" | "COMMAND_APPROVAL_REFUSED" | "COMMAND_AUTHORITY_REFUSED" | "COMMAND_COMMIT_UNCERTAIN" | "COMMAND_OUTCOME_UNKNOWN" | "COMMAND_PREPARATION_REFUSED" | "COMMAND_REFUSED" | "DEADLINE" | "EXECUTION_AUTHORITY_REFUSED" | "INVALID_BODY" | "INVALID_CONTENT_LENGTH" | "INVALID_JSON" | "INVALID_REQUEST" | "INVALID_UTF8" | "LOOKUP_REPLAY" | "LOOKUP_UNAVAILABLE" | "METHOD_NOT_ALLOWED" | "NOT_FOUND" | "REQUEST_FAILED" | "REQUEST_TOO_LARGE" | "RESPONSE_TOO_LARGE" | "SESSION_SCOPE_REFUSED" | "TASK_COMMAND_UNAVAILABLE" | "UNAUTHENTICATED" | "UNAVAILABLE" | "UNSUPPORTED_CONTENT_ENCODING" | "UNSUPPORTED_MEDIA_TYPE"; outcome: "NOT_DISPATCHED" | "UNKNOWN" | "RESULT_NOT_RELEASED" | "STORED_NOT_RELEASED" | "NOT_STORED" | "READ_UNAVAILABLE"; }; };
export type TaskCommandExpectedBinding = { tenantId: string; actorId: string; conversationId: string; runId: string; };
export type TaskUpdateContext = { binding: { tenantId: string; actorId: string; conversationId: string; runId: string; attemptId: string; workerId: string; writerFence: number; }; };
export type TaskUpdateCommand = { action: "task.update"; arguments: { taskId: string; mode: "unconditional_patch"; patch: { title?: string | undefined; status?: "canceled" | "done" | "blocked" | "todo" | "in_progress" | undefined; dueDate?: string | undefined; }; }; contractVersion: "0.2.0"; commandId: string; binding: { tenantId: string; actorId: string; conversationId: string; runId: string; attemptId: string; workerId: string; writerFence: number; }; attachments: unknown[]; scopes: { tenantId: string; kind: "client" | "public" | "document" | "memory" | "tenant" | "mailbox" | "private-user"; resourceId: string; policyRevision: string; }[]; idempotencyKey: string; };
export type RunBinding = { tenantId: string; actorId: string; conversationId: string; runId: string; attemptId: string; workerId: string; writerFence: number; };

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
