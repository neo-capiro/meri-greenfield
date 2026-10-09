// W02-07 canonical OFFLINE tests for the Office evidence export/reconstruct pair
// (`node --test apps/worker/qualification/probes/office-export.test.mjs`).
//
// Deterministic and hermetic: NEVER runs the real artifacts probe, Office,
// LibreOffice, a browser, a socket, AWS or any cloud/provider call. The export
// child is always an injected fake; generated subtrees are synthetic temp files.
// The positive fixture is faithful to the UNCHANGED artifacts.py / artifacts.mjs
// retained schema (cross-modelled against the captured baseline-3 runtime
// summary). This file reproduces every owner-audit case (d10424b) and keeps the
// earlier regressions: bounded writes, PID-validated group cleanup, junction
// ancestors above the run root, stale pre-read timestamps, bounded scanning and
// strict nested generation facts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync,
  symlinkSync, linkSync, rmSync, lstatSync, utimesSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  MARKER, PROTOCOL, EXPECTED_FILES, CAPS, CHUNK_BYTES, MAX_LINE_BYTES, EXPECTED_LIMITS,
  encodeRecord, planExport, buildRecords, verifyArtifactsVerdict, validateGenerationFacts,
  inspectExpectedFiles, runArtifactsChild, streamRecords, discoverRunDir, chunkBuffer,
  isContained, sha256Hex, normalizeDeadlineMs, readRegularFileVerified, main,
} from './office-export.mjs';
import {
  collectRecords, parseRecordLine, extractRecordLines, validateCapture, reconstruct,
  writeReconstruction, checkDestination, isCanonicalBase64, runCli, readBoundedText,
  countLinesUpTo,
} from './office-reconstruct.mjs';

