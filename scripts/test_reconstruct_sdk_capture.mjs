// Offline, builtin-only regression tests for scripts/reconstruct-sdk-capture.mjs.
//
// NO producer import, NO SDK load, NO native spawn, NO network/socket/cloud.
// Positive captures are synthetic native-SHAPE fixtures built inline.
//
// FIXTURES use ONLY the absolute assigned worktree scratch
//   <worktree>/.task-inputs/testscratch/w02-13-tests-<pid>-<n>/
// every fixture path is checked for resolved confinement, and the ONE new run
// directory is removed in a finally hook with a post-cleanup verification.
// No os.tmpdir/default tempfile is used.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as nodeFs from 'node:fs';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';

import {
  EXPECTED, validateCapture, writeCapture, runCli, isCanonicalBase64, parseRecords,
  readCaptureFile, checkDestination, assertSafeAncestors, realIo, scanJsonKeys, MAX_JSON_DEPTH,
  MAX_RECORD_BYTES, MAX_REQUEST_BYTES, MAX_DECOMPRESSED_BYTES, MAX_INPUT_BYTES,
} from './reconstruct-sdk-capture.mjs';

// ---------------------------------------------------------------------------
// Confined scratch
// ---------------------------------------------------------------------------
const HERE = dirname(fileURLToPath(import.meta.url));
const WT_ROOT = resolve(HERE, '..');
const SCRATCH_ROOT = resolve(WT_ROOT, '.task-inputs', 'testscratch');
const RUN_ROOT = resolve(SCRATCH_ROOT, `w02-13-tests-${process.pid}-${Date.now()}`);
let runRootCreated = false;

function assertConfined(p, base = SCRATCH_ROOT) {
  const rel = relative(resolve(base), resolve(p));
  return rel !== '' && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
}
// Derive scratch from this CURRENT allocated checkout, including review/root
// checkouts; no implementation basename or host-specific separator is required.
assert.ok(isAbsolute(WT_ROOT) && isAbsolute(SCRATCH_ROOT));
assert.equal(SCRATCH_ROOT, join(WT_ROOT, '.task-inputs', 'testscratch'));
assert.equal(assertConfined(RUN_ROOT), true, `run root not confined: ${RUN_ROOT}`);

function runDir(name) {
  if (!runRootCreated) {
    nodeFs.mkdirSync(SCRATCH_ROOT, { recursive: true });
    assertSafeAncestors(nodeFs, SCRATCH_ROOT);
    nodeFs.mkdirSync(RUN_ROOT); // exclusive; never reuse someone else's run dir
    runRootCreated = true;
  }
  const p = join(RUN_ROOT, name);
  assert.equal(assertConfined(p), true, `fixture not confined: ${p}`);
  nodeFs.mkdirSync(p, { recursive: true });
  return p;
}

after(() => {
  if (!runRootCreated) return;
  // Remove ONLY the single new known run directory we created, never the owner
  // query or .task-inputs itself.
  assert.equal(assertConfined(RUN_ROOT), true);
  assert.equal(nodeFs.lstatSync(RUN_ROOT).isSymbolicLink(), false);
  assert.equal(assertConfined(nodeFs.realpathSync(RUN_ROOT), nodeFs.realpathSync(SCRATCH_ROOT)), true);
  nodeFs.rmSync(RUN_ROOT, { recursive: true, force: true });
  assert.equal(nodeFs.existsSync(RUN_ROOT), false, 'run dir cleanup NOT verified');
});

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------
const UUID = '11111111-2222-4333-8444-555555555555';
const UUID2 = '99999999-2222-4333-8444-555555555555';

function sha(buf) { return createHash('sha256').update(buf).digest('hex'); }
function b64(buf) { return Buffer.from(buf).toString('base64'); }
// Clone a real fs.Stats preserving its prototype (methods) for injected fakes.
function statLike(st, overrides) { return Object.assign(Object.create(Object.getPrototypeOf(st)), st, overrides); }

function firstBody({ pad = 0 } = {}) {
  const body = {
    model: EXPECTED.CAPTURE_MODEL, stream: true, max_tokens: 256,
    tools: [{ name: EXPECTED.WIRE_TOOL_FULLNAME, description: 'synthetic', input_schema: { type: 'object' } }],
    messages: [{ role: 'user', content: [{ type: 'text', text: EXPECTED.CAPTURE_USER_PROMPT }] }],
  };
  if (pad > 0) body.system = `MERI_WIRE_PAD ${'x'.repeat(pad)}`; // extra size without altering the exact prompt
  return body;
}
function secondBody() {
  return {
    model: EXPECTED.CAPTURE_MODEL, stream: true, max_tokens: 256,
    tools: [{ name: EXPECTED.WIRE_TOOL_FULLNAME, description: 'synthetic', input_schema: { type: 'object' } }],
    messages: [
      { role: 'user', content: [{ type: 'text', text: EXPECTED.CAPTURE_USER_PROMPT }] },
      { role: 'assistant', content: [{ type: 'tool_use', id: EXPECTED.WIRE_TOOL_USE_ID, name: EXPECTED.WIRE_TOOL_FULLNAME, input: { value: EXPECTED.WIRE_TOKEN }, caller: { type: 'direct' }, toolset_name: null }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: EXPECTED.WIRE_TOOL_USE_ID, is_error: false, content: [{ type: 'text', text: EXPECTED.WIRE_TOOL_RESULT }] }] },
    ],
  };
}

const BASE_HEADERS = [
  { name: 'anthropic-version', value: '2023-06-01' },
  { name: 'content-type', value: 'application/json' },
  { name: 'x-api-key', value: '<redacted>' },
];
function headersFor(gzip) {
  const h = BASE_HEADERS.map((x) => ({ ...x }));
  if (gzip) h.splice(1, 0, { name: 'content-encoding', value: 'gzip' });
  return h;
}

function entryFor(index, json, { gzip = false, path = '/v1/messages', pad = 0 } = {}) {
  const rawJson = Buffer.from(JSON.stringify(json), 'utf8');
  const raw = gzip ? zlib.gzipSync(rawJson) : rawJson;
  return {
    index, path,
    rawLength: raw.length, rawSha256: sha(raw),
    decompressedLength: rawJson.length, decompressedSha256: sha(rawJson),
    headers: headersFor(gzip), hashOnly: false,
  };
}

