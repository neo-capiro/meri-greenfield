// Thin existing-driver callbacks; borrowed transport, no SDK/store/auth loop.
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { assertFixtureContext, fixtureReceiptIdentity, validateShape } from
  '../../../../packages/contracts/qualification-sdk/validate.mjs';
import { encodeFixtureRequest, decodeFixtureResponse } from
  '../../../../packages/contracts/qualification-sdk/wire.mjs';

const fail = code => { throw new Error(code); };
const same = (a, b) => canonicalSha256(a) === canonicalSha256(b);
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function snapshot(name, value) {
  validateShape(name, value); return freeze(structuredClone(value));
}
function driverMatches(value, full) {
  const expected = { runUuid: full.runUuid, sessionId: full.namespace.sessionId,
    attempt: full.identity.attempt, fence: full.identity.fence, operation: full.phase,
    deadlineMs: full.clock.deadlineMs };
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
      Reflect.ownKeys(value).length !== 6) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Object.entries(expected).every(([key, wanted]) => {
    const d = descriptors[key]; return d?.enumerable && Object.hasOwn(d, 'value') && d.value === wanted;
  });
}

/** requestId is trusted correlation injection, never an authority issuer. */
export function createFixtureChannel({ transport, producer: suppliedProducer,
  current: suppliedCurrent, phaseDeadlineMs, requestId, fixtureFile: suppliedFile,
  evidence: suppliedEvidence, reference: suppliedReference, now = Date.now }) {
  if (typeof transport !== 'function' || typeof requestId !== 'function' || typeof now !== 'function') fail('FIXTURE_COMPOSITION');
  const producer = snapshot('FixtureContext', suppliedProducer), current = snapshot('FixtureContext', suppliedCurrent);
  let lastNow = -Infinity;
  const tick = () => {
    let n; try { n = now(); } catch { fail('FIXTURE_CLOCK'); }
    if (!Number.isSafeInteger(n) || n < lastNow) fail('FIXTURE_CLOCK'); lastNow = n; return n;
  };
  const initial = tick();
  assertFixtureContext(producer, initial, { current: false }); assertFixtureContext(current, initial);
  if (producer.phase !== 'interrupt' || !Number.isSafeInteger(phaseDeadlineMs) ||
      phaseDeadlineMs <= initial || phaseDeadlineMs > Math.min(current.clock.deadlineMs, initial + 60000)) fail('FIXTURE_PHASE_CUTOFF');
  let fixtureFile = suppliedFile === undefined ? undefined : snapshot('Sentinel', suppliedFile);
  const evidence = suppliedEvidence === undefined ? undefined : snapshot('NativeEvidence', suppliedEvidence);
  const reference = suppliedReference === undefined ? undefined : snapshot('FixtureReceiptIdentity', suppliedReference);
  let commitAttempted = false;

  function mapped(driver, stale = false) {
    if (driverMatches(driver, current)) return current;
    if (stale && current.phase === 'resume' && driverMatches(driver, producer)) return producer;
    fail('FIXTURE_DRIVER_CONTEXT');
  }
  function expectedReference(value) {
    validateShape('FixtureReceiptIdentity', value);
    if (!reference || !same(value, reference)) fail('FIXTURE_EXPECTED_REFERENCE');
    return reference;
  }
  async function call(operation, context, payload = {}) {
    if (operation === 'commitFixtureCheckpoint' && commitAttempted) fail('FIXTURE_COMMIT_QUARANTINED');
    const started = tick(), deadlineMs = Math.min(phaseDeadlineMs, current.clock.deadlineMs,
      current.identity.expiresAtMs, context.identity.expiresAtMs);
    if (started >= deadlineMs) fail('FIXTURE_CHANNEL_DEADLINE');
    let correlation; try { correlation = requestId(operation); } catch { fail('FIXTURE_REQUEST_ID'); }
    const request = freeze({ channelVersion: 'sdk-fixture/1', profile: 'sdk-interruption-fixture-v1',
      operation, requestId: correlation, context, ...payload });
    const raw = encodeFixtureRequest(request, { nowMs: started });
    const dispatchAt = tick(); if (dispatchAt >= deadlineMs) fail('FIXTURE_CHANNEL_DEADLINE');
    // Quarantine begins immediately before a possibly effectful dispatch. Never retry.
    if (operation === 'commitFixtureCheckpoint') {
      if (commitAttempted) fail('FIXTURE_COMMIT_QUARANTINED');
      commitAttempted = true;
    }
    const controller = new AbortController(), timeoutError = new Error('FIXTURE_CHANNEL_TIMEOUT'); let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(timeoutError); }, deadlineMs - dispatchAt);
      });
      let pending;
      try { pending = Promise.resolve(transport({ operation, requestBytes: raw, deadlineMs, signal: controller.signal })); }
      catch { fail('FIXTURE_CHANNEL_TRANSPORT'); }
      let received;
      try { received = await Promise.race([pending, timeout]); }
      catch (error) {
        if (error === timeoutError) throw timeoutError;
        fail('FIXTURE_CHANNEL_TRANSPORT');
      }
      const ended = tick(); if (ended < started || ended >= deadlineMs) fail('FIXTURE_CHANNEL_DEADLINE');
      const decoded = decodeFixtureResponse(received, request, { producer, nowMs: ended });
      // Parsing/validation work consumes the same original budget.
      const checked = tick(); if (checked < ended || checked >= deadlineMs) fail('FIXTURE_CHANNEL_DEADLINE');
      return decoded;
    } finally { clearTimeout(timer); controller.abort(); }
  }
  const gateway = Object.freeze({ async authorize(driver) {
    const { response, status } = await call('authorizeFixturePhase', mapped(driver, true));
    if (status === 'AUTHORIZED') return true;
    if (status === 'STALE_BINDING_DENIED' && current.phase === 'resume' && same(response.currentContext, current)) return false;
    fail('FIXTURE_AUTHORIZATION_UNKNOWN');
  } });
  const checkpoint = Object.freeze({
    async commit({ context, bundle }) {
      const full = mapped(context);
      if (full.phase !== 'interrupt' || fixtureFile === undefined || evidence === undefined) fail('FIXTURE_COMMIT_INPUTS');
      // Snapshot hostile payload before owned timer/transport allocation.
      const data = snapshot('NativeBundle', bundle);
      const { response, status } = await call('commitFixtureCheckpoint', full, { bundle: data, fixtureFile, evidence });
      if (status !== 'COMMITTED') fail('FIXTURE_COMMIT_UNKNOWN');
      return freeze(fixtureReceiptIdentity(response.receipt));
    },
    async load({ context, reference: wanted }) {
      const full = mapped(context); if (full.phase !== 'resume') fail('FIXTURE_LOAD_PHASE');
      const { response, status } = await call('loadFixtureCheckpoint', full, { reference: expectedReference(wanted) });
      if (status !== 'LOADED') fail('FIXTURE_LOAD_UNKNOWN');
      // Bytes are checked against the externally supplied reference/producer, not authority derived from this reply.
      fixtureFile = snapshot('Sentinel', response.fixtureFile);
      return freeze(structuredClone({ receipt: response.receipt, bundle: response.bundle,
        fixtureFile: response.fixtureFile, reference }));
    },
    async verify({ context, bundle, reference: wanted }) {
      const full = mapped(context); if (full.phase !== 'resume' || fixtureFile === undefined) fail('FIXTURE_VERIFY_INPUTS');
      const data = snapshot('NativeBundle', bundle);
      const { status } = await call('verifyFixtureCheckpoint', full,
        { bundle: data, fixtureFile, reference: expectedReference(wanted) });
      if (status !== 'VERIFIED') fail('FIXTURE_VERIFY_UNKNOWN');
      return true;
    }
  });
  return Object.freeze({ gateway, checkpoint });
}
