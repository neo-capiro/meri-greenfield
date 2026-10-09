// Opt-in Linux Office-only evidence EXPORT wrapper (probe:office-export).
//
// NEVER run by `npm test`. It is the Fargate task Command the owner wires as
//   EntryPoint:["node"], Command:["/opt/meri-worker/probes/office-export.mjs"]
// after a separate exact-commit review. This file is PREPARATION only: it is
// not built, not executed natively here, and performs no cloud/provider/source
// call. It runs the UNCHANGED sibling artifacts.mjs EXACTLY ONCE with REQUIRED
// rendering, reads the fresh probe-<uuid> subtree it generates, verifies the
// authoritative structured verdict (successful exit AND native/render/recalc
// pass, numeric recalc value 6 and page counts 1/1/2), and only then streams
// the exact eleven allowlisted files as bounded, reproducible, marker-prefixed
// base64 chunk log lines plus a manifest and end record. A failed, signalled,
// timed-out or unparseable generation NEVER emits a successful-looking payload:
// it emits a single `error` record and exits nonzero (unaccepted downstream).
//
// Every export line is `<MARKER> <json>` so a CloudWatch stream is a sequence
// of unambiguous single-line JSON records (never concatenated pretty JSON).
// Backpressure is handled with an async write callback; stream errors and the
// export deadline abort the run instead of letting a truncated tail masquerade
// as a complete capture. Draining to the local stdout proves LOCAL WRITE ONLY;
// it does not prove CloudWatch delivery.

import { spawn } from 'node:child_process';
import {
  mkdirSync,
  existsSync,
  lstatSync,
  openSync,
  fstatSync,
  closeSync,
  readSync,
  realpathSync,
  constants,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, sep, resolve, relative, isAbsolute } from 'node:path';

import { parseStructuredOutput } from './runtime.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = join(HERE, 'artifacts.mjs');

/** Fixed, unique, greppable line marker. Every exported line starts with it. */
export const MARKER = 'MERI_OFFICE_EXPORT_V1';
/** Bounded, explicit protocol version carried on every record. */
export const PROTOCOL = 'meri-office-export/1';

export const CHUNK_BYTES = 6144;
export const MAX_LINE_BYTES = 12 * 1024;
export const MAX_TOTAL_CHUNKS = 1500;

/** Provisional fail-closed size caps (baseline did not record actual sizes). */
export const CAPS = Object.freeze({
  native: 512 * 1024,
  pdf: 1024 * 1024,
  png: 2 * 1024 * 1024,
  total: 8 * 1024 * 1024,
});

/** The exactly-eleven eligible files, in fixed order (index = position). */
export const EXPECTED_FILES = Object.freeze([
  { path: 'native/qualification.docx', kind: 'native', cap: CAPS.native },
  { path: 'native/qualification.xlsx', kind: 'native', cap: CAPS.native },
  { path: 'native/qualification.pptx', kind: 'native', cap: CAPS.native },
  { path: 'render/docx/qualification.pdf', kind: 'pdf', cap: CAPS.pdf },
  { path: 'render/docx/page-1.png', kind: 'png', cap: CAPS.png },
  { path: 'render/xlsx/qualification.pdf', kind: 'pdf', cap: CAPS.pdf },
  { path: 'render/xlsx/page-1.png', kind: 'png', cap: CAPS.png },
  { path: 'render/pptx/qualification.pdf', kind: 'pdf', cap: CAPS.pdf },
  { path: 'render/pptx/page-1.png', kind: 'png', cap: CAPS.png },
  { path: 'render/pptx/page-2.png', kind: 'png', cap: CAPS.png },
  { path: 'render/recalc-out/qualification-copy.xlsx', kind: 'native', cap: CAPS.native },
].map((f, index) => ({ ...f, index })));

/** Expected per-format PDF page counts from the accepted artifacts probe. */
export const EXPECTED_PAGES = Object.freeze({ docx: 1, xlsx: 1, pptx: 2 });
/** Expected numeric cached recalc value. */
export const EXPECTED_RECALC = 6;

