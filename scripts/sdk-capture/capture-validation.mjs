// Authoritative bounded validation + reconstruction orchestration for the SDK
// raw-capture decoder.
//
// validateCapture snapshots ONE bounded byte source, fatally decodes it, binds
// the supplied text/bytes, then validates record framing, metadata, chunk
// membership, decompression, hashes and retained synthetic semantics. It is
// pure and writes NOTHING. Depends on protocol, json-records, privacy and
// request-validation; performs no filesystem or network work on import.

import zlib from 'node:zlib';
import { TextDecoder } from 'node:util';
import {
  EXPECTED, KEYS, MAX_INPUT_BYTES, MAX_REASONS, MAX_TOTAL_RAW_BYTES,
  MAX_CHUNKS_PER_REQUEST, MAX_DECOMPRESSED_BYTES, UUID_RE, ISO_MS_RE,
  isInt, exactKeys, isCanonicalBase64, canonical, sha256Hex, expectedChunkCount,
} from './protocol.mjs';
import { parseRecords, scanJsonKeys } from './json-records.mjs';
import { hasSensitiveBody } from './privacy.mjs';
import {
  validateCounters, validateSpawn, validateResult, validateRequestEntry,
  validateFirstRequest, validateSecondRequest,
} from './request-validation.mjs';

function decodeBody(rawBytes, encoding) {
  const enc = encoding || 'identity'; // exact frozen producer whitelist
  if (enc === 'identity') return { ok: true, body: rawBytes };
  try {
    if (enc === 'gzip' || enc === 'x-gzip') return { ok: true, body: zlib.gunzipSync(rawBytes, { maxOutputLength: MAX_DECOMPRESSED_BYTES }) };
    if (enc === 'deflate') return { ok: true, body: zlib.inflateSync(rawBytes, { maxOutputLength: MAX_DECOMPRESSED_BYTES }) };
  } catch {
    return { ok: false, reason: 'decompression failed' };
  }
  return { ok: false, reason: 'unsupported content-encoding' };
}