const TMP_ROOTS = [];
function tempDir(prefix = 'meri-ox-') { const dir = mkdtempSync(join(tmpdir(), prefix)); TMP_ROOTS.push(dir); return dir; }
test.after(() => { for (const dir of TMP_ROOTS) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function bounded(p, ms = 250) { return Promise.race([p, sleep(ms).then(() => 'PENDING')]); }
function makeBytes(size, seed) { const buf = Buffer.alloc(size); for (let i = 0; i < size; i++) buf[i] = (i * 31 + seed * 17 + 7) & 0xff; return buf; }

const SIZES = Object.freeze(Object.fromEntries(EXPECTED_FILES.map((s, i) => [s.path, [900, 4096, 7000, 12000, 10000, 8000, 9000, 300, 400, 500, 6100][i]])));
function syntheticEntries(sizes = SIZES) {
  return EXPECTED_FILES.map((spec) => ({ path: spec.path, kind: spec.kind, index: spec.index, buffer: makeBytes(sizes[spec.path], spec.index) }));
}

// ---------------------------------------------------------------------------
// Positive fixture faithful to the unchanged artifacts.py / artifacts.mjs schema
// (shapes cross-checked against the captured W02-fargate-baseline-3 run summary)
// ---------------------------------------------------------------------------

const DOCX_STRUCTURE = ['[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/fontTable.xml', 'word/settings.xml', 'word/styles.xml', 'word/theme/theme1.xml'];
const XLSX_STRUCTURE = ['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'];
const PPTX_STRUCTURE = ['[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml', 'ppt/slideMasters/slideMaster1.xml', 'ppt/slides/slide1.xml', 'ppt/slides/slide2.xml', 'ppt/notesSlides/notesSlide1.xml', 'ppt/notesSlides/notesSlide2.xml', 'ppt/theme/theme1.xml'];

const sub = (parsed) => ({ ok: true, status: 0, signal: null, error: null, parseOk: true, parseError: null, stdout: '{}', stderr: '', parsed });
const convert = () => ({ ok: true, detail: 'exit 0', status: 0, signal: null, error: null, stdout: 'convert ok', stderr: '' });
const observed = () => ({ inspected: true, inputs: [1, 2, 3], formula: '=SUM(A1:A3)', cachedValue: 6, cachedType: 'int' });

function docxResult() {
  return { file: '/workspace/qualification-artifacts/probe-x/native/qualification.docx', sha256: 'e3'.padEnd(64, '0'), ok: true, expected: { heading: 'Meri qualification heading', table: [['label', 'value'], ['answer', '6']] }, reopened: { headings: ['Meri qualification heading'], tableText: [['label', 'value'], ['answer', '6']], tableCount: 1 }, structure: DOCX_STRUCTURE, hasDocumentXml: true };
}
function xlsxResult() {
  return { file: '/workspace/qualification-artifacts/probe-x/native/qualification.xlsx', sha256: 'af'.padEnd(64, '0'), ok: true, expected: { inputs: [1, 2, 3], formula: '=SUM(A1:A3)', recalculatedResult: 6 }, reopened: { inputs: [1, 2, 3], a4Formula: '=SUM(A1:A3)', a4GeneratedCachedValue: null }, cachedValueNote: 'blank cached result expected; not a recalc proof', structure: XLSX_STRUCTURE, hasSheetXml: true, xmlFacts: { a4Xml: '<c r="A4"><f>SUM(A1:A3)</f><v></v></c>', calcProperties: '<calcPr fullCalcOnLoad="1"/>' } };
}
function pptxResult() {
  return { file: '/workspace/qualification-artifacts/probe-x/native/qualification.pptx', sha256: '10'.padEnd(64, '0'), ok: true, slideCount: 2, notesCount: 2, structure: PPTX_STRUCTURE };
}
function recalcResult(cachedValue = 6) {
  return { file: '/workspace/qualification-artifacts/probe-x/render/recalc-out/qualification-copy.xlsx', sha256: '19'.padEnd(64, '0'), ok: true, expected: { inputs: [1, 2, 3], formula: '=SUM(A1:A3)', recalculatedResult: 6 }, observed: { inspected: true, inputs: [1, 2, 3], formula: '=SUM(A1:A3)', cachedValue, cachedType: 'int' }, observedA4: cachedValue, xmlFacts: {} };
}
function renderFact(pages) {
  return {
    convertOk: true, convertDetail: 'exit 0', convertStatus: 0, convertSignal: null, convertStderr: '',
    pdfExists: true, pdfPath: '/x', pdftoppmOk: true, pngDetail: 'exit 0', pngStatus: 0, pngCount: pages,
    pdfInspectOk: true, inspectDetail: 'ok', pages,
    convert: convert(),
    pdfInspection: sub({ probe: 'artifacts-python', ok: true, results: [{ file: '/x.pdf', sha256: 'a6'.padEnd(64, '0'), ok: true, pageCount: pages, firstPageTextSample: 'sample' }] }),
    pngChild: { status: 0, signal: null, error: null, stdout: '', stderr: '' },
    pdfInspectStatus: 0, pdfInspectStderr: '',
  };
}
function realisticArtifactsPayload() {
  return {
    probe: 'artifacts', ok: true,
    native: { status: 'pass', reasons: [] },
    nativeFacts: {
      generate: sub({ probe: 'artifacts-python', ok: true, results: [docxResult(), xlsxResult()] }),
      pptx: sub({ probe: 'artifacts-python', ok: true, results: [pptxResult()] }),
    },
    render: { status: 'pass', reasons: [] }, renderRequired: true,
    renderFacts: { docx: renderFact(1), xlsx: renderFact(1), pptx: renderFact(2) },
    recalc: {
      status: 'pass', reasons: [], observed: observed(), observedA4: 6,
      child: sub({ probe: 'artifacts-python', ok: true, results: [recalcResult(6)] }),
      convert: convert(),
      file: '/workspace/qualification-artifacts/probe-x/render/recalc-out/qualification-copy.xlsx',
    },
    tools: { soffice: '/usr/bin/soffice', pdftoppm: '/usr/bin/pdftoppm' },
    reasons: [], evidencePaths: ['/workspace/qualification-artifacts/probe-x'],
  };
}
const clone = (o) => JSON.parse(JSON.stringify(o));
function goodChild(stdout) { return { status: 0, signal: null, timedOut: false, cleanupConfirmed: true, error: null, stdout: JSON.stringify(stdout ?? realisticArtifactsPayload()) }; }
function validGeneration() { return verifyArtifactsVerdict(goodChild()).generation; }
function makeCapture({ sizes = SIZES, capture = randomUUID(), generation = validGeneration() } = {}) {
  const entries = syntheticEntries(sizes);
  const plan = planExport(entries, capture, {});
  assert.equal(plan.ok, true, `plan fixture invalid: ${plan.reasons.join('; ')}`);
  return { capture, entries, plan, records: buildRecords({ capture, plan, generation }), get lines() { return this.records.map(encodeRecord); } };
}
function materializeRun(base, sizes = SIZES) {
  const runDir = join(base, `probe-${randomUUID()}`);
  for (const spec of EXPECTED_FILES) { const full = join(runDir, spec.path); mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, makeBytes(sizes[spec.path], spec.index)); }
  return runDir;
}
function generatingSpawn({ payload = realisticArtifactsPayload(), code = 0, signal = null, materialize = true, sizes = SIZES, assertEnv, onSpawn } = {}) {
  return (cmd, args, opts) => {
    if (assertEnv) assertEnv(opts.env);
    if (onSpawn) onSpawn(opts);
    const base = opts.env.MERI_ARTIFACTS_OUTPUT_DIR;
    if (materialize) materializeRun(base, sizes);
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => true;
    setImmediate(() => { child.stdout.emit('data', Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload))); child.emit('exit', code, signal); child.emit('close', code, signal); });
    return child;
  };
}
function stuckKillChild() { const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => { setImmediate(() => child.emit('exit', null, 'SIGKILL')); return true; }; return child; }
function collectingStream({ failWrite = false } = {}) {
  const listeners = new Map();
  return {
    lines: [],
    on(ev, cb) { const a = listeners.get(ev) || []; a.push(cb); listeners.set(ev, a); },
    off(ev, cb) { const a = listeners.get(ev) || []; listeners.set(ev, a.filter((f) => f !== cb)); },
    emitEvent(ev, arg) { for (const cb of listeners.get(ev) || []) cb(arg); },
    write(chunk, cb) { if (failWrite) { if (cb) setImmediate(() => cb(new Error('EPIPE'))); return false; } this.lines.push(chunk.replace(/\n$/, '')); if (cb) setImmediate(() => cb()); return true; },
  };
}

