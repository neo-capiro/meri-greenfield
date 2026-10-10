// W02-18 focused fixtures for the initial read-only TestState request planner.
//
// Pure/CLI tests only: no AWS/shell/provider/network. Subprocess fixtures spawn the
// SAME Node executable with fixed args, shell:false and a bounded timeout. Source,
// graph and input validation stay real (owner literal data); nothing mirrors logic.
//
// The integration fixtures are the owner-supplied ignored inputs under
// .task-inputs/W02-18-owner-inputs/. If they are absent the suite fails one explicit
// "owner input data present" test instead of silently passing.
//
// Honest scope of what is MEASURED here: production dynamic-import ORDERING is not
// instrumentable from the tests, so it is established by source inspection only and is
// labelled as such; the pure validators and the raw-input checks are measured directly.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdtempSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { readBoundedRegularFile } from './native-teststate/files.mjs';
import { parseStrictJson, validateSourceRecord, verifySourceRecords, composeFixedBinding, isOwnedBinding, isInertAdmission, FIXED_SOURCE_PINS, GRAPH_RAW, STATIC_PINS_RAW, EXPECTED_STATIC_BINDING_ID } from './native-teststate/binding.mjs';
import { validateSeed, buildRequestPlan, SEED_SCHEMA, PLAN_SCHEMA, PLAN_STATUS, REQUEST_KEYS, CASES, ROLE_ARN } from './native-teststate/requests.mjs';
import { parseArgs } from './prepare-native-teststate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CLI = join(HERE, 'prepare-native-teststate.mjs');
const INPUT_DIR = join(ROOT, '.task-inputs', 'W02-18-owner-inputs');
const PINS_PATH = join(INPUT_DIR, 'static-pins.json');
const GRAPH_PATH = join(INPUT_DIR, 'definition.json');
const hasInputs = existsSync(PINS_PATH) && existsSync(GRAPH_PATH);
const SUBPROCESS_TIMEOUT_MS = 60000;

// Sanitized child environment: strip NODE_OPTIONS/NODE_PATH and provider/AWS credential
// variables (the removed NAMES are recorded, never values). Children also get a confined
// TMP/TEMP/TMPDIR. The pinned Node is process.execPath (same executable as the suite).
const STRIP_EXACT = new Set(['NODE_OPTIONS', 'NODE_PATH']);
const isProviderVar = (k) => /^AWS_/i.test(k) || /^OPENROUTER/i.test(k) || /^OPENAI/i.test(k)
  || /^ANTHROPIC/i.test(k) || /^GEMINI/i.test(k) || /^CLOUDFLARE/i.test(k) || /^AZURE/i.test(k);
const baseChildEnv = { ...process.env };
const removedEnvNames = [];
for (const key of Object.keys(baseChildEnv)) {
  if (STRIP_EXACT.has(key) || isProviderVar(key)) { removedEnvNames.push(key); delete baseChildEnv[key]; }
}
const childEnv = (extra = {}) => ({ ...baseChildEnv, ...extra });

const RUN_UUID = '87890e41-3f88-4b4d-b1d3-aaa9b85aaa9b';
const OTHER_UUID = '22222222-2222-4222-8222-222222222222';
const CAP_UUID = '11111111-1111-4111-8111-111111111111';
const CLUSTER = 'arn:aws:ecs:us-east-1:967807252336:cluster/meri-greenfield-qualification';
const T0 = 1760000000000;

const pinsBytes = hasInputs ? readFileSync(PINS_PATH) : null;
const graphBytes = hasInputs ? readFileSync(GRAPH_PATH) : null;
const composed = hasInputs ? await composeFixedBinding({ staticPinsBytes: pinsBytes, graphBytes }) : null;
const binding = composed && composed.ok ? composed.binding : null;
const graphText = graphBytes ? graphBytes.toString('utf8') : '';

const seedBytes = (over = {}) => Buffer.from(JSON.stringify({
  schemaVersion: SEED_SCHEMA, case: 'identity', wireCaptureId: CAP_UUID, runUuid: RUN_UUID, t0Ms: T0, planningTimeMs: T0 + 1000, ...over,
}));
const planFor = (over = {}) => buildRequestPlan({ binding, seedBytes: seedBytes(over) });

const TMP = mkdtempSync(join(tmpdir(), 'w02-18-teststate-'));
after(() => { try { rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ } });

