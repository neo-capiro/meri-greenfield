// Codex owner offline qualification. Real adopted components; no DOM/server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, mkdtempSync, copyFileSync, mkdirSync, writeFileSync, unlinkSync, symlinkSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { verifySSRReceipt } from './ssr-build.mjs';
import { checkSSRDeadline } from './ssr-runtime.mjs';
import ts from 'typescript';

const HERE = dirname(fileURLToPath(import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const blob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const read = path => readFileSync(join(HERE, path));
const json = path => JSON.parse(read(path).toString('utf8'));
const ownerHeader = '// Meri Codex owner adaptation: preserve strict exactOptionalPropertyTypes by\n// omitting an absent checked prop; all upstream imports/exports are retained.\n\n';
const omitChecked = '{...(checked === undefined ? {} : { checked })}';
const forbidden = /^(?:@ai-sdk\/|@vercel\/oidc(?:\/|$))|^(?:ai|openai|@anthropic-ai\/sdk)(?:\/|$)/;

const SSR_PHASES = new Set(['child-enter', 'guards-installed', 'module-load', 'source-transpile', 'deadline-armed', 'deadline', 'fixture-import', 'fixture-ready', 'renderer-import', 'renderer-ready', 'render', 'result-ready', 'result-written', 'cleanup-complete']);
const SSR_DIAGNOSTIC_BYTES = 8192;
const SSR_DIAGNOSTIC_LINES = 64;

function safeSSRDiagnostics(stderr) {
  const rows = [];
  let bytes = 0;
  for (const line of String(stderr ?? '').slice(0, SSR_DIAGNOSTIC_BYTES).split('\n')) {
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (!row || typeof row !== 'object' || Object.keys(row).sort().join(',') !== 'elapsedMs,loaded,ssrPhase'
        || !SSR_PHASES.has(row.ssrPhase) || !Number.isInteger(row.elapsedMs) || row.elapsedMs < 0 || row.elapsedMs > 1e9
        || !Number.isInteger(row.loaded) || row.loaded < 0 || row.loaded > 1e6) continue;
    const safe = JSON.stringify({ ssrPhase: row.ssrPhase, elapsedMs: row.elapsedMs, loaded: row.loaded });
    if (rows.length >= SSR_DIAGNOSTIC_LINES || bytes + Buffer.byteLength(safe) + 1 > SSR_DIAGNOSTIC_BYTES) break;
    rows.push(safe); bytes += Buffer.byteLength(safe) + 1;
  }
  return rows.join('\n');
}

function onceSSROutcome(run) {
  let started = false, outcome;
  return () => {
    if (!started) {
      started = true;
      try { outcome = { ok: true, value: run() }; } catch (error) { outcome = { ok: false, error }; }
    }
    if (!outcome.ok) throw outcome.error;
    return outcome.value;
  };
}

function sourceExportInventory(source) {
  const file = ts.createSourceFile('adopted.tsx', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const names = [];
  for (const node of file.statements) {
    if (ts.isExportDeclaration(node)) {
      assert.equal(node.isTypeOnly, false); assert.ok(node.exportClause && ts.isNamedExports(node.exportClause), 'unqualified wildcard export');
      for (const item of node.exportClause.elements) if (!item.isTypeOnly) names.push(item.name.text);
    } else if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) continue;
      if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) { assert.ok(ts.isIdentifier(declaration.name)); names.push(declaration.name.text); }
      else { assert.ok(node.name && ts.isIdentifier(node.name), 'unqualified export'); names.push(node.name.text); }
    }
  }
  assert.equal(new Set(names).size, names.length); return names.sort();
}

function vendorFiles(dir = join(HERE, 'vendor')) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? vendorFiles(join(dir, e.name)) : [relative(HERE, join(dir, e.name)).split(sep).join('/')]).sort();
}

function packageFiles(dir = HERE) {
  return readdirSync(dir, { withFileTypes: true }).filter(e => e.name !== 'node_modules').flatMap(e => e.isDirectory() ? packageFiles(join(dir, e.name)) : [relative(HERE, join(dir, e.name)).split(sep).join('/')]).sort();
}

