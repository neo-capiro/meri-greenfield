/** Inert shared fixture for the browser-only service tests (no child processes, no certificate issuance).
 *
 * TLS: no approved compatible STATIC source certificate material (<=15 min lifetime, exact DNS SAN) exists in this tree,
 * and this allocation forbids minting certificates or running helper children. TLS-dependent positive flows are
 * therefore reported unavailable and skipped with an explicit reason; every non-TLS validation and real-owner refusal
 * still runs.
 */
import {binding, installation, enabledPolicy} from '../../worker/conversation/browser/test/fixtures.mjs';
import {validateBrowserPolicy} from '../../worker/conversation/browser/policy.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {BROWSER_WORKSPACE_READBACK_SCHEMA} from '../../worker/conversation/host/browser-workspace/readback.mjs';
import {browserPaths} from '../../worker/conversation/browser/workspace.mjs';

/** Exact reason shown for every skipped TLS-dependent case (no material is invented). */
export const TLS_UNAVAILABLE = 'unavailable: no approved static <=15min mTLS fixture with the required DNS SAN; minting certificates and helper children are out of scope';

export const {launch, ...contextInstallation} = installation;
export const policy = validateBrowserPolicy(enabledPolicy());
export const policySha256 = canonicalSha256(policy);
export const cwd = `/workspace/${binding.conversationId}`;
export const paths = browserPaths(cwd);
export const allocation = Object.freeze({
  schema: 'meri-conversation-host-allocation/1', tenantId: binding.tenantId, conversationId: binding.conversationId, generation: 1,
  hostMode: 'browser-only', hostId: '00000000-0000-4000-8000-000000000002',
  imageDigest: `sha256:${'a'.repeat(64)}`, leaseDeadlineMs: Date.now() + 300000,
});
export const hostIdentity = Object.freeze({
  schema: 'meri-d005-host-identity/1', instanceId: 'i-0123456789abcdef0',
  bootId: '00000000-0000-4000-8000-000000000003', conversationId: binding.conversationId, hostId: allocation.hostId,
});
export const PEER = Object.freeze({name: 'control.meri.internal', fingerprintSha256: 'b'.repeat(64)});

export function workspaceReadback(overrides = {}) {
  return {
    schema: BROWSER_WORKSPACE_READBACK_SCHEMA,
    allocationSha256: canonicalSha256(allocation), bindingSha256: canonicalSha256(binding),
    hostIdentitySha256: canonicalSha256(hostIdentity), cwd, profile: paths.profile, output: paths.output, home: paths.home,
    browserUid: 2002, browserGid: 2002, sdkUid: 1001, sdkGid: 1001, leaderPid: 301,
    browserMountNamespace: 'mnt:[4026533000]', browserStartTicks: '12345', overlayMountId: '55', stateMountId: '56',
    originalCwdInode: '42', stateInode: '43', observedAtMs: Date.now(), ...overrides,
  };
}

