// Pure Office evidence DECODER / RECONSTRUCTOR (probe:office-reconstruct).
//
// No AWS client, no network, no native/probe execution and no top-level
// filesystem write on import. It consumes a captured CloudWatch stream (either
// plain marker-prefixed log lines or a documented JSON array of event messages)
// and, WITHOUT trusting event ordering or any lone ok:true, validates the
// bounded protocol BEFORE writing: version/capture identity, the exact eleven
// file set, allowlisted paths/kinds/caps/counts, integer ranges, canonical
// strict base64, byte-identical duplicate tolerance, changed-duplicate/mixed-
// capture rejection, complete chunk coverage, and the end/manifest hash
// bindings plus every decoded hash/length. Only a fully consistent capture is
// written; any failure writes NO partial artifact. Byte-identical duplicate
// delivery is tolerated; changed duplicates and mixed capture IDs are not.
//
// CLI: node office-reconstruct.mjs --input <captured.ndjson> --out <new-dir>
// The destination must be a NEW directory whose ancestors are all real
// directories (no symlinks); existing files are never overwritten.

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  lstatSync,
  realpathSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep, relative, isAbsolute } from 'node:path';

import { MARKER, PROTOCOL, EXPECTED_FILES, CAPS, CHUNK_BYTES } from './office-export.mjs';

/** Strict per-kind field allowlists (unknown fields are rejected). */
export const RECORD_FIELDS = Object.freeze({
  capture: ['kind', 'v', 'capture', 'protocol', 'fileCount', 'chunkCount', 'totalBytes', 'limits', 'generation', 'files'],
  chunk: ['kind', 'v', 'capture', 'path', 'index', 'seq', 'total', 'bytes', 'data'],
  end: ['kind', 'v', 'capture', 'fileCount', 'chunkCount', 'totalBytes', 'manifestSha256', 'files', 'elapsedMs'],
  error: ['kind', 'v', 'capture', 'reasons'],
});

const MANIFEST_FILE_FIELDS = ['path', 'kind', 'index', 'bytes', 'sha256', 'chunks'];

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

function isInt(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** Strict canonical base64: correct alphabet/padding and re-encodes identically. */
export function isCanonicalBase64(value) {
  if (typeof value !== 'string') return false;
  if (value.length === 0) return true;
  if (value.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return false;
  try {
    return Buffer.from(value, 'base64').toString('base64') === value;
  } catch {
    return false;
  }
}

function hasOnlyFields(obj, allowed) {
  return Object.keys(obj).every((k) => allowed.includes(k));
}

function sameFields(a, b, fields) {
  return fields.every((f) => JSON.stringify(a[f]) === JSON.stringify(b[f]));
}

/**
 * Turn raw captured text into candidate record lines. Accepts plain
 * marker-prefixed log lines OR a documented JSON array of CloudWatch-style
 * event messages ({message} / {events|logEvents:[...]}). No AWS client.
 */
export function extractRecordLines(text) {
  const ignored = [];
  const messages = [];
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) return { lines: [], ignored, parseError: 'empty input' };
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      return { lines: [], ignored, parseError: `invalid JSON envelope: ${String(error && error.message ? error.message : error).slice(0, 120)}` };
    }
    const events = Array.isArray(parsed) ? parsed : parsed.events || parsed.logEvents || [parsed];
    if (!Array.isArray(events)) return { lines: [], ignored, parseError: 'JSON envelope has no event array' };
    for (const ev of events) {
      if (typeof ev === 'string') messages.push(ev);
      else if (ev && typeof ev.message === 'string') messages.push(ev.message);
      else return { lines: [], ignored, parseError: 'event without a string message' };
    }
    const lines = messages.flatMap((m) => m.split('\n')).map((l) => l.replace(/\r$/, ''));
    return { lines, ignored, parseError: null };
  }
  const lines = trimmed.split('\n').map((l) => l.replace(/\r$/, ''));
  return { lines, ignored, parseError: null };
}

/** Parse one marker line strictly; non-marker lines are ignored (interleaved logs). */
export function parseRecordLine(line) {
  const idx = line.indexOf(MARKER);
  if (idx !== 0) return { marker: false };
  const rest = line.slice(MARKER.length);
  if (rest[0] !== ' ') return { marker: true, error: 'marker not followed by a space-delimited JSON record' };
  const json = rest.slice(1);
  let record;
  try {
    record = JSON.parse(json);
  } catch (error) {
    return { marker: true, error: `malformed record JSON: ${String(error && error.message ? error.message : error).slice(0, 120)}` };
  }
  if (record === null || typeof record !== 'object' || Array.isArray(record)) return { marker: true, error: 'record is not a JSON object' };
  return { marker: true, record };
}

