/**
 * Narrow adapters between native-chart-flows.mjs and the EXISTING
 * CODE/WOPI/Core qualification framework (SCRUM-241).
 *
 * Two hard facts about the retained fixture drive this file:
 *
 *  1. `GET /fresh/<id>` creates a NEW document from the corpus input on every
 *     call, so it can never be used to reopen saved bytes.
 *  2. The retained host resolves its own output relative to its script URL
 *     (`font-corpus/saved/<id>`, `continuous-native-results.json`,
 *     `continuous-recovery-private.json`), so a caller-side `--out` does not
 *     isolate host writes.
 *
 * Therefore a run must use an isolated run root that contains a copy of the
 * retained host and its modules, so every relative host write lands inside that
 * run root, and reopen must address the already-saved identity rather than
 * `/fresh`. Both are provided here without modifying the retained host and
 * without rebuilding any WOPI/Core behaviour.
 *
 * Nothing here starts a process, opens a socket or a browser.
 */

/** Identity shape used by the retained corpus run; never reused by this flow. */
export const RETAINED_IDENTITY =
  /^(?:docx|xlsx|pptx)-\d{2}(?:-(?:renew|restart|revoke|expire|lostack))?$/;

/** A control the editor does not expose: reported NOT RUN, never passed. */
export class ControlUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'ControlUnavailable';
  }
}

/** The run is not isolated, so it must not touch the host at all. */
export class IsolationRefused extends Error {
  constructor(message) {
    super(message);
    this.name = 'IsolationRefused';
  }
}

export function assertIsolatedIdentity(identity) {
  if (!identity || typeof identity !== 'string') {
    throw new IsolationRefused('an explicit isolated identity is required');
  }
  if (RETAINED_IDENTITY.test(identity)) {
    throw new IsolationRefused(
      `identity ${identity} is a retained corpus identity; use a run-scoped identity`);
  }
  return identity;
}

/**
 * Copy the retained host into a new run root so its relative output paths
 * (font-corpus/saved, continuous-*.json) land there instead of in the retained
 * tree. Pure file copy; the retained files stay read-only.
 *
 * @returns the run-root manifest, also written to <runRoot>/run-root.json
 */
export async function materializeRunRoot({retainedHost, runRoot, modules = [], fs}) {
  const files = fs ?? await import('node:fs/promises');
  const path = await import('node:path');
  if (!retainedHost || !runRoot) {
    throw new IsolationRefused('materializeRunRoot needs retainedHost and runRoot');
  }
  const hostName = path.basename(retainedHost);
  await files.mkdir(path.join(runRoot, 'host'), {recursive: true});
  await files.mkdir(path.join(runRoot, 'corpus', 'inputs'), {recursive: true});
  await files.mkdir(path.join(runRoot, 'font-corpus', 'saved'), {recursive: true});
  const copied = [];
  for (const source of [retainedHost, ...modules]) {
    const target = path.join(runRoot, 'host', path.basename(source));
    await files.copyFile(source, target);
    const payload = await files.readFile(target);
    const {createHash} = await import('node:crypto');
    copied.push({source, target, sha256: createHash('sha256').update(payload).digest('hex')});
  }
  const manifest = {
    schema: 'meri-office241-run-root/1',
    host: hostName,
    runRoot,
    copied,
    // Every retained host write path resolves under these.
    outputs: {
      saved: path.join(runRoot, 'font-corpus', 'saved'),
      continuous: path.join(runRoot, 'font-corpus', 'continuous-native-results.json'),
      recovery: path.join(runRoot, 'font-corpus', 'continuous-recovery-private.json'),
      inputs: path.join(runRoot, 'corpus', 'inputs'),
    },
    retainedTreeUntouched: true,
  };
  await files.mkdir(path.join(runRoot, 'font-corpus'), {recursive: true});
  await files.writeFile(path.join(runRoot, 'run-root.json'),
    JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

/**
 * HTTP adapter for a host started from an isolated run root.
 * No default origin, no default identity: both are explicit inputs.
 */
export async function createHttpAdapter({origin, identity, fetchImpl}) {
  assertIsolatedIdentity(identity);
  if (!origin || !/^https?:\/\//.test(origin)) {
    throw new IsolationRefused('an explicit http(s) origin is required; there is no default host');
  }
  const request = fetchImpl ?? globalThis.fetch;
  if (typeof request !== 'function') {
    throw new IsolationRefused('a fetch implementation is required');
  }
  let savedBytes = null;
  const state = async () => {
    const response = await request(`${origin}/state`);
    if (!response.ok) throw new Error(`state failed: ${response.status}`);
    return response.json();
  };
  return {
    origin,
    identity,
    async open() {
      const response = await request(`${origin}/fresh/${identity}`);
      if (!response.ok) throw new Error(`open failed: ${response.status}`);
    },
    async save() {
      throw new Error('the http adapter save() must be bound to an editor driver');
    },
    async reopen() {
      // Deliberately NOT /fresh: that would discard the saved document.
      const response = await request(`${origin}/reopen/${identity}`, {method: 'POST'});
      if (!response.ok) throw new Error(`reopen failed: ${response.status}`);
    },
    async bytes() {
      const response = await request(`${origin}/saved/${identity}`);
      if (!response.ok) throw new Error(`saved bytes unavailable: ${response.status}`);
      savedBytes = Buffer.from(await response.arrayBuffer());
      return savedBytes;
    },
    async sequence() {
      const current = await state();
      return current.files?.[identity]?.sequence ?? 0;
    },
    async verify() {
      const response = await request(`${origin}/verify/${identity}`, {method: 'POST'});
      const body = await response.json().catch(() => null);
      return {status: response.status, body};
    },
  };
}

/**
 * In-memory adapter used by the inert flow tests. It models the retained
 * route/state sequencing without any host, port or browser, so the flow logic
 * itself can be tested.
 *
 * @param original  bytes the host serves at open()
 * @param saved     bytes the host serves after a native save
 * @param verifyBody canonical /verify body
 * @param resetOnReopen simulate a host whose reopen re-seeds from the original
 */
export function createInertAdapter({original, saved, verifyBody, resetOnReopen = false,
  verifyStatus = 200, saveError = null, editor = {}}) {
  let current = Buffer.from(original);
  let sequence = 0;
  let opened = 0;
  const events = [];
  const host = {
    identity: 'inert-identity',
    async open() {
      events.push('open');
      opened += 1;
      current = Buffer.from(original);
      sequence = 0;
    },
    async save() {
      events.push('save');
      if (saveError) throw saveError;
      current = Buffer.from(saved);
      sequence += 1;
      return current;
    },
    async reopen() {
      events.push('reopen');
      if (resetOnReopen) {
        current = Buffer.from(original);
        sequence = 0;
      }
    },
    async bytes() {
      events.push('bytes');
      return current;
    },
    async sequence() {
      return sequence;
    },
    async verify() {
      events.push('verify');
      return {status: verifyStatus, body: verifyBody};
    },
  };
  const driver = {
    async ready() {
      events.push('ready');
      return true;
    },
    async editTitle() {
      events.push('editTitle');
      if (editor.editTitle) return editor.editTitle();
    },
    async editChartData(spec) {
      events.push('editChartData');
      if (!editor.editChartData) {
        throw new ControlUnavailable('inert adapter exposes no chart data control');
      }
      return editor.editChartData(spec);
    },
  };
  return {host, editor: driver, events, get opened() { return opened; }};
}
