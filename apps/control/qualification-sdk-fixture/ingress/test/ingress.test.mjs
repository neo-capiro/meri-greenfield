// Real loopback mTLS tests for the private fixture ingress transport.
//
// These tests prove transport behaviour only. The fake resolver and handlers
// stand in for trusted composition; they are not durable-state evidence, not an
// admitted identity and not proof of live policy, durability or G1 acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { INGRESS_CODES } from '../errors.mjs';
import { INGRESS_MAX_WIRE_BYTES, INGRESS_OPERATIONS, INGRESS_PATH } from '../config.mjs';
import { createFixtureIngress } from '../index.mjs';
import { bindRequestEnvelope, readBoundedRawBody } from '../http-request.mjs';
import { decodeFixtureResponse } from '../../../../../packages/contracts/qualification-sdk/wire.mjs';
import { CERTS, PATH, TRUSTED_FINGERPRINT, httpsCall, rawCall, startIngress, waitFor }
  from './harness.mjs';
import { NOW, fixture, requestFor, responseFor, wire } from './fixture-data.mjs';

const PEER = Object.freeze({ peerId: 'fixture-worker-a', credentialId: 'cred-ingress-1' });
const audienceFor = (f, operation) => operation === 'authorizeFixturePhase' ? [f.producer, f.current]
  : operation === 'commitFixtureCheckpoint' ? [f.producer] : [f.current];

/** Fake trusted resolver: maps the socket fingerprint and operation to a binding. */
function trustedResolver(f, { operations = INGRESS_OPERATIONS, audience } = {}) {
  return async ({ fingerprintSha256, operation }) => {
    if (fingerprintSha256 !== TRUSTED_FINGERPRINT || !operations.includes(operation)) return null;
    return { peer: { ...PEER }, context: f.current, producer: f.producer,
      audience: audience ?? audienceFor(f, operation) };
  };
}

/** Fake trusted handler table returning one valid canonical response per operation. */
function trustedHandlers(f, overrides = {}) {
  return Object.fromEntries(INGRESS_OPERATIONS.map(operation =>
    [operation, overrides[operation] ?? (async ({ request }) => responseFor(f, request))]));
}

function text(response) { return response.body.toString('utf8'); }

test('an authorized client dispatches exactly one canonical response over real mTLS', async t => {
  const f = fixture();
  const request = requestFor(f, 'authorizeFixturePhase');
  const seen = [];
  const { ingress, port, calls } = await startIngress(t, {
    resolver: trustedResolver(f),
    handlers: trustedHandlers(f, { authorizeFixturePhase: async input => {
      seen.push(input);
      return responseFor(f, input.request);
    } }),
  });
  const response = await httpsCall({ port, body: wire(request) });

  assert.equal(response.status, 200);
  assert.equal(response.headers['content-type'], 'application/json');
  assert.equal(response.headers['connection'], 'close');
  assert.equal(response.headers['content-encoding'], undefined);
  assert.equal(response.headers['location'], undefined);
  assert.equal(response.headers['content-length'], String(response.body.length));
  assert.equal(calls.resolver.length, 1);
  assert.equal(calls.resolver[0].fingerprintSha256, TRUSTED_FINGERPRINT);
  assert.equal(calls.resolver[0].operation, 'authorizeFixturePhase');
  assert.equal(calls.resolver[0].signal.aborted, true);
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].peer, PEER);
  assert.deepEqual(seen[0].context, f.current);
  assert.deepEqual(seen[0].producer, f.producer);
  assert.equal(seen[0].request.requestId, request.requestId);
  assert.equal(seen[0].signal.aborted, true, 'owned handler cancellation is cleaned up');

  const decoded = decodeFixtureResponse(response.body, request, { producer: f.producer, nowMs: NOW });
  assert.equal(decoded.status, 'AUTHORIZED');
  assert.equal(ingress.address().host, '127.0.0.1');
});

test('commit, load and verify dispatch their canonical responses and round-trip on the wire', async t => {
  const f = fixture();
  const { port } = await startIngress(t, { resolver: trustedResolver(f), handlers: trustedHandlers(f) });
  for (const [operation, status] of [['commitFixtureCheckpoint', 'COMMITTED'],
    ['loadFixtureCheckpoint', 'LOADED'], ['verifyFixtureCheckpoint', 'VERIFIED']]) {
    const request = requestFor(f, operation);
    const response = await httpsCall({ port, body: wire(request) });
    assert.equal(response.status, 200, `${operation} status`);
    const decoded = decodeFixtureResponse(response.body, request, { producer: f.producer, nowMs: NOW });
    assert.equal(decoded.status, status);
  }
});

