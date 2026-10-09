// Opt-in Linux Office-only evidence EXPORT wrapper (probe:office-export).
//
// NEVER run by `npm test`. It is the Fargate task Command the owner wires as
//   EntryPoint:["node"], Command:["/opt/meri-worker/probes/office-export.mjs"]
// after a separate exact-commit review. PREPARATION only: not built, not
// executed natively here, no cloud/provider/source call. It runs the UNCHANGED
// sibling artifacts.mjs EXACTLY ONCE with REQUIRED rendering, reads the fresh
// probe-<uuid> subtree it generates, verifies the authoritative structured
// verdict AND the exact retained nested observations (native Python parseOk and
// parsed DOCX/XLSX results/structures, PPTX 2-slide/2-note structure, per-format
// PDF parsed result/page count, and the recalc child's selected observations),
// and only then streams the exact eleven allowlisted files as marker-prefixed
// bounded base64 chunk records plus a manifest and an end record. A failed,
// signalled, timed-out, uncleaned or unparseable generation NEVER emits a
// successful-looking payload: it emits a single `error` record and exits nonzero.
//
// Every export line is `<MARKER> <json>`. Writes are bounded by an absolute
// deadline (pending write/error waits raced against a timer). Draining to local
// stdout proves LOCAL WRITE ONLY; it does not prove CloudWatch delivery.

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

export const MARKER = 'MERI_OFFICE_EXPORT_V1';
export const PROTOCOL = 'meri-office-export/1';

export const CHUNK_BYTES = 6144;
export const MAX_LINE_BYTES = 12 * 1024;
export const MAX_TOTAL_CHUNKS = 1500;
export const MAX_DEADLINE_MS = 120000;

/** Provisional fail-closed size caps (baseline did not record actual sizes). */
export const CAPS = Object.freeze({ native: 512 * 1024, pdf: 1024 * 1024, png: 2 * 1024 * 1024, total: 8 * 1024 * 1024 });

