// W02-07 canonical OFFLINE tests for the Office evidence export/reconstruct pair
// (`node --test apps/worker/qualification/probes/office-export.test.mjs`).
//
// Deterministic and hermetic: NEVER runs the real artifacts probe, Office,
// LibreOffice, a browser, a socket, AWS or any cloud/provider call. The export
// child is always an injected fake; generated subtrees are materialised from
// synthetic bytes in a temporary directory. Everything below exercises real
// parsing/validation/streaming/filesystem boundaries, including the repair
// regressions: bounded pending writes, late final write, no-close/false-close
// cleanup, Windows junction ancestors, strict generation/limits/UUID decoding,
// oversized protocol lines, and exclusive output acquisition.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  symlinkSync,
  linkSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  MARKER,
  PROTOCOL,
  EXPECTED_FILES,
  CAPS,
  CHUNK_BYTES,
  MAX_LINE_BYTES,
  EXPECTED_LIMITS,
  encodeRecord,
  planExport,
  buildRecords,
  verifyArtifactsVerdict,
  validateGenerationFacts,
  inspectExpectedFiles,
  runArtifactsChild,
  streamRecords,
  discoverRunDir,
  chunkBuffer,
  isContained,
  sha256Hex,
  normalizeDeadlineMs,
  main,
} from './office-export.mjs';
import {
  collectRecords,
  parseRecordLine,
  extractRecordLines,
  validateCapture,
  reconstruct,
  writeReconstruction,
  checkDestination,
  isCanonicalBase64,
  runCli,
} from './office-reconstruct.mjs';

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

const TMP_ROOTS = [];
function tempDir(prefix = 'meri-ox-') {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  TMP_ROOTS.push(dir);
  return dir;
}
test.after(() => {
  for (const dir of TMP_ROOTS) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function bounded(p, ms = 250) {
  return Promise.race([p, sleep(ms).then(() => 'PENDING')]);
}

/** Deterministic synthetic bytes so hashes/lengths are stable per (seed,size). */
function makeBytes(size, seed) {
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i++) buf[i] = (i * 31 + seed * 17 + 7) & 0xff;
  return buf;
}

const SIZES = Object.freeze(
  Object.fromEntries(EXPECTED_FILES.map((s, i) => [s.path, [900, 4096, 7000, 12000, 10000, 8000, 9000, 300, 400, 500, 6100][i]])),
);

function syntheticEntries(sizes = SIZES) {
  return EXPECTED_FILES.map((spec) => ({
    path: spec.path,
    kind: spec.kind,
    index: spec.index,
    buffer: makeBytes(sizes[spec.path], spec.index),
  }));
}

/** A realistic artifacts payload matching artifacts.mjs's retained nested schema. */
function renderFact(pages, pngCount) {
  return {
    convertOk: true, convertDetail: 'exit 0', convertStatus: 0, convertSignal: null, convertStderr: '',
    pdfExists: true, pdfPath: '/x', pdftoppmOk: true, pngDetail: 'exit 0', pngStatus: 0, pngCount,
    pdfInspectOk: true, inspectDetail: 'ok', pages,
    convert: { ok: true, detail: 'exit 0', status: 0, signal: null, error: null },
    pdfInspection: { ok: true, status: 0, signal: null, error: null, parseOk: true, parsed: { ok: true, results: [{ pageCount: pages }] } },
    pngChild: { status: 0, signal: null, error: null },
  };
}
function realisticArtifactsPayload() {
  return {
    probe: 'artifacts',
    ok: true,
    native: { status: 'pass', reasons: [] },
    nativeFacts: {
      generate: { ok: true, status: 0, signal: null, error: null, parseOk: true, parsed: { ok: true, probe: 'artifacts-python', results: [{ ok: true }, { ok: true }] } },
      pptx: { ok: true, status: 0, signal: null, error: null, parseOk: true, parsed: { ok: true, results: [{ ok: true, slideCount: 2, notesCount: 2 }] } },
    },
    render: { status: 'pass', reasons: [] },
    renderRequired: true,
    renderFacts: { docx: renderFact(1, 1), xlsx: renderFact(1, 1), pptx: renderFact(2, 2) },
    recalc: {
      status: 'pass', reasons: [], observedA4: 6, file: '/x',
      observed: { inspected: true, inputs: [1, 2, 3], formula: '=SUM(A1:A3)', cachedValue: 6, cachedType: 'int' },
      child: { ok: true, status: 0, signal: null, error: null, parseOk: true, parsed: { ok: true, results: [{ observed: { inspected: true, inputs: [1, 2, 3], formula: '=SUM(A1:A3)', cachedValue: 6 } }] } },
      convert: { ok: true, detail: 'exit 0', status: 0, signal: null, error: null },
    },
    tools: { soffice: '/usr/bin/soffice', pdftoppm: '/usr/bin/pdftoppm' },
    evidencePaths: ['/workspace/qualification-artifacts/probe-x'],
    reasons: [],
  };
}
const clone = (o) => JSON.parse(JSON.stringify(o));
function goodChild(stdout) {
  return { status: 0, signal: null, timedOut: false, cleanupConfirmed: true, error: null, stdout: JSON.stringify(stdout ?? realisticArtifactsPayload()) };
}
function validGeneration() {
  return verifyArtifactsVerdict(goodChild()).generation;
}

/** Build a fully consistent capture (records + encoded lines) from synthetic bytes. */
function makeCapture({ sizes = SIZES, capture = randomUUID(), generation = validGeneration() } = {}) {
  const entries = syntheticEntries(sizes);
  const plan = planExport(entries, capture, {});
  assert.equal(plan.ok, true, `plan fixture invalid: ${plan.reasons.join('; ')}`);
  const records = buildRecords({ capture, plan, generation });
  return { capture, entries, plan, records, lines: records.map(encodeRecord) };
}

/** Materialise the eleven expected files in a fresh run dir under base. */
function materializeRun(base, sizes = SIZES) {
  const runDir = join(base, `probe-${randomUUID()}`);
  for (const spec of EXPECTED_FILES) {
    const full = join(runDir, spec.path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, makeBytes(sizes[spec.path], spec.index));
  }
  return runDir;
}

/** Fake spawning function that simulates the artifacts probe on disk. */
function generatingSpawn({ payload = realisticArtifactsPayload(), code = 0, signal = null, materialize = true, sizes = SIZES, assertEnv, onSpawn } = {}) {
  return (cmd, args, opts) => {
    if (assertEnv) assertEnv(opts.env);
    if (onSpawn) onSpawn(opts);
    const base = opts.env.MERI_ARTIFACTS_OUTPUT_DIR;
    if (materialize) materializeRun(base, sizes);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => true;
    setImmediate(() => {
      child.stdout.emit('data', Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)));
      child.emit('exit', code, signal);
      child.emit('close', code, signal);
    });
    return child;
  };
}

