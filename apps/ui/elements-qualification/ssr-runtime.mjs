// Fresh guarded execution of a separately prepared, byte-bound real fixture.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import childProcess from 'node:child_process';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import { verifySSRBundle } from './ssr-build.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export function checkSSRDeadline(start, now = performance.now()) {
  assert.ok(Number.isFinite(start) && Number.isFinite(now) && now >= start && now - start < 20000, 'SSR original 20-second deadline exceeded');
}

export function installSSRGuards() {
  const attempts = [];
  // Ordinary functions also intercept constructor calls (WebSocket/Wasm).
  const deny = name => function (..._args) { attempts.push(name); throw new Error(`qualification denies ${name}`); };
  globalThis.fetch = deny('fetch'); globalThis.WebSocket = deny('WebSocket'); globalThis.EventSource = deny('EventSource');
  net.connect = deny('net.connect'); net.createConnection = deny('net.createConnection');
  net.Socket.prototype.connect = deny('Socket.connect'); net.Server.prototype.listen = deny('Server.listen');
  tls.connect = deny('tls.connect');
  for (const module of [http, https]) { module.request = deny('http.request'); module.get = deny('http.get'); }
  for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) childProcess[name] = deny(`child_process.${name}`);
  process.dlopen = deny('native addon');
  for (const name of ['compile', 'compileStreaming', 'instantiate', 'instantiateStreaming', 'Module', 'Instance']) WebAssembly[name] = deny(`WebAssembly.${name}`);
  syncBuiltinESMExports(); return attempts;
}

function bindRuntimeImports(bundleURL, externals, loaded) {
  const allowed = new Set([bundleURL, ...externals.map(x => x.startsWith('node:') ? x : 'node:' + x)]);
  const check = url => assert.ok(allowed.has(url), 'unbound SSR runtime import');
  return registerHooks({
    resolve(specifier, context, next) { const result = next(specifier, context); check(result.url); return result; },
    load(url, context, next) { check(url); loaded.add(url); return next(url, context); },
  });
}

async function render(receiptPath, expectedSha256) {
  const start = performance.now(); let lines = 0, bytes = 0;
  const loaded = new Set();
  const phase = ssrPhase => {
    const row = JSON.stringify({ ssrPhase, elapsedMs: Math.floor(performance.now() - start), loaded: loaded.size }) + '\n';
    if (lines < 64 && bytes + Buffer.byteLength(row) <= 8192) { lines++; bytes += Buffer.byteLength(row); process.stderr.write(row); }
  };
  phase('child-enter');
  const attempts = installSSRGuards(); phase('guards-installed');
  assert.equal(typeof globalThis.window, 'undefined'); assert.equal(typeof globalThis.document, 'undefined');
  const deadline = setTimeout(() => { phase('deadline'); process.exit(124); }, 20000);
  let hooks;
  try {
    phase('deadline-armed');
    const { receipt, bundlePath } = verifySSRBundle({ receiptPath, expectedSha256, packageRoot: HERE });
    const bundleURL = pathToFileURL(bundlePath).href;
    hooks = bindRuntimeImports(bundleURL, receipt.externalImports, loaded);
    checkSSRDeadline(start); phase('fixture-import');
    const kernel = await import(bundleURL);
    const { ElementsFixture, renderToStaticMarkup } = kernel.default;
    assert.equal(typeof ElementsFixture, 'function'); assert.equal(typeof renderToStaticMarkup, 'function');
    checkSSRDeadline(start); phase('fixture-ready');
    const inputs = [
      { userText: 'Synthetic user message', assistantText: 'Synthetic assistant response', promptText: 'Qualification fixture: sending is disabled' },
      { userText: '<script>alert("user")</script>', assistantText: '<img src=x onerror=alert(1)>', promptText: '</textarea><script>prompt()</script>' },
      { userText: '[click](javascript:alert(1))', assistantText: 'https://example.invalid/?q=<b>&x="y"', promptText: '<svg onload=alert(1)>' },
      { userText: '```mermaid\ngraph TD; A-->B\n```', assistantText: '# plain Markdown **stays text**', promptText: 'Quotes \' " & < > and Unicode π 你好' },
    ];
    const html = inputs.map(input => { checkSSRDeadline(start); phase('render'); return renderToStaticMarkup(ElementsFixture(input)); });
    const deterministic = renderToStaticMarkup(ElementsFixture(inputs[0])) === html[0];
    checkSSRDeadline(start);
    // Bind after execution as well; no success for observed source/output drift.
    verifySSRBundle({ receiptPath, expectedSha256, packageRoot: HERE }); checkSSRDeadline(start);
    const buildInputs = Object.keys(JSON.parse(readFileSync(resolve(dirname(receiptPath), 'metafile.json'), 'utf8')).inputs).sort();
    const result = { inputs, html, deterministic, attempts, loaded: [...loaded].sort(), buildInputs, dom: false, elapsedMs: performance.now() - start, receiptSchema: receipt.schema };
    phase('result-ready'); process.stdout.write(JSON.stringify(result)); phase('result-written');
  } finally { hooks?.deregister(); clearTimeout(deadline); phase('cleanup-complete'); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length === 3 && process.argv[2] === '--guard-probe') {
    const attempts = installSSRGuards();
    for (const call of [() => fetch('https://example.invalid'), () => net.connect(1), () => new net.Server().listen(1), () => childProcess.spawn('unqualified'), () => process.dlopen({}, 'unqualified'), () => WebAssembly.compile(new Uint8Array()), () => new WebAssembly.Module(new Uint8Array())]) assert.throws(call, /qualification denies/);
    const hooks = bindRuntimeImports('file:///no-application-loaded.cjs', ['node:crypto'], new Set());
    try {
      await import('node:crypto');
      await assert.rejects(() => import('node:fs'), /unbound SSR runtime import/);
    } finally { hooks.deregister(); }
    console.log(JSON.stringify({ attempts, unboundImportRefused: true }));
  } else {
    assert.equal(process.argv.length, 4, 'usage: node ssr-runtime.mjs RECEIPT SHA256');
    await render(resolve(process.argv[2]), process.argv[3]);
  }
}