/** Exact expected capture limits (must match; never auto-expanded). */
export const EXPECTED_LIMITS = Object.freeze({
  native: CAPS.native, pdf: CAPS.pdf, png: CAPS.png, total: CAPS.total,
  chunkBytes: CHUNK_BYTES, maxLineBytes: MAX_LINE_BYTES, maxTotalChunks: MAX_TOTAL_CHUNKS,
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

export const EXPECTED_PAGES = Object.freeze({ docx: 1, xlsx: 1, pptx: 2 });
export const EXPECTED_RECALC = 6;
export const EXPECTED_FORMULA = '=SUM(A1:A3)';
export const EXPECTED_INPUTS = Object.freeze([1, 2, 3]);
// Exact deterministic expectations from the UNCHANGED artifacts.py fixture.
export const EXPECT_DOCX_HEADING = 'Meri qualification heading';
export const EXPECT_DOCX_TABLE = Object.freeze([Object.freeze(['label', 'value']), Object.freeze(['answer', '6'])]);
export const EXPECT_DOCX_PART = 'word/document.xml';
export const EXPECT_XLSX_PART = 'xl/worksheets/sheet1.xml';
export const EXPECT_PPTX_SLIDE_PARTS = Object.freeze(['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml']);
export const EXPECT_PPTX_NOTES_PARTS = Object.freeze(['ppt/notesSlides/notesSlide1.xml', 'ppt/notesSlides/notesSlide2.xml']);

const DEFAULT_DEADLINE_MS = 120000;
const DEFAULT_EXPORT_DEADLINE_MS = 120000;
const ABORT_DEADLINE_MS = 5000;
const MAX_CHILD_STDOUT = 4 * 1024 * 1024;
const MAX_CHILD_STDERR = 64 * 1024;
const MAX_EVIDENCE_PATHS = 8;
const MAX_EVIDENCE_PATH_LEN = 400;

/** Strict field allowlists for the bounded generation-facts object. */
export const GEN_KEYS = Object.freeze(['exitStatus', 'signal', 'timedOut', 'probeOk', 'native', 'render', 'convert', 'png', 'pdf', 'recalc', 'pages', 'pngCounts', 'tools', 'elapsedMs', 'cgroup', 'evidencePaths']);
export const GEN_NATIVE_KEYS = Object.freeze(['status', 'generate', 'pptx']);
export const GEN_RENDER_KEYS = Object.freeze(['status']);
export const GEN_GENERATE_KEYS = Object.freeze(['ok', 'status', 'signal', 'error', 'parseOk', 'parsedOk', 'resultCount', 'docx', 'xlsx']);
export const GEN_DOCX_KEYS = Object.freeze(['ok', 'headings', 'tableText', 'tableCount', 'hasDocumentXml']);
export const GEN_XLSX_KEYS = Object.freeze(['ok', 'inputs', 'a4Formula', 'a4CachedValue', 'hasSheetXml']);
export const GEN_PPTX_KEYS = Object.freeze(['ok', 'status', 'signal', 'error', 'parseOk', 'parsedOk', 'resultCount', 'resultOk', 'slideCount', 'notesCount', 'hasSlideParts', 'hasNotesParts']);
export const GEN_SUB_KEYS = Object.freeze(['ok', 'status', 'signal', 'error']);
export const GEN_PNG_KEYS = Object.freeze(['ok', 'status', 'signal', 'error', 'count']);
export const GEN_PDF_KEYS = Object.freeze(['ok', 'status', 'signal', 'error', 'parseOk', 'parsedOk', 'resultCount', 'resultOk', 'pageCount']);
export const GEN_RECALC_KEYS = Object.freeze(['status', 'inspected', 'inputs', 'formula', 'cachedValue', 'newFile', 'convert', 'child']);
export const GEN_RECALC_CHILD_KEYS = Object.freeze(['ok', 'status', 'signal', 'error', 'parseOk', 'parsedOk', 'resultCount', 'resultOk', 'observedInspected', 'observedInputs', 'observedFormula', 'observedCachedValue']);
export const GEN_TOOLS_KEYS = Object.freeze(['soffice', 'pdftoppm']);
export const GEN_MAP_KEYS = Object.freeze(['docx', 'xlsx', 'pptx']);
export const CGROUP_KEYS = Object.freeze(['scope', 'memoryCurrent', 'memoryPeak', 'memoryMax', 'pidsCurrent', 'cpuStatLines']);

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

/** True when `parent` contains `child` (both already resolved absolute paths). */
export function isContained(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
}

/** Validate a deadline value; NaN/Infinity/non-positive/over-cap fail closed. */
export function normalizeDeadlineMs(value, { fallback = DEFAULT_EXPORT_DEADLINE_MS, max = MAX_DEADLINE_MS } = {}) {
  const v = value === undefined || value === null ? fallback : value;
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > max) {
    return { ok: false, ms: null, reason: `invalid deadline ${JSON.stringify(v)} (must be a finite number in (0, ${max}])` };
  }
  return { ok: true, ms: v, reason: null };
}

export function chunkBuffer(buf, size = CHUNK_BYTES) {
  const out = [];
  if (buf.length === 0) { out.push(Buffer.alloc(0)); return out; }
  for (let off = 0; off < buf.length; off += size) out.push(buf.subarray(off, off + size));
  return out;
}

export function planExport(entries, capture, extra = {}) {
  const reasons = [];
  const byPath = new Map(entries.map((e) => [e.path, e]));
  const manifestEntries = [];
  const chunkRecords = [];
  let totalBytes = 0;
  let totalChunks = 0;
  for (const spec of EXPECTED_FILES) {
    const entry = byPath.get(spec.path);
    if (!entry) { reasons.push(`missing expected file ${spec.path}`); continue; }
    const buf = Buffer.isBuffer(entry.buffer) ? entry.buffer : Buffer.from(entry.buffer || []);
    if (buf.length > spec.cap) reasons.push(`${spec.path} size ${buf.length} exceeds cap ${spec.cap}`);
    totalBytes += buf.length;
    const digest = sha256Hex(buf);
    const parts = chunkBuffer(buf);
    manifestEntries.push({ path: spec.path, kind: spec.kind, index: spec.index, bytes: buf.length, sha256: digest, chunks: parts.length });
    parts.forEach((part, seq) => {
      const record = { kind: 'chunk', v: PROTOCOL, capture, path: spec.path, index: spec.index, seq, total: parts.length, bytes: part.length, data: part.toString('base64') };
      if (Buffer.byteLength(encodeRecord(record), 'utf8') > MAX_LINE_BYTES) reasons.push(`${spec.path} chunk ${seq} line exceeds ${MAX_LINE_BYTES} bytes`);
      chunkRecords.push(record);
      totalChunks++;
    });
  }
  for (const p of entries.map((e) => e.path).filter((p) => !EXPECTED_FILES.some((s) => s.path === p))) reasons.push(`unexpected file ${p}`);
  if (totalBytes > CAPS.total) reasons.push(`aggregate ${totalBytes} exceeds total cap ${CAPS.total}`);
  if (totalChunks > MAX_TOTAL_CHUNKS) reasons.push(`aggregate chunks ${totalChunks} exceed ${MAX_TOTAL_CHUNKS}`);
  return {
    ok: reasons.length === 0, reasons, manifestEntries, chunkRecords, totalBytes, totalChunks,
    manifestSha256: sha256Hex(JSON.stringify(manifestEntries)), limits: { ...EXPECTED_LIMITS }, extra,
  };
}

export function encodeRecord(record) {
  return `${MARKER} ${JSON.stringify(record)}`;
}

/** Full ordered record list: capture, chunks, end. */
export function buildRecords({ capture, plan, generation, endElapsedMs = null }) {
  return [
    { kind: 'capture', v: PROTOCOL, capture, protocol: MARKER, fileCount: plan.manifestEntries.length, chunkCount: plan.totalChunks, totalBytes: plan.totalBytes, limits: plan.limits, generation, files: plan.manifestEntries },
    ...plan.chunkRecords,
    { kind: 'end', v: PROTOCOL, capture, fileCount: plan.manifestEntries.length, chunkCount: plan.totalChunks, totalBytes: plan.totalBytes, manifestSha256: plan.manifestSha256, files: plan.manifestEntries, elapsedMs: endElapsedMs },
  ];
}

// ---------------------------------------------------------------------------
// Authoritative generation facts (encoder) + strict validator (encoder+decoder)
// ---------------------------------------------------------------------------

function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }
function sig(v) { return v ? String(v) : null; }
function sub(o) {
  const s = o && typeof o === 'object' ? o : {};
  return { ok: s.ok === true, status: num(s.status), signal: sig(s.signal), error: !!s.error };
}
function strArray(v) { return Array.isArray(v) && v.every((x) => typeof x === 'string') ? v.map((x) => x) : null; }
function numArray(v) { return Array.isArray(v) && v.every((x) => typeof x === 'number' && Number.isFinite(x)) ? v.map((x) => x) : null; }
function tableArray(v) { return Array.isArray(v) && v.every((r) => Array.isArray(r) && r.every((c) => typeof c === 'string')) ? v.map((r) => r.map((c) => c)) : null; }

