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
import { summarize, computeExitCode, parseStructuredOutput, classifyChildResult, classifyNetworkResults, addressIn10_80 } from './runtime.mjs';
import { assessSandboxEvidence, parseSandboxRows, extractResultSection, decodeToolResult, identifyAssociatedChromium, scanDisablingFlags } from './browser.mjs';
import { classifySubprocess, decideNative, decideRecalc, decideRender } from './artifacts.mjs';

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
// Exact chrome://sandbox rows and /proc Chromium process evidence
// ---------------------------------------------------------------------------

const SANDBOX_ROWS_OK = [
  ['Layer 1 Sandbox', 'Namespace'],
  ['PID namespaces', 'Yes'],
  ['Network namespaces', 'Yes'],
  ['Seccomp-BPF sandbox', 'Yes'],
  ['Seccomp-BPF sandbox supports TSYNC', 'Yes'],
];
const SANDBOX_OK = { text: 'Sandbox Status', rows: SANDBOX_ROWS_OK, evaluation: 'Sandbox is enabled' };

const BROWSERS_ROOT = '/opt/meri-browsers';
const RUN_PROFILE = '/workspace/qualification-browser/probe-x/profile';
const CHROME_EXE = `${BROWSERS_ROOT}/chromium-1247/chrome-linux64/chrome`;
const PROC_TREE = [
  { pid: 10, ppid: 1, exe: '/usr/local/bin/node', type: 'browser', argv: ['node', 'cli.js', '--browser', 'chromium'] },
  { pid: 100, ppid: 10, exe: CHROME_EXE, type: 'browser', argv: [CHROME_EXE, '--headless', `--user-data-dir=${RUN_PROFILE}`, '--enable-features=Foo'] },
  { pid: 101, ppid: 100, exe: CHROME_EXE, type: 'renderer', argv: [CHROME_EXE, '--type=renderer', `--user-data-dir=${RUN_PROFILE}`] },
  { pid: 200, ppid: 1, exe: CHROME_EXE, type: 'browser', argv: [CHROME_EXE, '--headless', '--user-data-dir=/other/profile'] },
];

test('process identification rejects the MCP Node launcher and unrelated profiles', () => {
  const { browser, renderer, browsers } = identifyAssociatedChromium(PROC_TREE, { browsersRoot: BROWSERS_ROOT, profileDir: RUN_PROFILE });
  assert.equal(browser.pid, 100); // node pid 10 rejected by /proc exe
  assert.equal(renderer.pid, 101); // renderer via real PPid ancestry to 100
  assert.equal(browsers.length, 1); // /other/profile chrome not associated
  assert.equal(identifyAssociatedChromium([PROC_TREE[0]], { browsersRoot: BROWSERS_ROOT, profileDir: RUN_PROFILE }).browser, null); // node only
});

test('process identification requires an associated renderer and the exact run profile', () => {
  const noRenderer = PROC_TREE.filter((p) => p.type !== 'renderer');
  assert.equal(identifyAssociatedChromium(noRenderer, { browsersRoot: BROWSERS_ROOT, profileDir: RUN_PROFILE }).renderer, null);
  assert.equal(identifyAssociatedChromium(PROC_TREE, { browsersRoot: BROWSERS_ROOT, profileDir: '/nonexistent' }).browser, null);
});

test('sandbox verdict accepts Layer 1 Namespace + Seccomp-BPF Yes with an actual browser and renderer', () => {
  const { browser, renderer } = identifyAssociatedChromium(PROC_TREE, { browsersRoot: BROWSERS_ROOT, profileDir: RUN_PROFILE });
  const v = assessSandboxEvidence({ sandbox: SANDBOX_OK, browser, renderer });
  assert.equal(v.ok, true, v.reasons.join('; '));
});

test('sandbox verdict accepts Layer 1 SUID and rejects None/missing/ambiguous/No', () => {
  const rows = (l1, s) => [['Layer 1 Sandbox', l1], ['Seccomp-BPF sandbox', s]];
  const { browser, renderer } = identifyAssociatedChromium(PROC_TREE, { browsersRoot: BROWSERS_ROOT, profileDir: RUN_PROFILE });
  assert.equal(assessSandboxEvidence({ sandbox: { rows: rows('SUID', 'Yes') }, browser, renderer }).ok, true);
  assert.equal(assessSandboxEvidence({ sandbox: { rows: rows('None', 'Yes') }, browser, renderer }).ok, false);
  assert.equal(assessSandboxEvidence({ sandbox: { rows: rows('Namespace', 'No') }, browser, renderer }).ok, false);
  assert.equal(assessSandboxEvidence({ sandbox: { rows: [['Seccomp-BPF sandbox', 'Yes']] }, browser, renderer }).ok, false);
  assert.equal(assessSandboxEvidence({ sandbox: { rows: [['Layer 1 Sandbox', 'Namespace'], ['Seccomp-BPF sandbox', 'Maybe']] }, browser, renderer }).ok, false);
});

