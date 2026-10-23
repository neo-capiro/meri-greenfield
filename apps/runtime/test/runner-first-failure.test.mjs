// Native SDK/run diagnostics preserve the first failure and never inspect private error content.
import test from 'node:test';
import assert from 'node:assert/strict';
import {withRunnerDiagnostics,markRunnerStage,captureRunnerFailure} from '../runner-runtime-diagnostics.mjs';
import {withoutDetail} from './runner-diagnostic-lines.mjs';
const firstLine=(origin,code,kind='ERROR')=>`RUNNER_FIRST_FAILURE origin=${origin} stage=activity-stream code=${code} class=${kind} exit=none signal=none\n`;
const finalLine=code=>`RUNNER_RUNTIME_FAILED stage=activity-stream code=${code}\n`;
const coded=code=>Object.assign(Error('synthetic-private-canary'),{code});
const observe=promise=>promise.then(value=>({value}),error=>({error}));

test('first record is immediate, immutable and emitted once despite later capture and cleanup', async () => {
  const lines = [], initial = coded('RUNNER_SDK_REGISTRATION_UNAVAILABLE'), replacement = new AggregateError([Error('synthetic-private-canary')]);
  await assert.rejects(withRunnerDiagnostics(async () => {
    markRunnerStage('activity-stream');
    captureRunnerFailure(initial, 'runtime');
    assert.deepEqual(lines, [firstLine('runtime', 'RUNNER_SDK_REGISTRATION_UNAVAILABLE')]);
    initial.code = 'EACCES';
    markRunnerStage('remote-cleanup');
    captureRunnerFailure(coded('SDK_CLEANUP_UNKNOWN'), 'runtime');
    throw replacement;
  }, {write: line => lines.push(withoutDetail(line))}), error => error === replacement);
  assert.deepEqual(lines, [firstLine('runtime', 'RUNNER_SDK_REGISTRATION_UNAVAILABLE'), finalLine('RUNNER_SDK_REGISTRATION_UNAVAILABLE')]);
});

test('only fixed SDK codes are emitted and hostile errors/origins are never inspected', async () => {
  const allowed = ['RUNNER_SDK_REGISTRATION_UNAVAILABLE','SDK_CLEANUP_UNKNOWN','SDK_EXECUTION_FAILED','SDK_RESULT_MISSING','SDK_RESULT_DUPLICATE','SESSION_PERSISTENCE_FAILED'];
  for (const code of allowed) {
    const lines = [], error = coded(code);
    await assert.rejects(withRunnerDiagnostics(async () => {
      markRunnerStage('activity-stream'); captureRunnerFailure(error, 'runtime'); throw error;
    }, {write: line => lines.push(withoutDetail(line))}), thrown => thrown === error);
    assert.deepEqual(lines, [firstLine('runtime', code), finalLine(code)]);
  }
  let inspected = 0;
  const accessor = Object.defineProperty({}, 'code', {get() {inspected++; throw Error('private');}});
  const proxy = new Proxy({}, {getOwnPropertyDescriptor() {inspected++; throw Error('private');}, get() {inspected++; throw Error('private');}});
  // An unlisted code or message is never printed: an Error reports only its type, anything else NON_ERROR.
  for (const [error, code] of [[accessor, 'NON_ERROR'], [proxy, 'NON_ERROR'], [coded('RUNNER_SDK_REGISTRATION_UNAVAILABLE\nsynthetic-private-canary'), 'ERROR'], ['synthetic-private-canary', 'NON_ERROR'], [null, 'NON_ERROR']]) {
    const lines = [];
    // Node's assert.rejects inspects thrown proxies itself; retain the rejection in an inert envelope.
    const outcome = await observe(withRunnerDiagnostics(async () => {
      markRunnerStage('activity-stream'); captureRunnerFailure(error, 'sdk-prepare\nsynthetic-private-canary'); throw error;
    }, {write: line => lines.push(withoutDetail(line))}));
    assert.equal(outcome.error, error);
    assert.deepEqual(lines, [firstLine('runtime', code, code), finalLine(code)]);
  }
  assert.equal(inspected, 0);
});

test('failed diagnostic writes cannot alter rejection or cause a duplicate first-line attempt', async () => {
  const attempts = [], error = coded('RUNNER_SDK_REGISTRATION_UNAVAILABLE');
  await assert.rejects(withRunnerDiagnostics(async () => {
    markRunnerStage('activity-stream');
    captureRunnerFailure(error, 'runtime');
    captureRunnerFailure(coded('EACCES'), 'runtime');
    throw error;
  }, {write(line) {attempts.push(withoutDetail(line)); throw Error('synthetic stderr failure');}}), thrown => thrown === error);
  assert.deepEqual(attempts, [firstLine('runtime', 'RUNNER_SDK_REGISTRATION_UNAVAILABLE'), finalLine('RUNNER_SDK_REGISTRATION_UNAVAILABLE')]);
});