function inspectClosure(sourceMap) {
  const visited = new Set(), external = new Set();
  const visit = name => {
    if (visited.has(name)) return;
    const text = sourceMap.get(name); assert.equal(typeof text, 'string', `missing reachable source ${name}`); visited.add(name);
    const file = ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true, name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    for (const statement of file.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      const specifier = statement.moduleSpecifier.text;
      if (specifier.startsWith('@repo/shadcn-ui/')) {
        const stem = specifier.slice('@repo/shadcn-ui/'.length);
        visit('vendor/shadcn-ui/' + stem + (stem === 'lib/utils' ? '.ts' : '.tsx'));
      } else {
        assert.ok(!specifier.startsWith('.') && !specifier.startsWith('http') && !specifier.includes(':'), `unexpected runtime source ${specifier}`);
        if (specifier === 'ai') assert.equal(statement.importClause?.isTypeOnly, true, 'AI SDK must be type-only in adopted files');
        else assert.ok(!forbidden.test(specifier), `forbidden orchestration/provider import ${specifier}`);
        external.add(specifier);
      }
    }
  };
  for (const name of ['conversation', 'message', 'prompt-input']) visit(`vendor/ai-elements/${name}.tsx`);
  return { files: [...visited].sort(), external: [...external].sort() };
}

