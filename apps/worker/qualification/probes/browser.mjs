// Opt-in Playwright MCP browser qualification probe (probe:browser).
//
// NEVER run by `npm test`. Drives @playwright/mcp 0.0.83 -> playwright-core
// 1.64.0-alpha-1790635538000 (Chromium 155.0.8059.12, Chrome-for-Testing) via
// the official @modelcontextprotocol/sdk 1.32.1 Client + StdioClientTransport.
//
// Non-root, explicit --sandbox, isolated per-probe profile + owned output dir.
// No --no-sandbox, no desktop browser, no second integration, no root, no extra
// capabilities. It ALSO reports bounded pre-launch diagnostics (helper alias
// discovery, /proc security fields, mount flags, sysctls and a simple non-root
// libc.unshare(CLONE_NEWUSER) check) and STOPS the browser-dependent sequence
// after the FIRST fatal result. This Windows host cannot qualify the target
// Linux sandbox; the probe is prepared and statically inspected and is NOT RUN.

import { createServer } from 'node:http';
import { mkdirSync, readdirSync, writeFileSync, existsSync, readFileSync, readlinkSync, statSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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

// ---------------------------------------------------------------------------
// MCP Result-section parsing and sandbox rows (fail-closed)
// ---------------------------------------------------------------------------

/**
 * Fail-closed parser for the EXACT `### Result` Markdown section emitted by
 * playwright-core Response.serialize. Returns { ok, value, raw, error }.
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

/** Parse exact two-cell chrome://sandbox rows. Returns { found, ambiguous }. */
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

/** Pure sandbox verdict from the exact table plus identified process evidence. */
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

// ---------------------------------------------------------------------------
// Process identification
// ---------------------------------------------------------------------------

/** Select the actual Chromium processes for THIS run (exe identity, not argv). */
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

/** Read ALL processes from /proc with exe, ppid and --type. */
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
    evidence.status = readFileSync(join(procRoot, String(pid), 'status'), 'utf8').split('\n').filter((l) => /^(Name|Uid|Gid|CapEff|NoNewPrivs|Seccomp|Seccomp_filters|NSpid):/.test(l)).join(' | ').slice(0, 400);
  } catch { evidence.status = 'unavailable'; }
  try { evidence.uid_map = readFileSync(join(procRoot, String(pid), 'uid_map'), 'utf8').trim().slice(0, 200); } catch {}
  try { evidence.gid_map = readFileSync(join(procRoot, String(pid), 'gid_map'), 'utf8').trim().slice(0, 200); } catch {}
  return evidence;
}

function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }

// ---------------------------------------------------------------------------
// Prelaunch diagnostics: helper alias discovery, /proc, mounts, userns check
// ---------------------------------------------------------------------------

/** Bounded depth-first search for a filename under a root. */
export function findFileBounded(root, name, maxDepth = 4) {
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length) {
    const { dir, depth } = stack.pop();
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isFile() && e.name === name) return full;
      if (e.isDirectory() && depth < maxDepth) stack.push({ dir: full, depth: depth + 1 });
    }
  }
  return null;
}

/** Stat + realpath + sha256 for a helper path. */
export function statHelper(path) {
  try {
    const st = statSync(path);
    return { path, realpath: realpathSync(path), uid: st.uid, gid: st.gid, mode: `0${(st.mode & 0o7777).toString(8)}`, sha256: sha256(readFileSync(path)) };
  } catch (error) { return { path, error: String(error && error.message ? error.message : error).slice(0, 160) }; }
}

/** Discover the pinned CFT helper (chrome_sandbox) and its adjacent hyphen alias. */
export function discoverSandboxHelper(browsersRoot = BROWSERS_ROOT, aliasName = 'chrome-sandbox') {
  const pinnedPath = findFileBounded(browsersRoot, 'chrome_sandbox');
  const pinned = pinnedPath ? statHelper(pinnedPath) : { path: null, error: 'chrome_sandbox not found under browsers root' };
  const aliasExpected = pinnedPath ? join(dirname(pinnedPath), aliasName) : null;
  const alias = aliasExpected && existsSync(aliasExpected) ? statHelper(aliasExpected) : { path: aliasExpected, error: 'adjacent chrome-sandbox alias missing' };
  return { pinned, aliasExpected, alias };
}