const DEFAULT_DEADLINE_MS = 120000;
const DEFAULT_EXPORT_DEADLINE_MS = 120000;
const MAX_CHILD_STDOUT = 4 * 1024 * 1024;
const MAX_CHILD_STDERR = 64 * 1024;

/** sha256 hex of a Buffer (or string). */
export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

/** True when `parent` contains `child` (both already resolved absolute paths). */
export function isContained(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
}

/** Split a Buffer into CHUNK_BYTES-bounded pieces (never empty for empty input). */
export function chunkBuffer(buf, size = CHUNK_BYTES) {
  const out = [];
  if (buf.length === 0) {
    out.push(Buffer.alloc(0));
    return out;
  }
  for (let off = 0; off < buf.length; off += size) out.push(buf.subarray(off, off + size));
  return out;
}

/**
 * Pure plan: turn validated {path, buffer} entries into the manifest entries and
 * the ordered chunk records. Fails closed on any cap breach, out-of-set path or
 * line that would exceed MAX_LINE_BYTES. Never truncates.
 */
export function planExport(entries, capture, extra = {}) {
  const reasons = [];
  const byPath = new Map(entries.map((e) => [e.path, e]));
  const manifestEntries = [];
  const chunkRecords = [];
  let totalBytes = 0;
  let totalChunks = 0;
  for (const spec of EXPECTED_FILES) {
    const entry = byPath.get(spec.path);
    if (!entry) {
      reasons.push(`missing expected file ${spec.path}`);
      continue;
    }
    const buf = Buffer.isBuffer(entry.buffer) ? entry.buffer : Buffer.from(entry.buffer || []);
    if (buf.length > spec.cap) reasons.push(`${spec.path} size ${buf.length} exceeds cap ${spec.cap}`);
    totalBytes += buf.length;
    const digest = sha256Hex(buf);
    const parts = chunkBuffer(buf);
    manifestEntries.push({ path: spec.path, kind: spec.kind, index: spec.index, bytes: buf.length, sha256: digest, chunks: parts.length });
    parts.forEach((part, seq) => {
      const record = {
        kind: 'chunk',
        v: PROTOCOL,
        capture,
        path: spec.path,
        index: spec.index,
        seq,
        total: parts.length,
        bytes: part.length,
        data: part.toString('base64'),
      };
      const line = encodeRecord(record);
      if (Buffer.byteLength(line, 'utf8') > MAX_LINE_BYTES) reasons.push(`${spec.path} chunk ${seq} line exceeds ${MAX_LINE_BYTES} bytes`);
      chunkRecords.push(record);
      totalChunks++;
    });
  }
  const extraPaths = entries.map((e) => e.path).filter((p) => !EXPECTED_FILES.some((s) => s.path === p));
  for (const p of extraPaths) reasons.push(`unexpected file ${p}`);
  if (totalBytes > CAPS.total) reasons.push(`aggregate ${totalBytes} exceeds total cap ${CAPS.total}`);
  if (totalChunks > MAX_TOTAL_CHUNKS) reasons.push(`aggregate chunks ${totalChunks} exceed ${MAX_TOTAL_CHUNKS}`);
  const manifestSha256 = sha256Hex(JSON.stringify(manifestEntries));
  return {
    ok: reasons.length === 0,
    reasons,
    manifestEntries,
    chunkRecords,
    totalBytes,
    totalChunks,
    manifestSha256,
    limits: { ...CAPS, chunkBytes: CHUNK_BYTES, maxLineBytes: MAX_LINE_BYTES, maxTotalChunks: MAX_TOTAL_CHUNKS },
    extra,
  };
}

/** Encode one record as `<MARKER> <json>` (no trailing newline). */
export function encodeRecord(record) {
  return `${MARKER} ${JSON.stringify(record)}`;
}

