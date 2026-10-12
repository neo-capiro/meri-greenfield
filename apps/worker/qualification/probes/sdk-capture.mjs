// W02-05 native SDK loopback wire-capture PROBE (PREPARATION ONLY).
//
// OPT-IN, Linux-only live command. It is NEVER invoked by `npm test` and it is
// NEVER executed by the implementing session. Its purpose is to run the REAL
// Claude Agent SDK `query()` against a loopback scripted synthetic Messages
// endpoint so the owner can later reconstruct the exact native wire bytes from
// CloudWatch. The owner supplies the separate TaskDefinition EntryPoint:[node]
// Command:[/opt/meri-worker/probes/sdk-capture.mjs]; no image entrypoint change.
//
// Everything is injectable: `runCapture` takes a `host` whose side effects
// (settings resolution, workspace preparation, wire MCP server construction,
// native spawn, loopback server, and `query`) are supplied by the caller. The
// offline test injects fakes, so importing or testing this module starts NO
// server, NO native process and NO socket.

import http from 'node:http';
import zlib from 'node:zlib';
import { lstatSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname as pathDirname, resolve as pathResolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn as nodeSpawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { observeNativeStdout } from './native-stream-observer.mjs';

import {
  LOOPBACK_HOST,
  ACCEPTED_PATHS,
  CAPTURE_MODEL,
  CAPTURE_DEADLINE_MS,
  CAPTURE_CWD,
  CAPTURE_CONFIG_DIR,
  CAPTURE_HOME,
  MAX_REQUESTS,
  MAX_REQUEST_BYTES,
  MAX_DECOMPRESSED_BYTES,
  WIRE_SERVER_NAME,
  WIRE_TOOL_NAME,
  WIRE_TOOL_FULLNAME,
  WIRE_TOKEN,
  WIRE_TOOL_RESULT,
  WIRE_TOOL_TIMEOUT_MS,
  WIRE_DONE_MARKER,
  CAPTURE_USER_PROMPT,
  buildCaptureEnv,
  buildCaptureOptions,
  createPermissionCallback,
  runEchoHandler,
  preflightParentEnvironment,
} from './sdk-capture-options.mjs';

export {
  buildCaptureEnv,
  buildCaptureOptions,
  createPermissionCallback,
  runEchoHandler,
  preflightParentEnvironment,
} from './sdk-capture-options.mjs';

/** Bounded output / lifecycle constants. */
export const OUT_CHUNK_BYTES = 4096; // base64 chars per chunk; keeps every record < MAX_RECORD_BYTES
export const MAX_RECORD_BYTES = 12288;
export const MAX_STDERR_BYTES = 65536;
export const STDERR_PREVIEW_CHARS = 512;
export const CLOSE_GRACE_MS = 2000;
export const EXIT_GRACE_MS = 2000;
export const WRITE_TIMEOUT_MS = 5000;
export const MAX_DEADLINE_MS = 60000;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

/** sha256 hex of raw bytes. */
export function hashSha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** Error TYPES are data. Only fixed known tokens are ever exported; an unknown
 * (potentially opaque/secret) name is mapped to 'Error'. */
const KNOWN_ERROR_TYPES = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'EvalError', 'URIError', 'AbortError', 'TimeoutError', 'AggregateError']);
export function errorType(error) {
  const name = error && typeof error.name === 'string' ? error.name : '';
  return KNOWN_ERROR_TYPES.has(name) ? name : 'Error';
}

/** Validate the FIXED deadline. Must be finite, positive and <= 60000 ms. */
export function validateDeadline(deadlineMs) {
  if (typeof deadlineMs !== 'number' || !Number.isFinite(deadlineMs) || deadlineMs <= 0 || deadlineMs > MAX_DEADLINE_MS) {
    throw new Error(`invalid deadline must be finite and 0 < ms <= ${MAX_DEADLINE_MS}`);
  }
  return deadlineMs;
}

const SECRET_VALUE_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{6,}/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{10,}\b/g,
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g,
  /Bearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi,
];

/** Redact secret-like substrings from arbitrary text. */
export function scrubSecrets(text) {
  let out = String(text ?? '');
  for (const re of SECRET_VALUE_PATTERNS) out = out.replace(re, '<redacted>');
  out = out.replace(
    /(["']?[A-Za-z0-9_.-]*(?:key|token|secret|password|credential|authorization)[A-Za-z0-9_.-]*["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;}]+)/gi,
    '$1<redacted>',
  );
  return out;
}

/** True when the text appears to contain secret-like material. */
export function looksLikeSecret(text) {
  const s = String(text ?? '');
  return SECRET_VALUE_PATTERNS.some((re) => {
    re.lastIndex = 0;
    return re.test(s);
  });
}

// Credential detection is SEMANTIC: a key is credential-named only when one of
// its delimiter/camelCase/acronym-separated segments is a credential word. Accounting /
// token-count fields such as `max_tokens`, `input_tokens`, `cache_creation_
// input_tokens` and `output_tokens` split into `tokens` (plural) and are NOT
// credential names.
const CRED_KEY_SEGMENTS = new Set(['key', 'apikey', 'token', 'secret', 'password', 'passwd', 'passphrase', 'credential', 'credentials', 'authorization', 'bearer', 'cookie']);
function isCredentialKey(k) {
  return String(k)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((seg) => seg && CRED_KEY_SEGMENTS.has(seg));
}

/**
 * Recursively detect credential-named keys/values in a decoded body. Bounded in
 * depth/visited so a hostile body cannot cause unbounded work.
 */
