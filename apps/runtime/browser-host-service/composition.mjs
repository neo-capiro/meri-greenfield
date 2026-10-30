/** Browser-only host service composition.
 *
 * A browser-only allocation has no SDK query, process factory, model proxy, provider credential or Bash process: the
 * canonical AgentCore runtime already owns the sole SDK query and in-process MCP. This module composes the real merged
 * owners for one browser-only allocation and exposes a concrete start/stop seam.
 *
 * Real owners composed here (imported, never re-implemented):
 *   host/launcher/supervisor.mjs        createBrowserOnlyHostLauncher
 *   host/launcher/context-port.mjs      createConfinedContextPort (context-only installation)
 *   host/browser-session-host.mjs       createBrowserSessionHost (modelTransport:'host-owned')
 *   host/browser-operation-host.mjs     createBrowserOperationHost
 *   host/browser-viewer-transport.mjs   createBrowserViewerHostServer (named operations on the pinned listener)
 *   host/teardown.mjs                   createConversationHostTeardown (browser-only ports only)
 *
 * Everything else is a trusted owner binding. A missing binding refuses by name before the effect it guards, and no
 * capability, currentness, approval, provider or physical-absence evidence is fabricated here.
 */
import {createBrowserOnlyHostLauncher} from '../../worker/conversation/host/launcher/supervisor.mjs';
import {createConfinedContextPort} from '../../worker/conversation/host/launcher/context-port.mjs';
import {createBrowserSessionHost} from '../../worker/conversation/host/browser-session-host.mjs';
import {createBrowserOperationHost} from '../../worker/conversation/host/browser-operation-host.mjs';
import {createBrowserViewerHostServer} from '../../worker/conversation/host/browser-viewer-transport.mjs';
import {createConversationHostTeardown} from '../../worker/conversation/host/teardown.mjs';
import {browserPaths} from '../../worker/conversation/browser/workspace.mjs';

const fail = code => {
  throw Object.assign(new Error(code), {code});
};

/** Conversation/SDK-only inputs. Their presence on a browser-only service is a configuration error. */
const FORBIDDEN = ['processClientFactory', 'runnerQuery', 'createPreparedRunnerQuery', 'modelTransport', 'bash',
  'bashRuntimeFacts', 'providerCredentials', 'modelProxy', 'agentcoreClient', 'capabilityPolicy'];

const REQUIRED = ['allocation', 'binding', 'hostIdentity', 'cwd', 'deadlineMs', 'policy', 'installation', 'upstream',
  'controls', 'current', 'siteWorkflows', 'hold', 'processes', 'host', 'browser', 'browserNetwork', 'authority',
  'helperPath', 'browserUid', 'browserGid', 'readRun', 'viewer'];

export const BROWSER_ONLY_OWNERS = Object.freeze({
  launcher: createBrowserOnlyHostLauncher,
  contextPort: createConfinedContextPort,
  sessionHost: createBrowserSessionHost,
  operationHost: createBrowserOperationHost,
  viewer: createBrowserViewerHostServer,
  teardown: createConversationHostTeardown,
});

/** Validate the browser-only contract before any effect. */
export function assertBrowserOnlyServiceInputs(input) {
  const v = input && typeof input === 'object' ? input : {};
  for (const name of FORBIDDEN) if (v[name] !== undefined) fail('BROWSER_HOST_SERVICE_SDK_UNSUPPORTED');
  for (const name of REQUIRED) if (v[name] === undefined || v[name] === null) fail('BROWSER_HOST_SERVICE_CONFIGURATION');
  if (v.allocation?.hostMode !== 'browser-only') fail('BROWSER_HOST_SERVICE_PLACEMENT_REFUSED');
  if (!Number.isSafeInteger(v.deadlineMs) || v.deadlineMs < 1) fail('BROWSER_HOST_SERVICE_CONFIGURATION');
  if (typeof v.current !== 'function' || typeof v.hold !== 'function') fail('BROWSER_HOST_SERVICE_CURRENTNESS_UNBOUND');
  if (typeof v.controls?.bind !== 'function') fail('BROWSER_HOST_SERVICE_CONTROLS_UNBOUND');
  if (typeof v.processes?.arm !== 'function' || typeof v.processes?.waitForExit !== 'function') fail('BROWSER_HOST_SERVICE_PROCESS_OBSERVER_UNBOUND');
  if (typeof v.browser?.revoke !== 'function' || typeof v.browser?.close !== 'function') fail('BROWSER_HOST_SERVICE_EGRESS_UNBOUND');
  if (typeof v.host?.destroy !== 'function' || typeof v.host?.observeAbsent !== 'function') fail('BROWSER_HOST_SERVICE_HOST_UNBOUND');
  if (typeof v.readRun !== 'function') fail('BROWSER_HOST_SERVICE_READRUN_UNBOUND');
  if (typeof v.authority?.readCurrent !== 'function' || typeof v.authority?.policySha256 !== 'string') fail('BROWSER_HOST_SERVICE_CURRENTNESS_UNBOUND');
  for (const name of ['bind', 'tls', 'peer']) if (!v.viewer[name]) fail('BROWSER_HOST_SERVICE_VIEWER_UNBOUND');
  return v;
}

