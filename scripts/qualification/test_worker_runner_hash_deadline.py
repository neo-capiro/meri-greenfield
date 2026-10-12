"""Canonical hashing regressions using only AST-selected functions and fake ports.

No filesystem adapter, native target, supervisor or diagnostic is imported or
executed. Source files are read as text; the isolated function namespace contains
only standard data/hash helpers and explicitly supplied in-memory ports.
"""
import ast
import hashlib
from pathlib import Path
import stat
from types import SimpleNamespace
import unittest


def isolated_inventory():
    source = Path(__file__).with_name('worker_runner_inventory.py').read_text()
    names = {'identity', 'check_deadline', 'plain', 'ancestors', 'hash_file'}
    nodes = [node for node in ast.parse(source).body
             if isinstance(node, ast.FunctionDef) and node.name in names]
    if {node.name for node in nodes} != names:
        raise AssertionError('exact public function set required')
    namespace = {'Path': Path, 'stat': stat, 'hashlib': hashlib}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), '<inert-inventory>', 'exec'), namespace)
    return namespace


class InertFilesystem:
    def __init__(self, *, late=None, late_time=10, effect=None):
        self.now = 0
        self.late = late
        self.late_time = late_time
        self.effect = effect
        self.events = []
        self.named_count = 0
        self.opened_count = 0
        self.chunks = [b'abc', b'']
        self.size = 3
        self.links = 1
        self.attributes = 0
        self.open_mode = self.named_mode = stat.S_IFREG | 0o600
        self.clock_error = False

    def clock(self):
        if self.clock_error:
            raise RuntimeError('clock failed')
        return self.now

    def event(self, name):
        self.events.append((name, self.now))
        if name == self.late:
            self.now = self.late_time
        if self.effect is not None:
            self.effect(self, name)

    def info(self, *, directory=False, opened=False):
        return SimpleNamespace(st_dev=1, st_ino=2,
                               st_mode=stat.S_IFDIR | 0o700 if directory else self.open_mode if opened else self.named_mode,
                               st_nlink=self.links, st_size=self.size, st_mtime_ns=3,
                               st_ctime_ns=4, st_file_attributes=self.attributes)

    def lstat(self, path):
        if path == Path('/'):
            label = 'ancestor-root'
        elif path == Path('/inert'):
            label = 'ancestor-parent'
        else:
            self.named_count += 1
            label = 'named-before' if self.named_count == 1 else 'named-after'
        self.event(label)
        return self.info(directory=path != Path('/inert/member'))

    def open_read(self, path):
        self.event('open')
        return 17

    def fstat(self, descriptor):
        assert descriptor == 17
        self.opened_count += 1
        self.event('opened-before' if self.opened_count == 1 else 'opened-after')
        return self.info(opened=True)

    def read(self, descriptor, count):
        assert descriptor == 17 and count == 65536
        chunk = self.chunks.pop(0)
        self.event('read-data' if chunk else 'read-eof')
        return chunk

    def close(self, descriptor):
        assert descriptor == 17
        self.event('close')


class HashDeadlineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.functions = isolated_inventory()

    def hash(self, fs, *, allow_empty=False):
        return self.functions['hash_file'](Path('/inert/member'), fs=fs,
                                          clock=fs.clock, end=10, cap=3,
                                          allow_empty=allow_empty)

    def test_on_time_result_and_exact_close(self):
        fs = InertFilesystem()
        self.assertEqual(self.hash(fs), {'path': '/inert/member', 'bytes': 3,
                                       'sha256': hashlib.sha256(b'abc').hexdigest()})
        self.assertEqual([name for name, _ in fs.events].count('close'), 1)

    def test_each_late_port_refuses_without_another_observation(self):
        labels = ['ancestor-root', 'ancestor-parent', 'named-before', 'open',
                  'opened-before', 'read-data', 'read-eof', 'opened-after',
                  'close', 'named-after']
        for label in labels:
            for late_time in (10, 11):
                with self.subTest(port=label, returned_at=late_time):
                    fs = InertFilesystem(late=label, late_time=late_time)
                    with self.assertRaisesRegex(ValueError, '^runner inventory deadline$'):
                        self.hash(fs)
                    self.assertEqual([name for name, start in fs.events
                                      if start >= 10 and name != 'close'], [])
                    names = [name for name, _ in fs.events]
                    self.assertEqual(names.count('close'), 1 if 'open' in names else 0)

    def test_expired_entry_has_no_ports(self):
        fs = InertFilesystem()
        fs.now = 10
        with self.assertRaisesRegex(ValueError, 'inventory deadline'):
            self.hash(fs)
        self.assertEqual(fs.events, [])

    def test_optional_ancestor_deadline_is_paired_and_legacy_is_unchanged(self):
        fn = self.functions['ancestors']
        for kwargs in ({'clock': lambda: 0}, {'end': 10}):
            fs = InertFilesystem()
            with self.assertRaisesRegex(ValueError, 'deadline pair required'):
                fn(Path('/inert'), fs, **kwargs)
            self.assertEqual(fs.events, [])
        fs = InertFilesystem(late='ancestor-root')
        fn(Path('/inert'), fs)
        self.assertEqual([name for name, _ in fs.events], ['ancestor-root', 'ancestor-parent'])

    def test_clock_failure_after_open_still_closes(self):
        def effect(fs, name):
            if name == 'open':
                fs.clock_error = True
        fs = InertFilesystem(effect=effect)
        with self.assertRaisesRegex(RuntimeError, 'clock failed'):
            self.hash(fs)
        self.assertEqual([name for name, _ in fs.events][-2:], ['open', 'close'])

    def test_port_errors_preserve_owned_cleanup_without_retry(self):
        for failing in ('open', 'opened-before', 'read-data', 'read-eof', 'opened-after', 'close'):
            def effect(fs, name):
                if name == failing:
                    raise OSError('inert failure')
            with self.subTest(port=failing):
                fs = InertFilesystem(effect=effect)
                with self.assertRaisesRegex(OSError, 'inert failure'):
                    self.hash(fs)
                names = [name for name, _ in fs.events]
                self.assertEqual(names.count('close'), 0 if failing == 'open' else 1)
                self.assertNotIn('named-after', names)

    def test_identity_link_reparse_and_growth_guards_preserved(self):
        for changed in ('links', 'attributes', 'growth', 'opened-mode'):
            with self.subTest(change=changed):
                fs = InertFilesystem()
                if changed == 'links':
                    fs.links = 2
                elif changed == 'attributes':
                    fs.attributes = 0x400
                elif changed == 'growth':
                    fs.chunks = [b'abcd', b'']
                else:
                    fs.open_mode = stat.S_IFDIR | 0o600
                with self.assertRaises(ValueError):
                    self.hash(fs)

    def test_cross_api_permission_representation_remains_supported(self):
        fs = InertFilesystem()
        fs.open_mode = stat.S_IFREG | 0o644
        self.assertEqual(self.hash(fs)['bytes'], 3)

    def test_empty_file_still_requires_existing_opt_in(self):
        for allowed in (False, True):
            fs = InertFilesystem()
            fs.size, fs.chunks = 0, [b'']
            if allowed:
                self.assertEqual(self.hash(fs, allow_empty=True)['sha256'], hashlib.sha256(b'').hexdigest())
            else:
                with self.assertRaisesRegex(ValueError, 'file byte bound'):
                    self.hash(fs)


if __name__ == '__main__':
    unittest.main()
