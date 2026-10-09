// Meri W02-01 worker image qualification entrypoint (probe:runtime).
//
// OPT-IN live/container command. Never invoked by `npm test`.
// It runs independent checks and MUST keep running them when one fails: a
// browser sandbox failure must not prevent the identity, mount, SDK-static,
// network or Office checks from running.
//
// It always emits a structured JSON summary to stdout, preserves full child
// results (pretty JSON is parsed in full, never by last line alone), keeps
// scrubbed errors and evidence paths, and exits nonzero if ANY required check
// fails. Unavailable evidence is reported as skipped/failed, never a pass.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, statSync, readFileSync as readFile } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  QUALIFICATION,
  buildQualificationOptions,
  createReferenceStore,
  verifyRestore,
  InMemorySessionStore,
} from '../sdk-options.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROBE_DEADLINE_MS = Number(process.env.MERI_PROBE_DEADLINE_MS || 180000);
const NET_TIMEOUT_MS = Number(process.env.MERI_NET_TIMEOUT_MS || 3000);

/** @typedef {{name:string, required:boolean, status:'pass'|'fail'|'skipped', detail:string, evidencePaths?:string[], error?:string}} CheckResult */

/** Pure summary over independent check results. */
export function summarize(results) {
  const required = results.filter((r) => r.required);
  const failed = required.filter((r) => r.status !== 'pass');
  return {
    results,
    counts: {
      total: results.length,
      passed: results.filter((r) => r.status === 'pass').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'fail').length,
    },
    requiredFailed: failed.map((r) => r.name),
    ok: failed.length === 0,
  };
}

/** Exit code: nonzero if any required check did not pass (skipped counts as not-passed). */
export function computeExitCode(summary) {
  return summary.ok ? 0 : 1;
}

/**
 * Parse a child probe's structured stdout reliably. The COMPLETE trimmed stdout
 * must be exactly one JSON object (logs belong on stderr). Anything with
 * prefix/suffix noise, a non-object, or malformed JSON fails closed — there is
 * no backward scan, so an outer failed verdict can never be satisfied by a
 * nested `ok:true`. Returns { ok, value, error }.
 */
export function parseStructuredOutput(text) {
  const raw = typeof text === 'string' ? text : '';
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, value: null, error: 'empty stdout' };
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return { ok: false, value: null, error: 'stdout is not a single JSON object (prefix/suffix noise)' };
  }
  let value;
  try {
    value = JSON.parse(trimmed);
  } catch (error) {
    return { ok: false, value: null, error: `invalid JSON: ${String(error && error.message ? error.message : error).slice(0, 120)}` };
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, value: null, error: 'stdout JSON is not an object' };
  }
  return { ok: true, value, error: null };
}

/**
 * Classify a completed child probe. Never infers a pass from stdout alone:
 * a nonzero status, a signal, a timeout or a missing/false verdict all fail.
 */
export function classifyChildResult({ status, signal, timedOut, stdout, stderr } = {}) {
  if (timedOut) return { status: 'fail', detail: 'child exceeded its deadline', parsed: null, error: 'deadline exceeded' };
  const parsed = parseStructuredOutput(stdout);
  const err = (stderr || '').toString().slice(0, 400);
  if (status !== 0) {
    return { status: 'fail', detail: `child exited with status ${status}${signal ? ` signal ${signal}` : ''}`, parsed: parsed.value, error: err || parsed.error };
  }
  if (!parsed.ok) return { status: 'fail', detail: 'child stdout was not a parseable structured verdict', parsed: null, error: err || parsed.error };
  if (!parsed.value || parsed.value.ok !== true) {
    return { status: 'fail', detail: 'child reported ok !== true', parsed: parsed.value, error: err || (parsed.value && Array.isArray(parsed.value.reasons) ? parsed.value.reasons.join('; ').slice(0, 400) : null) };
  }
  return { status: 'pass', detail: 'child passed', parsed: parsed.value, error: null };
}

/** Effective identity and real read/write/delete in both mounted directories. */
export function checkIdentityAndMounts({ workspace = '/workspace', tmp = '/tmp', expectedUid = 10001 } = {}) {
  const evidencePaths = [];
  const detail = {};
  let ok = true;
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  const gid = typeof process.getgid === 'function' ? process.getgid() : null;
  detail.uid = uid;
  detail.gid = gid;
  detail.expectedUid = expectedUid;
  if (uid === null) {
    ok = false;
    detail.identity = 'unavailable: process.getuid() not supported (not a POSIX host)';
  } else if (uid !== expectedUid) {
    ok = false;
    detail.identity = `unexpected uid ${uid}`;
  } else {
    detail.identity = `uid ${uid} gid ${gid} matches expected`;
  }
  for (const dir of [workspace, tmp]) {
    const probe = join(dir, `.meri-probe-${randomUUID()}`);
    try {
      detail[`${dir}.mode`] = `0o${(statSync(dir).mode & 0o777).toString(8)}`;
      mkdirSync(probe);
      const file = join(probe, 'payload.txt');
      const payload = `meri-${randomUUID()}`;
      writeFileSync(file, payload, { mode: 0o600 });
      if (readFileSync(file, 'utf8') !== payload) {
        ok = false;
        detail[`${dir}.io`] = 'read mismatch';
      } else {
        detail[`${dir}.io`] = 'mkdir/write/read ok';
      }
      rmSync(probe, { recursive: true, force: true });
      evidencePaths.push(`${dir}/.meri-probe-<uuid> (created+deleted)`);
    } catch (error) {
      ok = false;
      detail[`${dir}.error`] = String(error && error.message ? error.message : error).slice(0, 200);
      evidencePaths.push(dir);
    }
  }
  return { name: 'identity-and-mounts', required: true, status: ok ? 'pass' : 'fail', detail: JSON.stringify(detail), evidencePaths };
}

