/** Shared owned deadline/cancellation; tracks pending work, never proves physical stop. */
export function createOperationLifetime({ deadlineMs, now, signal, schedule = setTimeout, unschedule = clearTimeout, errorFactory }) {
  if (typeof errorFactory !== 'function') throw new TypeError('Operation lifetime error factory required');
  const deny = code => { throw errorFactory(code); };
  if (typeof now !== 'function' || !Number.isSafeInteger(deadlineMs) ||
      !Number.isSafeInteger(now()) || deadlineMs <= now() || signal?.aborted) deny('DEADLINE');
  const controller = new AbortController();
  const pending = new Set(); let closed = false; let failure;
  let timer;
  const cancel = code => { failure ??= errorFactory(code); controller.abort(failure); };
  const abort = () => cancel('CANCELLED');
  try {
    signal?.addEventListener('abort', abort, { once: true });
    timer = schedule(() => cancel('DEADLINE'), deadlineMs-now());
  } catch {
    signal?.removeEventListener('abort', abort); controller.abort(); deny('GATEWAY_CONFIGURATION');
  }
  function check() {
    if (closed || controller.signal.aborted) throw failure ?? errorFactory('CANCELLED');
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
      rejected = () => reject(failure ?? errorFactory('CANCELLED'));
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
      controller.abort(errorFactory('CANCELLED'));
    }
    return { unsettledOperations: pending.size, physicalStopProven: false };
  }
  return Object.freeze({ run, check, close, limitDeadline, signal: controller.signal,
    pendingOperations: () => pending.size });
}

