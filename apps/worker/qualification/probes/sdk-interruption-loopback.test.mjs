import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import net from 'node:net';
import zlib from 'node:zlib';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
// Any accidental real HTTP/listener entry is a hard failure in this suite.
http.createServer = () => { throw new Error('REAL_HTTP_DENIED'); };
net.createConnection = net.connect = () => { throw new Error('REAL_SOCKET_DENIED'); };
net.Server.prototype.listen = () => { throw new Error('REAL_LISTEN_DENIED'); };
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'])
  childProcess[name] = () => { throw new Error('REAL_PROCESS_DENIED'); };
syncBuiltinESMExports();
const { createInterruptionLoopback, inspectInterruptionRequest, main } = await import('./sdk-interruption-loopback.mjs');
const { ACTIVE_MARKER, CONTINUITY_MARKER } = await import('./sdk-interruption-options.mjs');
const { MAX_REQUEST_BYTES, MAX_DECOMPRESSED_BYTES } = await import('./sdk-capture-options.mjs');
const runUuid = 'c446abef-2b04-4843-9849-fb8ec423b178', sessionId = '6355ba81-d7fd-4ad3-ae7c-e27a5ed5692f';
const promptA = `Remember synthetic continuity ${runUuid}. Emit ${ACTIVE_MARKER} then remain active.`;
const promptB = `Continue the previous synthetic conversation. Emit ${CONTINUITY_MARKER} and repeat its continuity value.`;
function scenario() { const t0Ms = Date.now() - 1000; return { runUuid, sessionId, t0Ms,
  deadlineMs: t0Ms + 720000, cleanupDeadlineMs: t0Ms + 900000, phaseDeadlineMs: Date.now() + 2000 }; }
const message = text => ({ role: 'user', content: [{ type: 'text', text }] });
function body(phase = 'interrupt') { return { model: 'meri-sonnet-qualification', stream: true,
  messages: phase === 'interrupt' ? [message(promptA)] : [message(promptA), { role: 'assistant', content: ACTIVE_MARKER }, message(promptB)] }; }
function inspect(data = body(), more = {}) { return inspectInterruptionRequest({ scenario: scenario(), phase: 'interrupt', port: 1234,
  method: 'POST', path: '/v1/messages?beta=true', peer: '127.0.0.1', headers: { host: '127.0.0.1:1234', 'content-type': 'application/json' },
  rawBytes: Buffer.from(JSON.stringify(data)), ...more }); }
