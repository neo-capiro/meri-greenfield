// Composition validation for the private mTLS ingress.
//
// Trusted composition supplies every socket, credential and limit here; nothing
// in this module reads the environment, the filesystem or a default credential
// chain, and no option can disable certificate verification. Validation is
// driven by exact key sets so an unknown or unsafe option (for example a
// `rejectUnauthorized`/`insecure` flag, a public route or an in-memory authority
// fallback) is refused instead of silently ignored.
import { isIP } from 'node:net';
import { MAX_FIXTURE_WIRE_BYTES } from '../../../../packages/contracts/qualification-sdk/wire.mjs';
import { INGRESS_CODES, fail } from './errors.mjs';

export const INGRESS_CHANNEL_VERSION = 'sdk-fixture/1';
export const INGRESS_PROFILE = 'sdk-interruption-fixture-v1';

/** The fixed wire verb and the single private route; no generic public route exists. */
export const INGRESS_METHOD = 'POST';
export const INGRESS_PATH = '/v1/qualification/sdk-fixture/interruption';
export const INGRESS_HTTP_VERSION = '1.1';
export const INGRESS_TLS_VERSION = 'TLSv1.3';

/** The closed operation vocabulary owned by the canonical private protocol. */
export const INGRESS_OPERATIONS = Object.freeze([
  'authorizeFixturePhase', 'commitFixtureCheckpoint',
  'loadFixtureCheckpoint', 'verifyFixtureCheckpoint',
]);

/** The canonical private bytes ceiling: 50 MiB raw request and response. */
export const INGRESS_MAX_WIRE_BYTES = MAX_FIXTURE_WIRE_BYTES;

/** Request headers this ingress will accept at all; every other name is refused. */
export const INGRESS_ALLOWED_HEADERS = Object.freeze([
  'host', 'connection', 'accept', 'content-type', 'content-length', 'content-encoding', 'user-agent',
]);

const DEFAULT_BODY_MS = 30000;
const DEFAULT_HANDLER_MS = 30000;
const MAX_PHASE_MS = 60000;
const OPTION_KEYS = Object.freeze(['bind', 'tls', 'limits', 'resolveCredential', 'handlers', 'now']);
const REQUIRED_OPTION_KEYS = Object.freeze(['bind', 'tls', 'resolveCredential', 'handlers']);
const TLS_KEYS = Object.freeze(['cert', 'key', 'clientCa']);
const LIMIT_KEYS = Object.freeze(['bodyMs', 'handlerMs', 'rawBytes', 'responseBytes']);
const BIND_KEYS = Object.freeze(['host', 'port']);
const DECIMAL = /^(?:0|[1-9][0-9]*)$/;

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}
function exactKeys(value, keys) {
  if (!plainObject(value)) fail(INGRESS_CODES.CONFIG);
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) fail(INGRESS_CODES.CONFIG);
}
function boundedInteger(value, { min, max }) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}
/** Owner-supplied PEM/mTLS material is required, nonempty and copied. */
function material(value) {
  if (Buffer.isBuffer(value)) { if (value.length === 0) fail(INGRESS_CODES.CONFIG); return Buffer.from(value); }
  if (typeof value === 'string') { if (value.length === 0) fail(INGRESS_CODES.CONFIG); return Buffer.from(value, 'utf8'); }
  fail(INGRESS_CODES.CONFIG);
}

/** Fixed interface address: an explicit IP literal, never a hostname or wildcard name. */
export function fixedBind(bind) {
  exactKeys(bind, BIND_KEYS);
  if (typeof bind.host !== 'string' || isIP(bind.host) === 0) fail(INGRESS_CODES.CONFIG);
  if (!boundedInteger(bind.port, { min: 0, max: 65535 })) fail(INGRESS_CODES.CONFIG);
  return Object.freeze({ host: bind.host, port: bind.port });
}

