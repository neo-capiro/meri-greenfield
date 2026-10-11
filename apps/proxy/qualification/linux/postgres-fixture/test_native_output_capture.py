"""Harmless real pipes/threads only; no subprocess, native engine or network."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import threading
import time
import unittest
from unittest import mock


def deny(event, args):
    if event.startswith('socket.') or event in ('subprocess.Popen', 'os.system', 'os.posix_spawn'):
        raise PermissionError('OFFLINE_EFFECT_DENIED')


sys.addaudithook(deny)
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('private_native_capture_under_test', HERE/'native_output_capture.py')
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)


def identities():
    return [(os.fstat(fd).st_dev, os.fstat(fd).st_ino, os.fstat(fd).st_mode) for fd in (1, 2)]


def wait_failure(value):
    until = time.monotonic() + 1
    while value.facts()['failure'] is None and time.monotonic() < until:
        time.sleep(.005)
    return value.facts()['failure']


def write_all(fd, data):
    view = memoryview(data)
    while view:
        sent = os.write(fd, view)
        view = view[sent:]


class NativeOutputTests(unittest.TestCase):
    def test_import_has_no_descriptor_thread_or_output_effect(self):
        before = identities(), set(threading.enumerate()), sys.stdout, sys.stderr
        s = importlib.util.spec_from_file_location('second_inert_capture_import', HERE/'native_output_capture.py')
        m = importlib.util.module_from_spec(s)
        s.loader.exec_module(m)
        self.assertEqual(identities(), before[0])
        self.assertEqual(set(threading.enumerate()), before[1])
        self.assertIs(sys.stdout, before[2]); self.assertIs(sys.stderr, before[3])

    def test_normal_split_bytes_complete_and_restore(self):
        before = identities(), sys.stdout, sys.stderr
        value = capture.capture_native_output(time.monotonic()+2)
        with value:
            with self.assertRaisesRegex(capture.NativeOutputCaptureError, 'INCOMPLETE'):
                value.private_bytes()
            os.write(1, b'\xe2\x82')
            os.write(2, b'\xffstructured-synthetic')
            os.write(1, b'\xac')
        self.assertEqual(value.private_bytes(), (b'\xe2\x82\xac', b'\xffstructured-synthetic'))
        self.assertTrue(value.facts()['complete'])
        self.assertEqual(value.facts()['observedBytes'], {'stdout': 3, 'stderr': 21})
        self.assertEqual(identities(), before[0])
        self.assertIs(sys.stdout, before[1]); self.assertIs(sys.stderr, before[2])
        self.assertNotIn('structured-synthetic', json.dumps(value.facts()))

    def test_body_failure_kept_separate_from_complete_drain(self):
        before = identities()
        value = capture.capture_native_output(time.monotonic()+2)
        with self.assertRaisesRegex(RuntimeError, 'SYNTHETIC_BODY'):
            with value:
                os.write(2, b'synthetic-native-error')
                raise RuntimeError('SYNTHETIC_BODY')
        self.assertTrue(value.facts()['bodyFailed'])
        self.assertTrue(value.facts()['complete'])
        self.assertEqual(value.private_bytes(), (b'', b'synthetic-native-error'))
        self.assertEqual(identities(), before)

    def test_invalid_or_expired_deadline_allocates_no_pipe(self):
        for deadline in (None, True, '1', float('inf'), float('nan'), time.monotonic()-1):
            with self.subTest(deadline=deadline), mock.patch.object(capture.os, 'pipe', side_effect=AssertionError('ALLOCATED')):
                with self.assertRaises(capture.NativeOutputCaptureError):
                    with capture.capture_native_output(deadline):
                        self.fail('entered')

    def test_second_pipe_failure_closes_all_owned_and_restores_borrowed(self):
        before = identities(); allocated = []; calls = [0]
        real_pipe, real_dup = os.pipe, os.dup
        def pipe():
            calls[0] += 1
            if calls[0] == 2:
                raise OSError('SYNTHETIC_INIT')
            pair = real_pipe(); allocated.extend(pair); return pair
        def dup(fd):
            result = real_dup(fd); allocated.append(result); return result
        value = capture.capture_native_output(time.monotonic()+2)
        with mock.patch.object(capture.os, 'pipe', side_effect=pipe), mock.patch.object(capture.os, 'dup', side_effect=dup):
            with self.assertRaisesRegex(capture.NativeOutputCaptureError, 'INITIALIZATION'):
                with value:
                    self.fail('entered')
        self.assertEqual(identities(), before)
        self.assertTrue(value.facts()['ownedDescriptorsClosed'])
        self.assertTrue(value.facts()['readerStopped'])
        for fd in allocated:
            with self.assertRaises(OSError): os.fstat(fd)

    def test_partial_redirect_failure_restores_first_descriptor(self):
        before = identities(); real_dup2 = os.dup2; calls = [0]
        def dup2(*args, **kwargs):
            calls[0] += 1
            if calls[0] == 2: raise OSError('SYNTHETIC_SECOND_REDIRECT')
            return real_dup2(*args, **kwargs)
        value = capture.capture_native_output(time.monotonic()+2)
        with mock.patch.object(capture.os, 'dup2', side_effect=dup2):
            with self.assertRaisesRegex(capture.NativeOutputCaptureError, 'INITIALIZATION'):
                with value: self.fail('entered')
        self.assertEqual(identities(), before)
        self.assertTrue(value.facts()['descriptorsRestored'])
        self.assertTrue(value.facts()['readerStopped'])
        self.assertTrue(value.facts()['ownedDescriptorsClosed'])

    def test_thread_start_without_reader_retains_unknown_ownership(self):
        s = importlib.util.spec_from_file_location('unknown_start_capture', HERE/'native_output_capture.py')
        isolated = importlib.util.module_from_spec(s); s.loader.exec_module(isolated)
        before = identities(); value = isolated.capture_native_output(time.monotonic()+.1)
        try:
            # ident may be assigned before Python marks a thread started;
            # neither ident nor a failed start is permission to join/close.
            with mock.patch.object(isolated.threading.Thread, 'start', side_effect=RuntimeError('SYNTHETIC_START')), \
                    mock.patch.object(isolated.threading.Thread, 'ident', property(lambda _: 1)), \
                    mock.patch.object(isolated.threading.Thread, 'join', side_effect=AssertionError('JOIN_NOT_STARTED')):
                with self.assertRaisesRegex(isolated.NativeOutputCaptureError, 'INITIALIZATION'):
                    with value: self.fail('entered')
            self.assertEqual(identities(), before)
            self.assertFalse(value.facts()['readerStopped'])
            self.assertFalse(value.facts()['ownedDescriptorsClosed'])
            self.assertFalse(value.facts()['complete'])
            for fd in value._reads: os.fstat(fd)
            with self.assertRaisesRegex(isolated.NativeOutputCaptureError, 'ALREADY_OWNED'):
                with isolated.capture_native_output(time.monotonic()+1): self.fail('ownership reset')
        finally:
            # This mock never launched a reader. Only the test knows that fact;
            # production cannot turn a raised start() into termination proof.
            for fd in value._reads: os.close(fd)

    def test_redirect_real_effect_then_baseexception_restores_borrowed(self):
        class Interrupt(BaseException): pass
        before = identities(); real_dup2 = os.dup2; calls = [0]
        def interrupted(*args, **kwargs):
            result = real_dup2(*args, **kwargs)
            calls[0] += 1
            if calls[0] == 1: raise Interrupt('SYNTHETIC_AFTER_REAL_DUP2')
            return result
        value = capture.capture_native_output(time.monotonic()+1)
        with mock.patch.object(capture.os, 'dup2', side_effect=interrupted):
            with self.assertRaisesRegex(capture.NativeOutputCaptureError, 'INITIALIZATION'):
                with value: self.fail('entered')
        self.assertEqual(identities(), before)
        self.assertTrue(value.facts()['descriptorsRestored'])
        self.assertTrue(value.facts()['readerStopped'])
        self.assertTrue(value.facts()['ownedDescriptorsClosed'])

    def test_thread_real_start_then_baseexception_waits_for_reader(self):
        class Interrupt(BaseException): pass
        before = identities(); real_start = threading.Thread.start
        def interrupted(thread):
            real_start(thread)
            raise Interrupt('SYNTHETIC_AFTER_REAL_START')
        value = capture.capture_native_output(time.monotonic()+1)
        with mock.patch.object(capture.threading.Thread, 'start', interrupted):
            with self.assertRaisesRegex(capture.NativeOutputCaptureError, 'INITIALIZATION'):
                with value: self.fail('entered')
        self.assertEqual(identities(), before)
        self.assertTrue(value.facts()['readerStopped'])
        self.assertTrue(value.facts()['ownedDescriptorsClosed'])
        self.assertFalse(value._thread.is_alive())

    def test_interrupted_delayed_reader_is_not_closed_or_released(self):
        class Interrupt(BaseException): pass
        s = importlib.util.spec_from_file_location('delayed_start_capture', HERE/'native_output_capture.py')
        isolated = importlib.util.module_from_spec(s); s.loader.exec_module(isolated)
        gate = threading.Event(); real_start = threading.Thread.start; real_read = isolated._NativeCapture._read
        def delayed(value):
            gate.wait(1)
            real_read(value)
        def interrupted(thread):
            real_start(thread)
            raise Interrupt('SYNTHETIC_AFTER_DELAYED_START')
        value = isolated.capture_native_output(time.monotonic()+.1)
        try:
            with mock.patch.object(isolated._NativeCapture, '_read', delayed), mock.patch.object(isolated.threading.Thread, 'start', interrupted):
                with self.assertRaisesRegex(isolated.NativeOutputCaptureError, 'INITIALIZATION'):
                    with value: self.fail('entered')
            self.assertTrue(value._thread.is_alive())
            self.assertFalse(value.facts()['readerStopped'])
            self.assertFalse(value.facts()['ownedDescriptorsClosed'])
            for fd in value._reads: os.fstat(fd)
            with self.assertRaisesRegex(isolated.NativeOutputCaptureError, 'ALREADY_OWNED'):
                with isolated.capture_native_output(time.monotonic()+1): self.fail('ownership reset')
        finally:
            gate.set(); value._thread.join(1)
        self.assertFalse(value._thread.is_alive())
        self.assertTrue(value.facts()['ownedDescriptorsClosed'])

    def test_uncertain_owned_close_is_not_reported_closed_or_retried(self):
        # Unknown ownership intentionally poisons this canonical module's
        # reservation. Isolate it from other independent test contexts.
        s = importlib.util.spec_from_file_location('uncertain_close_capture', HERE/'native_output_capture.py')
        isolated = importlib.util.module_from_spec(s); s.loader.exec_module(isolated)
        before = identities(); real_close = os.close; failed = []; calls = []
        def close(fd):
            calls.append(fd)
            if not failed:
                failed.append(fd)
                raise OSError('SYNTHETIC_UNCERTAIN_CLOSE')
            return real_close(fd)
        value = isolated.capture_native_output(time.monotonic()+2)
        try:
            with mock.patch.object(isolated.os, 'close', side_effect=close):
                with self.assertRaisesRegex(isolated.NativeOutputCaptureError, 'INITIALIZATION'):
                    with value: self.fail('entered')
            self.assertFalse(value.facts()['ownedDescriptorsClosed'])
            self.assertFalse(value.facts()['complete'])
            self.assertEqual(calls.count(failed[0]), 1)
            self.assertEqual(identities(), before)
            with self.assertRaisesRegex(isolated.NativeOutputCaptureError, 'ALREADY_OWNED'):
                with isolated.capture_native_output(time.monotonic()+2): self.fail('ownership reset')
        finally:
            # The injected close never ran. This test alone owns this surviving
            # harmless descriptor; cleanup here is not a capture success claim.
            if failed: real_close(failed[0])

    def test_aggregate_native_overflow_is_live_and_never_complete(self):
        before = identities(); value = capture.capture_native_output(time.monotonic()+3)
        with self.assertRaisesRegex(capture.NativeOutputCaptureError, 'NATIVE_BYTE_BOUND'):
            with value:
                write_all(1, b'a'*capture.NATIVE_BYTE_LIMIT)
                write_all(2, b'b'*32)
                self.assertEqual(wait_failure(value), 'NATIVE_BYTE_BOUND')
                with self.assertRaisesRegex(capture.NativeOutputCaptureError, 'NATIVE_BYTE_BOUND'): value.check()
        facts = value.facts()
        self.assertEqual(sum(facts['retainedBytes'].values()), 2*1024*1024)
        self.assertEqual(sum(facts['observedBytes'].values()), 2*1024*1024+32)
        self.assertFalse(facts['complete'])
        self.assertTrue(facts['readerStopped']); self.assertTrue(facts['ownedDescriptorsClosed'])
        with self.assertRaisesRegex(capture.NativeOutputCaptureError, 'INCOMPLETE'): value.private_bytes()
        self.assertEqual(identities(), before)

    def test_open_duplicated_writer_is_unknown_not_eof(self):
        before = identities(); started = time.monotonic(); writer = None
        deadline = started+.15; value = capture.capture_native_output(deadline)
        try:
            with self.assertRaisesRegex(capture.NativeOutputCaptureError, 'DRAIN_DEADLINE'):
                with value:
                    writer = os.dup(1)
                    os.write(writer, b'harmless-lingering-writer')
            facts = value.facts()
            self.assertFalse(facts['eof']['stdout']); self.assertFalse(facts['complete'])
            self.assertTrue(facts['readerStopped']); self.assertTrue(facts['ownedDescriptorsClosed'])
            with self.assertRaises(capture.NativeOutputCaptureError): value.private_bytes()
            self.assertLess(time.monotonic()-started, .5)
        finally:
            if writer is not None: os.close(writer)
        self.assertEqual(identities(), before)

    def test_original_deadline_expiry_refuses_without_renewal(self):
        before = identities(); value = capture.capture_native_output(time.monotonic()+.08)
        with self.assertRaises(capture.NativeOutputCaptureError):
            with value: time.sleep(.1)
        self.assertFalse(value.facts()['complete'])
        self.assertEqual(identities(), before)

    def test_nested_and_reused_capture_refused(self):
        value = capture.capture_native_output(time.monotonic()+2)
        with value:
            with self.assertRaisesRegex(capture.NativeOutputCaptureError, 'ALREADY_OWNED'):
                with capture.capture_native_output(time.monotonic()+2): self.fail('nested')
        with self.assertRaisesRegex(capture.NativeOutputCaptureError, 'SINGLE_USE'):
            with value: self.fail('reused')
        self.assertTrue(value.facts()['complete'])

    def test_reader_error_is_sanitized_and_refuses_private_output(self):
        value = capture.capture_native_output(time.monotonic()+2)
        with self.assertRaisesRegex(capture.NativeOutputCaptureError, 'NATIVE_READER_FAILURE'):
            with value:
                # Inject after completed setup, so this is a reader-lifecycle
                # failure rather than a race with the initialization check.
                with mock.patch.object(capture.os, 'read', side_effect=OSError('DO_NOT_EXPORT_SYNTHETIC_DETAIL')):
                    self.assertEqual(wait_failure(value), 'NATIVE_READER_FAILURE')
        self.assertNotIn('DO_NOT_EXPORT', json.dumps(value.facts()))
        self.assertTrue(value.facts()['readerStopped']); self.assertTrue(value.facts()['ownedDescriptorsClosed'])

    def test_nesting_uses_existing_python_sinks_and_shared_text_budget(self):
        s = importlib.util.spec_from_file_location('accepted_peer_for_composition', HERE/'prisma-peer.py')
        peer = importlib.util.module_from_spec(s); s.loader.exec_module(peer)
        before = identities(), sys.stdout, sys.stderr
        with peer.discard_native_output():
            out, err = sys.stdout, sys.stderr
            with capture.capture_native_output(time.monotonic()+2) as value:
                self.assertIs(sys.stdout, out); self.assertIs(sys.stderr, err)
                self.assertEqual((out.fileno(), err.fileno()), (1, 2))
                out.write('x'*(1024*1024)); err.write('y'*(1024*1024))
                with self.assertRaisesRegex(ValueError, 'UPSTREAM_OUTPUT_BOUND'): out.write('z')
                os.write(out.fileno(), b'native-only')
            self.assertEqual(value.private_bytes(), (b'native-only', b''))
            self.assertEqual(out.budget[0], 2*1024*1024+1)
            self.assertIs(sys.stdout, out); self.assertIs(sys.stderr, err)
        self.assertEqual(identities(), before[0])
        self.assertIs(sys.stdout, before[1]); self.assertIs(sys.stderr, before[2])


if __name__ == '__main__':
    unittest.main()