// ---------------------------------------------------------------------------
// A. Fixed source / graph / raw input integrity (real owner data)
// ---------------------------------------------------------------------------
test('owner input data is present', () => {
  assert.ok(hasInputs, `owner input data absent under ${INPUT_DIR}`);
});
test('eight fixed source records verify', { skip: !hasInputs }, () => {
  assert.deepEqual(verifySourceRecords(binding.sourceRecords), { ok: true });
  assert.equal(binding.sourceRecords.length, 8);
});
test('compile reproduces the exact inert graph once', { skip: !hasInputs }, () => {
  assert.equal(binding.runtimeEnabled, false);
  assert.equal(binding.staticBindingId, EXPECTED_STATIC_BINDING_ID);
  assert.equal(binding.graphSha256, GRAPH_RAW.sha256);
  assert.equal(binding.graphBytesLength, GRAPH_RAW.bytes);
  assert.equal(binding.graphText, graphText);
  assert.equal(Object.keys(binding.graph.States).length, 91);
});
test('graph contains mutators; plans may select only the read-only members', { skip: !hasInputs }, () => {
  assert.equal(binding.graph.States.RunTask.Resource, 'arn:aws:states:::aws-sdk:ecs:runTask');
  assert.equal(binding.graph.States.StopOwned.Resource, 'arn:aws:states:::aws-sdk:ecs:stopTask');
  for (const c of CASES) assert.ok(['DispatchIdentity', 'ListFirst'].includes(planFor({ case: c }).plan.stateName));
});
test('pure source-record validators reject every drift (production import ordering is source-inspected only)', () => {
  for (const pin of FIXED_SOURCE_PINS) {
    assert.deepEqual(validateSourceRecord({ path: pin.path, bytes: pin.bytes, sha256: pin.sha256 }, pin), { ok: true });
    assert.equal(validateSourceRecord({ path: pin.path, bytes: pin.bytes + 1, sha256: pin.sha256 }, pin).ok, false);
    assert.equal(validateSourceRecord({ path: pin.path, bytes: pin.bytes, sha256: 'f'.repeat(64) }, pin).ok, false);
    assert.equal(validateSourceRecord({ path: pin.path + 'x', bytes: pin.bytes, sha256: pin.sha256 }, pin).ok, false);
    const drifted = FIXED_SOURCE_PINS.map((p) => (p.path === pin.path ? { path: p.path, bytes: p.bytes + 1, sha256: p.sha256 } : { path: p.path, bytes: p.bytes, sha256: p.sha256 }));
    assert.equal(verifySourceRecords(drifted).ok, false);
  }
});
test('raw static-pins whitespace, equal-length and truncation drift are refused', { skip: !hasInputs }, async () => {
  const whitespace = await composeFixedBinding({ staticPinsBytes: Buffer.concat([pinsBytes, Buffer.from(' ')]), graphBytes });
  assert.equal(whitespace.ok, false);
  assert.match(whitespace.reason, /static pins raw identity/);
  const truncated = await composeFixedBinding({ staticPinsBytes: pinsBytes.subarray(0, 100), graphBytes });
  assert.equal(truncated.ok, false);
  const equalLength = Buffer.from(pinsBytes);
  equalLength[0] = 0x20;
  const changed = await composeFixedBinding({ staticPinsBytes: equalLength, graphBytes });
  assert.equal(changed.ok, false);
  assert.match(changed.reason, /static pins raw identity/);
});
test('raw graph drift is refused', { skip: !hasInputs }, async () => {
  const drifted = await composeFixedBinding({ staticPinsBytes: pinsBytes, graphBytes: Buffer.concat([graphBytes, Buffer.from(' ')]) });
  assert.equal(drifted.ok, false);
  assert.match(drifted.reason, /graph raw identity/);
});
test('caller input mutation across composition cannot substitute bytes', { skip: !hasInputs }, async () => {
  const pinsCopy = Buffer.from(pinsBytes);
  const graphCopy = Buffer.from(graphBytes);
  const pending = composeFixedBinding({ staticPinsBytes: pinsCopy, graphBytes: graphCopy });
  queueMicrotask(() => { pinsCopy.fill(0x20); graphCopy.fill(0x20); });
  const result = await pending;
  assert.equal(result.ok, true);
  assert.equal(result.binding.inputProvenance.staticPins.sha256, STATIC_PINS_RAW.sha256);
  assert.equal(result.binding.inputProvenance.graph.sha256, GRAPH_RAW.sha256);
});
test('a caller-supplied source reader cannot bypass production source checks', { skip: !hasInputs }, async () => {
  const result = await composeFixedBinding({ staticPinsBytes: pinsBytes, graphBytes, sourceReader: () => { throw new Error('ignored'); } });
  assert.equal(result.ok, true);
  assert.equal(result.binding.sourceRecords.length, 8);
});

