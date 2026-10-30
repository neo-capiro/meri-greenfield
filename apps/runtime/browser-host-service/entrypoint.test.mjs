/** Inert entrypoint/readiness tests: no environment mutation, no I/O, no service start. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readBrowserHostServiceConfig} from './config.mjs';
import {browserHostServiceReadiness, createBrowserHostServiceEntrypoint, PRODUCTION_BINDINGS} from './entrypoint.mjs';
import {serviceFixture, allocation} from './fixture.mjs';

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

test('config parses exactly and names malformed values without defaults', () => {
  assert.deepEqual(readBrowserHostServiceConfig(env).missing, []);
  assert.equal(readBrowserHostServiceConfig(env).config.viewer.bind.port, 9443);
  const bad = readBrowserHostServiceConfig({...env, MERI_HOST_SERVICE_VIEWER_BIND_PORT: '0', MERI_HOST_SERVICE_PEER_FINGERPRINT: 'nope'});
  assert.deepEqual(bad.invalid.sort(), ['MERI_HOST_SERVICE_PEER_FINGERPRINT', 'MERI_HOST_SERVICE_VIEWER_BIND_PORT']);
  assert.equal(bad.config, null);
});

test('readiness never accepts a caller-supplied list of binding NAMES', () => {
  const readiness = browserHostServiceReadiness({env, bound: PRODUCTION_BINDINGS.map(binding => binding.name), inputs: undefined});
  assert.equal(readiness.ready, false);
  assert.ok(readiness.missing.includes('owner inputs'));
});

test('readiness is false for known-invalid or incomplete owner objects', () => {
  const base = serviceFixture().input;
  assert.equal(browserHostServiceReadiness({env, inputs: {...base, dispose: undefined}}).ready, false);
  assert.equal(browserHostServiceReadiness({env, inputs: {...base, policy: {}}}).ready, false);
  assert.equal(browserHostServiceReadiness({env, inputs: {...base, installation: {}}}).ready, false);
  assert.equal(browserHostServiceReadiness({env, inputs: {...base, viewer: {bind: base.viewer.bind, tls: {serverName: base.viewer.tls.serverName}, peer: base.viewer.peer}}}).ready, false);
  assert.equal(browserHostServiceReadiness({env, inputs: {...base, allocation: {...allocation, hostMode: undefined}}}).ready, false);
  assert.equal(browserHostServiceReadiness({env: {}, inputs: base}).ready, false, 'viewer configuration is still required');
});

test('readiness is true only for fully validated owner objects', () => {
  const readiness = browserHostServiceReadiness({env, inputs: serviceFixture().input});
  assert.deepEqual(readiness.missing, []);
  assert.equal(readiness.ready, true);
});

test('the entrypoint respects readiness and composes without starting', () => {
  const refused = createBrowserHostServiceEntrypoint({env, inputs: {...serviceFixture().input, dispose: undefined}});
  assert.equal(refused.ready, false);
  assert.ok(refused.missing.length > 0);
  const entry = createBrowserHostServiceEntrypoint({env, inputs: serviceFixture().input});
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