function chunksFor(entry, raw) {
  const base = b64(raw);
  const total = Math.ceil(base.length / EXPECTED.MAX_CHUNK_BYTES);
  const out = [];
  for (let seq = 0; seq < total; seq += 1) {
    out.push({ record: 'sdk-capture-request-chunk', captureId: UUID, index: entry.index, seq, total, base64: base.slice(seq * EXPECTED.MAX_CHUNK_BYTES, (seq + 1) * EXPECTED.MAX_CHUNK_BYTES) });
  }
  return out;
}

function validSpawn() {
  return {
    spawned: true, cleanedUp: true, cleanupForced: false,
    argvCount: 5, argvBytes: 120, argvHash: 'a'.repeat(64),
    argvFlags: ['--print', '--output-format'],
    envNames: ['ANTHROPIC_BASE_URL', 'HOME', 'PATH'],
    stderrTotalBytes: 0, stderrHashedBytes: 0, stderrTruncated: false,
    stderrSha256: 'b'.repeat(64), stderrPreview: '',
  };
}
function validResult() {
  return { subtype: 'success', is_error: false, stop_reason: 'end_turn', num_turns: 2, session_id: UUID, resultLength: 58, resultSha256: 'c'.repeat(64) };
}

function buildCapture({ gzipSecond = false, firstPad = 0, mutate } = {}) {
  const b1 = firstBody({ pad: firstPad });
  const b2 = secondBody();
  const raw1 = Buffer.from(JSON.stringify(b1), 'utf8');
  const raw2json = Buffer.from(JSON.stringify(b2), 'utf8');
  const raw2 = gzipSecond ? zlib.gzipSync(raw2json) : raw2json;
  const e1 = entryFor(1, b1);
  const e2 = entryFor(2, b2, { gzip: gzipSecond });
  const manifest = {
    record: 'sdk-capture-manifest', captureId: UUID, generatedAt: '2026-10-10T00:00:00.000Z',
    ok: true, reasons: [],
    counters: { permissionCallbacks: 1, handlerExecutions: 1, spawns: 1 },
    spawn: validSpawn(),
    result: validResult(),
    requestCount: 2, totalBodyBytes: raw1.length + raw2.length,
    requestManifest: [e1, e2],
  };
  const records = [manifest, ...chunksFor(e1, raw1), ...chunksFor(e2, raw2), { record: 'sdk-capture-end', captureId: UUID, ok: true, requestCount: 2, totalBodyBytes: raw1.length + raw2.length }];
  if (mutate) mutate({ records, manifest, e1, e2, raw1, raw2 });
  const text = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  return text;
}
function buildCaptureBuf(opts) {
  const text = buildCapture(opts);
  return { text, buffer: Buffer.from(text, 'utf8') };
}
function reasonIncludes(result, fragment) { return result.reasons.some((r) => r.includes(fragment)); }

// Rewrite request `index`'s decoded body and rebind every chunk/hash field.
function rebindBody(records, index, mutate) {
  const manifest = records[0];
  const base = index === 1 ? firstBody() : secondBody();
  mutate(base);
  const raw = Buffer.from(JSON.stringify(base), 'utf8');
  const entry = manifest.requestManifest.find((e) => e.index === index);
  entry.rawLength = raw.length;
  entry.rawSha256 = sha(raw);
  entry.decompressedLength = raw.length;
  entry.decompressedSha256 = sha(raw);
  for (let i = records.length - 1; i >= 0; i -= 1) if (records[i].record === 'sdk-capture-request-chunk' && records[i].index === index) records.splice(i, 1);
  const endIdx = records.findIndex((r) => r.record === 'sdk-capture-end');
  const fresh = chunksFor(entry, raw);
  records.splice(endIdx, 0, ...fresh);
  const totalBytes = manifest.requestManifest.reduce((n, e) => n + e.rawLength, 0);
  manifest.totalBodyBytes = totalBytes;
  records.find((r) => r.record === 'sdk-capture-end').totalBodyBytes = totalBytes;
}

// Replace a request's RAW/decompressed bytes (arbitrary text or invalid UTF-8),
// rebinding every length/hash/chunk/header field. Lets tests craft bodies that
// JSON.stringify cannot express (duplicate keys, invalid UTF-8).
function rebindEntry(records, index, { raw, decompressed, gzip = false }) {
  const manifest = records[0];
  const entry = manifest.requestManifest.find((e) => e.index === index);
  entry.rawLength = raw.length;
  entry.rawSha256 = sha(raw);
  entry.decompressedLength = decompressed.length;
  entry.decompressedSha256 = sha(decompressed);
  entry.headers = headersFor(gzip);
  entry.hashOnly = false;
  for (let i = records.length - 1; i >= 0; i -= 1) if (records[i].record === 'sdk-capture-request-chunk' && records[i].index === index) records.splice(i, 1);
  const endIdx = records.findIndex((r) => r.record === 'sdk-capture-end');
  records.splice(endIdx, 0, ...chunksFor(entry, raw));
  const totalBytes = manifest.requestManifest.reduce((n, e) => n + e.rawLength, 0);
  manifest.totalBodyBytes = totalBytes;
  records.find((r) => r.record === 'sdk-capture-end').totalBodyBytes = totalBytes;
}

// ---------------------------------------------------------------------------
// POSITIVE
// ---------------------------------------------------------------------------
test('positive: identity capture validates and reports independent hashes', () => {
  const { text, buffer } = buildCaptureBuf();
  const result = validateCapture(text, { rawBuffer: buffer });
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
  assert.equal(result.report.requestCount, 2);
  assert.match(result.report.inputSha256, /^[0-9a-f]{64}$/);
  assert.match(result.report.framingSha256, /^[0-9a-f]{64}$/);
  assert.equal(result.report.inputSha256, sha(buffer));
  assert.equal(result.requests.length, 2);
});

test('positive: gzip second request validates', () => {
  const result = validateCapture(buildCapture({ gzipSecond: true }));
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
  assert.equal(result.report.requests[1].encoding, 'gzip');
});

test('positive: multi-chunk request validates with 4096-char boundaries', () => {
  const result = validateCapture(buildCapture({ firstPad: 4000 }));
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
  assert.ok(result.requests[0].rawBytes.length > 4096, 'expected a multi-chunk body');
});

test('positive: optional real tool-use metadata caller/toolset_name accepted', () => {
  const result = validateCapture(buildCapture());
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
  const assistant = result.requests[1].json.messages[1].content[0];
  assert.equal(assistant.caller.type, 'direct');
  assert.equal(assistant.toolset_name, null);
});

