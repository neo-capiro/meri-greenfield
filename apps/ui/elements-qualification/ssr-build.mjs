// Offline artifact preparation only. No component is imported or evaluated here.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const hash = raw => createHash('sha256').update(raw).digest('hex');
const read = path => { assert.ok(statSync(path).size <= 32 * 1024 * 1024, 'file bound'); return readFileSync(path); };
const record = (path, raw) => ({ path, bytes: raw.length, sha256: hash(raw) });
const inside = (root, path) => path.startsWith(root + sep);
const ENTRY = 'export { ElementsFixture } from "./fixture.tsx";\nexport { renderToStaticMarkup } from "react-dom/server";\n';

function sourceRecords(root) {
  const pins = JSON.parse(read(join(root, 'component-pins.json')));
  for (const item of pins.artifacts) {
    const raw = read(join(root, item.path));
    assert.equal(raw.length, item.bytes, item.path); assert.equal(hash(raw), item.sha256, item.path);
  }
  return pins.ownedPackageFiles.map(path => record(path, read(join(root, path))));
}

const externalsAllowed = rows => rows.every(x => /^(?:node:)?(?:stream|util|crypto|buffer|async_hooks|path|process|url)$/.test(x));
const slash = path => path.split(sep).join('/');

function inputBindings(root, dependencyRoot, metadata, sources) {
  const result = [];
  for (const name of Object.keys(metadata.inputs).sort()) {
    if (name === 'ssr-entry.mjs') continue;
    const path = realpathSync(resolve(root, name));
    const dependency = inside(dependencyRoot, path), base = dependency ? dependencyRoot : root;
    assert.ok(inside(base, path), 'input escapes source roots');
    const rel = slash(relative(base, path));
    if (!dependency) assert.ok(sources.some(x => x.path === rel), 'foreign package input');
    result.push({ input: name, dependency, path: rel });
  }
  assert.ok(result.length > 0 && result.length <= 10000, 'input set bound'); return result;
}

function assertRecords(root, rows) {
  assert.ok(Array.isArray(rows) && rows.length > 0 && rows.length <= 100000);
  const names = new Set();
  for (const item of rows) {
    assert.ok(item && typeof item.path === 'string' && !names.has(item.path)); names.add(item.path);
    const path = resolve(root, item.path); assert.ok(inside(root, path), 'record escapes root');
    const raw = read(path); assert.equal(raw.length, item.bytes, item.path); assert.equal(hash(raw), item.sha256, item.path);
  }
}

// Runtime binds the self-contained bundle and its complete recorded input mapping.
// Full installed input byte verification is a separate preparation/test operation.
export function verifySSRBundle({ receiptPath, expectedSha256, packageRoot = HERE }) {
  assert.match(expectedSha256, /^[a-f0-9]{64}$/);
  const raw = read(resolve(receiptPath)); assert.equal(hash(raw), expectedSha256, 'receipt digest');
  const receipt = JSON.parse(raw);
  assert.equal(receipt.schema, 'meri-elements-ssr-artifact/1');
  assert.equal(receipt.entry.sha256, hash(Buffer.from(ENTRY))); assert.equal(receipt.entry.text, ENTRY);
  assert.equal(receipt.node.version, process.version); assert.equal(receipt.node.platform, process.platform); assert.equal(receipt.node.arch, process.arch);
  const root = realpathSync(packageRoot);
  const tools = JSON.parse(read(join(root, 'toolchain-pins.json')));
  assert.deepEqual(receipt.tool, tools.tools.find(x => x.platform === process.platform + '-' + process.arch), 'tool receipt');
  assert.deepEqual(receipt.sources, sourceRecords(root), 'package source pins');
  const out = dirname(resolve(receiptPath));
  assert.deepEqual(receipt.outputs.map(x => x.path).sort(), ['fixture.cjs', 'fixture.cjs.LEGAL.txt', 'metafile.json']);
  assertRecords(out, receipt.outputs);
  const metadata = JSON.parse(read(join(out, 'metafile.json')));
  assert.deepEqual(receipt.inputs.map(x => x.input).sort(), Object.keys(metadata.inputs).filter(x => x !== 'ssr-entry.mjs').sort(), 'complete input mapping');
  for (const name of Object.keys(metadata.inputs)) {
    if (name === 'ssr-entry.mjs') continue;
    const binding = receipt.inputs.find(x => x.input === name);
    assert.ok(binding && (binding.dependency ? receipt.dependencies : receipt.sources).some(x => x.path === binding.path), 'unbound dependency input');
  }
  assert.deepEqual(receipt.externalImports, Object.values(metadata.outputs).flatMap(x => x.imports).filter(x => x.external).map(x => x.path).sort());
  assert.ok(externalsAllowed(receipt.externalImports), 'unreviewed runtime external');
  return { receipt, bundlePath: join(out, 'fixture.cjs') };
}

