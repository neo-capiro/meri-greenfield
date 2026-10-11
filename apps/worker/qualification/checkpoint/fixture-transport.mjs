// Bounded private HTTPS transport for createFixtureChannel's borrowed call shape.
//
// Trusted composition supplies the fixed HTTPS origin/path, the expected server
// identity pin and the mTLS material. Nothing here derives authority, host,
// path, port or credentials from request bytes, the environment, SDK/tool
// output or a redirect. Import is inert: this module only defines local
// constants and pure helpers, and starts no work.
//
// This is a transport only. It does not authenticate the application actor,
// decide current grants/fences, prove service persistence, allocate resources
// or implement a product SessionStore. A peer certificate pin and mTLS are
// transport checks only; the trusted service must independently enforce
// peer/current grant/policy and atomically publish immutable readback.
import https from 'node:https';
import { checkServerIdentity as checkHostIdentity } from 'node:tls';
import canonicalize from 'canonicalize';

export const FIXTURE_TRANSPORT_CHANNEL_VERSION = 'sdk-fixture/1';
export const FIXTURE_TRANSPORT_PROFILE = 'sdk-interruption-fixture-v1';
export const FIXTURE_TRANSPORT_OPERATIONS = Object.freeze([
  'authorizeFixturePhase', 'commitFixtureCheckpoint',
  'loadFixtureCheckpoint', 'verifyFixtureCheckpoint',
]);
export const FIXTURE_TRANSPORT_METHOD = 'POST';
export const FIXTURE_TRANSPORT_MIN_TLS = 'TLSv1.2';
export const FIXTURE_TRANSPORT_MAX_LIMIT_BYTES = 64 * 1024 * 1024;
export const FIXTURE_TRANSPORT_APPROVED_PORTS = Object.freeze([443]);

// Fixed, content-free error codes. No response/error body, header or private
// message is ever placed in a thrown message or logged.
const CODES = Object.freeze({
  CONFIG: 'FIXTURE_TRANSPORT_CONFIG',
  INPUT: 'FIXTURE_TRANSPORT_INPUT',
  PROFILE: 'FIXTURE_TRANSPORT_PROFILE',
  BUDGET: 'FIXTURE_TRANSPORT_BUDGET',
  REQUEST_BOUND: 'FIXTURE_TRANSPORT_REQUEST_BOUND',
  DISPATCH: 'FIXTURE_TRANSPORT_DISPATCH',
  TIMEOUT: 'FIXTURE_TRANSPORT_TIMEOUT',
  STATUS: 'FIXTURE_TRANSPORT_STATUS',
  ENCODING: 'FIXTURE_TRANSPORT_ENCODING',
  CONTENT_TYPE: 'FIXTURE_TRANSPORT_CONTENT_TYPE',
  RESPONSE_BOUND: 'FIXTURE_TRANSPORT_RESPONSE_BOUND',
  CLOSED: 'FIXTURE_TRANSPORT_CLOSED',
  IDENTITY: 'FIXTURE_TRANSPORT_IDENTITY',
});
const fail = code => { throw new Error(code); };

/** Fixed origin/path: HTTPS only, no credentials, query, fragment or unapproved port. */
function fixedTarget(endpoint, approvedPorts) {
  if (!endpoint || typeof endpoint !== 'object' ||
      typeof endpoint.origin !== 'string' || typeof endpoint.path !== 'string') fail(CODES.CONFIG);
  const ports = approvedPorts === undefined ? FIXTURE_TRANSPORT_APPROVED_PORTS : approvedPorts;
  if (!Array.isArray(ports) || ports.length === 0 ||
      ports.some(port => !Number.isInteger(port) || port < 1 || port > 65535)) fail(CODES.CONFIG);
  let url;
  try { url = new URL(endpoint.origin); } catch { fail(CODES.CONFIG); }
  const port = url.port === '' ? 443 : Number(url.port);
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' ||
      url.search !== '' || url.hash !== '' || url.pathname !== '/' || url.hostname === '' ||
      !Number.isInteger(port) || !ports.includes(port)) fail(CODES.CONFIG);
  const path = endpoint.path;
  if (!/^\/[A-Za-z0-9._/-]+$/.test(path) || path.length > 256 ||
      path.includes('//') || path.split('/').some(part => part === '.' || part === '..')) fail(CODES.CONFIG);
  // SNI is the fixed hostname unless the host is an address literal.
  const literal = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname) || url.hostname.includes(':');
  return { hostname: url.hostname, port, path, servername: literal ? undefined : url.hostname };
}