test('positive: plural *_tokens accounting fields are NOT treated as credentials', () => {
  const text = buildCapture({ mutate: ({ records }) => { rebindBody(records, 1, (b) => { b.max_tokens = 512; b.usage = { input_tokens: 16, output_tokens: 1, cache_creation_input_tokens: 0 }; }); } });
  const result = validateCapture(text);
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
});

test('positive: identical delivery duplicate chunk accepted (explicit policy)', () => {
  const text = buildCapture({ mutate: ({ records }) => { const c = records.find((r) => r.record === 'sdk-capture-request-chunk'); records.push({ ...c }); } });
  assert.equal(validateCapture(text).ok, true);
});

// ---------------------------------------------------------------------------
// F11 strict fields + confidentiality
// ---------------------------------------------------------------------------
test('F11: unknown/extra/missing record fields rejected', () => {
  const extraManifest = buildCapture({ mutate: ({ manifest }) => { manifest.extraField = 1; } });
  assert.equal(validateCapture(extraManifest).ok, false);
  const missingManifest = buildCapture({ mutate: ({ manifest }) => { delete manifest.reasons; } });
  assert.equal(validateCapture(missingManifest).ok, false);
  const extraChunk = buildCapture({ mutate: ({ records }) => { records.find((r) => r.record === 'sdk-capture-request-chunk').extraField = 1; } });
  assert.equal(validateCapture(extraChunk).ok, false);
  const extraEnd = buildCapture({ mutate: ({ records }) => { records.find((r) => r.record === 'sdk-capture-end').manifestHash = 'd'.repeat(64); } });
  assert.equal(validateCapture(extraEnd).ok, false);
  const unknownType = buildCapture({ mutate: ({ records }) => { records.splice(1, 0, { record: 'sdk-capture-extra', captureId: UUID }); } });
  assert.equal(validateCapture(unknownType).ok, false);
});

test('F11: nonboolean / missing hashOnly rejected', () => {
  for (const mutate of [
    ({ manifest }) => { manifest.requestManifest[0].hashOnly = 'false'; },
    ({ manifest }) => { manifest.requestManifest[0].hashOnly = 0; },
    ({ manifest }) => { delete manifest.requestManifest[0].hashOnly; },
    ({ manifest }) => { manifest.requestManifest[0].hashOnly = true; },
  ]) {
    assert.equal(validateCapture(buildCapture({ mutate })).ok, false);
  }
});

test('F11: malformed counters / spawn / result shapes rejected', () => {
  const cases = {
    countersExtra: ({ manifest }) => { manifest.counters.extra = 1; },
    countersSpawns: ({ manifest }) => { manifest.counters.spawns = 2; },
    spawnExtra: ({ manifest }) => { manifest.spawn.extra = 1; },
    spawnNotClean: ({ manifest }) => { manifest.spawn.cleanedUp = false; },
    spawnBadFlag: ({ manifest }) => { manifest.spawn.argvFlags = ['--print=secretvalue']; },
    spawnBadPreview: ({ manifest }) => { manifest.spawn.stderrPreview = 'Authorization: Bearer abcdefghijklmnop'; },
    resultExtra: ({ manifest }) => { manifest.result.extra = 1; },
    resultSubtype: ({ manifest }) => { manifest.result.subtype = 'error'; },
    resultNumTurns: ({ manifest }) => { manifest.result.num_turns = -1; },
    resultSession: ({ manifest }) => { manifest.result.session_id = 'not-a-uuid'; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const r = validateCapture(buildCapture({ mutate }));
    assert.equal(r.ok, false, name);
  }
});

test('F11: credential-named body key (camelCase / nested) rejected despite rebound hashes + hashOnly=false', () => {
  for (const mutate of [
    (b) => { b.clientSecret = 'plain-value'; },
    (b) => { b.apiKey = 'plain-value'; },
    (b) => { b.accessToken = 'plain-value'; },
    (b) => { b.nested = { deep: { awsAccessKeyId: 'plain-value' } }; },
    (b) => { b.messages[0].content[0].authorization = 'plain-value'; },
  ]) {
    const text = buildCapture({ mutate: ({ records }) => rebindBody(records, 1, mutate) });
    const r = validateCapture(text);
    assert.equal(r.ok, false);
    assert.ok(reasonIncludes(r, 'sensitive'), JSON.stringify(r.reasons));
  }
});

test('F11: secret-like string body value rejected despite rebound hashes', () => {
  const text = buildCapture({ mutate: ({ records }) => rebindBody(records, 1, (b) => { b.innocuous = 'sk-ant-abcdef1234567890'; }) });
  const r = validateCapture(text);
  assert.equal(r.ok, false);
  assert.ok(reasonIncludes(r, 'sensitive'));
});

test('F11: unredacted sensitive header rejected (authorization / x-api-key)', () => {
  const authHeader = buildCapture({ mutate: ({ e1 }) => { e1.headers = [{ name: 'authorization', value: 'Bearer sk-ant-abcdef1234567890' }, { name: 'content-type', value: 'application/json' }, { name: 'x-api-key', value: '<redacted>' }]; } });
  const r1 = validateCapture(authHeader);
  assert.equal(r1.ok, false);
  assert.ok(reasonIncludes(r1, 'not redacted'));
  const apiKeyHeader = buildCapture({ mutate: ({ e1 }) => { e1.headers = [{ name: 'content-type', value: 'application/json' }, { name: 'x-api-key', value: 'sk-ant-abcdef1234567890' }]; } });
  assert.equal(validateCapture(apiKeyHeader).ok, false);
});

test('F11: secret-like non-sensitive header value / unsorted / duplicate header names rejected', () => {
  const secretVal = buildCapture({ mutate: ({ e1 }) => { e1.headers = [{ name: 'content-type', value: 'application/json' }, { name: 'x-custom', value: 'sk-ant-abcdef1234567890' }]; } });
  assert.equal(validateCapture(secretVal).ok, false);
  const unsorted = buildCapture({ mutate: ({ e1 }) => { e1.headers = [{ name: 'z-last', value: 'v' }, { name: 'a-first', value: 'v' }]; } });
  assert.equal(validateCapture(unsorted).ok, false);
  const duplicate = buildCapture({ mutate: ({ e1 }) => { e1.headers = [{ name: 'a', value: 'v' }, { name: 'a', value: 'v' }]; } });
  assert.equal(validateCapture(duplicate).ok, false);
});

// ---------------------------------------------------------------------------
// F12 chunk metadata
// ---------------------------------------------------------------------------
test('F12: conflicting totals / seq>=total / changed duplicate / extra chunk rejected', () => {
  const firstChunk = (records) => records.find((r) => r.record === 'sdk-capture-request-chunk');
  const conflictTotals = buildCapture({ mutate: ({ records }) => { records.push({ ...firstChunk(records), total: firstChunk(records).total + 1 }); } });
  assert.equal(validateCapture(conflictTotals).ok, false);
  const seqTooBig = buildCapture({ mutate: ({ records }) => { const c = firstChunk(records); records.push({ ...c, seq: c.total }); } });
  assert.equal(validateCapture(seqTooBig).ok, false);
  const changedDup = buildCapture({ mutate: ({ records }) => { const c = firstChunk(records); records.push({ ...c, base64: 'QUJD' + c.base64.slice(4) }); } });
  assert.equal(validateCapture(changedDup).ok, false);
  const missing = buildCapture({ mutate: ({ records }) => { const i = records.findIndex((r) => r.record === 'sdk-capture-request-chunk'); records.splice(i, 1); } });
  assert.equal(validateCapture(missing).ok, false);
});

test('F12: multi-chunk shortened non-final chunk rejected', () => {
  const text = buildCapture({ firstPad: 4000, mutate: ({ records }) => { const c = records.find((r) => r.record === 'sdk-capture-request-chunk' && r.seq === 0); c.base64 = c.base64.slice(0, -1); } });
  const r = validateCapture(text);
  assert.equal(r.ok, false);
});

test('F12: huge declared total rejected before any bounded loop (bounded reasons)', () => {
  const text = buildCapture({ mutate: ({ records }) => { records.find((r) => r.record === 'sdk-capture-request-chunk').total = 1000000; } });
  const r = validateCapture(text);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.length <= 64, `reasons grew to ${r.reasons.length}`);
});

