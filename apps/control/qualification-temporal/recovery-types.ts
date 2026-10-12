/** Private Temporal metadata only; no task credential/context or checkpoint body. */
export interface RecoveryInput { readonly runUuid: string }
export interface RecoverySummary extends RecoveryInput {
  readonly bindingSha256: string;
  readonly reference: { readonly receiptId: string; readonly receiptSha256: string };
  readonly completeRecoveryCheckpoint: false;
  readonly sessionStoreQualified: false;
}
export interface RecoveryActivities {
  prepareFixtureRecovery(input: RecoveryInput): Promise<RecoverySummary>;
  cancelFixtureRecovery(input: RecoveryInput): Promise<{ runUuid: string; outcome: 'REVOKED' | 'ALREADY_REVOKED' }>;
}
