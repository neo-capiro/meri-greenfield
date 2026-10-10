// Finite offline integration checks. Temporary local Git copies only; no cloud/native/provider.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { COMPILER_PINS, SOURCE_REFERENCE, parseArgs, prepareNativeData } from './qualification/native_preparation.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GIT = 'C:/Program Files/Git/cmd/git.exe';
const sha = raw => createHash('sha256').update(raw).digest('hex');
const scratch = fs.mkdtempSync(join(tmpdir(), 'meri-native-preparation-'));
const repo = join(scratch, 'repo');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(GIT_|NODE_OPTIONS$)/i.test(key)));
Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: 'NUL', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' });
const clone = spawnSync(GIT, ['-c', 'core.hooksPath=NUL', 'clone', '--shared', '--no-checkout', '--quiet', ROOT, repo],
  { env, shell: false, timeout: 30000, maxBuffer: 2097152, windowsHide: true });
assert.equal(clone.status, 0, 'local Git fixture clone must succeed');
const toolRelative = 'scripts/qualification/native_preparation.mjs';
for (const path of [...COMPILER_PINS.map(p => p.path), toolRelative]) {
  fs.mkdirSync(dirname(join(repo, path)), { recursive: true }); fs.copyFileSync(join(ROOT, path), join(repo, path));
}
const tool = join(repo, toolRelative), original = new Map(COMPILER_PINS.map(p => [p.path, fs.readFileSync(join(repo, p.path))]));
const legacyRaw = fs.readFileSync(join(ROOT, '.task-inputs/W02-18-owner-inputs/static-pins.json'));
assert.equal(legacyRaw.length, 10904);
assert.equal(sha(legacyRaw), 'fc9f1beb1fc0e0c065abb9339ad4cfccc9a5b12591386064e113d128686591cc');
const canaryRaw = fs.readFileSync(join(ROOT, '.task-inputs/W02-19-owner-export-196e34dd-207d-48f6-8730-c8b2650b10a6/canary-input.json'));
assert.equal(sha(canaryRaw), 'cd6d1d598e33468bb776fac0c7325ddd2ea02b710f502ac0bf39e7d0e898cb39');
const native = JSON.parse(legacyRaw), canary = JSON.parse(canaryRaw).staticPins;
let sequence = 0;
function invoke(raw, profile = 'native', mode = 'cli', target = '') {
  const name = String(++sequence), input = join(scratch, `${name}-pins.json`), output = join(scratch, `${name}-out`);
  fs.writeFileSync(input, raw, { flag: 'wx' });
  let argv;
  if (mode === 'cli') argv = [tool, '--profile', profile, '--static-pins', input, '--output', output];
  else {
    // Real API invocation: synchronous reads finish before its first import await.
    // No production reader/import seam is supplied. The driver is a fresh process.
    const driver = join(scratch, `${name}-driver.mjs`);
    fs.writeFileSync(driver, `import * as fs from 'node:fs';\nimport {prepareNativeData} from ${JSON.stringify(pathToFileURL(tool).href)};\n` +
      `const pending=prepareNativeData(${JSON.stringify({ profile, staticPinsPath: input, outputDirectory: output })});\n` +
      `fs.appendFileSync(${JSON.stringify(mode === 'post-input' ? input : target)}, '\\n ');\n` +
      `try{await pending;process.exitCode=0;}catch{process.stderr.write('post-await refusal\\n');process.exitCode=1;}\n`, { flag: 'wx' });
    argv = [driver];
  }
  const result = spawnSync(process.execPath, argv, { env, shell: false, timeout: 30000, maxBuffer: 2097152, windowsHide: true });
  assert.equal(result.error, undefined, 'isolated process must complete within 30 seconds');
  assert.equal(result.signal, null);
  return { ...result, output, input };
}
function refused(result) {
  assert.equal(result.status, 1); assert.equal(fs.existsSync(result.output), false, 'no products on refusal');
}
function json(value) { return Buffer.from(JSON.stringify(value)); }
function sdkPins(pins) {
  const p = structuredClone(pins); p.wireProfile = 'ecs-sdk-pascal_ec2-pascal_sts-pascal_v2';
  const body = JSON.stringify({ profile: p.wireProfile, timestampEncoding: 'iso8601', listResult: { TaskArns: [] },
    describeResult: { Tasks: [], Failures: [] }, eniResult: { NetworkInterfaces: [] }, identityResult: { Account: p.account } });
  p.wireEvidence = { origin: 'OWNER_REVIEWED_ACTUAL_READ_ONLY_INTEGRATION', reference: 'synthetic:NOT_ACTUAL_AUTHORITY', version: 'fixture', body, sha256: sha(body) };
  return p;
}
function products(result) {
  assert.equal(result.status, 0, result.stderr.toString());
  assert.deepEqual(fs.readdirSync(result.output).sort(), ['binding.json', 'definition.json', 'manifest.json', 'static-pins.json', 'template.json']);
  const manifest = JSON.parse(fs.readFileSync(join(result.output, 'manifest.json')));
  assert.equal(manifest.schemaVersion, 'meri-native-preparation/2'); assert.equal(manifest.runtimeEnabled, false);
  assert.equal(manifest.sourceReference, SOURCE_REFERENCE); assert.equal(manifest.compilerRecords.length, 11);
  assert.deepEqual(manifest.sourceVerification.before.working, COMPILER_PINS);
  assert.deepEqual(manifest.sourceVerification.before.working, manifest.sourceVerification.after.working);
  assert.deepEqual(manifest.sourceVerification.before.git, manifest.sourceVerification.after.git);
  assert.deepEqual(manifest.executionClosure.before, manifest.executionClosure.after);
  assert.deepEqual(manifest.runtime.before, manifest.runtime.after);
  for (const phase of ['before', 'after']) {
    assert.equal(manifest.sourceVerification[phase].operations.length, 2);
    for (const op of manifest.sourceVerification[phase].operations) assert.equal(op.exitCode, 0);
  }
  for (const pin of manifest.files) {
    const raw = fs.readFileSync(join(result.output, pin.path)); assert.equal(raw.length, pin.bytes); assert.equal(sha(raw), pin.sha256);
  }
  const binding = JSON.parse(fs.readFileSync(join(result.output, 'binding.json')));
  const graph = JSON.parse(fs.readFileSync(join(result.output, 'definition.json')));
  const template = JSON.parse(fs.readFileSync(join(result.output, 'template.json')));
  assert.equal(binding.runtimeEnabled, false); assert.match(graph.States.GuardInput.Choices[0].Condition, /^\{% false and /);
  assert.equal(template.Metadata.runtimeEnabled, false); assert.deepEqual(template.Resources.NativeEnforcementMachine.Properties.Definition, graph);
  return { manifest, binding, graph, template };
}

test('legacy B raw products retain the three independently frozen hashes', () => {
  const result = invoke(legacyRaw), p = products(result);
  assert.equal(p.manifest.profile, 'native'); assert.deepEqual(fs.readFileSync(join(result.output, 'static-pins.json')), legacyRaw);
  for (const [path, digest] of [['binding.json', '9b9b77832b482e2d70f096326aa5c50cac60dbb1a37187bbb68cb6d20af654c1'],
    ['definition.json', '2c962d23a3ab42317e9b9d9ecd80c9d8eab7af6a7e9c59f46359de106f51eac3'],
    ['template.json', 'c2de9e540fb97dc0e3a3ea421eea768ee58212c8593f4d70462bbc8f9bc0818a']]) assert.equal(sha(fs.readFileSync(join(result.output, path))), digest);
});

test('legacy A fixture products retain the other three frozen hashes', async () => {
  const { fixturePins } = await import('./test-native-enforcement.mjs');
  const result = invoke(json(fixturePins())); products(result);
  for (const [path, digest] of [['binding.json', '19dfb84639bad374aa8e38c255512d1a1cc76eb0843c3d2d5929d8a4a4d671c5'],
    ['definition.json', '2c962d23a3ab42317e9b9d9ecd80c9d8eab7af6a7e9c59f46359de106f51eac3'],
    ['template.json', '6a8c3255737fc3d9dc0153241fd3af49ad7d186607f7a3d6b371d2881561b4c7']]) assert.equal(sha(fs.readFileSync(join(result.output, path))), digest);
});

test('native and canary SDK inputs remain inert even with an actual-origin label', () => {
  for (const [profile, p] of [['native', native], ['canary', canary]]) {
    const result = invoke(json(sdkPins(p)), profile), out = products(result);
    assert.equal(Object.keys(out.graph.States).length, 94); assert.equal(out.manifest.profile, profile);
    assert.equal(out.binding.pins.wireReference.origin, 'OWNER_REVIEWED_ACTUAL_READ_ONLY_INTEGRATION');
  }
});

test('role-free native output retains absent task roles and execution-only PassRole', () => {
  const p = sdkPins(native); p.workerRoleArn = null;
  for (const kind of ['sdk', 'office']) delete p.taskDefinitionPins[kind].taskRoleArn;
  const out = products(invoke(json(p)));
  const statement = out.template.Resources.NativeEnforcementRole.Properties.Policies[0].PolicyDocument.Statement.find(x => x.Action === 'iam:PassRole');
  assert.deepEqual(statement.Resource, [p.executionRoleArn]);
  for (const kind of ['sdk', 'office']) assert.equal(Object.hasOwn(out.binding.pins.taskDefinitionPins[kind], 'taskRoleArn'), false);
});

test('canary raw products exactly equal the original compiler public factory outputs', async () => {
  const out = invoke(json(canary), 'canary'); products(out);
  const app = await import('../infra/native-enforcement/app.mjs');
  const b = app.buildCanaryEnforcementAdmission({ staticPins: canary });
  for (const [path, expected] of [['binding.json', b], ['definition.json', app.buildCanaryEnforcementStateMachine(b)],
    ['template.json', app.buildCanaryEnforcementTemplate(b)]]) assert.deepEqual(fs.readFileSync(join(out.output, path)), json(expected));
});

for (const pin of COMPILER_PINS) {
  test('missing fixed compiler member refuses: ' + pin.path, () => {
    const path = join(repo, pin.path); fs.unlinkSync(path);
    try { refused(invoke(legacyRaw)); } finally { fs.writeFileSync(path, original.get(pin.path)); }
  });
  test('same-size drift refuses: ' + pin.path, () => {
    const path = join(repo, pin.path), bad = Buffer.from(original.get(pin.path)); bad[0] = bad[0] === 32 ? 9 : 32;
    fs.writeFileSync(path, bad);
    try { refused(invoke(legacyRaw)); } finally { fs.writeFileSync(path, original.get(pin.path)); }
  });
}

test('changed compiler code is refused before its top-level marker can execute', () => {
  const relative = COMPILER_PINS[0].path, path = join(repo, relative), marker = join(scratch, 'MUST-NOT-EXIST');
  fs.writeFileSync(path, `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(marker)},'executed');\n`);
  try { refused(invoke(legacyRaw)); assert.equal(fs.existsSync(marker), false); }
  finally { fs.writeFileSync(path, original.get(relative)); }
});

test('real post-await app and SDK-leaf drift cannot produce accepted products', () => {
  for (const relative of [COMPILER_PINS[0].path, COMPILER_PINS[10].path]) {
    try { refused(invoke(legacyRaw, 'native', 'post-source', join(repo, relative))); }
    finally { fs.writeFileSync(join(repo, relative), original.get(relative)); }
  }
});
test('real post-await raw static-input drift refuses', () => { refused(invoke(legacyRaw, 'native', 'post-input')); });

test('top-level, nested and escape-equivalent duplicate JSON names refuse', () => {
  for (const raw of [legacyRaw.toString().replace('{', '{"account":"shadow",'),
    legacyRaw.toString().replace(/"network"\s*:\s*\{/, '"network":{"vpcId":"shadow",'),
    legacyRaw.toString().replace('{', '{"acc\\u006funt":"shadow",')]) {
    assert.notEqual(raw, legacyRaw.toString()); refused(invoke(Buffer.from(raw)));
  }
});
test('malformed UTF8/JSON, BOM, non-finite and reserved object members refuse', () => {
  for (const raw of [Buffer.from([255]), Buffer.from('{'), Buffer.concat([Buffer.from([239,187,191]), legacyRaw]),
    Buffer.from('{"account":1e999}'), Buffer.from('{"__proto__":{}}')]) refused(invoke(raw));
});
test('cross-profile inputs and unknown profiles refuse without fallback', () => {
  refused(invoke(legacyRaw, 'canary')); refused(invoke(json(canary), 'native')); refused(invoke(legacyRaw, 'automatic'));
});
test('no execute toggle or arbitrary loader/reader/root option is accepted', async () => {
  for (const key of ['executeAdmitted', 'execute', 'sourceReader', 'importFunction', 'compilerPath', 'repoRoot']) {
    await assert.rejects(prepareNativeData({ profile: 'native', staticPinsPath: join(scratch, 'unused'), outputDirectory: join(scratch, 'unused-out'), [key]: true }), /exact inert/);
  }
  for (const argv of [[], ['--execute'], ['--profile', 'native', '--static-pins', '/x', '--execute', 'true'],
    ['--profile', 'native', '--profile', 'canary', '--output', '/x']]) assert.throws(() => parseArgs(argv));
});
test('existing output refuses and every existing byte is preserved', () => {
  const result = invoke(legacyRaw); products(result);
  const before = fs.readdirSync(result.output).map(path => [path, sha(fs.readFileSync(join(result.output, path)))]);
  const again = spawnSync(process.execPath, [tool, '--profile', 'native', '--static-pins', result.input, '--output', result.output],
    { env, shell: false, timeout: 30000, maxBuffer: 2097152, windowsHide: true });
  assert.equal(again.status, 1);
  assert.deepEqual(fs.readdirSync(result.output).map(path => [path, sha(fs.readFileSync(join(result.output, path)))]), before);
});
test('raw input maximum is enforced before compiler import', () => {
  refused(invoke(Buffer.alloc(16 * 1024 * 1024 + 1, 32)));
});
test('working source alone cannot substitute for the fixed Git reference', () => {
  const gitDirectory = join(repo, '.git'), held = join(scratch, 'git-held');
  fs.renameSync(gitDirectory, held);
  try { refused(invoke(legacyRaw)); } finally { fs.renameSync(held, gitDirectory); }
});

after(() => {
  for (const pin of COMPILER_PINS) assert.deepEqual(fs.readFileSync(join(repo, pin.path)), original.get(pin.path));
  assert.ok(resolve(scratch).startsWith(resolve(tmpdir()) + sep), 'cleanup target must remain within the OS temporary directory');
  fs.rmSync(scratch, { recursive: true, force: false });
});
