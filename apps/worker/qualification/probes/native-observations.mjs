// A trusted-owner-injected observer. Signing authenticates its observations;
// neither signatures nor this source fixture admit a runtime or authorize tools.
import { KeyObject, createHash, createPublicKey, sign } from 'node:crypto';
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { assertFixtureContext, validateShape } from '../../../../packages/contracts/qualification-sdk/validate.mjs';
import { assertNativeEvidenceRecord, nativeEvidenceSigningBytes, nativeCaptureBinding, nativeEvidenceKinds } from
  '../../../../packages/contracts/qualification-sdk/native-evidence.mjs';
import { ACTIVE_MARKER } from './sdk-interruption-options.mjs';

const fail = code => { throw new Error(code); };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function processData(value) {
  try { validateShape('NativeObservedProcess', value); }
  catch { fail('NATIVE_PROCESS_REQUIRED'); }
  return freeze(structuredClone(value));
}

/** inspectNamespace is a separately trusted supervisor capability, never a
 * model-provided boolean or an unchanged workspace hash. No external I/O occurs
 * at construction. There is no default signer, key lookup or namespace probe. */
export function createNativeEvidenceObserver({ producer: suppliedProducer, observerId,
  keyId, privateKey, now = Date.now, inspectNamespace }) {
  if (!(privateKey instanceof KeyObject) || privateKey.type !== 'private' ||
      privateKey.asymmetricKeyType !== 'ed25519' || typeof now !== 'function' ||
      typeof inspectNamespace !== 'function' || !uuid.test(observerId)) fail('NATIVE_OBSERVER_COMPOSITION');
  const actualKeyId = createHash('sha256').update(createPublicKey(privateKey).export({
    format: 'der', type: 'spki' })).digest('hex');
  if (keyId !== actualKeyId) fail('NATIVE_OBSERVER_KEY_BINDING');
  let lastNow = 0;
  const tick = () => {
    let value; try { value = now(); } catch { fail('NATIVE_OBSERVER_CLOCK'); }
    if (!Number.isSafeInteger(value) || value <= 0 || value < lastNow) fail('NATIVE_OBSERVER_CLOCK');
    lastNow = value; return value;
  };
  const initial = tick();
  assertFixtureContext(suppliedProducer, initial);
  if (suppliedProducer.phase !== 'interrupt') fail('NATIVE_OBSERVER_PHASE');
  const producer = freeze(structuredClone(suppliedProducer));
  const records = [];
  let process, busy = false, refused = false;
  function guarded(operation) {
    return (...args) => {
      if (refused) fail('NATIVE_OBSERVER_REFUSED');
      let result;
      try { result = operation(...args); }
      catch (error) { refused = true; throw error; }
      if (result && typeof result.then === 'function') return result.catch(error => {
        refused = true; throw error;
      });
      return result;
    };
  }
  const expected = kind => {
    if (busy || !process || nativeEvidenceKinds[records.length] !== kind) fail('NATIVE_OBSERVATION_ORDER');
  };
  function add(kind, facts, observedAtMs = tick()) {
    if (refused) fail('NATIVE_OBSERVER_REFUSED');
    const unsigned = { evidenceVersion: 'sdk-native-evidence/1', kind, producer,
      observer: { observerId, keyId }, process, sequence: records.length, observedAtMs, facts };
    const value = sign(null, nativeEvidenceSigningBytes(unsigned), privateKey).toString('base64');
    const record = { ...unsigned, signature: { algorithm: 'Ed25519', value } };
    assertNativeEvidenceRecord(record);
    records.push(freeze(record));
  }
  function sameProcess(value) {
    if (canonicalSha256(processData(value)) !== canonicalSha256(process)) fail('NATIVE_FOREIGN_PROCESS');
  }
  return Object.freeze({
    started: guarded(value => {
      if (process || records.length || busy) fail('NATIVE_OBSERVATION_ORDER');
      process = processData(value);
      if (process.startedAtMs < producer.identity.admittedAtMs || process.startedAtMs > tick()) fail('NATIVE_PROCESS_CLOCK');
    }),
    initialized: guarded(message => {
      expected('init');
      if (message?.type !== 'system' || message.subtype !== 'init' ||
          message.session_id !== producer.namespace.sessionId) fail('NATIVE_INIT_REQUIRED');
      add('init', { sessionId: message.session_id, sdkVersion: producer.pins.sdkVersion,
        cliVersion: producer.pins.cliVersion, initMessageSha256: canonicalSha256(message) });
    }),
    interrupted: guarded(({ activeEvent, requestedAtMs, acknowledgedAtMs, receipt }) => {
      expected('interrupt');
      const observedAtMs = tick();
      if (activeEvent?.type !== 'stream_event' || activeEvent.session_id !== producer.namespace.sessionId ||
          activeEvent.event?.type !== 'content_block_delta' || activeEvent.event.delta?.type !== 'text_delta' ||
          activeEvent.event.delta.text !== ACTIVE_MARKER) fail('NATIVE_ACTIVE_EVENT_REQUIRED');
      if (!Number.isSafeInteger(requestedAtMs) || !Number.isSafeInteger(acknowledgedAtMs) ||
          requestedAtMs < records[0].observedAtMs || acknowledgedAtMs < requestedAtMs ||
          acknowledgedAtMs > observedAtMs) fail('NATIVE_INTERRUPT_CLOCK');
      add('interrupt', { activeEventSha256: canonicalSha256(activeEvent), requestedAtMs,
        acknowledgedAtMs, receipt: structuredClone(receipt) }, observedAtMs);
    }),
    exited: guarded(async ({ process: observedProcess, exitCode, signal, forced, exitedAtMs }) => {
      expected('exit'); sameProcess(observedProcess);
      if (!Number.isSafeInteger(exitedAtMs) || exitedAtMs < records[1].observedAtMs) fail('NATIVE_EXIT_CLOCK');
      if (forced !== false || (exitCode === null && signal === null) ||
          (signal === null && exitCode !== 0) ||
          (signal !== null && !['SIGTERM', 'SIGINT'].includes(signal)) ||
          (signal !== null && exitCode !== null && exitCode !== (signal === 'SIGTERM' ? 143 : 130))) fail('NATIVE_EXIT_REQUIRED');
      busy = true;
      let namespace;
      try { namespace = await inspectNamespace({ process, exitedAtMs }); }
      finally { busy = false; }
      // The canonical contract rejects missing observations, surviving PIDs,
      // booleans and an invalid namespace; no fallback synthesizes quiescence.
      const observedAtMs = tick();
      if (!namespace || namespace.observedAtMs < exitedAtMs ||
          namespace.observedAtMs > observedAtMs) fail('NATIVE_NAMESPACE_CLOCK');
      add('exit', { exitCode, signal, forced, exitedAtMs, namespace }, observedAtMs);
    }),
    drained: guarded(({ process: observedProcess, eventStreamExhausted, stdout, stderr, bundle, fixtureFile }) => {
      expected('drain'); sameProcess(observedProcess);
      const observedAtMs = tick();
      const capture = nativeCaptureBinding({ producer, bundle, fixtureFile, nowMs: observedAtMs });
      add('drain', { eventStreamExhausted, stdout: structuredClone(stdout),
        stderr: structuredClone(stderr), capture }, observedAtMs);
    }),
    get records() { return Object.freeze([...records]); }
  });
}
