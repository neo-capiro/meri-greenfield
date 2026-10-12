// Real loopback mTLS harness for the ingress tests.
//
// Synthetic CA/server/client certificates are generated outside Git under
// `.task-inputs/sdk-fixture-ingress-1/` (see the report for the exact openssl
// commands). These helpers only exercise the transport; they are never durable
// state, an admitted identity or evidence of live policy.
import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import https from 'node:https';
import tls from 'node:tls';
import { createFixtureIngress } from '../index.mjs';
import { INGRESS_PATH } from '../config.mjs';
import { NOW } from './fixture-data.mjs';

const CERT_DIR = new URL('../../../../../.task-inputs/sdk-fixture-ingress-1/certs/', import.meta.url);

function read(name) {
  try { return readFileSync(new URL(name, CERT_DIR)); }
  catch {
    throw new Error(`FIXTURE_TEST_CERTS_MISSING: generate the synthetic test certificates under ` +
      `.task-inputs/sdk-fixture-ingress-1/certs (see the task report) - missing ${name}`);
  }
}

export const CERTS = Object.freeze({
  serverCert: read('server.crt'), serverKey: read('server.key'),
  ca: read('ca1.crt'), otherCa: read('ca2.crt'),
  clientCert: read('client-trusted.crt'), clientKey: read('client-trusted.key'),
  clientBCert: read('client-trusted-b.crt'), clientBKey: read('client-trusted-b.key'),
  rogueCert: read('client-untrusted.crt'), rogueKey: read('client-untrusted.key'),
});

/** SHA-256 of the trusted client certificate, as the ingress derives it from the socket. */
export const TRUSTED_FINGERPRINT = new X509Certificate(CERTS.clientCert).fingerprint256
  .replace(/:/g, '').toLowerCase();
export const TRUSTED_B_FINGERPRINT = new X509Certificate(CERTS.clientBCert).fingerprint256
  .replace(/:/g, '').toLowerCase();

export const PATH = INGRESS_PATH;

/** Monotonic synthetic protocol clock: NOW at start, advancing with wall time. */
export function testClock() {
  const wall = Date.now();
  return () => NOW + (Date.now() - wall);
}

/**
 * Starts one owned ingress on loopback and registers physical cleanup.
 * The resolver/handlers are fakes: they verify transport behaviour only.
 */
export async function startIngress(t, { limits, resolver, handlers, tls } = {}) {
  const calls = { resolver: [], handlers: [] };
  const ingress = createFixtureIngress({
    bind: { host: '127.0.0.1', port: 0 },
    tls: tls ?? { cert: CERTS.serverCert, key: CERTS.serverKey, clientCa: CERTS.ca },
    ...(limits === undefined ? {} : { limits }),
    resolveCredential: async query => {
      calls.resolver.push(query);
      return resolver === undefined ? null : await resolver(query);
    },
    handlers: handlers ?? Object.fromEntries(['authorizeFixturePhase', 'commitFixtureCheckpoint',
      'loadFixtureCheckpoint', 'verifyFixtureCheckpoint'].map(name => [name, async () => {
        throw new Error('FIXTURE_TEST_HANDLER_UNSET');
      }])),
    now: testClock(),
  });
  const address = await ingress.start();
  t.after(async () => { await ingress.close(); });
  return { ingress, port: address.port, calls };
}

/** One real mTLS POST/PUT/GET through node:https; rejects on transport failure. */
export function httpsCall({ port, path = PATH, method = 'POST', body = Buffer.alloc(0),
  headers = {}, client = 'trusted', ca = CERTS.ca }) {
  return new Promise((resolve, reject) => {
    const options = { host: '127.0.0.1', port, path, method, ca, agent: false,
      minVersion: 'TLSv1.3', headers: { 'content-type': 'application/json',
        'content-length': String(body.length), ...headers } };
    if (client === 'trusted') { options.cert = CERTS.clientCert; options.key = CERTS.clientKey; }
    if (client === 'trusted-b') { options.cert = CERTS.clientBCert; options.key = CERTS.clientBKey; }
    if (client === 'rogue') { options.cert = CERTS.rogueCert; options.key = CERTS.rogueKey; }
    const request = https.request(options, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers,
        body: Buffer.concat(chunks) }));
      response.on('error', reject);
    });
    request.on('error', reject);
    request.end(body);
  });
}

/** One raw TLS request, so malformed framing can be sent verbatim. Never rejects. */
export function rawCall({ port, text, client = 'trusted', ca = CERTS.ca, timeoutMs = 5000 }) {
  return new Promise(resolve => {
    const options = { host: '127.0.0.1', port, ca, minVersion: 'TLSv1.3' };
    if (client === 'trusted') { options.cert = CERTS.clientCert; options.key = CERTS.clientKey; }
    if (client === 'trusted-b') { options.cert = CERTS.clientBCert; options.key = CERTS.clientBKey; }
    if (client === 'rogue') { options.cert = CERTS.rogueCert; options.key = CERTS.rogueKey; }
    let settled = false, data = '';
    const socket = tls.connect(options, () => { socket.write(text); });
    function settle(error) {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch { /* already closed */ }
      resolve({ text: data, error: error ? (error.code ?? 'ERROR') : null });
    }
    socket.on('data', chunk => { data += chunk.toString('utf8'); });
    socket.on('close', () => settle(null));
    socket.on('error', error => settle(error));
    socket.setTimeout(timeoutMs, () => settle(null));
  });
}

/** Waits briefly for a condition; used to observe socket/server teardown. */
export async function waitFor(predicate, { attempts = 50, delayMs = 20 } = {}) {
  for (let index = 0; index < attempts; index++) {
    if (predicate()) return true;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return predicate();
}
