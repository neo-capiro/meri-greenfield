import test from 'node:test';
import assert from 'node:assert/strict';
import canonicalize from 'canonicalize';
import { fixture, response as fixtureResponse, NOW as FIXTURE_NOW, id as fixtureId,
  canonicalize as canon } from '../../../../packages/contracts/test/sdk-fixture-wire.test.mjs';
import { createFixtureChannel } from './fixture-channel.mjs';
import {
  createFixtureHttpsTransport,
  FIXTURE_TRANSPORT_CHANNEL_VERSION, FIXTURE_TRANSPORT_PROFILE, FIXTURE_TRANSPORT_OPERATIONS,
  FIXTURE_TRANSPORT_METHOD, FIXTURE_TRANSPORT_MIN_TLS, FIXTURE_TRANSPORT_MAX_LIMIT_BYTES,
  FIXTURE_TRANSPORT_APPROVED_PORTS,
} from './fixture-transport.mjs';

// Offline only: every case injects a fake https boundary. No socket, DNS,
// TLS handshake, certificate or network call is made by this file.

const NOW = 1_000_000;
const PIN = 'ab'.repeat(32);
const PIN_COLON = PIN.match(/../g).join(':').toUpperCase();
const ORIGIN = 'https://fixture.internal';
const PATH = '/sdk-fixture/v1';
const CANARY = 'BODY_CANARY_MARKER';
const PRIVATE = 'PRIVATE_MARKER';
const MATERIAL = {
  cert: Buffer.from('-----BEGIN CERTIFICATE-----\nSYNTHETIC\n-----END CERTIFICATE-----\n'),
  key: Buffer.from('-----BEGIN PRIVATE KEY-----\nSYNTHETIC\n-----END PRIVATE KEY-----\n'),
  ca: Buffer.from('-----BEGIN CERTIFICATE-----\nSYNTHETIC-CA\n-----END CERTIFICATE-----\n'),
};
const bytes = (operation = 'authorizeFixturePhase', patch = {}) => Buffer.from(canonicalize({
  channelVersion: FIXTURE_TRANSPORT_CHANNEL_VERSION, profile: FIXTURE_TRANSPORT_PROFILE,
  operation, requestId: '00000000-0000-4000-8000-000000000070',
  context: { runUuid: '00000000-0000-4000-8000-000000000001', phase: 'interrupt' },
  canary: CANARY, ...patch,
}));
const call = (operation = 'authorizeFixturePhase', patch = {}) => ({
  operation, requestBytes: bytes(operation), deadlineMs: NOW + 5000, ...patch,
});

function fakeHttps() {
  const state = { options: [], sent: [], destroyed: 0, moduleDestroyed: 0, handlers: new Map(), respond: null };
  const module = {
    request(options, onResponse) {
      state.options.push(options); state.respond = onResponse;
      const req = {
        on(type, handler) { state.handlers.set(type, handler); return req; },
        end(chunk) { state.sent.push(chunk); return req; },
        destroy() { state.destroyed += 1; return req; },
        emit(type, value) { state.handlers.get(type)?.(value); },
      };
      return req;
    },
    destroy() { state.moduleDestroyed += 1; },
  };
  return { module, state };
}

function fakeResponse({ statusCode = 200, headers = { 'content-type': 'application/json' }, chunks = [], end = true } = {}) {
  const listeners = new Map();
  const res = {
    statusCode, headers, destroyed: 0,
    on(type, handler) { listeners.set(type, [...(listeners.get(type) ?? []), handler]); return res; },
    destroy() { res.destroyed += 1; return res; },
    emit(type, value) { for (const handler of listeners.get(type) ?? []) handler(value); },
  };
  res.plan = () => { for (const chunk of chunks) res.emit('data', chunk); if (end) res.emit('end'); };
  return res;
}

function composition(extra = {}) {
  const fake = fakeHttps();
  const transport = createFixtureHttpsTransport({
    endpoint: { origin: ORIGIN, path: PATH },
    identity: { pinSha256: PIN },
    mtls: { ...MATERIAL },
    limits: { requestBytes: 4096, responseBytes: 1024 },
    contentType: 'application/json',
    httpsModule: fake.module,
    now: () => NOW,
    ...extra,
  });
  return { fake, transport };
}