test('F12: non-canonical base64 padding / trailing junk rejected', () => {
  const badPad = buildCapture({ mutate: ({ records }) => { const c = records.find((r) => r.record === 'sdk-capture-request-chunk'); c.base64 = c.base64 + '='; } });
  assert.equal(validateCapture(badPad).ok, false);
  const junk = buildCapture({ mutate: ({ records }) => { const c = records.find((r) => r.record === 'sdk-capture-request-chunk'); c.base64 = c.base64.slice(0, -1) + '!'; } });
  assert.equal(validateCapture(junk).ok, false);
});

test('F12: byte/decompression bounds and encoding mismatch rejected', () => {
  const rawTooBig = buildCapture({ mutate: ({ manifest }) => { manifest.requestManifest[0].rawLength = MAX_REQUEST_BYTES + 1; } });
  assert.equal(validateCapture(rawTooBig).ok, false);
  const decompTooBig = buildCapture({ mutate: ({ manifest }) => { manifest.requestManifest[0].decompressedLength = MAX_DECOMPRESSED_BYTES + 1; } });
  assert.equal(validateCapture(decompTooBig).ok, false);
  const encMismatch = buildCapture({ mutate: ({ manifest }) => { manifest.requestManifest[1].headers = [{ name: 'content-encoding', value: 'gzip' }, { name: 'content-type', value: 'application/json' }]; } });
  assert.equal(validateCapture(encMismatch).ok, false);
});

test('F12: mixed UUID / missing end / truncated end rejected', () => {
  const mixed = buildCapture({ mutate: ({ records }) => { records.find((r) => r.record === 'sdk-capture-end').captureId = UUID2; } });
  assert.equal(validateCapture(mixed).ok, false);
  const noEnd = buildCapture({ mutate: ({ records }) => { const i = records.findIndex((r) => r.record === 'sdk-capture-end'); records.splice(i, 1); } });
  assert.equal(validateCapture(noEnd).ok, false);
  const truncEnd = buildCapture({ mutate: ({ records }) => { delete records.find((r) => r.record === 'sdk-capture-end').totalBodyBytes; } });
  assert.equal(validateCapture(truncEnd).ok, false);
});

test('F12: oversized record line rejected', () => {
  const big = { record: 'sdk-capture-manifest', captureId: UUID, pad: 'x'.repeat(MAX_RECORD_BYTES + 100) };
  assert.equal(validateCapture(JSON.stringify(big) + '\n').ok, false);
});

test('parser rejects malformed and empty input', () => {
  assert.equal(parseRecords('').ok, false);
  assert.equal(parseRecords('not json\n').ok, false);
  assert.ok(isCanonicalBase64('AAAA'));
  assert.ok(!isCanonicalBase64('AAA'));
});

// ---------------------------------------------------------------------------
// F13 filesystem: read path identity
// ---------------------------------------------------------------------------
function writeFixtureFile(name, buffer) {
  const dir = runDir(name);
  const file = join(dir, 'capture.ndjson');
  nodeFs.writeFileSync(file, buffer);
  return file;
}

test('F13: full bounded read returns exact original bytes', () => {
  const { buffer } = buildCaptureBuf();
  const file = writeFixtureFile('read-positive', buffer);
  const loaded = readCaptureFile(file);
  assert.equal(Buffer.compare(loaded.buffer, buffer), 0);
  assert.equal(loaded.text, buffer.toString('utf8'));
});

test('F13: invalid UTF-8 rejected (strict fatal decode)', () => {
  const dir = runDir('invalid-utf8');
  const file = join(dir, 'capture.ndjson');
  nodeFs.writeFileSync(file, Buffer.from([0x7b, 0xff, 0x7d]));
  assert.throws(() => readCaptureFile(file), /valid UTF-8/);
});

test('F13: direct symlink input rejected (real junction, or injected fake with disclosure)', () => {
  const dir = runDir('direct-symlink');
  const target = join(dir, 'real.ndjson');
  nodeFs.writeFileSync(target, buildCaptureBuf().buffer);
  const link = join(dir, 'link.ndjson');
  let realOk = true;
  try { nodeFs.symlinkSync(target, link, 'file'); } catch { realOk = false; }
  if (realOk) {
    assert.throws(() => readCaptureFile(link), /symlink/);
  } else {
    console.log('F13 disclosure: real file symlink creation denied by Windows; using injected fake');
    const fakeFs = Object.create(nodeFs);
    fakeFs.lstatSync = (p) => (resolve(p) === resolve(link) ? { isSymbolicLink: () => true, isFile: () => false, isDirectory: () => false } : nodeFs.lstatSync(p));
    assert.throws(() => readCaptureFile(link, { fs: fakeFs }), /symlink/);
  }
});