export function hasSensitiveBody(value, depth = 0, seen = new Set()) {
  if (depth > 12) return true; // fail closed on absurd nesting
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

/** Bound + scrub a preview, keeping head and tail. */
export function boundedPreview(text, limit = STDERR_PREVIEW_CHARS) {
  const scrubbed = scrubSecrets(text);
  if (scrubbed.length <= limit) return scrubbed;
  const head = Math.floor(limit / 2);
  return `${scrubbed.slice(0, head)}<…${scrubbed.length - limit} bytes…>${scrubbed.slice(-(limit - head))}`;
}

const SENSITIVE_HEADER_NAME = /authorization|cookie|api[-_]?key|auth|token|secret|credential|password|passwd|bearer/i;

/** Sanitized header list (names retained; secret-like names/values redacted). */
export function sanitizeHeaders(headers = {}) {
  const norm = (v) => (Array.isArray(v) ? v.join(', ') : String(v));
  return Object.keys(headers)
    .sort()
    .map((name) => {
      const raw = norm(headers[name]);
      const redacted = SENSITIVE_HEADER_NAME.test(name) || looksLikeSecret(raw) ? '<redacted>' : scrubSecrets(raw);
      const value = redacted.length > 256 ? `${redacted.slice(0, 256)}<truncated>` : redacted;
      return { name, value };
    });
}

// ---------------------------------------------------------------------------
// Body decoding
// ---------------------------------------------------------------------------

export function decodeRequestBody({ rawBytes, contentEncoding, oversize = false } = {}) {
  const buf = Buffer.isBuffer(rawBytes) ? rawBytes : Buffer.from(rawBytes || []);
  const result = {
    ok: false,
    oversize: !!oversize,
    rawLength: buf.length,
    rawSha256: hashSha256(buf),
    encoding: contentEncoding || 'identity',
    decompressedLength: null,
    decompressedSha256: null,
    json: null,
    errorType: null,
  };
  if (oversize || buf.length > MAX_REQUEST_BYTES) {
    result.errorType = 'oversize';
    return result;
  }
  let decoded = buf;
  try {
    if (!contentEncoding || contentEncoding === 'identity') decoded = buf;
    else if (contentEncoding === 'gzip' || contentEncoding === 'x-gzip') decoded = zlib.gunzipSync(buf, { maxOutputLength: MAX_DECOMPRESSED_BYTES });
    else if (contentEncoding === 'deflate') decoded = zlib.inflateSync(buf, { maxOutputLength: MAX_DECOMPRESSED_BYTES });
    else {
      result.errorType = 'unsupported-encoding';
      return result;
    }
  } catch {
    result.errorType = 'decompression-failed';
    return result;
  }
  if (decoded.length > MAX_DECOMPRESSED_BYTES) {
    result.errorType = 'decompressed-oversize';
    return result;
  }
  result.decompressedLength = decoded.length;
  result.decompressedSha256 = hashSha256(decoded);
  try {
    result.json = JSON.parse(decoded.toString('utf8'));
  } catch {
    result.errorType = 'malformed-json';
    return result;
  }
  result.ok = true;
  return result;
}

// ---------------------------------------------------------------------------
// Capture state + strict request classification
// ---------------------------------------------------------------------------

export const WIRE_TOOL_USE_ID = 'toolu_meri_wire_01';

export function createCaptureState(port = 0) {
  return { count: 0, ready: false, aborted: null, toolUseId: WIRE_TOOL_USE_ID, port, requests: [] };
}

function blocksOf(content) {
  return Array.isArray(content) ? content : [{ type: 'text', text: String(content ?? '') }];
}

function textOfBlock(b) {
  if (b && Array.isArray(b.content)) return b.content.map((c) => (c && c.type === 'text' ? c.text : '')).join('');
  return String((b && b.content) ?? '');
}

/** Strict advertisement: tools must be present and exactly the wire echo tool. */
export function validateToolAdvertisement(json) {
  if (!json || !Array.isArray(json.tools)) return { ok: false, error: 'missing tool advertisement' };
  if (json.tools.length !== 1) return { ok: false, error: `expected exactly 1 advertised tool, saw ${json.tools.length}` };
  const t = json.tools[0];
  if (!t || t.name !== WIRE_TOOL_FULLNAME) return { ok: false, error: 'unexpected advertised tool' };
  return { ok: true };
}

/** Strict first request: exactly the synthetic prompt and tool advertisement. */
export function validateFirstRequest(json) {
  if (!json || !Array.isArray(json.messages)) return { ok: false, error: 'no messages array' };
  const userTexts = [];
  for (const m of json.messages) {
    if (!m || m.role !== 'user') continue;
    for (const b of blocksOf(m.content)) if (b && b.type === 'text') userTexts.push(String(b.text || ''));
  }
  if (userTexts.length !== 1) return { ok: false, error: `expected exactly 1 user text block, saw ${userTexts.length}` };
  if (userTexts[0] !== CAPTURE_USER_PROMPT) return { ok: false, error: 'first request prompt is not the exact synthetic prompt' };
  return validateToolAdvertisement(json);
}

/**
 * Strict second-request validation against the EMITTED tool-use id: the
 * tool_use block MUST live in an assistant message and the tool_result block
 * MUST live in a user message, in that order, after the exact prompt.
 */
export function validateToolRoundTrip(json, toolUseId) {
  if (!json || !Array.isArray(json.messages)) return { ok: false, error: 'no messages array' };
  const adv = validateToolAdvertisement(json);
  if (!adv.ok) return adv;
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
      if (b.type === 'text' && m.role === 'user') {
        userTexts.push(String(b.text || ''));
        if (promptIndex < 0) promptIndex = i;
      }
      if (b.type === 'tool_use') {
        toolUses.push({ i, role: m.role, b });
        assistantIndex = i;
      }
      if (b.type === 'tool_result') {
        toolResults.push({ i, role: m.role, b });
        resultIndex = i;
      }
    }
  });
  if (toolUses.length !== 1) return { ok: false, error: `expected exactly 1 tool_use, saw ${toolUses.length}` };
  if (toolResults.length !== 1) return { ok: false, error: `expected exactly 1 tool_result, saw ${toolResults.length}` };
  if (userTexts.length !== 1) return { ok: false, error: `expected exactly 1 user prompt, saw ${userTexts.length}` };
  if (userTexts[0] !== CAPTURE_USER_PROMPT) return { ok: false, error: 'prompt is not the exact synthetic prompt' };
  const tu = toolUses[0];
  const tr = toolResults[0];
  if (tu.role !== 'assistant') return { ok: false, error: 'tool_use must be in an assistant message' };
  if (tr.role !== 'user') return { ok: false, error: 'tool_result must be in a user message' };
  if (!(promptIndex < assistantIndex && assistantIndex < resultIndex)) {
    return { ok: false, error: 'order must be user prompt, assistant tool_use, user tool_result' };
  }
  if (tu.b.id !== toolUseId) return { ok: false, error: 'foreign tool_use id' };
  if (tu.b.name !== WIRE_TOOL_FULLNAME) return { ok: false, error: 'foreign tool name' };
  const keys = tu.b.input && typeof tu.b.input === 'object' ? Object.keys(tu.b.input) : [];
  if (keys.length !== 1 || tu.b.input.value !== WIRE_TOKEN) return { ok: false, error: 'tool_use input must be exactly {value:token}' };
  if (tr.b.tool_use_id !== toolUseId) return { ok: false, error: 'tool_result id does not match emitted id' };
  if (tr.b.is_error === true) return { ok: false, error: 'tool_result is_error:true' };
  if (textOfBlock(tr.b) !== WIRE_TOOL_RESULT) return { ok: false, error: 'tool_result content mismatch' };
  if (assistantBlocks.length !== 1 || assistantBlocks[0]?.type !== 'tool_use') {
    return { ok: false, error: 'assistant content must be exactly the emitted tool_use block' };
  }
  return { ok: true };
}

