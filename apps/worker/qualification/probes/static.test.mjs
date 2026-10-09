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
import { assessSandboxEvidence, parseSandboxRows, extractResultSection, decodeToolResult } from './browser.mjs';
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

const SANDBOX_PAGE_NAMESPACE = [
  'Sandbox Status',
  'Namespace Sandbox: Yes',
  'SUID Sandbox: No',
  'Seccomp-BPF Sandbox: Yes',
  'PID Namespace: Yes',
].join('\n');
const SANDBOX_PAGE_ALL_NO = ['Namespace Sandbox: No', 'SUID Sandbox: No', 'Seccomp-BPF Sandbox: No'].join('\n');
const PROCESSES = [
  { pid: 100, type: 'browser', argv: ['/opt/meri-browsers/chromium-1247/chrome-linux/chrome', '--headless', '--enable-features=Foo'] },
  { pid: 101, type: 'renderer', argv: ['/opt/meri-browsers/chromium-1247/chrome-linux/chrome', '--type=renderer'] },
];

test('sandbox verdict accepts Namespace Yes + SUID No + Seccomp-BPF Yes (disabled unused alternative allowed)', () => {
  const v = assessSandboxEvidence({ sandboxPageText: SANDBOX_PAGE_NAMESPACE, processes: PROCESSES, effectiveFlagsSource: 'proc' });
  assert.equal(v.ok, true, v.reasons.join('; '));
});

test('sandbox verdict rejects all-No rows and generic prose', () => {
  assert.equal(assessSandboxEvidence({ sandboxPageText: SANDBOX_PAGE_ALL_NO, processes: PROCESSES, effectiveFlagsSource: 'proc' }).ok, false);
  assert.equal(assessSandboxEvidence({ sandboxPageText: 'sandbox', processes: PROCESSES, effectiveFlagsSource: 'proc' }).ok, false);
  assert.equal(assessSandboxEvidence({ sandboxPageText: 'yes', processes: PROCESSES, effectiveFlagsSource: 'proc' }).ok, false);
  assert.equal(assessSandboxEvidence({ sandboxPageText: 'Layer 1 Sandbox: Yes', processes: PROCESSES, effectiveFlagsSource: 'proc' }).ok, false);
});

test('sandbox verdict rejects config-only evidence (requested config is not process evidence)', () => {
  const v = assessSandboxEvidence({ sandboxPageText: SANDBOX_PAGE_NAMESPACE, processes: PROCESSES, effectiveFlagsSource: 'config' });
  assert.equal(v.ok, false);
  assert.ok(v.reasons.some((r) => /proc Chromium process evidence/.test(r)));
});

test('sandbox verdict rejects absent processes and any disabling flag anywhere', () => {
  assert.equal(assessSandboxEvidence({ sandboxPageText: SANDBOX_PAGE_NAMESPACE, processes: [], effectiveFlagsSource: 'proc' }).ok, false);
  for (const flag of ['--no-sandbox', '--disable-namespace-sandbox', '--disable-seccomp-filter-sandbox']) {
    const procs = [{ pid: 9, type: 'renderer', argv: ['chrome', flag, '--type=renderer'] }];
    assert.equal(assessSandboxEvidence({ sandboxPageText: SANDBOX_PAGE_NAMESPACE, processes: procs, effectiveFlagsSource: 'proc' }).ok, false, flag);
  }
});

test('sandbox rows: known rows parsed exactly, unknown ignored, ambiguous/duplicate fail', () => {
  assert.deepEqual(parseSandboxRows(SANDBOX_PAGE_NAMESPACE).found, { namespace: true, suid: false, seccomp: true });
  assert.deepEqual(parseSandboxRows(SANDBOX_PAGE_NAMESPACE).ambiguous, []);
  assert.ok(parseSandboxRows('Namespace Sandbox: Yes\nNamespace Sandbox: No').ambiguous.length > 0);
  assert.ok(parseSandboxRows('Seccomp-BPF Sandbox: maybe').ambiguous.length > 0);
  assert.deepEqual(parseSandboxRows('PID Namespace: Yes\nNet Namespace: Yes').found, {});
});

// ---------------------------------------------------------------------------
// MCP Result-section parser (real framing)
// ---------------------------------------------------------------------------

const SANDBOX_STRING = 'Sandbox Status\nNamespace Sandbox: Yes\nSeccomp-BPF Sandbox: Yes';
const FRAME_OK = [
  '### Ran Playwright code',
  '```js',
  'await page.evaluate(() => document.body.innerText);',
  '```',
  '### Result',
  JSON.stringify(SANDBOX_STRING),
].join('\n');

test('extractResultSection decodes the exact Result section from real framing', () => {
  const r = extractResultSection(FRAME_OK);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.value, SANDBOX_STRING);
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

test('Dockerfile pins Debian repositories to the snapshot with signature verification and Check-Valid-Until disabled', () => {
  assert.match(dockerfile, /snapshot\.debian\.org\/archive\/debian\/20260901T000000Z/);
  assert.match(dockerfile, /snapshot\.debian\.org\/archive\/debian-security\/20260901T000000Z/);
  assert.match(dockerfile, /Signed-By: \/usr\/share\/keyrings\/debian-archive-keyring\.gpg/);
  assert.match(dockerfile, /Check-Valid-Until: no/);
  assert.doesNotMatch(dockerfile, /trusted=yes/);
  assert.doesNotMatch(dockerfile, /allow-unauthenticated|AllowUnauthenticated/);
});

test('Dockerfile bootstraps ca-certificates over HTTP then switches to HTTPS with a pinned CA version', () => {
  assert.match(dockerfile, /URIs: http:\/\/snapshot\.debian\.org\/archive\/debian\/20260901T000000Z/);
  assert.match(dockerfile, /URIs: https:\/\/snapshot\.debian\.org\/archive\/debian\/20260901T000000Z/);
  assert.match(dockerfile, /ca-certificates=20230311\+deb12u1/);
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
  assert.equal(pins.osPackages.resolved['ca-certificates'], '20230311+deb12u1');
  assert.equal(pins.osPackages.status, 'RESOLVED-FROM-SNAPSHOT');
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
