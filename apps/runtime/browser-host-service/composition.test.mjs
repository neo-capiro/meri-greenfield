/** Inert composition tests: local fakes only, no browser, host, SDK, provider or network. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {composeBrowserHostService, assertBrowserHostServiceInputs} from './composition.mjs';

const id = n => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const binding = {tenantId: id(1), actorId: id(2), conversationId: id(3), runId: id(4), attemptId: id(5), workerId: id(6), writerFence: 1};
const allocation = {hostId: id(8), generation: 1, leaseDeadlineMs: Date.now() + 60000};

function fixture(overrides = {}) {
  const calls = [];
  const settleCalls = [];
  let factoryTaken = 0;
  const facade = Object.freeze({
    ownerInstanceId: id(7),
    readAdmission: async () => ({admitted: true}), execute: async () => ({}), prepareResume: async () => ({}),
    adopt: async () => ({}), destroy: async () => ({destroyed: true}), open: async () => ({}),
  });
  const run = {
    allocation, binding, hostIdentity: {hostId: id(8), generation: 1}, browserPort: undefined, browserHost: facade,
    bashRuntimeFacts: {}, browserInstallation: undefined,
    processClientFactory() { factoryTaken++; if (factoryTaken > 1) throw Object.assign(new Error('HOST_SDK_QUERY_REUSED'), {code: 'HOST_SDK_QUERY_REUSED'}); calls.push('factory'); return {kind: 'one-sdk-query'}; },
    async settle({reason}) { settleCalls.push(reason); return {settled: true, reason}; },
  };
  const queries = [];
  const input = {
    allocation, binding, hostIdentity: run.hostIdentity, cwd: '/run/meri/x', deadlineMs: Date.now() + 60000,
    capabilityPolicy: {forRun() {}}, readBrowserPolicy: async () => ({enabled: true}),
    control: {}, model: {}, browser: {}, bash: {}, native: {}, network: {}, host: {},
    viewer: {bind: {address: '127.0.0.1', port: 9443}, tls: {serverName: 'browser.meri.internal'}, peer: {name: 'control.meri.internal', fingerprintSha256: 'a'.repeat(64)}},
    prepareGuestHostRun: async inputs => { calls.push('prepare'); assert.equal(inputs.binding, binding); return overrides.run ? await overrides.run(inputs, run) : run; },
    createBrowserViewerHostServer: config => {
      calls.push('viewer');
      assert.equal(config.relay, run.browserHost, 'relay must be the stable facade');
      assert.equal(config.custodyOwner, run.browserHost, 'custodyOwner must be the same facade identity');
      if (overrides.viewer) return overrides.viewer(config);
      return {async start() { calls.push('viewer-start'); return {address: '127.0.0.1', port: 9443}; }, async close() { calls.push('viewer-close'); return {closed: true}; }};
    },
    runnerQuery: query => { calls.push('query'); queries.push(query); if (overrides.runnerQuery) return overrides.runnerQuery(query); return {kind: 'prepared-query', client: query.processClientFactory()}; },
  };
  return {input, calls, settleCalls, queries, run, facade};
}

test('one prepared run, one viewer mount on the same facade, one prepared query', async () => {
  const f = fixture();
  const service = await composeBrowserHostService(f.input);
  assert.equal(f.calls.filter(call => call === 'prepare').length, 1);
  assert.equal(f.calls.filter(call => call === 'query').length, 1, 'exactly one prepared query');
  assert.equal(f.queries.length, 1);
  assert.equal(f.calls.filter(call => call === 'factory').length, 1, 'factory consumed once by the query');
  assert.equal(service.facade, f.facade);
  assert.equal(service.query.kind, 'prepared-query');
  assert.equal(service.query.client.kind, 'one-sdk-query');
  const started = await service.start();
  assert.deepEqual(started, {browser: true, address: {address: '127.0.0.1', port: 9443}});
  await assert.rejects(async () => service.start(), /BROWSER_HOST_SERVICE_VIEWER_STARTED/u);
  assert.deepEqual(f.settleCalls, [], 'composition alone never settles the host');
});

test('source-run completion retains the physical host; final destroy settles exactly once', async () => {
  const f = fixture();
  const service = await composeBrowserHostService(f.input);
  assert.deepEqual(service.sourceRunSettled(), {sourceSettled: true, retained: true});
  assert.deepEqual(f.settleCalls, [], 'a finished source run must not tear the host down');
  const first = await service.destroy({reason: 'final'});
  assert.equal(first.settled, true);
  assert.equal(first.viewerClosed, true);
  assert.deepEqual(f.settleCalls, ['final']);
  assert.equal(await service.destroy(), first, 'destroy is idempotent and settles once');
  assert.deepEqual(f.settleCalls, ['final']);
});

test('SDK-only run (no browser facade) mounts no viewer and still uses one query', async () => {
  const f = fixture({run: async (_inputs, base) => ({...base, browserHost: undefined})});
  const service = await composeBrowserHostService(f.input);
  assert.equal(service.viewer, null);
  assert.deepEqual(await service.start(), {browser: false});
  assert.equal(f.calls.filter(call => call === 'viewer').length, 0);
  assert.equal(f.calls.filter(call => call === 'query').length, 1);
  await service.destroy();
  assert.deepEqual(f.settleCalls, ['final']);
});

test('a query-construction failure settles the prepared host once and surfaces the error', async () => {
  const failure = Object.assign(new Error('QUERY_BOOTSTRAP_FAILED'), {code: 'QUERY_BOOTSTRAP_FAILED'});
  const f = fixture({runnerQuery: () => { throw failure; }});
  await assert.rejects(composeBrowserHostService(f.input), error => error === failure);
  assert.deepEqual(f.settleCalls, ['failed']);
});

test('an incomplete facade refuses before any query, and the prepared host is settled', async () => {
  const f = fixture({run: async (_inputs, base) => ({...base, browserHost: {readAdmission() {}, execute() {}}})});
  await assert.rejects(composeBrowserHostService(f.input), /BROWSER_HOST_SERVICE_FACADE_REFUSED/u);
  assert.deepEqual(f.calls.filter(call => call === 'query'), []);
  assert.deepEqual(f.settleCalls, ['failed']);
});

test('a cleanup failure during composition is reported, never masked by the startup error', async () => {
  const failure = Object.assign(new Error('QUERY_BOOTSTRAP_FAILED'), {code: 'QUERY_BOOTSTRAP_FAILED'});
  const f = fixture({runnerQuery: () => { throw failure; }});
  const original = f.input.prepareGuestHostRun;
  f.input.prepareGuestHostRun = async inputs => {
    const run = await original(inputs);
    return {...run, settle: async () => { throw Object.assign(new Error('HOST_BOOTSTRAP_CLEANUP_UNKNOWN'), {code: 'HOST_BOOTSTRAP_CLEANUP_UNKNOWN'}); }};
  };
  await assert.rejects(composeBrowserHostService(f.input), /BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN/u);
});

test('missing external functions refuse before prepareGuestHostRun is reached', async () => {
  const f = fixture();
  const withoutQuery = {...f.input}; delete withoutQuery.runnerQuery;
  assert.throws(() => assertBrowserHostServiceInputs(withoutQuery), /BROWSER_HOST_SERVICE_QUERY_UNBOUND/u);
  await assert.rejects(composeBrowserHostService(withoutQuery), /BROWSER_HOST_SERVICE_QUERY_UNBOUND/u);
  assert.deepEqual(f.calls.filter(call => call === 'prepare'), []);
  const noPolicy = {...f.input, capabilityPolicy: {}};
  assert.throws(() => assertBrowserHostServiceInputs(noPolicy), /BROWSER_HOST_SERVICE_POLICY_UNBOUND/u);
  const noViewer = {...f.input, viewer: {bind: {}}};
  assert.throws(() => assertBrowserHostServiceInputs(noViewer), /BROWSER_HOST_SERVICE_VIEWER_UNBOUND/u);
});
