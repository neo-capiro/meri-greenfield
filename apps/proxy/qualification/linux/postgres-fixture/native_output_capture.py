"""Private, bounded native fd1/2 collection; no Prisma or error classification.

Nest inside the existing Python text-suppression context. This module never
changes sys.stdout/stderr, their fixed fileno(), or their character budget.
Process-wide descriptors require a serialized trusted caller. No CLI exists.
"""
import math
import os
import threading
import time

NATIVE_BYTE_LIMIT = 2 * 1024 * 1024
_OWNER = threading.Lock()
_POLL_SECONDS = 0.005
_CLOSE_RESERVE_SECONDS = 0.02


class NativeOutputCaptureError(RuntimeError):
    """Only a fixed sanitized reason, never upstream bytes or exception text."""


def capture_native_output(deadline_monotonic):
    """Use the caller's existing absolute monotonic deadline without extension.

    check() observes live failures; it cannot asynchronously cancel caller work.
    On context exit borrowed descriptors are restored before EOF/drain checking.
    private_bytes() is available only after complete capture, even when the body
    itself raised. Never log, serialize, hash-export or persist these private bytes.
    """
    return _NativeCapture(deadline_monotonic)


class _NativeCapture:
    def __init__(self, deadline):
        if type(deadline) not in (int, float) or not math.isfinite(deadline):
            raise NativeOutputCaptureError('ORIGINAL_DEADLINE_TYPE')
        self._deadline = deadline
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._reader_finished = threading.Event()
        self._buffers = [bytearray(), bytearray()]
        self._observed = [0, 0]
        self._eof = [False, False]
        self._reads = []
        self._writes = []
        self._saved = []
        self._redirected = []
        self._owned = set()
        self._close_attempted = set()
        self._thread = None
        self._thread_start_attempted = False
        self._owner_acquired = False
        self._used = False
        self._closed = False
        self._restored = False
        self._body_failed = False
        self._failure = None

    def _fail(self, reason):
        with self._lock:
            if self._failure is None:
                self._failure = reason

    def _close_owned(self, fd):
        with self._lock:
            if fd not in self._owned or fd in self._close_attempted:
                return
            # close() errors can leave identity uncertain; never retry a
            # numeric descriptor which another thread could have reused.
            self._close_attempted.add(fd)
        try:
            os.close(fd)
        except OSError:
            self._fail('OWNED_DESCRIPTOR_CLOSE')
        else:
            with self._lock:
                self._owned.remove(fd)

    def __enter__(self):
        if self._used:
            raise NativeOutputCaptureError('SINGLE_USE_CAPTURE')
        self._used = True
        if time.monotonic() + _CLOSE_RESERVE_SECONDS >= self._deadline:
            raise NativeOutputCaptureError('ORIGINAL_DEADLINE_EXPIRED')
        if not _OWNER.acquire(blocking=False):
            raise NativeOutputCaptureError('NATIVE_DESCRIPTORS_ALREADY_OWNED')
        self._owner_acquired = True
        try:
            for fd in (1, 2):
                saved = os.dup(fd)
                self._owned.add(saved)
                self._saved.append(saved)
            for _ in (1, 2):
                read_fd, write_fd = os.pipe()
                self._owned.update((read_fd, write_fd))
                self._reads.append(read_fd)
                self._writes.append(write_fd)
                os.set_blocking(read_fd, False)
            self._thread = threading.Thread(target=self._read, name='private-native-fd-reader', daemon=True)
            # start() can launch the real reader and then be interrupted before
            # returning. A pre-call obligation cannot lose that ownership.
            self._thread_start_attempted = True
            self._thread.start()
            for index, fd in enumerate((1, 2)):
                # Even a failed/uncertain dup2 is safely restored from our
                # saved copy; record that obligation before its side effect.
                self._redirected.append(fd)
                os.dup2(self._writes[index], fd)
            for fd in self._writes:
                self._close_owned(fd)
            self.check()
            return self
        except BaseException:
            self._fail('CAPTURE_INITIALIZATION')
            self._finish()
            raise NativeOutputCaptureError('CAPTURE_INITIALIZATION') from None

    def _read(self):
        try:
            while not self._stop.is_set() and not all(self._eof):
                if time.monotonic() >= self._deadline - _CLOSE_RESERVE_SECONDS:
                    self._fail('ORIGINAL_DRAIN_DEADLINE')
                    break
                progressed = False
                for index, fd in enumerate(self._reads):
                    if self._eof[index]:
                        continue
                    try:
                        block = os.read(fd, 65536)
                    except BlockingIOError:
                        continue
                    if not block:
                        with self._lock:
                            self._eof[index] = True
                        progressed = True
                        continue
                    progressed = True
                    with self._lock:
                        self._observed[index] += len(block)
                        remaining = NATIVE_BYTE_LIMIT - sum(map(len, self._buffers))
                        self._buffers[index].extend(block[:remaining])
                        if len(block) > remaining and self._failure is None:
                            self._failure = 'NATIVE_BYTE_BOUND'
                    # Continue bounded discard after overflow so caller unwind
                    # does not strand a native writer on a full owned pipe.
                if not progressed:
                    self._stop.wait(_POLL_SECONDS)
        except BaseException:
            self._fail('NATIVE_READER_FAILURE')
        finally:
            for fd in self._reads:
                self._close_owned(fd)
            self._reader_finished.set()

    def check(self):
        if time.monotonic() >= self._deadline:
            self._fail('ORIGINAL_DEADLINE_EXPIRED')
        with self._lock:
            reason = self._failure
        if reason is not None:
            raise NativeOutputCaptureError(reason)

    def _finish(self):
        restored = True
        for fd in self._redirected:
            try:
                os.dup2(self._saved[fd - 1], fd)
            except OSError:
                restored = False
                self._fail('BORROWED_DESCRIPTOR_RESTORE')
        self._restored = restored
        for fd in (*self._writes, *self._saved):
            self._close_owned(fd)
        if self._thread_start_attempted:
            drain_until = self._deadline - _CLOSE_RESERVE_SECONDS
            while not self._reader_finished.is_set() and time.monotonic() < drain_until:
                self._reader_finished.wait(min(_POLL_SECONDS, max(0, drain_until - time.monotonic())))
            if not self._reader_finished.is_set():
                self._fail('ORIGINAL_DRAIN_DEADLINE')
                self._stop.set()
            # join is legal only once Python positively observes an actual
            # started thread. A not-yet-started/uncertain reader retains its
            # read descriptors; this owner must not close them underneath it.
            if self._thread.is_alive():
                self._thread.join(max(0, self._deadline - time.monotonic()))
            if not self._reader_stopped():
                self._fail('READER_STOP_UNKNOWN')
        else:
            for fd in self._reads:
                self._close_owned(fd)
        self._closed = True
        # Unknown cleanup must block another process-wide redirection. There is
        # deliberately no reset API: the trusted outer owner must end this
        # disposable process if descriptor/reader ownership cannot be proved.
        cleanup_proven = restored and not self._owned and self._reader_stopped()
        if self._owner_acquired and cleanup_proven:
            _OWNER.release()
            self._owner_acquired = False

    def __exit__(self, exc_type, exc, traceback):
        self._body_failed = exc_type is not None
        self._finish()
        if exc_type is None and not self.facts()['complete']:
            raise NativeOutputCaptureError(self._failure or 'NATIVE_DRAIN_UNKNOWN')
        return False

    def facts(self):
        """Sanitized observations only; body failure is separate from drain."""
        with self._lock:
            stopped = self._reader_stopped()
            return {'observedBytes': {'stdout': self._observed[0], 'stderr': self._observed[1]},
                    'retainedBytes': {'stdout': len(self._buffers[0]), 'stderr': len(self._buffers[1])},
                    'eof': {'stdout': self._eof[0], 'stderr': self._eof[1]},
                    'readerStopped': stopped, 'descriptorsRestored': self._restored,
                    'ownedDescriptorsClosed': not self._owned, 'closed': self._closed,
                    'bodyFailed': self._body_failed, 'failure': self._failure,
                    'complete': self._closed and self._restored and stopped and not self._owned
                                and all(self._eof) and self._failure is None}

    def _reader_stopped(self):
        return not self._thread_start_attempted or (
            self._reader_finished.is_set() and not self._thread.is_alive())

    def private_bytes(self):
        """Trusted in-process consumer only; caller owns/disposes returned copies."""
        if not self.facts()['complete']:
            raise NativeOutputCaptureError('PRIVATE_CAPTURE_INCOMPLETE')
        with self._lock:
            return bytes(self._buffers[0]), bytes(self._buffers[1])
