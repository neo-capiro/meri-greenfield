// Trusted-owner composition only. The signer and storage capability are never
// worker configuration, model tools or a replacement for runtime admission.
import { randomUUID } from 'node:crypto';
import { types } from 'node:util';
import { canonicalSha256 } from '../../packages/contracts/validate.mjs';
import { assertFixtureContext, assertFixturePayload, snapshotFixtureData } from
  '../../packages/contracts/qualification-sdk/validate.mjs';
import { encodeNativeEvidenceRecord, nativeEvidenceKinds } from
  '../../packages/contracts/qualification-sdk/native-evidence.mjs';
import { createNativeEvidenceObserver } from
  '../../apps/worker/qualification/probes/native-observations.mjs';
import { createNativeEvidencePublisher } from
  '../../apps/control/qualification-sdk-fixture/service/native-evidence-publisher.mjs';
import { assertNativeEvidenceAdmission, verifyNativeEvidenceRecords } from
  '../../apps/control/qualification-sdk-fixture/service/native-evidence.mjs';

const fail = () => { throw new Error('SDK_NATIVE_OWNER_REFUSED'); };
const same = (left, right) => canonicalSha256(left) === canonicalSha256(right);
const optionKeys = ['producer', 'admission', 'privateKey', 'inspectNamespace',
  'objects', 'authorize', 'phaseDeadlineMs', 'now', 'id'];
const requiredOptions = optionKeys.slice(0, 7);
const providerKeys = ['producer', 'context', 'bundle', 'fixtureFile', 'deadlineMs', 'signal'];

// Mixed configuration contains capabilities/KeyObjects, so it is not a JSON
// DTO. Inspect only own data properties; canonical validators own JSON inputs.
function fields(value, allowed, required = allowed) {
  if (!value || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype ||
      Reflect.ownKeys(value).some(key => !allowed.includes(key))) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (required.some(key => !Object.hasOwn(descriptors, key)) ||
      Object.values(descriptors).some(d => !d.enumerable || !Object.hasOwn(d, 'value'))) fail();
  return Object.fromEntries(Object.entries(descriptors).map(([key, d]) => [key, d.value]));
}

/**
 * Bind one observer to one original phase cutoff and one publication attempt.
 * All capabilities are borrowed. Import/construction starts no work and creates
 * no SDK/process/client/listener. Live UID/PID/key delivery remains a separate
 * qualification: these ports must never be handed to model-controlled code.
 */
export function createNativeEvidenceOwner(options) {
  const { producer: suppliedProducer, admission: suppliedAdmission, privateKey,
    inspectNamespace, objects, authorize, phaseDeadlineMs,
    now = Date.now, id = randomUUID } = fields(options, optionKeys, requiredOptions);
  if (typeof now !== 'function' || typeof id !== 'function' || typeof authorize !== 'function') fail();
  let lastNow = -Infinity;
  function tick() {
    let at; try { at = now(); } catch { fail(); }
    if (!Number.isSafeInteger(at) || at <= 0 || at < lastNow) fail();
    lastNow = at;
    return at;
  }
  const started = tick();
  assertFixtureContext(suppliedProducer, started);
  if (suppliedProducer.phase !== 'interrupt' || !Number.isSafeInteger(phaseDeadlineMs) ||
      phaseDeadlineMs <= started ||
      phaseDeadlineMs > Math.min(suppliedProducer.clock.deadlineMs, started + 60000)) fail();
  const producer = snapshotFixtureData(suppliedProducer);
  const admitted = fields(suppliedAdmission, ['producer', 'observerId', 'keyId', 'publicKey']);
  assertFixtureContext(admitted.producer, started);
  if (!same(admitted.producer, producer)) fail();
  const admission = Object.freeze({ ...admitted, producer: snapshotFixtureData(admitted.producer) });
  assertNativeEvidenceAdmission(admission, started);
  const deadlineMs = Math.min(phaseDeadlineMs, producer.clock.deadlineMs,
    producer.identity.expiresAtMs);
  function current(signal) {
    if (!(signal instanceof AbortSignal) || signal.aborted || tick() >= deadlineMs) fail();
  }
  const publisher = createNativeEvidencePublisher({ objects, producer, admission, id,
    now: tick, authorize: async input => {
      current(input.signal);
      const decision = await authorize(input);
      current(input.signal);
      return decision;
    } });
  const nativeObserver = createNativeEvidenceObserver({ producer,
    observerId: admission.observerId, keyId: admission.keyId, privateKey,
    inspectNamespace, now: tick });
  let attempted = false;

  async function evidenceProvider(input) {
    let timer, onAbort;
    try {
      if (attempted) fail();
      const supplied = fields(input, providerKeys);
      current(supplied.signal);
      assertFixtureContext(supplied.producer, lastNow);
      assertFixtureContext(supplied.context, lastNow);
      assertFixturePayload(supplied.bundle, supplied.fixtureFile, supplied.producer);
      if (!same(supplied.producer, producer) || !same(supplied.context, producer) ||
          supplied.deadlineMs !== deadlineMs) fail();
      const observed = nativeObserver.records;
      if (observed.length !== nativeEvidenceKinds.length) fail();
      const decoded = Object.fromEntries(nativeEvidenceKinds.map((kind, index) => [kind, observed[index]]));
      // Refuse an inconsistent observed capture before copying bulk payload.
      // Publication repeats this canonical verification on its exact bytes.
      verifyNativeEvidenceRecords({ records: decoded, producer, admission,
        bundle: supplied.bundle, fixtureFile: supplied.fixtureFile, nowMs: tick() });
      const capture = snapshotFixtureData({ bundle: supplied.bundle, fixtureFile: supplied.fixtureFile });
      const records = Object.fromEntries(nativeEvidenceKinds.map((kind, index) => {
        if (observed[index].kind !== kind) fail();
        return [kind, encodeNativeEvidenceRecord(observed[index])];
      }));
      current(supplied.signal);
      // Reserve before timers or possibly effectful asynchronous publication.
      // A lost reply or cancellation never permits another owner publication.
      attempted = true;
      const remaining = deadlineMs - tick();
      if (remaining <= 0) fail();
      const controller = new AbortController();
      try {
        const stopped = new Promise((_, reject) => {
          onAbort = () => { controller.abort(); reject(new Error('SDK_NATIVE_OWNER_REFUSED')); };
          supplied.signal.addEventListener('abort', onAbort, { once: true });
          if (supplied.signal.aborted) onAbort();
          timer = setTimeout(onAbort, remaining);
        });
        const pending = Promise.resolve().then(() => {
          current(controller.signal);
          return publisher.publish({ records, ...capture, signal: controller.signal });
        });
        const evidence = await Promise.race([pending, stopped]);
        current(supplied.signal);
        return evidence;
      } finally {
        clearTimeout(timer);
        supplied.signal.removeEventListener('abort', onAbort);
        controller.abort();
      }
    } catch { fail(); }
  }
  return Object.freeze({ nativeObserver, evidenceProvider });
}