/**
 * Build bounded authoritative generation facts from a parsed artifacts payload
 * and child result. Raw stdout/stderr is NEVER copied in; only bounded typed
 * observations (including the exact retained DOCX/XLSX/PPTX/PDF/recalc nested
 * facts) are kept.
 */
export function buildGenerationFacts(payload, child) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const c = child || {};
  const rf = p.renderFacts && typeof p.renderFacts === 'object' ? p.renderFacts : {};

  const gen = (p.nativeFacts && p.nativeFacts.generate) || {};
  const genParsed = gen.parsed && typeof gen.parsed === 'object' ? gen.parsed : {};
  const genResults = Array.isArray(genParsed.results) ? genParsed.results : [];
  const docxR = genResults[0] || {}; const dReop = docxR.reopened || {};
  const xlsxR = genResults[1] || {}; const xReop = xlsxR.reopened || {};

  const pptx = (p.nativeFacts && p.nativeFacts.pptx) || {};
  const pptxParsed = pptx.parsed && typeof pptx.parsed === 'object' ? pptx.parsed : {};
  const pptxResults = Array.isArray(pptxParsed.results) ? pptxParsed.results : [];
  const pptxR = pptxResults[0] || {};
  const pptxStruct = strArray(pptxR.structure);

  const conv = (n) => sub((rf[n] || {}).convert);
  const png = (n) => { const e = rf[n] || {}; const ch = e.pngChild || {}; return { ok: e.pdftoppmOk === true, status: num(ch.status), signal: sig(ch.signal), error: !!ch.error, count: num(e.pngCount) }; };
  const pdf = (n) => {
    const e = rf[n] || {}; const ins = e.pdfInspection || {};
    const insParsed = ins.parsed && typeof ins.parsed === 'object' ? ins.parsed : {};
    const res = Array.isArray(insParsed.results) ? insParsed.results : [];
    const r0 = res[0] || {};
    return { ok: e.pdfInspectOk === true, status: num(ins.status), signal: sig(ins.signal), error: !!ins.error, parseOk: ins.parseOk === true, parsedOk: insParsed.ok === true, resultCount: Array.isArray(insParsed.results) ? insParsed.results.length : null, resultOk: r0.ok === true, pageCount: num(r0.pageCount) };
  };

  const recalc = p.recalc && typeof p.recalc === 'object' ? p.recalc : {};
  const ro = recalc.observed && typeof recalc.observed === 'object' ? recalc.observed : {};
  const rcChild = recalc.child && typeof recalc.child === 'object' ? recalc.child : {};
  const rcParsed = rcChild.parsed && typeof rcChild.parsed === 'object' ? rcChild.parsed : {};
  const rcResults = Array.isArray(rcParsed.results) ? rcParsed.results : [];
  const rc0 = rcResults[0] || {};
  const rcObs = rc0.observed && typeof rc0.observed === 'object' ? rc0.observed : {};

  return {
    exitStatus: num(c.status),
    signal: sig(c.signal),
    timedOut: !!c.timedOut,
    probeOk: p.ok === true,
    native: {
      status: p.native && p.native.status ? String(p.native.status) : null,
      generate: {
        ...sub(gen), parseOk: gen.parseOk === true, parsedOk: genParsed.ok === true,
        resultCount: Array.isArray(genParsed.results) ? genParsed.results.length : null,
        docx: {
          ok: docxR.ok === true,
          headings: strArray(dReop.headings),
          tableText: tableArray(dReop.tableText),
          tableCount: num(dReop.tableCount),
          hasDocumentXml: strArray(docxR.structure) ? docxR.structure.includes(EXPECT_DOCX_PART) : (docxR.hasDocumentXml === true),
        },
        xlsx: {
          ok: xlsxR.ok === true,
          inputs: numArray(xReop.inputs),
          a4Formula: typeof xReop.a4Formula === 'string' ? xReop.a4Formula : null,
          a4CachedValue: xReop.a4GeneratedCachedValue === undefined ? null : num(xReop.a4GeneratedCachedValue),
          hasSheetXml: strArray(xlsxR.structure) ? xlsxR.structure.includes(EXPECT_XLSX_PART) : (xlsxR.hasSheetXml === true),
        },
      },
      pptx: {
        ...sub(pptx), parseOk: pptx.parseOk === true, parsedOk: pptxParsed.ok === true,
        resultCount: Array.isArray(pptxParsed.results) ? pptxParsed.results.length : null,
        resultOk: pptxR.ok === true,
        slideCount: num(pptxR.slideCount),
        notesCount: num(pptxR.notesCount),
        hasSlideParts: pptxStruct ? EXPECT_PPTX_SLIDE_PARTS.every((x) => pptxStruct.includes(x)) : false,
        hasNotesParts: pptxStruct ? EXPECT_PPTX_NOTES_PARTS.every((x) => pptxStruct.includes(x)) : false,
      },
    },
    render: { status: p.render && p.render.status ? String(p.render.status) : null },
    convert: { docx: conv('docx'), xlsx: conv('xlsx'), pptx: conv('pptx') },
    png: { docx: png('docx'), xlsx: png('xlsx'), pptx: png('pptx') },
    pdf: { docx: pdf('docx'), xlsx: pdf('xlsx'), pptx: pdf('pptx') },
    recalc: {
      status: recalc.status ? String(recalc.status) : null,
      inspected: ro.inspected === true,
      inputs: numArray(ro.inputs),
      formula: typeof ro.formula === 'string' ? ro.formula : null,
      cachedValue: num(ro.cachedValue),
      newFile: typeof recalc.file === 'string' && recalc.file.length > 0 ? recalc.file : null,
      convert: sub(recalc.convert),
      child: {
        ...sub(rcChild), parseOk: rcChild.parseOk === true, parsedOk: rcParsed.ok === true,
        resultCount: Array.isArray(rcParsed.results) ? rcParsed.results.length : null,
        resultOk: rc0.ok === true,
        observedInspected: rcObs.inspected === true,
        observedInputs: numArray(rcObs.inputs),
        observedFormula: typeof rcObs.formula === 'string' ? rcObs.formula : null,
        observedCachedValue: num(rcObs.cachedValue),
      },
    },
    pages: { docx: num((rf.docx || {}).pages), xlsx: num((rf.xlsx || {}).pages), pptx: num((rf.pptx || {}).pages) },
    pngCounts: { docx: num((rf.docx || {}).pngCount), xlsx: num((rf.xlsx || {}).pngCount), pptx: num((rf.pptx || {}).pngCount) },
    tools: { soffice: !!(p.tools && p.tools.soffice), pdftoppm: !!(p.tools && p.tools.pdftoppm) },
    elapsedMs: null,
    cgroup: null,
    evidencePaths: Array.isArray(p.evidencePaths) ? p.evidencePaths.map((x) => String(x)).slice(0, MAX_EVIDENCE_PATHS) : [],
  };
}

