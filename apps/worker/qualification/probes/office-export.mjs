// Opt-in Linux Office-only evidence EXPORT wrapper (probe:office-export).
//
// NEVER run by `npm test`. It is the Fargate task Command the owner wires as
//   EntryPoint:["node"], Command:["/opt/meri-worker/probes/office-export.mjs"]
// after a separate exact-commit review. This file is PREPARATION only: it is
// not built, not executed natively here, and performs no cloud/provider/source
// call. It runs the UNCHANGED sibling artifacts.mjs EXACTLY ONCE with REQUIRED
// rendering, reads the fresh probe-<uuid> subtree it generates, verifies the
// authoritative structured verdict (clean exit AND native/generate/pptx/convert/
// png/pdf-inspection/recalc child statuses, numeric recalc value 6, formula
// =SUM(A1:A3), inputs [1,2,3] and page/PNG counts exactly 1/1/2), and only then
// streams the exact eleven allowlisted files as bounded, reproducible, marker-
// prefixed base64 chunk log lines plus a manifest and end record. A failed,
// signalled, timed-out, uncleaned or unparseable generation NEVER emits a
// successful-looking payload: it emits a single `error` record and exits
// nonzero (unaccepted downstream).
//
// Every export line is `<MARKER> <json>` so a CloudWatch stream is a sequence
// of unambiguous single-line JSON records (never concatenated pretty JSON).
// Writes are bounded by an absolute deadline (pending write/error waits are
// raced against a timer, not only checked between writes), stream errors abort
// immediately, and listeners/timers are always cleaned up. Draining to the
// local stdout proves LOCAL WRITE ONLY; it does not prove CloudWatch delivery.

import { spawn } from 'node:child_process';
import {
  mkdirSync,
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
/** Hard cap on any single generation/export deadline (seconds -> 120s). */
export const MAX_DEADLINE_MS = 120000;

/** Provisional fail-closed size caps (baseline did not record actual sizes). */
export const CAPS = Object.freeze({
  native: 512 * 1024,
  pdf: 1024 * 1024,
  png: 2 * 1024 * 1024,
  total: 8 * 1024 * 1024,
});

/** The exact expected capture limits (must match, never auto-expanded). */
export const EXPECTED_LIMITS = Object.freeze({
  native: CAPS.native,
  pdf: CAPS.pdf,
  png: CAPS.png,
  total: CAPS.total,
  chunkBytes: CHUNK_BYTES,
  maxLineBytes: MAX_LINE_BYTES,
  maxTotalChunks: MAX_TOTAL_CHUNKS,
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

/** Expected per-format PDF page counts (and PNG counts) from the probe. */
export const EXPECTED_PAGES = Object.freeze({ docx: 1, xlsx: 1, pptx: 2 });
/** Expected numeric cached recalc value. */
export const EXPECTED_RECALC = 6;
/** Expected recalc formula and inputs. */
export const EXPECTED_FORMULA = '=SUM(A1:A3)';
export const EXPECTED_INPUTS = Object.freeze([1, 2, 3]);

const DEFAULT_DEADLINE_MS = 120000;
const DEFAULT_EXPORT_DEADLINE_MS = 120000;
const ABORT_DEADLINE_MS = 5000;
const MAX_CHILD_STDOUT = 4 * 1024 * 1024;
const MAX_CHILD_STDERR = 64 * 1024;

/** Strict field allowlists for the bounded generation-facts object. */
export const GEN_KEYS = Object.freeze(['exitStatus', 'signal', 'timedOut', 'probeOk', 'native', 'render', 'convert', 'png', 'pdf', 'recalc', 'pages', 'pngCounts', 'tools', 'elapsedMs', 'cgroup', 'evidencePaths']);
export const GEN_SUB_KEYS = Object.freeze(['ok', 'status', 'signal', 'error']);
export const GEN_SUB_PARSE_KEYS = Object.freeze(['ok', 'status', 'signal', 'error', 'parseOk']);
export const GEN_PNG_KEYS = Object.freeze(['ok', 'status', 'signal', 'error', 'count']);
export const GEN_PDF_KEYS = Object.freeze(['ok', 'status', 'signal', 'error', 'parseOk', 'pages']);
export const GEN_NATIVE_KEYS = Object.freeze(['status', 'generate', 'pptx']);
export const GEN_RENDER_KEYS = Object.freeze(['status']);
export const GEN_RECALC_KEYS = Object.freeze(['status', 'cachedValue', 'formula', 'inputs', 'child', 'nestedOk', 'convert']);
export const GEN_TOOLS_KEYS = Object.freeze(['soffice', 'pdftoppm']);
export const GEN_MAP_KEYS = Object.freeze(['docx', 'xlsx', 'pptx']);
const MAX_CGROUP_KEYS = 12;

/** sha256 hex of a Buffer (or string). */
export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

/** True when `parent` contains `child` (both already resolved absolute paths). */
export function isContained(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
}

/**
 * Validate/administer a deadline value. Returns { ok, ms, reason }. NaN/Infinity/
 * non-positive/over-cap values fail closed (no NaN/infinite bypass); undefined
 * or null falls back to the default.
 */
export function normalizeDeadlineMs(value, { fallback = DEFAULT_EXPORT_DEADLINE_MS, max = MAX_DEADLINE_MS } = {}) {
  const v = value === undefined || value === null ? fallback : value;
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > max) {
    return { ok: false, ms: null, reason: `invalid deadline ${JSON.stringify(v)} (must be a finite number in (0, ${max}])` };
  }
  return { ok: true, ms: v, reason: null };
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
    limits: { ...EXPECTED_LIMITS },
    extra,
  };
}

/** Encode one record as `<MARKER> <json>` (no trailing newline). */
export function encodeRecord(record) {
  return `${MARKER} ${JSON.stringify(record)}`;
}

/** Full ordered record list: capture, chunks, end. */
export function buildRecords({ capture, plan, generation, endElapsedMs = null }) {
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
      elapsedMs: endElapsedMs,
    },
  ];
}