/** Collect and structurally validate records from raw captured text. */
export function collectRecords(text) {
  const reasons = [];
  const { lines, parseError } = extractRecordLines(text);
  if (parseError) return { ok: false, reasons: [parseError], records: [] };
  const records = [];
  for (const line of lines) {
    if (!line.includes(MARKER)) continue;
    const parsed = parseRecordLine(line);
    if (!parsed.marker) continue;
    if (parsed.error) { reasons.push(parsed.error); continue; }
    const rec = parsed.record;
    const kind = rec.kind;
    if (!RECORD_FIELDS[kind]) { reasons.push(`unknown record kind ${JSON.stringify(kind)}`); continue; }
    if (!hasOnlyFields(rec, RECORD_FIELDS[kind])) { reasons.push(`${kind} record has unknown fields`); continue; }
    records.push(rec);
  }
  if (records.length === 0 && reasons.length === 0) reasons.push('no marker records found');
  return { ok: reasons.length === 0, reasons, records };
}

/** Validate a single manifest entry against the fixed allowlist for its index. */
export function validateManifestEntry(entry) {
  const reasons = [];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { ok: false, reasons: ['manifest entry is not an object'] };
  if (!hasOnlyFields(entry, MANIFEST_FILE_FIELDS)) reasons.push('manifest entry has unknown fields');
  if (!isInt(entry.index, 0, EXPECTED_FILES.length - 1)) return { ok: false, reasons: [...reasons, `manifest index ${JSON.stringify(entry.index)} out of range`] };
  const spec = EXPECTED_FILES[entry.index];
  if (entry.path !== spec.path) reasons.push(`manifest index ${entry.index} path ${JSON.stringify(entry.path)} != ${spec.path}`);
  if (entry.kind !== spec.kind) reasons.push(`manifest ${spec.path} kind ${JSON.stringify(entry.kind)} != ${spec.kind}`);
  if (!isInt(entry.bytes, 0, spec.cap)) reasons.push(`manifest ${spec.path} bytes ${JSON.stringify(entry.bytes)} out of range (cap ${spec.cap})`);
  if (typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) reasons.push(`manifest ${spec.path} sha256 malformed`);
  const wantChunks = entry.bytes === 0 ? 1 : Math.ceil(entry.bytes / CHUNK_BYTES);
  if (!isInt(entry.chunks, 1, 1500) || entry.chunks !== wantChunks) reasons.push(`manifest ${spec.path} chunks ${JSON.stringify(entry.chunks)} != ${wantChunks}`);
  return { ok: reasons.length === 0, reasons };
}

