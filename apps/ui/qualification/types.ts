// Frozen Meri UI-event types for the W02-04 offline UI-transport qualification.
//
// These declarations mirror `packages/contracts/meri.schema.json` ($defs.UIEvent,
// $defs.RunBinding, $defs.Scope, $defs.SourceEvidence) at the frozen contracts
// commit. They add no fields and change no semantics; they are local browser-safe
// types, not a compiled validator. Real browser-safe schema compilation remains
// explicit later work.
//
// Schema-hash binding (owner-corrected, 2026-10-09):
//   The frozen Git blob at commit 7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3 is
//   byte-identical (LF) to this worktree's packages/contracts/meri.schema.json:
//     SHA-256 e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b
//     50043 bytes, LF.
//   The value 0bf7d88dcef83e139eb1788864249d6d5c9396497e192e547c8d87ec6cc2965a
//   previously quoted in the W02-04 brief and the candidate document was the same
//   file with CRLF line endings in a root Windows checkout (52191 bytes); normalizing
//   only CRLF->LF reproduces the frozen blob exactly. The frozen schema is unchanged;
//   the earlier value was retracted.

import type { UIMessage } from 'ai';

export const FROZEN_CONTRACT_COMMIT = '7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3';
export const FROZEN_CONTRACT_VERSION = '0.1.0';
export const FROZEN_SCHEMA_ID = 'urn:meri:contracts:0.1.0';
export const FROZEN_SCHEMA_BLOB_SHA256 =
  'e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b';
export const FROZEN_SCHEMA_BYTES = 50043;
export const RETRACTED_SCHEMA_SHA256 =
  '0bf7d88dcef83e139eb1788864249d6d5c9396497e192e547c8d87ec6cc2965a';

// AI SDK stream chunk names. The data part chunk type is `data-meri-event`,
// while `dataPartSchemas` is keyed by the unprefixed data-type name `meri-event`
// (see MERI_EVENT_SCHEMA_KEY and the guarded transport).
export const MERI_EVENT_DATA_PART = 'data-meri-event';
export const MERI_EVENT_SCHEMA_KEY = 'meri-event';

export type ScopeKind =
  | 'tenant'
  | 'client'
  | 'mailbox'
  | 'memory'
  | 'document'
  | 'private-user'
  | 'public';

export interface Scope {
  tenantId: string;
  kind: ScopeKind;
  resourceId: string;
  policyRevision: string;
}

export interface RunBinding {
  tenantId: string;
  actorId: string;
  conversationId: string;
  runId: string;
  attemptId: string;
  workerId: string;
  writerFence: number;
}

export interface SourceEvidence {
  sourceId: string;
  recordId: string;
  sourceVersionId: string;
  observedAt: string;
  sourceUpdatedAt: string | null;
  citationId: string;
  scopes: Scope[];
  contentSha256: string;
  authorizationDecisionId: string;
}

export type RunStatusState =
  | 'queued'
  | 'starting'
  | 'running'
  | 'waiting-for-approval'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Common envelope fields, identical for every frozen variant. */
export interface UIEventEnvelope<TYPE extends string, DATA> {
  contractVersion: '0.1.0';
  eventId: string;
  binding: RunBinding;
  sequence: number;
  createdAt: string;
  scopes: Scope[];
  type: TYPE;
  data: DATA;
}

export type UIEvent =
  | UIEventEnvelope<'run.status', { state: RunStatusState; reasonCode: string | null }>
  | UIEventEnvelope<'message.delta', { messageId: string; text: string }>
  | UIEventEnvelope<'tool.started', { requestId: string; tool: string }>
  | UIEventEnvelope<'tool.completed', { requestId: string; resultReference: string }>
  | UIEventEnvelope<'source.available', SourceEvidence>
  | UIEventEnvelope<'approval.required', { proposalId: string; commandSha256: string; expiresAt: string }>
  | UIEventEnvelope<'artifact.available', { artifactId: string; versionId: string }>
  | UIEventEnvelope<'checkpoint.verified', { checkpointId: string }>
  | UIEventEnvelope<'usage.recorded', { usageId: string }>
  | UIEventEnvelope<'run.error', { code: string; retryable: boolean; message: string }>;

/** The exact ten frozen variants. */
export const MERI_UI_EVENT_VARIANTS = [
  'run.status',
  'message.delta',
  'tool.started',
  'tool.completed',
  'source.available',
  'approval.required',
  'artifact.available',
  'checkpoint.verified',
  'usage.recorded',
  'run.error',
] as const;

export type MeriEventVariant = (typeof MERI_UI_EVENT_VARIANTS)[number];

/** AI SDK UI message carrying only the custom Meri event data part. */
export type MeriUIMessage = UIMessage<unknown, { 'meri-event': UIEvent }>;

/** Boundary validator injected into the guarded transport. */
export type UIEventValidator = (value: unknown) => UIEvent;
