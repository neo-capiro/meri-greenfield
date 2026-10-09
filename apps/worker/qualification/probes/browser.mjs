// Opt-in Playwright MCP browser qualification probe (probe:browser).
//
// NEVER run by `npm test`. Drives @playwright/mcp 0.0.83 -> playwright-core
// 1.64.0-alpha-1790635538000 (Chromium 155.0.8059.12, Chrome-for-Testing) via
// the official @modelcontextprotocol/sdk 1.32.1 Client + StdioClientTransport
// (an adopted diagnostic driver, NOT a second integration).
//
// Non-root, explicit --sandbox, isolated per-probe profile + owned output dir.
// No --no-sandbox, no desktop browser, no second integration, no root. This
// Windows host cannot qualify the target Linux sandbox; the probe is prepared
// and statically inspected and is NOT RUN here.

import { createServer } from 'node:http';
import { mkdirSync, readdirSync, writeFileSync, existsSync, readFileSync, readlinkSync, statSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
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
const BROWSERS_ROOT = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/meri-browsers';
const EXPECTED_CHROMIUM_VERSION = '155.0.8059.12';
const DEADLINE_MS = Number(process.env.MERI_BROWSER_DEADLINE_MS || 120000);
const DOWNLOAD_PAYLOAD = 'meri-loopback-fixture-download\n';

const DISABLING_FLAGS = ['--no-sandbox', '--disable-namespace-sandbox', '--disable-seccomp-filter-sandbox'];

/**
 * Fail-closed parser for the EXACT `### Result` Markdown section emitted by
 * playwright-core Response.serialize. Returns { ok, value, raw, error }.
 * Multiple/missing/empty/malformed Result sections fail; an Error section fails.
 */
export function extractResultSection(text) {
  const raw = typeof text === 'string' ? text : '';
  const sections = [];
  let current = null;
  for (const line of raw.split('\n')) {
    const header = /^###\s+(.+?)\s*$/.exec(line);
    if (header) { current = { title: header[1], lines: [] }; sections.push(current); continue; }
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
    .filter((c) => c && c.type === 'text').map((c) => c.text).join('\n');
  if (result && result.structuredContent && typeof result.structuredContent === 'object') {
    const sc = result.structuredContent;
    return { ok: true, value: Object.prototype.hasOwnProperty.call(sc, 'result') ? sc.result : sc, raw: JSON.stringify(sc).slice(0, 4000), error: null, source: 'structuredContent' };
  }
  return { ...extractResultSection(text), source: 'result-section' };
}

const KNOWN_ROWS = {
  'Layer 1 Sandbox': 'layer1',
  'PID namespaces': 'pidNs',
  'Network namespaces': 'netNs',
  'Seccomp-BPF sandbox': 'seccomp',
  'Seccomp-BPF sandbox supports TSYNC': 'tsync',
};

/**
 * Parse exact two-cell chrome://sandbox rows (Chromium 155 builds a two-cell
 * table via sandbox_internals.ts: label + value). Unknown labels are ignored; a
 * duplicated known label or a known label with an unexpected value is ambiguous.
 * Returns { found, ambiguous }.
 */
export function parseSandboxRows(rows) {
  const found = {};
  const ambiguous = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!Array.isArray(row) || row.length < 2) { ambiguous.push(`malformed row ${JSON.stringify(row).slice(0, 80)}`); continue; }
    const label = String(row[0]).trim();
    const value = String(row[1]).trim();
    const key = KNOWN_ROWS[label];
    if (!key) continue;
    if (found[key] !== undefined) ambiguous.push(`${label} duplicated`);
    found[key] = value;
    if (key === 'layer1' && !['Namespace', 'SUID', 'None'].includes(value)) ambiguous.push(`Layer 1 Sandbox unexpected value ${value}`);
    if (key !== 'layer1' && !['Yes', 'No'].includes(value)) ambiguous.push(`${label} ambiguous value ${value}`);
  }
  return { found, ambiguous };
}

/**
 * Pure sandbox verdict from the exact chrome://sandbox table plus identified
 * /proc process evidence. Requires Layer 1 Sandbox = Namespace or SUID AND
 * Seccomp-BPF sandbox = Yes, and an associated actual browser AND renderer.
 * Missing/ambiguous/None/unknown fails. Requested config is never substituted.
 */
