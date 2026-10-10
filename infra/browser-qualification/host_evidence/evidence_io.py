"""W02-17 collector extraction: bounded evidence IO primitives (verbatim)."""
import os

from .config import MAX_EXE_BYTES

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