function hasOnlyFields(obj, allowed) {
  return obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).every((k) => allowed.includes(k));
}
function hasAllFields(obj, allowed) {
  return hasOnlyFields(obj, allowed) && allowed.every((k) => Object.prototype.hasOwnProperty.call(obj, k));
}
function subReasons(sub, label, keys) {
  const reasons = [];
  if (!hasAllFields(sub, keys)) { reasons.push(`${label} fields missing/unknown`); if (!sub || typeof sub !== 'object') return reasons; }
  if (sub.ok !== true) reasons.push(`${label} ok is not true`);
  if (sub.status !== 0) reasons.push(`${label} status ${JSON.stringify(sub.status)} != 0`);
  if (sub.signal !== null) reasons.push(`${label} signal is not null`);
  if (sub.error !== false) reasons.push(`${label} error present`);
  return reasons;
}
function cgroupReasons(cgroup) {
  if (cgroup === null) return [];
  if (!hasAllFields(cgroup, CGROUP_KEYS) || typeof cgroup !== 'object' || Array.isArray(cgroup)) return ['cgroup missing/unknown fields'];
  if (typeof cgroup.scope !== 'string' || cgroup.scope.length === 0 || cgroup.scope.length > 200) return ['cgroup scope invalid'];
  for (const k of CGROUP_KEYS) {
    if (k === 'scope') continue;
    const v = cgroup[k];
    if (!(v === null || v === 'max' || (typeof v === 'number' && Number.isFinite(v) && v >= 0))) return [`cgroup.${k} invalid`];
  }
  return [];
}
function sameJson(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/**
 * Strict validator for the bounded generation facts. Used by BOTH the encoder
 * verdict and the decoder. Nested `status:'pass'` alone is never trusted: the
 * exact retained observations must match the unchanged artifacts.py fixture.
 */
export function validateGenerationFacts(g) {
  const reasons = [];
  if (!hasOnlyFields(g, GEN_KEYS) || typeof g !== 'object' || Array.isArray(g)) return { ok: false, reasons: ['generation facts missing/unknown fields'] };
  if (g.exitStatus !== 0) reasons.push(`generation exitStatus ${JSON.stringify(g.exitStatus)} != 0`);
  if (g.signal !== null) reasons.push(`generation signal ${JSON.stringify(g.signal)} is not null`);
  if (g.timedOut !== false) reasons.push('generation timedOut is not false');
  if (g.probeOk !== true) reasons.push('generation probe ok is not true');

  const nat = g.native;
  if (!hasOnlyFields(nat, GEN_NATIVE_KEYS)) reasons.push('native has unknown fields');
  if (!nat || nat.status !== 'pass') reasons.push('native status is not pass');
  reasons.push(...validateGenerate(nat && nat.generate));
  reasons.push(...validatePptx(nat && nat.pptx));

  if (!hasOnlyFields(g.render, GEN_RENDER_KEYS)) reasons.push('render has unknown fields');
  if (!g.render || g.render.status !== 'pass') reasons.push('render status is not pass');

  for (const name of GEN_MAP_KEYS) {
    reasons.push(...subReasons((g.convert || {})[name], `convert.${name}`, GEN_SUB_KEYS));
    const pngSub = (g.png || {})[name];
    reasons.push(...subReasons(pngSub, `png.${name}`, GEN_PNG_KEYS));
    if (pngSub && Number.isInteger(pngSub.count) && pngSub.count !== EXPECTED_PAGES[name]) reasons.push(`png.${name} count ${pngSub.count} != ${EXPECTED_PAGES[name]}`);
    const pdfSub = (g.pdf || {})[name];
    reasons.push(...subReasons(pdfSub, `pdf.${name}`, GEN_PDF_KEYS));
    if (pdfSub) {
      if (pdfSub.parseOk !== true) reasons.push(`pdf.${name} parseOk is not true`);
      if (pdfSub.parsedOk !== true) reasons.push(`pdf.${name} parsedOk is not true`);
      if (pdfSub.resultCount !== 1) reasons.push(`pdf.${name} resultCount ${JSON.stringify(pdfSub.resultCount)} != 1`);
      if (pdfSub.resultOk !== true) reasons.push(`pdf.${name} result ok is not true`);
      if (pdfSub.pageCount !== EXPECTED_PAGES[name]) reasons.push(`pdf.${name} pageCount ${JSON.stringify(pdfSub.pageCount)} != ${EXPECTED_PAGES[name]}`);
    }
  }
  if (!hasOnlyFields(g.convert, GEN_MAP_KEYS)) reasons.push('convert has unknown fields');
  if (!hasOnlyFields(g.png, GEN_MAP_KEYS)) reasons.push('png has unknown fields');
  if (!hasOnlyFields(g.pdf, GEN_MAP_KEYS)) reasons.push('pdf has unknown fields');

  reasons.push(...validateRecalc(g.recalc));

  for (const name of GEN_MAP_KEYS) {
    if ((g.pages || {})[name] !== EXPECTED_PAGES[name]) reasons.push(`pages.${name} ${JSON.stringify((g.pages || {})[name])} != ${EXPECTED_PAGES[name]}`);
    if ((g.pngCounts || {})[name] !== EXPECTED_PAGES[name]) reasons.push(`pngCounts.${name} ${JSON.stringify((g.pngCounts || {})[name])} != ${EXPECTED_PAGES[name]}`);
  }
  if (!hasOnlyFields(g.pages, GEN_MAP_KEYS)) reasons.push('pages has unknown fields');
  if (!hasOnlyFields(g.pngCounts, GEN_MAP_KEYS)) reasons.push('pngCounts has unknown fields');

  if (!hasAllFields(g.tools, GEN_TOOLS_KEYS)) reasons.push('tools fields missing/unknown');
  if (!g.tools || g.tools.soffice !== true || g.tools.pdftoppm !== true) reasons.push('tools missing soffice/pdftoppm');

  if (!(g.elapsedMs === null || (typeof g.elapsedMs === 'number' && Number.isFinite(g.elapsedMs) && g.elapsedMs >= 0 && g.elapsedMs <= MAX_DEADLINE_MS))) reasons.push('elapsedMs invalid/over deadline');
  reasons.push(...cgroupReasons(g.cgroup));
  if (!Array.isArray(g.evidencePaths) || g.evidencePaths.length > MAX_EVIDENCE_PATHS || !g.evidencePaths.every((x) => typeof x === 'string' && x.length <= MAX_EVIDENCE_PATH_LEN)) reasons.push('evidencePaths must be a bounded string array');
  return { ok: reasons.length === 0, reasons };
}

function validateGenerate(gen) {
  const reasons = [];
  if (!hasAllFields(gen, GEN_GENERATE_KEYS)) { reasons.push('native.generate fields missing/unknown'); if (!gen || typeof gen !== 'object') return reasons; }
  if (gen.ok !== true) reasons.push('native.generate ok is not true');
  if (gen.status !== 0) reasons.push(`native.generate status ${JSON.stringify(gen.status)} != 0`);
  if (gen.signal !== null) reasons.push('native.generate signal is not null');
  if (gen.error !== false) reasons.push('native.generate error present');
  if (gen.parseOk !== true) reasons.push('native.generate parseOk is not true');
  if (gen.parsedOk !== true) reasons.push('native.generate parsed.ok is not true');
  if (gen.resultCount !== 2) reasons.push(`native.generate resultCount ${JSON.stringify(gen.resultCount)} != 2`);
  const docx = gen.docx;
  if (!hasAllFields(docx, GEN_DOCX_KEYS)) reasons.push('native.generate.docx fields missing/unknown');
  else {
    if (docx.ok !== true) reasons.push('DOCX result ok is not true');
    if (!sameJson(docx.headings, EXPECT_DOCX_HEADING ? [EXPECT_DOCX_HEADING] : null)) reasons.push('DOCX reopened headings mismatch');
    if (!sameJson(docx.tableText, EXPECT_DOCX_TABLE)) reasons.push('DOCX reopened table mismatch');
    if (docx.tableCount !== 1) reasons.push('DOCX tableCount != 1');
    if (docx.hasDocumentXml !== true) reasons.push('DOCX missing word/document.xml');
  }
  const xlsx = gen.xlsx;
  if (!hasAllFields(xlsx, GEN_XLSX_KEYS)) reasons.push('native.generate.xlsx fields missing/unknown');
  else {
    if (xlsx.ok !== true) reasons.push('XLSX result ok is not true');
    if (!sameJson(xlsx.inputs, EXPECTED_INPUTS)) reasons.push('XLSX reopened inputs mismatch');
    if (xlsx.a4Formula !== EXPECTED_FORMULA) reasons.push('XLSX a4Formula mismatch');
    if (xlsx.a4CachedValue !== null) reasons.push('XLSX a4GeneratedCachedValue must be blank (null), distinct from recalc 6');
    if (xlsx.hasSheetXml !== true) reasons.push('XLSX missing xl/worksheets/sheet1.xml');
  }
  return reasons;
}

function validatePptx(pptx) {
  const reasons = [];
  if (!hasAllFields(pptx, GEN_PPTX_KEYS)) { reasons.push('native.pptx fields missing/unknown'); if (!pptx || typeof pptx !== 'object') return reasons; }
  if (pptx.ok !== true) reasons.push('native.pptx ok is not true');
  if (pptx.status !== 0) reasons.push('native.pptx status != 0');
  if (pptx.signal !== null) reasons.push('native.pptx signal is not null');
  if (pptx.error !== false) reasons.push('native.pptx error present');
  if (pptx.parseOk !== true) reasons.push('native.pptx parseOk is not true');
  if (pptx.parsedOk !== true) reasons.push('native.pptx parsed.ok is not true');
  if (pptx.resultCount !== 1) reasons.push(`native.pptx resultCount ${JSON.stringify(pptx.resultCount)} != 1`);
  if (pptx.resultOk !== true) reasons.push('native.pptx result ok is not true');
  if (pptx.slideCount !== 2) reasons.push(`PPTX slideCount ${JSON.stringify(pptx.slideCount)} != 2`);
  if (pptx.notesCount !== 2) reasons.push(`PPTX notesCount ${JSON.stringify(pptx.notesCount)} != 2`);
  if (pptx.hasSlideParts !== true) reasons.push('PPTX missing required slide parts');
  if (pptx.hasNotesParts !== true) reasons.push('PPTX missing required notes parts');
  return reasons;
}

function validateRecalc(rc) {
  const reasons = [];
  if (!hasAllFields(rc, GEN_RECALC_KEYS)) { reasons.push('recalc fields missing/unknown'); if (!rc || typeof rc !== 'object') return reasons; }
  if (rc.status !== 'pass') reasons.push('recalc status is not pass');
  if (rc.inspected !== true) reasons.push('recalc observed.inspected is not true');
  if (!sameJson(rc.inputs, EXPECTED_INPUTS)) reasons.push(`recalc inputs ${JSON.stringify(rc.inputs)} != ${JSON.stringify(EXPECTED_INPUTS)} (must not be sliced)`);
  if (rc.formula !== EXPECTED_FORMULA) reasons.push('recalc formula mismatch');
  if (typeof rc.cachedValue !== 'number' || rc.cachedValue !== EXPECTED_RECALC) reasons.push('recalc cachedValue is not numeric 6');
  if (!(rc.newFile === null || (typeof rc.newFile === 'string' && rc.newFile.length > 0))) reasons.push('recalc newFile must be a non-empty path or null');
  reasons.push(...subReasons(rc.convert, 'recalc.convert', GEN_SUB_KEYS));
  const child = rc.child;
  if (!hasAllFields(child, GEN_RECALC_CHILD_KEYS)) reasons.push('recalc.child fields missing/unknown');
  else {
    if (child.ok !== true) reasons.push('recalc.child ok is not true');
    if (child.status !== 0) reasons.push('recalc.child status != 0');
    if (child.signal !== null) reasons.push('recalc.child signal is not null');
    if (child.error !== false) reasons.push('recalc.child error present');
    if (child.parseOk !== true) reasons.push('recalc.child parseOk is not true');
    if (child.parsedOk !== true) reasons.push('recalc.child parsed.ok is not true');
    if (child.resultCount !== 1) reasons.push('recalc.child resultCount != 1');
    if (child.resultOk !== true) reasons.push('recalc.child result ok is not true');
    if (child.observedInspected !== rc.inspected) reasons.push('recalc.child observed.inspected disagrees');
    if (!sameJson(child.observedInputs, rc.inputs)) reasons.push('recalc.child observed.inputs disagree with selected observations');
    if (child.observedFormula !== rc.formula) reasons.push('recalc.child observed.formula disagrees');
    if (child.observedCachedValue !== rc.cachedValue) reasons.push('recalc.child observed.cachedValue disagrees');
  }
  return reasons;
}

/**
 * Pure verdict over the artifacts child. Requires a clean exit, CONFIRMED
 * cleanup (exact true), structured pass and the exact retained nested facts.
 */
export function verifyArtifactsVerdict(child) {
  const reasons = [];
  const c = child || {};
  if (c.error) reasons.push(`child spawn/cleanup error: ${String(c.error).slice(0, 160)}`);
  if (c.timedOut) reasons.push('child exceeded the generation deadline');
  if (c.signal) reasons.push(`child killed by signal ${c.signal}`);
  if (c.cleanupConfirmed !== true) reasons.push('child cleanup not confirmed (process group/descendants not proven exited)');
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
  const files = { memoryCurrent: '/sys/fs/cgroup/memory.current', memoryPeak: '/sys/fs/cgroup/memory.peak', memoryMax: '/sys/fs/cgroup/memory.max', pidsCurrent: '/sys/fs/cgroup/pids.current' };
  for (const [key, p] of Object.entries(files)) {
    try { const raw = String(readFile(p)).trim().slice(0, 32); out[key] = raw === 'max' ? 'max' : Number.isFinite(Number(raw)) ? Number(raw) : null; } catch { out[key] = null; }
  }
  try { const cpu = String(readFile('/sys/fs/cgroup/cpu.stat')).trim().slice(0, 400); out.cpuStatLines = cpu ? cpu.split('\n').length : 0; } catch { out.cpuStatLines = 0; }
  return out;
}

// ---------------------------------------------------------------------------
// Filesystem validation
// ---------------------------------------------------------------------------

/**
 * Every component from the filesystem root down to (and including) `absPath`
 * must be a real directory: no symlink/junction at any level, including ABOVE
 * the run root.
 */
export function assertPathChainIsRealDirectories(absPath, lstat = lstatSync) {
  const abs = resolve(absPath);
  const parts = [];
  let cur = abs;
  while (true) { parts.unshift(cur); const parent = dirname(cur); if (parent === cur) break; cur = parent; }
  for (const p of parts) {
    let st;
    try { st = lstat(p); } catch { return { ok: false, reason: `path component unreadable: ${p}` }; }
    if (st.isSymbolicLink()) return { ok: false, reason: `path component is a symlink/junction: ${p}` };
    if (!st.isDirectory()) return { ok: false, reason: `path component is not a directory: ${p}` };
  }
  return { ok: true, reason: null };
}

/** Every ancestor directory component of `relPath` under `root` must be a real directory. */
export function assertRealDirectoryAncestors(root, relPath, lstat = lstatSync) {
  const parts = relPath.split('/');
  parts.pop();
  let cur = root;
  for (const p of parts) {
    cur = join(cur, p);
    let st;
    try { st = lstat(cur); } catch { return { ok: false, reason: `ancestor ${p} unreadable` }; }
    if (st.isSymbolicLink()) return { ok: false, reason: `ancestor ${p} is a symlink/junction` };
    if (!st.isDirectory()) return { ok: false, reason: `ancestor ${p} is not a directory` };
  }
  return { ok: true, reason: null };
}

export function inspectExpectedFiles(runDir, io = {}) {
  const lstat = io.lstatSync || lstatSync;
  const reasons = [];
  const entries = [];
  const chain = assertPathChainIsRealDirectories(runDir, lstat);
  if (!chain.ok) return { ok: false, reasons: [chain.reason], entries, totalBytes: 0 };
  const realRoot = safeRealpath(runDir);
  let totalBytes = 0;
  for (const spec of EXPECTED_FILES) {
    const full = join(runDir, spec.path);
    if (!isContained(runDir, full)) { reasons.push(`${spec.path} escapes the run root`); continue; }
    const anc = assertRealDirectoryAncestors(runDir, spec.path, lstat);
    if (!anc.ok) { reasons.push(`${spec.path}: ${anc.reason}`); continue; }
    let lst;
    try { lst = lstat(full); } catch { reasons.push(`missing ${spec.path}`); continue; }
    if (lst.isSymbolicLink()) { reasons.push(`${spec.path} is a symlink`); continue; }
    if (!lst.isFile()) { reasons.push(`${spec.path} is not a regular file`); continue; }
    if (lst.nlink > 1) { reasons.push(`${spec.path} has ${lst.nlink} hard links`); continue; }
    if (lst.size > spec.cap) { reasons.push(`${spec.path} size ${lst.size} exceeds cap ${spec.cap}`); continue; }
    const realFull = safeRealpath(full);
    if (realRoot && realFull && !isContained(realRoot, realFull)) { reasons.push(`${spec.path} real path escapes the run root`); continue; }
    let buf;
    try { buf = readRegularFileVerified(full, lst); } catch (error) { reasons.push(`${spec.path} read failed: ${String(error && error.message ? error.message : error).slice(0, 120)}`); continue; }
    totalBytes += buf.length;
    entries.push({ path: spec.path, kind: spec.kind, index: spec.index, buffer: buf });
  }
  if (totalBytes > CAPS.total) reasons.push(`aggregate ${totalBytes} exceeds total cap ${CAPS.total}`);
  return { ok: reasons.length === 0, reasons, entries, totalBytes };
}

function safeRealpath(p) { try { return realpathSync(p); } catch { return null; } }

/**
 * Open with O_NOFOLLOW, then compare the caller's lstat to the pre-read fstat
 * on identity/type/linkcount/size/mtime/ctime, read fully, and confirm the
 * post-read fstat is unchanged.
 */
export function readRegularFileVerified(full, lst) {
  const NOFOLLOW = constants.O_NOFOLLOW || 0;
  const fd = openSync(full, constants.O_RDONLY | NOFOLLOW);
  try {
    const before = fstatSync(fd);
    if (!before.isFile()) throw new Error('descriptor is not a regular file');
    if (before.nlink > 1) throw new Error('descriptor has hard links');
    if (before.dev !== lst.dev || before.ino !== lst.ino || before.size !== lst.size) throw new Error('descriptor identity mismatch before read');
    if (before.nlink !== lst.nlink || !before.isFile()) throw new Error('type/link count changed before read');
    if (before.mtimeMs !== lst.mtimeMs || before.ctimeMs !== lst.ctimeMs) throw new Error('mtime/ctime changed before read');
    const buf = Buffer.allocUnsafe(before.size);
    let read = 0;
    while (read < before.size) { const n = readSync(fd, buf, read, before.size - read, read); if (n <= 0) break; read += n; }
    if (read !== before.size) throw new Error(`short read ${read}/${before.size}`);
    const after = fstatSync(fd);
    if (!after.isFile() || after.nlink > 1) throw new Error('type/link count changed after read');
    if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) throw new Error('descriptor identity changed during read');
    return buf;
  } finally { closeSync(fd); }
}