// ---------------------------------------------------------------------------
// Authoritative generation facts (encoder side) + their strict validator
// ---------------------------------------------------------------------------

function genNum(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function genSig(v) {
  return v ? String(v) : null;
}
/** Compact sub-result: ok/status/signal/error(boolean). Never raw stderr. */
function genSub(o, withParse = false) {
  const s = { ok: !!(o && o.ok === true), status: genNum(o && o.status), signal: genSig(o && o.signal), error: !!(o && o.error) };
  if (withParse) s.parseOk = !!(o && o.parseOk === true);
  return s;
}

/**
 * Build the bounded authoritative generation-facts object from a parsed
 * artifacts payload and the child result. Raw stdout/stderr is NEVER copied in;
 * only bounded statuses/booleans/numbers are retained.
 */
export function buildGenerationFacts(payload, child) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const c = child || {};
  const rf = p.renderFacts && typeof p.renderFacts === 'object' ? p.renderFacts : {};
  const conv = (n) => genSub((rf[n] || {}).convert, false);
  const png = (n) => {
    const e = rf[n] || {};
    const ch = e.pngChild || {};
    return { ok: e.pdftoppmOk === true, status: genNum(ch.status), signal: genSig(ch.signal), error: !!ch.error, count: genNum(e.pngCount) };
  };
  const pdf = (n) => {
    const e = rf[n] || {};
    const ins = e.pdfInspection || {};
    return { ok: e.pdfInspectOk === true, status: genNum(ins.status), signal: genSig(ins.signal), error: !!ins.error, parseOk: ins.parseOk === true, pages: genNum(e.pages) };
  };
  const recalc = p.recalc && typeof p.recalc === 'object' ? p.recalc : {};
  const ro = recalc.observed && typeof recalc.observed === 'object' ? recalc.observed : {};
  const rcChild = recalc.child || {};
  return {
    exitStatus: genNum(c.status),
    signal: genSig(c.signal),
    timedOut: !!c.timedOut,
    probeOk: p.ok === true,
    native: {
      status: p.native && p.native.status ? String(p.native.status) : null,
      generate: genSub(p.nativeFacts && p.nativeFacts.generate, true),
      pptx: genSub(p.nativeFacts && p.nativeFacts.pptx, true),
    },
    render: { status: p.render && p.render.status ? String(p.render.status) : null },
    convert: { docx: conv('docx'), xlsx: conv('xlsx'), pptx: conv('pptx') },
    png: { docx: png('docx'), xlsx: png('xlsx'), pptx: png('pptx') },
    pdf: { docx: pdf('docx'), xlsx: pdf('xlsx'), pptx: pdf('pptx') },
    recalc: {
      status: recalc.status ? String(recalc.status) : null,
      cachedValue: genNum(ro.cachedValue),
      formula: typeof ro.formula === 'string' ? ro.formula : null,
      inputs: Array.isArray(ro.inputs) ? ro.inputs.slice(0, 3) : null,
      child: genSub(rcChild, true),
      nestedOk: !!(rcChild.parsed && rcChild.parsed.ok === true),
      convert: genSub(recalc.convert, false),
    },
    pages: { docx: genNum((rf.docx || {}).pages), xlsx: genNum((rf.xlsx || {}).pages), pptx: genNum((rf.pptx || {}).pages) },
    pngCounts: { docx: genNum((rf.docx || {}).pngCount), xlsx: genNum((rf.xlsx || {}).pngCount), pptx: genNum((rf.pptx || {}).pngCount) },
    tools: { soffice: !!(p.tools && p.tools.soffice), pdftoppm: !!(p.tools && p.tools.pdftoppm) },
    elapsedMs: null,
    cgroup: null,
    evidencePaths: Array.isArray(p.evidencePaths) ? p.evidencePaths.map((x) => String(x)).slice(0, 6) : [],
  };
}

