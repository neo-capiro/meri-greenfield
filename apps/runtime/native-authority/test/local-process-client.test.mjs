// Local execution (runner.executionTransport 'local') against the real receiver, its authority calls and lifetimes. The physical
// task is a stand-in here; sdk-initialization-milestones.test.mjs runs the real supervisor, launcher and CLI on Linux.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, rmSync, realpathSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PassThrough} from 'node:stream';
import {EventEmitter, once} from 'node:events';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {continuationFixture} from '../../../worker/conversation/continuation/test/fixtures.mjs';
import {createRemoteNativeTaskApplication} from '../remote-task-http.mjs';
import {createLocalSdkProcessClient} from '../local-process-client.mjs';
import {withRunnerDiagnostics} from '../../runner-runtime-diagnostics.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex'), taskToken = 'synthetic-task-only', controlToken = 'synthetic-control-only';
const taskArn = 'arn:aws:ecs:us-east-1:967807252336:task/synthetic/' + 'a'.repeat(32), preparationId = '11111111-1111-4111-8111-000000000009';

function fixture(t, {executionTransport = 'local', refuseStart = false} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'meri-local-client-')), workspace = join(root, 'workspace'), configDirectory = join(root, 'config');
  mkdirSync(workspace); mkdirSync(configDirectory);
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const {binding, target} = continuationFixture(), command = realpathSync(process.execPath), env = {CLAUDE_CONFIG_DIR: configDirectory, CLAUDE_SECURESTORAGE_CONFIG_DIR: configDirectory};
  const descriptor = {command, args: [], cwd: workspace, env}, executionKey = hash(binding);
  const original = {binding, executionKey, executionId: executionKey, planSha256: hash(descriptor), expiresAtMs: Date.now() + 60000, versions: target.versions};
  const launchConfiguration = {binding, workspace, configDirectory, versions: {sdk: target.versions.sdk, cli: target.versions.cli}, expiresAtMs: original.expiresAtMs,
    executableSha256: sha(readFileSync(command)), launch: {command, args: [], env}, enabled: true};
  const events = new EventEmitter(), stdin = new PassThrough(), stdout = new PassThrough(), counts = {launches: 0, starts: 0, closes: 0, prepare: 0, start: 0, started: 0, verify: 0};
  let booted = false, closed = false, authorityCurrent = true;
  const receipt = () => ({binding, executionId: executionKey, planSha256: original.planSha256, expiresAtMs: original.expiresAtMs, versions: original.versions, taskId: 'synthetic-task',
    state: closed ? 'stopped' : 'executing', physicalStopProven: closed});
  const task = {
    launch: async () => { counts.launches++; booted = true; return receipt(); }, startPreparedProcess: async () => { counts.starts++; },
    spawnClaudeCodeProcess: () => ({stdin, stdout, on: (...a) => events.on(...a)}), status: () => ({booted, supervisorPid: booted ? 10 : null}),
    inspect: async () => receipt(), retire: async () => { closed = true; return receipt(); }, close: async () => { counts.closes++; closed = true; }, readiness: async () => {},
    registration: {read: async v => ({binding: v.binding, key: v.key})}, workspace: {restore: async ({signal, ...v}) => v, verify: async ({signal, ...v}) => v},
  };
  const ack = pins => ({original, descriptorSha256: pins.descriptorSha256, configTreeSha256: pins.configTreeSha256, preparationId, taskArn, checkedAtMs: Date.now(), expiresAtMs: original.expiresAtMs});
  const authorizer = {
    prepare: async pins => { counts.prepare++; return ack(pins); },
    verify: async pins => { counts.verify++; if (!authorityCurrent) throw Error('original-authority-lost'); return ack(pins); },
    start: async pins => { counts.start++; if (refuseStart) throw Error('synthetic-start-refusal'); await task.launch(original); return {...ack(pins), dispatch: true}; },
    started: async pins => { counts.started++; return ack(pins); },
    admitted: async () => ({original, taskArn, checkedAtMs: Date.now(), expiresAtMs: original.expiresAtMs}),
  };
  const receiver = createRemoteNativeTaskApplication({original, controlCapabilitySha256: sha(controlToken), taskCapabilitySha256: sha(taskToken), taskArn,
    descriptorPolicy: {workspace, command, configParentDirectory: root, secureStorageDirectory: configDirectory}, preparationAuthorizer: authorizer,
    nativeFactory: () => ({task, launchConfiguration}), parkedWorkspace: task.workspace, enabled: true, executionTransport});
  t.after(() => receiver.close().catch(() => {}));
  const post = (operation, token, body = {}) => receiver.handle(new Request('https://runner.invalid/v1/native-task/' + operation, {method: 'POST',
    headers: {authorization: 'Bearer ' + token, 'content-type': 'application/json'}, body: JSON.stringify({original, ...body})}));
  return {original, descriptor, receiver, post, events, stdin, stdout, counts, loseAuthority: () => { authorityCurrent = false; }, taskClosed: () => closed};
}

test('local mode keeps the forwarded byte routes closed to the task role and control operations, including recovery readback, open', async t => {
  const x = fixture(t);
  for (const operation of ['prepare', 'start', 'stdin', 'stdout']) assert.equal((await x.post(operation, taskToken)).status, 403);
  const client = createLocalSdkProcessClient({task: x.receiver.local});
  client.spawnClaudeCodeProcess(x.descriptor);
  await client.startPreparedProcess();
  assert.equal((await x.post('inspect', controlToken)).status, 200);
  // Restart recovery: control's reconcile reads the started binding back through the same route.
  const readback = await x.post('binding-read', controlToken);
  assert.equal(readback.status, 200);
  assert.equal((await readback.json()).descriptorSha256, hash(x.descriptor));
  assert.equal((await x.post('stop', controlToken)).status, 200);
  assert.equal(x.taskClosed(), true);
  assert.equal(fixture(t, {executionTransport: 'forwarded'}).receiver.local, undefined);
  assert.throws(() => fixture(t, {executionTransport: 'remote'}), /REMOTE_TASK_REFUSED/);
});

