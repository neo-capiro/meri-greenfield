// Standalone strict bounded SDK raw-capture decoder (OFFLINE TOOLING CANDIDATE).
//
// Node BUILTINS ONLY. It does NOT import the frozen producer probe, load the
// Claude Agent SDK, spawn any native/CLI process, open a socket or contact the
// network. It consumes the exact bounded stdout records emitted by the accepted
// sdk-capture probe (buildOutputLines) and validates the COMPLETE wire framing
// and every field BEFORE writing anything.
//
// Record shapes are read from the accepted source
//   apps/worker/qualification/probes/sdk-capture.mjs
//   (SDK85ca1efd09f4d6c03d3e4d6048966db30c16b7a5 lineage):
//   { record:'sdk-capture-manifest', captureId, generatedAt, ok, reasons,
//     counters:{permissionCallbacks,handlerExecutions,spawns},
//     spawn:{spawned,cleanedUp,cleanupForced,argvCount,argvBytes,argvHash,
//            argvFlags,envNames,stderrTotalBytes,stderrHashedBytes,
//            stderrTruncated,stderrSha256,stderrPreview},
//     result:{subtype,is_error,stop_reason,num_turns,session_id,resultLength,
//             resultSha256}|null, requestCount, totalBodyBytes,
//     requestManifest:[{index,path,rawLength,rawSha256,decompressedLength,
//                       decompressedSha256,headers:[{name,value}],hashOnly}] }
//   { record:'sdk-capture-request-chunk', captureId, index, seq, total, base64 }
//   { record:'sdk-capture-end', captureId, ok, requestCount, totalBodyBytes }
//
// The producer's sdk-capture-end carries NO manifest hash. This decoder does not
// invent one. The producer also exports only a bounded SDK RESULT SUMMARY
// (subtype/is_error/stop_reason/num_turns/session_id/resultLength/resultSha256),
// never the SDK result body: this decoder cannot independently re-hash or
// re-verify the absent result body or the MERI_WIRE_DONE marker the producer
// checked before summarising. It instead preserves the ORIGINAL raw transcript
// bytes and an INDEPENDENT canonical-framing hash, and independently cross-checks
// every field that actually exists.
//
// CLI: node reconstruct-sdk-capture.mjs --input <captured.ndjson> --out <new-dir>
//      (default, --input only => bounded validate, write nothing).

import * as nodeFs from 'node:fs';
import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep, relative, isAbsolute } from 'node:path';
import zlib from 'node:zlib';

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
const MAX_REASONS = 64;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/;
const ISO_MS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SAFE_FLAG_RE = /^--?[A-Za-z][A-Za-z0-9-]{0,40}$/;
const HASHED_FLAG_RE = /^--hashed-[0-9a-f]{12}$/;

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

function errMsg(error) { return String(error && error.message ? error.message : error).slice(0, 140); }
function isInt(value, min, max) { return Number.isInteger(value) && value >= min && value <= max; }

// ---------------------------------------------------------------------------
// Independent confidentiality primitives (equivalent semantics to the accepted
// producer; re-implemented here so the decoder never trusts a producer boolean).
// ---------------------------------------------------------------------------
const SECRET_VALUE_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{6,}/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{10,}\b/g,
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g,
  /Bearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi,
];