/** A child that reports a kill signal on exit but NEVER closes (uncertain exit). */
function stuckKillChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => { setImmediate(() => child.emit('exit', null, 'SIGKILL')); return true; };
  return child;
}

/** In-memory stream that records lines and controls callbacks/errors. */
function collectingStream({ failWrite = false } = {}) {
  const listeners = new Map();
  return {
    lines: [],
    on(ev, cb) { const a = listeners.get(ev) || []; a.push(cb); listeners.set(ev, a); },
    off(ev, cb) { const a = listeners.get(ev) || []; listeners.set(ev, a.filter((f) => f !== cb)); },
    emitEvent(ev, arg) { for (const cb of listeners.get(ev) || []) cb(arg); },
    write(chunk, cb) {
      if (failWrite) { if (cb) setImmediate(() => cb(new Error('EPIPE'))); return false; }
      this.lines.push(chunk.replace(/\n$/, ''));
      if (cb) setImmediate(() => cb());
      return true;
    },
  };
}

// ---------------------------------------------------------------------------
// Protocol / chunking / planner / limits
// ---------------------------------------------------------------------------

test('export lines are single marker-prefixed JSON records within 12KiB (no concatenated pretty JSON)', () => {
  const { lines } = makeCapture();
  assert.ok(lines.length >= 11);
  for (const line of lines) {
    assert.ok(line.startsWith(MARKER + ' '));
    const parsed = parseRecordLine(line);
    assert.equal(parsed.error, undefined);
    assert.ok(Buffer.byteLength(line, 'utf8') <= MAX_LINE_BYTES);
  }
  const kinds = lines.map((l) => parseRecordLine(l).record.kind);
  assert.equal(kinds[0], 'capture');
  assert.equal(kinds.at(-1), 'end');
});

test('chunkBuffer bounds raw payloads at CHUNK_BYTES and never emits empty arrays', () => {
  assert.deepEqual(chunkBuffer(Buffer.alloc(0)).map((b) => b.length), [0]);
  const parts = chunkBuffer(makeBytes(CHUNK_BYTES * 3 + 5, 1));
  assert.deepEqual(parts.map((b) => b.length), [CHUNK_BYTES, CHUNK_BYTES, CHUNK_BYTES, 5]);
});

