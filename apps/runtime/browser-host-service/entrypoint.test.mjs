/** Inert entrypoint/readiness tests: no environment mutation, no I/O, no service start. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readBrowserHostServiceConfig} from './config.mjs';
import {browserHostServiceReadiness, createBrowserHostServiceEntrypoint, PRODUCTION_BINDINGS} from './entrypoint.mjs';

const env = {
  MERI_HOST_SERVICE_VIEWER_BIND_ADDRESS: '10.0.0.12',
  MERI_HOST_SERVICE_VIEWER_BIND_PORT: '9443',
  MERI_HOST_SERVICE_VIEWER_SERVER_NAME: 'browser.meri.internal',
  MERI_HOST_SERVICE_VIEWER_CERT_FILE: '/etc/meri/viewer.crt',
  MERI_HOST_SERVICE_VIEWER_KEY_FILE: '/etc/meri/viewer.key',
  MERI_HOST_SERVICE_VIEWER_CLIENT_CA_FILE: '/etc/meri/control-ca.crt',
  MERI_HOST_SERVICE_PEER_NAME: 'control.meri.internal',
  MERI_HOST_SERVICE_PEER_FINGERPRINT: 'b'.repeat(64),
};

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const binding = {tenantId: uuid(1), actorId: uuid(2), conversationId: uuid(3), runId: uuid(4), attemptId: uuid(5), workerId: uuid(6), writerFence: 1};
const allocation = {schema: 'meri-conversation-host-allocation/1', tenantId: binding.tenantId, conversationId: binding.conversationId, generation: 1, hostMode: 'browser-only', hostId: uuid(7), imageDigest: `sha256:${'a'.repeat(64)}`, leaseDeadlineMs: Date.now() + 60000};
const hostIdentity = {schema: 'meri-d005-host-identity/1', instanceId: 'i-0123456789abcdef0', bootId: uuid(8), conversationId: binding.conversationId, hostId: allocation.hostId};
const inputs = {
  allocation, binding, hostIdentity, cwd: `/workspace/${binding.conversationId}`, deadlineMs: Date.now() + 60000,
  policy: {}, installation: {}, upstream: {}, controls: {bind() {}}, current: async () => ({}), siteWorkflows: {},
  hold: async () => ({}), sessionProcesses: {waitForExit: async () => undefined},
  processes: {arm: async () => ({armed: true}), waitForExit: async () => undefined, close: async () => {}},
  host: {destroy: async () => ({}), observeAbsent: async () => ({})},
  browser: {revoke: async () => ({revoked: true}), close: async () => ({closed: true})},
  browserNetwork: {}, authority: {readCurrent: async () => ({}), policySha256: 'c'.repeat(64)},
  helperPath: '/opt/meri/bin/meri-host-launcher', browserUid: 2002, browserGid: 2002, readRun: async () => ({}),
  viewer: {bind: {address: '127.0.0.1', port: 9443}, tls: {serverName: 'browser.meri.internal'}, peer: {name: 'control.meri.internal', fingerprintSha256: 'a'.repeat(64)}},
};

test('config parses exactly and names malformed values without defaults', () => {
  assert.deepEqual(readBrowserHostServiceConfig(env).missing, []);
  assert.equal(readBrowserHostServiceConfig(env).config.viewer.bind.port, 9443);
  const bad = readBrowserHostServiceConfig({...env, MERI_HOST_SERVICE_VIEWER_BIND_PORT: '0', MERI_HOST_SERVICE_PEER_FINGERPRINT: 'nope'});
  assert.deepEqual(bad.invalid.sort(), ['MERI_HOST_SERVICE_PEER_FINGERPRINT', 'MERI_HOST_SERVICE_VIEWER_BIND_PORT']);
  assert.equal(bad.config, null);
});

test('readiness never accepts a caller-supplied list of binding NAMES', () => {
  const names = PRODUCTION_BINDINGS.map(binding => binding.name);
  const readiness = browserHostServiceReadiness({env, bound: names, inputs: undefined});
  assert.equal(readiness.ready, false);
  assert.ok(readiness.missing.includes('owner inputs'));
});

test('readiness consumes actual validated owner objects and names the missing one', () => {
  assert.equal(browserHostServiceReadiness({env, inputs}).ready, true);
  const {processes, ...withoutObserver} = inputs;
  const partial = browserHostServiceReadiness({env, inputs: withoutObserver});
  assert.equal(partial.ready, false);
  assert.ok(partial.missing.includes('processes') || partial.missing.includes('owner inputs'), JSON.stringify(partial.missing));
  assert.equal(browserHostServiceReadiness({env: {}, inputs}).ready, false, 'viewer material/config is still required');
});

test('browser-only entrypoint composes concrete objects but starts nothing', () => {
  const absent = createBrowserHostServiceEntrypoint({});
  assert.equal(absent.ready, false);
  assert.ok(absent.missing.includes('owner inputs'));
  const entry = createBrowserHostServiceEntrypoint({inputs});
  assert.equal(entry.ready, true);
  assert.equal(typeof entry.start, 'function');
  assert.equal(typeof entry.stop, 'function');
  assert.equal(entry.service.started, false, 'construction is inert');
});

test('no SDK/query/provider/Bash binding is claimed by this service', () => {
  const names = PRODUCTION_BINDINGS.map(binding => binding.name).join(' ').toLowerCase();
  for (const forbidden of ['runnerquery', 'preparedrunner', 'processclientfactory', 'modelproxy', 'providercredential', 'sdkquery', 'bash']) {
    assert.equal(names.includes(forbidden), false, forbidden);
  }
});