// ---------------------------------------------------------------------------
// B. Strict JSON
// ---------------------------------------------------------------------------
test('parseStrictJson accepts a bounded object', () => {
  const r = parseStrictJson(Buffer.from('{"a":1,"b":[true,null]}'), { maxBytes: 1024 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { a: 1, b: [true, null] });
});
test('parseStrictJson refuses duplicate members (top, nested, escaped)', () => {
  assert.equal(parseStrictJson(Buffer.from('{"a":1,"a":2}'), { maxBytes: 1024 }).reason, 'duplicate JSON member');
  assert.equal(parseStrictJson(Buffer.from('{"x":{"b":1,"b":2}}'), { maxBytes: 1024 }).reason, 'duplicate JSON member');
  assert.equal(parseStrictJson(Buffer.from('{"a":1,"\\u0061":2}'), { maxBytes: 1024 }).reason, 'duplicate JSON member');
});
test('parseStrictJson refuses invalid UTF-8, non-finite, depth and byte limit', () => {
  assert.equal(parseStrictJson(Buffer.from([0x22, 0xff, 0x22]), { maxBytes: 1024 }).reason, 'invalid UTF-8');
  assert.equal(parseStrictJson(Buffer.from('1e999'), { maxBytes: 1024 }).reason, 'non-finite number');
  assert.equal(parseStrictJson(Buffer.from(`${'['.repeat(70)}${']'.repeat(70)}`), { maxBytes: 4096 }).reason, 'malformed JSON');
  assert.equal(parseStrictJson(Buffer.from('{}'), { maxBytes: 1 }).reason, 'json exceeds byte bound');
});
test('parseStrictJson refuses forbidden prototype members', () => {
  assert.equal(parseStrictJson(Buffer.from('{"__proto__":{"x":1}}'), { maxBytes: 1024 }).reason, 'forbidden JSON member');
  assert.equal(parseStrictJson(Buffer.from('{"a":{"constructor":1}}'), { maxBytes: 1024 }).reason, 'forbidden JSON member');
  assert.equal(parseStrictJson(Buffer.from('{"prototype":1}'), { maxBytes: 1024 }).reason, 'forbidden JSON member');
});
test('parseStrictJson is immune to a poisoned global TextDecoder', () => {
  const real = globalThis.TextDecoder;
  try {
    globalThis.TextDecoder = class { decode() { throw new Error('poisoned'); } };
    assert.equal(parseStrictJson(Buffer.from('{"a":1}'), { maxBytes: 1024 }).ok, true);
  } finally { globalThis.TextDecoder = real; }
});

// ---------------------------------------------------------------------------
// C. Seed contract
// ---------------------------------------------------------------------------
test('validateSeed accepts the four exact cases', () => {
  for (const c of CASES) assert.deepEqual(validateSeed({ schemaVersion: SEED_SCHEMA, case: c, wireCaptureId: CAP_UUID, runUuid: RUN_UUID, t0Ms: T0, planningTimeMs: T0 + 1000 }), { ok: true });
});
test('validateSeed refuses forbidden cases and extra keys', () => {
  const base = { schemaVersion: SEED_SCHEMA, case: 'identity', wireCaptureId: CAP_UUID, runUuid: RUN_UUID, t0Ms: T0, planningTimeMs: T0 + 1000 };
  assert.equal(validateSeed({ ...base, case: 'run-task' }).ok, false);
  for (const key of ['stateName', 'roleArn', 'definition', 'importPath', 'ctx', 'variables', 'mock', 'context', 'profile', 'inspectionLevel', 'executeAdmitted', 'runtimeEnabled']) {
    assert.equal(validateSeed({ ...base, [key]: 'x' }).ok, false, key);
  }
  assert.equal(validateSeed({ ...base, schemaVersion: 'other' }).ok, false);
  assert.equal(validateSeed({ ...base, extra: 1 }).ok, false);
});
test('validateSeed refuses bad UUIDs and wire==run', () => {
  const base = { schemaVersion: SEED_SCHEMA, case: 'identity', wireCaptureId: CAP_UUID, runUuid: RUN_UUID, t0Ms: T0, planningTimeMs: T0 + 1000 };
  assert.equal(validateSeed({ ...base, runUuid: RUN_UUID.toUpperCase() }).ok, false);
  assert.equal(validateSeed({ ...base, runUuid: '12345678-1234-1234-1234-123456789abc' }).ok, false);
  assert.equal(validateSeed({ ...base, wireCaptureId: RUN_UUID }).ok, false);
  assert.equal(validateSeed({ ...base, wireCaptureId: 'not-a-uuid' }).ok, false);
});
test('validateSeed refuses stale, unsafe and deadline-short times', () => {
  const base = { schemaVersion: SEED_SCHEMA, case: 'identity', wireCaptureId: CAP_UUID, runUuid: RUN_UUID, t0Ms: T0, planningTimeMs: T0 + 1000 };
  assert.equal(validateSeed({ ...base, t0Ms: T0 + 2, planningTimeMs: T0 + 1 }).ok, false);
  assert.equal(validateSeed({ ...base, t0Ms: 0 }).ok, false);
  assert.equal(validateSeed({ ...base, t0Ms: -5 }).ok, false);
  assert.equal(validateSeed({ ...base, t0Ms: 1.5 }).ok, false);
  assert.equal(validateSeed({ ...base, t0Ms: Number.MAX_SAFE_INTEGER }).ok, false);
  assert.equal(validateSeed({ ...base, planningTimeMs: T0 + 720000 }).ok, false);
  assert.equal(validateSeed({ ...base, planningTimeMs: T0 + 719500 }).ok, false);
  assert.deepEqual(validateSeed({ ...base, planningTimeMs: T0 + 719000 }), { ok: true });
});

// ---------------------------------------------------------------------------
// D. Request plan (real binding)
// ---------------------------------------------------------------------------
test('four cases produce the exact request/variable shapes', { skip: !hasInputs }, () => {
  const D = T0 + 720000;
  const C = T0 + 900000;
  const expected = {
    identity: { stateName: 'DispatchIdentity', resource: 'arn:aws:states:::aws-sdk:sts:getCallerIdentity', variables: JSON.stringify({ ctx: { D } }), args: {} },
    'list-started-by': { stateName: 'ListFirst', resource: 'arn:aws:states:::aws-sdk:ecs:listTasks', variables: JSON.stringify({ ctx: { C, mode: 0, run: { uuid: RUN_UUID } } }), args: { Cluster: CLUSTER, MaxResults: 10, StartedBy: RUN_UUID } },
    'list-running': { stateName: 'ListFirst', resource: 'arn:aws:states:::aws-sdk:ecs:listTasks', variables: JSON.stringify({ ctx: { C, mode: 1 } }), args: { Cluster: CLUSTER, MaxResults: 10, DesiredStatus: 'RUNNING' } },
    'list-stopped': { stateName: 'ListFirst', resource: 'arn:aws:states:::aws-sdk:ecs:listTasks', variables: JSON.stringify({ ctx: { C, mode: 2 } }), args: { Cluster: CLUSTER, MaxResults: 10, DesiredStatus: 'STOPPED' } },
  };
  for (const [c, e] of Object.entries(expected)) {
    const { plan } = planFor({ case: c });
    assert.equal(plan.schemaVersion, PLAN_SCHEMA);
    assert.equal(plan.status, PLAN_STATUS);
    assert.equal(plan.stateName, e.stateName);
    assert.equal(plan.resource, e.resource);
    assert.equal(plan.request.variables, e.variables);
    assert.deepEqual(plan.expectedArguments, e.args);
    assert.deepEqual(Object.keys(plan.request), REQUEST_KEYS);
    assert.equal(plan.request.definition, graphText);
    assert.equal(plan.request.input, '{}');
    assert.equal(plan.request.inspectionLevel, 'DEBUG');
    assert.equal(plan.request.revealSecrets, false);
    assert.equal(plan.request.roleArn, ROLE_ARN);
    assert.equal(plan.selectedMemberHash, binding.memberHashes[e.stateName]);
    assert.equal(plan.staticBindingId, EXPECTED_STATIC_BINDING_ID);
    assert.equal(plan.graph.sha256, GRAPH_RAW.sha256);
    assert.equal(plan.seed.sha256, createHash('sha256').update(seedBytes({ case: c })).digest('hex'));
  }
});
test('plan carries raw static-pins and graph identity provenance', { skip: !hasInputs }, () => {
  const p = planFor().plan;
  assert.deepEqual(p.input.staticPins, { bytes: STATIC_PINS_RAW.bytes, sha256: STATIC_PINS_RAW.sha256 });
  assert.deepEqual(p.input.graph, { bytes: GRAPH_RAW.bytes, sha256: GRAPH_RAW.sha256 });
  assert.equal(p.graph.bytes, GRAPH_RAW.bytes);
});
test('plan preserves original times and derives timeout expectation', { skip: !hasInputs }, () => {
  assert.equal(planFor().plan.expectedTimeoutSeconds, 30);
  assert.equal(planFor({ planningTimeMs: T0 + 700000 }).plan.expectedTimeoutSeconds, 20);
  assert.equal(planFor({ planningTimeMs: T0 + 719000 }).plan.expectedTimeoutSeconds, 1);
  assert.equal(planFor({ planningTimeMs: T0 + 718500 }).plan.expectedTimeoutSeconds, 1);
  const p = planFor().plan;
  assert.deepEqual(p.seed.originalTimes, { t0Ms: T0, planningTimeMs: T0 + 1000 });
  assert.deepEqual(p.seed.derived, { D: T0 + 720000, C: T0 + 900000 });
});
test('plan carries synthetic/inert/not-executed provenance and no acceptance tokens', { skip: !hasInputs }, () => {
  const p = planFor().plan;
  assert.deepEqual(p.provenance, {
    synthetic: true, inert: true, notExecuted: true, runtimeEnabled: false, executeAdmitted: false,
    wireOrigin: 'SYNTHETIC_TEST_ONLY', roleStatus: 'FUTURE_NOT_CREATED_NOT_TRUSTED_NOT_AUTHORIZED', hashesAreIdentityNotAuthority: true,
  });
  const text = JSON.stringify(p);
  for (const banned of ['OWNER_REVIEWED_ACTUAL_READ_ONLY_INTEGRATION', 'executeAdmitted":true', 'runtimeEnabled":true', 'wireEvidence', 'decodedResult']) {
    assert.equal(text.includes(banned), false, banned);
  }
});
test('branded authority is deeply frozen and nested mutation is refused', { skip: !hasInputs }, () => {
  for (const node of [binding, binding.graph, binding.graph.States, binding.pins, binding.authorityReferences, binding.sourceRecords, binding.sourceRecords[0], binding.memberHashes, binding.inputProvenance, FIXED_SOURCE_PINS, FIXED_SOURCE_PINS[0]]) {
    assert.equal(Object.isFrozen(node), true);
  }
  // strict-mode ESM assignment to any frozen authority throws
  assert.throws(() => { binding.graphText = 'x'; });
  assert.throws(() => { binding.graph.States.ListFirst.Arguments = 'x'; });
  assert.throws(() => { binding.graph.States.ListFirst.Output = {}; });
  assert.throws(() => { binding.pins.runUuid = 'x'; });
  assert.throws(() => { binding.authorityReferences.push({}); });
  assert.throws(() => { binding.sourceRecords[0].sha256 = 'x'; });
  assert.throws(() => { binding.memberHashes.ListFirst = 'x'; });
  assert.throws(() => { binding.inputProvenance.graph.sha256 = 'x'; });
  assert.throws(() => { FIXED_SOURCE_PINS[0].sha256 = 'x'; });
  // authority is unchanged and the plan still derives from the same snapshot
  assert.equal(binding.memberHashes.ListFirst, planFor({ case: 'list-running' }).plan.selectedMemberHash);
});
test('forgery/spread is brand-rejected; a true non-inert admission is refused by the predicate', { skip: !hasInputs }, () => {
  assert.equal(isOwnedBinding(binding), true);
  assert.equal(isOwnedBinding({ runtimeEnabled: false, graph: binding.graph }), false);
  assert.equal(isOwnedBinding(Object.freeze({ runtimeEnabled: true })), false);
  const forged = buildRequestPlan({ binding: { ...binding }, seedBytes: seedBytes() });
  assert.equal(forged.ok, false);
  assert.match(forged.reason, /unbranded/);
  assert.equal(buildRequestPlan({ binding: { runtimeEnabled: true }, seedBytes: seedBytes() }).ok, false);
  assert.equal(isInertAdmission({ runtimeEnabled: true, staticBindingId: 'x' }), false);
  assert.equal(isInertAdmission({ runtimeEnabled: false, staticBindingId: 'x' }), true);
  assert.equal(isInertAdmission(null), false);
});
test('binding run equality and request bytes/sha are enforced', { skip: !hasInputs }, () => {
  const wrongRun = planFor({ runUuid: OTHER_UUID });
  assert.equal(wrongRun.ok, false);
  assert.match(wrongRun.reason, /runUuid/);
  const { plan } = planFor();
  assert.equal(plan.requestBytes, JSON.stringify(plan.request));
  assert.equal(plan.requestSha256, createHash('sha256').update(plan.requestBytes).digest('hex'));
});

// ---------------------------------------------------------------------------
// E. Bounded file reads (in-process fakes)
// ---------------------------------------------------------------------------
const fakeOps = (over = {}) => ({
  lstat: () => ({ isFile: () => true, isSymbolicLink: () => false, dev: 1, ino: 2, size: 3, nlink: 1 }),
  open: () => 7,
  fstat: () => ({ isFile: () => true, dev: 1, ino: 2, size: 3 }),
  read: (() => { let done = false; return (fd, buf) => { if (done) return 0; done = true; buf.write('abc'); return 3; }; })(),
  close: () => {},
  ...over,
});
const dirStub = { isFile: () => false, isSymbolicLink: () => false };
const fileStub = { isFile: () => true, isSymbolicLink: () => false, dev: 1, ino: 2, size: 3, nlink: 1 };
const pathOps = (target, targetStub, over = {}) => fakeOps({ lstat: (p) => (p === target ? targetStub : dirStub), ...over });
test('bounded read succeeds on a regular file and reports sha256', () => {
  const r = readBoundedRegularFile('/abs/file.json', { maxBytes: 16, ops: fakeOps() });
  assert.equal(r.ok, true);
  assert.equal(r.byteLength, 3);
  assert.equal(r.bytes.toString('utf8'), 'abc');
  assert.equal(r.sha256, createHash('sha256').update('abc').digest('hex'));
  assert.equal(r.handleClosed, true);
});
test('bounded read refuses relative, missing, non-regular, symlink, hard links', () => {
  assert.equal(readBoundedRegularFile('rel.json', { maxBytes: 16, ops: fakeOps() }).error.code, 'path-not-absolute');
  assert.equal(readBoundedRegularFile('/x/y.json', { maxBytes: 16, ops: pathOps('/x/y.json', fileStub, { open: () => { throw new Error('ENOENT'); } }) }).error.code, 'unreadable');
  assert.equal(readBoundedRegularFile('/abs/dir', { maxBytes: 16, ops: pathOps('/abs/dir', dirStub) }).error.code, 'not-regular');
  assert.equal(readBoundedRegularFile('/abs/link', { maxBytes: 16, ops: pathOps('/abs/link', { isFile: () => false, isSymbolicLink: () => true }) }).error.code, 'symlink');
  assert.equal(readBoundedRegularFile('/abs/hard', { maxBytes: 16, ops: pathOps('/abs/hard', { ...fileStub, nlink: 2 }) }).error.code, 'multiple-hard-links');
  assert.equal(readBoundedRegularFile('/abs/x', { maxBytes: 16, ops: fakeOps({ lstat: (p) => (p === '/' ? { isSymbolicLink: () => true } : fileStub) }) }).error.code, 'ancestor-link');
});
test('bounded read refuses oversize, identity mismatch and mid-read change', () => {
  assert.equal(readBoundedRegularFile('/abs/big', { maxBytes: 2, ops: pathOps('/abs/big', fileStub) }).error.code, 'too-large');
  assert.equal(readBoundedRegularFile('/abs/swap', { maxBytes: 16, ops: pathOps('/abs/swap', fileStub, { fstat: () => ({ isFile: () => true, dev: 9, ino: 2, size: 3 }) }) }).error.code, 'identity-mismatch');
  let seen = 0;
  const changing = fakeOps({ lstat: (p) => { if (p !== '/abs/sub/file') return dirStub; seen += 1; return seen === 1 ? fileStub : { ...fileStub, size: 99 }; } });
  assert.equal(readBoundedRegularFile('/abs/sub/file', { maxBytes: 16, ops: changing }).error.code, 'changed-during-read');
});
test('bounded read detects final identity, link policy and same-size timestamp changes', () => {
  let l = 0;
  const finalIno = pathOps('/abs/f', fileStub, { lstat: (p) => (p !== '/abs/f' ? dirStub : (l += 1) === 1 ? fileStub : { ...fileStub, ino: 99 }) });
  assert.equal(readBoundedRegularFile('/abs/f', { maxBytes: 16, ops: finalIno }).error.code, 'changed-during-read');
  let f = 0;
  const finalFdLink = pathOps('/abs/f', fileStub, { fstat: () => { f += 1; return { isFile: () => true, dev: 1, ino: 2, size: 3, nlink: f === 1 ? 1 : 3, mtimeMs: 5, ctimeMs: 5 }; } });
  assert.equal(readBoundedRegularFile('/abs/f', { maxBytes: 16, ops: finalFdLink }).error.code, 'multiple-hard-links');
  let t = 0;
  const finalStamp = pathOps('/abs/f', fileStub, { lstat: (p) => (p !== '/abs/f' ? dirStub : { ...fileStub, mtimeMs: (t += 1) === 1 ? 100 : 200, ctimeMs: 100 }) });
  assert.equal(readBoundedRegularFile('/abs/f', { maxBytes: 16, ops: finalStamp }).error.code, 'changed-during-read');
});
test('bounded read maps every IO/close throw to a bounded refusal and closes handles', () => {
  const ancestorThrow = readBoundedRegularFile('/a/b', { maxBytes: 16, ops: fakeOps({ lstat: (p) => { if (p !== '/a/b') throw new Error('EACCES on /a'); return fileStub; } }) });
  assert.equal(ancestorThrow.error.code, 'io-error');
  assert.equal(ancestorThrow.handleClosed, false);
  assert.equal(String(ancestorThrow.error.message).includes('/a'), false);
  const readThrow = readBoundedRegularFile('/abs/f', { maxBytes: 16, ops: pathOps('/abs/f', fileStub, { read: () => { throw new Error('EIO'); } }) });
  assert.equal(readThrow.error.code, 'io-error');
  assert.equal(readThrow.handleClosed, true);
  const fstatThrow = readBoundedRegularFile('/abs/f', { maxBytes: 16, ops: pathOps('/abs/f', fileStub, { fstat: () => { throw new Error('EIO'); } }) });
  assert.equal(fstatThrow.error.code, 'io-error');
  assert.equal(fstatThrow.handleClosed, true);
  let closed = 0;
  const closeThrow = readBoundedRegularFile('/abs/f', { maxBytes: 16, ops: pathOps('/abs/f', fileStub, { close: () => { closed += 1; throw new Error('EBADF'); } }) });
  assert.equal(closeThrow.ok, false);
  assert.equal(closeThrow.error.code, 'close-failed');
  assert.equal(closeThrow.handleClosed, false);
  assert.equal(closeThrow.closeFailed, true);
  assert.equal(closed, 1);
  const earlierRefusal = readBoundedRegularFile('/abs/f', { maxBytes: 2, ops: pathOps('/abs/f', fileStub, { close: () => { throw new Error('EBADF'); } }) });
  assert.equal(earlierRefusal.error.code, 'too-large');
  assert.equal(earlierRefusal.closeFailed, true);
  assert.equal(earlierRefusal.handleClosed, false);
});
test('bounded read touches the filesystem only on invocation', () => {
  let calls = 0;
  const counting = { lstat: () => { calls += 1; return null; }, open: () => { calls += 1; }, fstat: () => { calls += 1; }, read: () => { calls += 1; }, close: () => { calls += 1; } };
  assert.equal(calls, 0);
  readBoundedRegularFile('/abs/none', { maxBytes: 4, ops: counting });
  assert.ok(calls > 0);
});
test('modules are importable with no input files or repo cwd (no IO instrumented)', () => {
  const url = (rel) => pathToFileURL(join(HERE, 'native-teststate', rel)).href;
  const code = `await import(${JSON.stringify(url('binding.mjs'))});await import(${JSON.stringify(url('requests.mjs'))});await import(${JSON.stringify(url('files.mjs'))});process.stdout.write('ok');`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: TMP, encoding: 'utf8', shell: false, env: childEnv(), timeout: SUBPROCESS_TIMEOUT_MS });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'ok');
});

