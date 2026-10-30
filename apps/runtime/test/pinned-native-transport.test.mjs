// The real apps/runtime/pinned-native-transport.mjs over local TLS listeners: classification, every failure class, cancellation and
// deadline, abort/response races, redaction and socket/listener/timer cleanup, and the native client's run-owner replay through it
// (control's answers stored by the real conversation store). No provider, SDK process or credential.
// CA file: on Linux/POSIX the transport opens a real 0600 file owned by this uid (no mock, no security-check bypass) and the
// ownership/mode refusals are exercised against the real filesystem. On Windows only, the POSIX uid/mode check cannot
// pass, so the CA bytes are presented through an inert handle (needs --experimental-test-module-mocks); that run is named
// `[windows-ca-mock]` and is NOT Linux qualification.
import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {createServer as createTlsServer} from 'node:tls';
import {createServer as createTcpServer} from 'node:net';
import {mkdtempSync, writeFileSync, chmodSync, symlinkSync, mkdirSync, rmSync, chownSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {inspect} from 'node:util';
import {getEventListeners} from 'node:events';
import {createRunnerTlsCertificateFixture} from '../native-authority/test/runner-tls-fixture.mjs';
import {withRunnerDiagnostics, markRunnerStage, captureRunnerFailure, PINNED_NATIVE_FAILURE_CODES, classifyPinnedStatus} from '../runner-runtime-diagnostics.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {isAuthorityUnavailable} from '../../../packages/runtime/authority-availability.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {binding, versions, scopes, id, storeFixture} from '../../control/conversations/test/store-fixture.mjs';
import {withoutDetail} from './runner-diagnostic-lines.mjs';

const realSetTimeout = globalThis.setTimeout;
const delay = ms => new Promise(resolve => realSetTimeout(resolve, ms));
const fixtureHooks = {after: fn => test.after(fn)};
const trusted = createRunnerTlsCertificateFixture(fixtureHooks), untrusted = createRunnerTlsCertificateFixture(fixtureHooks);
const leaf = trusted.issueLeaf('control', 'DNS:localhost'), mismatch = trusted.issueLeaf('elsewhere', 'DNS:elsewhere.example');
const strangerLeaf = untrusted.issueLeaf('stranger', 'DNS:localhost');
const caSha256 = createHash('sha256').update(trusted.ca).digest('hex');
const posixCa = process.platform !== 'win32';
const label = posixCa ? '[posix-real-ca]' : '[windows-ca-mock]';
const dir = mkdtempSync(join(tmpdir(), 'meri-pinned-matrix-'));
test.after(() => rmSync(dir, {recursive: true, force: true}));

let caFile;
if (posixCa) {
  caFile = join(dir, 'control-ca.pem');
  writeFileSync(caFile, trusted.ca, {mode: 0o600});
  chmodSync(caFile, 0o600);
} else {
  caFile = '/synthetic/control-ca.pem';
  mock.module('node:fs/promises', {namedExports: {open: async () => ({
    stat: async () => ({isFile: () => true, size: trusted.ca.length, uid: 0, mode: 0o100600}), readFile: async () => trusted.ca, close: async () => {}})}});
  process.getuid ??= () => 0;
}
const {createPinnedNativeFetch, classifyPinnedRequestError} = await import('../pinned-native-transport.mjs');

const SECRET = {credential: 'SECRETCREDENTIAL0123', prompt: 'SECRET-PROMPT-7f3a', body: 'SECRET-BODY-91c2', header: 'SECRET-HEADER-55e1',
  status: 'SECRET-STATUS-TEXT', cn: 'ignored-cn', ca: 'synthetic-test-ca'};
const probe = {binding};

// --- servers ---------------------------------------------------------------------------------------------------------
const open = new Set();
const track = server => server.on('connection', socket => {open.add(socket); socket.once('close', () => open.delete(socket));});
let mode = 'ok', seen = [], onRequest = () => {};
const json = (res, status, value, extra = {}) => {const body = Buffer.from(JSON.stringify(value)); res.writeHead(status, {'content-type': 'application/json', 'content-length': String(body.length), ...extra}); res.end(body);};
const secretReply = (res, status) => {res.writeHead(status, SECRET.status, {'content-type': 'application/json', 'x-secret': SECRET.header}); res.end(JSON.stringify({error: SECRET.body}));};
function control(req, res) {
  const chunks = []; req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const text = Buffer.concat(chunks).toString('utf8');
    seen.push({method: req.method, url: req.url, headers: {...req.headers}, text});
    if (req.url === '/v1/runner/publish') return runner(req, res, text);
    const {original} = JSON.parse(text);
    onRequest(res);
    const ok = () => json(res, 200, {original, probeSha256: hash(probe)});
    switch (mode) {
      case 'ok': return ok();
      case 'ok-chunked': res.writeHead(200, {'content-type': 'application/json'}); res.write('{"original":'); res.end(JSON.stringify(original ?? null) + ',"probeSha256":"' + hash(probe) + '"}'); return;
      case 'ok-delayed': realSetTimeout(ok, 5); return;
      case 's403': return secretReply(res, 403);
      case 's400': return secretReply(res, 400);
      case 's404': return secretReply(res, 404);
      case 's429': return secretReply(res, 429);
      case 's503': return secretReply(res, 503);
      case 's500': return secretReply(res, 500);
      case 's502': return secretReply(res, 502);
      case 's302': res.writeHead(302, {location: 'https://localhost:1/v1/elsewhere', 'content-length': '0'}); res.end(); return;
      case 's503-oversize': res.writeHead(503, {'content-type': 'application/json'}); res.end(JSON.stringify({error: SECRET.body, pad: 'x'.repeat(5000)})); return;
      case 's403-truncated': res.writeHead(403, {'content-type': 'application/json', 'content-length': '64'}); res.write('{"error":'); realSetTimeout(() => req.socket.destroy(), 20); return;
      case 's500-gzip': return json(res, 500, {error: SECRET.body}, {'content-encoding': 'gzip'});
      case 'located-200': return json(res, 200, {original}, {location: 'https://localhost:1/'});
      case 'gzip-200': return json(res, 200, {original}, {'content-encoding': 'gzip'});
      case 'oversize-declared': return json(res, 200, {original, pad: 'x'.repeat(64)});
      case 'oversize-streamed': res.writeHead(200, {'content-type': 'application/json'}); res.write('['); res.write('"' + 'x'.repeat(256) + '"'); res.end(']'); return;
      case 'trailers': res.writeHead(200, {'content-type': 'application/json', trailer: 'x-t'}); res.write('{}'); res.addTrailers({'x-t': SECRET.header}); res.end(); return;
      case 'header-overflow': res.writeHead(200, {'content-type': 'application/json', 'x-big': 'h'.repeat(12000)}); res.end('{}'); return;
      case 'reset-before-headers': req.socket.destroy(); return;
      case 'truncated-length': res.writeHead(200, {'content-type': 'application/json', 'content-length': '64'}); res.write('{"original":'); realSetTimeout(() => req.socket.destroy(), 20); return;
      case 'truncated-chunked': res.writeHead(200, {'content-type': 'application/json'}); res.write('{"original":'); realSetTimeout(() => req.socket.destroy(), 20); return;
      case 'head-then-hang': res.writeHead(200, {'content-type': 'application/json', 'content-length': '64'}); res.write('{"orig'); return;
      case 'hang': return;
      case 'late': realSetTimeout(() => {try {json(res, 200, {late: SECRET.body});} catch {}}, 150); return;
      default: throw Error('unknown mode');
    }
  });
}
// Control's run-owner answers: each queued answer once, then the publish stored by the real Postgres conversation store (over
// the in-memory pool), so a replayed eventId is stored exactly as control stores it. 'stored-then-reset' stores, then drops the
// connection before any head: control did the work but its answer never arrives.
let runnerStore, runnerAnswers = [];
async function runner(req, res, text) {
  const answer = runnerAnswers.shift() ?? 'stored', {binding: b, event} = JSON.parse(text);
  if (typeof answer === 'object') return json(res, answer.status, {error: {code: answer.code}});
  const stored = await runnerStore.append(b, event, () => {});
  if (answer === 'stored-then-reset') return req.socket.destroy();
  json(res, 200, stored);
}
const listen = async server => {track(server); await new Promise(resolve => server.listen(0, 'localhost', resolve)); test.after(() => {for (const s of open) s.destroy(); server.close();}); return `https://localhost:${server.address().port}`;};
const origin = await listen(createServer({key: leaf.key, cert: leaf.cert}, control));
const strangerOrigin = await listen(createServer({key: strangerLeaf.key, cert: strangerLeaf.cert}, control));
const mismatchOrigin = await listen(createServer({key: mismatch.key, cert: mismatch.cert}, control));
const tls12Origin = await listen(createServer({key: leaf.key, cert: leaf.cert, maxVersion: 'TLSv1.2'}, control));
const handshakeResetOrigin = await listen(createTcpServer(socket => {socket.on('error', () => {}); socket.resetAndDestroy();}));
const plaintextOrigin = await listen(createTcpServer(socket => socket.on('error', () => {}).resume().end('HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\n{}')));
const garbageOrigin = await listen(createTlsServer({key: leaf.key, cert: leaf.cert}, socket => {socket.on('data', () => socket.end('NOT-HTTP ' + SECRET.body + '\r\n\r\n')); socket.on('error', () => {});}));
const closed = createTcpServer(); await new Promise(resolve => closed.listen(0, 'localhost', resolve));
const refusedOrigin = `https://localhost:${closed.address().port}`; await new Promise(resolve => closed.close(resolve));

