// Resume qualification calls a separately admitted trusted owner. This module
// has no A credential/transport and does not establish the owner's provenance.
import { randomUUID } from 'node:crypto';
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { assertFixtureContext, assertFixtureReplacement, assertFixtureRequest,
  assertFixtureResponse, snapshotFixtureData } from
  '../../../../packages/contracts/qualification-sdk/validate.mjs';

const fail = code => { throw new Error(code); };
const same = (a, b) => canonicalSha256(a) === canonicalSha256(b);
function fields(value, expected) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
      Reflect.ownKeys(value).some(key => !expected.includes(key))) fail('RESUME_ADMISSION_COMPOSITION');
  const entries = Object.getOwnPropertyDescriptors(value);
  if (Object.values(entries).some(d => !d.enumerable || !Object.hasOwn(d, 'value'))) fail('RESUME_ADMISSION_COMPOSITION');
  return entries;
}
function matches(context, scenario, phase) {
  const identity = context.identity;
  return context.phase === phase && context.runUuid === scenario.runUuid &&
    context.namespace.sessionId === scenario.sessionId &&
    identity.attempt === (phase === 'interrupt' ? 1 : 2) &&
    identity.fence === (phase === 'interrupt' ? 1 : 2) &&
    context.clock.t0Ms === scenario.t0Ms &&
    context.clock.deadlineMs === scenario.deadlineMs &&
    context.clock.cleanupDeadlineMs === scenario.cleanupDeadlineMs;
}

/** Inert validation/snapshot; the returned one-shot verifier holds only the
 * owner port and public admitted contexts. Runtime placement/IPC is separate. */
export function createResumeAdmissionVerifier({ admission, scenario, now = Date.now } = {}) {
  const entries = fields(admission, ['producer', 'current', 'staleWorkerChallenge', 'requestId']);
  if (!entries.producer || !entries.current || !entries.staleWorkerChallenge || typeof now !== 'function') fail('RESUME_ADMISSION_COMPOSITION');
  const port = entries.staleWorkerChallenge.value;
  const methods = fields(port, ['verify']);
  if (!methods.verify || typeof methods.verify.value !== 'function') fail('RESUME_ADMISSION_COMPOSITION');
  const requestId = entries.requestId ? entries.requestId.value : randomUUID;
  if (typeof requestId !== 'function') fail('RESUME_ADMISSION_COMPOSITION');
  let lastNow = -Infinity;
  const tick = () => {
    let value; try { value = now(); } catch { fail('RESUME_ADMISSION_CLOCK'); }
    if (!Number.isSafeInteger(value) || value < lastNow) fail('RESUME_ADMISSION_CLOCK');
    lastNow = value; return value;
  };
  const at = tick();
  assertFixtureContext(entries.producer.value, at, { current: false });
  assertFixtureContext(entries.current.value, at);
  assertFixtureReplacement(entries.producer.value, entries.current.value, at,
    entries.producer.value.identity.admittedAtMs);
  const { producer, current } = snapshotFixtureData({ producer: entries.producer.value, current: entries.current.value });
  if (!matches(producer, scenario, 'interrupt') || !matches(current, scenario, 'resume')) fail('RESUME_ADMISSION_BINDING');
  const deadlineMs = Math.min(scenario.phaseDeadlineMs, producer.clock.deadlineMs,
    current.clock.deadlineMs, producer.identity.expiresAtMs, current.identity.expiresAtMs);
  if (deadlineMs <= at || deadlineMs > at + 60000) fail('RESUME_ADMISSION_DEADLINE');
  let attempted = false;
  async function verify({ signal } = {}) {
    if (attempted || (signal !== undefined && !(signal instanceof AbortSignal)) ||
        signal?.aborted) fail('RESUME_ADMISSION_REFUSED');
    const started = tick();
    if (started >= deadlineMs) fail('RESUME_ADMISSION_DEADLINE');
    let correlation; try { correlation = requestId(); } catch { fail('RESUME_ADMISSION_REQUEST_ID'); }
    const candidate = { channelVersion: producer.channelVersion,
      profile: producer.profile, operation: 'authorizeFixturePhase',
      requestId: correlation, context: producer };
    // Validate the exact outgoing envelope before allocating owned timers or
    // invoking the owner. It remains one of the existing four operations.
    assertFixtureRequest(candidate, { nowMs: started });
    const request = snapshotFixtureData(candidate);
    if (attempted) fail('RESUME_ADMISSION_REFUSED');
    attempted = true;
    // A Promise executor converts clock failures into rejections; it must not
    // leave a dispatch microtask scheduled after failed timer preparation.
    const remaining = deadlineMs - tick();
    if (remaining <= 0) fail('RESUME_ADMISSION_DEADLINE');
    const controller = new AbortController(); let timer, onAbort;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('RESUME_ADMISSION_DEADLINE')); }, remaining);
      });
      const cancelled = new Promise((_, reject) => {
        onAbort = () => { controller.abort(); reject(new Error('RESUME_ADMISSION_REFUSED')); };
        signal?.addEventListener('abort', onAbort, { once: true });
        if (signal?.aborted) onAbort();
      });
      const pending = Promise.resolve().then(() => {
        if (controller.signal.aborted || tick() >= deadlineMs) fail('RESUME_ADMISSION_DEADLINE');
        return methods.verify.value.call(port, { request, current, deadlineMs, signal: controller.signal });
      });
      const response = await Promise.race([pending, timeout, cancelled]);
      const ended = tick();
      if (ended >= deadlineMs || controller.signal.aborted) fail('RESUME_ADMISSION_DEADLINE');
      if (assertFixtureResponse(request, response, { producer, nowMs: ended }) !== 'STALE_BINDING_DENIED' ||
          !same(response.currentContext, current)) fail('STALE_FENCE_NOT_DENIED');
      return true;
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', onAbort); controller.abort();
    }
  }
  return Object.freeze({ verify });
}
