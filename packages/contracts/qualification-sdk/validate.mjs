// Private qualification protocol: shape/integrity checks never establish authority.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import canonicalize from 'canonicalize';
import { canonicalSha256, assertWorkspacePaths } from '../validate.mjs';

const publicRaw = readFileSync(new URL('../meri.schema.json', import.meta.url));
export const publicSchemaSha256 = createHash('sha256').update(publicRaw).digest('hex');
const schema = JSON.parse(readFileSync(new URL('./fixture.schema.json', import.meta.url)));
const nativeEvidenceSchema = JSON.parse(readFileSync(new URL('./native-evidence.schema.json', import.meta.url)));
export const nativeEvidenceKinds = Object.freeze([...nativeEvidenceSchema.$defs.NativeEvidenceSigningRecord.properties.kind.enum]);
const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv); ajv.addSchema(JSON.parse(publicRaw)); ajv.addSchema(schema); ajv.addSchema(nativeEvidenceSchema);
const validators = new Map([schema, nativeEvidenceSchema].flatMap(owner =>
  Object.keys(owner.$defs).map(name => [name, ajv.compile({ $ref: `${owner.$id}#/$defs/${name}` })])));
const operations = Object.freeze(['authorizeFixturePhase', 'commitFixtureCheckpoint',
  'loadFixtureCheckpoint', 'verifyFixtureCheckpoint']);
const fail = code => { throw new Error(code); };
const same = (a, b) => canonicalSha256(a) === canonicalSha256(b);

