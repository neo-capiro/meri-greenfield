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
// (settings resolution, wire MCP server construction, native spawn, loopback
// server, and `query`) are supplied by the caller. The offline test injects
// fakes, so importing or testing this module starts NO server, NO native
// process and NO socket.

import http from 'node:http';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { spawn as nodeSpawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  LOOPBACK_HOST,
  ACCEPTED_PATHS,
  CAPTURE_MODEL,
  CAPTURE_DEADLINE_MS,
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

/** Bounded output/stdout constants. */
export const OUT_CHUNK_BYTES = 8192;
export const MAX_STDERR_BYTES = 65536;
export const STDERR_PREVIEW_CHARS = 512;
export const CLOSE_GRACE_MS = 2000;

// ---------------------------------------------------------------------------
// Pure helpers: hashing + secret scrubbing
// ---------------------------------------------------------------------------

/** sha256 hex of raw bytes. */
export function hashSha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

const SECRET_VALUE_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{6,}/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{10,}\b/g,
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g, // JWT-ish
  /Bearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi,
];

/** Redact secret-like substrings from arbitrary text (headers, stderr, errors). */
export function scrubSecrets(text) {
  let out = String(text ?? '');
  for (const re of SECRET_VALUE_PATTERNS) out = out.replace(re, '<redacted>');
  // key=value / "key": "value" pairs whose key names a credential.
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

/** Bound + scrub a preview, keeping head and tail so evidence stays useful. */
export function boundedPreview(text, limit = STDERR_PREVIEW_CHARS) {
  const scrubbed = scrubSecrets(text);
  if (scrubbed.length <= limit) return scrubbed;
  const head = Math.floor(limit / 2);
  return `${scrubbed.slice(0, head)}<…${scrubbed.length - limit} bytes…>${scrubbed.slice(-(limit - head))}`;
}

const SENSITIVE_HEADER_NAME = /authorization|cookie|api[-_]?key|auth|token|secret|credential|password|passwd|bearer/i;

/**
 * Sanitized header list: every NAME is retained (protocol/beta header names are
 * needed for later admission review); secret-like NAMES and secret-looking
 * VALUES are redacted and all values are length-bounded.
 */
export function sanitizeHeaders(headers = {}) {
  const norm = (v) => (Array.isArray(v) ? v.join(', ') : String(v));
  return Object.keys(headers)
    .sort()
    .map((name) => {
      const raw = norm(headers[name]);
      const redacted =
        SENSITIVE_HEADER_NAME.test(name) || looksLikeSecret(raw) ? '<redacted>' : scrubSecrets(raw);
      const value = redacted.length > 256 ? `${redacted.slice(0, 256)}<truncated>` : redacted;
      return { name, value };
    });
}

// ---------------------------------------------------------------------------
// Body decoding (raw-byte hash, explicit compressed bounds)
// ---------------------------------------------------------------------------

/**
 * Decode a received request body. The HASH is always taken over the RAW
 * received bytes; the decoded JSON is parsed separately, so a reserialized JSON
 * is never what is hashed. Compressed encodings are handled explicitly with an
 * independent decompressed bound; unknown encodings are rejected. Oversized
 * bodies are rejected explicitly (never reinterpreted as malformed JSON).
 */
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
    error: null,
  };
  if (oversize || buf.length > MAX_REQUEST_BYTES) {
    result.error = `oversize request body (${buf.length} > ${MAX_REQUEST_BYTES})`;
    return result;
  }
  let decoded = buf;
  try {
    if (!contentEncoding || contentEncoding === 'identity') {
      decoded = buf;
    } else if (contentEncoding === 'gzip' || contentEncoding === 'x-gzip') {
      decoded = zlib.gunzipSync(buf, { maxOutputLength: MAX_DECOMPRESSED_BYTES });
    } else if (contentEncoding === 'deflate') {
      decoded = zlib.inflateSync(buf, { maxOutputLength: MAX_DECOMPRESSED_BYTES });
    } else {
      result.error = `unsupported content-encoding: ${contentEncoding}`;
      return result;
    }
  } catch (error) {
    result.error = `decompression failed: ${String((error && error.message) || error).slice(0, 120)}`;
    return result;
  }
  if (decoded.length > MAX_DECOMPRESSED_BYTES) {
    result.error = `decompressed body exceeds bound (${decoded.length} > ${MAX_DECOMPRESSED_BYTES})`;
    return result;
  }
  result.decompressedLength = decoded.length;
  result.decompressedSha256 = hashSha256(decoded);
  try {
    result.json = JSON.parse(decoded.toString('utf8'));
  } catch (error) {
    result.error = `malformed JSON: ${String((error && error.message) || error).slice(0, 120)}`;
    return result;
  }
  result.ok = true;
  return result;
}

