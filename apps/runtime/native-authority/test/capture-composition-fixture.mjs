// The end-of-turn capture across the real composed exchange: control's controller (remote-task-client) → control listener → task
// router (control.mjs wiring) → real TLS → runner listener → receiver `capture` → the task checkpoint source, whose closeQuery closes
// the runner's remote SDK process client, which stops the original through the same router with the runner's task credential.
// Only the router's task authority and ENI reader, the SDK session and the native process are stand-ins (as in
// native-start-router-budget.test.mjs). Needs --experimental-test-module-mocks on Windows (router-tls-fixture.mjs).
import {mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createExecutionBinding} from '../../../control/conversations/execution-boundary.mjs';
import {id} from '../../../control/conversations/test/store-fixture.mjs';
import {createTaskRouterApplication} from '../task-router.mjs';
import {createTaskRouterIngress} from '../task-router-boundary.mjs';
import {createRemoteNativeTaskApplication} from '../remote-task-http.mjs';
import {createRemoteNativeTaskController, createRemoteSdkProcessClient} from '../remote-task-client.mjs';
import {createTaskCheckpointSource} from '../task-checkpoint-source.mjs';
import {sha, caFile, ca, createPinnedNativeFetch, listen, tlsConnector} from './router-tls-fixture.mjs';

export const taskToken = 'synthetic-task-only', controlToken = 'synthetic-control-only';
const taskArn = 'arn:aws:ecs:us-east-1:967807252336:task/synthetic/' + 'a'.repeat(32);
const gate = () => Promise.withResolvers();

/** One composed control + runner pair for `binding`. `selfStop`: the capture's closeQuery closes the runner's process client, as the
 * runner's query close does. The capture's first snapshot waits for `x.release()`; `x.holdNextObserve()` parks the next router ENI
 * read. `x.stopped` resolves when a stop reached the runner. */
export async function composeCapture(t, {binding, versions, sessionId, selfStop}) {
  const root = mkdtempSync(join(tmpdir(), 'meri-capture-composition-')), workspace = join(root, 'workspace'), configDirectory = join(root, 'config');
  mkdirSync(workspace); mkdirSync(configDirectory); writeFileSync(join(workspace, 'note.txt'), 'captured');
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const command = realpathSync(process.execPath), env = {CLAUDE_CONFIG_DIR: configDirectory, CLAUDE_SECURESTORAGE_CONFIG_DIR: configDirectory};
  const plan = {command, args: [], cwd: workspace, env}, original = createExecutionBinding({binding, versions, plan, expiresAtMs: Date.now() + 600000});
  const {executionKey: _key, ...execution} = original;
  // The native process stand-in: executing until closed by the receiver's stop or the capture's own closeNative.
  let closed = false;
  const nativeTask = {inspect: async () => ({...execution, taskId: 'scripted-native', state: closed ? 'stopped' : 'executing', physicalStopProven: closed}),
    close: async () => { closed = true; }, status: () => ({booted: true, supervisorPid: 10}),
    retire: async () => ({...execution, taskId: 'scripted-native', state: 'stopped', physicalStopProven: true})};
  // Router stand-ins: the task authority (revocable) and the ENI reader (one read can be parked to keep an exchange in flight).
  let revoked = false, parked = null;
  const routerAuthority = {async verify({original: value}) {
    if (revoked) throw Error('revoked');
    return {original: value, resource: {taskArn}, expiresAtMs: original.expiresAtMs, pinSha256: 'f'.repeat(64)};
  }};
  const candidate = {taskArn, privateIPv4Address: '10.40.7.226', port: 8080, expiresAtMs: original.expiresAtMs};
  const networkReader = {async observe({signal}) {
    const hold = parked; parked = null;
    if (hold) await new Promise((resolve, reject) => { hold.promise.then(resolve); signal.addEventListener('abort', () => reject(signal.reason), {once: true}); });
    return {...candidate, checkedAtMs: Date.now()};
  }};
  let runnerOrigin;
  const ingress = createTaskRouterIngress(), marker = ingress.issue(), routerLog = [];
  // control.mjs wires the router with maxRequestMs 8000 (a forwarded capture takes TASK_ROUTER_CAPTURE_MS).
  const router = createTaskRouterApplication({authority: routerAuthority, networkReader, connector: tlsConnector(() => runnerOrigin), privateIngress: ingress,
    enabled: true, maxRequestMs: 8000, report: line => routerLog.push(JSON.parse(line))});
  const control = await listen({handle: async request => (await router.privateApplication.handle(request, {ingress: marker})) ?? null});
  const controlOrigin = 'https://localhost:' + control.address.port;
  const pinned = await createPinnedNativeFetch({origin: controlOrigin, caFile, caSha256: sha(ca)});
  // The runner side: its remote SDK process client (the CLI's process facade) and the real capture over that query.
  const processClient = createRemoteSdkProcessClient({original, origin: controlOrigin, credential: taskToken, fetchImpl: pinned});
  const stopped = gate(), released = gate();
  const key = {projectKey: workspace.replace(/[^a-zA-Z0-9]/gu, '-'), sessionId};
  const transcripts = [{entries: [{type: 'system', opaque: {state: 'retained'}}, {type: 'user', uuid: id(863), message: {content: 'first prompt'}}]}];
  let snapshots = 0;
  const capture = createTaskCheckpointSource({original, workspace,
    session: {async settle() {}, async close() {}, async snapshot() { if (++snapshots === 1) await released.promise; return {key, transcripts}; }},
    native: {inspect: value => nativeTask.inspect(value), close: () => nativeTask.close()},
    // remote-composition.mjs: closeQuery closes the active SDK query; its process port's kill() is the client's close(), which stops
    // the original through the router. Live, that stop reached the router before the capture replied; keep that order.
    async closeQuery() { if (selfStop) { void processClient.close().catch(() => {}); await stopped.promise; } }});
  const receiver = createRemoteNativeTaskApplication({original, controlCapabilitySha256: sha(controlToken), taskCapabilitySha256: sha(taskToken), taskArn,
    // The launched task already exists when a turn ends.
    task: nativeTask, launchConfiguration: {binding, workspace, configDirectory, versions: {sdk: versions.sdk, cli: versions.cli},
      expiresAtMs: original.expiresAtMs, executableSha256: sha(readFileSync(command)), launch: {command, args: [], env}, enabled: true},
    capture, enabled: true, limits: {maxRequestMs: 25000}});
  const runner = await listen({handle: async request => {
    const response = await receiver.handle(request);
    if (new URL(request.url).pathname === '/v1/native-task/stop') stopped.resolve();
    return response;
  }});
  runnerOrigin = 'https://localhost:' + runner.address.port;
  t.after(async () => { router.close(); await runner.close(); await control.close(); });
  const controller = createRemoteNativeTaskController({original, origin: controlOrigin, credential: controlToken, fetchImpl: pinned});
  const outcome = promise => promise.then(() => 'answered', error => error.code);
  return {original, plan, controller, router, routerLog, stopped: stopped.promise, release: () => released.resolve(),
    revoke() { revoked = true; },
    holdNextObserve() { parked = gate(); },
    capture: () => outcome(controller.capture({binding, controlId: id(864), sessionId})),
    inspect: () => outcome(controller.inspect({...original})),
    stop: () => outcome(controller.stop()),
    async inFlight(count) { while (router.status().activeRequests < count) await new Promise(resolve => setImmediate(resolve)); }};
}
