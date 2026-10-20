// In-memory SDK/transport boundaries only: no provider, process, network or credentials.
import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {withRunnerDiagnostics, markRunnerStage, captureRunnerFailure} from '../runner-runtime-diagnostics.mjs';
import {createRemoteSdkProcessClient} from '../native-authority/remote-task-client.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {binding, versions} from '../../control/conversations/test/store-fixture.mjs';

let sdkQuery = () => assert.fail('SDK query not configured by this test');
mock.module('../../worker/conversation/agent-sdk.mjs', {namedExports: {query: value => sdkQuery(value)}});
const {prepareNativeSdkQuery} = await import('../native-authority/sdk-query-preparation.mjs');
const descriptor = {command: '/synthetic/node', args: [], cwd: '/synthetic/workspace', env: {}};
const firstLine = (origin, code, kind = 'ERROR') => `RUNNER_FIRST_FAILURE origin=${origin} stage=activity-stream code=${code} class=${kind} exit=none signal=none\n`;
const finalLine = code => `RUNNER_RUNTIME_FAILED stage=activity-stream code=${code}\n`;
const coded = code => Object.assign(Error('synthetic-private-canary'), {code});
const observe = promise => promise.then(value => ({value}), error => ({error}));

function originalAt(now) {
  const executionKey = hash(binding);
  return {binding, versions, executionKey, executionId: executionKey, planSha256: hash(descriptor), expiresAtMs: now + 120000};
}

function installSdk(events, {signal, close = () => {}} = {}) {
  let queryCalls = 0;
  sdkQuery = ({prompt, options}) => {
    queryCalls++;
    assert.equal(prompt, 'synthetic prompt');
    events.push('sdk-query');
    return {
      [Symbol.asyncIterator]() {
        return {next() {
          events.push('sdk-next');
          options.spawnClaudeCodeProcess({...descriptor, ...(signal ? {signal} : {})});
          return Promise.resolve({done: false, value: {type: 'synthetic-first'}});
        }};
      },
      close() {events.push('sdk-close'); close();},
    };
  };
  return () => queryCalls;
}

function remote(t, events, handle, {now = Date.now, startupBudget} = {}) {
  const original = originalAt(now());
  const client = createRemoteSdkProcessClient({
    original, origin: 'https://synthetic-task.invalid', credential: 'synthetic-task-only', now,
    ...(startupBudget ? {startupBudget} : {}),
    fetchImpl: async (url, init) => {
      const operation = new URL(url).pathname.split('/').at(-1);
      events.push(operation);
      assert.equal(new URL(url).origin, 'https://synthetic-task.invalid');
      assert.equal(init.method, 'POST');
      assert.equal(init.headers.authorization, 'Bearer synthetic-task-only');
      assert.equal(init.redirect, 'error');
      assert.equal(init.credentials, 'omit');
      assert.equal(init.cache, 'no-store');
      const body = JSON.parse(init.body);
      assert.deepEqual(body.original, original);
      assert.equal(Object.hasOwn(body, 'credential'), false);
      if (operation === 'prepare') assert.deepEqual(body.descriptor, descriptor);
      if (operation === 'start') assert.equal(body.descriptorSha256, hash(descriptor));
      return handle(operation, original, init);
    },
  });
  t.after(() => client.close());
  return client;
}

function stopped(original) {
  return Response.json({original, receipt: {physicalStopProven: false, notAllocated: true}});
}
function prepared(original) {return Response.json({original, descriptorSha256: hash(descriptor)});}