test('sandbox verdict rejects missing evidence, generic prose or a missing renderer', () => {
  const { browser } = identifyAssociatedChromium(PROC_TREE, { browsersRoot: BROWSERS_ROOT, profileDir: RUN_PROFILE });
  assert.equal(assessSandboxEvidence({}).ok, false);
  assert.equal(assessSandboxEvidence({ sandbox: { text: 'sandbox yes' }, browser, renderer: null }).ok, false);
  assert.equal(assessSandboxEvidence({ sandbox: SANDBOX_OK, browser, renderer: null }).ok, false);
  assert.equal(assessSandboxEvidence({ sandbox: SANDBOX_OK, browser: null, renderer: null }).ok, false);
});

test('sandbox rows: unknown labels ignored, duplicates and unexpected values ambiguous', () => {
  assert.deepEqual(parseSandboxRows(SANDBOX_ROWS_OK).found, { layer1: 'Namespace', pidNs: 'Yes', netNs: 'Yes', seccomp: 'Yes', tsync: 'Yes' });
  assert.deepEqual(parseSandboxRows(SANDBOX_ROWS_OK).ambiguous, []);
  assert.deepEqual(parseSandboxRows([['Ptrace Protection with Yama LSM (Broker)', 'Yes']]).found, {});
  assert.ok(parseSandboxRows([['Layer 1 Sandbox', 'Namespace'], ['Layer 1 Sandbox', 'None']]).ambiguous.length > 0);
  assert.ok(parseSandboxRows([['Seccomp-BPF sandbox', 'Maybe']]).ambiguous.length > 0);
  assert.ok(parseSandboxRows([['Layer 1 Sandbox', 'Bogus']]).ambiguous.length > 0);
});

test('disabling flags are detected anywhere in any process argv', () => {
  assert.equal(scanDisablingFlags(PROC_TREE).length, 0);
  for (const flag of ['--no-sandbox', '--disable-namespace-sandbox', '--disable-seccomp-filter-sandbox']) {
    assert.equal(scanDisablingFlags([{ pid: 9, type: 'renderer', argv: ['chrome', flag, '--type=renderer'] }]).length, 1, flag);
  }
});

// ---------------------------------------------------------------------------
// MCP Result-section parser (real framing)
// ---------------------------------------------------------------------------

const SANDBOX_OBJECT = {
  text: 'Sandbox Status\nLayer 1 Sandbox\tNamespace\nSeccomp-BPF sandbox\tYes',
  rows: [['Layer 1 Sandbox', 'Namespace'], ['Seccomp-BPF sandbox', 'Yes']],
  evaluation: 'Sandbox is enabled',
};
const FRAME_OK = [
  '### Ran Playwright code',
  '```js',
  'await page.evaluate(() => ({ text: document.body.innerText, rows: [] }));',
  '```',
  '### Result',
  JSON.stringify(SANDBOX_OBJECT),
].join('\n');

test('extractResultSection decodes the exact Result section (two-cell object with escaped newlines)', () => {
  const r = extractResultSection(FRAME_OK);
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.value, SANDBOX_OBJECT);
  assert.equal(r.value.rows[0][0], 'Layer 1 Sandbox');
  assert.match(r.raw, /### Ran Playwright code/);
});

test('extractResultSection decodes multi-line pretty JSON Result', () => {
  const frame = ['### Ran Playwright code', 'x', '### Result', '{\n  "browser": {\n    "launchOptions": { "chromiumSandbox": true }\n  }\n}'].join('\n');
  const r = extractResultSection(frame);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.value.browser.launchOptions.chromiumSandbox, true);
});

test('extractResultSection fails closed on missing, duplicate, empty, error or malformed Result', () => {
  assert.equal(extractResultSection('### Ran Playwright code\nx').ok, false);
  assert.equal(extractResultSection('### Result\n1\n### Result\n2').ok, false);
  assert.equal(extractResultSection('### Result\n\n### Ran Playwright code\nx').ok, false);
  assert.equal(extractResultSection('### Error\nboom').ok, false);
  assert.equal(extractResultSection('### Result\n{ not json }').ok, false);
});

