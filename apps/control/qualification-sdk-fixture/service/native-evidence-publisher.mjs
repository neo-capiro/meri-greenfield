// Trusted qualification observer publication. No observer/key/credential is
// inferred from a submitted record; construction performs no external I/O.
import { randomUUID, createHash } from 'node:crypto';
import { validateShape, assertFixtureContext } from
  '../../../../packages/contracts/qualification-sdk/validate.mjs';
import { decodeNativeEvidenceRecord, nativeEvidenceKinds, nativeEvidenceLimit } from
  '../../../../packages/contracts/qualification-sdk/native-evidence.mjs';
import { verifyNativeEvidenceRecords } from './native-evidence.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const kinds = nativeEvidenceKinds;
const fail = () => { throw new Error('NATIVE_EVIDENCE_PUBLICATION_REFUSED'); };
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

export function createNativeEvidencePublisher({ objects, producer: suppliedProducer,
  admission, authorize, now = Date.now, id = randomUUID } = {}) {
  if (!objects || typeof objects.putEvidence !== 'function' || typeof authorize !== 'function' ||
      typeof now !== 'function' || typeof id !== 'function') fail();
  validateShape('FixtureContext', suppliedProducer);
  const producer = freeze(structuredClone(suppliedProducer));
  // The admission's KeyObject is borrowed immutable owner configuration, not JSON.
  if (!admission || Object.getPrototypeOf(admission) !== Object.prototype ||
      Reflect.ownKeys(admission).length !== 4) fail();
  const admitted = Object.getOwnPropertyDescriptors(admission), trusted = {};
  for (const field of ['producer', 'observerId', 'keyId', 'publicKey']) {
    const d = admitted[field];
    if (!d?.enumerable || !Object.hasOwn(d, 'value')) fail();
    trusted[field] = field === 'producer' ? freeze(structuredClone(validateShape('FixtureContext', d.value))) : d.value;
  }
  Object.freeze(trusted);
  let attempted = false, lastNow = -Infinity;
  function tick() {
    let value; try { value = now(); } catch { fail(); }
    if (!Number.isSafeInteger(value) || value < lastNow) fail();
    lastNow = value; assertFixtureContext(producer, value); return value;
  }
  async function current(signal) {
    tick(); if (signal?.aborted) fail();
    let decision; try { decision = await authorize({ producer, signal }); } catch { fail(); }
    tick(); if (decision !== true || signal?.aborted) fail();
  }
  async function publish({ records, bundle, fixtureFile, signal } = {}) {
    if (attempted || signal?.aborted) fail();
    try {
      // Decode the exact supplied bytes. Arrays, unknown kinds and accessors are
      // refused before any authorization or object-store effect.
      if (!records || Object.getPrototypeOf(records) !== Object.prototype ||
          Reflect.ownKeys(records).length !== kinds.length) fail();
      const descriptors = Object.getOwnPropertyDescriptors(records), decoded = {}, raw = {};
      for (const kind of kinds) {
        const d = descriptors[kind];
        if (!d?.enumerable || !Object.hasOwn(d, 'value') ||
            !(d.value instanceof Uint8Array) || d.value.byteLength < 1 ||
            d.value.byteLength > nativeEvidenceLimit) fail();
        raw[kind] = Buffer.from(d.value);
        decoded[kind] = decodeNativeEvidenceRecord(raw[kind]);
      }
      // Capture is used only by this synchronous verification, never after an
      // await. Do not clone potentially inconsistent bulk input before refusal.
      verifyNativeEvidenceRecords({ records: decoded, producer, admission: trusted,
        bundle, fixtureFile, nowMs: tick() });
      const objectIds = {};
      for (const kind of kinds) {
        let generated; try { generated = id(kind); } catch { fail(); }
        if (typeof generated !== 'string' || !UUID.test(generated)) fail();
        objectIds[kind] = generated;
      }
      if (new Set(Object.values(objectIds)).size !== kinds.length) fail();
      // Reserve this one-shot attempt synchronously before the first await.
      // A concurrent caller cannot cross the authorization barrier with us.
      attempted = true;
      await current(signal);
      // A storage failure may follow an accepted PUT. Keep the entire
      // publication quarantined, including a lost authorization/write reply.
      const references = {};
      for (const kind of kinds) {
        await current(signal);
        const reference = await objects.putEvidence({ producer, kind, objectId: objectIds[kind],
          bytes: raw[kind], signal });
        tick(); if (signal?.aborted) fail();
        if (!reference || Object.getPrototypeOf(reference) !== Object.prototype ||
            Reflect.ownKeys(reference).length !== 4) fail();
        const fields = Object.getOwnPropertyDescriptors(reference);
        if (['objectId', 'versionId', 'sha256', 'bytes'].some(field =>
          !fields[field]?.enumerable || !Object.hasOwn(fields[field], 'value'))) fail();
        if (reference.objectId !== objectIds[kind] || reference.bytes !== raw[kind].length ||
            reference.sha256 !== createHash('sha256').update(raw[kind]).digest('hex') ||
            typeof reference.versionId !== 'string' || reference.versionId === 'null' ||
            reference.versionId.length < 1 || reference.versionId.length > 256) fail();
        references[kind] = { ...reference, scopes: [{ kind: 'tenant',
          tenantId: producer.identity.canonical.tenantId,
          resourceId: producer.identity.canonical.tenantId,
          policyRevision: producer.identity.policyRevision }] };
      }
      validateShape('NativeEvidence', references);
      return freeze(references);
    } catch { fail(); }
  }
  return Object.freeze({ publish });
}