function normalizeFiles(entries) {
  if (!Array.isArray(entries)) return null;
  const out = [];
  for (const e of entries) {
    if (!e || typeof e !== 'object') return null;
    const normalized = {};
    for (const f of MANIFEST_FILE_FIELDS) normalized[f] = e[f];
    out.push(normalized);
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

function sameManifest(a, b) {
  const na = normalizeFiles(a);
  const nb = normalizeFiles(b);
  if (!na || !nb || na.length !== nb.length) return false;
  for (let i = 0; i < na.length; i++) if (!sameFields(na[i], nb[i], MANIFEST_FILE_FIELDS)) return false;
  return true;
}

/**
 * Pure validation + reconstruction. Returns { ok, reasons, files:[{path,buffer}] }.
 * Writes nothing. Any failure yields ok:false with no files.
 */
export function validateCapture(text) {
  const reasons = [];
  const collected = collectRecords(text);
  reasons.push(...collected.reasons);
  const records = collected.records;
  if (records.length === 0) return { ok: false, reasons, files: [] };
  for (const rec of records) {
    if (rec.v !== PROTOCOL) { reasons.push(`record kind ${rec.kind} has version ${JSON.stringify(rec.v)} != ${PROTOCOL}`); }
  }
  if (records.some((r) => r.kind === 'error')) {
    return { ok: false, reasons: [...reasons, 'capture stream contains an error record'], files: [] };
  }
  const captures = records.filter((r) => r.kind === 'capture');
  const ends = records.filter((r) => r.kind === 'end');
  const chunks = records.filter((r) => r.kind === 'chunk');
  if (chunks.length === 0 && captures.length === 0) return { ok: false, reasons: [...reasons, 'no capture manifest present'], files: [] };
  if (captures.length === 0) reasons.push('no capture manifest present');
  if (ends.length === 0) reasons.push('no end record present');
  if (captures.length > 1 && !captures.every((c) => JSON.stringify(c) === JSON.stringify(captures[0]))) reasons.push('conflicting capture manifest records');
  if (ends.length > 1 && !ends.every((e) => JSON.stringify(e) === JSON.stringify(ends[0]))) reasons.push('conflicting end records');
  const capture = captures[0];
  const end = ends[0];
  // Capture identity must be unanimous across every record.
  const captureId = capture && capture.capture;
  if (typeof captureId !== 'string' || captureId.length === 0) reasons.push('capture id missing');
  for (const rec of records) if (rec.capture !== captureId) reasons.push('mixed capture ids across records');
  if (reasons.length) return { ok: false, reasons, files: [] };

  if (capture.protocol !== MARKER) reasons.push(`capture protocol ${JSON.stringify(capture.protocol)} != ${MARKER}`);
  if (!Array.isArray(capture.files) || capture.files.length !== EXPECTED_FILES.length) {
    reasons.push(`capture manifest must list exactly ${EXPECTED_FILES.length} files`);
  } else {
    const seen = new Set();
    for (const entry of capture.files) {
      const v = validateManifestEntry(entry);
      reasons.push(...v.reasons);
      if (entry && isInt(entry.index, 0, EXPECTED_FILES.length - 1)) {
        if (seen.has(entry.index)) reasons.push(`duplicate manifest index ${entry.index}`);
        seen.add(entry.index);
      }
    }
    if (seen.size !== EXPECTED_FILES.length) reasons.push('manifest does not cover the exact eleven-file set');
  }
  if (reasons.length) return { ok: false, reasons, files: [] };

  // End bindings: counts + manifest hash over the capture's own files array.
  const manifestEntries = capture.files;
  const totalChunks = manifestEntries.reduce((n, f) => n + f.chunks, 0);
  const totalBytes = manifestEntries.reduce((n, f) => n + f.bytes, 0);
  if (totalBytes > CAPS.total) reasons.push(`aggregate ${totalBytes} exceeds total cap ${CAPS.total}`);
  if (capture.fileCount !== EXPECTED_FILES.length) reasons.push(`capture fileCount ${JSON.stringify(capture.fileCount)} != ${EXPECTED_FILES.length}`);
  if (capture.chunkCount !== totalChunks) reasons.push('capture chunkCount disagrees with manifest');
  if (capture.totalBytes !== totalBytes) reasons.push('capture totalBytes disagrees with manifest');
  if (end.fileCount !== EXPECTED_FILES.length) reasons.push(`end fileCount ${JSON.stringify(end.fileCount)} != ${EXPECTED_FILES.length}`);
  if (end.chunkCount !== totalChunks) reasons.push('end chunkCount disagrees with manifest');
  if (end.totalBytes !== totalBytes) reasons.push('end totalBytes disagrees with manifest');
  if (!sameManifest(end.files, manifestEntries)) reasons.push('end file set differs from capture manifest');
  const manifestSha256 = sha256Hex(JSON.stringify(manifestEntries));
  if (end.manifestSha256 !== manifestSha256) reasons.push('end manifestSha256 does not bind the capture manifest');
  if (reasons.length) return { ok: false, reasons, files: [] };

  // Gather chunks: identical duplicates tolerated, changed duplicates rejected.
  const byFile = new Map();
  for (const spec of EXPECTED_FILES) byFile.set(spec.path, new Map());
  for (const chunk of chunks) {
    const entry = manifestEntries.find((f) => f.path === chunk.path);
    if (!entry) { reasons.push(`chunk references unknown path ${JSON.stringify(chunk.path)}`); continue; }
    if (chunk.index !== entry.index) { reasons.push(`chunk ${chunk.path} index mismatch`); continue; }
    if (chunk.total !== entry.chunks) { reasons.push(`chunk ${chunk.path} total ${JSON.stringify(chunk.total)} != ${entry.chunks}`); continue; }
    if (!isInt(chunk.seq, 0, entry.chunks - 1)) { reasons.push(`chunk ${chunk.path} seq ${JSON.stringify(chunk.seq)} out of range`); continue; }
    if (!isInt(chunk.bytes, 0, CHUNK_BYTES)) { reasons.push(`chunk ${chunk.path} bytes ${JSON.stringify(chunk.bytes)} out of range`); continue; }
    if (!isCanonicalBase64(chunk.data)) { reasons.push(`chunk ${chunk.path} seq ${chunk.seq} data is not canonical base64`); continue; }
    const decoded = Buffer.from(chunk.data, 'base64');
    if (decoded.length !== chunk.bytes) { reasons.push(`chunk ${chunk.path} seq ${chunk.seq} decoded length ${decoded.length} != ${chunk.bytes}`); continue; }
    const slot = byFile.get(chunk.path);
    const existing = slot.get(chunk.seq);
    if (existing) {
      if (existing.data !== chunk.data || existing.bytes !== chunk.bytes) reasons.push(`conflicting duplicate chunk ${chunk.path} seq ${chunk.seq}`);
      continue;
    }
    slot.set(chunk.seq, { data: chunk.data, bytes: chunk.bytes, decoded });
  }
  if (reasons.length) return { ok: false, reasons, files: [] };

  // Complete coverage + exact decoded hash/length per file BEFORE writing.
  const files = [];
  for (const entry of manifestEntries) {
    const slot = byFile.get(entry.path);
    const parts = [];
    for (let seq = 0; seq < entry.chunks; seq++) {
      const got = slot.get(seq);
      if (!got) { reasons.push(`missing chunk ${entry.path} seq ${seq}`); continue; }
      parts.push(got.decoded);
    }
    if (parts.length !== entry.chunks) continue;
    const buffer = Buffer.concat(parts);
    if (buffer.length !== entry.bytes) { reasons.push(`${entry.path} decoded length ${buffer.length} != manifest ${entry.bytes}`); continue; }
    if (sha256Hex(buffer) !== entry.sha256) { reasons.push(`${entry.path} decoded sha256 mismatch`); continue; }
    files.push({ path: entry.path, buffer });
  }
  if (reasons.length) return { ok: false, reasons, files: [] };
  return { ok: true, reasons: [], files, capture: captureId, manifestSha256 };
}

/** Reject a destination that already exists or has a non-directory/symlink ancestor. */
export function checkDestination(outDir) {
  const reasons = [];
  const abs = resolve(String(outDir));
  if (existsSync(abs)) reasons.push(`destination already exists: ${abs}`);
  let cur = abs;
  const chain = [];
  while (true) {
    const parent = dirname(cur);
    if (parent === cur) break;
    chain.push(parent);
    cur = parent;
  }
  for (const ancestor of chain) {
    if (!existsSync(ancestor)) { reasons.push(`destination ancestor missing: ${ancestor}`); continue; }
    try {
      const st = lstatSync(ancestor);
      if (st.isSymbolicLink()) reasons.push(`destination ancestor is a symlink: ${ancestor}`);
      else if (!st.isDirectory()) reasons.push(`destination ancestor is not a directory: ${ancestor}`);
    } catch (error) {
      reasons.push(`cannot inspect ancestor ${ancestor}: ${String(error && error.message ? error.message : error).slice(0, 80)}`);
    }
  }
  return { ok: reasons.length === 0, reasons, abs };
}

function pathedContained(root, child) {
  const rel = relative(resolve(root), resolve(child));
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
}

/** Write fully validated buffers into a NEW directory (fail if any exists). */
export function writeReconstruction(files, outDir) {
  const reasons = [];
  const dest = checkDestination(outDir);
  if (!dest.ok) return { ok: false, reasons: dest.reasons };
  try {
    for (const file of files) {
      const full = join(dest.abs, file.path);
      if (!pathedContained(dest.abs, full)) { reasons.push(`${file.path} escapes the destination`); continue; }
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, file.buffer, { flag: 'wx' });
    }
  } catch (error) {
    return { ok: false, reasons: [...reasons, String(error && error.message ? error.message : error).slice(0, 160)] };
  }
  return { ok: true, reasons: [], written: files.length, dest: dest.abs };
}

/**
 * End-to-end pure helper used by the CLI and tests: validate captured text, then
 * (only on success) write to a NEW directory. Returns { ok, reasons, written }.
 */
export function reconstruct(text, outDir) {
  const validated = validateCapture(text);
  if (!validated.ok) return { ok: false, reasons: validated.reasons, written: 0 };
  return writeReconstruction(validated.files, outDir);
}

function parseArgs(argv) {
  const args = { input: null, out: null, error: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input') args.input = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a.startsWith('--input=')) args.input = a.slice('--input='.length);
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length);
    else args.error = `unexpected argument ${JSON.stringify(a)}`;
  }
  return args;
}