// Refuse non-JSON objects/accessors before schema/hash traversal. No getters run.
function data(value, seen = new Set(), count = { n: 0 }, depth = 0) {
  if (++count.n > 10000 || depth > 32) fail('FIXTURE_DATA_BOUND');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('FIXTURE_NONFINITE'); return; }
  if (typeof value !== 'object' || types.isProxy(value) || seen.has(value) ||
      (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)) fail('FIXTURE_JSON_ONLY');
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some(k => typeof k !== 'string')) fail('FIXTURE_JSON_ONLY');
  if (Array.isArray(value) && (Object.keys(value).length !== value.length ||
      Object.keys(value).some((key, index) => key !== String(index)))) fail('FIXTURE_JSON_ONLY');
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (Array.isArray(value) && key === 'length') continue;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('FIXTURE_JSON_ONLY');
    data(descriptor.value, seen, count, depth + 1);
  }
  seen.delete(value);
}
export function validateShape(name, value) {
  data(value); const validator = validators.get(name);
  if (!validator) fail('UNKNOWN_FIXTURE_SHAPE');
  if (!validator(value)) fail(`INVALID_FIXTURE_${name}`);
  return value;
}
/** Immutable private request snapshot across asynchronous trusted boundaries. */
export function snapshotFixtureData(value) {
  data(value);
  const serialized = canonicalize(value);
  if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > 64 * 1024 * 1024)
    fail('FIXTURE_TRANSFER_BOUND');
  const copied = JSON.parse(serialized);
  const freeze = item => {
    if (item !== null && typeof item === 'object') {
      Object.values(item).forEach(freeze); Object.freeze(item);
    }
    return item;
  };
  return freeze(copied);
}
function clock(context, nowMs, current) {
  const c = context.clock, i = context.identity;
  if (!Number.isSafeInteger(nowMs) || c.deadlineMs !== c.t0Ms + 720000 ||
      c.cleanupDeadlineMs !== c.t0Ms + 900000 || nowMs < c.t0Ms || nowMs >= c.deadlineMs ||
      i.admittedAtMs < c.t0Ms || i.admittedAtMs >= i.expiresAtMs || i.expiresAtMs > c.deadlineMs ||
      i.admittedAtMs > nowMs || (current && nowMs >= i.expiresAtMs)) fail('FIXTURE_CLOCK_OR_EXPIRY');
}
export function assertFixtureContext(context, nowMs, { current = true } = {}) {
  validateShape('FixtureContext', context); clock(context, nowMs, current);
  const i = context.identity;
  if (i.attempt !== (context.phase === 'interrupt' ? 1 : 2) ||
      i.fence !== i.canonical.writerFence || context.runUuid === context.namespace.sessionId ||
      context.pins.contractsSchemaSha256 !== publicSchemaSha256) fail('FIXTURE_MAPPING_OR_PINS');
  return context;
}
function stable(a, b) {
  if (a.runUuid !== b.runUuid || !same(a.namespace, b.namespace) || !same(a.clock, b.clock) ||
      !same(a.pins, b.pins) || a.identity.policyRevision !== b.identity.policyRevision ||
      ['tenantId', 'actorId', 'conversationId', 'runId'].some(k =>
        a.identity.canonical[k] !== b.identity.canonical[k])) fail('FIXTURE_STABLE_BINDING');
}
export function assertFixtureReplacement(producer, current, nowMs, committedAtMs) {
  assertFixtureContext(producer, nowMs, { current: false }); assertFixtureContext(current, nowMs);
  stable(producer, current);
  const a = producer.identity, b = current.identity;
  if (producer.phase !== 'interrupt' || current.phase !== 'resume' || b.fence <= a.fence ||
      ['mappingId', 'grantId', 'taskArn'].some(k => a[k] === b[k]) ||
      ['attemptId', 'workerId'].some(k => a.canonical[k] === b.canonical[k]) ||
      b.admittedAtMs <= committedAtMs) fail('FIXTURE_REPLACEMENT_REQUIRED');
}
function assertObject(reference, context) {
  if (reference.bytes < 1 || reference.bytes > 48 * 1024 * 1024 || reference.versionId.length > 256 ||
      reference.scopes.length !== 1) fail('FIXTURE_OBJECT_BOUND');
  const s = reference.scopes[0], i = context.identity;
  if (s.kind !== 'tenant' || s.tenantId !== i.canonical.tenantId || s.resourceId !== s.tenantId ||
      s.policyRevision !== i.policyRevision) fail('FIXTURE_OBJECT_SCOPE');
}
function paths(inventory, context) {
  const sid = context.namespace.sessionId, names = new Set(), files = inventory.files;
  if (files.length + inventory.directories.length > 512) fail('FIXTURE_MEMBER_BOUND');
  const check = name => {
    const parts = name.split('/');
    if (parts.length > 12 || parts.some(p => p.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(p) ||
      p.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)) ||
      (name !== `${sid}.jsonl` && name !== sid && !name.startsWith(`${sid}/`)) || names.has(name)) fail('FIXTURE_NATIVE_PATH');
    names.add(name);
  };
  for (const name of inventory.directories) check(name);
  for (const row of files) check(row.path);
  if (files[0].path !== `${sid}.jsonl` || files[0].bytes < 1 ||
      files.some(f => f.path === sid)) fail('FIXTURE_MAIN_REQUIRED');
  const dirs = new Set(inventory.directories), fileNames = new Set(files.map(f => f.path));
  for (const name of names) {
    const parts = name.split('/');
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(0, i).join('/');
      if (!dirs.has(parent) || fileNames.has(parent)) fail('FIXTURE_PARENT_REQUIRED');
    }
  }
  if (files.reduce((n, f) => n + f.bytes, 0) !== inventory.totalBytes) fail('FIXTURE_TOTAL_BYTES');
}
function bytes(row) {
  // Canonical base64 length follows the already bounded declared byte count.
  // Refuse inconsistent input before allocating a decoded buffer.
  if (row.base64.length !== Math.ceil(row.bytes / 3) * 4) fail('FIXTURE_BYTES_MISMATCH');
  const raw = Buffer.from(row.base64, 'base64');
  if (raw.length !== row.bytes || raw.toString('base64') !== row.base64 ||
      createHash('sha256').update(raw).digest('hex') !== row.sha256) fail('FIXTURE_BYTES_MISMATCH');
}
/** The fixed qualification sentinel uses the existing bounded byte grammar. */
export function assertFixtureSentinelPayload(value) {
  validateShape('Sentinel', value); bytes(value); return value;
}
function inventory(bundle) {
  return { format: bundle.format, directories: bundle.directories,
    files: bundle.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })), totalBytes: bundle.totalBytes };
}
export function assertFixturePayload(bundle, fixtureFile, context) {
  validateShape('NativeBundle', bundle); validateShape('Sentinel', fixtureFile);
  if (!same(bundle.binding, context.namespace)) fail('FIXTURE_NATIVE_NAMESPACE');
  paths(inventory(bundle), context); bundle.files.forEach(bytes); bytes(fixtureFile);
  if (Buffer.byteLength(canonicalize(bundle)) > 48 * 1024 * 1024) fail('FIXTURE_TRANSFER_BOUND');
}
export function assertFixtureEvidence(evidence, context) {
  validateShape('NativeEvidence', evidence);
  Object.values(evidence).forEach(r => assertObject(r, context));
}

