// W02-03 inert deterministic orchestration workflow fixture.
//
// Preparation only. This module is compiled against @temporalio/workflow
// 1.24.0 and is NEVER run: no Worker is created, no connection is opened, and
// there is no SDK/model/browser/Office call. It declares the deterministic
// constructs the production design depends on:
//   - typed activity calls via proxyActivities
//   - a Signal handler and a Query handler
//   - a durable timer and a condition wait
//   - a cancellation-safe scope
//   - an explicit Continue-as-New boundary
//
// Workflow code must stay deterministic (no wall-clock, randomness, I/O or
// ambient process state). workerDeploymentOptions with a PINNED default
// versioning behavior is validated separately in negative-types.ts and in
// compatibility.test.mjs against the installed WorkerDeploymentOptions union.

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
} from '@temporalio/workflow';
import type * as activities from './activities.js';

/** Fixed, deterministic Continue-as-New boundary: continue every N stages. */
export const CONTINUE_AS_NEW_AFTER_STAGES = 3;

/** Named task queue placeholder; the real value is pinned by trusted config. */
export const MERI_TASK_QUEUE = 'meri-orchestration';

const { recordCheckpoint, publishArtifact, collectApproval } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '1 minute',
    maximumAttempts: 3,
  },
});

export const approvalSignal = defineSignal<[string]>('approval');
export const cancelSignal = defineSignal('cancelRequested');
export const stateQuery = defineQuery<RunState>('state');

export interface RunInput {
  readonly runId: string;
  readonly tenantRef: string;
  readonly objectKey: string;
  /** Continue-as-New chain depth; the caller passes 0 for a fresh run. */
  readonly continuation: number;
}

export interface RunState {
  approvals: string[];
  stage: string;
  sequence: number;
  continuation: number;
}

/**
 * Deterministic orchestration skeleton. Awaiting approval, a durable timer,
 * cancellation handling and the Continue-as-New boundary are all inert here.
 */
export async function meriOrchestrationWorkflow(input: RunInput): Promise<string> {
  const state: RunState = {
    approvals: [],
    stage: 'queued',
    sequence: 0,
    continuation: input.continuation,
  };
  let cancelRequested = false;

  setHandler(approvalSignal, (approver: string) => {
    state.approvals.push(approver);
  });
  setHandler(cancelSignal, () => {
    cancelRequested = true;
  });
  setHandler(stateQuery, () => state);

  state.stage = 'awaiting-approval';
  const decided = await condition(() => state.approvals.length > 0 || cancelRequested, '30 minutes');
  if (cancelRequested || !decided) {
    state.stage = 'cancelled';
    return `workflow ${input.runId} cancelled at sequence ${state.sequence}`;
  }

  // Durable timer before the first checkpoint.
  await sleep('5 seconds');
  state.stage = 'checkpointing';
  state.sequence += 1;
  await recordCheckpoint({
    runId: input.runId,
    tenantRef: input.tenantRef,
    stage: state.stage,
    sequence: state.sequence,
  });

  // Approval collection inside a cancellation-safe scope.
  const decision = await CancellationScope.cancellable(async () =>
    collectApproval({ runId: input.runId, approvalRef: `${input.runId}#${state.sequence}` }),
  );
  if (decision === 'denied') {
    state.stage = 'denied';
    return `workflow ${input.runId} denied`;
  }

  try {
    await publishArtifact({ runId: input.runId, objectKey: input.objectKey, contentDigest: `seq-${state.sequence}` });
  } catch (err) {
    if (isCancellation(err)) {
      state.stage = 'cancelled-during-publish';
      throw err;
    }
    // A real implementation would classify a durable activity failure here.
    if (err instanceof ActivityFailure) {
      state.stage = 'publish-failed';
    }
    throw err;
  }

  // Explicit Continue-as-New boundary keeps histories bounded.
  if (state.sequence >= CONTINUE_AS_NEW_AFTER_STAGES) {
    return await continueAsNew<typeof meriOrchestrationWorkflow>({
      runId: input.runId,
      tenantRef: input.tenantRef,
      objectKey: input.objectKey,
      continuation: state.continuation + 1,
    });
  }

  state.stage = 'completed';
  return `workflow ${input.runId} completed at sequence ${state.sequence}`;
}