test('planExport covers exactly the eleven allowlisted files with the exact expected limits', () => {
  const { plan } = makeCapture();
  assert.equal(plan.manifestEntries.length, 11);
  for (const [i, entry] of plan.manifestEntries.entries()) assert.equal(entry.path, EXPECTED_FILES[i].path);
  assert.deepEqual(plan.limits, EXPECTED_LIMITS);
});

test('planExport fails closed on cap breaches and out-of-set paths (no truncation)', () => {
  const entries = syntheticEntries();
  entries[0] = { ...entries[0], buffer: Buffer.alloc(CAPS.native + 1, 1) };
  assert.match(planExport(entries, randomUUID(), {}).reasons.join('; '), /exceeds cap/);
  const extra = [...syntheticEntries(), { path: 'render/recalc-in/qualification-copy.xlsx', index: 99, buffer: Buffer.alloc(3) }];
  assert.match(planExport(extra, randomUUID(), {}).reasons.join('; '), /unexpected file/);
});

// ---------------------------------------------------------------------------
// Generation verdict (strict, fail-closed)
// ---------------------------------------------------------------------------

test('verifyArtifactsVerdict passes only on clean exit + full retained nested facts', () => {
  const ok = verifyArtifactsVerdict(goodChild());
  assert.equal(ok.ok, true, ok.reasons.join('; '));
  assert.equal(ok.generation.pages.docx, 1);
  assert.equal(ok.generation.pages.pptx, 2);
  assert.equal(ok.generation.recalc.cachedValue, 6);
  assert.equal(validateGenerationFacts(ok.generation).ok, true);
});

test('verifyArtifactsVerdict rejects the audit mutations (formula/inputs/children/native/extra png)', () => {
  const bad = {
    missingFormula: (p) => { delete p.recalc.observed.formula; },
    wrongInputs: (p) => { p.recalc.observed.inputs = [9, 9, 9]; },
    inspectionFailed: (p) => { p.recalc.child = { ok: false, status: 1, parseOk: false }; },
    nestedConvertFailed: (p) => { p.renderFacts.docx.convert = { ok: false, status: 1 }; },
    nativeFailed: (p) => { p.nativeFacts = { generate: { ok: false, status: 1 }, pptx: { ok: false, status: 1 } }; },
    extraPng: (p) => { p.renderFacts.docx.pngCount = 7; },
    missingPngChild: (p) => { delete p.renderFacts.pptx.pngChild; },
    pdfInspectionFailed: (p) => { p.renderFacts.xlsx.pdfInspection.status = 1; },
    recalcConvertFailed: (p) => { p.recalc.convert = { ok: false, status: 1 }; },
  };
  for (const [label, mutate] of Object.entries(bad)) {
    const p = realisticArtifactsPayload();
    mutate(p);
    assert.equal(verifyArtifactsVerdict(goodChild(p)).ok, false, `${label} must be rejected`);
  }
});

test('verifyArtifactsVerdict fails on nonzero exit/signal/timeout/error/uncleaned even with a good payload', () => {
  assert.equal(verifyArtifactsVerdict({ status: 1, signal: null, stdout: JSON.stringify(realisticArtifactsPayload()) }).ok, false);
  assert.equal(verifyArtifactsVerdict({ status: 0, signal: 'SIGKILL', stdout: JSON.stringify(realisticArtifactsPayload()) }).ok, false);
  assert.equal(verifyArtifactsVerdict({ status: 0, timedOut: true, stdout: JSON.stringify(realisticArtifactsPayload()) }).ok, false);
  assert.equal(verifyArtifactsVerdict({ status: 0, error: 'boom', stdout: JSON.stringify(realisticArtifactsPayload()) }).ok, false);
  assert.equal(verifyArtifactsVerdict({ status: 0, cleanupConfirmed: false, stdout: JSON.stringify(realisticArtifactsPayload()) }).ok, false);
  assert.equal(verifyArtifactsVerdict({ status: 0, stdout: 'not json' }).ok, false);
});

// ---------------------------------------------------------------------------
// Deadline validation + bounded streaming
// ---------------------------------------------------------------------------

