/** Browser-only host service composition (correction 04).
 *
 * One `hostMode:'browser-only'` allocation. No SDK query, process factory, model proxy, provider credential or Bash
 * process: the canonical AgentCore runtime owns the sole SDK query and in-process MCP.
 *
 * Real owners imported here:
 *   host/launcher/supervisor.mjs        createBrowserOnlyHostLauncher
 *   host/composition/run.mjs            prepareAdmittedBrowserWorkspace, armBrowserAfterWorkspaceReadback
 *   host/launcher/context-port.mjs      createConfinedContextPort
 *   host/browser-session-host.mjs       createBrowserSessionHost (modelTransport:'host-owned')
 *   host/browser-operation-host.mjs     createBrowserOperationHost (original prepareBrowserRun owns open/adopt)
 *   host/browser-viewer-transport.mjs   createBrowserViewerHostServer (named operations on the pinned listener)
 *   host/teardown.mjs                   createConversationHostTeardown (browser-only ports only)
 *   host/binding.mjs, browser/policy.mjs, browser/server.mjs, host/control/tls.mjs  for pre-effect validation
 *
 * Lifetime rules:
 *  - the pre-exec callback prepares the admitted workspace, verifies the exact measured readback, then arms the
 *    per-profile browser observer and the host-wide observer BEFORE GO;
 *  - the real input AbortSignal and the canonical allocation/run expiry both terminate the service through the same
 *    canonical final teardown, including during startup;
 *  - local settlement is bounded: a stalled start or close becomes explicit UNKNOWN after a finite owned phase, and the
 *    independent instance/root-volume/ENI destroy+readback backstop still runs;
 *  - stop is terminal; late results are disposed without publishing or reviving the listener.
 */
import {createBrowserOnlyHostLauncher} from '../../worker/conversation/host/launcher/supervisor.mjs';
import {prepareAdmittedBrowserWorkspace, armBrowserAfterWorkspaceReadback} from '../../worker/conversation/host/composition/run.mjs';
import {createConfinedContextPort} from '../../worker/conversation/host/launcher/context-port.mjs';
import {createBrowserSessionHost} from '../../worker/conversation/host/browser-session-host.mjs';
import {createBrowserOperationHost} from '../../worker/conversation/host/browser-operation-host.mjs';
import {createBrowserViewerHostServer} from '../../worker/conversation/host/browser-viewer-transport.mjs';
import {createConversationHostTeardown} from '../../worker/conversation/host/teardown.mjs';
import {browserPaths} from '../../worker/conversation/browser/workspace.mjs';
import {assertHostAllocation, assertHostRunBinding, assertD005HostIdentity} from '../../worker/conversation/host/binding.mjs';
import {validateBrowserPolicy} from '../../worker/conversation/browser/policy.mjs';
import {validateBrowserContextInstallation} from '../../worker/conversation/browser/server.mjs';
import {privateAddress, dnsName, fingerprint, tlsBytes, checkedCertificate} from '../../worker/conversation/host/control/tls.mjs';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';

const fail = code => {
  throw Object.assign(new Error(code), {code});
};

const FORBIDDEN = ['processClientFactory', 'runnerQuery', 'createPreparedRunnerQuery', 'modelTransport', 'bash',
  'bashRuntimeFacts', 'providerCredentials', 'modelProxy', 'agentcoreClient', 'capabilityPolicy'];

const REQUIRED = ['allocation', 'binding', 'hostIdentity', 'cwd', 'deadlineMs', 'policy', 'installation', 'upstream',
  'controls', 'current', 'siteWorkflows', 'hold', 'dispose', 'browserClient', 'maxFreshMs', 'workspaceOwnership',
  'sessionProcesses', 'processes', 'host', 'browser', 'browserNetwork', 'authority', 'helperPath', 'browserUid',
  'browserGid', 'readRun', 'viewer'];

