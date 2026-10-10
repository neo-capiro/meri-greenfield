"""Offline pure-composition tests for the bounded build-host cleanup helper.

No real filesystem deletion, no Docker, no AWS, no network. A fake OS surface
is injected so success and every refusal path are exercised meaningfully. The
real POSIX confined deletion is NOT executed here, and a Windows run is not a
Linux pass; Windows real deletion is explicitly unsupported.
"""
import errno
import importlib.util
import io
import json
import os
import pathlib
import stat
import types
import unittest
from unittest.mock import patch

TOOL = pathlib.Path(__file__).resolve().with_name('clear-qualification-docker-config.py')


def subject():
    spec = importlib.util.spec_from_loader('clear_qualification_docker_config', loader=None)
    module = importlib.util.module_from_spec(spec)
    module.__file__ = str(TOOL)
    exec(compile(TOOL.read_bytes(), str(TOOL), 'exec'), module.__dict__)
    return module


m = subject()


class Node:
    def __init__(self, kind, mode=0o700, uid=0, nlink=1, size=0, dev=1, ino=None, target=None):
        self.kind = kind
        self.mode = mode
        self.uid = uid
        self.nlink = nlink
        self.size = size
        self.dev = dev
        self.ino = ino
        self.target = target
        self.children = {} if kind == 'dir' else None

    def stat(self):
        if self.kind == 'dir':
            fmt = stat.S_IFDIR
        elif self.kind == 'file':
            fmt = stat.S_IFREG
        elif self.kind == 'symlink':
            fmt = stat.S_IFLNK
        else:
            fmt = stat.S_IFIFO
        return types.SimpleNamespace(st_mode=fmt | self.mode, st_nlink=self.nlink, st_uid=self.uid,
                                     st_gid=0, st_size=self.size, st_dev=self.dev, st_ino=self.ino)


class FakeFs:
    """In-memory confined-deletion surface mirroring the exact syscalls used."""

    def __init__(self, uid=0):
        self.uid = uid
        self._fd = 10
        self._ino = 0
        self.paths = {}
        self.fds = {}
        self.opens = []
        self.unlinks = []
        self.rmdirs = []
        self.fstat_hook = None
        self.lstat_hook = None
        self.root = self._node('dir', mode=0o1777)
        self.paths['/tmp'] = self.root

    def _node(self, *a, **k):
        node = Node(*a, **k)
        if node.ino is None:
            self._ino += 1
            node.ino = self._ino
        return node

    def add_dir(self, parent, name, **k):
        node = self._node('dir', **k)
        parent.children[name] = node
        return node

    def add_file(self, parent, name, **k):
        node = self._node('file', **k)
        parent.children[name] = node
        return node

    def add_special(self, parent, name, **k):
        node = self._node('fifo', **k)
        parent.children[name] = node
        return node

    def add_symlink(self, parent, name, target='/outside', **k):
        node = self._node('symlink', mode=0o777, target=target, **k)
        parent.children[name] = node
        return node

    def _resolve(self, path, dir_fd):
        if isinstance(path, str) and path.startswith('/'):
            node = self.paths.get(path)
            if node is None:
                raise FileNotFoundError(path)
            return node
        base = self.fds[dir_fd]
        node = base.children.get(path)
        if node is None:
            raise FileNotFoundError(path)
        return node

    def open(self, path, flags, dir_fd=None, mode=0o777):
        self.opens.append((path, dir_fd))
        node = self._resolve(path, dir_fd)
        if node.kind == 'symlink':
            raise OSError(errno.ELOOP, 'symlink not followed')
        if node.kind != 'dir':
            raise OSError(errno.ENOTDIR, 'not a directory')
        self._fd += 1
        self.fds[self._fd] = node
        return self._fd

    def close(self, fd):
        self.fds.pop(fd, None)

    def fstat(self, fd):
        node = self.fds[fd]
        if self.fstat_hook:
            node = self.fstat_hook(node, fd)
        return node.stat()

    def lstat(self, path, dir_fd=None):
        node = self._resolve(path, dir_fd)
        if self.lstat_hook:
            node = self.lstat_hook(node, path, dir_fd)
        return node.stat()

    def listdir(self, fd):
        return list(self.fds[fd].children.keys())

    def unlink(self, path, dir_fd=None):
        base = self.fds[dir_fd] if dir_fd is not None else self.paths['/' + path.split('/')[1]]
        node = base.children.get(path) if dir_fd is not None else self.paths[path]
        if node is None:
            raise FileNotFoundError(path)
        if node.kind == 'dir':
            raise OSError(errno.EISDIR, 'is a directory')
        if dir_fd is not None:
            del base.children[path]
        else:
            del self.paths[path]
        self.unlinks.append(path)

    def rmdir(self, path, dir_fd=None):
        base = self.fds[dir_fd]
        node = base.children.get(path)
        if node is None:
            raise FileNotFoundError(path)
        if node.kind != 'dir':
            raise OSError(errno.ENOTDIR, 'not a directory')
        if node.children:
            raise OSError(errno.ENOTEMPTY, 'directory not empty')
        del base.children[path]
        self.rmdirs.append(path)

    def geteuid(self):
        return self.uid


