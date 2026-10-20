// Native-start startup budget across the real composed exchange (no provider, no SDK process, no network beyond loopback):
// runner client + pinned transport → control listener → task router (control's wiring) → runner listener → receiver `start`
// → nested runner→control preparation calls (real native client, pinned transport, preparation application).
// Only the authority owners are modelled: each sleeps for the serial Core/DB/ECS work it performs in the deployed source,
// using the live Core target average (≈0.28 s per call, 2026-10-20 01:38–01:41). Needs --experimental-test-module-mocks on
// Windows (the CA file uid/mode check is POSIX-only); on Linux the CA file is real and nothing is mocked.
import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import * as fsp from 'node:fs/promises';
import {request as httpsRequest} from 'node:https';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync, chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PassThrough} from 'node:stream';
import {EventEmitter} from 'node:events';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {continuationFixture} from '../../../worker/conversation/continuation/test/fixtures.mjs';
import {runnerStartupBudget} from '../../../../packages/runtime/runner-load-budget.mjs';
import {listenRuntime} from '../../http-server.mjs';
import {createNativeCapabilityClient} from '../../native-client.mjs';
import {withRunnerDiagnostics} from '../../runner-runtime-diagnostics.mjs';
import {createTaskRouterApplication} from '../task-router.mjs';
import {createTaskRouterIngress} from '../task-router-boundary.mjs';
import {createRemoteNativeTaskApplication} from '../remote-task-http.mjs';
import {createRemoteSdkProcessClient} from '../remote-task-client.mjs';
import {createNativePreparationApplication, createNativePreparationClient} from '../preparation-http.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const taskToken = 'synthetic-task-only', controlToken = 'synthetic-control-only';
const taskArn = 'arn:aws:ecs:us-east-1:967807252336:task/synthetic/' + 'a'.repeat(32);
const preparationId = '11111111-1111-4111-8111-000000000009';

// Serial work per owner in the deployed source (see adj-c report §1.2), at live average latencies.
const CORE_CALL_MS = 280, DB_MS = 10, ECS_MS = 120;
const VERIFY_MS = Math.round(2.5 * CORE_CALL_MS) + 4 * DB_MS;           // taskVerifier.verify: identity + context (+preflight) + 4 DB reads
const CURRENT_MS = VERIFY_MS + DB_MS + ECS_MS;                           // prepared-runtime current(): verify + journal read + ECS task proof
const ROUTER_AUTHORITY_MS = 3 * DB_MS, ROUTER_OBSERVE_MS = 2 * ECS_MS, TLS_MS = 50;
const ROUTER_HOP_MS = 3 * ROUTER_AUTHORITY_MS + 3 * ROUTER_OBSERVE_MS + TLS_MS;
const MODEL = {
  prepare: 2 * CURRENT_MS + 2 * DB_MS,
  // current, broker fresh, claim, fresh, nested launch hop (receiver verify → current, supervisor fork/boot), record, fresh, current
  start: CURRENT_MS + VERIFY_MS + DB_MS + VERIFY_MS + ROUTER_HOP_MS + CURRENT_MS + 500 + DB_MS + VERIFY_MS + CURRENT_MS,
  // current, broker.current (fresh, read, nested inspect hop, record, fresh), recordLaunch, current
  started: CURRENT_MS + VERIFY_MS + DB_MS + ROUTER_HOP_MS + DB_MS + VERIFY_MS + DB_MS + CURRENT_MS,
  verify: CURRENT_MS,
  admitted: CURRENT_MS,
};

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason);
  const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
  const abort = () => { clearTimeout(timer); reject(signal.reason); };
  signal?.addEventListener('abort', abort, {once: true});
});

