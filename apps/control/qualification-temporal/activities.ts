// W02-03 inert activity fixtures for the synthetic Meri orchestration workflow.
//
// Preparation only. These functions are never executed and perform NO I/O, no
// database access, no provider/model call and no browser/Office work. They exist
// to give the deterministic workflow (workflow.ts) a real, typed activity
// interface compiled against @temporalio/activity 1.24.0.
//
// A production activity would live in a separately restricted trusted worker
// that receives task-bound short-lived capabilities, never a database/provider/
// admin credential (see docs/qualification/PROXY-TEMPORAL-DECISIONS.md).

import { Context } from '@temporalio/activity';

export interface CheckpointEntry {
  readonly runId: string;
  readonly tenantRef: string;
  readonly stage: string;
  readonly sequence: number;
}

export interface ArtifactRef {
  readonly runId: string;
  readonly objectKey: string;
  readonly contentDigest: string;
}

export interface ApprovalTicket {
  readonly runId: string;
  readonly approvalRef: string;
}

/** Inert: echoes a durable checkpoint receipt; reports activity progress via heartbeat. */
export async function recordCheckpoint(entry: CheckpointEntry): Promise<{ recorded: true; sequence: number }> {
  Context.current().heartbeat({ stage: entry.stage, sequence: entry.sequence });
  return { recorded: true, sequence: entry.sequence };
}

/** Inert: echoed object reference only; no storage write and no object body. */
export async function publishArtifact(ref: ArtifactRef): Promise<{ published: true; objectKey: string }> {
  return { published: true, objectKey: ref.objectKey };
}

/** Inert: returns a fixed decision; a real implementation consults trusted authorization. */
export async function collectApproval(_ticket: ApprovalTicket): Promise<'approved' | 'denied'> {
  return 'approved';
}