NONCE = 'ABCD1234'
NAME = 'meri-worker-auth.' + NONCE


def config(nonce=NONCE, parent='/tmp', prefix='meri-worker-auth.', **k):
    return m.CleanupConfig(parent, prefix, nonce, k.pop('identity', (1, 2)), **k)


def populated(fs=None, uid=0):
    fs = fs or FakeFs(uid=uid)
    target = fs.add_dir(fs.root, NAME, mode=0o700, uid=uid)
    fs.add_file(target, 'config.json', mode=0o600, uid=uid, size=120)
    buildx = fs.add_dir(target, 'buildx', mode=0o755, uid=uid)
    fs.add_file(buildx, 'state.db', mode=0o644, uid=uid, size=4096)
    fs.add_file(target, '.token_seed', mode=0o600, uid=uid, size=8)
    return fs, target


class CleanupSuccessTests(unittest.TestCase):
    def test_success_removes_all_state_and_proves_absence(self):
        fs, target = populated()
        receipt = m.run_cleanup(config(), fs)
        self.assertEqual(receipt['status'], 'CLEANED')
        self.assertEqual(receipt['schema'], m.SCHEMA)
        self.assertTrue(receipt['verifiedAbsent'])
        self.assertEqual(receipt['parent'], '/tmp')
        self.assertEqual(receipt['nonce'], NONCE)
        self.assertNotIn(NAME, fs.root.children)
        self.assertEqual(receipt['filesRemoved'], 3)
        self.assertGreaterEqual(receipt['maxDepth'], 1)
        self.assertEqual(fs.rmdirs, ['buildx', NAME])

    def test_config_removed_before_state_enumeration_and_never_opened(self):
        fs, target = populated()
        m.run_cleanup(config(), fs)
        self.assertEqual(fs.unlinks[0], 'config.json')
        self.assertNotIn('config.json', [p for p, _ in fs.opens])

    def test_empty_after_config_is_also_cleaned(self):
        fs = FakeFs()
        target = fs.add_dir(fs.root, NAME, mode=0o700)
        fs.add_file(target, 'config.json', mode=0o600, size=10)
        receipt = m.run_cleanup(config(), fs)
        self.assertTrue(receipt['verifiedAbsent'])
        self.assertEqual(receipt['filesRemoved'], 1)

    def test_receipt_has_no_credential_contents_or_arbitrary_listing(self):
        fs, target = populated()
        receipt = m.run_cleanup(config(), fs)
        blob = json.dumps(receipt)
        self.assertEqual(set(receipt), {
            'schema', 'status', 'parent', 'prefix', 'nonce', 'directoryName', 'entriesRemoved',
            'filesRemoved', 'bytesRemoved', 'maxDepth', 'verifiedAbsent', 'rootObserved',
            'boundIdentity', 'policy', 'realWindowsDeletion', 'elapsedMs'})
        for needle in ('config.json', 'state.db', '.token_seed', 'buildx'):
            self.assertNotIn(needle, blob)

    def test_main_unsupported_off_posix_is_not_a_linux_pass(self):
        with patch.object(m.os, 'name', 'nt'):
            with self.assertRaises(m.UnsupportedPlatform):
                m.assert_supported_platform()
            code = m.main(['--nonce', NONCE, '--identity', '1:2'])
        self.assertEqual(code, 3)

    def test_time_bound_is_enforced(self):
        fs, target = populated()
        ticks = iter([0.0, 0.0, 100.0, 100.0, 100.0])
        with self.assertRaises(m.CleanupError):
            m.run_cleanup(config(deadline=25.0), fs, clock=lambda: next(ticks))


