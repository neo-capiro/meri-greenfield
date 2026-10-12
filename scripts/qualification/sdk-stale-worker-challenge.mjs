// Trusted qualification-owner adapter. A's transport stays here, outside B.
// This injected port adds no network endpoint, credential issuer or authority.
import { canonicalSha256 } from '../../packages/contracts/validate.mjs';
import { assertFixtureContext, assertFixtureReplacement, assertFixtureRequest,
  snapshotFixtureData } from
  '../../packages/contracts/qualification-sdk/validate.mjs';
import { encodeFixtureRequest, decodeFixtureResponse } from
  '../../packages/contracts/qualification-sdk/wire.mjs';

const fail = () => { throw new Error('STALE_WORKER_CHALLENGE_REFUSED'); };
const same = (a, b) => canonicalSha256(a) === canonicalSha256(b);

/** Import/construction does no I/O. Runtime must separately qualify A's
 * credential, owner placement and delivery of this narrow port to B. */
export function createStaleWorkerChallenge({ transport, producer: suppliedProducer,
  current: suppliedCurrent, phaseDeadlineMs, now = Date.now } = {}) {
  if (typeof transport !== 'function' || typeof now !== 'function') fail();
  let lastNow = -Infinity;
  const tick = () => {
    let value; try { value = now(); } catch { fail(); }
    if (!Number.isSafeInteger(value) || value < lastNow) fail();
    lastNow = value; return value;
  };
  const at = tick();
  assertFixtureContext(suppliedProducer, at, { current: false });
  assertFixtureContext(suppliedCurrent, at);
  assertFixtureReplacement(suppliedProducer, suppliedCurrent, at,
    suppliedProducer.identity.admittedAtMs);
  const { producer, current } = snapshotFixtureData({ producer: suppliedProducer, current: suppliedCurrent });
  if (producer.phase !== 'interrupt' || current.phase !== 'resume' ||
      !Number.isSafeInteger(phaseDeadlineMs)) fail();
  const expectedDeadline = Math.min(phaseDeadlineMs, producer.clock.deadlineMs,
    current.clock.deadlineMs, producer.identity.expiresAtMs, current.identity.expiresAtMs);
  if (expectedDeadline <= at || expectedDeadline > at + 60000) fail();
  let attempted = false;
  async function verify(input) {
    if (attempted || !input || Object.getPrototypeOf(input) !== Object.prototype ||
        Reflect.ownKeys(input).length !== 4) fail();
    const entries = Object.getOwnPropertyDescriptors(input);
    if (['request', 'current', 'deadlineMs', 'signal'].some(name =>
      !entries[name]?.enumerable || !Object.hasOwn(entries[name], 'value'))) fail();
    const { request, current: expectedCurrent, deadlineMs, signal } = input;
    const started = tick();
    assertFixtureRequest(request, { nowMs: started });
    assertFixtureContext(expectedCurrent, started);
    if (request.operation !== 'authorizeFixturePhase' || !same(request.context, producer) ||
        !same(expectedCurrent, current) || deadlineMs !== expectedDeadline ||
        started >= deadlineMs || !(signal instanceof AbortSignal) || signal.aborted) fail();
    const snapshot = snapshotFixtureData(request);
    const requestBytes = encodeFixtureRequest(snapshot, { nowMs: started });
    // Reserve before any await: a lost response cannot authorize a retry.
    attempted = true;
    const raw = await transport({ operation: 'authorizeFixturePhase', requestBytes, deadlineMs, signal });
    const ended = tick();
    if (signal.aborted || ended >= deadlineMs) fail();
    const { response, status } = decodeFixtureResponse(raw, snapshot, { producer, nowMs: ended });
    if (status !== 'STALE_BINDING_DENIED' || !same(response.currentContext, current)) fail();
    return snapshotFixtureData(response);
  }
  return Object.freeze({ verify });
}