// ---------------------------------------------------------------------------
// F. CLI
// ---------------------------------------------------------------------------
test('parseArgs enforces exactly three absolute flags', () => {
  assert.equal(parseArgs([]).ok, false);
  assert.equal(parseArgs(['--static-pins', 'a']).ok, false);
  assert.equal(parseArgs(['--bogus', '/x', '--graph', '/y', '--seed', '/z']).ok, false);
  assert.equal(parseArgs(['--static-pins', 'rel', '--graph', '/y', '--seed', '/z']).ok, false);
  assert.equal(parseArgs(['--static-pins', '/a', '--static-pins', '/b', '--graph', '/y', '--seed', '/z']).ok, false);
  assert.equal(parseArgs(['/positional', '--graph', '/y', '--seed', '/z']).ok, false);
  assert.equal(parseArgs(['--static-pins', '/a', '--graph', '/y', '--seed', '/z']).ok, true);
});
const runCli = (args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', shell: false, env: childEnv(), timeout: SUBPROCESS_TIMEOUT_MS });
test('CLI emits one plan to stdout and does not alter inputs', { skip: !hasInputs }, () => {
  const seedPath = join(TMP, 'seed.json');
  writeFileSync(seedPath, seedBytes());
  const before = readdirSync(INPUT_DIR).sort().join(',');
  const graphBefore = readFileSync(GRAPH_PATH);
  const r = runCli(['--static-pins', PINS_PATH, '--graph', GRAPH_PATH, '--seed', seedPath]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, '');
  const plan = JSON.parse(r.stdout);
  assert.equal(plan.status, PLAN_STATUS);
  assert.equal(readFileSync(GRAPH_PATH).equals(graphBefore), true);
  assert.equal(readdirSync(INPUT_DIR).sort().join(','), before);
});
test('CLI refuses no args, unknown flags and relative paths', { skip: !hasInputs }, () => {
  assert.notEqual(runCli([]).status, 0);
  assert.notEqual(runCli(['--nope', '/x']).status, 0);
  const rel = runCli(['--static-pins', 'static-pins.json', '--graph', GRAPH_PATH, '--seed', join(TMP, 'seed.json')]);
  assert.notEqual(rel.status, 0);
});
test('CLI refuses oversize and non-regular inputs', { skip: !hasInputs }, () => {
  const bigSeed = join(TMP, 'big-seed.json');
  writeFileSync(bigSeed, `"${'a'.repeat(5000)}"`);
  assert.notEqual(runCli(['--static-pins', PINS_PATH, '--graph', GRAPH_PATH, '--seed', bigSeed]).status, 0);
  assert.notEqual(runCli(['--static-pins', INPUT_DIR, '--graph', GRAPH_PATH, '--seed', join(TMP, 'seed.json')]).status, 0);
});
test('CLI source validation stays real: drifted graph is refused', { skip: !hasInputs }, () => {
  const badGraph = join(TMP, 'drift-graph.json');
  writeFileSync(badGraph, Buffer.concat([graphBytes, Buffer.from(' ')]));
  const seedPath = join(TMP, 'seed2.json');
  writeFileSync(seedPath, seedBytes());
  assert.notEqual(runCli(['--static-pins', PINS_PATH, '--graph', badGraph, '--seed', seedPath]).status, 0);
});

// ---------------------------------------------------------------------------
// G. Real-loader source closure matrix (fresh confined clones, same pinned Node)
//
// Each case builds a fresh confined clone of the accepted W18 five files (four
// production plus the existing test, which is never imported as an oracle), the
// scanner two and the complete eight-file compiler, then runs a small production-only
// runner in a fresh same-Node shell:false process. Positive pristine provenance is
// asserted before every negative.
// ---------------------------------------------------------------------------
const PACK = join(ROOT, '.task-inputs', 'W02-22-owner-inputs');
const PACK_NEW = join(PACK, 'source-new');
const PACK_OLD6 = join(PACK, 'source-old-six');
const PACK_W18 = join(PACK, 'source-w18-accepted');
const hasPack = existsSync(join(PACK, 'inputs.json')) && existsSync(join(PACK, 'four-request-baseline', 'identity.request.json'));

const W18_FIVE = [
  'scripts/prepare-native-teststate.mjs',
  'scripts/native-teststate/binding.mjs',
  'scripts/native-teststate/files.mjs',
  'scripts/native-teststate/requests.mjs',
  'scripts/test-native-teststate.mjs',
];
const SCANNER_TWO = ['scripts/sdk-capture/json-records.mjs', 'scripts/sdk-capture/protocol.mjs'];
const COMPILER_RELS = FIXED_SOURCE_PINS.map((p) => p.path);
const OLD_SIX_RELS = [
  'infra/native-enforcement/app.mjs',
  'infra/native-enforcement/lib/binding.mjs',
  'infra/native-enforcement/lib/expressions.mjs',
  'infra/native-enforcement/lib/workflow.mjs',
  'infra/native-enforcement/lib/infrastructure.mjs',
  'infra/native-enforcement/lib/task-definition.mjs',
];
const INPUT_RELS = ['.task-inputs/W02-18-owner-inputs/static-pins.json', '.task-inputs/W02-18-owner-inputs/definition.json'];

const CLONES = join(TMP, 'clones');
const CHILD_SCRATCH = join(TMP, 'child-scratch');
mkdirSync(CLONES, { recursive: true });
mkdirSync(CHILD_SCRATCH, { recursive: true });

const LOADER_RUNNER = `import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { composeFixedBinding } from './scripts/native-teststate/binding.mjs';
const root = process.cwd();
const pins = readFileSync(join(root, '.task-inputs', 'W02-18-owner-inputs', 'static-pins.json'));
const graph = readFileSync(join(root, '.task-inputs', 'W02-18-owner-inputs', 'definition.json'));
const r = await composeFixedBinding({ staticPinsBytes: pins, graphBytes: graph });
const out = r.ok
  ? { ok: true, records: r.binding.sourceRecords.map((x) => x.path), graphSha256: r.binding.graphSha256, graphBytesLength: r.binding.graphBytesLength, bindingId: r.binding.staticBindingId }
  : { ok: false, reason: r.reason };
process.stdout.write(JSON.stringify(out));
`;

const POST_AWAIT_RUNNER = `import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { composeFixedBinding } from './scripts/native-teststate/binding.mjs';
const root = process.cwd();
const target = process.argv[2];
const pins = readFileSync(join(root, '.task-inputs', 'W02-18-owner-inputs', 'static-pins.json'));
const graph = readFileSync(join(root, '.task-inputs', 'W02-18-owner-inputs', 'definition.json'));
const seq = ['call'];
const pending = composeFixedBinding({ staticPinsBytes: pins, graphBytes: graph });
seq.push('pending');
{
  const buf = readFileSync(join(root, target));
  const i = buf.indexOf(0x20);
  if (i < 0) throw new Error('no space byte to mutate');
  buf[i] = 0x09;
  writeFileSync(join(root, target), buf);
}
seq.push('mutated');
const r = await pending;
seq.push('awaited');
process.stdout.write(JSON.stringify({ ok: r.ok, reason: r.reason ?? null, seq, target }));
`;

const copyExact = (srcRoot, rel, dstRoot) => {
  const bytes = readFileSync(join(srcRoot, rel));
  const dst = join(dstRoot, rel);
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, bytes);
  return bytes;
};