/** CLI entry. Returns an exit code; performs no work on import. */
export function runCli(argv = process.argv.slice(2), { readFile = (p) => readFileSync(p, 'utf8'), log = (m) => process.stdout.write(m + '\n') } = {}) {
  const args = parseArgs(argv);
  if (args.error) { log(JSON.stringify({ probe: 'office-reconstruct', ok: false, reasons: [args.error] })); return 2; }
  if (!args.input || !args.out) { log(JSON.stringify({ probe: 'office-reconstruct', ok: false, reasons: ['--input and --out are required'] })); return 2; }
  let text;
  try {
    text = readFile(args.input);
  } catch (error) {
    log(JSON.stringify({ probe: 'office-reconstruct', ok: false, reasons: [`cannot read input: ${String(error && error.message ? error.message : error).slice(0, 120)}`] }));
    return 1;
  }
  const result = reconstruct(text, args.out);
  if (!result.ok) {
    log(JSON.stringify({ probe: 'office-reconstruct', ok: false, reasons: result.reasons.slice(0, 12), wroteAny: false }));
    return 1;
  }
  log(JSON.stringify({ probe: 'office-reconstruct', ok: true, written: result.written, dest: result.dest }));
  return 0;
}

const invokedDirectly = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (invokedDirectly) {
  process.exit(runCli());
}
