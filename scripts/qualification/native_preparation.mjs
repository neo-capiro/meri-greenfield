// Offline DATA preparation only. No AWS client, executor, caller loader or authority toggle.
import * as fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TextDecoder } from 'node:util';

const SELF = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SELF), '../..');
const GIT = 'C:/Program Files/Git/cmd/git.exe';
export const SOURCE_REFERENCE = '651ec8ce136a9ed3b22f911ea0dac90f33de40c7';
export const MAX_STATIC_PINS_BYTES = 16 * 1024 * 1024;
export const COMPILER_PINS = Object.freeze([
  ['infra/native-enforcement/app.mjs', 618, 'e03076acb2ccda59bd38c2e2763f94af0d057f6c6c1bd3e699e25c72314ab1ed'],
  ['infra/native-enforcement/lib/binding.mjs', 17314, '985519195dec59763d120ab8b1847eb71c023a782fa652e4d32e35528f5484e7'],
  ['infra/native-enforcement/lib/expressions.mjs', 14772, '5195d83752a230ed3fae80bab14871026d6678caf1fbd9e4f82350d9d6fc0a45'],
  ['infra/native-enforcement/lib/workflow.mjs', 25523, '237eae6c3938464732c13add0ef6e18484c203e51f00a79c1ef8064e6fd3bc98'],
  ['infra/native-enforcement/lib/infrastructure.mjs', 4892, '80876d633d73b511d5060baecc6a609350d90706435f7acbcd086f40832c42b2'],
  ['infra/native-enforcement/lib/task-definition.mjs', 9432, 'edd9a835e7c05ed4fe47eaaa375bdb74204913e31b49fd169d9079a169164896'],
  ['infra/native-enforcement/lib/probe-profiles.mjs', 4920, '67dff6ffb4025e1767226a5bb330998ad78bd9d76083319adb910a22e3397660'],
  ['infra/native-enforcement/canary-task-definition.mjs', 2612, '524135d00aec413a6393e69a7d22974160109b01cc4ced71d35f26440d3e4df5'],
  ['infra/native-enforcement/lib/ecs-wire.mjs', 7060, '1c7c318d011cf6f4783f6a29a2d64f69005ce366fc418359ba2d936f3a773c57'],
  ['scripts/sdk-capture/json-records.mjs', 6814, '8b889617a9565b7f1b5d29863b772b71f2c880a5fd1606b8a8b68ac2163be02d'],
  ['scripts/sdk-capture/protocol.mjs', 5151, 'c20499a3a9e29069f6a59b58c7262fda6dfddd03068d7a49d6d73003f07e4a9e'],
].map(([path, bytes, sha256]) => Object.freeze({ path, bytes, sha256 })));

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const requireThat = (value, reason) => { if (!value) throw Error(reason); };
const record = (path, bytes) => ({ path, bytes: bytes.length, sha256: sha(bytes) });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const serialize = value => Buffer.from(JSON.stringify(value));
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

function checkAncestors(path) {
  for (let current = dirname(path);; current = dirname(current)) {
    requireThat(!fs.lstatSync(current).isSymbolicLink(), 'visible ancestor link refused');
    if (dirname(current) === current) break;
  }
}