// A length-preserving, syntax-valid raw drift: flip the first space byte to a tab. The
// file stays a valid module (and its header comment stays a comment) so only the raw
// byte identity check can catch it.
const driftInPlace = (target) => {
  const buf = readFileSync(target);
  const i = buf.indexOf(0x20);
  assert.ok(i >= 0, `no space byte to mutate in ${target}`);
  buf[i] = 0x09;
  writeFileSync(target, buf);
};

const makeClone = (name, loaderRoot, compilerRoot, compilerRels) => {
  const dir = join(CLONES, name);
  mkdirSync(dir, { recursive: true });
  for (const rel of W18_FIVE) copyExact(loaderRoot, rel, dir);
  for (const rel of SCANNER_TWO) copyExact(ROOT, rel, dir);
  for (const rel of compilerRels) copyExact(compilerRoot, rel, dir);
  for (const rel of INPUT_RELS) copyExact(ROOT, rel, dir);
  writeFileSync(join(dir, 'runner.mjs'), LOADER_RUNNER);
  writeFileSync(join(dir, 'post-await-runner.mjs'), POST_AWAIT_RUNNER);
  return dir;
};

const pristineBase = hasPack ? makeClone('base', ROOT, ROOT, COMPILER_RELS) : null;
const freshClone = (name) => {
  const dir = join(CLONES, name);
  cpSync(pristineBase, dir, { recursive: true });
  return dir;
};
const runClone = (dir, script = 'runner.mjs', args = []) => {
  const r = spawnSync(process.execPath, [join(dir, script), ...args], {
    cwd: dir, encoding: 'utf8', shell: false, timeout: SUBPROCESS_TIMEOUT_MS,
    env: childEnv({ TMP: CHILD_SCRATCH, TEMP: CHILD_SCRATCH, TMPDIR: CHILD_SCRATCH }),
  });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* leave null: the raw capture stays in r.stdout */ }
  return { r, json };
};

