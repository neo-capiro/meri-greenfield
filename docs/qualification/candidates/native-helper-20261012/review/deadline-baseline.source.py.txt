"""Bounded read-only runner filesystem observations and owned result files."""
from contextlib import contextmanager
from dataclasses import dataclass
import hashlib
import os
from pathlib import Path, PurePosixPath
import stat
import time


@dataclass(frozen=True)
class Limits:
    files: int = 20000
    entries: int = 80000
    file_bytes: int = 16 * 1024 * 1024
    total_bytes: int = 256 * 1024 * 1024
    seconds: int = 60


class Filesystem:
    """Native operations needed by this inventory; injected only by callers/tests."""
    lstat = staticmethod(os.lstat)
    fstat = staticmethod(os.fstat)
    close = staticmethod(os.close)
    read = staticmethod(os.read)

    @contextmanager
    def children(self, path):
        with os.scandir(path) as entries:
            yield (Path(entry.path) for entry in entries)

    def open_read(self, path):
        return os.open(path, os.O_RDONLY | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0))


def identity(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_nlink, info.st_size,
            info.st_mtime_ns, info.st_ctime_ns, getattr(info, 'st_file_attributes', 0))


def check_deadline(end, clock):
    if clock() >= end:
        raise ValueError('runner inventory deadline')


def plain(path, fs, directory=False):
    info = fs.lstat(path)
    if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
        raise ValueError('runner link/reparse refused')
    if directory:
        if not stat.S_ISDIR(info.st_mode):
            raise ValueError('runner directory required')
    elif not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
        raise ValueError('runner single regular file required')
    return info


def ancestors(path, fs):
    path = Path(path)
    if not path.is_absolute() or '..' in path.parts or str(path).startswith('\\\\'):
        raise ValueError('absolute local runner path required')
    for parent in reversed((path, *path.parents)):
        plain(parent, fs, directory=True)


def hash_file(path, *, fs, clock, end, cap, allow_empty=False):
    """Stream bytes without retaining contents; bind the opened and named file."""
    check_deadline(end, clock)
    path = Path(path)
    ancestors(path.parent, fs)
    before = plain(path, fs)
    if not (0 if allow_empty else 1) <= before.st_size <= cap:
        raise ValueError('runner file byte bound')
    fd = fs.open_read(path)
    try:
        opened = fs.fstat(fd)
        # Windows lstat/fstat permission/attribute representations may differ.
        # Keep each API's metadata independently stable and bind the same file.
        if (opened.st_dev, opened.st_ino, opened.st_size, opened.st_nlink) != (
                before.st_dev, before.st_ino, before.st_size, before.st_nlink) \
                or not stat.S_ISREG(opened.st_mode):
            raise ValueError('runner open identity changed')
        digest, count = hashlib.sha256(), 0
        while True:
            check_deadline(end, clock)
            chunk = fs.read(fd, 65536)
            if not chunk:
                break
            count += len(chunk)
            if count > cap or count > before.st_size:
                raise ValueError('runner growing file refused')
            digest.update(chunk)
        if identity(fs.fstat(fd)) != identity(opened):
            raise ValueError('runner file changed while reading')
    finally:
        fs.close(fd)
    if identity(plain(path, fs)) != identity(before) or count != before.st_size:
        raise ValueError('runner named file changed')
    return {'path': str(path), 'bytes': count, 'sha256': digest.hexdigest()}


def selected_paths(executable, prefix, repository, helper_names, *, fs, clock, end, limits):
    """Enumerate the explicit build-runtime profile, never site-packages."""
    files, directories, seen, count = [], {}, set(), 0
    for root in (prefix, prefix / 'Lib', prefix / 'DLLs', repository):
        ancestors(root, fs)

    def add(path):
        if len(str(path)) > 1024:
            raise ValueError('runner path length bound')
        key = str(path).casefold()
        if key in seen:
            raise ValueError('duplicate/casefold runner path')
        seen.add(key)
        files.append(path)
        if len(files) > limits.files:
            raise ValueError('runner member bound')

    def children(folder):
        nonlocal count
        check_deadline(end, clock)
        before = plain(folder, fs, directory=True)
        directories[str(folder)] = identity(before)
        result = []
        with fs.children(folder) as entries:
            for path in entries:
                check_deadline(end, clock)
                count += 1
                if count > limits.entries:
                    raise ValueError('runner directory-entry bound')
                if path.parent != folder or path.name in ('', '.', '..'):
                    raise ValueError('runner enumeration escaped directory')
                result.append(path)
        if identity(plain(folder, fs, directory=True)) != identity(before):
            raise ValueError('runner directory changed while listing')
        return sorted(result, key=lambda path: (str(path).casefold(), str(path)))

    add(executable)
    pending = [prefix / 'Lib']
    while pending:
        folder = pending.pop()
        for path in children(folder):
            if path.name.casefold() == 'site-packages':
                continue
            info = fs.lstat(path)
            if stat.S_ISDIR(info.st_mode):
                plain(path, fs, directory=True)
                pending.append(path)
            elif path.suffix.casefold() == '.py':
                plain(path, fs)
                add(path)
            elif stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
                raise ValueError('runner selected-tree link/reparse refused')
    for folder in (prefix, prefix / 'DLLs'):
        for path in children(folder):
            if path.suffix.casefold() == '.dll' or (folder.name == 'DLLs' and path.suffix.casefold() == '.pyd'):
                plain(path, fs)
                add(path)
    helper_keys = set()
    for name in helper_names:
        if type(name) is not str or PurePosixPath(name).as_posix() != name or PurePosixPath(name).is_absolute() \
                or '\\' in name or any(part in ('', '.', '..') for part in name.split('/')):
            raise ValueError('canonical helper path required')
        if name.casefold() in helper_keys:
            raise ValueError('duplicate/casefold helper path')
        helper_keys.add(name.casefold())
        add(repository / name)
    ordered = sorted(files, key=lambda path: (str(path).casefold(), str(path)))
    metadata = {str(path): identity(plain(path, fs)) for path in ordered}
    return ordered, directories, metadata