export const BROWSER_ONLY_REQUIRED_INPUTS = Object.freeze([...REQUIRED]);
export const BROWSER_ONLY_FORBIDDEN_INPUTS = Object.freeze([...FORBIDDEN]);

export const BROWSER_ONLY_OWNERS = Object.freeze({
  launcher: createBrowserOnlyHostLauncher,
  contextPort: createConfinedContextPort,
  sessionHost: createBrowserSessionHost,
  operationHost: createBrowserOperationHost,
  viewer: createBrowserViewerHostServer,
  teardown: createConversationHostTeardown,
  prepareWorkspace: prepareAdmittedBrowserWorkspace,
  armWorkspaceReadback: armBrowserAfterWorkspaceReadback,
});

const uid = value => Number.isSafeInteger(value) && value >= 1000 && value <= 65533;

/** Full pre-effect validation using the canonical validators; returns normalized values. */
export function assertBrowserOnlyServiceInputs(input) {
  const v = input && typeof input === 'object' ? input : {};
  for (const name of FORBIDDEN) if (v[name] !== undefined) fail('BROWSER_HOST_SERVICE_SDK_UNSUPPORTED');
  for (const name of REQUIRED) if (v[name] === undefined || v[name] === null) fail('BROWSER_HOST_SERVICE_CONFIGURATION');
  // Placement first, then binding and host identity through the canonical host validators.
  if (v.allocation?.hostMode !== 'browser-only') fail('BROWSER_HOST_SERVICE_PLACEMENT_REFUSED');
  const allocation = assertHostAllocation(v.allocation);
  const binding = assertHostRunBinding(allocation, v.binding);
  const hostIdentity = assertD005HostIdentity(v.hostIdentity, binding, allocation);
  if (!Number.isSafeInteger(v.deadlineMs) || v.deadlineMs <= (v.now ?? Date.now)()) fail('BROWSER_HOST_SERVICE_DEADLINE_EXPIRED');
  if (!Number.isSafeInteger(allocation.leaseDeadlineMs) || allocation.leaseDeadlineMs <= (v.now ?? Date.now)()) fail('BROWSER_HOST_SERVICE_DEADLINE_EXPIRED');
  // Trusted inputs and owner interfaces.
  if (typeof v.current !== 'function' || typeof v.hold !== 'function' || typeof v.dispose !== 'function') fail('BROWSER_HOST_SERVICE_CURRENTNESS_UNBOUND');
  // Closed authority shape exactly as the real launcher authorities() requires; v.maxFreshMs is not a substitute.
  let authority;
  try { authority = own(v.authority ?? {}, ['policySha256', 'readCurrent', 'maxFreshMs']); }
  catch { fail('BROWSER_HOST_SERVICE_AUTHORITY_SHAPE_REFUSED'); }
  if (!/^[0-9a-f]{64}$/u.test(authority.policySha256 ?? '') || typeof authority.readCurrent !== 'function' ||
      !Number.isSafeInteger(authority.maxFreshMs) || authority.maxFreshMs < 1 || authority.maxFreshMs > 30000) fail('BROWSER_HOST_SERVICE_CURRENTNESS_UNBOUND');
  // Browser network plan/verify plus the matching egress configuration the real launcher requires.
  const plan = v.browserNetwork?.plan;
  if (typeof v.browserNetwork?.verify !== 'function' || plan?.kind !== 'browser' || !Array.isArray(plan.routes) ||
      !plan.routes.length || !Number.isSafeInteger(plan.routes[0]?.localPort) || plan.routes[0].localPort < 1 ||
      plan.routes[0].localPort > 65535) fail('BROWSER_HOST_SERVICE_NETWORK_UNBOUND');
  if (typeof v.siteWorkflows !== 'object' && typeof v.siteWorkflows !== 'function') fail('BROWSER_HOST_SERVICE_CONFIGURATION');
  if (typeof v.controls?.bind !== 'function') fail('BROWSER_HOST_SERVICE_CONTROLS_UNBOUND');
  if (typeof v.browserClient?.readCurrent !== 'function' || !Number.isSafeInteger(v.maxFreshMs) || v.maxFreshMs < 1) fail('BROWSER_HOST_SERVICE_CURRENTNESS_UNBOUND');
  if (typeof v.sessionProcesses?.arm !== 'function' || typeof v.sessionProcesses?.waitForExit !== 'function') fail('BROWSER_HOST_SERVICE_BROWSER_OBSERVER_UNBOUND');
  if (typeof v.processes?.arm !== 'function' || typeof v.processes?.waitForExit !== 'function') fail('BROWSER_HOST_SERVICE_PROCESS_OBSERVER_UNBOUND');
  if (typeof v.browser?.revoke !== 'function' || typeof v.browser?.close !== 'function') fail('BROWSER_HOST_SERVICE_EGRESS_UNBOUND');
  if (typeof v.host?.destroy !== 'function' || typeof v.host?.observeAbsent !== 'function') fail('BROWSER_HOST_SERVICE_HOST_UNBOUND');
  if (typeof v.readRun !== 'function') fail('BROWSER_HOST_SERVICE_READRUN_UNBOUND');
  if (typeof v.authority?.readCurrent !== 'function' || typeof v.authority?.policySha256 !== 'string') fail('BROWSER_HOST_SERVICE_CURRENTNESS_UNBOUND');
  // Policy and context-only installation through their canonical validators.
  let policy, installation;
  try { policy = validateBrowserPolicy(v.policy); } catch { fail('BROWSER_HOST_SERVICE_POLICY_REFUSED'); }
  if (policy.enabled !== true) fail('BROWSER_HOST_SERVICE_POLICY_REFUSED');
  try { installation = validateBrowserContextInstallation(v.installation); } catch { fail('BROWSER_HOST_SERVICE_INSTALLATION_UNBOUND'); }
  if (installation.egressProxy !== `http://127.0.0.1:${v.browserNetwork.plan.routes[0].localPort}`) fail('BROWSER_HOST_SERVICE_NETWORK_MISMATCH');
  if (typeof v.upstream?.createConnection !== 'function') fail('BROWSER_HOST_SERVICE_INSTALLATION_UNBOUND');
  // Workspace ownership IDs are trusted filesystem/readback identities, never SDK launch permission.
  const ws = v.workspaceOwnership;
  if (!ws || ![ws.sdkUid, ws.sdkGid, ws.browserUid, ws.browserGid].every(uid)) fail('BROWSER_HOST_SERVICE_WORKSPACE_UNBOUND');
  if (ws.browserUid !== v.browserUid || ws.browserGid !== v.browserGid) fail('BROWSER_HOST_SERVICE_WORKSPACE_MISMATCH');
  if (ws.sdkUid === ws.browserUid || ws.sdkGid === ws.browserGid) fail('BROWSER_HOST_SERVICE_WORKSPACE_MISMATCH');
  if (typeof v.helperPath !== 'string' || !v.helperPath.startsWith('/')) fail('BROWSER_HOST_SERVICE_CONFIGURATION');
  // Real viewer TLS material with the canonical helpers.
  const viewer = v.viewer ?? {};
  const address = privateAddress(viewer.bind?.address);
  const port = viewer.bind?.port;
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) fail('BROWSER_HOST_SERVICE_VIEWER_UNBOUND');
  const serverName = dnsName(viewer.tls?.serverName);
  const peerName = dnsName(viewer.peer?.name);
  const peerFingerprint = fingerprint(viewer.peer?.fingerprintSha256);
  const cert = tlsBytes(viewer.tls?.cert);
  tlsBytes(viewer.tls?.key);
  tlsBytes(viewer.tls?.clientCa);
  checkedCertificate(cert, {name: serverName, nowMs: (v.now ?? Date.now)()});
  return {v, allocation, binding, hostIdentity, policy, installation, viewer: {bind: {address, port}, tls: viewer.tls, peer: {name: peerName, fingerprintSha256: peerFingerprint}}};
}