class CleanupScopeTests(unittest.TestCase):
    def test_wrong_parent_refused(self):
        fs, target = populated()
        with self.assertRaisesRegex(m.CleanupError, 'untrusted parent'):
            m.run_cleanup(config(parent='/etc'), fs)

    def test_wrong_prefix_refused(self):
        fs, target = populated()
        with self.assertRaisesRegex(m.CleanupError, 'untrusted prefix'):
            m.run_cleanup(config(prefix='meri-worker-authx.'), fs)

    def test_bad_nonce_refused(self):
        for nonce in ('', 'ABCD123', 'ABCD12345', 'abcd123$', 'ABCD 123'):
            with self.subTest(nonce=nonce), self.assertRaisesRegex(m.CleanupError, 'nonce'):
                m.run_cleanup(config(nonce=nonce), FakeFs())

    def test_symlink_target_refused(self):
        fs = FakeFs()
        fs.add_symlink(fs.root, NAME, target='/etc')
        with self.assertRaisesRegex(m.CleanupError, 'symlink'):
            m.run_cleanup(config(), fs)

    def test_never_follows_outside_root(self):
        fs, target = populated()
        outside = fs.add_dir(fs.root, 'real-secret', mode=0o700)
        fs.add_file(outside, 'config.json', mode=0o600)
        fs.add_symlink(target, 'escape', target='/tmp/real-secret')
        with self.assertRaisesRegex(m.CleanupError, 'symlink'):
            m.run_cleanup(config(), fs)
        self.assertIn('real-secret', fs.root.children)
        self.assertIn('config.json', outside.children)

    def test_parent_substitution_refused(self):
        fs, target = populated()
        fs.lstat_hook = lambda node, path, dir_fd: (
            fs._node('dir', mode=0o1777) if path == '/tmp' else node)
        with self.assertRaisesRegex(m.CleanupError, 'parent substitution'):
            m.run_cleanup(config(), fs)

    def test_target_substitution_race_refused(self):
        fs, target = populated()
        fs.fstat_hook = lambda node, fd: (fs._node('dir', mode=0o700) if node is target else node)
        with self.assertRaisesRegex(m.CleanupError, 'race'):
            m.run_cleanup(config(), fs)