function hasOnlyFields(obj, allowed) {
  return obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).every((k) => allowed.includes(k));
}

function genSubReasons(sub, label, keys) {
  const reasons = [];
  if (!sub || typeof sub !== 'object' || Array.isArray(sub)) return [`${label} missing`];
  if (!hasOnlyFields(sub, keys)) reasons.push(`${label} has unknown fields`);
  if (sub.ok !== true) reasons.push(`${label} ok is not true`);
  if (sub.status !== 0) reasons.push(`${label} status ${JSON.stringify(sub.status)} != 0`);
  if (sub.signal !== null) reasons.push(`${label} signal is not null`);
  if (sub.error !== false) reasons.push(`${label} error present`);
  return reasons;
}

function genCgroupReasons(cgroup) {
  if (cgroup === null) return [];
  if (!hasOnlyFields(cgroup, Object.keys(cgroup || {})) || typeof cgroup !== 'object' || Array.isArray(cgroup)) return ['cgroup malformed'];
  if (typeof cgroup.scope !== 'string' || cgroup.scope.length === 0 || cgroup.scope.length > 200) return ['cgroup scope invalid'];
  if (Object.keys(cgroup).length > MAX_CGROUP_KEYS) return ['cgroup has too many keys'];
  for (const [k, v] of Object.entries(cgroup)) {
    const okValue = k === 'scope' ? typeof v === 'string' : v === null || v === 'max' || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
    if (!okValue) return [`cgroup.${k} invalid`];
  }
  return [];
}

/**
 * Strict validator for the bounded generation-facts object. Used by BOTH the
 * encoder verdict and the decoder, so a nested `status:pass` alone is never
 * trusted. Any failed/unclean/nonexact fact fails.
 */
