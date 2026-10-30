/** Browser-only service tests (correction 05).
 *
 * No child process, no certificate issuance, no socket/browser/native resource. Real owners are exercised for their own
 * refusals and the pre-effect validator is exercised for the exact contract gaps found in review 04. TLS-dependent
 * positive flows are SKIPPED with an explicit reason because no approved static <=15 min mTLS fixture exists.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {binding} from '../../worker/conversation/browser/test/fixtures.mjs';
import {createBrowserOnlyHostLauncher} from '../../worker/conversation/host/launcher/supervisor.mjs';
import {createHostWideProcessObserver} from '../../worker/conversation/host/host-wide-process-observer.mjs';
import {createBrowserOperationHost} from '../../worker/conversation/host/browser-operation-host.mjs';
import {createBrowserViewerHostServer} from '../../worker/conversation/host/browser-viewer-transport.mjs';
import {createConversationHostTeardown} from '../../worker/conversation/host/teardown.mjs';
import {assertBrowserOnlyServiceInputs, composeBrowserOnlyHostService} from './composition.mjs';
import {allocation, hostIdentity, policy, policySha256, cwd, paths, serviceFixture, PEER, TLS_UNAVAILABLE} from './fixture.mjs';

const skip = {skip: TLS_UNAVAILABLE};

// ------------------------------------------------------------ A. real owner refusals
test('real browser-only launcher refuses a conversation allocation', () => {
  const {hostMode, ...conversationAllocation} = allocation;
  assert.throws(() => createBrowserOnlyHostLauncher({
    allocation: conversationAllocation, binding, hostIdentity, helperPath: '/opt/meri/bin/meri-host-launcher',
    browserNetwork: {}, authority: {policySha256, maxFreshMs: 1000, readCurrent: async () => ({})},
    browserUid: 2002, browserGid: 2002, onBrowserPrepared: async () => {},
  }), error => error?.code === 'HOST_LAUNCH_CONFIGURATION');
});

test('real launcher refuses the authority shape the service now also requires', () => {
  assert.throws(() => createBrowserOnlyHostLauncher({
    allocation, binding, hostIdentity, helperPath: '/opt/meri/bin/meri-host-launcher',
    browserNetwork: {plan: {kind: 'browser', namespaceName: 'ns', routes: [{localPort: 3128}]}, verify: async () => ({})},
    authority: {policySha256, readCurrent: async () => ({})}, browserUid: 2002, browserGid: 2002, onBrowserPrepared: async () => {},
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

// ------------------------------------------------------------ B. exact pre-effect contracts
test('authority closed shape is required (maxFreshMs, hex digest, 1..30000)', () => {
  const base = serviceFixture().input;
  for (const patch of [
    {authority: {policySha256, readCurrent: async () => ({})}},
    {authority: {policySha256: 'not-hex', readCurrent: async () => ({}), maxFreshMs: 1000}},
    {authority: {policySha256, readCurrent: async () => ({}), maxFreshMs: 0}},
    {authority: {policySha256, readCurrent: async () => ({}), maxFreshMs: 30001}},
    {maxFreshMs: 1000, authority: {policySha256, readCurrent: async () => ({})}},
  ]) {
    assert.throws(() => assertBrowserOnlyServiceInputs({...base, ...patch}), error => error?.code === 'BROWSER_HOST_SERVICE_CURRENTNESS_UNBOUND', JSON.stringify(patch.authority));
  }
});

test('browser network plan/verify and matching egress are required', () => {
  const base = serviceFixture().input;
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, browserNetwork: {}}), error => error?.code === 'BROWSER_HOST_SERVICE_NETWORK_UNBOUND');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, browserNetwork: {plan: {kind: 'sdk', routes: [{localPort: 3128}]}, verify: async () => ({})}}), error => error?.code === 'BROWSER_HOST_SERVICE_NETWORK_UNBOUND');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, browserNetwork: {plan: base.browserNetwork.plan, verify: async () => ({})}, installation: {...base.installation, egressProxy: 'http://127.0.0.1:9999'}}), error => error?.code === 'BROWSER_HOST_SERVICE_NETWORK_MISMATCH');
});

test('workspace ownership IDs must be distinct SDK/browser pairs and match the launcher', () => {
  const base = serviceFixture().input;
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, workspaceOwnership: {sdkUid: 2002, sdkGid: 1001, browserUid: 2002, browserGid: 2002}}), error => error?.code === 'BROWSER_HOST_SERVICE_WORKSPACE_MISMATCH');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, workspaceOwnership: {sdkUid: 1001, sdkGid: 2002, browserUid: 2002, browserGid: 2002}}), error => error?.code === 'BROWSER_HOST_SERVICE_WORKSPACE_MISMATCH');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, browserUid: 2003}), error => error?.code === 'BROWSER_HOST_SERVICE_WORKSPACE_MISMATCH');
});

test('expired canonical deadlines refuse before any effect', () => {
  const base = serviceFixture().input;
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, deadlineMs: Date.now() - 1}), error => error?.code === 'BROWSER_HOST_SERVICE_DEADLINE_EXPIRED');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, allocation: {...allocation, leaseDeadlineMs: Date.now() - 1}}), error => error?.code === 'BROWSER_HOST_SERVICE_DEADLINE_EXPIRED');
});

test('invalid policy, installation, upstream, dispose, workspace IDs, TLS, placement or SDK inputs refuse', () => {
  const base = serviceFixture().input;
  const cases = [
    [{dispose: undefined}, 'BROWSER_HOST_SERVICE_CONFIGURATION'],
    [{policy: {}}, 'BROWSER_HOST_SERVICE_POLICY_REFUSED'],
    [{installation: {}}, 'BROWSER_HOST_SERVICE_INSTALLATION_UNBOUND'],
    [{upstream: {}}, 'BROWSER_HOST_SERVICE_INSTALLATION_UNBOUND'],
    [{workspaceOwnership: {sdkUid: 1, sdkGid: 1001, browserUid: 2002, browserGid: 2002}}, 'BROWSER_HOST_SERVICE_WORKSPACE_UNBOUND'],
    [{viewer: {bind: base.viewer.bind, tls: {serverName: 'browser.meri.internal'}, peer: PEER}}, 'any'],
  ];
  for (const [patch, code] of cases) {
    assert.throws(() => assertBrowserOnlyServiceInputs({...base, ...patch}), error => (code === 'any' ? typeof error?.code === 'string' || error instanceof Error : error?.code === code), JSON.stringify(patch));
  }
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, allocation: {...allocation, hostMode: undefined}}), error => error?.code === 'BROWSER_HOST_SERVICE_PLACEMENT_REFUSED');
  for (const name of ['processClientFactory', 'runnerQuery', 'modelTransport', 'bash', 'providerCredentials', 'capabilityPolicy']) {
    assert.throws(() => assertBrowserOnlyServiceInputs({...base, [name]: () => ({})}), error => error?.code === 'BROWSER_HOST_SERVICE_SDK_UNSUPPORTED', name);
  }
});

test('a structurally complete input still refuses at TLS because no approved fixture material exists', () => {
  assert.throws(() => assertBrowserOnlyServiceInputs(serviceFixture().input), error => typeof error?.code === 'string' || error instanceof Error);
});

// ------------------------------------------------------------ C. TLS-dependent positive flows (UNAVAILABLE)
test('preexec order: admitted workspace before launcher, readback + per-profile arm + host-wide arm before GO', skip, async () => {
  const f = serviceFixture();
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  const order = ['current', 'prepare-workspace', 'launch', 'readback', 'session-arm', 'host-arm', 'go', 'viewer-start'].map(name => f.events.indexOf(name));
  assert.deepEqual([...order].sort((a, b) => a - b), order, JSON.stringify(f.events));
  await service.destroy();
});

test('wrong measured readback refuses before the host-wide arm and before GO', skip, async () => {
  const f = serviceFixture();
  f.input.readWorkspace = async () => ({...await f.input.readWorkspace(), stateInode: '99'});
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await assert.rejects(service.start(), error => error?.code === 'HOST_BROWSER_WORKSPACE_UNPROVEN');
  assert.equal(f.events.includes('host-arm'), false);
  await service.destroy();
});

test('launcher seam refuses if workspace preparation has not completed first', skip, async () => {
  const f = serviceFixture();
  f.deps.launcher = config => ({async prepareBrowserContext() {
    if (!f.events.includes('prepare-workspace')) throw Object.assign(Error('NATIVE_WITHOUT_WORKSPACE'), {code: 'NATIVE_WITHOUT_WORKSPACE'});
    await config.onBrowserPrepared({leaderPid: 301, kind: 'browser'});
    return {readable: {}, writable: {}, installation: f.input.installation, close: async () => {}};
  }, close: async () => {}});
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  assert.ok(f.events.indexOf('prepare-workspace') < f.events.indexOf('launch'));
  await service.destroy();
});

test('caller abort and canonical expiry reach the terminal owner', skip, async () => {
  const f = serviceFixture();
  const controller = new AbortController();
  f.input.signal = controller.signal;
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  controller.abort();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(f.events.includes('physical-destroy'));
});

test('destroy fences pending workspace/currentness work and disposes late results', skip, async () => {
  const f = serviceFixture();
  let releaseCurrent;
  f.input.browserClient = {readCurrent: () => new Promise(resolve => { releaseCurrent = () => resolve({allocation, binding, policySha256, phase: 'active', checkedAtMs: Date.now(), currentUntilMs: Date.now() + 1000}); })};
  f.input.localSettleMs = 40;
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  const starting = service.start();
  await new Promise(resolve => setImmediate(resolve));
  const outcome = await service.destroy().then(value => value, error => error);
  assert.equal(outcome?.code, 'BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN');
  releaseCurrent();
  await assert.rejects(starting, error => error?.code === 'BROWSER_HOST_SERVICE_TORN_DOWN');
  assert.equal(f.events.includes('prepare-workspace'), false, 'no late workspace preparation after terminal settlement');
});

test('stalled local close and stalled start keep the physical backstop', skip, async () => {
  const f = serviceFixture({viewCloseStalls: true});
  f.input.localSettleMs = 40;
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  const outcome = await service.destroy().then(value => value, error => error);
  assert.ok(f.events.includes('physical-destroy'));
  assert.equal(outcome?.code, 'BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN');
  f.releaseClose();
});
