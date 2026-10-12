"""Reviewer-owned memory-only filesystem model; no native file/process ports."""
import hashlib
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
import stat

SLOT = Path('/synthetic-review-slot')

class Clock:
    def __init__(self):
        self.now = 0.0
    def __call__(self):
        return self.now

class Budget:
    def __init__(self, clock):
        self.clock = clock
        self.total_end = 15.0
    def check(self, phase):
        if phase != 'total':
            raise AssertionError('writer changed budget phase')
        if self.clock() >= self.total_end:
            raise ValueError('inert-expired')
    def remaining(self, phase):
        return max(0, self.total_end - self.clock())

class Memory:
    def __init__(self, *, mode='valid'):
        self.clock = Clock()
        self.budget = Budget(self.clock)
        self.mode = mode
        self.files = {}
        self.inodes = {}
        self.opened = {}
        self.closed = []
        self.calls = []
        self.enumerations = 0
        self.next_fd = 100
        self.next_inode = 10
        self.directory_inode = 2
        self.readbacks = 0

    def event(self, label):
        self.calls.append(label)
        if self.mode == 'late-' + label:
            self.clock.now = 16.0
        if self.mode == 'error-' + label:
            raise OSError('inert-' + label)

    def info(self, path):
        path = Path(path)
        if path == SLOT:
            ino = 99 if self.mode == 'foreign-directory' else self.directory_inode
            return SimpleNamespace(st_dev=1, st_ino=ino, st_mode=stat.S_IFDIR | 0o700,
                                   st_nlink=1, st_size=len(self.files), st_mtime_ns=len(self.files),
                                   st_ctime_ns=len(self.files), st_file_attributes=0)
        if path.parent != SLOT or path.name not in self.files:
            raise FileNotFoundError('inert-missing')
        mode = stat.S_IFLNK if self.mode == 'symlink-member' else stat.S_IFREG
        links = 2 if self.mode == 'hardlink-member' else 1
        return SimpleNamespace(st_dev=1, st_ino=self.inodes[path.name], st_mode=mode | 0o600,
                               st_nlink=links, st_size=len(self.files[path.name]),
                               st_mtime_ns=len(self.files[path.name]), st_ctime_ns=len(self.files[path.name]),
                               st_file_attributes=0)

    def ancestors(self, path, fs):
        self.event('ancestors')
        if Path(path) not in (SLOT, SLOT.parent):
            raise ValueError('inert-unexpected-ancestry')

    def plain(self, path, fs, directory=False):
        self.event('plain')
        row = self.info(path)
        if directory:
            if not stat.S_ISDIR(row.st_mode):
                raise ValueError('inert-not-directory')
        elif not stat.S_ISREG(row.st_mode) or row.st_nlink != 1:
            raise ValueError('inert-unsafe-member')
        return row

    @staticmethod
    def identity(row):
        return (row.st_dev, row.st_ino, row.st_mode, row.st_nlink, row.st_size,
                row.st_mtime_ns, row.st_ctime_ns, row.st_file_attributes)

    @contextmanager
    def children(self, path):
        if Path(path) != SLOT:
            raise AssertionError('inert-foreign-enumeration')
        self.enumerations += 1
        self.event('children')
        if self.mode == 'late-final-membership' and self.enumerations >= 5:
            self.clock.now = 16.0
        paths = [SLOT / name for name in self.files]
        if self.mode == 'extra-member' and paths:
            paths.append(SLOT / 'foreign.txt')
        if self.mode == 'duplicate-member' and paths:
            paths.append(paths[0])
        if self.mode == 'foreign-child' and paths:
            paths.append(Path('/unrelated/member'))
        values = iter(paths)
        parent = self
        class Entries:
            def __iter__(self):
                return self
            def __next__(self):
                parent.event('next')
                return next(values)
        try:
            yield Entries()
        finally:
            self.event('children-close')

    def open_exclusive(self, path, *args, **kwargs):
        self.event('open')
        path = Path(path)
        if path.parent != SLOT or path.name in self.files:
            raise FileExistsError('inert-exclusive-refusal')
        self.files[path.name] = bytearray()
        self.inodes[path.name] = self.next_inode
        self.next_inode += 1
        fd = self.next_fd
        self.next_fd += 1
        self.opened[fd] = path
        return fd

    def write(self, fd, content):
        self.event('write')
        if self.mode == 'zero-write':
            return 0
        if self.mode == 'boolean-write':
            return True
        if self.mode == 'negative-write':
            return -1
        if self.mode == 'oversized-write':
            return len(content) + 1
        count = min(2, len(content)) if self.mode == 'short-write' else len(content)
        self.files[self.opened[fd].name].extend(content[:count])
        return count

    def fstat(self, fd):
        self.event('fstat')
        row = self.info(self.opened[fd])
        if self.mode == 'foreign-opened-file':
            row.st_ino += 500
        return row

    def fsync(self, fd):
        self.event('fsync')

    def close(self, fd):
        self.closed.append(fd)
        self.event('close')

    def hash_file(self, path, *, fs, clock, end, cap, allow_empty=False):
        self.event('readback')
        self.readbacks += 1
        if end != self.budget.total_end or clock is not self.clock:
            raise AssertionError('inert-clock-replaced')
        raw = bytes(self.files[Path(path).name])
        if len(raw) > cap:
            raise ValueError('inert-cap')
        value = hashlib.sha256(raw).hexdigest()
        if self.mode == 'wrong-hash':
            value = '0' * 64
        if self.mode == 'substitute-after-readback':
            self.inodes[Path(path).name] += 1000
        return {'path': str(path), 'bytes': len(raw) + (1 if self.mode == 'wrong-size' else 0), 'sha256': value}