{
  const ssr = onceSSROutcome(() => {
    const env = { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '', NODE_ENV: 'production', TZ: 'UTC', NODE_DISABLE_COMPILE_CACHE: '1' };
    const receiptPath = process.env.MERI_ELEMENTS_SSR_RECEIPT;
    const expectedSha256 = process.env.MERI_ELEMENTS_SSR_RECEIPT_SHA256;
    assert.equal(typeof receiptPath, 'string', 'prepare an exclusive SSR artifact first');
    verifySSRReceipt({ receiptPath, expectedSha256 });
    const argv = [join(HERE, 'ssr-runtime.mjs'), receiptPath, expectedSha256], start = new Date().toISOString(), clock = performance.now();
    const result = spawnSync(process.execPath, argv, { cwd: HERE, env, timeout: 25000, maxBuffer: 512 * 1024 });
    if (process.env.MERI_ELEMENTS_SSR_CAPTURE_ROOT) {
      const out = resolve(process.env.MERI_ELEMENTS_SSR_CAPTURE_ROOT);
      assert.ok(out !== HERE && !out.startsWith(HERE + sep), 'SSR evidence must be outside source package'); mkdirSync(out);
      for (const name of ['stdout', 'stderr']) writeFileSync(join(out, name + '.bin'), result[name] ?? Buffer.alloc(0), { flag: 'wx' });
      const streams = Object.fromEntries(['stdout', 'stderr'].map(name => [name, { bytes: result[name]?.length ?? 0, sha256: sha(result[name] ?? Buffer.alloc(0)) }]));
      writeFileSync(join(out, 'process.json'), JSON.stringify({ argv: [process.execPath, ...argv], cwd: HERE, environment: env, startUtc: start, endUtc: new Date().toISOString(), durationMs: performance.now() - clock, timeoutMs: 25000, maxBuffer: 512 * 1024, status: result.status, signal: result.signal, error: result.error?.code ?? null, shell: false, streams }, null, 2) + '\n', { flag: 'wx' });
    }
    const code = /^[A-Z0-9_]{1,32}$/.test(result.error?.code ?? '') ? result.error.code : 'UNKNOWN';
    const diagnostics = safeSSRDiagnostics(result.stderr);
    assert.equal(result.error === undefined, true, `SSR spawn failed (${code}); bounded phases:\n${diagnostics}`);
    assert.equal(result.signal === null, true, `SSR signalled; bounded phases:\n${diagnostics}`);
    assert.equal(result.status === 0, true, `SSR child failed; bounded phases:\n${diagnostics}`);
    try { return JSON.parse(result.stdout); } catch { throw new Error(`SSR result JSON malformed; bounded phases:\n${diagnostics}`); }
  });

  test('SSR harness caches its first success or failure without launching again', () => {
    let calls = 0;
    const failure = new Error('synthetic first child failure');
    const failed = onceSSROutcome(() => { calls++; throw failure; });
    for (let i = 0; i < 3; i++) assert.throws(failed, error => error === failure);
    assert.equal(calls, 1);
    const value = { synthetic: true };
    const passed = onceSSROutcome(() => { calls++; return value; });
    assert.equal(passed(), value); assert.equal(passed(), value); assert.equal(calls, 2);
    let parses = 0;
    const malformed = onceSSROutcome(() => { parses++; return JSON.parse('not-json'); });
    assert.throws(malformed, SyntaxError); assert.throws(malformed, SyntaxError); assert.equal(parses, 1);
  });

  test('SSR harness diagnostics retain only bounded phase counts and no raw payloads', () => {
    const safe = JSON.stringify({ ssrPhase: 'fixture-import', elapsedMs: 20, loaded: 100 });
    const hostile = ['<script>secret payload</script>', 'C:\\private\\module.js',
      JSON.stringify({ ssrPhase: 'secret payload', elapsedMs: 1, loaded: 1 }),
      JSON.stringify({ ssrPhase: 'render', elapsedMs: 1, loaded: 1, secret: 'payload' }),
      JSON.stringify({ ssrPhase: 'render', elapsedMs: -1, loaded: 1 }),
      JSON.stringify({ ssrPhase: 'render', elapsedMs: 1, loaded: 'C:/secret/module.js' })];
    assert.equal(safeSSRDiagnostics([...hostile, safe].join('\n')), safe);
    assert.equal(safeSSRDiagnostics('x'.repeat(SSR_DIAGNOSTIC_BYTES) + '\n' + safe), '');
    const many = safeSSRDiagnostics(Array(200).fill(safe).join('\n'));
    assert.equal(many.split('\n').length, SSR_DIAGNOSTIC_LINES); assert.ok(Buffer.byteLength(many) <= SSR_DIAGNOSTIC_BYTES);
  });

  test('all adopted value exports remain present in the frozen static inventory', () => {
    const expected = json('component-pins.json').sourceExportInventory;
    for (const name of ['conversation', 'message', 'prompt-input']) {
      const source = read(`vendor/ai-elements/${name}.tsx`).toString('utf8');
      assert.deepEqual(sourceExportInventory(source), expected[name]);
      assert.notDeepEqual(sourceExportInventory(source + '\nexport const OWNER_NEGATIVE_EXTRA = 1;'), expected[name]);
    }
    assert.ok(expected.message.includes('MessageResponse'));
    assert.ok(expected['prompt-input'].includes('PromptInputActionAddScreenshot'));
  });

  test('elapsed deadline refuses a starved timer and real guards refuse restricted operations', () => {
    checkSSRDeadline(10, 20009); assert.throws(() => checkSSRDeadline(10, 20010), /20-second/);
    assert.throws(() => checkSSRDeadline(10, 20011)); assert.throws(() => checkSSRDeadline(10, 9));
    const run = spawnSync(process.execPath, [join(HERE, 'ssr-runtime.mjs'), '--guard-probe'], {
      cwd: HERE, env: { SystemRoot: process.env.SystemRoot ?? '', NODE_DISABLE_COMPILE_CACHE: '1' }, timeout: 25000, maxBuffer: 512 * 1024, encoding: 'utf8', shell: false,
    });
    assert.equal(run.error, undefined); assert.equal(run.status, 0);
    assert.deepEqual(JSON.parse(run.stdout).attempts, ['fetch', 'net.connect', 'Server.listen', 'child_process.spawn', 'native addon', 'WebAssembly.compile', 'WebAssembly.Module']);
    assert.equal(JSON.parse(run.stdout).unboundImportRefused, true);
  });

  test('real receipt rejects wrong identity, missing or changed source and changed output before execution', () => {
    const receiptPath = process.env.MERI_ELEMENTS_SSR_RECEIPT;
    const expectedSha256 = process.env.MERI_ELEMENTS_SSR_RECEIPT_SHA256;
    assert.equal(typeof receiptPath, 'string');
    const { receipt } = verifySSRReceipt({ receiptPath, expectedSha256 });
    assert.throws(() => verifySSRReceipt({ receiptPath, expectedSha256: '0'.repeat(64) }), /receipt digest/);
    const temp = mkdtempSync(join(dirname(receiptPath), 'negative-'));
    const tryReceipt = (name, change) => {
      const modified = structuredClone(receipt); change(modified);
      const raw = Buffer.from(JSON.stringify(modified)); const path = join(temp, name + '.json'); writeFileSync(path, raw, { flag: 'wx' });
      // Place the negative receipt beside copies of the real bound outputs.
      for (const item of receipt.outputs) if (!existsSync(join(temp, item.path))) copyFileSync(join(dirname(receiptPath), item.path), join(temp, item.path));
      return () => verifySSRReceipt({ receiptPath: path, expectedSha256: sha(raw) });
    };
    assert.throws(tryReceipt('tool', r => { r.tool.binarySha256 = '0'.repeat(64); }), /tool receipt/);
    assert.throws(tryReceipt('output', r => { r.outputs[0].sha256 = '0'.repeat(64); }));
    const usedJS = receipt.dependencies.find(x => x.path.endsWith('/react.production.js')); assert.ok(usedJS);
    assert.throws(tryReceipt('omitted-input', r => { r.dependencies = r.dependencies.filter(x => x.path !== usedJS.path); }), /unbound dependency input/);
    const clone = join(temp, 'package'); mkdirSync(clone);
    for (const name of json('component-pins.json').ownedPackageFiles) { const path = join(clone, name); mkdirSync(dirname(path), { recursive: true }); copyFileSync(join(HERE, name), path); }
    symlinkSync(join(HERE, 'node_modules'), join(clone, 'node_modules'), 'junction');
    writeFileSync(join(clone, 'fixture.tsx'), Buffer.concat([read('fixture.tsx'), Buffer.from(' ')]));
    assert.throws(() => verifySSRReceipt({ receiptPath, expectedSha256, packageRoot: clone }));
    unlinkSync(join(clone, 'fixture.tsx'));
    assert.throws(() => verifySSRReceipt({ receiptPath, expectedSha256, packageRoot: clone }), /ENOENT/);
    const child = spawnSync(process.execPath, [join(HERE, 'ssr-runtime.mjs'), receiptPath, '0'.repeat(64)], {
      cwd: HERE, env: { SystemRoot: process.env.SystemRoot ?? '', NODE_DISABLE_COMPILE_CACHE: '1' }, timeout: 25000, maxBuffer: 512 * 1024, encoding: 'utf8', shell: false,
    });
    assert.equal(child.error, undefined); assert.notEqual(child.status, 0); assert.doesNotMatch(child.stderr, /"ssrPhase":"fixture-import"/);
  });

  test('immutable vendor blob identities and one exact owner adaptation', () => {
    const pins = json('component-pins.json');
    assert.equal(pins.upstream.commit, 'bc871264341cf54a7ea1fee36d951688ed2a1ff7');
    assert.equal(pins.upstream.tagObject, 'e4289305573b338dfcfb0836b8e97a5699cb34a6');
    assert.equal(pins.sources.length, 17);
    assert.deepEqual(vendorFiles(), pins.sources.map(s => s.localPath).sort());
    for (const entry of pins.sources) {
      const raw = read(entry.localPath); assert.equal(sha(raw), entry.localSha256); assert.equal(raw.length, entry.localBytes);
      let original = raw;
      if (entry.adaptation) {
        assert.equal(entry.localPath, 'vendor/shadcn-ui/components/ui/dropdown-menu.tsx');
        const text = raw.toString('utf8'); assert.equal(text.split(ownerHeader).length, 2); assert.equal(text.split(omitChecked).length, 2);
        original = Buffer.from(text.replace(ownerHeader, '').replace(omitChecked, 'checked={checked}'));
      }
      assert.equal(sha(original), entry.upstreamSha256); assert.equal(blob(original), entry.upstreamBlobSha1); assert.equal(original.length, entry.upstreamBytes);
    }
    assert.equal(pins.sources.filter(s => s.adaptation).length, 1);
  });

  test('actual import graph is a closed seventeen-file display source; no runtime AI orchestration', () => {
    const sources = new Map(vendorFiles().map(name => [name, read(name).toString('utf8')]));
    const closure = inspectClosure(sources); assert.deepEqual(closure.files, vendorFiles());
    const p = json('package.json');
    for (const name of closure.external) assert.ok(Object.hasOwn(p.dependencies, name), `undeclared dependency ${name}`);
    const bad = new Map(sources); bad.set('vendor/ai-elements/conversation.tsx', sources.get('vendor/ai-elements/conversation.tsx') + '\nimport {generateText} from "ai";');
    assert.throws(() => inspectClosure(bad), /type-only/);
    const missing = new Map(sources); missing.delete('vendor/shadcn-ui/components/ui/input.tsx');
    assert.throws(() => inspectClosure(missing), /missing reachable source/);
  });

  test('allocated package closure and every non-self artifact hash match actual files', () => {
    const pins = json('component-pins.json'); assert.equal(pins.ownedPackageFiles.length, 32);
    assert.deepEqual(packageFiles(), pins.ownedPackageFiles);
    assert.equal(pins.artifacts.length, 31);
    for (const artifact of pins.artifacts) { const raw = read(artifact.path); assert.equal(raw.length, artifact.bytes); assert.equal(sha(raw), artifact.sha256, artifact.path); }
  });

  test('strict compiler checks remain enabled for every actual adopted source', () => {
    const c = json('tsconfig.json').compilerOptions;
    for (const key of ['strict', 'exactOptionalPropertyTypes', 'noUncheckedIndexedAccess', 'noImplicitOverride', 'noFallthroughCasesInSwitch', 'verbatimModuleSyntax', 'isolatedModules', 'forceConsistentCasingInFileNames', 'noEmit']) assert.equal(c[key], true, key);
    assert.equal(c.moduleResolution, 'Bundler'); assert.equal(c.module, 'ESNext');
    assert.deepEqual(json('tsconfig.json').include, ['fixture.tsx', 'vendor/**/*.ts', 'vendor/**/*.tsx']);
  });

  test('exact dependency lock uses registry integrities and actual installed package versions', () => {
    const p = json('package.json'), lock = json('package-lock.json'), pins = json('component-pins.json');
    assert.equal(sha(read('package-lock.json')), pins.packageLockSha256); assert.equal(lock.lockfileVersion, 3);
    assert.deepEqual(lock.packages[''].dependencies, p.dependencies); assert.deepEqual(lock.packages[''].devDependencies, p.devDependencies);
    for (const [name, version] of Object.entries({ ...p.dependencies, ...p.devDependencies })) {
      assert.match(version, /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/);
      assert.equal(lock.packages['node_modules/' + name].version, version);
      const meta = pins.directDependencies.find(d => d.name === name); assert.equal(meta.version, version);
      assert.equal(meta.integrity, lock.packages['node_modules/' + name].integrity); assert.equal(meta.resolved, lock.packages['node_modules/' + name].resolved);
    }
    const entries = Object.entries(lock.packages).filter(([path]) => path); assert.equal(entries.length, 367);
    for (const [path, entry] of entries) {
      assert.match(entry.resolved, /^https:\/\/registry\.npmjs\.org\//); assert.match(entry.integrity, /^sha512-[A-Za-z0-9+/]+=*$/);
      assert.notEqual(entry.link, true); assert.notEqual(entry.hasInstallScript, true);
      assert.equal(json(path + '/package.json').version, entry.version);
    }
    assert.equal(p.dependencies.ai, '7.0.137'); assert.equal(p.dependencies.react, '19.3.0'); assert.equal(p.dependencies.zod, '4.6.5'); assert.equal(p.devDependencies.typescript, '5.9.3');
  });

  test('license/notice inventory checks actual package files and retains complete Apache terms', () => {
    const pins = json('component-pins.json'), text = read('THIRD-PARTY-NOTICES.md').toString('utf8');
    assert.equal(pins.licenseInventory.length, 367); assert.equal(sha(read('THIRD-PARTY-NOTICES.md')), pins.noticesSha256);
    assert.equal(read('LICENSE-AI-ELEMENTS').length, 552); assert.match(text, /upstream attribution header, not the full license/i);
    const full = text.split('<!-- BEGIN EXACT APACHE-2.0 TERMS -->\n')[1]?.split('\n<!-- END EXACT APACHE-2.0 TERMS -->')[0];
    assert.ok(full); assert.equal(sha(Buffer.from(full)), pins.apacheTerms.sha256); assert.equal(Buffer.byteLength(full), 11358);
    assert.match(full, /4\. Redistribution/); assert.match(full, /9\. Accepting Warranty/); assert.match(full, /END OF TERMS AND CONDITIONS/);
    assert.equal(sha(read('LICENSE-SHADCN')), pins.shadcnLicense.sha256);
    assert.match(read('LICENSE-SHADCN').toString('utf8'), /Copyright \(c\) 2023 shadcn/);
    for (const entry of pins.licenseInventory) {
      const actual = json(entry.path + '/package.json'); assert.equal(actual.version, entry.version);
      assert.equal(sha(read(entry.path + '/package.json')), entry.packageJsonSha256);
      assert.deepEqual(actual.license ?? null, entry.declaredLicense);
      for (const notice of entry.files) {
        const raw = read(entry.path + '/' + notice.name); assert.equal(sha(raw), notice.sha256); assert.equal(raw.length, notice.bytes);
        const retained = text.split(`<!-- BEGIN INSTALLED NOTICE ${notice.sha256} -->\n`)[1]?.split(`\n<!-- END INSTALLED NOTICE ${notice.sha256} -->`)[0];
        assert.notEqual(retained, undefined, entry.path + '/' + notice.name);
        assert.equal(sha(Buffer.from(retained)), notice.normalizedSha256);
        assert.equal(retained, new TextDecoder('utf-8', { fatal: true }).decode(raw).replace(/\r\n/g, '\n'));
      }
      if (!entry.files.length) assert.ok(entry.unknowns.includes('No root license/notice text in installed package'));
    }
    const khroma = pins.licenseInventory.find(e => e.name === 'khroma'); assert.equal(khroma.declaredLicense, null); assert.ok(khroma.unknowns.length); assert.ok(khroma.files.some(f => f.name === 'license'));
  });

  test('real Conversation, Message and PromptInput server-render deterministically without network/DOM/provider/native calls', t => {
    const r = ssr(); assert.equal(r.dom, false); assert.equal(r.deterministic, true); assert.deepEqual(r.attempts, []);
    for (const html of r.html) {
      assert.match(html, /role="log"/); assert.match(html, /is-user/); assert.match(html, /is-assistant/); assert.match(html, /data-slot="input-group"/);
      assert.match(html, /<fieldset disabled=""/); assert.match(html, /<textarea[^>]* disabled=""[^>]*readOnly=""/); assert.match(html, /<button[^>]*disabled=""/);
      assert.doesNotMatch(html, /<(?:script|img|iframe|svg|a|pre|code)\b/i);
      const actualTags = (html.match(/<[^>]*>/g) ?? []).join('');
      assert.doesNotMatch(actualTags, /\s(?:href|src|action|onerror|onclick)=/i);
    }
    assert.ok(r.buildInputs.includes('vendor/ai-elements/conversation.tsx'));
    assert.ok(r.buildInputs.includes('vendor/ai-elements/message.tsx'));
    assert.ok(r.buildInputs.includes('vendor/ai-elements/prompt-input.tsx'));
    assert.ok(!r.buildInputs.some(u => /(?:^|\/)node_modules\/(?:ai\/|@ai-sdk\/|@vercel\/oidc\/)/.test(u)), 'type-only AI imports must not load gateway/provider code');
    assert.ok(r.loaded.some(u => u.endsWith('/fixture.cjs'))); assert.ok(r.elapsedMs < 20000);
    t.diagnostic(JSON.stringify({ elapsedMs: r.elapsedMs, loadedModules: r.loaded.length, buildInputs: r.buildInputs.length, deniedAttempts: r.attempts.length }));
  });

  test('hostile HTML, URLs, Markdown and diagram syntax remain escaped plain text in all display slots', () => {
    const r = ssr();
    const escape = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' })[c]);
    for (let i = 0; i < r.inputs.length; i++) for (const text of Object.values(r.inputs[i])) assert.ok(r.html[i].includes(escape(text)), `literal text missing: ${text}`);
    assert.ok(r.html[2].includes('[click](javascript:alert(1))')); assert.ok(r.html[3].includes('```mermaid'));
  });

  test('fixture enables no Markdown, attachment, screenshot, speech, model or durable command control', () => {
    const source = read('fixture.tsx').toString('utf8');
    assert.doesNotMatch(source, /MessageResponse|PromptInputAction|ConversationDownload|fetch\s*\(|useChat|streamText|generateText|dangerouslySetInnerHTML|<a\b|<img\b/);
    assert.match(source, /<fieldset disabled/); assert.match(source, /globalDrop=\{false\}/); assert.match(source, /syncHiddenInput=\{false\}/); assert.match(source, /maxFiles=\{0\}/); assert.match(source, /event\.preventDefault\(\)/);
    const emitted = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    assert.doesNotMatch(emitted, /(?:from|import\()\s*["'](?:ai|@ai-sdk\/|@vercel\/)/);
  });

  test('CSS records real Tailwind4/Streamdown sources while leaving browser styling unqualified', () => {
    const css = read('styles.css').toString('utf8'); assert.match(css, /@import "tailwindcss"/); assert.match(css, /@import "streamdown\/styles.css"/);
    for (const name of ['streamdown', '@streamdown/code', '@streamdown/cjk', '@streamdown/math', '@streamdown/mermaid']) {
      assert.ok(css.includes(`./node_modules/${name}/dist/*.js`)); assert.ok(existsSync(join(HERE, 'node_modules', name, 'dist')));
    }
    assert.match(css, /no CSS processor\/browser build was run/);
  });
}
