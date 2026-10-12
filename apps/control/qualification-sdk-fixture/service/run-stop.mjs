// Process-local control-owner stop bookkeeping. The canonical registry remains
// the sole durable authority. This is not a run ledger or restart recovery.
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { snapshotFixtureData } from '../../../../packages/contracts/qualification-sdk/validate.mjs';
import { revocationBinding } from '../state/revocation.mjs';
import { CommitUncertain } from '../state/errors.mjs';

const fail = code => { throw new Error(code); };
const MAX_WAIT_MS = 60000;

export function createRunStop({ registry, now = Date.now }) {
  if (!registry || typeof registry.revokeRun !== 'function' || typeof now !== 'function') {
    fail('FIXTURE_CONTROL_CONFIGURATION');
  }
  const records = new Map(), pending = new Set();
  let closing = false, lastNow = -Infinity;
  function clock() {
    const at = now();
    if (!Number.isSafeInteger(at) || at < lastNow) fail('FIXTURE_CONTROL_CLOCK');
    lastNow = at; return at;
  }
  function identify(context, peer) {
    const binding = revocationBinding(context, peer);
    return { key: canonicalSha256(binding), binding };
  }
  function recordFor(context, peer) {
    const { key, binding } = identify(context, peer);
    if (!records.has(key)) records.set(key, { key, binding, stopRequested: false,
      revocation: 'NOT_REQUESTED', publicationUncertain: false, operations: new Map(), stop: null });
    return records.get(key);
  }
  function remember(promise) {
    pending.add(promise);
    promise.finally(() => pending.delete(promise)).catch(() => {});
    return promise;
  }
  function bounded(work, deadlineMs) {
    const remaining = deadlineMs - clock();
    if (remaining <= 0) return Promise.reject(new Error('FIXTURE_CONTROL_UNSETTLED'));
    let timer;
    return Promise.race([work, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('FIXTURE_CONTROL_UNSETTLED')), remaining);
    })]).finally(() => clearTimeout(timer));
  }
  function uncertain(record) {
    return record.publicationUncertain || record.revocation === 'UNCERTAIN';
  }

  function track(handler, input) {
    if (closing) fail('FIXTURE_CONTROL_STOPPED');
    // The presented operation belongs to its authenticated peer; a stale A
    // request must not inherit the resolver's current B context for tracking.
    const record = recordFor(input.request.context, input.peer);
    if (record.stopRequested) fail('FIXTURE_CONTROL_STOPPED');
    const controller = new AbortController(), abort = () => controller.abort();
    input.signal?.addEventListener('abort', abort, { once: true });
    if (input.signal?.aborted) abort();
    const operation = Promise.resolve().then(() => {
      if (closing || record.stopRequested || controller.signal.aborted) fail('FIXTURE_CONTROL_STOPPED');
      return handler({ ...input, signal: controller.signal });
    }).catch(error => {
      if (error instanceof CommitUncertain) record.publicationUncertain = true;
      throw error;
    }).finally(() => {
      input.signal?.removeEventListener('abort', abort);
      record.operations.delete(operation);
      if (!record.stopRequested && !record.publicationUncertain && record.operations.size === 0) {
        records.delete(record.key);
      }
    });
    record.operations.set(operation, controller);
    return remember(operation);
  }

  function ownerInput(input) {
    const snapshot = snapshotFixtureData(input);
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) ||
        Object.keys(snapshot).length !== 2 || !Object.hasOwn(snapshot, 'context') ||
        !Object.hasOwn(snapshot, 'peer')) fail('FIXTURE_CONTROL_CONFIGURATION');
    return snapshot;
  }

  function stopRun(input) {
    const snapshot = ownerInput(input);
    const record = recordFor(snapshot.context, snapshot.peer);
    if (record.stop !== null) return record.stop;
    record.stopRequested = true;
    // Reserve before abort listeners can synchronously reenter this method.
    record.stop = Promise.resolve().then(async () => {
      const at = clock(), deadline = Math.min(record.binding.cleanupDeadlineMs, at + MAX_WAIT_MS);
      if (deadline <= at) { record.revocation = 'FAILED'; fail('FIXTURE_CONTROL_UNSETTLED'); }
      record.revocation = 'PENDING';
      const revocation = remember(Promise.resolve().then(() => {
        if (clock() >= deadline) fail('FIXTURE_CONTROL_UNSETTLED');
        return registry.revokeRun(snapshot);
      }).then(result => {
        if (!['REVOKED', 'ALREADY_REVOKED'].includes(result?.outcome) ||
            canonicalSha256(result.binding) !== canonicalSha256(record.binding)) {
          throw new CommitUncertain('FIXTURE_CONTROL_REVOCATION_UNKNOWN');
        }
        record.revocation = result.outcome;
        return result;
      }).catch(error => {
        record.revocation = error instanceof CommitUncertain ? 'UNCERTAIN' : 'FAILED';
        throw error;
      }));
      const result = await bounded(revocation, deadline);
      await bounded(Promise.allSettled([...record.operations.keys()]), deadline);
      if (record.operations.size) fail('FIXTURE_CONTROL_UNSETTLED');
      if (uncertain(record)) throw new CommitUncertain('FIXTURE_CONTROL_UNCERTAIN');
      return result;
    });
    for (const controller of record.operations.values()) controller.abort();
    // Retain the single attempt even after timeout/uncertainty; never retry it.
    record.stop.catch(() => {});
    return record.stop;
  }

  function runStatus(input) {
    const { context, peer } = ownerInput(input);
    const { key } = identify(context, peer), record = records.get(key);
    return Object.freeze({ stopRequested: record?.stopRequested ?? false,
      revocation: record?.revocation ?? 'NOT_REQUESTED',
      activeOperations: record?.operations.size ?? 0,
      publicationUncertain: record?.publicationUncertain ?? false });
  }
  function closeAdmission() {
    closing = true;
    for (const record of records.values()) for (const controller of record.operations.values()) controller.abort();
  }
  async function settleForClose() {
    const at = clock();
    const cutoffs = [...records.values()].filter(r => r.operations.size || r.revocation === 'PENDING')
      .map(r => r.binding.cleanupDeadlineMs);
    if (pending.size) await bounded(Promise.allSettled([...pending]), Math.min(at + MAX_WAIT_MS, ...cutoffs));
    if (pending.size) fail('FIXTURE_CONTROL_UNSETTLED');
    if ([...records.values()].some(uncertain)) throw new CommitUncertain('FIXTURE_CONTROL_UNCERTAIN');
  }
  return Object.freeze({ track, stopRun, runStatus, closeAdmission, settleForClose,
    isClosing: () => closing,
    activeOperations: () => [...records.values()].reduce((n, r) => n + r.operations.size, 0) });
}