// --- helpers ---------------------------------------------------------------------------------------------------------
const SECRETS_IN_ERRORS = () => [...Object.values(SECRET), 'localhost', '127.0.0.1', '::1'];
const handles = () => process.getActiveResourcesInfo().filter(type => type === 'TLSWrap' || type === 'TCPSocketWrap').length;
const timers = () => process.getActiveResourcesInfo().filter(type => type === 'Timeout').length;
async function quiesce(baseline) {
  const until = Date.now() + 3000;
  while (open.size || handles() > baseline.handles || timers() > baseline.timers) {
    if (Date.now() > until) {
      const report = `not cleaned up: server sockets ${open.size}, socket handles ${handles()}>${baseline.handles}, timers ${timers()}>${baseline.timers}`;
      for (const socket of open) socket.destroy(); // keep one leak from cascading into later cases
      assert.fail(report);
    }
    await delay(10);
  }
}
async function snapshot() {await quiesce({handles: Infinity, timers: Infinity}); return {handles: handles(), timers: timers()};}
function assertSanitized(error, code) {
  assert.ok(error instanceof Error, 'rejects with an Error');
  assert.equal(error.code, code);
  assert.ok(PINNED_NATIVE_FAILURE_CODES.includes(error.code));
  assert.equal(error.message, 'PINNED_NATIVE_REFUSED');
  assert.deepEqual(Object.getOwnPropertyNames(error).sort(), ['code', 'message', 'stack']);
  assert.equal(error.cause, undefined);
  const rendered = [inspect(error, {showHidden: true, depth: 8}), String(error), JSON.stringify(error)].join('\n');
  for (const secret of SECRETS_IN_ERRORS()) assert.ok(!rendered.includes(secret), `rejection must not carry ${secret}`);
  for (const port of [origin, strangerOrigin, mismatchOrigin, refusedOrigin].map(value => new URL(value).port)) assert.ok(!rendered.includes(':' + port), 'no peer port');
}
const request = (signal, extra = {}) => ({method: 'POST', redirect: 'error', headers: {authorization: 'Bearer ' + SECRET.credential, 'content-type': 'application/json'},
  body: JSON.stringify({original: {prompt: SECRET.prompt}}), ...(signal ? {signal} : {}), ...extra});
