// One synthetic Messages transport per phase; no SDK/orchestration/authority owner.
import http from 'node:http';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { scanJsonKeys } from '../../../../scripts/sdk-capture/json-records.mjs';
import { decodeRequestBody, hashSha256, sanitizeHeaders, hasSensitiveBody,
  completeMessageStart, completeUsage, boundedWait, CLOSE_GRACE_MS } from './sdk-capture.mjs';
import { LOOPBACK_HOST, ACCEPTED_PATHS, CAPTURE_MODEL, MAX_REQUEST_BYTES,
  MAX_DECOMPRESSED_BYTES } from './sdk-capture-options.mjs';
import { ACTIVE_MARKER, CONTINUITY_MARKER, validateScenario, phaseContext } from './sdk-interruption-options.mjs';

const fail = code => { throw new Error(code); };
const phasePrompt = (s, phase) => phase === 'interrupt'
  ? `Remember synthetic continuity ${s.runUuid}. Emit ${ACTIVE_MARKER} then remain active.`
  : `Continue the previous synthetic conversation. Emit ${CONTINUITY_MARKER} and repeat its continuity value.`;
function textBlocks(content) {
  if (typeof content === 'string') return [content];
  if (!Array.isArray(content) || content.length > 64) fail('HISTORY_CONTENT');
  return content.map(b => {
    if (!b || b.type !== 'text' || typeof b.text !== 'string') fail('HISTORY_BLOCK');
    return b.text;
  });
}

/** No response can be planned until exact native request history is inspected. */
export function inspectInterruptionRequest({ scenario, phase, port, method, path, peer,
  headers, rawBytes, contentEncoding }) {
  scenario = validateScenario(scenario); phaseContext(scenario, phase);
  if (method !== 'POST' || !ACCEPTED_PATHS.includes(path) ||
      ![LOOPBACK_HOST, `::ffff:${LOOPBACK_HOST}`].includes(peer) ||
      headers.host !== `${LOOPBACK_HOST}:${port}` || headers['content-type'] !== 'application/json') fail('REQUEST_TARGET');
  if (!Buffer.isBuffer(rawBytes)) fail('REQUEST_BODY');
  const decoded = decodeRequestBody({ rawBytes, contentEncoding });
  if (!decoded.ok) fail('REQUEST_BODY');
  // Reuse the canonical strict member scanner on bounded decompressed UTF-8;
  // the decoder's public API supplies JSON/hashes, not its temporary text.
  let textBytes = rawBytes;
  if (contentEncoding === 'gzip' || contentEncoding === 'x-gzip') textBytes = zlib.gunzipSync(rawBytes, { maxOutputLength: MAX_DECOMPRESSED_BYTES });
  if (contentEncoding === 'deflate') textBytes = zlib.inflateSync(rawBytes, { maxOutputLength: MAX_DECOMPRESSED_BYTES });
  scanJsonKeys(new TextDecoder('utf-8', { fatal: true }).decode(textBytes));
  const body = decoded.json;
  if (!body || body.model !== CAPTURE_MODEL || body.stream !== true ||
      !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 256 ||
      (body.tools !== undefined && (!Array.isArray(body.tools) || body.tools.length !== 0)) ||
      hasSensitiveBody(body)) fail('REQUEST_PROFILE');
  const users = [];
  body.messages.forEach((m, index) => {
    if (!m || !['user', 'assistant'].includes(m.role)) fail('HISTORY_ROLE');
    const texts = textBlocks(m.content);
    if (m.role === 'user') for (const text of texts) users.push({ index, text });
  });
  const prior = phasePrompt(scenario, 'interrupt'), current = phasePrompt(scenario, phase);
  if (phase === 'interrupt') {
    if (body.messages.length !== 1 || users.length !== 1 || users[0].text !== current) fail('INITIAL_PROMPT');
  } else {
    if (users.length !== 2 || users[0].text !== prior || users[1].text !== current ||
        users[0].index >= users[1].index || users[1].index !== body.messages.length - 1) fail('RESUMED_HISTORY');
  }
  return { historyVerified: phase === 'resume', rawLength: decoded.rawLength,
    rawSha256: decoded.rawSha256, decompressedLength: decoded.decompressedLength,
    decompressedSha256: decoded.decompressedSha256 };
}