// ---------------------------------------------------------------------------
// Capture state + request classification (pure)
// ---------------------------------------------------------------------------

/** Deterministic synthetic tool_use id request 2 must echo back. */
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

/**
 * Strict validation of the exact two-request sequence against the emitted
 * tool-use id. Returns { ok, error }.
 */
export function validateToolRoundTrip(json, toolUseId) {
  if (!json || !Array.isArray(json.messages)) return { ok: false, error: 'no messages array' };
  const msgs = json.messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant'));
  const toolUses = [];
  const toolResults = [];
  let promptIndex = -1;
  let assistantIndex = -1;
  let resultIndex = -1;
  msgs.forEach((m, i) => {
    for (const b of blocksOf(m.content)) {
      if (!b) continue;
      if (b.type === 'text' && m.role === 'user' && String(b.text || '').includes(CAPTURE_USER_PROMPT) && promptIndex < 0) {
        promptIndex = i;
      } else if (b.type === 'text' && m.role === 'user' && !String(b.text || '').includes(CAPTURE_USER_PROMPT) && promptIndex < 0) {
        promptIndex = -2; // unrelated prompt seen
      }
      if (b.type === 'tool_use') {
        toolUses.push({ i, b });
        assistantIndex = i;
      }
      if (b.type === 'tool_result') {
        toolResults.push({ i, b });
        resultIndex = i;
      }
    }
  });
  if (toolUses.length !== 1) return { ok: false, error: `expected exactly 1 tool_use, saw ${toolUses.length}` };
  if (toolResults.length !== 1) return { ok: false, error: `expected exactly 1 tool_result, saw ${toolResults.length}` };
  const tu = toolUses[0].b;
  const tr = toolResults[0].b;
  if (promptIndex < 0) return { ok: false, error: promptIndex === -2 ? 'unrelated prompt present' : 'prompt missing' };
  if (!(promptIndex < assistantIndex && assistantIndex < resultIndex)) {
    return { ok: false, error: 'message role order must be prompt, assistant tool_use, user tool_result' };
  }
  if (tu.id !== toolUseId) return { ok: false, error: `foreign tool_use id ${tu.id}` };
  if (tu.name !== WIRE_TOOL_FULLNAME) return { ok: false, error: `foreign tool name ${tu.name}` };
  const keys = tu.input && typeof tu.input === 'object' ? Object.keys(tu.input) : [];
  if (keys.length !== 1 || tu.input.value !== WIRE_TOKEN) {
    return { ok: false, error: 'tool_use input must be exactly {value:token}' };
  }
  if (tr.tool_use_id !== toolUseId) return { ok: false, error: `tool_result id ${tr.tool_use_id} does not match emitted id` };
  if (tr.is_error === true) return { ok: false, error: 'tool_result is_error:true' };
  if (textOfBlock(tr) !== WIRE_TOOL_RESULT) return { ok: false, error: 'tool_result content mismatch' };
  return { ok: true };
}

function advertisedToolSetOk(json) {
  if (!json || json.tools === undefined || json.tools === null) return true;
  if (!Array.isArray(json.tools)) return false;
  return json.tools.every((t) => t && t.name === WIRE_TOOL_FULLNAME);
}

/**
 * Validate one received request against the capture contract and mutate state.
 * Any violation aborts the capture immediately. Returns
 * { ok, action: 'respond'|'abort', index?, plan?, error? }.
 */