/**
 * Validate one received request and mutate state. Violations abort immediately.
 */
export function classifyRequest(state, req = {}) {
  const abort = (error) => {
    state.aborted = `request ${state.count + 1}: ${error}`;
    return { ok: false, action: 'abort', error: state.aborted };
  };
  if (state.aborted) return { ok: false, action: 'abort', error: state.aborted };
  if (req.method !== 'POST') return abort('unexpected method');
  if (!ACCEPTED_PATHS.includes(req.path)) return abort('unexpected path');
  const peer = String(req.peer || '');
  if (peer !== LOOPBACK_HOST && peer !== `::ffff:${LOOPBACK_HOST}`) return abort('non-loopback peer');
  if (String(req.host || '') !== `${LOOPBACK_HOST}:${state.port}`) return abort(`host does not equal bound ${LOOPBACK_HOST}:${state.port}`);
  const decoded = decodeRequestBody({ rawBytes: req.rawBytes, contentEncoding: req.contentEncoding, oversize: req.oversize });
  if (!decoded.ok) return abort(decoded.errorType);
  const json = decoded.json;
  if (json && json.model !== CAPTURE_MODEL) return abort('wrong model');
  if (json && json.stream !== true) return abort('stream !== true');
  const index = state.count + 1;
  if (index > MAX_REQUESTS) return abort('duplicate/extra request beyond exactly 2');
  if (index === 1) {
    const v = validateFirstRequest(json);
    if (!v.ok) return abort(v.error);
  } else {
    const v = validateToolRoundTrip(json, state.toolUseId);
    if (!v.ok) return abort(v.error);
  }
  const sensitive = hasSensitiveBody(json);
  state.count = index;
  state.requests.push({
    index,
    method: req.method,
    path: req.path,
    host: req.host,
    peer,
    contentEncoding: decoded.encoding,
    rawLength: decoded.rawLength,
    rawSha256: decoded.rawSha256,
    decompressedLength: decoded.decompressedLength,
    decompressedSha256: decoded.decompressedSha256,
    base64: req.rawBytes ? Buffer.from(req.rawBytes).toString('base64') : null,
    decoded: json,
    hashOnly: sensitive,
    headers: sanitizeHeaders(req.headers),
  });
  if (index === MAX_REQUESTS) state.ready = true;
  return { ok: true, action: 'respond', index, plan: { index, toolUseId: state.toolUseId } };
}

// ---------------------------------------------------------------------------
// SSE response shapes (current locked BETA Messages declarations)
// ---------------------------------------------------------------------------

function sseEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Complete BetaUsage. */
export function completeUsage({ inputTokens = 16, outputTokens = 1 } = {}) {
  return {
    cache_creation: null,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    fallback_credit: null,
    inference_geo: null,
    input_tokens: inputTokens,
    iterations: null,
    output_tokens: outputTokens,
    output_tokens_details: null,
    server_tool_use: null,
    service_tier: 'standard',
    speed: 'standard',
  };
}

/** Complete nullable BetaMessage container for message_start. */
export function completeMessageStart({ usage } = {}) {
  return {
    type: 'message_start',
    message: {
      id: 'msg_meri_wire_01',
      type: 'message',
      role: 'assistant',
      model: CAPTURE_MODEL,
      content: [],
      container: null,
      context_management: null,
      diagnostics: null,
      stop_details: null,
      stop_reason: null,
      stop_sequence: null,
      usage: usage || completeUsage(),
    },
  };
}

export function buildToolUseSse(toolUseId = WIRE_TOOL_USE_ID) {
  return (
    sseEvent('message_start', completeMessageStart({ usage: completeUsage({ inputTokens: 16, outputTokens: 1 }) })) +
    sseEvent('content_block_start', {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'tool_use', id: toolUseId, name: WIRE_TOOL_FULLNAME, input: {}, caller: { type: 'direct' }, toolset_name: null },
    }) +
    sseEvent('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'input_json_delta', partial_json: JSON.stringify({ value: WIRE_TOKEN }) },
    }) +
    sseEvent('content_block_stop', { type: 'content_block_stop', index: 0 }) +
    sseEvent('message_delta', {
      type: 'message_delta',
      context_management: null,
      delta: { container: null, stop_details: null, stop_reason: 'tool_use', stop_sequence: null },
      usage: { cache_creation_input_tokens: 0, cache_read_input_tokens: 0, fallback_credit: null, input_tokens: 16, iterations: null, output_tokens: 18, output_tokens_details: null, server_tool_use: null },
    }) +
    sseEvent('message_stop', { type: 'message_stop' })
  );
}

export function buildFinalSse() {
  return (
    sseEvent('message_start', completeMessageStart({ usage: completeUsage({ inputTokens: 24, outputTokens: 1 }) })) +
    sseEvent('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: null } }) +
    sseEvent('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: WIRE_DONE_MARKER } }) +
    sseEvent('content_block_stop', { type: 'content_block_stop', index: 0 }) +
    sseEvent('message_delta', {
      type: 'message_delta',
      context_management: null,
      delta: { container: null, stop_details: null, stop_reason: 'end_turn', stop_sequence: null },
      usage: { cache_creation_input_tokens: 0, cache_read_input_tokens: 0, fallback_credit: null, input_tokens: 24, iterations: null, output_tokens: 9, output_tokens_details: null, server_tool_use: null },
    }) +
    sseEvent('message_stop', { type: 'message_stop' })
  );
}

export function planSseResponse(index, toolUseId = WIRE_TOOL_USE_ID) {
  return index === 1 ? buildToolUseSse(toolUseId) : buildFinalSse();
}

// ---------------------------------------------------------------------------
// Bounded waits
// ---------------------------------------------------------------------------

/** Bound a promise by an absolute deadline; never rejects. */
export function boundedWait(promise, atMs, now = Date.now) {
  const ms = Math.max(1, atMs - now());
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ ok: false, timedOut: true });
      }
    }, ms);
    Promise.resolve(promise).then(
      (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ ok: true, value });
        }
      },
      (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ ok: false, error });
        }
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Loopback capture server (REAL http)
// ---------------------------------------------------------------------------