test('the authenticated socket certificate, not a header or body field, establishes the peer', async t => {
  const f = fixture();
  const request = requestFor(f, 'authorizeFixturePhase');
  const { port, calls } = await startIngress(t, { resolver: trustedResolver(f), handlers: trustedHandlers(f) });

  // A trusted certificate with allowlisted spoofed header values still resolves
  // to the socket fingerprint.
  const spoofed = await httpsCall({ port, body: wire(request),
    headers: { 'user-agent': TRUSTED_FINGERPRINT, accept: TRUSTED_FINGERPRINT } });
  assert.equal(spoofed.status, 200);
  assert.equal(calls.resolver.length, 1);
  assert.equal(calls.resolver[0].fingerprintSha256, TRUSTED_FINGERPRINT);

  // A credential header outside the fixed envelope is refused outright.
  const extra = await httpsCall({ port, body: wire(request),
    headers: { 'x-client-cert-sha256': TRUSTED_FINGERPRINT } });
  assert.equal(extra.status, 400);
  assert.equal(calls.resolver.length, 1, 'a spoofed header never reaches resolution');
});

test('an absent or untrusted client certificate never reaches fixture dispatch', async t => {
  const f = fixture();
  const request = requestFor(f, 'authorizeFixturePhase');
  const { port, calls } = await startIngress(t, { resolver: trustedResolver(f), handlers: trustedHandlers(f) });

  await assert.rejects(httpsCall({ port, client: 'absent', body: wire(request) }));
  assert.equal(calls.resolver.length, 0, 'no certificate means no peer resolution');
  await assert.rejects(httpsCall({ port, client: 'rogue', body: wire(request) }));
  assert.equal(calls.resolver.length, 0, 'a certificate from an untrusted CA is refused at the handshake');
  // Whichever layer refuses first (handshake alert or socket check), no fixture
  // work may happen and no success may be returned.
  const absent = await httpsCall({ port, client: 'absent', body: wire(request) })
    .then(response => response.status, error => error.code);
  assert.ok(absent !== 200, `a certificate-less client must never dispatch (${absent})`);
  assert.equal(calls.resolver.length, 0);

  // A spoofed fingerprint header cannot substitute for the certificate.
  const spoof = await rawCall({ port, client: 'rogue', text: `POST ${PATH} HTTP/1.1\r\nHost: 127.0.0.1\r\n` +
    `x-client-cert-sha256: ${TRUSTED_FINGERPRINT}\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{}` });
  assert.equal(spoof.text, '');
  assert.equal(calls.resolver.length, 0);

  // The listener is still healthy after those refusals.
  const response = await httpsCall({ port, body: wire(request) });
  assert.equal(response.status, 200);
});

test('an unknown credential or an unbound operation refuses without dispatch', async t => {
  const f = fixture();
  const request = requestFor(f, 'verifyFixtureCheckpoint');
  const seen = [];
  const { port, calls } = await startIngress(t, {
    resolver: trustedResolver(f, { operations: ['authorizeFixturePhase'] }),
    handlers: trustedHandlers(f, { verifyFixtureCheckpoint: async input => {
      seen.push(input); return responseFor(f, input.request);
    } }),
  });
  const response = await httpsCall({ port, body: wire(request) });
  assert.equal(response.status, 403);
  assert.equal(text(response), '');
  assert.equal(calls.resolver.length, 1);
  assert.equal(seen.length, 0, 'an unbound operation never dispatches');

  const unknown = await startIngress(t, { resolver: async () => null, handlers: trustedHandlers(f) });
  const refused = await httpsCall({ port: unknown.port, body: wire(requestFor(f, 'authorizeFixturePhase')) });
  assert.equal(refused.status, 403);
  assert.equal(text(refused), '');
  assert.equal(unknown.calls.resolver.length, 1);
});