/** Full ordered record list: capture, chunks, end. */
export function buildRecords({ capture, plan, generation }) {
  return [
    {
      kind: 'capture',
      v: PROTOCOL,
      capture,
      protocol: MARKER,
      fileCount: plan.manifestEntries.length,
      chunkCount: plan.totalChunks,
      totalBytes: plan.totalBytes,
      limits: plan.limits,
      generation,
      files: plan.manifestEntries,
    },
    ...plan.chunkRecords,
    {
      kind: 'end',
      v: PROTOCOL,
      capture,
      fileCount: plan.manifestEntries.length,
      chunkCount: plan.totalChunks,
      totalBytes: plan.totalBytes,
      manifestSha256: plan.manifestSha256,
      files: plan.manifestEntries,
      elapsedMs: plan.extra.exportElapsedMs ?? null,
    },
  ];
}

/**
 * Pure verdict over the artifacts child. Requires a clean exit AND the
 * authoritative structured pass AND the exact numeric/page facts. Any signal,
 * timeout, error, unparseable stdout or missing data fails. A good-looking
 * nested payload after a failed child can never pass.
 */
export function verifyArtifactsVerdict(child) {
  const reasons = [];
  const c = child || {};
  if (c.error) reasons.push(`child spawn error: ${String(c.error).slice(0, 160)}`);
  if (c.timedOut) reasons.push('child exceeded the generation deadline');
  if (c.signal) reasons.push(`child killed by signal ${c.signal}`);
  if (typeof c.status !== 'number' || c.status !== 0) reasons.push(`child exit status ${c.status}`);
  const parsed = parseStructuredOutput(c.stdout);
  if (!parsed.ok) reasons.push(`stdout not a single structured object: ${String(parsed.error).slice(0, 120)}`);
  const p = parsed.value || {};
  if (parsed.ok && p.ok !== true) reasons.push('artifacts probe reported ok !== true');
  if (!p.native || p.native.status !== 'pass') reasons.push('native generation did not pass');
  if (!p.render || p.render.status !== 'pass') reasons.push('required rendering did not pass');
  if (!p.recalc || p.recalc.status !== 'pass') reasons.push('xlsx recalculation did not pass');
  const observed = p.recalc && p.recalc.observed;
  if (!observed || typeof observed.cachedValue !== 'number' || observed.cachedValue !== EXPECTED_RECALC) {
    reasons.push(`recalc cached value ${observed ? JSON.stringify(observed.cachedValue) : 'missing'} is not numeric ${EXPECTED_RECALC}`);
  }
  const rf = p.renderFacts || {};
  for (const [name, want] of Object.entries(EXPECTED_PAGES)) {
    const pages = rf[name] && rf[name].pages;
    if (pages !== want) reasons.push(`${name} PDF page count ${JSON.stringify(pages)} != ${want}`);
    const pngCount = rf[name] && rf[name].pngCount;
    if (typeof pngCount !== 'number' || pngCount < want) reasons.push(`${name} page PNG count ${JSON.stringify(pngCount)} < ${want}`);
  }
  const generation = {
    exitStatus: c.status ?? null,
    signal: c.signal ?? null,
    timedOut: !!c.timedOut,
    native: p.native ? { status: p.native.status, reasons: (p.native.reasons || []).slice(0, 8) } : null,
    render: p.render ? { status: p.render.status, reasons: (p.render.reasons || []).slice(0, 8) } : null,
    recalc: { status: p.recalc ? p.recalc.status : null, cachedValue: observed ? observed.cachedValue : null, formula: observed ? observed.formula : null },
    pages: Object.fromEntries(Object.entries(EXPECTED_PAGES).map(([n]) => [n, rf[n] ? rf[n].pages : null])),
    pngCounts: Object.fromEntries(Object.entries(EXPECTED_PAGES).map(([n]) => [n, rf[n] ? rf[n].pngCount : null])),
    tools: p.tools ? { soffice: !!p.tools.soffice, pdftoppm: !!p.tools.pdftoppm } : null,
    evidencePaths: Array.isArray(p.evidencePaths) ? p.evidencePaths.map((x) => String(x)).slice(0, 6) : [],
  };
  return { ok: reasons.length === 0, reasons, generation };
}