// ---------------------------------------------------------------------------
// Child process: owned validated group + confirmed cleanup
// ---------------------------------------------------------------------------

/** Kill the OWNED process group (Linux, detached, pid>1) else the direct child. */
export function defaultGroupKill(child, signal = 'SIGKILL') {
  if (!child) return false;
  const pid = child.pid;
  if (process.platform === 'linux' && Number.isInteger(pid) && pid > 1) {
    try { process.kill(-pid, signal); return true; } catch { return false; }
  }
  try { return typeof child.kill === 'function' && child.kill(signal) === true; } catch { return false; }
}

/**
 * True ONLY when the owned group is DEFINITELY absent (kill(-pid,0) -> ESRCH).
 * Alive, permission/unknown errors, non-Linux and malformed children all return
 * a non-true value so absence can never be confirmed by uncertainty.
 */
export function defaultProbeGroup(child) {
  if (!child) return undefined;
  const pid = child.pid;
  if (process.platform === 'linux' && Number.isInteger(pid) && pid > 1) {
    try { process.kill(-pid, 0); return true; } catch (error) { return error && error.code === 'ESRCH' ? false : undefined; }
  }
  // Non-Linux: no owned detached group was created, so the direct child is gone.
  return false;
}

/**
 * Spawn the unchanged artifacts probe once in its own (Linux) process group,
 * bounded streams and a hard deadline. Resolves only after 'close' AND a
 * confirmed absent owned group/descendants within a bounded grace. On a normal
 * close with a live group it kills the OWNED validated group, then bounded-
 * confirms absence. Kill-request/false/error is not confirmation of exit.
 */
