/**
 * The ONE Core service-identity read this lane performs: the canonical source-event custody
 * read behind a producer event.
 *
 * This is the existing Core/Meri service transport, not a new one: the verified service identity
 * travels as `x-internal-service-secret` exactly as the schedule worker's routine calls do
 * (Core guard ToolServiceSecretGuard), the origin is a retained read-only origin, the connection
 * is non-redirecting/non-credentialed, and every non-200 answer is a refusal — there is no
 * fallback credential and no caller-supplied producer claim is ever accepted as authority.
 *
 * The route it targets does NOT exist in Core yet (CLAIM.txt section 2 names the exact hunk);
 * until it is composed every call refuses with SOURCE_EVENT_UNAVAILABLE and the receiver writes
 * nothing. That is deliberate: an unattended producer event must never be released on a claim.
 */
import {types} from 'node:util';
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {retainedOrigin} from '../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../gateway/sources/json-response.mjs';
import {SourceEventError, SOURCE_EVENT_CORE_ROUTE, refuse} from './source-event-contract.mjs';

const TOKEN = /^[\x21-\x7e]{1,8192}$/u;
const fault = code => new SourceEventError(`SOURCE_EVENT_${code}`);
const owned = error => error instanceof SourceEventError;
const deny = code => {
  throw fault(code);
};

export function createSourceEventCoreClient(configuration) {
  let c, origin, fetchImpl, maxRequestMs, maxResponseBytes;
  try {
    c = own(configuration, ['origin', 'getServiceSecret', 'now'], ['fetchImpl', 'maxRequestMs', 'maxResponseBytes']);
    origin = retainedOrigin(c.origin);
    for (const fn of [c.getServiceSecret, c.now, c.fetchImpl ?? globalThis.fetch])
      if (typeof fn !== 'function' || types.isProxy(fn)) throw Error();
    if (c.maxRequestMs !== undefined && (!Number.isSafeInteger(c.maxRequestMs) || c.maxRequestMs < 1 || c.maxRequestMs > 30000)) throw Error();
    if (c.maxResponseBytes !== undefined && (!Number.isSafeInteger(c.maxResponseBytes) || c.maxResponseBytes < 1 || c.maxResponseBytes > 1048576)) throw Error();
  } catch {
    throw Object.assign(Error('SOURCE_EVENT_CORE_CONFIGURATION'), {code: 'SOURCE_EVENT_CORE_CONFIGURATION'});
  }
  const now = c.now, getServiceSecret = c.getServiceSecret;
  fetchImpl = c.fetchImpl ?? globalThis.fetch;
  maxRequestMs = c.maxRequestMs ?? 10000;
  maxResponseBytes = c.maxResponseBytes ?? 262144;

  /** Service-identity-only custody read. `value` is the exact event identity Core is asked about. */
  async function readSourceEvent(value, options = {}) {
    let v, o;
    try {
      v = own(value, ['schemaVersion', 'producer', 'tenantId', 'eventId', 'eventHash', 'scheduleId', 'generation']);
      o = own(options, [], ['signal', 'limitDeadline', 'check']);
      nativeSignal(o.signal);
    } catch {
      refuse('SOURCE_EVENT_INVALID');
    }
    const check = typeof o.check === 'function' ? o.check : () => {};
    let life, acquired;
    try {
      const began = now();
      if (!Number.isSafeInteger(began)) deny('UNAVAILABLE');
      life = createOperationLifetime({
        now, signal: o.signal, deadlineMs: Math.min(o.limitDeadline ?? Infinity, began + maxRequestMs), errorFactory: fault,
      });
      const secret = await life.run(() => getServiceSecret());
      if (typeof secret !== 'string' || !TOKEN.test(secret)) deny('UNAVAILABLE');
      acquired = await life.run(signal => {
        const pending = Promise.resolve(fetchImpl(`${origin}${SOURCE_EVENT_CORE_ROUTE}`, {
          method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store', signal,
          headers: {
            'x-internal-service-secret': secret, 'content-type': 'application/json',
            accept: 'application/json', 'accept-encoding': 'identity',
          },
          body: JSON.stringify(v),
        }));
        pending.then(response => {
          if (life.signal.aborted) try { cancelBody(responseBody(response)); } catch {}
        }, () => {});
        return pending;
      });
      if (!(acquired instanceof Response) || types.isProxy(acquired)) deny('RESULT');
      // 401/404/5xx are OUR transport state (absent route, wrong local credential) and stay
      // UNAVAILABLE: only Core's own authoritative refusal may be reported as a refusal.
      if (acquired.status !== 200) deny([400, 403, 409, 422].includes(acquired.status) ? 'REFUSED' : 'UNAVAILABLE');
      const receipt = await readJsonResponse(acquired, {lifetime: life, maxResponseBytes});
      check();
      life.check();
      return receipt;
    } catch (error) {
      if (owned(error)) throw error;
      deny(['DEADLINE', 'CANCELLED'].includes(error?.code) ? error.code : 'UNAVAILABLE');
    } finally {
      try { if (acquired) cancelBody(responseBody(acquired)); } catch {}
      life?.close();
    }
  }

  return Object.freeze({readSourceEvent});
}