/** Read-only, accurately scoped cgroup observations (whole cgroup, not child). */
export function readCgroupObservations(readFile = (p) => readFileSync(p, 'utf8')) {
  const scope = 'read-only cgroup-wide snapshot; NOT a per-child peak or cost';
  const out = { scope };
  const files = {
    memoryCurrent: '/sys/fs/cgroup/memory.current',
    memoryPeak: '/sys/fs/cgroup/memory.peak',
    memoryMax: '/sys/fs/cgroup/memory.max',
    pidsCurrent: '/sys/fs/cgroup/pids.current',
  };
  for (const [key, p] of Object.entries(files)) {
    try {
      const raw = String(readFile(p)).trim().slice(0, 32);
      out[key] = raw === 'max' ? 'max' : Number.isFinite(Number(raw)) ? Number(raw) : null;
    } catch {
      out[key] = null;
    }
  }
  try {
    const cpu = String(readFile('/sys/fs/cgroup/cpu.stat')).trim().slice(0, 400);
    out.cpuStatLines = cpu ? cpu.split('\n').length : 0;
  } catch {
    out.cpuStatLines = 0;
  }
  return out;
}

/**
 * Inspect exactly the eleven expected files under `runDir` (never a recursive
 * walk). Rejects symlinks, hardlinks, non-regular/special files, cap breaches,
 * descriptor/stat identity mismatches and any escape from the run root.
 */
export function inspectExpectedFiles(runDir) {
  const reasons = [];
  const entries = [];
  const realRoot = safeRealpath(runDir);
  let totalBytes = 0;
  for (const spec of EXPECTED_FILES) {
    const full = join(runDir, spec.path);
    if (!isContained(runDir, full)) {
      reasons.push(`${spec.path} escapes the run root`);
      continue;
    }
    let lst;
    try {
      lst = lstatSync(full);
    } catch {
      reasons.push(`missing ${spec.path}`);
      continue;
    }
    if (lst.isSymbolicLink()) { reasons.push(`${spec.path} is a symlink`); continue; }
    if (!lst.isFile()) { reasons.push(`${spec.path} is not a regular file`); continue; }
    if (lst.nlink > 1) { reasons.push(`${spec.path} has ${lst.nlink} hard links`); continue; }
    if (lst.size > spec.cap) { reasons.push(`${spec.path} size ${lst.size} exceeds cap ${spec.cap}`); continue; }
    const realFull = safeRealpath(full);
    if (realRoot && realFull && !isContained(realRoot, realFull)) { reasons.push(`${spec.path} real path escapes the run root`); continue; }
    let buf;
    try {
      buf = readRegularFileVerified(full, lst);
    } catch (error) {
      reasons.push(`${spec.path} read failed: ${String(error && error.message ? error.message : error).slice(0, 120)}`);
      continue;
    }
    totalBytes += buf.length;
    entries.push({ path: spec.path, kind: spec.kind, index: spec.index, buffer: buf });
  }
  if (totalBytes > CAPS.total) reasons.push(`aggregate ${totalBytes} exceeds total cap ${CAPS.total}`);
  return { ok: reasons.length === 0, reasons, entries, totalBytes };
}

