// Opt-in Playwright MCP browser qualification probe (probe:browser).
//
// NEVER run by `npm test`. Requires the selected official integration
// (@playwright/mcp 0.0.83 -> playwright-core 1.64.0-alpha-1790635538000,
// Chromium revision 1247 / 155.0.8059.12) driven through the official
// @modelcontextprotocol/sdk 1.32.1 Client + StdioClientTransport (adopted
// diagnostic driver, NOT a second browser integration).
//
// Runs as non-root with an explicit --sandbox and an isolated per-probe profile
// plus owned output dir. Live output/profiles default under /workspace; the
// authoring host keeps scratch under .runtime. It must never fall back to
// --no-sandbox, a desktop browser, a second Playwright integration, root, or
// extra capabilities. This Windows host cannot qualify the target Linux/Fargate
// sandbox, so the probe is prepared and statically inspected and is NOT RUN here.

import { createServer } from 'node:http';
import { mkdirSync, readdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const IS_LINUX = process.platform === 'linux';
const DEFAULT_OUTPUT_ROOT = IS_LINUX ? '/workspace/qualification-browser' : join(HERE, '..', '.runtime', 'browser');
const OUTPUT_ROOT = process.env.MERI_BROWSER_OUTPUT_DIR || DEFAULT_OUTPUT_ROOT;
const DEADLINE_MS = Number(process.env.MERI_BROWSER_DEADLINE_MS || 120000);

// Affirmative Linux sandbox layers expected on chrome://sandbox. A generic
// 'sandbox'/'yes'/'namespace' token is NOT enough: namespace OR SUID sandbox
// AND Seccomp-BPF must both be affirmatively enabled, and no negative marker.
const NAMESPACE_AFFIRMATIVE = /(namespace|suid|setuid)[^\n]*(yes|enabled|true)/i;
const SECCOMP_AFFIRMATIVE = /seccomp[^\n]*(yes|enabled|true)/i;
const NEGATIVE = /(namespace|suid|setuid|seccomp)[^\n]*\b(no|disabled|false)\b/i;

/**
 * Pure verdict over captured browser evidence. Returns { ok, reasons }.
 * Refuses when the sandbox layers are missing/negative, when flags are not
 * actual process evidence, or when a disabling flag is present.
 */
export function assessSandboxEvidence({ sandboxPageText, effectiveFlags, effectiveFlagsSource } = {}) {
  const reasons = [];
  const text = typeof sandboxPageText === 'string' ? sandboxPageText : '';
  if (!text) {
    reasons.push('chrome://sandbox evidence unavailable');
  } else {
    if (NEGATIVE.test(text)) reasons.push('chrome://sandbox reports a sandbox layer disabled');
    if (!NAMESPACE_AFFIRMATIVE.test(text)) reasons.push('no affirmative namespace/SUID sandbox layer evidence');
    if (!SECCOMP_AFFIRMATIVE.test(text)) reasons.push('no affirmative Seccomp-BPF evidence');
  }
  const flags = Array.isArray(effectiveFlags) ? effectiveFlags : [];
  if (effectiveFlagsSource !== 'proc') {
    reasons.push('effective Chromium flags are not actual process (/proc) evidence');
  }
  if (flags.length === 0) reasons.push('effective Chromium flags absent');
  if (flags.some((f) => /--no-sandbox/.test(f))) reasons.push('effective Chromium flags include --no-sandbox');
  if (flags.some((f) => /--disable-seccomp-filter-sandbox/.test(f))) reasons.push('effective Chromium flags disable the seccomp filter sandbox');
  return { ok: reasons.length === 0, reasons };
}

/** Read actual Chromium process command lines from /proc (empty when unavailable). */
export function readChromiumCmdline(procRoot = '/proc') {
  const out = [];
  try {
    for (const pid of readdirSync(procRoot)) {
      if (!/^\d+$/.test(pid)) continue;
      let raw;
      try {
        raw = readFileSync(join(procRoot, pid, 'cmdline'), 'utf8');
      } catch {
        continue;
      }
      const parts = raw.split('\0').filter(Boolean);
      if (parts.some((p) => /chrom(e|ium)|headless_shell/i.test(p)) && parts.some((p) => p.startsWith('--'))) {
        out.push({ pid, argv: parts });
      }
    }
  } catch {
    return [];
  }
  return out;
}

function toolText(result) {
  return (result && Array.isArray(result.content) ? result.content : [])
    .filter((c) => c && c.type === 'text')
    .map((c) => c.text)
    .join('\n');
}

function startFixtureServer() {
  const server = createServer((req, res) => {
    if (req.url && req.url.startsWith('/download')) {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Disposition': 'attachment; filename="meri-fixture.txt"' });
      res.end('meri-loopback-fixture-download\n');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>Meri fixture</title><h1 id="marker">meri-loopback-ok</h1><a id="dl" href="/download">download</a>');
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server)));
}

async function main() {
  const reasons = [];
  const evidencePaths = [];
  let ok = false;
  let config = null;
  let sandboxPageText = '';
  let effectiveFlags = [];
  let effectiveFlagsSource = 'none';
  let serverVersion = null;
  let toolNames = [];
  let evaluateSchema = null;
  let server = null;
  let client = null;
  let transport = null;
  let stderrText = '';
  let runDir = null;

  try {
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    if (uid === null) throw new Error('process.getuid() unsupported: cannot prove non-root');
    if (uid === 0) throw new Error('refusing to run browser probe as root (uid 0)');

    runDir = join(OUTPUT_ROOT, `probe-${randomUUID()}`);
    const profileDir = join(runDir, 'profile');
    const outputDir = join(runDir, 'output');
    mkdirSync(profileDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    evidencePaths.push(runDir);

    server = await startFixtureServer();
    const port = server.address().port;

    const mcpPkg = require('@playwright/mcp/package.json');
    const mcpDir = dirname(require.resolve('@playwright/mcp/package.json'));
    const mcpCli = join(mcpDir, mcpPkg.bin['playwright-mcp']);

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [mcpCli, '--headless', '--browser', 'chromium', '--sandbox', '--user-data-dir', profileDir, '--output-dir', outputDir],
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/meri-browsers' },
      stderr: 'pipe',
      cwd: runDir,
    });
    client = new Client({ name: 'meri-qualification', version: '0.0.0' });
    await client.connect(transport);
    serverVersion = client.getServerVersion();

    const toolList = await client.listTools();
    toolNames = (toolList.tools || []).map((t) => t.name);
    evaluateSchema = (toolList.tools || []).find((t) => t.name === 'browser_evaluate');

    if (toolNames.includes('browser_get_config')) {
      const cfgResult = await client.callTool({ name: 'browser_get_config', arguments: {} });
      if (!cfgResult.isError) {
        try { config = JSON.parse(toolText(cfgResult)); } catch { config = null; }
      }
    }

    const navResult = await client.callTool({ name: 'browser_navigate', arguments: { url: `http://127.0.0.1:${port}/` } });
    if (navResult.isError) reasons.push(`fixture navigation error: ${toolText(navResult).slice(0, 200)}`);
    const snap = await client.callTool({ name: 'browser_snapshot', arguments: {} });
    if (snap.isError || !/meri-loopback-ok/.test(toolText(snap))) reasons.push('fixture navigation did not return the loopback marker');

    const dlResult = await client.callTool({ name: 'browser_navigate', arguments: { url: `http://127.0.0.1:${port}/download` } });
    if (dlResult.isError) reasons.push(`download navigation error: ${toolText(dlResult).slice(0, 200)}`);
    const downloaded = existsSync(outputDir) && readdirSync(outputDir).some((f) => /meri-fixture/.test(f));
    if (!downloaded) reasons.push('loopback download not observed in owned output dir');

    const sandboxNav = await client.callTool({ name: 'browser_navigate', arguments: { url: 'chrome://sandbox' } });
    if (sandboxNav.isError) reasons.push(`chrome://sandbox navigation error: ${toolText(sandboxNav).slice(0, 200)}`);
    const evalResult = await client.callTool({ name: 'browser_evaluate', arguments: { function: '() => document.body.innerText' } });
    if (evalResult.isError) {
      reasons.push(`chrome://sandbox evaluate error: ${toolText(evalResult).slice(0, 200)}`);
    } else {
      const raw = toolText(evalResult).trim();
      try { sandboxPageText = JSON.parse(raw); } catch { sandboxPageText = raw; }
    }

    const procs = readChromiumCmdline();
    if (procs.length > 0) {
      effectiveFlags = procs[0].argv.filter((a) => a.startsWith('--'));
      effectiveFlagsSource = 'proc';
    }

    if (transport.stderr && typeof transport.stderr.on === 'function') {
      transport.stderr.on('data', (c) => { stderrText += c.toString(); });
    }

    const verdict = assessSandboxEvidence({ sandboxPageText, effectiveFlags, effectiveFlagsSource });
    reasons.push(...verdict.reasons);
    ok = verdict.ok && !reasons.some((r) => /fixture|download/.test(r));

    const evidence = {
      probe: 'browser', ok, uid, serverVersion,
      mcpToolCount: toolNames.length,
      hasGetConfig: toolNames.includes('browser_get_config'),
      hasEvaluate: !!evaluateSchema,
      resolvedConfig: config,
      effectiveFlags, effectiveFlagsSource,
      sandboxPageSample: sandboxPageText.slice(0, 500),
      reasons, evidencePaths,
    };
    writeFileSync(join(runDir, 'evidence.json'), JSON.stringify(evidence, null, 2));
  } catch (error) {
    reasons.push(String(error && error.message ? error.message : error).slice(0, 300));
    ok = false;
  } finally {
    try { if (client) await client.close(); } catch (error) { reasons.push(`client close uncertainty: ${String(error).slice(0, 120)}`); }
    try { if (server) server.close(); } catch {}
    if (stderrText) evidencePaths.push('mcp stderr preserved in summary');
  }

  process.stdout.write(JSON.stringify({
    probe: 'browser',
    ok,
    sandboxVerified: ok,
    uid: typeof process.getuid === 'function' ? process.getuid() : null,
    serverVersion,
    mcpToolCount: toolNames.length,
    hasGetConfig: toolNames.includes('browser_get_config'),
    hasEvaluate: !!evaluateSchema,
    effectiveFlags,
    effectiveFlagsSource,
    resolvedConfigChromiumSandbox: config && config.browser ? config.browser.launchOptions && config.browser.launchOptions.chromiumSandbox : null,
    sandboxPageSample: sandboxPageText.slice(0, 500),
    reasons,
    stderr: stderrText.slice(0, 1000),
    evidencePaths,
  }, null, 2) + '\n');
  process.exit(ok ? 0 : 1);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((error) => {
    process.stdout.write(JSON.stringify({ probe: 'browser', ok: false, reasons: [String(error).slice(0, 300)] }, null, 2) + '\n');
    process.exit(1);
  });
}