// ---------------------------------------------------------------------------
// Pure, fully-bounded validation + reconstruction. Writes NOTHING.
// ---------------------------------------------------------------------------
export function validateCapture(text, options = {}) {
  const reasons = [];
  const addReason = (...items) => {
    const remaining = MAX_REASONS - reasons.length;
    if (remaining > 0) reasons.push(...items.slice(0, remaining));
  };
  if (typeof text !== 'string') return { ok: false, reasons: ['input text must be a string'], requests: [], report: null };
  if (!options || typeof options !== 'object' || Array.isArray(options)) return { ok: false, reasons: ['input options are invalid'], requests: [], report: null };
  const hasRawBuffer = Object.prototype.hasOwnProperty.call(options, 'rawBuffer');
  if (hasRawBuffer && !Buffer.isBuffer(options.rawBuffer)) return { ok: false, reasons: ['raw input must be a Buffer'], requests: [], report: null };
  if ((hasRawBuffer ? options.rawBuffer.length : Buffer.byteLength(text, 'utf8')) > MAX_INPUT_BYTES) return { ok: false, reasons: ['input exceeds byte bound'], requests: [], report: null };
  // Snapshot the sole byte source before validating it; caller mutation of the
  // original Buffer must not change the transcript later exported as evidence.
  const inputBuffer = Buffer.from(hasRawBuffer ? options.rawBuffer : text);
  let inputText;
  try { inputText = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(inputBuffer); }
  catch { return { ok: false, reasons: ['input is not valid UTF-8'], requests: [], report: null }; }
  if (inputText !== text) return { ok: false, reasons: ['input bytes do not match input text'], requests: [], report: null };
  const parsed = parseRecords(inputText);
  addReason(...parsed.reasons.slice(0, MAX_REASONS));
  const records = parsed.records;
  if (records.length === 0 || reasons.length) return { ok: false, reasons, requests: [], report: null };

  // 1. Record-type partitioning with exact presence.
  const KNOWN = new Set(['sdk-capture-manifest', 'sdk-capture-request-chunk', 'sdk-capture-end']);
  for (const rec of records) {
    if (typeof rec.record !== 'string' || !KNOWN.has(rec.record)) {
      if (reasons.length < MAX_REASONS) addReason('unknown record type');
    }
  }
  const manifests = records.filter((r) => r.record === 'sdk-capture-manifest');
  const ends = records.filter((r) => r.record === 'sdk-capture-end');
  const chunks = records.filter((r) => r.record === 'sdk-capture-request-chunk');
  if (manifests.length !== 1) addReason(`expected exactly 1 manifest record, saw ${manifests.length}`);
  if (ends.length !== 1) addReason(`expected exactly 1 end record, saw ${ends.length}`);
  if (chunks.length === 0) addReason('no chunk records present');
  if (reasons.length) return { ok: false, reasons, requests: [], report: null };

  const manifest = manifests[0];
  const end = ends[0];

  // 2. Exact record shapes before any deeper work.
  if (!exactKeys(manifest, KEYS.manifest)) addReason('manifest fields are not exact');
  if (!exactKeys(end, KEYS.end)) addReason('end fields are not exact');
  for (const chunk of chunks) {
    if (!exactKeys(chunk, KEYS.chunk)) { if (reasons.length < MAX_REASONS) addReason('chunk fields are not exact'); break; }
  }
  if (reasons.length) return { ok: false, reasons, requests: [], report: null };

  // 3. One consistent capture UUID across every record.
  const captureId = manifest.captureId;
  if (typeof captureId !== 'string' || !UUID_RE.test(captureId)) addReason('captureId is not a UUID');
  for (const rec of records) {
    if (rec.captureId !== captureId) addReason('mixed/invalid captureId across records');
  }
  if (reasons.length) return { ok: false, reasons, requests: [], report: null };

  // 4. Manifest envelope.
  if (typeof manifest.generatedAt !== 'string' || !ISO_MS_RE.test(manifest.generatedAt)) addReason('manifest generatedAt is not an ISO timestamp');
  if (manifest.ok !== true) addReason('manifest ok is not true');
  if (!Array.isArray(manifest.reasons) || manifest.reasons.length !== 0) addReason('manifest carries failure reasons');
  const counterReason = validateCounters(manifest.counters);
  if (counterReason) addReason(counterReason);
  const spawnReason = validateSpawn(manifest.spawn);
  if (spawnReason) addReason(spawnReason);
  if (manifest.result === null) addReason('manifest result summary is missing');
  else {
    const resultReason = validateResult(manifest.result);
    if (resultReason) addReason(resultReason);
  }
  const endHashKeys = Object.keys(end).filter((k) => /hash/i.test(k));
  if (endHashKeys.length) addReason('end record carries an unsupported hash field');
  if (end.ok !== true) addReason('end ok is not true');
  if (end.requestCount !== EXPECTED.EXPECTED_REQUESTS) addReason('end requestCount must be exactly 2');
  if (reasons.length) return { ok: false, reasons, requests: [], report: null };

  // 5. requestManifest: exactly 2 entries keyed by index 1,2.
  const requestManifest = manifest.requestManifest;
  if (!Array.isArray(requestManifest) || requestManifest.length !== EXPECTED.EXPECTED_REQUESTS) {
    return { ok: false, reasons: [`requestManifest must list exactly ${EXPECTED.EXPECTED_REQUESTS} requests`], requests: [], report: null };
  }
  // Validate every shape and integer index before dereference/coercion/sorting.
  if (requestManifest.some((entry) => !exactKeys(entry, KEYS.request) || !isInt(entry.index, 1, 2))) {
    return { ok: false, reasons: ['request metadata fields or indices are invalid'], requests: [], report: null };
  }
  const indices = requestManifest.map((r) => r.index).sort((a, b) => a - b);
  if (indices.length !== new Set(indices).size) addReason('duplicate request index');
  if (indices.join(',') !== '1,2') addReason('request indices must be exactly 1,2');
  if (reasons.length) return { ok: false, reasons, requests: [], report: null };

  const byIndex = new Map();
  let totalRaw = 0;
  for (const entry of requestManifest) {
    const index = entry && entry.index;
    const v = validateRequestEntry(entry, index);
    addReason(...v.reasons);
    if (v.reasons.length) continue; // never coerce invalid metadata in arithmetic
    byIndex.set(index, { entry, encoding: v.encoding, chunks: new Map(), declaredTotal: null, duplicates: 0 });
    totalRaw += entry.rawLength;
  }
  if (manifest.requestCount !== EXPECTED.EXPECTED_REQUESTS) addReason('manifest requestCount must be exactly 2');
  if (!isInt(manifest.totalBodyBytes, 0, MAX_TOTAL_RAW_BYTES)) addReason('manifest totalBodyBytes is invalid');
  if (manifest.totalBodyBytes !== totalRaw) addReason('manifest totalBodyBytes disagrees with requestManifest');
  if (totalRaw > MAX_TOTAL_RAW_BYTES) addReason('combined raw bytes exceed the aggregate bound');
  if (end.totalBodyBytes !== totalRaw) addReason('end totalBodyBytes disagrees with requestManifest');
  if (reasons.length) return { ok: false, reasons, requests: [], report: null };

  // 6. Chunk assembly with strict totals / seq membership / contiguity.
  for (const chunk of chunks) {
    const slot = byIndex.get(chunk.index);
    if (!slot) { if (reasons.length < MAX_REASONS) addReason('chunk references an unknown index'); continue; }
    const expectedTotal = expectedChunkCount(slot.entry.rawLength);
    if (!isInt(chunk.total, 1, MAX_CHUNKS_PER_REQUEST)) { if (reasons.length < MAX_REASONS) addReason(`chunk ${chunk.index} total is out of bounds`); continue; }
    if (chunk.total !== expectedTotal) { if (reasons.length < MAX_REASONS) addReason(`chunk ${chunk.index} total ${chunk.total} != expected ${expectedTotal}`); continue; }
    if (!isInt(chunk.seq, 0, chunk.total - 1)) { if (reasons.length < MAX_REASONS) addReason(`chunk ${chunk.index} seq is out of range`); continue; }
    if (!isCanonicalBase64(chunk.base64)) { if (reasons.length < MAX_REASONS) addReason(`chunk ${chunk.index}:${chunk.seq} base64 is not canonical`); continue; }
    if (chunk.base64.length > EXPECTED.MAX_CHUNK_BYTES) { if (reasons.length < MAX_REASONS) addReason(`chunk ${chunk.index}:${chunk.seq} exceeds the source chunk bound`); continue; }
    if (chunk.seq < chunk.total - 1 && chunk.base64.length !== EXPECTED.MAX_CHUNK_BYTES) { if (reasons.length < MAX_REASONS) addReason(`chunk ${chunk.index}:${chunk.seq} is not a full 4096-char source chunk`); continue; }
    if (slot.declaredTotal === null) slot.declaredTotal = chunk.total;
    else if (slot.declaredTotal !== chunk.total) { if (reasons.length < MAX_REASONS) addReason(`chunk ${chunk.index} declares conflicting totals`); continue; }
    const existing = slot.chunks.get(chunk.seq);
    if (existing !== undefined) {
      if (existing !== chunk.base64) { if (reasons.length < MAX_REASONS) addReason(`chunk ${chunk.index}:${chunk.seq} changed duplicate`); continue; }
      slot.duplicates += 1; // explicit protocol-aware identical delivery duplicate
      continue;
    }
    slot.chunks.set(chunk.seq, chunk.base64);
  }
  if (reasons.length) return { ok: false, reasons, requests: [], report: null };

  const requests = [];
  for (const index of [1, 2]) {
    const slot = byIndex.get(index);
    const total = slot.declaredTotal;
    if (!isInt(total, 1, MAX_CHUNKS_PER_REQUEST)) { addReason(`request ${index} chunk total not declared`); continue; }
    if (slot.chunks.size !== total) { addReason(`request ${index} chunk count ${slot.chunks.size} != declared ${total}`); continue; }
    const parts = [];
    let complete = true;
    for (let seq = 0; seq < total; seq += 1) {
      const data = slot.chunks.get(seq);
      if (data === undefined) { addReason(`request ${index} missing chunk ${seq}`); complete = false; break; }
      parts.push(data);
    }
    if (!complete) continue;
    const base64 = parts.join('');
    const expectedBase64Length = Math.ceil(slot.entry.rawLength / 3) * 4;
    if (base64.length !== expectedBase64Length) addReason(`request ${index} base64 length disagrees with rawLength`);
    let rawBytes;
    try { rawBytes = Buffer.from(base64, 'base64'); } catch { addReason(`request ${index} base64 decode failed`); continue; }
    if (rawBytes.length !== slot.entry.rawLength) addReason(`request ${index} raw length ${rawBytes.length} != ${slot.entry.rawLength}`);
    if (sha256Hex(rawBytes) !== slot.entry.rawSha256) addReason(`request ${index} raw sha256 mismatch`);
    if (reasons.length) break;
    const decoded = decodeBody(rawBytes, slot.encoding);
    if (!decoded.ok) { addReason(`request ${index}: ${decoded.reason}`); continue; }
    if (decoded.body.length > MAX_DECOMPRESSED_BYTES) { addReason(`request ${index} decompressed exceeds bound`); continue; }
    if (slot.entry.decompressedLength === null) addReason(`request ${index} decompressedLength missing`);
    if (slot.entry.decompressedSha256 === null) addReason(`request ${index} decompressedSha256 missing`);
    if (decoded.body.length !== slot.entry.decompressedLength) addReason(`request ${index} decompressed length mismatch`);
    if (sha256Hex(decoded.body) !== slot.entry.decompressedSha256) addReason(`request ${index} decompressed sha256 mismatch`);
    let bodyText;
    try { bodyText = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(decoded.body); } catch { addReason(`request ${index} body is not valid UTF-8`); continue; }
    let json;
    try {
      scanJsonKeys(bodyText); // reject duplicate members before JSON.parse hides them
      json = JSON.parse(bodyText);
    } catch (error) {
      addReason(error && error.name === 'DuplicateKeyError' ? `request ${index} body contains duplicate JSON object members` : `request ${index} body is not valid JSON`);
      continue;
    }
    // Independent confidentiality: reject any credential-bearing / secret-like
    // body, even when the producer claims hashOnly=false.
    const sensitivity = hasSensitiveBody(json);
    if (sensitivity) addReason(`request ${index} body contains sensitive material`);
    requests.push({ index, path: slot.entry.path, encoding: slot.encoding, rawBytes, decompressedBytes: decoded.body, json });
  }
  if (reasons.length) return { ok: false, reasons, requests: [], report: null };

  // 7. Retained-body semantics.
  const semantic = [validateFirstRequest(requests[0].json), validateSecondRequest(requests[1].json)].filter(Boolean);
  if (semantic.length) return { ok: false, reasons: semantic, requests: [], report: null };

  // 8. Independent evidence hashes (never a producer field).
  const inputSha256 = sha256Hex(inputBuffer);
  const framingSha256 = sha256Hex(Buffer.from(records.map((r) => canonical(r)).join('\n') + '\n', 'utf8'));

  const report = {
    probe: 'sdk-capture-reconstruct',
    schemaVersion: 1,
    captureId,
    generatedAt: manifest.generatedAt,
    requestCount: EXPECTED.EXPECTED_REQUESTS,
    totalBodyBytes: totalRaw,
    counters: manifest.counters,
    spawn: manifest.spawn,
    result: manifest.result,
    requests: requests.map((r) => ({
      index: r.index,
      path: r.path,
      encoding: r.encoding,
      rawLength: r.rawBytes.length,
      rawSha256: sha256Hex(r.rawBytes),
      decompressedLength: r.decompressedBytes.length,
      decompressedSha256: sha256Hex(r.decompressedBytes),
      headers: byIndex.get(r.index).entry.headers,
      rawArtifact: `request-${r.index}.raw`,
      bodyArtifact: `request-${r.index}.body`,
    })),
    transcriptArtifact: 'capture-transcript.ndjson',
    // ORIGINAL raw transcript bytes and an INDEPENDENT canonical-framing hash.
    inputSha256,
    framingSha256,
    limits: 'Producer exports a bounded SDK result SUMMARY only (no result body): this decoder cannot re-verify the absent SDK result body or the producer MERI_WIRE_DONE check, and the producer end record carries no manifest hash. Filesystem identity is checked via dev/ino/size/nlink plus within-API (path-vs-path and fd-vs-fd) mtime/ctime continuity; residual TOCTOU between the final identity check and any later reader is not eliminable with the qualified local Node fs API.',
  };
  return { ok: true, reasons: [], requests, report, inputBuffer, framingSha256 };
}