function fakeHttp() {
  const server = new EventEmitter(); server.listening = false;
  server.listen = (port, host, cb) => { assert.equal(port, 0); assert.equal(host, '127.0.0.1'); server.listening = true; cb(); };
  server.address = () => ({ port: 1234 }); server.close = cb => { server.listening = false; cb(); };
  const api = { createServer(handler) { server.handler = handler; return server; } };
  function request(raw = Buffer.from(JSON.stringify(body())), extra = {}) {
    const socket = new EventEmitter(); socket.remoteAddress = '127.0.0.1'; socket.destroyed = false;
    const req = new EventEmitter(), res = new EventEmitter();
    Object.assign(req, { method: 'POST', url: '/v1/messages', headers: { host: '127.0.0.1:1234', 'content-type': 'application/json' },
      rawHeaders: ['Host', '127.0.0.1:1234', 'Content-Type', 'application/json'], socket }, extra);
    socket.destroy = () => { if (!socket.destroyed) { socket.destroyed = true; socket.emit('close'); res.emit('close'); } };
    req.destroy = () => { req.destroyed = true; socket.destroy(); };
    res.destroy = () => { res.destroyed = true; socket.destroy(); };
    res.writeHead = code => { res.code = code; };res.flushHeaders = () => {};
    res.write = chunk => { res.raw = Buffer.from(chunk); return true; };
    res.end = chunk => { res.write(chunk); res.ended = true; res.emit('finish'); };
    server.emit('connection', socket); server.handler(req, res);
    if (raw) { req.emit('data', raw); req.emit('end'); }
    return { req, res, socket };
  }
  return { server, api, request };
}
test('safe import/help/missing never allocate a real listener', () => {
  const out = { write() {} };assert.equal(main(['--help'], out), 0);assert.equal(main([], out), 2);
});
test('exact initial and resumed history inspect independently of canned response', () => {
  assert.equal(inspect().historyVerified, false);
  assert.equal(inspect(body('resume'), { phase: 'resume' }).historyVerified, true);
});
test('continuity value in system/assistant/current response cannot replace prior exact user history', () => {
  for (const messages of [[message(promptB)], [{ role: 'assistant', content: promptA }, message(promptB)],
    [message(promptA+'x'), message(promptB)], [message(promptB), message(promptA)],
    [message(promptA), message(promptB), message('extra')], [message(promptA), message(promptA), message(promptB)]]) {
    assert.throws(() => inspect({ ...body('resume'), messages }, { phase: 'resume' }), /RESUMED_HISTORY/);
  }
});
test('target/model/stream/tool profile refuses before response', () => {
  for (const more of [{ method: 'GET' }, { path: '/v1/messages?other=true' }, { peer: '10.0.0.1' },
    { headers: { host: 'localhost:1234', 'content-type': 'application/json' } }]) assert.throws(() => inspect(body(), more), /REQUEST_TARGET/);
  for (const delta of [{ model: 'real-model' }, { stream: false }, { tools: [{}] }, { password: 'value' }])
    assert.throws(() => inspect({ ...body(), ...delta }), /REQUEST_PROFILE/);
});
test('canonical compression accepts gzip/deflate; duplicate keys and invalid UTF8 refuse', () => {
  const raw = Buffer.from(JSON.stringify(body()));
  for (const [contentEncoding, rawBytes] of [['gzip', zlib.gzipSync(raw)], ['deflate', zlib.deflateSync(raw)]])
    assert.equal(inspect(body(), { rawBytes, contentEncoding }).historyVerified, false);
  assert.throws(() => inspect(body(), { rawBytes: Buffer.from('{"model":"x","model":"meri-sonnet-qualification"}') }));
  assert.throws(() => inspect(body(), { rawBytes: Buffer.from([0xff]) }));
  assert.throws(() => inspect(body(), { contentEncoding: 'br' }), /REQUEST_BODY/);
});
test('raw and decompression bombs are bounded', () => {
  assert.throws(() => inspect(body(), { rawBytes: Buffer.alloc(MAX_REQUEST_BYTES+1) }), /REQUEST_BODY/);
  const rawBytes = zlib.gzipSync(Buffer.alloc(MAX_DECOMPRESSED_BYTES+1, 32));
  assert.throws(() => inspect(body(), { rawBytes, contentEncoding: 'gzip' }), /REQUEST_BODY/);
});
test('PhaseA response stays active without terminal and records peer close distinctly', async () => {
  const f = fakeHttp(), s = await createInterruptionLoopback({ scenario: scenario(), phase: 'interrupt', httpModule: f.api });
  try {
    const r = f.request();assert.equal(r.res.code, 200);assert.equal(r.res.ended, undefined);
    assert.match(r.res.raw.toString(), /MERI_INTERRUPT_ACTIVE/);assert.doesNotMatch(r.res.raw.toString(), /message_stop|content_block_stop/);
    r.socket.destroy();const receipt = s.receipt();assert.equal(receipt.requestEnded, true);
    assert.equal(receipt.requestAborted, false);assert.equal(receipt.responseClosed, true);assert.equal(receipt.socketClosed, true);
    assert.equal(receipt.responseFinished, false);assert.equal(receipt.forcedSocketCloses, 0);
    assert.equal(receipt.responseClosedBeforeOwnerClose, true);assert.equal(receipt.socketClosedBeforeOwnerClose, true);
  } finally { await s.close(); }
});
test('PhaseB emits continuity only after exact history, retains raw request and response hashes', async () => {
  const f = fakeHttp(), s = await createInterruptionLoopback({ scenario: scenario(), phase: 'resume', httpModule: f.api });
  try {
    const raw = Buffer.from(JSON.stringify(body('resume'))), r = f.request(raw);
    assert.equal(r.res.code, 200);assert.equal(r.res.ended, true);
    assert.match(r.res.raw.toString(), /MERI_RESUMED_CONTINUITY/);assert.match(r.res.raw.toString(), new RegExp(runUuid));
    assert.match(r.res.raw.toString(), /message_stop/);const got = s.receipt();assert.equal(got.historyVerified, true);
    assert.deepEqual(Buffer.from(got.request.rawBase64, 'base64'), raw);assert.deepEqual(Buffer.from(got.response.rawBase64, 'base64'), r.res.raw);
  } finally { await s.close(); }
});
test('unverified resume history gets no artificial marker/terminal response', async () => {
  const f = fakeHttp(), s = await createInterruptionLoopback({ scenario: scenario(), phase: 'resume', httpModule: f.api });
  const r = f.request(Buffer.from(JSON.stringify({ ...body('resume'), messages: [message(promptB)] })));
  await s.close();assert.equal(r.res.raw, undefined);assert.equal(s.receipt().failure, 'REQUEST_REFUSED');
});
test('duplicate headers refuse before response and secret bodies stay hash-only', async () => {
  for (const secret of [false, true]) {
    const f = fakeHttp(), s = await createInterruptionLoopback({ scenario: scenario(), phase: 'interrupt', httpModule: f.api });
    const r = f.request(Buffer.from(JSON.stringify(secret ? { ...body(), password: 'not-exported' } : body())),
      secret ? {} : { rawHeaders: ['Host', '127.0.0.1:1234', 'host', '127.0.0.1:1234'] });
    await s.close();assert.equal(r.res.raw, undefined);assert.equal(s.receipt().request.rawBase64, undefined);
  }
});
test('owner cleanup does not masquerade as native teardown', async () => {
  const f = fakeHttp(), s = await createInterruptionLoopback({ scenario: scenario(), phase: 'interrupt', httpModule: f.api });
  f.request();await s.close();const got = s.receipt();assert.equal(got.forcedSocketCloses, 1);
  assert.equal(got.serverClosed, true);assert.equal(got.socketsDrained, true);assert.equal(Object.hasOwn(got, 'physicalTaskStopped'), false);
  assert.equal(got.socketClosedBeforeOwnerClose, false);assert.equal(got.responseClosedBeforeOwnerClose, false);
});