// Trusted local checkout bound. No caller IO seam; no hostile-filesystem guarantee.
function readBounded(path, maximum) {
  let fd;
  try {
    checkAncestors(path);
    const before = fs.lstatSync(path);
    requireThat(before.isFile() && !before.isSymbolicLink() && before.nlink === 1
      && before.size <= maximum, 'regular bounded file required');
    fd = fs.openSync(path, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const first = fs.fstatSync(fd), bytes = Buffer.alloc(before.size + 1);
    let total = 0, count;
    do { count = fs.readSync(fd, bytes, total, bytes.length - total, total); total += count; }
    while (count && total < bytes.length);
    const last = fs.fstatSync(fd), after = fs.lstatSync(path);
    for (const st of [first, last, after]) {
      requireThat(st.isFile() && !st.isSymbolicLink() && st.nlink === 1
        && st.dev === before.dev && st.ino === before.ino && st.size === total
        && st.mtimeMs === before.mtimeMs && st.ctimeMs === before.ctimeMs, 'file changed during read');
    }
    requireThat(total === before.size, 'file changed during read');
    return Buffer.from(bytes.subarray(0, total));
  } catch { throw Error('bounded file read refused'); }
  finally { if (fd !== undefined) { try { fs.closeSync(fd); } catch { throw Error('file close refused'); } } }
}

function gitRead(args, input, operations) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')));
  Object.assign(env, { GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: 'NUL' });
  const argv = ['-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-c', 'core.hooksPath=NUL', '-C', ROOT, ...args];
  const result = spawnSync(GIT, argv, { input, env, shell: false, timeout: 15000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
  operations.push({ executable: GIT, argv, exitCode: result.status, signal: result.signal,
    errorCode: result.error?.code || null, timeoutMs: 15000, maxBuffer: 2097152,
    stdout: record('stdout', result.stdout || Buffer.alloc(0)), stderr: record('stderr', result.stderr || Buffer.alloc(0)) });
  requireThat(!result.error && result.status === 0 && !result.signal, 'fixed Git read refused');
  return result.stdout;
}

function verifyCompiler() {
  const operations = [], working = [], git = [], entries = new Map();
  const tree = gitRead(['ls-tree', '-r', '-z', '-l', SOURCE_REFERENCE, '--', ...COMPILER_PINS.map(p => p.path)], undefined, operations);
  for (const row of tree.toString('utf8').split('\0').filter(Boolean)) {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\s+([0-9]+)\t(.+)$/.exec(row);
    requireThat(match && !entries.has(match[4]), 'fixed Git tree refused');
    entries.set(match[4], { oid: match[2], bytes: Number(match[3]), mode: match[1] });
  }
  requireThat(entries.size === COMPILER_PINS.length, 'fixed Git closure incomplete');
  for (const pin of COMPILER_PINS) requireThat(entries.get(pin.path)?.bytes === pin.bytes, 'fixed Git source size drift');
  const batch = gitRead(['cat-file', '--batch'], Buffer.from(COMPILER_PINS.map(p => entries.get(p.path).oid + '\n').join('')), operations);
  let cursor = 0;
  for (const pin of COMPILER_PINS) {
    const entry = entries.get(pin.path), end = batch.indexOf(10, cursor);
    requireThat(end >= cursor && batch.subarray(cursor, end).toString('ascii') === `${entry.oid} blob ${pin.bytes}`, 'fixed Git blob header refused');
    const raw = batch.subarray(end + 1, end + 1 + pin.bytes);
    requireThat(raw.length === pin.bytes && sha(raw) === pin.sha256 && batch[end + 1 + pin.bytes] === 10, 'fixed Git source hash drift');
    git.push({ ...pin, objectId: entry.oid, mode: entry.mode });
    const current = record(pin.path, readBounded(join(ROOT, pin.path), pin.bytes));
    requireThat(same(current, pin), 'fixed working source drift: ' + pin.path);
    working.push(current); cursor = end + 2 + pin.bytes;
  }
  requireThat(cursor === batch.length, 'extra fixed Git data');
  return { working, git, operations };
}

function rejectUnsafe(value) {
  if (typeof value === 'number') requireThat(Number.isFinite(value), 'non-finite JSON number refused');
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    requireThat(!['__proto__', 'constructor', 'prototype'].includes(key), 'reserved JSON member refused');
    rejectUnsafe(child);
  }
}

export function parseArgs(args) {
  requireThat(Array.isArray(args) && args.length === 6, 'exact profile/static-pins/output arguments required');
  const names = new Map([['--profile', 'profile'], ['--static-pins', 'staticPinsPath'], ['--output', 'outputDirectory']]), options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = names.get(args[i]);
    requireThat(key && !Object.hasOwn(options, key) && typeof args[i + 1] === 'string', 'unknown or duplicate argument refused');
    options[key] = args[i + 1];
  }
  return options;
}

