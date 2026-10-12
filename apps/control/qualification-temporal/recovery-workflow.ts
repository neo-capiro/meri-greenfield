// Deterministic source entry; native Temporal execution is not qualified here.
import { proxyActivities, CancellationScope, ActivityCancellationType,
  ActivityFailure, ApplicationFailure } from '@temporalio/workflow';
import type { RecoveryActivities, RecoveryInput, RecoverySummary } from './recovery-types.js';

const { prepareFixtureRecovery } = proxyActivities<RecoveryActivities>({
  activityId: 'prepare-fixture-recovery', startToCloseTimeout: '60 seconds', heartbeatTimeout: '5 seconds',
  cancellationType: ActivityCancellationType.WAIT_CANCELLATION_COMPLETED, retry: { maximumAttempts: 1 },
});
const { cancelFixtureRecovery } = proxyActivities<RecoveryActivities>({
  activityId: 'cancel-fixture-recovery', startToCloseTimeout: '60 seconds',
  retry: { maximumAttempts: 1 },
});

/** An admission receipt only, never a full restored SDK/native checkpoint. */
export async function sdkFixtureRecoveryWorkflow(input: RecoveryInput): Promise<RecoverySummary> {
  try { return await prepareFixtureRecovery(input); }
  catch (error) {
    const cause = error instanceof ActivityFailure ? error.cause : error;
    // Unknown replacement liability must not be converted into guessed cleanup.
    if (cause instanceof ApplicationFailure && cause.type === 'FixtureRecoveryUncertain') throw error;
    await CancellationScope.nonCancellable(() => cancelFixtureRecovery(input));
    throw error;
  }
}