def inventory(executable, prefix, repository, helper_names, *, fs=None, clock=time.monotonic,
              limits=Limits(), end=None):
    if any(type(value) is not int or value <= 0 for value in (
            limits.files, limits.entries, limits.file_bytes, limits.total_bytes, limits.seconds)):
        raise ValueError('positive inventory limits required')
    fs = fs or Filesystem()
    executable, prefix, repository = map(Path, (executable, prefix, repository))
    end = clock() + limits.seconds if end is None else end
    initial = selected_paths(executable, prefix, repository, helper_names,
                             fs=fs, clock=clock, end=end, limits=limits)
    records, total = [], 0
    for path in initial[0]:
        row = hash_file(path, fs=fs, clock=clock, end=end, cap=limits.file_bytes)
        total += row['bytes']
        if total > limits.total_bytes:
            raise ValueError('runner aggregate byte bound')
        records.append(row)
    final = selected_paths(executable, prefix, repository, helper_names,
                           fs=fs, clock=clock, end=end, limits=limits)
    if initial != final:
        raise ValueError('runner membership/identity changed during capture')
    helper_set = {str(repository / name) for name in helper_names}
    helpers, runtime = [], []
    for row in records:
        if row['path'] in helper_set:
            helpers.append(dict(row, path=Path(row['path']).relative_to(repository).as_posix()))
        else:
            runtime.append(row)
    return {'files': runtime, 'helperFiles': helpers, 'totalBytes': total,
            'coverage': {'profile': 'selected-build-runtime/1', 'stdlibPython': 'Lib/**/*.py',
                         'rootNative': '*.dll', 'extensionNative': 'DLLs/*.pyd and DLLs/*.dll',
                         'executableIncluded': True,
                         'excluded': ['site-packages', 'existing .pyc bytecode',
                                      'stdlib/installation .zip archives', 'non-.py stdlib data',
                                      'venv/registry startup configuration',
                                      'native dependencies outside the selected DLL sets',
                                      'OS binaries and ACLs'],
                         'completeExecutableClosure': False, 'loadedNativeDependenciesQualified': False,
                         'osAclQualified': False, 'wholeHermesEnvironment': False,
                         'membershipRescanned': True}}


def write_result(output, artifacts, *, fs=None, clock=time.monotonic, end=None):
    """Create only an exclusive slot; remove only identities this call created."""
    fs = fs or Filesystem()
    end = clock() + 30 if end is None else end
    ancestors(output.parent, fs)
    created, owned = [], None

    def snapshot():
        """Bracket the exact result membership and all owned file identities."""
        check_deadline(end, clock)
        before = identity(plain(output, fs, directory=True))
        if before[:2] != owned:
            raise ValueError('owned result directory substituted')
        names, metadata = set(), {}
        with fs.children(output) as entries:
            for path in entries:
                check_deadline(end, clock)
                if path.parent != output or path.name not in artifacts or path.name in names:
                    raise ValueError('owned result membership differs')
                names.add(path.name)
                metadata[path.name] = identity(plain(path, fs))
        if names != set(artifacts) or identity(plain(output, fs, directory=True)) != before:
            raise ValueError('owned result membership/directory changed')
        for path, key in created:
            if metadata[path.name][:2] != key:
                raise ValueError('owned result file substituted')
        return before, metadata

    try:
        output.mkdir(exist_ok=False)
        owned = identity(plain(output, fs, directory=True))[:2]
        for name, raw in artifacts.items():
            check_deadline(end, clock)
            if Path(name).name != name or name in ('', '.', '..'):
                raise ValueError('result filename refused')
            if identity(plain(output, fs, directory=True))[:2] != owned:
                raise ValueError('owned result directory substituted')
            path = output / name
            flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0)
            fd = os.open(path, flags, 0o600)
            created.append((path, identity(os.fstat(fd))[:2]))
            with os.fdopen(fd, 'wb') as stream:
                stream.write(raw)
                stream.flush()
                os.fsync(stream.fileno())
            observed = hash_file(path, fs=fs, clock=clock, end=end,
                                 cap=max(1, len(raw)), allow_empty=True)
            if observed['bytes'] != len(raw) or observed['sha256'] != hashlib.sha256(raw).hexdigest():
                raise ValueError('owned result file readback differs')
        initial = snapshot()
        for name, raw in artifacts.items():
            observed = hash_file(output / name, fs=fs, clock=clock, end=end,
                                 cap=max(1, len(raw)), allow_empty=True)
            if observed['bytes'] != len(raw) or observed['sha256'] != hashlib.sha256(raw).hexdigest():
                raise ValueError('final result closure readback differs')
        if snapshot() != initial:
            raise ValueError('result closure changed during final readback')
    except Exception:
        if owned is not None and output.exists() and identity(plain(output, fs, directory=True))[:2] == owned:
            for path, key in reversed(created):
                if identity(plain(output, fs, directory=True))[:2] != owned:
                    raise ValueError('capture failed; substituted slot preserved') from None
                if path.exists() and identity(plain(path, fs))[:2] == key:
                    path.unlink()
            if identity(plain(output, fs, directory=True))[:2] != owned:
                raise ValueError('capture failed; substituted slot preserved') from None
            try:
                output.rmdir()
            except OSError:
                raise ValueError('capture failed; owned slot contains foreign/incomplete files') from None
        raise
