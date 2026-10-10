"""Bounded BUILD HOST cleanup of one isolated Docker auth/config directory.

Trusted build-host tool only. It is never part of the worker Docker build
context (apps/worker/qualification) and must never be copied into, or run by,
the worker image. It exists because the reviewed remote buildspec creates a
throwaway ``DOCKER_CONFIG`` directory with ``mktemp -d /tmp/meri-worker-auth.XXXXXXXX``
and the old ``rmdir`` failed with "Directory not empty". Residual contents
were not observed; Docker/BuildKit state is only a hypothesis.

Design constraints (all enforced below):

* standard library only;
* deletion is confined to ONE directory under an EXACT trusted parent using
  open-directory + ``dir_fd`` relative syscalls, so a symlink or rename can
  never follow a symlink outside the admitted root;
* the exact parent, prefix and canonical 8-character nonce are required and
  anything else is refused;
* credential CONTENTS are never opened, read, printed, logged or hashed. Only
  typed metadata (lstat/fstat) is inspected; the expected regular
  ``config.json`` is unlinked first and bounded state metadata is removed after;
* symlinks, hardlinks, special files, unexpected ownership/mode, oversized
  entry counts, depth or byte totals, root/parent substitution and races are
  refused;
* absence is verified after removal; unknown cleanup is a failure;
* real deletion on Windows is explicitly unsupported (the confined POSIX
  syscalls are unavailable there);
* no wildcard ``rm -rf`` and no general arbitrary-path deletion entry point.
"""
import argparse
import errno
import json
import os
import re
import math
import stat
import sys
import time

SCHEMA = 'meri-worker-auth-cleanup/1'
TRUSTED_PARENT = '/tmp'
DIR_PREFIX = 'meri-worker-auth.'
NONCE_RE = re.compile(r'[A-Za-z0-9]{8}')
CONFIG_NAME = 'config.json'

MAX_ENTRIES = 4096
MAX_DEPTH = 16
MAX_BYTES = 64 * 1024 * 1024
MAX_FILE_BYTES = 16 * 1024 * 1024
DEADLINE_SECONDS = 25.0

CONFINED_FD_DELETION = True

_O_DIRECTORY = getattr(os, 'O_DIRECTORY', 0)
_O_NOFOLLOW = getattr(os, 'O_NOFOLLOW', 0)
_O_CLOEXEC = getattr(os, 'O_CLOEXEC', 0)
_DIR_FLAGS = os.O_RDONLY | _O_DIRECTORY | _O_NOFOLLOW | _O_CLOEXEC


class CleanupError(Exception):
    """Confined cleanup refused or failed; absence is unproven."""


class UnsupportedPlatform(Exception):
    """Real confined deletion is not available on this platform."""


def require(condition, message):
    if not condition:
        raise CleanupError(message)


class CleanupConfig:
    __slots__ = ('parent', 'prefix', 'nonce', 'identity', 'deadline')

    def __init__(self, parent, prefix, nonce, identity, deadline=DEADLINE_SECONDS):
        self.parent = parent
        self.prefix = prefix
        self.nonce = nonce
        self.identity = identity
        self.deadline = deadline


class CleanupState:
    __slots__ = ('start', 'clock', 'deadline', 'entries', 'files', 'bytes', 'depth')

    def __init__(self, start, clock, deadline):
        self.start = start
        self.clock = clock
        self.deadline = deadline
        self.entries = 0
        self.files = 0
        self.bytes = 0
        self.depth = 0

    def tick(self):
        require(self.clock() - self.start <= self.deadline, 'cleanup exceeded the bounded deadline')


class RealFs:
    """Minimal POSIX filesystem surface, injected so tests can compose a fake."""

    def open(self, path, flags, dir_fd=None, mode=0o777):
        return os.open(path, flags, mode, dir_fd=dir_fd)

    def close(self, fd):
        os.close(fd)

    def fstat(self, fd):
        return os.fstat(fd)

    def lstat(self, path, dir_fd=None):
        return os.lstat(path, dir_fd=dir_fd)

    def listdir(self, fd):
        return os.listdir(fd)

    def unlink(self, path, dir_fd=None):
        os.unlink(path, dir_fd=dir_fd)

    def rmdir(self, path, dir_fd=None):
        os.rmdir(path, dir_fd=dir_fd)

    def geteuid(self):
        return os.geteuid()


def _identity(st):
    return (st.st_dev, st.st_ino)


def _expect_absent(fsapi, name, dir_fd):
    try:
        fsapi.lstat(name, dir_fd=dir_fd)
    except FileNotFoundError:
        return
    except OSError as error:
        if error.errno == errno.ENOENT:
            return
        raise
    raise CleanupError('entry still present after removal')