// Trusted-checkout provenance only; this supplies no deployment authority.
export function verifySSRReceipt(options) {
  const result = verifySSRBundle(options), root = realpathSync(options.packageRoot ?? HERE);
  const depRoot = realpathSync(join(root, 'node_modules'));
  assertRecords(depRoot, result.receipt.dependencies);
  const metadata = JSON.parse(read(join(dirname(resolve(options.receiptPath)), 'metafile.json')));
  assert.deepEqual(result.receipt.inputs, inputBindings(root, depRoot, metadata, result.receipt.sources), 'input roots');
  return result;
}

export function buildSSR({ toolRoot, outputRoot, packageRoot = HERE }) {
  const root = realpathSync(packageRoot), out = resolve(outputRoot);
  assert.ok(!inside(root, out) && out !== root, 'output must be outside package');
  const pins = JSON.parse(read(join(root, 'toolchain-pins.json')));
  assert.equal(pins.schema, 'meri-elements-ssr-toolchain/1'); assert.equal(pins.version, '0.28.2');
  const platform = process.platform + '-' + process.arch;
  assert.ok(platform === 'win32-x64' || platform === 'linux-x64');
  const selected = pins.tools.find(x => x.platform === platform); assert.ok(selected);
  const toolDir = join(realpathSync(toolRoot), platform), binary = join(toolDir, selected.binaryName);
  for (const [name, bytes, digest] of [['metadata.json', selected.metadataBytes, selected.metadataSha256], ['archive.tgz', selected.archiveBytes, selected.archiveSha256], [selected.binaryName, selected.binaryBytes, selected.binarySha256]]) {
    const raw = read(join(toolDir, name)); assert.equal(raw.length, bytes); assert.equal(hash(raw), digest);
  }
  const archive = read(join(toolDir, 'archive.tgz'));
  assert.equal('sha512-' + createHash('sha512').update(archive).digest('base64'), selected.archiveIntegrity);
  assert.equal(hash(read(join(toolDir, 'package.json'))), selected.packageJsonSha256);
  const before = sourceRecords(root), depRoot = realpathSync(join(root, 'node_modules'));
  mkdirSync(out); // Exclusive directory; esbuild can only create new outputs here.
  const version = spawnSync(binary, ['--version'], { env: { SystemRoot: process.env.SystemRoot ?? '', PATH: '' }, timeout: 5000, maxBuffer: 8192 });
  for (const name of ['stdout', 'stderr']) writeFileSync(join(out, 'version.' + name + '.bin'), version[name] ?? Buffer.alloc(0), { flag: 'wx' });
  assert.equal(version.status, 0); assert.equal(version.error, undefined); assert.equal(version.stdout.toString().trim(), pins.version);
  const env = { PATH: '', SystemRoot: process.env.SystemRoot ?? '', NODE_ENV: 'production', TZ: 'UTC' };
  const compile = dir => {
    const args = ['--bundle', '--platform=node', '--target=node24', '--format=cjs', '--jsx=automatic', '--tree-shaking=true', '--define:process.env.NODE_ENV="production"', '--alias:@repo/shadcn-ui=./vendor/shadcn-ui', '--sourcefile=ssr-entry.mjs', '--legal-comments=external', '--log-level=warning', '--outfile=' + join(dir, 'fixture.cjs'), '--metafile=' + join(dir, 'metafile.json')];
    const start = new Date().toISOString(), clock = performance.now();
    const result = spawnSync(binary, args, { cwd: root, env, input: ENTRY, timeout: 120000, maxBuffer: 512 * 1024 });
    for (const name of ['stdout', 'stderr']) writeFileSync(join(dir, 'build.' + name + '.bin'), result[name] ?? Buffer.alloc(0), { flag: 'wx' });
    const envelope = { argv: [binary, ...args], cwd: root, environmentKeys: Object.keys(env).sort(), startUtc: start, endUtc: new Date().toISOString(), durationMs: performance.now() - clock, timeoutMs: 120000, status: result.status, signal: result.signal, error: result.error?.code ?? null, shell: false, inputSha256: hash(Buffer.from(ENTRY)) };
    writeFileSync(join(dir, 'build.process.json'), JSON.stringify(envelope, null, 2) + '\n', { flag: 'wx' });
    assert.equal(result.error, undefined, 'build spawn failed'); assert.equal(result.signal, null); assert.equal(result.status, 0, 'build failed; binary evidence retained'); return envelope;
  };
  // Discovery compiles only: it never imports/evaluates the bundled application.
  const discoveryDir = join(out, 'discovery'); mkdirSync(discoveryDir);
  const discovery = compile(discoveryDir), discovered = JSON.parse(read(join(discoveryDir, 'metafile.json')));
  const inputs = inputBindings(root, depRoot, discovered, before), dependencyMap = new Map();
  for (const row of inputs.filter(x => x.dependency)) dependencyMap.set(row.path, record(row.path, read(join(depRoot, row.path))));
  const inventory = JSON.parse(read(join(root, 'component-pins.json'))).licenseInventory;
  assert.equal(inventory.length, 367, 'fixed resolver inventory');
  for (const item of inventory) {
    assert.ok(item.path.startsWith('node_modules/')); const rel = item.path.slice(13) + '/package.json';
    const row = record(rel, read(join(depRoot, rel))); assert.equal(row.sha256, item.packageJsonSha256, 'resolver metadata drift'); dependencyMap.set(rel, row);
  }
  const dependencies = [...dependencyMap.values()].sort((a, b) => a.path.localeCompare(b.path));
  assert.ok(dependencies.reduce((n, x) => n + x.bytes, 0) <= 256 * 1024 * 1024, 'finite input bytes bound');
  assert.deepEqual(sourceRecords(root), before, 'source changed during discovery'); assertRecords(depRoot, dependencies);
  // A fresh final compiler process consumes the frozen finite source/input set.
  const envelope = compile(out), metadata = JSON.parse(read(join(out, 'metafile.json')));
  assert.deepEqual(inputBindings(root, depRoot, metadata, before), inputs, 'final input set changed');
  assertRecords(depRoot, dependencies);
  assert.deepEqual(sourceRecords(root), before, 'source changed during build');
  assert.equal(hash(read(binary)), selected.binarySha256, 'tool drift');
  for (const [name, digest] of [['metadata.json', selected.metadataSha256], ['archive.tgz', selected.archiveSha256], ['package.json', selected.packageJsonSha256]]) assert.equal(hash(read(join(toolDir, name))), digest, 'tool artifact drift');
  const outputs = ['fixture.cjs', 'fixture.cjs.LEGAL.txt', 'metafile.json'].map(path => record(path, read(join(out, path))));
  const externalImports = Object.values(metadata.outputs).flatMap(x => x.imports).filter(x => x.external).map(x => x.path).sort();
  assert.ok(externalsAllowed(externalImports), 'unreviewed runtime external');
  const receipt = { schema: 'meri-elements-ssr-artifact/1', scope: 'Offline SSR fixture; not browser/product/G1 admission', node: { version: process.version, platform: process.platform, arch: process.arch }, tool: selected, entry: { text: ENTRY, sha256: hash(Buffer.from(ENTRY)) }, sources: before, inputs, dependencies, outputs, externalImports, discovery, build: envelope, resolverMetadataRecords: inventory.length };
  const raw = Buffer.from(JSON.stringify(receipt, null, 2) + '\n'), receiptPath = join(out, 'receipt.json');
  writeFileSync(receiptPath, raw, { flag: 'wx' });
  const expectedSha256 = hash(raw); verifySSRReceipt({ receiptPath, expectedSha256, packageRoot: root });
  return { receiptPath, expectedSha256, bundleBytes: outputs[0].bytes, inputCount: Object.keys(metadata.inputs).length, dependencyRecords: dependencies.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 4, 'usage: node ssr-build.mjs TOOL_ROOT NEW_OUTPUT_ROOT');
  console.log(JSON.stringify(buildSSR({ toolRoot: process.argv[2], outputRoot: process.argv[3] })));
}
