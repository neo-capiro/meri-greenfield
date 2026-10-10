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
import { summarize, computeExitCode, parseStructuredOutput, classifyChildResult, classifyNetworkResults, addressIn10_80, DIRECT_IP_DENIED } from './runtime.mjs';
import { assessSandboxEvidence, parseSandboxRows, extractResultSection, decodeToolResult, decodeRawText, identifyAssociatedChromium, scanDisablingFlags, classifyHelperDiscovery, classifyUnshareDiagnostic, parseSelfStatus, mountFlagsFor, planBrowserSteps, shouldStopAfter, hasActualError, buildBrowserSteps, runBoundedSequence } from './browser.mjs';
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
  assert.match(dockerfile, /^FROM node:24\.21\.0-trixie-slim@sha256:173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66$/m);
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
  assert.match(dockerfile, /ca-certificates=20250419\b/);
  assert.doesNotMatch(dockerfile, /20250419~deb12u1/);
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
  assert.match(dockerfile, /chrome_sandbox/);
  assert.match(dockerfile, /chrome-sandbox/);
  assert.match(dockerfile, /chmod 4755 "\$orig" "\$alias"/);
  assert.match(dockerfile, /chrome-linux64/);
  assert.doesNotMatch(dockerfile, /--no-sandbox/);
  assert.doesNotMatch(dockerfile, /--privileged/);
  assert.doesNotMatch(dockerfile, /docker\.sock/);
});

test('component-pins.json records the inspected CfT archive, sha256 and helper path', () => {
  assert.equal(pins.chromium.browserVersion, '155.0.8059.12');
  assert.equal(pins.chromium.archiveFile, 'chrome-linux64.zip');
  assert.equal(pins.chromium.archiveBytes, 198335306);
  assert.equal(pins.chromium.archiveSha256, 'a24546e0e6c763bf864861ce50498f38783663e24cd2af2a16798c25dc3a9489');
  assert.match(pins.chromium.downloadPath, /builds\/cft\/155\.0\.8059\.12\/linux64\/chrome-linux64\.zip/);
  assert.match(pins.chromium.sandboxHelper, /chrome_sandbox/);
  assert.match(pins.chromium.extractedExecutable, /chrome-linux64\/chrome$/);
});

test('component-pins.json records CFT per-file pins and provenance', () => {
  assert.equal(pins.chromium.perFilePins['chrome-linux64/chrome'], 'adf078f8f80eb9e980a07b4418af23b0f4008a83bc5756d5588055bc4d76c5a0');
  assert.equal(pins.chromium.perFilePins['chrome-linux64/chrome_sandbox'], 'be9f5d4be90fa60b985ad3069812b144ba7331fed0c3f980c6d9399d37d60314');
  assert.equal(pins.chromium.installedPaths.chrome, '/opt/meri-browsers/chromium-1247/chrome-linux64/chrome');
  assert.equal(pins.chromium.installedPaths.chromeSandbox, '/opt/meri-browsers/chromium-1247/chrome-linux64/chrome_sandbox');
  assert.match(pins.chromium.archiveProvenance, /W02-01-BUILD-ACCEPTANCE/);
});

test('Dockerfile byte-verifies CFT files at the established paths and emits build evidence fail-closed', () => {
  assert.ok(dockerfile.includes('/opt/meri-browsers/chromium-1247/chrome-linux64'));
  assert.ok(dockerfile.includes('adf078f8f80eb9e980a07b4418af23b0f4008a83bc5756d5588055bc4d76c5a0'));
  assert.ok(dockerfile.includes('be9f5d4be90fa60b985ad3069812b144ba7331fed0c3f980c6d9399d37d60314'));
  assert.ok(dockerfile.includes('cat /opt/meri-worker/os-installed-packages.txt'));
  assert.ok(dockerfile.includes("grep -Eq 'LibreOffice [0-9]'"));
  assert.ok(!dockerfile.includes('|| echo "libreoffice version unavailable"'));
  assert.ok(!dockerfile.includes('| sort > /opt/meri-worker/os-installed-packages.txt'), 'dpkg-query must not run inside an unchecked pipeline');
});

