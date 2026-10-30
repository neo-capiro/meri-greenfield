/**
 * Adapter between the Office241 chart flows and the EXISTING public
 * CODE/WOPI/Core qualification host (SCRUM-241).
 *
 * It encodes only what the retained public host actually does
 * (`work/code-native/host-font-corpus.mjs`):
 *
 *   GET  /fresh/<label>     create the document from the corpus input (RESETS)
 *   GET  /qualify/<label>   serve the editor for the existing identity
 *   POST /renew/<label>     refresh the editor claims and relaunch data
 *   GET  /state             {files: {<label>: {sequence, bytes, state, lock}}}
 *   GET  /saved/<label>     the saved bytes held by the host
 *   POST /verify/<label>    canonical persistence evidence (postgres host)
 *   <WOPI> /files/synthetic-<label>/contents
 *
 * Labels are `<manifest id>` with an optional supported suffix; that is the
 * complete routable set, so isolation comes from a separate host root and not
 * from inventing unsupported route identifiers.
 *
 * The host resolves every relative path from its own module URL, so an
 * isolated run root must contain the host at its root, next to the modules it
 * imports and the corpus manifest/inputs it reads. `materializeRunRoot` copies
 * exactly that public layout and refuses unsafe or aliased roots. Private TLS
 * material is never read or copied from the retained fixture: the operator
 * supplies fresh certificate/key paths explicitly.
 */
import {createHash} from 'node:crypto';
import {copyFile, mkdir, readdir, readFile, stat, writeFile} from 'node:fs/promises';
import {basename, dirname, join, relative, resolve, sep} from 'node:path';

/** Suffixes the retained WOPI route and manifest lookup strip or accept. */
export const HOST_SUFFIXES = ['', '-renew', '-revoke', '-expire', '-restart', '-lostack'];

/** Modules the public host imports relative to its own root. */
export const PUBLIC_HOST_FILES = [
  'host-font-corpus.mjs',
  'qualification-fixture.mjs',
  'qualification-pg-fixture.mjs',
  'core-native-port.mjs',
];

export class IsolationRefused extends Error {
  constructor(message) {
    super(message);
    this.name = 'IsolationRefused';
  }
}

export class ControlUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'ControlUnavailable';
  }
}

export class InputRefused extends Error {
  constructor(message) {
    super(message);
    this.name = 'InputRefused';
  }
}

/** Split a routable label into manifest id and supported suffix. */
export function parseFixtureLabel(label) {
  if (typeof label !== 'string' || !label) return null;
  for (const suffix of HOST_SUFFIXES) {
    if (!suffix) continue;
    if (label.endsWith(suffix)) {
      return {baseId: label.slice(0, -suffix.length), suffix};
    }
  }
  return {baseId: label, suffix: ''};
}

/**
 * Validate that a label is routable on the retained host: a manifest id plus a
 * supported suffix. Rejects anything else, because the host cannot route it.
 */
export function resolveFixtureLabel(label, manifestIds) {
  const parsed = parseFixtureLabel(label);
  if (!parsed) throw new IsolationRefused('a routable fixture label is required');
  if (!Array.isArray(manifestIds) || !manifestIds.length) {
    throw new IsolationRefused('the corpus manifest ids are required to resolve a label');
  }
  if (!manifestIds.includes(parsed.baseId)) {
    throw new IsolationRefused(
      `${label} is not a manifest identity; the host only routes manifest ids with a supported suffix`);
  }
  return parsed;
}

function isInside(parent, child) {
  const path = relative(resolve(parent), resolve(child));
  return path === '' || (!path.startsWith('..') && !path.startsWith(sep));
}

/** Output paths the copied host will actually use, given its root. */
export function expectedOutputs(runRoot, {postgres = true} = {}) {
  return {
    hostRoot: resolve(runRoot),
    saved: resolve(runRoot, postgres ? 'font-corpus/saved' : 'corpus/saved'),
    continuous: resolve(runRoot, 'font-corpus/continuous-native-results.json'),
    recovery: resolve(runRoot, 'font-corpus/continuous-recovery-private.json'),
    inputs: resolve(runRoot, 'corpus/inputs'),
    manifest: resolve(runRoot, 'corpus/manifest.json'),
  };
}

/**
 * Copy the known public harness layout into a new isolated root.
 *
 * The host must end up at the root of the run root (it resolves `./cert.pem`,
 * `./corpus/...` and its sibling modules from import.meta.url). Every relative
 * import of the copied host is checked to exist afterwards, so a flattened copy
 * cannot silently break.
 */