export function assessSandboxEvidence({ sandbox, browser, renderer } = {}) {
  const reasons = [];
  const rows = sandbox && Array.isArray(sandbox.rows) ? sandbox.rows : null;
  if (!sandbox || (!sandbox.text && !rows)) {
    reasons.push('chrome://sandbox evidence unavailable');
  } else if (!rows) {
    reasons.push('chrome://sandbox rows unavailable');
  } else {
    const { found, ambiguous } = parseSandboxRows(rows);
    if (ambiguous.length) reasons.push(`ambiguous chrome://sandbox rows: ${ambiguous.join(', ')}`);
    if (!['Namespace', 'SUID'].includes(found.layer1)) reasons.push(`Layer 1 Sandbox is not Namespace/SUID (${found.layer1})`);
    if (found.seccomp !== 'Yes') reasons.push(`Seccomp-BPF sandbox is not Yes (${found.seccomp})`);
  }
  if (!browser) reasons.push('no identified actual Chromium browser process for this run');
  if (!renderer) reasons.push('no identified actual Chromium renderer process for this run');
  return { ok: reasons.length === 0, reasons };
}

/** Any disabling flag in any process argv. */
export function scanDisablingFlags(processes) {
  const hits = [];
  for (const p of processes || []) for (const flag of p.argv || []) {
    if (DISABLING_FLAGS.some((bad) => flag === bad || flag.startsWith(`${bad}=`))) hits.push({ pid: p.pid, flag });
  }
  return hits;
}

/**
 * Select the actual Chromium processes for THIS run. Executable identity comes
 * from /proc/<pid>/exe, not argv: the MCP Node launcher passes `--browser
 * chromium` yet its exe is node and is rejected. The browser must run our exact
 * profileDir; renderers are associated through real PPid ancestry.
 */
export function identifyAssociatedChromium(processes, { browsersRoot = BROWSERS_ROOT, profileDir } = {}) {
  const all = Array.isArray(processes) ? processes : [];
  const byPid = new Map(all.map((p) => [p.pid, p]));
  const isChromiumExe = (p) => typeof p.exe === 'string' && p.exe.startsWith(browsersRoot)
    && !/(^|[\\/])node(\.exe)?$/.test(p.exe);
  const browsers = all.filter((p) => isChromiumExe(p) && p.type === 'browser' && (p.argv || []).some((a) => typeof a === 'string' && a.includes(profileDir)));
  const browser = browsers[0] || null;
  let renderer = null;
  if (browser) {
    const descends = (p) => {
      let cur = p;
      for (let i = 0; i < 12 && cur; i += 1) {
        if (cur.ppid === browser.pid) return true;
        cur = byPid.get(cur.ppid);
      }
      return false;
    };
    renderer = all.find((p) => /renderer/.test(p.type) && isChromiumExe(p) && descends(p)) || null;
  }
  return { browser, renderer, browsers };
}

/** Read ALL processes from /proc with exe, ppid and --type; no exe filtering here. */
export function readProcesses(procRoot = '/proc') {
  const out = [];
  try {
    for (const pid of readdirSync(procRoot)) {
      if (!/^\d+$/.test(pid)) continue;
      let argv = [];
      try { argv = readFileSync(join(procRoot, pid, 'cmdline'), 'utf8').split('\0').filter(Boolean); } catch { continue; }
      if (argv.length === 0) continue;
      let exe = null;
      try { exe = readlinkSync(join(procRoot, pid, 'exe')); } catch { exe = null; }
      const typeFlag = argv.find((p) => p.startsWith('--type='));
      const status = readProcStatus(pid, procRoot);
      out.push({ pid: Number(pid), ppid: status.ppid, exe, type: typeFlag ? typeFlag.slice('--type='.length).split(',')[0] : 'browser', argv });
    }
  } catch { return []; }
  return out;
}

function readProcStatus(pid, procRoot = '/proc') {
  const result = { ppid: null, fields: {}, uid_map: 'unavailable', gid_map: 'unavailable' };
  try {
    const status = readFileSync(join(procRoot, String(pid), 'status'), 'utf8');
    for (const line of status.split('\n')) {
      const m = /^(PPid|Name|Uid|Gid|CapEff|NoNewPrivs|Seccomp|Seccomp_filters|NSpid):\s*(.*)$/.exec(line);
      if (m) result.fields[m[1]] = m[2].trim();
    }
    result.ppid = result.fields.PPid ? Number(result.fields.PPid) : null;
  } catch {}
  try { result.uid_map = readFileSync(join(procRoot, String(pid), 'uid_map'), 'utf8').trim().slice(0, 200); } catch {}
  try { result.gid_map = readFileSync(join(procRoot, String(pid), 'gid_map'), 'utf8').trim().slice(0, 200); } catch {}
  return result;
}