test('a context outside the credential audience refuses without any stale denial', async t => {
  const f = fixture();
  const request = requestFor(f, 'authorizeFixturePhase'); // presents the historical producer
  const seen = [];
  const { port } = await startIngress(t, {
    resolver: trustedResolver(f, { audience: [f.current] }),
    handlers: trustedHandlers(f, { authorizeFixturePhase: async input => {
      seen.push(input); return responseFor(f, input.request);
    } }),
  });
  const response = await httpsCall({ port, body: wire(request) });
  assert.equal(response.status, 403);
  assert.equal(text(response), '');
  assert.equal(seen.length, 0, 'a mismatched context is DATA only and never dispatches');
});

test('an audience entry cannot substitute for the operation-bound producer or current context', async t => {
  const f = fixture();
  for (const operation of ['authorizeFixturePhase', 'verifyFixtureCheckpoint']) {
    const request = requestFor(f, operation);
    const binding = { peer: { ...PEER }, producer: structuredClone(f.producer),
      context: structuredClone(f.current), audience: [request.context] };
    const selected = operation === 'authorizeFixturePhase' ? binding.producer : binding.context;
    selected.identity.grantId = '00000000-0000-4000-9000-000000000999';
    let dispatched = false;
    const { port } = await startIngress(t, { resolver: async () => binding,
      handlers: trustedHandlers(f, { [operation]: async input => {
        dispatched = true; return responseFor(f, input.request);
      } }) });
    const response = await httpsCall({ port, body: wire(request) });
    assert.equal(response.status, 403, operation);
    assert.equal(response.body.length, 0);
    assert.equal(dispatched, false);
  }
});

test('resolver current and producer must share the same canonical run lineage', async t => {
  const f = fixture();
  const wrongCurrent = structuredClone(f.current);
  wrongCurrent.identity.canonical.actorId = 'unrelated-actor';
  const wrongProducer = structuredClone(f.producer);
  wrongProducer.identity.canonical.actorId = 'unrelated-actor';
  const first = await startIngress(t, {
    resolver: async () => ({ peer: { ...PEER }, context: wrongCurrent,
      producer: f.producer, audience: [f.producer] }),
    handlers: trustedHandlers(f),
  });
  const second = await startIngress(t, {
    resolver: async () => ({ peer: { ...PEER }, context: f.current,
      producer: wrongProducer, audience: [f.current] }),
    handlers: trustedHandlers(f),
  });
  const original = await httpsCall({ port: first.port,
    body: wire(requestFor(f, 'authorizeFixturePhase')) });
  const resumedRequest = requestFor(f, 'authorizeFixturePhase');
  resumedRequest.context = structuredClone(f.current);
  const resumed = await httpsCall({ port: second.port, body: wire(resumedRequest) });
  for (const response of [original, resumed]) {
    assert.equal(response.status, 403);
    assert.equal(response.body.length, 0);
  }
});

test('response freshness uses a trusted clock reading after handler completion', async t => {
  const f = fixture();
  const { port } = await startIngress(t, { resolver: trustedResolver(f),
    handlers: trustedHandlers(f, { authorizeFixturePhase: async ({ request }) => {
      await new Promise(resolve => setTimeout(resolve, 80));
      return { ...responseFor(f, request), checkedAtMs: NOW + 40 };
    } }) });
  const response = await httpsCall({ port, body: wire(requestFor(f, 'authorizeFixturePhase')) });
  assert.equal(response.status, 200);
});

test('a stalled credential resolver meets the post-body deadline and sees cancellation', async t => {
  const f = fixture();
  let signal;
  const { port } = await startIngress(t, { limits: { handlerMs: 120 },
    resolver: async query => { signal = query.signal; return new Promise(() => {}); },
    handlers: trustedHandlers(f) });
  const response = await httpsCall({ port, body: wire(requestFor(f, 'authorizeFixturePhase')) });
  assert.equal(response.status, 504);
  assert.equal(response.body.length, 0);
  assert.equal(signal.aborted, true);
});

test('a cooperative resolver abort still reports the deadline, never a credential decision', async t => {
  const f = fixture();
  const { port } = await startIngress(t, { limits: { handlerMs: 120 },
    resolver: ({ signal }) => new Promise((_, reject) =>
      signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })),
    handlers: trustedHandlers(f) });
  const response = await httpsCall({ port, body: wire(requestFor(f, 'authorizeFixturePhase')) });
  assert.equal(response.status, 504);
  assert.equal(response.body.length, 0);
});

