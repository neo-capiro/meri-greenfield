// SDK initialization as separate milestones, with the pinned SDK 0.3.295, the pinned Linux CLI 2.1.295, the real supervisor and
// session launcher, the real receiver and the real runner process client and query preparation. The model provider is a local
// HTTP listener: the first model request is captured and answered locally, nothing leaves loopback and no credential is used.
// Linux only (the supervisor pins /proc facts and process groups); skipped when the platform CLI is not installed.
// SDK_START_DELAY_MS models the startup exchange between descriptor capture and the start acknowledgement.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {continuationFixture} from '../../../worker/conversation/continuation/test/fixtures.mjs';
import {createRemoteNativeTaskApplication} from '../remote-task-http.mjs';
import {createRemoteSdkProcessClient} from '../remote-task-client.mjs';
import {createIndependentNativeTask} from '../independent-task.mjs';
import {createPreparedRunnerQuery} from '../runner-query.mjs';
import {withRunnerDiagnostics, markRunnerStage} from '../../runner-runtime-diagnostics.mjs';
import {withoutDetail} from '../../test/runner-diagnostic-lines.mjs';

const cliPackage = fileURLToPath(new URL('../../../worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude', import.meta.url));
const available = process.platform === 'linux' && existsSync(cliPackage);
const taskToken = 'synthetic-task-only', controlToken = 'synthetic-control-only';
const taskArn = 'arn:aws:ecs:us-east-1:967807252336:task/synthetic/' + 'a'.repeat(32), preparationId = '11111111-1111-4111-8111-000000000009';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const startDelayMs = Number(process.env.SDK_START_DELAY_MS ?? 2000);