/** Expected peer identity: a fixed SHA-256 certificate fingerprint (colon form allowed). */
function fixedPin(identity) {
  const value = identity && typeof identity === 'object' ? identity.pinSha256 : undefined;
  if (typeof value !== 'string') fail(CODES.CONFIG);
  const normalized = value.replace(/:/g, '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) fail(CODES.CONFIG);
  return normalized;
}

/** mTLS material is required, nonempty and copied: the transport never owns the caller's buffers. */
function materialBytes(value) {
  if (Buffer.isBuffer(value)) { if (value.length === 0) fail(CODES.CONFIG); return Buffer.from(value); }
  if (typeof value === 'string') { if (value.length === 0) fail(CODES.CONFIG); return Buffer.from(value, 'utf8'); }
  fail(CODES.CONFIG);
}
function fixedMaterial(mtls) {
  if (!mtls || typeof mtls !== 'object') fail(CODES.CONFIG);
  return { cert: materialBytes(mtls.cert), key: materialBytes(mtls.key), ca: materialBytes(mtls.ca) };
}

/** Bounded request and streaming-response budgets, supplied by trusted composition. */
function fixedLimits(limits) {
  if (!limits || typeof limits !== 'object') fail(CODES.CONFIG);
  for (const value of [limits.requestBytes, limits.responseBytes]) {
    if (!Number.isSafeInteger(value) || value < 1 || value > FIXTURE_TRANSPORT_MAX_LIMIT_BYTES) fail(CODES.CONFIG);
  }
  return { requestBytes: limits.requestBytes, responseBytes: limits.responseBytes };
}

function fixedContentType(value) {
  if (value !== 'application/json') fail(CODES.CONFIG);
  return value;
}

/** Envelope + canonical byte equality only. The full fixture schema stays with the wire owner. */
function assertCanonicalProfile(requestBytes, operation) {
  let parsed;
  try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(requestBytes)); }
  catch { fail(CODES.PROFILE); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed) ||
      parsed.channelVersion !== FIXTURE_TRANSPORT_CHANNEL_VERSION ||
      parsed.profile !== FIXTURE_TRANSPORT_PROFILE ||
      parsed.operation !== operation ||
      !FIXTURE_TRANSPORT_OPERATIONS.includes(parsed.operation)) fail(CODES.PROFILE);
  let canonical;
  try { canonical = canonicalize(parsed); } catch { fail(CODES.PROFILE); }
  if (typeof canonical !== 'string' || !Buffer.from(canonical, 'utf8').equals(requestBytes)) fail(CODES.PROFILE);
}

/**
 * Builds one bounded transport function from trusted composition.
 *
 * @param {object} options
 * @param {{origin: string, path: string}} options.endpoint fixed HTTPS origin and request path
 * @param {{pinSha256: string}} options.identity expected peer certificate SHA-256 fingerprint
 * @param {{cert: Buffer|string, key: Buffer|string, ca: Buffer|string}} options.mtls client material
 * @param {{requestBytes: number, responseBytes: number}} options.limits byte budgets
 * @param {string} options.contentType exact accepted/declared media type
 * @param {number[]} [options.approvedPorts] default [443]
 * @param {object} [options.httpsModule] node:https boundary; offline tests inject a fake
 * @param {() => number} [options.now] injected clock
 * @returns {(call: {operation: string, requestBytes: Buffer, deadlineMs: number, signal?: AbortSignal}) => Promise<Buffer>}
 */