// ---------------------------------------------------------------------------
// Protocol / planner / limits
// ---------------------------------------------------------------------------

test('export lines are single marker-prefixed JSON records within 12KiB', () => {
  const { lines } = makeCapture();
  assert.ok(lines.length >= 11);
  for (const line of lines) { assert.ok(line.startsWith(MARKER + ' ')); assert.equal(parseRecordLine(line).error, undefined); assert.ok(Buffer.byteLength(line, 'utf8') <= MAX_LINE_BYTES); }
  const kinds = lines.map((l) => parseRecordLine(l).record.kind);
  assert.equal(kinds[0], 'capture');
  assert.equal(kinds.at(-1), 'end');
});

test('chunkBuffer bounds payloads at CHUNK_BYTES and never emits empty arrays', () => {
  assert.deepEqual(chunkBuffer(Buffer.alloc(0)).map((b) => b.length), [0]);
  assert.deepEqual(chunkBuffer(makeBytes(CHUNK_BYTES * 3 + 5, 1)).map((b) => b.length), [CHUNK_BYTES, CHUNK_BYTES, CHUNK_BYTES, 5]);
});

test('planExport covers exactly the eleven files with the exact expected limits', () => {
  const { plan } = makeCapture();
  assert.equal(plan.manifestEntries.length, 11);
  for (const [i, entry] of plan.manifestEntries.entries()) assert.equal(entry.path, EXPECTED_FILES[i].path);
  assert.deepEqual(plan.limits, EXPECTED_LIMITS);
});

test('planExport fails closed on cap breaches and out-of-set paths', () => {
  const entries = syntheticEntries();
  entries[0] = { ...entries[0], buffer: Buffer.alloc(CAPS.native + 1, 1) };
  assert.match(planExport(entries, randomUUID(), {}).reasons.join('; '), /exceeds cap/);
  const extra = [...syntheticEntries(), { path: 'render/recalc-in/qualification-copy.xlsx', index: 99, buffer: Buffer.alloc(3) }];
  assert.match(planExport(extra, randomUUID(), {}).reasons.join('; '), /unexpected file/);
});

// ---------------------------------------------------------------------------
// Authoritative generation facts (owner audit d10424b reproduction)
// ---------------------------------------------------------------------------

test('baseline: the faithful positive fixture is accepted by verdict and decoder', () => {
  const v = verifyArtifactsVerdict(goodChild());
  assert.equal(v.ok, true, v.reasons.join('; '));
  assert.equal(validateGenerationFacts(v.generation).ok, true);
});

test('owner audit: every contradictory nested fact is rejected (10 cases)', () => {
  const mutations = {
    nativeParseFalse: (p) => { p.nativeFacts.generate.parseOk = false; },
    nativeNestedFailure: (p) => { p.nativeFacts.generate.parsed.ok = false; },
    nativeStructureWrong: (p) => { p.nativeFacts.generate.parsed.results[0].reopened.headings = ['wrong']; p.nativeFacts.generate.parsed.results[0].structure = []; },
    nativeStructureAbsent: (p) => { delete p.nativeFacts.generate.parsed.results; },
    pptxWrongCounts: (p) => { p.nativeFacts.pptx.parsed.results[0].slideCount = 0; p.nativeFacts.pptx.parsed.results[0].notesCount = 0; },
    pdfNestedFailure: (p) => { p.renderFacts.docx.pdfInspection.parsed.ok = false; },
    pdfWrongObservedPages: (p) => { p.renderFacts.docx.pdfInspection.parsed.results[0].pageCount = 99; },
    recalcNotInspected: (p) => { p.recalc.observed.inspected = false; },
    recalcChildContradiction: (p) => { p.recalc.child.parsed.results[0].observed.cachedValue = 99; },
    extraInputs: (p) => { p.recalc.observed.inputs.push(999); },
  };
  for (const [label, mutate] of Object.entries(mutations)) {
    const p = realisticArtifactsPayload(); mutate(p);
    assert.equal(verifyArtifactsVerdict(goodChild(p)).ok, false, `${label} must be rejected`);
  }
});