test('real-loader pristine control loads the accepted eight-file closure', { skip: !hasPack }, () => {
  const dir = freshClone('pristine');
  const { r, json } = runClone(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(json, r.stdout);
  assert.equal(json.ok, true, JSON.stringify(json));
  assert.deepEqual(json.records, COMPILER_RELS);
  assert.equal(json.graphSha256, GRAPH_RAW.sha256);
  assert.equal(json.graphBytesLength, GRAPH_RAW.bytes);
  assert.equal(json.bindingId, EXPECTED_STATIC_BINDING_ID);
  for (const rel of [...W18_FIVE, ...SCANNER_TWO, ...COMPILER_RELS]) {
    assert.ok(readFileSync(join(dir, rel)).equals(readFileSync(join(ROOT, rel))), rel);
  }
});

for (const rel of COMPILER_RELS) {
  const slug = rel.replace(/[^a-z0-9]+/gi, '-');
  test(`real-loader genuinely-missing clone refuses before import: ${rel}`, { skip: !hasPack }, () => {
    const dir = freshClone(`missing-${slug}`);
    rmSync(join(dir, rel));
    const { r, json } = runClone(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(json, r.stdout);
    assert.equal(json.ok, false);
    assert.equal(json.reason, `source unreadable: ${rel}`);
    for (const other of COMPILER_RELS) {
      if (other === rel) continue;
      assert.ok(readFileSync(join(dir, other)).equals(readFileSync(join(ROOT, other))), other);
    }
  });
  test(`real-loader syntax-valid raw-drift clone refuses before import: ${rel}`, { skip: !hasPack }, () => {
    const dir = freshClone(`drift-${slug}`);
    driftInPlace(join(dir, rel));
    const { r, json } = runClone(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(json, r.stdout);
    assert.equal(json.ok, false);
    assert.ok(json.reason.startsWith(`source drift: ${rel}`) || json.reason.startsWith(`source unreadable: ${rel}`), json.reason);
    for (const other of COMPILER_RELS) {
      if (other === rel) continue;
      assert.ok(readFileSync(join(dir, other)).equals(readFileSync(join(ROOT, other))), other);
    }
  });
}

for (const rel of ['infra/native-enforcement/lib/probe-profiles.mjs', 'infra/native-enforcement/canary-task-definition.mjs']) {
  test(`real-loader post-await mutation is refused after the precheck: ${rel}`, { skip: !hasPack }, () => {
    const dir = freshClone(`postawait-${rel.includes('canary') ? 'canary' : 'probe'}`);
    const { r, json } = runClone(dir, 'post-await-runner.mjs', [rel]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(json, r.stdout);
    assert.equal(json.ok, false);
    assert.ok(json.reason.startsWith(`source drift: ${rel}`), json.reason);
    assert.deepEqual(json.seq, ['call', 'pending', 'mutated', 'awaited']);
    assert.equal(json.target, rel);
  });
}

test('old-six loader with the new eight-file compiler refuses (no fallback)', { skip: !hasPack }, () => {
  const dir = makeClone('mismatch-old-loader', PACK_W18, PACK_NEW, COMPILER_RELS);
  const { r, json } = runClone(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(json, r.stdout);
  assert.equal(json.ok, false);
  assert.ok(json.reason.startsWith('source drift: infra/native-enforcement/app.mjs') || json.reason.startsWith('source unreadable: infra/native-enforcement/app.mjs'), json.reason);
});
test('new eight-file loader with the old-six compiler refuses (no fallback)', { skip: !hasPack }, () => {
  const dir = makeClone('mismatch-old-compiler', ROOT, PACK_OLD6, OLD_SIX_RELS);
  const { r, json } = runClone(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(json, r.stdout);
  assert.equal(json.ok, false);
  assert.ok(json.reason.startsWith('source drift: infra/native-enforcement/app.mjs') || json.reason.startsWith('source unreadable: infra/native-enforcement/app.mjs'), json.reason);
});

// ---------------------------------------------------------------------------
// H. Retained raw requests and whole old plan facts (only plan.source six->eight)
// ---------------------------------------------------------------------------
const packInputs = hasPack ? JSON.parse(readFileSync(join(PACK, 'inputs.json'), 'utf8')) : null;
const STRICT_SOURCE_KEYS = ['path', 'bytes', 'sha256'];

for (const caseName of (packInputs ? packInputs.fourRequestBaselines.map((b) => b.case) : [])) {
  test(`retained raw request reproduces byte-exactly and old plan facts hold: ${caseName}`, { skip: !hasInputs || !hasPack }, () => {
    const base = packInputs.fourRequestBaselines.find((b) => b.case === caseName);
    const rawSeed = readFileSync(join(PACK, base.seed.path));
    const rawRequest = readFileSync(join(PACK, base.request.path));
    assert.equal(createHash('sha256').update(rawSeed).digest('hex'), base.seed.sha256);
    assert.equal(createHash('sha256').update(rawRequest).digest('hex'), base.request.sha256);
    assert.equal(rawRequest.length, base.request.bytes);
    const built = buildRequestPlan({ binding, seedBytes: rawSeed });
    assert.equal(built.ok, true, built.reason);
    const plan = built.plan;
    assert.equal(Object.keys(plan).join(','), base.completePlanBaselineSelector.topLevelPlanKeys.join(','));
    assert.equal(plan.requestBytes, rawRequest.toString('utf8'));
    assert.equal(JSON.stringify(plan.request), plan.requestBytes);
    assert.equal(plan.requestSha256, base.request.sha256);
    const { request, requestBytes, source, ...rest } = plan;
    assert.deepEqual(rest, base.oldPlanFactsOtherThanRequestBytesAndSource);
    assert.deepEqual(Object.keys(plan.source), base.sourceObjectKeys);
    assert.equal(plan.source.records.length, 8);
    for (const rec of plan.source.records) assert.deepEqual(Object.keys(rec), STRICT_SOURCE_KEYS);
    assert.deepEqual(plan.source.records, packInputs.newCompilerPins.map((p) => ({ path: p.path, bytes: p.bytes, sha256: p.sha256 })));
  });
}