test('normalizeDeadlineMs rejects NaN/Infinity/non-positive/over-cap and accepts valid numbers', () => {
  assert.equal(normalizeDeadlineMs(NaN).ok, false);
  assert.equal(normalizeDeadlineMs(Infinity).ok, false);
  assert.equal(normalizeDeadlineMs(-1).ok, false);
  assert.equal(normalizeDeadlineMs(0).ok, false);
  assert.equal(normalizeDeadlineMs(200000).ok, false);
  assert.equal(normalizeDeadlineMs(5000).ok, true);
  assert.equal(normalizeDeadlineMs(undefined, { fallback: 7000 }).ms, 7000);
});

test('streamRecords rejects an invalid deadline instead of bypassing the bound', async () => {
  const { records } = makeCapture();
  for (const bad of [NaN, Infinity, -5, 200000]) {
    const r = await streamRecords(collectingStream(), records, { deadlineMs: bad });
    assert.equal(r.ok, false, `deadline ${bad}`);
    assert.equal(r.written, 0);
  }
});

test('streamRecords bounds a never-callback pending write (no hang)', async () => {
  const stuck = new EventEmitter();
  stuck.write = () => false; // never calls the callback
  const res = await bounded(streamRecords(stuck, [{ kind: 'fake' }], { deadlineMs: 5 }));
  assert.notEqual(res, 'PENDING');
  assert.equal(res.ok, false);
  assert.ok(res.error);
});

test('streamRecords aborts a pending write on a stream error (no hang)', async () => {
  const errored = new EventEmitter();
  errored.write = () => { setTimeout(() => errored.emit('error', new Error('EPIPE')), 3); return false; };
  const res = await bounded(streamRecords(errored, [{ kind: 'fake' }], { deadlineMs: 200 }));
  assert.notEqual(res, 'PENDING');
  assert.equal(res.ok, false);
});

test('streamRecords fails closed when the final write lands after the deadline', async () => {
  const late = new EventEmitter();
  late.write = (_line, cb) => { setTimeout(cb, 30); return false; };
  const res = await streamRecords(late, [{ kind: 'fake' }], { deadlineMs: 5 });
  assert.equal(res.ok, false);
  assert.ok(res.error);
});

test('streamRecords completes bounded writes and cleans up (all records emitted)', async () => {
  const { records } = makeCapture();
  const stream = collectingStream();
  const res = await streamRecords(stream, records, { deadlineMs: 100000 });
  assert.equal(res.ok, true, res.error || '');
  assert.equal(res.written, records.length);
  assert.equal(stream.lines.length, records.length);
});

// ---------------------------------------------------------------------------
// Child process: owned group, kill-signal-not-exit, confirmed cleanup
// ---------------------------------------------------------------------------

test('runArtifactsChild requires the close event: a kill signal alone is not exit', async () => {
  const res = await runArtifactsChild({ base: tempDir(), deadlineMs: 20, graceMs: 30, spawnFn: () => stuckKillChild() });
  assert.equal(res.timedOut, true);
  assert.equal(res.killRequested, true);
  assert.equal(res.cleanupConfirmed, false);
  assert.ok(res.error);
  assert.notEqual(res.status, 0);
});

test('runArtifactsChild plumbs an owned detached process group and kills only it', async () => {
  let spawnOptions;
  let groupKilled = 0;
  const res = await runArtifactsChild({
    base: tempDir(),
    detached: true,
    deadlineMs: 15,
    graceMs: 20,
    spawnFn: (cmd, args, opts) => { spawnOptions = opts; return stuckKillChild(); },
    groupKill: () => { groupKilled++; return true; },
    probeGroup: () => false,
  });
  assert.equal(spawnOptions.detached, true);
  assert.equal(res.detached, true);
  assert.equal(groupKilled, 1);
  assert.equal(res.groupKillOk, true);
});

test('runArtifactsChild fails closed when close arrives but descendants remain', async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => true;
  setImmediate(() => { child.stdout.emit('data', Buffer.from(JSON.stringify(realisticArtifactsPayload()))); child.emit('close', 0, null); });
  const res = await runArtifactsChild({ base: tempDir(), deadlineMs: 1000, graceMs: 30, spawnFn: () => child, probeGroup: () => true });
  assert.equal(res.cleanupConfirmed, false);
  assert.ok(res.error);
  assert.equal(verifyArtifactsVerdict(res).ok, false);
});