/** Redact secret-like substrings from arbitrary text (producer-equivalent). */
export function scrubSecrets(text) {
  let out = String(text ?? '');
  for (const re of SECRET_VALUE_PATTERNS) out = out.replace(re, '<redacted>');
  out = out.replace(
    /([\"']?[A-Za-z0-9_.-]*(?:key|token|secret|password|credential|authorization)[A-Za-z0-9_.-]*[\"']?\s*[:=]\s*)(\"[^\"]*\"|'[^']*'|[^\s,;}]+)/gi,
    '$1<redacted>',
  );
  return out;
}

/** True when the text appears to contain secret-like material. */
export function looksLikeSecret(text) {
  const s = String(text ?? '');
  return SECRET_VALUE_PATTERNS.some((re) => { re.lastIndex = 0; return re.test(s); });
}

// Credential NAMES are SEMANTIC. A key is credential-named only when one of its
// delimiter/camelCase/acronym-separated segments is a credential word. Plural
// accounting fields (max_tokens/input_tokens/output_tokens -> "tokens") are NOT
// credential names.
const CRED_KEY_SEGMENTS = new Set(['key', 'apikey', 'token', 'secret', 'password', 'passwd', 'passphrase', 'credential', 'credentials', 'authorization', 'bearer', 'cookie']);
export function isCredentialKey(k) {
  return String(k)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((seg) => seg && CRED_KEY_SEGMENTS.has(seg));
}

/** Recursive, depth/seen-bounded credential detection (depth>12 fails closed). */
export function hasSensitiveBody(value, depth = 0, seen = new Set()) {
  if (depth > 12) return true;
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return looksLikeSecret(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((v) => hasSensitiveBody(v, depth + 1, seen));
  for (const [k, v] of Object.entries(value)) {
    if (isCredentialKey(k) && v !== null && v !== undefined) return true;
    if (hasSensitiveBody(v, depth + 1, seen)) return true;
  }
  return false;
}

const SENSITIVE_HEADER_NAME = /authorization|cookie|api[-_]?key|auth|token|secret|credential|password|passwd|bearer/i;

// ---------------------------------------------------------------------------
// Exact-shape helpers
// ---------------------------------------------------------------------------
const KEYS = Object.freeze({
  manifest: ['record', 'captureId', 'generatedAt', 'ok', 'reasons', 'counters', 'spawn', 'result', 'requestCount', 'totalBodyBytes', 'requestManifest'],
  chunk: ['record', 'captureId', 'index', 'seq', 'total', 'base64'],
  end: ['record', 'captureId', 'ok', 'requestCount', 'totalBodyBytes'],
  request: ['index', 'path', 'rawLength', 'rawSha256', 'decompressedLength', 'decompressedSha256', 'headers', 'hashOnly'],
  counters: ['permissionCallbacks', 'handlerExecutions', 'spawns'],
  spawn: ['spawned', 'cleanedUp', 'cleanupForced', 'argvCount', 'argvBytes', 'argvHash', 'argvFlags', 'envNames', 'stderrTotalBytes', 'stderrHashedBytes', 'stderrTruncated', 'stderrSha256', 'stderrPreview'],
  result: ['subtype', 'is_error', 'stop_reason', 'num_turns', 'session_id', 'resultLength', 'resultSha256'],
  header: ['name', 'value'],
});

function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function exactKeys(obj, allowed) {
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

function canonical(value) { return JSON.stringify(sortDeep(value)); }
function sortDeep(value) {
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

/** Bounded parse of the captured stdout into JSON record lines. */
export function parseRecords(text) {
  const raw = typeof text === 'string' ? text : '';
  if (Buffer.byteLength(raw, 'utf8') > MAX_INPUT_BYTES) return { ok: false, reasons: [`input exceeds ${MAX_INPUT_BYTES} bytes`], records: [] };
  // Only JSON whitespace is framing; Unicode trim() also discards BOM/NBSP/VT.
  const trimmed = raw.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
  if (!trimmed) return { ok: false, reasons: ['empty input'], records: [] };
  if (countLinesUpTo(trimmed, MAX_LINES).exceeded) return { ok: false, reasons: [`input exceeds ${MAX_LINES} lines`], records: [] };
  const lines = trimmed.split('\n');
  if (lines.length > MAX_LINES) return { ok: false, reasons: [`input exceeds ${MAX_LINES} lines`], records: [] };
  const reasons = [];
  const records = [];
  for (const line of lines) {
    const recordLine = line.replace(/\r$/, '');
    if (recordLine === '') continue;
    if (Buffer.byteLength(recordLine, 'utf8') > MAX_RECORD_BYTES) { if (reasons.length < MAX_REASONS) reasons.push(`record line exceeds ${MAX_RECORD_BYTES} bytes`); continue; }
    let value;
    try {
      scanJsonKeys(recordLine); // reject duplicate members before JSON.parse hides them
      value = JSON.parse(recordLine);
    } catch (error) {
      if (reasons.length < MAX_REASONS) reasons.push(error && error.name === 'DuplicateKeyError' ? 'record contains duplicate JSON object members' : 'malformed JSON record');
      continue;
    }
    if (!isPlainObject(value)) { if (reasons.length < MAX_REASONS) reasons.push('record is not a JSON object'); continue; }
    records.push(value);
    if (records.length > MAX_RECORDS) return { ok: false, reasons: [`more than ${MAX_RECORDS} records`], records: [] };
  }
  if (records.length === 0 && reasons.length === 0) reasons.push('no records found');
  return { ok: reasons.length === 0, reasons, records };
}

// ---------------------------------------------------------------------------
// Strict JSON member-name scanner (duplicate-key detection BEFORE JSON.parse).
//
// JSON.parse silently keeps the LAST duplicate member, which can hide a
// credential/header/record value. This scanner walks the raw text, tracking a
// per-object member-name set at EVERY nesting depth, decoding JSON string
// escapes (\uXXXX, \", \\, ...) so escaped/colliding names are compared by
// their decoded value. Same names in DISTINCT object scopes are allowed.
// Bounded by MAX_JSON_DEPTH; failures are constant diagnostics (no excerpts).
// ---------------------------------------------------------------------------
export const MAX_JSON_DEPTH = 64;
class DuplicateKeyError extends Error { constructor() { super('duplicate JSON member'); this.name = 'DuplicateKeyError'; } }
class JsonScanError extends Error { constructor() { super('malformed JSON'); this.name = 'JsonScanError'; } }

/** Throw DuplicateKeyError on any duplicate object member, JsonScanError on malformed JSON. */
export function scanJsonKeys(text) {
  const n = text.length;
  let i = 0;
  const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
  const isDigit = (c) => c >= '0' && c <= '9';
  const fail = () => { throw new JsonScanError(); };
  function ws() { while (i < n && isWs(text[i])) i += 1; }
  function scanString() {
    if (text[i] !== '"') fail();
    i += 1;
    let out = '';
    while (i < n) {
      const c = text[i];
      if (c === '"') { i += 1; return out; }
      if (c === '\\') {
        i += 1;
        if (i >= n) fail();
        const e = text[i];
        if (e === '"' || e === '\\' || e === '/') { out += e; i += 1; }
        else if (e === 'b') { out += '\b'; i += 1; }
        else if (e === 'f') { out += '\f'; i += 1; }
        else if (e === 'n') { out += '\n'; i += 1; }
        else if (e === 'r') { out += '\r'; i += 1; }
        else if (e === 't') { out += '\t'; i += 1; }
        else if (e === 'u') {
          if (i + 4 >= n) fail();
          const hex = text.slice(i + 1, i + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail();
          out += String.fromCharCode(parseInt(hex, 16));
          i += 5;
        } else fail();
      } else if (c.charCodeAt(0) < 0x20) { fail(); } else { out += c; i += 1; }
    }
    return fail();
  }
  function scanNumber() {
    if (text[i] === '-') i += 1;
    if (text[i] === '0') i += 1;
    else if (text[i] >= '1' && text[i] <= '9') { while (isDigit(text[i])) i += 1; }
    else return fail();
    if (text[i] === '.') { i += 1; if (!isDigit(text[i])) fail(); while (isDigit(text[i])) i += 1; }
    if (text[i] === 'e' || text[i] === 'E') { i += 1; if (text[i] === '+' || text[i] === '-') i += 1; if (!isDigit(text[i])) fail(); while (isDigit(text[i])) i += 1; }
  }
  function scanObject(depth) {
    if (depth > MAX_JSON_DEPTH) fail();
    i += 1; ws();
    const seen = new Set();
    if (text[i] === '}') { i += 1; return; }
    while (true) {
      ws();
      if (text[i] !== '"') fail();
      const key = scanString();
      if (seen.has(key)) throw new DuplicateKeyError();
      seen.add(key);
      ws();
      if (text[i] !== ':') fail();
      i += 1;
      scanValue(depth + 1);
      ws();
      if (text[i] === ',') { i += 1; continue; }
      if (text[i] === '}') { i += 1; return; }
      return fail();
    }
  }
  function scanArray(depth) {
    if (depth > MAX_JSON_DEPTH) fail();
    i += 1; ws();
    if (text[i] === ']') { i += 1; return; }
    while (true) {
      scanValue(depth + 1);
      ws();
      if (text[i] === ',') { i += 1; continue; }
      if (text[i] === ']') { i += 1; return; }
      return fail();
    }
  }
  function scanValue(depth) {
    if (depth > MAX_JSON_DEPTH) fail();
    ws();
    if (i >= n) fail();
    const c = text[i];
    if (c === '"') { scanString(); return; }
    if (c === '{') { scanObject(depth); return; }
    if (c === '[') { scanArray(depth); return; }
    if (c === '-' || isDigit(c)) { scanNumber(); return; }
    if (text.startsWith('true', i)) { i += 4; return; }
    if (text.startsWith('false', i)) { i += 5; return; }
    if (text.startsWith('null', i)) { i += 4; return; }
    return fail();
  }
  ws();
  if (i >= n) fail();
  scanValue(0);
  ws();
  if (i !== n) fail();
}

// ---------------------------------------------------------------------------
// Compression (producer-supported encodings only)
// ---------------------------------------------------------------------------
function headerEntries(headers, name) {
  return Array.isArray(headers) ? headers.filter((h) => h && h.name === name) : [];
}
function resolveEncoding(headers) {
  const entries = headerEntries(headers, 'content-encoding');
  if (entries.length === 0) return { ok: true, encoding: 'identity' };
  if (entries.length > 1) return { ok: false, reason: 'duplicate content-encoding header' };
  return { ok: true, encoding: typeof entries[0].value === 'string' ? entries[0].value : 'identity' };
}
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
// Retained-body semantic validation (mirrors the accepted producer exactly,
// including optional real tool-use metadata caller/toolset_name).
// ---------------------------------------------------------------------------
function blocksOf(content) {
  return Array.isArray(content) ? content : [{ type: 'text', text: String(content ?? '') }];
}
function textOfBlock(b) {
  if (b && Array.isArray(b.content)) return b.content.map((c) => (c && c.type === 'text' ? c.text : '')).join('');
  return String((b && b.content) ?? '');
}
function validateToolAdvertisement(json) {
  if (!json || !Array.isArray(json.tools)) return 'missing tool advertisement';
  if (json.tools.length !== 1) return `expected exactly 1 advertised tool, saw ${json.tools.length}`;
  const t = json.tools[0];
  if (!t || t.name !== EXPECTED.WIRE_TOOL_FULLNAME) return 'unexpected advertised tool';
  return null;
}
function validateFirstRequest(json) {
  if (!json || typeof json !== 'object') return 'first request is not an object';
  if (json.model !== EXPECTED.CAPTURE_MODEL) return 'first request model mismatch';
  if (json.stream !== true) return 'first request stream !== true';
  if (!Array.isArray(json.messages)) return 'first request has no messages array';
  const userTexts = [];
  for (const m of json.messages) {
    if (!m || m.role !== 'user') continue;
    for (const b of blocksOf(m.content)) if (b && b.type === 'text') userTexts.push(String(b.text || ''));
  }
  if (userTexts.length !== 1) return 'first request must have exactly 1 user text block';
  if (userTexts[0] !== EXPECTED.CAPTURE_USER_PROMPT) return 'first request prompt is not the exact synthetic prompt';
  return validateToolAdvertisement(json);
}
function validateSecondRequest(json) {
  if (!json || typeof json !== 'object') return 'second request is not an object';
  if (json.model !== EXPECTED.CAPTURE_MODEL) return 'second request model mismatch';
  if (json.stream !== true) return 'second request stream !== true';
  const adv = validateToolAdvertisement(json);
  if (adv) return adv;
  if (!Array.isArray(json.messages)) return 'second request has no messages array';
  const toolUses = [];
  const toolResults = [];
  const userTexts = [];
  const assistantBlocks = [];
  let promptIndex = -1;
  let assistantIndex = -1;
  let resultIndex = -1;
  json.messages.forEach((m, i) => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return;
    for (const b of blocksOf(m.content)) {
      if (m.role === 'assistant') assistantBlocks.push(b);
      if (!b) continue;
      if (b.type === 'text' && m.role === 'user') { userTexts.push(String(b.text || '')); if (promptIndex < 0) promptIndex = i; }
      if (b.type === 'tool_use') { toolUses.push({ i, role: m.role, b }); assistantIndex = i; }
      if (b.type === 'tool_result') { toolResults.push({ i, role: m.role, b }); resultIndex = i; }
    }
  });
  if (toolUses.length !== 1) return `second request must have exactly 1 tool_use (saw ${toolUses.length})`;
  if (toolResults.length !== 1) return `second request must have exactly 1 tool_result (saw ${toolResults.length})`;
  if (userTexts.length !== 1) return 'second request must have exactly 1 user prompt';
  if (userTexts[0] !== EXPECTED.CAPTURE_USER_PROMPT) return 'second request prompt is not the exact synthetic prompt';
  const tu = toolUses[0];
  const tr = toolResults[0];
  if (tu.role !== 'assistant') return 'tool_use must be in an assistant message';
  if (tr.role !== 'user') return 'tool_result must be in a user message';
  if (!(promptIndex < assistantIndex && assistantIndex < resultIndex)) return 'order must be prompt, assistant tool_use, user tool_result';
  if (tu.b.id !== EXPECTED.WIRE_TOOL_USE_ID) return 'foreign tool_use id';
  if (tu.b.name !== EXPECTED.WIRE_TOOL_FULLNAME) return 'foreign tool name';
  const keys = tu.b.input && typeof tu.b.input === 'object' ? Object.keys(tu.b.input) : [];
  if (keys.length !== 1 || tu.b.input.value !== EXPECTED.WIRE_TOKEN) return 'tool_use input must be exactly {value:token}';
  if (tr.b.tool_use_id !== EXPECTED.WIRE_TOOL_USE_ID) return 'tool_result id does not match the emitted id';
  if (tr.b.is_error === true) return 'tool_result is_error:true';
  if (textOfBlock(tr.b) !== EXPECTED.WIRE_TOOL_RESULT) return 'tool_result content mismatch';
  if (assistantBlocks.length !== 1 || !assistantBlocks[0] || assistantBlocks[0].type !== 'tool_use') return 'assistant content must be exactly the emitted tool_use block';
  return null;
}

// ---------------------------------------------------------------------------
// Strict record-field validation
// ---------------------------------------------------------------------------
function validateHeaders(headers, index) {
  if (!Array.isArray(headers)) return `request ${index} headers are not an array`;
  let prev = null;
  const seen = new Set();
  for (const h of headers) {
    if (!exactKeys(h, KEYS.header)) return `request ${index} header entry fields are not exactly name/value`;
    const { name, value } = h;
    if (typeof name !== 'string' || name.length === 0 || name.length > 256) return `request ${index} header name is invalid`;
    if (looksLikeSecret(name)) return `request ${index} header name is secret-like`;
    if (seen.has(name)) return `request ${index} header names are not unique`;
    seen.add(name);
    if (prev !== null && !(name > prev)) return `request ${index} header names are not sorted`;
    prev = name;
    if (typeof value !== 'string') return `request ${index} header value is not a string`;
    if (SENSITIVE_HEADER_NAME.test(name)) {
      if (value !== '<redacted>') return `request ${index} sensitive header value is not redacted`;
      continue;
    }
    if (looksLikeSecret(value)) return `request ${index} header value is secret-like`;
    if (scrubSecrets(value) !== value) return `request ${index} header value is not sanitized`;
    if (value.length > 256) {
      if (!(value.length === 256 + '<truncated>'.length && value.endsWith('<truncated>'))) return `request ${index} header value exceeds the retained bound`;
    }
  }
  return null;
}

function validateCounters(counters) {
  if (!exactKeys(counters, KEYS.counters)) return 'counters fields are not exact';
  if (counters.permissionCallbacks !== 1) return 'permissionCallbacks must be exactly 1';
  if (counters.handlerExecutions !== 1) return 'handlerExecutions must be exactly 1';
  if (counters.spawns !== 1) return 'spawns must be exactly 1';
  return null;
}

function validateSpawn(spawn) {
  if (!exactKeys(spawn, KEYS.spawn)) return 'spawn fields are not exact';
  if (spawn.spawned !== true) return 'spawn.spawned is not true';
  if (spawn.cleanedUp !== true) return 'spawn.cleanedUp is not true';
  if (typeof spawn.cleanupForced !== 'boolean') return 'spawn.cleanupForced is not boolean';
  if (!isInt(spawn.argvCount, 0, 4096)) return 'spawn.argvCount is invalid';
  if (!isInt(spawn.argvBytes, 0, 1024 * 1024)) return 'spawn.argvBytes is invalid';
  if (typeof spawn.argvHash !== 'string' || !HEX64_RE.test(spawn.argvHash)) return 'spawn.argvHash is malformed';
  if (!Array.isArray(spawn.argvFlags)) return 'spawn.argvFlags is not an array';
  for (const flag of spawn.argvFlags) {
    if (typeof flag !== 'string' || looksLikeSecret(flag)) return 'spawn.argvFlags contains an unsafe flag';
    if (!HASHED_FLAG_RE.test(flag) && !(SAFE_FLAG_RE.test(flag) && flag.length <= 42)) return 'spawn.argvFlags contains a non-name flag';
  }
  if (!Array.isArray(spawn.envNames) || spawn.envNames.length === 0) return 'spawn.envNames is not a non-empty array';
  let prevEnv = null;
  for (const name of spawn.envNames) {
    if (typeof name !== 'string' || !ENV_NAME_RE.test(name)) return 'spawn.envNames contains an invalid name';
    if (looksLikeSecret(name)) return 'spawn.envNames contains a secret-like name';
    if (prevEnv !== null && !(name > prevEnv)) return 'spawn.envNames is not sorted/unique';
    prevEnv = name;
  }
  if (!spawn.envNames.includes('ANTHROPIC_BASE_URL')) return 'spawn env lacks ANTHROPIC_BASE_URL';
  if (!isInt(spawn.stderrTotalBytes, 0, MAX_INPUT_BYTES)) return 'spawn.stderrTotalBytes is invalid';
  if (!isInt(spawn.stderrHashedBytes, 0, 65536)) return 'spawn.stderrHashedBytes is invalid';
  if (spawn.stderrHashedBytes > spawn.stderrTotalBytes) return 'spawn.stderrHashedBytes exceeds total';
  if (spawn.stderrTruncated !== false) return 'stderr was truncated (capture incomplete)';
  if (spawn.stderrSha256 !== null && (typeof spawn.stderrSha256 !== 'string' || !HEX64_RE.test(spawn.stderrSha256))) return 'spawn.stderrSha256 is malformed';
  if (spawn.stderrTotalBytes > 0 && typeof spawn.stderrSha256 !== 'string') return 'spawn.stderrSha256 missing for non-empty stderr';
  if (spawn.stderrPreview !== null) {
    if (typeof spawn.stderrPreview !== 'string') return 'spawn.stderrPreview is not a string';
    if (spawn.stderrPreview.length > 1024) return 'spawn.stderrPreview exceeds the retained bound';
    if (looksLikeSecret(spawn.stderrPreview) || scrubSecrets(spawn.stderrPreview) !== spawn.stderrPreview) return 'spawn.stderrPreview is not sanitized';
  }
  return null;
}

function validateResult(result) {
  if (!exactKeys(result, KEYS.result)) return 'result summary fields are not exact';
  if (result.subtype !== 'success') return 'result subtype is not success';
  if (result.is_error !== false) return 'result is_error is not false';
  if (result.stop_reason !== 'end_turn') return 'result stop_reason is not end_turn';
  if (!isInt(result.num_turns, 0, 1_000_000)) return 'result num_turns is invalid';
  if (typeof result.session_id !== 'string' || !UUID_RE.test(result.session_id)) return 'result session_id is not a UUID';
  if (!isInt(result.resultLength, 0, MAX_INPUT_BYTES)) return 'result resultLength is invalid';
  if (typeof result.resultSha256 !== 'string' || !HEX64_RE.test(result.resultSha256)) return 'result resultSha256 is malformed';
  return null;
}

/** Validate one requestManifest entry; returns {reasons, entry} with resolved encoding. */
function validateRequestEntry(entry, index) {
  const label = isInt(index, 1, 2) ? index : '?';
  if (!exactKeys(entry, KEYS.request)) return { reasons: [`request ${label} metadata fields are not exact`] };
  const reasons = [];
  if (entry.index !== index) reasons.push(`request ${label} index field mismatch`);
  if (!EXPECTED.ACCEPTED_PATHS.includes(entry.path)) reasons.push(`request ${label} has an unexpected path`);
  if (entry.hashOnly !== false) reasons.push(`request ${label} hashOnly is not the boolean false`);
  if (!isInt(entry.rawLength, 1, MAX_REQUEST_BYTES)) reasons.push(`request ${label} rawLength is invalid`);
  if (typeof entry.rawSha256 !== 'string' || !HEX64_RE.test(entry.rawSha256)) reasons.push(`request ${label} rawSha256 is malformed`);
  if (entry.decompressedLength !== null && !isInt(entry.decompressedLength, 0, MAX_DECOMPRESSED_BYTES)) reasons.push(`request ${label} decompressedLength is invalid`);
  if (entry.decompressedSha256 !== null && (typeof entry.decompressedSha256 !== 'string' || !HEX64_RE.test(entry.decompressedSha256))) reasons.push(`request ${label} decompressedSha256 is malformed`);
  const hdr = validateHeaders(entry.headers, label);
  if (hdr) reasons.push(hdr);
  const enc = resolveEncoding(entry.headers);
  if (!enc.ok) reasons.push(`request ${label}: ${enc.reason}`);
  return { reasons, encoding: enc.ok ? enc.encoding : 'identity', entry };
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

/** Expected chunk count for a raw byte length under the source 4096-char rule. */
function expectedChunkCount(rawLength) {
  const base64Length = Math.ceil(rawLength / 3) * 4;
  return Math.ceil(base64Length / EXPECTED.MAX_CHUNK_BYTES);
}

// ---------------------------------------------------------------------------
// Symlink/junction-safe path identity + read
// ---------------------------------------------------------------------------
export const realIo = Object.freeze({ fs: nodeFs });

function sameIdentity(a, b) {
  // dev/ino/size only; hardlink membership is enforced separately by explicit
  // nlink===1 gates on BOTH the path and descriptor observations, before AND
  // after the read (a hardlink swap that keeps dev/ino/size is still caught).
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size;
}
function sameTimestamps(a, b) {
  return a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}

/** Check `dir` AND every ancestor up to the root are real, non-symlink dirs. */
export function assertSafeAncestors(fs, dir) {
  let cur = resolve(dir);
  const seen = new Set();
  while (true) {
    if (seen.has(cur)) break;
    seen.add(cur);
    let st;
    try { st = fs.lstatSync(cur); } catch { throw new Error(`directory is missing: ${cur}`); }
    if (st.isSymbolicLink()) throw new Error(`directory is a symlink/junction: ${cur}`);
    if (!st.isDirectory()) throw new Error(`path component is not a directory: ${cur}`);
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
}

/**
 * Read the full bounded original file bytes with strict fatal UTF-8 and
 * descriptor/path identity continuity. io is injectable for race tests.
 */
export function readCaptureFile(filePath, io = realIo) {
  const fs = io.fs;
  if (typeof filePath !== 'string' || filePath.length === 0) throw new Error('input path required');
  const abs = resolve(filePath);
  assertSafeAncestors(fs, dirname(abs)); // immediate parent AND all ancestors
  let pre;
  try { pre = fs.lstatSync(abs); } catch { throw new Error('cannot stat input'); }
  if (pre.isSymbolicLink()) throw new Error('input is a symlink/junction');
  if (!pre.isFile()) throw new Error('input is not a regular file');
  if (pre.nlink !== 1) throw new Error('input has multiple hard links');
  if (pre.size > MAX_INPUT_BYTES) throw new Error(`input exceeds ${MAX_INPUT_BYTES} bytes`);
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  const fd = fs.openSync(abs, flags);
  let buf;
  let fstBefore;
  let fstAfter;
  try {
    fstBefore = fs.fstatSync(fd);
    if (!fstBefore.isFile()) throw new Error('input is not a regular file');
    if (fstBefore.nlink !== 1) throw new Error('input has multiple hard links');
    if (fstBefore.size > MAX_INPUT_BYTES) throw new Error(`input exceeds ${MAX_INPUT_BYTES} bytes`);
    if (!sameIdentity(pre, fstBefore)) throw new Error('input identity mismatch (path vs descriptor)');
    buf = Buffer.allocUnsafe(fstBefore.size);
    let read = 0;
    while (read < fstBefore.size) {
      const n = fs.readSync(fd, buf, read, fstBefore.size - read, read);
      if (n <= 0) break;
      read += n;
    }
    if (read !== fstBefore.size) throw new Error(`short read ${read}/${fstBefore.size}`);
    fstAfter = fs.fstatSync(fd);
  } finally { fs.closeSync(fd); }
  if (!sameIdentity(fstBefore, fstAfter) || !sameTimestamps(fstBefore, fstAfter)) throw new Error('input changed during read');
  if (fstAfter.nlink !== 1) throw new Error('input has multiple hard links');
  let post;
  try { post = fs.lstatSync(abs); } catch { throw new Error('input vanished after read'); }
  if (post.nlink !== 1) throw new Error('input has multiple hard links');
  if (!sameIdentity(pre, post) || !sameTimestamps(pre, post)) throw new Error('input path changed during read');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buf); } catch { throw new Error('input is not valid UTF-8'); }
  return { buffer: buf, text, path: abs };
}

// ---------------------------------------------------------------------------
// Exclusive, symlink-safe output
// ---------------------------------------------------------------------------
export function checkDestination(outDir, io = realIo) {
  const fs = io.fs;
  const reasons = [];
  if (typeof outDir !== 'string' || outDir.length === 0) return { ok: false, reasons: ['destination path required'], abs: null };
  if (outDir.includes('\0')) return { ok: false, reasons: ['destination path is invalid'], abs: null };
  if (outDir.split(/[\\/]+/).includes('..')) return { ok: false, reasons: ['destination must not contain .. traversal'], abs: null };
  const abs = resolve(outDir);
  if (abs === dirname(abs)) return { ok: false, reasons: ['destination must not be the filesystem root'], abs: null };
  try { assertSafeAncestors(fs, dirname(abs)); } catch (error) { reasons.push(errMsg(error)); }
  if (fs.existsSync(abs)) reasons.push(`destination already exists: ${abs}`);
  return { ok: reasons.length === 0, reasons, abs };
}

function pathedContained(root, child) {
  const rel = relative(resolve(root), resolve(child));
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
}

/** Build the in-memory artifact set (all-before-write). */
function buildArtifacts(result) {
  const artifacts = [{ name: 'capture-transcript.ndjson', data: result.inputBuffer }];
  for (const request of result.requests) {
    artifacts.push({ name: `request-${request.index}.raw`, data: request.rawBytes });
    artifacts.push({ name: `request-${request.index}.body`, data: request.decompressedBytes });
  }
  return artifacts;
}

/** Write validated artifacts into a NEW exclusive directory; any failure removes it. */
export function writeCapture(result, outDir, io = realIo) {
  const fs = io.fs;
  if (!result || result.ok !== true) return { ok: false, reasons: result ? result.reasons : ['no validated capture'] };
  if (!Buffer.isBuffer(result.inputBuffer) || result.inputBuffer.length > MAX_INPUT_BYTES || sha256Hex(result.inputBuffer) !== result.report?.inputSha256) {
    return { ok: false, reasons: ['validated transcript bytes changed'] };
  }
  const dest = checkDestination(outDir, io);
  if (!dest.ok) return { ok: false, reasons: dest.reasons };
  const payload = buildArtifacts(result);
  const fileFacts = payload.map((a) => ({ name: a.name, bytes: a.data.length, sha256: sha256Hex(a.data) }));
  const report = { ...result.report, artifacts: fileFacts.map((f) => ({ ...f, file: f.name })) };
  const reportData = Buffer.from(canonical(report) + '\n', 'utf8');

  let created = false;
  const reasons = [];
  try {
    fs.mkdirSync(dest.abs); // exclusive: throws EEXIST if present
    created = true;
    for (const artifact of payload) {
      const full = join(dest.abs, artifact.name);
      if (!pathedContained(dest.abs, full)) { reasons.push(`${artifact.name} escapes the destination`); throw new Error('containment violation'); }
      fs.writeFileSync(full, artifact.data, { flag: 'wx' });
    }
    const reportPath = join(dest.abs, 'capture-report.json');
    if (!pathedContained(dest.abs, reportPath)) { reasons.push('capture-report.json escapes the destination'); throw new Error('containment violation'); }
    fs.writeFileSync(reportPath, reportData, { flag: 'wx' });
    // Independently recompute every written file's size + SHA256.
    const written = [];
    for (const artifact of [...payload, { name: 'capture-report.json', data: reportData }]) {
      const full = join(dest.abs, artifact.name);
      const reread = fs.readFileSync(full);
      const expected = fileFacts.find((f) => f.name === artifact.name) || { bytes: reportData.length, sha256: sha256Hex(reportData) };
      if (reread.length !== expected.bytes || sha256Hex(reread) !== expected.sha256) throw new Error(`artifact verification failed for ${artifact.name}`);
      written.push({ file: artifact.name, bytes: reread.length, sha256: sha256Hex(reread) });
    }
    return { ok: true, reasons: [], dest: dest.abs, files: written, reportSha256: sha256Hex(reportData), reportBytes: reportData.length, transcriptSha256: result.report.inputSha256 };
  } catch (error) {
    let cleaned = false;
    if (created) {
      try { fs.rmSync(dest.abs, { recursive: true, force: true }); cleaned = !fs.existsSync(dest.abs); } catch { /* uncertainty retained */ }
    }
    const base = error && error.code === 'EEXIST' ? [`destination already exists: ${dest.abs}`] : [...reasons, `write failed: ${errMsg(error)}`];
    return { ok: false, reasons: [...base, ...(!cleaned ? ['partial output cleanup unconfirmed'] : [])], cleaned };
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { input: null, out: null, error: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--input') args.input = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a.startsWith('--input=')) args.input = a.slice('--input='.length);
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length);
    else args.error = 'unexpected argument';
  }
  return args;
}

/** CLI entry. Returns an exit code; performs no work on import. */
export function runCli(argv = process.argv.slice(2), { readFile = (p) => readCaptureFile(p), log = (m) => process.stdout.write(m + '\n') } = {}) {
  const args = parseArgs(argv);
  if (args.error) { log(JSON.stringify({ probe: 'sdk-capture-reconstruct', ok: false, reasons: [args.error] })); return 2; }
  if (!args.input) { log(JSON.stringify({ probe: 'sdk-capture-reconstruct', ok: false, reasons: ['--input is required'] })); return 2; }
  let loaded;
  try { loaded = readFile(args.input); } catch (error) { log(JSON.stringify({ probe: 'sdk-capture-reconstruct', ok: false, reasons: [`cannot read input: ${errMsg(error)}`] })); return 1; }
  const text = typeof loaded === 'string' ? loaded : loaded.text;
  const rawBuffer = typeof loaded === 'string' ? undefined : loaded.buffer;
  const result = validateCapture(text, rawBuffer === undefined ? {} : { rawBuffer });
  if (!result.ok) { log(JSON.stringify({ probe: 'sdk-capture-reconstruct', ok: false, reasons: result.reasons.slice(0, 12), wroteAny: false })); return 1; }
  if (!args.out) {
    log(JSON.stringify({ probe: 'sdk-capture-reconstruct', ok: true, checked: true, captureId: result.report.captureId, inputSha256: result.report.inputSha256, framingSha256: result.report.framingSha256, wroteAny: false }));
    return 0;
  }
  const written = writeCapture(result, args.out);
  if (!written.ok) { log(JSON.stringify({ probe: 'sdk-capture-reconstruct', ok: false, reasons: written.reasons.slice(0, 12), wroteAny: false })); return 1; }
  log(JSON.stringify({ probe: 'sdk-capture-reconstruct', ok: true, written: written.files.length, dest: written.dest, inputSha256: result.report.inputSha256, reportSha256: written.reportSha256 }));
  return 0;
}

const invokedDirectly = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (invokedDirectly) { process.exit(runCli()); }
