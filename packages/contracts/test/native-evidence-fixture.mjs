// Synthetic signed DATA shared by contract/control/publication tests only.
// Keys, process IDs, namespace observations and reads here prove no runtime fact.
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import canonicalize from 'canonicalize';
import { nativeCaptureBinding, nativeEvidenceSigningBytes } from '../qualification-sdk/native-evidence.mjs';

const hash = raw => createHash('sha256').update(raw).digest('hex');
export const nativeEvidenceKinds = Object.freeze(['init', 'interrupt', 'exit', 'drain']);
export const syntheticEvidenceBytes = record => Buffer.from(canonicalize(record), 'utf8');

export function syntheticNativeEvidence({ producer, bundle, fixtureFile, nowMs }) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const observer = { observerId: randomUUID(),
    keyId: hash(publicKey.export({ type: 'spki', format: 'der' })) };
  const t0 = producer.identity.admittedAtMs;
  const process = { instanceId: randomUUID(), pid: 42, startedAtMs: t0 + 100 };
  const stream = { bytes: 3, sha256: hash(Buffer.from('abc')),
    endObserved: true, closed: true, error: false };
  const facts = {
    init: { sessionId: producer.namespace.sessionId, sdkVersion: producer.pins.sdkVersion,
      cliVersion: producer.pins.cliVersion, initMessageSha256: hash(Buffer.from('synthetic-init')) },
    interrupt: { activeEventSha256: hash(Buffer.from('synthetic-active')),
      requestedAtMs: t0 + 2000, acknowledgedAtMs: t0 + 2100, receipt: { still_queued: [], cancelled: [] } },
    exit: { exitCode: 0, signal: null, forced: false, exitedAtMs: t0 + 4000,
      namespace: { method: 'linux-proc', observedAtMs: t0 + 4500,
        pidNamespace: 'pid:[4026532849]', observerPid: 1, otherPids: [] } },
    drain: { eventStreamExhausted: true, stdout: structuredClone(stream),
      stderr: { ...stream, overflow: false },
      capture: nativeCaptureBinding({ producer, bundle, fixtureFile, nowMs }) },
  };
  function signed(record) {
    const copy = structuredClone(record);
    delete copy.signature;
    return { ...copy, signature: { algorithm: 'Ed25519',
      value: sign(null, nativeEvidenceSigningBytes(copy), privateKey).toString('base64') } };
  }
  const records = Object.fromEntries(nativeEvidenceKinds.map((kind, sequence) => [kind,
    signed({ evidenceVersion: 'sdk-native-evidence/1', kind, producer: structuredClone(producer),
      observer: structuredClone(observer), process: structuredClone(process), sequence,
      observedAtMs: t0 + [1000, 2200, 4600, 5000][sequence], facts: facts[kind] })]));
  const bytes = Object.fromEntries(nativeEvidenceKinds.map(kind => [kind, syntheticEvidenceBytes(records[kind])]));
  const scopes = [{ tenantId: producer.identity.canonical.tenantId, kind: 'tenant',
    resourceId: producer.identity.canonical.tenantId, policyRevision: producer.identity.policyRevision }];
  const evidence = Object.fromEntries(nativeEvidenceKinds.map(kind => [kind,
    { objectId: randomUUID(), versionId: `synthetic-${kind}-version`,
      bytes: bytes[kind].length, sha256: hash(bytes[kind]), scopes: structuredClone(scopes) }]));
  function replace(kind, record, { resign = true } = {}) {
    records[kind] = resign ? signed(record) : record;
    bytes[kind] = syntheticEvidenceBytes(records[kind]);
    evidence[kind] = { ...evidence[kind], bytes: bytes[kind].length, sha256: hash(bytes[kind]) };
  }
  const reads = [];
  const objects = { readEvidence: async input => {
    reads.push(input);
    return { bytes: Buffer.from(bytes[input.kind]), versionId: evidence[input.kind].versionId };
  } };
  return { records, bytes, evidence, reads, objects, signed, replace,
    admission: { producer, ...observer, publicKey }, privateKey };
}
