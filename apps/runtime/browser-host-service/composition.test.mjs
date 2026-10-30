/** Browser-only service tests.
 *
 * Two groups:
 *  A. REAL owner APIs: every assertion below calls the imported merged constructor and checks its own refusal or receipt.
 *  B. Service lifecycle: the Windows-hostile Linux launch chain (native exec, cgroup, socket) is replaced only at the
 *     four constructor seams; the canonical teardown owner stays real. Scripted ports are not native/Linux evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {posix} from 'node:path';
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

function ports({processAbsent = false, hostAbsent = false, destroyThrows = true} = {}) {
  const calls = [];
  return {
    calls,
    browser: {async revoke() { calls.push('revoke'); return {revoked: true}; }, async close() { calls.push('close'); return {closed: true}; }},
    processes: {async arm() { return {armed: true}; }, async waitForExit() { calls.push('waitForExit'); return processAbsent ? {schema: HOST_PROCESS_ABSENCE_SCHEMA, observedAtMs: Date.now(), scope: 'browser-host-descendants', exited: true, remainingPids: []} : undefined; }, async close() {}},
    host: {async destroy() { calls.push('destroy'); if (destroyThrows) throw Error('cloud-unbound'); return {resources: {}}; }, async observeAbsent() { return hostAbsent ? {} : undefined; }},
  };
}

// ---------------------------------------------------------------- A. real owners
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

test('real teardown preserves UNKNOWN for a browser-only allocation with absent evidence', async () => {
  const p = ports({processAbsent: false, hostAbsent: false, destroyThrows: true});
  const teardown = createConversationHostTeardown({
    allocation, binding, hostIdentity, cwd, browserPolicySha256: policySha256,
    ports: {browser: p.browser, processes: p.processes, host: p.host}, now: Date.now,
  });
  const receipt = await teardown.settle({reason: 'conversation-end'}).catch(error => { assert.equal(error?.code, 'HOST_TEARDOWN_UNKNOWN'); return error.receipt; });
  assert.equal(receipt.status, 'UNKNOWN');
  assert.equal(receipt.bashEgress, 'not-applicable');
  assert.equal(receipt.processScope, 'browser-host-descendants');
  assert.equal(receipt.processes, 'unknown');
  assert.equal(receipt.browserEgress, 'closed');
});

test('real teardown refuses browser-only ports for a conversation allocation', () => {
  const {hostMode, ...conversationAllocation} = allocation;
  const p = ports();
  assert.throws(() => createConversationHostTeardown({
    allocation: conversationAllocation, binding, hostIdentity, cwd, browserPolicySha256: policySha256,
    ports: {browser: p.browser, processes: p.processes, host: p.host},
  }), error => error?.code === 'HOST_TEARDOWN_CONFIGURATION');
});

test('the service accepts no SDK/provider/Bash configuration and requires browser-only placement', () => {
  const base = {allocation, binding, hostIdentity, cwd, deadlineMs: Date.now() + 60000, policy, installation: contextInstallation,
    upstream: {}, controls: {bind() {}}, current: async () => ({}), siteWorkflows: {}, hold: async () => ({}),
    processes: ports().processes, host: ports().host, browser: ports().browser, browserNetwork: {}, authority: {readCurrent: async () => ({}), policySha256},
    helperPath: '/opt/meri/bin/meri-host-launcher', browserUid: 2002, browserGid: 2002, readRun: async () => ({}),
    viewer: {bind: {address: '127.0.0.1', port: 9443}, tls: {serverName: 'browser.meri.internal'}, peer: {name: 'control.meri.internal', fingerprintSha256: 'a'.repeat(64)}}};
  for (const name of ['processClientFactory', 'runnerQuery', 'modelTransport', 'bash', 'providerCredentials', 'capabilityPolicy']) {
    assert.throws(() => assertBrowserOnlyServiceInputs({...base, [name]: () => ({})}), error => error?.code === 'BROWSER_HOST_SERVICE_SDK_UNSUPPORTED', name);
  }
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, allocation: {...allocation, hostMode: undefined}}), error => error?.code === 'BROWSER_HOST_SERVICE_PLACEMENT_REFUSED');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, processes: {}}), error => error?.code === 'BROWSER_HOST_SERVICE_PROCESS_OBSERVER_UNBOUND');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, viewer: {bind: {}}}), error => error?.code === 'BROWSER_HOST_SERVICE_VIEWER_UNBOUND');
  assert.equal(assertBrowserOnlyServiceInputs(base), base);
});

// ---------------------------------------------------------------- B. lifecycle (scripted constructor seams)
function lifecycle({launchFails = false, viewFails = false, openFails = false, teardownFails = false} = {}) {
  const events = [];
  const sessions = {
    ownerInstanceId: 'session-facade',
    async open() { events.push('session-open'); if (openFails) throw Object.assign(Error('OPEN_REFUSED'), {code: 'BROWSER_HOST_BINDING_REFUSED'}); },
    async destroy() { events.push('session-destroy'); },
  };
  const input = {
    allocation, binding, hostIdentity, cwd, deadlineMs: Date.now() + 60000, policy, installation: contextInstallation,
    upstream: {}, controls: {bind() {}}, current: async () => ({}), siteWorkflows: {}, hold: async () => ({}),
    processes: ports().processes, host: ports().host, browser: ports().browser, browserNetwork: {},
    authority: {readCurrent: async () => ({}), policySha256},
    helperPath: '/opt/meri/bin/meri-host-launcher', browserUid: 2002, browserGid: 2002,
    readRun: async () => ({}), viewer: {bind: {address: '127.0.0.1', port: 9443}, tls: {serverName: 'browser.meri.internal'}, peer: {name: 'control.meri.internal', fingerprintSha256: 'a'.repeat(64)}},
  };
  const deps = {
    launcher: () => ({
      async prepareBrowserContext() { events.push('launch'); if (launchFails) throw Object.assign(Error('LAUNCH_REFUSED'), {code: 'HOST_LAUNCH_UNKNOWN'}); return {readable: {}, writable: {}, installation: contextInstallation, close: async () => { events.push('launch-close'); }}; },
      close: async () => { events.push('launch-close'); },
    }),
    contextPort: () => ({async create() { return {}; }, close: async () => { events.push('context-close'); }}),
    sessionHost: () => sessions,
    operationHost: () => ({executeBrowserOperation: async () => ({})}),
    viewer: () => ({async start() { events.push('viewer-start'); if (viewFails) throw Error('LISTEN_FAILED'); return {address: '10.0.0.12', port: 9443}; }, async close() { events.push('viewer-close'); return {closed: true}; }}),
  };
  return {input, deps, events, sessions};
}

test('a start rejection closes every obtained local resource and never reports success', async () => {
  const f = lifecycle({viewFails: true});
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await assert.rejects(service.start(), /LISTEN_FAILED/u);
  assert.equal(service.started, false);
  for (const step of ['viewer-close', 'context-close', 'launch-close']) assert.ok(f.events.includes(step), `cleanup step ${step}`);
  await assert.rejects(service.start(), /BROWSER_HOST_SERVICE/u);
});

test('a later constructor failure still closes earlier resources', async () => {
  const f = lifecycle({openFails: true});
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await assert.rejects(service.start(), error => error?.code === 'BROWSER_HOST_BINDING_REFUSED');
  assert.ok(f.events.includes('viewer-close'));
  assert.ok(f.events.includes('launch-close'));
});

test('concurrent starts run one launch; repeated starts and post-destroy starts are refused', async () => {
  const f = lifecycle();
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  const [a, b] = await Promise.all([service.start(), service.start()]);
  assert.deepEqual(a, b);
  assert.equal(f.events.filter(step => step === 'launch').length, 1);
  await assert.rejects(service.start(), /BROWSER_HOST_SERVICE_STARTED/u);
  const receipt = await service.destroy({reason: 'conversation-end'});
  assert.equal(receipt.status, 'UNKNOWN', 'absent physical evidence stays UNKNOWN');
  assert.ok(f.events.includes('viewer-close'));
  await assert.rejects(service.start(), /BROWSER_HOST_SERVICE_TORN_DOWN/u);
});

test('destroy is idempotent and settles the canonical teardown once', async () => {
  const f = lifecycle();
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  const first = await service.destroy();
  const second = await service.destroy();
  assert.equal(first, second);
  assert.equal(f.events.filter(step => step === 'viewer-close').length, 1);
});

test('retained source-run completion does not destroy the browser host', async () => {
  const f = lifecycle();
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  assert.deepEqual(service.sourceRunSettled(), {sourceSettled: true, retained: true});
  assert.equal(f.events.includes('viewer-close'), false);
  const receipt = await service.destroy({reason: 'conversation-end'});
  assert.equal(receipt.sourceSettled, true);
  assert.equal(f.events.includes('viewer-close'), true);
});

test('a cleanup failure is reported, not masked as an ordinary result', async () => {
  const f = lifecycle();
  f.deps.viewer = () => ({async start() { throw Error('LISTEN_FAILED'); }, async close() { throw Error('CLOSE_FAILED'); }});
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await assert.rejects(service.start(), error => error?.code === 'BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN');
});