const admittedUrl = base => base + '/v1/runner/native/admitted';
const fetchFor = (base = origin, options = {}) => createPinnedNativeFetch({origin: base, caFile, caSha256, ...options});
async function outcome(promise) {return promise.then(value => ({value}), error => ({error}));}
async function expectClass(selected, code, {base = origin, options, signal} = {}) {
  mode = selected; seen = [];
  const baseline = await snapshot(), controller = signal ? null : new AbortController(), used = signal ?? controller.signal;
  const fetchImpl = await fetchFor(base, options);
  const {value, error} = await outcome(fetchImpl(admittedUrl(base), request(used)));
  assert.equal(value, undefined, `${selected} must not resolve`);
  assertSanitized(error, code);
  assert.equal(getEventListeners(used, 'abort').length, 0, 'abort listener removed');
  await quiesce(baseline);
  return error;
}

// --- pure classification and the diagnostics allowlist --------------------------------------------------------------
const coded = code => Object.assign(Error('synthetic'), {code});
test('status classes are fixed and never echo the status text', () => {
  for (const [status, code] of [[403, 'STATUS_403'], [503, 'STATUS_503'], [400, 'STATUS_4XX'], [404, 'STATUS_4XX'], [502, 'STATUS_5XX'],
    [302, 'STATUS_OTHER'], [101, 'STATUS_OTHER'], [600, 'STATUS_OTHER'], [403.5, 'STATUS_OTHER'], ['403', 'STATUS_OTHER'], [undefined, 'STATUS_OTHER']]) {
    assert.equal(classifyPinnedStatus(status), 'PINNED_NATIVE_' + code);
  }
});
test('request error classes cover connect, TLS trust, socket and parser failures; anything else is the TRANSPORT fallback', () => {
  for (const [code, expected] of [['ECONNREFUSED', 'CONNECT'], ['ENOTFOUND', 'CONNECT'], ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'TLS'],
    ['ERR_TLS_CERT_ALTNAME_INVALID', 'TLS'], ['ERR_SSL_WRONG_VERSION_NUMBER', 'TLS'], ['ECONNRESET', 'SOCKET'], ['EPIPE', 'SOCKET'],
    ['HPE_INVALID_CONSTANT', 'RESPONSE'], ['SOMETHING_ELSE', 'TRANSPORT'], ['econnrefused', 'TRANSPORT'], [7, 'TRANSPORT']]) {
    assert.equal(classifyPinnedRequestError(coded(code)), 'PINNED_NATIVE_' + expected);
  }
  for (const value of [Error('no code'), null, 'ECONNREFUSED', {get code() {return 'ECONNREFUSED';}}, new Proxy({}, {get() {throw Error('hostile');}}),
    // A hostile descriptor trap must not throw out of an event listener (it would be an uncaught exception there).
    new Proxy({}, {getOwnPropertyDescriptor() {throw Error('hostile');}})]) {
    assert.equal(classifyPinnedRequestError(value), 'PINNED_NATIVE_TRANSPORT');
  }
});
test('the class set is closed and constant-shaped, every class prints, and the allowlist is exact', async () => {
  assert.ok(Object.isFrozen(PINNED_NATIVE_FAILURE_CODES));
  assert.equal(new Set(PINNED_NATIVE_FAILURE_CODES).size, PINNED_NATIVE_FAILURE_CODES.length);
  for (const code of PINNED_NATIVE_FAILURE_CODES) {
    assert.match(code, /^PINNED_NATIVE_[A-Z0-9_]{1,40}$/u);
    const lines = [];
    await withRunnerDiagnostics(async () => {markRunnerStage('activity-stream'); captureRunnerFailure(coded(code), 'native-start'); throw coded(code);},
      {write: line => lines.push(withoutDetail(line))}).catch(() => {});
    assert.deepEqual(lines, [`RUNNER_FIRST_FAILURE origin=native-start stage=activity-stream code=${code} class=ERROR exit=none signal=none\n`, `RUNNER_RUNTIME_FAILED stage=activity-stream code=${code}\n`]);
  }
  const lines = []; // a look-alike outside the set stays UNKNOWN: the allowlist is exact, not a prefix match
  await withRunnerDiagnostics(async () => {throw coded('PINNED_NATIVE_SECRET');}, {write: line => lines.push(withoutDetail(line))}).catch(() => {});
  assert.deepEqual(lines, ['RUNNER_FIRST_FAILURE origin=runtime stage=module-import code=ERROR class=ERROR exit=none signal=none\n', 'RUNNER_RUNTIME_FAILED stage=module-import code=ERROR\n']);
});

