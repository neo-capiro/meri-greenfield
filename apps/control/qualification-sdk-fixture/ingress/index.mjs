// Private mTLS ingress transport for the qualification SDK fixture channel.
//
// Trusted composition entry point. It sequences the cohesive modules - owned TLS
// listener, bounded HTTP envelope/body binding, socket-certificate-backed peer
// binding, canonical decode, closed-table dispatch and canonical transmission -
// and owns nothing else. Importing this module opens no socket, loads no
// credential and starts no timer; the caller must explicitly start() and close()
// the returned handle.
//
// The ingress is a transport only. Handlers supplied by trusted composition must
// themselves compose the durable fixture registry (current grant/fence/expiry,
// stale-binding decision, atomic publication) and a real immutable object-store
// readback; this transport never accepts the request as authority, never decides
// currentness, and never reports durability.
import { decodeFixtureRequest } from '../../../../packages/contracts/qualification-sdk/wire.mjs';
import { bindAuthenticatedOperation, peerCertificateFingerprint } from './authority.mjs';
import {
  INGRESS_ALLOWED_HEADERS, INGRESS_CHANNEL_VERSION, INGRESS_HTTP_VERSION, INGRESS_MAX_WIRE_BYTES,
  INGRESS_METHOD, INGRESS_OPERATIONS, INGRESS_PATH, INGRESS_PROFILE, INGRESS_TLS_VERSION,
  fixedComposition, readClock,
} from './config.mjs';
import { createOperationDispatch } from './dispatch.mjs';
import { INGRESS_CODES, fail } from './errors.mjs';
import { bindRequestEnvelope, readBoundedRawBody } from './http-request.mjs';
import { transmitCanonicalResponse, transmitTransportFailure } from './http-response.mjs';
import { createFixtureTlsServer } from './server.mjs';

export {
  INGRESS_ALLOWED_HEADERS, INGRESS_CHANNEL_VERSION, INGRESS_HTTP_VERSION, INGRESS_MAX_WIRE_BYTES,
  INGRESS_METHOD, INGRESS_OPERATIONS, INGRESS_PATH, INGRESS_PROFILE, INGRESS_TLS_VERSION,
} from './config.mjs';
export { INGRESS_CODES } from './errors.mjs';

const KNOWN_CODES = new Set(Object.values(INGRESS_CODES));

/** Only a fixed code we raised is transmitted; anything else collapses to one refusal. */
function refusalCode(error) {
  const message = error instanceof Error ? error.message : undefined;
  return typeof message === 'string' && KNOWN_CODES.has(message) ? message : INGRESS_CODES.DISPATCH;
}

/**
 * Creates the private ingress handle. Nothing is bound until start() is called.
 *
 * @param {object} options trusted composition, exactly these keys:
 * @param {{host: string, port: number}} options.bind literal address for the owned listener
 * @param {{cert: Buffer|string, key: Buffer|string, clientCa: Buffer|string}} options.tls
 *   owned server identity and the CA used to verify the client certificate
 * @param {{bodyMs?: number, handlerMs?: number, rawBytes?: number, responseBytes?: number}} [options.limits]
 * @param {(query: {fingerprintSha256: string, operation: string, signal: AbortSignal}) => Promise<object|null>} options.resolveCredential
 *   authenticated-credential resolver: returns {peer, context, producer, audience} or null
 * @param {Record<string, Function>} options.handlers closed four-operation handler table
 * @param {() => number} [options.now] injected monotonic protocol clock
 * @returns {{start: Function, close: Function, address: Function, activeConnections: Function}}
 */
export function createFixtureIngress(options) {
  const { bind, tls, limits, resolveCredential, now, handlers } = fixedComposition(options);
  const dispatch = createOperationDispatch({ handlers, handlerMs: limits.handlerMs,
    responseBytes: limits.responseBytes });
  let lastClock = null;
  function protocolClock() {
    const reading = readClock(now, lastClock);
    lastClock = reading;
    return reading;
  }

  async function pipeline(req, res) {
    try {
      const { declaredBytes } = bindRequestEnvelope(req, { path: INGRESS_PATH, rawBytes: limits.rawBytes });
      // Identity comes from the authenticated socket before any body byte is read.
      const fingerprintSha256 = peerCertificateFingerprint(req.socket);
      const raw = await readBoundedRawBody(req, { rawBytes: limits.rawBytes, bodyMs: limits.bodyMs,
        declaredBytes });
      const nowMs = protocolClock();
      let request;
      try { request = decodeFixtureRequest(raw, { nowMs }); }
      catch { fail(INGRESS_CODES.DECODE); }
      // One post-body wall deadline covers both credential resolution and the
      // handler. Socket closure cancels cooperative work immediately.
      const controller = new AbortController();
      let timer;
      let cancel;
      const deadline = new Promise((_, reject) => {
        cancel = code => { controller.abort(); reject(new Error(code)); };
        timer = setTimeout(() => cancel(INGRESS_CODES.HANDLER_TIMEOUT), limits.handlerMs);
        timer.unref?.();
      });
      const onClose = () => cancel(INGRESS_CODES.CLOSED);
      req.socket.once('close', onClose);
      let bytes;
      try {
        const work = (async () => {
          const { peer, context, producer } = await bindAuthenticatedOperation({
            fingerprintSha256, operation: request.operation, presentedContext: request.context,
            resolveCredential, nowMs, signal: controller.signal });
          if (controller.signal.aborted) fail(INGRESS_CODES.HANDLER_TIMEOUT);
          return dispatch.dispatch({ operation: request.operation, peer, context, producer,
            request, nowMs, validationClock: protocolClock, signal: controller.signal });
        })();
        ({ bytes } = await Promise.race([work, deadline]));
      } finally {
        clearTimeout(timer);
        req.socket.removeListener('close', onClose);
        controller.abort();
      }
      transmitCanonicalResponse(res, bytes);
    } catch (error) {
      // Every refusal is a bodyless transport failure; no protocol outcome is synthesized.
      transmitTransportFailure(res, refusalCode(error));
    }
  }

  const server = createFixtureTlsServer({ tls, bind, limits,
    onRequest: (req, res) => { pipeline(req, res).catch(() => transmitTransportFailure(res,
      INGRESS_CODES.DISPATCH)); } });

  return Object.freeze({
    start: () => server.start(),
    close: () => server.close(),
    address: () => server.address(),
    activeConnections: () => server.activeConnections(),
  });
}