/** Owned server identity plus the owner-supplied CA used to verify the client. */
export function fixedTls(tls) {
  exactKeys(tls, TLS_KEYS);
  return Object.freeze({ cert: material(tls.cert), key: material(tls.key), clientCa: material(tls.clientCa) });
}

export function fixedLimits(limits) {
  const supplied = limits === undefined ? {} : limits;
  exactKeys(supplied, LIMIT_KEYS.filter(key => Object.hasOwn(supplied, key)));
  const bodyMs = supplied.bodyMs ?? DEFAULT_BODY_MS;
  const handlerMs = supplied.handlerMs ?? DEFAULT_HANDLER_MS;
  const rawBytes = supplied.rawBytes ?? INGRESS_MAX_WIRE_BYTES;
  const responseBytes = supplied.responseBytes ?? INGRESS_MAX_WIRE_BYTES;
  if (!boundedInteger(bodyMs, { min: 1, max: MAX_PHASE_MS })) fail(INGRESS_CODES.CONFIG);
  if (!boundedInteger(handlerMs, { min: 1, max: MAX_PHASE_MS })) fail(INGRESS_CODES.CONFIG);
  if (bodyMs + handlerMs > MAX_PHASE_MS) fail(INGRESS_CODES.CONFIG);
  if (!boundedInteger(rawBytes, { min: 1, max: INGRESS_MAX_WIRE_BYTES })) fail(INGRESS_CODES.CONFIG);
  if (!boundedInteger(responseBytes, { min: 1, max: INGRESS_MAX_WIRE_BYTES })) fail(INGRESS_CODES.CONFIG);
  return Object.freeze({ bodyMs, handlerMs, rawBytes, responseBytes });
}

/** Closed four-operation handler table: no dynamic lookup, no default handler. */
export function fixedHandlers(handlers) {
  exactKeys(handlers, INGRESS_OPERATIONS);
  if (!INGRESS_OPERATIONS.every(operation => typeof handlers[operation] === 'function')) fail(INGRESS_CODES.CONFIG);
  return Object.freeze(Object.fromEntries(INGRESS_OPERATIONS.map(operation => [operation, handlers[operation]])));
}

/** The injected trusted credential resolver is the only peer/authority source. */
export function fixedResolver(resolveCredential) {
  if (typeof resolveCredential !== 'function') fail(INGRESS_CODES.CONFIG);
  return resolveCredential;
}

/** Injected protocol clock; readings must be safe integers and never move back. */
export function fixedClock(now) {
  if (now === undefined) return Date.now;
  if (typeof now !== 'function') fail(INGRESS_CODES.CONFIG);
  return now;
}
export function readClock(now, last) {
  let reading;
  try { reading = now(); } catch { fail(INGRESS_CODES.CLOCK); }
  if (!Number.isSafeInteger(reading) || (last !== null && reading < last)) fail(INGRESS_CODES.CLOCK);
  return reading;
}

/** Validates the whole composition and refuses every unknown or unsafe option. */
export function fixedComposition(options) {
  if (!plainObject(options)) fail(INGRESS_CODES.CONFIG);
  const own = Reflect.ownKeys(options);
  if (!own.every(key => OPTION_KEYS.includes(key)) ||
      !REQUIRED_OPTION_KEYS.every(key => own.includes(key))) fail(INGRESS_CODES.CONFIG);
  return Object.freeze({
    bind: fixedBind(options.bind),
    tls: fixedTls(options.tls),
    limits: fixedLimits(options.limits),
    resolveCredential: fixedResolver(options.resolveCredential),
    handlers: fixedHandlers(options.handlers),
    now: fixedClock(options.now),
  });
}

/** Accepted decimal content-length values only; no sign, padding or exponent. */
export function declaredLength(value) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !DECIMAL.test(value)) fail(INGRESS_CODES.LENGTH);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) fail(INGRESS_CODES.LENGTH);
  return parsed;
}