export function classifyRequest(state, req = {}) {
  const abort = (error) => {
    state.aborted = `request ${state.count + 1}: ${error}`;
    return { ok: false, action: 'abort', error: state.aborted };
  };
  if (state.aborted) return { ok: false, action: 'abort', error: state.aborted };
  if (req.method !== 'POST') return abort(`method ${req.method}`);
  if (!ACCEPTED_PATHS.includes(req.path)) return abort(`path ${req.path}`);
  // Exact loopback peer + exact bound Host:port.
  const peer = String(req.peer || '');
  if (peer !== LOOPBACK_HOST && peer !== `::ffff:${LOOPBACK_HOST}`) return abort(`non-loopback peer ${peer}`);
  if (String(req.host || '') !== `${LOOPBACK_HOST}:${state.port}`) return abort(`host ${req.host} (expected ${LOOPBACK_HOST}:${state.port})`);
  const decoded = decodeRequestBody({ rawBytes: req.rawBytes, contentEncoding: req.contentEncoding, oversize: req.oversize });
  if (!decoded.ok) return abort(decoded.error);
  const json = decoded.json;
  if (json && json.model !== CAPTURE_MODEL) return abort(`model ${json && json.model}`);
  if (json && json.stream !== true) return abort('stream !== true');
  if (!advertisedToolSetOk(json)) return abort('request advertises a tool outside the wire echo tool set');
  const index = state.count + 1;
  if (index > MAX_REQUESTS) return abort('duplicate/extra request beyond exactly 2');
  if (index === 1) {
    if (!json.messages || !json.messages.some((m) => m && m.role === 'user' && blocksOf(m.content).some((b) => b.type === 'text'))) {
      return abort('first request lacks a user prompt');
    }
  } else {
    const check = validateToolRoundTrip(json, state.toolUseId);
    if (!check.ok) return abort(check.error);
  }
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
    base64: req.rawBytes && decoded.ok ? Buffer.from(req.rawBytes).toString('base64') : null,
    decoded: json,
    headers: sanitizeHeaders(req.headers),
  });
  if (index === MAX_REQUESTS) state.ready = true;
  return { ok: true, action: 'respond', index, plan: { index, toolUseId: state.toolUseId } };
}

// ---------------------------------------------------------------------------
// SSE response shapes (current locked BETA Messages declarations)
// ---------------------------------------------------------------------------
//
// Field sets below are taken from the INSTALLED @anthropic-ai/sdk 0.133.0
// BETA Messages declarations (resources/beta/messages/messages.d.ts) that the
// Agent SDK uses: BetaMessage, BetaUsage, BetaMessageDeltaUsage,
// BetaTextBlock, BetaToolUseBlock, BetaRawMessageStart/Delta/StopEvent and
// BetaRawContentBlockStart/Delta/StopEvent. Nullable Message/container/
// diagnostics/stop_details/context_management fields and the full Usage/
// cache_creation/inference_geo/output_tokens_details/server_tool_use/
// service_tier/speed/iterations/fallback_credit fields are all present.

function sseEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Complete BetaUsage (message_start). */
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

/** Request 1 response: one assistant tool_use echo block with direct caller. */
export function buildToolUseSse(toolUseId = WIRE_TOOL_USE_ID) {
  return (
    sseEvent('message_start', completeMessageStart({ usage: completeUsage({ inputTokens: 16, outputTokens: 1 }) })) +
    sseEvent('content_block_start', {
      type: 'content_block_start',
      index: 0,
      content_block: {
        type: 'tool_use',
        id: toolUseId,
        name: WIRE_TOOL_FULLNAME,
        input: {},
        caller: { type: 'direct' },
        toolset_name: null,
      },
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
      usage: {
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        fallback_credit: null,
        input_tokens: 16,
        iterations: null,
        output_tokens: 18,
        output_tokens_details: null,
        server_tool_use: null,
      },
    }) +
    sseEvent('message_stop', { type: 'message_stop' })
  );
}