export async function createLoopbackServer({ state, deadlineMs = CAPTURE_DEADLINE_MS, maxRequests = MAX_REQUESTS, onAbort, signal, host = LOOPBACK_HOST } = {}) {
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    let aborted = false;
    let completed = false;
    req.on('aborted', () => {
      if (!completed) {
        aborted = true;
        if (typeof onAbort === 'function') onAbort('incomplete request (client aborted)');
      }
    });
    req.on('close', () => {
      if (!completed && !aborted) {
        aborted = true;
        if (typeof onAbort === 'function') onAbort('incomplete request (connection closed early)');
      }
    });
    const chunks = [];
    let size = 0;
    let over = false;
    const abortOversize = () => {
      over = true;
      aborted = true;
      try {
        if (!res.headersSent) res.writeHead(413, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'meri-wire: oversize' } }));
      } catch {
        /* ignore */
      }
      try {
        req.destroy();
        if (req.socket) req.socket.destroy();
      } catch {
        /* ignore */
      }
      if (typeof onAbort === 'function') onAbort('oversize request body');
    };
    req.on('data', (chunk) => {
      if (over || aborted) return;
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        abortOversize();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      completed = true;
      if (aborted) return;
      const rawBytes = Buffer.concat(chunks);
      const headers = {};
      for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = v;
      const decision = classifyRequest(state, {
        method: req.method,
        path: req.url,
        host: headers.host,
        peer: req.socket && req.socket.remoteAddress,
        rawBytes,
        oversize: over,
        contentEncoding: headers['content-encoding'],
        headers,
      });
      if (!decision.ok) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'meri-wire: rejected' } }));
        if (typeof onAbort === 'function') onAbort(decision.error);
        return;
      }
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.end(planSseResponse(decision.index, decision.plan.toolUseId));
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.setTimeout(deadlineMs, () => {
    if (typeof onAbort === 'function') onAbort('server idle timeout');
  });
  const closeAll = async () => {
    for (const socket of sockets) {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
    }
    sockets.clear();
    await new Promise((resolve) => server.close(() => resolve()));
  };
  if (signal) {
    if (signal.aborted) {
      await closeAll();
      throw new Error('server startup aborted');
    }
    signal.addEventListener('abort', () => closeAll().catch(() => {}), { once: true });
  }
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, resolve);
  });
  const { port } = server.address();
  state.port = port;
  return { port, state, close: closeAll };
}

// ---------------------------------------------------------------------------
// Spawn hook (one spawn; argv hash + flag names only; bounded stderr drain)
// ---------------------------------------------------------------------------

const SAFE_FLAG_RE = /^--?[A-Za-z][A-Za-z0-9-]{0,40}$/;

/**
 * Export a flag NAME only: split at the first '=' (the pinned SDK argv builder
 * emits `--flag=value`), keep a strict short flag-name form, and hash anything
 * else. A secret smuggled into a value or an opaque name is never exported.
 */
export function sanitizeArgvFlag(arg) {
  const s = String(arg);
  const eq = s.indexOf('=');
  const name = eq >= 0 ? s.slice(0, eq) : s;
  if (SAFE_FLAG_RE.test(name) && name.length <= 42 && !looksLikeSecret(name)) return name;
  return `--hashed-${hashSha256(Buffer.from(s)).slice(0, 12)}`;
}

/** Build the public spawnClaudeCodeProcess hook. Refuses a second spawn. */
export function buildSpawnHook(counters, record, spawnImpl, onViolation) {
  return function spawnClaudeCodeProcess(spawnOptions) {
    if (counters.spawns >= 1) {
      record.violation = 'extra-spawn';
      if (typeof onViolation === 'function') onViolation('extra native spawn');
      throw new Error('extra native spawn refused');
    }
    counters.spawns += 1;
    const args = Array.isArray(spawnOptions.args) ? spawnOptions.args.map(String) : [];
    record.command = spawnOptions.command;
    record.argvCount = args.length;
    record.argvBytes = args.reduce((n, a) => n + Buffer.byteLength(a), 0);
    record.argvHash = hashSha256(Buffer.from(args.join('\u0000')));
    record.argvFlags = args.filter((a) => a.startsWith('-')).map(sanitizeArgvFlag);
    record.cwd = spawnOptions.cwd;
    record.envNames = Object.keys(spawnOptions.env || {}).sort();
    record.spawned = true;
    record.instanceId = randomUUID();
    record.startedAtMs = Date.now();
    const child = spawnImpl(spawnOptions, record, onViolation);
    record.child = child;
    record.pid = child?.pid;
    record.exitPromise = new Promise((resolve) => {
      if (child && typeof child.once === 'function') {
        child.once('exit', (code, sig) => {
          record.exited = true;
          record.exitCode = code;
          record.signalCode = sig;
          record.exitedAtMs = Date.now();
          resolve();
        });
      } else {
        resolve();
      }
    });
    return child;
  };
}

/**
 * Confirm ACTUAL child termination within a bounded grace AFTER kill/abort. A
 * kill request or an error event alone is NOT termination; uncertainty fails.
 */
export async function confirmChildCleanup(record, { graceMs = EXIT_GRACE_MS, now = Date.now } = {}) {
  const child = record && record.child;
  if (!child) return false;
  const terminated = () =>
    record.exited === true ||
    (child.exitCode !== null && child.exitCode !== undefined) ||
    (child.signalCode !== null && child.signalCode !== undefined) ||
    (record.signalCode !== null && record.signalCode !== undefined);
  if (terminated()) {
    record.cleanedUp = true;
    return true;
  }
  try {
    child.kill('SIGKILL');
    record.cleanupForced = true;
  } catch {
    /* ignore */
  }
  if (terminated()) {
    record.cleanedUp = true;
    return true;
  }
  if (record.exitPromise) {
    const res = await boundedWait(record.exitPromise, now() + graceMs, now);
    if (res.ok && terminated()) {
      record.cleanedUp = true;
      return true;
    }
  }
  return false;
}