export async function prepareNativeData(options = {}) {
  requireThat(options && typeof options === 'object' && !Array.isArray(options)
    && same(Object.keys(options).sort(), ['outputDirectory', 'profile', 'staticPinsPath']), 'exact inert preparation options required');
  const { profile, staticPinsPath, outputDirectory } = options;
  requireThat(profile === 'native' || profile === 'canary', 'explicit closed profile required');
  requireThat(typeof staticPinsPath === 'string' && isAbsolute(staticPinsPath)
    && typeof outputDirectory === 'string' && isAbsolute(outputDirectory), 'absolute paths required');
  requireThat(!fs.existsSync(outputDirectory), 'output must be new');
  checkAncestors(outputDirectory);
  const input = readBounded(staticPinsPath, MAX_STATIC_PINS_BYTES);
  const selfBefore = record('scripts/qualification/native_preparation.mjs', readBounded(SELF, 128 * 1024));
  const runtimeBefore = record(process.execPath, readBounded(process.execPath, 256 * 1024 * 1024));
  const before = verifyCompiler(); // ALL eleven Git + working records BEFORE either fixed dynamic import.
  const scanner = await import(pathToFileURL(join(ROOT, 'scripts/sdk-capture/json-records.mjs')).href);
  let pins;
  try { const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input);
    scanner.scanJsonKeys(text); pins = JSON.parse(text); rejectUnsafe(pins);
  } catch { throw Error('strict static-pins JSON refused'); }
  const compiler = await import(pathToFileURL(join(ROOT, 'infra/native-enforcement/app.mjs')).href);
  let binding, graph, template;
  try {
    binding = profile === 'native' ? compiler.buildNativeEnforcementAdmission({ staticPins: pins }) : compiler.buildCanaryEnforcementAdmission({ staticPins: pins });
    requireThat(binding.runtimeEnabled === false && /^[a-f0-9]{64}$/.test(binding.staticBindingId), 'inert compiled binding required');
    graph = profile === 'native' ? compiler.buildNativeEnforcementStateMachine(binding) : compiler.buildCanaryEnforcementStateMachine(binding);
    template = profile === 'native' ? compiler.buildNativeEnforcementTemplate(binding) : compiler.buildCanaryEnforcementTemplate(binding);
    requireThat(graph.States.GuardInput.Choices[0].Condition.startsWith('{% false and ')
      && template.Metadata.runtimeEnabled === false
      && JSON.stringify(template.Resources.NativeEnforcementMachine.Properties.Definition) === JSON.stringify(graph), 'inert matching products required');
  } catch { throw Error('closed compiler refused static pins'); }
  const after = verifyCompiler();
  requireThat(same(before.working, after.working) && same(before.git, after.git), 'compiler changed after import');
  requireThat(input.equals(readBounded(staticPinsPath, MAX_STATIC_PINS_BYTES)), 'static pins changed after import');
  const selfAfter = record(selfBefore.path, readBounded(SELF, 128 * 1024));
  const runtimeAfter = record(process.execPath, readBounded(process.execPath, 256 * 1024 * 1024));
  requireThat(same(selfBefore, selfAfter) && same(runtimeBefore, runtimeAfter), 'preparation execution closure changed');
  const files = { 'static-pins.json': input, 'binding.json': serialize(binding), 'definition.json': serialize(graph), 'template.json': serialize(template) };
  const manifest = { schemaVersion: 'meri-native-preparation/2', status: 'INERT_DATA_PREPARATION_NOT_ADMISSION', profile,
    sourceReference: SOURCE_REFERENCE, compilerRecords: COMPILER_PINS, sourceVerification: { before, after },
    executionClosure: { before: [selfBefore], after: [selfAfter], dependencies: 'Node built-ins only outside the fixed compiler eleven' },
    runtime: { before: runtimeBefore, after: runtimeAfter, nodeVersion: process.version },
    staticBindingId: binding.staticBindingId, runtimeEnabled: false,
    files: Object.entries(files).map(([path, bytes]) => record(path, bytes)),
    limitations: ['Hashes identify code/data; they do not authenticate evidence or grant authority.',
      'No freshness, IAM, image, transport, task, isolation, termination or cleanup qualification.',
      'Trusted checkout with visible link checks and pre/post observations; not an atomic hostile-filesystem boundary.',
      'Use a fresh ordinary Node process; caller loaders, modified built-ins or prior module-cache interference are outside this offline boundary.',
      'Later execution requires a separate reviewed owner executor and fresh authority; this tool has no execution toggle.'] };
  fs.mkdirSync(outputDirectory, { recursive: false });
  for (const [name, bytes] of Object.entries(files)) fs.writeFileSync(join(outputDirectory, name), bytes, { flag: 'wx' });
  fs.writeFileSync(join(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  return freeze(manifest);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { const result = await prepareNativeData(parseArgs(process.argv.slice(2))); process.stdout.write(JSON.stringify({ status: result.status, profile: result.profile, runtimeEnabled: false }) + '\n'); }
  catch { process.stderr.write('error: native data preparation refused\n'); process.exitCode = 1; }
}
