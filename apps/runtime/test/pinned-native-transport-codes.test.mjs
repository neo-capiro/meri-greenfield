// Pure classification of one pinned exchange's failure into the fixed, allowlisted constants. No network or filesystem.
import test from 'node:test';
import assert from 'node:assert/strict';
import {PINNED_NATIVE_FAILURE_CODES, classifyPinnedStatus, classifyPinnedRequestError} from '../pinned-native-transport.mjs';
import {captureRunnerFailure, withRunnerDiagnostics, markRunnerStage} from '../runner-runtime-diagnostics.mjs';

const coded = code => Object.assign(Error('synthetic'), {code});

test('status classes are fixed and never echo the status text', () => {
  assert.equal(classifyPinnedStatus(403), 'PINNED_NATIVE_STATUS_403');
  assert.equal(classifyPinnedStatus(503), 'PINNED_NATIVE_STATUS_503');
  assert.equal(classifyPinnedStatus(400), 'PINNED_NATIVE_STATUS_4XX');
  assert.equal(classifyPinnedStatus(404), 'PINNED_NATIVE_STATUS_4XX');
  assert.equal(classifyPinnedStatus(502), 'PINNED_NATIVE_STATUS_5XX');
  assert.equal(classifyPinnedStatus(302), 'PINNED_NATIVE_STATUS_OTHER');
  assert.equal(classifyPinnedStatus(101), 'PINNED_NATIVE_STATUS_OTHER');
  assert.equal(classifyPinnedStatus(600), 'PINNED_NATIVE_STATUS_OTHER');
  assert.equal(classifyPinnedStatus(403.5), 'PINNED_NATIVE_STATUS_OTHER');
  assert.equal(classifyPinnedStatus('403'), 'PINNED_NATIVE_STATUS_OTHER');
  assert.equal(classifyPinnedStatus(undefined), 'PINNED_NATIVE_STATUS_OTHER');
});

test('request error classes cover connect, TLS trust, socket and parser failures; anything else is the TRANSPORT fallback', () => {
  assert.equal(classifyPinnedRequestError(coded('ECONNREFUSED')), 'PINNED_NATIVE_CONNECT');
  assert.equal(classifyPinnedRequestError(coded('ENOTFOUND')), 'PINNED_NATIVE_CONNECT');
  assert.equal(classifyPinnedRequestError(coded('UNABLE_TO_VERIFY_LEAF_SIGNATURE')), 'PINNED_NATIVE_TLS');
  assert.equal(classifyPinnedRequestError(coded('ERR_TLS_CERT_ALTNAME_INVALID')), 'PINNED_NATIVE_TLS');
  assert.equal(classifyPinnedRequestError(coded('ERR_SSL_WRONG_VERSION_NUMBER')), 'PINNED_NATIVE_TLS');
  assert.equal(classifyPinnedRequestError(coded('ECONNRESET')), 'PINNED_NATIVE_SOCKET');
  assert.equal(classifyPinnedRequestError(coded('EPIPE')), 'PINNED_NATIVE_SOCKET');
  assert.equal(classifyPinnedRequestError(coded('HPE_INVALID_CONSTANT')), 'PINNED_NATIVE_RESPONSE');
  assert.equal(classifyPinnedRequestError(coded('SOMETHING_ELSE')), 'PINNED_NATIVE_TRANSPORT');
  assert.equal(classifyPinnedRequestError(coded('econnrefused')), 'PINNED_NATIVE_TRANSPORT');
  assert.equal(classifyPinnedRequestError(coded(7)), 'PINNED_NATIVE_TRANSPORT');
  assert.equal(classifyPinnedRequestError(Error('no code')), 'PINNED_NATIVE_TRANSPORT');
  assert.equal(classifyPinnedRequestError(null), 'PINNED_NATIVE_TRANSPORT');
  assert.equal(classifyPinnedRequestError('ECONNREFUSED'), 'PINNED_NATIVE_TRANSPORT');
  assert.equal(classifyPinnedRequestError({get code() {return 'ECONNREFUSED';}}), 'PINNED_NATIVE_TRANSPORT');
  assert.equal(classifyPinnedRequestError(new Proxy({}, {get() {throw Error('hostile');}})), 'PINNED_NATIVE_TRANSPORT');
  // A hostile descriptor trap must not throw out of an event listener (it would be an uncaught exception there).
  assert.equal(classifyPinnedRequestError(new Proxy({}, {getOwnPropertyDescriptor() {throw Error('hostile');}})), 'PINNED_NATIVE_TRANSPORT');
});

test('the class set is closed, constant-shaped and every member is accepted by the runner diagnostics allowlist', async () => {
  assert.ok(Object.isFrozen(PINNED_NATIVE_FAILURE_CODES));
  assert.equal(new Set(PINNED_NATIVE_FAILURE_CODES).size, PINNED_NATIVE_FAILURE_CODES.length);
  for (const code of PINNED_NATIVE_FAILURE_CODES) {
    assert.match(code, /^PINNED_NATIVE_[A-Z0-9_]{1,40}$/u);
    const lines = [];
    await withRunnerDiagnostics(async () => {markRunnerStage('activity-stream'); captureRunnerFailure(coded(code), 'native-start'); throw coded(code);},
      {write: line => lines.push(line)}).catch(() => {});
    assert.deepEqual(lines, [`RUNNER_FIRST_FAILURE origin=native-start code=${code}\n`, `RUNNER_RUNTIME_FAILED stage=activity-stream code=${code}\n`]);
  }
  // A look-alike outside the set is still UNKNOWN: the allowlist is exact, not a prefix match.
  const lines = [];
  await withRunnerDiagnostics(async () => {throw coded('PINNED_NATIVE_SECRET');}, {write: line => lines.push(line)}).catch(() => {});
  assert.deepEqual(lines, ['RUNNER_FIRST_FAILURE origin=runtime code=UNKNOWN\n', 'RUNNER_RUNTIME_FAILED stage=module-import code=UNKNOWN\n']);
});