test('F13: immediate-parent / ancestor symlink-junction rejected', () => {
  const base = runDir('parent-symlink');
  const real = join(base, 'real');
  nodeFs.mkdirSync(real);
  const file = join(real, 'capture.ndjson');
  nodeFs.writeFileSync(file, buildCaptureBuf().buffer);
  const link = join(base, 'link');
  let realOk = true;
  try { nodeFs.symlinkSync(real, link, 'junction'); } catch { realOk = false; }
  const viaLink = join(link, 'capture.ndjson');
  if (realOk) {
    assert.throws(() => readCaptureFile(viaLink), /symlink\/junction/);
  } else {
    console.log('F13 disclosure: real junction creation denied by Windows; using injected fake');
    const fakeFs = Object.create(nodeFs);
    fakeFs.lstatSync = (p) => (resolve(p) === resolve(link) ? { isSymbolicLink: () => true, isFile: () => false, isDirectory: () => true } : nodeFs.lstatSync(p));
    assert.throws(() => readCaptureFile(viaLink, { fs: fakeFs }), /symlink\/junction/);
  }
});

test('F13: path replaced after read rejected (within-path identity continuity)', () => {
  const file = writeFixtureFile('path-replaced', buildCaptureBuf().buffer);
  const real = nodeFs.lstatSync(file);
  let calls = 0;
  const fakeFs = Object.create(nodeFs);
  fakeFs.lstatSync = (p) => {
    if (resolve(p) !== resolve(file)) return nodeFs.lstatSync(p);
    calls += 1;
    if (calls === 1) return real;
    return statLike(real, { ino: real.ino + 1 });
  };
  assert.throws(() => readCaptureFile(file, { fs: fakeFs }), /path changed/);
});

test('F13: append/truncate during read rejected (fd continuity)', () => {
  const file = writeFixtureFile('append-race', buildCaptureBuf().buffer);
  const inspectedFd = nodeFs.openSync(file, 'r');
  let realFd;
  try { realFd = nodeFs.fstatSync(inspectedFd); } finally { nodeFs.closeSync(inspectedFd); }
  let calls = 0;
  const fakeFs = Object.create(nodeFs);
  fakeFs.fstatSync = (fd) => { calls += 1; const st = nodeFs.fstatSync(fd); return calls === 2 ? statLike(st, { size: st.size + 3, mtimeMs: st.mtimeMs + 5 }) : st; };
  assert.throws(() => readCaptureFile(file, { fs: fakeFs }), /changed during read/);
  assert.ok(realFd.size >= 0);
});

test('F13: path-vs-descriptor identity mismatch rejected', () => {
  const file = writeFixtureFile('identity-mismatch', buildCaptureBuf().buffer);
  const fakeFs = Object.create(nodeFs);
  fakeFs.fstatSync = (fd) => statLike(nodeFs.fstatSync(fd), { dev: nodeFs.fstatSync(fd).dev + 1 });
  assert.throws(() => readCaptureFile(file, { fs: fakeFs }), /identity mismatch/);
});

test('F13: missing parent directory rejected (no creation)', () => {
  const missing = join(RUN_ROOT, 'nope', 'capture.ndjson');
  assert.throws(() => readCaptureFile(missing), /missing/);
});

// ---------------------------------------------------------------------------
// F13 output writer
// ---------------------------------------------------------------------------
test('F13: writeCapture writes a NEW exclusive dir with exact canonical artifacts', () => {
  const { text, buffer } = buildCaptureBuf();
  const result = validateCapture(text, { rawBuffer: buffer });
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
  const out = join(runDir('write-positive'), 'out');
  const written = writeCapture(result, out);
  assert.equal(written.ok, true, JSON.stringify(written.reasons));
  assert.deepEqual(nodeFs.readdirSync(out).sort(), ['capture-report.json', 'capture-transcript.ndjson', 'request-1.body', 'request-1.raw', 'request-2.body', 'request-2.raw']);
  // independently recompute + compare to the original bytes
  assert.equal(Buffer.compare(nodeFs.readFileSync(join(out, 'capture-transcript.ndjson')), buffer), 0);
  assert.equal(Buffer.compare(nodeFs.readFileSync(join(out, 'request-1.raw')), result.requests[0].rawBytes), 0);
  assert.equal(Buffer.compare(nodeFs.readFileSync(join(out, 'request-1.body')), result.requests[0].decompressedBytes), 0);
  const report = JSON.parse(nodeFs.readFileSync(join(out, 'capture-report.json'), 'utf8'));
  assert.equal(report.inputSha256, sha(buffer));
  for (const f of report.artifacts) {
    const bytes = nodeFs.readFileSync(join(out, f.file));
    assert.equal(sha(bytes), f.sha256, f.file);
    assert.equal(bytes.length, f.bytes, f.file);
  }
  const again = writeCapture(result, out);
  assert.equal(again.ok, false);
  assert.ok(reasonIncludes(again, 'already exists'));
});

test('F13: existing output rejected (writes nothing)', () => {
  const result = validateCapture(buildCapture());
  const out = runDir('existing-out');
  assert.equal(nodeFs.readdirSync(out).length, 0);
  const written = writeCapture(result, out);
  assert.equal(written.ok, false);
  assert.equal(nodeFs.readdirSync(out).length, 0);
});

test('F13: missing ancestor output path rejected with no partial dirs', () => {
  const result = validateCapture(buildCapture());
  const out = join(runDir('missing-ancestor'), 'missing', 'out');
  const written = writeCapture(result, out);
  assert.equal(written.ok, false);
  assert.equal(nodeFs.existsSync(out), false);
});

test('F13: traversal / outside destination rejected', () => {
  const result = validateCapture(buildCapture());
  assert.equal(writeCapture(result, runDir('traversal') + '/../escape').ok, false);
  assert.equal(checkDestination(runDir('traversal') + '/../escape').ok, false);
});