test('component-pins.json records base license source and the prior runtime-probe evidence', () => {
  assert.match(pins.baseImage.licenseSource, /nodejs\/node\/v24\.21\.0\/LICENSE/);
  assert.match(pins.baseImage.licenseSource, /License audit INCOMPLETE/);
  assert.ok(pins.priorBuiltCandidate.scanStatus.includes('UNRESOLVED'));
  assert.equal(pins.runtimeProbeEvidence.taskId, 'cfcc4a32e3ea45a7be898d322f663411');
  assert.equal(pins.runtimeProbeEvidence.stopped, 'exit 1 at 2026-10-09T20:57:40Z');
  assert.match(pins.runtimeProbeEvidence.failed['browser-sandbox'], /No usable sandbox/);
});

test('component-pins.json records the trixie snapshot, python 3.13 and coherent direct pins', () => {
  assert.equal(pins.baseImage.reference, 'node:24.21.0-trixie-slim');
  assert.equal(pins.baseImage.nodeVersion, '24.21.0');
  assert.match(pins.baseImage.indexDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(pins.baseImage.pythonSeries, /^3\.13 /);
  assert.equal(pins.osPackages.snapshotTimestamp, '20261009T000000Z');
  assert.deepEqual(Object.keys(pins.osPackages.repositories).sort(), ['main', 'security']);
  assert.ok(pins.osPackages.repositories.security.includes('trixie-security'));
  assert.equal(pins.osPackages.resolved['libreoffice-core'], '4:25.2.3-2+deb13u8');
  assert.equal(pins.osPackages.resolved['libtiff6'], '4.7.0-3+deb13u3');
  assert.equal(pins.osPackages.resolved['ca-certificates'], '20250419');
  assert.equal(pins.osPackages.resolved['libnss3'], '2:3.110-1+deb13u4');
  assert.equal(pins.osPackages.directPinCount, 35);
  assert.equal(Object.keys(pins.osPackages.resolved).length, 35);
  assert.equal(pins.osPackages.status, 'RESOLVED-FROM-SNAPSHOT-TRIXIE-REFRESHED-UNBUILT');
});

test('Dockerfile OS package pins match the component-pins resolved versions (no drift)', () => {
  for (const p of ['ca-certificates', 'poppler-utils', 'libnss3', 'libexpat1', 'libreoffice-core', 'python3']) {
    assert.ok(dockerfile.includes(`${p}=${pins.osPackages.resolved[p]}`), `Dockerfile pin for ${p}`);
  }
  // Coherent trixie poppler set and the t64 rename: no legacy non-t64 pin may remain.
  assert.equal(pins.osPackages.resolved['poppler-utils'], '25.03.0-5+deb13u4');
  for (const legacy of ['libasound2', 'libatk1.0-0', 'libatk-bridge2.0-0', 'libcups2', 'libatspi2.0-0', 'libglib2.0-0']) {
    assert.equal(pins.osPackages.resolved[legacy], undefined, `legacy non-t64 pin ${legacy}`);
  }
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
  assert.equal(pins.priorBuiltCandidate.ecrScan.critical, 2);
  assert.equal(pins.priorBuiltCandidate.ecrScan.high, 13);
  assert.equal(pins.priorBuiltCandidate.buildId, '55c89c64-547f-41ff-8a8b-3120e25d8b39');
  assert.equal(pins.priorBuiltCandidate.integrationCommit, '8785118bff574e2cf3f520a542f6a7b56e075f9e');
  const open = pins.osPackages.securityFindings.remainingOpen;
  assert.ok(Object.keys(open).some((k) => k.includes('CVE-2026-95210')));
  const fixedCandidates = pins.osPackages.securityFindings.vendorFixedPackageCandidates;
  assert.ok(fixedCandidates['libreoffice (CVE-2026-63277)'].includes('deb13u8'));
  assert.ok(Object.keys(open).some((k) => k.includes('CVE-2026-52490')));
  assert.ok(Object.keys(fixedCandidates).every((k) => !k.includes('CVE-2026-52490')));
  assert.ok(pins.osPackages.expectedInheritedVersions['libgnutls30t64']);
});

// ---------------------------------------------------------------------------
// Network denial classification (positive control required)
// ---------------------------------------------------------------------------

test('classifyNetworkResults requires expected denial classes and a 10.80 positive control', () => {
  const good = classifyNetworkResults({
    negatives: [{ name: 'example.com', resolved: false, errorCode: 'ENOTFOUND' }, { name: 'api.anthropic.com', resolved: false, errorCode: 'EAI_NONAME' }],
    positive: { name: 'logs.us-east-1.amazonaws.com', resolved: true, address: '10.80.4.5' },
    connect: 'CONNECTED',
    directIp: 'timeout',
  });
  assert.equal(good.ok, true, good.reasons.join('; '));
});

test('classifyNetworkResults fails on resolver success, unknown error class, wrong range or failed connect', () => {
  const neg = [{ name: 'example.com', resolved: false, errorCode: 'ENOTFOUND' }];
  assert.equal(classifyNetworkResults({ negatives: neg, positive: { name: 'x', resolved: true, address: '10.80.4.5' }, connect: 'CONNECTED', directIp: 'timeout' }).ok, true);
  assert.equal(classifyNetworkResults({ negatives: [{ name: 'example.com', resolved: true, address: '1.2.3.4' }], positive: { name: 'x', resolved: true, address: '10.80.4.5' }, connect: 'CONNECTED', directIp: 'timeout' }).ok, false);
  assert.equal(classifyNetworkResults({ negatives: [{ name: 'example.com', resolved: false, errorCode: 'SERVFAIL' }], positive: { name: 'x', resolved: true, address: '10.80.4.5' }, connect: 'CONNECTED', directIp: 'timeout' }).ok, false);
  assert.equal(classifyNetworkResults({ negatives: neg, positive: { name: 'x', resolved: false, errorCode: 'ENOTFOUND' }, connect: 'skipped', directIp: 'timeout' }).ok, false);
  assert.equal(classifyNetworkResults({ negatives: neg, positive: { name: 'x', resolved: true, address: '52.1.1.1' }, connect: 'CONNECTED', directIp: 'timeout' }).ok, false);
  assert.equal(classifyNetworkResults({ negatives: neg, positive: { name: 'x', resolved: true, address: '10.80.4.5' }, connect: 'timeout', directIp: 'timeout' }).ok, false);
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
  assert.equal(decideNative({ gen: { status: 0, parseOk: true, parsed: { ok: true } }, pptxOk: true }).status, 'pass');
  assert.equal(decideNative({ gen: { status: 1 }, pptxOk: true }).status, 'fail');
  assert.equal(decideNative({ gen: { status: 0, parseOk: true, parsed: { ok: false } }, pptxOk: true }).status, 'fail');
  assert.equal(decideNative({ gen: { status: 0, parseOk: false }, pptxOk: true }).status, 'fail');
  assert.equal(decideNative({ gen: { status: 0, parseOk: true, parsed: { ok: true } }, pptxOk: false }).status, 'fail');
});

test('decideRecalc requires successful conversion, a NEW file and observed numeric 6', () => {
  assert.equal(decideRecalc({ convert: { status: 0 }, newFile: true, observed: OBS_GOOD, inspect: { status: 0, parseOk: true, nestedOk: true } }).status, 'pass');
  assert.equal(decideRecalc({ convert: { status: 0 }, newFile: false, observed: OBS_GOOD }).status, 'fail');
  assert.equal(decideRecalc({ convert: { status: 0 }, newFile: true, observed: { inspected: false } }).status, 'fail');
  assert.equal(decideRecalc({ convert: { status: 1 }, newFile: true, observed: OBS_GOOD }).status, 'fail');
  assert.equal(decideRecalc({ convert: { status: 0, signal: 'SIGSEGV' }, newFile: true, observed: OBS_GOOD }).status, 'fail');
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

// ---------------------------------------------------------------------------
// Prelaunch helper discovery, unshare diagnostic, mounts and stop sequence
// ---------------------------------------------------------------------------

const PINNED = { path: '/opt/meri-browsers/chromium-1247/chrome-linux64/chrome_sandbox', realpath: '/opt/meri-browsers/chromium-1247/chrome-linux64/chrome_sandbox', uid: 0, gid: 0, mode: '04755', sha256: 'be9f5d4be90fa60b985ad3069812b144ba7331fed0c3f980c6d9399d37d60314' };
const ALIAS_OK = { path: '/opt/meri-browsers/chromium-1247/chrome-linux64/chrome-sandbox', realpath: '/opt/meri-browsers/chromium-1247/chrome-linux64/chrome-sandbox', uid: 0, gid: 0, mode: '04755', sha256: 'be9f5d4be90fa60b985ad3069812b144ba7331fed0c3f980c6d9399d37d60314' };

test('helper discovery accepts a root-owned 4755 alias matching the pinned helper', () => {
  assert.equal(classifyHelperDiscovery({ pinned: PINNED, alias: ALIAS_OK, aliasExpected: ALIAS_OK.path }).ok, true);
});

test('helper discovery rejects a missing, wrong-bytes, non-root or non-4755 alias', () => {
  assert.equal(classifyHelperDiscovery({ pinned: PINNED, alias: { path: ALIAS_OK.path, error: 'missing' }, aliasExpected: ALIAS_OK.path }).ok, false);
  assert.equal(classifyHelperDiscovery({ pinned: PINNED, alias: { ...ALIAS_OK, sha256: 'deadbeef' }, aliasExpected: ALIAS_OK.path }).ok, false);
  assert.equal(classifyHelperDiscovery({ pinned: PINNED, alias: { ...ALIAS_OK, uid: 10001 }, aliasExpected: ALIAS_OK.path }).ok, false);
  assert.equal(classifyHelperDiscovery({ pinned: PINNED, alias: { ...ALIAS_OK, mode: '0755' }, aliasExpected: ALIAS_OK.path }).ok, false);
  assert.equal(classifyHelperDiscovery({ pinned: { path: null, error: 'none' }, alias: ALIAS_OK, aliasExpected: ALIAS_OK.path }).ok, false);
});

test('classifyUnshareDiagnostic reads the simple newuserns check and never calls killed/timeout/spawn-error children ok', () => {
  assert.equal(classifyUnshareDiagnostic({ status: 0, stdout: 'unshare_ret=0 errno=0' }).newUserNsAsNonRoot, true);
  const denied = classifyUnshareDiagnostic({ status: 3, stdout: 'unshare_ret=-1 errno=1' });
  assert.equal(denied.newUserNsAsNonRoot, false);
  assert.match(denied.note, /simple check only/);
  assert.equal(classifyUnshareDiagnostic({ status: null, timedOut: true, stdout: 'unshare_ret=0 errno=0' }).outcome, 'timeout');
  assert.equal(classifyUnshareDiagnostic({ status: null, signal: 'SIGKILL', stdout: 'unshare_ret=0 errno=0' }).outcome, 'signal:SIGKILL');
  assert.equal(classifyUnshareDiagnostic({ status: null, error: { code: 'ENOENT' }, stdout: 'unshare_ret=0 errno=0' }).outcome, 'spawn-error');
  assert.equal(classifyUnshareDiagnostic({ status: 0, stdout: 'noise' }).outcome, 'unavailable');
});

test('parseSelfStatus and mountFlagsFor extract bounded security fields', () => {
  const status = 'Name:\tchrome\nUid:\t10001\t10001\t10001\t10001\nCapEff:\t0000000000000000\nNoNewPrivs:\t0\nSeccomp:\t2\nSeccomp_filters:\t1\nTracerPid:\t0\n';
  const parsed = parseSelfStatus(status);
  assert.equal(parsed.CapEff, '0000000000000000');
  assert.equal(parsed.Seccomp, '2');
  const mountinfo = '21 27 0:20 / /opt/meri-browsers rw,nosuid,nodev,relatime - ext4 /dev/x rw\n1 0 0:1 / / ro,relatime - overlay overlay rw\n';
  assert.deepEqual(mountFlagsFor('/opt/meri-browsers/chromium-1247/chrome-linux64/chrome_sandbox', mountinfo).options, ['rw', 'nosuid', 'nodev', 'relatime']);
  assert.deepEqual(mountFlagsFor('/', mountinfo).options, ['ro', 'relatime']);
  assert.deepEqual(mountFlagsFor('/anything-else', mountinfo).options, ['ro', 'relatime']); // falls back to the root mount prefix
});

test('planBrowserSteps lists the granular browser-dependent substeps', () => {
  assert.deepEqual(planBrowserSteps(), ['get_config', 'nav-fixture', 'snapshot', 'download-nav', 'download-bytes', 'version-nav', 'version-eval', 'sandbox-nav', 'sandbox-eval']);
  assert.equal(shouldStopAfter('get_config', { isError: false, decodedOk: false }), true);
  assert.equal(shouldStopAfter('nav-fixture', { isError: true }), true);
  assert.equal(shouldStopAfter('snapshot', { isError: false }), false);
});

// ---------------------------------------------------------------------------
// Real-flow driver fixtures: fail each actual substep in turn, assert no later
// MCP call runs. Uses the SAME buildBrowserSteps + runBoundedSequence path as
// main(); NO network, process launch or real browser.
// ---------------------------------------------------------------------------

const FAKE_IO = {
  port: 1234,
  outputDir: '/owned/output',
  exists: () => true,
  readdir: () => ['meri-fixture.txt'],
  readFile: () => Buffer.from('meri-loopback-fixture-download\n'),
  sha256: () => 'FIXEDHASH',
  expectedVersion: '155.0.8059.12',
};

function makeFakeCallTool(overrides = {}) {
  const calls = [];
  const okText = (t) => ({ content: [{ type: 'text', text: t }] });
  const okEval = (v) => ({ content: [{ type: 'text', text: `### Result\n${JSON.stringify(v)}\n` }] });
  const defaults = {
    browser_get_config: () => okEval({ browsers: ['chromium'] }),
    browser_navigate: (args) => (args && String(args.url).includes('chrome://'))
      ? okText('### Page\n- navigated')
      : okText('### Page\n- navigated'),
    browser_snapshot: () => okText('### Snapshot\n- marker meri-loopback-ok'),
    browser_evaluate: (args) => (args && typeof args.function === 'string' && args.function.includes('navigator.userAgent'))
      ? okEval({ userAgent: 'Mozilla/5.0 Chrome/155.0.8059.12', text: 'x' })
      : okEval({ text: 's', rows: [['Layer 1 Sandbox', 'Namespace'], ['Seccomp-BPF sandbox', 'Yes']], evaluation: 'OK' }),
  };
  const callTool = async (name, args) => {
    calls.push(name);
    const fn = Object.prototype.hasOwnProperty.call(overrides, name) ? overrides[name] : defaults[name];
    return typeof fn === 'function' ? fn(args) : fn;
  };
  return { calls, callTool };
}

async function runBrowserFixture(overrides) {
  const { calls, callTool } = makeFakeCallTool(overrides);
  const evidence = { rawResults: {} };
  const reasons = [];
  const steps = buildBrowserSteps({ callTool, toolNames: ['browser_get_config'], evidence, reasons, io: FAKE_IO });
  const seq = await runBoundedSequence(steps);
  return { calls, seq, reasons, evidence };
}

test('real-flow: nav/snapshot success without a Result section is NOT fatal', async () => {
  const { seq, evidence } = await runBrowserFixture();
  assert.equal(seq.stoppedAfter, null);
  assert.deepEqual(seq.ran, planBrowserSteps());
  assert.ok(evidence.sandbox && evidence.sandbox.rows.length === 2);
});

for (const [step, overrides, expectedCalls] of [
  ['get_config', { browser_get_config: { content: [{ type: 'text', text: '### Error\nboom' }], isError: true } }, 1],
  ['nav-fixture', { browser_navigate: (a) => (String(a.url).includes('/download') ? { content: [{ type: 'text', text: '### Page' }] } : { content: [{ type: 'text', text: '### Error\nnav' }], isError: true }) }, 2],
  ['snapshot', { browser_snapshot: { content: [{ type: 'text', text: '### Snapshot\n- no marker here' }] } }, 3],
  ['download-nav', { browser_navigate: (a) => (String(a.url).includes('/download') ? { content: [{ type: 'text', text: '### Error\ndl' }], isError: true } : { content: [{ type: 'text', text: '### Page' }] }) }, 4],
  ['version-nav', { browser_navigate: (a) => (String(a.url).includes('chrome://version') ? { content: [{ type: 'text', text: '### Error\nv' }], isError: true } : { content: [{ type: 'text', text: '### Page' }] }) }, 5],
  ['sandbox-nav', { browser_navigate: (a) => (String(a.url).includes('chrome://sandbox') ? { content: [{ type: 'text', text: '### Error\ns' }], isError: true } : { content: [{ type: 'text', text: '### Page' }] }) }, 7],
]) {
  test(`real-flow: a fatal ${step} stops the sequence and runs no later MCP call`, async () => {
    const { calls, seq } = await runBrowserFixture(overrides);
    assert.equal(seq.stoppedAfter, step);
    assert.equal(calls.length, expectedCalls, `expected exactly ${expectedCalls} MCP calls, got ${calls.length}`);
    const later = seq.notRun;
    assert.ok(later.length >= 1, 'expected remaining substeps recorded not-run');
  });
}

test('real-flow: download-bytes failure (no file) stops before version/sandbox MCP calls', async () => {
  const { calls, seq } = await runBrowserFixture();
  // re-run with a special IO where the downloaded file is absent
  const { callTool } = makeFakeCallTool();
  const evidence = { rawResults: {} };
  const reasons = [];
  const steps = buildBrowserSteps({ callTool, toolNames: ['browser_get_config'], evidence, reasons, io: { ...FAKE_IO, exists: () => false } });
  const seq2 = await runBoundedSequence(steps);
  assert.equal(seq2.stoppedAfter, 'download-bytes');
  assert.ok(seq2.notRun.includes('version-nav'));
  assert.ok(seq2.notRun.includes('sandbox-eval'));
});

test('real-flow: version-eval failure stops before sandbox navigation', async () => {
  const { seq } = await runBrowserFixture({ browser_evaluate: (a) => (a.function.includes('navigator.userAgent') ? { content: [{ type: 'text', text: '### Error\nbad eval' }], isError: true } : { content: [{ type: 'text', text: '### Result\n{}' }] }) });
  assert.equal(seq.stoppedAfter, 'version-eval');
  assert.ok(!seq.ran.includes('sandbox-nav'));
  assert.ok(seq.notRun.includes('sandbox-eval'));
});

// ---------------------------------------------------------------------------
// Office recalculation observed-value fixtures (never collapse to a pass)
// ---------------------------------------------------------------------------

const OK_CONVERT = { status: 0, signal: null, error: null };
const OBS_GOOD = { inspected: true, inputs: [1, 2, 3], formula: '=SUM(A1:A3)', cachedValue: 6, cachedType: 'int' };

test('decideRecalc passes only on original inputs, retained formula and numeric 6', () => {
  assert.equal(decideRecalc({ convert: OK_CONVERT, newFile: true, observed: OBS_GOOD, inspect: { status: 0, parseOk: true, nestedOk: true } }).status, 'pass');
  assert.equal(decideRecalc({ convert: OK_CONVERT, newFile: true, observed: OBS_GOOD }).status, 'fail');
  assert.equal(decideRecalc({ convert: OK_CONVERT, newFile: true, observed: OBS_GOOD, inspect: { status: 0 } }).status, 'fail');
});

test('decideRecalc fails on wrong 0, actual null, missing inspection, python failure, malformed parse and constant 6 without formula', () => {
  assert.equal(decideRecalc({ convert: OK_CONVERT, newFile: true, observed: { ...OBS_GOOD, cachedValue: 0 } }).status, 'fail'); // wrong 0
  assert.equal(decideRecalc({ convert: OK_CONVERT, newFile: true, observed: { ...OBS_GOOD, cachedValue: null, cachedType: 'NoneType' } }).status, 'fail'); // actual null
  assert.equal(decideRecalc({ convert: OK_CONVERT, newFile: true, observed: { inspected: false } }).status, 'fail'); // missing inspection
  assert.equal(decideRecalc({ convert: { status: 1, signal: null }, newFile: true, observed: OBS_GOOD }).status, 'fail'); // python/convert failure
  assert.equal(decideRecalc({ convert: { status: 0, signal: 'SIGSEGV' }, newFile: true, observed: OBS_GOOD }).status, 'fail');
  assert.equal(decideRecalc({ convert: OK_CONVERT, newFile: false, observed: OBS_GOOD }).status, 'fail'); // no new file
  assert.equal(decideRecalc({ convert: OK_CONVERT, newFile: true, observed: { ...OBS_GOOD, formula: 6 } }).status, 'fail'); // constant 6 without formula
  assert.equal(decideRecalc({ convert: OK_CONVERT, newFile: true, observed: { ...OBS_GOOD, inputs: [1, 2] } }).status, 'fail'); // missing input
});

test('decideRecalc rejects good-looking observed facts from a failed inspection child (false-pass guard)', () => {
  const okChild = { status: 0, signal: null, error: null, parseOk: true, nestedOk: true };
  assert.equal(decideRecalc({ convert: OK_CONVERT, newFile: true, observed: OBS_GOOD, inspect: okChild }).status, 'pass');
  assert.equal(decideRecalc({ convert: OK_CONVERT, newFile: true, observed: OBS_GOOD, inspect: { ...okChild, status: 1 } }).status, 'fail'); // exit 1
  assert.equal(decideRecalc({ convert: OK_CONVERT, newFile: true, observed: OBS_GOOD, inspect: { ...okChild, status: null, signal: 'SIGKILL' } }).status, 'fail'); // signal
  assert.equal(decideRecalc({ convert: OK_CONVERT, newFile: true, observed: OBS_GOOD, inspect: { ...okChild, status: null, error: 'spawn ENOENT' } }).status, 'fail'); // spawn error
  assert.equal(decideRecalc({ convert: OK_CONVERT, newFile: true, observed: OBS_GOOD, inspect: { ...okChild, parseOk: false, parseError: 'bad json' } }).status, 'fail'); // parse failure
  assert.equal(decideRecalc({ convert: OK_CONVERT, newFile: true, observed: OBS_GOOD, inspect: { ...okChild, nestedOk: false } }).status, 'fail'); // nested ok false
});

// ---------------------------------------------------------------------------
// Direct-IP negative fixtures
// ---------------------------------------------------------------------------

test('classifyNetworkResults requires the direct-IP negative and fails on CONNECTED or ambiguous results', () => {
  const base = { negatives: [{ name: 'example.com', resolved: false, errorCode: 'ENOTFOUND' }], positive: { name: 'x', resolved: true, address: '10.80.4.5' }, connect: 'CONNECTED' };
  assert.equal(classifyNetworkResults({ ...base, directIp: 'timeout' }).ok, true);
  assert.equal(classifyNetworkResults({ ...base, directIp: 'error:ENETUNREACH' }).ok, true);
  assert.equal(classifyNetworkResults({ ...base, directIp: 'error:EHOSTUNREACH' }).ok, true);
  assert.equal(classifyNetworkResults({ ...base, directIp: 'CONNECTED' }).ok, false);
  assert.equal(classifyNetworkResults({ ...base, directIp: 'error:EACCES' }).ok, false); // ambiguous fails closed
  assert.equal(classifyNetworkResults({ ...base, directIp: 'error:ECONNREFUSED' }).ok, false); // peer refusal is inconclusive
  assert.equal(classifyNetworkResults({ ...base, directIp: undefined }).ok, false);
  assert.ok(DIRECT_IP_DENIED.includes('timeout'));
});

test('an absent optional MCP config tool is recorded as not-run, without a call', async () => {
  const evidence = { rawResults: {} };
  let calls = 0;
  const [configStep] = buildBrowserSteps({ callTool: async () => { calls += 1; }, toolNames: ['browser_navigate'], evidence, reasons: [] });
  const sequence = await runBoundedSequence([configStep]);
  assert.equal(calls, 0);
  assert.deepEqual(sequence.ran, []);
  assert.deepEqual(sequence.notRun, ['get_config']);
});

test('native generation never accepts successful-looking JSON from a signalled or errored child', () => {
  const gen = { status: 0, parseOk: true, parsed: { ok: true } };
  assert.equal(decideNative({ gen, pptxOk: true }).status, 'pass');
  assert.equal(decideNative({ gen: { ...gen, error: { code: 'ETIMEDOUT' } }, pptxOk: true }).status, 'fail');
  assert.equal(decideNative({ gen: { ...gen, signal: 'SIGKILL' }, pptxOk: true }).status, 'fail');
});

// ---------------------------------------------------------------------------
// W02-08 trixie base manifest / retained provenance / wheels
// ---------------------------------------------------------------------------

test('component-pins.json records the trixie base manifest digests and retained public-source hashes', () => {
  assert.equal(pins.baseImage.platformManifestDigestAmd64, 'sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63');
  assert.equal(pins.baseImage.platformConfigDigest, 'sha256:04f59b17d8d39a8fdeb138fecb8fcbaa6e208ed7b6db929c7e98ad9005e0a52f');
  assert.equal(pins.baseImage.debianBaseDigest, 'sha256:918311b7b6c4c6f68b232ba516584925f6c78ad82b6fd534b98979df6438e483');
  const s = pins.publicSourcesRetained;
  assert.ok(s.dockerIndex.includes('173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66 bytes=5177'));
  assert.ok(s.dockerAmd64Manifest.includes('c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63 bytes=1923'));
  assert.ok(s.dockerAmd64Config.includes('04f59b17d8d39a8fdeb138fecb8fcbaa6e208ed7b6db929c7e98ad9005e0a52f bytes=6769'));
  assert.ok(s.debianMainRelease.includes('ed56aac47e7911e65ee63aae8d67e29f20e023f840e49f8ed037043a33de138a bytes=138612'));
  assert.ok(s.debianSecurityRelease.includes('29d373d5d74320b73e0a464f1dae402bbe88ca28bd6f3cf04b14982afd77ddb6 bytes=41759'));
  assert.ok(s.debianMainPackagesXz.includes('7778d3e3f303b7ddb8ce0fe7c8d57473a076c6bf2e8f241f75421d2396352498 bytes=9678380'));
  assert.ok(s.debianSecurityPackagesXz.includes('5cf72f9c534b27dd9fb350b7d4c31b05a82dea2abcfed19a08097bf8d7e8f847 bytes=264900'));
});

test('component-pins.json records the cp313 lxml wheel and real downloaded-byte verification', () => {
  const lxml = pins.pypiTransitive.find((p) => p.name === 'lxml');
  assert.match(lxml.wheel, /^lxml-6\.1\.3-cp313-cp313-manylinux_2_26_x86_64\.manylinux_2_28_x86_64\.whl$/);
  assert.equal(lxml.sha256, 'd85dfab42dd672f87a7f76e9de7172962aee69fa12044f0d6e1a23cbd53fb80e');
  assert.equal(pins.wheelHashVerification.verified, true);
  // requirements.lock must carry the cp313 lxml hash, never the W02-01 cp311 one.
  assert.match(requirements, /^lxml==6\.1\.3 --hash=sha256:d85dfab42dd672f87a7f76e9de7172962aee69fa12044f0d6e1a23cbd53fb80e$/m);
  assert.doesNotMatch(requirements, /527195c188d7d0af748cd48d220ab8cdc5cb99be3d49ac4d9be7324d8abf9bc0/);
});

// ---------------------------------------------------------------------------
// W02-08 end-of-recipe inventory interface + privilege-bit reduction
// ---------------------------------------------------------------------------

test('Dockerfile ends with the owner-closed inventory over the exact declared roots and helpers', () => {
  assert.ok(dockerfile.includes('image-inventory.py'), 'owner inventory probe invoked');
  for (const r of ['/opt/meri-worker', '/opt/meri-venv', '/opt/meri-browsers', '/usr', '/etc', '/var/lib/dpkg', '/bin', '/sbin', '/lib', '/lib64', '/root', '/home']) {
    assert.ok(dockerfile.includes(`--root ${r}`), `declared root ${r}`);
  }
  assert.ok(dockerfile.includes('--allow-suid /opt/meri-browsers/chromium-1247/chrome-linux64/chrome_sandbox'));
  assert.ok(dockerfile.includes('--allow-suid /opt/meri-browsers/chromium-1247/chrome-linux64/chrome-sandbox'));
  assert.ok(dockerfile.includes('--out /opt/meri-worker/image-inventory.json'));
  // The owner CLI compiles roots/pins/allow-list and exposes no escape hatch.
  assert.ok(!dockerfile.includes('--expect-file'), 'no invented expectation flag');
  assert.ok(!dockerfile.includes('--platform-override'), 'no platform escape hatch');
});

test('Dockerfile reduces SUID/SGID via chmod only, before the inventory, before USER', () => {
  assert.ok(dockerfile.includes('chmod u-s,g-s'));
  assert.doesNotMatch(dockerfile, /\bapt-get\s+(remove|purge)\b/);
  assert.doesNotMatch(dockerfile, /\brm\s+-rf\s+\/usr\b/);
  const reduceAt = dockerfile.indexOf('chmod u-s,g-s');
  const invAt = dockerfile.indexOf('image-inventory.py');
  const userAt = dockerfile.indexOf('USER 10001:10001');
  assert.ok(reduceAt > 0 && invAt > reduceAt && userAt > invAt, 'order: reduce -> inventory -> USER');
});

test('Dockerfile preserves SDK/CFT hashes, non-root identity, strict env and no bypass', () => {
  assert.ok(dockerfile.includes('4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358'));
  assert.ok(dockerfile.includes('adf078f8f80eb9e980a07b4418af23b0f4008a83bc5756d5588055bc4d76c5a0'));
  assert.ok(dockerfile.includes('be9f5d4be90fa60b985ad3069812b144ba7331fed0c3f980c6d9399d37d60314'));
  assert.match(dockerfile, /^USER 10001:10001$/m);
  assert.ok(dockerfile.includes('python3.13/site-packages/pip'), 'pip removal tracks trixie 3.13');
  assert.doesNotMatch(dockerfile, /python3\.11\/site-packages\/pip/);
  assert.ok(dockerfile.includes('CHROMIUM_SANDBOX_REQUIRED=true'));
  assert.doesNotMatch(dockerfile, /trusted=yes|allow-unauthenticated|AllowUnauthenticated/i);
  assert.doesNotMatch(dockerfile, /--no-sandbox|--privileged|docker\.sock/);
});