/** Real spawner: SDK AbortSignal forwarded, stdio piped to SDK, bounded stderr.
 * Exposes an INTERNAL completion contract (`record.stdioDone`) that resolves
 * only after the child 'close' event confirms all child stdio has closed,
 * so the orchestrator can require actual drain before a PASS. */
export function realSpawner(spawnOptions, record, onViolation) {
  const child = nodeSpawn(spawnOptions.command, spawnOptions.args, {
    cwd: spawnOptions.cwd,
    env: spawnOptions.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    signal: spawnOptions.signal,
  });
  observeNativeStdout(child, record, onViolation);
  child.on('error', error => {
    // Node reports an intentional AbortSignal shutdown as AbortError. It still
    // requires an observed exit; it is distinct from a spawn/transport failure.
    if (error?.name === 'AbortError' && spawnOptions.signal?.aborted) record.controlledAbortError = true;
    else record.processError = true;
  });
  let total = 0;
  let hashed = 0;
  let preview = '';
  const hash = createHash('sha256');
  let resolveStdio;
  record.stdioDone = new Promise((res) => {
    resolveStdio = res;
  });
  const snapshot = () => {
    record.stderrTotalBytes = total;
    record.stderrHashedBytes = hashed;
    record.stderrTruncated = total > MAX_STDERR_BYTES;
    record.stderrSha256 = hash.copy().digest('hex');
    record.stderrPreview = boundedPreview(preview);
  };
  child.stderr.on('data', (b) => {
    total += b.length;
    if (hashed < MAX_STDERR_BYTES) {
      const take = Math.min(b.length, MAX_STDERR_BYTES - hashed);
      hash.update(b.subarray(0, take));
      hashed += take;
    }
    const room = STDERR_PREVIEW_CHARS * 2 - preview.length;
    if (room > 0) preview += b.toString('utf8', 0, Math.min(b.length, room));
    if (total > MAX_STDERR_BYTES && !record.stderrOverflow) {
      record.stderrOverflow = true;
      if (typeof onViolation === 'function') onViolation('stderr overflow');
    }
  });
  child.stderr.on('end', () => {
    record.stderrEnded = true;
  });
  child.stderr.on('close', () => { record.stderrClosed = true; });
  child.stderr.on('error', () => {
    record.stderrReadError = true;
    if (typeof onViolation === 'function') onViolation('stderr read failed');
  });
  if (child.on) child.on('close', () => {
    snapshot();
    resolveStdio();
  });
  return child;
}

// ---------------------------------------------------------------------------
// Synthetic input stream + gate
// ---------------------------------------------------------------------------

export function createGate() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export async function* syntheticPromptStream(promptText, gatePromise) {
  yield { type: 'user', message: { role: 'user', content: [{ type: 'text', text: promptText }] }, parent_tool_use_id: null };
  await gatePromise;
}

// ---------------------------------------------------------------------------
// Wire MCP server + tool
// ---------------------------------------------------------------------------

export function buildWireTool({ counters, sdkTool, z }) {
  return sdkTool(
    WIRE_TOOL_NAME,
    'Synthetic always-load echo tool for Meri wire capture.',
    { value: z.literal(WIRE_TOKEN) },
    (args) => runEchoHandler(counters, args),
    { alwaysLoad: true },
  );
}

export function buildWireServer({ counters, createSdkMcpServer, sdkTool, z }) {
  return {
    [WIRE_SERVER_NAME]: createSdkMcpServer({ name: WIRE_SERVER_NAME, version: '0.0.0', tools: [buildWireTool({ counters, sdkTool, z })], alwaysLoad: true, timeout: WIRE_TOOL_TIMEOUT_MS }),
  };
}

// ---------------------------------------------------------------------------
// Resolved settings validation (stop before construction on any defect)
// ---------------------------------------------------------------------------