/**
 * Prove the container root filesystem is actually mounted read-only. Permission
 * denial alone is insufficient: read /proc/self/mountinfo for the "/" mount and
 * require the "ro" option, and confirm a root write fails with EROFS.
 */
export function checkReadOnlyRoot({ root = '/', probePath = '/opt/meri-worker/.ro-probe' } = {}) {
  const evidencePaths = [];
  const detail = {};
  let ok = true;
  let mountinfo = null;
  try {
    mountinfo = readFile('/proc/self/mountinfo', 'utf8');
  } catch (error) {
    ok = false;
    detail.mountinfo = `unavailable: ${String(error && error.message ? error.message : error).slice(0, 120)}`;
  }
  if (mountinfo) {
    const line = mountinfo.split('\n').find((l) => {
      const parts = l.split(' ');
      return parts[4] === root;
    });
    if (!line) {
      ok = false;
      detail.mountinfo = `no mountinfo entry for ${root}`;
    } else {
      const opts = (line.split(' ')[5] || '').split(',');
      detail.mountOptions = opts.join(',');
      if (!opts.includes('ro')) {
        ok = false;
        detail.readOnlyRoot = `root mount is not ro (options: ${opts.join(',')})`;
      } else {
        detail.readOnlyRoot = 'root mount options include ro';
      }
    }
  }
  try {
    writeFileSync(probePath, 'x');
    rmSync(probePath, { force: true });
    ok = false;
    detail.writeAttempt = 'root write unexpectedly SUCCEEDED';
  } catch (error) {
    const code = error && error.code;
    detail.writeAttempt = `root write rejected (${code || 'error'})`;
    if (code !== 'EROFS' && code !== 'EACCES' && code !== 'EPERM') {
      ok = false;
      detail.writeAttempt += ' — unexpected error class';
    }
  }
  return { name: 'read-only-root', required: true, status: ok ? 'pass' : 'fail', detail: JSON.stringify(detail), evidencePaths };
}

/** Expected DNS denial classes for a blocked name (not any arbitrary failure). */
export const DENIAL_CODES = ['ENOTFOUND', 'EAI_NONAME', 'ENODATA'];

/** True when an IPv4 address is inside the qualification VPC range 10.80.0.0/16. */
export function addressIn10_80(address) {
  return typeof address === 'string' && /^10\.80\./.test(address);
}

/**
 * Pure classification of network-denial evidence. Negative names must be denied
 * with an expected denial class (arbitrary resolver failures are NOT success);
 * the positive control must resolve inside 10.80.0.0/16 and its connect must
 * succeed. Negative-name resolution, missing/incorrect positive resolution or a
 * failed connect all fail visibly.
 */
export function classifyNetworkResults({ negatives = [], positive = {}, connect } = {}) {
  const reasons = [];
  const detail = {};
  for (const n of negatives) {
    if (n.resolved) {
      detail[`dns:${n.name}`] = `UNEXPECTEDLY RESOLVED ${n.address}`;
      reasons.push(`${n.name} unexpectedly resolved`);
    } else {
      detail[`dns:${n.name}`] = `denied (${n.errorCode})`;
      if (!DENIAL_CODES.includes(n.errorCode)) reasons.push(`${n.name} denied with unexpected error class ${n.errorCode}`);
    }
  }
  if (!positive.resolved) {
    detail[`positive:${positive.name}`] = `unresolved (${positive.errorCode})`;
    reasons.push(`positive control ${positive.name} did not resolve`);
  } else {
    detail[`positive:${positive.name}`] = `resolved ${positive.address}`;
    if (!addressIn10_80(positive.address)) reasons.push(`positive control address ${positive.address} not in 10.80.0.0/16`);
  }
  detail.connect = connect;
  if (connect !== 'CONNECTED') reasons.push(`positive control connect ${connect}`);
  return { ok: reasons.length === 0, reasons, detail };
}

