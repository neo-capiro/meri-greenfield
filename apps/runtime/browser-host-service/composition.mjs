/** Browser-only host service composition (correction 03).
 *
 * One `hostMode:'browser-only'` allocation. No SDK query, process factory, model proxy, provider credential or Bash
 * process: the canonical AgentCore runtime owns the sole SDK query and in-process MCP.
 *
 * Real owners composed (imported): createBrowserOnlyHostLauncher, createConfinedContextPort,
 * createBrowserSessionHost(modelTransport:'host-owned'), createBrowserOperationHost, createBrowserViewerHostServer,
 * createConversationHostTeardown.
 *
 * Ownership rules enforced here:
 *  - the ORIGINAL browser operation preparation (createBrowserOperationHost -> prepareBrowserRun) alone opens/adopts
 *    the session, grants egress and applies the hard activation gate; this service never opens the facade;
 *  - session/run lifecycle observation uses the browser-scoped observer (`sessionProcesses`); final physical teardown
 *    uses the host-wide `browser-host-descendants` observer (`processes`). They are different contracts;
 *  - every terminal path (startup failure, abort/expiry, explicit stop) closes the owned local resources first and then
 *    runs the canonical teardown once, so recursive-absence observation never precedes stopping our own child, and a
 *    local failure never prevents the independent instance/root-volume/ENI destruction attempt;
 *  - stop is terminal: async acquisitions re-check terminal ownership and dispose late results without publishing them.
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

const FORBIDDEN = ['processClientFactory', 'runnerQuery', 'createPreparedRunnerQuery', 'modelTransport', 'bash',
  'bashRuntimeFacts', 'providerCredentials', 'modelProxy', 'agentcoreClient', 'capabilityPolicy'];

const REQUIRED = ['allocation', 'binding', 'hostIdentity', 'cwd', 'deadlineMs', 'policy', 'installation', 'upstream',
  'controls', 'current', 'siteWorkflows', 'hold', 'sessionProcesses', 'processes', 'host', 'browser', 'browserNetwork',
  'authority', 'helperPath', 'browserUid', 'browserGid', 'readRun', 'viewer'];

export const BROWSER_ONLY_REQUIRED_INPUTS=Object.freeze([...REQUIRED]);
export const BROWSER_ONLY_FORBIDDEN_INPUTS=Object.freeze([...FORBIDDEN]);
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
  if (typeof v.sessionProcesses?.waitForExit !== 'function') fail('BROWSER_HOST_SERVICE_BROWSER_OBSERVER_UNBOUND');
  if (typeof v.processes?.arm !== 'function' || typeof v.processes?.waitForExit !== 'function') fail('BROWSER_HOST_SERVICE_PROCESS_OBSERVER_UNBOUND');
  if (typeof v.browser?.revoke !== 'function' || typeof v.browser?.close !== 'function') fail('BROWSER_HOST_SERVICE_EGRESS_UNBOUND');
  if (typeof v.host?.destroy !== 'function' || typeof v.host?.observeAbsent !== 'function') fail('BROWSER_HOST_SERVICE_HOST_UNBOUND');
  if (typeof v.readRun !== 'function') fail('BROWSER_HOST_SERVICE_READRUN_UNBOUND');
  if (typeof v.authority?.readCurrent !== 'function' || typeof v.authority?.policySha256 !== 'string') fail('BROWSER_HOST_SERVICE_CURRENTNESS_UNBOUND');
  for (const name of ['bind', 'tls', 'peer']) if (!v.viewer[name]) fail('BROWSER_HOST_SERVICE_VIEWER_UNBOUND');
  return v;
}

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
  let starting, started = false, tearingDown = false, destroyed, retained = false, armed = false;

  /** Terminal ownership, re-checked after every async acquisition. */
  const live = () => !tearingDown && destroyed === undefined;

  const closeLocal = async () => {
    const problems = [];
    for (const resource of [viewer, contextPort, launch]) {
      if (!resource) continue;
      try { await resource.close(); } catch (error) { problems.push(error); }
    }
    return problems;
  };

  /** Canonical owned final path: stop admission + owned children, then one teardown, then retire the observer. */
  const finalTeardown = async reason => {
    const problems = await closeLocal();
    let receipt;
    try { receipt = await teardown.settle({reason}); }
    catch (error) {
      if (error?.code === 'HOST_TEARDOWN_UNKNOWN' && error.receipt) receipt = error.receipt;
      else problems.push(error);
    }
    // The host-wide observer is retained until its absence proof has been produced above.
    try { await v.processes.close?.(); } catch (error) { problems.push(error); }
    return {receipt, problems};
  };

  const service = {
    get ownerInstanceId() { return sessionHost?.ownerInstanceId; },
    get sessions() { return sessionHost; },
    get operations() { return operationHost; },
    get started() { return started; },
    /** Source-run completion: retained for takeover, never a physical teardown. */
    sourceRunSettled() {
      if (!started) fail('BROWSER_HOST_SERVICE_NOT_STARTED');
      retained = true;
      return Object.freeze({sourceSettled: true, retained: true});
    },
    /** Abort/expiry/currentness loss: same owned final path as an explicit stop. */
    async abort(reason = 'revoked') {
      return this.destroy({reason});
    },
    async start() {
      if (!live()) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
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
          if (!live()) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
          const native = await launch.prepareBrowserContext({policy: v.policy, installation: v.installation, paths});
          if (!live()) { await launch.close?.(); fail('BROWSER_HOST_SERVICE_TORN_DOWN'); }
          contextPort = owners.contextPort({native, binding: v.binding, policy: v.policy, installation: v.installation, paths, signal: v.signal, now});
          if (!live()) { await contextPort.close?.(); fail('BROWSER_HOST_SERVICE_TORN_DOWN'); }
          sessionHost = owners.sessionHost({
            allocation: v.allocation, binding: v.binding, cwd: v.cwd, installation: v.installation,
            upstream: v.upstream, contexts: contextPort, modelTransport: 'host-owned',
            controls: v.controls, current: v.current, siteWorkflows: v.siteWorkflows, hold: v.hold,
            processes: v.sessionProcesses, dispose: v.dispose, now,
          });
          if (!live()) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
          // The original preparation chain owns session.open/adopt; bind the canonical port to this exact facade.
          const readRun = async request => {
            if (!live()) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
            const facts = await v.readRun(request);
            if (facts?.port?.modelTransport !== 'host-owned' || typeof facts.port.policy !== 'function') fail('BROWSER_HOST_SERVICE_READRUN_REFUSED');
            if (!live()) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
            return Object.freeze({...facts, port: Object.freeze({...facts.port, sessions: sessionHost})});
          };
          operationHost = owners.operationHost({binding: v.binding, readRun, sessions: sessionHost, now});
          if (!live()) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
          viewer = owners.viewer({
            bind: v.viewer.bind, tls: v.viewer.tls, peer: v.viewer.peer,
            relay: sessionHost, custodyOwner: sessionHost, operationOwner: operationHost,
            now, ...(v.viewer.requestMs === undefined ? {} : {requestMs: v.viewer.requestMs}),
          });
          if (!live()) { await viewer.close?.(); fail('BROWSER_HOST_SERVICE_TORN_DOWN'); }
          const address = await viewer.start();
          if (!live()) fail('BROWSER_HOST_SERVICE_TORN_DOWN');
          started = true;
          return Object.freeze({started: true, address, ownerInstanceId: sessionHost.ownerInstanceId});
        } catch (error) {
          if (error?.code === 'BROWSER_HOST_SERVICE_TORN_DOWN') {
            // The terminal owner (destroy) awaits this promise and disposes exactly once; publish nothing here.
            throw error;
          }
          const {problems} = await finalTeardown('failed');
          if (problems.length) fail('BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN');
          throw error;
        }
      })();
      return starting;
    },
    destroy({reason = 'conversation-end'} = {}) {
      if (destroyed) return destroyed;
      if (tearingDown) return destroyed;
      tearingDown = true;
      const pending = starting;
      destroyed = (async () => {
        // Settle any in-flight acquisition first: its terminal checks dispose late results and never publish.
        if (pending) await pending.catch(() => {});
        const {receipt, problems} = await finalTeardown(reason);
        if (problems.length) {
          throw Object.assign(new Error('BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN', {cause: problems}), {code: 'BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN'});
        }
        return Object.freeze({...receipt, sourceSettled: retained});
      })();
      return destroyed;
    },
  };
  return Object.freeze(service);
}