/** Bounded namespace symlink targets + status/maps for a pid. */
export function readProcEvidence(pid, procRoot = '/proc') {
  const evidence = { namespaces: {}, status: null, uid_map: 'unavailable', gid_map: 'unavailable' };
  try {
    for (const ns of readdirSync(join(procRoot, String(pid), 'ns'))) {
      try { evidence.namespaces[ns] = readlinkSync(join(procRoot, String(pid), 'ns', ns)); } catch { evidence.namespaces[ns] = 'unavailable'; }
    }
  } catch { evidence.namespaces = 'unavailable'; }
  try {
    const status = readFileSync(join(procRoot, String(pid), 'status'), 'utf8');
    evidence.status = status.split('\n').filter((l) => /^(Name|Uid|Gid|CapEff|NoNewPrivs|Seccomp|Seccomp_filters|NSpid):/.test(l)).join(' | ').slice(0, 400);
  } catch { evidence.status = 'unavailable'; }
  try { evidence.uid_map = readFileSync(join(procRoot, String(pid), 'uid_map'), 'utf8').trim().slice(0, 200); } catch {}
  try { evidence.gid_map = readFileSync(join(procRoot, String(pid), 'gid_map'), 'utf8').trim().slice(0, 200); } catch {}
  return evidence;
}

function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }

function startFixtureServer() {
  const server = createServer((req, res) => {
    if (req.url && req.url.startsWith('/download')) {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Disposition': 'attachment; filename="meri-fixture.txt"' });
      res.end(DOWNLOAD_PAYLOAD);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>Meri fixture</title><h1 id="marker">meri-loopback-ok</h1><a id="dl" href="/download">download</a>');
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server)));
}

const SANDBOX_EXPR = '() => ({ text: document.body.innerText, rows: Array.from(document.querySelectorAll("#sandbox-status tr"), (r) => Array.from(r.cells, (c) => c.innerText.trim())), evaluation: document.querySelector("#evaluation")?.innerText })';
const VERSION_EXPR = '() => ({ userAgent: navigator.userAgent, text: document.body.innerText })';