/**
 * Pure helper-discovery verdict. Chromium 155's setuid host
 * (sandbox/linux/suid/client/setuid_sandbox_host.cc) expects an adjacent
 * `chrome-sandbox` (hyphen); the archive helper is `chrome_sandbox` (underscore)
 * and is never auto-discovered. The alias must match the pinned bytes, be
 * root-owned and mode 4755.
 */
export function classifyHelperDiscovery({ pinned, alias, aliasExpected } = {}) {
  const reasons = [];
  if (!pinned || pinned.error || !pinned.path) reasons.push('pinned chrome_sandbox helper not found');
  if (!aliasExpected) reasons.push('adjacent chrome-sandbox path could not be derived');
  if (!alias || alias.error || !alias.path) reasons.push('adjacent chrome-sandbox alias missing (setuid host expects the hyphen name)');
  else {
    if (pinned && pinned.sha256 && alias.sha256 !== pinned.sha256) reasons.push('alias sha256 differs from the pinned helper');
    if (alias.uid !== 0) reasons.push(`alias not root-owned (uid ${alias.uid})`);
    if (alias.mode !== '04755') reasons.push(`alias mode ${alias.mode} != 04755`);
  }
  return { ok: reasons.length === 0, reasons };
}

/** Parse security-relevant fields from /proc/<pid>/status text. */
export function parseSelfStatus(text) {
  const out = {};
  for (const line of String(text).split('\n')) {
    const m = /^(CapInh|CapPrm|CapEff|CapBnd|CapAmb|NoNewPrivs|TracerPid|Seccomp|Seccomp_filters|Uid|Gid):\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/** Longest-prefix mount flags for a path from /proc/self/mountinfo text. */
export function mountFlagsFor(path, mountinfoText) {
  let best = null;
  for (const line of String(mountinfoText).split('\n')) {
    const parts = line.split(' ');
    if (parts.length < 6) continue;
    const mp = parts[4];
    if (path === mp || path.startsWith(mp.endsWith('/') ? mp : `${mp}/`)) {
      if (!best || mp.length > best.mountPoint.length) best = { mountPoint: mp, options: parts[5].split(',') };
    }
  }
  return best;
}

/** Bounded non-root child: Python3.11 ctypes libc.unshare(CLONE_NEWUSER) check.
 * Retains raw spawn facts (error type/code) plus bounded stdout/stderr, not just
 * a classification. */
export function runUsernsDiagnostic({ pythonBin = 'python3', timeoutMs = 5000 } = {}) {
  const code = "import ctypes,sys\nlibc=ctypes.CDLL('libc.so.6',use_errno=True)\nr=libc.unshare(0x10000000)\nprint('unshare_ret=%d errno=%d' % (r, ctypes.get_errno()))\nsys.exit(0 if r==0 else 3)\n";
  const res = spawnSync(pythonBin, ['-c', code], { encoding: 'utf8', timeout: timeoutMs });
  return {
    status: res.status,
    signal: res.signal,
    timedOut: !!(res.error && res.error.code === 'ETIMEDOUT'),
    error: res.error ? { message: String(res.error.message || res.error).slice(0, 200), code: res.error.code || null, type: res.error.name || null } : null,
    stdout: (res.stdout || '').slice(0, 200),
    stderr: (res.stderr || '').slice(0, 200),
  };
}

/**
 * Classify the simple unshare diagnostic. This is NOT Chromium's full namespace
 * predicate (credentials.cc clone/map/drop/second-unshare) and is NOT a
 * standalone required pass if the browser qualifies by another supported route.
 * A timed-out, signal-killed or spawn-errored child is NEVER classified as ok,
 * regardless of any stdout it may have produced.
 */
export function classifyUnshareDiagnostic({ status, signal, timedOut, stdout, stderr, error } = {}) {
  if (timedOut) return { outcome: 'timeout', newUserNsAsNonRoot: null };
  if (error) return { outcome: 'spawn-error', newUserNsAsNonRoot: null, error: error.code || error.message || 'unknown' };
  if (signal) return { outcome: `signal:${signal}`, newUserNsAsNonRoot: null };
  const m = /unshare_ret=(-?\d+) errno=(\d+)/.exec(String(stdout || ''));
  if (status === 0 && m && m[1] === '0') return { outcome: 'unshare-newuserns-ok', newUserNsAsNonRoot: true, errno: Number(m[2]) };
  if (m && m[1] !== '0') return { outcome: 'unshare-newuserns-denied', newUserNsAsNonRoot: false, errno: Number(m[2]), note: 'simple check only; not Chromium full predicate' };
  return { outcome: 'unavailable', newUserNsAsNonRoot: null, stderr: String(stderr || '').slice(0, 200) };
}

/** Browser-dependent steps after launch, in order (granular actual MCP substeps). */
export function planBrowserSteps() {
  return ['get_config', 'nav-fixture', 'snapshot', 'download-nav', 'download-bytes', 'version-nav', 'version-eval', 'sandbox-nav', 'sandbox-eval'];
}

/** True when an MCP tool result carries an isError flag or an actual `### Error` section. */
export function hasActualError(result) {
  if (!result || result.isError) return true;
  const text = (result && Array.isArray(result.content) ? result.content : []).filter((c) => c && c.type === 'text').map((c) => c.text).join('\n');
  return /^###\s+Error\s*$/m.test(text);
}

/** Decide whether the browser-dependent sequence must stop after a step. */
export function shouldStopAfter(step, { isError, decodedOk } = {}) {
  if (step === 'browser_get_config' || step === 'get_config') return !!isError || decodedOk === false;
  return !!isError;
}

/**
 * Small actual sequence driver. Each step is { name, run: async () => ({ fatal, detail }) }.
 * After the FIRST fatal step, NO later step's run() is invoked; remaining steps
 * are recorded as not-run. main() and the offline fake-client fixtures use this
 * SAME path, so a fixture that makes an early step fatal asserts that no later
 * MCP callback is executed.
 */
export async function runBoundedSequence(steps) {
  const order = steps.map((s) => s.name);
  const ran = [];
  const notRun = [];
  const details = {};
  let stoppedAfter = null;
  for (const step of steps) {
    if (stoppedAfter) { notRun.push(step.name); continue; }
    ran.push(step.name);
    const res = (await step.run()) || {};
    details[step.name] = res.detail === undefined ? null : res.detail;
    if (res.fatal) stoppedAfter = step.name;
  }
  return { order, ran, notRun, stoppedAfter, details };
}

/** Discover the installed Chrome-for-Testing executable under the browsers root. */
export function discoverChrome(browsersRoot = BROWSERS_ROOT) {
  const chromePath = findFileBounded(browsersRoot, 'chrome');
  return chromePath ? statHelper(chromePath) : { path: null, error: 'chrome executable not found under browsers root' };
}

/** Collect bounded prelaunch diagnostics (no browser launch). */
export function collectPrelaunchDiagnostics({ browsersRoot = BROWSERS_ROOT } = {}) {
  const discovery = discoverSandboxHelper(browsersRoot);
  const helperVerdict = classifyHelperDiscovery(discovery);
  const chrome = discoverChrome(browsersRoot);
  let mountinfo = '';
  try { mountinfo = readFileSync('/proc/self/mountinfo', 'utf8'); } catch {}
  let selfStatus = '';
  try { selfStatus = readFileSync('/proc/self/status', 'utf8'); } catch {}
  let uidMap = 'unavailable';
  let gidMap = 'unavailable';
  try { uidMap = readFileSync('/proc/self/uid_map', 'utf8').trim().slice(0, 200); } catch {}
  try { gidMap = readFileSync('/proc/self/gid_map', 'utf8').trim().slice(0, 200); } catch {}
  const sysctls = {};
  for (const k of ['kernel.unprivileged_userns_clone', 'user.max_user_namespaces', 'kernel.unprivileged_bpf_disabled', 'kernel.apparmor_restrict_unprivileged_userns']) {
    try { sysctls[k] = readFileSync(`/proc/sys/${k.replace(/\./g, '/')}`, 'utf8').trim(); } catch { sysctls[k] = 'unavailable'; }
  }
  const helperPathForMount = (discovery.alias && discovery.alias.path) || (discovery.pinned && discovery.pinned.path) || '/';
  const usernsRaw = runUsernsDiagnostic();
  return {
    discovery,
    helperVerdict,
    chrome,
    selfStatus: parseSelfStatus(selfStatus),
    selfUidMap: uidMap,
    selfGidMap: gidMap,
    helperMount: mountFlagsFor(helperPathForMount, mountinfo),
    chromeMount: chrome && chrome.path ? mountFlagsFor(chrome.path, mountinfo) : null,
    rootMount: mountFlagsFor('/', mountinfo),
    sysctls,
    usernsRaw,
    userns: classifyUnshareDiagnostic(usernsRaw),
  };
}

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

/** Concatenate an MCP tool result's text content (no Result-section requirement). */
export function decodeRawText(result) {
  return (result && Array.isArray(result.content) ? result.content : []).filter((c) => c && c.type === 'text').map((c) => c.text).join('\n');
}

/**
 * Build the granular browser-dependent steps shared by main() and the offline
 * fake-client fixtures. `callTool(name, args)` is the injected MCP call; `io`
 * supplies port/outputDir plus readdir/exists/readFile/sha256/expectedVersion.
 * Nav/snapshot successes often have NO Result section, so only an isError flag,
 * an actual Error section or a missing required marker is fatal for them;
 * structured browser_evaluate stays strict (decodeToolResult).
 */
export function buildBrowserSteps({ callTool, toolNames = [], evidence, reasons, io = {} }) {
  const { port, outputDir } = io;
  const exists = io.exists || existsSync;
  const readDir = io.readdir || readdirSync;
  const readFile = io.readFile || readFileSync;
  const sha = io.sha256 || sha256;
  const expectedVersion = io.expectedVersion || EXPECTED_CHROMIUM_VERSION;
  const wantsConfig = toolNames.length === 0 || toolNames.includes('browser_get_config');
  return [
    { name: 'get_config', run: async () => {
      if (!wantsConfig) return { fatal: false, detail: 'browser_get_config tool absent' };
      const cfg = await callTool('browser_get_config', {});
      const decoded = decodeToolResult(cfg);
      evidence.rawResults.get_config = decoded.raw;
      if (hasActualError(cfg) || !decoded.ok) { reasons.push('browser_get_config failed'); return { fatal: true, detail: decoded.error || 'isError' }; }
      evidence.resolvedConfig = typeof decoded.value === 'object' ? decoded.value : null;
      return { fatal: false, detail: 'ok' };
    } },
    { name: 'nav-fixture', run: async () => {
      const nav = await callTool('browser_navigate', { url: `http://127.0.0.1:${port}/` });
      evidence.rawResults.nav = decodeRawText(nav).slice(0, 4000);
      if (hasActualError(nav)) { reasons.push(`fixture navigation error: ${evidence.rawResults.nav.slice(0, 200)}`); return { fatal: true, detail: 'navigation error' }; }
      return { fatal: false, detail: 'ok' };
    } },
    { name: 'snapshot', run: async () => {
      const snap = await callTool('browser_snapshot', {});
      const raw = decodeRawText(snap);
      evidence.rawResults.snapshot = raw.slice(0, 800);
      if (hasActualError(snap) || !/meri-loopback-ok/.test(raw)) { reasons.push('fixture navigation did not return the loopback marker'); return { fatal: true, detail: 'missing marker' }; }
      return { fatal: false, detail: 'marker present' };
    } },
    { name: 'download-nav', run: async () => {
      const dl = await callTool('browser_navigate', { url: `http://127.0.0.1:${port}/download` });
      evidence.rawResults.download = decodeRawText(dl).slice(0, 4000);
      if (hasActualError(dl)) { reasons.push(`download navigation error: ${evidence.rawResults.download.slice(0, 200)}`); return { fatal: true, detail: 'download nav error' }; }
      return { fatal: false, detail: 'ok' };
    } },
    { name: 'download-bytes', run: async () => {
      const downloaded = exists(outputDir) ? readDir(outputDir).find((f) => /meri-fixture/.test(f)) : undefined;
      if (!downloaded) { evidence.download = { found: false }; reasons.push('loopback download not observed in owned output dir'); return { fatal: true, detail: 'no download' }; }
      const bytes = readFile(join(outputDir, downloaded));
      const hash = sha(bytes);
      const expectedHash = sha(Buffer.from(DOWNLOAD_PAYLOAD));
      evidence.download = { found: true, file: downloaded, bytes: bytes.length, sha256: hash, expectedSha256: expectedHash, payloadMatches: hash === expectedHash };
      if (hash !== expectedHash) { reasons.push('downloaded bytes do not match the known fixture payload'); return { fatal: true, detail: 'hash mismatch' }; }
      return { fatal: false, detail: 'bytes match' };
    } },
    { name: 'version-nav', run: async () => {
      const verNav = await callTool('browser_navigate', { url: 'chrome://version' });
      evidence.rawResults.versionNav = decodeRawText(verNav).slice(0, 4000);
      if (hasActualError(verNav)) { reasons.push('chrome://version navigation error'); return { fatal: true, detail: 'version nav error' }; }
      return { fatal: false, detail: 'ok' };
    } },
    { name: 'version-eval', run: async () => {
      const verEval = await callTool('browser_evaluate', { function: VERSION_EXPR });
      const verDecoded = decodeToolResult(verEval);
      evidence.rawResults.version = verDecoded.raw.slice(0, 4000);
      if (hasActualError(verEval) || !verDecoded.ok || typeof verDecoded.value !== 'object' || verDecoded.value === null || typeof verDecoded.value.userAgent !== 'string') { reasons.push('chrome://version evaluate did not return {userAgent,text}'); return { fatal: true, detail: 'version eval failed' }; }
      evidence.versionData = { userAgent: verDecoded.value.userAgent.slice(0, 300), text: String(verDecoded.value.text || '').slice(0, 400) };
      const m = /Chrome\/([0-9][0-9.]*)/.exec(verDecoded.value.userAgent);
      evidence.browserVersion = m ? m[1] : null;
      if (evidence.browserVersion !== expectedVersion) { reasons.push(`browser version ${evidence.browserVersion} != pinned ${expectedVersion}`); return { fatal: true, detail: 'version mismatch' }; }
      return { fatal: false, detail: evidence.browserVersion };
    } },
    { name: 'sandbox-nav', run: async () => {
      const sandboxNav = await callTool('browser_navigate', { url: 'chrome://sandbox' });
      evidence.rawResults.sandboxNav = decodeRawText(sandboxNav).slice(0, 4000);
      if (hasActualError(sandboxNav)) { reasons.push('chrome://sandbox navigation error'); return { fatal: true, detail: 'sandbox nav error' }; }
      return { fatal: false, detail: 'ok' };
    } },
    { name: 'sandbox-eval', run: async () => {
      const sandboxEval = await callTool('browser_evaluate', { function: SANDBOX_EXPR });
      const sandboxDecoded = decodeToolResult(sandboxEval);
      evidence.rawResults.sandbox = sandboxDecoded.raw.slice(0, 4000);
      if (hasActualError(sandboxEval) || !sandboxDecoded.ok || typeof sandboxDecoded.value !== 'object' || sandboxDecoded.value === null || !Array.isArray(sandboxDecoded.value.rows)) { reasons.push('chrome://sandbox evaluate did not return {text,rows,evaluation}'); return { fatal: true, detail: 'sandbox eval failed' }; }
      evidence.sandbox = { text: String(sandboxDecoded.value.text || '').slice(0, 800), rows: sandboxDecoded.value.rows, evaluation: String(sandboxDecoded.value.evaluation || '').slice(0, 300) };
      return { fatal: false, detail: 'rows captured' };
    } },
  ];
}

async function main() {
  const reasons = [];
  const evidencePaths = [];
  const evidence = { probe: 'browser', uid: null, serverVersion: null, browserVersion: null, versionData: null, sandbox: null, browserProcess: null, rendererProcess: null, processes: [], procEvidence: {}, download: null, rawResults: {}, prelaunch: null, stepSequence: null, reasons, evidencePaths };
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

    evidence.prelaunch = collectPrelaunchDiagnostics();

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

    // Browser-dependent sequence: the SAME bounded driver used by the offline
    // fake-client fixtures. After the FIRST fatal substep, no later MCP call runs.
    const callTool = (name, args) => client.callTool({ name, arguments: args });
    const steps = buildBrowserSteps({ callTool, toolNames, evidence, reasons, io: { port, outputDir } });
    evidence.stepSequence = await runBoundedSequence(steps);

    const processes = readProcesses();
    evidence.processes = processes.map((p) => ({ pid: p.pid, ppid: p.ppid, exe: p.exe, type: p.type, argv: p.argv }));
    const identified = identifyAssociatedChromium(processes, { profileDir });
    evidence.browserProcess = identified.browser ? { pid: identified.browser.pid, exe: identified.browser.exe, argv: identified.browser.argv } : null;
    evidence.rendererProcess = identified.renderer ? { pid: identified.renderer.pid, exe: identified.renderer.exe, type: identified.renderer.type, argv: identified.renderer.argv } : null;
    evidence.effectiveFlagsSource = identified.browser ? 'proc' : 'none';
    evidence.disablingFlags = scanDisablingFlags(processes);
    for (const [label, pid] of [['self', process.pid], ['browser', identified.browser && identified.browser.pid], ['renderer', identified.renderer && identified.renderer.pid]]) {
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