/** Request 2 response: final assistant text (citations null) + end_turn. */
export function buildFinalSse() {
  return (
    sseEvent('message_start', completeMessageStart({ usage: completeUsage({ inputTokens: 24, outputTokens: 1 }) })) +
    sseEvent('content_block_start', {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '', citations: null },
    }) +
    sseEvent('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: WIRE_DONE_MARKER },
    }) +
    sseEvent('content_block_stop', { type: 'content_block_stop', index: 0 }) +
    sseEvent('message_delta', {
      type: 'message_delta',
      context_management: null,
      delta: { container: null, stop_details: null, stop_reason: 'end_turn', stop_sequence: null },
      usage: {
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        fallback_credit: null,
        input_tokens: 24,
        iterations: null,
        output_tokens: 9,
        output_tokens_details: null,
        server_tool_use: null,
      },
    }) +
    sseEvent('message_stop', { type: 'message_stop' })
  );
}

/** Choose the response body for a validated request index. */
export function planSseResponse(index, toolUseId = WIRE_TOOL_USE_ID) {
  return index === 1 ? buildToolUseSse(toolUseId) : buildFinalSse();
}

// ---------------------------------------------------------------------------
// Loopback capture server (REAL http; only the opt-in probe builds it)
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

/**
 * Bind a bounded capture server on LOOPBACK_HOST only. It validates peer and
 * exact Host:port, accepts only the two bounded POST paths, captures the
 * received bytes BEFORE decoding, tracks owned sockets, aborts immediately on
 * any violation (including oversized or incomplete requests), and bounds its
 * own close.
 */