test('F13: output ancestor symlink rejected (injected fake with disclosure)', () => {
  const base = runDir('out-ancestor');
  const link = join(base, 'link');
  let realOk = true;
  try { nodeFs.symlinkSync(base, link, 'junction'); } catch { realOk = false; }
  const target = join(link, 'out');
  if (realOk) {
    assert.equal(checkDestination(target).ok, false);
  } else {
    console.log('F13 disclosure: real junction creation denied by Windows; using injected fake');
    const fakeFs = Object.create(nodeFs);
    fakeFs.lstatSync = (p) => (resolve(p) === resolve(link) ? { isSymbolicLink: () => true, isFile: () => false, isDirectory: () => true } : nodeFs.lstatSync(p));
    assert.equal(checkDestination(target, { fs: fakeFs }).ok, false);
  }
});

test('F13: write failure removes the owned partial output (no partial artifacts)', () => {
  const result = validateCapture(buildCapture());
  const out = join(runDir('write-failure'), 'out');
  const fakeFs = Object.create(nodeFs);
  fakeFs.writeFileSync = (p, data, opts) => {
    if (String(p).endsWith('request-2.body')) throw new Error('injected write failure');
    return nodeFs.writeFileSync(p, data, opts);
  };
  const written = writeCapture(result, out, { fs: fakeFs });
  assert.equal(written.ok, false);
  assert.equal(nodeFs.existsSync(out), false, 'partial output was not cleaned up');
});

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
test('CLI: validate-only and write modes', () => {
  const { text } = buildCaptureBuf();
  const logs = [];
  assert.equal(runCli(['--input', 'x'], { readFile: () => text, log: (m) => logs.push(m) }), 0);
  assert.match(logs.join(''), /"checked":true/);
  const out = join(runDir('cli'), 'out');
  assert.equal(runCli(['--input', 'x', '--out', out], { readFile: () => text, log: (m) => logs.push(m) }), 0);
  assert.equal(nodeFs.existsSync(join(out, 'capture-report.json')), true);
});

test('CLI: unexpected argument, missing input and read failure are non-zero', () => {
  const logs = [];
  assert.equal(runCli(['--bogus'], { readFile: () => '', log: (m) => logs.push(m) }), 2);
  assert.equal(runCli([], { readFile: () => '', log: (m) => logs.push(m) }), 2);
  assert.equal(runCli(['--input', 'x'], { readFile: () => { throw new Error('nope'); }, log: (m) => logs.push(m) }), 1);
});

test('rejection writes no artifacts (validate-only)', () => {
  const result = validateCapture(buildCapture({ mutate: ({ manifest }) => { manifest.spawn.cleanedUp = false; } }));
  assert.equal(result.ok, false);
  assert.deepEqual(result.requests, []);
  assert.equal(result.report, null);
});

// keep realIo referenced (default IO surface used by the CLI)
test('io surface: realIo exposes node fs', () => {
  assert.equal(realIo.fs, nodeFs);
  assert.equal(typeof assertSafeAncestors, 'function');
});

// ===========================================================================
// RESUME (W02-13 implementation-2) — owner-witness repairs
// ===========================================================================
const WITNESS_SENTINEL = 'SENTINEL_SECRET_sk-ant-LEAKVALUE0000';

// -- A. duplicate JSON member detection (before JSON.parse) ------------------
test('witness A1: duplicate body credential key (apiKey:value then apiKey:null) rejected', () => {
  const base = JSON.stringify(firstBody());
  const rawText = `${base.slice(0, -1)},"apiKey":"synthetic-1","apiKey":null}`;
  assert.ok(rawText.includes('"apiKey"'));
  const text = buildCapture({ mutate: ({ records }) => rebindEntry(records, 1, { raw: Buffer.from(rawText, 'utf8'), decompressed: Buffer.from(rawText, 'utf8') }) });
  const r = validateCapture(text);
  assert.equal(r.ok, false);
  assert.ok(reasonIncludes(r, 'duplicate'), JSON.stringify(r.reasons));
});

test('witness A2: duplicate header value overwritten by <redacted> rejected (no leak)', () => {
  const text = buildCapture().replace('{"name":"x-api-key","value":"<redacted>"}', '{"name":"x-api-key","value":"synthetic-leaked","value":"<redacted>"}');
  const r = validateCapture(text);
  assert.equal(r.ok, false);
  assert.ok(reasonIncludes(r, 'duplicate'));
  assert.ok(!JSON.stringify(r.reasons).includes('synthetic-leaked'));
});

test('witness A3: duplicate NDJSON envelope field rejected even when parsed object would be valid', () => {
  const text = buildCapture().replace('"requestCount":2', '"requestCount":2,"requestCount":2');
  const r = validateCapture(text);
  assert.equal(r.ok, false);
  assert.ok(reasonIncludes(r, 'duplicate'));
});

test('duplicate-key scanner: escaped/unicode/nested collisions rejected; distinct scopes allowed', () => {
  assert.throws(() => scanJsonKeys('{"api\\u004bey":1,"apiKey":2}'), /duplicate/i);
  assert.throws(() => scanJsonKeys('{"apiKey":1,"api\\u004bey":2}'), /duplicate/i);
  assert.throws(() => scanJsonKeys('{"a":{"x":1,"x":2}}'), /duplicate/i);
  assert.throws(() => scanJsonKeys('[{"k":1},{"k":1,"k":2}]'), /duplicate/i);
  assert.doesNotThrow(() => scanJsonKeys('{"a":{"x":1},"b":{"x":2}}'));
  assert.doesNotThrow(() => scanJsonKeys('[{"k":1},{"k":2}]'));
  assert.doesNotThrow(() => scanJsonKeys('{"k":"api\\"Key","s":"a\\\\b","u":"caf\\u00e9"}'));
  assert.doesNotThrow(() => scanJsonKeys('{"escaped\\u004bey":1,"other":2}'));
  const deep = '['.repeat(MAX_JSON_DEPTH + 5) + ']'.repeat(MAX_JSON_DEPTH + 5);
  assert.throws(() => scanJsonKeys(deep), /malformed/i);
});

test('duplicate-key scanner: valid native fixture with same keys in distinct scopes accepted', () => {
  const text = buildCapture({ mutate: ({ records }) => rebindBody(records, 1, (b) => { b.nested = { first: { k: 1 }, second: { k: 2 } }; b.note = 'looks like api"Key but is only text'; }) });
  const r = validateCapture(text);
  assert.equal(r.ok, true, JSON.stringify(r.reasons));
});

