// W02-21 UNQUALIFIED legacy JS mirror of the on-host Python classifier.
// Preserved verbatim from the original app.mjs; Python remains authoritative.
// Importing this module is inert and does not run classification.

const NODE_EXE = /(^|[\\/])node(\.exe)?$/i;
const HEX64 = /^[0-9a-f]{64}$/;
const inRoot = (exe) => typeof exe === 'string' && /^\/opt\/meri-browsers\/chromium-[0-9]+\/chrome-linux\/chrome$/.test(exe);
const isNode = (exe) => typeof exe === 'string' && NODE_EXE.test(exe);
const capZero = (v) => typeof v === 'string' && /^0+$/.test(v);
const threadOk = (t) => capZero(t.capEffHex) && capZero(t.capPrmHex) && t.noNewPrivs === 1 && t.seccomp === 2;
const validUidMap = (t) => typeof t === 'string' && t.trim().split('\n').some((l) => {
  const p = l.trim().split(/\s+/); return p.length >= 3 && p.slice(0, 3).every((x) => /^\d+$/.test(x)) && Number(p[2]) > 0;
});
function descends(proc, targetPid, byPid, maxDepth = 16) {
  let cur = proc, depth = 0;
  while (cur && depth < maxDepth) { if (cur.ppid === targetPid) return true; cur = byPid.get(cur.ppid); depth += 1; }
  return false;
}
const nsOf = (p, k) => (p && p.nsInodes && typeof p.nsInodes === 'object') ? p.nsInodes[k] : undefined;
export function classifyHostEvidence(observation = {}, expected = {}) {
  const o = observation || {}; const exp = expected || {}; const reasons = [];
  const procs = Array.isArray(o.processes) ? o.processes : [];
  const running = Array.isArray(o.runningContainers) ? o.runningContainers : [];
  const boot = o.bootId;
  const byPid = new Map(procs.filter((p) => Number.isInteger(p.pid)).map((p) => [p.pid, p]));
  const mainProc = byPid.get(o.mainPid);
  const baseline = o.containerSeccompFilters;
  const expectedSha = exp.exeSha256 || o.expectedExeSha256;

  if (exp.runId && o.runId !== exp.runId) reasons.push('observation runId does not match the required run');
  if (!o.runId) reasons.push('observation is not bound to a run');
  if (running.length !== 1) reasons.push(`expected exactly one running container this run, saw ${running.length}`);
  const target = running.length === 1 ? running[0] : undefined;
  if (!o.containerId || !target || target.id !== o.containerId) reasons.push('target container is not the single observed running container');
  if (target && o.runId && (target.labels || {})['meri.qualification.run'] !== o.runId) reasons.push('observed container label is not bound to the run');
  if (target && o.runId && !String(target.name || '').includes(o.runId)) reasons.push('observed container name is not bound to the run');
  if (procs.length === 0) reasons.push('no process evidence collected for the target container');
  if (!Number.isInteger(baseline) || baseline < 1) reasons.push('missing positive same-container seccomp baseline');
  if (procs.some((p) => boot && p.bootId && p.bootId !== boot)) reasons.push('process evidence crosses boot ids (possible PID reuse)');
  if (procs.some((p) => p.cgroup && o.containerId && !String(p.cgroup).includes(String(o.containerId).slice(0, 12)) && p.pid !== o.mainPid)) reasons.push('a process is outside the target container cgroup');

  const browser = procs.find((p) => p.type === 'browser' && inRoot(p.exe)) || null;
  const renderer = procs.find((p) => p.type === 'renderer' && inRoot(p.exe)) || null;
  if (procs.some((p) => (p.type === 'browser' || p.type === 'renderer') && isNode(p.exe))) reasons.push('a Node process was misidentified as a browser/renderer');
  if (!browser) reasons.push('no identified actual Chromium browser process for this run');
  if (!renderer) reasons.push('no identified actual Chromium renderer process for this run');

  const checkExe = (p, label) => {
    if (!p) return;
    if (!inRoot(p.exe)) reasons.push(`${label} executable is not the pinned Chromium path`);
    if (!(typeof p.exeSha256 === 'string' && HEX64.test(p.exeSha256))) reasons.push(`${label} executable hash missing/malformed`);
    else if (expectedSha && p.exeSha256 !== expectedSha) reasons.push(`${label} executable hash does not match the pinned value`);
  };
  checkExe(browser, 'browser'); checkExe(renderer, 'renderer');
  if (browser && browser.ppid !== o.mainPid && !descends(browser, o.mainPid, byPid)) reasons.push('browser is not a descendant of the container main process');
  if (browser && renderer && !descends(renderer, browser.pid, byPid)) reasons.push('renderer is not a descendant of the identified browser');

  for (const [label, p] of [['browser', browser], ['renderer', renderer]]) {
    if (!p) continue;
    const threads = Array.isArray(p.threads) ? p.threads : [];
    if (threads.length === 0) { reasons.push(`${label} has no thread evidence`); continue; }
    for (const th of threads) if (!threadOk(th)) reasons.push(`${label} thread ${th.tid} is not capsets0/NoNewPrivs1/Seccomp2`);
    if (!capZero(p.capEffHex) || !capZero(p.capPrmHex)) reasons.push(`${label} retains host capabilities (CapEff/CapPrm != 0)`);
    if (p.noNewPrivs !== 1) reasons.push(`${label} NoNewPrivs is not 1`);
    if (p.seccomp !== 2) reasons.push(`${label} Seccomp mode is not 2`);
  }

  const rendererUserNs = nsOf(renderer, 'user');
  const baselines = new Set([nsOf(mainProc, 'user'), nsOf(browser, 'user')]);
  if (!rendererUserNs) reasons.push('renderer user namespace inode unavailable');
  else if (baselines.has(rendererUserNs)) reasons.push('renderer user namespace is not distinct from the host/container/browser baseline');
  if (!validUidMap(renderer ? renderer.uidMap : null)) reasons.push('renderer user namespace has no valid UID mapping');

  if (renderer) {
    const filters = (renderer.threads || []).map((t) => t.seccompFilters).filter(Number.isInteger);
    if (filters.length === 0) reasons.push('renderer seccomp filter counts unavailable');
    else if (Math.min(...filters) <= (baseline || 0)) reasons.push('renderer seccomp filters do not exceed the container baseline (min across threads)');
  }
  return { ok: reasons.length === 0, reasons, browserPid: browser ? browser.pid : null, rendererPid: renderer ? renderer.pid : null };
}
