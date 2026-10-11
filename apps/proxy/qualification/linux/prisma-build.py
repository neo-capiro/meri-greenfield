"""Finite offline Prisma build inputs, cache assembly and generated output evidence.

This module is safe to import. Native generation is a distinct Linux build action;
it never installs packages, resolves dependencies, migrates or connects to a DB.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path, PurePosixPath
import signal
import stat
import subprocess
import sys
import tarfile
import time

FILE_LIMIT = 512 * 1024 * 1024
TOTAL_LIMIT = 5 * 1024 * 1024 * 1024
ENGINE_COMMIT = "ac9d7041ed77bcc8a8dbd2ab6616b39013829574"
TARGETS = ["native", "debian-openssl-1.1.x", "debian-openssl-3.0.x",
           "linux-musl", "linux-musl-openssl-3.0.x"]
QUERY_TARGETS = tuple(TARGETS[1:])  # native resolves to Debian OpenSSL3 here.
CACHE = Path("/opt/prisma/binaries")
APP = Path("/opt/meri-proxy")
VENV = Path("/opt/meri-proxy-venv")


class BuildRefused(ValueError):
    pass


def _pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise BuildRefused("DUPLICATE_JSON_KEY")
        result[key] = value
    return result


def load_pins(path):
    before = hash_file(path, 4 * 1024 * 1024)
    with path.open("rb") as stream:
        raw = stream.read(4 * 1024 * 1024 + 1)
    if len(raw) > 4 * 1024 * 1024 or {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()} != before:
        raise BuildRefused("PINS_BOUND_OR_DRIFT")
    if hash_file(path, 4 * 1024 * 1024) != before:
        raise BuildRefused("PINS_DRIFT")
    def finite(value):
        result = float(value)
        if not math.isfinite(result):
            raise BuildRefused("NONFINITE_JSON")
        return result
    pins = json.loads(raw.decode("utf-8"), object_pairs_hook=_pairs,
                      parse_float=finite,
                      parse_constant=lambda _: (_ for _ in ()).throw(BuildRefused("NONFINITE_JSON")))
    if (type(pins) is not dict or pins.get("schema") != "meri.proxy.linux-assembly/1"
            or pins.get("artifactClosureComplete") is not True or pins.get("artifactHolds") != []
            or pins.get("runtimeAdmitted") is not False
            or pins.get("prisma", {}).get("engineCommit") != ENGINE_COMMIT
            or pins.get("prisma", {}).get("schemaTargets") != TARGETS):
        raise BuildRefused("INCOMPLETE_OR_CHANGED_ASSEMBLY")
    artifacts = pins.get("artifacts")
    if type(artifacts) is not list or not 1 <= len(artifacts) <= 2000:
        raise BuildRefused("ARTIFACT_COUNT")
    names = set()
    total = 0
    for item in artifacts:
        if type(item) is not dict or set(item) != {"path", "bytes", "sha256", "kind"}:
            raise BuildRefused("ARTIFACT_SHAPE")
        name = item["path"]
        if (type(name) is not str or "\\" in name or not name or len(name) > 512
                or PurePosixPath(name).is_absolute() or any(x in ("", ".", "..") for x in name.split("/"))
                or name in names or name.split("/")[0] not in {"wheels", "npm", "engines", "notices"}
                and name != "schema.prisma"):
            raise BuildRefused("ARTIFACT_PATH")
        if (type(item["bytes"]) is not int or not 0 <= item["bytes"] <= FILE_LIMIT
                or type(item["sha256"]) is not str or len(item["sha256"]) != 64
                or any(x not in "0123456789abcdef" for x in item["sha256"])
                or item["kind"] not in {"wheel", "npm", "engine", "notice", "schema"}):
            raise BuildRefused("ARTIFACT_IDENTITY")
        names.add(name)
        total += item["bytes"]
    if total > TOTAL_LIMIT:
        raise BuildRefused("ARTIFACT_TOTAL_BOUND")
    wheels = pins.get("wheels")
    if type(wheels) is not list or len(wheels) != 124:
        raise BuildRefused("WHEEL_SET")
    versions = {r.get("name"): r.get("version") for r in wheels if type(r) is dict}
    if (len(versions) != len(wheels) or "litellm-enterprise" in versions or "pywin32" in versions
            or any(versions.get(k) != v for k, v in {"litellm": "1.104.2",
                "litellm-proxy-extras": "0.4.102.post1", "prisma": "0.11.0"}.items())):
        raise BuildRefused("COMMUNITY_VERSION_BOUNDARY")
    required = {"schema.prisma", "npm/prisma-5.4.2.tgz", "npm/prisma-engines-5.4.2.tgz",
                "engines/query-engine-debian-openssl-3.0.x", "engines/schema-engine-debian-openssl-3.0.x",
                "engines/query-engine.sha256", "engines/query-engine.gz.sha256",
                "engines/schema-engine.sha256", "engines/schema-engine.gz.sha256"}
    if not required <= names:
        raise BuildRefused("MISSING_PRISMA_INPUT")
    if {"wheels/" + r["filename"] for r in wheels} != {x["path"] for x in artifacts if x["kind"] == "wheel"}:
        raise BuildRefused("WHEEL_INVENTORY_MISMATCH")
    query_engine_inputs(pins)
    return pins


def query_engine_inputs(pins):
    """Closed target-to-artifact mapping; never alias native bytes as another ABI."""
    rows = pins.get("prisma", {}).get("queryEngineMappings")
    if type(rows) is not list or len(rows) != len(QUERY_TARGETS):
        raise BuildRefused("QUERY_TARGET_MAPPING")
    artifacts = {row["path"]: row for row in pins["artifacts"]}
    result = {}
    for row in rows:
        if type(row) is not dict or set(row) != {"target", "body", "sha256", "gzipSha256"}:
            raise BuildRefused("QUERY_TARGET_MAPPING")
        target = row["target"]
        if type(target) is not str or target not in QUERY_TARGETS or target in result:
            raise BuildRefused("QUERY_TARGET_MAPPING")
        stem = "engines/" if target == "debian-openssl-3.0.x" else "engines/" + target + "/"
        expected = {"target": target,
                    "body": stem + "query-engine" + ("-" + target if target == "debian-openssl-3.0.x" else ""),
                    "sha256": stem + "query-engine.sha256", "gzipSha256": stem + "query-engine.gz.sha256"}
        if row != expected or any(name not in artifacts or artifacts[name]["kind"] != "engine"
                                  for name in (row["body"], row["sha256"], row["gzipSha256"])):
            raise BuildRefused("QUERY_TARGET_ARTIFACT")
        if artifacts[row["body"]]["bytes"] <= 0 or any(artifacts[row[key]]["bytes"] != 64
                                                      for key in ("sha256", "gzipSha256")):
            raise BuildRefused("QUERY_TARGET_ARTIFACT")
        result[target] = row
    if set(result) != set(QUERY_TARGETS):
        raise BuildRefused("QUERY_TARGET_MAPPING")
    return result


def verify_query_engines(root, pins):
    mappings = query_engine_inputs(pins)
    artifacts = {row["path"]: row for row in pins["artifacts"]}
    for row in mappings.values():
        for key in ("body", "sha256", "gzipSha256"):
            expected = {k: artifacts[row[key]][k] for k in ("bytes", "sha256")}
            if hash_file(root / row[key]) != expected:
                raise BuildRefused("QUERY_TARGET_HASH")
        # gzip checksum text is retained metadata, not verification of a gzip body.
        checksum = (root / row["sha256"]).read_bytes()
        compressed_checksum = (root / row["gzipSha256"]).read_bytes()
        if checksum != artifacts[row["body"]]["sha256"].encode("ascii"):
            raise BuildRefused("QUERY_TARGET_CHECKSUM")
        if len(compressed_checksum) != 64 or any(c not in b"0123456789abcdef" for c in compressed_checksum):
            raise BuildRefused("QUERY_TARGET_CHECKSUM")
    return mappings


def _plain_ancestors(path):
    for parent in [path, *path.parents]:
        info = parent.lstat()
        if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
            raise BuildRefused("REPARSE_OR_SYMLINK")


def hash_file(path, limit=FILE_LIMIT):
    _plain_ancestors(path.parent)
    before = path.lstat()
    if (not stat.S_ISREG(before.st_mode) or before.st_nlink != 1
            or getattr(before, "st_file_attributes", 0) & 0x400 or before.st_size > limit):
        raise BuildRefused("NOT_BOUNDED_PLAIN_FILE")
    h = hashlib.sha256()
    count = 0
    with path.open("rb") as stream:
        opened = os.fstat(stream.fileno())
        if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (
                opened.st_dev, opened.st_ino, opened.st_size, opened.st_mtime_ns):
            raise BuildRefused("OPEN_IDENTITY_CHANGED")
        while True:
            block = stream.read(1024 * 1024)
            if not block:
                break
            count += len(block)
            if count > limit:
                raise BuildRefused("FILE_BOUND")
            h.update(block)
        closed = os.fstat(stream.fileno())
    after = path.lstat()
    identity = lambda s: (s.st_dev, s.st_ino, s.st_mode, s.st_nlink, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
    if identity(before) != identity(after) or identity(opened) != identity(closed) or count != before.st_size:
        raise BuildRefused("READ_DRIFT")
    return {"bytes": count, "sha256": h.hexdigest()}


def verify_artifacts(root, pins):
    _plain_ancestors(root)
    expected = {r["path"]: r for r in pins["artifacts"]}
    actual = set()
    for parent, dirs, files in os.walk(root, followlinks=False):
        for name in dirs:
            _plain_ancestors(Path(parent) / name)
        for name in files:
            path = Path(parent) / name
            relative = path.relative_to(root).as_posix()
            if relative not in expected:
                raise BuildRefused("UNLISTED_ARTIFACT")
            identity = hash_file(path)
            if identity != {k: expected[relative][k] for k in ("bytes", "sha256")}:
                raise BuildRefused("ARTIFACT_HASH_MISMATCH")
            actual.add(relative)
    if actual != set(expected):
        raise BuildRefused("MISSING_ARTIFACT")
    schema = (root / "schema.prisma").read_bytes()
    header = schema.split(b"// Budget", 1)[0].decode("utf-8")
    if not all('"' + target + '"' in header for target in TARGETS):
        raise BuildRefused("SCHEMA_TARGETS_CHANGED")
    verify_query_engines(root, pins)
    return {"artifacts": len(actual), "bytes": sum(r["bytes"] for r in expected.values())}


def _npm_members(archive):
    members = archive.getmembers()
    if len(members) > 100000:
        raise BuildRefused("NPM_MEMBER_COUNT")
    names = set()
    total = 0
    for member in members:
        parts = member.name.split("/")
        if (parts[0] != "package" or any(x in ("", ".", "..") for x in parts)
                or "\\" in member.name or member.name in names
                or not (member.isfile() or member.isdir()) or member.mode & 0o6000
                or member.size > FILE_LIMIT):
            raise BuildRefused("NPM_UNSAFE_MEMBER")
        names.add(member.name)
        total += member.size
    if total > 512 * 1024 * 1024:
        raise BuildRefused("NPM_EXPANSION_BOUND")
    return members


def assemble_engine_cache(root, pins):
    mappings = verify_query_engines(root, pins)
    cache_home = CACHE.parent / ".cache"
    if os.path.lexists(cache_home):
        raise BuildRefused("ENGINE_CACHE_ALREADY_EXISTS")
    # Preserve the native package pair; other platforms are supplied through the
    # exact upstream target cache, then copied by the genuine generator.
    engines = CACHE / "node_modules/@prisma/engines"
    for kind in ("query-engine", "schema-engine"):
        name = kind + "-debian-openssl-3.0.x"
        with (root / "engines" / name).open("rb") as source, (engines / name).open("xb") as sink:
            while block := source.read(1024 * 1024):
                sink.write(block)
        (engines / name).chmod(0o755)
        if hash_file(engines / name) != hash_file(root / "engines" / name):
            raise BuildRefused("COPIED_ENGINE_DRIFT")
    entries = [(target, "query-engine", row) for target, row in mappings.items()]
    entries.append(("debian-openssl-3.0.x", "schema-engine",
                    {"body": "engines/schema-engine-debian-openssl-3.0.x",
                     "sha256": "engines/schema-engine.sha256", "gzipSha256": "engines/schema-engine.gz.sha256"}))
    created = set()
    for target, kind, row in entries:
        target_cache = CACHE.parent / ".cache/prisma/master" / ENGINE_COMMIT / target
        if target not in created:
            target_cache.mkdir(parents=True)
            created.add(target)
        for key, suffix in (("body", ""), ("sha256", ".sha256"), ("gzipSha256", ".gz.sha256")):
            source_path = root / row[key]
            destination = target_cache / (kind + suffix)
            with source_path.open("rb") as source, destination.open("xb") as sink:
                while block := source.read(1024 * 1024):
                    sink.write(block)
            destination.chmod(0o755 if key == "body" else 0o644)
            if hash_file(destination) != hash_file(source_path):
                raise BuildRefused("CACHE_COPY_DRIFT")


def assemble_cache(root, pins):
    if os.path.lexists(CACHE):
        raise BuildRefused("CACHE_ALREADY_EXISTS")
    # Validate BOTH archives fully before creating output. No tar extractall,
    # links, scripts, npm install or package lifecycle hooks are used.
    packages = [("prisma-5.4.2.tgz", "prisma"), ("prisma-engines-5.4.2.tgz", "@prisma/engines")]
    for filename, _ in packages:
        with tarfile.open(root / "npm" / filename, "r:gz") as archive:
            _npm_members(archive)
    CACHE.mkdir(parents=True)
    for filename, target in packages:
        destination = CACHE / "node_modules" / target
        with tarfile.open(root / "npm" / filename, "r:gz") as archive:
            for member in _npm_members(archive):
                suffix = PurePosixPath(member.name).relative_to("package")
                out = destination / suffix
                if member.isdir():
                    out.mkdir(parents=True, exist_ok=True)
                    continue
                out.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(member) as source, out.open("xb") as sink:
                    count = 0
                    while block := source.read(1024 * 1024):
                        count += len(block)
                        if count > member.size:
                            raise BuildRefused("NPM_MEMBER_DRIFT")
                        sink.write(block)
                if count != member.size:
                    raise BuildRefused("NPM_TRUNCATED_MEMBER")
                out.chmod(0o755 if member.mode & 0o111 else 0o644)
    assemble_engine_cache(root, pins)
    (CACHE / "node_modules/.bin").mkdir()
    (CACHE / "node_modules/.bin/prisma").symlink_to("../prisma/build/index.js")


def generate(root, pins):
    if sys.platform != "linux" or sys.version_info[:2] != (3, 13) or Path(sys.prefix) != VENV:
        raise BuildRefused("LINUX_BUILD_VENV_REQUIRED")
    before = verify_artifacts(root, pins)
    assemble_cache(root, pins)
    schema = APP / "schema.prisma"
    with schema.open("xb") as out:
        out.write((root / "schema.prisma").read_bytes())
    env = {"PATH": "/opt/meri-proxy-venv/bin:/usr/local/bin:/usr/bin:/bin",
           "HOME": "/opt/prisma", "TMPDIR": "/tmp", "PYTHONDONTWRITEBYTECODE": "1",
           "PRISMA_BINARY_CACHE_DIR": str(CACHE), "PRISMA_CLI_QUERY_ENGINE_TYPE": "binary",
           "PRISMA_USE_GLOBAL_NODE": "true", "PRISMA_USE_NODEJS_BIN": "false",
           "PRISMA_GENERATE_SKIP_AUTOINSTALL": "true", "PRISMA_HIDE_UPDATE_MESSAGE": "true",
           "CHECKPOINT_DISABLE": "1", "npm_config_offline": "true", "npm_config_update_notifier": "false",
           "DATABASE_URL": "postgresql://generation:inert@127.0.0.1:1/generation"}
    command = ["/usr/local/bin/node", str(CACHE / "node_modules/prisma/build/index.js"),
               "generate", "--schema", str(schema)]
    started = time.monotonic()
    timed_out = False
    stdout_path = APP / "prisma-generate.stdout.bin"
    stderr_path = APP / "prisma-generate.stderr.bin"
    # Redirection avoids unbounded PIPE memory. Files have a post-completion
    # bound; the outer build also needs a disk/deadline bound.
    with stdout_path.open("xb") as stdout, stderr_path.open("xb") as stderr:
        child = subprocess.Popen(command, env=env, cwd=APP, stdin=subprocess.DEVNULL,
                                 stdout=stdout, stderr=stderr, start_new_session=True)
        try:
            child.wait(timeout=240)
        except BaseException:
            timed_out = True
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            child.wait(timeout=5)
    if timed_out or child.returncode != 0 or stdout_path.stat().st_size + stderr_path.stat().st_size > 16 * 1024 * 1024:
        raise BuildRefused("GENERATION_FAILED_OR_BOUND")
    if verify_artifacts(root, pins) != before:
        raise BuildRefused("BUILD_INPUT_DRIFT")
    # This is genuine generated-client inspection inside the later owner build.
    from prisma.client import BINARY_PATHS, Prisma
    paths = BINARY_PATHS.query_engine
    engine_bytes = validate_generated_engines(paths, pins)
    records = []
    package = VENV / "lib/python3.13/site-packages/prisma"
    for path in sorted(package.rglob("*")):
        if path.is_file():
            records.append({"path": path.relative_to(VENV).as_posix(), **hash_file(path)})
    if not records or len(records) > 10000:
        raise BuildRefused("GENERATED_INVENTORY_BOUND")
    return {"status": "GENERATED_BUILD_OBSERVATION_NOT_RUNTIME_ADMITTED", "seconds": time.monotonic() - started,
            "input": before, "clientClassPresent": isinstance(Prisma, type), "BINARY_PATHS": paths,
            "files": records, "engineBytes": engine_bytes}


def validate_generated_engines(paths, pins):
    mappings = query_engine_inputs(pins)
    if type(paths) is not dict or set(paths) != set(QUERY_TARGETS):
        raise BuildRefused("UNQUALIFIED_GENERATED_TARGETS")
    artifacts = {row["path"]: row for row in pins["artifacts"]}
    result = {}
    for target, raw in paths.items():
        expected_path = CACHE / "node_modules/prisma" / ("query-engine-" + target)
        if type(raw) is not str or raw != str(expected_path):
            raise BuildRefused("GENERATED_ENGINE_PATHS")
        observed = hash_file(expected_path)
        artifact = artifacts[mappings[target]["body"]]
        if observed != {key: artifact[key] for key in ("bytes", "sha256")}:
            raise BuildRefused("GENERATED_ENGINE_NOT_PINNED")
        result[target] = observed
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("verify", "generate"))
    parser.add_argument("--pins", type=Path, default=Path(__file__).parent / "assembly-pins.json")
    parser.add_argument("--artifacts", type=Path, default=APP / "artifacts")
    args = parser.parse_args(argv)
    try:
        pins = load_pins(args.pins)
        result = verify_artifacts(args.artifacts, pins) if args.action == "verify" else generate(args.artifacts, pins)
        print(json.dumps(result, sort_keys=True))
        return 0
    except Exception as error:
        print(json.dumps({"status": "BUILD_REFUSED", "errorType": type(error).__name__, "reason": str(error)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
