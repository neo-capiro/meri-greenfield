/** Browser-only service tests (correction 06). Real imported owners; inert scripted lowest-level ports; no child process. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {binding} from '../../worker/conversation/browser/test/fixtures.mjs';
import {createBrowserOnlyHostLauncher} from '../../worker/conversation/host/launcher/supervisor.mjs';
import {createHostWideProcessObserver} from '../../worker/conversation/host/host-wide-process-observer.mjs';
import {createBrowserOperationHost} from '../../worker/conversation/host/browser-operation-host.mjs';
import {createBrowserViewerHostServer} from '../../worker/conversation/host/browser-viewer-transport.mjs';
import {createConversationHostTeardown} from '../../worker/conversation/host/teardown.mjs';
import {assertBrowserOnlyServiceInputs, composeBrowserOnlyHostService} from './composition.mjs';
import {allocation, hostIdentity, policySha256, cwd, paths, serviceFixture, workspaceReadback, PEER, FIXTURE_NOW_MS} from './fixture.mjs';

// ------------------------------------------------------------ A. real owner refusals
test('real browser-only launcher refuses a conversation allocation', t => {
  // supervisor scope() reads Date.now() for the lease check before any injected clock, so pin the wall clock to the
  // existing fixed fixture clock for this call only. Assertions stay on the intended placement refusal.
  t.mock.timers.enable({apis: ['Date'], now: FIXTURE_NOW_MS});
  t.after(() => t.mock.timers.reset());
  const {hostMode, ...conversationAllocation} = allocation;
  assert.throws(() => createBrowserOnlyHostLauncher({
    allocation: conversationAllocation, binding, hostIdentity, helperPath: '/opt/meri/bin/meri-host-launcher',
    browserNetwork: {}, authority: {policySha256, maxFreshMs: 1000, readCurrent: async () => ({})},
    browserUid: 2002, browserGid: 2002, onBrowserPrepared: async () => {},
  }), error => error?.code === 'HOST_LAUNCH_CONFIGURATION');
});

test('real launcher rejects the same authority extra key this service rejects', t => {
  // Same scoped clock pin: the real launcher's lease check must not pre-empt the authority-shape refusal under test.
  t.mock.timers.enable({apis: ['Date'], now: FIXTURE_NOW_MS});
  t.after(() => t.mock.timers.reset());
  const authority = {policySha256, maxFreshMs: 1000, readCurrent: async () => ({}), unexpected: true};
  assert.throws(() => createBrowserOnlyHostLauncher({
    allocation, binding, hostIdentity, helperPath: '/opt/meri/bin/meri-host-launcher',
    browserNetwork: {plan: {kind: 'browser', namespaceName: 'ns', routes: [{localPort: 3128}]}, verify: async () => ({})},
    authority, browserUid: 2002, browserGid: 2002, onBrowserPrepared: async () => {},
  }), error => error?.code === 'HOST_LAUNCH_CONFIGURATION');
  assert.throws(() => assertBrowserOnlyServiceInputs(serviceFixture().input && {...serviceFixture().input, authority}),
    error => error?.code === 'BROWSER_HOST_SERVICE_AUTHORITY_SHAPE_REFUSED');
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
    ports: {browser: f.input.browser, processes: f.input.processes, host: f.input.host}, now: () => FIXTURE_NOW_MS,
  });
  const receipt = await teardown.settle({reason: 'conversation-end'}).catch(error => {
    assert.equal(error?.code, 'HOST_TEARDOWN_UNKNOWN');
    return error.receipt;
  });
  assert.equal(receipt.status, 'UNKNOWN');
  assert.equal(receipt.processScope, 'browser-host-descendants');
});

// ------------------------------------------------------------ B. exact pre-effect contracts
test('authority closed shape rejects extra keys and each invalid field', () => {
  const base = serviceFixture().input;
  const cases = [
    [{...base.authority, unexpected: true}, 'BROWSER_HOST_SERVICE_AUTHORITY_SHAPE_REFUSED'],
    [{policySha256, readCurrent: async () => ({})}, 'BROWSER_HOST_SERVICE_AUTHORITY_SHAPE_REFUSED'],
    [{policySha256: 'not-hex', readCurrent: async () => ({}), maxFreshMs: 1000}, 'BROWSER_HOST_SERVICE_CURRENTNESS_UNBOUND'],
    [{policySha256, readCurrent: async () => ({}), maxFreshMs: 0}, 'BROWSER_HOST_SERVICE_CURRENTNESS_UNBOUND'],
    [{policySha256, readCurrent: async () => ({}), maxFreshMs: 30001}, 'BROWSER_HOST_SERVICE_CURRENTNESS_UNBOUND'],
  ];
  for (const [authority, code] of cases) {
    assert.throws(() => assertBrowserOnlyServiceInputs({...base, authority}), error => error?.code === code, JSON.stringify(authority));
  }
});

test('browser network plan/verify, egress match, UID pairs and deadlines are enforced', () => {
  const base = serviceFixture().input;
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, browserNetwork: {}}), error => error?.code === 'BROWSER_HOST_SERVICE_NETWORK_UNBOUND');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, browserNetwork: {plan: base.browserNetwork.plan, verify: async () => ({})}, installation: {...base.installation, egressProxy: 'http://127.0.0.1:9999'}}), error => error?.code === 'BROWSER_HOST_SERVICE_NETWORK_MISMATCH');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, workspaceOwnership: {sdkUid: 2002, sdkGid: 1001, browserUid: 2002, browserGid: 2002}}), error => error?.code === 'BROWSER_HOST_SERVICE_WORKSPACE_MISMATCH');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, deadlineMs: FIXTURE_NOW_MS - 1}), error => error?.code === 'BROWSER_HOST_SERVICE_DEADLINE_EXPIRED');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, policy: {}}), error => error?.code === 'BROWSER_HOST_SERVICE_POLICY_REFUSED');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, dispose: undefined}), error => error?.code === 'BROWSER_HOST_SERVICE_CONFIGURATION');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, allocation: {...allocation, hostMode: undefined}}), error => error?.code === 'BROWSER_HOST_SERVICE_PLACEMENT_REFUSED');
  assert.throws(() => assertBrowserOnlyServiceInputs({...base, processClientFactory: () => ({})}), error => error?.code === 'BROWSER_HOST_SERVICE_SDK_UNSUPPORTED');
});

// ------------------------------------------------------------ C. positive lifecycle (static TLS fixture + fixed clock)
test('workspace preparation precedes launcher construction; readback + both observer arms precede GO', async () => {
  const f = serviceFixture();
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  const order = ['current', 'prepare-workspace', 'launcher-ctor', 'prepare', 'readback', 'session-arm', 'host-arm', 'go', 'viewer-start'].map(name => f.events.indexOf(name));
  assert.ok(order.every(index => index >= 0), JSON.stringify(f.events));
  assert.deepEqual([...order].sort((a, b) => a - b), order, JSON.stringify(f.events));
  await service.destroy();
});

test('wrong measured readback refuses before the host-wide arm and before GO', async () => {
  const f = serviceFixture();
  f.input.readWorkspace = async () => workspaceReadback({stateInode: '99'});
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await assert.rejects(service.start(), error => error?.code === 'HOST_BROWSER_WORKSPACE_UNPROVEN');
  assert.equal(f.events.includes('host-arm'), false);
  assert.equal(f.events.includes('go'), false);
  assert.ok(f.events.includes('physical-destroy'));
});

test('a launcher that starts before workspace preparation is refused by the service seam', async () => {
  const f = serviceFixture();
  f.deps.launcher = config => {
    f.events.push('launcher-ctor');
    return {async prepareBrowserContext() {
      if (!f.events.includes('prepare-workspace')) throw Object.assign(Error('NATIVE_WITHOUT_WORKSPACE'), {code: 'NATIVE_WITHOUT_WORKSPACE'});
      await config.onBrowserPrepared({leaderPid: 301, kind: 'browser'});
      f.events.push('go');
      return {readable: {}, writable: {}, installation: f.input.installation, close: async () => {}};
    }, close: async () => { f.events.push('launcher-close'); }};
  };
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  assert.ok(f.events.indexOf('prepare-workspace') < f.events.indexOf('launcher-ctor'));
  await service.destroy();
});

test('no premature session open; canonical readRun binds the exact facade', async () => {
  const f = serviceFixture();
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  assert.equal(f.counters.open, 0);
  assert.equal(service.sessions, f.sessions);
  await service.destroy();
});

test('caller abort terminates through the canonical teardown, including during startup', async () => {
  const f = serviceFixture({preparePending: true});
  const controller = new AbortController();
  f.input.signal = controller.signal;
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  const starting = service.start();
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  f.releasePrepare();
  await assert.rejects(starting, error => typeof error?.code === 'string');
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(f.events.includes('physical-destroy'));
  await service.destroy();
});

test('allocated/run expiry terminates through the same canonical teardown', async () => {
  const f = serviceFixture();
  f.input.deadlineMs = FIXTURE_NOW_MS + 60;
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.ok(f.events.includes('physical-destroy'));
  await service.destroy();
});

test('startup failure revokes the terminal lifetime and still runs the physical backstop', async () => {
  const f = serviceFixture({viewFails: true});
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await assert.rejects(service.start(), /LISTEN_FAILED/u);
  assert.ok(f.events.includes('physical-destroy'));
  assert.ok(f.events.indexOf('viewer-close') < f.events.indexOf('observe-processes'));
  assert.equal(f.events.at(-1), 'session-observer-close');
  const receipt = await service.destroy();
  assert.equal(receipt.status, 'UNKNOWN');
});

test('a delayed readback released after destroy acquires no observer and publishes nothing', async () => {
  const f = serviceFixture();
  let releaseReadback;
  f.input.readWorkspace = () => new Promise(resolve => { releaseReadback = () => resolve(workspaceReadback()); });
  f.input.localSettleMs = 40;
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  const starting = service.start();
  await new Promise(resolve => setImmediate(resolve));
  const stopping = service.destroy();
  const outcome = await stopping.then(value => value, error => error);
  assert.equal(outcome?.code, 'BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN');
  releaseReadback();
  await assert.rejects(starting, error => typeof error?.code === 'string');
  assert.equal(f.events.includes('session-arm'), false, 'no late per-profile arm');
  assert.equal(f.events.includes('host-arm'), false, 'no late host-wide arm');
  assert.equal(service.started, false);
});

test('stalled local close yields UNKNOWN but the physical backstop still runs', async () => {
  const f = serviceFixture({viewCloseStalls: true});
  f.input.localSettleMs = 40;
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  const outcome = await service.destroy().then(value => value, error => error);
  assert.equal(outcome?.code, 'BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN');
  assert.ok(f.events.includes('physical-destroy'));
  f.releaseClose();
});

test('stalled start settlement does not block the backstop and a late result is never published', async () => {
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

test('retained source-run completion never destroys; stop is idempotent and post-destroy start is refused', async () => {
  const f = serviceFixture();
  const service = composeBrowserOnlyHostService(f.input, f.deps);
  await service.start();
  assert.deepEqual(service.sourceRunSettled(), {sourceSettled: true, retained: true});
  assert.equal(f.events.includes('viewer-close'), false);
  const first = await service.destroy();
  const second = await service.destroy();
  assert.equal(first, second);
  assert.equal(f.events.filter(event => event === 'physical-destroy').length, 1);
  await assert.rejects(service.start(), error => error?.code === 'BROWSER_HOST_SERVICE_TORN_DOWN');
});

test('the session owner is destroyed with the reason-derived trigger before local resources and physical teardown', async () => {
  for (const [reason, trigger] of [['conversation-end', 'conversation-end'], ['revoked', 'revocation'], ['lease-expired', 'ttl-expiry']]) {
    const f = serviceFixture();
    const triggers = [];
    f.deps.sessionHost = () => ({ownerInstanceId: 'session-facade', async open() {}, async destroy(input) { triggers.push(input.trigger); f.events.push('session-destroy'); }});
    const service = composeBrowserOnlyHostService(f.input, f.deps);
    await service.start();
    await service.destroy({reason});
    assert.deepEqual(triggers, [trigger]);
    const at = name => f.events.indexOf(name);
    assert.ok(at('session-destroy') >= 0 && at('session-destroy') < at('context-close') && at('session-destroy') < at('physical-destroy'), JSON.stringify(f.events));
  }
});

test('a session owner that never opened is skipped, and an unconfirmed destruction is a cleanup problem', async () => {
  const never = serviceFixture();
  never.deps.sessionHost = () => ({ownerInstanceId: 'session-facade', async open() {}, async destroy() { throw Object.assign(Error('BROWSER_CUSTODY_UNAVAILABLE'), {code: 'BROWSER_CUSTODY_UNAVAILABLE'}); }});
  const quiet = composeBrowserOnlyHostService(never.input, never.deps);
  await quiet.start();
  await quiet.destroy();
  assert.ok(never.events.includes('physical-destroy'));
  const incomplete = serviceFixture();
  incomplete.deps.sessionHost = () => ({ownerInstanceId: 'session-facade', async open() {}, async destroy() { throw Object.assign(Error('BROWSER_DISPOSE_INCOMPLETE'), {code: 'BROWSER_DISPOSE_INCOMPLETE'}); }});
  const service = composeBrowserOnlyHostService(incomplete.input, incomplete.deps);
  await service.start();
  const outcome = await service.destroy().then(value => value, error => error);
  assert.equal(outcome?.code, 'BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN');
  assert.ok(incomplete.events.includes('physical-destroy'), 'physical teardown still runs');
});
