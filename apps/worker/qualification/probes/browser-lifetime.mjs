// Bounds official MCP/fixture-server waits. This is API cleanup observation,
// never proof of physical descendant death or a replacement browser sandbox.
const MAX_STDERR_BYTES = 64 * 1024;
export function createBrowserLifetime({ deadlineMs = 120000, graceMs = 5000, signal } = {}) {
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0 || deadlineMs > 180000) throw new Error('invalid browser deadline');
  if (!Number.isFinite(graceMs) || graceMs <= 0 || graceMs > 5000) throw new Error('invalid browser cleanup grace');
  const end = performance.now() + deadlineMs;
  const resources = [], pending = new Set(), waiters = new Set();
  let failure = null, closing = false, closePromise = null, stderr = '', stderrBytes = 0;
  const fail = (reason) => {
    if (!failure) failure = new Error(reason);
    for (const reject of waiters) reject(failure);
  };
  const active = () => {
    if (signal?.aborted) fail('browser aborted');
    if (performance.now() >= end) fail('browser deadline exceeded');
    if (failure) throw failure;
    if (closing) throw new Error('browser lifetime closed');
  };
  const abort = () => fail('browser aborted');
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();

  // Late cleanup is bounded and observed. It cannot rewrite a frozen result.
  const boundedClose = (label, fn) => new Promise((resolve) => {
    let done = false;
    const cleanupEnd = performance.now() + graceMs;
    const finish = (ok, error) => {
      if (done) return;
      if (ok && performance.now() >= cleanupEnd) { ok = false; error = 'cleanup deadline exceeded'; }
      done = true; clearTimeout(timer); resolve({ label, ok, error });
    };
    const timer = setTimeout(() => finish(false, 'cleanup deadline exceeded'), graceMs);
    Promise.resolve().then(fn).then(() => finish(true, null), error => finish(false, String(error?.message || error)));
  });
  const own = (label, resource, close) => {
    const record = { label, resource, close, closePromise: null };
    resources.push(record);
    if (closing || failure) record.closePromise = boundedClose(label, () => close(resource));
    return resource;
  };
  const run = (label, fn, { lateCleanup } = {}) => {
    try { active(); } catch (error) { return Promise.reject(error); }
    return new Promise((resolve, reject) => {
      let done = false;
      const token = { label }; pending.add(token);
      const finish = (error, value) => {
        if (done) return;
        done = true; clearTimeout(timer); waiters.delete(onFailure);
        if (error) reject(error); else resolve(value);
      };
      const onFailure = (error) => finish(error);
      waiters.add(onFailure);
      const timer = setTimeout(() => { fail(`browser deadline exceeded during ${label}`); }, Math.max(1, end - performance.now()));
      Promise.resolve().then(() => { active(); return fn(); }).then(value => {
        pending.delete(token);
        if (done || closing || failure || performance.now() >= end) {
          if (lateCleanup) void boundedClose(`${label} late completion`, () => lateCleanup(value));
          if (!done) { fail(`browser deadline exceeded during ${label}`); finish(failure); }
          return;
        }
        finish(null, value);
      }, error => { pending.delete(token); if (!done) { fail(`${label}: ${String(error?.message || error)}`); finish(failure); } });
    });
  };
  const acquire = (label, fn, close) => run(label, async () => own(label, await fn(), close));
  return Object.freeze({
    run, acquire, own, assertActive: active,
    captureStderr(chunk) {
      if (closing) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stderrBytes += bytes.length;
      if (stderrBytes > MAX_STDERR_BYTES || Buffer.byteLength(stderr) + Buffer.byteLength(bytes.toString('utf8')) > MAX_STDERR_BYTES) { fail('MCP stderr exceeded bound'); return; }
      stderr += bytes.toString('utf8');
    },
    get stderr() { return stderr; },
    get failure() { return failure?.message || null; },
    close() {
      if (closePromise) return closePromise;
      if (signal?.aborted) fail('browser aborted');
      if (performance.now() >= end) fail('browser deadline exceeded');
      closing = true;
      for (const reject of waiters) reject(new Error('browser lifetime closed'));
      signal?.removeEventListener('abort', abort);
      const pendingAtClose = [...pending].map(p => p.label);
      closePromise = Promise.all(resources.map(record => {
        if (!record.closePromise) record.closePromise = boundedClose(record.label, () => record.close(record.resource));
        return record.closePromise;
      })).then(results => {
        if (signal?.aborted) fail('browser aborted');
        if (performance.now() >= end) fail('browser deadline exceeded');
        return Object.freeze({ confirmed: pendingAtClose.length === 0 && results.every(r => r.ok),
        scope: 'API-close-only; physical group absence requires outer supervisor',
        pendingAtClose: Object.freeze(pendingAtClose), resources: Object.freeze(results.map(Object.freeze)) });
      });
      return closePromise;
    },
  });
}

/** Node's callback is the close observation; returning from close() is insufficient. */
export function closeFixtureServer(server) {
  return new Promise((resolve, reject) => {
    try { server.close(error => error ? reject(error) : resolve()); } catch (error) { reject(error); }
  });
}
