// Synthetic, wall-clock-valid fixture adapted from the canonical ingress data.
// No value here is an admitted cloud identity or an immutable object readback.
import { canonicalSha256 } from '../../../../../packages/contracts/validate.mjs';
import { fixture, requestFor, wire } from '../../ingress/test/fixture-data.mjs';

export { requestFor, wire };

export function liveFixture() {
  const f = fixture();
  const t0 = Date.now() - 30000;
  for (const context of [f.producer, f.current]) {
    context.clock = { t0Ms: t0, deadlineMs: t0 + 720000,
      cleanupDeadlineMs: t0 + 900000 };
    context.identity.admittedAtMs = t0 + (context.phase === 'resume' ? 15000 : 0);
    context.identity.expiresAtMs = t0 + 720000;
  }
  f.receipt.producer = structuredClone(f.producer);
  f.receipt.workspace.createdAt = new Date(t0 + 9000).toISOString();
  f.receipt.workspaceSha256 = canonicalSha256(f.receipt.workspace);
  f.receipt.commit.committedAtMs = t0 + 11000;
  f.receipt.commit.workspaceReadbackSha256 = f.receipt.workspaceSha256;
  f.reference = { receiptId: f.receipt.receiptId,
    receiptSha256: canonicalSha256(f.receipt) };
  f.readback = { verified: true, verifierId: 'synthetic-test-readback',
    bundleReadback: structuredClone(f.receipt.bundle),
    workspaceReadbackSha256: f.receipt.workspaceSha256 };
  return f;
}