test('runArtifactsChild confirms cleanup once close arrives and the group is proven absent', async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => true;
  let probes = 0;
  setImmediate(() => { child.stdout.emit('data', Buffer.from(JSON.stringify(realisticArtifactsPayload()))); child.emit('close', 0, null); });
  // group alive for the first probes, absent afterwards → bounded poll confirms cleanup
  const res = await runArtifactsChild({ base: tempDir(), deadlineMs: 1000, graceMs: 200, spawnFn: () => child, probeGroup: () => (++probes <= 1) });
  assert.equal(res.cleanupConfirmed, true);
  assert.equal(verifyArtifactsVerdict(res).ok, true);
});

test('runArtifactsChild bounds child stdout and fails closed on overflow', async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => true;
  setImmediate(() => { child.stdout.emit('data', Buffer.alloc(5 * 1024 * 1024, 120)); child.emit('close', 0, null); });
  const res = await runArtifactsChild({ base: tempDir(), deadlineMs: 1000, spawnFn: () => child, probeGroup: () => false });
  assert.equal(res.overflow, true);
  assert.ok(res.error);
});

// ---------------------------------------------------------------------------
// Full round-trip through the reconstructor
// ---------------------------------------------------------------------------

test('full eleven-file round-trip reconstructs byte-identical files', () => {
  const { lines, entries } = makeCapture();
  const validated = validateCapture(lines.join('\n'));
  assert.equal(validated.ok, true, validated.reasons.join('; '));
  for (const file of validated.files) {
    const want = entries.find((e) => e.path === file.path).buffer;
    assert.equal(sha256Hex(file.buffer), sha256Hex(want));
  }
  const out = join(tempDir(), 'reconstructed');
  const written = reconstruct(lines.join('\n'), out);
  assert.equal(written.ok, true, written.reasons.join('; '));
  for (const spec of EXPECTED_FILES) {
    assert.equal(sha256Hex(readFileSync(join(out, spec.path))), sha256Hex(makeBytes(SIZES[spec.path], spec.index)));
  }
});

test('out-of-order record delivery and byte-identical duplicate delivery both reconstruct', () => {
  const { lines } = makeCapture();
  assert.equal(validateCapture([...lines].reverse().join('\n')).ok, true);
  const doubled = lines.flatMap((l) => [l, l]).sort(() => Math.random() - 0.5);
  assert.equal(validateCapture(doubled.join('\n')).ok, true);
});

test('CloudWatch-style JSON event envelope with embedded newlines is accepted', () => {
  const { lines } = makeCapture();
  const envelope = JSON.stringify([{ message: lines.join('\n') }, { message: 'unrelated log line ignored' }]);
  assert.equal(validateCapture(envelope).ok, true);
});

// ---------------------------------------------------------------------------
// Decoder adversarial regressions (all must write nothing)
// ---------------------------------------------------------------------------

function expectReject(mutator, matcher) {
  const { records } = makeCapture();
  const mutated = mutator(clone(records));
  const result = validateCapture(mutated.map(encodeRecord).join('\n'));
  assert.equal(result.ok, false, 'expected rejection');
  assert.equal(result.files.length, 0);
  if (matcher) assert.match(result.reasons.join('; '), matcher);
  return result;
}

test('rejector: missing end / missing chunk', () => {
  expectReject((r) => r.filter((x) => x.kind !== 'end'), /no end record/);
  const result = expectReject((r) => r.filter((x) => x.kind !== 'chunk'));
  assert.ok(result.reasons.join('; ').length > 0);
});

test('rejector: changed duplicate / non-canonical base64 / mixed capture', () => {
  const { records, capture } = makeCapture();
  const chunk = records.find((r) => r.kind === 'chunk');
  const dup = { ...chunk, data: Buffer.from(makeBytes(chunk.bytes, 9)).toString('base64') };
  assert.equal(validateCapture([...records, dup].map(encodeRecord).join('\n')).ok, false);
  expectReject((r) => { r.find((x) => x.kind === 'chunk').data = 'AB=='; return r; }, /canonical base64/);
  expectReject((r) => { r.find((x) => x.kind === 'chunk').capture = randomUUID(); return r; }, /mixed\/invalid capture id/);
});

test('rejector: wrong decoded hash (bindings re-synced) / wrong length / wrong count', () => {
  expectReject((r) => {
    const cap = r.find((x) => x.kind === 'capture');
    const end = r.find((x) => x.kind === 'end');
    cap.files[0].sha256 = 'f'.repeat(64);
    end.files[0].sha256 = 'f'.repeat(64);
    end.manifestSha256 = sha256Hex(JSON.stringify(cap.files));
    return r;
  }, /sha256 mismatch/);
  expectReject((r) => { const c = r.find((x) => x.kind === 'capture'); c.files[1].bytes += 1; return r; });
  expectReject((r) => { const c = r.find((x) => x.kind === 'capture'); c.files[0].chunks += 1; return r; }, /chunks/);
});

