/** Inert entrypoint/config tests: no environment mutation, no I/O, no effects. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readBrowserHostServiceConfig} from './config.mjs';
import {browserHostServiceReadiness, PRODUCTION_BINDINGS} from './entrypoint.mjs';

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

test('config parses exactly and reports nothing missing', () => {
  const parsed = readBrowserHostServiceConfig(env);
  assert.deepEqual(parsed.missing, []);
  assert.deepEqual(parsed.invalid, []);
  assert.equal(parsed.config.viewer.bind.port, 9443);
});

test('config names absent and malformed values without defaulting them', () => {
  const parsed = readBrowserHostServiceConfig({});
  assert.equal(parsed.config, null);
  assert.equal(parsed.missing.length, Object.keys(env).length);
  const bad = readBrowserHostServiceConfig({...env, MERI_HOST_SERVICE_VIEWER_BIND_PORT: '0', MERI_HOST_SERVICE_PEER_FINGERPRINT: 'nope', MERI_HOST_SERVICE_VIEWER_BIND_ADDRESS: '0.0.0.0'});
  assert.deepEqual(bad.invalid.sort(), ['MERI_HOST_SERVICE_PEER_FINGERPRINT', 'MERI_HOST_SERVICE_VIEWER_BIND_ADDRESS', 'MERI_HOST_SERVICE_VIEWER_BIND_PORT']);
  assert.equal(bad.config, null);
});

test('readiness refuses while any production binding is unbound, naming each one', () => {
  const readiness = browserHostServiceReadiness({env, bound: []});
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.missing, PRODUCTION_BINDINGS.map(binding => binding.name));
  assert.ok(readiness.missing.includes('provisioning.loginCredentialReference'));
  assert.ok(readiness.missing.includes('processes'));
});

test('no SDK/query/provider/Bash binding is claimed by the browser-only service', () => {
  const names = PRODUCTION_BINDINGS.map(binding => binding.name).join(' ').toLowerCase();
  for (const forbidden of ['runnerquery', 'preparedrunner', 'processclientfactory', 'modelproxy', 'providercredential', 'sdkquery', 'bash']) {
    assert.equal(names.includes(forbidden), false, forbidden);
  }
});

test('readiness is true only when configuration and every binding are supplied', () => {
  assert.equal(browserHostServiceReadiness({env, bound: PRODUCTION_BINDINGS.map(binding => binding.name)}).ready, true);
  assert.equal(browserHostServiceReadiness({env: {}, bound: PRODUCTION_BINDINGS.map(binding => binding.name)}).ready, false);
});

test('every declared binding names an owner and carries no secret material', () => {
  for (const binding of PRODUCTION_BINDINGS) {
    assert.equal(typeof binding.owner, 'string');
    assert.ok(binding.owner.length > 0);
  }
  assert.equal(/password|BEGIN [A-Z ]*PRIVATE KEY/iu.test(JSON.stringify(PRODUCTION_BINDINGS)), false);
});