function spySignal() {
  const listeners = new Set();
  const spy = {
    aborted: false, aborts: 0, listeners,
    addEventListener(type, handler) { listeners.add(handler); },
    removeEventListener(type, handler) { listeners.delete(handler); },
    abort() { spy.aborts += 1; spy.aborted = true; for (const handler of [...listeners]) handler(); },
  };
  return spy;
}

const refusal = async (promise, code) => {
  await assert.rejects(promise, error => error instanceof Error && error.message === code);
};

// ---------------------------------------------------------------------------
// Trusted composition is validated once and fails closed
// ---------------------------------------------------------------------------

const CONFIG_CASES = [
  ['a plain-HTTP origin', { endpoint: { origin: 'http://fixture.internal', path: PATH } }],
  ['credentials embedded in the origin URL', { endpoint: { origin: 'https://user:secret@fixture.internal', path: PATH } }],
  ['a query string on the origin', { endpoint: { origin: `${ORIGIN}/?a=1`, path: PATH } }],
  ['a fragment on the origin', { endpoint: { origin: `${ORIGIN}/#x`, path: PATH } }],
  ['a non-root origin path', { endpoint: { origin: `${ORIGIN}/other`, path: PATH } }],
  ['a non-numeric or unapproved port', { endpoint: { origin: 'https://fixture.internal:8443', path: PATH } }],
  ['an approved-port list that is empty or malformed', { approvedPorts: [] }],
  ['a relative request path', { endpoint: { origin: ORIGIN, path: 'sdk-fixture/v1' } }],
  ['a request path carrying a query, fragment or backslash', { endpoint: { origin: ORIGIN, path: `${PATH}?a=1` } }],
  ['a request path with traversal segments', { endpoint: { origin: ORIGIN, path: '/a/../b' } }],
  ['an encoded or double-slash request path', { endpoint: { origin: ORIGIN, path: '/sdk/%2e%2e//v1' } }],
  ['a missing or malformed peer pin', { identity: { pinSha256: 'not-a-fingerprint' } }],
  ['a missing certificate, key or CA', { mtls: { cert: MATERIAL.cert, key: MATERIAL.key } }],
  ['empty certificate material', { mtls: { cert: '', key: MATERIAL.key, ca: MATERIAL.ca } }],
  ['missing limits', { limits: undefined }],
  ['non-integer or oversized limits', { limits: { requestBytes: 0, responseBytes: 1024 } }],
  ['an oversized limit above the fixed ceiling', { limits: { requestBytes: FIXTURE_TRANSPORT_MAX_LIMIT_BYTES + 1, responseBytes: 1024 } }],
  ['a missing or parameterised content type', { contentType: 'application/json; charset=utf-8' }],
  ['a non-JSON content type', { contentType: 'text/plain' }],
  ['an https boundary without request()', { httpsModule: {} }],
  ['a non-function clock', { now: 1 }],
];

test('invalid trusted composition is refused before any dispatch', () => {
  for (const [label, patch] of CONFIG_CASES) {
    const fake = fakeHttps();
    assert.throws(() => createFixtureHttpsTransport({
      endpoint: { origin: ORIGIN, path: PATH }, identity: { pinSha256: PIN }, mtls: { ...MATERIAL },
      limits: { requestBytes: 4096, responseBytes: 1024 }, contentType: 'application/json',
      httpsModule: fake.module, now: () => NOW, ...patch,
    }), /FIXTURE_TRANSPORT_CONFIG/, label);
    assert.equal(fake.state.options.length, 0, `${label} must not dispatch`);
  }
});

test('an approved non-default port is accepted only when explicitly listed', () => {
  const fake = fakeHttps();
  const transport = createFixtureHttpsTransport({
    endpoint: { origin: 'https://fixture.internal:8443', path: PATH }, identity: { pinSha256: PIN },
    mtls: { ...MATERIAL }, limits: { requestBytes: 4096, responseBytes: 1024 },
    contentType: 'application/json', approvedPorts: [8443], httpsModule: fake.module, now: () => NOW,
  });
  assert.equal(typeof transport, 'function');
  assert.equal(fake.state.options.length, 0);
});

