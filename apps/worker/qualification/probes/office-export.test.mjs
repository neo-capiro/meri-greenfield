// W02-07 canonical OFFLINE tests for the Office evidence export/reconstruct pair
// (`node --test apps/worker/qualification/probes/office-export.test.mjs`).
//
// Deterministic and hermetic: NEVER runs the real artifacts probe, Office,
// LibreOffice, a browser, a socket, AWS or any cloud/provider call. The export
// child is always an injected fake; the generated eleven-file subtree is
// materialised from synthetic bytes in a temporary directory. Everything below
// exercises real parsing/validation/streaming/filesystem boundaries.

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
  encodeRecord,
  planExport,
  buildRecords,
  verifyArtifactsVerdict,
  inspectExpectedFiles,
  runArtifactsChild,
  streamRecords,
  discoverRunDir,
  chunkBuffer,
  isContained,
  sha256Hex,
  main,
} from './office-export.mjs';
import {
  collectRecords,
  parseRecordLine,
  extractRecordLines,
  validateCapture,
  reconstruct,
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

/** Build a fully consistent capture (records + encoded lines) from synthetic bytes. */
function makeCapture({ sizes = SIZES, capture = randomUUID() } = {}) {
  const entries = syntheticEntries(sizes);
  const plan = planExport(entries, capture, {});
  assert.equal(plan.ok, true, `plan fixture invalid: ${plan.reasons.join('; ')}`);
  const records = buildRecords({ capture, plan, generation: { note: 'offline-fixture' } });
  return { capture, entries, plan, records, lines: records.map(encodeRecord) };
}

function validArtifactsPayload(overrides = {}) {
  const base = {
    probe: 'artifacts',
    ok: true,
    native: { status: 'pass', reasons: [] },
    render: { status: 'pass', reasons: [] },
    recalc: { status: 'pass', reasons: [], observed: { inputs: [1, 2, 3], formula: '=SUM(A1:A3)', cachedValue: 6 }, observedA4: 6 },
    renderFacts: { docx: { pages: 1, pngCount: 1 }, xlsx: { pages: 1, pngCount: 1 }, pptx: { pages: 2, pngCount: 2 } },
    tools: { soffice: '/usr/bin/soffice', pdftoppm: '/usr/bin/pdftoppm' },
    evidencePaths: ['/workspace/qualification-artifacts/probe-x'],
  };
  return { ...base, ...overrides };
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
function generatingSpawn({ payload = validArtifactsPayload(), code = 0, signal = null, materialize = true, sizes = SIZES, assertEnv } = {}) {
  return (cmd, args, opts) => {
    if (assertEnv) assertEnv(opts.env);
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
  child.kill = () => {
    setImmediate(() => child.emit('exit', null, 'SIGKILL'));
    return true;
  };
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
// Protocol / chunking / planner
// ---------------------------------------------------------------------------

test('export lines are single marker-prefixed JSON records (never concatenated pretty JSON)', () => {
  const { lines } = makeCapture();
  assert.ok(lines.length >= 11);
  for (const line of lines) {
    assert.ok(line.startsWith(MARKER + ' '), 'every line starts with the marker');
    const parsed = parseRecordLine(line);
    assert.equal(parsed.marker, true);
    assert.equal(parsed.error, undefined);
    assert.ok(Buffer.byteLength(line, 'utf8') <= MAX_LINE_BYTES, 'line within 12KiB');
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

test('planExport covers exactly the eleven allowlisted files with caps and both-zero/one-chunk semantics', () => {
  const { plan } = makeCapture();
  assert.equal(plan.manifestEntries.length, 11);
  for (const [i, entry] of plan.manifestEntries.entries()) {
    assert.equal(entry.path, EXPECTED_FILES[i].path);
    assert.equal(entry.index, i);
  }
  const totalChunks = plan.manifestEntries.reduce((n, f) => n + f.chunks, 0);
  assert.equal(plan.totalChunks, totalChunks);
});

test('planExport fails closed on cap breaches and out-of-set paths (no truncation)', () => {
  const entries = syntheticEntries();
  entries[0] = { ...entries[0], buffer: Buffer.alloc(CAPS.native + 1, 1) };
  const plan = planExport(entries, randomUUID(), {});
  assert.equal(plan.ok, false);
  assert.match(plan.reasons.join('; '), /exceeds cap/);

  const extra = [...syntheticEntries(), { path: 'render/recalc-in/qualification-copy.xlsx', index: 99, buffer: Buffer.alloc(3) }];
  const plan2 = planExport(extra, randomUUID(), {});
  assert.equal(plan2.ok, false);
  assert.match(plan2.reasons.join('; '), /unexpected file/);
});

// ---------------------------------------------------------------------------
// Generation verdict (fail-closed)
// ---------------------------------------------------------------------------

test('verifyArtifactsVerdict passes only on clean exit + native/render/recalc pass + numeric 6 + pages 1/1/2', () => {
  const ok = verifyArtifactsVerdict({ status: 0, signal: null, timedOut: false, error: null, stdout: JSON.stringify(validArtifactsPayload()) });
  assert.equal(ok.ok, true, ok.reasons.join('; '));
  assert.equal(ok.generation.pages.docx, 1);
  assert.equal(ok.generation.pages.pptx, 2);
  assert.equal(ok.generation.recalc.cachedValue, 6);
});

test('verifyArtifactsVerdict fails on nonzero exit/signal/timeout/error even with a passing payload', () => {
  const stdout = JSON.stringify(validArtifactsPayload());
  assert.equal(verifyArtifactsVerdict({ status: 1, signal: null, stdout }).ok, false);
  assert.equal(verifyArtifactsVerdict({ status: 0, signal: 'SIGKILL', stdout }).ok, false);
  assert.equal(verifyArtifactsVerdict({ status: 0, timedOut: true, stdout }).ok, false);
  assert.equal(verifyArtifactsVerdict({ status: 0, error: 'spawn EACCES', stdout }).ok, false);
});

test('verifyArtifactsVerdict fails on wrong numeric value, wrong page counts and unparseable/missing facts', () => {
  const wrongValue = validArtifactsPayload({ recalc: { status: 'pass', observed: { inputs: [1, 2, 3], formula: '=SUM(A1:A3)', cachedValue: 7 } } });
  assert.match(verifyArtifactsVerdict({ status: 0, stdout: JSON.stringify(wrongValue) }).reasons.join('; '), /numeric 6/);

  const wrongPages = validArtifactsPayload({ renderFacts: { docx: { pages: 1, pngCount: 1 }, xlsx: { pages: 1, pngCount: 1 }, pptx: { pages: 1, pngCount: 1 } } });
  assert.match(verifyArtifactsVerdict({ status: 0, stdout: JSON.stringify(wrongPages) }).reasons.join('; '), /pptx PDF page count/);

  const { native, ...noNative } = validArtifactsPayload();
  assert.match(verifyArtifactsVerdict({ status: 0, stdout: JSON.stringify(noNative) }).reasons.join('; '), /native generation/);
  assert.equal(verifyArtifactsVerdict({ status: 0, stdout: 'not json' }).ok, false);
});

// ---------------------------------------------------------------------------
// Child process: bounded streams, deadline, kill-signal-not-exit
// ---------------------------------------------------------------------------

test('runArtifactsChild requires the close event: a kill signal alone is not confirmation of exit', async () => {
  const base = tempDir();
  const result = await runArtifactsChild({ base, deadlineMs: 20, graceMs: 30, spawnFn: () => stuckKillChild() });
  assert.equal(result.timedOut, true);
  assert.notEqual(result.status, 0);
});

test('runArtifactsChild bounds child stdout and fails closed on overflow', async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => true;
  setImmediate(() => {
    child.stdout.emit('data', Buffer.alloc(5 * 1024 * 1024, 120));
    child.emit('close', 0, null);
  });
  const result = await runArtifactsChild({ base: tempDir(), deadlineMs: 1000, spawnFn: () => child });
  assert.equal(result.overflow, true);
  assert.ok(result.error, 'overflow is surfaced as an error');
});

// ---------------------------------------------------------------------------
// Full round-trip through the reconstructor
// ---------------------------------------------------------------------------

test('full eleven-file round-trip reconstructs byte-identical files', () => {
  const { lines, entries } = makeCapture();
  const text = lines.join('\n');
  const validated = validateCapture(text);
  assert.equal(validated.ok, true, validated.reasons.join('; '));
  assert.deepEqual(validated.files.map((f) => f.path), EXPECTED_FILES.map((s) => s.path));
  for (const file of validated.files) {
    const want = entries.find((e) => e.path === file.path).buffer;
    assert.equal(sha256Hex(file.buffer), sha256Hex(want));
    assert.equal(file.buffer.length, want.length);
  }
  const out = join(tempDir(), 'reconstructed');
  const written = reconstruct(text, out);
  assert.equal(written.ok, true, written.reasons.join('; '));
  for (const spec of EXPECTED_FILES) {
    const got = readFileSync(join(out, spec.path));
    assert.equal(sha256Hex(got), sha256Hex(makeBytes(SIZES[spec.path], spec.index)));
  }
});

test('out-of-order record delivery reconstructs identically', () => {
  const { lines } = makeCapture();
  const shuffled = [...lines].reverse();
  const validated = validateCapture(shuffled.join('\n'));
  assert.equal(validated.ok, true, validated.reasons.join('; '));
});

test('byte-identical duplicate delivery (every line twice) is tolerated', () => {
  const { lines } = makeCapture();
  const doubled = lines.flatMap((l) => [l, l]).sort(() => Math.random() - 0.5);
  const validated = validateCapture(doubled.join('\n'));
  assert.equal(validated.ok, true, validated.reasons.join('; '));
});

test('CloudWatch-style JSON event envelope with embedded newlines is accepted', () => {
  const { lines } = makeCapture();
  const envelope = JSON.stringify([{ message: lines.join('\n') }, { message: 'unrelated log line ignored' }]);
  const validated = validateCapture(envelope);
  assert.equal(validated.ok, true, validated.reasons.join('; '));
});

// ---------------------------------------------------------------------------
// Reconstruction failures (all must write nothing)
// ---------------------------------------------------------------------------

function expectReject(mutator, matcher) {
  const { records } = makeCapture();
  const mutated = mutator(records.map((r) => JSON.parse(JSON.stringify(r))));
  const text = mutated.map(encodeRecord).join('\n');
  const result = validateCapture(text);
  assert.equal(result.ok, false, 'expected rejection');
  assert.equal(result.files.length, 0);
  if (matcher) assert.match(result.reasons.join('; '), matcher);
  return result;
}

test('rejector: missing end record is unaccepted', () => {
  expectReject((recs) => recs.filter((r) => r.kind !== 'end'), /no end record/);
});
test('rejector: missing chunk is unaccepted', () => {
  const { records } = makeCapture();
  const stripped = records.map((r) => JSON.parse(JSON.stringify(r))).filter((r, i, a) => !(r.kind === 'chunk' && a.findIndex((x) => x.kind === 'chunk') === i));
  const result = validateCapture(stripped.map(encodeRecord).join('\n'));
  assert.equal(result.ok, false);
  assert.match(result.reasons.join('; '), /missing chunk/);
});
test('rejector: changed duplicate chunk conflicts', () => {
  const { records, capture } = makeCapture();
  const chunk = records.find((r) => r.kind === 'chunk');
  const dup = { ...chunk, data: Buffer.from(makeBytes(chunk.bytes, 999)).toString('base64') };
  const text = [...records, dup].map(encodeRecord).join('\n');
  const result = validateCapture(text);
  assert.equal(result.ok, false);
  assert.match(result.reasons.join('; '), /conflicting duplicate/);
});
test('rejector: wrong decoded hash fails when bindings are re-synced', () => {
  expectReject((recs) => {
    for (const r of recs) {
      if (r.kind === 'capture' || r.kind === 'end') {
        r.files[0].sha256 = 'f'.repeat(64);
        if (r.kind === 'end') r.manifestSha256 = sha256Hex(JSON.stringify(recs.find((x) => x.kind === 'capture').files));
      }
    }
    return recs;
  }, /sha256 mismatch/);
});
test('rejector: wrong declared length fails', () => {
  expectReject((recs) => {
    const cap = recs.find((r) => r.kind === 'capture');
    cap.files[1].bytes = cap.files[1].bytes + 1;
    return recs;
  }, /chunks|length|cap/);
});
test('rejector: wrong chunk count fails', () => {
  expectReject((recs) => {
    const cap = recs.find((r) => r.kind === 'capture');
    cap.files[0].chunks = cap.files[0].chunks + 1;
    return recs;
  }, /chunks/);
});
test('rejector: non-canonical base64 fails', () => {
  expectReject((recs) => {
    const chunk = recs.find((r) => r.kind === 'chunk');
    chunk.data = 'AB==';
    return recs;
  }, /canonical base64/);
});
test('rejector: mixed capture ids fail', () => {
  expectReject((recs) => {
    recs.find((r) => r.kind === 'chunk').capture = randomUUID();
    return recs;
  }, /mixed capture ids/);
});
test('rejector: unknown record field fails', () => {
  expectReject((recs) => {
    recs.find((r) => r.kind === 'end').extra = true;
    return recs;
  }, /unknown fields/);
});
test('rejector: an error record present voids the capture', () => {
  const text = `${encodeRecord({ kind: 'error', v: PROTOCOL, capture: randomUUID(), reasons: ['boom'] })}\n${makeCapture().lines.join('\n')}`;
  const result = validateCapture(text);
  assert.equal(result.ok, false);
});

test('rejector: unparseable marker line fails closed (no silent drop)', () => {
  const { lines } = makeCapture();
  const corrupted = [...lines, `${MARKER} {not json`];
  const result = validateCapture(corrupted.join('\n'));
  assert.equal(result.ok, false);
  assert.match(result.reasons.join('; '), /malformed record JSON/);
});

test('reconstruction failure writes no files and leaves a new destination absent', () => {
  const { records } = makeCapture();
  const stripped = records.map((r) => JSON.parse(JSON.stringify(r))).filter((r) => r.kind !== 'end');
  const out = join(tempDir(), 'never-created');
  const result = reconstruct(stripped.map(encodeRecord).join('\n'), out);
  assert.equal(result.ok, false);
  assert.equal(result.written, 0);
  assert.equal(existsSync(out), false, 'no partial destination was created');
});

test('an existing destination is refused and left untouched', () => {
  const out = join(tempDir(), 'existing');
  mkdirSync(out);
  writeFileSync(join(out, 'keep.txt'), 'untouched');
  const result = reconstruct(makeCapture().lines.join('\n'), out);
  assert.equal(result.ok, false);
  assert.match(result.reasons.join('; '), /already exists/);
  assert.equal(readFileSync(join(out, 'keep.txt'), 'utf8'), 'untouched');
  assert.equal(existsSync(join(out, EXPECTED_FILES[0].path)), false);
});

// ---------------------------------------------------------------------------
// Filesystem scanning: containment, symlink/hardlink/special, extras ignored
// ---------------------------------------------------------------------------

test('inspectExpectedFiles accepts only the eleven regular files and ignores decoys (never recursive)', () => {
  const base = tempDir();
  const runDir = materializeRun(base);
  // Decoys that must NOT be exported.
  for (const rel of ['render/recalc-in/qualification-copy.xlsx', 'render/docx/page-99.png', 'render/lo-profile/lock']) {
    mkdirSync(dirname(join(runDir, rel)), { recursive: true });
    writeFileSync(join(runDir, rel), Buffer.from('decoy'));
  }
  const scan = inspectExpectedFiles(runDir);
  assert.equal(scan.ok, true, scan.reasons.join('; '));
  assert.deepEqual(scan.entries.map((e) => e.path), EXPECTED_FILES.map((s) => s.path));
});

test('inspectExpectedFiles rejects a missing file, a directory-as-file and a hard link', () => {
  const base = tempDir();
  const runDir = materializeRun(base);
  const missing = join(runDir, 'render', 'xlsx', 'page-1.png');
  assert.equal(inspectExpectedFiles(runDir).ok, true);
  rmSync(missing);
  assert.match(inspectExpectedFiles(runDir).reasons.join('; '), /missing render\/xlsx\/page-1\.png/);

  const base2 = tempDir();
  const runDir2 = materializeRun(base2);
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

test('inspectExpectedFiles rejects a symlink where a regular file is required', (t) => {
  const base = tempDir();
  const runDir = materializeRun(base);
  const target = join(base, 'outside.bin');
  writeFileSync(target, makeBytes(32, 4));
  const linkPath = join(runDir, 'native', 'qualification.pptx');
  rmSync(linkPath);
  try {
    symlinkSync(target, linkPath);
  } catch (error) {
    t.skip(`symlink unsupported here: ${error.code || error.message}`);
    return;
  }
  assert.match(inspectExpectedFiles(runDir).reasons.join('; '), /symlink/);
});

test('isContained and checkDestination reject traversal and symlink ancestors', () => {
  assert.equal(isContained('/a/b', '/a/b/c'), true);
  assert.equal(isContained('/a/b', '/a/bc'), false);
  assert.equal(isContained('/a/b', '/a/../etc'), false);
  assert.equal(isCanonicalBase64('AA=='), true);
  assert.equal(isCanonicalBase64('AB=='), false);
  assert.equal(isCanonicalBase64('AAA'), false);
});

// ---------------------------------------------------------------------------
// Streaming: backpressure, stream errors, deadline
// ---------------------------------------------------------------------------

test('streamRecords completes with an async write callback (drain) and emits every record', async () => {
  const { records } = makeCapture();
  const stream = collectingStream();
  const result = await streamRecords(stream, records, { deadlineMs: 100000 });
  assert.equal(result.ok, true, result.error || '');
  assert.equal(result.written, records.length);
  assert.equal(stream.lines.length, records.length);
});

test('streamRecords fails closed on a stdout write error', async () => {
  const { records } = makeCapture();
  const stream = collectingStream({ failWrite: true });
  const result = await streamRecords(stream, records, { deadlineMs: 100000 });
  assert.equal(result.ok, false);
  assert.ok(result.error);
});

test('streamRecords fails closed when the export deadline is exceeded', async () => {
  const { records } = makeCapture();
  const stream = collectingStream();
  let ticks = 0;
  const now = () => (ticks += 10000);
  const result = await streamRecords(stream, records, { deadlineMs: 5000, now });
  assert.equal(result.ok, false);
  assert.match(result.error, /deadline/);
});

// ---------------------------------------------------------------------------
// main(): end-to-end with an injected fake child
// ---------------------------------------------------------------------------

test('main() streams a complete capture after a clean generation, and it reconstructs', async () => {
  const baseRoot = tempDir();
  const stream = collectingStream();
  const code = await main({
    baseRoot,
    spawnFn: generatingSpawn({ assertEnv: (env) => {
      assert.equal(env.MERI_ARTIFACTS_RENDER, 'required');
      assert.ok(env.MERI_ARTIFACTS_OUTPUT_DIR.startsWith(baseRoot));
    } }),
    writeStream: stream,
    now: () => Date.now(),
    readCgroup: () => ({ scope: 'test' }),
  });
  assert.equal(code, 0);
  const kinds = stream.lines.map((l) => parseRecordLine(l).record.kind);
  assert.equal(kinds[0], 'capture');
  assert.equal(kinds.at(-1), 'end');
  assert.ok(!kinds.includes('error'));
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
    spawnFn: generatingSpawn({ payload: validArtifactsPayload({ ok: false }), code: 1 }),
    writeStream: stream,
    now: () => Date.now(),
    readCgroup: () => ({}),
  });
  assert.equal(code, 1);
  const kinds = stream.lines.map((l) => parseRecordLine(l).record.kind);
  assert.deepEqual(kinds, ['error']);
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

  const noArgs = runCli([], { log: (m) => logs.push(m) });
  assert.equal(noArgs, 2);
});

test('runCli reconstructs a valid capture to a new directory', () => {
  const { lines } = makeCapture();
  const base = tempDir();
  const input = join(base, 'capture.ndjson');
  writeFileSync(input, lines.join('\n'));
  const out = join(base, 'cli-recon');
  const logs = [];
  const code = runCli(['--input', input, '--out', out], { log: (m) => logs.push(m) });
  assert.equal(code, 0);
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