/** Structurally complete input whose TLS bytes are absent; validation must refuse it before any effect. */
export function baseInput(overrides = {}) {
  const events = [];
  const input = {
    allocation, binding, hostIdentity, cwd, deadlineMs: Date.now() + 60000,
    policy, installation: contextInstallation, upstream: {createConnection() {}}, controls: {bind() {}},
    current: async () => ({binding}), siteWorkflows: {}, hold: async () => ({}), dispose: async () => ({disposed: true}),
    browserClient: {async readCurrent() { events.push('current'); return {allocation, binding, policySha256, phase: 'active', checkedAtMs: Date.now(), currentUntilMs: Date.now() + 1000}; }},
    maxFreshMs: 1000,
    workspaceOwnership: {sdkUid: 1001, sdkGid: 1001, browserUid: 2002, browserGid: 2002},
    prepareBrowserWorkspace: () => { events.push('prepare-workspace'); return {cwd, paths, cwdInode: '42', stateInode: '43'}; },
    readWorkspace: async () => { events.push('readback'); return workspaceReadback(); },
    sessionProcesses: {async arm() { events.push('session-arm'); return {armed: true}; }, async waitForExit() { return undefined; }, async close() { events.push('session-observer-close'); }},
    processes: {async arm() { events.push('host-arm'); return {armed: true}; }, async waitForExit() { events.push('observe-processes'); return undefined; }, async close() { events.push('host-observer-close'); }},
    host: {async destroy() { events.push('physical-destroy'); throw Error('cloud-unbound'); }, async observeAbsent() { events.push('physical-observe'); return undefined; }},
    browser: {async revoke() { events.push('egress-revoke'); return {revoked: true}; }, async close() { events.push('egress-close'); return {closed: true}; }},
    browserNetwork: {plan: {kind: 'browser', namespaceName: 'browser-ns', routes: [{name: 'browser-http', localPort: 3128}]}, verify: async () => ({})},
    authority: {readCurrent: async () => ({}), policySha256, maxFreshMs: 1000},
    helperPath: '/opt/meri/bin/meri-host-launcher', browserUid: 2002, browserGid: 2002,
    readRun: async () => ({binding, cwd, deadlineMs: Date.now() + 60000, port: {modelTransport: 'host-owned', policy: async () => policy}}),
    viewer: {bind: {address: '127.0.0.1', port: 9443}, tls: {serverName: 'browser.meri.internal'}, peer: PEER},
  };
  return {...input, ...overrides};
}

/** Scripted lowest-level ports; constructors stay real unless a Linux-only seam must be replaced. */
export function serviceFixture(overrides = {}) {
  const events = [];
  const counters = {open: 0, close: 0};
  let releasePrepare, releaseView, releaseClose;
  const prepareGate = new Promise(resolve => { releasePrepare = () => resolve({readable: {}, writable: {}, installation: contextInstallation, close: async () => { events.push('launch-close'); }}); });
  const viewGate = new Promise(resolve => { releaseView = () => resolve({address: '127.0.0.1', port: 9443}); });
  const stalledClose = new Promise(resolve => { releaseClose = resolve; });
  const sessions = {ownerInstanceId: 'session-facade', async open() { counters.open++; events.push('session-open'); }, async destroy() { events.push('session-destroy'); }};
  const input = baseInput(overrides.input);
  const deps = {
    launcher: config => ({
      async prepareBrowserContext() {
        events.push('launch');
        if (overrides.prepareFails) throw Object.assign(Error('LAUNCH_REFUSED'), {code: 'HOST_LAUNCH_UNKNOWN'});
        if (overrides.preparePending) { await prepareGate; events.push('prepare-late'); }
        // The real launcher calls onBrowserPrepared before GO; a refused callback must refuse GO.
        await config.onBrowserPrepared({leaderPid: 301, kind: 'browser'});
        events.push('go');
        return {readable: {}, writable: {}, installation: contextInstallation, close: async () => { events.push('launch-close'); }};
      },
      close: async () => { events.push('launcher-close'); },
    }),
    contextPort: () => ({async create() { return {}; }, close: async () => { events.push('context-close'); }}),
    sessionHost: () => sessions,
    operationHost: () => ({executeBrowserOperation: async () => ({})}),
    viewer: () => ({
      async start() {
        events.push('viewer-start');
        if (overrides.viewFails) throw Error('LISTEN_FAILED');
        if (overrides.viewPending) { await viewGate; events.push('viewer-start-late'); }
        return {address: '127.0.0.1', port: 9443};
      },
      async close() {
        counters.close++; events.push('viewer-close');
        if (overrides.viewCloseStalls) return stalledClose;
        if (overrides.viewCloseFails) throw Error('CLOSE_FAILED');
        return {closed: true};
      },
    }),
  };
  return {input, deps, events, counters, sessions, releasePrepare, releaseView, releaseClose};
}