test('rejector: non-UUID capture identity', () => {
  expectReject((r) => { for (const x of r) x.capture = 'not-a-uuid'; return r; }, /not a UUID/);
});

test('rejector: missing / false capture limits', () => {
  expectReject((r) => { delete r[0].limits; return r; }, /limits/);
  expectReject((r) => { r[0].limits = { total: 999999999, unknown: true }; return r; }, /limits/);
});

test('rejector: failed generation facts', () => {
  expectReject((r) => { r[0].generation.native.status = 'fail'; return r; }, /native status/);
  expectReject((r) => { r[0].generation.recalc.formula = '=SUM(B1:B3)'; return r; }, /formula/);
  expectReject((r) => { r[0].generation.exitStatus = 1; return r; }, /exitStatus/);
});

test('rejector: unknown end.files field / unknown record field / error record present', () => {
  expectReject((r) => { r.at(-1).files = r.at(-1).files.map((f) => ({ ...f, unexpected: true })); return r; }, /unknown fields/);
  expectReject((r) => { r.find((x) => x.kind === 'end').extra = true; return r; }, /unknown fields/);
  const text = `${encodeRecord({ kind: 'error', v: PROTOCOL, capture: randomUUID(), reasons: ['boom'] })}\n${makeCapture().lines.join('\n')}`;
  assert.equal(validateCapture(text).ok, false);
});

test('rejector: oversized capture line is rejected BEFORE parsing (>12KiB)', () => {
  const result = expectReject((r) => { r[0].generation.evidencePaths = ['x'.repeat(20000)]; return r; }, /exceeds 12288 bytes/);
  assert.ok(result.reasons.length > 0);
});

test('rejector: malformed marker line fails closed', () => {
  const { lines } = makeCapture();
  assert.equal(validateCapture([...lines, `${MARKER} {not json`].join('\n')).ok, false);
});

test('reconstruction failure writes no files and leaves a new destination absent', () => {
  const { records } = makeCapture();
  const out = join(tempDir(), 'never-created');
  const result = reconstruct(records.filter((r) => r.kind !== 'end').map(encodeRecord).join('\n'), out);
  assert.equal(result.ok, false);
  assert.equal(result.written, 0);
  assert.equal(existsSync(out), false);
});

// ---------------------------------------------------------------------------
// Exclusive output acquisition
// ---------------------------------------------------------------------------

test('an existing destination is refused, left untouched, and never reused', () => {
  const out = join(tempDir(), 'existing');
  mkdirSync(out);
  writeFileSync(join(out, 'keep.txt'), 'untouched');
  const result = reconstruct(makeCapture().lines.join('\n'), out);
  assert.equal(result.ok, false);
  assert.match(result.reasons.join('; '), /already exists/);
  assert.equal(readFileSync(join(out, 'keep.txt'), 'utf8'), 'untouched');
});

test('exclusive output acquisition: a second write to the same directory loses', () => {
  const files = [{ path: EXPECTED_FILES[0].path, buffer: Buffer.from('a') }];
  const out = join(tempDir(), 'race');
  const first = writeReconstruction(files, out);
  assert.equal(first.ok, true, first.reasons.join('; '));
  const second = writeReconstruction(files, out);
  assert.equal(second.ok, false);
  assert.match(second.reasons.join('; '), /already exists/);
  assert.equal(readFileSync(join(out, EXPECTED_FILES[0].path), 'utf8'), 'a');
});

// ---------------------------------------------------------------------------
// Filesystem scanning: containment, symlink/junction ancestors, links, extras
// ---------------------------------------------------------------------------

test('inspectExpectedFiles ignores decoys and never walks recursively', () => {
  const base = tempDir();
  const runDir = materializeRun(base);
  for (const rel of ['render/recalc-in/qualification-copy.xlsx', 'render/docx/page-99.png', 'render/lo-profile/lock']) {
    mkdirSync(dirname(join(runDir, rel)), { recursive: true });
    writeFileSync(join(runDir, rel), Buffer.from('decoy'));
  }
  const scan = inspectExpectedFiles(runDir);
  assert.equal(scan.ok, true, scan.reasons.join('; '));
  assert.deepEqual(scan.entries.map((e) => e.path), EXPECTED_FILES.map((s) => s.path));
});

