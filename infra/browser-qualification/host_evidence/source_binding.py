"""Finite v2 source/context validation. Import is inert; no cached authority.

The privileged loader supplies the protected tree and its externally reviewed
manifest. These checks detect drift; they do not authenticate a replaced root
owner's expectation. Named fixture imports confer no host admission.
"""
import hashlib
import json
import os
import stat

from .classification import _hex64_ok
from .config import (
    CONTEXT_KEYS, EXPECTED_SECCOMP_SHA256, PINNED_IMAGE, SOURCE_AGGREGATE_MAX,
    SOURCE_ASSET_MAX, SOURCE_ASSET_PATHS, SOURCE_MANIFEST_MAX, SOURCE_MANIFEST_NAME,
    SOURCE_PROFILE_ASSET, SOURCE_RECORD_KEYS, SOURCE_SCHEMA_V2, SUPPORT_PATTERN,
)
from .evidence_io import _strict_json


def _source_root():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _source_identity(value):
    return (value.st_dev, value.st_ino, value.st_mode, value.st_nlink,
            value.st_size, value.st_mtime_ns,
            getattr(value, "st_birthtime_ns", value.st_ctime_ns) if os.name == "nt" else value.st_ctime_ns)


def _source_read(path, limit):
    """Read bounded raw bytes, bind pathname/FD identities, always close the FD."""
    fd = None
    try:
        listed = os.lstat(path)
        if not stat.S_ISREG(listed.st_mode) or listed.st_nlink != 1 or not 0 < listed.st_size <= limit:
            raise ValueError("source file refused")
        fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_BINARY", 0))
        opened = os.fstat(fd)
        if _source_identity(listed) != _source_identity(opened):
            raise ValueError("source file refused")
        chunks, total = [], 0
        while total <= limit:
            chunk = os.read(fd, min(65536, limit + 1 - total))
            if not chunk:
                break
            chunks.append(chunk)
            total += len(chunk)
        if total != opened.st_size or total > limit:
            raise ValueError("source file refused")
        if _source_identity(opened) != _source_identity(os.fstat(fd)) or _source_identity(opened) != _source_identity(os.lstat(path)):
            raise ValueError("source file refused")
        return b"".join(chunks)
    except OSError:
        raise OSError("source file unavailable") from None
    finally:
        if fd is not None:
            try:
                os.close(fd)
            except OSError:
                raise OSError("source descriptor close refused") from None


def _source_asset_read(folder, relpath, limit=SOURCE_ASSET_MAX):
    if relpath not in SOURCE_ASSET_PATHS or type(limit) is not int or not 0 < limit <= SOURCE_ASSET_MAX:
        raise ValueError("source asset refused")
    return _source_read(os.path.join(folder, *relpath.split("/")), limit)


def _source_tree(folder):
    """Require the complete finalized finite layout, including separate DATA."""
    package = os.path.join(folder, "host_evidence")
    for directory in (folder, package):
        if not stat.S_ISDIR(os.lstat(directory).st_mode):
            raise ValueError("source directory refused")
    if set(os.listdir(folder)) != {"bootstrap.sh", "host-evidence.py", "seccomp.json", SOURCE_MANIFEST_NAME, "host_evidence"}:
        raise ValueError("source tree refused")
    names = {p.split("/", 1)[1] for p in SOURCE_ASSET_PATHS if p.startswith("host_evidence/")}
    if set(os.listdir(package)) != names:
        raise ValueError("source package refused")


def _canonical(data):
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True) + "\n"


def _source_manifest_data(folder):
    raw = _source_read(os.path.join(folder, SOURCE_MANIFEST_NAME), SOURCE_MANIFEST_MAX)
    try:
        data = _strict_json(raw.decode("ascii"))
        if _canonical(data).encode("ascii") != raw:
            raise ValueError("noncanonical source manifest")
        return data
    except (UnicodeError, ValueError, RecursionError):
        raise ValueError("source manifest refused") from None


def _source_v2_ok(source):
    if type(source) is not dict or set(source) != {"assets", "schema"} or source.get("schema") != SOURCE_SCHEMA_V2:
        return False
    assets = source.get("assets")
    if type(assets) is not list or len(assets) != len(SOURCE_ASSET_PATHS):
        return False
    total = 0
    for path, record in zip(SOURCE_ASSET_PATHS, assets):
        if type(record) is not dict or set(record) != set(SOURCE_RECORD_KEYS) or record.get("path") != path:
            return False
        size, sha = record.get("bytes"), record.get("sha256")
        if type(size) is not int or not 0 < size <= SOURCE_ASSET_MAX or type(sha) is not str or len(sha) != 64 or not _hex64_ok(sha):
            return False
        total += size
    return total <= SOURCE_AGGREGATE_MAX and assets[-1]["sha256"] == EXPECTED_SECCOMP_SHA256


def source_manifest():
    """Return all verified v2 records or a bounded content-free refusal."""
    try:
        folder = _source_root()
        _source_tree(folder)
        data = _source_manifest_data(folder)
        if not _source_v2_ok(data):
            raise ValueError("source manifest refused")
        for record in data["assets"]:
            raw = _source_asset_read(folder, record["path"], record["bytes"])
            if len(raw) != record["bytes"] or hashlib.sha256(raw).hexdigest() != record["sha256"]:
                raise ValueError("source asset refused")
        _source_tree(folder)
        if _source_manifest_data(folder) != data:
            raise ValueError("source manifest changed")
        return data
    except OSError:
        raise OSError("source tree unavailable") from None


def _context_ok(ctx, run):
    if type(ctx) is not dict or set(ctx) != CONTEXT_KEYS or type(run) is not str or ctx.get("run") != run:
        return False
    if ctx.get("workerImage") != PINNED_IMAGE or ctx.get("profileSha") != EXPECTED_SECCOMP_SHA256:
        return False
    support = ctx.get("supportImage")
    if type(support) is not str or support == PINNED_IMAGE or SUPPORT_PATTERN.fullmatch(support) is None:
        return False
    return _source_v2_ok(ctx.get("source"))
