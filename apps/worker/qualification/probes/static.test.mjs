// W02-01 canonical OFFLINE qualification tests (`npm test` / `npm run check`).
//
// Deterministic and hermetic: no SDK query, browser, service, Docker,
// LibreOffice, provider request or cloud call. These tests exercise real
// boundaries only: exact package/lock/browser alignment, supported SDK
// configuration and observed opaque-session behavior, image non-root/writable/
// sandbox configuration, and failure/summary behavior.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  QUALIFICATION,
  buildQualificationOptions,
  assertInertOptions,
  assertSupportedCombination,
  createReferenceStore,
  verifyRestore,
  InMemorySessionStore,
} from '../sdk-options.mjs';
import { summarize, computeExitCode, parseStructuredOutput, classifyChildResult } from './runtime.mjs';
import { assessSandboxEvidence } from './browser.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const read = (rel) => readFileSync(join(PKG, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
const pins = readJson('component-pins.json');
const dockerfile = read('Dockerfile');
const requirements = read('requirements.lock.txt');
const sdkManifest = readJson('node_modules/@anthropic-ai/claude-agent-sdk/manifest.json');
const sdkTypes = read('node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts');
const browsers = readJson('node_modules/playwright-core/browsers.json');

// ---------------------------------------------------------------------------
// Exact package / lock / component alignment
// ---------------------------------------------------------------------------

test('package.json pins the exact qualification dependency versions', () => {
  assert.deepEqual(pkg.dependencies, {
    '@anthropic-ai/claude-agent-sdk': '0.3.295',
    '@modelcontextprotocol/sdk': '1.32.1',
    '@playwright/mcp': '0.0.83',
    'pdfjs-dist': '6.4.299',
    playwright: '1.64.0-alpha-1790635538000',
    'playwright-core': '1.64.0-alpha-1790635538000',
    pptxgenjs: '4.0.1',
  });
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, 'module');
});

test('package-lock.json locks the same exact versions with integrity', () => {
  for (const [name, version] of Object.entries(pkg.dependencies)) {
    const entry = lock.packages[`node_modules/${name}`];
    assert.ok(entry, `lock missing ${name}`);
    assert.equal(entry.version, version, `${name} lock version`);
    assert.match(entry.integrity || '', /^sha512-/, `${name} integrity`);
  }
});

test('component-pins.json agrees with package.json, lock and tests', () => {
  assert.equal(pins.assembledImageDigest, null, 'image digest must stay unbuilt');
  const npmByName = Object.fromEntries(pins.npm.map((p) => [p.name, p]));
  for (const [name, version] of Object.entries(pkg.dependencies)) {
    assert.equal(npmByName[name].version, version, `${name} pins version`);
    assert.match(npmByName[name].integrity, /^sha512-/, `${name} pins integrity`);
    assert.ok(npmByName[name].license, `${name} license recorded`);
  }
  assert.equal(npmByName['@anthropic-ai/claude-agent-sdk'].bundledCli.version, '2.1.295');
  assert.equal(pins.chromium.revision, '1247');
  assert.equal(pins.chromium.browserVersion, '155.0.8059.12');
});

test('SDK bundle manifest declares CLI 2.1.295 and the pinned linux-x64 checksum', () => {
  assert.equal(sdkManifest.version, '2.1.295');
  const sdkPin = pins.npm.find((p) => p.name === '@anthropic-ai/claude-agent-sdk');
  assert.equal(sdkManifest.platforms['linux-x64'].checksum, sdkPin.bundledCli.linuxX64BinaryChecksum);
  assert.equal(sdkManifest.platforms['linux-x64'].size, sdkPin.bundledCli.linuxX64BinarySize);
});

test('playwright-core maps Chromium revision 1247 to version 155.0.8059.12', () => {
  const chromium = browsers.browsers.find((b) => b.name === 'chromium');
  assert.equal(chromium.revision, '1247');
  assert.equal(chromium.browserVersion, '155.0.8059.12');
});