test('second request or connection refuses even after the first peer closes', async () => {
  for (const secondConnection of [false, true]) {
    const f = fakeHttp(), s = await createInterruptionLoopback({ scenario: scenario(), phase: 'interrupt', httpModule: f.api });
    try {
      const r = f.request();
      if (secondConnection) { r.socket.destroy();f.request(); }
      else f.server.handler(r.req, r.res);
      await s.close();assert.equal(s.receipt().failure, secondConnection ? 'SOCKET_COUNT' : 'REQUEST_COUNT_OR_DEADLINE');
      assert.equal(s.receipt().requestCount, 2);
    } finally { await s.close(); }
  }
});

test('oversized HTTP input retains only bounded prefix identity and received count', async () => {
  const f = fakeHttp(), s = await createInterruptionLoopback({ scenario: scenario(), phase: 'interrupt', httpModule: f.api });
  try {
    const r = f.request(null);r.req.emit('data', Buffer.from('prefix'));r.req.emit('data', Buffer.alloc(MAX_REQUEST_BYTES));
    await s.close();const got = s.receipt();assert.equal(got.failure, 'BODY_BOUND');
    assert.equal(got.request.complete, false);assert.equal(got.request.rawLength, 6);
    assert.equal(got.request.receivedBytes, MAX_REQUEST_BYTES+6);assert.equal(got.request.rawBase64, undefined);
    assert.equal(got.response, null);
  } finally { await s.close(); }
});
test('aborted/incomplete request and original deadline stop pending transport', async () => {
  const f = fakeHttp(), s = await createInterruptionLoopback({ scenario: scenario(), phase: 'interrupt', httpModule: f.api });
  const r = f.request(null);r.req.emit('data', Buffer.from('partial'));r.req.emit('aborted');await s.close();assert.equal(s.receipt().requestAborted, true);
  assert.equal(s.receipt().request.complete, false);assert.equal(s.receipt().request.rawLength, 7);
  assert.equal(s.receipt().response, null);
  const g = fakeHttp(), input = scenario();input.phaseDeadlineMs = Date.now()+20;
  const t = await createInterruptionLoopback({ scenario: input, phase: 'interrupt', httpModule: g.api });
  await new Promise(resolve => setTimeout(resolve, 35));assert.equal(t.receipt().failure, 'PHASE_DEADLINE');await t.close();
});
test('failed listen and already-aborted ownership refuse without leaked server', async () => {
  const f = fakeHttp();f.server.listen = () => { f.server.emit('error', new Error('synthetic')); };
  await assert.rejects(createInterruptionLoopback({ scenario: scenario(), phase: 'interrupt', httpModule: f.api }));
  const controller = new AbortController();controller.abort();
  await assert.rejects(createInterruptionLoopback({ scenario: scenario(), phase: 'interrupt', httpModule: f.api, signal: controller.signal }), /SERVER_CONFIGURATION/);
});