def _open_child_dir(fsapi, name, dir_fd):
    try:
        return fsapi.open(name, _DIR_FLAGS, dir_fd=dir_fd)
    except OSError as error:
        if error.errno in (errno.ELOOP, errno.ENOTDIR, errno.ENOENT):
            raise CleanupError('refused non-directory or symlink entry')
        raise


def _remove_config(fsapi, dir_fd, state, expect_uid):
    try:
        st = fsapi.lstat(CONFIG_NAME, dir_fd=dir_fd)
    except FileNotFoundError:
        return  # Failure-trap replay after config removal is idempotent.
    require(stat.S_ISREG(st.st_mode), 'config entry is not a regular file')
    require(st.st_nlink == 1, 'config entry is a hardlink')
    require(st.st_uid == expect_uid, 'config entry ownership mismatch')
    require(st.st_mode & 0o7022 == 0, 'config entry mode has unexpected bits')
    require(0 <= st.st_size <= MAX_FILE_BYTES, 'config entry size out of bounds')
    state.entries += 1
    require(state.entries <= MAX_ENTRIES, 'entry count bound exceeded')
    state.files += 1
    state.bytes += st.st_size
    require(state.bytes <= MAX_BYTES, 'aggregate byte bound exceeded')
    fsapi.unlink(CONFIG_NAME, dir_fd=dir_fd)
    _expect_absent(fsapi, CONFIG_NAME, dir_fd)


def _clear(fsapi, dir_fd, state, depth, expect_uid):
    require(depth <= MAX_DEPTH, 'depth bound exceeded')
    if depth > state.depth:
        state.depth = depth
    names = fsapi.listdir(dir_fd)
    require(isinstance(names, list) and len(names) <= MAX_ENTRIES, 'directory listing invalid or oversized')
    state.entries += len(names)
    require(state.entries <= MAX_ENTRIES, 'entry count bound exceeded')
    for name in sorted(names):
        state.tick()
        require(isinstance(name, str) and name not in ('.', '..') and '/' not in name and '\0' not in name,
                'refused unsafe entry name')
        st = fsapi.lstat(name, dir_fd=dir_fd)
        require(stat.S_ISDIR(st.st_mode) or stat.S_ISREG(st.st_mode), 'refused symlink/special entry')
        require(st.st_mode & 0o7022 == 0, 'entry has unexpected mode bits')
        require(st.st_uid == expect_uid, 'entry ownership mismatch')
        if stat.S_ISDIR(st.st_mode):
            child = _open_child_dir(fsapi, name, dir_fd)
            try:
                require(_identity(fsapi.fstat(child)) == _identity(st), 'directory substitution race')
                _clear(fsapi, child, state, depth + 1, expect_uid)
            finally:
                fsapi.close(child)
            after = fsapi.lstat(name, dir_fd=dir_fd)
            require(_identity(after) == _identity(st) and stat.S_ISDIR(after.st_mode), 'directory substitution race')
            fsapi.rmdir(name, dir_fd=dir_fd)
            _expect_absent(fsapi, name, dir_fd)
        elif stat.S_ISREG(st.st_mode):
            require(st.st_nlink == 1, 'entry is a hardlink')
            require(st.st_mode & 0o0022 == 0, 'entry mode has unexpected write bits')
            require(0 <= st.st_size <= MAX_FILE_BYTES, 'entry size out of bounds')
            state.files += 1
            state.bytes += st.st_size
            require(state.bytes <= MAX_BYTES, 'aggregate byte bound exceeded')
            fsapi.unlink(name, dir_fd=dir_fd)
            _expect_absent(fsapi, name, dir_fd)
        else:
            raise CleanupError('refused symlink/special entry')


