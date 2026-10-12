/** Owned deadline/cancellation and pending-operation tracking, not physical stop. */
import { deny, GatewayDenied } from './operation-result.mjs';
import { createOperationLifetime } from '../../../packages/runtime/operation-lifetime.mjs';

export function createDispatchLifetime(options) {
  return createOperationLifetime({...options, errorFactory: code => new GatewayDenied(code)});
}

export async function markBudgetUncertain(budget, reservationId, cleanupMs) {
  // An uncertainty write is bounded separately; failure never releases a lease.
  let timer;
  try {
    await Promise.race([Promise.resolve().then(() => budget.markUncertain(reservationId)),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new GatewayDenied('BUDGET_UNCERTAIN')), cleanupMs); })]);
  } catch { deny('BUDGET_UNCERTAIN'); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
