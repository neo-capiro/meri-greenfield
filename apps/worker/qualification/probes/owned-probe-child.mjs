// Qualification-only owned child supervision. Scripted ports test policy; only
// target-native close plus positive group absence can supply physical evidence.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = new Set(['browser.mjs', 'artifacts.mjs']);
export const MAX_CHILD_STDOUT = 4 * 1024 * 1024;
export const MAX_CHILD_STDERR = 64 * 1024;

export function defaultGroupKill(child, signal = 'SIGKILL') {
  if (!child) return false;
  if (process.platform === 'linux') {
    if (!Number.isInteger(child.pid) || child.pid <= 1) return false;
    try { process.kill(-child.pid, signal); return true; } catch { return false; }
  }
  try { return typeof child.kill === 'function' && child.kill(signal) === true; } catch { return false; }
}
export function defaultProbeGroup(child) {
  if (!child) return undefined;
  if (process.platform === 'linux') {
    if (!Number.isInteger(child.pid) || child.pid <= 1) return undefined;
    try { process.kill(-child.pid, 0); return true; } catch (error) { return error?.code === 'ESRCH' ? false : undefined; }
  }
  // Non-Linux qualification observes direct child close only, not a process tree.
  return false;
}

export function runOwnedProbeChild({ script, deadlineMs = 120000, spawnFn = spawn,
  env = process.env, graceMs = 5000, groupKill = defaultGroupKill,
  probeGroup = defaultProbeGroup, detached, signal } = {}) {
  const reject = (error) => Promise.resolve({ status: null, signal: null, timedOut: false,
    cleanupConfirmed: false, error, stdout: '', stderr: '' });
  if (!SCRIPTS.has(script)) return reject('probe script is not allowlisted');
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0 || deadlineMs > 180000) return reject('invalid child deadline');
  if (!Number.isFinite(graceMs) || graceMs <= 0 || graceMs > 5000) return reject('invalid cleanup grace');
  const useDetached = detached === undefined ? process.platform === 'linux' : detached;
  if (typeof useDetached !== 'boolean' || (process.platform === 'linux' && !useDetached)) return reject('Linux owned group requires detached child');
  if (signal?.aborted) return reject('child aborted before spawn');
  return new Promise((resolve) => {
    const deadlineAt = performance.now() + deadlineMs;
    let child;
    try { child = spawnFn(process.execPath, [join(HERE, script)], { env: { ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: useDetached }); }
    catch (error) { resolve({ status: null, signal: null, timedOut: false, cleanupConfirmed: false, error: String(error?.message || error), stdout: '', stderr: '' }); return; }
    let stdout = '', stderr = '', stdoutBytes = 0, stderrBytes = 0;
    let settled = false, closed = false, exited = null, timedOut = false, aborted = false;
    let overflow = false, error = null, killRequested = false, groupKillOk = null;
    let deadlineTimer, graceTimer, pollTimer;
    const finish = (cleanupConfirmed, fallback) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadlineTimer); clearTimeout(graceTimer); clearTimeout(pollTimer);
      signal?.removeEventListener('abort', onAbort);
      resolve(Object.freeze({ status: exited?.code ?? null, signal: exited?.signal ?? null,
        timedOut, aborted, overflow, killRequested, groupKillOk, cleanupConfirmed,
        detached: useDetached, error: error || fallback || null, stdout, stderr }));
    };
    const gone = () => { try { return probeGroup(child) === false; } catch { return false; } };
    const kill = () => {
      if (killRequested || settled) return;
      killRequested = true;
      try { groupKillOk = groupKill(child, 'SIGKILL') === true; } catch { groupKillOk = false; }
    };
    const poll = () => {
      if (settled) return;
      if (closed && gone()) { finish(true); return; }
      pollTimer = setTimeout(poll, 10);
    };
    const contain = (reason) => {
      if (settled) return;
      if (reason && !error) error = reason;
      clearTimeout(deadlineTimer);
      // Start the single grace before kill: injected/real close may be synchronous.
      if (!graceTimer) graceTimer = setTimeout(() => finish(false, 'child close and process group/descendants not confirmed clean within grace'), graceMs);
      kill();
      if (!settled && !pollTimer) poll();
    };
    const onAbort = () => { if (!settled) { aborted = true; contain('child aborted'); } };
    const data = (channel, chunk) => {
      if (settled) return;
      if (performance.now() >= deadlineAt) { timedOut = true; contain('child deadline exceeded'); return; }
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const text = bytes.toString('utf8');
      if (channel === 'stdout') {
        stdoutBytes += bytes.length;
        if (stdoutBytes > MAX_CHILD_STDOUT || Buffer.byteLength(stdout) + Buffer.byteLength(text) > MAX_CHILD_STDOUT) { overflow = true; contain('child stdout exceeded bound'); return; }
        stdout += text;
      } else {
        stderrBytes += bytes.length;
        if (stderrBytes > MAX_CHILD_STDERR || Buffer.byteLength(stderr) + Buffer.byteLength(text) > MAX_CHILD_STDERR) { overflow = true; contain('child stderr exceeded bound'); return; }
        stderr += text;
      }
    };
    // Keep inert error listeners after settlement so late errors do not crash the
    // caller. All callbacks stop changing facts or issuing effects once settled.
    child.on('error', (err) => { if (!settled) contain(String(err?.message || err)); });
    child.stdout.on('data', (chunk) => data('stdout', chunk));
    child.stderr.on('data', (chunk) => data('stderr', chunk));
    child.stdout.on('error', (err) => { if (!settled) contain(`stdout error: ${String(err)}`); });
    child.stderr.on('error', (err) => { if (!settled) contain(`stderr error: ${String(err)}`); });
    child.on('exit', (code, exitSignal) => { if (!settled) exited = { code, signal: exitSignal }; });
    child.on('close', (code, exitSignal) => {
      if (settled) return;
      closed = true; exited = { code, signal: exitSignal };
      if (performance.now() >= deadlineAt) { timedOut = true; error ||= 'child deadline exceeded'; }
      clearTimeout(deadlineTimer);
      if (gone()) finish(true); else contain(null);
    });
    deadlineTimer = setTimeout(() => { if (!settled) { timedOut = true; contain('child deadline exceeded'); } }, Math.max(1, deadlineAt - performance.now()));
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

/** CLI-only bridge. Importing this module installs no process listeners. */
export function installProbeCancellation(processLike = process) {
  const controller = new AbortController();
  let disposed = false;
  const onInterrupt = () => { if (!controller.signal.aborted) controller.abort(new Error('qualification interrupted (SIGINT)')); };
  const onTerminate = () => { if (!controller.signal.aborted) controller.abort(new Error('qualification terminated (SIGTERM)')); };
  processLike.on('SIGINT', onInterrupt);
  processLike.on('SIGTERM', onTerminate);
  return Object.freeze({ signal: controller.signal, dispose() {
    if (disposed) return;
    disposed = true;
    processLike.removeListener('SIGINT', onInterrupt);
    processLike.removeListener('SIGTERM', onTerminate);
  } });
}