function safeRealpath(p) {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

/**
 * Open the file with O_NOFOLLOW, revalidate descriptor identity against the
 * pre-read lstat, read it fully and confirm the whole byte length was read.
 */
export function readRegularFileVerified(full, lst) {
  const NOFOLLOW = constants.O_NOFOLLOW || 0;
  const fd = openSync(full, constants.O_RDONLY | NOFOLLOW);
  try {
    const st = fstatSync(fd);
    if (!st.isFile()) throw new Error('descriptor is not a regular file');
    if (st.dev !== lst.dev || st.ino !== lst.ino || st.size !== lst.size) throw new Error('descriptor/stat identity mismatch');
    const buf = Buffer.allocUnsafe(st.size);
    let read = 0;
    while (read < st.size) {
      const n = readSync(fd, buf, read, st.size - read, read);
      if (n <= 0) break;
      read += n;
    }
    if (read !== st.size) throw new Error(`short read ${read}/${st.size}`);
    return buf;
  } finally {
    closeSync(fd);
  }
}

/**
 * Spawn the unchanged artifacts probe exactly once with REQUIRED rendering and a
 * fresh output root, bounded streams and a hard deadline. Resolves only after
 * the child 'close' event (stdio drained AND process reaped): a kill signal
 * alone is NOT confirmation of exit; if close never arrives the run fails as
 * uncertain.
 */
export function runArtifactsChild({ base, deadlineMs = DEFAULT_DEADLINE_MS, spawnFn = spawn, env = process.env, graceMs = 5000 } = {}) {
  return new Promise((resolve) => {
    const childEnv = { ...env, MERI_ARTIFACTS_OUTPUT_DIR: base, MERI_ARTIFACTS_RENDER: 'required' };
    let child;
    try {
      child = spawnFn(process.execPath, [ARTIFACTS], { env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ status: null, signal: null, timedOut: false, error: String(error && error.message ? error.message : error), stdout: '', stderr: '' });
      return;
    }
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let closed = false;
    let exited = null;
    let timedOut = false;
    let overflow = false;
    let spawnError = null;
    let graceTimer = null;
    const finish = () => {
      if (closed) return;
      closed = true;
      clearTimeout(deadlineTimer);
      if (graceTimer) clearTimeout(graceTimer);
      resolve({
        status: exited ? exited.code : null,
        signal: exited ? exited.signal : null,
        timedOut,
        overflow,
        error: spawnError || (overflow ? 'child stdout exceeded bound' : null),
        stdout,
        stderr,
      });
    };
    const deadlineTimer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      graceTimer = setTimeout(finish, graceMs);
    }, deadlineMs);
    child.on('error', (err) => { spawnError = String(err && err.message ? err.message : err); });
    child.stdout.on('data', (d) => {
      stdoutBytes += d.length;
      if (stdoutBytes > MAX_CHILD_STDOUT) { overflow = true; try { child.kill('SIGKILL'); } catch { /* ignore */ } return; }
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d) => {
      stderrBytes += d.length;
      if (stderrBytes > MAX_CHILD_STDERR) return;
      stderr += d.toString('utf8');
    });
    child.on('exit', (code, signal) => { exited = { code, signal }; });
    child.on('close', (code, signal) => { exited = { code, signal }; finish(); });
  });
}

/** Find the single fresh probe-<uuid> subtree created under the run base. */
export function discoverRunDir(base) {
  const reasons = [];
  let dirs = [];
  try {
    dirs = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith('probe-')).map((d) => join(base, d.name));
  } catch (error) {
    reasons.push(`cannot list run base: ${String(error && error.message ? error.message : error).slice(0, 120)}`);
  }
  if (dirs.length === 0) reasons.push('no fresh probe-<uuid> subtree was generated');
  if (dirs.length > 1) reasons.push(`expected exactly one probe subtree, found ${dirs.length}`);
  return { ok: reasons.length === 0, reasons, runDir: dirs.length === 1 ? dirs[0] : null };
}