// -- B. strict fatal UTF-8 for reconstructed/decoded bodies ------------------
test('witness B: invalid UTF-8 in identity body rejected (strict fatal decode)', () => {
  const bad = Buffer.concat([Buffer.from('{"a":"', 'utf8'), Buffer.from([0xff, 0xfe]), Buffer.from('"}', 'utf8')]);
  const text = buildCapture({ mutate: ({ records }) => rebindEntry(records, 1, { raw: bad, decompressed: bad }) });
  const r = validateCapture(text);
  assert.equal(r.ok, false);
  assert.ok(reasonIncludes(r, 'valid UTF-8'), JSON.stringify(r.reasons));
});

test('witness B: invalid UTF-8 inside a gzip-compressed body rejected', () => {
  const bad = Buffer.concat([Buffer.from('{"a":"', 'utf8'), Buffer.from([0xff, 0xfe]), Buffer.from('"}', 'utf8')]);
  const raw = zlib.gzipSync(bad);
  const text = buildCapture({ mutate: ({ records }) => rebindEntry(records, 1, { raw, decompressed: bad, gzip: true }) });
  const r = validateCapture(text);
  assert.equal(r.ok, false);
  assert.ok(reasonIncludes(r, 'valid UTF-8'), JSON.stringify(r.reasons));
});

// -- C. constant, non-leaking diagnostics -----------------------------------
test('witness C: malformed NDJSON/body/decompress diagnostics leak no sentinel', () => {
  const malformedRecord = `{"record":"sdk-capture-manifest","pad":"${WITNESS_SENTINEL}`;
  const leakOf = (r) => { const s = JSON.stringify(r.reasons); return s.includes('SENTINEL') || s.includes('sk-ant'); };
  const r1 = validateCapture(malformedRecord + '\n');
  assert.equal(r1.ok, false);
  assert.ok(!leakOf(r1), JSON.stringify(r1.reasons));

  const bodyBad = '{' + WITNESS_SENTINEL;
  const t2 = buildCapture({ mutate: ({ records }) => rebindEntry(records, 1, { raw: Buffer.from(bodyBad, 'utf8'), decompressed: Buffer.from(bodyBad, 'utf8') }) });
  const r2 = validateCapture(t2);
  assert.equal(r2.ok, false);
  assert.ok(!leakOf(r2), JSON.stringify(r2.reasons));

  const t3 = buildCapture({ mutate: ({ records }) => rebindEntry(records, 1, { raw: Buffer.from(WITNESS_SENTINEL, 'utf8'), decompressed: Buffer.from('{}', 'utf8'), gzip: true }) });
  const r3 = validateCapture(t3);
  assert.equal(r3.ok, false);
  assert.ok(reasonIncludes(r3, 'decompression failed'), JSON.stringify(r3.reasons));
  assert.ok(!leakOf(r3), JSON.stringify(r3.reasons));

  const logs = [];
  const code = runCli(['--input', 'x'], { readFile: () => malformedRecord + '\n', log: (m) => logs.push(m) });
  assert.equal(code, 1);
  assert.ok(!logs.join('').includes('SENTINEL') && !logs.join('').includes('sk-ant'));
});

// -- D. hardlink rejection ---------------------------------------------------
test('witness D: real hardlink (nlink 2) rejected where supported', () => {
  const dir = runDir('hardlink');
  const target = join(dir, 'capture.ndjson');
  nodeFs.writeFileSync(target, buildCaptureBuf().buffer);
  const link = join(dir, 'link.ndjson');
  let realOk = true;
  try { nodeFs.linkSync(target, link); } catch { realOk = false; }
  if (realOk) {
    assert.ok(nodeFs.lstatSync(link).nlink >= 2);
    assert.throws(() => readCaptureFile(link), /multiple hard links/);
  } else {
    console.log('witness D disclosure: real hardlink unsupported/denied; using injected fake');
    const fakeFs = Object.create(nodeFs);
    fakeFs.lstatSync = (p) => (resolve(p) === resolve(link) ? statLike(nodeFs.lstatSync(target), { nlink: 2 }) : nodeFs.lstatSync(p));
    assert.throws(() => readCaptureFile(link, { fs: fakeFs }), /multiple hard links/);
  }
});

test('witness D: injected path/fd hardlink races before and after read rejected', () => {
  const file = writeFixtureFile('hardlink-races', buildCaptureBuf().buffer);
  const before = Object.create(nodeFs);
  before.lstatSync = (p) => (resolve(p) === resolve(file) ? statLike(nodeFs.lstatSync(file), { nlink: 2 }) : nodeFs.lstatSync(p));
  assert.throws(() => readCaptureFile(file, { fs: before }), /multiple hard links/);
  const fdBefore = Object.create(nodeFs);
  fdBefore.fstatSync = (fd) => statLike(nodeFs.fstatSync(fd), { nlink: 2 });
  assert.throws(() => readCaptureFile(file, { fs: fdBefore }), /multiple hard links/);
  let fc = 0;
  const fdAfter = Object.create(nodeFs);
  fdAfter.fstatSync = (fd) => { fc += 1; const st = nodeFs.fstatSync(fd); return fc === 2 ? statLike(st, { nlink: 2 }) : st; };
  assert.throws(() => readCaptureFile(file, { fs: fdAfter }), /multiple hard links/);
  let lc = 0;
  const pathAfter = Object.create(nodeFs);
  pathAfter.lstatSync = (p) => { if (resolve(p) !== resolve(file)) return nodeFs.lstatSync(p); lc += 1; const st = nodeFs.lstatSync(file); return lc === 2 ? statLike(st, { nlink: 2 }) : st; };
  assert.throws(() => readCaptureFile(file, { fs: pathAfter }), /multiple hard links/);
});

test('witness D: source-faithful single-link positive read still passes', () => {
  const file = writeFixtureFile('hardlink-positive', buildCaptureBuf().buffer);
  const loaded = readCaptureFile(file);
  assert.ok(loaded.buffer.length > 0);
  assert.equal(nodeFs.lstatSync(file).nlink, 1);
});


// Codex owner completion after exact Hermes candidate3cde028; synthetic/offline.
test('Codex R1: raw byte type, bound, mismatch and invalid UTF-8 reject before parsing', () => {
  const text = buildCapture();
  for (const rawBuffer of [undefined, null, new Uint8Array([1]), 'not-bytes', Buffer.from('SYNTHETIC_RAW_MISMATCH'), Buffer.from([255]), Buffer.alloc(MAX_INPUT_BYTES + 1)]) {
    let r;
    assert.doesNotThrow(() => { r = validateCapture(text, { rawBuffer }); });
    assert.equal(r.ok, false);
    assert.equal(r.report, null);
    assert.deepEqual(r.requests, []);
  }
  assert.equal(validateCapture(text + '\ud800').ok, false);
  assert.equal(validateCapture(text, null).ok, false);
});

