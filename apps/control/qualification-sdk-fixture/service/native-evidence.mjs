// Trusted admission and immutable observation verification for the partial SDK
// fixture. Signatures authenticate an admitted observer; they do not qualify G1.
import { KeyObject, createHash, verify as verifySignature } from 'node:crypto';
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { assertFixtureContext, assertFixtureEvidence, validateShape, snapshotFixtureData }
  from '../../../../packages/contracts/qualification-sdk/validate.mjs';
import { assertNativeEvidenceRecord, decodeNativeEvidenceRecord,
  nativeEvidenceSigningBytes, nativeCaptureBinding, nativeEvidenceLimit, nativeEvidenceKinds }
  from '../../../../packages/contracts/qualification-sdk/native-evidence.mjs';

const kinds = nativeEvidenceKinds;
const fail = () => { throw new Error('NATIVE_EVIDENCE_REFUSED'); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => canonicalSha256(a) === canonicalSha256(b);
const emptySha256 = sha(Buffer.alloc(0));

// Shared trusted configuration validation. Call before exposing owner ports;
// record verification rechecks this same canonical admission after I/O.
export function assertNativeEvidenceAdmission(admission, nowMs) {
  if (!admission || Object.getPrototypeOf(admission) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(admission);
  const names = ['producer', 'observerId', 'keyId', 'publicKey'];
  if (Reflect.ownKeys(admission).length !== names.length || names.some(name =>
    !descriptors[name]?.enumerable || !Object.hasOwn(descriptors[name], 'value'))) fail();
  const { producer, observerId, keyId, publicKey } = admission;
  assertFixtureContext(producer, nowMs);
  if (producer.phase !== 'interrupt' || !(publicKey instanceof KeyObject) ||
      publicKey.type !== 'public' || publicKey.asymmetricKeyType !== 'ed25519' ||
      sha(publicKey.export({ type: 'spki', format: 'der' })) !== keyId) fail();
  const descriptor = { observerId, keyId };
  validateShape('NativeObserver', descriptor);
  return { producer, descriptor, publicKey };
}

function lifecycle(records, nowMs) {
  const { init, interrupt, exit, drain } = records;
  const process = init.process;
  const times = [process.startedAtMs, init.observedAtMs,
    interrupt.facts.requestedAtMs, interrupt.facts.acknowledgedAtMs,
    interrupt.observedAtMs, exit.facts.exitedAtMs,
    exit.facts.namespace.observedAtMs, exit.observedAtMs, drain.observedAtMs, nowMs];
  if (times.some((at, index) => !Number.isSafeInteger(at) || at < 1 ||
      (index > 0 && at < times[index - 1])) ||
      exit.facts.namespace.observerPid === process.pid) fail();
  const { exitCode, signal } = exit.facts;
  const intentional = signal === 'SIGTERM' ? [null, 143] : signal === 'SIGINT' ? [null, 130] : [0];
  if (!intentional.includes(exitCode)) fail();
  for (const stream of [drain.facts.stdout, drain.facts.stderr]) {
    if (stream.bytes === 0 && stream.sha256 !== emptySha256) fail();
  }
  const facts = init.facts, producer = init.producer;
  if (facts.sessionId !== producer.namespace.sessionId ||
      facts.sdkVersion !== producer.pins.sdkVersion || facts.cliVersion !== producer.pins.cliVersion) fail();
}

/** Shared by the read inspector and trusted create-only publisher. No I/O. */
export function verifyNativeEvidenceRecords({ records, producer, admission,
  bundle, fixtureFile, nowMs } = {}) {
  try {
    validateShape('NativeEvidenceRecordSet', records);
    assertFixtureContext(producer, nowMs);
    const trusted = assertNativeEvidenceAdmission(admission, nowMs);
    if (!same(producer, trusted.producer)) fail();
    let process;
    for (const [sequence, kind] of kinds.entries()) {
      const record = assertNativeEvidenceRecord(records[kind]);
      if (record.kind !== kind || record.sequence !== sequence ||
          !same(record.producer, producer) || !same(record.observer, trusted.descriptor) ||
          record.observedAtMs > nowMs || (process && !same(record.process, process))) fail();
      process = record.process;
      if (!verifySignature(null, nativeEvidenceSigningBytes(record), trusted.publicKey,
        Buffer.from(record.signature.value, 'base64'))) fail();
    }
    lifecycle(records, nowMs);
    if (!same(records.drain.facts.capture,
      nativeCaptureBinding({ producer, bundle, fixtureFile, nowMs }))) fail();
    return true;
  } catch { fail(); }
}

/** Read all four producer-scoped exact versions before proving the capture. */
export function createNativeEvidenceInspector({ objects, admission, now = Date.now } = {}) {
  try {
    if (!objects || typeof objects.readEvidence !== 'function' || typeof now !== 'function') fail();
    const initially = now();
    assertNativeEvidenceAdmission(admission, initially);
    // Owner admission is snapshotted, never consulted from the payload.
    const trustedAdmission = Object.freeze({ producer: snapshotFixtureData(admission.producer),
      observerId: admission.observerId, keyId: admission.keyId, publicKey: admission.publicKey });
    let lastClock = initially;
    const clock = () => {
      const at = now();
      if (!Number.isSafeInteger(at) || at < lastClock) fail();
      lastClock = at;
      return at;
    };
    async function verify({ producer, evidence, bundle, fixtureFile, signal } = {}) {
      try {
        const at = clock();
        assertFixtureContext(producer, at);
        assertFixtureEvidence(evidence, producer);
        if (!same(producer, trustedAdmission.producer) || signal?.aborted) fail();
        nativeCaptureBinding({ producer, bundle, fixtureFile, nowMs: at });
        ({ producer, evidence, bundle, fixtureFile } = snapshotFixtureData({
          producer, evidence, bundle, fixtureFile }));
        const records = {};
        for (const kind of kinds) {
          const reference = evidence[kind];
          if (reference.bytes > nativeEvidenceLimit || reference.versionId === 'null') fail();
          const read = await objects.readEvidence({ producer, kind, reference, signal });
          if (signal?.aborted || !read || Object.getPrototypeOf(read) !== Object.prototype) fail();
          const descriptors = Object.getOwnPropertyDescriptors(read);
          if (Reflect.ownKeys(read).length !== 2 || ['bytes', 'versionId'].some(name =>
            !descriptors[name]?.enumerable || !Object.hasOwn(descriptors[name], 'value'))) fail();
          const raw = descriptors.bytes.value, versionId = descriptors.versionId.value;
          if (!Buffer.isBuffer(raw) || versionId !== reference.versionId ||
              raw.length !== reference.bytes || sha(raw) !== reference.sha256) fail();
          records[kind] = decodeNativeEvidenceRecord(raw);
        }
        if (signal?.aborted) fail();
        return verifyNativeEvidenceRecords({ records, producer, admission: trustedAdmission,
          bundle, fixtureFile, nowMs: clock() });
      } catch { fail(); }
    }
    return Object.freeze({ verify });
  } catch { fail(); }
}