test('input written before the start acknowledgement is held, then delivered on local pipes with no byte exchanges', async t => {
  const x = fixture(t), client = createLocalSdkProcessClient({task: x.receiver.local}), port = client.spawnClaudeCodeProcess(x.descriptor);
  let delivered = '';
  x.stdin.on('data', chunk => { delivered += chunk; });
  port.stdin.write('initialize\n');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(delivered, '');
  await client.startPreparedProcess();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(delivered, 'initialize\n');
  const output = once(port.stdout, 'data');
  x.stdout.write('response\n');
  assert.equal(String((await output)[0]), 'response\n');
  assert.deepEqual({prepare: x.counts.prepare, start: x.counts.start, started: x.counts.started, launches: x.counts.launches, starts: x.counts.starts},
    {prepare: 1, start: 1, started: 1, launches: 1, starts: 1});
  // Startup freshness: one verify before prepare finishes, one before start, one after started; no per-byte verification.
  assert.equal(x.counts.verify, 3);
  await client.close();
  assert.equal(x.taskClosed(), true);
});

test('start is at most once: a second start and a replayed prepare after start are refused without another launch', async t => {
  const x = fixture(t), client = createLocalSdkProcessClient({task: x.receiver.local});
  client.spawnClaudeCodeProcess(x.descriptor);
  await client.startPreparedProcess();
  await assert.rejects(client.startPreparedProcess(), /REMOTE_TASK_REFUSED/);
  await assert.rejects(x.receiver.local.start({descriptorSha256: hash(x.descriptor)}), /REMOTE_TASK_REFUSED/);
  assert.equal(x.counts.start, 1);
  assert.equal(x.counts.launches, 1);
  await client.close();
});

test('a refused or lost start acknowledgement closes the task, records native-start and is never retried', async t => {
  const x = fixture(t, {refuseStart: true}), client = createLocalSdkProcessClient({task: x.receiver.local}), lines = [];
  client.spawnClaudeCodeProcess(x.descriptor);
  await assert.rejects(withRunnerDiagnostics(() => client.startPreparedProcess(), {write: line => lines.push(line)}), /REMOTE_TASK_REFUSED/);
  assert.equal(lines[0].trim(), 'RUNNER_FIRST_FAILURE origin=native-start code=REMOTE_TASK_REFUSED');
  assert.equal(x.receiver.status().state, 'unknown');
  assert.equal(client.status().closed, true);
  await assert.rejects(client.startPreparedProcess(), /REMOTE_TASK_REFUSED/);
  assert.equal(x.counts.start, 1);
  assert.equal(x.counts.starts, 0);
});

test('revocation while running: the lease recheck stops the task and surfaces an error within one lease interval', async t => {
  const x = fixture(t), client = createLocalSdkProcessClient({task: x.receiver.local, leaseMs: 100}), port = client.spawnClaudeCodeProcess(x.descriptor);
  await client.startPreparedProcess();
  // The SDK-facing facade exposes on/once/off like the forwarded one, so wait with its own once.
  const failed = new Promise(resolve => port.once('error', resolve)), exited = new Promise(resolve => port.once('exit', resolve));
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(x.taskClosed(), false);
  const before = x.counts.verify;
  assert.ok(before >= 4, 'lease rechecks ran: ' + before);
  x.loseAuthority();
  await failed;
  await exited;
  assert.equal(x.taskClosed(), true);
  assert.equal(port.killed, true);
});

test('natural completion reports exit only after both the process exit and the end of its output', async t => {
  const x = fixture(t), client = createLocalSdkProcessClient({task: x.receiver.local}), port = client.spawnClaudeCodeProcess(x.descriptor);
  await client.startPreparedProcess();
  let exit;
  port.on('exit', (code, signal) => { exit = {code, signal}; });
  const chunks = [];
  port.stdout.on('data', chunk => chunks.push(chunk));
  x.events.emit('exit', 0, null);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(exit, undefined);
  x.stdout.end('final result\n');
  await once(port.stdout, 'end');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(exit, {code: 0, signal: null});
  assert.equal(Buffer.concat(chunks).toString(), 'final result\n');
  await client.close();
  assert.equal(x.taskClosed(), true);
});

test('two concurrent local runs keep separate receivers, tasks and one start each', async t => {
  const runs = [fixture(t), fixture(t)].map(x => ({x, client: createLocalSdkProcessClient({task: x.receiver.local})}));
  for (const {x, client} of runs) client.spawnClaudeCodeProcess(x.descriptor);
  await Promise.all(runs.map(({client}) => client.startPreparedProcess()));
  for (const {x} of runs) assert.deepEqual({start: x.counts.start, launches: x.counts.launches, state: x.receiver.status().state}, {start: 1, launches: 1, state: 'running'});
  await Promise.all(runs.map(({client}) => client.close()));
  for (const {x} of runs) assert.equal(x.taskClosed(), true);
});

test('cancellation before start allocates nothing and close reports no physical allocation', async t => {
  const x = fixture(t), abort = new AbortController(), client = createLocalSdkProcessClient({task: x.receiver.local});
  client.spawnClaudeCodeProcess({...x.descriptor, signal: abort.signal});
  abort.abort();
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(client.startPreparedProcess(), /REMOTE_TASK_REFUSED/);
  assert.equal(x.counts.prepare, 0);
  assert.equal(x.counts.launches, 0);
  assert.equal(client.status().closed, true);
});