async function main() {
  const reasons = [];
  const evidencePaths = [];
  const evidence = { probe: 'browser', uid: null, serverVersion: null, browserVersion: null, versionData: null, sandbox: null, browserProcess: null, rendererProcess: null, processes: [], procEvidence: {}, download: null, rawResults: {}, reasons, evidencePaths };
  let server = null;
  let client = null;
  let transport = null;
  let stderrText = '';
  let runDir = null;
  let profileDir = null;

  try {
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    evidence.uid = uid;
    if (uid === null) throw new Error('process.getuid() unsupported: cannot prove non-root');
    if (uid === 0) throw new Error('refusing to run browser probe as root (uid 0)');

    runDir = join(OUTPUT_ROOT, `probe-${randomUUID()}`);
    profileDir = join(runDir, 'profile');
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
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: BROWSERS_ROOT },
      stderr: 'pipe',
      cwd: runDir,
    });
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
      const decoded = decodeToolResult(cfg);
      evidence.rawResults.get_config = decoded.raw;
      if (cfg.isError || !decoded.ok) reasons.push('browser_get_config failed');
      else evidence.resolvedConfig = typeof decoded.value === 'object' ? decoded.value : null;
    }

    const nav = await client.callTool({ name: 'browser_navigate', arguments: { url: `http://127.0.0.1:${port}/` } });
    evidence.rawResults.nav = (await decodeToolResult(nav)).raw;
    if (nav.isError) reasons.push(`fixture navigation error: ${evidence.rawResults.nav.slice(0, 200)}`);
    const snap = await client.callTool({ name: 'browser_snapshot', arguments: {} });
    const snapDecoded = decodeToolResult(snap);
    evidence.rawResults.snapshot = snapDecoded.raw.slice(0, 800);
    if (snap.isError || !/meri-loopback-ok/.test(snapDecoded.raw)) reasons.push('fixture navigation did not return the loopback marker');

    const dl = await client.callTool({ name: 'browser_navigate', arguments: { url: `http://127.0.0.1:${port}/download` } });
    evidence.rawResults.download = (await decodeToolResult(dl)).raw;
    if (dl.isError) reasons.push(`download navigation error: ${evidence.rawResults.download.slice(0, 200)}`);
    const downloaded = existsSync(outputDir) ? readdirSync(outputDir).find((f) => /meri-fixture/.test(f)) : undefined;
    if (!downloaded) {
      evidence.download = { found: false };
      reasons.push('loopback download not observed in owned output dir');
    } else {
      const bytes = readFileSync(join(outputDir, downloaded));
      const hash = sha256(bytes);
      const expectedHash = sha256(Buffer.from(DOWNLOAD_PAYLOAD));
      evidence.download = { found: true, file: downloaded, bytes: bytes.length, sha256: hash, expectedSha256: expectedHash, payloadMatches: hash === expectedHash };
      if (hash !== expectedHash) reasons.push('downloaded bytes do not match the known fixture payload');
    }

    const verNav = await client.callTool({ name: 'browser_navigate', arguments: { url: 'chrome://version' } });
    evidence.rawResults.versionNav = (await decodeToolResult(verNav)).raw;
    if (verNav.isError) reasons.push('chrome://version navigation error');
    const verEval = await client.callTool({ name: 'browser_evaluate', arguments: { function: VERSION_EXPR } });
    const verDecoded = decodeToolResult(verEval);
    evidence.rawResults.version = verDecoded.raw;
    if (verEval.isError || !verDecoded.ok || typeof verDecoded.value !== 'object' || verDecoded.value === null || typeof verDecoded.value.userAgent !== 'string') {
      reasons.push('chrome://version evaluate did not return {userAgent,text}');
    } else {
      evidence.versionData = { userAgent: verDecoded.value.userAgent.slice(0, 300), text: String(verDecoded.value.text || '').slice(0, 400) };
      const m = /Chrome\/([0-9][0-9.]*)/.exec(verDecoded.value.userAgent);
      evidence.browserVersion = m ? m[1] : null;
      if (evidence.browserVersion !== EXPECTED_CHROMIUM_VERSION) reasons.push(`browser version ${evidence.browserVersion} != pinned ${EXPECTED_CHROMIUM_VERSION}`);
    }

    const sandboxNav = await client.callTool({ name: 'browser_navigate', arguments: { url: 'chrome://sandbox' } });
    evidence.rawResults.sandboxNav = (await decodeToolResult(sandboxNav)).raw;
    if (sandboxNav.isError) reasons.push('chrome://sandbox navigation error');
    const sandboxEval = await client.callTool({ name: 'browser_evaluate', arguments: { function: SANDBOX_EXPR } });
    const sandboxDecoded = decodeToolResult(sandboxEval);
    evidence.rawResults.sandbox = sandboxDecoded.raw;
    if (sandboxEval.isError || !sandboxDecoded.ok || typeof sandboxDecoded.value !== 'object' || sandboxDecoded.value === null || !Array.isArray(sandboxDecoded.value.rows)) {
      reasons.push('chrome://sandbox evaluate did not return {text,rows,evaluation}');
    } else {
      evidence.sandbox = { text: String(sandboxDecoded.value.text || '').slice(0, 800), rows: sandboxDecoded.value.rows, evaluation: String(sandboxDecoded.value.evaluation || '').slice(0, 300) };
    }

    const processes = readProcesses();
    evidence.processes = processes.map((p) => ({ pid: p.pid, ppid: p.ppid, exe: p.exe, type: p.type, argv: p.argv }));
    const identified = identifyAssociatedChromium(processes, { profileDir });
    evidence.browserProcess = identified.browser ? { pid: identified.browser.pid, exe: identified.browser.exe, argv: identified.browser.argv } : null;
    evidence.rendererProcess = identified.renderer ? { pid: identified.renderer.pid, exe: identified.renderer.exe, type: identified.renderer.type, argv: identified.renderer.argv } : null;
    evidence.effectiveFlagsSource = identified.browser ? 'proc' : 'none';
    evidence.disablingFlags = scanDisablingFlags(processes);
    const selfPid = process.pid;
    for (const [label, pid] of [['self', selfPid], ['browser', identified.browser && identified.browser.pid], ['renderer', identified.renderer && identified.renderer.pid]]) {
      if (pid) evidence.procEvidence[label] = readProcEvidence(pid);
    }

    const verdict = assessSandboxEvidence({ sandbox: evidence.sandbox, browser: identified.browser, renderer: identified.renderer });
    reasons.push(...verdict.reasons);
    if (evidence.disablingFlags.length) reasons.push(`disabling Chromium flags present: ${evidence.disablingFlags.map((d) => d.flag).join(', ')}`);
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
  if (runDir) { try { writeFileSync(join(runDir, 'evidence.json'), JSON.stringify(evidence, null, 2)); } catch {} }
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