/** Validate the exact public ResolvedSettings shape and reject managed tiers. */
export function validateResolvedSettings(resolved) {
  if (!resolved || typeof resolved !== 'object' || Array.isArray(resolved)) return { ok: false, reason: 'malformed' };
  if (typeof resolved.effective !== 'object' || resolved.effective === null || Array.isArray(resolved.effective)) return { ok: false, reason: 'malformed' };
  if (typeof resolved.provenance !== 'object' || resolved.provenance === null || Array.isArray(resolved.provenance)) return { ok: false, reason: 'malformed' };
  if (!Array.isArray(resolved.sources)) return { ok: false, reason: 'malformed' };
  for (const s of resolved.sources) {
    if (!s || typeof s !== 'object' || typeof s.source !== 'string' || typeof s.settings !== 'object' || s.settings === null || Array.isArray(s.settings)) {
      return { ok: false, reason: 'malformed' };
    }
    if (s.source === 'managed') return { ok: false, reason: 'managed' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Result validation (bounded typed shape only)
// ---------------------------------------------------------------------------

export function validateResultMessage(msg) {
  if (!msg || msg.type !== 'result') return { ok: false, error: 'no SDK result message' };
  if (msg.subtype !== 'success') return { ok: false, error: 'unexpected result subtype' };
  if (msg.is_error !== false) return { ok: false, error: 'result is_error !== false' };
  if (typeof msg.result !== 'string' || !msg.result.includes(WIRE_DONE_MARKER)) return { ok: false, error: 'result marker missing' };
  if (msg.stop_reason !== 'end_turn') return { ok: false, error: 'unexpected stop_reason' };
  if (typeof msg.session_id !== 'string' || !UUID_RE.test(msg.session_id)) return { ok: false, error: 'invalid session_id' };
  const numTurns = Number.isInteger(msg.num_turns) && msg.num_turns >= 0 && msg.num_turns <= 1_000_000 ? msg.num_turns : null;
  const resultBuf = Buffer.from(msg.result);
  const summary = {
    subtype: 'success',
    is_error: false,
    stop_reason: 'end_turn',
    num_turns: numTurns,
    session_id: msg.session_id,
    resultLength: resultBuf.length,
    resultSha256: hashSha256(resultBuf),
  };
  if (Buffer.byteLength(JSON.stringify(summary)) > MAX_RECORD_BYTES) return { ok: false, error: 'result summary exceeds record bound' };
  return { ok: true, summary };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

function emptyReport(reasons) {
  return { ok: false, reasons, counters: { permissionCallbacks: 0, handlerExecutions: 0, spawns: 0 }, requests: [], spawn: { spawned: false, cleanedUp: false }, result: null, captureId: null };
}

/**
 * Run one capture. Preflight and settings validation STOP before any
 * tool/server/query/spawn construction. The absolute deadline is fixed before
 * the first await and bounds every await (settings, startup, iteration, return,
 * close, exit). All cleanup outcomes affect the verdict.
 */
export async function runCapture({
  host,
  source = process.env,
  resolvedSettings,
  deadlineMs = CAPTURE_DEADLINE_MS,
  promptText = CAPTURE_USER_PROMPT,
  now = () => Date.now(),
  captureId = randomUUID(),
} = {}) {
  try {
    validateDeadline(deadlineMs);
  } catch {
    return emptyReport(['invalid deadline injection']);
  }
  const start = now();
  const deadlineAt = start + deadlineMs;
  const counters = { permissionCallbacks: 0, handlerExecutions: 0, spawns: 0 };
  const state = createCaptureState(0);
  const reasons = [];
  const spawnRecord = { spawned: false, cleanedUp: false, argvCount: 0, argvBytes: 0, argvHash: null, argvFlags: [], envNames: [] };
  let server;
  let gate;
  let abortController;
  let streamRef = null;
  let iteratorRef = null;
  let resultMessage = null;
  let constructed = false;

  const abortNow = (reason) => {
    if (!state.aborted) state.aborted = reason;
    if (abortController) {
      try {
        abortController.abort();
      } catch {
        /* ignore */
      }
    }
    if (gate) gate.resolve();
  };

  try {
    // 1. Pure parent-env preflight (no host call on failure).
    const envPre = preflightParentEnvironment({ source });
    if (!envPre.ok) {
      reasons.push(...envPre.reasons);
      return { ...emptyReport(reasons), captureId };
    }
    // 2. Settings resolution: any error/timeout/malformed/invalid STOPS here.
    let resolved = resolvedSettings;
    if (resolved === undefined) {
      if (!host || typeof host.resolveSettings !== 'function') {
        reasons.push('settings resolution unavailable');
        return { ...emptyReport(reasons), captureId };
      }
      const r = await boundedWait(host.resolveSettings({ settingSources: [] }), deadlineAt, now);
      if (!r.ok) {
        reasons.push(r.timedOut ? 'settings resolution timed out' : `settings resolution failed (${errorType(r.error)})`);
        return { ...emptyReport(reasons), captureId };
      }
      resolved = r.value;
    }
    const vres = validateResolvedSettings(resolved);
    if (!vres.ok) {
      reasons.push(vres.reason === 'managed' ? 'unexpected managed settings tier present' : 'malformed resolved settings');
      return { ...emptyReport(reasons), captureId };
    }

    // ---- Construction begins only after passing preflight + validation ----
    constructed = true;
    abortController = new AbortController();
    const deadlineTimer = setTimeout(() => abortNow('deadline'), Math.max(1, deadlineAt - now()));
    if (deadlineTimer.unref) deadlineTimer.unref();

    // 3. Workspace preparation (injected; bounded) before any spawn.
    if (host.prepareWorkspace) {
      const prep = await boundedWait(Promise.resolve().then(() => host.prepareWorkspace()), deadlineAt, now);
      if (!prep.ok) {
        reasons.push(prep.timedOut ? 'workspace preparation timed out' : `workspace preparation failed (${errorType(prep.error)})`);
        return { ...emptyReport(reasons), captureId };
      }
    }

    const spawnHook = buildSpawnHook(counters, spawnRecord, (spawnOptions, record) => host.spawn(spawnOptions, record, abortNow), abortNow);
    const mcpServers = host.createWireServer({ counters });
    const srv = await boundedWait(host.startServer({ state, deadlineMs, maxRequests: MAX_REQUESTS, onAbort: abortNow, signal: abortController.signal }), deadlineAt, now);
    if (!srv.ok) {
      reasons.push(srv.timedOut ? 'server startup timed out' : `server startup failed (${errorType(srv.error)})`);
      return { ...emptyReport(reasons), captureId };
    }
    server = srv.value;
    state.port = server.port;
    const env = buildCaptureEnv(server.port);
    const options = buildCaptureOptions({ abortController, env, mcpServers, canUseTool: createPermissionCallback(counters), spawnClaudeCodeProcess: spawnHook });

    gate = createGate();
    streamRef = host.query({ prompt: syntheticPromptStream(promptText, gate.promise), options });

    const it = streamRef[Symbol.asyncIterator]();
    iteratorRef = it;
    while (true) {
      const step = await boundedWait(it.next(), deadlineAt, now);
      if (!step.ok) {
        if (step.timedOut && !state.aborted) state.aborted = 'deadline';
        break;
      }
      const { value, done } = step.value;
      if (done) break;
      if (value && value.type === 'result') {
        resultMessage = value;
        break;
      }
      if (state.aborted) break;
    }
  } catch (error) {
    reasons.push(`capture threw (${errorType(error)})`);
  } finally {
    if (gate) gate.resolve();
    // Query cleanup via the public AsyncGenerator return(); its failure counts.
    const cleanupTarget = streamRef && typeof streamRef.return === 'function' ? streamRef : iteratorRef && typeof iteratorRef.return === 'function' ? iteratorRef : null;
    if (cleanupTarget) {
      const r = await boundedWait(Promise.resolve().then(() => cleanupTarget.return()), now() + CLOSE_GRACE_MS, now);
      if (!r.ok) reasons.push(r.timedOut ? 'query cleanup timed out' : `query cleanup failed (${errorType(r.error)})`);
    }
    if (abortController) {
      try {
        abortController.abort();
      } catch {
        /* ignore */
      }
    }
    if (server && typeof server.close === 'function') {
      const closed = await boundedWait(Promise.resolve().then(() => server.close()), now() + CLOSE_GRACE_MS, now);
      if (!closed.ok) reasons.push('server close did not complete within the grace window');
    }
    if (constructed) {
      // Require the child's stdio to be fully drained (EOF) before a PASS, and
      // take the final stderr accounting only after that drain.
      if (spawnRecord.stdioDone) {
        const sd = await boundedWait(spawnRecord.stdioDone, now() + CLOSE_GRACE_MS, now);
        if (!sd.ok) reasons.push('child stdio not drained (no EOF)');
      }
      if (!(await confirmChildCleanup(spawnRecord, { now }))) {
        reasons.push('child cleanup not confirmed (no exit/signal observed)');
      }
    }
  }

  if (state.count !== MAX_REQUESTS) reasons.push(`expected exactly ${MAX_REQUESTS} requests, observed ${state.count}`);
  if (state.aborted) reasons.push(`capture aborted: ${state.aborted}`);
  if (counters.permissionCallbacks !== 1) reasons.push(`expected 1 permission callback, observed ${counters.permissionCallbacks}`);
  if (counters.handlerExecutions !== 1) reasons.push(`expected 1 tool handler execution, observed ${counters.handlerExecutions}`);
  if (counters.spawns !== 1) reasons.push(`expected 1 native spawn, observed ${counters.spawns}`);
  if (!spawnRecord.envNames.includes('ANTHROPIC_BASE_URL')) reasons.push('spawn env lacks ANTHROPIC_BASE_URL');
  if (spawnRecord.stderrOverflow) reasons.push(`stderr exceeded ${MAX_STDERR_BYTES} bytes (truncated)`);
  if (spawnRecord.stderrReadError) reasons.push('stderr read failed');
  if (state.requests.some((r) => r.hashOnly)) reasons.push('sensitive material detected in captured body (hash-only, no raw export)');
  const resultCheck = validateResultMessage(resultMessage);
  if (!resultCheck.ok) reasons.push(`result: ${resultCheck.error}`);

  return {
    ok: reasons.length === 0,
    reasons,
    captureId,
    counters,
    requests: state.requests,
    spawn: {
      spawned: spawnRecord.spawned,
      cleanedUp: !!spawnRecord.cleanedUp,
      cleanupForced: !!spawnRecord.cleanupForced,
      argvCount: spawnRecord.argvCount,
      argvBytes: spawnRecord.argvBytes,
      argvHash: spawnRecord.argvHash,
      argvFlags: spawnRecord.argvFlags,
      envNames: spawnRecord.envNames,
      stderrTotalBytes: spawnRecord.stderrTotalBytes ?? 0,
      stderrHashedBytes: spawnRecord.stderrHashedBytes ?? 0,
      stderrTruncated: !!spawnRecord.stderrTruncated,
      stderrSha256: spawnRecord.stderrSha256 ?? null,
      stderrPreview: spawnRecord.stderrPreview ?? null,
    },
    result: resultCheck.summary || null,
  };
}

// ---------------------------------------------------------------------------
// Bounded indexed output records
// ---------------------------------------------------------------------------

/** Build bounded indexed output records (manifest + base64 chunks + end). */
export function buildOutputLines(report, { chunkBytes = OUT_CHUNK_BYTES } = {}) {
  const requests = report.requests.map((r) => {
    const hashOnly = r.hashOnly === true || hasSensitiveBody(r.decoded);
    return {
      index: r.index,
      path: r.path,
      rawLength: r.rawLength,
      rawSha256: r.rawSha256,
      decompressedLength: r.decompressedLength,
      decompressedSha256: r.decompressedSha256,
      headers: r.headers,
      hashOnly,
      base64: hashOnly ? null : r.base64,
    };
  });
  const totalBodyBytes = requests.reduce((n, r) => n + r.rawLength, 0);
  const manifest = {
    record: 'sdk-capture-manifest',
    captureId: report.captureId ?? null,
    generatedAt: new Date().toISOString(),
    ok: report.ok,
    reasons: report.reasons,
    counters: report.counters,
    spawn: report.spawn,
    result: report.result,
    requestCount: requests.length,
    totalBodyBytes,
    requestManifest: requests.map(({ base64, ...rest }) => rest),
  };
  const lines = [manifest];
  for (const r of requests) {
    if (!r.base64) continue;
    const total = Math.ceil(r.base64.length / chunkBytes);
    for (let seq = 0; seq < total; seq += 1) {
      lines.push({ record: 'sdk-capture-request-chunk', captureId: report.captureId ?? null, index: r.index, seq, total, base64: r.base64.slice(seq * chunkBytes, (seq + 1) * chunkBytes) });
    }
  }
  lines.push({ record: 'sdk-capture-end', captureId: report.captureId ?? null, ok: report.ok, requestCount: requests.length, totalBodyBytes });
  for (const line of lines) {
    if (Buffer.byteLength(JSON.stringify(line)) > MAX_RECORD_BYTES) {
      return [{ record: 'sdk-capture-manifest', captureId: report.captureId ?? null, ok: false, reasons: ['output record exceeded bound'], requestCount: requests.length }, { record: 'sdk-capture-end', captureId: report.captureId ?? null, ok: false }];
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Bounded stdout writing
// ---------------------------------------------------------------------------

// One guard per stream, held weakly: settled writes retain no subscribers or
// grace timers. The shared error observer lives until close, including after a
// successful callback. A real stdout failure must also fail the direct CLI.
const OUTPUT_GUARDS = new WeakMap();
function outputGuard(stdout) {
  if (OUTPUT_GUARDS.has(stdout)) return OUTPUT_GUARDS.get(stdout);
  const guard = { failed: stdout.errored ? errorType(stdout.errored) : null,
    closed: stdout.destroyed === true || stdout.closed === true, subscribers: new Set() };
  const onError = (error) => {
    guard.failed ||= errorType(error);
    if (stdout === process.stdout) process.exitCode = 1;
    for (const settle of [...guard.subscribers]) settle(false, guard.failed);
  };
  const onClose = () => {
    guard.closed = true;
    for (const settle of [...guard.subscribers]) settle(false, 'output-closed');
    stdout.off?.('error', onError);
    stdout.off?.('close', onClose);
  };
  OUTPUT_GUARDS.set(stdout, guard);
  if (typeof stdout.on === 'function') stdout.on('error', onError);
  else stdout.once?.('error', onError); // minimal injected writer fixtures
  stdout.once?.('close', onClose);
  if (guard.failed && stdout === process.stdout) process.exitCode = 1;
  return guard;
}

/** Write one chunk with one deadline timer and a shared stream error guard. */
export function writeOnce(text, stdout, atMs, now = Date.now) {
  return new Promise((resolve) => {
    const guard = outputGuard(stdout);
    if (guard.failed || guard.closed) return resolve({ ok: false, error: guard.failed || 'output-closed' });
    let done = false;
    const finish = (ok, error) => {
      if (done) return;
      done = true;
      if (!ok) guard.failed ||= error;
      clearTimeout(timer);
      guard.subscribers.delete(finish);
      resolve({ ok, error });
    };
    const timer = setTimeout(() => finish(false, 'write-timeout'), Math.max(1, atMs - now()));
    guard.subscribers.add(finish);
    try {
      stdout.write(text, (err) => {
        if (err) {
          guard.failed ||= errorType(err);
          if (stdout === process.stdout) process.exitCode = 1;
          return finish(false, guard.failed);
        }
        if (guard.failed || guard.closed) return finish(false, guard.failed || 'output-closed');
        if (now() > atMs) return finish(false, 'write-late');
        return finish(true);
      });
    } catch (e) {
      guard.failed ||= errorType(e);
      finish(false, guard.failed);
    }
  });
}

/**
 * Await-write all records against ONE fixed absolute deadline (never silently
 * extended per write). The deadline is checked before EACH write and after every
 * callback, and must be a finite absolute time; an expired/already-expired
 * deadline writes NOTHING and fails.
 */
export async function writeLines(lines, stdout, { deadlineAt, now = Date.now } = {}) {
  if (typeof deadlineAt !== 'number' || !Number.isFinite(deadlineAt)) return { ok: false, error: 'invalid-output-deadline' };
  for (const line of lines) {
    if (now() >= deadlineAt) return { ok: false, error: 'output-deadline-expired' };
    const chunk = `${JSON.stringify(line)}\n`;
    if (Buffer.byteLength(chunk) > MAX_RECORD_BYTES) return { ok: false, error: 'record-too-large' };
    const w = await writeOnce(chunk, stdout, deadlineAt, now);
    if (!w.ok) return w;
    const guard = outputGuard(stdout);
    if (guard.failed || guard.closed) return { ok: false, error: guard.failed || 'output-closed' };
    if (now() >= deadlineAt) return { ok: false, error: 'output-deadline-expired' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Workspace preparation (injected; no-follow ancestor checks)
// ---------------------------------------------------------------------------

/** Ensure the synthetic workspace dirs exist, are real dirs, empty, no symlinks. */
export function realPrepareWorkspace(dirs = [CAPTURE_CWD, CAPTURE_CONFIG_DIR, CAPTURE_HOME]) {
  for (const dir of dirs) {
    const abs = pathResolve(dir);
    const chain = [];
    let cur = abs;
    while (true) {
      chain.push(cur);
      const parent = pathDirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
    for (const p of chain.reverse()) {
      let st;
      try {
        st = lstatSync(p);
      } catch {
        continue; // a missing ancestor is created below
      }
      if (st.isSymbolicLink()) throw new Error('symlink ancestor');
      if (!st.isDirectory()) throw new Error('non-directory ancestor');
    }
    let exists;
    try {
      exists = lstatSync(abs);
    } catch {
      exists = null;
    }
    if (!exists) mkdirSync(abs, { recursive: true, mode: 0o700 });
    if (readdirSync(abs).length !== 0) throw new Error('workspace dir not empty');
  }
  return true;
}

// ---------------------------------------------------------------------------
// Live host (assembled only when the probe actually runs on Linux)
// ---------------------------------------------------------------------------

async function buildRealHost() {
  const sdk = await import('@anthropic-ai/claude-agent-sdk');
  const { z } = await import('zod');
  return {
    resolveSettings: (opts) => sdk.resolveSettings(opts),
    prepareWorkspace: () => realPrepareWorkspace(),
    createWireServer: ({ counters }) => buildWireServer({ counters, createSdkMcpServer: sdk.createSdkMcpServer, sdkTool: sdk.tool, z }),
    spawn: (spawnOptions, record, onViolation) => realSpawner(spawnOptions, record, onViolation),
    startServer: (cfg) => createLoopbackServer(cfg),
    query: ({ prompt, options }) => sdk.query({ prompt, options }),
  };
}

export async function main({ platform = process.platform, source = process.env, stdout = process.stdout } = {}) {
  // Absolute write deadline is a literal so main's extracted body has no hidden
  // module-scope dependency (it is also injected verbatim by the audit harness).
  const writeDeadline = () => Date.now() + 5000;
  if (platform !== 'linux') {
    await writeLines([{ record: 'sdk-capture-manifest', ok: false, skipped: true, reason: 'linux-only probe' }], stdout, { deadlineAt: writeDeadline() }).catch(() => {});
    return 2;
  }
  const host = await buildRealHost();
  const report = await runCapture({ host, source });
  const lines = buildOutputLines(report);
  const written = await writeLines(lines, stdout, { deadlineAt: writeDeadline() });
  // Final exit is derived from the EMITTED protocol + write outcome, never from
  // the in-memory report alone.
  const emittedFailure = !Array.isArray(lines) || lines.length === 0 || lines.some((l) => !l || l.ok === false);
  if (!written.ok) {
    // bounded failed-output path (no unbounded raw stdout write).
    await writeLines([{ record: 'sdk-capture-manifest', captureId: report.captureId, ok: false, reasons: ['output write failed'] }], stdout, { deadlineAt: writeDeadline() }).catch(() => {});
    return 1;
  }
  return emittedFailure ? 1 : report.ok ? 0 : 1;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main()
    .then((code) => {
      process.exitCode = code || process.exitCode || 0; // preserve late stdout failure; allow drain.
    })
    .catch(async (error) => {
      process.exitCode = 1;
      await writeLines([{ record: 'sdk-capture-manifest', ok: false, reasons: [`fatal (${errorType(error)})`] }], process.stdout, { deadlineAt: Date.now() + 5000 }).catch(() => {});
    });
}
