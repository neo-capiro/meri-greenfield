// Owned TLS server lifecycle for the private mTLS ingress.
//
// This module owns exactly one TLS listener: its creation from owner-supplied
// material, explicit listen/close, and the connection bookkeeping the caller
// needs to prove physical cleanup. Nothing here reads credentials, environment
// or files, and nothing listens until the caller invokes start().
//
// Client authentication is mandatory and cannot be relaxed: the server requests
// and requires a client certificate, verifies it against the owner-supplied CA,
// and negotiates TLS 1.3 only. There is no insecure, no-verify or plaintext
// option anywhere in this module.
import https from 'node:https';
import { INGRESS_TLS_VERSION } from './config.mjs';
import { INGRESS_CODES, fail } from './errors.mjs';

const MAX_HEADERS = 32;

/**
 * @param {{tls: {cert: Buffer, key: Buffer, clientCa: Buffer}, bind: {host: string, port: number},
 *   limits: {bodyMs: number}, onRequest: Function}} options
 */
export function createFixtureTlsServer({ tls, bind, limits, onRequest }) {
  if (typeof onRequest !== 'function') fail(INGRESS_CODES.CONFIG);
  const sockets = new Set();
  let listening = false;
  let closed = false;
  let starting = null;
  let closing = null;

  const server = https.createServer({
    cert: tls.cert,
    key: tls.key,
    ca: tls.clientCa,
    requestCert: true,
    rejectUnauthorized: true,
    minVersion: INGRESS_TLS_VERSION,
    maxVersion: INGRESS_TLS_VERSION,
    keepAlive: false,
  }, onRequest);

  server.maxHeadersCount = MAX_HEADERS;
  // The ingress body/handler timers are the authoritative bounds; Node's request
  // timeout is only the outer backstop for the whole body+handler budget.
  server.headersTimeout = Math.min(limits.bodyMs, 10000);
  server.requestTimeout = limits.bodyMs + limits.handlerMs;

  // A failed or certificate-less handshake never reaches the request pipeline.
  server.on('tlsClientError', (error, socket) => { try { socket.destroy(); } catch { /* closed */ } });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => { /* transport-level peer failure is not a product outcome */ });
  });

  function address() {
    const bound = server.address();
    if (listening && bound !== null && typeof bound === 'object') {
      return Object.freeze({ host: bound.address, port: bound.port });
    }
    return null;
  }

  /** Explicit listen. Resolves with the bound address and never leaks a listener on failure. */
  function start() {
    if (closed) fail(INGRESS_CODES.CLOSED);
    if (listening) return Promise.resolve(address());
    if (starting !== null) return starting;
    starting = new Promise((resolve, reject) => {
      function cleanup() {
        server.removeListener('error', onError);
        server.removeListener('listening', onListening);
      }
      function onError() {
        cleanup();
        try { server.close(); } catch { /* never listened */ }
        reject(new Error(INGRESS_CODES.LISTEN));
      }
      function onListening() {
        cleanup();
        listening = true;
        if (closed) reject(new Error(INGRESS_CODES.CLOSED));
        else resolve(address());
      }
      server.on('error', onError);
      server.on('listening', onListening);
      try { server.listen({ host: bind.host, port: bind.port, exclusive: true }); }
      catch { onError(); }
    }).finally(() => { starting = null; });
    return starting;
  }

  /** Explicit close: stops accepting, destroys owned sockets, resolves when nothing is bound. */
  function close() {
    if (closing !== null) return closing;
    closed = true;
    closing = (async () => {
      if (starting !== null) await starting.catch(() => {});
      for (const socket of sockets) { try { socket.destroy(); } catch { /* already closed */ } }
      sockets.clear();
      if (server.listening) await new Promise(resolve => server.close(() => resolve()));
      listening = false;
    })();
    return closing;
  }

  return Object.freeze({ start, close, address, activeConnections: () => sockets.size });
}
