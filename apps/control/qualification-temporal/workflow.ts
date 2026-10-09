// W02-03 inert deterministic orchestration workflow fixture.
//
// Preparation only. This module is compiled against @temporalio/workflow
// 1.24.0 and is NEVER run: no Worker is created, no connection is opened, and
// there is no SDK/model/browser/Office call. Nothing here executes at test time
// except the pure, Temporal-free `planContinuation` helper (exported for an
// isolated unit test).
//
// It declares the deterministic constructs the production design depends on:
//   - typed activity calls via proxyActivities
//   - a note Signal and a cancel Signal, plus a Query handler
//   - a finite three-stage batch with a checkpoint and increment per stage
//   - a durable timer and a condition wait
//   - cancellation observed at every stage boundary
//   - an explicit, bounded Continue-as-New boundary
//
// Workflow code must stay deterministic (no wall-clock, randomness, I/O or
// ambient process state).

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  sleep,
  condition,
  continueAsNew,
  CancellationScope,
  isCancellation,
  ActivityFailure,
  ApplicationFailure,
} from '@temporalio/workflow';
import type * as activities from './activities.js';

/** Finite batch size: three checkpoints per run. */
export const STAGES = 3;

/** Named task queue placeholder; the real value is pinned by trusted config. */
export const MERI_TASK_QUEUE = 'meri-orchestration';

/** Only these continuation depths are safe: 0 = fresh run, 1 = continued run. */
export const ALLOWED_CONTINUATIONS: readonly number[] = Object.freeze([0, 1]);

export interface ContinuationPlan {
  readonly ok: boolean;
  readonly action: 'continue-as-new' | 'complete';
  readonly nextContinuation: number;
  readonly reason: string | null;
}

/**
 * Pure, Temporal-free continuation policy.
 *
 * continuation 0 (fresh)     -> run the batch, then Continue-as-New once (depth 1)
 * continuation 1 (continued) -> run the batch, then complete
 * any other / negative / non-integer / unsafe value -> rejected
 */
export function planContinuation(continuation: number): ContinuationPlan {
  if (!Number.isSafeInteger(continuation) || continuation < 0 || continuation > 1) {
    return { ok: false, action: 'complete', nextContinuation: continuation, reason: 'continuation must be exactly 0 (fresh) or 1 (continued)' };
  }
  if (continuation === 0) return { ok: true, action: 'continue-as-new', nextContinuation: 1, reason: null };
  return { ok: true, action: 'complete', nextContinuation: 1, reason: null };
}

const { recordCheckpoint, publishArtifact, collectApproval } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '1 minute',
    maximumAttempts: 3,
  },
});

// A note signal records an observation only. It does NOT grant approval or
// external-write authority; approval authority comes from the trusted activity.
export const noteSignal = defineSignal<[string]>('approvalNote');
export const cancelSignal = defineSignal('cancelRequested');
export const stateQuery = defineQuery<RunState>('state');

export interface RunInput {
  readonly runId: string;
  readonly tenantRef: string;
  readonly objectKey: string;
  /** Bounded continuation depth: 0 = fresh, 1 = continued. */
  readonly continuation: number;
}

export interface RunState {
  notes: string[];
  stage: string;
  checkpoints: number;
  continuation: number;
  cancelled: boolean;
}

/**
 * Deterministic orchestration skeleton. The three-stage batch, cancellation
 * handling and the Continue-as-New boundary are all inert here.
 */
export async function meriOrchestrationWorkflow(input: RunInput): Promise<string> {
  const plan = planContinuation(input.continuation);
  if (!plan.ok) {
    throw ApplicationFailure.create({ message: `unsafe continuation ${input.continuation}: ${plan.reason}`, type: 'UnsafeContinuation', nonRetryable: true });
  }

  const state: RunState = {
    notes: [],
    stage: 'queued',
    checkpoints: 0,
    continuation: input.continuation,
    cancelled: false,
  };
  let cancelRequested = false;

  setHandler(noteSignal, (note: string) => {
    // Recorded as an observation only; never treated as approval.
    state.notes.push(note);
  });
  setHandler(cancelSignal, () => {
    cancelRequested = true;
  });
  setHandler(stateQuery, () => state);

  state.stage = 'awaiting-cancellation-window';
  // Cancellation is observed even after this first condition returns.
  await condition(() => cancelRequested, '30 minutes');
  if (cancelRequested) {
    state.cancelled = true;
    state.stage = 'cancelled-before-batch';
    return `workflow ${input.runId} cancelled before batch`;
  }

  // Authoritative approval comes from the trusted activity, never from a signal.
  const decision = await CancellationScope.cancellable(async () =>
    collectApproval({ runId: input.runId, approvalRef: `${input.runId}#${input.continuation}` }),
  );
  if (decision !== 'approved') {
    state.stage = 'denied';
    return `workflow ${input.runId} denied`;
  }

  // Finite three-stage batch; cancellation is re-checked at every boundary.
  for (let stage = 1; stage <= STAGES; stage += 1) {
    if (cancelRequested) {
      state.cancelled = true;
      state.stage = `cancelled-stage-${stage}`;
      return `workflow ${input.runId} cancelled at stage ${stage}`;
    }
    await sleep('5 seconds');
    await CancellationScope.cancellable(async () => {
      await recordCheckpoint({ runId: input.runId, tenantRef: input.tenantRef, stage: `stage-${stage}`, sequence: stage });
    });
    state.checkpoints += 1;
    state.stage = `stage-${stage}`;
  }

  // External write happens only after the full batch and an authoritative approval.
  try {
    await publishArtifact({ runId: input.runId, objectKey: input.objectKey, contentDigest: `batch-${input.continuation}` });
  } catch (err) {
    if (isCancellation(err)) {
      state.stage = 'cancelled-during-publish';
      throw err;
    }
    if (err instanceof ActivityFailure) {
      state.stage = 'publish-failed';
    }
    throw err;
  }

  // Explicit bounded Continue-as-New boundary with the next continuation passed.
  if (plan.action === 'continue-as-new') {
    return await continueAsNew<typeof meriOrchestrationWorkflow>({
      runId: input.runId,
      tenantRef: input.tenantRef,
      objectKey: input.objectKey,
      continuation: plan.nextContinuation,
    });
  }

  state.stage = 'completed';
  return `workflow ${input.runId} completed continuation ${input.continuation} after ${state.checkpoints} checkpoints`;
}
