/** Inert entrypoint/readiness tests: no environment mutation, no I/O, no service start, no certificate generation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {browserHostServiceReadiness, createBrowserHostServiceEntrypoint, PRODUCTION_BINDINGS} from './entrypoint.mjs';
import {serviceFixture, allocation} from './fixture.mjs';

test('readiness never accepts a caller-supplied list of binding NAMES', () => {
  const readiness = browserHostServiceReadiness({bound: PRODUCTION_BINDINGS.map(binding => binding.name), inputs: undefined});
  assert.equal(readiness.ready, false);
  assert.ok(readiness.missing.includes('owner inputs'));
});

test('readiness is false for known-invalid or incomplete owner objects', () => {
  const base = serviceFixture().input;
  assert.equal(browserHostServiceReadiness({inputs: {...base, dispose: undefined}}).ready, false);
  assert.equal(browserHostServiceReadiness({inputs: {...base, policy: {}}}).ready, false);
  assert.equal(browserHostServiceReadiness({inputs: {...base, authority: {...base.authority, unexpected: true}}}).ready, false);
  assert.equal(browserHostServiceReadiness({inputs: {...base, authority: {policySha256: base.authority.policySha256, readCurrent: async () => ({})}}}).ready, false);
  assert.equal(browserHostServiceReadiness({inputs: {...base, allocation: {...allocation, hostMode: undefined}}}).ready, false);
  assert.ok(browserHostServiceReadiness({inputs: {...base, retirement: undefined}}).missing.includes('retirement'));
  const {host, ...provisioned} = base;
  assert.equal(browserHostServiceReadiness({inputs: provisioned}).ready, true, 'a provisioned host has no cloud destroy port');
});

test('readiness is true only for fully validated owner objects on the static TLS fixture', () => {
  const readiness = browserHostServiceReadiness({inputs: serviceFixture().input});
  assert.deepEqual(readiness.missing, []);
  assert.equal(readiness.ready, true);
});

test('the entrypoint respects readiness and composes without starting', () => {
  const refused = createBrowserHostServiceEntrypoint({inputs: {...serviceFixture().input, dispose: undefined}});
  assert.equal(refused.ready, false);
  assert.ok(refused.missing.length > 0);
  assert.equal(typeof refused.start, 'function');
  const entry = createBrowserHostServiceEntrypoint({inputs: serviceFixture().input});
  assert.equal(entry.ready, true);
  assert.equal(entry.service.started, false, 'construction is inert');
  assert.equal(typeof entry.stop, 'function');
});

test('no SDK/query/provider/Bash binding is claimed by this service', () => {
  const names = PRODUCTION_BINDINGS.map(binding => binding.name).join(' ').toLowerCase();
  for (const forbidden of ['runnerquery', 'preparedrunner', 'processclientfactory', 'modelproxy', 'providercredential', 'sdkquery', 'bash']) {
    assert.equal(names.includes(forbidden), false, forbidden);
  }
});