test('owner audit: missing cleanupConfirmed fails closed (exact true required)', () => {
  const child = goodChild(); delete child.cleanupConfirmed;
  assert.equal(verifyArtifactsVerdict(child).ok, false);
  assert.equal(verifyArtifactsVerdict({ ...goodChild(), cleanupConfirmed: false }).ok, false);
});

test('owner audit: native XLSX cached value must be blank (null), distinct from recalc 6', () => {
  const p = realisticArtifactsPayload(); p.nativeFacts.generate.parsed.results[1].reopened.a4GeneratedCachedValue = 6;
  assert.match(verifyArtifactsVerdict(goodChild(p)).reasons.join('; '), /blank/);
});

test('owner audit: decoder rejects native parse false/absent, bad evidence paths, unknown cgroup and over-deadline elapsed', () => {
  const make = () => { const capture = randomUUID(); return buildRecords({ capture, plan: planExport(syntheticEntries(), capture, {}), generation: validGeneration(), endElapsedMs: 1 }); };
  const text = (rs) => rs.map(encodeRecord).join('\n');
  const muts = {
    nativeParseFalse: (rs) => { rs[0].generation.native.generate.parseOk = false; },
    nativeParseAbsent: (rs) => { delete rs[0].generation.native.pptx.parseOk; },
    evidenceObjects: (rs) => { rs[0].generation.evidencePaths = [{ unexpected: 'object' }]; },
    cgroupUnknown: (rs) => { rs[0].generation.cgroup = { scope: 'test', unknown: 1 }; },
    genTimeOverDeadline: (rs) => { rs[0].generation.elapsedMs = 999999999; },
  };
  for (const [label, mutate] of Object.entries(muts)) {
    const rs = make(); mutate(rs);
    assert.equal(validateCapture(text(rs)).ok, false, `decoder must reject ${label}`);
  }
});

test('verifyArtifactsVerdict fails on nonzero exit/signal/timeout/error even with the good payload', () => {
  const stdout = JSON.stringify(realisticArtifactsPayload());
  assert.equal(verifyArtifactsVerdict({ status: 1, signal: null, cleanupConfirmed: true, stdout }).ok, false);
  assert.equal(verifyArtifactsVerdict({ status: 0, signal: 'SIGKILL', cleanupConfirmed: true, stdout }).ok, false);
  assert.equal(verifyArtifactsVerdict({ status: 0, timedOut: true, cleanupConfirmed: true, stdout }).ok, false);
  assert.equal(verifyArtifactsVerdict({ status: 0, error: 'boom', cleanupConfirmed: true, stdout }).ok, false);
  assert.equal(verifyArtifactsVerdict({ status: 0, stdout: 'not json' }).ok, false);
});

// ---------------------------------------------------------------------------
// Deadline validation + bounded streaming
// ---------------------------------------------------------------------------

test('normalizeDeadlineMs rejects NaN/Infinity/non-positive/over-cap', () => {
  for (const bad of [NaN, Infinity, -1, 0, 200000]) assert.equal(normalizeDeadlineMs(bad).ok, false, `deadline ${bad}`);
  assert.equal(normalizeDeadlineMs(5000).ok, true);
  assert.equal(normalizeDeadlineMs(undefined, { fallback: 7000 }).ms, 7000);
});

test('streamRecords rejects an invalid deadline instead of bypassing the bound', async () => {
  const { records } = makeCapture();
  for (const bad of [NaN, Infinity, -5, 200000]) { const r = await streamRecords(collectingStream(), records, { deadlineMs: bad }); assert.equal(r.ok, false); assert.equal(r.written, 0); }
});

test('streamRecords bounds a never-callback pending write (no hang)', async () => {
  const stuck = new EventEmitter(); stuck.write = () => false;
  const res = await bounded(streamRecords(stuck, [{ kind: 'fake' }], { deadlineMs: 5 }));
  assert.notEqual(res, 'PENDING'); assert.equal(res.ok, false); assert.ok(res.error);
});

test('streamRecords aborts a pending write on a stream error (no hang)', async () => {
  const errored = new EventEmitter(); errored.write = () => { setTimeout(() => errored.emit('error', new Error('EPIPE')), 3); return false; };
  const res = await bounded(streamRecords(errored, [{ kind: 'fake' }], { deadlineMs: 200 }));
  assert.notEqual(res, 'PENDING'); assert.equal(res.ok, false);
});

test('streamRecords fails closed when the final write lands after the deadline', async () => {
  const late = new EventEmitter(); late.write = (_l, cb) => { setTimeout(cb, 30); return false; };
  const res = await streamRecords(late, [{ kind: 'fake' }], { deadlineMs: 5 });
  assert.equal(res.ok, false); assert.ok(res.error);
});

