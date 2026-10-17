"""Inert, source-verified read-only mounts for the fixed product Linux tests.

The caller must first verify the complete source archive and manifest, then
extract that archive into a private directory. This module performs no work on
import and never obtains registry or cloud credentials.
"""

import hashlib
import json
import math
import os
from pathlib import Path
import re
import stat


FIXTURE_PATHS = (
    "apps/control/conversations/test/application-fixture.mjs",
    "apps/control/conversations/test/initial-input-fixture.mjs",
    "apps/control/conversations/test/store-fixture.mjs",
    "apps/gateway/test/fixtures.mjs",
    "apps/runtime/native-authority/test/fixture.mjs",
    "apps/runtime/test/prepared-candidate-bootstrap.test.mjs",
    "apps/runtime/test/prepared-candidate-fixture.mjs",
    "apps/runtime/test/remote-conversation-runner.test.mjs",
    "apps/worker/conversation/continuation/test/fixtures.mjs",
    "apps/runtime/temporal-product-token-writer.test.mjs",
)

_REFUSED = "PRODUCT_IMAGE_LINUX_FIXTURE_UNPROVEN"
_PRESENT = b'{"schemaVersion":1,"status":"PRESENT","count":10}\n'
_IMAGE = re.compile(
    r"967807252336\.dkr\.ecr\.us-east-1\.amazonaws\.com/[a-z0-9._/-]+:product-[a-f0-9]{40}-[a-f0-9]{32}\Z"
)
_SHA = re.compile(r"[a-f0-9]{64}\Z")
_PREFLIGHT = """import fs from 'node:fs';
import {createHash} from 'node:crypto';
let expected;
try { expected=JSON.parse(process.argv[1]); } catch { process.exit(2); }
if (!Array.isArray(expected)||expected.length!==10) process.exit(2);
for (const row of expected) {
  try {
    const name='/opt/meri/'+row.path;
    const st=fs.lstatSync(name);
    if (!st.isFile()||st.isSymbolicLink()||st.size!==row.bytes) process.exit(2);
    const bytes=fs.readFileSync(name);
    if (bytes.length!==row.bytes||createHash('sha256').update(bytes).digest('hex')!==row.sha256) process.exit(2);
  } catch { process.exit(2); }
}
process.stdout.write('{"schemaVersion":1,"status":"PRESENT","count":10}\\n');
"""


def _deny():
    raise ValueError(_REFUSED)


def _pair(argv, flag, value):
    return argv.count(flag) == 1 and argv[argv.index(flag) + 1] == value


def _checked_sandbox(sandbox):
    if (type(sandbox) is not list or any(type(part) is not str for part in sandbox)):
        _deny()
    if len(sandbox) < 20 or sandbox[0] != "docker" or not _IMAGE.fullmatch(sandbox[-1]):
        _deny()
    if sandbox[-3:-1] != ["--entrypoint", "/usr/local/bin/node"]:
        _deny()
    for flag in ("--rm", "--init", "--read-only"):
        if sandbox.count(flag) != 1:
            _deny()
    for flag, value in (
        ("--network", "none"), ("--cap-drop", "ALL"),
        ("--security-opt", "no-new-privileges"),
        ("--pids-limit", "128"), ("--memory", "2g"),
        ("--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=128m"),
    ):
        if not _pair(sandbox, flag, value):
            _deny()
    if any(option in sandbox for option in ("--mount", "--volume", "-v", "--privileged")):
        _deny()


def _checked_source(context, members, path):
    row = members.get(path)
    if (type(row) is not dict or set(row) != {"path", "sha256", "bytes", "mode"}
            or row["path"] != path or row["mode"] != "100644"
            or type(row["bytes"]) is not int or not 0 < row["bytes"] <= 256 * 1024
            or type(row["sha256"]) is not str or not _SHA.fullmatch(row["sha256"])):
        _deny()
    source = context.joinpath(*path.split("/"))
    parent = context
    for part in path.split("/")[:-1]:
        parent = parent / part
        info = parent.lstat()
        if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode):
            _deny()
    info = source.lstat()
    if (not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode)
            or info.st_mode & 0o111 or not info.st_mode & 0o444
            or info.st_size != row["bytes"]):
        _deny()
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_BINARY", 0)
    descriptor = os.open(source, flags)
    try:
        opened = os.fstat(descriptor)
        if (not stat.S_ISREG(opened.st_mode) or opened.st_size != row["bytes"]
                or (opened.st_dev, opened.st_ino) != (info.st_dev, info.st_ino)):
            _deny()
        with os.fdopen(os.dup(descriptor), "rb") as stream:
            payload = stream.read(256 * 1024 + 1)
        after = os.fstat(descriptor)
    finally:
        os.close(descriptor)
    latest = source.lstat()
    if (len(payload) != row["bytes"] or hashlib.sha256(payload).hexdigest() != row["sha256"]
            or (after.st_dev, after.st_ino, after.st_size) != (opened.st_dev, opened.st_ino, opened.st_size)
            or (latest.st_dev, latest.st_ino, latest.st_size) != (opened.st_dev, opened.st_ino, opened.st_size)
            or stat.S_ISLNK(latest.st_mode)):
        _deny()
    return source, {"path": path, "sha256": row["sha256"], "bytes": row["bytes"]}


def prepare_fixture_sandbox(sandbox, context, members, bounded_command, timeout, report):
    """Return exact read-only test mounts after a bounded in-image hash preflight.

    ``members`` is the path-to-row map from the already verified manifest.
    No production module, directory, credential, or socket is mounted.
    """
    try:
        _checked_sandbox(sandbox)
        if (type(members) is not dict or not callable(bounded_command)
                or type(timeout) not in (int, float) or not math.isfinite(timeout)
                or timeout <= 0 or report is not None and not callable(report)):
            _deny()
        root = Path(context)
        if not root.is_absolute() or root.is_symlink() or not root.is_dir():
            _deny()
        expected = []
        mounted = sandbox[:-1].copy()
        for path in FIXTURE_PATHS:
            source, row = _checked_source(root, members, path)
            if source.resolve(strict=True) != root.resolve(strict=True).joinpath(*path.split("/")):
                _deny()
            address = str(source)
            if any(char in address for char in (",", "\n", "\r", "\x00")):
                _deny()
            mounted += ["--mount", "type=bind,src=" + address + ",dst=/opt/meri/" + path + ",readonly"]
            expected.append(row)
        mounted.append(sandbox[-1])
        code, output = bounded_command(
            mounted + ["--input-type=module", "-e", _PREFLIGHT,
                       json.dumps(expected, sort_keys=True, separators=(",", ":"))],
            timeout=min(30, timeout), report=report,
        )
        if type(code) is not int or code != 0 or type(output) is not bytes or output != _PRESENT:
            _deny()
        return mounted
    except Exception:
        raise ValueError(_REFUSED) from None
