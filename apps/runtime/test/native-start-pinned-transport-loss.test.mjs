// Reproduction only (deployed source 2b4421f6). In-memory boundaries: no provider, process, network or credentials.
// Shows why `RUNNER_FIRST_FAILURE origin=native-start` can only say UNKNOWN on the product path: the runner's real
// fetchImpl is apps/runtime/pinned-native-transport.mjs, whose every failure (a non-200 status from control or the
// ALB, a socket/TLS error, a timeout, a truncated body) rejects with `Error('PINNED_NATIVE_REFUSED')` and no `code`
// property (lines 37 and 45). runner-runtime-diagnostics.mjs codeOf() reads only an own `code` from its allowlist.
import test from 'node:test';
import assert from 'node:assert/strict';
import {withRunnerDiagnostics, markRunnerStage} from '../runner-runtime-diagnostics.mjs';
import {createRemoteSdkProcessClient} from '../native-authority/remote-task-client.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {binding, versions} from '../../control/conversations/test/store-fixture.mjs';

const descriptor = {command: '/synthetic/node', args: [], cwd: '/synthetic/workspace', env: {}};
const firstLine = code => `RUNNER_FIRST_FAILURE origin=native-start code=${code}\n`;
function originalAt(now) {
  const executionKey = hash(binding);
  return {binding, versions, executionKey, executionId: executionKey, planSha256: hash(descriptor), expiresAtMs: now + 120000};
}
const prepared = original => Response.json({original, descriptorSha256: hash(descriptor)});
const stopped = original => Response.json({original, receipt: {physicalStopProven: false, notAllocated: true}});

/** Exact shape of the product transport's rejection (pinned-native-transport.mjs:37): a bare Error, no own `code`. */
const pinnedRejection = () => Error('PINNED_NATIVE_REFUSED');

/** The product transport (pinned-native-transport.mjs:25-60) as seen by remote-task-client.mjs: a 200 becomes a
 * buffered Response; anything else (non-200 status at line 45, request/response error, timeout, integrity) rejects
 * with pinnedRejection(). `reply` returns a Response (status honoured) or throws to model a socket-level failure. */
function pinnedLikeFetch(reply) {
  return async (url, init, original) => {
    const operation = new URL(url).pathname.split('/').at(-1);
    let response;
    try {response = await reply(operation, init, original);} catch {throw pinnedRejection();}
    if (!(response instanceof Response) || response.status !== 200) throw pinnedRejection();
    return new Response(Buffer.from(await response.arrayBuffer()), {status: 200, headers: {'content-type': 'application/json'}});
  };
}

async function driveStart({fetchImpl, startupBudget, now = Date.now}) {
  const original = originalAt(now());
  const client = createRemoteSdkProcessClient({original, origin: 'https://control.synthetic.invalid', credential: 'synthetic-task-only', now,
    ...(startupBudget ? {startupBudget: startupBudget(original)} : {}), fetchImpl: (url, init) => fetchImpl(url, init, original)});
  const lines = [];
  let startError;
  const outcome = await withRunnerDiagnostics(async () => {
    markRunnerStage('activity-stream');
    client.spawnClaudeCodeProcess(descriptor);
    try {await client.startPreparedProcess();} catch (error) {startError = error; throw error;}
  }, {write: line => lines.push(line)}).then(() => assert.fail('start must reject'), error => error);
  assert.equal(outcome, startError);
  return {lines, error: startError, status: client.status()};
}

const controlReplies = statusForStart => (operation, init, original) => {
  if (operation === 'prepare') return prepared(original);
  if (operation === 'stop') return stopped(original);
  assert.equal(operation, 'start');
  return statusForStart(original);
};

test('control 403 at native start is reported as UNKNOWN through the product transport', async () => {
  const refused = original => Response.json({error: {code: 'TASK_ROUTER_REFUSED'}}, {status: 403});
  const {lines, error, status} = await driveStart({fetchImpl: pinnedLikeFetch(controlReplies(refused))});
  assert.equal(lines[0], firstLine('UNKNOWN'));
  assert.equal(error.message, 'PINNED_NATIVE_REFUSED');
  assert.equal(Object.getOwnPropertyDescriptor(error, 'code'), undefined);
  assert.deepEqual(status, {requested: true, started: true, closed: true});
});

test('socket-level failure at native start is reported identically: the two causes are indistinguishable', async () => {
  const dropped = () => {throw Object.assign(Error('read ECONNRESET'), {code: 'ECONNRESET'});};
  const viaStatus = await driveStart({fetchImpl: pinnedLikeFetch(controlReplies(original => Response.json({}, {status: 403})))});
  const viaSocket = await driveStart({fetchImpl: pinnedLikeFetch(controlReplies(dropped))});
  assert.equal(viaSocket.lines[0], firstLine('UNKNOWN'));
  assert.equal(viaSocket.lines[0], viaStatus.lines[0]);
  assert.equal(viaSocket.error.message, viaStatus.error.message);
});

test('the same 403 delivered as a Response (the existing test model) is reported as REMOTE_TASK_REFUSED', async () => {
  // runner-first-failure.test.mjs hands the client a Response with status 403; the product transport never does.
  const asResponse = (url, init, original) => controlReplies(() => Response.json({error: {code: 'TASK_ROUTER_REFUSED'}}, {status: 403}))(new URL(url).pathname.split('/').at(-1), init, original);
  const {lines, error} = await driveStart({fetchImpl: asResponse});
  assert.equal(lines[0], firstLine('REMOTE_TASK_REFUSED'));
  assert.equal(error.code, 'REMOTE_TASK_REFUSED');
});

test('a native-start lifetime deadline is reported as REMOTE_TASK_REFUSED, so live UNKNOWN is not the 23 s cutoff', async () => {
  // The transport rejects code-less on abort too (pinned-native-transport.mjs:37-38); the owned lifetime still wins the race.
  const hanging = (operation, init, original) => {
    if (operation !== 'start') return controlReplies(() => assert.fail())(operation, init, original);
    return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(pinnedRejection()), {once: true}));
  };
  const budget = original => ({nativePrepare: {maxMs: 23000, expiresAtMs: original.expiresAtMs - 1000}, nativeStart: {maxMs: 5, expiresAtMs: original.expiresAtMs - 1000}});
  const {lines, error} = await driveStart({fetchImpl: pinnedLikeFetch(hanging), startupBudget: budget});
  assert.equal(lines[0], firstLine('REMOTE_TASK_REFUSED'));
  assert.equal(error.code, 'REMOTE_TASK_REFUSED');
});