// ---------------------------------------------------------------------------
// Unsafe calls refuse before any network allocation
// ---------------------------------------------------------------------------

test('an operation outside the closed four-operation profile refuses before dispatch', async () => {
  const { fake, transport } = composition();
  for (const operation of ['arbitrary', 'authorizeFixturePhases', '', 'commitfixturecheckpoint', undefined]) {
    await refusal(transport({ ...call('authorizeFixturePhase'), operation }), 'FIXTURE_TRANSPORT_INPUT');
  }
  assert.equal(fake.state.options.length, 0);
});

test('a non-Buffer, empty or oversized request body refuses before dispatch', async () => {
  const { fake, transport } = composition();
  // Non-Buffer and empty input is an input error, not a bound error.
  for (const requestBytes of ['{"a":1}', undefined, null, 42, {}, Buffer.alloc(0)]) {
    await refusal(transport({ ...call('authorizeFixturePhase'), requestBytes }), 'FIXTURE_TRANSPORT_INPUT');
  }
  for (const size of [4097, 8192]) {
    await refusal(transport({ ...call('authorizeFixturePhase'), requestBytes: Buffer.alloc(size, 0x20) }),
      'FIXTURE_TRANSPORT_REQUEST_BOUND');
  }
  assert.equal(fake.state.options.length, 0);
});

test('a non-integer deadline or malformed signal refuses before dispatch', async () => {
  const { fake, transport } = composition();
  for (const deadlineMs of [NOW + 1.5, '1000', undefined, NaN, Infinity]) {
    await refusal(transport({ ...call('authorizeFixturePhase'), deadlineMs }), 'FIXTURE_TRANSPORT_INPUT');
  }
  for (const signal of [null, {}, { aborted: false }, { aborted: 'no', addEventListener() {}, removeEventListener() {} }]) {
    await refusal(transport({ ...call('authorizeFixturePhase'), signal }), 'FIXTURE_TRANSPORT_INPUT');
  }
  assert.equal(fake.state.options.length, 0);
});

test('malformed, noncanonical or profile-mismatched bytes refuse before dispatch', async () => {
  const { fake, transport } = composition();
  const valid = bytes('authorizeFixturePhase');
  // Guard: this case must differ in raw bytes while parsing to the same DATA.
  const escaped = Buffer.from(valid.toString().replace('"canary":"B', '"canary":"\\u0042'));
  assert.notEqual(escaped.toString(), valid.toString());
  assert.deepEqual(JSON.parse(escaped.toString()), JSON.parse(valid.toString()));
  const hostile = [
    Buffer.from('not json'),
    Buffer.from([0xef, 0xbb, 0xbf, ...valid]),
    Buffer.concat([valid, Buffer.from('\n')]),
    Buffer.from(' ' + valid.toString()),
    // Same parsed DATA, different raw bytes: an unnecessary escape is not canonical.
    Buffer.from(valid.toString().replace('"canary":"B', '"canary":"\\u0042')),
    Buffer.from(canonicalize({ channelVersion: 'other/1', profile: FIXTURE_TRANSPORT_PROFILE, operation: 'authorizeFixturePhase' })),
    Buffer.from(canonicalize({ channelVersion: FIXTURE_TRANSPORT_CHANNEL_VERSION, profile: 'other-profile', operation: 'authorizeFixturePhase' })),
    Buffer.from('null'), Buffer.from('[]'), Buffer.from('"x"'),
  ];
  for (const requestBytes of hostile) {
    await refusal(transport({ ...call('authorizeFixturePhase'), requestBytes }), 'FIXTURE_TRANSPORT_PROFILE');
  }
  // The body's own operation must match the invoked operation.
  await refusal(transport({ ...call('loadFixtureCheckpoint'), requestBytes: bytes('verifyFixtureCheckpoint') }),
    'FIXTURE_TRANSPORT_PROFILE');
  await refusal(transport({ ...call('authorizeFixturePhase'), requestBytes: bytes('arbitrary') }),
    'FIXTURE_TRANSPORT_PROFILE');
  assert.equal(fake.state.options.length, 0);
});