class CleanupMetadataTests(unittest.TestCase):
    def test_hardlink_config_refused(self):
        fs = FakeFs()
        target = fs.add_dir(fs.root, NAME, mode=0o700)
        fs.add_file(target, 'config.json', mode=0o600, nlink=2)
        with self.assertRaisesRegex(m.CleanupError, 'hardlink'):
            m.run_cleanup(config(), fs)

    def test_hardlink_state_entry_refused(self):
        fs = FakeFs()
        target = fs.add_dir(fs.root, NAME, mode=0o700)
        fs.add_file(target, 'config.json', mode=0o600)
        fs.add_file(target, 'linked', mode=0o600, nlink=2)
        with self.assertRaisesRegex(m.CleanupError, 'hardlink'):
            m.run_cleanup(config(), fs)

    def test_special_file_entry_refused(self):
        fs = FakeFs()
        target = fs.add_dir(fs.root, NAME, mode=0o700)
        fs.add_file(target, 'config.json', mode=0o600)
        fs.add_special(target, 'agent.sock', mode=0o600)
        with self.assertRaisesRegex(m.CleanupError, 'symlink/special'):
            m.run_cleanup(config(), fs)

    def test_unexpected_ownership_refused(self):
        fs = FakeFs(uid=0)
        target = fs.add_dir(fs.root, NAME, mode=0o700, uid=10001)
        fs.add_file(target, 'config.json', mode=0o600)
        with self.assertRaisesRegex(m.CleanupError, 'ownership'):
            m.run_cleanup(config(), fs)

    def test_unexpected_mode_refused(self):
        for kwargs in ({'mode': 0o4755}, {'mode': 0o777}):
            with self.subTest(**kwargs):
                fs = FakeFs()
                target = fs.add_dir(fs.root, NAME, mode=0o700)
                fs.add_file(target, 'config.json', mode=0o600)
                fs.add_file(target, 'weird', **kwargs)
                with self.assertRaises(m.CleanupError):
                    m.run_cleanup(config(), fs)

    def test_missing_config_idempotently_cleans_bound_root(self):
        fs = FakeFs()
        fs.add_dir(fs.root, NAME, mode=0o700)
        self.assertTrue(m.run_cleanup(config(), fs)['verifiedAbsent'])

    def test_directory_that_is_not_a_dir_refused(self):
        fs = FakeFs()
        fs.add_file(fs.root, NAME, mode=0o600)
        with self.assertRaisesRegex(m.CleanupError, 'not a real directory'):
            m.run_cleanup(config(), fs)