test('method, route, query and HTTP-version anomalies refuse before any dispatch', async t => {
  const f = fixture();
  const request = requestFor(f, 'authorizeFixturePhase');
  const body = wire(request);
  const seen = [];
  const { port, calls } = await startIngress(t, {
    resolver: trustedResolver(f),
    handlers: trustedHandlers(f, { authorizeFixturePhase: async input => {
      seen.push(input); return responseFor(f, input.request);
    } }),
  });
  assert.equal((await httpsCall({ port, method: 'GET', body })).status, 405);
  assert.equal((await httpsCall({ port, path: '/other', body })).status, 404);
  assert.equal((await httpsCall({ port, path: `${PATH}?operation=authorizeFixturePhase`, body })).status, 404);
  assert.equal((await httpsCall({ port, path: `${PATH}/`, body })).status, 404);
  const http10 = await rawCall({ port, text: `POST ${PATH} HTTP/1.0\r\nHost: 127.0.0.1\r\n` +
    `Content-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n${body}` });
  assert.match(http10.text, /^HTTP\/1\.1 400 /);
  assert.equal(calls.resolver.length, 0);
  assert.equal(seen.length, 0);
});

test('media-type, encoding and header anomalies refuse', async t => {
  const f = fixture();
  const body = wire(requestFor(f, 'authorizeFixturePhase'));
  const { port, calls } = await startIngress(t, { resolver: trustedResolver(f), handlers: trustedHandlers(f) });
  assert.equal((await httpsCall({ port, body, headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await httpsCall({ port, body, headers: { 'content-encoding': 'gzip' } })).status, 415);
  assert.equal((await httpsCall({ port, body, headers: { 'x-extra': '1' } })).status, 400);
  const duplicate = await rawCall({ port, text: `POST ${PATH} HTTP/1.1\r\nHost: 127.0.0.1\r\n` +
    `Content-Type: application/json\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n${body}` });
  assert.match(duplicate.text, /^HTTP\/1\.1 400 /);
  const chunked = await rawCall({ port, text: `POST ${PATH} HTTP/1.1\r\nHost: 127.0.0.1\r\n` +
    'Transfer-Encoding: chunked\r\nContent-Type: application/json\r\n\r\n2\r\n{}\r\n0\r\n\r\n' });
  assert.match(chunked.text, /^HTTP\/1\.1 400 /);
  const badLength = await rawCall({ port, text: `POST ${PATH} HTTP/1.1\r\nHost: 127.0.0.1\r\n` +
    'Content-Type: application/json\r\nContent-Length: 0x10\r\n\r\n' });
  assert.match(badLength.text, /^HTTP\/1\.1 400 /);
  assert.equal(calls.resolver.length, 0);
});

test('malformed and noncanonical bodies refuse without dispatch', async t => {
  const f = fixture();
  const request = requestFor(f, 'authorizeFixturePhase');
  const { port, calls } = await startIngress(t, { resolver: trustedResolver(f), handlers: trustedHandlers(f) });
  assert.equal((await httpsCall({ port, body: Buffer.from('not-json') })).status, 400);
  assert.equal((await httpsCall({ port, body: Buffer.concat([wire(request), Buffer.from('\n')]) })).status, 400);
  const padded = JSON.stringify(request).replace('{', '{ ');
  assert.equal((await httpsCall({ port, body: Buffer.from(padded) })).status, 400);
  const reordered = Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(request).reverse())));
  assert.equal((await httpsCall({ port, body: reordered })).status, 400);
  assert.equal(calls.resolver.length, 0);
});

test('the private raw ceiling refuses an oversized declared body without reading it', async t => {
  const f = fixture();
  const { port, calls } = await startIngress(t, { resolver: trustedResolver(f), handlers: trustedHandlers(f) });
  const response = await httpsCall({ port, body: Buffer.alloc(0),
    headers: { 'content-length': String(INGRESS_MAX_WIRE_BYTES + 1) } });
  assert.equal(response.status, 413);
  assert.equal(calls.resolver.length, 0);
});

