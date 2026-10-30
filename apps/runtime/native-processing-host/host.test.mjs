/** Inert native-processing-host tests: configuration, closed request, handler and readiness. No socket, TLS handshake,
 *  native child, cgroup or credential read. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nativeProcessingConfig} from './config.mjs';
import {createInspectionHandler,inspectionRequest,NATIVE_INSPECTION_PATH,NATIVE_INSPECTION_SCHEMA} from './service.mjs';
import {nativeProcessingReadiness} from './entrypoint.mjs';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ENV = Object.freeze({
  MERI_NATIVE_PROCESSING_PORT: '9443',
  MERI_NATIVE_PROCESSING_TLS_KEY: '/run/meri/processing/tls.key',
  MERI_NATIVE_PROCESSING_TLS_CERT: '/run/meri/processing/tls.crt',
  MERI_NATIVE_PROCESSING_PEER_SAN: 'control.meri.internal',
  MERI_NATIVE_PROCESSING_PEER_FINGERPRINT: 'a'.repeat(64),
  MERI_NATIVE_PROCESSING_IMAGE_DIGEST: `sha256:${'b'.repeat(64)}`,
  MERI_NATIVE_PROCESSING_HOST_ID: uuid(7),
  MERI_NATIVE_PROCESSING_GENERATION: '3',
  MERI_NATIVE_PROCESSING_CONVERSATION_ID: uuid(3),
  MERI_NATIVE_PROCESSING_LEASE_DEADLINE_MS: String(Date.now() + 600000),
  MERI_NATIVE_PROCESSING_CPU_QUOTA_US: '50000',
  MERI_NATIVE_PROCESSING_CPU_PERIOD_US: '100000',
  MERI_NATIVE_PROCESSING_MEMORY_BYTES: '268435456',
  MERI_NATIVE_PROCESSING_PIDS_MAX: '16',
  MERI_NATIVE_PROCESSING_DEADLINE_MAX_MS: '30000',
  MERI_NATIVE_PROCESSING_BODY_BYTES: '1048576',
  MERI_NATIVE_PROCESSING_HELPER: '/usr/lib/meri/meri-host-launcher',
  MERI_NATIVE_PROCESSING_HOME: '/run/meri/processing',
  MERI_NATIVE_PROCESSING_DEFINITIONS: '/run/meri/upload-definitions',
  MERI_NATIVE_PROCESSING_EXTRACTOR: '/opt/meri/apps/control/uploads/native/extract.py',
  MERI_NATIVE_PROCESSING_SCRATCH: '/run/meri/upload-scratch',
  MERI_NATIVE_PROCESSING_RUNTIME_UID: '1000',
  MERI_NATIVE_PROCESSING_RUNTIME_GID: '1000',
  MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS: '/proc/1/environ,/root/.aws/credentials',
});

test('a complete fixed configuration is accepted and a missing protected inventory is refused', () => {
  const config = nativeProcessingConfig({env: ENV});
  assert.equal(config.listen.port, 9443);
  assert.equal(config.paths.runtimeUid, 1000);
  assert.deepEqual(config.paths.credentialPaths, ['/proc/1/environ', '/root/.aws/credentials']);
  const missingInventory = {...ENV};
  delete missingInventory.MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS;
  assert.throws(() => nativeProcessingConfig({env: missingInventory}),
    error => error?.code === 'NATIVE_PROCESSING_CONFIGURATION');
});

test('bad transport, identity and limit values are refused', () => {
  for (const [key, value] of [
    ['MERI_NATIVE_PROCESSING_PORT', '80'],
    ['MERI_NATIVE_PROCESSING_PEER_SAN', '*.meri.internal'],
    ['MERI_NATIVE_PROCESSING_PEER_FINGERPRINT', 'zz'.repeat(32)],
    ['MERI_NATIVE_PROCESSING_IMAGE_DIGEST', 'sha256:short'],
    ['MERI_NATIVE_PROCESSING_CPU_QUOTA_US', '0'],
    ['MERI_NATIVE_PROCESSING_PIDS_MAX', '4097'],
    ['MERI_NATIVE_PROCESSING_DEADLINE_MAX_MS', '100'],
    ['MERI_NATIVE_PROCESSING_TLS_KEY', 'relative/key.pem'],
    ['MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS', '/ok/../bad'],
  ]) {
    assert.throws(() => nativeProcessingConfig({env: {...ENV, [key]: value}}),
      error => error?.code === 'NATIVE_PROCESSING_CONFIGURATION', key);
  }
});

const bytes = Buffer.from('# fixed upload content\n');
const request = extra => ({schema: NATIVE_INSPECTION_SCHEMA, requestId: uuid(1), imageDigest: `sha256:${'b'.repeat(64)}`,
  declarationId: 'c'.repeat(64), format: 'md', bytesB64: bytes.toString('base64'),
  deadlineMs: Date.now() + 5000, ...extra});

test('the inspection request is closed: unknown keys, bad base64 and out-of-bounds deadlines are refused', () => {
  const parsed = inspectionRequest(request(), {deadlineMaxMs: 30000, bodyBytes: 65536});
  assert.equal(parsed.bytes.length, bytes.length);
  assert.equal(parsed.file.sha256, createHash('sha256').update(bytes).digest('hex'));
  for (const bad of [request({command:'/bin/sh'}), request({argv:['-c','id']}), request({cwd:'/tmp'}),
    request({bytesB64:'notbase64'}), request({deadlineMs: Date.now() - 1}), request({deadlineMs: Date.now() + 600000})]) {
    assert.throws(() => inspectionRequest(bad, {deadlineMaxMs: 30000, bodyBytes: 65536}),
      error => ['NATIVE_INSPECTION_REQUEST', 'NATIVE_INSPECTION_DEADLINE'].includes(error?.code));
  }
});

function handlerPorts({peerVerified = true, run = async () => ({scan: {status: 'clean'}})} = {}) {
  const calls = [];
  const handler = createInspectionHandler({
    authenticate: async ({socket}) => { calls.push(['authenticate', socket.encrypted]); return {verified: peerVerified}; },
    readBody: async () => Buffer.from(JSON.stringify(request())),
    runInspection: async input => { calls.push(['run', input.request.requestId]); return run(input); },
    limits: {deadlineMaxMs: 30000, bodyBytes: 65536},
  });
  return {handler, calls};
}
const fakeReq = (overrides = {}) => ({method: 'POST', url: NATIVE_INSPECTION_PATH, httpVersionMajor: 2,
  socket: {encrypted: true, alpnProtocol: 'h2', getPeerCertificate: () => ({})}, headers: {}, ...overrides});
const fakeRes = () => { const out = {status: 0, body: '', writeHead(status) { out.status = status; }, end(body) { out.body = body; } }; return out; };

test('the handler authenticates the peer before running the fixed operation and returns the closed result', async () => {
  const {handler, calls} = handlerPorts();
  const res = fakeRes();
  await handler(fakeReq(), res);
  assert.equal(res.status, 200);
  assert.deepEqual(calls[0], ['authenticate', true]);
  assert.deepEqual(calls[1][0], 'run');
  assert.equal(JSON.parse(res.body).scan.status, 'clean');
});

test('an unauthenticated peer, a wrong route and a plaintext socket are refused without running anything', async () => {
  const {handler, calls} = handlerPorts({peerVerified: false});
  const denied = fakeRes();
  await handler(fakeReq(), denied);
  assert.equal(denied.status, 403);
  assert.equal(calls.filter(call => call[0] === 'run').length, 0);

  const route = fakeRes();
  await handlerPorts().handler(fakeReq({url: '/other'}), route);
  assert.equal(route.status, 404);

  const tls = fakeRes();
  await handlerPorts().handler(fakeReq({socket: {encrypted: false, alpnProtocol: null}}), tls);
  assert.equal(tls.status, 403);
});

test('a run failure is reported with its closed code and never as a successful inspection', async () => {
  const {handler} = handlerPorts({run: async () => { throw Object.assign(Error('NATIVE_PROCESSING_UNAVAILABLE'), {code: 'NATIVE_PROCESSING_UNAVAILABLE'}); }});
  const res = fakeRes();
  await handler(fakeReq(), res);
  assert.equal(res.status, 400);
  assert.deepEqual(JSON.parse(res.body), {error: 'NATIVE_PROCESSING_UNAVAILABLE'});
});

test('readiness names the exact Parent join and never reports ready without it', () => {
  const config = nativeProcessingConfig({env: ENV});
  const readiness = nativeProcessingReadiness({config, parent: null});
  assert.equal(readiness.ready, false);
  assert.ok(readiness.missing.some(entry => entry.startsWith('parent.authorize:')));
  assert.ok(readiness.missing.some(entry => entry.startsWith('parent.placement:')));
  assert.equal(readiness.endpoint, '/internal/upload-inspection');
});