export function validateGenerationFacts(g) {
  const reasons = [];
  if (!g || typeof g !== 'object' || Array.isArray(g)) return { ok: false, reasons: ['generation facts missing or not an object'] };
  if (!hasOnlyFields(g, GEN_KEYS)) reasons.push('generation has unknown fields');
  if (g.exitStatus !== 0) reasons.push(`generation exitStatus ${JSON.stringify(g.exitStatus)} != 0`);
  if (g.signal !== null) reasons.push(`generation signal ${JSON.stringify(g.signal)} is not null`);
  if (g.timedOut !== false) reasons.push('generation timedOut is not false');
  if (g.probeOk !== true) reasons.push('generation probe ok is not true');

  const nat = g.native;
  if (!hasOnlyFields(nat, GEN_NATIVE_KEYS)) reasons.push('native has unknown fields');
  if (!nat || nat.status !== 'pass') reasons.push('native status is not pass');
  reasons.push(...genSubReasons(nat && nat.generate, 'native.generate', GEN_SUB_PARSE_KEYS));
  reasons.push(...genSubReasons(nat && nat.pptx, 'native.pptx', GEN_SUB_PARSE_KEYS));

  if (!hasOnlyFields(g.render, GEN_RENDER_KEYS)) reasons.push('render has unknown fields');
  if (!g.render || g.render.status !== 'pass') reasons.push('render status is not pass');

  for (const name of GEN_MAP_KEYS) {
    reasons.push(...genSubReasons((g.convert || {})[name], `convert.${name}`, GEN_SUB_KEYS));
    const pngSub = (g.png || {})[name];
    reasons.push(...genSubReasons(pngSub, `png.${name}`, GEN_PNG_KEYS));
    if (pngSub && pngSub.count !== EXPECTED_PAGES[name]) reasons.push(`png.${name} count ${JSON.stringify(pngSub.count)} != ${EXPECTED_PAGES[name]}`);
    const pdfSub = (g.pdf || {})[name];
    reasons.push(...genSubReasons(pdfSub, `pdf.${name}`, GEN_PDF_KEYS));
    if (pdfSub && pdfSub.parseOk !== true) reasons.push(`pdf.${name} parseOk is not true`);
    if (pdfSub && pdfSub.pages !== EXPECTED_PAGES[name]) reasons.push(`pdf.${name} pages ${JSON.stringify(pdfSub.pages)} != ${EXPECTED_PAGES[name]}`);
  }
  if (!hasOnlyFields(g.convert, GEN_MAP_KEYS)) reasons.push('convert has unknown fields');
  if (!hasOnlyFields(g.png, GEN_MAP_KEYS)) reasons.push('png has unknown fields');
  if (!hasOnlyFields(g.pdf, GEN_MAP_KEYS)) reasons.push('pdf has unknown fields');

  const rc = g.recalc;
  if (!hasOnlyFields(rc, GEN_RECALC_KEYS)) reasons.push('recalc has unknown fields');
  if (!rc || rc.status !== 'pass') reasons.push('recalc status is not pass');
  if (typeof rc?.cachedValue !== 'number' || !Number.isFinite(rc.cachedValue) || rc.cachedValue !== EXPECTED_RECALC) reasons.push(`recalc cachedValue ${JSON.stringify(rc && rc.cachedValue)} is not numeric ${EXPECTED_RECALC}`);
  if (rc?.formula !== EXPECTED_FORMULA) reasons.push(`recalc formula ${JSON.stringify(rc && rc.formula)} != ${EXPECTED_FORMULA}`);
  if (JSON.stringify(rc?.inputs) !== JSON.stringify(EXPECTED_INPUTS)) reasons.push(`recalc inputs ${JSON.stringify(rc && rc.inputs)} != ${JSON.stringify(EXPECTED_INPUTS)}`);
  reasons.push(...genSubReasons(rc?.child, 'recalc.child', GEN_SUB_PARSE_KEYS));
  if (rc?.child && rc.child.parseOk !== true) reasons.push('recalc.child parseOk is not true');
  if (rc?.nestedOk !== true) reasons.push('recalc.child nestedOk is not true');
  reasons.push(...genSubReasons(rc?.convert, 'recalc.convert', GEN_SUB_KEYS));

  for (const name of GEN_MAP_KEYS) {
    if ((g.pages || {})[name] !== EXPECTED_PAGES[name]) reasons.push(`pages.${name} ${JSON.stringify((g.pages || {})[name])} != ${EXPECTED_PAGES[name]}`);
    if ((g.pngCounts || {})[name] !== EXPECTED_PAGES[name]) reasons.push(`pngCounts.${name} ${JSON.stringify((g.pngCounts || {})[name])} != ${EXPECTED_PAGES[name]}`);
  }
  if (!hasOnlyFields(g.pages, GEN_MAP_KEYS)) reasons.push('pages has unknown fields');
  if (!hasOnlyFields(g.pngCounts, GEN_MAP_KEYS)) reasons.push('pngCounts has unknown fields');

  if (!hasOnlyFields(g.tools, GEN_TOOLS_KEYS)) reasons.push('tools has unknown fields');
  if (!g.tools || g.tools.soffice !== true || g.tools.pdftoppm !== true) reasons.push('tools missing soffice/pdftoppm');

  if (!(g.elapsedMs === null || (typeof g.elapsedMs === 'number' && Number.isFinite(g.elapsedMs) && g.elapsedMs >= 0))) reasons.push('elapsedMs invalid');
  reasons.push(...genCgroupReasons(g.cgroup));
  if (!Array.isArray(g.evidencePaths)) reasons.push('evidencePaths is not an array');
  return { ok: reasons.length === 0, reasons };
}