// --- success and status classes --------------------------------------------------------------------------------------
test(`${label} 200 resolves a fully buffered Response and sends exactly the pinned request`, async () => {
  for (const selected of ['ok', 'ok-chunked']) {
    mode = selected; seen = [];
    const baseline = await snapshot(), controller = new AbortController(), fetchImpl = await fetchFor();
    const response = await fetchImpl(admittedUrl(origin), request(controller.signal));
    assert.ok(response instanceof Response); assert.equal(response.status, 200);
    assert.equal(JSON.parse(await response.text()).probeSha256, hash(probe));
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    controller.abort(); // after settlement: inert
    assert.equal(seen.length, 1);
    const [{method, url, headers}] = seen;
    assert.equal(method, 'POST'); assert.equal(url, '/v1/runner/native/admitted');
    assert.deepEqual(Object.keys(headers).sort(), ['accept', 'accept-encoding', 'authorization', 'connection', 'content-length', 'content-type', 'host']);
    assert.equal(headers.connection, 'close'); assert.equal(headers['accept-encoding'], 'identity');
    await quiesce(baseline);
  }
});
for (const selected of ['s403', 's400', 's404', 's429', 's503', 's500', 's502']) {
  test(`${label} a ${selected.slice(1)} answer resolves with only its status, content type and bounded body`, async () => {
    mode = selected; seen = [];
    const baseline = await snapshot(), controller = new AbortController(), fetchImpl = await fetchFor();
    const response = await fetchImpl(admittedUrl(origin), request(controller.signal));
    assert.ok(response instanceof Response); assert.equal(response.status, Number(selected.slice(1)));
    assert.equal(response.statusText, '', 'the status text never escapes');
    assert.deepEqual([...response.headers.keys()], ['content-type'], 'no other header escapes');
    assert.deepEqual(JSON.parse(await response.text()), {error: SECRET.body});
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    assert.equal(seen.length, 1, 'no retry');
    await quiesce(baseline);
  });
}
// A non-200 whose bounded body cannot be read whole keeps its fixed status class.
for (const [selected, code] of [['s302', 'PINNED_NATIVE_STATUS_OTHER'], ['s503-oversize', 'PINNED_NATIVE_STATUS_503'],
  ['s403-truncated', 'PINNED_NATIVE_STATUS_403'], ['s500-gzip', 'PINNED_NATIVE_STATUS_5XX']]) {
  test(`${label} ${selected} is ${code}; body, header and status text never escape`, async () => {
    await expectClass(selected, code);
    assert.equal(seen.length, 1, 'no retry and no redirect follow');
  });
}