test('an expired budget or an already-aborted signal refuses before dispatch', async () => {
  const { fake, transport } = composition();
  await refusal(transport({ ...call('authorizeFixturePhase'), deadlineMs: NOW }), 'FIXTURE_TRANSPORT_BUDGET');
  await refusal(transport({ ...call('authorizeFixturePhase'), deadlineMs: NOW - 1 }), 'FIXTURE_TRANSPORT_BUDGET');
  await refusal(transport({ ...call('authorizeFixturePhase'), deadlineMs: NOW + 60001 }), 'FIXTURE_TRANSPORT_BUDGET');
  const signal = spySignal(); signal.abort();
  await refusal(transport({ ...call('authorizeFixturePhase'), signal }), 'FIXTURE_TRANSPORT_BUDGET');
  assert.equal(fake.state.options.length, 0);
  const clock = composition({ now: () => { throw new Error(PRIVATE); } });
  await refusal(clock.transport(call('authorizeFixturePhase')), 'FIXTURE_TRANSPORT_BUDGET');
  assert.equal(clock.fake.state.options.length, 0);
});

// ---------------------------------------------------------------------------
// One fixed POST per invocation, from trusted composition only
// ---------------------------------------------------------------------------

test('exactly one fixed POST carries the raw canonical bytes and trusted TLS options', async () => {
  const { fake, transport } = composition();
  const requestBytes = bytes('commitFixtureCheckpoint');
  const pending = transport({ operation: 'commitFixtureCheckpoint', requestBytes, deadlineMs: NOW + 60000 });
  assert.equal(fake.state.options.length, 1, 'one dispatch');
  assert.equal(fake.state.sent.length, 1, 'one send');
  assert.ok(fake.state.sent[0].equals(requestBytes), 'raw canonical request bytes preserved verbatim');
  const options = fake.state.options[0];
  assert.equal(options.method, FIXTURE_TRANSPORT_METHOD);
  assert.equal(options.protocol, 'https:');
  assert.equal(options.hostname, 'fixture.internal');
  assert.equal(options.port, 443);
  assert.equal(options.path, PATH);
  assert.equal(options.agent, false);
  assert.equal(options.rejectUnauthorized, true);
  assert.equal(options.minVersion, FIXTURE_TRANSPORT_MIN_TLS);
  assert.equal(options.servername, 'fixture.internal');
  assert.deepEqual(Object.keys(options.headers), ['content-type', 'accept', 'content-length']);
  assert.equal(options.headers['content-length'], String(requestBytes.length));
  assert.equal(Buffer.compare(options.cert, MATERIAL.cert), 0);
  assert.equal(Buffer.compare(options.key, MATERIAL.key), 0);
  assert.equal(Buffer.compare(options.ca, MATERIAL.ca), 0);
  const response = fakeResponse({ chunks: [Buffer.from('{"status":"COMMITTED"}')] });
  fake.state.respond(response); response.plan();
  assert.ok((await pending).equals(Buffer.from('{"status":"COMMITTED"}')));
  assert.equal(fake.state.options.length, 1, 'no retry after success');
});

