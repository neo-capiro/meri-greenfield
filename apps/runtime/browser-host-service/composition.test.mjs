/** Browser-only service tests (correction 04).
 *
 * Real imported owners are exercised for their own refusals/receipts and for the pre-exec workspace/readback/observer
 * joins. Only the Linux-only launcher/context/session/viewer constructors and lowest-level native/socket/physical ports
 * are scripted; the canonical teardown and the workspace/readback helpers stay real.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {binding} from '../../worker/conversation/browser/test/fixtures.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createBrowserOnlyHostLauncher} from '../../worker/conversation/host/launcher/supervisor.mjs';
import {createHostWideProcessObserver} from '../../worker/conversation/host/host-wide-process-observer.mjs';
import {createBrowserOperationHost} from '../../worker/conversation/host/browser-operation-host.mjs';
import {createBrowserViewerHostServer} from '../../worker/conversation/host/browser-viewer-transport.mjs';
import {createConversationHostTeardown} from '../../worker/conversation/host/teardown.mjs';
import {assertBrowserOnlyServiceInputs, composeBrowserOnlyHostService} from './composition.mjs';
import {allocation, hostIdentity, policy, policySha256, cwd, paths, serviceFixture, workspaceReadback, PEER} from './fixture.mjs';

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
    peer: {name: 'control.meri.internal', fingerprintSha256: PEER.fingerprintSha256}, relay: {}, custodyOwner: {},
  }));
});

test('real teardown preserves UNKNOWN for browser-only placement with absent evidence', async () => {
  const f = serviceFixture();
  const teardown = createConversationHostTeardown({
    allocation, binding, hostIdentity, cwd, browserPolicySha256: policySha256,
    ports: {browser: f.input.browser, processes: f.input.processes, host: f.input.host}, now: Date.now,
  });
  const receipt = await teardown.settle({reason: 'conversation-end'}).catch(error => {
    assert.equal(error?.code, 'HOST_TEARDOWN_UNKNOWN');
    return error.receipt;
  });
  assert.equal(receipt.status, 'UNKNOWN');
  assert.equal(receipt.bashEgress, 'not-applicable');
  assert.equal(receipt.processScope, 'browser-host-descendants');
});

// ------------------------------------------------------------------ B. pre-effect validation
test('invalid policy, installation, upstream, workspace ownership, dispose or TLS never reaches an effect', () => {
  const base = serviceFixture().input;
  const cases = [
    [{dispose: undefined}, 'BROWSER_HOST_SERVICE_CONFIGURATION'],
    [{policy: {}}, 'BROWSER_HOST_SERVICE_POLICY_REFUSED'],
    [{installation: {}}, 'BROWSER_HOST_SERVICE_INSTALLATION_UNBOUND'],
    [{upstream: {}}, 'BROWSER_HOST_SERVICE_INSTALLATION_UNBOUND'],
    [{workspaceOwnership: {sdkUid: 1 /* invalid */, sdkGid: 1001, browserUid: 2002, browserGid: 2002}}, 'BROWSER_HOST_SERVICE_WORKSPACE_UNBOUND'],
    [{workspaceOwnership: {sdkUid: 1001, sdkGid: 1001, browserUid: 1003, browserGid: 2002}}, 'BROWSER_HOST_SERVICE_WORKSPACE_MISMATCH'],
    [{viewer: {bind: {address: '127.0.0.1', port: 9443}, tls: {serverName: 'browser.meri.internal'}, peer: PEER}}, 'any'],
  ];
  for (const [patch, code] of cases) {
    assert.throws(() => assertBrowserOnlyServiceInputs({...base, ...patch}), error => (code === 'any' ? true : error?.code === code), JSON.stringify(patch));
  }
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, allocation: {...allocation, hostMode: undefined}}), error => error?.code === 'BROWSER_HOST_SERVICE_PLACEMENT_REFUSED');
  for (const name of ['processClientFactory', 'runnerQuery', 'modelTransport', 'bash', 'providerCredentials', 'capabilityPolicy']) {
    assert.throws(() => assertBrowserOnlyServiceInputs({...base, [name]: () => ({})}), error => error?.code === 'BROWSER_HOST_SERVICE_SDK_UNSUPPORTED', name);
  }
});