for (const phase of ['prepare', 'start']) {
  test(`native ${phase} refusal is visible before held cleanup and keeps its original rejection`, {timeout: 5000}, async t => {
    const events = [], lines = [], stopEntered = Promise.withResolvers(), releaseStop = Promise.withResolvers();
    t.after(() => releaseStop.resolve());
    const client = remote(t, events, async (operation, original) => {
      if (operation === 'stop') {stopEntered.resolve(); await releaseStop.promise; return stopped(original);}
      if (operation === phase) return Response.json({error: 'synthetic-private-canary'}, {status: 403});
      assert.equal(operation, 'prepare');
      return prepared(original);
    });
    const queryCalls = installSdk(events);
    let caught, startError, settled = false;
    const pending = withRunnerDiagnostics(async () => {
      markRunnerStage('activity-stream');
      try {
        return await prepareNativeSdkQuery({prompt: 'synthetic prompt', options: {}, bindLaunch(request) {
          events.push('sdk-bind');
          assert.deepEqual(request, descriptor);
          return {process: client.spawnClaudeCodeProcess(request), async start() {
            try {await client.startPreparedProcess();} catch (error) {startError = error; throw error;}
          }, close: () => client.close()};
        }});
      } catch (error) {caught = error; throw error;}
    }, {write: line => lines.push(line)});
    const result = observe(pending).then(value => {settled = true; return value;});
    try {
      await stopEntered.promise;
      assert.equal(settled, false);
      assert.deepEqual(lines, [firstLine(`native-${phase}`, 'REMOTE_TASK_REFUSED')]);
      assert.deepEqual(events, ['sdk-query', 'sdk-next', 'sdk-bind', 'prepare', ...(phase === 'start' ? ['start'] : []), 'stop']);
      assert.equal(queryCalls(), 1);
      assert.deepEqual(client.status(), {requested: true, started: true, closed: true});
    } finally {releaseStop.resolve();}
    const {error} = await result;
    assert.equal(error, caught);
    assert.equal(error, startError);
    assert.equal(error.code, 'REMOTE_TASK_REFUSED');
    assert.deepEqual(lines, [firstLine(`native-${phase}`, 'REMOTE_TASK_REFUSED'), finalLine('REMOTE_TASK_REFUSED')]);
    assert.equal(events.filter(operation => operation === 'stop').length, 1);
    assert.equal(events.at(-1), 'sdk-close');
    assert.equal(events.includes('stdout'), false);
    assert.equal(events.includes('stdin'), false);
  });
}

test('SDK no-launch refusal is captured by actual preparation before rethrow', async () => {
  const lines = [], events = [];
  sdkQuery = () => ({[Symbol.asyncIterator]() {return {async next() {return {done: true};}};}, close() {events.push('sdk-close');}});
  const {error} = await observe(withRunnerDiagnostics(() => {
    markRunnerStage('activity-stream');
    return prepareNativeSdkQuery({prompt: 'synthetic prompt', options: {}, bindLaunch() {assert.fail('No launch allowed');}});
  }, {write: line => {lines.push(line); events.push(line.startsWith('RUNNER_FIRST_FAILURE') ? 'first' : 'final');}}));
  assert.equal(error.code, 'NATIVE_EXECUTION_SDK_PREPARATION_NO_LAUNCH');
  assert.deepEqual(events, ['first', 'sdk-close', 'final']);
  assert.deepEqual(lines, [firstLine('sdk-prepare', error.code), finalLine(error.code)]);
});

test('preparation refusal or already assembled aggregate is rethrown without inspecting inner errors', async () => {
  let inspected = 0;
  const refused = coded('NATIVE_EXECUTION_SDK_PREPARATION_REFUSED');
  const aggregate = new AggregateError([refused, Error('synthetic-private-canary')]);
  Object.defineProperty(aggregate, 'errors', {get() {inspected++; throw Error('private aggregate members');}});
  for (const [initial, code, kind] of [[refused, refused.code, 'ERROR'], [aggregate, 'AGGREGATE_ERROR', 'AGGREGATE_ERROR']]) {
    const lines = [];
    sdkQuery = () => {throw initial;};
    await assert.rejects(withRunnerDiagnostics(() => {
      markRunnerStage('activity-stream');
      return prepareNativeSdkQuery({prompt: 'synthetic prompt', options: {}, bindLaunch() {assert.fail('No launch allowed');}});
    }, {write: line => lines.push(line)}), error => error === initial);
    assert.deepEqual(lines, [firstLine('sdk-prepare', code, kind), finalLine(code)]);
  }
  assert.equal(inspected, 0);
});