test('the streaming ceiling refuses while the body is still arriving', async () => {
  const stream = new EventEmitter();
  const pending = readBoundedRawBody(stream, { rawBytes: 1024, bodyMs: 5000, declaredBytes: null });
  stream.emit('data', Buffer.alloc(512));
  stream.emit('data', Buffer.alloc(512));
  stream.emit('data', Buffer.alloc(1));
  const refusal = await pending.then(() => null, error => error.message);
  assert.equal(refusal, INGRESS_CODES.RAW_BOUND);
  assert.equal(stream.listenerCount('data'), 0, 'owned listeners are released on refusal');
});

test('a delivered length that disagrees with the declared length refuses', async () => {
  const stream = new EventEmitter();
  const pending = readBoundedRawBody(stream, { rawBytes: 4096, bodyMs: 5000, declaredBytes: 12 });
  stream.emit('data', Buffer.from('short'));
  stream.emit('end');
  const refusal = await pending.then(() => null, error => error.message);
  assert.equal(refusal, INGRESS_CODES.LENGTH);
});

test('a bounded body without a declared length is accepted', async () => {
  const stream = new EventEmitter();
  const pending = readBoundedRawBody(stream, { rawBytes: 4096, bodyMs: 5000, declaredBytes: null });
  stream.emit('data', Buffer.from('canonical'));
  stream.emit('end');
  const raw = await pending;
  assert.equal(raw.toString('utf8'), 'canonical');
});

test('a request body that never completes times out and closes the socket', async t => {
  const f = fixture();
  const { port } = await startIngress(t, { limits: { bodyMs: 300, handlerMs: 300 },
    resolver: trustedResolver(f), handlers: trustedHandlers(f) });
  const started = Date.now();
  const result = await rawCall({ port, text: `POST ${PATH} HTTP/1.1\r\nHost: 127.0.0.1\r\n` +
    'Content-Type: application/json\r\nContent-Length: 64\r\n\r\n' });
  assert.ok(Date.now() - started < 3000, 'the body bound is enforced promptly');
  assert.match(result.text, /^HTTP\/1\.1 408 /);
});

test('a handler failure is a bodyless 500 and cannot fabricate a stale denial', async t => {
  const f = fixture();
  const { port } = await startIngress(t, { resolver: trustedResolver(f),
    handlers: trustedHandlers(f, { authorizeFixturePhase: async () => {
      throw new Error('DENIED_STALE_BINDING');
    } }) });
  const response = await httpsCall({ port, body: wire(requestFor(f, 'authorizeFixturePhase')) });
  assert.equal(response.status, 500);
  assert.equal(response.body.length, 0);
  assert.ok(!text(response).includes('DENIED'));
});

test('a handler deadline aborts the handler and refuses with 504', async t => {
  const f = fixture();
  let aborted = false;
  const { port } = await startIngress(t, { limits: { handlerMs: 200 },
    resolver: trustedResolver(f),
    handlers: trustedHandlers(f, { authorizeFixturePhase: async ({ signal }) => {
      signal.addEventListener('abort', () => { aborted = true; });
      return new Promise(() => {});
    } }) });
  const response = await httpsCall({ port, body: wire(requestFor(f, 'authorizeFixturePhase')) });
  assert.equal(response.status, 504);
  assert.equal(response.body.length, 0);
  assert.equal(aborted, true);
});

test('a handler response that violates the canonical contract is refused', async t => {
  const f = fixture();
  const request = requestFor(f, 'authorizeFixturePhase');
  const { port } = await startIngress(t, { resolver: trustedResolver(f),
    handlers: trustedHandlers(f, { authorizeFixturePhase: async () =>
      ({ ...request, status: 'DENIED_STALE_BINDING', decisionId: request.requestId,
        checkedAtMs: NOW }) }) });
  const response = await httpsCall({ port, body: wire(request) });
  assert.equal(response.status, 500);
  assert.equal(response.body.length, 0);
});

test('an unhandled operation is refused rather than defaulted', async t => {
  const f = fixture();
  const { port } = await startIngress(t, { resolver: trustedResolver(f), handlers: trustedHandlers(f) });
  const request = requestFor(f, 'authorizeFixturePhase');
  const tampered = { ...request, operation: 'deleteEverything' };
  const response = await httpsCall({ port, body: wire(tampered) });
  assert.equal(response.status, 400, 'the canonical decoder owns the operation vocabulary');
});