export function runArtifactsChild({
  base, deadlineMs = DEFAULT_DEADLINE_MS, spawnFn = spawn, env = process.env, graceMs = 5000,
  groupKill = defaultGroupKill, probeGroup = defaultProbeGroup, detached,
} = {}) {
  return new Promise((resolve) => {
    const dl = normalizeDeadlineMs(deadlineMs, { fallback: DEFAULT_DEADLINE_MS });
    if (!dl.ok) { resolve({ status: null, signal: null, timedOut: false, cleanupConfirmed: false, error: dl.reason, stdout: '', stderr: '' }); return; }
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
      clearTimeout(deadlineTimer); clearTimeout(graceTimer); clearTimeout(pollTimer);
      resolve({
        status: exited ? exited.code : null, signal: exited ? exited.signal : null,
        timedOut, overflow, killRequested, groupKillOk, cleanupConfirmed, detached: useDetached,
        error: spawnError || (overflow ? 'child stdout exceeded bound' : null) || (error || null),
        stdout, stderr,
      });
    };
    // Absence is confirmed ONLY by a definite non-live result (strict === false).
    const groupGone = () => { try { return probeGroup(child) === false; } catch { return false; } };
    const killOwnedGroup = () => { killRequested = true; try { groupKillOk = groupKill(child, 'SIGKILL') === true; } catch { groupKillOk = false; } };
    const confirmAbsenceUntilGrace = () => {
      const start = Date.now();
      const poll = () => {
        if (settled) return;
        if (groupGone()) { cleanupConfirmed = true; settle(null); return; }
        if (Date.now() - start >= graceMs) { cleanupConfirmed = false; settle('process group/descendants not confirmed clean'); return; }
        pollTimer = setTimeout(poll, 10);
      };
      poll();
    };

    deadlineTimer = setTimeout(() => {
      timedOut = true;
      killOwnedGroup();
      graceTimer = setTimeout(() => { cleanupConfirmed = false; settle('child did not close after group kill within grace'); }, graceMs);
    }, dl.ms);

    child.on('error', (err) => { spawnError = String(err && err.message ? err.message : err); });
    child.stdout.on('data', (d) => {
      stdoutBytes += d.length;
      if (stdoutBytes > MAX_CHILD_STDOUT) { overflow = true; if (!killRequested) killOwnedGroup(); return; }
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d) => { stderrBytes += d.length; if (stderrBytes > MAX_CHILD_STDERR) return; stderr += d.toString('utf8'); });
    child.on('exit', (code, signal) => { exited = { code, signal }; });
    child.on('close', (code, signal) => {
      exited = { code, signal };
      if (settled) return;
      clearTimeout(deadlineTimer); deadlineTimer = null;
      if (groupGone()) { cleanupConfirmed = true; settle(null); return; }
      // Group still alive after close: kill the OWNED validated group, then bounded-confirm.
      if (!killRequested) killOwnedGroup();
      confirmAbsenceUntilGrace();
    });
  });
}

