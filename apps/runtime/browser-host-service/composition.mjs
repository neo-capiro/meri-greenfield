/** Caller composition for one prepared guest host run.
 *
 * Composes the merged capabilities owner (`prepareGuestHostRun`), the existing viewer host transport and the shared
 * integration owner's prepared runner query. It creates no SDK session itself, no second query, no model proxy and no
 * parallel host contract. Importing this module is inert.
 *
 * Physical lifetime: a run completing while the browser host is retained for takeover must NOT call `settle`.
 * `settle` is only reached from `destroy()` (final physical teardown) or from a composition failure that already owns
 * a prepared run.
 */
const fail = code => {
  throw Object.assign(new Error(code), {code});
};

const FUNCTIONS = ['prepareGuestHostRun', 'createBrowserViewerHostServer', 'runnerQuery'];
const RUN_INPUTS = ['allocation', 'binding', 'hostIdentity', 'cwd', 'deadlineMs', 'capabilityPolicy', 'readBrowserPolicy', 'control', 'model', 'browser', 'native', 'network', 'host'];

/** Validate the exact external inputs this caller owns before any effect. */
export function assertBrowserHostServiceInputs(input) {
  const value = input && typeof input === 'object' ? input : {};
  for (const name of FUNCTIONS) if (typeof value[name] !== 'function') fail(`BROWSER_HOST_SERVICE_${name === 'runnerQuery' ? 'QUERY_UNBOUND' : 'CONFIGURATION'}`);
  for (const name of RUN_INPUTS) if (value[name] === undefined || value[name] === null) fail('BROWSER_HOST_SERVICE_CONFIGURATION');
  if (typeof value.readBrowserPolicy !== 'function') fail('BROWSER_HOST_SERVICE_POLICY_UNBOUND');
  if (typeof value.capabilityPolicy?.forRun !== 'function') fail('BROWSER_HOST_SERVICE_POLICY_UNBOUND');
  if (!Number.isSafeInteger(value.deadlineMs)) fail('BROWSER_HOST_SERVICE_CONFIGURATION');
  const viewer = value.viewer;
  if (!viewer || typeof viewer !== 'object' || !viewer.bind || !viewer.tls || !viewer.peer) {
    fail('BROWSER_HOST_SERVICE_VIEWER_UNBOUND');
  }
  if (typeof value.now !== 'function' && value.now !== undefined) fail('BROWSER_HOST_SERVICE_CONFIGURATION');
  if (value.signal !== undefined && typeof value.signal?.aborted !== 'boolean') fail('BROWSER_HOST_SERVICE_CONFIGURATION');
  return value;
}

/** One prepared run, one viewer mount, one prepared query. */
export async function composeBrowserHostService(input) {
  const v = assertBrowserHostServiceInputs(input);
  const now = v.now ?? Date.now;

  // 1. The capabilities owner prepares the run. It owns cleanup of everything it created on failure.
  const run = await v.prepareGuestHostRun({
    allocation: v.allocation, binding: v.binding, hostIdentity: v.hostIdentity, cwd: v.cwd,
    deadlineMs: v.deadlineMs, capabilityPolicy: v.capabilityPolicy, readBrowserPolicy: v.readBrowserPolicy,
    control: v.control, model: v.model, browser: v.browser, bash: v.bash, native: v.native,
    network: v.network, host: v.host, now, signal: v.signal,
  });
  if (!run || typeof run.processClientFactory !== 'function' || typeof run.settle !== 'function') {
    fail('BROWSER_HOST_SERVICE_RUN_REFUSED');
  }

  // 2. The facade is a stable identity. The viewer transport receives that same object twice, or nothing at all.
  const facade = run.browserHost;
  let viewer = null;
  let viewerStarted = false;
  const abandon = async error => {
    try { await run.settle({reason: 'failed'}); } catch (cleanup) {
      throw Object.assign(new Error('BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN', {cause: new AggregateError([error, cleanup])}), {code: 'BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN'});
    }
    throw error;
  };
  try {
    if (facade !== undefined && facade !== null) {
      for (const member of ['readAdmission', 'execute', 'prepareResume', 'adopt', 'destroy', 'open']) {
        if (typeof facade[member] !== 'function') fail('BROWSER_HOST_SERVICE_FACADE_REFUSED');
      }
      viewer = v.createBrowserViewerHostServer({
        bind: v.viewer.bind, tls: v.viewer.tls, peer: v.viewer.peer,
        relay: facade, custodyOwner: facade,
        ...(v.viewer.requestMs === undefined ? {} : {requestMs: v.viewer.requestMs}),
        now,
      });
      for (const member of ['start', 'close']) if (typeof viewer[member] !== 'function') fail('BROWSER_HOST_SERVICE_VIEWER_REFUSED');
    }
  } catch (error) { await abandon(error); }

  // 3. Exactly one prepared query consumes the one-use factory.
  let query;
  try {
    query = v.runnerQuery({processClientFactory: run.processClientFactory, run, allocation: run.allocation, binding: run.binding, hostIdentity: run.hostIdentity});
    if (query === undefined) fail('BROWSER_HOST_SERVICE_QUERY_REFUSED');
  } catch (error) { await abandon(error); }

  let destroyed, sourceSettled = false;
  const service = {
    facade, viewer, query, run,
    /** Source run finished; the physical host may be retained for takeover. Never tears down. */
    sourceRunSettled() { sourceSettled = true; return Object.freeze({sourceSettled: true, retained: true}); },
    /** Final physical teardown: once, after the viewer stops accepting. */
    destroy({reason = 'final'} = {}) {
      if (destroyed) return destroyed;
      destroyed = (async () => {
        let problem;
        let viewerReceipt;
        try { if (viewer) viewerReceipt = await viewer.close(); } catch (error) { problem ??= error; }
        let settleReceipt;
        try { settleReceipt = await run.settle({reason}); } catch (error) { problem ??= error; }
        if (problem) throw Object.assign(new Error('BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN', {cause: problem}), {code: 'BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN'});
        return Object.freeze({reason, sourceSettled, viewerClosed: viewerReceipt?.closed === true, settled: true, receipt: settleReceipt});
      })();
      return destroyed;
    },
    async start() {
      if (!viewer) return Object.freeze({browser: false});
      if (viewerStarted) fail('BROWSER_HOST_SERVICE_VIEWER_STARTED');
      const address = await viewer.start();
      viewerStarted = true;
      return Object.freeze({browser: true, address});
    },
  };
  return Object.freeze(service);
}

