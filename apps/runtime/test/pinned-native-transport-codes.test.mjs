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
  assert.equal(classifyPinnedStatus(undefined), 'PINNED_NATIVE_STATUS_OTHER');
});

test('request error classes cover connect, TLS trust, socket and parser failures; anything else stays REFUSED', () => {
  assert.equal(classifyPinnedRequestError(coded('ECONNREFUSED')), 'PINNED_NATIVE_CONNECT');
  assert.equal(classifyPinnedRequestError(coded('ENOTFOUND')), 'PINNED_NATIVE_CONNECT');
  assert.equal(classifyPinnedRequestError(coded('UNABLE_TO_VERIFY_LEAF_SIGNATURE')), 'PINNED_NATIVE_TLS');
  assert.equal(classifyPinnedRequestError(coded('ERR_TLS_CERT_ALTNAME_INVALID')), 'PINNED_NATIVE_TLS');
  assert.equal(classifyPinnedRequestError(coded('ERR_SSL_WRONG_VERSION_NUMBER')), 'PINNED_NATIVE_TLS');
  assert.equal(classifyPinnedRequestError(coded('ECONNRESET')), 'PINNED_NATIVE_SOCKET');
  assert.equal(classifyPinnedRequestError(coded('EPIPE')), 'PINNED_NATIVE_SOCKET');
  assert.equal(classifyPinnedRequestError(coded('HPE_INVALID_CONSTANT')), 'PINNED_NATIVE_RESPONSE');
  assert.equal(classifyPinnedRequestError(coded('SOMETHING_ELSE')), 'PINNED_NATIVE_REFUSED');
  assert.equal(classifyPinnedRequestError(Error('no code')), 'PINNED_NATIVE_REFUSED');
  assert.equal(classifyPinnedRequestError(null), 'PINNED_NATIVE_REFUSED');
  assert.equal(classifyPinnedRequestError(new Proxy({}, {get() {throw Error('hostile');}})), 'PINNED_NATIVE_REFUSED');
});

test('every pinned failure class is accepted by the runner diagnostics allowlist', async () => {
  for (const code of PINNED_NATIVE_FAILURE_CODES) {
    const lines = [];
    await withRunnerDiagnostics(async () => {markRunnerStage('activity-stream'); captureRunnerFailure(coded(code), 'native-start'); throw coded(code);},
      {write: line => lines.push(line)}).catch(() => {});
    assert.deepEqual(lines, [`RUNNER_FIRST_FAILURE origin=native-start code=${code}\n`, `RUNNER_RUNTIME_FAILED stage=activity-stream code=${code}\n`]);
  }
});