const within = async (work, ms) => {
  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve({timedOut: true}), ms); timer.unref?.(); });
  try { return await Promise.race([Promise.resolve().then(work).then(value => ({value}), error => ({error})), timeout]); }
  finally { clearTimeout(timer); }
};

export function composeBrowserOnlyHostService(input, dependencies = {}) {
  const {v, allocation, binding, hostIdentity, policy, installation, viewer: viewerConfig} = assertBrowserOnlyServiceInputs(input);
  const owners = {...BROWSER_ONLY_OWNERS, ...dependencies};
  const now = v.now ?? Date.now;
  const paths = browserPaths(v.cwd);
  const localSettleMs = v.localSettleMs ?? 5000;
  if (!Number.isSafeInteger(localSettleMs) || localSettleMs < 1 || localSettleMs > 120000) fail('BROWSER_HOST_SERVICE_CONFIGURATION');
  const teardown = owners.teardown({
    allocation, binding, hostIdentity, cwd: v.cwd, browserPolicySha256: v.authority.policySha256,
    ports: {browser: v.browser, processes: v.processes, host: v.host}, now,
  });

  let launch, contextPort, sessionHost, operationHost, viewer, preparedWorkspace;
  let starting, started = false, tearingDown = false, destroying, destroyed, retained = false, armed = false;
  const terminal = new AbortController();
  const fence = () => { if (!terminal.signal.aborted) terminal.abort(Object.assign(Error('BROWSER_HOST_SERVICE_TORN_DOWN'), {code: 'BROWSER_HOST_SERVICE_TORN_DOWN'})); };
  const listeners = [];
  const live = () => !tearingDown && destroyed === undefined;

  const closeLocal = async () => {
    const problems = [];
    for (const resource of [viewer, contextPort, launch]) {
      if (!resource) continue;
      const result = await within(() => resource.close(), localSettleMs);
      if (result.timedOut) problems.push(Object.assign(Error('BROWSER_HOST_SERVICE_LOCAL_CLOSE_TIMEOUT'), {code: 'BROWSER_HOST_SERVICE_LOCAL_CLOSE_TIMEOUT'}));
      else if (result.error) problems.push(result.error);
    }
    return problems;
  };

  /** Canonical owned final path: bounded local stop, one teardown, then retire both observers if obtained. */
  const finalTeardown = async reason => {
    const problems = await closeLocal();
    let receipt;
    try { receipt = await teardown.settle({reason}); }
    catch (error) {
      if (error?.code === 'HOST_TEARDOWN_UNKNOWN' && error.receipt) receipt = error.receipt;
      else problems.push(error);
    }
    for (const release of listeners.splice(0)) { try { release(); } catch { /* ignore */ } }
    for (const observer of [v.processes, v.sessionProcesses]) {
      if (typeof observer?.close !== 'function') continue;
      const result = await within(() => observer.close(), localSettleMs);
      if (result.timedOut) problems.push(Object.assign(Error('BROWSER_HOST_SERVICE_OBSERVER_CLOSE_TIMEOUT'), {code: 'BROWSER_HOST_SERVICE_OBSERVER_CLOSE_TIMEOUT'}));
      else if (result.error) problems.push(result.error);
    }
    return {receipt, problems};
  };

  const service = {
    get ownerInstanceId() { return sessionHost?.ownerInstanceId; },
    get sessions() { return sessionHost; },
    get operations() { return operationHost; },
    get started() { return started; },
    sourceRunSettled() {
      if (!started) fail('BROWSER_HOST_SERVICE_NOT_STARTED');
      retained = true;
      return Object.freeze({sourceSettled: true, retained: true});
    },
    /** Explicit terminal trigger (used by tests and by owners that can only call a method). */
    async abort(reason = 'revoked') { return this.destroy({reason}); },
    async start() {
      if (!live()) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
      if (started) fail('BROWSER_HOST_SERVICE_STARTED');
      if (starting) return starting;
      starting = (async () => {
        try {
          // Admitted workspace FIRST, before any native launcher/child exists (prepare.mjs contract), after the
          // authenticated browser-purpose currentness read. The exact receipt is retained for the pre-exec readback.
          preparedWorkspace = await owners.prepareWorkspace({
            allocation, binding, cwd: v.cwd, paths, browserClient: v.browserClient,
            policySha256: v.authority.policySha256, maxFreshMs: v.authority.maxFreshMs, now, signal: terminal.signal,
            sdkUid: v.workspaceOwnership.sdkUid, sdkGid: v.workspaceOwnership.sdkGid,
            browserUid: v.browserUid, browserGid: v.browserGid,
            ...(v.prepareBrowserWorkspace === undefined ? {} : {prepare: v.prepareBrowserWorkspace}),
          });
          if (!live()) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
          launch = owners.launcher({
            allocation, binding, hostIdentity,
            helperPath: v.helperPath, browserNetwork: v.browserNetwork, authority: v.authority,
            browserUid: v.browserUid, browserGid: v.browserGid,
            onBrowserPrepared: async ({leaderPid, kind}) => {
              if (kind !== 'browser' || armed) fail('BROWSER_HOST_SERVICE_PROCESS_ARM_REFUSED');
              if (!live() || terminal.signal.aborted || !preparedWorkspace) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
              // The workspace receipt exists before this launcher; the measured readback + per-profile arm inside the
              // real helper and the separate host-wide arm are both fenced by the owned terminal lifetime.
              const fencedObserver = Object.freeze({
                async arm(input) {
                  if (!live() || terminal.signal.aborted) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
                  const receipt = await v.sessionProcesses.arm(input);
                  if (!live() || terminal.signal.aborted) throw Object.assign(Error('BROWSER_HOST_SERVICE_TORN_DOWN'), {code: 'BROWSER_HOST_SERVICE_TORN_DOWN'});
                  return receipt;
                },
              });
              await owners.armWorkspaceReadback({
                allocation, binding, hostIdentity, cwd: v.cwd, paths,
                browserUid: v.browserUid, browserGid: v.browserGid,
                sdkUid: v.workspaceOwnership.sdkUid, sdkGid: v.workspaceOwnership.sdkGid,
                leaderPid, browserObserver: fencedObserver, preparedWorkspace,
                ...(v.readWorkspace === undefined ? {} : {readWorkspace: v.readWorkspace}), now,
              });
              if (!live() || terminal.signal.aborted) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
              const receipt = await v.processes.arm({browserLeaderPid: leaderPid});
              if (!live() || terminal.signal.aborted) throw Object.assign(Error('BROWSER_HOST_SERVICE_TORN_DOWN'), {code: 'BROWSER_HOST_SERVICE_TORN_DOWN'});
              if (receipt?.armed !== true) fail('BROWSER_HOST_SERVICE_PROCESS_ARM_REFUSED');
              armed = true;
            },
            signal: terminal.signal,
            ...(v.spawnNative === undefined ? {} : {spawnNative: v.spawnNative}),
            now,
          });
          if (!live()) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
          const native = await launch.prepareBrowserContext({policy, installation, paths});
          if (!live()) { await within(() => launch.close(), localSettleMs); fail('BROWSER_HOST_SERVICE_TORN_DOWN'); }
          contextPort = owners.contextPort({native, binding, policy, installation, paths, signal: terminal.signal, now});
          if (!live()) { await within(() => contextPort.close?.(), localSettleMs); fail('BROWSER_HOST_SERVICE_TORN_DOWN'); }
          sessionHost = owners.sessionHost({
            allocation, binding, cwd: v.cwd, installation,
            upstream: v.upstream, contexts: contextPort, modelTransport: 'host-owned',
            controls: v.controls, current: v.current, siteWorkflows: v.siteWorkflows, hold: v.hold,
            processes: v.sessionProcesses, dispose: v.dispose, now,
          });
          if (!live()) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
          const readRun = async request => {
            if (!live()) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
            const facts = await v.readRun(request);
            if (facts?.port?.modelTransport !== 'host-owned' || typeof facts.port.policy !== 'function') fail('BROWSER_HOST_SERVICE_READRUN_REFUSED');
            if (!live()) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
            return Object.freeze({...facts, port: Object.freeze({...facts.port, sessions: sessionHost})});
          };
          operationHost = owners.operationHost({binding, readRun, sessions: sessionHost, now});
          if (!live()) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
          viewer = owners.viewer({
            bind: viewerConfig.bind, tls: viewerConfig.tls, peer: viewerConfig.peer,
            relay: sessionHost, custodyOwner: sessionHost, operationOwner: operationHost,
            now, ...(v.viewer.requestMs === undefined ? {} : {requestMs: v.viewer.requestMs}),
          });
          if (!live()) { await within(() => viewer.close?.(), localSettleMs); fail('BROWSER_HOST_SERVICE_TORN_DOWN'); }
          const address = await viewer.start();
          if (!live()) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
          started = true;
          return Object.freeze({started: true, address, ownerInstanceId: sessionHost.ownerInstanceId});
        } catch (error) {
          // Every terminal path revokes the owned lifetime; this is the same owner destroy() uses.
          fence();
          tearingDown = true;
          if (error?.code === 'BROWSER_HOST_SERVICE_TORN_DOWN') { throw error; }
          const {receipt, problems} = await finalTeardown('failed');
          if (!destroyed) destroyed = Object.freeze({...(receipt ?? {status: 'UNKNOWN'}), failure: true});
          if (problems.length) fail('BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN');
          throw error;
        }
      })();
      return starting;
    },
    destroy({reason = 'conversation-end'} = {}) {
      if (destroyed) return destroyed;
      if (destroying) return destroying;
      tearingDown = true;
      fence();
      const pending = starting;
      const settledProblems = [];
      destroying = (async () => {
        // A stalled acquisition may not block the physical backstop: bounded terminal settlement.
        if (pending) {
          const settled = await within(() => pending.catch(() => undefined), localSettleMs);
          if (settled.timedOut) settledProblems.push(Object.assign(Error('BROWSER_HOST_SERVICE_START_SETTLE_TIMEOUT'), {code: 'BROWSER_HOST_SERVICE_START_SETTLE_TIMEOUT'}));
        }
        if (destroyed) return destroyed;
        const {receipt, problems} = await finalTeardown(reason);
        const all = [...settledProblems, ...problems];
        if (all.length) throw Object.assign(new Error('BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN', {cause: all}), {code: 'BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN'});
        destroyed = Object.freeze({...receipt, sourceSettled: retained});
        return destroyed;
      })();
      return destroying;
    },
  };

  // Real terminal triggers: the caller's AbortSignal and the canonical allocation/run expiry.
  const terminate = reason => { fence(); if (!destroyed) void service.destroy({reason}).catch(() => {}); };
  if (v.signal !== undefined) {
    const onAbort = () => terminate('revoked');
    v.signal.addEventListener('abort', onAbort, {once: true});
    listeners.push(() => v.signal.removeEventListener('abort', onAbort));
    if (v.signal.aborted) queueMicrotask(onAbort);
  }
  const expiresAtMs = Math.min(v.deadlineMs, allocation.leaseDeadlineMs);
  const remaining = expiresAtMs - now();
  if (Number.isSafeInteger(remaining)) {
    const onExpiry = () => terminate('lease-expired');
    const timer = setTimeout(onExpiry, Math.max(0, remaining));
    timer.unref?.();
    listeners.push(() => clearTimeout(timer));
  }
  return Object.freeze(service);
}
