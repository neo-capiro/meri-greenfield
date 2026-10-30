/**
 * Adapter between the Office241 chart flows and the EXISTING public
 * CODE/WOPI/Core qualification host (SCRUM-241).
 *
 * Only routes the retained public host actually serves are used:
 *
 *   GET  /fresh/<label>     create the document from the corpus input (RESETS)
 *   GET  /qualify/<label>   serve the editor for the existing identity
 *   POST /renew/<label>     refresh editor claims and relaunch data
 *   GET  /state             {files: {<label>: {sequence, bytes, state, lock}}}
 *   GET  /saved/<label>     the saved bytes held by the host
 *   POST /verify/<label>    canonical persistence evidence (postgres host)
 *
 * A label is a corpus manifest id plus one of the host's supported suffixes, so
 * the complete routable set is accepted and isolation comes from a separate
 * host root instead of invented identifiers.
 *
 * The host resolves every relative path from its own module URL, and two of its
 * public modules reach outside that root:
 *
 *   qualification-fixture.mjs / qualification-pg-fixture.mjs
 *       import absolute file:///...wave6-capabilities-runtime/... modules
 *   core-native-port.mjs
 *       spawns the retained core-native.cjs bridge
 *
 * A copied host therefore is NOT isolated by a new root alone. materializeRunRoot
 * requires an operator-selected runtime source tree and an isolated Core bridge,
 * then rewrites only those import/spawn paths in the COPY. The retained files
 * are never modified, and retained private TLS/config is never read or copied.
 *
 * Everything is validated before anything is written.
 */
import {createHash} from 'node:crypto';
import {copyFile, mkdir, readdir, readFile, realpath, stat, writeFile} from 'node:fs/promises';
import {basename, dirname, join, relative, resolve, sep} from 'node:path';

/** Suffixes the retained WOPI route and manifest lookup accept. */
export const HOST_SUFFIXES = ['', '-renew', '-revoke', '-expire', '-restart', '-lostack'];

/** Public host modules copied as-is. core-native-port.mjs is adapted separately. */
export const PUBLIC_HOST_FILES = [
  'host-font-corpus.mjs',
  'qualification-fixture.mjs',
  'qualification-pg-fixture.mjs',
];
export const CORE_BRIDGE_FILE = 'core-native-port.mjs';