const certificates = mkdtempSync(join(tmpdir(), 'meri-native-start-budget-'));
const openssl = process.platform === 'win32' ? 'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe' : 'openssl';
const run = args => execFileSync(openssl, args, {cwd: certificates, stdio: 'ignore'});
run(['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '2',
  '-subj', '/CN=synthetic-control-ca', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
run(['req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', 'srv.key', '-out', 'srv.csr', '-subj', '/CN=localhost']);
writeFileSync(join(certificates, 'srv.ext'), 'subjectAltName=DNS:localhost\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n');
run(['x509', '-req', '-in', 'srv.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'srv.pem', '-days', '2', '-extfile', 'srv.ext']);
const ca = readFileSync(join(certificates, 'ca.pem'));
const serverTls = {key: readFileSync(join(certificates, 'srv.key')), cert: readFileSync(join(certificates, 'srv.pem')), minVersion: 'TLSv1.3'};
let caFile = join(certificates, 'ca.pem');
if (process.platform === 'win32') {
  caFile = '/synthetic/control-ca.pem';
  const handle = {stat: async () => ({isFile: () => true, size: ca.length, uid: 0, mode: 0o100600}), readFile: async () => ca, close: async () => {}};
  mock.module('node:fs/promises', {namedExports: {...fsp, open: async (path, ...rest) => path === caFile ? handle : fsp.open(path, ...rest)}});
  process.getuid ??= () => 0;
} else chmodSync(caFile, 0o600);
const {createPinnedNativeFetch} = await import('../../pinned-native-transport.mjs');
test.after(() => rmSync(certificates, {recursive: true, force: true}));

const listen = (application, http = {hostname: 'localhost', port: 0, frontendOrigin: 'https://synthetic.invalid'}) =>
  listenRuntime({configuration: {http, limits: {requestMs: 25000, shutdownMs: 2000}}, application, readiness: async () => ({}), tls: serverTls});

/** One composed control + runner pair. `slow` overrides a modelled preparation owner duration (ms); `routerSlow(operation, n)`
 * adds ms to the router's n-th authority join for that operation. */
async function compose(t, {routerOptions, slow = {}, routerSlow = () => 0} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'meri-native-start-task-')), workspace = join(root, 'workspace'), configDirectory = join(root, 'config');
  mkdirSync(workspace); mkdirSync(configDirectory);
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const {binding, target} = continuationFixture(), command = realpathSync(process.execPath);
  const descriptor = {command, args: [], cwd: workspace, env: {CLAUDE_CONFIG_DIR: configDirectory, CLAUDE_SECURESTORAGE_CONFIG_DIR: configDirectory}};
  const executionKey = hash(binding);
  const original = {binding, executionKey, executionId: executionKey, planSha256: hash(descriptor), expiresAtMs: Date.now() + 600000, versions: target.versions};
  const launchConfiguration = {binding, workspace, configDirectory, versions: {sdk: target.versions.sdk, cli: target.versions.cli}, expiresAtMs: original.expiresAtMs,
    executableSha256: sha(readFileSync(command)), launch: {command, args: [], env: descriptor.env}, enabled: true};
  const startup = runnerStartupBudget({requestMs: 25000, shutdownMs: 10000, originalExpiresAtMs: original.expiresAtMs}).stages;

  // Physical task stand-in: the supervisor/CLI chain is Linux-only and is not the boundary under test here.
  const events = new EventEmitter(), stdin = new PassThrough(), stdout = new PassThrough();
  let booted = false, closed = false, starts = 0;
  const receipt = {binding, executionId: executionKey, planSha256: original.planSha256, expiresAtMs: original.expiresAtMs, versions: original.versions, taskId: 'synthetic-task', state: 'executing', physicalStopProven: false};
  const task = {
    launch: async () => { booted = true; return receipt; }, startPreparedProcess: async () => { starts++; },
    spawnClaudeCodeProcess: () => ({stdin, stdout, on: (...a) => events.on(...a)}), status: () => ({booted, supervisorPid: booted ? 10 : null}),
    inspect: async () => closed ? {...receipt, state: 'stopped', physicalStopProven: true} : receipt,
    retire: async () => ({...receipt, state: 'stopped', physicalStopProven: true}), close: async () => { closed = true; }, readiness: async () => {},
    registration: {read: async v => ({binding: v.binding, key: v.key})}, workspace: {restore: async ({signal, ...v}) => v, verify: async ({signal, ...v}) => v},
  };

  // Control-side preparation owner: modelled latency, records which calls were cancelled in flight.
  const calls = [], aborted = [];
  const ack = pins => ({original, descriptorSha256: pins.descriptorSha256, configTreeSha256: pins.configTreeSha256, preparationId, taskArn, checkedAtMs: Date.now(), expiresAtMs: original.expiresAtMs});
  const modelled = (method, result) => async ({signal, ...pins}) => {
    calls.push(method);
    try { await sleep(slow[method] ?? MODEL[method], signal); } catch (error) { aborted.push(method); throw error; }
    return result(pins);
  };
  const owner = {
    prepare: modelled('prepare', ack), verify: modelled('verify', ack), started: modelled('started', ack), admitted: modelled('admitted', () => ({original})),
    start: modelled('start', pins => { booted = true; return {...ack(pins), dispatch: true}; }),
  };
  const preparationLog = [];
  const preparation = createNativePreparationApplication({owner, taskCapabilitySha256: sha(taskToken), enabled: true, maxRequestMs: 25000,
    report: line => preparationLog.push(JSON.parse(line))});

  // Control → runner forwarding over a real local TLS connection; close() destroys it like the production connector.
  let runnerOrigin;
  const connector = {async connect({signal}) {
    await sleep(TLS_MS, signal);
    let request;
    return {close: () => request?.destroy(), send: ({operation, body, authorization, signal: sendSignal}) => new Promise((resolve, reject) => {
      request = httpsRequest(runnerOrigin + '/v1/native-task/' + operation, {method: 'POST', ca, agent: false,
        headers: {authorization, 'content-type': 'application/json', 'content-length': String(body.length)}}, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk)).on('end', () => resolve({status: response.statusCode, body: Buffer.concat(chunks)})).on('error', reject);
      });
      request.on('error', reject);
      sendSignal?.addEventListener('abort', () => { request.destroy(); reject(Error('aborted')); }, {once: true});
      request.end(body);
    })};
  }};
  const joins = {};
  const routerAuthority = {async verify({original: value, operation, signal}) {
    joins[operation] = (joins[operation] ?? 0) + 1;
    await sleep(ROUTER_AUTHORITY_MS + routerSlow(operation, joins[operation]), signal);
    return {original: value, resource: {taskArn}, expiresAtMs: original.expiresAtMs, pinSha256: 'f'.repeat(64)};
  }};
  const candidate = {taskArn, privateIPv4Address: '10.40.7.226', port: 8080, expiresAtMs: original.expiresAtMs};
  const networkReader = {async observe({signal}) { await sleep(ROUTER_OBSERVE_MS, signal); return {...candidate, checkedAtMs: Date.now()}; }};
  const ingress = createTaskRouterIngress(), marker = ingress.issue();
  const routerLog = [];
  // control.mjs wires the router with maxRequestMs 8000.
  const router = createTaskRouterApplication({authority: routerAuthority, networkReader, connector, privateIngress: ingress, enabled: true,
    maxRequestMs: 8000, report: line => routerLog.push(JSON.parse(line)), ...routerOptions});
  const control = await listen({handle: async request => (await router.privateApplication.handle(request, {ingress: marker})) ?? preparation.handle(request)});
  const controlOrigin = 'https://localhost:' + control.address.port;
  const pinned = await createPinnedNativeFetch({origin: controlOrigin, caFile, caSha256: sha(ca)});

  // Runner receiver: real application; its preparation calls go back to control through the same pinned transport.
  const native = createNativeCapabilityClient({configuration: {origin: controlOrigin, maxResponseBytes: 2097152}, credential: taskToken, fetch: pinned});
  const receiver = createRemoteNativeTaskApplication({original, controlCapabilitySha256: sha(controlToken), taskCapabilitySha256: sha(taskToken), taskArn,
    descriptorPolicy: {workspace, command, configParentDirectory: root, secureStorageDirectory: configDirectory},
    preparationAuthorizer: createNativePreparationClient({native, startupBudget: {...startup, admittedBefore: startup.nativePrepare, admittedAfter: startup.nativePrepare}}),
    nativeFactory: () => ({task, launchConfiguration}), parkedWorkspace: task.workspace, enabled: true, limits: {maxRequestMs: 25000}});
  const runner = await listen({handle: request => receiver.handle(request)});
  runnerOrigin = 'https://localhost:' + runner.address.port;
  t.after(async () => { router.close(); await runner.close(); await control.close(); });

  const client = createRemoteSdkProcessClient({original, origin: controlOrigin, credential: taskToken, fetchImpl: pinned, startupMaxRequestMs: 23000, startupBudget: startup});
  return {client, descriptor, receiver, calls, aborted, routerLog, preparationLog, starts: () => starts, taskClosed: () => closed};
}

