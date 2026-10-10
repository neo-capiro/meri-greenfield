// Source-specific record-field validation for the SDK raw-capture decoder.
//
// Validates exact record shapes (headers, counters, spawn, result) and the
// retained synthetic request/tool semantics against the frozen producer. Every
// reason is a constant string; rejected values are never reflected. Depends on
// the protocol and privacy leaf modules; performs no filesystem or network work
// on import.

import {
  KEYS, EXPECTED, isInt, exactKeys,
  HEX64_RE, UUID_RE, ISO_MS_RE, ENV_NAME_RE, SAFE_FLAG_RE, HASHED_FLAG_RE,
  MAX_REQUEST_BYTES, MAX_DECOMPRESSED_BYTES, MAX_INPUT_BYTES,
} from './protocol.mjs';
import { looksLikeSecret, scrubSecrets, SENSITIVE_HEADER_NAME } from './privacy.mjs';

// ---------------------------------------------------------------------------
// Compression header resolution (producer-supported encodings only)
// ---------------------------------------------------------------------------
export function headerEntries(headers, name) {
  return Array.isArray(headers) ? headers.filter((h) => h && h.name === name) : [];
}
export function resolveEncoding(headers) {
  const entries = headerEntries(headers, 'content-encoding');
  if (entries.length === 0) return { ok: true, encoding: 'identity' };
  if (entries.length > 1) return { ok: false, reason: 'duplicate content-encoding header' };
  return { ok: true, encoding: typeof entries[0].value === 'string' ? entries[0].value : 'identity' };
}

// ---------------------------------------------------------------------------
// Retained-body semantic validation (mirrors the accepted producer exactly,
// including optional real tool-use metadata caller/toolset_name).
// ---------------------------------------------------------------------------
export function blocksOf(content) {
  return Array.isArray(content) ? content : [{ type: 'text', text: String(content ?? '') }];
}
export function textOfBlock(b) {
  if (b && Array.isArray(b.content)) return b.content.map((c) => (c && c.type === 'text' ? c.text : '')).join('');
  return String((b && b.content) ?? '');
}
export function validateToolAdvertisement(json) {
  if (!json || !Array.isArray(json.tools)) return 'missing tool advertisement';
  if (json.tools.length !== 1) return `expected exactly 1 advertised tool, saw ${json.tools.length}`;
  const t = json.tools[0];
  if (!t || t.name !== EXPECTED.WIRE_TOOL_FULLNAME) return 'unexpected advertised tool';
  return null;
}
export function validateFirstRequest(json) {
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
export function validateSecondRequest(json) {
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
export function validateHeaders(headers, index) {
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

export function validateCounters(counters) {
  if (!exactKeys(counters, KEYS.counters)) return 'counters fields are not exact';
  if (counters.permissionCallbacks !== 1) return 'permissionCallbacks must be exactly 1';
  if (counters.handlerExecutions !== 1) return 'handlerExecutions must be exactly 1';
  if (counters.spawns !== 1) return 'spawns must be exactly 1';
  return null;
}

export function validateSpawn(spawn) {
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

export function validateResult(result) {
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
export function validateRequestEntry(entry, index) {
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