/**
 * Compose one browser-only host service. Construction is inert.
 * - start() launches the browser, arms the host-wide observer from the measured leader, mounts the pinned mTLS
 *   listener with the named operations and returns the listener address.
 * - sourceRunSettled() records source-run completion; the physical browser host is retained for takeover.
 * - destroy() is the final physical teardown and returns the canonical receipt (UNKNOWN preserved).
 */
export function composeBrowserOnlyHostService(input, dependencies = {}) {
  const v = assertBrowserOnlyServiceInputs(input);
  const owners = {...BROWSER_ONLY_OWNERS, ...dependencies};
  const now = v.now ?? Date.now;
  const paths = browserPaths(v.cwd);
  const teardown = owners.teardown({
    allocation: v.allocation, binding: v.binding, hostIdentity: v.hostIdentity, cwd: v.cwd,
    browserPolicySha256: v.authority.policySha256,
    ports: {browser: v.browser, processes: v.processes, host: v.host}, now,
  });
  let launch, contextPort, sessionHost, operationHost, viewer;
  let starting, started = false, failed = false, destroying, destroyed, retained = false, armed = false;

  const closeLocal = async () => {
    const problems = [];
    for (const resource of [viewer, contextPort, launch]) {
      if (!resource) continue;
      try { await resource.close(); } catch (error) { problems.push(error); }
    }
    return problems;
  };
  const abandon = async cause => {
    const problems = await closeLocal();
    try { await v.processes.close?.(); } catch (error) { problems.push(error); }
    if (problems.length) fail('BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN');
    throw cause;
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
    async start() {
      if (destroyed || destroying) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
      if (failed) fail('BROWSER_HOST_SERVICE_START_FAILED');
      if (started) fail('BROWSER_HOST_SERVICE_STARTED');
      if (starting) return starting;
      starting = (async () => {
        try {
          launch = owners.launcher({
            allocation: v.allocation, binding: v.binding, hostIdentity: v.hostIdentity,
            helperPath: v.helperPath, browserNetwork: v.browserNetwork, authority: v.authority,
            browserUid: v.browserUid, browserGid: v.browserGid,
            onBrowserPrepared: async ({leaderPid, kind}) => {
              if (kind !== 'browser' || armed) fail('BROWSER_HOST_SERVICE_PROCESS_ARM_REFUSED');
              const receipt = await v.processes.arm({browserLeaderPid: leaderPid});
              if (receipt?.armed !== true) fail('BROWSER_HOST_SERVICE_PROCESS_ARM_REFUSED');
              armed = true;
            },
            ...(v.signal === undefined ? {} : {signal: v.signal}),
            ...(v.spawnNative === undefined ? {} : {spawnNative: v.spawnNative}),
            now,
          });
          const native = await launch.prepareBrowserContext({policy: v.policy, installation: v.installation, paths});
          contextPort = owners.contextPort({native, binding: v.binding, policy: v.policy, installation: v.installation, paths, signal: v.signal, now});
          sessionHost = owners.sessionHost({
            allocation: v.allocation, binding: v.binding, cwd: v.cwd, installation: v.installation,
            upstream: v.upstream, contexts: contextPort, modelTransport: 'host-owned',
            controls: v.controls, current: v.current, siteWorkflows: v.siteWorkflows, hold: v.hold,
            processes: v.processes, dispose: v.dispose, now,
          });
          operationHost = owners.operationHost({binding: v.binding, readRun: v.readRun, sessions: sessionHost, now});
          viewer = owners.viewer({
            bind: v.viewer.bind, tls: v.viewer.tls, peer: v.viewer.peer,
            relay: sessionHost, custodyOwner: sessionHost, operationOwner: operationHost,
            now, ...(v.viewer.requestMs === undefined ? {} : {requestMs: v.viewer.requestMs}),
          });
          await sessionHost.open({binding: v.binding, policy: v.policy, deadlineMs: v.deadlineMs, manifest: v.manifest ?? null});
          const address = await viewer.start();
          started = true;
          return Object.freeze({started: true, address, ownerInstanceId: sessionHost.ownerInstanceId});
        } catch (error) {
          started = false;
          failed = true;
          return abandon(error);
        }
      })();
      return starting;
    },
    destroy({reason = 'conversation-end'} = {}) {
      if (destroyed) return destroyed;
      if (destroying) return destroying;
      destroying = (async () => {
        const problems = [];
        let receipt;
        try { receipt = await teardown.settle({reason}); }
        catch (error) {
          // The canonical teardown reports UNKNOWN with its receipt; that is the honest result, not a local failure.
          if (error?.code === 'HOST_TEARDOWN_UNKNOWN' && error.receipt) receipt = error.receipt;
          else problems.push(error);
        }
        problems.push(...await closeLocal());
        if (problems.length) {
          throw Object.assign(new Error('BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN', {cause: problems}), {code: 'BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN'});
        }
        destroyed = Object.freeze({...receipt, sourceSettled: retained});
        return destroyed;
      })();
      return destroying;
    },
  };
  return Object.freeze(service);
}
