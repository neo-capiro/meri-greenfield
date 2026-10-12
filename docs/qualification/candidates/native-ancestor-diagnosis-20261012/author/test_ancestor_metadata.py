"""Synthetic source controls only; no native execution or collector imports."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path, PureWindowsPath
import stat
import time
import types
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).parents[1] / 'inspect-ancestor-metadata.py'
SPEC = importlib.util.spec_from_file_location('ancestor_diagnostic', SCRIPT)
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)


def info(mode=stat.S_IFDIR | 0o755, attrs=0x10, tag=0):
    return types.SimpleNamespace(st_mode=mode, st_file_attributes=attrs, st_reparse_tag=tag)


class Controls(unittest.TestCase):
    def setUp(self):
        self.end = time.monotonic() + 10
        self.path = PureWindowsPath('C:/private/receipt/repository')

    def role(self, facts):
        seen = []
        def observe(path):
            seen.append(path)
            value = facts[len(seen)-1]
            if isinstance(value, Exception): raise value
            return value
        with patch.object(m, 'fixed_drive') as drive, patch.object(m.os, 'lstat', side_effect=observe):
            try:
                result = m.inspect_role('repository', self.path, self.end)
            except m.Refusal as error:
                result = error
            drive.assert_called_once_with(self.path)
        return result, seen

    def test_root_first_and_success_counts_without_paths(self):
        result, seen = self.role([info()]*4)
        self.assertEqual(seen, list(reversed((self.path, *self.path.parents))))
        self.assertEqual(result, {'role': 'repository', 'ancestorCount': 4,
                                 'status': 'plain_directory_metadata_observed'})

    def test_individual_and_simultaneous_predicates_stop_at_exact_ordinal(self):
        cases = [(stat.S_IFDIR | 0o755, 0x410, {'symbolic_link': False, 'reparse_point': True, 'not_directory': False}),
                 (stat.S_IFLNK | 0o777, 0, {'symbolic_link': True, 'reparse_point': False, 'not_directory': True}),
                 (stat.S_IFREG | 0o644, 0, {'symbolic_link': False, 'reparse_point': False, 'not_directory': True}),
                 (stat.S_IFLNK | 0o777, 0x400, {'symbolic_link': True, 'reparse_point': True, 'not_directory': True})]
        for mode, attrs, predicates in cases:
            result, seen = self.role([info(), info(mode, attrs, 0xA0000003)])
            self.assertIsInstance(result, m.Refusal)
            self.assertEqual(len(seen), 2)
            self.assertEqual(result.observation['ancestorOrdinal'], 2)
            self.assertEqual(result.observation['ancestorCount'], 4)
            self.assertEqual(result.observation['predicates'], predicates)
            self.assertEqual(result.observation['mode'], mode)
            self.assertEqual(result.observation['fileAttributes'], attrs)
            self.assertEqual(result.observation['reparseTag'], 0xA0000003)
            self.assertNotIn('private', json.dumps(result.observation))

    def test_lstat_error_reports_numeric_codes_not_filename_or_exception(self):
        error = OSError(13, 'private error', 'C:/secret/private')
        error.winerror = 5
        result, seen = self.role([info(), error])
        self.assertEqual(len(seen), 2)
        self.assertEqual(result.reason, 'filesystem_or_native_api_error')
        self.assertEqual(result.observation, {'role': 'repository', 'ancestorOrdinal': 2,
                         'ancestorCount': 4, 'stage': 'lstat', 'errno': 13, 'winerror': 5})

    def test_unsafe_syntax_before_drive_or_lstat(self):
        unsafe = ['relative', 'C:relative', '//server/share/private', '//?/C:/private',
                  '//./C:/private', 'C:/safe/../private', 'C:/'+'x'*1024, 'C:/a\x00b',
                  'C:/'+'/'.join(['a']*65)]
        with patch.object(m, 'fixed_drive') as drive, patch.object(m.os, 'lstat') as observe:
            for value in unsafe:
                with self.assertRaises(m.Refusal):
                    m.inspect_role('repository', PureWindowsPath(value), self.end)
            drive.assert_not_called(); observe.assert_not_called()

    def test_fixed_drive_failure_before_metadata(self):
        for failure in [m.Refusal('fixed_local_drive_required', {'driveType': 4}), OSError(5, 'secret API')]:
            with patch.object(m, 'fixed_drive', side_effect=failure), patch.object(m.os, 'lstat') as observe:
                with self.assertRaises(m.Refusal) as caught:
                    m.inspect_role('repository', self.path, self.end)
                self.assertEqual(caught.exception.observation['stage'], 'drive_type')
                observe.assert_not_called()

    def test_expired_deadline_before_drive_or_lstat(self):
        with patch.object(m, 'fixed_drive') as drive, patch.object(m.os, 'lstat') as observe:
            with self.assertRaises(m.Refusal) as caught:
                m.inspect_role('repository', self.path, time.monotonic()-1)
            self.assertEqual(caught.exception.reason, 'diagnostic_deadline')
            drive.assert_not_called(); observe.assert_not_called()

    def test_original_runtime_refuses_before_any_metadata(self):
        with patch.object(m.os, 'lstat') as observe, patch.object(m, 'fixed_drive') as drive:
            with self.assertRaises(m.Refusal) as caught:
                m.metadata(self.path, self.path/'out', self.end)
            self.assertEqual(caught.exception.reason, 'actual_windows_python_3_11_15_required')
            observe.assert_not_called(); drive.assert_not_called()

    def test_five_roles_order_and_failure_preserves_only_completed_roles(self):
        calls = []
        def role(name, path, end):
            calls.append((name, path))
            if name == 'Lib':
                raise m.Refusal('plain_local_directory_ancestors_required', {'role': name, 'ancestorOrdinal': 3, 'ancestorCount': 4})
            return {'role': name, 'ancestorCount': len(path.parents)+1, 'status': 'plain_directory_metadata_observed'}
        with patch.object(m.sys, 'platform', 'win32'), patch.object(m.sys, 'version_info', (3,11,15)), \
             patch.object(m.sys, 'base_prefix', 'C:/runtime/python'), patch.object(m, 'Path', PureWindowsPath), \
             patch.object(m, 'inspect_role', side_effect=role):
            with self.assertRaises(m.Refusal) as caught:
                m.metadata(self.path, self.path/'.task-inputs/worker-runner-capture-original', self.end)
        self.assertEqual([n for n,p in calls], ['repository','output-parent','basePrefix','Lib'])
        self.assertEqual(calls[1][1], self.path/'.task-inputs')
        self.assertEqual([r['role'] for r in caught.exception.observation['completedRoles']], ['repository','output-parent','basePrefix'])

    def test_missing_windows_attributes_are_reported_without_inventing_values(self):
        result, seen = self.role([types.SimpleNamespace(st_mode=stat.S_IFREG | 0o644)])
        self.assertEqual(len(seen), 1)
        self.assertIsNone(result.observation['fileAttributes'])
        self.assertIsNone(result.observation['reparseTag'])

    def test_parser_suppresses_supplied_private_argument_text(self):
        sink = io.TextIOWrapper(io.BytesIO(), encoding='utf-8')
        with patch.object(m.sys, 'stdout', sink):
            code = m.main(['--private-receipt=C:/secret/value'])
            sink.flush(); raw = sink.buffer.getvalue()
        self.assertEqual(code, 2)
        self.assertNotIn(b'secret', raw)
        self.assertEqual(json.loads(raw)['reason'], 'invalid_arguments')

    def test_stdout_bound_fails_closed(self):
        sink = io.TextIOWrapper(io.BytesIO(), encoding='utf-8')
        with patch.object(m.sys, 'stdout', sink), patch.object(m, 'metadata', return_value={'excess': 'x'*40000}):
            code = m.main(['--repository','C:/repo','--original-output','C:/repo/out'])
            sink.flush(); raw = sink.buffer.getvalue()
        self.assertEqual(code, 2)
        self.assertLessEqual(len(raw), m.MAX_OUTPUT_BYTES)
        self.assertEqual(json.loads(raw)['reason'], 'output_size_bound')


if __name__ == '__main__':
    unittest.main()
