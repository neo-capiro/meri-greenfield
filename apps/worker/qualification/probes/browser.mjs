// Opt-in Playwright MCP browser qualification probe (probe:browser).
//
// NEVER run by `npm test`. Drives the selected official integration
// (@playwright/mcp 0.0.83 -> playwright-core 1.64.0-alpha-1790635538000,
// Chromium revision 1247 / 155.0.8059.12) through the official
// @modelcontextprotocol/sdk 1.32.1 Client + StdioClientTransport (an adopted
// diagnostic driver, NOT a second browser integration).
//
// Non-root, explicit --sandbox, isolated per-probe profile + owned output dir.
// Live output/profiles default under /workspace; authoring host uses .runtime.
// No --no-sandbox, no desktop browser, no second integration, no root, no extra
// capabilities. This Windows host cannot qualify the target Linux sandbox, so
// the probe is prepared and statically inspected and is NOT RUN here.

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

const DISABLING_FLAGS = ['--no-sandbox', '--disable-namespace-sandbox', '--disable-seccomp-filter-sandbox'];

/**
 * Fail-closed parser for the EXACT `### Result` Markdown section emitted by
 * playwright-core Response.serialize (framed output includes other sections such
 * as `### Ran Playwright code`). Returns { ok, value, raw, error }. Multiple,
 * missing, empty, or malformed Result sections fail; an Error section fails.
 */