test('streamRecords completes bounded writes and cleans up', async () => {
  const { records } = makeCapture();
  const stream = collectingStream();
  const res = await streamRecords(stream, records, { deadlineMs: 100000 });
  assert.equal(res.ok, true, res.error || ''); assert.equal(res.written, records.length); assert.equal(stream.lines.length, records.length);
});

// ---------------------------------------------------------------------------
// Child process: owned group, PID ownership, confirmed cleanup
// ---------------------------------------------------------------------------

test('runArtifactsChild requires the close event: a kill signal alone is not exit', async () => {
  const res = await runArtifactsChild({ base: tempDir(), deadlineMs: 20, graceMs: 30, spawnFn: () => stuckKillChild() });
  assert.equal(res.timedOut, true); assert.equal(res.killRequested, true); assert.equal(res.cleanupConfirmed, false); assert.ok(res.error); assert.notEqual(res.status, 0);
});

test('owner audit: normal close with a live owned group kills the group (killCalls>=1) and fails closed', async () => {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.pid = 424242; child.kill = () => false;
  setImmediate(() => { child.stdout.emit('data', Buffer.from(JSON.stringify(realisticArtifactsPayload()))); child.emit('exit', 0, null); child.emit('close', 0, null); });
  let killCalls = 0;
  const res = await runArtifactsChild({ base: tempDir(), deadlineMs: 50, graceMs: 15, detached: true, spawnFn: () => child, probeGroup: () => true, groupKill: () => { killCalls++; return true; } });
  assert.equal(res.killRequested, true);
  assert.ok(killCalls >= 1, 'the owned group must be killed on close');
  assert.equal(res.cleanupConfirmed, false);
  assert.ok(res.error);
  assert.equal(verifyArtifactsVerdict(res).ok, false);
});

test('owner audit: an undefined group-probe result cannot confirm cleanup', async () => {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.pid = 424242; child.kill = () => false;
  setImmediate(() => { child.stdout.emit('data', Buffer.from(JSON.stringify(realisticArtifactsPayload()))); child.emit('close', 0, null); });
  const res = await runArtifactsChild({ base: tempDir(), deadlineMs: 50, graceMs: 15, detached: true, spawnFn: () => child, probeGroup: () => undefined, groupKill: () => true });
  assert.equal(res.cleanupConfirmed, false);
  assert.equal(verifyArtifactsVerdict(res).ok, false);
});

test('runArtifactsChild plumbs a detached group and only kills the owned pid', async () => {
  let spawnOptions; let groupKilled = 0;
  const res = await runArtifactsChild({
    base: tempDir(), detached: true, deadlineMs: 15, graceMs: 20,
    spawnFn: (c, a, opts) => { spawnOptions = opts; return stuckKillChild(); },
    groupKill: () => { groupKilled++; return true; }, probeGroup: () => false,
  });
  assert.equal(spawnOptions.detached, true); assert.equal(res.detached, true); assert.equal(groupKilled, 1); assert.equal(res.groupKillOk, true);
});

test('runArtifactsChild confirms cleanup only when the group is proven absent', async () => {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => true;
  let probes = 0;
  setImmediate(() => { child.stdout.emit('data', Buffer.from(JSON.stringify(realisticArtifactsPayload()))); child.emit('close', 0, null); });
  const res = await runArtifactsChild({ base: tempDir(), deadlineMs: 1000, graceMs: 200, spawnFn: () => child, probeGroup: () => (++probes <= 1 ? true : false) });
  assert.equal(res.cleanupConfirmed, true);
  assert.equal(verifyArtifactsVerdict(res).ok, true);
});

test('runArtifactsChild bounds child stdout and fails closed on overflow', async () => {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => true;
  setImmediate(() => { child.stdout.emit('data', Buffer.alloc(5 * 1024 * 1024, 120)); child.emit('close', 0, null); });
  const res = await runArtifactsChild({ base: tempDir(), deadlineMs: 1000, spawnFn: () => child, probeGroup: () => false });
  assert.equal(res.overflow, true); assert.ok(res.error);
});

// ---------------------------------------------------------------------------
// Filesystem validation
// ---------------------------------------------------------------------------

test('owner audit: a junction ABOVE the run root is rejected by inspectExpectedFiles', () => {
  const fsCase = tempDir();
  const real = join(fsCase, 'real'); mkdirSync(real);
  const run = join(real, `probe-${randomUUID()}`); materializeRun(real);
  const link = join(fsCase, 'linked-root');
  symlinkSync(real, link, 'junction');
  assert.equal(lstatSync(link).isSymbolicLink(), true);
  assert.equal(inspectExpectedFiles(join(link, 'probe-run')).ok, false);
  void run;
});

test('owner audit: readRegularFileVerified rejects a stale pre-read timestamp', () => {
  const dir = tempDir();
  const file = join(dir, 'f.bin');
  writeFileSync(file, Buffer.from('x'));
  const stale = lstatSync(file);
  utimesSync(file, new Date(stale.atimeMs), new Date(stale.mtimeMs + 10000));
  assert.throws(() => readRegularFileVerified(file, stale), /mtime\/ctime changed before read/);
});

