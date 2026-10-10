// Generated from frozen meri.schema.json by generate.mjs. Do not edit.

export type UIEvent =
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: RunBinding;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Scope, ...Scope[]];
      type: 'run.status';
      data: {
        state:
          'queued' | 'starting' | 'running' | 'waiting-for-approval' | 'paused' | 'completed' | 'failed' | 'cancelled';
        reasonCode: string | null;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: RunBinding;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Scope, ...Scope[]];
      type: 'message.delta';
      data: {
        messageId: string;
        text: string;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: RunBinding;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Scope, ...Scope[]];
      type: 'tool.started';
      data: {
        requestId: string;
        tool: string;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: RunBinding;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Scope, ...Scope[]];
      type: 'tool.completed';
      data: {
        requestId: string;
        resultReference: string;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: RunBinding;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Scope, ...Scope[]];
      type: 'source.available';
      data: SourceEvidence;
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: RunBinding;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Scope, ...Scope[]];
      type: 'approval.required';
      data: {
        proposalId: string;
        commandSha256: string;
        expiresAt: string;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: RunBinding;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Scope, ...Scope[]];
      type: 'artifact.available';
      data: {
        artifactId: string;
        versionId: string;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: RunBinding;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Scope, ...Scope[]];
      type: 'checkpoint.verified';
      data: {
        checkpointId: string;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: RunBinding;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Scope, ...Scope[]];
      type: 'usage.recorded';
      data: {
        usageId: string;
      };
    }
  | {
      contractVersion: '0.1.0';
      eventId: string;
      binding: RunBinding;
      sequence: number;
      createdAt: string;
      /**
       * @minItems 1
       */
      scopes: [Scope, ...Scope[]];
      type: 'run.error';
      data: {
        code: string;
        retryable: boolean;
        message: string;
      };
    };

export interface RunBinding {
  tenantId: string;
  actorId: string;
  conversationId: string;
  runId: string;
  attemptId: string;
  workerId: string;
  writerFence: number;
}
export interface Scope {
  tenantId: string;
  kind: 'tenant' | 'client' | 'mailbox' | 'memory' | 'document' | 'private-user' | 'public';
  resourceId: string;
  policyRevision: string;
}
export interface SourceEvidence {
  sourceId: string;
  recordId: string;
  sourceVersionId: string;
  observedAt: string;
  sourceUpdatedAt: string | null;
  citationId: string;
  /**
   * @minItems 1
   */
  scopes: [Scope, ...Scope[]];
  contentSha256: string;
  authorizationDecisionId: string;
}