export async function createLoopbackServer({
  state,
  deadlineMs = CAPTURE_DEADLINE_MS,
  maxRequests = MAX_REQUESTS,
  onAbort,
  host = LOOPBACK_HOST,
} = {}) {
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    let aborted = false;
    let completed = false;
    req.on('aborted', () => {
      aborted = true;
      if (typeof onAbort === 'function') onAbort('incomplete request (client aborted)');
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
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        over = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      completed = true;
      if (aborted) return;
      const rawBytes = over ? Buffer.alloc(0) : Buffer.concat(chunks);
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
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      });
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
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, resolve);
  });
  const { port } = server.address();
  state.port = port;
  return {
    port,
    state,
    close: async () => {
      for (const socket of sockets) {
        try {
          socket.destroy();
        } catch {
          /* ignore */
        }
      }
      sockets.clear();
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

// ---------------------------------------------------------------------------
// Spawn hook (one spawn; argv + env NAMES only; bounded stderr drain)
// ---------------------------------------------------------------------------

/** Build the public spawnClaudeCodeProcess hook (no undocumented hooks used). */
export function buildSpawnHook(counters, record, spawnImpl) {
  return function spawnClaudeCodeProcess(spawnOptions) {
    counters.spawns += 1;
    const args = Array.isArray(spawnOptions.args) ? spawnOptions.args.slice(0, 40) : [];
    record.command = spawnOptions.command;
    record.argvCount = args.length;
    record.args = args.map((a) => (String(a).length > 160 ? `${String(a).slice(0, 160)}<truncated>` : String(a)));
    record.cwd = spawnOptions.cwd;
    record.envNames = Object.keys(spawnOptions.env || {}).sort();
    record.spawned = true;
    const child = spawnImpl(spawnOptions, record);
    record.child = child;
    const markExit = (code, signal) => {
      record.exited = true;
      record.exitCode = code;
      record.signalCode = signal;
    };
    if (child && typeof child.once === 'function') {
      child.once('exit', markExit);
    }
    return child;
  };
}

/**
 * Confirm ACTUAL child termination: an exit event, or a non-null exitCode, or a
 * non-null signalCode. A kill REQUEST alone (child.killed) is NOT termination;
 * an 'error' event alone is NOT termination. Uncertain -> false.
 */
export function confirmChildCleanup(record) {
  const child = record && record.child;
  if (!child) return false;
  const terminated = () =>
    record.exited === true ||
    child.exitCode !== null && child.exitCode !== undefined ||
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
  return false;
}

/** Real spawner: SDK AbortSignal forwarded, stdio piped for the SDK, stderr drained. */
export function realSpawner(spawnOptions, record) {
  const child = nodeSpawn(spawnOptions.command, spawnOptions.args, {
    cwd: spawnOptions.cwd,
    env: spawnOptions.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    signal: spawnOptions.signal,
  });
  let stderrBytes = 0;
  const hash = createHash('sha256');
  let preview = '';
  child.stderr.on('data', (b) => {
    stderrBytes += b.length;
    hash.update(b);
    if (preview.length < STDERR_PREVIEW_CHARS * 2) preview += b.toString('utf8');
  });
  child.stderr.on('end', () => {
    record.stderrBytes = stderrBytes;
    record.stderrSha256 = hash.digest('hex');
    record.stderrPreview = boundedPreview(preview);
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

/** One synthetic SDKUserMessage, then held open until the gate resolves. */
export async function* syntheticPromptStream(promptText, gatePromise) {
  yield {
    type: 'user',
    message: { role: 'user', content: [{ type: 'text', text: promptText }] },
    parent_tool_use_id: null,
  };
  await gatePromise;
}

// ---------------------------------------------------------------------------
// Wire MCP server + tool (SDK primitives injected so tests stay offline)
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
    [WIRE_SERVER_NAME]: createSdkMcpServer({
      name: WIRE_SERVER_NAME,
      version: '0.0.0',
      tools: [buildWireTool({ counters, sdkTool, z })],
      alwaysLoad: true,
      timeout: WIRE_TOOL_TIMEOUT_MS,
    }),
  };
}

// ---------------------------------------------------------------------------
// Result validation
// ---------------------------------------------------------------------------

/** Require subtype success, is_error false, the marker and end_turn. */
export function validateResultMessage(msg) {
  if (!msg || msg.type !== 'result') return { ok: false, error: 'no SDK result message' };
  if (msg.subtype !== 'success') return { ok: false, error: `result subtype ${msg.subtype}` };
  if (msg.is_error !== false) return { ok: false, error: 'result is_error !== false' };
  if (typeof msg.result !== 'string' || !msg.result.includes(WIRE_DONE_MARKER)) {
    return { ok: false, error: 'result marker missing' };
  }
  if (msg.stop_reason !== 'end_turn') return { ok: false, error: `stop_reason ${msg.stop_reason}` };
  return {
    ok: true,
    summary: { subtype: msg.subtype, is_error: msg.is_error, stop_reason: msg.stop_reason, num_turns: msg.num_turns, session_id: msg.session_id },
  };
}

// ---------------------------------------------------------------------------
// Orchestrator (host side effects injected)
// ---------------------------------------------------------------------------

function emptyReport(reasons) {
  return {
    ok: false,
    reasons,
    counters: { permissionCallbacks: 0, handlerExecutions: 0, spawns: 0 },
    requests: [],
    spawn: { spawned: false, cleanedUp: false },
    result: null,
  };
}

/**
 * Run one capture. `host` supplies: resolveSettings, createWireServer, spawn,
 * startServer, query. The offline test injects fakes for all of them.
 *
 * The ABSOLUTE deadline is fixed before the first await. A failed preflight
 * returns BEFORE any tool/server/query/spawn construction. Every await that can
 * hang (settings resolution, stream iteration, server close) is bounded.
 */
export async function runCapture({
  host,
  source = process.env,
  resolvedSettings,
  deadlineMs = CAPTURE_DEADLINE_MS,
  promptText = CAPTURE_USER_PROMPT,
  now = () => Date.now(),
} = {}) {
  const start = now();
  const deadlineAt = start + deadlineMs;
  const counters = { permissionCallbacks: 0, handlerExecutions: 0, spawns: 0 };
  const state = createCaptureState(0);
  const reasons = [];
  const spawnRecord = { spawned: false, cleanedUp: false, argvCount: 0, args: [], envNames: [] };
  let server;
  let gate;
  let abortController;
  let deadlineTimer;
  let streamRef = null;
  let resultMessage = null;
  let preflightPassed = false;

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
    // ---- Preflight FIRST, before ANY host construction ----
    // 1. Pure environment scan: no host call at all on failure.
    const envPre = preflightParentEnvironment({ source });
    if (!envPre.ok) {
      reasons.push(...envPre.reasons);
      return emptyReport(reasons);
    }
    // 2. Managed-tier check (needs settings resolution; still before
    //    tool/server/query/spawn construction). Bounded by the deadline.
    let resolved = resolvedSettings;
    if (resolved === undefined && host && typeof host.resolveSettings === 'function') {
      const r = await boundedWait(host.resolveSettings({ settingSources: [] }), deadlineAt, now);
      if (r.ok) resolved = r.value;
      else if (r.timedOut) reasons.push('settings resolution timed out');
      else reasons.push(`settings resolution failed: ${scrubSecrets(String((r.error && r.error.message) || r.error)).slice(0, 160)}`);
    }
    const managedPre = preflightParentEnvironment({ source: {}, resolved });
    if (!managedPre.ok) {
      reasons.push(...managedPre.reasons);
      return emptyReport(reasons);
    }
    preflightPassed = true;

    // ---- Construction begins only after a passing preflight ----
    abortController = new AbortController();
    const spawnHook = buildSpawnHook(counters, spawnRecord, host.spawn);
    const mcpServers = host.createWireServer({ counters });
    server = await host.startServer({ state, deadlineMs, maxRequests: MAX_REQUESTS, onAbort: abortNow });
    state.port = server.port;
    const env = buildCaptureEnv(server.port);
    const options = buildCaptureOptions({
      abortController,
      env,
      mcpServers,
      canUseTool: createPermissionCallback(counters),
      spawnClaudeCodeProcess: spawnHook,
    });
    deadlineTimer = setTimeout(() => abortNow('deadline'), Math.max(1, deadlineAt - now()));
    if (deadlineTimer.unref) deadlineTimer.unref();

    gate = createGate();
    const prompt = syntheticPromptStream(promptText, gate.promise);
    streamRef = host.query({ prompt, options });

    const it = streamRef[Symbol.asyncIterator]();
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
    reasons.push(`capture threw: ${scrubSecrets(String((error && error.message) || error)).slice(0, 200)}`);
  } finally {
    if (gate) gate.resolve();
    if (streamRef && typeof streamRef.return === 'function') {
      try {
        await boundedWait(streamRef.return(), now() + CLOSE_GRACE_MS, now);
      } catch {
        /* ignore */
      }
    }
    if (abortController) {
      try {
        abortController.abort();
      } catch {
        /* ignore */
      }
    }
    if (deadlineTimer) clearTimeout(deadlineTimer);
    if (server && typeof server.close === 'function') {
      const closed = await boundedWait(server.close(), now() + CLOSE_GRACE_MS, now);
      if (!closed.ok) reasons.push('server close did not complete within the grace window');
    }
    if (preflightPassed && !confirmChildCleanup(spawnRecord)) {
      reasons.push('child cleanup not confirmed (no exit/signal observed)');
    }
  }

  if (state.count !== MAX_REQUESTS) reasons.push(`expected exactly ${MAX_REQUESTS} requests, observed ${state.count}`);
  if (state.aborted) reasons.push(`capture aborted: ${state.aborted}`);
  if (counters.permissionCallbacks !== 1) reasons.push(`expected 1 permission callback, observed ${counters.permissionCallbacks}`);
  if (counters.handlerExecutions !== 1) reasons.push(`expected 1 tool handler execution, observed ${counters.handlerExecutions}`);
  if (counters.spawns !== 1) reasons.push(`expected 1 native spawn, observed ${counters.spawns}`);
  if (!spawnRecord.envNames.includes('ANTHROPIC_BASE_URL')) reasons.push('spawn env lacks ANTHROPIC_BASE_URL');
  const resultCheck = validateResultMessage(resultMessage);
  if (!resultCheck.ok) reasons.push(`result: ${resultCheck.error}`);

  return {
    ok: reasons.length === 0,
    reasons,
    counters,
    requests: state.requests,
    spawn: {
      spawned: spawnRecord.spawned,
      cleanedUp: !!spawnRecord.cleanedUp,
      cleanupForced: !!spawnRecord.cleanupForced,
      argvCount: spawnRecord.argvCount,
      args: spawnRecord.args,
      envNames: spawnRecord.envNames,
      stderrBytes: spawnRecord.stderrBytes ?? 0,
      stderrSha256: spawnRecord.stderrSha256 ?? null,
      stderrPreview: spawnRecord.stderrPreview ?? null,
    },
    result: resultCheck.summary || null,
  };
}

// ---------------------------------------------------------------------------
// Bounded indexed output records (base64 chunks + length/hash manifest)
// ---------------------------------------------------------------------------

/**
 * Build bounded indexed output records. Body bytes are exported as base64
 * chunks UNLESS the raw body looks like it contains secret material, in which
 * case only the length/hash manifest is exported (hash-only fail).
 */
export function buildOutputLines(report, { chunkBytes = OUT_CHUNK_BYTES } = {}) {
  const requests = report.requests.map((r) => {
    const rawText = r.decoded ? JSON.stringify(r.decoded) : '';
    const hashOnly = looksLikeSecret(rawText) || looksLikeSecret(Buffer.from(r.base64 || '', 'base64').toString('utf8'));
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
  const lines = [
    {
      record: 'sdk-capture-manifest',
      generatedAt: new Date().toISOString(),
      ok: report.ok,
      reasons: report.reasons,
      counters: report.counters,
      spawn: report.spawn,
      result: report.result,
      requestManifest: requests.map(({ base64, ...rest }) => rest),
    },
  ];
  for (const r of requests) {
    if (!r.base64) continue;
    const total = Math.ceil(r.base64.length / chunkBytes);
    for (let seq = 0; seq < total; seq += 1) {
      lines.push({
        record: 'sdk-capture-request-chunk',
        index: r.index,
        seq,
        total,
        base64: r.base64.slice(seq * chunkBytes, (seq + 1) * chunkBytes),
      });
    }
  }
  lines.push({ record: 'sdk-capture-end', ok: report.ok });
  return lines;
}

// ---------------------------------------------------------------------------
// Live host (assembled only when the probe actually runs on Linux)
// ---------------------------------------------------------------------------

async function buildRealHost() {
  const sdk = await import('@anthropic-ai/claude-agent-sdk');
  const { z } = await import('zod');
  return {
    resolveSettings: (opts) => sdk.resolveSettings(opts),
    createWireServer: ({ counters }) =>
      buildWireServer({ counters, createSdkMcpServer: sdk.createSdkMcpServer, sdkTool: sdk.tool, z }),
    spawn: (spawnOptions, record) => realSpawner(spawnOptions, record),
    startServer: (cfg) => createLoopbackServer(cfg),
    query: ({ prompt, options }) => sdk.query({ prompt, options }),
  };
}

/** Awaited, backpressure-aware line writer. */
async function writeLines(lines, stdout) {
  for (const line of lines) {
    const chunk = `${JSON.stringify(line)}\n`;
    if (!stdout.write(chunk)) {
      await new Promise((resolve) => stdout.once('drain', resolve));
    }
  }
}

export async function main({
  platform = process.platform,
  source = process.env,
  stdout = process.stdout,
} = {}) {
  if (platform !== 'linux') {
    await writeLines([{ record: 'sdk-capture-manifest', ok: false, skipped: true, reason: 'linux-only probe' }], stdout);
    return 2;
  }
  const host = await buildRealHost();
  const report = await runCapture({ host, source });
  await writeLines(buildOutputLines(report), stdout);
  return report.ok ? 0 : 1;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main()
    .then((code) => {
      process.exitCode = code; // never process.exit(): stdout must drain.
    })
    .catch((error) => {
      process.exitCode = 1;
      try {
        process.stdout.write(`${JSON.stringify({ record: 'sdk-capture-manifest', ok: false, error: scrubSecrets(String((error && error.message) || error)).slice(0, 200) })}\n`);
      } catch {
        /* ignore */
      }
    });
}
