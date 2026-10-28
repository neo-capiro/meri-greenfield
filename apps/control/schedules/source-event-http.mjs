/**
 * MB-05 private inbound transport for producer events. Inert Fetch: it authenticates the
 * transport (shared service identity, timing-safe) and forwards exactly one event to the
 * receiver, which keeps every domain and authority decision.
 *
 * There is no user-session path here: an event must arrive as an unattended service-identity
 * call, so a bearer is refused rather than reinterpreted as a producer claim.
 */
import {createHash, timingSafeEqual} from 'node:crypto';
import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {ApplicationError,jsonBody,response} from '../action-application/http.mjs';
import {SOURCE_EVENT_BINDING_PATH, SOURCE_EVENT_PATH, SourceEventError, snapshotSourceEventBindingRequest} from './source-event-contract.mjs';

export const SOURCE_EVENT_PATHS = Object.freeze([SOURCE_EVENT_PATH, SOURCE_EVENT_BINDING_PATH]);
const secretMatches = (presented, expected) => timingSafeEqual(
  createHash('sha256').update(presented, 'utf8').digest(),
  createHash('sha256').update(expected, 'utf8').digest(),
);
const STATUS = Object.freeze({
  SOURCE_EVENT_INVALID: 400, SOURCE_EVENT_PRODUCER: 400, SOURCE_EVENT_HASH: 400, SOURCE_EVENT_RECEIPT: 400,
  SOURCE_EVENT_CORE_REFUSED: 403, SOURCE_EVENT_REFUSED: 403,
  SOURCE_EVENT_UNAVAILABLE: 503, SOURCE_EVENT_CORE_CONFIGURATION: 503, SOURCE_EVENT_STORE_UNAVAILABLE: 503,
  SOURCE_EVENT_COMMIT_UNKNOWN: 503, SOURCE_EVENT_DISPATCH_UNKNOWN: 503,
  SOURCE_EVENT_CORRUPT: 500, SOURCE_EVENT_UNKNOWN: 500, SOURCE_EVENT_PORTS: 500, SOURCE_EVENT_STORE: 500,
});
const statusFor = code => STATUS[code] ?? 500;