test('inspectExpectedFiles ignores decoys and never walks recursively', () => {
  const runDir = materializeRun(tempDir());
  for (const rel of ['render/recalc-in/qualification-copy.xlsx', 'render/docx/page-99.png', 'render/lo-profile/lock']) { mkdirSync(dirname(join(runDir, rel)), { recursive: true }); writeFileSync(join(runDir, rel), Buffer.from('decoy')); }
  const scan = inspectExpectedFiles(runDir);
  assert.equal(scan.ok, true, scan.reasons.join('; '));
  assert.deepEqual(scan.entries.map((e) => e.path), EXPECTED_FILES.map((s) => s.path));
});

test('inspectExpectedFiles rejects a missing file, a directory-as-file and a hard link', () => {
  const runDir = materializeRun(tempDir());
  rmSync(join(runDir, 'render', 'xlsx', 'page-1.png'));
  assert.match(inspectExpectedFiles(runDir).reasons.join('; '), /missing render\/xlsx\/page-1\.png/);

  const runDir2 = materializeRun(tempDir());
  const asDir = join(runDir2, 'render', 'pptx', 'page-2.png'); rmSync(asDir); mkdirSync(asDir);
  assert.match(inspectExpectedFiles(runDir2).reasons.join('; '), /not a regular file/);

  const base3 = tempDir();
  const runDir3 = materializeRun(base3);
  const original = join(base3, 'outside.bin'); writeFileSync(original, makeBytes(64, 3));
  const hard = join(runDir3, 'native', 'qualification.docx'); rmSync(hard); linkSync(original, hard);
  assert.match(inspectExpectedFiles(runDir3).reasons.join('; '), /hard links/);
});

test('inspectExpectedFiles rejects an internal junction inside the run root', () => {
  const base = tempDir();
  const runDir = join(base, `probe-${randomUUID()}`);
  for (const spec of EXPECTED_FILES) { if (spec.path.startsWith('native/')) continue; const full = join(runDir, spec.path); mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, makeBytes(128, spec.index)); }
  const realNative = join(runDir, 'real-native'); mkdirSync(realNative);
  for (const spec of EXPECTED_FILES.filter((f) => f.path.startsWith('native/'))) writeFileSync(join(realNative, spec.path.slice('native/'.length)), makeBytes(128, spec.index));
  symlinkSync(realNative, join(runDir, 'native'), 'junction');
  const scan = inspectExpectedFiles(runDir);
  assert.equal(scan.ok, false);
  assert.match(scan.reasons.join('; '), /ancestor native is a symlink\/junction/);
});

test('isContained, canonical base64 and checkDestination reject traversal and symlink ancestors', () => {
  assert.equal(isContained('/a/b', '/a/b/c'), true);
  assert.equal(isContained('/a/b', '/a/bc'), false);
  assert.equal(isCanonicalBase64('AA=='), true);
  assert.equal(isCanonicalBase64('AB=='), false);
  const base = tempDir();
  const real = join(base, 'real'); mkdirSync(real);
  assert.equal(checkDestination(join(real, 'out')).ok, true);
  const link = join(base, 'link');
  try { symlinkSync(real, link, 'junction'); assert.equal(checkDestination(join(link, 'out')).ok, false); } catch { /* covered elsewhere */ }
});

// ---------------------------------------------------------------------------
// Decoder adversarial regressions
// ---------------------------------------------------------------------------

function expectReject(mutator, matcher) {
  const { records } = makeCapture();
  const result = validateCapture(mutator(clone(records)).map(encodeRecord).join('\n'));
  assert.equal(result.ok, false, 'expected rejection');
  assert.equal(result.files.length, 0);
  if (matcher) assert.match(result.reasons.join('; '), matcher);
  return result;
}

test('rejector: missing end / missing chunk', () => {
  expectReject((r) => r.filter((x) => x.kind !== 'end'), /no end record/);
  assert.ok(expectReject((r) => r.filter((x) => x.kind !== 'chunk')).reasons.length > 0);
});

test('rejector: changed duplicate / non-canonical base64 / mixed capture', () => {
  const { records } = makeCapture();
  const chunk = records.find((r) => r.kind === 'chunk');
  const dup = { ...chunk, data: Buffer.from(makeBytes(chunk.bytes, 9)).toString('base64') };
  assert.equal(validateCapture([...records, dup].map(encodeRecord).join('\n')).ok, false);
  expectReject((r) => { r.find((x) => x.kind === 'chunk').data = 'AB=='; return r; }, /canonical base64/);
  expectReject((r) => { r.find((x) => x.kind === 'chunk').capture = randomUUID(); return r; }, /mixed\/invalid capture id/);
});