export function fixtureReceiptIdentity(receipt) {
  validateShape('FixtureCheckpointReceipt', receipt);
  return { receiptId: receipt.receiptId, receiptSha256: canonicalSha256(receipt) };
}
export function assertFixtureReceipt(receipt, { producer, reference, nowMs }) {
  validateShape('FixtureCheckpointReceipt', receipt); validateShape('FixtureReceiptIdentity', reference);
  assertFixtureContext(producer, nowMs, { current: false });
  assertFixtureContext(receipt.producer, nowMs, { current: false });
  if (!same(receipt.producer, producer) || producer.phase !== 'interrupt' ||
      !same(fixtureReceiptIdentity(receipt), reference)) fail('FIXTURE_RECEIPT_BINDING');
  const { commit, workspace } = receipt;
  if (commit.committedAtMs < producer.identity.admittedAtMs || commit.committedAtMs > nowMs ||
      commit.committedAtMs >= producer.identity.expiresAtMs || commit.publicationFence !== producer.identity.fence ||
      !same(commit.bundleReadback, receipt.bundle)) fail('FIXTURE_COMMIT_BINDING');
  paths(receipt.nativeInventory, producer); assertObject(receipt.bundle, producer); assertFixtureEvidence(receipt.evidence, producer);
  assertWorkspacePaths(workspace);
  if (!same(workspace.binding, producer.identity.canonical) || workspace.entries.length !== 1 ||
      workspace.entries[0].path !== 'qualification/continuity.txt' || workspace.entries[0].executable !== false ||
      workspace.entries[0].object.bytes > 65536 || !same(workspace.scopes, receipt.bundle.scopes) ||
      Date.parse(workspace.createdAt) < producer.clock.t0Ms || Date.parse(workspace.createdAt) > commit.committedAtMs ||
      canonicalSha256(workspace) !== receipt.workspaceSha256 ||
      commit.workspaceReadbackSha256 !== receipt.workspaceSha256) fail('FIXTURE_WORKSPACE_BINDING');
  assertObject(workspace.entries[0].object, producer);
  return receipt;
}
export function assertFixtureRequest(request, { nowMs }) {
  data(request);
  if (!operations.includes(request?.operation)) fail('UNKNOWN_FIXTURE_OPERATION');
  validateShape(`${request.operation}Request`, request); assertFixtureContext(request.context, nowMs);
  const upload = request.operation === 'commitFixtureCheckpoint', read = request.operation !== 'authorizeFixturePhase' && !upload;
  if ((upload && request.context.phase !== 'interrupt') || (read && request.context.phase !== 'resume')) fail('FIXTURE_PHASE_OPERATION');
  if (upload || request.operation === 'verifyFixtureCheckpoint') assertFixturePayload(request.bundle, request.fixtureFile, request.context);
  if (upload) assertFixtureEvidence(request.evidence, request.context);
  return request;
}
function payloadMatches(receipt, bundle, file) {
  if (receipt.bundle.sha256 !== canonicalSha256(bundle) || receipt.bundle.bytes !== Buffer.byteLength(canonicalize(bundle)) ||
      !same(receipt.nativeInventory, inventory(bundle)) || receipt.workspace.entries[0].object.sha256 !== file.sha256 ||
      receipt.workspace.entries[0].object.bytes !== file.bytes) fail('FIXTURE_STORED_BYTES_MISMATCH');
}
/** Throws on ERROR/unknown. Only an exact typed stale denial can support a false witness. */
export function assertFixtureResponse(request, response, { producer, nowMs }) {
  assertFixtureRequest(request, { nowMs }); validateShape(`${request.operation}Response`, response);
  if (request.requestId !== response.requestId || !same(request.context, response.context)) fail('FIXTURE_RESPONSE_CORRELATION');
  if (response.status === 'ERROR') fail(`FIXTURE_CHANNEL_${response.code}`);
  if (request.operation === 'authorizeFixturePhase') {
    assertFixtureContext(producer, nowMs, { current: false });
    stable(producer, request.context);
    if (request.context.phase === 'interrupt' && !same(producer, request.context)) fail('FIXTURE_PRODUCER_REWRITE');
    if (request.context.phase === 'resume') assertFixtureReplacement(producer, request.context, nowMs, producer.identity.admittedAtMs);
    if (response.checkedAtMs > nowMs || response.checkedAtMs < nowMs - 30000 ||
        response.checkedAtMs < request.context.identity.admittedAtMs) fail('FIXTURE_DECISION_FRESHNESS');
    if (response.status === 'DENIED_STALE_BINDING') {
      assertFixtureReplacement(request.context, response.currentContext, nowMs, request.context.identity.admittedAtMs);
      if (response.checkedAtMs < response.currentContext.identity.admittedAtMs) fail('FIXTURE_DECISION_FRESHNESS');
      return 'STALE_BINDING_DENIED';
    }
    return 'AUTHORIZED';
  }
  const reference = request.operation === 'commitFixtureCheckpoint' ? fixtureReceiptIdentity(response.receipt) : request.reference;
  assertFixtureReceipt(response.receipt, { producer, reference, nowMs });
  if (request.operation === 'commitFixtureCheckpoint') {
    if (!same(request.context, producer) || !same(request.evidence, response.receipt.evidence)) fail('FIXTURE_PRODUCER_REWRITE');
    payloadMatches(response.receipt, request.bundle, request.fixtureFile);
  } else {
    assertFixtureReplacement(producer, request.context, nowMs, response.receipt.commit.committedAtMs);
    const bundle = request.operation === 'loadFixtureCheckpoint' ? response.bundle : request.bundle;
    const file = request.operation === 'loadFixtureCheckpoint' ? response.fixtureFile : request.fixtureFile;
    assertFixturePayload(bundle, file, request.context); payloadMatches(response.receipt, bundle, file);
  }
  return response.status;
}