class CleanupBoundTests(unittest.TestCase):
    def test_entry_count_bound(self):
        fs = FakeFs()
        target = fs.add_dir(fs.root, NAME, mode=0o700)
        fs.add_file(target, 'config.json', mode=0o600)
        for i in range(m.MAX_ENTRIES + 1):
            fs.add_file(target, 'f%05d' % i, mode=0o600)
        with self.assertRaisesRegex(m.CleanupError, 'entry count|oversized'):
            m.run_cleanup(config(), fs)

    def test_depth_bound(self):
        fs = FakeFs()
        target = fs.add_dir(fs.root, NAME, mode=0o700)
        fs.add_file(target, 'config.json', mode=0o600)
        node = target
        for i in range(m.MAX_DEPTH + 2):
            node = fs.add_dir(node, 'd%d' % i, mode=0o700)
        with self.assertRaisesRegex(m.CleanupError, 'depth'):
            m.run_cleanup(config(), fs)

    def test_aggregate_byte_bound(self):
        fs = FakeFs()
        target = fs.add_dir(fs.root, NAME, mode=0o700)
        fs.add_file(target, 'config.json', mode=0o600)
        for i in range(MAX_FILES_TO_EXCEED := (m.MAX_BYTES // m.MAX_FILE_BYTES) + 1):
            fs.add_file(target, 'big%d' % i, mode=0o600, size=m.MAX_FILE_BYTES)
        with self.assertRaisesRegex(m.CleanupError, 'byte bound'):
            m.run_cleanup(config(), fs)

    def test_oversized_config_refused(self):
        fs = FakeFs()
        target = fs.add_dir(fs.root, NAME, mode=0o700)
        fs.add_file(target, 'config.json', mode=0o600, size=m.MAX_FILE_BYTES + 1)
        with self.assertRaisesRegex(m.CleanupError, 'out of bounds'):
            m.run_cleanup(config(), fs)


class CleanupAbsenceTests(unittest.TestCase):
    def test_nonempty_residual_is_not_unknown_success(self):
        class Stubborn(FakeFs):
            def rmdir(self, path, dir_fd=None):
                if path == NAME:
                    return
                super().rmdir(path, dir_fd=dir_fd)

        fs = Stubborn()
        target = fs.add_dir(fs.root, NAME, mode=0o700)
        fs.add_file(target, 'config.json', mode=0o600)
        with self.assertRaisesRegex(m.CleanupError, 'still present'):
            m.run_cleanup(config(), fs)

    def test_receipt_stdout_has_no_arbitrary_file_write_authority(self):
        fs, target = populated()
        output = io.StringIO()
        with patch.object(m, 'assert_supported_platform'), patch.object(m, 'RealFs', return_value=fs), patch('sys.stdout', output), patch('builtins.open', side_effect=AssertionError('No receipt path opens')):
            self.assertEqual(m.main(['--nonce', NONCE, '--identity', '1:2']), 0)
        self.assertTrue(json.loads(output.getvalue())['verifiedAbsent'])

    def test_already_absent_bound_root_is_idempotent(self):
        fs, _ = populated()
        m.run_cleanup(config(), fs)
        result = m.run_cleanup(config(), fs)
        self.assertFalse(result['rootObserved'])
        self.assertEqual(result['filesRemoved'], 0)
        self.assertTrue(result['verifiedAbsent'])

    def test_deadline_invalid_values_and_nonroot_refused_before_deletion(self):
        for deadline in (0, -1, 25.1, float('nan'), float('inf'), True):
            fs, _ = populated()
            with self.subTest(deadline=deadline), self.assertRaises(m.CleanupError):
                m.run_cleanup(config(deadline=deadline), fs)
            self.assertEqual(fs.unlinks, [])
        fs, _ = populated(uid=10001)
        with self.assertRaises(m.CleanupError):
            m.run_cleanup(config(), fs)

    def test_exact_parent_and_root_modes_and_parent_owner(self):
        for parent_mode, parent_uid, root_mode in ((0o777,0,0o700),(0o1777,1,0o700),(0o1777,0,0o755),(0o1777,0,0o2700)):
            fs, target = populated()
            fs.root.mode, fs.root.uid, target.mode = parent_mode, parent_uid, root_mode
            with self.subTest(mode=root_mode), self.assertRaises(m.CleanupError):
                m.run_cleanup(config(), fs)
            self.assertEqual(fs.unlinks, [])

    def test_bound_identity_mismatch_refuses_other_nonce_reuse(self):
        fs, target = populated()
        with self.assertRaises(m.CleanupError):
            m.run_cleanup(config(identity=(1, 999)), fs)
        self.assertEqual(fs.unlinks, [])

    def test_final_parent_substitution_is_failure(self):
        fs, target = populated()
        seen = 0
        def replace(node, path, dir_fd):
            nonlocal seen
            if path == '/tmp':
                seen += 1
                if seen >= 2:
                    return fs._node('dir', mode=0o1777)
            return node
        fs.lstat_hook = replace
        with self.assertRaises(m.CleanupError):
            m.run_cleanup(config(), fs)
        self.assertIn(NAME, fs.root.children)

class FinalMetadataTests(unittest.TestCase):
    def test_root_metadata_changed_on_open_refused(self):
        fs, target = populated()
        def mutate(node, fd):
            if node is target:
                node.mode = 0o755
            return node
        fs.fstat_hook = mutate
        with self.assertRaises(m.CleanupError):
            m.run_cleanup(config(), fs)
        self.assertEqual(fs.unlinks, [])

    def test_entry_budget_includes_credential_config(self):
        fs=FakeFs();target=fs.add_dir(fs.root,NAME,mode=0o700)
        fs.add_file(target,'config.json',mode=0o600)
        for i in range(m.MAX_ENTRIES):
            fs.add_file(target,'f%05d'%i,mode=0o600)
        with self.assertRaises(m.CleanupError):
            m.run_cleanup(config(),fs)


if __name__ == '__main__':
    unittest.main(verbosity=2)