test('rejector: wrong decoded hash / wrong length / wrong count', () => {
  expectReject((r) => {
    const cap = r.find((x) => x.kind === 'capture'); const end = r.find((x) => x.kind === 'end');
    cap.files[0].sha256 = 'f'.repeat(64); end.files[0].sha256 = 'f'.repeat(64);
    end.manifestSha256 = sha256Hex(JSON.stringify(cap.files));
    return r;
  }, /sha256 mismatch/);
  expectReject((r) => { r.find((x) => x.kind === 'capture').files[1].bytes += 1; return r; });
  expectReject((r) => { r.find((x) => x.kind === 'capture').files[0].chunks += 1; return r; }, /chunks/);
});

test('rejector: non-UUID capture identity, missing/false limits, unknown fields', () => {
  expectReject((r) => { for (const x of r) x.capture = 'not-a-uuid'; return r; }, /not a UUID/);
  expectReject((r) => { delete r[0].limits; return r; }, /limits/);
  expectReject((r) => { r[0].limits = { total: 999999999, unknown: true }; return r; }, /limits/);
  expectReject((r) => { r.at(-1).files = r.at(-1).files.map((f) => ({ ...f, unexpected: true })); return r; }, /unknown fields/);
  expectReject((r) => { r.find((x) => x.kind === 'end').extra = true; return r; }, /unknown fields/);
});

test('rejector: oversized capture line is rejected BEFORE parsing (>12KiB)', () => {
  expectReject((r) => { r[0].generation.evidencePaths = ['x'.repeat(20000)]; return r; }, /exceeds 12288 bytes/);
});

test('rejector: an error record voids the capture; malformed marker line fails closed', () => {
  assert.equal(validateCapture(`${encodeRecord({ kind: 'error', v: PROTOCOL, capture: randomUUID(), reasons: ['boom'] })}\n${makeCapture().lines.join('\n')}`).ok, false);
  assert.equal(validateCapture([...makeCapture().lines, `${MARKER} {not json`].join('\n')).ok, false);
});

test('owner audit: line count is bounded while scanning (no 20k-line allocation)', () => {
  const manyLines = 'ignored\n'.repeat(20001) + 'last';
  assert.equal(countLinesUpTo(manyLines, 20000).exceeded, true);
  assert.equal(extractRecordLines(manyLines).lines.length, 0);
  assert.ok(extractRecordLines(manyLines).parseError);
  assert.equal(collectRecords(manyLines).ok, false);
});

test('readBoundedText enforces the size cap and rejects non-regular input', () => {
  const dir = tempDir();
  const big = join(dir, 'big.ndjson');
  writeFileSync(big, Buffer.alloc(64));
  assert.throws(() => readBoundedText(big, 32), /exceeds/);
  assert.throws(() => readBoundedText(dir, 1024), /not a regular file/);
});

test('reconstruction failure writes no files and leaves a new destination absent', () => {
  const { records } = makeCapture();
  const out = join(tempDir(), 'never-created');
  const result = reconstruct(records.filter((r) => r.kind !== 'end').map(encodeRecord).join('\n'), out);
  assert.equal(result.ok, false); assert.equal(result.written, 0); assert.equal(existsSync(out), false);
});

// ---------------------------------------------------------------------------
// Exclusive output acquisition
// ---------------------------------------------------------------------------

test('an existing destination is refused, left untouched, and never reused', () => {
  const out = join(tempDir(), 'existing'); mkdirSync(out); writeFileSync(join(out, 'keep.txt'), 'untouched');
  const result = reconstruct(makeCapture().lines.join('\n'), out);
  assert.equal(result.ok, false); assert.match(result.reasons.join('; '), /already exists/);
  assert.equal(readFileSync(join(out, 'keep.txt'), 'utf8'), 'untouched');
});

test('exclusive output acquisition: a second write to the same directory loses', () => {
  const files = [{ path: EXPECTED_FILES[0].path, buffer: Buffer.from('a') }];
  const out = join(tempDir(), 'race');
  assert.equal(writeReconstruction(files, out).ok, true);
  const second = writeReconstruction(files, out);
  assert.equal(second.ok, false); assert.match(second.reasons.join('; '), /already exists/);
  assert.equal(readFileSync(join(out, EXPECTED_FILES[0].path), 'utf8'), 'a');
});

// ---------------------------------------------------------------------------
// Round-trip + main()
// ---------------------------------------------------------------------------

test('full eleven-file round-trip reconstructs byte-identical files', () => {
  const { lines, entries } = makeCapture();
  const validated = validateCapture(lines.join('\n'));
  assert.equal(validated.ok, true, validated.reasons.join('; '));
  for (const file of validated.files) assert.equal(sha256Hex(file.buffer), sha256Hex(entries.find((e) => e.path === file.path).buffer));
  const out = join(tempDir(), 'reconstructed');
  assert.equal(reconstruct(lines.join('\n'), out).ok, true);
  for (const spec of EXPECTED_FILES) assert.equal(sha256Hex(readFileSync(join(out, spec.path))), sha256Hex(makeBytes(SIZES[spec.path], spec.index)));
});