// --- connect, TLS, socket ----------------------------------------------------------------------------------------------
test(`${label} DNS failure is CONNECT`, async () => {
  await expectClass('ok', 'PINNED_NATIVE_CONNECT', {base: 'https://meri-pinned-transport-test.invalid', signal: AbortSignal.timeout(15000)});
});
test(`${label} connection refused is CONNECT`, async () => {await expectClass('ok', 'PINNED_NATIVE_CONNECT', {base: refusedOrigin});});
test(`${label} certificate from an untrusted CA is TLS and no request reaches the listener`, async () => {
  await expectClass('ok', 'PINNED_NATIVE_TLS', {base: strangerOrigin}); assert.equal(seen.length, 0);
});
test(`${label} certificate for another host name is TLS`, async () => {
  await expectClass('ok', 'PINNED_NATIVE_TLS', {base: mismatchOrigin}); assert.equal(seen.length, 0);
});
test(`${label} a TLS 1.2-only peer is TLS (minimum TLS 1.3 unchanged)`, async () => {
  await expectClass('ok', 'PINNED_NATIVE_TLS', {base: tls12Origin}); assert.equal(seen.length, 0);
});
test(`${label} plaintext peer is TLS`, async () => {await expectClass('ok', 'PINNED_NATIVE_TLS', {base: plaintextOrigin});});
test(`${label} reset during the handshake is SOCKET`, async () => {await expectClass('ok', 'PINNED_NATIVE_SOCKET', {base: handshakeResetOrigin});});
test(`${label} reset after the request, before any head, is SOCKET`, async () => {await expectClass('reset-before-headers', 'PINNED_NATIVE_SOCKET');});

// --- malformed, truncated, oversize ----------------------------------------------------------------------------------
test(`${label} non-HTTP bytes after the handshake are RESPONSE`, async () => {await expectClass('ok', 'PINNED_NATIVE_RESPONSE', {base: garbageOrigin});});
for (const [selected, options] of [['truncated-length'], ['truncated-chunked'], ['located-200'], ['gzip-200'], ['trailers'], ['header-overflow'],
  ['oversize-declared', {maxResponseBytes: 16}], ['oversize-streamed', {maxResponseBytes: 16}]]) {
  test(`${label} ${selected} is RESPONSE`, async () => {await expectClass(selected, 'PINNED_NATIVE_RESPONSE', {options});});
}