/** Drive SDK process preparation exactly as the runner query does; capture runner diagnostics and listener console lines. */
async function driveStart(x) {
  const lines = [], consoleLines = [], consoleError = console.error;
  console.error = (...args) => { consoleLines.push(args.map(String).join(' ')); };
  try {
    await withRunnerDiagnostics(async () => { x.client.spawnClaudeCodeProcess(x.descriptor); await x.client.startPreparedProcess(); }, {write: line => lines.push(line)});
    return {ok: true, lines, consoleLines, receiverState: x.receiver.status().state};
  } catch (error) {
    return {ok: false, error, lines, consoleLines};
  } finally {
    await new Promise(resolve => setTimeout(resolve, 200));
    console.error = consoleError;
    await x.client.close().catch(() => {});
  }
}

test('modelled deployed authority chain: start encloses more serial work than the eight-second router allowance', () => {
  assert.ok(MODEL.prepare + ROUTER_HOP_MS + MODEL.verify < 8000, 'prepare fits the ordinary router allowance');
  assert.ok(ROUTER_HOP_MS + MODEL.start + MODEL.started + MODEL.verify > 8000, 'start does not');
});

const startRecord = log => log.find(entry => entry.operation === 'start');
const prematureCloses = result => result.consoleLines.filter(line => line === 'Client connection prematurely closed.').length;

