/** Owned deadline/cancellation and pending-operation tracking, not physical stop. */
import { deny, GatewayDenied } from './operation-result.mjs';

export function createDispatchLifetime({ deadlineMs, now, signal, schedule = setTimeout, unschedule = clearTimeout }) {
  if (typeof now !== 'function' || !Number.isSafeInteger(deadlineMs) ||
      !Number.isSafeInteger(now()) || deadlineMs <= now() || signal?.aborted) deny('DEADLINE');
  const controller = new AbortController();
  const pending = new Set(); let closed = false; let failure;
  let timer;
  const cancel = code => { failure ??= new GatewayDenied(code); controller.abort(failure); };
  const abort = () => cancel('CANCELLED');
  try {
    signal?.addEventListener('abort', abort, { once: true });
    timer = schedule(() => cancel('DEADLINE'), deadlineMs-now());
  } catch {
    signal?.removeEventListener('abort', abort); controller.abort(); deny('GATEWAY_CONFIGURATION');
  }
  function check() {
    if (closed || controller.signal.aborted) throw failure ?? new GatewayDenied('CANCELLED');
    if (now() >= deadlineMs) { cancel('DEADLINE'); throw failure; }
  }
  function limitDeadline(next) {
    if (!Number.isSafeInteger(next)) deny('DEADLINE');
    check();
    if (next < deadlineMs) {
      deadlineMs = next; unschedule(timer);
      if (deadlineMs <= now()) { cancel('DEADLINE'); throw failure; }
      timer = schedule(() => cancel('DEADLINE'), deadlineMs-now());
    }
  }
  async function run(operation) {
    check();
    let rejected;
    const cancellation = new Promise((_, reject) => {
      rejected = () => reject(failure ?? new GatewayDenied('CANCELLED'));
      controller.signal.addEventListener('abort', rejected, { once: true });
    });
    const work = Promise.resolve().then(() => { check(); return operation(controller.signal); });
    pending.add(work);
    work.then(() => pending.delete(work), () => pending.delete(work));
    try { const value = await Promise.race([work, cancellation]); check(); return value; }
    finally { controller.signal.removeEventListener('abort', rejected); }
  }
  function close() {
    if (!closed) {
      closed = true; unschedule(timer); signal?.removeEventListener('abort', abort);
      controller.abort(new GatewayDenied('CANCELLED'));
    }
    return { unsettledOperations: pending.size, physicalStopProven: false };
  }
  return Object.freeze({ run, check, close, limitDeadline, signal: controller.signal,
    pendingOperations: () => pending.size });
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
