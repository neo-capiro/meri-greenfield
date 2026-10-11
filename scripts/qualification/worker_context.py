"""Exclusive fixed-source worker build context. No build or runtime dispatch."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
QUALIFICATION = "apps/worker/qualification/"
PACKAGE_FILES = (
    ".dockerignore", "Dockerfile", "README.md", "package.json", "package-lock.json",
    "requirements.lock.txt", "component-pins.json", "sdk-options.mjs",
    "vendor/capiro-meri-contracts-0.1.0.tgz", "checkpoint/native-session-files.mjs",
    "checkpoint/fixture-channel.mjs", "checkpoint/fixture-channel.test.mjs",
    "checkpoint/fixture-transport.mjs", "checkpoint/fixture-transport.test.mjs",
    "checkpoint/resume-admission.mjs", "checkpoint/resume-admission.test.mjs",
    "checkpoint/fixture-sentinel.mjs", "checkpoint/fixture-sentinel.test.mjs",
    "probes/artifacts.mjs", "probes/artifacts.py", "probes/browser.mjs",
    "probes/image-inventory.py", "probes/image-inventory.test.mjs",
    "probes/office-export.mjs", "probes/office-export.test.mjs", "probes/office-reconstruct.mjs",
    "probes/runtime.mjs", "probes/sdk-capture.mjs", "probes/sdk-capture.test.mjs",
    "probes/native-observations.mjs", "probes/native-stream-observer.mjs",
    "probes/native-namespace-observer.mjs",
    "probes/sdk-capture-options.mjs", "probes/sdk-discovery-options.mjs",
    "probes/sdk-discovery-options.test.mjs", "probes/sdk-discovery-tools.mjs",
    "probes/sdk-discovery-tools.test.mjs", "probes/sdk-interruption.mjs",
    "probes/sdk-interruption.test.mjs", "probes/sdk-interruption-options.mjs",
    "probes/sdk-interruption-loopback.mjs", "probes/sdk-interruption-loopback.test.mjs",
    "probes/static.test.mjs",
)
MEMBERS = tuple((QUALIFICATION + p, p) for p in PACKAGE_FILES) + (
    ("scripts/sdk-capture/json-records.mjs", "build-dependencies/sdk-capture/json-records.mjs"),
    ("scripts/sdk-capture/protocol.mjs", "build-dependencies/sdk-capture/protocol.mjs"),
    ("packages/contracts/validate.mjs", "build-dependencies/contracts/validate.mjs"),
    ("packages/contracts/meri.schema.json", "build-dependencies/contracts/meri.schema.json"),
    ("packages/contracts/qualification-sdk/validate.mjs", "build-dependencies/contracts/qualification-sdk/validate.mjs"),
    ("packages/contracts/qualification-sdk/wire.mjs", "build-dependencies/contracts/qualification-sdk/wire.mjs"),
    ("packages/contracts/qualification-sdk/fixture.schema.json", "build-dependencies/contracts/qualification-sdk/fixture.schema.json"),
    ("packages/contracts/qualification-sdk/native-evidence.mjs", "build-dependencies/contracts/qualification-sdk/native-evidence.mjs"),
    ("packages/contracts/qualification-sdk/native-evidence.schema.json", "build-dependencies/contracts/qualification-sdk/native-evidence.schema.json"),
    ("packages/contracts/test/sdk-fixture-wire.test.mjs", "build-dependencies/contracts/test/sdk-fixture-wire.test.mjs"),
)
MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_TOTAL_BYTES = 8 * 1024 * 1024
DEADLINE_SECONDS = 30
CHUNK_BYTES = 64 * 1024


def _check_deadline(deadline):
    if time.monotonic() >= deadline:
        raise ValueError("context deadline")


def _identity(st):
    return (st.st_dev, st.st_ino, st.st_mode, st.st_nlink, st.st_size,
            st.st_mtime_ns, st.st_ctime_ns)


def _plain(path, directory=False):
    st = path.lstat()
    if stat.S_ISLNK(st.st_mode) or getattr(st, "st_file_attributes", 0) & 0x400:
        raise ValueError("linked context path")
    if directory:
        if not stat.S_ISDIR(st.st_mode):
            raise ValueError("context directory required")
    elif not stat.S_ISREG(st.st_mode) or st.st_nlink != 1:
        raise ValueError("single regular context file required")
    return st


def _ancestors(path):
    for parent in reversed((path,) + tuple(path.parents)):
        _plain(parent, directory=True)


def _read(path, deadline):
    _check_deadline(deadline)
    _ancestors(path.parent)
    before = _plain(path)
    if before.st_size > MAX_FILE_BYTES:
        raise ValueError("context file bound")
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags)
    try:
        opened = os.fstat(fd)
        # Windows lstat/fstat permission bits can differ; each API stays bound
        # independently. The opened object must still be the same regular inode.
        if (opened.st_dev, opened.st_ino, opened.st_size, opened.st_nlink) != (
                before.st_dev, before.st_ino, before.st_size, before.st_nlink):
            raise ValueError("context open identity")
        if not stat.S_ISREG(opened.st_mode):
            raise ValueError("context opened type")
        chunks, size = [], 0
        while True:
            _check_deadline(deadline)
            chunk = os.read(fd, CHUNK_BYTES)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_FILE_BYTES or size > before.st_size:
                raise ValueError("context read bound")
            chunks.append(chunk)
        if size != before.st_size or _identity(os.fstat(fd)) != _identity(opened):
            raise ValueError("context file changed")
    finally:
        os.close(fd)
    if _identity(_plain(path)) != _identity(before):
        raise ValueError("context path changed")
    _ancestors(path.parent)
    return b"".join(chunks), _identity(before)


def _write_new(path, raw, deadline):
    _check_deadline(deadline)
    _ancestors(path.parent)
    with path.open("xb") as handle:
        handle.write(raw)
        handle.flush()
        os.fsync(handle.fileno())


def _directories():
    result = set()
    for _, member in MEMBERS:
        result.update(str(p).replace("\\", "/") for p in Path(member).parents if str(p) != ".")
    return result


def _verify(output, manifest, deadline):
    if set(manifest) != {"schemaVersion", "status", "commitAuthority", "members", "totalBytes"}:
        raise ValueError("context manifest fields")
    if type(manifest["schemaVersion"]) is not int or manifest["schemaVersion"] != 1 or manifest["status"] != "SOURCE_ONLY" or manifest["commitAuthority"] is not False:
        raise ValueError("context manifest profile")
    rows = manifest["members"]
    if not isinstance(rows, list) or len(rows) != len(MEMBERS):
        raise ValueError("context manifest members")
    context = output / "context"
    _ancestors(context)
    actual_files, actual_dirs = set(), set()
    for base, dirs, files in os.walk(context, followlinks=False):
        _check_deadline(deadline)
        _plain(Path(base), directory=True)
        for name in dirs:
            path = Path(base) / name
            _plain(path, directory=True)
            actual_dirs.add(path.relative_to(context).as_posix())
        for name in files:
            path = Path(base) / name
            _plain(path)
            actual_files.add(path.relative_to(context).as_posix())
        if len(actual_files) > len(MEMBERS) or len(actual_dirs) > len(_directories()):
            raise ValueError("context membership bound")
    if actual_files != {m for _, m in MEMBERS} or actual_dirs != _directories():
        raise ValueError("context exact membership")
    total, identities = 0, []
    for row, (source, member) in zip(rows, MEMBERS):
        if set(row) != {"sourcePath", "contextPath", "bytes", "sha256"} or row["sourcePath"] != source or row["contextPath"] != member:
            raise ValueError("context row identity")
        if type(row["bytes"]) is not int or not 0 <= row["bytes"] <= MAX_FILE_BYTES:
            raise ValueError("context row bytes")
        source_raw, source_identity = _read(ROOT / source, deadline)
        context_raw, context_identity = _read(context / member, deadline)
        identities.extend(((ROOT / source, source_identity), (context / member, context_identity)))
        if source_raw != context_raw or len(source_raw) != row["bytes"] or hashlib.sha256(source_raw).hexdigest() != row["sha256"]:
            raise ValueError("context byte drift")
        total += len(source_raw)
    if type(manifest["totalBytes"]) is not int or total != manifest["totalBytes"] or total > MAX_TOTAL_BYTES:
        raise ValueError("context aggregate bound")
    for path, identity in identities:
        _check_deadline(deadline)
        if _identity(_plain(path)) != identity:
            raise ValueError("context final identity drift")
        _ancestors(path.parent)


def verify_context(output):
    """Recheck all fixed source and context bytes; no commit/authentication claim."""
    deadline = time.monotonic() + DEADLINE_SECONDS
    output = Path(output)
    _ancestors(output)
    if {p.name for p in output.iterdir()} != {"context", "manifest.json"}:
        raise ValueError("context output membership")
    raw, _ = _read(output / "manifest.json", deadline)
    manifest = json.loads(raw.decode("utf-8"))
    # Only assembler-produced canonical bytes are accepted, including key order.
    if raw != _json_bytes(manifest):
        raise ValueError("context manifest serialization")
    _verify(output, manifest, deadline)
    return manifest


def _json_bytes(value):
    return (json.dumps(value, ensure_ascii=True, separators=(",", ":")) + "\n").encode("ascii")


def assemble_context(output):
    """Read and validate first, then exclusively create a retained output."""
    deadline = time.monotonic() + DEADLINE_SECONDS
    output = Path(output)
    if not output.is_absolute() or ".." in output.parts:
        raise ValueError("absolute fresh context output required")
    _ancestors(output.parent)
    if output.exists() or output.is_symlink():
        raise FileExistsError("context output already exists")
    raw_members, rows, identities, total = [], [], [], 0
    for source, member in MEMBERS:
        raw, identity = _read(ROOT / source, deadline)
        total += len(raw)
        if total > MAX_TOTAL_BYTES:
            raise ValueError("context aggregate bound")
        raw_members.append((member, raw))
        identities.append((source, identity))
        rows.append({"sourcePath": source, "contextPath": member, "bytes": len(raw),
                     "sha256": hashlib.sha256(raw).hexdigest()})
    _check_deadline(deadline)
    output.mkdir()  # No overwrite, repair, recursive removal or retry.
    context = output / "context"
    context.mkdir()
    for directory in sorted(_directories(), key=lambda p: (p.count("/"), p)):
        (context / directory).mkdir()
    for member, raw in raw_members:
        _write_new(context / member, raw, deadline)
    for source, identity in identities:
        if _identity(_plain(ROOT / source)) != identity:
            raise ValueError("context source identity drift")
    manifest = {"schemaVersion": 1, "status": "SOURCE_ONLY", "commitAuthority": False,
                "members": rows, "totalBytes": total}
    _verify(output, manifest, deadline)
    _write_new(output / "manifest.json", _json_bytes(manifest), deadline)
    _verify(output, manifest, deadline)
    _check_deadline(deadline)
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument("--output", required=True, help="fresh absolute output directory; parent must exist")
    args = parser.parse_args(argv)
    try:
        result = assemble_context(args.output)
    except (OSError, ValueError):
        print("worker context refused; any exclusive partial output remains", file=sys.stderr)
        return 1
    print(json.dumps({"status": result["status"], "members": len(result["members"]), "totalBytes": result["totalBytes"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