test('a wrong measured workspace readback refuses before the host-wide arm and before GO', async () => {
  const f = serviceFixture();
  f.input.readWorkspace = async () => workspaceReadback({stateInode: '99'});
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await assert.rejects(service.start(), error => error?.code === 'HOST_BROWSER_WORKSPACE_UNPROVEN');
  assert.equal(f.events.includes('host-arm'), false, 'host-wide arm must not happen on a failed readback');
  assert.equal(f.events.includes('viewer-start'), false, 'GO never reached');
  assert.ok(f.events.includes('physical-destroy'));
});

test('preexec order: admitted workspace, exact readback, per-profile arm, host-wide arm, then GO', async () => {
  const f = serviceFixture();
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  const order = ['current', 'prepare-workspace', 'readback', 'session-arm', 'host-arm', 'viewer-start'].map(name => f.events.indexOf(name));
  assert.deepEqual([...order].sort((a, b) => a - b), order, JSON.stringify(f.events));
  await service.destroy();
});

test('canonical readRun is bound to the exact facade and the service opens nothing', async () => {
  const f = serviceFixture();
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  assert.equal(f.counters.open, 0);
  const facts = await f.readRun()({binding});
  assert.equal(facts.port.sessions, f.sessions);
  await service.destroy();
});

// ------------------------------------------------------------------ C. terminal triggers
test('caller AbortSignal terminates through the canonical final teardown, including during startup', async () => {
  const f = serviceFixture({preparePending: true});
  const controller = new AbortController();
  f.input.signal = controller.signal;
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  const starting = service.start();
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  f.releasePrepare();
  await assert.rejects(starting, error => typeof error?.code === 'string');
  const receipt = await service.destroy();
  assert.equal(receipt.status, 'UNKNOWN');
  assert.ok(f.events.includes('physical-destroy'));
  assert.ok(f.events.includes('viewer-close') || f.events.includes('launcher-close'));
});

test('canonical allocated/run expiry triggers the same terminal teardown', async () => {
  const f = serviceFixture();
  f.input.deadlineMs = Date.now() + 60;
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.ok(f.events.includes('physical-destroy'), 'expiry reached the canonical teardown');
  const receipt = await service.destroy();
  assert.equal(receipt.status, 'UNKNOWN');
});

test('a stalled local close becomes UNKNOWN and still allows the physical backstop', async () => {
  const f = serviceFixture({viewCloseStalls: true});
  f.input.localSettleMs = 40;
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  const receipt = await service.destroy({reason: 'conversation-end'}).then(value => value, error => error);
  assert.ok(f.events.includes('physical-destroy'), 'physical attempt happened despite the stall');
  assert.equal(receipt?.code, 'BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN');
  f.releaseClose();
});

test('a stalled start settlement does not block the physical backstop; a late result is not published', async () => {
  const f = serviceFixture({preparePending: true});
  f.input.localSettleMs = 40;
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  const starting = service.start();
  await new Promise(resolve => setImmediate(resolve));
  const outcome = await service.destroy().then(value => value, error => error);
  assert.equal(outcome?.code, 'BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN');
  assert.ok(f.events.includes('physical-destroy'));
  f.releasePrepare();
  await assert.rejects(starting, error => error?.code === 'BROWSER_HOST_SERVICE_TORN_DOWN');
  assert.equal(service.started, false);
});

test('retained source-run completion never destroys the browser host; stop stays idempotent', async () => {
  const f = serviceFixture();
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  assert.deepEqual(service.sourceRunSettled(), {sourceSettled: true, retained: true});
  assert.equal(f.events.includes('viewer-close'), false);
  const first = await service.destroy();
  const second = await service.destroy();
  assert.equal(first, second);
  await assert.rejects(service.start(), error => error?.code === 'BROWSER_HOST_SERVICE_TORN_DOWN');
});