export function createFixtureHttpsTransport(options = {}) {
  const { endpoint, identity, mtls, limits, contentType,
    approvedPorts, httpsModule = https, now = Date.now } = options ?? {};
  if (typeof httpsModule?.request !== 'function' || typeof now !== 'function') fail(CODES.CONFIG);
  const target = fixedTarget(endpoint, approvedPorts);
  const pin = fixedPin(identity);
  const material = fixedMaterial(mtls);
  const caps = fixedLimits(limits);
  const expectedType = fixedContentType(contentType);
  // The default hostname check is preserved and the pin is added on top; both
  // failures collapse to one fixed content-free error.
  const checkServerIdentity = (host, cert) => {
    try {
      if (cert && String(cert.fingerprint256 ?? '').replace(/:/g, '').toLowerCase() === pin &&
          checkHostIdentity(host, cert) === undefined) return undefined;
    } catch { /* malformed peer identity is a fixed refusal */ }
    return new Error(CODES.IDENTITY);
  };
  const base = Object.freeze({
    protocol: 'https:', hostname: target.hostname, port: target.port, path: target.path,
    method: FIXTURE_TRANSPORT_METHOD, agent: false, rejectUnauthorized: true,
    minVersion: FIXTURE_TRANSPORT_MIN_TLS, servername: target.servername,
    cert: material.cert, key: material.key, ca: material.ca, checkServerIdentity,
  });

  return async function fixtureTransport(call = {}) {
    const { operation, requestBytes, deadlineMs, signal } = call ?? {};
    if (!FIXTURE_TRANSPORT_OPERATIONS.includes(operation)) fail(CODES.INPUT);
    if (!Buffer.isBuffer(requestBytes) || requestBytes.length === 0) fail(CODES.INPUT);
    if (!Number.isSafeInteger(deadlineMs)) fail(CODES.INPUT);
    if (signal !== undefined && (signal === null || typeof signal !== 'object' ||
        typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function' ||
        typeof signal.removeEventListener !== 'function')) fail(CODES.INPUT);
    if (requestBytes.length > caps.requestBytes) fail(CODES.REQUEST_BOUND);
    assertCanonicalProfile(requestBytes, operation);
    let started;
    try { started = now(); } catch { fail(CODES.BUDGET); }
    if (!Number.isSafeInteger(started) || started >= deadlineMs || deadlineMs - started > 60000) fail(CODES.BUDGET);
    if (signal !== undefined && signal.aborted) fail(CODES.BUDGET);
    const timeoutMs = deadlineMs - started;

    return await new Promise((resolve, reject) => {
      let settled = false, timer, request, response;
      // Only owned resources are closed. The borrowed signal, https module and
      // credential material are never disposed.
      function closeOwned() {
        if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
        if (signal !== undefined) { try { signal.removeEventListener('abort', onAbort); } catch { /* owned cleanup continues */ } }
        if (response !== undefined) { try { response.destroy(); } catch { /* owned */ } }
        if (request !== undefined) { try { request.destroy(); } catch { /* owned */ } }
      }
      function settle(ok, value) {
        if (settled) return;
        settled = true; closeOwned();
        if (ok) resolve(value); else reject(value);
      }
      function onAbort() { settle(false, new Error(CODES.TIMEOUT)); }
      function onResponse(stream) {
        response = stream;
        const headers = stream.headers ?? {};
        if (stream.statusCode !== 200 || headers.location !== undefined) { settle(false, new Error(CODES.STATUS)); return; }
        const encoding = headers['content-encoding'];
        if (encoding !== undefined && String(encoding).trim().toLowerCase() !== 'identity') {
          settle(false, new Error(CODES.ENCODING)); return;
        }
        const media = String(headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
        if (media !== expectedType) { settle(false, new Error(CODES.CONTENT_TYPE)); return; }
        const rawLength = headers['content-length'];
        const declared = rawLength === undefined ? null : String(rawLength);
        if (declared !== null && (!/^(?:0|[1-9][0-9]*)$/.test(declared) ||
            !Number.isSafeInteger(Number(declared)) || Number(declared) > caps.responseBytes)) {
          settle(false, new Error(CODES.RESPONSE_BOUND)); return;
        }
        // Streaming budget applies during receipt, before any aggregation.
        const chunks = []; let received = 0;
        stream.on('data', chunk => {
          if (settled) return;
          if (!Buffer.isBuffer(chunk)) { settle(false, new Error(CODES.RESPONSE_BOUND)); return; }
          received += chunk.length;
          if (received > caps.responseBytes) { settle(false, new Error(CODES.RESPONSE_BOUND)); return; }
          chunks.push(chunk);
        });
        stream.on('aborted', () => settle(false, new Error(CODES.CLOSED)));
        stream.on('error', () => settle(false, new Error(CODES.CLOSED)));
        stream.on('close', () => settle(false, new Error(CODES.CLOSED)));
        stream.on('end', () => {
          if (declared !== null && received !== Number(declared)) {
            settle(false, new Error(CODES.RESPONSE_BOUND)); return;
          }
          settle(true, Buffer.concat(chunks, received));
        });
      }
      timer = setTimeout(() => settle(false, new Error(CODES.TIMEOUT)), timeoutMs);
      if (signal !== undefined) {
        try { signal.addEventListener('abort', onAbort, { once: true }); }
        catch { settle(false, new Error(CODES.INPUT)); return; }
      }
      try {
        request = httpsModule.request({ ...base, headers: {
          'content-type': expectedType, accept: expectedType,
          'content-length': String(requestBytes.length),
        } }, onResponse);
      } catch { settle(false, new Error(CODES.DISPATCH)); return; }
      if (settled) { closeOwned(); return; }
      try {
        request.on('error', () => settle(false, new Error(CODES.DISPATCH)));
        request.end(requestBytes);
      } catch { settle(false, new Error(CODES.DISPATCH)); }
    });
  };
}