test('held SDK cleanup preserves the first code and passes the same aggregate to the caller', {timeout: 5000}, async () => {
  const events = [], lines = [], entered = Promise.withResolvers(), release = Promise.withResolvers();
  const initial = coded('NATIVE_EXECUTION_SDK_PREPARATION_REFUSED'), cleanup = coded('NATIVE_EXECUTION_SDK_PREPARATION_CLEANUP_UNKNOWN');
  installSdk(events);
  let aggregate, settled = false;
  const result = observe(withRunnerDiagnostics(async () => {
    markRunnerStage('activity-stream');
    try {
      return await prepareNativeSdkQuery({prompt: 'synthetic prompt', options: {}, bindLaunch() {
        events.push('sdk-bind');
        return {process: {}, async start() {events.push('start'); throw initial;}, async close() {
          events.push('close-enter'); entered.resolve(); await release.promise; events.push('close-reject'); throw cleanup;
        }};
      }});
    } catch (error) {aggregate = error; throw error;}
  }, {write: line => {lines.push(line); events.push(line.startsWith('RUNNER_FIRST_FAILURE') ? 'first' : 'final');}})).then(value => {settled = true; return value;});
  try {
    await entered.promise;
    assert.equal(settled, false);
    assert.deepEqual(lines, [firstLine('sdk-prepare', initial.code)]);
    assert.deepEqual(events, ['sdk-query', 'sdk-next', 'sdk-bind', 'start', 'first', 'close-enter']);
  } finally {release.resolve();}
  const {error} = await result;
  assert.equal(error, aggregate);
  assert.ok(error instanceof AggregateError);
  assert.equal(error.message, 'SDK_PREPARATION_CLEANUP_UNKNOWN');
  assert.deepEqual(error.errors, [initial, cleanup]);
  assert.equal(error.errors[0], initial);
  assert.equal(error.errors[1], cleanup);
  assert.deepEqual(lines, [firstLine('sdk-prepare', initial.code), finalLine(initial.code)]);
  assert.deepEqual(events.slice(-2), ['close-reject', 'final']);
  assert.equal(events.includes('sdk-close'), false);
});

test('successful preparation retains start, stop and SDK-close order without diagnostics', async t => {
  const events = [], lines = [];
  const client = remote(t, events, async (operation, original) => {
    if (operation === 'stop') return stopped(original);
    if (operation === 'stdout') return Response.json({original, sequence: 0, frame: {bytes: 0, sha256: createHash('sha256').update('').digest('hex'), base64: ''}, end: true, exitCode: 0, signal: null});
    assert.ok(['prepare', 'start'].includes(operation));
    return prepared(original);
  });
  installSdk(events);
  await withRunnerDiagnostics(async () => {
    markRunnerStage('activity-stream');
    const ready = await prepareNativeSdkQuery({prompt: 'synthetic prompt', options: {}, bindLaunch(request) {
      events.push('sdk-bind');
      return {process: client.spawnClaudeCodeProcess(request), start: () => client.startPreparedProcess(), close: () => client.close()};
    }});
    assert.deepEqual(await ready.messages.next(), {done: false, value: {type: 'synthetic-first'}});
    assert.deepEqual(events, ['sdk-query', 'sdk-next', 'sdk-bind', 'prepare', 'start', 'stdout']);
    await ready.close();
    await ready.close();
  }, {write: line => lines.push(line)});
  assert.deepEqual(events, ['sdk-query', 'sdk-next', 'sdk-bind', 'prepare', 'start', 'stdout', 'stop', 'sdk-close']);
  assert.deepEqual(lines, []);
});

for (const cancellation of ['close', 'abort']) {
  test(`intentional ${cancellation} during preparation has no native first-failure record or late start`, {timeout: 5000}, async t => {
    const events = [], lines = [], entered = Promise.withResolvers(), late = Promise.withResolvers(), abort = new AbortController();
    let requestSignal;
    const client = remote(t, events, async (operation, original, init) => {
      if (operation === 'prepare') {requestSignal = init.signal; entered.resolve(original); return late.promise;}
      assert.equal(operation, 'stop');
      return stopped(original);
    });
    client.spawnClaudeCodeProcess({...descriptor, signal: abort.signal});
    await withRunnerDiagnostics(async () => {
      const pending = observe(client.startPreparedProcess());
      const original = await entered.promise;
      try {
        if (cancellation === 'abort') abort.abort();
        await client.close();
      } finally {late.resolve(prepared(original));}
      assert.equal((await pending).error.code, 'REMOTE_TASK_REFUSED');
    }, {write: line => lines.push(line)});
    if (cancellation === 'abort') assert.equal(requestSignal.aborted, true);
    assert.deepEqual(events, ['prepare', 'stop']);
    assert.deepEqual(lines, []);
  });
}