/**
 * Pure verdict over the artifacts child. Requires a clean exit, confirmed
 * cleanup, structured pass, and the exact retained nested facts. Any signal,
 * timeout, error, uncleaned process group, unparseable stdout or missing data
 * fails. A good-looking nested payload after a failed child can never pass.
 */
export function verifyArtifactsVerdict(child) {
  const reasons = [];
  const c = child || {};
  if (c.error) reasons.push(`child spawn/cleanup error: ${String(c.error).slice(0, 160)}`);
  if (c.timedOut) reasons.push('child exceeded the generation deadline');
  if (c.signal) reasons.push(`child killed by signal ${c.signal}`);
  if (c.cleanupConfirmed === false) reasons.push('child cleanup not confirmed (process group/descendants not proven exited)');
  if (typeof c.status !== 'number' || c.status !== 0) reasons.push(`child exit status ${c.status}`);
  const parsed = parseStructuredOutput(c.stdout);
  if (!parsed.ok) reasons.push(`stdout not a single structured object: ${String(parsed.error).slice(0, 120)}`);
  const payload = parsed.value || {};
  const generation = buildGenerationFacts(payload, c);
  reasons.push(...validateGenerationFacts(generation).reasons);
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
 * walk). Validates EVERY real-directory ancestor (no symlink/junction), then
 * the leaf (regular file, single link, within cap); revalidates descriptor
 * identity/linkcount/type/size BEFORE and AFTER the read; rejects escapes.
 */