export function extractResultSection(text) {
  const raw = typeof text === 'string' ? text : '';
  const sections = [];
  let current = null;
  for (const line of raw.split('\n')) {
    const header = /^###\s+(.+?)\s*$/.exec(line);
    if (header) {
      current = { title: header[1], lines: [] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  const errors = sections.filter((s) => s.title === 'Error');
  const results = sections.filter((s) => s.title === 'Result');
  if (errors.length > 0) return { ok: false, value: null, raw: raw.slice(0, 4000), error: 'MCP response contains an Error section' };
  if (results.length === 0) return { ok: false, value: null, raw: raw.slice(0, 4000), error: 'missing Result section' };
  if (results.length > 1) return { ok: false, value: null, raw: raw.slice(0, 4000), error: 'duplicate Result section' };
  const body = results[0].lines.join('\n').trim();
  if (!body) return { ok: false, value: null, raw: raw.slice(0, 4000), error: 'empty Result section' };
  try {
    return { ok: true, value: JSON.parse(body), raw: raw.slice(0, 4000), error: null };
  } catch (error) {
    return { ok: false, value: null, raw: raw.slice(0, 4000), error: `malformed Result JSON: ${String(error && error.message ? error.message : error).slice(0, 120)}` };
  }
}

/** Decode an MCP tool result: prefer structuredContent, else the Result section. */
export function decodeToolResult(result) {
  const text = (result && Array.isArray(result.content) ? result.content : [])
    .filter((c) => c && c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  if (result && result.structuredContent && typeof result.structuredContent === 'object') {
    const sc = result.structuredContent;
    return { ok: true, value: Object.prototype.hasOwnProperty.call(sc, 'result') ? sc.result : sc, raw: JSON.stringify(sc).slice(0, 4000), error: null, source: 'structuredContent' };
  }
  return { ...extractResultSection(text), source: 'result-section' };
}

/**
 * Parse exact chrome://sandbox rows. Recognises only the known labels; a known
 * label with a non-Yes/No value, or a duplicated label, is ambiguous and cannot
 * pass. Unknown rows are ignored. Returns { found, ambiguous }.
 */
export function parseSandboxRows(text) {
  const labels = {
    namespace: /^Namespace Sandbox:\s*(Yes|No)\s*$/i,
    suid: /^SUID Sandbox:\s*(Yes|No)\s*$/i,
    seccomp: /^Seccomp-BPF Sandbox:\s*(Yes|No)\s*$/i,
  };
  const found = {};
  const ambiguous = [];
  for (const rawLine of String(text).split('\n')) {
    const line = rawLine.trim();
    for (const [key, re] of Object.entries(labels)) {
      const m = re.exec(line);
      if (m) {
        if (found[key] !== undefined) ambiguous.push(`${key} duplicated`);
        found[key] = m[1].toLowerCase() === 'yes';
      }
    }
    const label = /^(Namespace Sandbox|SUID Sandbox|Seccomp-BPF Sandbox)\s*:\s*(.*)$/i.exec(line);
    if (label && !/^(yes|no)$/i.test(label[2].trim())) ambiguous.push(`${label[1]} ambiguous value`);
  }
  return { found, ambiguous };
}

/**
 * Pure sandbox verdict. Requires (Namespace Sandbox OR SUID Sandbox) enabled
 * AND Seccomp-BPF Sandbox enabled from the actual page, plus actual /proc
 * Chromium process evidence with no disabling flag anywhere. Requested config
 * alone is never accepted. A disabled unused alternative layer is allowed.
 */
export function assessSandboxEvidence({ sandboxPageText, processes, effectiveFlagsSource } = {}) {
  const reasons = [];
  const text = typeof sandboxPageText === 'string' ? sandboxPageText : '';
  if (!text) {
    reasons.push('chrome://sandbox evidence unavailable');
  } else {
    const { found, ambiguous } = parseSandboxRows(text);
    if (ambiguous.length) reasons.push(`ambiguous chrome://sandbox rows: ${ambiguous.join(', ')}`);
    if (found.namespace !== true && found.suid !== true) reasons.push('neither Namespace Sandbox nor SUID Sandbox is affirmatively enabled');
    if (found.seccomp !== true) reasons.push('Seccomp-BPF Sandbox is not affirmatively enabled');
  }
  const procs = Array.isArray(processes) ? processes : [];
  if (effectiveFlagsSource !== 'proc' || procs.length === 0) reasons.push('no actual /proc Chromium process evidence');
  const disabling = scanDisablingFlags(procs);
  if (disabling.length) reasons.push(`disabling Chromium flags present: ${disabling.map((d) => d.flag).join(', ')}`);
  return { ok: reasons.length === 0, reasons };
}

/** Find any disabling flag in any process argv. */
export function scanDisablingFlags(processes) {
  const hits = [];
  for (const p of processes || []) {
    for (const flag of p.argv || []) {
      if (DISABLING_FLAGS.some((bad) => flag === bad || flag.startsWith(`${bad}=`))) hits.push({ pid: p.pid, flag });
    }
  }
  return hits;
}

/** Read ALL Chromium processes from /proc, distinguishing browser vs renderer. */
export function readChromiumProcesses(procRoot = '/proc') {
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
      const argv = raw.split('\0').filter(Boolean);
      if (!argv.some((p) => /chrom(e|ium)|headless_shell/i.test(p)) || !argv.some((p) => p.startsWith('--'))) continue;
      const typeFlag = argv.find((p) => p.startsWith('--type='));
      out.push({ pid: Number(pid), type: typeFlag ? typeFlag.slice('--type='.length).split(',')[0] : 'browser', argv });
    }
  } catch {
    return [];
  }
  return out;
}

/** Bounded /proc status + namespace evidence for a pid. */
export function readProcEvidence(pid, procRoot = '/proc') {
  const evidence = {};
  try {
    const status = readFileSync(join(procRoot, String(pid), 'status'), 'utf8');
    evidence.status = status.split('\n').filter((l) => /^(Name|Seccomp|NSpid|NoNewPrivs):/.test(l)).join(' | ').slice(0, 300);
  } catch { evidence.status = 'unavailable'; }
  try {
    evidence.namespaces = readdirSync(join(procRoot, String(pid), 'ns')).sort();
  } catch { evidence.namespaces = []; }
  return evidence;
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
  const evidence = { probe: 'browser', uid: null, serverVersion: null, browserVersion: null, chromeVersionSample: '', tools: [], resolvedConfig: null, effectiveFlagsSource: 'none', processes: [], procEvidence: [], sandboxRows: null, sandboxPageSample: '', rawResults: {}, reasons, evidencePaths };
  let server = null;
  let client = null;
  let transport = null;
  let stderrText = '';
  let runDir = null;

  try {
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    evidence.uid = uid;
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
    // Attach the stderr listener immediately, BEFORE connect, so early errors
    // are preserved even if connect or the first tool call fails.
    if (transport.stderr && typeof transport.stderr.on === 'function') {
      transport.stderr.on('data', (c) => { stderrText += c.toString(); });
    }

    client = new Client({ name: 'meri-qualification', version: '0.0.0' });
    await client.connect(transport);
    evidence.serverVersion = client.getServerVersion();
    const toolList = await client.listTools();
    const toolNames = (toolList.tools || []).map((t) => t.name);
    evidence.tools = toolNames;

    if (toolNames.includes('browser_get_config')) {
      const cfg = await client.callTool({ name: 'browser_get_config', arguments: {} });
      if (cfg.isError) reasons.push('browser_get_config returned isError');
      else {
        const decoded = decodeToolResult(cfg);
        if (!decoded.ok) reasons.push(`browser_get_config decode failed: ${decoded.error}`);
        else if (decoded.value === null || typeof decoded.value !== 'object') reasons.push('browser_get_config did not return an object');
        else evidence.resolvedConfig = decoded.value;
        evidence.rawResults.get_config = decoded.raw;
      }
    }

    const nav = await client.callTool({ name: 'browser_navigate', arguments: { url: `http://127.0.0.1:${port}/` } });
    if (nav.isError) reasons.push(`fixture navigation error: ${decodeToolResult(nav).raw.slice(0, 200)}`);
    const snap = await client.callTool({ name: 'browser_snapshot', arguments: {} });
    if (snap.isError || !/meri-loopback-ok/.test(decodeToolResult(snap).raw)) reasons.push('fixture navigation did not return the loopback marker');
    evidence.rawResults.snapshot = decodeToolResult(snap).raw.slice(0, 800);

    const dl = await client.callTool({ name: 'browser_navigate', arguments: { url: `http://127.0.0.1:${port}/download` } });
    if (dl.isError) reasons.push(`download navigation error: ${decodeToolResult(dl).raw.slice(0, 200)}`);
    if (!(existsSync(outputDir) && readdirSync(outputDir).some((f) => /meri-fixture/.test(f)))) reasons.push('loopback download not observed in owned output dir');

    const versionNav = await client.callTool({ name: 'browser_navigate', arguments: { url: 'chrome://version' } });
    if (versionNav.isError) reasons.push('chrome://version navigation error');
    const versionEval = await client.callTool({ name: 'browser_evaluate', arguments: { function: '() => document.body.innerText' } });
    if (versionEval.isError) {
      reasons.push('chrome://version evaluate error');
    } else {
      const decoded = decodeToolResult(versionEval);
      evidence.rawResults.version = decoded.raw;
      if (!decoded.ok || typeof decoded.value !== 'string') reasons.push('chrome://version evaluate did not return a string');
      else {
        evidence.chromeVersionSample = decoded.value.slice(0, 400);
        const m = /Google Chrome\s+([0-9][0-9.]*)/.exec(decoded.value);
        evidence.browserVersion = m ? m[1] : null;
        if (!evidence.browserVersion) reasons.push('could not read the actual Chromium version from chrome://version');
      }
    }

    const sandboxNav = await client.callTool({ name: 'browser_navigate', arguments: { url: 'chrome://sandbox' } });
    if (sandboxNav.isError) reasons.push('chrome://sandbox navigation error');
    const sandboxEval = await client.callTool({ name: 'browser_evaluate', arguments: { function: '() => document.body.innerText' } });
    let sandboxPageText = '';
    if (sandboxEval.isError) {
      reasons.push('chrome://sandbox evaluate error');
    } else {
      const decoded = decodeToolResult(sandboxEval);
      evidence.rawResults.sandbox = decoded.raw;
      if (!decoded.ok || typeof decoded.value !== 'string') reasons.push('chrome://sandbox evaluate did not return a string');
      else sandboxPageText = decoded.value;
    }
    evidence.sandboxPageSample = sandboxPageText.slice(0, 600);
    evidence.sandboxRows = parseSandboxRows(sandboxPageText).found;

    const processes = readChromiumProcesses();
    evidence.processes = processes.map((p) => ({ pid: p.pid, type: p.type, argv: p.argv.slice(0, 40) }));
    evidence.effectiveFlagsSource = processes.length > 0 ? 'proc' : 'none';
    evidence.browserProcessFlags = (processes.find((p) => p.type === 'browser') || processes[0] || { argv: [] }).argv.filter((a) => a.startsWith('--'));
    evidence.procEvidence = processes.slice(0, 4).map((p) => ({ pid: p.pid, type: p.type, ...readProcEvidence(p.pid) }));

    const verdict = assessSandboxEvidence({ sandboxPageText, processes, effectiveFlagsSource: evidence.effectiveFlagsSource });
    reasons.push(...verdict.reasons);
  } catch (error) {
    reasons.push(String(error && error.message ? error.message : error).slice(0, 300));
  } finally {
    try { if (client) await client.close(); } catch (error) { reasons.push(`client close uncertainty: ${String(error).slice(0, 160)}`); }
    try { if (server) server.close(); } catch {}
    if (stderrText) evidencePaths.push('mcp stderr preserved in stdout summary');
  }

  const ok = reasons.length === 0;
  evidence.ok = ok;
  evidence.sandboxVerified = ok;
  evidence.stderr = stderrText.slice(0, 2000);
  if (runDir) {
    try { writeFileSync(join(runDir, 'evidence.json'), JSON.stringify(evidence, null, 2)); } catch {}
  }
  process.stdout.write(JSON.stringify(evidence, null, 2) + '\n');
  process.exit(ok ? 0 : 1);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((error) => {
    process.stdout.write(JSON.stringify({ probe: 'browser', ok: false, reasons: [String(error).slice(0, 300)] }, null, 2) + '\n');
    process.exit(1);
  });
}
