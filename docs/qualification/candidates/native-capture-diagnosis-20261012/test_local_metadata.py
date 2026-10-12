"""Local synthetic tests only. Never executes collector, AWS CLI or Windows API."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PureWindowsPath
from types import SimpleNamespace
import tempfile
import time
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location('diagnostic_candidate', Path(__file__).with_name('inspect-local-metadata.py'))
diagnostic = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(diagnostic)


class SyntheticDiagnostic(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def test_empty_selected_file_and_excluded_site_packages_without_body_reads(self):
        (self.root / 'empty.py').write_bytes(b'')
        (self.root / 'normal.py').write_bytes(b'normal fixture')
        (self.root / 'ignored.txt').write_bytes(b'')
        excluded = self.root / 'site-packages'; excluded.mkdir()
        (excluded / 'secret.py').write_bytes(b'')
        with patch.object(Path, 'open', side_effect=AssertionError('file body read')):
            result = diagnostic.scan_stdlib(self.root, time.monotonic() + 5)
        self.assertEqual(result['selectedPyFiles'], 2)
        self.assertEqual(result['issueCounts'], {'zero_byte_selected_py': 1})
        self.assertEqual(result['issueExamples'][0]['relativePath'], 'empty.py')
        self.assertNotIn('secret.py', json.dumps(result))
        self.assertFalse(result['collectorInventoryReplayed'])

    def test_directory_symlink_is_reported_without_following(self):
        outside = self.root / 'outside'; outside.mkdir()
        (outside / 'private.py').write_bytes(b'')
        lib = self.root / 'Lib'; lib.mkdir()
        (lib / 'link').symlink_to(outside, target_is_directory=True)
        result = diagnostic.scan_stdlib(lib, time.monotonic() + 5)
        self.assertEqual(result['selectedPyFiles'], 0)
        self.assertEqual(result['issueCounts'], {'link_or_reparse_not_followed': 1})
        self.assertNotIn('private.py', json.dumps(result))

    def test_reparse_directory_is_reported_without_following(self):
        junction = self.root / 'junction'; junction.mkdir()
        (junction / 'private.py').write_bytes(b'')
        original_lstat = os.lstat

        def observed(path):
            info = original_lstat(path)
            if Path(path) == junction:
                return SimpleNamespace(st_mode=info.st_mode, st_size=info.st_size,
                                       st_nlink=info.st_nlink, st_file_attributes=0x400)
            return info

        with patch.object(diagnostic.os, 'lstat', side_effect=observed):
            result = diagnostic.scan_stdlib(self.root, time.monotonic() + 5)
        self.assertEqual(result['selectedPyFiles'], 0)
        self.assertEqual(result['issueCounts'], {'link_or_reparse_not_followed': 1})

    def test_remote_drive_and_unc_refuse_without_metadata_io(self):
        import ctypes
        get_drive_type = lambda _path: 4  # Synthetic DRIVE_REMOTE only.
        with patch.object(diagnostic.sys, 'platform', 'win32'), \
                patch.object(ctypes, 'WinDLL', return_value=SimpleNamespace(GetDriveTypeW=get_drive_type), create=True), \
                patch.object(diagnostic.os, 'lstat', side_effect=AssertionError('filesystem IO')):
            with self.assertRaisesRegex(diagnostic.Refusal, 'fixed_local_drive_required'):
                diagnostic.fixed_drive(PureWindowsPath('Z:/synthetic'))
            with self.assertRaisesRegex(diagnostic.Refusal, 'absolute_local_path_required'):
                diagnostic.fixed_drive(PureWindowsPath('//synthetic/share/file'))

    def test_deadline_and_entry_bound_refuse(self):
        with self.assertRaisesRegex(diagnostic.Refusal, 'diagnostic_deadline'):
            diagnostic.scan_stdlib(self.root, time.monotonic() - 1)
        (self.root / 'a.py').write_bytes(b'a')
        (self.root / 'b.py').write_bytes(b'b')
        with patch.object(diagnostic, 'MAX_ENTRIES', 1), self.assertRaisesRegex(diagnostic.Refusal, 'directory_entry_bound'):
            diagnostic.scan_stdlib(self.root, time.monotonic() + 5)

    def test_original_streams_are_compared_not_rewritten_or_exposed(self):
        stream = self.root / 'original.stderr'
        for raw, label in [(diagnostic.GENERIC + b'\r\n', 'canonical_generic_CRLF'),
                           (diagnostic.GENERIC + b'\n', 'canonical_generic_LF'),
                           (b'', 'empty'), (b'PRIVATE_BODY_MARKER', None)]:
            stream.write_bytes(raw)
            with patch.object(diagnostic, 'fixed_drive', return_value=None):
                result = diagnostic.inspect_stream(stream, time.monotonic() + 5)
            self.assertEqual(result['knownMessage'], label)
            self.assertEqual(result['bytes'], len(raw))
            self.assertEqual(result['sha256'], hashlib.sha256(raw).hexdigest())
            self.assertEqual(stream.read_bytes(), raw)
            self.assertNotIn('PRIVATE_BODY_MARKER', json.dumps(result))

    def test_stream_size_and_symlink_refused_before_body_open(self):
        original = self.root / 'original.stderr'
        original.write_bytes(b'x' * (diagnostic.MAX_STREAM_BYTES + 1))
        with patch.object(diagnostic, 'fixed_drive', return_value=None), \
                patch.object(Path, 'open', side_effect=AssertionError('opened forbidden body')), \
                self.assertRaisesRegex(diagnostic.Refusal, 'original_stream_size_bound'):
            diagnostic.inspect_stream(original, time.monotonic() + 5)
        link = self.root / 'link.stderr'; link.symlink_to(original)
        with patch.object(diagnostic, 'fixed_drive', return_value=None), \
                self.assertRaisesRegex(diagnostic.Refusal, 'single_plain_stream_file_required'):
            diagnostic.inspect_stream(link, time.monotonic() + 5)

    def test_wrong_host_refuses_before_filesystem_or_windows_api(self):
        if os.name == 'nt':
            self.skipTest('Linux-only wrong-host source control')
        with self.assertRaisesRegex(diagnostic.Refusal, 'native_windows_required'), \
                patch.object(diagnostic.os, 'lstat', side_effect=AssertionError('filesystem IO')):
            diagnostic.fixed_drive(self.root)


if __name__ == '__main__':
    unittest.main()