export function inspectExpectedFiles(runDir, io = {}) {
  const lstat = io.lstatSync || lstatSync;
  const reasons = [];
  const entries = [];
  let realRoot = null;
  try {
    const rst = lstat(runDir);
    if (rst.isSymbolicLink()) reasons.push('run root is a symlink/junction');
    else if (!rst.isDirectory()) reasons.push('run root is not a directory');
    else realRoot = safeRealpath(runDir);
  } catch (error) {
    reasons.push(`run root unreadable: ${String(error && error.message ? error.message : error).slice(0, 100)}`);
  }
  if (reasons.length) return { ok: false, reasons, entries, totalBytes: 0 };
  let totalBytes = 0;
  for (const spec of EXPECTED_FILES) {
    const full = join(runDir, spec.path);
    if (!isContained(runDir, full)) { reasons.push(`${spec.path} escapes the run root`); continue; }
    const anc = assertRealDirectoryAncestors(runDir, spec.path, lstat);
    if (!anc.ok) { reasons.push(`${spec.path}: ${anc.reason}`); continue; }
    let lst;
    try {
      lst = lstat(full);
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

/** Every ancestor component of `relPath` under `root` must be a real directory. */
export function assertRealDirectoryAncestors(root, relPath, lstat = lstatSync) {
  const parts = relPath.split('/');
  parts.pop();
  let cur = root;
  for (const p of parts) {
    cur = join(cur, p);
    let st;
    try {
      st = lstat(cur);
    } catch {
      return { ok: false, reason: `ancestor ${p} unreadable` };
    }
    if (st.isSymbolicLink()) return { ok: false, reason: `ancestor ${p} is a symlink/junction` };
    if (!st.isDirectory()) return { ok: false, reason: `ancestor ${p} is not a directory` };
  }
  return { ok: true, reason: null };
}

function safeRealpath(p) {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

/**
 * Open with O_NOFOLLOW, revalidate descriptor identity/linkcount/type/size both
 * BEFORE reading (vs the caller's lstat) and AFTER reading.
 */
export function readRegularFileVerified(full, lst) {
  const NOFOLLOW = constants.O_NOFOLLOW || 0;
  const fd = openSync(full, constants.O_RDONLY | NOFOLLOW);
  try {
    const before = fstatSync(fd);
    if (!before.isFile()) throw new Error('descriptor is not a regular file');
    if (before.nlink > 1) throw new Error('descriptor has hard links');
    if (before.dev !== lst.dev || before.ino !== lst.ino || before.size !== lst.size) throw new Error('descriptor/stat identity mismatch before read');
    const buf = Buffer.allocUnsafe(before.size);
    let read = 0;
    while (read < before.size) {
      const n = readSync(fd, buf, read, before.size - read, read);
      if (n <= 0) break;
      read += n;
    }
    if (read !== before.size) throw new Error(`short read ${read}/${before.size}`);
    const after = fstatSync(fd);
    if (!after.isFile() || after.nlink > 1) throw new Error('descriptor/stat identity mismatch after read');
    if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
      throw new Error('descriptor/stat identity changed during read');
    }
    return buf;
  } finally {
    closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// Child process: owned Linux process group + confirmed cleanup
// ---------------------------------------------------------------------------

/** Kill the OWNED process group (Linux, detached) else the direct child. */
export function defaultGroupKill(child, signal = 'SIGKILL') {
  if (!child) return false;
  if (process.platform === 'linux' && Number.isInteger(child.pid) && child.pid > 0) {
    try { process.kill(-child.pid, signal); return true; } catch { return false; }
  }
  try { return typeof child.kill === 'function' && child.kill(signal) === true; } catch { return false; }
}

/** True when the owned process group still has live members (Linux only). */
export function defaultProbeGroup(child) {
  if (!child) return false;
  if (process.platform === 'linux' && Number.isInteger(child.pid) && child.pid > 0) {
    try { process.kill(-child.pid, 0); return true; } catch (error) { return !!(error && error.code === 'EPERM'); }
  }
  return false; // non-Linux: cannot probe a group, treat as absent
}

/**
 * Spawn the unchanged artifacts probe exactly once in its own (Linux) process
 * group, with REQUIRED rendering and a fresh output root, bounded streams and a
 * hard deadline. Resolves only after the child 'close' event AND a confirmed
 * absent process group/descendants within a bounded grace. A kill request,
 * a false kill result or an error is NOT confirmation of exit; any uncertainty
 * fails closed (cleanupConfirmed=false + error).
 */
export function runArtifactsChild({
  base,
  deadlineMs = DEFAULT_DEADLINE_MS,
  spawnFn = spawn,
  env = process.env,
  graceMs = 5000,
  groupKill = defaultGroupKill,
  probeGroup = defaultProbeGroup,
  detached,
} = {}) {
  return new Promise((resolve) => {
    const dl = normalizeDeadlineMs(deadlineMs, { fallback: DEFAULT_DEADLINE_MS });
    if (!dl.ok) {
      resolve({ status: null, signal: null, timedOut: false, cleanupConfirmed: false, error: dl.reason, stdout: '', stderr: '' });
      return;
    }
    const useDetached = detached === undefined ? process.platform === 'linux' : !!detached;
    const childEnv = { ...env, MERI_ARTIFACTS_OUTPUT_DIR: base, MERI_ARTIFACTS_RENDER: 'required' };
    let child;
    try {
      child = spawnFn(process.execPath, [ARTIFACTS], { env: childEnv, stdio: ['ignore', 'pipe', 'pipe'], detached: useDetached });
    } catch (error) {
      resolve({ status: null, signal: null, timedOut: false, cleanupConfirmed: false, error: String(error && error.message ? error.message : error), stdout: '', stderr: '' });
      return;
    }
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let exited = null;
    let timedOut = false;
    let overflow = false;
    let spawnError = null;
    let killRequested = false;
    let groupKillOk = null;
    let cleanupConfirmed = false;
    let deadlineTimer = null;
    let graceTimer = null;
    let pollTimer = null;

    const settle = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadlineTimer);
      clearTimeout(graceTimer);
      clearTimeout(pollTimer);
      resolve({
        status: exited ? exited.code : null,
        signal: exited ? exited.signal : null,
        timedOut,
        overflow,
        killRequested,
        groupKillOk,
        cleanupConfirmed,
        detached: useDetached,
        error: spawnError || (overflow ? 'child stdout exceeded bound' : null) || (error || null),
        stdout,
        stderr,
      });
    };

    const groupGone = () => {
      try { return probeGroup(child) !== true; } catch { return false; }
    };

    // After close: confirm the group/descendants are gone; poll within the grace.
    const confirmAfterClose = () => {
      if (groupGone()) { cleanupConfirmed = true; settle(null); return; }
      const start = Date.now();
      const poll = () => {
        if (settled) return;
        if (groupGone()) { cleanupConfirmed = true; settle(null); return; }
        if (Date.now() - start >= graceMs) { cleanupConfirmed = false; settle('process group/descendants not confirmed clean after close'); return; }
        pollTimer = setTimeout(poll, 10);
      };
      poll();
    };

    const requestKill = () => {
      killRequested = true;
      try { groupKillOk = groupKill(child, 'SIGKILL') === true; } catch { groupKillOk = false; }
      graceTimer = setTimeout(() => { cleanupConfirmed = false; settle('child did not close after group kill within grace'); }, graceMs);
    };

    deadlineTimer = setTimeout(() => {
      timedOut = true;
      requestKill();
    }, dl.ms);

    child.on('error', (err) => { spawnError = String(err && err.message ? err.message : err); });
    child.stdout.on('data', (d) => {
      stdoutBytes += d.length;
      if (stdoutBytes > MAX_CHILD_STDOUT) { overflow = true; if (!killRequested) requestKill(); return; }
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d) => {
      stderrBytes += d.length;
      if (stderrBytes > MAX_CHILD_STDERR) return;
      stderr += d.toString('utf8');
    });
    child.on('exit', (code, signal) => { exited = { code, signal }; });
    child.on('close', (code, signal) => {
      exited = { code, signal };
      if (settled) return;
      clearTimeout(deadlineTimer);
      confirmAfterClose();
    });
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

// ---------------------------------------------------------------------------
// Bounded streaming
// ---------------------------------------------------------------------------

function errMsg(error) {
  return String(error && error.message ? error.message : error).slice(0, 120);
}

/**
 * Await a single stream write, raced against `remainingMs` and stream errors.
 * Never hangs: the timer, the write callback, a thrown error and a stream
 * 'error' event all settle exactly once, and all listeners/timers are removed.
 */
export function writeBounded(stream, line, remainingMs) {
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (typeof stream.off === 'function') stream.off('error', onError);
    };
    const finish = (ok, error) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ ok, error: error || null });
    };
    function onError(err) { finish(false, `stdout error: ${errMsg(err)}`); }
    timer = setTimeout(() => finish(false, 'write exceeded the export deadline'), Math.max(1, Math.floor(remainingMs)));
    if (typeof stream.on === 'function') stream.on('error', onError);
    if (stream.writable === false && stream.destroyed === true) { finish(false, 'stdout is not writable'); return; }
    try {
      stream.write(line + '\n', (err) => (err ? finish(false, `write callback error: ${errMsg(err)}`) : finish(true, null)));
    } catch (error) {
      finish(false, `write threw: ${errMsg(error)}`);
    }
  });
}