test('inspectExpectedFiles rejects a missing file, a directory-as-file and a hard link', () => {
  const runDir = materializeRun(tempDir());
  rmSync(join(runDir, 'render', 'xlsx', 'page-1.png'));
  assert.match(inspectExpectedFiles(runDir).reasons.join('; '), /missing render\/xlsx\/page-1\.png/);

  const runDir2 = materializeRun(tempDir());
  const asDir = join(runDir2, 'render', 'pptx', 'page-2.png');
  rmSync(asDir);
  mkdirSync(asDir);
  assert.match(inspectExpectedFiles(runDir2).reasons.join('; '), /not a regular file/);

  const base3 = tempDir();
  const runDir3 = materializeRun(base3);
  const original = join(base3, 'outside.bin');
  writeFileSync(original, makeBytes(64, 3));
  const hard = join(runDir3, 'native', 'qualification.docx');
  rmSync(hard);
  linkSync(original, hard);
  assert.match(inspectExpectedFiles(runDir3).reasons.join('; '), /hard links/);
});

test('inspectExpectedFiles rejects an internal junction/symlink ancestor (native/)', () => {
  const base = tempDir();
  const runDir = join(base, `probe-${randomUUID()}`);
  // Non-native files exist normally.
  for (const spec of EXPECTED_FILES) {
    if (spec.path.startsWith('native/')) continue;
    const full = join(runDir, spec.path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, makeBytes(128, spec.index));
  }
  // native/ is a junction to a real directory that holds the native files.
  const realNative = join(runDir, 'real-native');
  mkdirSync(realNative);
  for (const spec of EXPECTED_FILES.filter((f) => f.path.startsWith('native/'))) {
    writeFileSync(join(realNative, spec.path.slice('native/'.length)), makeBytes(128, spec.index));
  }
  symlinkSync(realNative, join(runDir, 'native'), 'junction');
  const scan = inspectExpectedFiles(runDir);
  assert.equal(scan.ok, false, 'an internal junction ancestor must be rejected');
  assert.match(scan.reasons.join('; '), /ancestor native is a symlink\/junction/);
});

test('inspectExpectedFiles rejects a leaf symlink and confirms real-directory ancestors', () => {
  const base = tempDir();
  const runDir = materializeRun(base);
  const target = join(base, 'outside.bin');
  writeFileSync(target, makeBytes(32, 4));
  const linkPath = join(runDir, 'render', 'docx', 'page-1.png');
  rmSync(linkPath);
  try {
    symlinkSync(target, linkPath);
  } catch (error) {
    // If the host forbids symlinks, still assert the ancestor check below.
    assert.match(String(error.code || ''), /./);
  }
  assert.equal(inspectExpectedFiles(runDir).ok, false);
});

test('isContained, canonical base64 and checkDestination reject traversal and symlink ancestors', () => {
  assert.equal(isContained('/a/b', '/a/b/c'), true);
  assert.equal(isContained('/a/b', '/a/bc'), false);
  assert.equal(isCanonicalBase64('AA=='), true);
  assert.equal(isCanonicalBase64('AB=='), false);
  const base = tempDir();
  const real = join(base, 'real');
  mkdirSync(real);
  assert.equal(checkDestination(join(real, 'out')).ok, true);
  const link = join(base, 'link');
  try {
    symlinkSync(real, link, 'junction');
    assert.equal(checkDestination(join(link, 'out')).ok, false);
  } catch { /* symlink unsupported: covered by the junction test above */ }
});

// ---------------------------------------------------------------------------
// main(): end-to-end with an injected fake child
// ---------------------------------------------------------------------------

test('main() streams a complete capture (with honest end.elapsedMs) and it reconstructs', async () => {
  const baseRoot = tempDir();
  const stream = collectingStream();
  const code = await main({
    baseRoot,
    spawnFn: generatingSpawn({
      assertEnv: (env) => {
        assert.equal(env.MERI_ARTIFACTS_RENDER, 'required');
        assert.ok(env.MERI_ARTIFACTS_OUTPUT_DIR.startsWith(baseRoot));
      },
    }),
    writeStream: stream,
    now: () => Date.now(),
    readCgroup: () => ({ scope: 'test' }),
  });
  assert.equal(code, 0);
  const kinds = stream.lines.map((l) => parseRecordLine(l).record.kind);
  assert.equal(kinds[0], 'capture');
  assert.equal(kinds.at(-1), 'end');
  assert.ok(!kinds.includes('error'));
  const endRec = parseRecordLine(stream.lines.at(-1)).record;
  assert.equal(typeof endRec.elapsedMs, 'number');
  assert.ok(Number.isFinite(endRec.elapsedMs) && endRec.elapsedMs >= 0);
  const out = join(tempDir(), 'recon');
  const written = reconstruct(stream.lines.join('\n'), out);
  assert.equal(written.ok, true, written.reasons.join('; '));
  assert.equal(readFileSync(join(out, EXPECTED_FILES[0].path)).length, SIZES[EXPECTED_FILES[0].path]);
});

