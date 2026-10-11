// Synthetic fixture DATA for the ingress transport tests.
//
// These values are literal test scaffolding: they are not admitted identities,
// not an allocated runtime clock and not durable-state evidence. They exist only
// so the ingress tests can feed the canonical private wire decoder and the
// canonical response contract real, schema-valid inputs. Builders are local to
// this test directory; the ingress source never imports them.
import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';
import { canonicalSha256 } from '../../../../../packages/contracts/validate.mjs';
import { publicSchemaSha256 } from '../../../../../packages/contracts/qualification-sdk/validate.mjs';

/** Synthetic protocol clock base: T0, with the original deadline at T0 + 720000. */
export const T0 = 2000000;
/** Reading used as "now" inside the synthetic window; the test clock advances from here. */
export const NOW = T0 + 20000;
export const PROFILE = Object.freeze({ channelVersion: 'sdk-fixture/1', profile: 'sdk-interruption-fixture-v1' });
const PARTIAL = Object.freeze({ completeRecoveryCheckpoint: false, sessionStoreQualified: false });

const uuid = n => `00000000-0000-4000-9000-${n.toString(16).padStart(12, '0')}`;
const sha = raw => createHash('sha256').update(raw).digest('hex');
const copy = value => structuredClone(value);
const policy = 'd'.repeat(64);

function scope() {
  return { tenantId: 'synthetic', kind: 'tenant', resourceId: 'synthetic', policyRevision: policy };
}
function objectReference(n, bytes = 9, sha256 = 'e'.repeat(64)) {
  return { objectId: uuid(n), versionId: `immutable-${n}`, bytes, sha256, scopes: [scope()] };
}

/** Producer (original interrupt attempt) or current replacement (resumed attempt). */
export function context(phase = 'interrupt') {
  const resumed = phase === 'resume';
  return { ...PROFILE, runUuid: uuid(1), phase,
    namespace: { sessionId: uuid(2), cwd: '/workspace/conversation', projectKey: '-workspace-conversation' },
    identity: { mappingId: uuid(resumed ? 112 : 111), grantId: uuid(resumed ? 122 : 121),
      admittedAtMs: T0 + (resumed ? 15000 : 0), expiresAtMs: T0 + 720000,
      taskArn: `arn:aws:ecs:us-east-1:967807252336:task/qualification/${(resumed ? '2' : '1').repeat(32)}`,
      attempt: resumed ? 2 : 1, fence: resumed ? 2 : 1, policyRevision: policy,
      canonical: { tenantId: 'synthetic', actorId: 'actor', conversationId: uuid(3), runId: uuid(4),
        attemptId: uuid(resumed ? 132 : 131), workerId: uuid(resumed ? 142 : 141),
        writerFence: resumed ? 2 : 1 } },
    clock: { t0Ms: T0, deadlineMs: T0 + 720000, cleanupDeadlineMs: T0 + 900000 },
    pins: { sourceCommit: 'a'.repeat(40), imageDigest: `sha256:${'b'.repeat(64)}`, sdkVersion: '0.3.295',
      cliVersion: '2.1.295', contractsVersion: '0.1.0', contractsSchemaSha256: publicSchemaSha256,
      skillsManifestSha256: 'c'.repeat(64) } };
}

function file(path, raw) {
  return { path, bytes: raw.length, sha256: sha(raw), base64: raw.toString('base64') };
}

/** A complete, canonically valid fixture set for all four fixed operations. */
export function fixture() {
  const producer = context(), current = context('resume');
  const bundle = { format: 'meri-native-session-files-v1', sdk: '0.3.295', cli: '2.1.295',
    binding: copy(producer.namespace), directories: [uuid(2), `${uuid(2)}/subagents`],
    files: [file(`${uuid(2)}.jsonl`, Buffer.from('synthetic native transcript\n')),
      file(`${uuid(2)}/subagents/agent-b.jsonl`, Buffer.from('synthetic child transcript\n'))],
    totalBytes: 0 };
  bundle.totalBytes = bundle.files.reduce((total, row) => total + row.bytes, 0);
  const sentinel = file('qualification/continuity.txt', Buffer.from('SYNTHETIC-INGRESS-CONTINUITY\n'));
  const evidence = { init: objectReference(161), interrupt: objectReference(162),
    exit: objectReference(163), drain: objectReference(164) };
  const workspace = { contractVersion: '0.1.0', manifestId: uuid(151),
    binding: copy(producer.identity.canonical), logicalCwd: '/workspace/conversation',
    entries: [{ path: sentinel.path, kind: 'file', executable: false,
      object: objectReference(152, sentinel.bytes, sentinel.sha256) }],
    scopes: [scope()], createdAt: new Date(T0 + 10000).toISOString() };
  const bundleReference = objectReference(153, Buffer.byteLength(canonicalize(bundle)), canonicalSha256(bundle));
  const receipt = { ...PROFILE, ...PARTIAL, receiptId: uuid(154), producer,
    coverage: { native: 'declared-transcript-tree', workspace: 'one-synthetic-sentinel' },
    bundle: bundleReference,
    nativeInventory: { format: bundle.format, directories: copy(bundle.directories),
      files: bundle.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
      totalBytes: bundle.totalBytes },
    workspace, workspaceSha256: canonicalSha256(workspace), evidence,
    commit: { commitId: uuid(155), publisherId: 'synthetic-trusted-broker', committedAtMs: T0 + 11000,
      publication: 'CURRENT_FENCE_COMMITTED', publicationFence: 1, bundleReadback: copy(bundleReference),
      workspaceReadbackSha256: canonicalSha256(workspace) } };
  return { producer, current, receipt, bundle, sentinel, evidence,
    reference: { receiptId: receipt.receiptId, receiptSha256: canonicalSha256(receipt) } };
}

/** Canonical request DATA for one operation, optionally mutated for a negative case. */
export function requestFor(f, operation, mutate) {
  const upload = operation === 'commitFixtureCheckpoint';
  const request = { ...PROFILE, operation, requestId: uuid(170),
    context: copy(upload || operation === 'authorizeFixturePhase' ? f.producer : f.current),
    ...(upload ? { bundle: copy(f.bundle), fixtureFile: copy(f.sentinel), evidence: copy(f.evidence) } : {}),
    ...(operation === 'loadFixtureCheckpoint' || operation === 'verifyFixtureCheckpoint'
      ? { reference: copy(f.reference) } : {}),
    ...(operation === 'verifyFixtureCheckpoint'
      ? { bundle: copy(f.bundle), fixtureFile: copy(f.sentinel) } : {}) };
  if (mutate) mutate(request);
  return request;
}

/** The canonical success response a trusted handler must produce. */
export function responseFor(f, request) {
  const status = { authorizeFixturePhase: 'AUTHORIZED', commitFixtureCheckpoint: 'COMMITTED',
    loadFixtureCheckpoint: 'LOADED', verifyFixtureCheckpoint: 'VERIFIED' }[request.operation];
  const response = { ...PROFILE, operation: request.operation, requestId: request.requestId,
    context: copy(request.context),
    ...(request.operation === 'authorizeFixturePhase'
      ? { status, decisionId: uuid(171), checkedAtMs: NOW }
      : { ...PARTIAL, status, receipt: copy(f.receipt) }),
    ...(request.operation === 'loadFixtureCheckpoint'
      ? { bundle: copy(f.bundle), fixtureFile: copy(f.sentinel) } : {}) };
  return response;
}

/** Exact canonical UTF-8 bytes for a request or response DATA object. */
export function wire(value) {
  return Buffer.from(canonicalize(value), 'utf8');
}