async function handleRequest(request, configuration) {
  if (!request || types.isProxy(request) || !(request instanceof Request)) return null;
  let url, method, headers, signal, body;
  try {
    url = new URL(request.url); method = request.method; headers = request.headers;
    signal = request.signal; body = request.body;
  } catch {
    return response({error: {code: 'INVALID_REQUEST'}}, 400);
  }
  if (!SOURCE_EVENT_PATHS.includes(url.pathname)) return null;
  const state = {started: false};
  let life = null;
  try {
    if (url.search || url.hash) return response({error: {code: 'NOT_FOUND'}}, 404);
    if (!configuration.enabled) return response({error: {code: 'SOURCE_EVENT_UNAVAILABLE'}}, 503);
    if (method !== 'POST') return response({error: {code: 'METHOD_NOT_ALLOWED'}}, 405);
    const header = name => Headers.prototype.get.call(headers, name);
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type') ?? ''))
      return response({error: {code: 'UNSUPPORTED_MEDIA_TYPE'}}, 415);
    if (header('content-encoding') !== null) return response({error: {code: 'UNSUPPORTED_CONTENT_ENCODING'}}, 415);
    if (header('authorization') !== null) return response({error: {code: 'UNATTENDED_SERVICE_IDENTITY_ONLY'}}, 401);
    const presented = header('x-internal-service-secret');
    if (typeof presented !== 'string' || presented.length === 0 || presented.length > 8192)
      return response({error: {code: 'UNAUTHENTICATED'}}, 401);
    const length = header('content-length');
    if (length !== null && !/^(0|[1-9][0-9]*)$/u.test(length)) return response({error: {code: 'INVALID_CONTENT_LENGTH'}}, 400);
    const at = configuration.now();
    const bounds = configuration.limits;
    if (!Number.isSafeInteger(at) || at < 0 || !Number.isSafeInteger(at + bounds.maxRequestMs))
      return response({error: {code: 'APPLICATION_CLOCK'}}, 500);
    const deadlineMs = at + bounds.maxRequestMs;
    life = createOperationLifetime({
      deadlineMs, now: configuration.now, signal,
      errorFactory: code => new ApplicationError(code === 'DEADLINE' ? 'DEADLINE' : 'CANCELLED', code === 'DEADLINE' ? 408 : 499),
    });
    // The secret is read per call (rotation without restart) and is never logged or echoed.
    const expected = await configuration.getServiceSecret();
    if (typeof expected !== 'string' || expected.length === 0 || !secretMatches(presented, expected))
      return response({error: {code: 'UNAUTHENTICATED'}}, 401);
    const raw = await jsonBody({body, length: length === null ? null : Number(length)}, bounds.maxRequestBytes, life, life.check);
    // The producer's READ of the approved binding for a producer/resource pair. It is read-only,
    // exposes the routine pins and nothing of the routine's work, and cannot create a binding.
    if (url.pathname === SOURCE_EVENT_BINDING_PATH) {
      if (typeof configuration.lookup !== 'function')
        return response({error: {code: 'SOURCE_EVENT_UNAVAILABLE'}, outcome: 'NOT_DISPATCHED'}, 503);
      const request = snapshotSourceEventBindingRequest(raw);
      const found = await life.run(() => configuration.lookup(request, life.check));
      const binding = found === null || found === undefined ? null
        : {scheduleId: String(found.scheduleId), generation: Number(found.generation)};
      return response({outcome: 'BINDING_READ', binding}, 200);
    }
    const disposed = await life.run(async () => {
      state.started = true;
      return configuration.service.receive({raw, check: life.check, deadlineMs});
    });
    const inert = JSON.parse(JSON.stringify(disposed));
    return response({outcome: inert.disposition, sourceEvent: inert}, 200);
  } catch (error) {
    if (state.started && !(error instanceof SourceEventError) && !(error instanceof ApplicationError))
      return response({error: {code: 'SOURCE_EVENT_UNKNOWN'}, outcome: 'UNKNOWN'}, 500);
    const code = error instanceof SourceEventError ? error.code
      : error instanceof ApplicationError ? error.code
        : error?.code === 'DEADLINE' ? 'DEADLINE' : error?.code === 'CANCELLED' ? 'CANCELLED' : 'SOURCE_EVENT_UNKNOWN';
    const status = code === 'DEADLINE' ? 408 : code === 'CANCELLED' ? 499 : statusFor(code);
    // The boundary only reports an uncertain effect where it genuinely cannot know one was not
    // released: a durable commit/dispatch uncertainty, or a request cut short after the service
    // was entered. A recognised refusal happened before any release, so it is NOT_DISPATCHED —
    // the receiver records its own truthful disposition row instead.
    const unknown = code === 'SOURCE_EVENT_COMMIT_UNKNOWN' || code === 'SOURCE_EVENT_DISPATCH_UNKNOWN' ||
      (state.started && (code === 'DEADLINE' || code === 'CANCELLED'));
    return response({error: {code}, outcome: unknown ? 'UNKNOWN' : 'NOT_DISPATCHED'}, status);
  } finally {
    life?.close();
    if (body) try { Promise.resolve(body.cancel()).catch(() => {}); } catch {}
  }
}

export function createSourceEventHttpApplication(configuration) {
  let c, limits;
  try {
    c = own(configuration, [], ['now', 'limits', 'service', 'enabled', 'getServiceSecret', 'lookup']);
    if (c.enabled !== undefined && typeof c.enabled !== 'boolean') throw Error();
    if (c.limits !== undefined) {
      limits = own(c.limits, ['maxRequestMs', 'maxRequestBytes']);
      if (Object.values(limits).some(value => !Number.isSafeInteger(value) || value < 1) ||
          limits.maxRequestMs > 60000 || limits.maxRequestBytes > 1048576) throw Error();
    }
    if (c.now !== undefined && typeof c.now !== 'function') throw Error();
    if (c.lookup !== undefined && (typeof c.lookup !== 'function' || types.isProxy(c.lookup))) throw Error();
    if (c.enabled !== false) {
      if (typeof c.now !== 'function' || limits === undefined || typeof c.getServiceSecret !== 'function' || types.isProxy(c.getServiceSecret)) throw Error();
      const receive = Object.getOwnPropertyDescriptor(c.service ?? {}, 'receive');
      if (!receive || !Object.hasOwn(receive, 'value') || typeof receive.value !== 'function') throw Error();
    }
  } catch {
    throw TypeError('SOURCE_EVENT_APPLICATION_CONFIGURATION');
  }
  const captured = {service: c.service, lookup: c.lookup, limits, now: c.now, enabled: c.enabled !== false, getServiceSecret: c.getServiceSecret};
  return Object.freeze({paths: SOURCE_EVENT_PATHS, handle: request => handleRequest(request, captured)});
}
