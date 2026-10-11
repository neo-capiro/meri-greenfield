import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { createHash } from 'node:crypto';
import { observeNativeStdout, nativeStreamFacts, MAX_NATIVE_STDOUT_BYTES } from './native-stream-observer.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture() {
  const source = new PassThrough(), child = { stdout: source, stdio: [null, source, null] };
  const record = {}, violations = [];
  observeNativeStdout(child, record, reason => violations.push(reason));
  return { source, child, record, violations };
}
test('stdout tap is lazy and preserves exact consumed bytes and SDK readable shape', async () => {
  const f = fixture();
  assert.equal(f.source.readableFlowing, null);
  assert.equal(f.source.listenerCount('data'), 0);
  f.source.write(Buffer.from('before-consumer'));
  assert.equal(f.record.stdoutTotalBytes, 0);
  assert.equal(f.child.stdout, f.child.stdio[1]);
  assert.equal(typeof f.child.stdout[Symbol.asyncIterator], 'function');
  const received = [];
  const consume = (async () => { for await (const chunk of f.child.stdout) received.push(chunk); })();
  f.source.end(Buffer.from('\nafter-consumer'));
  await consume;
  const bytes = Buffer.concat(received);
  assert.equal(bytes.toString(), 'before-consumer\nafter-consumer');
  assert.equal(f.record.stdoutTotalBytes, bytes.length);
  assert.equal(f.record.stdoutSha256, sha(bytes));
  assert.equal(f.record.stdoutEnded, true);
  assert.equal(f.record.stdoutClosed, true);
  assert.deepEqual(f.violations, []);
});
test('stdout is backpressured when the SDK consumer stops reading', async () => {
  const f = fixture();
  f.child.stdout.read(0);
  let accepted = 0;
  while (f.source.write(Buffer.alloc(16384)) && ++accepted < 1000) {}
  assert.ok(accepted < 1000, 'the observer cannot drain an unconsumed stdout without bound');
  assert.ok(f.record.stdoutTotalBytes < MAX_NATIVE_STDOUT_BYTES);
  f.source.destroy(); f.child.stdout.destroy();
});
test('SDK consumer destruction closes the original owned stdout pipe', async () => {
  const f = fixture();
  f.child.stdout.read(0); f.source.write(Buffer.from('unconsumed native bytes'));
  const closed = new Promise(resolve => f.source.once('close', resolve));
  f.child.stdout.destroy(); await closed;
  assert.equal(f.source.destroyed, true);
  assert.equal(f.record.stdoutClosed, true);
  assert.equal(f.record.stdoutEnded, undefined, 'destroying unconsumed bytes cannot establish EOF');
});
test('stdout read error is a fixed failure without leaking raw error text', async () => {
  const f = fixture();
  const consume = (async () => { for await (const _chunk of f.child.stdout) {} })();
  f.source.destroy(new Error('OPAQUE_SYNTHETIC_CREDENTIAL'));
  await assert.rejects(consume, /NATIVE_STDOUT_READ/);
  assert.equal(f.record.stdoutReadError, true);
  assert.deepEqual(f.violations, ['stdout read failed']);
  assert.equal(JSON.stringify(f.record).includes('OPAQUE_SYNTHETIC_CREDENTIAL'), false);
});
test('original stdout closes without EOF as a bounded failure rather than hanging', async () => {
  const f = fixture();
  const consume = (async () => { for await (const _chunk of f.child.stdout) {} })();
  f.source.destroy();
  await assert.rejects(consume, /NATIVE_STDOUT_PREMATURE_CLOSE/);
  assert.equal(f.record.stdoutReadError, true);
  assert.deepEqual(f.violations, ['stdout closed before EOF']);
});
test('stdout overflow refuses evidence and terminates the bounded stream', async () => {
  const f = fixture();
  const consume = (async () => { for await (const _chunk of f.child.stdout) {} })();
  f.source.end(Buffer.alloc(MAX_NATIVE_STDOUT_BYTES + 1));
  await assert.rejects(consume, /NATIVE_STDOUT_BOUND/);
  assert.equal(f.record.stdoutOverflow, true);
  assert.deepEqual(f.violations, ['stdout overflow']);
});
test('stream proof requires both EOF and close and rejects any error/overflow', () => {
  const record = { stdoutTotalBytes: 0, stdoutSha256: sha(''), stdoutEnded: true,
    stdoutClosed: true, stderrTotalBytes: 0, stderrSha256: sha(''), stderrEnded: true, stderrClosed: true };
  assert.deepEqual(nativeStreamFacts(record).stderr, { bytes: 0, sha256: sha(''),
    endObserved: true, closed: true, error: false, overflow: false });
  for (const change of [{ stdoutEnded: false }, { stdoutClosed: false }, { stderrEnded: false },
    { stderrClosed: false }, { stderrOverflow: true }, { stderrReadError: true },
    { stdoutReadError: true }, { stdoutOverflow: true }, { stdoutSha256: undefined }, { stderrTotalBytes: undefined }]) {
    assert.throws(() => nativeStreamFacts({ ...record, ...change }), /NATIVE_STREAM_OBSERVATION_REQUIRED/);
  }
});