// --- cancellation, deadline, races --------------------------------------------------------------------------------------
test(`${label} an already aborted signal is ABORTED and opens no connection`, async () => {
  const baseline = await snapshot(), fetchImpl = await fetchFor(); seen = [];
  const {error} = await outcome(fetchImpl(admittedUrl(origin), request(AbortSignal.abort())));
  assertSanitized(error, 'PINNED_NATIVE_ABORTED'); assert.equal(seen.length, 0); await quiesce(baseline);
});
test(`${label} outer cancellation while control is silent is ABORTED and closes the socket`, async () => {
  mode = 'hang'; seen = [];
  const baseline = await snapshot(), controller = new AbortController(), fetchImpl = await fetchFor();
  onRequest = () => realSetTimeout(() => controller.abort(), 10);
  try {
    const {error} = await outcome(fetchImpl(admittedUrl(origin), request(controller.signal)));
    assertSanitized(error, 'PINNED_NATIVE_ABORTED'); assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  } finally {onRequest = () => {};}
  await quiesce(baseline);
});
test(`${label} cancellation after a 200 head, mid-body, is ABORTED (not RESPONSE or SOCKET)`, async () => {
  mode = 'head-then-hang'; seen = [];
  const baseline = await snapshot(), controller = new AbortController(), fetchImpl = await fetchFor();
  onRequest = () => realSetTimeout(() => controller.abort(), 30);
  try {assertSanitized((await outcome(fetchImpl(admittedUrl(origin), request(controller.signal)))).error, 'PINNED_NATIVE_ABORTED');} finally {onRequest = () => {};}
  await quiesce(baseline);
});
test(`${label} the adapter's own 30 s ceiling is TIMEOUT and closes the socket`, async t => {
  mode = 'hang'; seen = [];
  const baseline = await snapshot(), fetchImpl = await fetchFor();
  t.mock.timers.enable({apis: ['setTimeout']});
  const pending = outcome(fetchImpl(admittedUrl(origin), request()));
  const until = Date.now() + 5000; while (!seen.length) {if (Date.now() > until) assert.fail('request never arrived'); await delay(5);}
  t.mock.timers.tick(29999); await delay(20); assert.equal(open.size, 1, 'still pending before the ceiling');
  t.mock.timers.tick(1);
  assertSanitized((await pending).error, 'PINNED_NATIVE_TIMEOUT');
  t.mock.timers.reset();
  await quiesce(baseline);
});
test(`${label} named browser calls retain separate execution, approval and hook ceilings`, async t => {
 for(const [route,ceiling] of [['browser-call',130000],['browser-approve',900000],['browser-hook',10000]]){
  mode='hang';seen=[];const baseline=await snapshot(),fetchImpl=await fetchFor();
  t.mock.timers.enable({apis:['setTimeout']});
  const pending=outcome(fetchImpl(origin+'/v1/runner/'+route,request()));
  const until=Date.now()+5000;while(!seen.length){if(Date.now()>until)assert.fail('request never arrived');await delay(5);}
  t.mock.timers.tick(ceiling-1);await delay(10);assert.equal(open.size,1,'socket remains bounded by the named operation');
  t.mock.timers.tick(1);assertSanitized((await pending).error,'PINNED_NATIVE_TIMEOUT');t.mock.timers.reset();await quiesce(baseline);
 }
});
test(`${label} a late response after abort neither resolves nor raises`, async () => {
  mode = 'late'; seen = [];
  const baseline = await snapshot(), controller = new AbortController(), fetchImpl = await fetchFor();
  onRequest = () => realSetTimeout(() => controller.abort(), 20);
  let settled = 0;
  try {
    const pending = fetchImpl(admittedUrl(origin), request(controller.signal)).finally(() => {settled++;});
    assertSanitized((await outcome(pending)).error, 'PINNED_NATIVE_ABORTED');
    await delay(250); // the server's late write lands on a destroyed socket
    assert.equal(settled, 1);
  } finally {onRequest = () => {};}
  await quiesce(baseline);
});
test(`${label} abort racing the response settles exactly once as a full 200 or ABORTED, then cleans up`, async () => {
  const fetchImpl = await fetchFor(), outcomes = new Map();
  for (let i = 0; i < 24; i++) {
    mode = i % 2 ? 'ok' : 'ok-delayed'; seen = [];
    const baseline = await snapshot(), controller = new AbortController(), wait = i % 6;
    onRequest = () => {if (wait === 0) queueMicrotask(() => controller.abort()); else if (wait === 1) setImmediate(() => controller.abort()); else realSetTimeout(() => controller.abort(), wait - 1);};
    let settlements = 0;
    try {
      const result = await outcome(fetchImpl(admittedUrl(origin), request(controller.signal)).finally(() => {settlements++;}));
      if (result.error) {assertSanitized(result.error, 'PINNED_NATIVE_ABORTED'); outcomes.set('ABORTED', (outcomes.get('ABORTED') ?? 0) + 1);}
      else {assert.equal(result.value.status, 200); assert.equal(JSON.parse(await result.value.text()).probeSha256, hash(probe)); outcomes.set('OK', (outcomes.get('OK') ?? 0) + 1);}
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    } finally {onRequest = () => {};}
    await delay(10); assert.equal(settlements, 1);
    await quiesce(baseline);
  }
  assert.equal([...outcomes.values()].reduce((a, b) => a + b, 0), 24);
});