export async function materializeRunRoot({
  fixtureRoot,
  runRoot,
  corpusIds,
  postgres = true,
  operatorPki,
  files = PUBLIC_HOST_FILES,
  fs = {},
}) {
  const ops = {copyFile, mkdir, readdir, readFile, stat, writeFile, ...fs};
  if (!fixtureRoot || !runRoot) {
    throw new IsolationRefused('fixtureRoot and runRoot are both required');
  }
  const fixture = resolve(fixtureRoot);
  const target = resolve(runRoot);
  if (isInside(fixture, target) || isInside(target, fixture)) {
    throw new IsolationRefused(
      `runRoot ${target} overlaps the fixture root ${fixture}; choose a separate new root`);
  }
  if (!Array.isArray(corpusIds) || !corpusIds.length) {
    throw new InputRefused('a non-empty corpus selection is required');
  }
  if (!operatorPki || !operatorPki.certPath || !operatorPki.keyPath) {
    throw new IsolationRefused(
      'fresh operator PKI paths (certPath, keyPath) are required; retained TLS material is never reused');
  }
  for (const [name, path] of Object.entries(operatorPki)) {
    if (isInside(fixture, path)) {
      throw new IsolationRefused(
        `${name} ${path} is inside the retained fixture; supply a fresh operator copy`);
    }
  }

  let exists = true;
  try {
    await ops.stat(target);
  } catch {
    exists = false;
  }
  if (exists) {
    const entries = await ops.readdir(target);
    if (entries.length) throw new IsolationRefused(`runRoot ${target} already exists and is not empty`);
  }
  await ops.mkdir(target, {recursive: true});

  const manifest = JSON.parse(await ops.readFile(join(fixture, 'corpus', 'manifest.json'), 'utf8'));
  if (!Array.isArray(manifest) || !manifest.length) {
    throw new IsolationRefused('the fixture corpus manifest is empty or malformed');
  }
  const selected = manifest.filter(entry => corpusIds.includes(entry.id));
  if (selected.length !== corpusIds.length) {
    throw new InputRefused('every selected corpus id must exist in the fixture manifest');
  }

  const copied = [];
  for (const name of files) {
    const source = join(fixture, name);
    const destination = join(target, name);
    try {
      await ops.copyFile(source, destination);
    } catch (error) {
      if (name === 'core-native-port.mjs') continue; // optional, postgres-only
      throw new IsolationRefused(`cannot copy public harness file ${name}: ${error.message}`);
    }
    const payload = await ops.readFile(destination);
    copied.push({name, sha256: createHash('sha256').update(payload).digest('hex')});
  }

  // Preserve the corpus layout the host reads: corpus/manifest.json + inputs/.
  await ops.mkdir(join(target, 'corpus', 'inputs'), {recursive: true});
  await ops.copyFile(join(fixture, 'corpus', 'manifest.json'),
    join(target, 'corpus', 'manifest.json'));
  const inputs = [];
  for (const entry of selected) {
    const source = join(fixture, 'corpus', 'inputs', entry.filename);
    const destination = join(target, 'corpus', 'inputs', entry.filename);
    await ops.copyFile(source, destination);
    const payload = await ops.readFile(destination);
    const digest = createHash('sha256').update(payload).digest('hex');
    if (entry.sha256 && digest !== entry.sha256) {
      throw new IsolationRefused(`copied ${entry.filename} does not match its manifest hash`);
    }
    inputs.push({id: entry.id, filename: entry.filename, sha256: digest});
  }

  await ops.copyFile(operatorPki.certPath, join(target, 'cert.pem'));
  await ops.copyFile(operatorPki.keyPath, join(target, 'key.pem'));

  // Every relative module import of the host must exist in the copy.
  const hostSource = await ops.readFile(join(target, 'host-font-corpus.mjs'), 'utf8');
  const relativeImports = [...hostSource.matchAll(/['"]\.\/([^'"]+\.mjs)['"]/g)]
    .map(match => match[1]);
  const missing = [];
  for (const name of new Set(relativeImports)) {
    try {
      await ops.stat(join(target, name));
    } catch {
      missing.push(name);
    }
  }
  if (missing.length) {
    throw new IsolationRefused(`run root is missing host imports: ${missing.join(', ')}`);
  }

  const outputs = expectedOutputs(target, {postgres});
  await ops.mkdir(outputs.saved, {recursive: true});
  await ops.mkdir(dirname(outputs.continuous), {recursive: true});
  const record = {
    schema: 'meri-office241-run-root/2',
    hostRoot: outputs.hostRoot,
    host: basename(join(target, 'host-font-corpus.mjs')),
    postgres,
    copied,
    inputs,
    outputs,
    pki: {cert: join(target, 'cert.pem'), key: join(target, 'key.pem'),
      source: {certPath: operatorPki.certPath, keyPath: operatorPki.keyPath}},
    retainedTreeUntouched: true,
  };
  await ops.writeFile(join(target, 'run-root.json'), JSON.stringify(record, null, 2) + '\n');
  return record;
}

const decoder = new TextDecoder();

/**
 * HTTP adapter for a host started from an isolated run root. Every request path
 * is one the retained host actually serves.
 *
 * `editor` performs the browser work outside this module:
 *   editor.navigate(routePath) -> opens/relaunches the editor and awaits ready
 *   editor.save()             -> triggers the editor's own Save and awaits it
 * A missing editor is refused: comparing the host's unchanged bytes would not
 * prove an open, an edit or a reopen.
 */