/**
 * Stream records with an ABSOLUTE deadline. Pending writes, error waits and the
 * final flush are all bounded by the deadline; the deadline is re-checked
 * absolutely after the last write, so a late final write is not a false pass.
 * Listener/timer cleanup is guaranteed. Returns { ok, written, error }.
 */
export async function streamRecords(stream, records, { deadlineMs, deadlineAt, now = () => Date.now() } = {}) {
  let deadline;
  if (deadlineAt !== undefined) {
    if (typeof deadlineAt !== 'number' || !Number.isFinite(deadlineAt)) return { ok: false, written: 0, error: 'invalid absolute deadline' };
    deadline = deadlineAt;
  } else {
    const r = normalizeDeadlineMs(deadlineMs, { fallback: DEFAULT_EXPORT_DEADLINE_MS });
    if (!r.ok) return { ok: false, written: 0, error: r.reason };
    deadline = now() + r.ms;
  }
  let streamError = null;
  const onError = (err) => { streamError = err; };
  if (typeof stream.on === 'function') stream.on('error', onError);
  let written = 0;
  try {
    for (const record of records) {
      if (streamError) return { ok: false, written, error: `stdout error: ${errMsg(streamError)}` };
      const remaining = deadline - now();
      if (remaining <= 0) return { ok: false, written, error: 'export deadline exceeded before writing a record' };
      const res = await writeBounded(stream, encodeRecord(record), remaining);
      if (!res.ok) return { ok: false, written, error: res.error };
      written++;
    }
    if (now() > deadline) return { ok: false, written, error: 'export deadline exceeded after the final write' };
    if (streamError) return { ok: false, written, error: `stdout error: ${errMsg(streamError)}` };
    return { ok: true, written, error: null };
  } catch (error) {
    return { ok: false, written, error: errMsg(error) };
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
    spawnFn = spawn,
    writeStream = process.stdout,
    now = () => Date.now(),
    readCgroup = readCgroupObservations,
    mkdir = mkdirSync,
    graceMs = 5000,
    detached,
  } = opts;
  const genDl = normalizeDeadlineMs(opts.deadlineMs ?? Number(process.env.MERI_OFFICE_EXPORT_GEN_DEADLINE_MS || DEFAULT_DEADLINE_MS), { fallback: DEFAULT_DEADLINE_MS });
  const expDl = normalizeDeadlineMs(opts.exportDeadlineMs ?? Number(process.env.MERI_OFFICE_EXPORT_DEADLINE_MS || DEFAULT_EXPORT_DEADLINE_MS), { fallback: DEFAULT_EXPORT_DEADLINE_MS });
  const capture = randomUUID();
  const emitAbort = async (reasons) => {
    const record = { kind: 'error', v: PROTOCOL, capture, reasons: reasons.map((r) => String(r).slice(0, 200)).slice(0, 12) };
    try { await streamRecords(writeStream, [record], { deadlineMs: ABORT_DEADLINE_MS, now }); } catch { /* best effort */ }
  };
  if (!genDl.ok) { await emitAbort([genDl.reason]); return 1; }
  if (!expDl.ok) { await emitAbort([expDl.reason]); return 1; }
  try {
    const base = join(baseRoot, `office-export-${capture}`);
    mkdir(baseRoot, { recursive: true });
    try {
      mkdir(base); // exclusive: throws EEXIST if it somehow already exists
    } catch (error) {
      if (error && error.code === 'EEXIST') { await emitAbort(['fresh run base already exists']); return 1; }
      throw error;
    }
    const genStart = now();
    const child = await runArtifactsChild({ base, deadlineMs: genDl.ms, spawnFn, graceMs, detached });
    const genElapsedMs = now() - genStart;
    const verdict = verifyArtifactsVerdict(child);
    if (!verdict.ok) { await emitAbort(verdict.reasons); return 1; }
    const disco = discoverRunDir(base);
    if (!disco.ok) { await emitAbort(disco.reasons); return 1; }
    const scan = inspectExpectedFiles(disco.runDir);
    if (!scan.ok) { await emitAbort(scan.reasons); return 1; }
    const exportStart = now();
    const exportDeadlineAt = exportStart + expDl.ms;
    const plan = planExport(scan.entries, capture, {});
    if (!plan.ok) { await emitAbort(plan.reasons); return 1; }
    const generation = { ...verdict.generation, elapsedMs: genElapsedMs, cgroup: readCgroup() };
    const records = buildRecords({ capture, plan, generation });
    const head = records.slice(0, -1);
    const endRecord = records.at(-1);
    const streamed = await streamRecords(writeStream, head, { deadlineAt: exportDeadlineAt, now });
    if (!streamed.ok) { await emitAbort([streamed.error]); return 1; }
    // Honest measured export timing, bounded to the actual export phase: covers
    // capture + every chunk through the last chunk flush; it excludes the end
    // record's own final line flush (it cannot measure its own write).
    endRecord.elapsedMs = Math.max(0, now() - exportStart);
    const tail = await streamRecords(writeStream, [endRecord], { deadlineAt: exportDeadlineAt, now });
    if (!tail.ok) { await emitAbort([tail.error]); return 1; }
    return 0;
  } catch (error) {
    await emitAbort([String(error && error.message ? error.message : error)]);
    return 1;
  }
}

const invokedDirectly = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (invokedDirectly) {
  main().then((code) => process.exit(code)).catch(() => {
    process.exit(1);
  });
}
