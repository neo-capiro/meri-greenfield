// Procfs samples are conservative observations, not an atomic process freeze.
// The trusted owner must exclusively own the fixture PID namespace and workspace
// throughout capture/publication. This module supplies neither that authority nor
// a signing key, and never treats a worker-provided boolean as quiescence.
import { open, opendir, readlink } from 'node:fs/promises';
import { validateShape } from '../../../../packages/contracts/qualification-sdk/validate.mjs';

const ROOT = '/proc';
const MAX_BYTES = 65536;
const MAX_ENTRIES = 4096;
const MAX_OPERATION_MS = 5000;
const fail = code => { throw new Error(code); };
const interrupted = signal => { if (signal.aborted) fail('NAMESPACE_ABORTED'); };

// Fixed-path, bounded Linux adapter. All handles belong to this adapter and are
// closed when pending filesystem requests settle, including after cancellation.
// A deadline/refusal never claims an unsettled operation completed or cleaned up.
function linuxProcIO() {
  return Object.freeze({
    async read(path, { signal }) {
      interrupted(signal);
      const file = await open(path, 'r');
      try {
        interrupted(signal);
        const chunks = []; let count = 0;
        for (;;) {
          const bytes = Buffer.alloc(Math.min(4096, MAX_BYTES + 1 - count));
          const { bytesRead } = await file.read(bytes, 0, bytes.length, null);
          interrupted(signal);
          if (!bytesRead) break;
          count += bytesRead;
          if (count > MAX_BYTES) fail('NAMESPACE_READ_BOUND');
          chunks.push(bytes.subarray(0, bytesRead));
        }
        return Buffer.concat(chunks);
      } finally { await file.close(); }
    },
    async readlink(path, { signal }) {
      interrupted(signal);
      const value = await readlink(path);
      interrupted(signal);
      if (value.length > 256) fail('NAMESPACE_LINK_BOUND');
      return value;
    },
    async list(path, { signal }) {
      interrupted(signal);
      const directory = await opendir(path);
      try {
        interrupted(signal);
        const names = [];
        for (;;) {
          const entry = await directory.read();
          interrupted(signal);
          if (!entry) break;
          if (names.length >= MAX_ENTRIES) fail('NAMESPACE_LIST_BOUND');
          if (/^[0-9]+$/.test(entry.name) && !entry.isDirectory()) fail('NAMESPACE_PROC_COVERAGE');
          names.push(entry.name);
        }
        return names;
      } finally { await directory.close(); }
    }
  });
}

function text(bytes) {
  if (!Buffer.isBuffer(bytes) && typeof bytes !== 'string') fail('NAMESPACE_PROC_READ');
  if (Buffer.byteLength(bytes) > MAX_BYTES) fail('NAMESPACE_READ_BOUND');
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(bytes)); }
  catch { fail('NAMESPACE_PROC_READ'); }
}

function startTicks(stat, pid) {
  const value = text(stat).trim();
  const end = value.lastIndexOf(') ');
  if (!value.startsWith(`${pid} (`) || end < 3) fail('NAMESPACE_STAT');
  // After comm, index 0 is state (field 3); starttime is field 22/index 19.
  const fields = value.slice(end + 2).split(/\s+/);
  if (fields.length < 20 || !/^[A-Za-z]$/.test(fields[0]) ||
      fields.slice(1).some(field => !/^-?[0-9]+$/.test(field)) ||
      !/^[1-9][0-9]*$/.test(fields[19])) fail('NAMESPACE_STAT');
  return fields[19]; // Decimal string retains the kernel's full integer precision.
}

function namespace(value) {
  if (typeof value !== 'string' || !/^pid:\[[1-9][0-9]*\]$/.test(value)) fail('NAMESPACE_PID_NAMESPACE');
  return value;
}