test('no dispatched option is derived from the request body, the environment or a redirect', async () => {
  const previous = process.env.FIXTURE_TRANSPORT_HOST_CANARY;
  process.env.FIXTURE_TRANSPORT_HOST_CANARY = 'evil.example';
  try {
    const { fake, transport } = composition();
    const requestBytes = bytes('authorizeFixturePhase', { host: 'evil.example', path: '//evil.example/x', port: 9999 });
    const pending = transport({ operation: 'authorizeFixturePhase', requestBytes, deadlineMs: NOW + 5000 });
    const options = fake.state.options[0];
    assert.equal(options.hostname, 'fixture.internal');
    assert.equal(options.path, PATH);
    assert.equal(options.port, 443);
    assert.deepEqual(Object.keys(options.headers), ['content-type', 'accept', 'content-length']);
    const scalars = Object.entries(options)
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .map(([key, value]) => `${key}=${value}`).join('&');
    for (const leak of [CANARY, PRIVATE, 'evil.example']) assert.doesNotMatch(scalars, new RegExp(leak));
    assert.doesNotMatch(Object.values(options.headers).join('&'), new RegExp(`${CANARY}|${PRIVATE}`));
    // The operation is carried by the canonical body only; no operation header is invented.
    for (const operation of FIXTURE_TRANSPORT_OPERATIONS) assert.ok(!Object.values(options.headers).includes(operation));
    const response = fakeResponse({ chunks: [Buffer.from('{}')] });
    fake.state.respond(response); response.plan();
    await pending;
  } finally {
    if (previous === undefined) delete process.env.FIXTURE_TRANSPORT_HOST_CANARY;
    else process.env.FIXTURE_TRANSPORT_HOST_CANARY = previous;
  }
});

// ---------------------------------------------------------------------------
// Response boundary: status, encoding, type, declared length, streaming cap
// ---------------------------------------------------------------------------