/** Local stand-in for the trusted proxy: records the first model request shape only and answers one streamed text turn. */
async function localProvider(t) {
  const requests = [];
  const events = model => [
    ['message_start', {type: 'message_start', message: {id: 'msg_local', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: {input_tokens: 1, output_tokens: 1}}}],
    ['content_block_start', {type: 'content_block_start', index: 0, content_block: {type: 'text', text: ''}}],
    ['content_block_delta', {type: 'content_block_delta', index: 0, delta: {type: 'text_delta', text: 'hello'}}],
    ['content_block_stop', {type: 'content_block_stop', index: 0}],
    ['message_delta', {type: 'message_delta', delta: {stop_reason: 'end_turn', stop_sequence: null}, usage: {output_tokens: 1}}],
    ['message_stop', {type: 'message_stop'}],
  ];
  const server = createServer((request, response) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk)).on('end', () => {
      const path = new URL(request.url, 'http://local').pathname;
      if (request.method !== 'POST' || !path.startsWith('/v1/messages') || path !== '/v1/messages') {
        requests.push({at: Date.now(), path, method: request.method});
        response.writeHead(404, {'content-type': 'application/json'}).end('{"type":"error","error":{"type":"not_found_error","message":"local"}}');
        return;
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      requests.push({at: Date.now(), path, method: request.method, model: body.model, stream: body.stream === true, messages: body.messages?.length ?? 0});
      if (body.stream === true) {
        response.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-cache'});
        for (const [event, data] of events(body.model)) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        response.end();
      } else {
        response.writeHead(200, {'content-type': 'application/json'}).end(JSON.stringify({id: 'msg_local', type: 'message', role: 'assistant', model: body.model,
          content: [{type: 'text', text: 'hello'}], stop_reason: 'end_turn', stop_sequence: null, usage: {input_tokens: 1, output_tokens: 1}}));
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return {origin: 'http://127.0.0.1:' + server.address().port, requests};
}

/** One composed run; `refuseStart` makes the control-side start authority refuse after the modelled delay;
 * `endCli` sends that signal to the native CLI once its initialize answer has crossed the facade, before any model turn. */
async function runQuery(t, {refuseStart = false, endCli} = {}) {
  const provider = await localProvider(t);
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'meri-sdk-milestones-'))), workspace = join(root, 'workspace'), configDirectory = join(root, 'config-run');
  mkdirSync(workspace, {mode: 0o700}); mkdirSync(configDirectory, {mode: 0o700});
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const command = realpathSync(cliPackage), executableSha256 = sha(readFileSync(command));
  const {binding, target} = continuationFixture(), executionKey = hash(binding);
  const original = {binding, executionKey, executionId: executionKey, planSha256: 'b'.repeat(64), expiresAtMs: Date.now() + 600000, versions: target.versions};
  const env = {CLAUDE_CONFIG_DIR: configDirectory, CLAUDE_SECURESTORAGE_CONFIG_DIR: configDirectory, ANTHROPIC_BASE_URL: provider.origin,
    ANTHROPIC_AUTH_TOKEN: 'synthetic-local-proxy-token', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', DISABLE_PROMPT_CACHING: '1', HOME: configDirectory, PATH: '/usr/bin:/bin'};

  const began = Date.now(), at = () => Date.now() - began, milestones = {}, mark = name => { milestones[name] ??= at(); };
  let nativeTask;
  const ack = pins => ({original, descriptorSha256: pins.descriptorSha256, configTreeSha256: pins.configTreeSha256, preparationId, taskArn, checkedAtMs: Date.now(), expiresAtMs: original.expiresAtMs});
  const authorizer = {
    prepare: async pins => ack(pins), verify: async pins => ack(pins), started: async pins => ack(pins),
    admitted: async () => ({original, taskArn, checkedAtMs: Date.now(), expiresAtMs: original.expiresAtMs}),
    // The control broker launches the supervisor inside start; the delay stands for the authority chain around it.
    start: async ({signal, ...pins}) => {
      await new Promise(resolve => setTimeout(resolve, startDelayMs));
      if (refuseStart) { mark('startRefused'); throw Error('synthetic-start-refusal'); }
      await nativeTask.launch({...original, signal}); mark('supervisorBooted'); return {...ack(pins), dispatch: true};
    },
  };
  const receiver = createRemoteNativeTaskApplication({original, controlCapabilitySha256: sha(controlToken), taskCapabilitySha256: sha(taskToken), taskArn,
    descriptorPolicy: {workspace, command, configParentDirectory: dirname(configDirectory), secureStorageDirectory: configDirectory},
    preparationAuthorizer: authorizer, parkedWorkspace: {restore: () => { throw Error('unused'); }, verify: () => { throw Error('unused'); }},
    nativeFactory: ({descriptor}) => {
      const launchConfiguration = {shutdownMs: 1000, binding, workspace, configDirectory, versions: {sdk: target.versions.sdk, cli: target.versions.cli}, expiresAtMs: original.expiresAtMs,
        executableSha256, launch: {command: descriptor.command, args: descriptor.args, env: descriptor.env}, enabled: true};
      nativeTask = createIndependentNativeTask({startupMaxRequestMs:3000,original, launchConfiguration, deferredSpawn: true, maxRequestMs: 25000});
      return {task: nativeTask, launchConfiguration};
    }, enabled: true, limits: {maxRequestMs: 25000}});
  t.after(() => receiver.close().catch(() => {}));

  // In-process stand-in for runner → control router → receiver; records which byte operations happen when.
  const exchanges = [];
  const fetchImpl = async (url, init) => {
    const operation = new URL(url).pathname.split('/').at(-1), body = JSON.parse(init.body), sent = at();
    if (operation === 'start') mark('startRequested');
    const response = await receiver.handle(new Request(url, init));
    const reply = await response.clone().json();
    const frame = operation === 'stdin' ? body.frame : operation === 'stdout' ? reply.frame : undefined;
    const text = frame?.base64 ? Buffer.from(frame.base64, 'base64').toString('utf8') : '';
    exchanges.push({operation, sent, done: at(), status: response.status, bytes: frame?.bytes ?? 0,
      initializeRequest: operation === 'stdin' && text.includes('"subtype":"initialize"'),
      initializeResponse: operation === 'stdout' && text.includes('"type":"control_response"') && text.includes('"subtype":"success"')});
    if (operation === 'prepare' && response.status === 200) mark('prepareAcknowledged');
    if (operation === 'start' && response.status === 200) mark('startAcknowledged');
    if (exchanges.at(-1).initializeRequest) mark('initializeDelivered');
    if (exchanges.at(-1).initializeResponse) { mark('initializeResponded'); if (endCli) process.kill(nativeTask.status().nativePid, endCli); }
    return response;
  };
  const client = createRemoteSdkProcessClient({limits:{maxRequestMs:8000},original, origin: 'https://runner.invalid', credential: taskToken, fetchImpl, startupMaxRequestMs: 23000});
  const spawn = client.spawnClaudeCodeProcess;
  const processClient = {...client, spawnClaudeCodeProcess: descriptor => { mark('descriptorCaptured'); return spawn(descriptor); }};
  const query = createPreparedRunnerQuery({processClientFactory: () => processClient})({
    prompt: (async function* () { yield {type: 'user', session_id: '', parent_tool_use_id: null, message: {role: 'user', content: 'Reply with hello'}}; })(),
    options: {cwd: workspace, env, pathToClaudeCodeExecutable: command, model: 'meri-sonnet-qualification', maxTurns: 1, includePartialMessages: true, settingSources: [], tools: []}});

  let result, sessionId, error;
  const failure = setTimeout(() => { void query.close(); }, 120000);
  try {
    for await (const message of query) {
      if (message.type === 'system' && message.subtype === 'init') { mark('sessionRegistered'); sessionId = message.session_id; }
      if (message.type === 'stream_event') mark('firstStreamEvent');
      if (message.type === 'result') { result = message; mark('result'); break; }
    }
  } catch (thrown) { error = thrown; mark('iteratorRejected'); } finally { clearTimeout(failure); await query.close().catch(() => {}); }
  const firstModelRequest = provider.requests.find(request => request.path === '/v1/messages');
  if (firstModelRequest) milestones.firstModelRequest = firstModelRequest.at - began;
  t.diagnostic(JSON.stringify({startDelayMs, milestones, providerRequests: provider.requests.map(({at: when, ...rest}) => ({...rest, at: when - began})),
    stdinBeforeStart: exchanges.filter(e => e.operation === 'stdin' && e.sent < milestones.startAcknowledged).length,
    operations: exchanges.reduce((counts, e) => ({...counts, [e.operation]: (counts[e.operation] ?? 0) + 1}), {}), result: result && {subtype: result.subtype, isError: result.is_error}, error: error?.code}));
  return {milestones, exchanges, provider, firstModelRequest, sessionId, result, error, receiver, nativeTask};
}

test('SDK initialization milestones through the deferred remote process facade', {skip: !available && 'needs Linux and the pinned Linux CLI'}, async t => {
  const {milestones, exchanges, firstModelRequest, sessionId, result, nativeTask} = await runQuery(t);

  // Order: capture → prepare → start (process exists) → initialize delivered → initialize answered → session → model request → result.
  for (const name of ['descriptorCaptured', 'prepareAcknowledged', 'supervisorBooted', 'startAcknowledged', 'initializeDelivered', 'initializeResponded', 'sessionRegistered', 'firstModelRequest', 'result'])
    assert.equal(typeof milestones[name], 'number', 'missing milestone ' + name + ' ' + JSON.stringify(milestones));
  assert.ok(milestones.descriptorCaptured <= milestones.prepareAcknowledged && milestones.prepareAcknowledged <= milestones.startAcknowledged);
  assert.ok(milestones.startAcknowledged <= milestones.initializeDelivered, 'input stays deferred until the start acknowledgement');
  assert.equal(exchanges.filter(e => e.operation === 'stdin' && e.sent < milestones.startAcknowledged).length, 0);
  assert.ok(milestones.initializeDelivered < milestones.initializeResponded && milestones.initializeResponded <= milestones.firstModelRequest);
  assert.equal(firstModelRequest.model, 'meri-sonnet-qualification');
  assert.equal(typeof sessionId, 'string');
  assert.equal(result.subtype, 'success');
  assert.equal(nativeTask.status().physicalStopProven, true);
});

test('a refused start ends the SDK iteration promptly, before any process or model request', {skip: !available && 'needs Linux and the pinned Linux CLI'}, async t => {
  const {milestones, exchanges, provider, error, receiver, nativeTask} = await runQuery(t, {refuseStart: true});
  assert.equal(error?.code, 'REMOTE_TASK_REFUSED');
  assert.ok(milestones.iteratorRejected - milestones.startRefused < 3000, JSON.stringify(milestones));
  assert.equal(exchanges.filter(e => e.operation === 'stdin').length, 0);
  assert.deepEqual(provider.requests, []);
  assert.deepEqual({supervisorPid: nativeTask.status().supervisorPid, nativePid: nativeTask.status().nativePid}, {supervisorPid: null, nativePid: null});
  // A failed start stays UNKNOWN at the receiver even after its stop; only the stop receipt says nothing was allocated.
  assert.equal(receiver.status().state, 'unknown');
});

/** The runner's first-failure line for an activity whose SDK iteration rejected with `error` (activity.mjs captures it raw). */
async function firstFailureLine(error) {
  const lines = [];
  await withRunnerDiagnostics(async () => {markRunnerStage('activity-stream'); throw error;}, {write: line => lines.push(withoutDetail(line))}).catch(() => {});
  return lines[0];
}

// Live run ef0c07c7: the CLI was running behind the remote facade when the activity failed, and the runner printed only
// `code=UNKNOWN`. An SDK-side process failure must name its class, exit code or signal, and the stage.
for (const [signal, expected] of [
  ['SIGKILL', 'RUNNER_FIRST_FAILURE origin=runtime stage=activity-stream code=SDK_PROCESS_KILLED_BY_SIGNAL class=SDK_PROCESS_KILLED_BY_SIGNAL exit=none signal=SIGKILL\n'],
  ['SIGTERM', 'RUNNER_FIRST_FAILURE origin=runtime stage=activity-stream code=SDK_PROCESS_EXITED_NONZERO class=SDK_PROCESS_EXITED_NONZERO exit=143 signal=none\n'],
]) {
  test(`a CLI ended by ${signal} after initialize is reported with its SDK class and exit, never UNKNOWN`, {skip: !available && 'needs Linux and the pinned Linux CLI'}, async t => {
    const {error, result, nativeTask} = await runQuery(t, {endCli: signal});
    assert.equal(result, undefined);
    assert.ok(error instanceof Error);
    assert.equal(await firstFailureLine(error), expected);
    assert.equal(nativeTask.status().physicalStopProven, true);
  });
}