// --- unchanged local denial ------------------------------------------------------------------------------------------
test(`${label} local refusals are REFUSED and send nothing`, async () => {
  const fetchImpl = await fetchFor(); seen = []; const baseline = await snapshot();
  const bad = [
    [origin + '/v1/runner/native/admitted?x=1', request()], [strangerOrigin + '/v1/runner/native/admitted', request()], [origin + '/v2/runner/native/admitted', request()],
    [admittedUrl(origin), request(undefined, {method: 'GET'})], [admittedUrl(origin), request(undefined, {redirect: 'follow'})],
    [admittedUrl(origin), request(undefined, {body: Buffer.from('{}')})], [admittedUrl(origin), request(undefined, {body: ''})],
    [admittedUrl(origin), request(undefined, {headers: {authorization: 'Bearer ' + SECRET.credential, 'content-type': 'application/json', 'x-extra': '1'}})],
    [admittedUrl(origin), request(undefined, {headers: {authorization: 'Basic abc', 'content-type': 'application/json'}})],
    [admittedUrl(origin), request(undefined, {headers: {authorization: 'Bearer ' + SECRET.credential, 'content-type': 'text/plain'}})],
    ['not a url', request()],
  ];
  for (const [address, init] of bad) assertSanitized((await outcome(fetchImpl(address, init))).error, 'PINNED_NATIVE_REFUSED');
  const small = await fetchFor(origin, {maxRequestBytes: 8});
  assertSanitized((await outcome(small(admittedUrl(origin), request()))).error, 'PINNED_NATIVE_REFUSED');
  assert.equal(seen.length, 0); await quiesce(baseline);
});
test(`${label} adapter configuration refusals are CONFIGURATION`, async () => {
  for (const options of [{origin: 'http://localhost:1'}, {origin: origin + '/'}, {origin: origin + '/x'}, {origin: 'https://u:p@localhost:1'}, {origin: 'nonsense'},
    {caFile: 'relative/ca.pem'}, {caSha256: 'A'.repeat(64)}, {caSha256: '0'.repeat(64)}, {maxResponseBytes: 0}, {maxResponseBytes: 67108865}, {maxRequestBytes: 50331649}]) {
    assertSanitized((await outcome(createPinnedNativeFetch({origin, caFile, caSha256, ...options}))).error, 'PINNED_NATIVE_CONFIGURATION');
  }
});

// --- POSIX CA-file ownership and mode, real filesystem, no bypass -----------------------------------------------------
test(`${label} CA file ownership, mode and type are enforced on the real filesystem`, {skip: posixCa ? false : 'POSIX uid/mode semantics; the Windows run mocks the CA handle'}, async () => {
  const refuse = async file => assertSanitized((await outcome(createPinnedNativeFetch({origin, caFile: file, caSha256}))).error, 'PINNED_NATIVE_CONFIGURATION');
  assert.equal(typeof (await createPinnedNativeFetch({origin, caFile, caSha256})), 'function', 'the 0600 own-uid file is accepted');
  for (const [name, mode] of [['group-read.pem', 0o640], ['world-read.pem', 0o604], ['group-write.pem', 0o620], ['world-all.pem', 0o666]]) {
    const file = join(dir, name); writeFileSync(file, trusted.ca); chmodSync(file, mode); await refuse(file);
  }
  const link = join(dir, 'link.pem'); symlinkSync(caFile, link); await refuse(link);
  const folder = join(dir, 'folder.pem'); mkdirSync(folder, {mode: 0o700}); await refuse(folder);
  const empty = join(dir, 'empty.pem'); writeFileSync(empty, ''); chmodSync(empty, 0o600); await refuse(empty);
  const large = join(dir, 'large.pem'); writeFileSync(large, Buffer.alloc(16385, 0x41)); chmodSync(large, 0o600); await refuse(large);
  const other = join(dir, 'other-bytes.pem'); writeFileSync(other, untrusted.ca); chmodSync(other, 0o600); await refuse(other);
  await refuse(join(dir, 'missing.pem'));
  await refuse('/etc/passwd');
});
test(`${label} a CA file owned by another uid is refused even at mode 0600`, {skip: !posixCa ? 'POSIX only' : process.getuid() !== 0 ? 'needs root to chown; the non-root run covers foreign ownership via /etc/passwd (root-owned, 0644)' : false}, async () => {
  const file = join(dir, 'foreign.pem'); writeFileSync(file, trusted.ca); chmodSync(file, 0o600); chownSync(file, 65534, 65534);
  assertSanitized((await outcome(createPinnedNativeFetch({origin, caFile: file, caSha256}))).error, 'PINNED_NATIVE_CONFIGURATION');
});