test('requirements.lock.txt pins the four direct Python libraries and transitives with hashes', () => {
  for (const [name, version] of [['python-docx', '1.2.0'], ['XlsxWriter', '3.2.9'], ['openpyxl', '3.1.5'], ['pypdf', '6.20.0']]) {
    assert.match(requirements, new RegExp(`^${name}==${version.replace('.', '\\.')} --hash=sha256:[a-f0-9]{64}$`, 'm'));
  }
  for (const name of ['lxml', 'et_xmlfile', 'typing_extensions']) {
    assert.match(requirements, new RegExp(`^${name}==`, 'm'));
  }
});

test('published sdk.d.ts declares the supported configuration fields (not hypothetical APIs)', () => {
  assert.match(sdkTypes, /settingSources\?: SettingSource\[\];/);
  assert.match(sdkTypes, /skills\?: string\[\] \| 'all';/);
  assert.match(sdkTypes, /autoMemoryEnabled\?: boolean;/);
  assert.match(sdkTypes, /persistSession\?: boolean;/);
  assert.match(sdkTypes, /enableFileCheckpointing\?: boolean;/);
  assert.match(sdkTypes, /sessionStore\?: SessionStore;/);
  assert.match(sdkTypes, /export declare type SessionStore = \{/);
});

// ---------------------------------------------------------------------------
// SDK options builder: explicit and inert
// ---------------------------------------------------------------------------

test('buildQualificationOptions produces the explicit inert options', () => {
  assert.deepEqual(buildQualificationOptions(), {
    cwd: '/workspace/conversation',
    settingSources: [],
    settings: { autoMemoryEnabled: false },
    skills: [],
  });
});

test('options builder rejects overrides that re-enable discovery or move cwd', () => {
  assert.throws(() => buildQualificationOptions({ settingSources: ['user'] }), /rejected/);
  assert.throws(() => buildQualificationOptions({ skills: ['pdf'] }), /rejected/);
  assert.throws(() => buildQualificationOptions({ cwd: '/tmp' }), /rejected/);
  assert.throws(() => buildQualificationOptions({ settings: { autoMemoryEnabled: true } }), /rejected/);
});

test('assertInertOptions fails closed on non-inert option sets', () => {
  assert.throws(() => assertInertOptions({ cwd: '/tmp', settingSources: [], settings: { autoMemoryEnabled: false }, skills: [] }), /stable cwd/);
  assert.throws(() => assertInertOptions({ cwd: QUALIFICATION.cwd, settingSources: ['local'], settings: { autoMemoryEnabled: false }, skills: [] }), /settingSources/);
  assert.throws(() => assertInertOptions({ cwd: QUALIFICATION.cwd, settingSources: [], settings: { autoMemoryEnabled: true }, skills: [] }), /autoMemoryEnabled/);
  assert.throws(() => assertInertOptions({ cwd: QUALIFICATION.cwd, settingSources: [], settings: { autoMemoryEnabled: false }, skills: ['x'] }), /skills/);
});

test('options builder refuses unsupported SessionStore combinations', () => {
  const store = createReferenceStore();
  assert.throws(() => buildQualificationOptions({ sessionStore: store, persistSession: false }), /persistSession/);
  assert.throws(() => buildQualificationOptions({ sessionStore: store, enableFileCheckpointing: true }), /enableFileCheckpointing/);
  assert.doesNotThrow(() => assertSupportedCombination({ sessionStore: store }));
  const withStore = buildQualificationOptions({ sessionStore: store });
  assert.equal(withStore.sessionStore, store);
});

// ---------------------------------------------------------------------------
// Opaque session store behavior (actual pinned upstream store)
// ---------------------------------------------------------------------------

const KEY = { projectKey: 'projA', sessionId: 'sess-1' };

test('reference store load of a missing session returns null', async () => {
  const store = createReferenceStore();
  assert.equal(await store.load(KEY), null);
});

test('reference store retains opaque entries and their unknown fields unchanged', async () => {
  const store = createReferenceStore();
  const entry = { type: 'user', uuid: 'u1', timestamp: 't1', extra: { keep: [1, 2, 3] } };
  await store.append(KEY, [entry]);
  assert.deepEqual(store.getEntries(KEY), [entry]);
});

test('reference store accepts and retains UUID-less entries', async () => {
  const store = createReferenceStore();
  await store.append(KEY, [{ type: 'system', note: 'no-uuid' }]);
  assert.deepEqual(store.getEntries(KEY), [{ type: 'system', note: 'no-uuid' }]);
});

test('reference store separates the main transcript from subagent subkeys', async () => {
  const store = createReferenceStore();
  await store.append(KEY, [{ type: 'user', uuid: 'main-1' }]);
  await store.append({ ...KEY, subpath: 'subagents/agent-x' }, [{ type: 'user', uuid: 'sub-1' }]);
  assert.deepEqual(await store.listSubkeys({ projectKey: 'projA', sessionId: 'sess-1' }), ['subagents/agent-x']);
  assert.deepEqual(store.getEntries(KEY).map((e) => e.uuid), ['main-1']);
  assert.deepEqual((await store.load({ ...KEY, subpath: 'subagents/agent-x' })).map((e) => e.uuid), ['sub-1']);
});

test('reference store separates project and session scopes', async () => {
  const store = createReferenceStore();
  await store.append(KEY, [{ type: 'user', uuid: 'a' }]);
  assert.equal(await store.load({ projectKey: 'projB', sessionId: 'sess-1' }), null);
  assert.equal(await store.load({ projectKey: 'projA', sessionId: 'sess-2' }), null);
});

test('OBSERVED: InMemorySessionStore does not deduplicate repeated UUIDs (upstream guarantee NOT assumed)', async () => {
  const store = createReferenceStore();
  const entry = { type: 'user', uuid: 'dup', timestamp: 't' };
  await store.append(KEY, [entry]);
  await store.append(KEY, [{ ...entry }]);
  assert.equal(store.getEntries(KEY).length, 2, 'reference store append is pass-through, not upsert');
  // A production durable adapter must deduplicate separately and is out of scope.
});

// ---------------------------------------------------------------------------
// Restore verification must fail closed on any mismatch
// ---------------------------------------------------------------------------

test('verifyRestore succeeds on exact ordered opaque-entry equality', async () => {
  const store = createReferenceStore();
  const entries = [{ type: 'user', uuid: 'u1', extra: 1 }, { type: 'system', note: 'no-uuid' }];
  await store.append(KEY, entries);
  assert.deepEqual(await verifyRestore(store, KEY, entries), entries);
});

test('verifyRestore fails closed when expected state is absent', async () => {
  const store = createReferenceStore();
  await assert.rejects(() => verifyRestore(store, KEY, [{ type: 'user', uuid: 'u1' }]), /no session state/);
});

test('verifyRestore fails when an opaque unknown field changed', async () => {
  const store = createReferenceStore();
  await store.append(KEY, [{ type: 'user', uuid: 'u1', extra: 'a' }]);
  await assert.rejects(() => verifyRestore(store, KEY, [{ type: 'user', uuid: 'u1', extra: 'b' }]), /opaque bytes/);
});

test('verifyRestore fails when a duplicate or UUID-less entry is missing', async () => {
  const store = createReferenceStore();
  const entry = { type: 'user', uuid: 'u1' };
  await store.append(KEY, [entry]);
  await assert.rejects(() => verifyRestore(store, KEY, [entry, entry]), /entry count/);
  await assert.rejects(() => verifyRestore(store, KEY, [{ type: 'system', note: 'x' }]), /opaque bytes/);
});

// ---------------------------------------------------------------------------
// Browser sandbox verdict: reject weak or non-process evidence
// ---------------------------------------------------------------------------

const REAL_SANDBOX_PAGE = [
  'Sandbox Status',
  'Layer 1 Sandbox: Yes',
  'Namespace Sandbox: Yes',
  'PID Namespace: Yes',
  'Net Namespace: Yes',
  'Seccomp-BPF: Yes',
].join('\n');

test('sandbox verdict requires affirmative namespace/SUID AND seccomp layers', () => {
  assert.equal(assessSandboxEvidence({}).ok, false);
  assert.equal(assessSandboxEvidence({ sandboxPageText: 'sandbox', effectiveFlags: ['--headless'], effectiveFlagsSource: 'proc' }).ok, false);
  assert.equal(assessSandboxEvidence({ sandboxPageText: 'yes', effectiveFlags: ['--headless'], effectiveFlagsSource: 'proc' }).ok, false);
  assert.equal(assessSandboxEvidence({ sandboxPageText: 'namespace', effectiveFlags: ['--headless'], effectiveFlagsSource: 'proc' }).ok, false);
});

test('sandbox verdict rejects all-No table text', () => {
  const allNo = 'Namespace Sandbox: No\nSeccomp-BPF: No\nPID Namespace: No';
  assert.equal(assessSandboxEvidence({ sandboxPageText: allNo, effectiveFlags: ['--headless'], effectiveFlagsSource: 'proc' }).ok, false);
});

test('sandbox verdict rejects config-only (non-process) effective flags', () => {
  const v = assessSandboxEvidence({ sandboxPageText: REAL_SANDBOX_PAGE, effectiveFlags: ['--headless'], effectiveFlagsSource: 'config' });
  assert.equal(v.ok, false);
  assert.ok(v.reasons.some((r) => /not actual process/.test(r)));
});

test('sandbox verdict rejects absent flags and disabling flags', () => {
  assert.equal(assessSandboxEvidence({ sandboxPageText: REAL_SANDBOX_PAGE, effectiveFlags: [], effectiveFlagsSource: 'proc' }).ok, false);
  assert.equal(assessSandboxEvidence({ sandboxPageText: REAL_SANDBOX_PAGE, effectiveFlags: ['--no-sandbox'], effectiveFlagsSource: 'proc' }).ok, false);
  assert.equal(assessSandboxEvidence({ sandboxPageText: REAL_SANDBOX_PAGE, effectiveFlags: ['--disable-seccomp-filter-sandbox'], effectiveFlagsSource: 'proc' }).ok, false);
});

test('sandbox verdict accepts a real affirmative table with complete process flags', () => {
  const v = assessSandboxEvidence({ sandboxPageText: REAL_SANDBOX_PAGE, effectiveFlags: ['--headless', '--enable-features=Foo'], effectiveFlagsSource: 'proc' });
  assert.equal(v.ok, true, v.reasons.join('; '));
});

// ---------------------------------------------------------------------------
// Child-output parsing, classification and summary behavior
// ---------------------------------------------------------------------------

test('parseStructuredOutput parses complete pretty multi-line JSON', () => {
  const pretty = JSON.stringify({ probe: 'x', ok: true, nested: { a: 1 } }, null, 2);
  assert.deepEqual(parseStructuredOutput(pretty).value, { probe: 'x', ok: true, nested: { a: 1 } });
  assert.deepEqual(parseStructuredOutput(`  ${pretty}\n`).value, { probe: 'x', ok: true, nested: { a: 1 } });
});

test('parseStructuredOutput fails closed on malformed, missing, noisy or non-object output', () => {
  assert.equal(parseStructuredOutput('').ok, false);
  assert.equal(parseStructuredOutput('not json at all').ok, false);
  assert.equal(parseStructuredOutput('{ broken').ok, false); // regression: malformed opening brace must not loop
  assert.equal(parseStructuredOutput('{ broken }').ok, false);
  assert.equal(parseStructuredOutput('log line\n{"ok":true}').ok, false); // prefix noise
  assert.equal(parseStructuredOutput('{"ok":true}\ntrailing log').ok, false); // suffix noise
  assert.equal(parseStructuredOutput('[1,2,3]').ok, false); // non-object
  assert.equal(parseStructuredOutput('42').ok, false);
});

test('classifyChildResult refuses a nested ok:true inside an outer failed verdict', () => {
  assert.equal(classifyChildResult({ status: 0, stdout: JSON.stringify({ probe: 'x', ok: false, nested: { ok: true } }) }).status, 'fail');
  assert.equal(classifyChildResult({ status: 0, stdout: JSON.stringify({ probe: 'x', ok: false, reasons: ['nope'], nested: { ok: true } }, null, 2) }).status, 'fail');
});

test('classifyChildResult fails on nonzero status, missing verdict and timeout', () => {
  assert.equal(classifyChildResult({ status: 1, stdout: '{"ok":true}' }).status, 'fail');
  assert.equal(classifyChildResult({ status: 0, stdout: 'garbage' }).status, 'fail');
  assert.equal(classifyChildResult({ status: 0, stdout: '{"ok":false,"reasons":["x"]}' }).status, 'fail');
  assert.equal(classifyChildResult({ status: 0, timedOut: true, stdout: '{"ok":true}' }).status, 'fail');
  assert.equal(classifyChildResult({ status: 0, stdout: '{"ok":true}' }).status, 'pass');
});

test('summarize/computeExitCode treat a required skipped or failed check as not-ok', () => {
  const skippedRequired = summarize([{ name: 'a', required: true, status: 'skipped' }]);
  assert.equal(skippedRequired.ok, false);
  assert.equal(computeExitCode(skippedRequired), 1);
  const failed = summarize([{ name: 'a', required: true, status: 'pass' }, { name: 'b', required: true, status: 'fail' }]);
  assert.deepEqual(failed.requiredFailed, ['b']);
  assert.equal(computeExitCode(failed), 1);
  const okOptionalSkipped = summarize([{ name: 'a', required: true, status: 'pass' }, { name: 'b', required: false, status: 'skipped' }]);
  assert.equal(okOptionalSkipped.ok, true);
  assert.equal(computeExitCode(okOptionalSkipped), 0);
});

// ---------------------------------------------------------------------------
// Image recipe configuration (non-root, writable paths, sandbox, pins)
// ---------------------------------------------------------------------------

test('Dockerfile pins an immutable base digest and non-root UID/GID 10001', () => {
  assert.match(dockerfile, /^FROM node:24\.9\.0-bookworm-slim@sha256:[a-f0-9]{64}$/m);
  assert.match(dockerfile, /^USER 10001:10001$/m);
  assert.match(dockerfile, /groupadd --gid 10001 meri/);
  assert.match(dockerfile, /useradd --uid 10001 --gid 10001/);
});

test('Dockerfile declares the writable mount points and read-only-root expectation', () => {
  assert.match(dockerfile, /^VOLUME \["\/workspace", "\/tmp"\]$/m);
  assert.match(dockerfile, /chown -R 10001:10001 \/workspace \/tmp/);
  assert.match(dockerfile, /readOnlyRootFilesystem=true/);
  assert.match(dockerfile, /CHROMIUM_SANDBOX_REQUIRED=true/);
});

test('Dockerfile pins Debian repositories to the snapshot with signature verification', () => {
  assert.match(dockerfile, /snapshot\.debian\.org\/archive\/debian\/20260901T000000Z/);
  assert.match(dockerfile, /snapshot\.debian\.org\/archive\/debian-security\/20260901T000000Z/);
  assert.match(dockerfile, /Signed-By: \/usr\/share\/keyrings\/debian-archive-keyring\.gpg/);
});

test('Dockerfile performs one locked npm install with optional binaries and no fallback', () => {
  assert.match(dockerfile, /npm ci --no-audit --no-fund --include=optional/);
  assert.doesNotMatch(dockerfile, /\|\|\s*npm ci/);
  assert.doesNotMatch(dockerfile, /--omit=dev/);
});

test('Dockerfile installs the matched browser via the adopted Playwright CLI and keeps the sandbox', () => {
  assert.match(dockerfile, /node node_modules\/playwright\/cli\.js install chromium/);
  assert.match(dockerfile, /chmod 4755 "\$sb"/);
  assert.doesNotMatch(dockerfile, /--no-sandbox/);
  assert.doesNotMatch(dockerfile, /--privileged/);
  assert.doesNotMatch(dockerfile, /docker\.sock/);
});

test('component-pins.json records resolved OS/snapshot versions and unresolved pins none remain for base', () => {
  assert.equal(pins.baseImage.reference, 'node:24.9.0-bookworm-slim');
  assert.match(pins.baseImage.indexDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(pins.osPackages.snapshotTimestamp, '20260901T000000Z');
  assert.ok(pins.osPackages.resolved['libreoffice-core']);
  assert.ok(pins.osPackages.resolved['libnss3']);
  assert.equal(pins.osPackages.status, 'RESOLVED-FROM-SNAPSHOT');
});

test('the SDK reference store is the actual pinned upstream export', () => {
  assert.equal(typeof InMemorySessionStore, 'function');
  assert.ok(createReferenceStore() instanceof InMemorySessionStore);
});