test('decodeToolResult prefers structuredContent over the Result section', () => {
  const r = decodeToolResult({ structuredContent: { result: { x: 1 } }, content: [{ type: 'text', text: '### Result\n2' }] });
  assert.equal(r.source, 'structuredContent');
  assert.deepEqual(r.value, { x: 1 });
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
  assert.match(dockerfile, /^FROM node:24\.21\.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20$/m);
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

test('Dockerfile pins Debian repositories to the snapshot with signature verification and Check-Valid-Until disabled', () => {
  assert.match(dockerfile, /snapshot\.debian\.org\/archive\/debian\/20261009T000000Z/);
  assert.match(dockerfile, /snapshot\.debian\.org\/archive\/debian-security\/20261009T000000Z/);
  assert.match(dockerfile, /Signed-By: \/usr\/share\/keyrings\/debian-archive-keyring\.gpg/);
  assert.match(dockerfile, /Check-Valid-Until: no/);
  assert.doesNotMatch(dockerfile, /trusted=yes/);
  assert.doesNotMatch(dockerfile, /allow-unauthenticated|AllowUnauthenticated/);
});

test('Dockerfile bootstraps ca-certificates over HTTP then switches to HTTPS with a pinned CA version', () => {
  assert.match(dockerfile, /URIs: http:\/\/snapshot\.debian\.org\/archive\/debian\/20261009T000000Z/);
  assert.match(dockerfile, /URIs: https:\/\/snapshot\.debian\.org\/archive\/debian\/20261009T000000Z/);
  assert.match(dockerfile, /ca-certificates=20250419~deb12u1/);
});

test('Dockerfile keeps the browser tree root-owned and asserts the setuid helper after ownership ops', () => {
  assert.match(dockerfile, /stat -c '%U' "\$sb"/);
  assert.match(dockerfile, /stat -c '%a' "\$sb"/);
  assert.match(dockerfile, /chown -R 10001:10001 \/workspace \/tmp \/opt\/meri-worker/);
  assert.doesNotMatch(dockerfile, /chown[^\n]*\/opt\/meri-browsers/);
});

test('Dockerfile performs one locked npm install with optional binaries and no fallback', () => {
  assert.match(dockerfile, /npm ci --no-audit --no-fund --include=optional/);
  assert.doesNotMatch(dockerfile, /\|\|\s*npm ci/);
  assert.doesNotMatch(dockerfile, /--omit=dev/);
});

test('Dockerfile installs the matched CfT browser via the adopted Playwright CLI and keeps the sandbox helper', () => {
  assert.match(dockerfile, /node node_modules\/playwright\/cli\.js install chromium/);
  assert.match(dockerfile, /-name chrome_sandbox/);
  assert.match(dockerfile, /chmod 4755 "\$sb"/);
  assert.match(dockerfile, /chrome-linux64/);
  assert.doesNotMatch(dockerfile, /--no-sandbox/);
  assert.doesNotMatch(dockerfile, /--privileged/);
  assert.doesNotMatch(dockerfile, /docker\.sock/);
});

test('component-pins.json records the inspected CfT archive, sha256 and helper path', () => {
  assert.equal(pins.chromium.browserVersion, '155.0.8059.12');
  assert.equal(pins.chromium.archiveFile, 'chrome-linux64.zip');
  assert.match(pins.chromium.archiveSha256, /^[a-f0-9]{64}$/);
  assert.match(pins.chromium.downloadPath, /builds\/cft\/155\.0\.8059\.12\/linux64\/chrome-linux64\.zip/);
  assert.match(pins.chromium.sandboxHelper, /chrome_sandbox/);
  assert.match(pins.chromium.extractedExecutable, /chrome-linux64\/chrome$/);
});

test('component-pins.json records resolved OS/snapshot versions and unresolved pins none remain for base', () => {
  assert.equal(pins.baseImage.reference, 'node:24.21.0-bookworm-slim');
  assert.equal(pins.baseImage.nodeVersion, '24.21.0');
  assert.match(pins.baseImage.indexDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(pins.osPackages.snapshotTimestamp, '20261009T000000Z');
  assert.ok(pins.osPackages.resolved['libreoffice-core']);
  assert.ok(pins.osPackages.resolved['libnss3']);
  assert.equal(pins.osPackages.resolved['ca-certificates'], '20250419~deb12u1');
  assert.equal(pins.osPackages.resolved['libnss3'], '2:3.87.1-1+deb12u4');
  assert.equal(pins.osPackages.status, 'RESOLVED-FROM-SNAPSHOT-REFRESHED-UNBUILT');
});

test('Dockerfile OS package pins match the component-pins resolved versions (no drift)', () => {
  for (const p of ['ca-certificates', 'poppler-utils', 'libnss3', 'libexpat1', 'libreoffice-core', 'python3']) {
    assert.ok(dockerfile.includes(`${p}=${pins.osPackages.resolved[p]}`), `Dockerfile pin for ${p}`);
  }
  // The security-updated poppler set is the coherent fix for the first build failure.
  assert.equal(pins.osPackages.resolved['poppler-utils'], '22.12.0-2+deb12u3');
  assert.ok(pins.osPackages.firstBuildFailure);
});

test('Dockerfile refreshes inherited packages and records build-time evidence', () => {
  assert.ok(dockerfile.includes('apt-get -y --no-remove dist-upgrade'), 'no-removal bounded upgrade');
  assert.ok(dockerfile.includes('os-installed-packages.txt'), 'dpkg inventory');
  assert.ok(dockerfile.includes('runtime-versions.txt'), 'runtime versions');
  assert.ok(dockerfile.includes('claude-agent-sdk-linux-x64/claude'), 'SDK binary path');
  assert.ok(dockerfile.includes('4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358'), 'SDK binary checksum');
  assert.ok(dockerfile.includes('cft-hashes.txt'), 'CFT hash evidence');
});

test('component-pins.json distinguishes the prior built candidate from the unbuilt refresh', () => {
  assert.equal(pins.assembledImageDigest, null);
  assert.match(pins.priorBuiltCandidate.digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(pins.priorBuiltCandidate.ecrScan.critical, 12);
  assert.ok(pins.priorBuiltCandidate.buildId);
  assert.ok(pins.priorBuiltCandidate.sourceRecipeCommit);
  assert.ok(pins.osPackages.securityFindings.scan.includes('12 CRITICAL'));
  assert.ok(pins.osPackages.securityFindings.remainingOpen['CVE-2026-95210']);
  assert.ok(pins.osPackages.securityFindings.remainingOpen['CVE-2026-52490']);
  assert.ok(pins.osPackages.expectedInheritedVersions['libgnutls30']);
});

// ---------------------------------------------------------------------------
// Network denial classification (positive control required)
// ---------------------------------------------------------------------------

test('classifyNetworkResults requires expected denial classes and a 10.80 positive control', () => {
  const good = classifyNetworkResults({
    negatives: [{ name: 'example.com', resolved: false, errorCode: 'ENOTFOUND' }, { name: 'api.anthropic.com', resolved: false, errorCode: 'EAI_NONAME' }],
    positive: { name: 'logs.us-east-1.amazonaws.com', resolved: true, address: '10.80.4.5' },
    connect: 'CONNECTED',
  });
  assert.equal(good.ok, true, good.reasons.join('; '));
});

test('classifyNetworkResults fails on resolver success, unknown error class, wrong range or failed connect', () => {
  const neg = [{ name: 'example.com', resolved: false, errorCode: 'ENOTFOUND' }];
  assert.equal(classifyNetworkResults({ negatives: neg, positive: { name: 'x', resolved: true, address: '10.80.4.5' }, connect: 'CONNECTED' }).ok, true);
  assert.equal(classifyNetworkResults({ negatives: [{ name: 'example.com', resolved: true, address: '1.2.3.4' }], positive: { name: 'x', resolved: true, address: '10.80.4.5' }, connect: 'CONNECTED' }).ok, false);
  assert.equal(classifyNetworkResults({ negatives: [{ name: 'example.com', resolved: false, errorCode: 'SERVFAIL' }], positive: { name: 'x', resolved: true, address: '10.80.4.5' }, connect: 'CONNECTED' }).ok, false);
  assert.equal(classifyNetworkResults({ negatives: neg, positive: { name: 'x', resolved: false, errorCode: 'ENOTFOUND' }, connect: 'skipped' }).ok, false);
  assert.equal(classifyNetworkResults({ negatives: neg, positive: { name: 'x', resolved: true, address: '52.1.1.1' }, connect: 'CONNECTED' }).ok, false);
  assert.equal(classifyNetworkResults({ negatives: neg, positive: { name: 'x', resolved: true, address: '10.80.4.5' }, connect: 'timeout' }).ok, false);
});

test('addressIn10_80 matches only the qualification VPC range', () => {
  assert.equal(addressIn10_80('10.80.0.1'), true);
  assert.equal(addressIn10_80('10.80.255.254'), true);
  assert.equal(addressIn10_80('10.81.0.1'), false);
  assert.equal(addressIn10_80('1.1.1.1'), false);
});

// ---------------------------------------------------------------------------
// Office render/recalc error propagation (pure decision helpers)
// ---------------------------------------------------------------------------

test('classifySubprocess fails on nonzero status, signal or spawn error', () => {
  assert.equal(classifySubprocess({ status: 1 }).ok, false);
  assert.equal(classifySubprocess({ status: 0, signal: 'SIGKILL' }).ok, false);
  assert.equal(classifySubprocess({ status: 0, error: new Error('x') }).ok, false);
  assert.equal(classifySubprocess({ status: 0 }).ok, true);
});

test('decideNative fails when generation or PPTX inspection fails', () => {
  assert.equal(decideNative({ gen: { status: 0, parsed: { ok: true } }, pptxOk: true }).status, 'pass');
  assert.equal(decideNative({ gen: { status: 1 }, pptxOk: true }).status, 'fail');
  assert.equal(decideNative({ gen: { status: 0, parsed: { ok: false } }, pptxOk: true }).status, 'fail');
  assert.equal(decideNative({ gen: { status: 0, parsed: { ok: true } }, pptxOk: false }).status, 'fail');
});

test('decideRecalc requires successful conversion, a NEW file and A4=6', () => {
  assert.equal(decideRecalc({ convert: { status: 0 }, newFile: true, a4: 6 }).status, 'pass');
  assert.equal(decideRecalc({ convert: { status: 0 }, newFile: false, a4: 6 }).status, 'fail');
  assert.equal(decideRecalc({ convert: { status: 0 }, newFile: true, a4: null }).status, 'fail');
  assert.equal(decideRecalc({ convert: { status: 1 }, newFile: true, a4: 6 }).status, 'fail');
  assert.equal(decideRecalc({ convert: { status: 0, signal: 'SIGSEGV' }, newFile: true, a4: 6 }).status, 'fail');
});

const GOOD_PDFS = {
  docx: { convertOk: true, pdfExists: true, pdftoppmOk: true, pngCount: 1, pdfInspectOk: true, pages: 1 },
  xlsx: { convertOk: true, pdfExists: true, pdftoppmOk: true, pngCount: 1, pdfInspectOk: true, pages: 1 },
  pptx: { convertOk: true, pdfExists: true, pdftoppmOk: true, pngCount: 1, pdfInspectOk: true, pages: 1 },
};

test('decideRender treats disabled rendering as a visible not-passed result', () => {
  assert.equal(decideRender({ disabled: true }).status, 'fail');
  assert.ok(decideRender({ disabled: true }).reasons.some((r) => /disabled/.test(r)));
});

test('decideRender fails on any failed conversion, missing PNG or failed PDF inspection', () => {
  assert.equal(decideRender({ disabled: false, soffice: '/s', pdftoppm: '/p', pdfs: GOOD_PDFS, recalc: { status: 'pass' } }).status, 'pass');
  assert.equal(decideRender({ disabled: false, soffice: null, pdftoppm: '/p', pdfs: GOOD_PDFS, recalc: { status: 'pass' } }).status, 'fail');
  const badInspect = { ...GOOD_PDFS, docx: { ...GOOD_PDFS.docx, pdfInspectOk: false } };
  assert.equal(decideRender({ disabled: false, soffice: '/s', pdftoppm: '/p', pdfs: badInspect, recalc: { status: 'pass' } }).status, 'fail');
  const noPng = { ...GOOD_PDFS, pptx: { ...GOOD_PDFS.pptx, pngCount: 0 } };
  assert.equal(decideRender({ disabled: false, soffice: '/s', pdftoppm: '/p', pdfs: noPng, recalc: { status: 'pass' } }).status, 'fail');
  assert.equal(decideRender({ disabled: false, soffice: '/s', pdftoppm: '/p', pdfs: GOOD_PDFS, recalc: { status: 'fail' } }).status, 'fail');
});

test('the SDK reference store is the actual pinned upstream export', () => {
  assert.equal(typeof InMemorySessionStore, 'function');
  assert.ok(createReferenceStore() instanceof InMemorySessionStore);
});