// --- through the product client and runner diagnostics -------------------------------------------------------------------
// --- run-owner replay through this transport (native-client.mjs) -----------------------------------------------------
async function publishThroughPinned(answers) {
  mode = 'ok'; seen = []; runnerAnswers = [...answers]; runnerStore = createPostgresConversationStore(storeFixture());
  const at = new Date().toISOString(), policyRevision = scopes[0].policyRevision;
  await runnerStore.accept({run: {binding, state: 'queued', scopes, createdAt: at, policyRevision, versions}, request: {requestId: id(6), prompt: 'Synthetic only', skill: null, window: null},
    conversation: {conversationId: binding.conversationId, owner: {tenantId: binding.tenantId, actorId: binding.actorId}, scopes, createdAt: at, policyRevision},
    event: {contractVersion: '0.1.0', eventId: id(7), binding, sequence: 1, createdAt: at, scopes, type: 'run.status', data: {state: 'queued', reasonCode: null}}}, () => {});
  const baseline = await snapshot(), client = createNativeCapabilityClient({configuration: {origin, maxResponseBytes: 131072}, credential: SECRET.credential, fetch: await fetchFor()});
  const event = {eventId: id(88), createdAt: at, type: 'run.status', data: {state: 'starting', reasonCode: null}};
  const outcome = await client.call('runner/publish', {binding, event}, {deadlineMs: Date.now() + 10000, maxRequestMs: 5000}).then(value => ({value}), error => ({error}));
  const stored = (await runnerStore.read(binding, {after: 0, limit: 10}, () => {})).events.map(e => e.eventId);
  await quiesce(baseline);
  return {...outcome, requests: seen.filter(entry => entry.url === '/v1/runner/publish').length, stored};
}
for (const [status, code] of [[403, 'WORKER_REQUEST_REFUSED'], [401, 'NATIVE_GATEWAY_REFUSED'], [408, 'DEADLINE'], [503, 'NATIVE_EXECUTION_UNAVAILABLE']]) {
  test(`${label} control's ${status} ${code} reaches the native client as an answer: sent once, definitive, status class as cause`, async () => {
    const {error, requests, stored} = await publishThroughPinned([{status, code}]);
    assert.equal(error?.code, 'NATIVE_UNAVAILABLE'); assert.equal(isAuthorityUnavailable(error), false);
    assertSanitized(error.cause, classifyPinnedStatus(status));
    assert.equal(requests, 1); assert.deepEqual(stored, [id(7)]);
  });
}
test(`${label} 503 WORKER_AUTHORITY_UNAVAILABLE is sent again and the next answer stores the event`, async () => {
  const {value, requests, stored} = await publishThroughPinned([{status: 503, code: 'WORKER_AUTHORITY_UNAVAILABLE'}]);
  assert.equal(value?.eventId, id(88)); assert.equal(requests, 2); assert.deepEqual(stored, [id(7), id(88)]);
});
test(`${label} a reset after control stored the publish is sent again and the event is stored once`, async () => {
  const {value, requests, stored} = await publishThroughPinned(['stored-then-reset']);
  assert.equal(value?.eventId, id(88)); assert.equal(value.sequence, 2); assert.equal(requests, 2); assert.deepEqual(stored, [id(7), id(88)]);
});