def run_cleanup(config, fsapi, clock=time.monotonic):
    """Remove exactly one admitted auth directory and prove its absence."""
    require(isinstance(config.parent, str) and config.parent == TRUSTED_PARENT, 'untrusted parent refused')
    require(config.prefix == DIR_PREFIX, 'untrusted prefix refused')
    require(isinstance(config.nonce, str) and NONCE_RE.fullmatch(config.nonce) is not None,
            'non-canonical nonce refused')
    name = config.prefix + config.nonce
    require(fsapi.geteuid() == 0, 'trusted build-host root identity required')
    expect_uid = 0
    require(isinstance(config.deadline, (int, float)) and not isinstance(config.deadline, bool)
            and math.isfinite(config.deadline) and 0 < config.deadline <= DEADLINE_SECONDS,
            'deadline must be finite positive and at most 25 seconds')
    require(isinstance(config.identity, tuple) and len(config.identity) == 2
            and all(type(v) is int and v > 0 for v in config.identity), 'bound root identity required')
    start = clock()
    state = CleanupState(start, clock, config.deadline)

    parent_fd = fsapi.open(config.parent, _DIR_FLAGS)
    try:
        parent_stat = fsapi.fstat(parent_fd)
        def check_parent():
            path_stat = fsapi.lstat(config.parent)
            require(stat.S_ISDIR(path_stat.st_mode) and path_stat.st_uid == 0
                    and stat.S_IMODE(path_stat.st_mode) == 0o1777, 'untrusted parent metadata')
            require(_identity(path_stat) == _identity(parent_stat), 'parent substitution refused')
        require(stat.S_ISDIR(parent_stat.st_mode) and parent_stat.st_uid == 0
                and stat.S_IMODE(parent_stat.st_mode) == 0o1777, 'untrusted parent metadata')
        check_parent()
        try:
            target = fsapi.lstat(name, dir_fd=parent_fd)
        except FileNotFoundError:
            target = None
        if target is None:
            check_parent()
            _expect_absent(fsapi, name, parent_fd)
            state.tick()
            return _receipt(config, state, clock, root_observed=False)
        require(stat.S_ISDIR(target.st_mode), 'target is not a real directory (symlink/other refused)')
        require(target.st_uid == expect_uid, 'target ownership mismatch')
        require(stat.S_IMODE(target.st_mode) == 0o700, 'target mode must be exactly 0700')
        require(_identity(target) == config.identity, 'bound target identity mismatch')
        target_fd = fsapi.open(name, _DIR_FLAGS, dir_fd=parent_fd)
        try:
            opened = fsapi.fstat(target_fd)
            require(_identity(opened) == _identity(target) and opened.st_uid == 0
                    and stat.S_IMODE(opened.st_mode) == 0o700, 'target substitution race')
            state.tick()
            _remove_config(fsapi, target_fd, state, expect_uid)
            _clear(fsapi, target_fd, state, 0, expect_uid)
            state.tick()
        finally:
            fsapi.close(target_fd)
        before_rmdir = fsapi.lstat(name, dir_fd=parent_fd)
        require(_identity(before_rmdir) == _identity(target) and stat.S_ISDIR(before_rmdir.st_mode)
                and before_rmdir.st_uid == 0 and stat.S_IMODE(before_rmdir.st_mode) == 0o700,
                'target substitution race before removal')
        check_parent()
        fsapi.rmdir(name, dir_fd=parent_fd)
        _expect_absent(fsapi, name, parent_fd)
        check_parent()
        state.tick()
    finally:
        fsapi.close(parent_fd)

    return _receipt(config, state, clock, root_observed=True)


def _receipt(config, state, clock, root_observed):
    return dict(schema=SCHEMA, status='CLEANED', parent=config.parent, prefix=config.prefix,
                nonce=config.nonce, directoryName=config.prefix + config.nonce, entriesRemoved=state.entries,
                filesRemoved=state.files, bytesRemoved=state.bytes, maxDepth=state.depth,
                verifiedAbsent=True, rootObserved=root_observed, boundIdentity=list(config.identity),
                policy='fd-relative-nofollow-root-owned-bounded/1',
                realWindowsDeletion='UNSUPPORTED', elapsedMs=int((clock() - state.start) * 1000))


def assert_supported_platform():
    if os.name != 'posix':
        raise UnsupportedPlatform('real confined deletion is unsupported on ' + os.name)
    if not _O_DIRECTORY or not _O_NOFOLLOW or not all(f in os.supports_dir_fd for f in (os.open, os.stat, os.unlink, os.rmdir)) or os.listdir not in os.supports_fd:
        raise UnsupportedPlatform('confined FD deletion unavailable')


def main(argv=None):
    parser = argparse.ArgumentParser(description='Bounded build-host Docker auth/config cleanup.')
    parser.add_argument('--nonce', required=True)
    parser.add_argument('--identity', required=True, help='Exact device:inode bound immediately after mktemp')
    parser.add_argument('--max-seconds', type=float, default=DEADLINE_SECONDS)
    args = parser.parse_args(argv)
    try:
        assert_supported_platform()
        require(re.fullmatch(r'[1-9][0-9]*:[1-9][0-9]*', args.identity) is not None, 'bound root identity required')
        config = CleanupConfig(TRUSTED_PARENT, DIR_PREFIX, args.nonce,
                               tuple(map(int, args.identity.split(':'))), deadline=args.max_seconds)
        receipt = run_cleanup(config, RealFs())
    except UnsupportedPlatform as error:
        print(json.dumps(dict(schema=SCHEMA, status='UNSUPPORTED_PLATFORM', platform=os.name,
                              detail=str(error))), file=sys.stderr)
        return 3
    except BaseException as error:  # noqa: BLE001 - fail closed, never suppress.
        print(json.dumps(dict(schema=SCHEMA, status='FAILED', errorType=type(error).__name__)), file=sys.stderr)
        return 1
    print(json.dumps(receipt, sort_keys=True))  # No filesystem receipt-path authority.
    return 0


if __name__ == '__main__':
    sys.exit(main())