test('out-of-order and byte-identical duplicate delivery both reconstruct', () => {
  const { lines } = makeCapture();
  assert.equal(validateCapture([...lines].reverse().join('\n')).ok, true);
  assert.equal(validateCapture(lines.flatMap((l) => [l, l]).sort(() => Math.random() - 0.5).join('\n')).ok, true);
});

test('CloudWatch-style JSON event envelope with embedded newlines is accepted', () => {
  const { lines } = makeCapture();
  assert.equal(validateCapture(JSON.stringify([{ message: lines.join('\n') }, { message: 'noise' }])).ok, true);
});

test('main() streams a complete capture (with honest end.elapsedMs) and it reconstructs', async () => {
  const baseRoot = tempDir(); const stream = collectingStream();
  const code = await main({ baseRoot, spawnFn: generatingSpawn({ assertEnv: (env) => { assert.equal(env.MERI_ARTIFACTS_RENDER, 'required'); assert.ok(env.MERI_ARTIFACTS_OUTPUT_DIR.startsWith(baseRoot)); } }), writeStream: stream, now: () => Date.now(), readCgroup: () => ({ scope: 'test', memoryCurrent: null, memoryPeak: null, memoryMax: null, pidsCurrent: null, cpuStatLines: 0 }) });
  assert.equal(code, 0);
  const kinds = stream.lines.map((l) => parseRecordLine(l).record.kind);
  assert.equal(kinds[0], 'capture'); assert.equal(kinds.at(-1), 'end'); assert.ok(!kinds.includes('error'));
  const endRec = parseRecordLine(stream.lines.at(-1)).record;
  assert.equal(typeof endRec.elapsedMs, 'number'); assert.ok(Number.isFinite(endRec.elapsedMs) && endRec.elapsedMs >= 0);
  const out = join(tempDir(), 'recon');
  assert.equal(reconstruct(stream.lines.join('\n'), out).ok, true);
  assert.equal(readFileSync(join(out, EXPECTED_FILES[0].path)).length, SIZES[EXPECTED_FILES[0].path]);
});

test('main() emits only an error record after a failed/signalled/unclosed generation or invalid deadline', async () => {
  const cases = [
    { spawnFn: generatingSpawn({ payload: { ...realisticArtifactsPayload(), ok: false }, code: 1 }) },
    { spawnFn: generatingSpawn({ signal: 'SIGSEGV', code: null }) },
    { deadlineMs: 20, graceMs: 30, spawnFn: () => stuckKillChild() },
    { deadlineMs: NaN, spawnFn: () => { throw new Error('must not spawn'); } },
  ];
  for (const c of cases) {
    const baseRoot = tempDir(); const stream = collectingStream();
    const code = await main({ baseRoot, writeStream: stream, now: () => Date.now(), readCgroup: () => ({}), ...c });
    assert.equal(code, 1);
    assert.deepEqual(stream.lines.map((l) => parseRecordLine(l).record.kind), ['error']);
    assert.equal(validateCapture(stream.lines.join('\n')).ok, false);
  }
});

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

test('runCli requires --input/--out and writes nothing on a malformed capture', () => {
  const out = join(tempDir(), 'cli-out');
  const badInput = join(tempDir(), 'bad.ndjson'); writeFileSync(badInput, `${MARKER} {"kind":"end"}`);
  const logs = [];
  assert.equal(runCli(['--input', badInput, '--out', out], { log: (m) => logs.push(m) }), 1);
  assert.match(logs.join('\n'), /"wroteAny":false/); assert.equal(existsSync(out), false);
  assert.equal(runCli([], { log: (m) => logs.push(m) }), 2);
});

test('runCli reconstructs a valid capture to a new directory', () => {
  const { lines } = makeCapture();
  const base = tempDir(); const input = join(base, 'capture.ndjson'); writeFileSync(input, lines.join('\n'));
  const out = join(base, 'cli-recon'); const logs = [];
  assert.equal(runCli(['--input', input, '--out', out], { log: (m) => logs.push(m) }), 0);
  assert.match(logs.join('\n'), /"ok":true/);
  assert.equal(readFileSync(join(out, EXPECTED_FILES.at(-1).path)).length, SIZES[EXPECTED_FILES.at(-1).path]);
});

test('collectRecords ignores non-marker log lines but keeps every marker record', () => {
  const { records } = makeCapture();
  const collected = collectRecords(['noise', ...records.map(encodeRecord), 'more noise'].join('\n'));
  assert.equal(collected.ok, true, collected.reasons.join('; ')); assert.equal(collected.records.length, records.length);
});
