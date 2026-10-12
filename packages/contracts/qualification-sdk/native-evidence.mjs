// Private qualification grammar and exact capture binding. No keys or authority
// are accepted from a record, and valid syntax never establishes runtime truth.
import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';
import canonicalize from 'canonicalize';
import { canonicalSha256 } from '../validate.mjs';
import { validateShape, assertFixtureContext, assertFixturePayload } from './validate.mjs';
export { nativeEvidenceKinds } from './validate.mjs';

export const nativeEvidenceLimit = 64 * 1024;
const fail = () => { throw new Error('NATIVE_EVIDENCE_REFUSED'); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const utf8 = new TextDecoder('utf-8', { fatal: true });

function safeNumbers(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) fail();
  if (value !== null && typeof value === 'object') Object.values(value).forEach(safeNumbers);
}

function canonicalBytes(value) {
  const serialized = canonicalize(value);
  if (typeof serialized !== 'string') fail();
  return Buffer.from(serialized, 'utf8');
}

function recordShape(record, name) {
  validateShape(name, record); // Canonical JSON-only guard precedes traversal.
  safeNumbers(record);
  if (record.producer.phase !== 'interrupt' ||
      record.process.startedAtMs > record.observedAtMs ||
      record.process.startedAtMs < record.producer.identity.admittedAtMs ||
      record.observedAtMs >= record.producer.identity.expiresAtMs) fail();
  assertFixtureContext(record.producer, record.observedAtMs);
  if (record.signature !== undefined) {
    const bytes = Buffer.from(record.signature.value, 'base64');
    if (bytes.length !== 64 || bytes.toString('base64') !== record.signature.value) fail();
  }
  if (canonicalBytes(record).length > nativeEvidenceLimit) fail();
  return record;
}

export function assertNativeEvidenceRecord(record) {
  try { return recordShape(record, 'NativeEvidenceRecord'); } catch { fail(); }
}

export function encodeNativeEvidenceRecord(record) {
  assertNativeEvidenceRecord(record);
  return canonicalBytes(record);
}

/** Decode exact canonical UTF-8; refuse malformed encodings and alternate JSON. */
export function decodeNativeEvidenceRecord(bytes) {
  try {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 ||
        bytes.byteLength > nativeEvidenceLimit) fail();
    const raw = Buffer.from(bytes);
    const record = JSON.parse(utf8.decode(raw));
    assertNativeEvidenceRecord(record);
    if (!canonicalBytes(record).equals(raw)) fail();
    return record;
  } catch { fail(); }
}

/** Canonical full record minus signature. Unsigned input is allowed only here. */
export function nativeEvidenceSigningBytes(record) {
  try {
    recordShape(record, 'NativeEvidenceSigningRecord');
    const { signature: _signature, ...unsigned } = record;
    return canonicalBytes(unsigned);
  } catch { fail(); }
}

/** Bind all submitted transcript bytes and the one synthetic workspace file. */
export function nativeCaptureBinding({ producer, bundle, fixtureFile, nowMs }) {
  try {
    assertFixtureContext(producer, nowMs);
    if (producer.phase !== 'interrupt') fail();
    assertFixturePayload(bundle, fixtureFile, producer);
    safeNumbers(bundle); safeNumbers(fixtureFile);
    const raw = canonicalBytes(bundle);
    const inventory = { format: bundle.format, directories: bundle.directories,
      files: bundle.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
      totalBytes: bundle.totalBytes };
    const capture = { bundleSha256: sha(raw), bundleBytes: raw.length,
      nativeInventorySha256: canonicalSha256(inventory),
      sentinel: { path: fixtureFile.path, bytes: fixtureFile.bytes, sha256: fixtureFile.sha256 } };
    validateShape('NativeCaptureBinding', capture);
    return capture;
  } catch { fail(); }
}