test('reproduction: the deployed eight-second router enclosure cuts start inside a nested authority call', async t => {
  const x = await compose(t, {routerOptions: {startupMaxRequestMs: 8000}}), result = await driveStart(x);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'PINNED_NATIVE_STATUS_403');
  assert.equal(result.lines[0].trim(), 'RUNNER_FIRST_FAILURE origin=native-start code=PINNED_NATIVE_STATUS_403');
  // Live signature: the router destroys its runner connection, the runner aborts its nested call back to control.
  assert.equal(prematureCloses(result), 2, result.consoleLines.join(' | '));
  assert.deepEqual(x.aborted, ['started']);
  // The CLI was already started when the acknowledgement was lost: the receiver keeps the run UNKNOWN, never retries.
  assert.equal(x.starts(), 1);
  assert.equal(x.receiver.status().state, 'unknown');
  const record = startRecord(x.routerLog);
  assert.deepEqual({outcome: record.outcome, phase: record.phase, category: record.category, certainty: record.certainty, cleanup: record.cleanup},
    {outcome: 'refused', phase: 'send', category: 'DEADLINE', certainty: 'effect-uncertain', cleanup: 'closed'});
  assert.ok(record.elapsedMs > 6500 && record.elapsedMs < 9500, String(record.elapsedMs));
  assert.equal(record.remainingMs, 0);
  const started = x.preparationLog.find(entry => entry.operation === 'started');
  assert.deepEqual({outcome: started.outcome, phase: started.phase, category: started.category, certainty: started.certainty},
    {outcome: 'refused', phase: 'owner', category: 'CANCELLED', certainty: 'effect-uncertain'});
});

test('native start completes inside the startup allowance and records its elapsed time', async t => {
  const x = await compose(t), result = await driveStart(x);
  assert.equal(result.ok, true, result.error?.stack);
  assert.deepEqual(result.lines, []);
  assert.equal(prematureCloses(result), 0);
  assert.equal(x.starts(), 1);
  assert.deepEqual(x.aborted, []);
  assert.equal(result.receiverState, 'running');
  const record = startRecord(x.routerLog);
  assert.equal(record.outcome, 'completed');
  assert.equal(record.certainty, 'effect-answered');
  assert.ok(record.elapsedMs > 8000 && record.elapsedMs < 21000, String(record.elapsedMs));
  assert.deepEqual(x.preparationLog.map(entry => entry.outcome), x.preparationLog.map(() => 'completed'));
});

test('a nested authority call slower than the allowance is refused by the receiver first; the router still answers', async t => {
  const x = await compose(t, {slow: {started: 60000}}), result = await driveStart(x);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'PINNED_NATIVE_STATUS_403');
  assert.deepEqual(x.aborted, ['started']);
  // Only control logs a cut connection (the runner abandoned its nested call); the router received the receiver's refusal.
  assert.equal(prematureCloses(result), 1, result.consoleLines.join(' | '));
  const record = startRecord(x.routerLog);
  assert.deepEqual({outcome: record.outcome, phase: record.phase, category: record.category, certainty: record.certainty},
    {outcome: 'refused', phase: 'response', category: 'DOWNSTREAM_REFUSED', certainty: 'effect-answered'});
  assert.ok(record.remainingMs > 0, JSON.stringify(record));
  assert.equal(x.receiver.status().state, 'unknown');
  // Cleanup after the first failure is separately bounded and proves the stand-in task stopped.
  assert.equal(x.taskClosed(), true);
});

test('lost acknowledgement after a completed start is refused once, never retried, and cleanup stops the task', async t => {
  const x = await compose(t, {routerSlow: (operation, join) => operation === 'start' && join === 3 ? 30000 : 0}), result = await driveStart(x);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'PINNED_NATIVE_STATUS_403');
  const record = startRecord(x.routerLog);
  assert.deepEqual({phase: record.phase, category: record.category, certainty: record.certainty},
    {phase: 'authority-after', category: 'DEADLINE', certainty: 'effect-answered'});
  assert.equal(x.starts(), 1);
  assert.equal(x.receiver.status().state, 'stopped');
  assert.equal(x.taskClosed(), true);
});
