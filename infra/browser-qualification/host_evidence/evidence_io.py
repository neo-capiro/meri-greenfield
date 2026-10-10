"""W02-17/20 evidence IO: bounded file primitives plus strict JSON helpers.

The three W02-17 file primitives stay byte-identical; W02-20 adds the strict /
bounded JSON decoders moved verbatim out of the entry. Import is inert: no host
IO, no mutable lifecycle state, stdlib only.
"""
import json
import os

from .config import CAPTURE_FILE_MAX, EXPORT_TOTAL_RAW_MAX, MAX_EXE_BYTES


def _read(path, limit=4096):
    try:
        with open(path, "r", errors="replace") as fh:
            return fh.read(limit)
    except OSError:
        return None


def _read_bytes(path, limit=MAX_EXE_BYTES):
    try:
        with open(path, "rb") as fh:
            return fh.read(limit)
    except OSError:
        return None
    except MemoryError:
        return None


def _atomic_write(path, text):
    tmp = path + ".tmp.%d" % os.getpid()
    with open(tmp, "w") as fh:
        fh.write(text)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, path)

def _finite_json(value):
    try:
        return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False, ensure_ascii=False)
    except (TypeError, ValueError):
        return None

def _exact_keys(value, keys):
    return isinstance(value, dict) and set(value) == set(keys)

def _strict_json(text):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result: raise ValueError("duplicate JSON key")
            result[key] = value
        return result
    def constant(_value): raise ValueError("nonfinite JSON")
    return json.loads(text, object_pairs_hook=pairs, parse_constant=constant)

def _bounded_text(path, limit=CAPTURE_FILE_MAX):
    """Bound before allocation; reject replacement, links, nonregular or changed input."""
    import stat
    listed = os.lstat(path)
    if not stat.S_ISREG(listed.st_mode) or listed.st_nlink != 1 or listed.st_size > limit:
        raise ValueError("unsafe/oversize evidence file: " + os.path.basename(path))
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_BINARY", 0)
    fd = os.open(path, flags)
    try:
        before = os.fstat(fd)
        if _evidence_identity(before) != _evidence_identity(listed) or before.st_nlink != 1:
            raise ValueError("evidence file changed before read")
        chunks, total = [], 0
        while True:
            chunk = os.read(fd, min(65536, limit - total + 1))
            if not chunk:
                break
            total += len(chunk)
            if total > limit:
                raise ValueError("evidence file exceeds bound")
            chunks.append(chunk)
        after = os.fstat(fd)
        if _evidence_identity(after) != _evidence_identity(before) or after.st_nlink != 1 or total != before.st_size or _evidence_identity(os.lstat(path)) != _evidence_identity(listed):
            raise ValueError("evidence file changed during read")
        return b"".join(chunks).decode("utf-8", "strict")
    finally:
        os.close(fd)

def _evidence_identity(st):
    # Python on Windows reports path ctime as birthtime but descriptor ctime as
    # change time. Authoring fixtures compare birthtime consistently there.
    # Actual Linux guest retains the full inode/size/mtime/ctime comparison.
    changed = getattr(st, "st_birthtime_ns", None) if os.name == "nt" else st.st_ctime_ns
    return (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns, changed)

def _load_json(path, default=None):
    try:return _strict_json(_bounded_text(path,EXPORT_TOTAL_RAW_MAX*3))
    except (OSError,ValueError,UnicodeError):return default