/** Await a stream write (callback fires after flush/drain). */
export function writeLine(stream, line) {
  return new Promise((resolve, reject) => {
    stream.write(line + '\n', (err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Stream records with async callback/drain, honoring a deadline and stream
 * errors. Returns { ok, written, error }.
 */
export async function streamRecords(stream, records, { deadlineMs = DEFAULT_EXPORT_DEADLINE_MS, now = () => Date.now() } = {}) {
  const start = now();
  let streamError = null;
  const onError = (err) => { streamError = err; };
  if (typeof stream.on === 'function') stream.on('error', onError);
  let written = 0;
  try {
    for (const record of records) {
      if (streamError) return { ok: false, written, error: `stdout error: ${String(streamError.message || streamError).slice(0, 120)}` };
      if (now() - start > deadlineMs) return { ok: false, written, error: 'export deadline exceeded before completion' };
      await writeLine(stream, encodeRecord(record));
      written++;
    }
    if (streamError) return { ok: false, written, error: `stdout error: ${String(streamError.message || streamError).slice(0, 120)}` };
    return { ok: true, written, error: null };
  } catch (error) {
    return { ok: false, written, error: String(error && error.message ? error.message : error).slice(0, 160) };
  } finally {
    if (typeof stream.off === 'function') stream.off('error', onError);
  }
}

/** Default run base: under /workspace/qualification-artifacts on Linux. */
export function defaultBaseRoot() {
  if (process.env.MERI_OFFICE_EXPORT_BASE) return process.env.MERI_OFFICE_EXPORT_BASE;
  return process.platform === 'linux' ? '/workspace/qualification-artifacts' : join(HERE, '..', '.runtime', 'office-export');
}

/**
 * Entry point. Injectable for offline tests (spawnFn, writeStream, now,
 * baseRoot, io). Never invoked by `npm test`.
 */
export async function main(opts = {}) {
  const {
    baseRoot = defaultBaseRoot(),
    deadlineMs = Number(process.env.MERI_OFFICE_EXPORT_GEN_DEADLINE_MS || DEFAULT_DEADLINE_MS),
    exportDeadlineMs = Number(process.env.MERI_OFFICE_EXPORT_DEADLINE_MS || DEFAULT_EXPORT_DEADLINE_MS),
    spawnFn = spawn,
    writeStream = process.stdout,
    now = () => Date.now(),
    readCgroup = readCgroupObservations,
    mkdir = mkdirSync,
    exists = existsSync,
    graceMs = 5000,
  } = opts;
  const capture = randomUUID();
  const emitAbort = async (reasons) => {
    const record = { kind: 'error', v: PROTOCOL, capture, reasons: reasons.map((r) => String(r).slice(0, 200)).slice(0, 12) };
    try { await writeLine(writeStream, encodeRecord(record)); } catch { /* nothing else to do */ }
  };
  try {
    const base = join(baseRoot, `office-export-${capture}`);
    if (exists(base)) { await emitAbort(['fresh run base already exists']); return 1; }
    mkdir(baseRoot, { recursive: true });
    mkdir(base);
    const genStart = now();
    const child = await runArtifactsChild({ base, deadlineMs, spawnFn, graceMs });
    const genElapsedMs = now() - genStart;
    const verdict = verifyArtifactsVerdict(child);
    if (!verdict.ok) { await emitAbort(verdict.reasons); return 1; }
    const disco = discoverRunDir(base);
    if (!disco.ok) { await emitAbort(disco.reasons); return 1; }
    const scan = inspectExpectedFiles(disco.runDir);
    if (!scan.ok) { await emitAbort(scan.reasons); return 1; }
    const exportStart = now();
    const plan = planExport(scan.entries, capture, { exportElapsedMs: null });
    if (!plan.ok) { await emitAbort(plan.reasons); return 1; }
    const generation = { ...verdict.generation, elapsedMs: genElapsedMs, cgroup: readCgroup() };
    const records = buildRecords({ capture, plan, generation });
    const streamed = await streamRecords(writeStream, records, { deadlineMs: exportDeadlineMs, now });
    if (!streamed.ok) { await emitAbort([streamed.error]); return 1; }
    return 0;
  } catch (error) {
    await emitAbort([String(error && error.message ? error.message : error)]);
    return 1;
  }
}

const invokedDirectly = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (invokedDirectly) {
  main().then((code) => process.exit(code)).catch(async () => {
    process.exit(1);
  });
}
