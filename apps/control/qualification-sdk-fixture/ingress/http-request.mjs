// Bounded HTTP request binding for the private mTLS ingress.
//
// Owns exactly the wire envelope checks and the bounded raw-body read. It never
// decodes the fixture protocol, never authenticates a peer and never decides
// authority: it produces the exact raw bytes the canonical wire decoder consumes,
// or a fixed content-free refusal.
import { INGRESS_ALLOWED_HEADERS, INGRESS_HTTP_VERSION, INGRESS_METHOD, declaredLength }
  from './config.mjs';
import { INGRESS_CODES, fail } from './errors.mjs';

const ALLOWED = new Set(INGRESS_ALLOWED_HEADERS);
const JSON_MEDIA = 'application/json';
const IDENTITY = 'identity';

function headerPairs(req) {
  const raw = req.rawHeaders;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length % 2 !== 0) fail(INGRESS_CODES.HEADERS);
  const pairs = [];
  for (let index = 0; index < raw.length; index += 2) {
    const name = raw[index], value = raw[index + 1];
    if (typeof name !== 'string' || typeof value !== 'string') fail(INGRESS_CODES.HEADERS);
    const lower = name.toLowerCase();
    if (!ALLOWED.has(lower)) fail(INGRESS_CODES.HEADERS);
    if (pairs.some(([seen]) => seen === lower)) fail(INGRESS_CODES.HEADERS);
    pairs.push([lower, value]);
  }
  return pairs;
}

function valueOf(pairs, name) {
  const found = pairs.find(([key]) => key === name);
  return found === undefined ? undefined : found[1];
}

/** Media type must be the exact accepted type: no parameters, no aliases. */
function assertMediaType(pairs) {
  const value = valueOf(pairs, 'content-type');
  if (typeof value !== 'string' || value.trim().toLowerCase() !== JSON_MEDIA) fail(INGRESS_CODES.CONTENT_TYPE);
}
/** No compressed or transformed body is accepted: absent or identity only. */
function assertContentEncoding(pairs) {
  const value = valueOf(pairs, 'content-encoding');
  if (value === undefined) return;
  if (value.trim().toLowerCase() !== IDENTITY) fail(INGRESS_CODES.ENCODING);
}
/** HTTP/1.1 requires a host; the ingress never routes on it. */
function assertHost(pairs) {
  const value = valueOf(pairs, 'host');
  if (typeof value !== 'string' || value.length === 0) fail(INGRESS_CODES.HEADERS);
}
/** No protocol upgrade or connection hijack is part of this fixed wire. */
function assertConnection(pairs) {
  const value = valueOf(pairs, 'connection');
  if (value === undefined) return;
  if (value.toLowerCase().includes('upgrade')) fail(INGRESS_CODES.HEADERS);
}

/**
 * Fixed-envelope binding: exact HTTP version, verb and route, allowlisted unique
 * headers, exact media type, identity encoding and a bounded declared length.
 * A query string, alternate route, alternate verb or unknown header refuses.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {{path: string, rawBytes: number}} fixed
 * @returns {{declaredBytes: number|null}}
 */
export function bindRequestEnvelope(req, { path, rawBytes }) {
  if (req.httpVersion !== INGRESS_HTTP_VERSION) fail(INGRESS_CODES.VERSION);
  if (req.method !== INGRESS_METHOD) fail(INGRESS_CODES.METHOD);
  if (req.url !== path) fail(INGRESS_CODES.PATH);
  const pairs = headerPairs(req);
  assertHost(pairs);
  assertConnection(pairs);
  assertContentEncoding(pairs);
  assertMediaType(pairs);
  const declaredBytes = declaredLength(valueOf(pairs, 'content-length'));
  if (declaredBytes !== null && declaredBytes > rawBytes) fail(INGRESS_CODES.RAW_BOUND);
  return { declaredBytes };
}

/**
 * Streams the request body under the private raw ceiling.
 *
 * The running byte count refuses the moment the ceiling is exceeded, before an
 * oversized complete buffer is retained; the declared length is an independent
 * pre-check. A declared length that does not match the received bytes refuses.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {{rawBytes: number, bodyMs: number, declaredBytes: number|null}} limits
 * @returns {Promise<Buffer>}
 */
export function readBoundedRawBody(req, { rawBytes, bodyMs, declaredBytes }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let received = 0;
    let settled = false;
    let timer;
    function cleanup() {
      if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('aborted', onAborted);
      req.removeListener('error', onError);
    }
    function settle(error, value) {
      if (settled) return;
      settled = true; cleanup();
      if (error) reject(error); else resolve(value);
    }
    function onData(chunk) {
      if (settled) return;
      if (!Buffer.isBuffer(chunk)) { settle(new Error(INGRESS_CODES.RAW_BOUND)); return; }
      if (received + chunk.length > rawBytes) { settle(new Error(INGRESS_CODES.RAW_BOUND)); return; }
      received += chunk.length;
      chunks.push(chunk);
    }
    function onEnd() {
      if (declaredBytes !== null && received !== declaredBytes) {
        settle(new Error(INGRESS_CODES.LENGTH)); return;
      }
      settle(null, Buffer.concat(chunks, received));
    }
    function onAborted() { settle(new Error(INGRESS_CODES.BODY_TIMEOUT)); }
    function onError() { settle(new Error(INGRESS_CODES.BODY_TIMEOUT)); }
    timer = setTimeout(() => settle(new Error(INGRESS_CODES.BODY_TIMEOUT)), bodyMs);
    timer.unref?.();
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('aborted', onAborted);
    req.on('error', onError);
  });
}