function mountIdentity(bytes) {
  const lines = text(bytes).trim().split('\n');
  let identity;
  for (const line of lines) {
    const fields = line.split(' '), separator = fields.indexOf('-');
    if (fields.length < 10 || separator < 6 || separator + 3 >= fields.length) fail('NAMESPACE_MOUNTINFO');
    const mount = fields[4];
    if (/^\/proc\/(?:[0-9]+|self|thread-self)(?:\/|$)/.test(mount)) fail('NAMESPACE_PROC_COVERAGE');
    if (mount !== ROOT) continue;
    if (identity || fields[3] !== '/' || fields[separator + 1] !== 'proc' ||
        !/^[0-9]+$/.test(fields[0]) || !/^[0-9]+:[0-9]+$/.test(fields[2])) fail('NAMESPACE_PROC_MOUNT');
    const options = `${fields[5]},${fields[separator + 3]}`.split(',');
    if (options.some(value => /^hidepid=/.test(value) && value !== 'hidepid=0') ||
        options.some(value => /^subset=/.test(value))) fail('NAMESPACE_PROC_COVERAGE');
    identity = `${fields[0]}:${fields[2]}:${fields[3]}:${fields[5]}:${fields.slice(6).join(' ')}`;
  }
  if (!identity) fail('NAMESPACE_PROC_MOUNT');
  return identity;
}

function processList(names) {
  if (!Array.isArray(names) || names.length > MAX_ENTRIES ||
      names.some(name => typeof name !== 'string' || !name || name.includes('/')) ||
      new Set(names).size !== names.length) fail('NAMESPACE_PROC_COVERAGE');
  const pids = names.filter(name => /^[0-9]+$/.test(name)).map(name => {
    const pid = Number(name);
    if (!Number.isSafeInteger(pid) || pid <= 0 || String(pid) !== name) fail('NAMESPACE_PROC_COVERAGE');
    return pid;
  }).sort((a, b) => a - b);
  // Missing PID 1 is not proof of a private namespace: procfs may be incomplete.
  if (!pids.includes(1)) fail('NAMESPACE_PROC_COVERAGE');
  return pids;
}

/** Establish the baseline before spawning the SDK. Only the trusted supervisor
 * (PID 1) may exist in this dedicated fixture namespace. The injected I/O seam
 * is for a trusted host adapter/tests, never payload-selected filesystem paths.
 * The separately trusted spawn owner must ensure the SDK child inherits this
 * namespace without unshare/setns; inspecting an exited PID cannot prove that
 * earlier fact. Runtime qualification must verify the actual spawn restriction.
 * Construction performs no I/O. An uncertain/failed operation seals this owner.
 */