test('Codex R1: source Buffer is snapshotted and exported transcript remains exact', () => {
  const text = buildCapture(), original = Buffer.from(text);
  const r = validateCapture(text, { rawBuffer: original });
  assert.equal(r.ok, true);
  original.fill(0);
  assert.equal(r.inputBuffer.equals(Buffer.from(text)), true);
  const dest = join(runDir('codex-snapshot'), 'new-output');
  const written = writeCapture(r, dest);
  assert.equal(written.ok, true, JSON.stringify(written.reasons));
  assert.equal(nodeFs.readFileSync(join(dest, 'capture-transcript.ndjson')).equals(Buffer.from(text)), true);
  assert.equal(written.transcriptSha256, sha(Buffer.from(text)));
});

test('Codex R1: changing validated transcript bytes refuses output', () => {
  const r = validateCapture(buildCapture());
  r.inputBuffer[0] ^= 1;
  const dest = join(runDir('codex-mutated-result'), 'must-not-exist');
  assert.equal(writeCapture(r, dest).ok, false);
  assert.equal(nodeFs.existsSync(dest), false);
});

test('Codex R2: malformed entries and structured indices return rejection without coercion or output', () => {
  const badEntries = [
    () => null, () => 3, () => [], () => ({}),
    (e) => ({ ...e, index: { toString: 'SYNTHETIC_INDEX_CANARY' } }),
    (e) => ({ ...e, index: [1] }), (e) => ({ ...e, index: true }),
    (e) => ({ ...e, index: 1.5 }),
    (e) => ({ ...e, rawLength: { toString: 'SYNTHETIC_INDEX_CANARY' } }),
    (e) => ({ ...e, rawLength: [1] }), (e) => ({ ...e, rawLength: '1' }),
  ];
  const dest = join(runDir('codex-malformed-metadata'), 'must-not-exist');
  for (const make of badEntries) {
    const text = buildCapture({ mutate: ({ manifest }) => { manifest.requestManifest[0] = make(manifest.requestManifest[0]); } });
    let r;
    assert.doesNotThrow(() => { r = validateCapture(text); });
    assert.equal(r.ok, false);
    assert.equal(r.report, null);
    assert.equal(writeCapture(r, dest).ok, false);
    assert.equal(nodeFs.existsSync(dest), false);
    const logs = [];
    assert.equal(runCli(['--input', 'synthetic'], { readFile: () => text, log: (m) => logs.push(m) }), 1);
    assert.equal(logs.join('').includes('SYNTHETIC_INDEX_CANARY'), false);
  }
});

test('Codex R3: only JSON whitespace is accepted around complete framing', () => {
  const text = buildCapture();
  assert.equal(validateCapture(' \t\r\n' + text + '\t\r\n ').ok, true);
  for (const forbidden of ['\u00a0', '\u000b', '\u000c', '\ufeff']) {
    assert.equal(validateCapture(forbidden + text).ok, false);
    assert.equal(validateCapture(text + forbidden).ok, false);
  }
});

test('Codex R3: BOM bytes are preserved by the file reader then rejected as framing', () => {
  const text = buildCapture();
  const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text)]);
  const file = writeFixtureFile('codex-bom-transcript', buf);
  const loaded = readCaptureFile(file);
  assert.equal(loaded.text.charCodeAt(0), 0xfeff);
  assert.equal(loaded.buffer.equals(buf), true);
  assert.equal(validateCapture(loaded.text, { rawBuffer: loaded.buffer }).ok, false);
});

function codexEncodedCapture(body, encoding) {
  const raw = encoding === 'identity' ? body : encoding === 'deflate' ? zlib.deflateSync(body) : zlib.gzipSync(body);
  return buildCapture({ mutate: ({ records, manifest }) => {
    rebindEntry(records, 1, { raw, decompressed: body, gzip: encoding !== 'identity' });
    if (encoding !== 'identity') manifest.requestManifest[0].headers.find((h) => h.name === 'content-encoding').value = encoding;
  } });
}

test('Codex R3: BOM body rejects in identity and every supported compression', () => {
  const body = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify(firstBody()))]);
  for (const encoding of ['identity', 'gzip', 'x-gzip', 'deflate']) {
    const r = validateCapture(codexEncodedCapture(body, encoding));
    assert.equal(r.ok, false, encoding);
    assert.equal(r.report, null);
  }
});

test('Codex compression: all four exact producer encodings remain accepted', () => {
  const body = Buffer.from(JSON.stringify(firstBody()));
  for (const encoding of ['identity', 'gzip', 'x-gzip', 'deflate']) {
    assert.equal(validateCapture(codexEncodedCapture(body, encoding)).ok, true, encoding);
  }
});

test('Codex R3: encoding whitelist is case-sensitive like the frozen producer', () => {
  const body = Buffer.from(JSON.stringify(firstBody()));
  for (const encoding of ['GZIP', 'Gzip', 'DEFLATE', 'IDENTITY']) {
    assert.equal(validateCapture(codexEncodedCapture(body, encoding)).ok, false, encoding);
  }
});

test('Codex R4/R5: CLI rejects without reflecting arguments and failures stay within64', () => {
  const logs = [], sentinel = 'SYNTHETIC_ARGUMENT_CANARY';
  assert.equal(runCli(['--unexpected=' + sentinel], { log: (m) => logs.push(m) }), 2);
  assert.equal(logs.join('').includes(sentinel), false);
  const text = buildCapture({ mutate: ({ records }) => {
    records.splice(2, 0, ...Array.from({ length: 100 }, () => ({ ...records[1], captureId: UUID2 })));
  } });
  const r = validateCapture(text);
  assert.equal(r.ok, false);
  assert.equal(r.reasons.length, 64);
});

test('Codex R6: confinement derives from current checkout and works for review/root names', () => {
  assert.equal(SCRATCH_ROOT, resolve(WT_ROOT, '.task-inputs', 'testscratch'));
  for (const name of ['independent-review', 'integrated-root']) {
    const scratch = resolve(dirname(WT_ROOT), name, '.task-inputs', 'testscratch');
    assert.equal(assertConfined(join(scratch, 'owned-run'), scratch), true);
    assert.equal(assertConfined(scratch, scratch), false);
    assert.equal(assertConfined(resolve(scratch, '..', 'foreign'), scratch), false);
  }
});