export async function createHttpAdapter({origin, identity, editor, manifestIds, fetchImpl}) {
  if (!origin || !/^https?:\/\//.test(origin)) {
    throw new IsolationRefused('an explicit http(s) origin is required; there is no default host');
  }
  if (manifestIds) resolveFixtureLabel(identity, manifestIds);
  else if (!parseFixtureLabel(identity)) throw new IsolationRefused('a routable label is required');
  if (!editor || typeof editor.navigate !== 'function' || typeof editor.save !== 'function') {
    throw new IsolationRefused('an editor driver (navigate, save) is required');
  }
  const request = fetchImpl ?? globalThis.fetch;
  if (typeof request !== 'function') throw new IsolationRefused('a fetch implementation is required');
  const encode = identity;

  const state = async () => {
    const response = await request(`${origin}/state`);
    if (!response.ok) throw new Error(`state failed: ${response.status}`);
    return response.json();
  };

  return {
    origin,
    identity,
    async open() {
      await editor.navigate(`/fresh/${encode}`);
    },
    async save() {
      const before = (await state()).files?.[encode]?.sequence ?? 0;
      await editor.save();
      const after = (await state()).files?.[encode]?.sequence ?? 0;
      if (after <= before) {
        throw new Error(`native Save did not advance the host sequence (${before} -> ${after})`);
      }
      return {sequence: after};
    },
    async reopen() {
      // The host resets on /fresh, so reopen renews the claims and reopens the
      // existing identity through /qualify.
      const renewal = await request(`${origin}/renew/${encode}`, {method: 'POST'});
      if (!renewal.ok) throw new Error(`renew failed: ${renewal.status}`);
      await editor.navigate(`/qualify/${encode}`);
    },
    async bytes() {
      const response = await request(`${origin}/saved/${encode}`);
      if (!response.ok) throw new Error(`saved bytes unavailable: ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    },
    async sequence() {
      return (await state()).files?.[encode]?.sequence ?? 0;
    },
    async verify() {
      const response = await request(`${origin}/verify/${encode}`, {method: 'POST'});
      const text = decoder.decode(await response.arrayBuffer());
      let body = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
      return {status: response.status, body};
    },
  };
}

/**
 * Route-accurate in-memory host for inert tests. It serves the same paths the
 * retained host serves, including the resetting /fresh and the non-resetting
 * /qualify, so the adapter can be tested without a socket.
 */
export function createInertHost({manifestIds, documents = {}, postgres = true,
  verifyBody = null} = {}) {
  const files = new Map();
  const requests = [];
  const ok = body => ({ok: true, status: 200,
    json: async () => body, arrayBuffer: async () => Buffer.from(JSON.stringify(body))});
  const binary = payload => ({ok: true, status: 200,
    json: async () => { throw new Error('not json'); },
    arrayBuffer: async () => Buffer.from(payload)});
  const fail = status => ({ok: false, status, json: async () => null,
    arrayBuffer: async () => Buffer.alloc(0)});

  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const method = options.method ?? 'GET';
    requests.push({method, path});
    const label = path.split('/').at(-1);
    if (path === '/state') {
      return ok({files: Object.fromEntries([...files].map(([key, value]) =>
        [key, {sequence: value.sequence, bytes: value.bytes.length, state: 'draft',
          lock: false}]))});
    }
    if (path.startsWith('/fresh/')) {
      const parsedLabel = resolveFixtureLabel(label, manifestIds);
      const seed = documents[parsedLabel.baseId];
      if (!seed) return fail(404);
      files.set(label, {sequence: 0, bytes: Buffer.from(seed)});
      return ok({seeded: true});
    }
    if (path.startsWith('/qualify/')) {
      if (!files.has(label)) {
        const parsedLabel = resolveFixtureLabel(label, manifestIds);
        const seed = documents[parsedLabel.baseId];
        if (!seed) return fail(404);
        files.set(label, {sequence: 0, bytes: Buffer.from(seed)});
      }
      return ok({qualified: true});
    }
    if (path.startsWith('/renew/') && method === 'POST') {
      if (!files.has(label)) return fail(404);
      return ok({actionUrl: 'inert', fields: {}});
    }
    if (path.startsWith('/saved/')) {
      const entry = files.get(label);
      if (!entry) return fail(404);
      return binary(entry.bytes);
    }
    if (path.startsWith('/verify/') && method === 'POST') {
      if (!postgres) return fail(404);
      const entry = files.get(label);
      if (!entry || !entry.sequence) return fail(409);
      const body = typeof verifyBody === 'function' ? verifyBody({label, entry}) : verifyBody;
      if (!body) return fail(500);
      return ok(body);
    }
    return fail(404);
  };

  return {
    fetchImpl,
    requests,
    state: files,
    /** Simulate the editor performing a native Save of new bytes. */
    save(label, bytes) {
      const entry = files.get(label);
      if (!entry) throw new Error(`no identity ${label}`);
      entry.bytes = Buffer.from(bytes);
      entry.sequence += 1;
      return entry.sequence;
    },
  };
}