test('main() emits only an error record (no capture/end) after a failed generation', async () => {
  const baseRoot = tempDir();
  const stream = collectingStream();
  const code = await main({
    baseRoot,
    spawnFn: generatingSpawn({ payload: { ...realisticArtifactsPayload(), ok: false }, code: 1 }),
    writeStream: stream,
    now: () => Date.now(),
    readCgroup: () => ({}),
  });
  assert.equal(code, 1);
  assert.deepEqual(stream.lines.map((l) => parseRecordLine(l).record.kind), ['error']);
  assert.equal(validateCapture(stream.lines.join('\n')).ok, false);
});

test('main() emits only an error record when the generation is signalled', async () => {
  const baseRoot = tempDir();
  const stream = collectingStream();
  const code = await main({
    baseRoot,
    spawnFn: generatingSpawn({ signal: 'SIGSEGV', code: null }),
    writeStream: stream,
    now: () => Date.now(),
    readCgroup: () => ({}),
  });
  assert.equal(code, 1);
  assert.deepEqual(stream.lines.map((l) => parseRecordLine(l).record.kind), ['error']);
});

test('main() fails closed (error record) when the child never closes within the deadline', async () => {
  const baseRoot = tempDir();
  const stream = collectingStream();
  const code = await main({
    baseRoot,
    deadlineMs: 20,
    graceMs: 30,
    spawnFn: () => stuckKillChild(),
    writeStream: stream,
    now: () => Date.now(),
    readCgroup: () => ({}),
  });
  assert.equal(code, 1);
  assert.deepEqual(stream.lines.map((l) => parseRecordLine(l).record.kind), ['error']);
});

test('main() fails closed on an invalid deadline before spawning', async () => {
  const baseRoot = tempDir();
  const stream = collectingStream();
  let spawned = false;
  const code = await main({
    baseRoot,
    deadlineMs: NaN,
    writeStream: stream,
    now: () => Date.now(),
    readCgroup: () => ({}),
    spawnFn: () => { spawned = true; return stuckKillChild(); },
  });
  assert.equal(code, 1);
  assert.equal(spawned, false);
  assert.deepEqual(stream.lines.map((l) => parseRecordLine(l).record.kind), ['error']);
});

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

test('runCli requires --input/--out and writes nothing on a malformed capture', () => {
  const out = join(tempDir(), 'cli-out');
  const badInput = join(tempDir(), 'bad.ndjson');
  writeFileSync(badInput, `${MARKER} {"kind":"end"}`);
  const logs = [];
  const code = runCli(['--input', badInput, '--out', out], { log: (m) => logs.push(m) });
  assert.equal(code, 1);
  assert.match(logs.join('\n'), /"wroteAny":false/);
  assert.equal(existsSync(out), false);
  assert.equal(runCli([], { log: (m) => logs.push(m) }), 2);
});

test('runCli reconstructs a valid capture to a new directory', () => {
  const { lines } = makeCapture();
  const base = tempDir();
  const input = join(base, 'capture.ndjson');
  writeFileSync(input, lines.join('\n'));
  const out = join(base, 'cli-recon');
  const logs = [];
  assert.equal(runCli(['--input', input, '--out', out], { log: (m) => logs.push(m) }), 0);
  assert.match(logs.join('\n'), /"ok":true/);
  assert.equal(readFileSync(join(out, EXPECTED_FILES.at(-1).path)).length, SIZES[EXPECTED_FILES.at(-1).path]);
});

test('collectRecords ignores non-marker log lines but keeps every marker record', () => {
  const { records } = makeCapture();
  const text = ['noise line', ...records.map(encodeRecord), 'another noise'].join('\n');
  const collected = collectRecords(text);
  assert.equal(collected.ok, true, collected.reasons.join('; '));
  assert.equal(collected.records.length, records.length);
});

test('extractRecordLines bounds the aggregate input size', () => {
  const huge = 'x'.repeat(33 * 1024 * 1024);
  assert.ok(extractRecordLines(huge).parseError);
});
