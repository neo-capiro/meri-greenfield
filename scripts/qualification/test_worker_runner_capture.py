"""Source-only synthetic filesystem observations; actual Windows remains unrun."""
from contextlib import contextmanager
import copy
import hashlib
import json
import os
from pathlib import Path
import signal
import stat
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import worker_runner_capture as capture
import worker_runner_inventory as inventory


class RunnerCapture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.prefix = self.root / 'Python'
        (self.prefix / 'Lib' / 'site-packages').mkdir(parents=True)
        (self.prefix / 'DLLs').mkdir()
        self.executable = self.prefix / 'python.exe'
        self.executable.write_bytes(b'MZ synthetic Python')
        (self.prefix / 'Lib' / 'os.py').write_bytes(b'# synthetic os\n')
        (self.prefix / 'Lib' / 'site-packages' / 'private.py').write_bytes(b'EXCLUDED_PRIVATE_MARKER')
        (self.prefix / 'python311.dll').write_bytes(b'synthetic DLL')
        (self.prefix / 'DLLs' / '_ssl.pyd').write_bytes(b'synthetic pyd')
        self.repo = self.root / 'repo'
        (self.repo / '.task-inputs').mkdir(parents=True)
        for name in capture.HELPERS:
            path = self.repo / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b'RAW_HELPER_CONTENT_MUST_NOT_BE_RETAINED\n')
        self.aws = self.root / 'aws.exe'
        self.aws.write_bytes(b'MZ synthetic AWS CLI')
        self.output = self.repo / '.task-inputs' / 'worker-runner-capture-synthetic-r1'
        self.runtime = {'platform': 'win32', 'executable': str(self.executable),
                        'basePrefix': str(self.prefix), 'version': [3, 11, 15]}
        self.calls = []

    def version(self, argv, **kwargs):
        self.calls.append((argv, kwargs))
        return 0, b'aws-cli/2.37.12 Python/3.13.11 Windows/11 exe/AMD64\n', b''

    def measure(self, **kwargs):
        return inventory.inventory(self.executable, self.prefix, self.repo, capture.HELPERS, **kwargs)

    def run_capture(self, **kwargs):
        arguments = {'runtime': self.runtime, 'repository': self.repo,
                     'version_runner': self.version, 'aws_executable': str(self.aws)}
        arguments.update(kwargs)
        return capture.capture(str(self.output), True, **arguments)

    def test_success_has_exact_selected_scope_no_contents_or_authority(self):
        result = self.run_capture()
        self.assertFalse(result['buildAuthorized'])
        observed = json.loads((self.output / 'runner-capture.json').read_bytes())
        self.assertEqual(len(observed['runtime']['files']), 4)
        self.assertEqual({row['path'] for row in observed['helperFiles']}, set(capture.HELPERS))
        self.assertFalse(observed['callerObserved'])
        self.assertTrue(observed['stsEvidenceRequiredSeparately'])
        self.assertFalse(observed['coverage']['wholeHermesEnvironment'])
        self.assertFalse(observed['coverage']['completeExecutableClosure'])
        self.assertIn('existing .pyc bytecode', observed['coverage']['excluded'])
        self.assertIn('stdlib/installation .zip archives', observed['coverage']['excluded'])
        self.assertFalse(observed['coverage']['loadedNativeDependenciesQualified'])
        self.assertFalse(observed['coverage']['osAclQualified'])
        self.assertFalse(observed['awsCli']['wholeInstallationQualified'])
        self.assertEqual(observed['awsRequests'], 0)
        for field in ('runnerQualified', 'buildAuthorized', 'scanAdmitted', 'runtimeAdmitted', 'g1Admitted'):
            self.assertIs(observed[field], False)
        raw = (self.output / 'runner-capture.json').read_bytes()
        self.assertNotIn(b'EXCLUDED_PRIVATE_MARKER', raw)
        self.assertNotIn(b'RAW_HELPER_CONTENT_MUST_NOT_BE_RETAINED', raw)
        self.assertEqual(self.calls[0][0], [capture.AWS_EXE, '--version'])
        index = json.loads((self.output / 'capture-index.json').read_bytes())
        for row in index['files']:
            data = (self.output / row['path']).read_bytes()
            self.assertEqual((len(data), hashlib.sha256(data).hexdigest()), (row['bytes'], row['sha256']))

    def test_wrong_host_and_version_before_io_or_native_invocation(self):
        for field, value in (('platform', 'linux'), ('version', [3, 12, 14])):
            runtime = dict(self.runtime, **{field: value})
            with self.subTest(field=field), patch.object(inventory.Filesystem, 'lstat', side_effect=AssertionError('unexpected IO')):
                with self.assertRaises(ValueError): self.run_capture(runtime=runtime)
            self.assertEqual(self.calls, [])
            self.assertFalse(self.output.exists())

    def test_missing_config_refuses_before_host_files_or_output(self):
        with patch.object(capture, 'observed_runtime', return_value=self.runtime), \
                patch.object(inventory.Filesystem, 'lstat', side_effect=AssertionError('unexpected IO')):
            self.assertEqual(capture.main([]), 2)
        self.assertFalse(self.output.exists())

    def test_output_syntax_and_existing_slot_refuse(self):
        for output in ('relative', str(self.repo / 'outside'), str(self.output.parent / 'bad-name')):
            with self.subTest(output=output), self.assertRaises(ValueError):
                capture.validate_config(output, True, self.runtime, self.repo)
        self.output.mkdir()
        borrowed = self.output / 'borrowed.txt'; borrowed.write_bytes(b'preserve')
        with self.assertRaises(ValueError): self.run_capture()
        self.assertEqual(borrowed.read_bytes(), b'preserve')
        self.assertEqual(self.calls, [])

    def test_dangling_output_link_refuses_before_native(self):
        self.output.symlink_to(self.root / 'absent', target_is_directory=True)
        with self.assertRaises(ValueError): self.run_capture()
        self.assertTrue(self.output.is_symlink())
        self.assertEqual(self.calls, [])

    def test_symlink_file_directory_and_hardlink_refused(self):
        path = self.prefix / 'Lib' / 'os.py'
        original = path.read_bytes()
        path.unlink(); path.symlink_to(self.executable)
        with self.assertRaises(ValueError): self.measure()
        path.unlink(); path.write_bytes(original)
        link = self.prefix / 'Lib' / 'linked'; link.symlink_to(self.prefix / 'DLLs', target_is_directory=True)
        with self.assertRaises(ValueError): self.measure()
        link.unlink()
        hardlink = self.root / 'borrowed-link'; os.link(path, hardlink)
        with self.assertRaises(ValueError): self.measure()
        self.assertTrue(hardlink.exists())

    def test_reparse_attribute_refused(self):
        selected = self.prefix / 'Lib' / 'os.py'
        class Reparse(inventory.Filesystem):
            def lstat(self, path):
                info = os.lstat(path)
                if Path(path) == selected:
                    return SimpleNamespace(**{name: getattr(info, name) for name in
                        ('st_dev', 'st_ino', 'st_mode', 'st_nlink', 'st_size', 'st_mtime_ns', 'st_ctime_ns')},
                        st_file_attributes=0x400)
                return info
        with self.assertRaises(ValueError): self.measure(fs=Reparse())

    def test_opened_permissions_are_independently_stable(self):
        class WindowsRepresentations(inventory.Filesystem):
            def fstat(self, fd):
                info = os.fstat(fd)
                values = {name: getattr(info, name) for name in
                    ('st_dev', 'st_ino', 'st_mode', 'st_nlink', 'st_size', 'st_mtime_ns', 'st_ctime_ns')}
                values['st_mode'] = stat.S_IFREG | stat.S_IRUSR
                return SimpleNamespace(**values, st_file_attributes=0x20)
        measured = self.measure(fs=WindowsRepresentations())
        self.assertEqual(len(measured['files']), 4)

    def test_casefold_and_explicit_duplicate_paths_refused(self):
        (self.prefix / 'Lib' / 'OS.PY').write_bytes(b'case alias')
        with self.assertRaises(ValueError): self.measure()
        (self.prefix / 'Lib' / 'OS.PY').unlink()
        with self.assertRaises(ValueError):
            inventory.inventory(self.executable, self.prefix, self.repo, capture.HELPERS + (capture.HELPERS[0],))

    def test_helper_traversal_and_missing_helper_refused(self):
        with self.assertRaises(ValueError):
            inventory.inventory(self.executable, self.prefix, self.repo, ('../outside.py',))
        (self.repo / capture.HELPERS[0]).unlink()
        with self.assertRaises(OSError): self.measure()

    def test_member_entry_file_aggregate_and_deadline_bounds(self):
        for limits in (inventory.Limits(files=1), inventory.Limits(entries=1),
                       inventory.Limits(file_bytes=1), inventory.Limits(total_bytes=1)):
            with self.subTest(limits=limits), self.assertRaises(ValueError): self.measure(limits=limits)
        with self.assertRaises(ValueError): self.measure(clock=lambda: 10, end=10)
        with self.assertRaises(ValueError): self.measure(limits=inventory.Limits(files=True))

    def test_read_mutation_detected_and_handle_closed(self):
        selected = self.prefix / 'Lib' / 'os.py'
        class Mutating(inventory.Filesystem):
            changed = False
            closes = 0
            def read(self, fd, size):
                chunk = os.read(fd, size)
                if not self.changed:
                    self.changed = True
                    selected.write_bytes(b'changed while inventory hashes')
                return chunk
            def close(self, fd):
                self.closes += 1
                os.close(fd)
        fs = Mutating()
        with self.assertRaises(ValueError): self.measure(fs=fs)
        self.assertGreater(fs.closes, 0)

    def test_extra_or_missing_member_on_rescan_refused(self):
        lib = self.prefix / 'Lib'
        for operation in ('extra', 'missing'):
            class RescanChange(inventory.Filesystem):
                visits = 0
                @contextmanager
                def children(self, path):
                    if Path(path) == lib:
                        self.visits += 1
                        if self.visits == 2:
                            if operation == 'extra': (lib / 'new.py').write_bytes(b'new')
                            else: (lib / 'os.py').unlink()
                    with super().children(path) as rows:
                        yield rows
            with self.subTest(operation=operation), self.assertRaises((ValueError, OSError)):
                self.measure(fs=RescanChange())
            (lib / 'new.py').unlink(missing_ok=True)
            (lib / 'os.py').write_bytes(b'# restored synthetic os\n')

    def test_version_failure_oversize_and_changed_executable_leave_no_slot(self):
        for response in ((1, b'', b'failure'), (0, b'x'*65537, b''), (0, b'not aws version\n', b'')):
            with self.subTest(response=response[0]), self.assertRaises(ValueError):
                self.run_capture(version_runner=lambda *args, **kwargs: response)
            self.assertFalse(self.output.exists())
        def mutate(*args, **kwargs):
            self.aws.write_bytes(b'changed AWS executable')
            return self.version(*args, **kwargs)
        with self.assertRaises(ValueError): self.run_capture(version_runner=mutate)
        self.assertFalse(self.output.exists())

    def test_runtime_mutation_during_version_capture_is_refused(self):
        def mutate(*args, **kwargs):
            (self.prefix / 'Lib' / 'os.py').write_bytes(b'mutated after first snapshot')
            return self.version(*args, **kwargs)
        with self.assertRaises(ValueError): self.run_capture(version_runner=mutate)
        self.assertFalse(self.output.exists())

    def test_writer_failure_cleans_only_created_resources(self):
        with patch.object(os, 'fsync', side_effect=OSError('synthetic disk failure')):
            with self.assertRaises(OSError): inventory.write_result(self.output, {'owned.json': b'{}'})
        self.assertFalse(self.output.exists())
        self.assertTrue(self.prefix.is_dir())

    def test_writer_foreign_file_preserved_on_failure(self):
        def fail(fd):
            (self.output / 'foreign.txt').write_bytes(b'borrowed')
            raise OSError('synthetic failure')
        with patch.object(os, 'fsync', side_effect=fail), self.assertRaises(ValueError):
            inventory.write_result(self.output, {'owned.json': b'{}'})
        self.assertEqual((self.output / 'foreign.txt').read_bytes(), b'borrowed')
        self.assertFalse((self.output / 'owned.json').exists())

    def test_writer_corruption_readback_refuses_and_cleans_owned_slot(self):
        def corrupt(fd):
            (self.output / 'owned.json').write_bytes(b'corrupted after flush')
        with patch.object(os, 'fsync', side_effect=corrupt), self.assertRaises(ValueError):
            inventory.write_result(self.output, {'owned.json': b'{}'})
        self.assertFalse(self.output.exists())

    def test_writer_substituted_directory_is_preserved(self):
        old = self.output.with_name(self.output.name + '-renamed')
        def replace(fd):
            self.output.rename(old)
            self.output.mkdir()
            (self.output / 'borrowed.txt').write_bytes(b'preserve replacement')
            raise OSError('synthetic directory substitution')
        with patch.object(os, 'fsync', side_effect=replace), self.assertRaises(OSError):
            inventory.write_result(self.output, {'owned.json': b'{}'})
        self.assertEqual((self.output / 'borrowed.txt').read_bytes(), b'preserve replacement')
        self.assertTrue((old / 'owned.json').exists())

    def test_writer_foreign_member_refuses_success_and_preserves_foreign(self):
        original = os.fsync
        inserted = False
        def insert(fd):
            nonlocal inserted
            if not inserted:
                inserted = True
                (self.output / 'foreign.txt').write_bytes(b'borrowed foreign member')
            original(fd)
        with patch.object(os, 'fsync', insert), self.assertRaises(ValueError):
            inventory.write_result(self.output, {'first.json': b'{}', 'second.json': b'{}'})
        self.assertEqual((self.output / 'foreign.txt').read_bytes(), b'borrowed foreign member')
        self.assertFalse((self.output / 'first.json').exists())
        self.assertFalse((self.output / 'second.json').exists())

    def test_writer_prior_artifact_changed_by_later_fsync_refuses(self):
        original = os.fsync
        writes = 0
        def mutate(fd):
            nonlocal writes
            writes += 1
            original(fd)
            if writes == 2:
                (self.output / 'first.json').write_bytes(b'{]')
        with patch.object(os, 'fsync', mutate), self.assertRaises(ValueError):
            inventory.write_result(self.output, {'first.json': b'{}', 'second.json': b'{}'})
        self.assertFalse(self.output.exists())

    def test_writer_final_readback_mutation_is_detected_by_closure_rescan(self):
        class Mutating(inventory.Filesystem):
            visits = 0
            def open_read(self, path):
                if Path(path).name == 'second.json':
                    self.visits += 1
                    if self.visits == 2:
                        (self.output / 'first.json').write_bytes(b'{]')
                return super().open_read(path)
        fs = Mutating(); fs.output = self.output
        with self.assertRaises(ValueError):
            inventory.write_result(self.output, {'first.json': b'{}', 'second.json': b'{}'}, fs=fs)
        self.assertFalse(self.output.exists())

    def test_native_version_command_and_limits_refuse_before_process(self):
        for argv, seconds, cap in ((['aws', '--version'], 5, 10),
                                   ([capture.AWS_EXE, '--version'], 0, 10),
                                   ([capture.AWS_EXE, '--version'], 5, 65537)):
            with patch.object(capture.subprocess, 'Popen') as child, self.assertRaises(ValueError):
                capture.native_version(argv, seconds=seconds, cap=cap)
            child.assert_not_called()

    def test_version_clock_initialization_failure_allocates_no_child(self):
        def fail_clock():
            raise RuntimeError('synthetic clock initialization failure')
        with patch.object(capture.os, 'environ', {'SYSTEMROOT': r'C:\Windows'}), \
                patch.object(capture.subprocess, 'Popen') as process, \
                self.assertRaisesRegex(RuntimeError, 'clock initialization failure'):
            capture.native_version([capture.AWS_EXE, '--version'], seconds=1, cap=65536,
                                   clock=fail_clock)
        process.assert_not_called()

    def test_version_clock_failure_after_allocation_reaps_child_and_closes_pipes(self):
        original = subprocess.Popen
        children, calls = [], 0
        def fail_after_initialization():
            nonlocal calls
            calls += 1
            if calls > 1:
                raise RuntimeError('synthetic clock polling failure')
            return time.monotonic()
        def launch(argv, **kwargs):
            child = original([sys.executable, '-I', '-B', '-S', '-c',
                              'import time; time.sleep(30)'], **kwargs)
            children.append(child)
            return child
        with patch.object(capture.os, 'environ', {'SYSTEMROOT': r'C:\Windows'}), \
                patch.object(capture.subprocess, 'Popen', launch), \
                self.assertRaisesRegex(RuntimeError, 'clock polling failure'):
            capture.native_version([capture.AWS_EXE, '--version'], seconds=1, cap=65536,
                                   clock=fail_after_initialization)
        self.assertEqual(len(children), 1)
        self.assertIsNotNone(children[0].poll())
        self.assertTrue(children[0].stdout.closed)
        self.assertTrue(children[0].stderr.closed)

    def test_version_adapter_bounded_streams_timeout_and_environment(self):
        original = subprocess.Popen
        scenarios = [
            ("import sys; print('aws-cli/2.37.12 fake'); print('stderr', file=sys.stderr)", 1, 65536, False),
            ("import sys; sys.stdout.write('x'*100000); sys.stdout.flush()", 1, 64, True),
            ("import time; time.sleep(5)", 0.05, 65536, True)]
        for script, seconds, cap, refusal in scenarios:
            children = []
            def launch(argv, **kwargs):
                self.assertEqual(argv, [capture.AWS_EXE, '--version'])
                self.assertFalse(kwargs['shell'])
                self.assertEqual(set(kwargs['env']), {'SYSTEMROOT', 'AWS_EC2_METADATA_DISABLED', 'AWS_MAX_ATTEMPTS', 'AWS_PAGER'})
                child = original([sys.executable, '-I', '-B', '-S', '-c', script], **kwargs)
                children.append(child)
                return child
            with self.subTest(refusal=refusal, cap=cap), \
                    patch.object(capture.os, 'environ', {'SYSTEMROOT': r'C:\Windows', 'HTTPS_PROXY': 'synthetic', 'AWS_SECRET_ACCESS_KEY': 'synthetic'}), \
                    patch.object(capture.subprocess, 'Popen', launch):
                if refusal:
                    with self.assertRaises((ValueError, subprocess.TimeoutExpired)):
                        capture.native_version([capture.AWS_EXE, '--version'], seconds=seconds, cap=cap)
                else:
                    code, stdout, stderr = capture.native_version([capture.AWS_EXE, '--version'], seconds=seconds, cap=cap)
                    self.assertEqual(code, 0)
                    self.assertIn(b'aws-cli/', stdout)
                    self.assertIn(b'stderr', stderr)
            self.assertEqual(len(children), 1)
            self.assertIsNotNone(children[0].poll())
            self.assertTrue(children[0].stdout.closed)
            self.assertTrue(children[0].stderr.closed)

    @unittest.skipUnless(os.name == 'posix', 'POSIX inherited-pipe fixture; Windows remains unrun')
    def test_version_adapter_inherited_stdout_or_stderr_refuses_with_bounded_close(self):
        original = subprocess.Popen
        for inherited in ('stdout', 'stderr', 'both'):
            children = []
            redirect = {'stdout': 'stderr=subprocess.DEVNULL',
                        'stderr': 'stdout=subprocess.DEVNULL', 'both': ''}[inherited]
            script = ("import subprocess,sys; subprocess.Popen([sys.executable,'-I','-B','-S','-c',"
                      "'import time; time.sleep(30)'],stdin=subprocess.DEVNULL" +
                      (',' + redirect if redirect else '') +
                      "); print('aws-cli/2.37.12 inherited fixture',flush=True)")
            def launch(argv, **kwargs):
                self.assertEqual(argv, [capture.AWS_EXE, '--version'])
                self.assertEqual(kwargs['bufsize'], 0)
                child = original([sys.executable, '-I', '-B', '-S', '-c', script],
                                 start_new_session=True, **kwargs)
                children.append(child)
                return child
            start = time.monotonic()
            try:
                with self.subTest(inherited=inherited), \
                        patch.object(capture.os, 'environ', {'SYSTEMROOT': r'C:\Windows'}), \
                        patch.object(capture.subprocess, 'Popen', launch), \
                        self.assertRaisesRegex(capture.VersionPipeBoundaryError, 'DESCENDANT_TEARDOWN_UNQUALIFIED'):
                    capture.native_version([capture.AWS_EXE, '--version'], seconds=0.25, cap=65536)
                self.assertLess(time.monotonic() - start, 1.5)
                self.assertEqual(len(children), 1)
                self.assertIsNotNone(children[0].poll())
                self.assertTrue(children[0].stdout.closed)
                self.assertTrue(children[0].stderr.closed)
            finally:
                # The fixture owns its group; production claims only direct child.
                for child in children:
                    try: os.killpg(child.pid, signal.SIGKILL)
                    except ProcessLookupError: pass
                    child.wait(timeout=3)


if __name__ == '__main__':
    unittest.main()