/** Find the single fresh probe-<uuid> subtree created under the run base. */
export function discoverRunDir(base) {
  const reasons = [];
  let dirs = [];
  try { dirs = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith('probe-')).map((d) => join(base, d.name)); } catch (error) { reasons.push(`cannot list run base: ${String(error && error.message ? error.message : error).slice(0, 120)}`); }
  if (dirs.length === 0) reasons.push('no fresh probe-<uuid> subtree was generated');
  if (dirs.length > 1) reasons.push(`expected exactly one probe subtree, found ${dirs.length}`);
  return { ok: reasons.length === 0, reasons, runDir: dirs.length === 1 ? dirs[0] : null };
}

// ---------------------------------------------------------------------------
// Bounded streaming
// ---------------------------------------------------------------------------

function errMsg(error) { return String(error && error.message ? error.message : error).slice(0, 120); }

/** Await a single stream write, raced against `remainingMs` and stream errors. */
export function writeBounded(stream, line, remainingMs) {
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const onError = (err) => finish(false, `stdout error: ${errMsg(err)}`);
    function finish(ok, error) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (typeof stream.off === 'function') stream.off('error', onError);
      resolve({ ok, error: error || null });
    }
    timer = setTimeout(() => finish(false, 'write exceeded the export deadline'), Math.max(1, Math.floor(remainingMs)));
    if (typeof stream.on === 'function') stream.on('error', onError);
    try { stream.write(line + '\n', (err) => (err ? finish(false, `write callback error: ${errMsg(err)}`) : finish(true, null))); } catch (error) { finish(false, `write threw: ${errMsg(error)}`); }
  });
}

/**
 * Stream records with an ABSOLUTE deadline. Pending writes and the final flush
 * are bounded; the deadline is re-checked absolutely after the last write.
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
    baseRoot = defaultBaseRoot(), spawnFn = spawn, writeStream = process.stdout,
    now = () => Date.now(), readCgroup = readCgroupObservations, mkdir = mkdirSync, graceMs = 5000, detached,
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
    try { mkdir(base); } catch (error) { if (error && error.code === 'EEXIST') { await emitAbort(['fresh run base already exists']); return 1; } throw error; }
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
    // Honest measured export timing bound to the actual export phase (through the
    // last chunk flush; excludes the end line's own flush, which it cannot measure).
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
  main().then((code) => process.exit(code)).catch(() => { process.exit(1); });
}