test('a completed request closes its connection and close() unbinds the listener', async t => {
  const f = fixture();
  const { ingress, port } = await startIngress(t, { resolver: trustedResolver(f), handlers: trustedHandlers(f) });
  const response = await httpsCall({ port, body: wire(requestFor(f, 'authorizeFixturePhase')) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.connection, 'close');
  assert.equal(await waitFor(() => ingress.activeConnections() === 0), true, 'the owned socket closes');

  await ingress.close();
  assert.equal(ingress.address(), null);
  assert.equal(ingress.activeConnections(), 0);
  await assert.rejects(httpsCall({ port, body: wire(requestFor(f, 'authorizeFixturePhase')) }));
});

test('composition refuses unsafe or unknown options and binds nothing before start()', async t => {
  const f = fixture();
  const base = { bind: { host: '127.0.0.1', port: 0 },
    tls: { cert: CERTS.serverCert, key: CERTS.serverKey, clientCa: CERTS.ca },
    resolveCredential: trustedResolver(f), handlers: trustedHandlers(f) };
  assert.throws(() => createFixtureIngress({ ...base, rejectUnauthorized: false }),
    /FIXTURE_INGRESS_CONFIG/);
  assert.throws(() => createFixtureIngress({ ...base,
    tls: { ...base.tls, rejectUnauthorized: false } }), /FIXTURE_INGRESS_CONFIG/);
  assert.throws(() => createFixtureIngress({ ...base, insecure: true }), /FIXTURE_INGRESS_CONFIG/);
  assert.throws(() => createFixtureIngress({ ...base,
    limits: { bodyMs: 60000, handlerMs: 60000 } }), /FIXTURE_INGRESS_CONFIG/);
  assert.throws(() => createFixtureIngress({ ...base, handlers: { authorizeFixturePhase: async () => ({}) } }),
    /FIXTURE_INGRESS_CONFIG/);

  const ingress = createFixtureIngress(base);
  assert.equal(ingress.address(), null, 'importing and composing binds nothing');
  assert.equal(ingress.activeConnections(), 0);
  await ingress.start();
  assert.notEqual(ingress.address(), null);
  await ingress.close();
});

test('concurrent start and close during startup leave no listener', async () => {
  const f = fixture();
  const ingress = createFixtureIngress({ bind: { host: '127.0.0.1', port: 0 },
    tls: { cert: CERTS.serverCert, key: CERTS.serverKey, clientCa: CERTS.ca },
    resolveCredential: trustedResolver(f), handlers: trustedHandlers(f), now: () => NOW });
  const first = ingress.start();
  const second = ingress.start();
  assert.strictEqual(first, second);
  await ingress.close();
  await assert.rejects(first, /FIXTURE_INGRESS_CLOSED/);
  assert.equal(ingress.address(), null);
  assert.equal(ingress.activeConnections(), 0);
  assert.throws(() => ingress.start(), /FIXTURE_INGRESS_CLOSED/);
});

test('the ingress source is inert: no ambient configuration, no implicit listener', () => {
  const base = new URL('../', import.meta.url);
  const modules = ['errors.mjs', 'config.mjs', 'http-request.mjs', 'http-response.mjs', 'authority.mjs',
    'dispatch.mjs', 'server.mjs', 'index.mjs'];
  for (const name of modules) {
    const source = readFileSync(new URL(name, base), 'utf8');
    assert.ok(!source.includes('process.env'), `${name} must not read ambient configuration`);
    assert.ok(!/from 'node:(fs|child_process|net)'/.test(source) || name === 'config.mjs',
      `${name} must not reach the filesystem or spawn processes`);
    assert.ok(!source.includes('readFileSync'), `${name} must not load credential material from disk`);
    if (name !== 'server.mjs') assert.ok(!source.includes('createServer'),
      `${name} must not create a listener`);
  }
  const requestModule = readFileSync(new URL('http-request.mjs', base), 'utf8');
  assert.ok(requestModule.includes('INGRESS_ALLOWED_HEADERS'));
  const envelope = bindRequestEnvelope({ httpVersion: '1.1', method: 'POST', url: PATH,
    rawHeaders: ['host', '127.0.0.1', 'content-length', '0', 'content-type', 'application/json'] },
  { path: PATH, rawBytes: 16 });
  assert.deepEqual(envelope, { declaredBytes: 0 });
});