const RESPONSE_CASES = [
  ['a redirect', { statusCode: 302, headers: { 'content-type': 'application/json', location: 'https://evil.example/' } }, 'FIXTURE_TRANSPORT_STATUS'],
  ['a 204 or 500', { statusCode: 500 }, 'FIXTURE_TRANSPORT_STATUS'],
  ['a compressed response', { headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' } }, 'FIXTURE_TRANSPORT_ENCODING'],
  ['an identity encoding', { headers: { 'content-type': 'application/json', 'content-encoding': 'identity' } }, null],
  ['an unsupported content type', { headers: { 'content-type': 'text/plain' } }, 'FIXTURE_TRANSPORT_CONTENT_TYPE'],
  ['a missing content type', { headers: {} }, 'FIXTURE_TRANSPORT_CONTENT_TYPE'],
  ['a declared length over the cap', { headers: { 'content-type': 'application/json', 'content-length': '2048' } }, 'FIXTURE_TRANSPORT_RESPONSE_BOUND'],
  ['a malformed declared length', { headers: { 'content-type': 'application/json', 'content-length': 'lots' } }, 'FIXTURE_TRANSPORT_RESPONSE_BOUND'],
  ['a nondecimal declared length', { headers: { 'content-type': 'application/json', 'content-length': '1e2' } }, 'FIXTURE_TRANSPORT_RESPONSE_BOUND'],
  ['a noncanonical declared length', { headers: { 'content-type': 'application/json', 'content-length': '01' } }, 'FIXTURE_TRANSPORT_RESPONSE_BOUND'],
  ['a chunked parameterised content type', { headers: { 'content-type': 'Application/JSON; charset=utf-8' } }, null],
];

test('redirects, non-200, compression, wrong types and declared oversize refuse and destroy the response', async () => {
  for (const [label, shape, code] of RESPONSE_CASES) {
    const { fake, transport } = composition();
    const pending = transport(call('authorizeFixturePhase'));
    const response = fakeResponse({ ...shape, chunks: [Buffer.from('{"status":"AUTHORIZED"}')] });
    fake.state.respond(response); response.plan();
    if (code === null) assert.ok((await pending).length > 0, label);
    else await refusal(pending, code);
    assert.equal(fake.state.options.length, 1, `${label}: exactly one dispatch, no retry`);
    assert.equal(response.destroyed, 1, `${label}: owned response destroyed`);
    assert.equal(fake.state.destroyed, 1, `${label}: owned request destroyed`);
  }
});

test('declared response length must equal the bytes actually received', async () => {
  const { fake, transport } = composition();
  const pending = transport(call('authorizeFixturePhase'));
  const response = fakeResponse({ headers: { 'content-type': 'application/json', 'content-length': '3' },
    chunks: [Buffer.from('{}')] });
  fake.state.respond(response); response.plan();
  await refusal(pending, 'FIXTURE_TRANSPORT_RESPONSE_BOUND');
  assert.equal(response.destroyed, 1);
  assert.equal(fake.state.destroyed, 1);
});

test('the streaming cap applies during receipt, before aggregation', async () => {
  const { fake, transport } = composition({ limits: { requestBytes: 4096, responseBytes: 8 } });
  const pending = transport(call('authorizeFixturePhase'));
  const response = fakeResponse({ chunks: [] });
  fake.state.respond(response);
  response.emit('data', Buffer.alloc(8, 0x61));
  response.emit('data', Buffer.alloc(1, 0x62)); // crosses the cap before any 'end'
  await refusal(pending, 'FIXTURE_TRANSPORT_RESPONSE_BOUND');
  assert.equal(response.destroyed, 1, 'owned response destroyed at the crossing chunk');
  // The refusal is not derived from a later end/close event.
  response.emit('end');
  response.emit('close');
  assert.equal(fake.state.options.length, 1);
});

test('a non-Buffer chunk, an abort mid-stream and a close before end refuse', async () => {
  for (const [event, value] of [['data', 'text'], ['aborted', undefined], ['close', undefined], ['error', new Error(PRIVATE)]]) {
    const { fake, transport } = composition();
    const pending = transport(call('authorizeFixturePhase'));
    const response = fakeResponse({});
    fake.state.respond(response);
    response.emit(event, value);
    await assert.rejects(pending, error => error instanceof Error && /^FIXTURE_TRANSPORT_(RESPONSE_BOUND|CLOSED)$/.test(error.message));
    assert.ok(!String(await pending.catch(error => error.message)).includes(PRIVATE));
    assert.equal(response.destroyed, 1);
  }
});

// ---------------------------------------------------------------------------
// Expected server identity and pin
// ---------------------------------------------------------------------------

test('the peer pin check refuses a foreign, missing or unverifiable certificate', async () => {
  const { fake, transport } = composition();
  const pending = transport(call('authorizeFixturePhase'));
  const check = fake.state.options[0].checkServerIdentity;
  const valid = { fingerprint256: PIN_COLON, subjectaltname: 'DNS:fixture.internal' };
  assert.equal(check('fixture.internal', valid), undefined, 'exact pin and hostname accepted');
  for (const cert of [{ ...valid, fingerprint256: 'cd'.repeat(32) }, { fingerprint256: PIN_COLON }, undefined, null,
    { ...valid, subjectaltname: 'DNS:other.test' }, { ...valid, fingerprint256: PIN_COLON.replace(/^../, 'zz') }]) {
    const outcome = check('fixture.internal', cert);
    assert.ok(outcome instanceof Error, 'identity failure refused');
    assert.equal(outcome.message, 'FIXTURE_TRANSPORT_IDENTITY', 'content-free identity error');
  }
  assert.equal(check('other.test', valid).message, 'FIXTURE_TRANSPORT_IDENTITY', 'hostname mismatch refused');
  const response = fakeResponse({ chunks: [Buffer.from('{}')] });
  fake.state.respond(response); response.plan();
  await pending;
});

// ---------------------------------------------------------------------------
// Deadline, cancellation and owned-resource cleanup
// ---------------------------------------------------------------------------

test('the original deadline rejects with a fixed error and clears its owned timer', async () => {
  const { fake, transport } = composition();
  const before = process.getActiveResourcesInfo().filter(resource => resource === 'Timeout').length;
  const pending = transport({ ...call('authorizeFixturePhase'), deadlineMs: NOW + 60000 });
  const response = fakeResponse({ chunks: [Buffer.from('{}')] });
  fake.state.respond(response); response.plan();
  await pending;
  const after = process.getActiveResourcesInfo().filter(resource => resource === 'Timeout').length;
  assert.ok(after <= before, `owned timer must be cleared (before ${before}, after ${after})`);

  const expiry = composition({ now: () => NOW });
  const expired = expiry.transport({ ...call('authorizeFixturePhase'), deadlineMs: NOW + 5 });
  await refusal(expired, 'FIXTURE_TRANSPORT_TIMEOUT');
  assert.equal(expiry.fake.state.destroyed, 1, 'owned request destroyed on timeout');
  assert.equal(expiry.fake.state.options.length, 1, 'no retry after timeout');
});

test('an abort during flight rejects with a fixed error without disposing the borrowed signal', async () => {
  const { fake, transport } = composition();
  const signal = spySignal();
  const pending = transport({ ...call('authorizeFixturePhase'), signal });
  assert.equal(signal.listeners.size, 1, 'transport observes the borrowed signal');
  signal.abort(); // the channel owner aborts its own controller
  await refusal(pending, 'FIXTURE_TRANSPORT_TIMEOUT');
  assert.equal(signal.aborts, 1, 'the transport never aborts the borrowed controller');
  assert.equal(signal.listeners.size, 0, 'the transport removes its own listener');
  assert.equal(fake.state.destroyed, 1, 'owned request destroyed on abort');
  assert.equal(fake.state.options.length, 1, 'no retry after abort');
});

test('listener registration and malformed request objects fail without an owned timer leak', async () => {
  const { fake, transport } = composition();
  const before = process.getActiveResourcesInfo().filter(resource => resource === 'Timeout').length;
  const signal = { aborted: false, addEventListener() { throw new Error(PRIVATE); },
    removeEventListener() { throw new Error(PRIVATE); } };
  await refusal(transport({ ...call('authorizeFixturePhase'), signal }), 'FIXTURE_TRANSPORT_INPUT');
  assert.equal(fake.state.options.length, 0);
  const invalid = composition({ httpsModule: { request() { return {}; } } });
  await refusal(invalid.transport(call('authorizeFixturePhase')), 'FIXTURE_TRANSPORT_DISPATCH');
  const after = process.getActiveResourcesInfo().filter(resource => resource === 'Timeout').length;
  assert.ok(after <= before, 'failed setup clears owned timers');
});

test('borrowed credentials, the injected module and the caller buffers are never disposed or mutated', async () => {
  const { fake, transport } = composition();
  const material = { ...MATERIAL };
  const pending = transport(call('authorizeFixturePhase'));
  const response = fakeResponse({ chunks: [Buffer.from('{}')] });
  fake.state.respond(response); response.plan();
  await pending;
  assert.equal(fake.state.moduleDestroyed, 0, 'borrowed https boundary not disposed');
  assert.equal(typeof fake.module.request, 'function', 'borrowed https boundary intact');
  for (const [name, original] of Object.entries(material)) {
    assert.equal(Buffer.compare(original, MATERIAL[name]), 0, `${name} material not mutated or zeroed`);
  }
  const signal = spySignal();
  const ok = composition();
  const done = ok.transport({ ...call('authorizeFixturePhase'), signal });
  const second = fakeResponse({ chunks: [Buffer.from('{}')] });
  ok.fake.state.respond(second); second.plan();
  await done;
  assert.equal(signal.aborts, 0, 'a successful call never disposes the borrowed signal');
  assert.equal(signal.listeners.size, 0, 'listener removed on success');
});

// ---------------------------------------------------------------------------
// Fixed, content-free failures and a minimal export surface
// ---------------------------------------------------------------------------

test('private error objects and response bodies never escape into a thrown message', async () => {
  let reads = 0;
  const hostile = { get message() { reads += 1; throw new Error(PRIVATE); } };
  const dispatchFailure = composition();
  const pending = dispatchFailure.transport(call('authorizeFixturePhase'));
  dispatchFailure.fake.state.handlers.get('error')(hostile);
  await refusal(pending, 'FIXTURE_TRANSPORT_DISPATCH');
  assert.equal(reads, 0, 'a rejected transport object is never inspected');

  const bodyFailure = composition();
  const bodyPending = bodyFailure.transport(call('authorizeFixturePhase'));
  const response = fakeResponse({ statusCode: 500, chunks: [Buffer.from(`{"error":"${PRIVATE}"}`)] });
  bodyFailure.fake.state.respond(response); response.plan();
  await assert.rejects(bodyPending, error => error.message === 'FIXTURE_TRANSPORT_STATUS' &&
    !error.message.includes(PRIVATE) && !String(error.stack).includes(PRIVATE));

  const dispatchThrow = composition({ httpsModule: { request() { throw new Error(PRIVATE); } } });
  await refusal(dispatchThrow.transport(call('authorizeFixturePhase')), 'FIXTURE_TRANSPORT_DISPATCH');
  const endThrow = fakeHttps();
  endThrow.module.request = (options, onResponse) => ({ on() {}, end() { throw new Error(PRIVATE); }, destroy() {} });
  const endFailure = composition({ httpsModule: endThrow.module });
  await refusal(endFailure.transport(call('authorizeFixturePhase')), 'FIXTURE_TRANSPORT_DISPATCH');
});

test('the module exposes only the transport factory and its fixed constants', () => {
  assert.deepEqual(Object.keys(FIXTURE_TRANSPORT_OPERATIONS),
    ['0', '1', '2', '3']);
  assert.deepEqual([...FIXTURE_TRANSPORT_OPERATIONS], [
    'authorizeFixturePhase', 'commitFixtureCheckpoint', 'loadFixtureCheckpoint', 'verifyFixtureCheckpoint']);
  assert.ok(Object.isFrozen(FIXTURE_TRANSPORT_OPERATIONS));
  assert.deepEqual([...FIXTURE_TRANSPORT_APPROVED_PORTS], [443]);
  assert.equal(FIXTURE_TRANSPORT_METHOD, 'POST');
  assert.equal(FIXTURE_TRANSPORT_MIN_TLS, 'TLSv1.2');
  assert.equal(FIXTURE_TRANSPORT_MAX_LIMIT_BYTES, 64 * 1024 * 1024);
  const fake = fakeHttps();
  const transport = createFixtureHttpsTransport({
    endpoint: { origin: ORIGIN, path: PATH }, identity: { pinSha256: PIN }, mtls: { ...MATERIAL },
    limits: { requestBytes: 4096, responseBytes: 1024 }, contentType: 'application/json',
    httpsModule: fake.module, now: () => NOW,
  });
  assert.equal(typeof transport, 'function');
  assert.equal(fake.state.options.length, 0, 'composition performs no dispatch');
  // Independent compositions share no dispatch state.
  const other = composition();
  assert.equal(typeof other.transport, 'function');
  assert.notEqual(transport, other.transport);
});

// ---------------------------------------------------------------------------
// Composition with the real borrowed channel (offline, injected HTTPS boundary)
// ---------------------------------------------------------------------------

test('the transport satisfies createFixtureChannel over an injected HTTPS boundary', async () => {
  const f = fixture();
  const driver = full => ({ runUuid: full.runUuid, sessionId: full.namespace.sessionId,
    attempt: full.identity.attempt, fence: full.identity.fence, operation: full.phase,
    deadlineMs: full.clock.deadlineMs });
  const fake = fakeHttps();
  const transport = createFixtureHttpsTransport({
    endpoint: { origin: ORIGIN, path: PATH }, identity: { pinSha256: PIN }, mtls: { ...MATERIAL },
    limits: { requestBytes: 262144, responseBytes: 262144 }, contentType: 'application/json',
    httpsModule: fake.module, now: () => FIXTURE_NOW,
  });
  const channel = createFixtureChannel({
    transport, producer: f.producer, current: f.producer, phaseDeadlineMs: FIXTURE_NOW + 100,
    requestId: () => fixtureId(70), fixtureFile: f.fixtureFile, evidence: f.evidence,
    now: () => FIXTURE_NOW,
  });
  const pending = channel.gateway.authorize(driver(f.producer));
  assert.equal(fake.state.options.length, 1, 'the channel borrows exactly one dispatch');
  const sent = fake.state.sent[0];
  assert.equal(sent.toString(), canon(JSON.parse(sent.toString())), 'the channel supplied canonical bytes');
  const answered = fixtureResponse(f, JSON.parse(sent.toString()));
  const response = fakeResponse({ chunks: [Buffer.from(canon(answered))] });
  fake.state.respond(response); response.plan();
  assert.equal(await pending, true, 'the channel accepts the transport result');
  assert.equal(fake.state.options.length, 1, 'no retry through the channel');
  assert.equal(fake.state.destroyed, 1);
});
