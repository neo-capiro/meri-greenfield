// Shared immutable protocol constants, exact field sets and small shared pure
// byte/shape/canonical helpers for the SDK raw-capture decoder.
//
// Leaf module: it imports NO other decoder module and performs NO filesystem or
// network work on import. Every name here is either part of the original public
// export surface (re-exported by the entry) or a small shared pure helper used
// privately between decoder modules.

import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Accepted (frozen) producer constants, hard-copied from source as test input.
// ---------------------------------------------------------------------------
export const EXPECTED = Object.freeze({
  CAPTURE_MODEL: 'meri-sonnet-qualification',
  WIRE_TOOL_FULLNAME: 'mcp__wire__echo',
  WIRE_TOKEN: 'meri-wire-token',
  WIRE_TOOL_RESULT: 'meri-wire-tool-result',
  WIRE_TOOL_USE_ID: 'toolu_meri_wire_01',
  CAPTURE_USER_PROMPT: 'MERI_WIRE_QUALIFICATION_PROMPT: call the wire echo tool once.',
  ACCEPTED_PATHS: Object.freeze(['/v1/messages', '/v1/messages?beta=true']),
  EXPECTED_REQUESTS: 2,
  MAX_CHUNK_BYTES: 4096, // base64 CHARACTERS per chunk (OUT_CHUNK_BYTES in source)
});

// Aggregate allocation bounds enforced BEFORE heavy processing/decoding.
export const MAX_INPUT_BYTES = 32 * 1024 * 1024;
export const MAX_LINES = 20000;
export const MAX_RECORDS = 20000;
export const MAX_RECORD_BYTES = 12288;
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_DECOMPRESSED_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_RAW_BYTES = 2 * MAX_REQUEST_BYTES;
export const MAX_CHUNKS_PER_REQUEST = 4096;
export const MAX_REASONS = 64;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const HEX64_RE = /^[0-9a-f]{64}$/;
export const ISO_MS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export const ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const SAFE_FLAG_RE = /^--?[A-Za-z][A-Za-z0-9-]{0,40}$/;
export const HASHED_FLAG_RE = /^--hashed-[0-9a-f]{12}$/;

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function errMsg(error) { return String(error && error.message ? error.message : error).slice(0, 140); }
export function isInt(value, min, max) { return Number.isInteger(value) && value >= min && value <= max; }

// ---------------------------------------------------------------------------
// Exact-shape field sets
// ---------------------------------------------------------------------------
export const KEYS = Object.freeze({
  manifest: ['record', 'captureId', 'generatedAt', 'ok', 'reasons', 'counters', 'spawn', 'result', 'requestCount', 'totalBodyBytes', 'requestManifest'],
  chunk: ['record', 'captureId', 'index', 'seq', 'total', 'base64'],
  end: ['record', 'captureId', 'ok', 'requestCount', 'totalBodyBytes'],
  request: ['index', 'path', 'rawLength', 'rawSha256', 'decompressedLength', 'decompressedSha256', 'headers', 'hashOnly'],
  counters: ['permissionCallbacks', 'handlerExecutions', 'spawns'],
  spawn: ['spawned', 'cleanedUp', 'cleanupForced', 'argvCount', 'argvBytes', 'argvHash', 'argvFlags', 'envNames', 'stderrTotalBytes', 'stderrHashedBytes', 'stderrTruncated', 'stderrSha256', 'stderrPreview'],
  result: ['subtype', 'is_error', 'stop_reason', 'num_turns', 'session_id', 'resultLength', 'resultSha256'],
  header: ['name', 'value'],
});

export function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
export function exactKeys(obj, allowed) {
  if (!isPlainObject(obj)) return false;
  const keys = Object.keys(obj);
  if (keys.length !== allowed.length) return false;
  const set = new Set(allowed);
  return keys.every((k) => set.has(k));
}

/** Strict canonical base64: alphabet/padding correct and re-encodes identically. */
export function isCanonicalBase64(value) {
  if (typeof value !== 'string') return false;
  if (value.length === 0) return true;
  if (value.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return false;
  try { return Buffer.from(value, 'base64').toString('base64') === value; } catch { return false; }
}

export function canonical(value) { return JSON.stringify(sortDeep(value)); }
export function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortDeep(value[key]);
    return out;
  }
  return value;
}

/** Count lines up to `max` WITHOUT allocating the split array. */
export function countLinesUpTo(text, max) {
  let idx = -1;
  let count = 1;
  while (true) {
    idx = text.indexOf('\n', idx + 1);
    if (idx === -1) break;
    count += 1;
    if (count > max) return { exceeded: true, count };
  }
  return { exceeded: false, count };
}

/** Expected chunk count for a raw byte length under the source 4096-char rule. */
export function expectedChunkCount(rawLength) {
  const base64Length = Math.ceil(rawLength / 3) * 4;
  return Math.ceil(base64Length / EXPECTED.MAX_CHUNK_BYTES);
}