const event = (type, data) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
function responseWire(s, phase) {
  const prefix = event('message_start', completeMessageStart({ usage: completeUsage() })) +
    event('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: null } }) +
    event('content_block_delta', { type: 'content_block_delta', index: 0,
      delta: { type: 'text_delta', text: phase === 'interrupt' ? ACTIVE_MARKER : CONTINUITY_MARKER } });
  if (phase === 'interrupt') return prefix; // Deliberately active; no stop/end.
  return prefix + event('content_block_delta', { type: 'content_block_delta', index: 0,
    delta: { type: 'text_delta', text: ` ${s.runUuid}` } }) +
    event('content_block_stop', { type: 'content_block_stop', index: 0 }) +
    event('message_delta', { type: 'message_delta', context_management: null,
      delta: { container: null, stop_details: null, stop_reason: 'end_turn', stop_sequence: null },
      usage: completeUsage({ outputTokens: 16 }) }) + event('message_stop', { type: 'message_stop' });
}

/** Real HTTP by default; offline tests inject only the node:http boundary. */
export async function createInterruptionLoopback({ scenario: input, phase, httpModule = http, signal } = {}) {
  const scenario = validateScenario(input); phaseContext(scenario, phase);
  if (!httpModule || typeof httpModule.createServer !== 'function' || signal?.aborted) fail('SERVER_CONFIGURATION');
  const state = { phase, runUuid: scenario.runUuid, requestCount: 0, connectionCount: 0, failure: null,
    requestAborted: false, requestEnded: false, responseClosed: false,
    responseClosedBeforeOwnerClose: false, responseFinished: false, socketClosed: false,
    socketClosedBeforeOwnerClose: false, historyVerified: false,
    serverClosed: false, socketsDrained: false, forcedSocketCloses: 0, request: null, response: null };
  const sockets = new Set(); let closePromise, timer, port, closing = false;
  const abort = code => { state.failure ||= code; void close().catch(() => {}); };
  const server = httpModule.createServer((req, res) => {
    if (++state.requestCount !== 1 || closing || Date.now() >= scenario.phaseDeadlineMs) {
      req.destroy(); res.destroy(); abort('REQUEST_COUNT_OR_DEADLINE'); return;
    }
    const chunks = []; let bytes = 0, ended = false;
    const recordRequest = complete => {
      const raw = Buffer.concat(chunks);
      state.request = { receivedBytes: bytes, rawLength: raw.length, rawSha256: hashSha256(raw), complete };
      return raw;
    };
    req.on('aborted', () => { state.requestAborted = true; if (!ended) { recordRequest(false); abort('REQUEST_ABORTED'); } });
    req.on('error', () => abort('REQUEST_ERROR'));
    res.on('error', () => abort('RESPONSE_ERROR'));
    res.on('finish', () => { state.responseFinished = true; });
    res.on('close', () => { state.responseClosed = true; if (!closing) state.responseClosedBeforeOwnerClose = true; });
    req.on('data', chunk => {
      if (ended || closing) return;
      if (!Buffer.isBuffer(chunk)) { abort('BODY_CHUNK'); return; }
      bytes += chunk.length;
      if (bytes > MAX_REQUEST_BYTES) { recordRequest(false); req.destroy(); res.destroy(); abort('BODY_BOUND'); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      ended = true; state.requestEnded = true;
      if (closing) return;
      const raw = recordRequest(true);
      try {
        if (Date.now() >= scenario.phaseDeadlineMs) fail('REQUEST_DEADLINE');
        if (!Array.isArray(req.rawHeaders) || req.rawHeaders.length > 128 ||
            req.rawHeaders.length % 2 || Buffer.byteLength(JSON.stringify(req.rawHeaders)) > 8192) fail('HEADER_BOUND');
        const names = new Set();
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
          if (typeof req.rawHeaders[i] !== 'string' || typeof req.rawHeaders[i + 1] !== 'string') fail('HEADER_SHAPE');
          const name = req.rawHeaders[i].toLowerCase();
          if (names.has(name)) fail('DUPLICATE_HEADER'); names.add(name);
        }
        const proof = inspectInterruptionRequest({ scenario, phase, port, method: req.method, path: req.url,
          peer: req.socket?.remoteAddress, headers: req.headers, rawBytes: raw, contentEncoding: req.headers['content-encoding'] });
        state.historyVerified = proof.historyVerified;
        state.request = { ...state.request, ...proof, headers: sanitizeHeaders(req.headers), rawBase64: raw.toString('base64') };
        const wire = Buffer.from(responseWire(scenario, phase));
        if (wire.length > 8192 || Date.now() >= scenario.phaseDeadlineMs) fail('RESPONSE_BOUND_OR_DEADLINE');
        state.response = { rawLength: wire.length, rawSha256: hashSha256(wire), rawBase64: wire.toString('base64'), terminalEmitted: phase === 'resume' };
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
        res.flushHeaders?.();
        // One finite write; no accumulating application queue while PhaseA is active.
        if (phase === 'interrupt') res.write(wire); else res.end(wire);
      } catch { req.destroy(); res.destroy(); abort('REQUEST_REFUSED'); }
    });
  });
  server.maxHeadersCount = 64;
  server.on('error', () => abort('SERVER_ERROR'));
  server.on('connection', socket => {
    if (++state.connectionCount !== 1 || closing) { socket.destroy(); abort('SOCKET_COUNT'); return; }
    sockets.add(socket);
    socket.on('error', () => abort('SOCKET_ERROR'));
    socket.on('close', () => { sockets.delete(socket); state.socketClosed = true; if (!closing) state.socketClosedBeforeOwnerClose = true; });
  });
  async function close() {
    if (closePromise) return closePromise;
    closing = true; clearTimeout(timer); signal?.removeEventListener('abort', onSignal);
    const at = Math.min(scenario.cleanupDeadlineMs, Date.now() + CLOSE_GRACE_MS);
    closePromise = (async () => {
      for (const socket of sockets) if (!socket.destroyed) { state.forcedSocketCloses++; socket.destroy(); }
      const observed = await boundedWait(new Promise(resolve => server.close(error => resolve(!error))), at);
      state.serverClosed = observed.ok && observed.value === true;
      state.socketsDrained = sockets.size === 0;
      if (!state.serverClosed || !state.socketsDrained) fail('SERVER_CLOSE_UNKNOWN');
      return structuredClone(state);
    })();
    return closePromise;
  }
  const onSignal = () => abort('OWNER_ABORT');
  signal?.addEventListener('abort', onSignal, { once: true });
  timer = setTimeout(() => abort('PHASE_DEADLINE'), Math.max(1, scenario.phaseDeadlineMs - Date.now()));
  try {
    const ready = await boundedWait(new Promise((resolve, reject) => {
      server.once('error', reject); server.listen(0, LOOPBACK_HOST, resolve);
    }), scenario.phaseDeadlineMs);
    if (!ready.ok || closing) fail('SERVER_START_UNKNOWN');
    port = server.address()?.port;
    if (!Number.isInteger(port) || port < 1 || port > 65535) fail('SERVER_PORT');
    return { port, close, receipt: () => structuredClone(state) };
  } catch (error) { await close().catch(() => {}); throw error; }
}

export function main(argv = process.argv.slice(2), output = process.stdout) {
  output.write(argv.length === 1 && argv[0] === '--help'
    ? 'Import createInterruptionLoopback in the reviewed remote interruption composition; no direct native execution.\n'
    : 'COMPOSITION_REQUIRED: original scenario and trusted SDK phase owner required.\n');
  return argv.length === 1 && argv[0] === '--help' ? 0 : 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
