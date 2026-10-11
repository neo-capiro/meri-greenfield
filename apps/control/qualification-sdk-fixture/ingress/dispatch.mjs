// Closed-table handler dispatch for the private mTLS ingress.
//
// The handler table is fixed by trusted composition to exactly the four private
// operations; it is never selected by a request field. A handler receives only
// the authenticated peer, the trusted contexts and the already-decoded request
// DATA - never a worker-selected storage key, URL, version or privilege. The
// returned response is validated against the canonical private response contract
// before its canonical UTF-8 bytes are produced. Unknown, failed and timed-out
// handlers refuse with a fixed content-free code and cannot fabricate a
// stale-binding denial.
import canonicalize from 'canonicalize';
import { assertFixtureResponse } from '../../../../packages/contracts/qualification-sdk/validate.mjs';
import { INGRESS_MAX_WIRE_BYTES } from './config.mjs';
import { INGRESS_CODES, fail } from './errors.mjs';

const TIMEOUT = Symbol('FIXTURE_INGRESS_HANDLER_TIMEOUT');

/**
 * @param {{handlers: object, handlerMs: number, responseBytes?: number}} options
 *   `handlers` must already be the closed four-operation table from trusted
 *   composition; `responseBytes` is the canonical response ceiling.
 */
export function createOperationDispatch({ handlers, handlerMs, responseBytes = INGRESS_MAX_WIRE_BYTES }) {
  if (handlers === null || typeof handlers !== 'object' || !Number.isSafeInteger(handlerMs) ||
      handlerMs < 1 || !Number.isSafeInteger(responseBytes) || responseBytes < 1) {
    fail(INGRESS_CODES.CONFIG);
  }
  const table = handlers;

  /**
   * Invokes one trusted handler under an owned deadline and returns canonical
   * bytes for transmission.
   *
   * @param {{operation: string, peer: object, context: object, producer: object,
   *   request: object, nowMs: number, validationClock: Function, signal?: AbortSignal}} input
   * @returns {Promise<{bytes: Buffer, response: object}>}
   */
  async function dispatch({ operation, peer, context, producer, request, nowMs,
    validationClock, signal }) {
    const handler = typeof operation === 'string' ? table[operation] : undefined;
    if (typeof handler !== 'function') fail(INGRESS_CODES.DISPATCH);
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) fail(INGRESS_CODES.HANDLER_TIMEOUT);
    signal?.addEventListener('abort', abort, { once: true });
    const call = Object.freeze({ peer, context, producer, operation, request, nowMs,
      signal: controller.signal });
    let timer;
    let response;
    try {
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(TIMEOUT); }, handlerMs);
        timer.unref?.();
      });
      response = await Promise.race([
        Promise.resolve().then(() => handler(call)),
        deadline,
      ]);
    } catch (error) {
      // A timeout is reported separately; every other handler failure is one
      // fixed refusal. Neither path can be mistaken for a protocol outcome.
      fail(error === TIMEOUT ? INGRESS_CODES.HANDLER_TIMEOUT : INGRESS_CODES.HANDLER);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      // Owned cancellation only. Aborting is not proof that the handler stopped.
      controller.abort();
    }
    try { assertFixtureResponse(request, response, { producer, nowMs: validationClock() }); }
    catch { fail(INGRESS_CODES.RESPONSE_CONTRACT); }
    let bytes;
    try { bytes = Buffer.from(canonicalize(response), 'utf8'); }
    catch { fail(INGRESS_CODES.RESPONSE_CONTRACT); }
    if (bytes.length === 0 || bytes.length > responseBytes) fail(INGRESS_CODES.RESPONSE_BOUND);
    return { bytes, response };
  }

  return Object.freeze({ dispatch });
}