test('expired preparation deadline still refuses before start and records native-prepare', async t => {
  const events = [], lines = [];
  let clock = Date.now();
  const client = remote(t, events, async (operation, original) => {
    if (operation === 'prepare') {clock += 2; return prepared(original);}
    assert.equal(operation, 'stop');
    return stopped(original);
  }, {now: () => clock, startupBudget: {nativePrepare: {maxMs: 1000, expiresAtMs: clock + 1}}});
  client.spawnClaudeCodeProcess(descriptor);
  await assert.rejects(withRunnerDiagnostics(() => {
    markRunnerStage('activity-stream');
    return client.startPreparedProcess();
  }, {write: line => lines.push(line)}), {code: 'REMOTE_TASK_REFUSED'});
  assert.deepEqual(events, ['prepare', 'stop']);
  assert.deepEqual(lines, [firstLine('native-prepare', 'REMOTE_TASK_REFUSED'), finalLine('REMOTE_TASK_REFUSED')]);
});

test('first record is immediate, immutable and emitted once despite later capture and cleanup', async () => {
  const lines = [], initial = coded('REMOTE_TASK_REFUSED'), replacement = new AggregateError([Error('synthetic-private-canary')]);
  await assert.rejects(withRunnerDiagnostics(async () => {
    markRunnerStage('activity-stream');
    captureRunnerFailure(initial, 'native-prepare');
    assert.deepEqual(lines, [firstLine('native-prepare', 'REMOTE_TASK_REFUSED')]);
    initial.code = 'EACCES';
    markRunnerStage('remote-cleanup');
    captureRunnerFailure(coded('NATIVE_EXECUTION_SDK_PREPARATION_CLEANUP_UNKNOWN'), 'sdk-prepare');
    throw replacement;
  }, {write: line => lines.push(line)}), error => error === replacement);
  assert.deepEqual(lines, [firstLine('native-prepare', 'REMOTE_TASK_REFUSED'), finalLine('REMOTE_TASK_REFUSED')]);
});

test('only fixed SDK codes are emitted and hostile errors/origins are never inspected', async () => {
  const allowed = ['REMOTE_TASK_REFUSED', 'NATIVE_EXECUTION_SDK_ITERATOR_REUSED', ...['CONFIGURATION', 'CLEANUP_UNKNOWN', 'BINDING_UNKNOWN', 'REFUSED', 'NO_LAUNCH'].map(suffix => 'NATIVE_EXECUTION_SDK_PREPARATION_' + suffix)];
  for (const code of allowed) {
    const lines = [], error = coded(code);
    await assert.rejects(withRunnerDiagnostics(async () => {
      markRunnerStage('activity-stream'); captureRunnerFailure(error, 'sdk-prepare'); throw error;
    }, {write: line => lines.push(line)}), thrown => thrown === error);
    assert.deepEqual(lines, [firstLine('sdk-prepare', code), finalLine(code)]);
  }
  let inspected = 0;
  const accessor = Object.defineProperty({}, 'code', {get() {inspected++; throw Error('private');}});
  const proxy = new Proxy({}, {getOwnPropertyDescriptor() {inspected++; throw Error('private');}, get() {inspected++; throw Error('private');}});
  // An unlisted code or message is never printed: an Error reports only its type, anything else NON_ERROR.
  for (const [error, code] of [[accessor, 'NON_ERROR'], [proxy, 'NON_ERROR'], [coded('REMOTE_TASK_REFUSED\nsynthetic-private-canary'), 'ERROR'], ['synthetic-private-canary', 'NON_ERROR'], [null, 'NON_ERROR']]) {
    const lines = [];
    // Node's assert.rejects inspects thrown proxies itself; retain the rejection in an inert envelope.
    const outcome = await observe(withRunnerDiagnostics(async () => {
      markRunnerStage('activity-stream'); captureRunnerFailure(error, 'sdk-prepare\nsynthetic-private-canary'); throw error;
    }, {write: line => lines.push(line)}));
    assert.equal(outcome.error, error);
    assert.deepEqual(lines, [firstLine('runtime', code, code), finalLine(code)]);
  }
  assert.equal(inspected, 0);
});

test('failed diagnostic writes cannot alter rejection or cause a duplicate first-line attempt', async () => {
  const attempts = [], error = coded('REMOTE_TASK_REFUSED');
  await assert.rejects(withRunnerDiagnostics(async () => {
    markRunnerStage('activity-stream');
    captureRunnerFailure(error, 'native-start');
    captureRunnerFailure(coded('EACCES'), 'sdk-prepare');
    throw error;
  }, {write(line) {attempts.push(line); throw Error('synthetic stderr failure');}}), thrown => thrown === error);
  assert.deepEqual(attempts, [firstLine('native-start', 'REMOTE_TASK_REFUSED'), finalLine('REMOTE_TASK_REFUSED')]);
});
