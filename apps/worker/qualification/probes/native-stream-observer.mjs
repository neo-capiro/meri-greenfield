// Observe the bytes consumed by the SDK without a competing stdout reader.
import { Transform } from 'node:stream';
import { createHash } from 'node:crypto';

export const MAX_NATIVE_STDOUT_BYTES = 4 * 1024 * 1024;

/** A lazy, backpressured tap. No source bytes flow until its consumer reads. */
export function observeNativeStdout(child, record, onViolation) {
  const source = child?.stdout;
  if (!source || typeof source.pipe !== 'function' || typeof source.once !== 'function') return;
  let started = false, total = 0, sourceEnded = false;
  const hash = createHash('sha256');
  const snapshot = () => {
    record.stdoutTotalBytes = total;
    record.stdoutSha256 = hash.copy().digest('hex');
  };
  const violation = reason => { if (typeof onViolation === 'function') onViolation(reason); };
  const tap = new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length;
      if (total > MAX_NATIVE_STDOUT_BYTES) {
        record.stdoutOverflow = true;
        snapshot(); violation('stdout overflow');
        callback(new Error('NATIVE_STDOUT_BOUND'));
        return;
      }
      hash.update(chunk); snapshot(); callback(null, chunk);
    },
    destroy(error, callback) {
      // The SDK owns this pipe through child.stdout. Preserve its destroy
      // lifecycle even though the observable readable is now the byte tap.
      source.destroy(); callback(error);
    }
  });
  // Transform's original _read must still run so writable/readable backpressure
  // and its buffered final chunk retain the native stream contract.
  const read = tap._read;
  tap._read = function(size) {
    if (!started) { started = true; source.pipe(tap); }
    return read.call(this, size);
  };
  source.on('error', () => {
    record.stdoutReadError = true;
    violation('stdout read failed');
    tap.destroy(new Error('NATIVE_STDOUT_READ'));
  });
  source.once('end', () => { sourceEnded = true; });
  source.once('close', () => {
    record.stdoutClosed = true; snapshot();
    if (!sourceEnded && !tap.destroyed) {
      record.stdoutReadError = true;
      violation('stdout closed before EOF');
      tap.destroy(new Error('NATIVE_STDOUT_PREMATURE_CLOSE'));
    }
  });
  tap.once('end', () => { record.stdoutEnded = true; snapshot(); });
  tap.on('error', () => { record.stdoutReadError = true; });
  snapshot();
  child.stdout = tap;
  if (Array.isArray(child.stdio)) child.stdio[1] = tap;
}

/** Only observed EOF/closure/error-free streams can become native evidence. */
export function nativeStreamFacts(record) {
  const stdout = { bytes: record.stdoutTotalBytes, sha256: record.stdoutSha256,
    endObserved: record.stdoutEnded === true, closed: record.stdoutClosed === true,
    error: record.stdoutReadError === true || record.stdoutOverflow === true };
  const stderr = { bytes: record.stderrTotalBytes, sha256: record.stderrSha256,
    endObserved: record.stderrEnded === true, closed: record.stderrClosed === true,
    error: record.stderrReadError === true, overflow: record.stderrOverflow === true };
  if (!stdout.endObserved || !stdout.closed || stdout.error || !stderr.endObserved ||
      !stderr.closed || stderr.error || stderr.overflow ||
      !Number.isSafeInteger(stdout.bytes) || !Number.isSafeInteger(stderr.bytes) ||
      !/^[0-9a-f]{64}$/.test(stdout.sha256) || !/^[0-9a-f]{64}$/.test(stderr.sha256)) {
    throw new Error('NATIVE_STREAM_OBSERVATION_REQUIRED');
  }
  return { stdout, stderr };
}
