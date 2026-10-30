/** Browser-only service tests (correction 03).
 *
 * Group A calls the REAL imported owners for their own refusals/receipts. Group B exercises the service lifetime with
 * scripted constructor seams (Windows cannot run the Linux launch/context/cgroup/socket chain) while the canonical
 * teardown stays real. Scripted ports are not native or physical evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {binding, installation, enabledPolicy} from '../../worker/conversation/browser/test/fixtures.mjs';
import {validateBrowserPolicy} from '../../worker/conversation/browser/policy.mjs';
import {createBrowserOnlyHostLauncher} from '../../worker/conversation/host/launcher/supervisor.mjs';
import {createHostWideProcessObserver} from '../../worker/conversation/host/host-wide-process-observer.mjs';
import {createBrowserOperationHost} from '../../worker/conversation/host/browser-operation-host.mjs';
import {createBrowserViewerHostServer} from '../../worker/conversation/host/browser-viewer-transport.mjs';
import {createConversationHostTeardown, HOST_PROCESS_ABSENCE_SCHEMA} from '../../worker/conversation/host/teardown.mjs';
import {assertBrowserOnlyServiceInputs, composeBrowserOnlyHostService} from './composition.mjs';

const {launch, ...contextInstallation} = installation;
const policy = validateBrowserPolicy(enabledPolicy());
const policySha256 = canonicalSha256(policy);
const cwd = `/workspace/${binding.conversationId}`;
const paths = Object.freeze({root: `${cwd}/.browser`, home: `${cwd}/.browser/home`, profile: `${cwd}/.browser/profile`, output: `${cwd}/.browser/output`});
const allocation = Object.freeze({
  schema: 'meri-conversation-host-allocation/1', tenantId: binding.tenantId, conversationId: binding.conversationId, generation: 1,
  hostMode: 'browser-only', hostId: '00000000-0000-4000-8000-000000000002',
  imageDigest: `sha256:${'a'.repeat(64)}`, leaseDeadlineMs: Date.now() + 300000,
});
const hostIdentity = Object.freeze({
  schema: 'meri-d005-host-identity/1', instanceId: 'i-0123456789abcdef0',
  bootId: '00000000-0000-4000-8000-000000000003', conversationId: binding.conversationId, hostId: allocation.hostId,
});

function telemetry() {
  const events = [];
  return {
    events,
    browser: {async revoke() { events.push('egress-revoke'); return {revoked: true}; }, async close() { events.push('egress-close'); return {closed: true}; }},
    processes: {async arm() { events.push('observer-arm'); return {armed: true}; }, async waitForExit() { events.push('observe-processes'); return undefined; }, async close() { events.push('observer-close'); }},
    sessionProcesses: {async waitForExit() { events.push('observe-session'); return undefined; }},
    host: {async destroy() { events.push('physical-destroy'); throw Error('cloud-unbound'); }, async observeAbsent() { events.push('physical-observe'); return undefined; }},
  };
}

// ------------------------------------------------------------------ A. REAL owners
test('real browser-only launcher refuses a conversation allocation', () => {
  const {hostMode, ...conversationAllocation} = allocation;
  assert.throws(() => createBrowserOnlyHostLauncher({
    allocation: conversationAllocation, binding, hostIdentity, helperPath: '/opt/meri/bin/meri-host-launcher',
    browserNetwork: {}, authority: {policySha256, maxFreshMs: 1000, readCurrent: async () => ({})},
    browserUid: 2002, browserGid: 2002, onBrowserPrepared: async () => {},
  }), error => error?.code === 'HOST_LAUNCH_CONFIGURATION');
});

test('real host-wide observer refuses an sdk leader kind for a browser-only allocation', () => {
  const stub = {openGroup: async () => ({}), readLeaderCgroup: async () => null, readBootId: async () => hostIdentity.bootId};
  assert.throws(() => createHostWideProcessObserver({
    allocation, binding, hostIdentity, profile: paths.profile, verifyConfinement: async () => ({}), ports: stub, leaderKind: 'sdk',
  }), error => error?.code === 'HOST_PROCESS_CONFIGURATION');
});

test('real operation host requires the sessions model-tool surface', () => {
  assert.throws(() => createBrowserOperationHost({binding, readRun: async () => ({}), sessions: {}, now: () => 1}));
});

test('real viewer transport refuses a relay without execute/readAdmission', () => {
  assert.throws(() => createBrowserViewerHostServer({
    bind: {address: '127.0.0.1', port: 0}, tls: {serverName: 'browser.meri.internal'},
    peer: {name: 'control.meri.internal', fingerprintSha256: 'a'.repeat(64)}, relay: {}, custodyOwner: {},
  }));
});

test('real teardown preserves UNKNOWN for browser-only placement with absent evidence', async () => {
  const t = telemetry();
  const teardown = createConversationHostTeardown({
    allocation, binding, hostIdentity, cwd, browserPolicySha256: policySha256,
    ports: {browser: t.browser, processes: t.processes, host: t.host}, now: Date.now,
  });
  const receipt = await teardown.settle({reason: 'conversation-end'}).catch(error => {
    assert.equal(error?.code, 'HOST_TEARDOWN_UNKNOWN');
    return error.receipt;
  });
  assert.equal(receipt.status, 'UNKNOWN');
  assert.equal(receipt.bashEgress, 'not-applicable');
  assert.equal(receipt.processScope, 'browser-host-descendants');
});

test('real teardown refuses browser-only ports for a conversation allocation', () => {
  const {hostMode, ...conversationAllocation} = allocation;
  const t = telemetry();
  assert.throws(() => createConversationHostTeardown({
    allocation: conversationAllocation, binding, hostIdentity, cwd, browserPolicySha256: policySha256,
    ports: {browser: t.browser, processes: t.processes, host: t.host},
  }), error => error?.code === 'HOST_TEARDOWN_CONFIGURATION');
});

// ------------------------------------------------------------------ B. service lifetime
function lifecycle({launchFails = false, viewFails = false, preparePending = false, viewPending = false} = {}) {
  const t = telemetry();
  const events = t.events;
  const counters = {open: 0, arms: 0};
  let release, releaseView, prepared, viewEntered;
  const gate = new Promise(resolve => { release = () => resolve({readable: {}, writable: {}, installation: contextInstallation, close: async () => { events.push('launch-close'); }}); });
  const viewGate = new Promise(resolve => { releaseView = () => resolve({address: '127.0.0.1', port: 9443}); });
  const sessions = {
    ownerInstanceId: 'session-facade',
    async open() { counters.open++; events.push('session-open'); },
    async destroy() { events.push('session-destroy'); },
  };
  let capturedReadRun;
  const input = {
    allocation, binding, hostIdentity, cwd, deadlineMs: Date.now() + 60000, policy, installation: contextInstallation,
    upstream: {}, controls: {bind() {}}, current: async () => ({}), siteWorkflows: {}, hold: async () => ({}),
    sessionProcesses: t.sessionProcesses, processes: t.processes, host: t.host, browser: t.browser, browserNetwork: {},
    authority: {readCurrent: async () => ({}), policySha256},
    helperPath: '/opt/meri/bin/meri-host-launcher', browserUid: 2002, browserGid: 2002,
    readRun: async () => ({binding, cwd, deadlineMs: Date.now() + 60000, port: {modelTransport: 'host-owned', policy: async () => policy}}),
    viewer: {bind: {address: '127.0.0.1', port: 9443}, tls: {serverName: 'browser.meri.internal'}, peer: {name: 'control.meri.internal', fingerprintSha256: 'a'.repeat(64)}},
  };
  const deps = {
    launcher: () => ({
      async prepareBrowserContext() {
        events.push('prepare');
        if (launchFails) throw Object.assign(Error('LAUNCH_REFUSED'), {code: 'HOST_LAUNCH_UNKNOWN'});
        return preparePending ? gate : {readable: {}, writable: {}, installation: contextInstallation, close: async () => { events.push('launch-close'); }};
      },
      close: async () => { events.push('launcher-close'); },
    }),
    contextPort: () => ({async create() { return {}; }, close: async () => { events.push('context-close'); }}),
    sessionHost: () => sessions,
    operationHost: options => { capturedReadRun = options.readRun; events.push('operation-host'); return {executeBrowserOperation: async () => ({})}; },
    viewer: () => ({
      async start() {
        events.push('viewer-start');
        if (viewFails) throw Error('LISTEN_FAILED');
        if (viewPending) { await viewGate; events.push('viewer-started-late'); return {address: '127.0.0.1', port: 9443}; }
        return {address: '127.0.0.1', port: 9443};
      },
      async close() { events.push('viewer-close'); if (viewFails === 'close') throw Error('CLOSE_FAILED'); return {closed: true}; },
    }),
  };
  return {input, deps, sessions, events, t, counters, release, releaseView, readRun: () => capturedReadRun};
}

test('startup failure runs the canonical teardown after stopping owned local resources', async () => {
  const f = lifecycle({viewFails: true});
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await assert.rejects(service.start(), /LISTEN_FAILED/u);
  assert.ok(f.events.includes('physical-destroy'), 'independent physical destruction attempted: '+JSON.stringify(f.events));
  assert.ok(f.events.includes('egress-revoke'), 'egress revoked before absence observation');
  assert.ok(f.events.indexOf('viewer-close') < f.events.indexOf('observe-processes'), 'local stop precedes recursive absence');
  assert.ok(f.events.indexOf('launcher-close') < f.events.indexOf('observe-processes'));
  assert.equal(f.events.at(-1), 'observer-close', 'observer retained until its proof was consumed');
  assert.equal(service.started, false);
  assert.equal(f.counters.open, 0, 'the service never opens the session facade');
});

test('a local close failure never prevents the physical destruction attempt', async () => {
  const f = lifecycle({viewFails: 'close'});
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await assert.rejects(service.start(), /BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN/u);
  assert.ok(f.events.includes('physical-destroy'));
  assert.ok(f.events.includes('physical-observe'));
});

test('a delayed preparation after destroy is disposed and never published', async () => {
  const f = lifecycle({preparePending: true});
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  const starting = service.start();
  await new Promise(resolve => setImmediate(resolve));
  const stopping = service.destroy();
  f.release();
  const receipt = await stopping;
  assert.equal(receipt.status, 'UNKNOWN');
  await assert.rejects(starting, /BROWSER_HOST_SERVICE_TORN_DOWN/u);
  assert.equal(service.started, false);
  assert.equal(f.counters.open, 0);
  assert.ok(f.events.includes('launcher-close'), 'late preparation result is disposed');
});

test('a delayed listener start after destroy is closed once and never published', async () => {
  const f = lifecycle({viewPending: true});
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  const starting = service.start();
  await new Promise(resolve => setImmediate(resolve));
  const stopping = service.destroy();
  f.releaseView();
  const receipt = await stopping;
  assert.equal(receipt.status, 'UNKNOWN');
  await assert.rejects(starting, /BROWSER_HOST_SERVICE_TORN_DOWN/u);
  assert.equal(service.started, false);
  assert.equal(f.events.filter(event => event === 'viewer-close').length, 1);
});

test('the canonical readRun is bound to the exact sessions facade and the service opens nothing', async () => {
  const f = lifecycle();
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  assert.equal(f.counters.open, 0);
  assert.equal(service.sessions, f.sessions);
  const facts = await f.readRun()({binding});
  assert.equal(facts.port.sessions, f.sessions, 'port.sessions is the exact facade served to the viewer');
  assert.equal(facts.port.modelTransport, 'host-owned');
});

test('session/run observation and host-wide physical observation stay separate', async () => {
  const f = lifecycle();
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  assert.notEqual(f.input.sessionProcesses, f.input.processes);
  await service.destroy();
  assert.ok(f.events.includes('observe-processes'));
  assert.equal(f.events.includes('observe-session'), false, 'physical teardown never reuses the per-profile contract');
});

test('retained source-run completion does not tear the browser host down', async () => {
  const f = lifecycle();
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  assert.deepEqual(service.sourceRunSettled(), {sourceSettled: true, retained: true});
  assert.equal(f.events.includes('viewer-close'), false);
  const receipt = await service.destroy({reason: 'conversation-end'});
  assert.equal(receipt.sourceSettled, true);
});

test('destroy is idempotent and abort routes through the same canonical final path', async () => {
  const f = lifecycle();
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  const first = await service.abort('revoked');
  const second = await service.destroy();
  assert.equal(first, second);
  assert.equal(f.events.filter(event => event === 'physical-destroy').length, 1);
  await assert.rejects(service.start(), /BROWSER_HOST_SERVICE_TORN_DOWN/u);
});

test('SDK/provider/Bash-shaped configuration is refused before any effect', () => {
  const base = {...lifecycle().input};
  for (const name of ['processClientFactory', 'runnerQuery', 'modelTransport', 'bash', 'providerCredentials', 'capabilityPolicy']) {
    assert.throws(() => assertBrowserOnlyServiceInputs({...base, [name]: () => ({})}), error => error?.code === 'BROWSER_HOST_SERVICE_SDK_UNSUPPORTED', name);
  }
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, allocation: {...allocation, hostMode: undefined}}), error => error?.code === 'BROWSER_HOST_SERVICE_PLACEMENT_REFUSED');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, sessionProcesses: {}}), error => error?.code === 'BROWSER_HOST_SERVICE_BROWSER_OBSERVER_UNBOUND');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, processes: {}}), error => error?.code === 'BROWSER_HOST_SERVICE_PROCESS_OBSERVER_UNBOUND');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, viewer: {bind: {}}}), error => error?.code === 'BROWSER_HOST_SERVICE_VIEWER_UNBOUND');
});