export function createLinuxProcNamespaceInspector({ io = linuxProcIO(), now = Date.now,
  deadlineMs, signal, observerPid = process.pid } = {}) {
  if (!io || !['read', 'readlink', 'list'].every(name => typeof io[name] === 'function') ||
      typeof now !== 'function' || !(signal instanceof AbortSignal) ||
      !Number.isSafeInteger(deadlineMs) || !Number.isSafeInteger(observerPid) || observerPid <= 0) fail('NAMESPACE_COMPOSITION');
  let lastNow = 0, baseline, busy = false, sealed = false, activeController;
  const tick = () => {
    const value = now();
    if (!Number.isSafeInteger(value) || value <= 0 || value < lastNow) fail('NAMESPACE_CLOCK');
    lastNow = value;
    return value;
  };
  tick();
  async function bounded(operation) {
    if (busy || sealed) {
      sealed = true; activeController?.abort(); fail('NAMESPACE_OWNER_UNAVAILABLE');
    }
    busy = true;
    const owner = new AbortController();
    activeController = owner;
    let timer, onAbort;
    try {
      interrupted(signal);
      const remaining = deadlineMs - tick();
      if (remaining <= 0) fail('NAMESPACE_DEADLINE');
      const stopped = new Promise((_, reject) => {
        onAbort = () => { owner.abort(); reject(new Error('NAMESPACE_ABORTED')); };
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) onAbort();
        timer = setTimeout(() => { owner.abort(); reject(new Error('NAMESPACE_DEADLINE')); },
          Math.min(remaining, MAX_OPERATION_MS));
      });
      const check = () => {
        interrupted(owner.signal); interrupted(signal);
        if (tick() >= deadlineMs) fail('NAMESPACE_DEADLINE');
      };
      const result = await Promise.race([operation(owner.signal, check), stopped]);
      check();
      return result;
    } catch (error) { sealed = true; owner.abort(); throw error; }
    finally {
      clearTimeout(timer);
      if (onAbort) signal.removeEventListener('abort', onAbort);
      busy = false; activeController = undefined;
    }
  }
  async function sample(ownerSignal, check) {
    const read = async path => { const value = await io.read(path, { signal: ownerSignal, maxBytes: MAX_BYTES }); check(); return value; };
    const link = async path => { const value = await io.readlink(path, { signal: ownerSignal }); check(); return namespace(value); };
    const mount = mountIdentity(await read(`${ROOT}/self/mountinfo`));
    const own = startTicks(await read(`${ROOT}/${observerPid}/stat`), observerPid);
    if (startTicks(await read(`${ROOT}/self/stat`), observerPid) !== own) fail('NAMESPACE_OWNER_CHANGED');
    const pidNamespace = await link(`${ROOT}/${observerPid}/ns/pid`);
    if (await link(`${ROOT}/self/ns/pid`) !== pidNamespace) fail('NAMESPACE_PID_NAMESPACE');
    const pids = processList(await io.list(ROOT, { signal: ownerSignal, maxEntries: MAX_ENTRIES }));
    check();
    if (!pids.includes(observerPid)) fail('NAMESPACE_PROC_COVERAGE');
    return { mount, own, pidNamespace, pids };
  }
  async function stableSamples(ownerSignal, check) {
    const first = await sample(ownerSignal, check);
    const second = await sample(ownerSignal, check);
    if (first.mount !== second.mount || first.own !== second.own ||
        first.pidNamespace !== second.pidNamespace) fail('NAMESPACE_OWNER_CHANGED');
    if (JSON.stringify(first.pids) !== JSON.stringify(second.pids)) fail('NAMESPACE_ENUMERATION_CHANGED');
    if (second.pids.some(pid => pid !== observerPid)) fail('NAMESPACE_SURVIVING_PROCESS');
    return second;
  }
  return Object.freeze({
    async baseline() {
      if (baseline) fail('NAMESPACE_BASELINE_ONCE');
      return bounded(async (ownerSignal, check) => {
        const observed = await stableSamples(ownerSignal, check);
        check(); baseline = { ...observed, observedAtMs: tick() };
        return Object.freeze({ method: 'linux-proc', observedAtMs: baseline.observedAtMs,
          pidNamespace: observed.pidNamespace, observerPid, otherPids: Object.freeze([]) });
      });
    },
    async inspectNamespace({ process: child, exitedAtMs } = {}) {
      if (!baseline) fail('NAMESPACE_BASELINE_REQUIRED');
      try { validateShape('NativeObservedProcess', child); }
      catch { fail('NAMESPACE_PROCESS_BINDING'); }
      if (child.pid === observerPid || child.startedAtMs < baseline.observedAtMs ||
          !Number.isSafeInteger(exitedAtMs) || exitedAtMs < child.startedAtMs ||
          exitedAtMs > tick()) fail('NAMESPACE_PROCESS_BINDING');
      return bounded(async (ownerSignal, check) => {
        const observed = await stableSamples(ownerSignal, check);
        if (observed.mount !== baseline.mount || observed.own !== baseline.own ||
            observed.pidNamespace !== baseline.pidNamespace) fail('NAMESPACE_OWNER_CHANGED');
        try {
          await io.read(`${ROOT}/${child.pid}/stat`, { signal: ownerSignal, maxBytes: MAX_BYTES });
          fail('NAMESPACE_SDK_PROCESS_SURVIVES');
        } catch (error) { if (error?.code !== 'ENOENT') throw error; }
        check();
        return Object.freeze({ method: 'linux-proc', observedAtMs: tick(),
          pidNamespace: observed.pidNamespace, observerPid, otherPids: Object.freeze([]) });
      });
    }
  });
}