/** Bounded DNS-denial + positive-control probe. No credentials, no mutation. */
export async function checkNetworkDenial({ denied = ['example.com', 'api.anthropic.com'], positiveName = 'logs.us-east-1.amazonaws.com', port = 443, timeoutMs = NET_TIMEOUT_MS } = {}) {
  const negatives = [];
  for (const name of denied) {
    try {
      const res = await lookup(name);
      negatives.push({ name, resolved: true, address: res.address });
    } catch (error) {
      negatives.push({ name, resolved: false, errorCode: error && error.code ? error.code : 'UNKNOWN' });
    }
  }
  let positive;
  try {
    const res = await lookup(positiveName);
    positive = { name: positiveName, resolved: true, address: res.address };
  } catch (error) {
    positive = { name: positiveName, resolved: false, errorCode: error && error.code ? error.code : 'UNKNOWN' };
  }
  let connectResult = 'skipped';
  if (positive.resolved) {
    connectResult = await new Promise((resolve) => {
      const socket = connect({ host: positive.address, port });
      const done = (result) => { socket.destroy(); resolve(result); };
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => done('CONNECTED'));
      socket.once('timeout', () => done('timeout'));
      socket.once('error', (err) => done(`error:${err.code || 'error'}`));
    });
  }
  const cls = classifyNetworkResults({ negatives, positive, connect: connectResult });
  return {
    name: 'network-denial',
    required: true,
    status: cls.ok ? 'pass' : 'fail',
    detail: JSON.stringify(cls.detail),
    error: cls.ok ? undefined : cls.reasons.join('; '),
    evidencePaths: [],
    note: 'DNS-denial + positive control only; does not establish complete network qualification',
  };
}

/** Static contract of the pinned SDK: options shape and opaque session store. */
export async function checkSdkStatic() {
  try {
    const options = buildQualificationOptions();
    const store = createReferenceStore();
    if (!(store instanceof InMemorySessionStore)) throw new Error('reference store type mismatch');
    const key = { projectKey: 'qualification', sessionId: randomUUID() };
    const entry = { type: 'user', uuid: randomUUID(), opaque: { keep: true } };
    await store.append(key, [entry]);
    const loaded = await store.load(key);
    await verifyRestore(store, key, [entry]);
    let failedClosed = false;
    try {
      await verifyRestore(store, { projectKey: 'qualification', sessionId: 'absent' }, [entry]);
    } catch {
      failedClosed = true;
    }
    if (!failedClosed) throw new Error('verifyRestore did not fail closed on absent state');
    return {
      name: 'sdk-static',
      required: true,
      status: 'pass',
      detail: `sdk ${QUALIFICATION.sdkVersion} options+session-store reference contract observed`,
      evidencePaths: [],
      installedVersions: { sdk: QUALIFICATION.sdkVersion, bundledCli: QUALIFICATION.bundledCliVersion, observedEntries: loaded.length },
    };
  } catch (error) {
    return { name: 'sdk-static', required: true, status: 'fail', detail: 'sdk static contract check failed', error: String(error && error.message ? error.message : error).slice(0, 300), evidencePaths: [] };
  }
}

/** Run a sibling probe script as a child process with an explicit deadline. */
export function runProbeScript(script, { name, required = true, deadlineMs = PROBE_DEADLINE_MS } = {}) {
  let result;
  try {
    result = spawnSync(process.execPath, [join(HERE, script)], {
      timeout: deadlineMs,
      killSignal: 'SIGKILL',
      encoding: 'utf8',
      env: { ...process.env },
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    return { name, required, status: 'fail', detail: `${script} could not be spawned`, error: String(error).slice(0, 300), evidencePaths: [] };
  }
  const timedOut = !!(result.error && (result.error.code === 'ETIMEDOUT' || result.signal));
  const verdict = classifyChildResult({ status: result.status, signal: result.signal, timedOut, stdout: result.stdout, stderr: result.stderr });
  return {
    name,
    required,
    status: verdict.status,
    detail: `${script}: ${verdict.detail}`,
    error: verdict.error || undefined,
    childResult: verdict.parsed || undefined,
    evidencePaths: verdict.parsed && Array.isArray(verdict.parsed.evidencePaths) ? verdict.parsed.evidencePaths : [],
  };
}

async function main() {
  const results = [];
  results.push(checkIdentityAndMounts());
  results.push(checkReadOnlyRoot());
  results.push(await checkSdkStatic());
  results.push(await checkNetworkDenial());
  results.push(runProbeScript('browser.mjs', { name: 'browser-sandbox', required: true }));
  results.push(runProbeScript('artifacts.mjs', { name: 'office-artifacts', required: true }));

  const summary = summarize(results);
  const payload = { probe: 'runtime', generatedAt: new Date().toISOString(), ...summary };
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  process.exit(computeExitCode(summary));
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((error) => {
    process.stdout.write(JSON.stringify({ probe: 'runtime', ok: false, error: String(error).slice(0, 300) }, null, 2) + '\n');
    process.exit(1);
  });
}