/** The absolute source root the public fixtures import their runtime from. */
export const RUNTIME_IMPORT_PATTERN = /file:\/\/\/(?:[^'"\s]*\/)?wave6-capabilities-runtime\//g;

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

export function parseFixtureLabel(label) {
  if (typeof label !== 'string' || !label) return null;
  for (const suffix of HOST_SUFFIXES) {
    if (!suffix) continue;
    if (label.endsWith(suffix)) return {baseId: label.slice(0, -suffix.length), suffix};
  }
  return {baseId: label, suffix: ''};
}

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

function inside(parent, child) {
  const path = relative(resolve(parent), resolve(child));
  return path === '' || (!path.startsWith('..') && !path.startsWith(sep));
}

async function realOrResolved(path) {
  try {
    return await realpath(path);
  } catch {
    return resolve(path);
  }
}

/** Outputs the copied host will really use, given the run root it sits in. */
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

function fileUrlOf(path) {
  return 'file:///' + resolve(path).replace(/\\/g, '/').replace(/^\/+/, '');
}

/** Rewrite the runtime imports of a fixture module to the operator's tree. */
export function adaptRuntimeImports(source, runtimeRoot) {
  const replacement = fileUrlOf(runtimeRoot).replace(/\/+$/, '') + '/';
  const hits = source.match(RUNTIME_IMPORT_PATTERN) ?? [];
  const adapted = source.replace(RUNTIME_IMPORT_PATTERN, replacement);
  return {adapted, count: hits.length};
}

/** Rewrite the retained bridge spawn to the operator's isolated bridge. */
export function adaptCoreBridge(source, {script, nodeExecutable}) {
  const spawnCall = /spawn\((?:[^;]*?),\[([^\]]*)\]/;
  const match = source.match(spawnCall);
  if (!match) {
    throw new IsolationRefused('core-native-port.mjs does not expose the expected spawn call');
  }
  const args = script ? JSON.stringify(script) : null;
  if (!args) throw new IsolationRefused('an isolated Core bridge script is required');
  const executable = nodeExecutable
    ? JSON.stringify(nodeExecutable)
    : 'process.execPath';
  const adapted = source.replace(spawnCall, `spawn(${executable},[${args}]`);
  return {adapted, from: match[1], to: args};
}

const basenameOnly = name => typeof name === 'string' && name === basename(name)
  && !name.includes('..') && !name.includes('/') && !name.includes('\\');

/**
 * Copy the known public harness layout into a new isolated root, adapting only
 * the copied absolute runtime/bridge paths to operator-selected sources.
 *
 * Nothing is created until every input has been validated.
 */
export async function materializeRunRoot({
  fixtureRoot, runRoot, corpusIds, postgres = true,
  runtimeRoot, coreBridge, operatorPki, fs = {},
}) {
  const ops = {copyFile, mkdir, readdir, readFile, realpath, stat, writeFile, ...fs};
  if (!fixtureRoot || !runRoot) throw new IsolationRefused('fixtureRoot and runRoot are required');
  if (!runtimeRoot) {
    throw new IsolationRefused(
      'an explicit operator runtime source tree is required; the copied fixtures import it by absolute path');
  }
  if (postgres && !coreBridge) {
    throw new IsolationRefused(
      'an explicit isolated Core bridge is required for the postgres host; the retained bridge is not reused');
  }
  if (!Array.isArray(corpusIds) || !corpusIds.length) {
    throw new InputRefused('a non-empty corpus selection is required');
  }
  if (!operatorPki || !operatorPki.certPath || !operatorPki.keyPath) {
    throw new IsolationRefused(
      'fresh operator PKI paths (certPath, keyPath) are required; retained TLS material is never reused');
  }

  const fixtureReal = await realOrResolved(fixtureRoot);
  const runtimeReal = await realOrResolved(runtimeRoot);
  const parentReal = await realOrResolved(dirname(resolve(runRoot)));
  const targetReal = join(parentReal, basename(resolve(runRoot)));

  const guarded = [
    ['runRoot', targetReal, fixtureReal],
    ['runtime source', runtimeReal, fixtureReal],
    ['PKI certificate', operatorPki.certPath, fixtureReal],
    ['PKI key', operatorPki.keyPath, fixtureReal],
  ];
  for (const [name, path, root] of guarded) {
    if (inside(root, path)) {
      throw new IsolationRefused(`${name} ${path} is inside the retained fixture ${root}`);
    }
  }
  for (const other of [fixtureReal, runtimeReal]) {
    if (inside(other, targetReal) || inside(targetReal, other)) {
      throw new IsolationRefused(`runRoot ${targetReal} overlaps ${other}; choose a separate new root`);
    }
  }
  if (coreBridge && coreBridge.script) {
    const bridgeReal = await realOrResolved(coreBridge.script);
    if (inside(fixtureReal, bridgeReal)) {
      throw new IsolationRefused(`Core bridge ${bridgeReal} is inside the retained fixture`);
    }
    if (inside(targetReal, bridgeReal)) {
      throw new IsolationRefused('the Core bridge must not live inside the run root it serves');
    }
    coreBridge = {...coreBridge, script: bridgeReal};
  }

  let exists = true;
  try {
    await ops.stat(targetReal);
  } catch {
    exists = false;
  }
  if (exists) {
    const entries = await ops.readdir(targetReal);
    if (entries.length) throw new IsolationRefused(`runRoot ${targetReal} already exists and is not empty`);
  }
  try {
    await ops.stat(runtimeReal);
  } catch {
    throw new IsolationRefused(`runtime source ${runtimeReal} does not exist`);
  }

  // ---- validation only, no writes yet ----
  const manifest = JSON.parse(await ops.readFile(join(fixtureReal, 'corpus', 'manifest.json'), 'utf8'));
  if (!Array.isArray(manifest) || !manifest.length) {
    throw new IsolationRefused('the fixture corpus manifest is empty or malformed');
  }
  const selected = [];
  for (const id of corpusIds) {
    const entry = manifest.find(item => item.id === id);
    if (!entry) throw new InputRefused(`${id} is not in the fixture manifest`);
    if (!basenameOnly(entry.filename)) {
      throw new IsolationRefused(`manifest filename ${entry.filename} is not a plain file name`);
    }
    const source = join(fixtureReal, 'corpus', 'inputs', entry.filename);
    const payload = await ops.readFile(source).catch(() => null);
    if (!payload) throw new IsolationRefused(`corpus input ${entry.filename} is missing`);
    const digest = createHash('sha256').update(payload).digest('hex');
    if (entry.sha256 && digest !== entry.sha256) {
      throw new IsolationRefused(`corpus input ${entry.filename} does not match its manifest hash`);
    }
    selected.push({id, filename: entry.filename, sha256: digest, payload});
  }

  const sources = {};
  for (const name of PUBLIC_HOST_FILES) {
    sources[name] = await ops.readFile(join(fixtureReal, name)).catch(() => null);
    if (!sources[name]) throw new IsolationRefused(`public harness file ${name} is missing`);
  }
  let bridgeSource = null;
  if (postgres) {
    bridgeSource = await ops.readFile(join(fixtureReal, CORE_BRIDGE_FILE)).catch(() => null);
    if (!bridgeSource) throw new IsolationRefused(`${CORE_BRIDGE_FILE} is missing from the fixture`);
  }

  // The adapted copies must resolve to real operator files.
  const adaptations = [];
  const adaptedFixtures = {};
  for (const name of ['qualification-fixture.mjs', 'qualification-pg-fixture.mjs']) {
    const {adapted, count} = adaptRuntimeImports(sources[name].toString('utf8'), runtimeReal);
    if (!count) {
      throw new IsolationRefused(`${name} has no runtime imports to rebind; layout changed`);
    }
    const imports = [...adapted.matchAll(/file:\/\/\/([^'"]+?\.mjs)/g)].map(match => match[1]);
    for (const imported of imports) {
      const path = process.platform === 'win32'
        ? imported.replace(/^\/([A-Za-z]:)/, '$1')
        : '/' + imported.replace(/^\/+/, '');
      try {
        await ops.stat(path);
      } catch {
        throw new IsolationRefused(`runtime source is missing ${path}`);
      }
    }
    adaptedFixtures[name] = adapted;
    adaptations.push({file: name, rebinds: count, runtime: fileUrlOf(runtimeReal)});
  }
  let bridgeAdaptation = null;
  if (postgres) {
    bridgeAdaptation = adaptCoreBridge(bridgeSource.toString('utf8'), coreBridge);
    try {
      await ops.stat(coreBridge.script);
    } catch {
      throw new IsolationRefused(`Core bridge ${coreBridge.script} does not exist`);
    }
    adaptations.push({file: CORE_BRIDGE_FILE, bridge: coreBridge.script});
  }

  // Every relative module import of the host must be satisfied by the copy.
  const hostSource = sources['host-font-corpus.mjs'].toString('utf8');
  const relativeImports = new Set([...hostSource.matchAll(/['"]\.\/([^'"]+\.mjs)['"]/g)]
    .map(match => match[1]));
  for (const name of relativeImports) {
    if (!PUBLIC_HOST_FILES.includes(name) && name !== CORE_BRIDGE_FILE) {
      throw new IsolationRefused(`host imports ${name}, which is not a known public module`);
    }
    if (name === CORE_BRIDGE_FILE && !postgres) continue;
  }

  // ---- writes start here ----
  await ops.mkdir(join(targetReal, 'corpus', 'inputs'), {recursive: true});
  await ops.mkdir(join(targetReal, 'font-corpus', 'saved'), {recursive: true});
  const copied = [];
  for (const name of PUBLIC_HOST_FILES) {
    const payload = adaptedFixtures[name] !== undefined
      ? Buffer.from(adaptedFixtures[name], 'utf8')
      : sources[name];
    await ops.writeFile(join(targetReal, name), payload);
    copied.push({name, sha256: createHash('sha256').update(sources[name]).digest('hex')});
  }
  if (postgres) {
    await ops.writeFile(join(targetReal, CORE_BRIDGE_FILE), bridgeAdaptation.adapted);
    copied.push({name: CORE_BRIDGE_FILE, adapted: true});
  }
  await ops.copyFile(join(fixtureReal, 'corpus', 'manifest.json'), join(targetReal, 'corpus', 'manifest.json'));
  for (const entry of selected) {
    await ops.writeFile(join(targetReal, 'corpus', 'inputs', entry.filename), entry.payload);
  }
  await ops.copyFile(operatorPki.certPath, join(targetReal, 'cert.pem'));
  await ops.copyFile(operatorPki.keyPath, join(targetReal, 'key.pem'));

  const outputs = expectedOutputs(targetReal, {postgres});
  const record = {
    schema: 'meri-office241-run-root/3',
    hostRoot: outputs.hostRoot,
    host: 'host-font-corpus.mjs',
    postgres,
    copied,
    inputs: selected.map(entry => ({id: entry.id, filename: entry.filename, sha256: entry.sha256})),
    outputs,
    runtime: {root: runtimeReal, url: fileUrlOf(runtimeReal)},
    bridge: postgres ? {script: coreBridge.script, nodeExecutable: coreBridge.nodeExecutable ?? null} : null,
    adaptations,
    pki: {cert: join(targetReal, 'cert.pem'), key: join(targetReal, 'key.pem'),
      source: {certPath: operatorPki.certPath, keyPath: operatorPki.keyPath}},
    retainedTreeUntouched: true,
  };
  await ops.writeFile(join(targetReal, 'run-root.json'), JSON.stringify(record, null, 2) + '\n');
  return record;
}

const decoder = new TextDecoder();

/**
 * HTTP adapter for a host started from an isolated run root. Every request path
 * is one the retained host serves; the browser work is delegated to `editor`.
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

  const state = async () => {
    const response = await request(`${origin}/state`);
    if (!response.ok) throw new Error(`state failed: ${response.status}`);
    return response.json();
  };

  return {
    origin,
    identity,
    async open() {
      await editor.navigate(`/fresh/${identity}`);
    },
    async save() {
      const before = (await state()).files?.[identity]?.sequence ?? 0;
      await editor.save();
      const after = (await state()).files?.[identity]?.sequence ?? 0;
      if (after <= before) {
        throw new Error(`native Save did not advance the host sequence (${before} -> ${after})`);
      }
      return {sequence: after};
    },
    async reopen() {
      const renewal = await request(`${origin}/renew/${identity}`, {method: 'POST'});
      if (!renewal.ok) throw new Error(`renew failed: ${renewal.status}`);
      await editor.navigate(`/qualify/${identity}`);
    },
    async bytes() {
      const response = await request(`${origin}/saved/${identity}`);
      if (!response.ok) throw new Error(`saved bytes unavailable: ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    },
    async sequence() {
      return (await state()).files?.[identity]?.sequence ?? 0;
    },
    async verify() {
      const response = await request(`${origin}/verify/${identity}`, {method: 'POST'});
      let body = null;
      try {
        body = JSON.parse(decoder.decode(await response.arrayBuffer()));
      } catch {
        body = null;
      }
      return {status: response.status, body};
    },
  };
}

/** Route-accurate in-memory host for inert tests (same paths, no socket). */
export function createInertHost({manifestIds, documents = {}, postgres = true, verifyBody = null} = {}) {
  const files = new Map();
  const requests = [];
  const ok = body => ({ok: true, status: 200, json: async () => body,
    arrayBuffer: async () => Buffer.from(JSON.stringify(body))});
  const binary = payload => ({ok: true, status: 200,
    json: async () => { throw new Error('not json'); }, arrayBuffer: async () => Buffer.from(payload)});
  const fail = status => ({ok: false, status, json: async () => null, arrayBuffer: async () => Buffer.alloc(0)});

  const fetchImpl = async (url, options = {}) => {
    const path = new URL(url).pathname;
    const method = options.method ?? 'GET';
    requests.push({method, path});
    const label = path.split('/').at(-1);
    if (path === '/state') {
      return ok({files: Object.fromEntries([...files].map(([key, value]) =>
        [key, {sequence: value.sequence, bytes: value.bytes.length, state: 'draft', lock: false}]))});
    }
    if (path.startsWith('/fresh/')) {
      const parsed = resolveFixtureLabel(label, manifestIds);
      if (!documents[parsed.baseId]) return fail(404);
      files.set(label, {sequence: 0, bytes: Buffer.from(documents[parsed.baseId])});
      return ok({seeded: true});
    }
    if (path.startsWith('/qualify/')) {
      if (!files.has(label)) {
        const parsed = resolveFixtureLabel(label, manifestIds);
        if (!documents[parsed.baseId]) return fail(404);
        files.set(label, {sequence: 0, bytes: Buffer.from(documents[parsed.baseId])});
      }
      return ok({qualified: true});
    }
    if (path.startsWith('/renew/') && method === 'POST') {
      if (!files.has(label)) return fail(404);
      return ok({actionUrl: 'inert', fields: {}});
    }
    if (path.startsWith('/saved/')) {
      const entry = files.get(label);
      return entry ? binary(entry.bytes) : fail(404);
    }
    if (path.startsWith('/verify/') && method === 'POST') {
      if (!postgres) return fail(404);
      const entry = files.get(label);
      if (!entry || !entry.sequence) return fail(409);
      const body = typeof verifyBody === 'function' ? verifyBody({label, entry}) : verifyBody;
      return body ? ok(body) : fail(500);
    }
    return fail(404);
  };

  return {
    fetchImpl,
    requests,
    state: files,
    save(label, bytes) {
      const entry = files.get(label);
      if (!entry) throw new Error(`no identity ${label}`);
      entry.bytes = Buffer.from(bytes);
      entry.sequence += 1;
      return entry.sequence;
    },
  };
}
