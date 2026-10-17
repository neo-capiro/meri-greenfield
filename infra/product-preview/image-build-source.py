"""Offline sealed product source creation and verification.

This module never uses Docker, AWS, credentials, or the network.
Errors deliberately exclude subprocess output, environment and credential values.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import tempfile
import threading
import time
import zipfile

SHA = re.compile(r"[a-f0-9]{64}\Z")
COMMIT = re.compile(r"[a-f0-9]{40}\Z")
RUNNER = "apps/runtime/conversation-runner.mjs"
VERIFIER = "infra/product-preview/image-build-source.py"
PRODUCER = "infra/product-preview/image-build-producer.py"
CONTRACT = "meri.runner-entrypoint.v1"


def need(ok, code):
    if not ok:
        raise ValueError("PRODUCT_IMAGE_" + code)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def file_sha(path, maximum):
    need(path.stat().st_size <= maximum, "FILE_BOUND")
    digest, total = hashlib.sha256(), 0
    with path.open("rb") as stream:
        while True:
            block = stream.read(1024**2)
            if not block:
                break
            total += len(block)
            need(total <= maximum, "FILE_BOUND")
            digest.update(block)
    return digest.hexdigest()


def exact(value, keys):
    need(type(value) is dict and set(value) == set(keys), "SHAPE_REFUSED")
    return value


def pairs(rows):
    result = {}
    for key, value in rows:
        need(key not in result, "DUPLICATE_KEY")
        result[key] = value
    return result


def decode(data):
    return json.loads(data, object_pairs_hook=pairs)


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def safe_path(value):
    need(type(value) is str and value and not re.search(r"[\\\x00-\x1f\x7f:]", value), "MEMBER_PATH")
    need(not value.startswith("/") and all(p not in ("", ".", "..") for p in value.split("/")), "MEMBER_PATH")
    need(str(PurePosixPath(value)) == value and value.isascii(), "MEMBER_PATH")
    return value


def archive_members(archive):
    need(archive.stat().st_size <= 1024**3, "ARCHIVE_BOUND")
    result = {}
    with zipfile.ZipFile(archive) as source:
        rows = source.infolist()
        need(0 < len(rows) <= 50000 and sum(row.file_size for row in rows) <= 2 * 1024**3, "ARCHIVE_BOUND")
        seen = set()
        for row in rows:
            path = safe_path(row.filename.rstrip("/") if row.is_dir() else row.filename)
            need(path.casefold() not in seen, "DUPLICATE_MEMBER")
            seen.add(path.casefold())
            mode = row.external_attr >> 16
            need(not row.flag_bits & 1 and not stat.S_ISLNK(mode), "MEMBER_TYPE")
            if row.is_dir():
                need(stat.S_IFMT(mode) in (0, stat.S_IFDIR), "MEMBER_TYPE")
                continue
            need(stat.S_IFMT(mode) in (0, stat.S_IFREG) and row.file_size <= 128 * 1024**2, "MEMBER_TYPE")
            need(not any(p in (".git", "node_modules", ".aws", ".codex", ".agents") for p in path.split("/")), "PRIVATE_MEMBER")
            need(not any(p.startswith(".env") or p == "credentials" for p in path.split("/")) and not path.endswith((".key", ".pem")), "PRIVATE_MEMBER")
            payload = source.read(row)
            result[path] = {"path": path, "sha256": sha(payload), "bytes": len(payload), "mode": "100755" if mode & 0o111 else "100644"}
    need(all(not any(str(ancestor) in result for ancestor in list(PurePosixPath(path).parents)[:-1]) for path in result), "MEMBER_ANCESTOR")
    return result


class ScanNotFoundPending(ValueError):
    """Private static signal; raw CLI errors never cross the command boundary."""
    def __init__(self):
        super().__init__("PRODUCT_IMAGE_SCAN_INCOMPLETE")


def _scan_read_command(args):
    return (type(args) is list and len(args) == 12 and
            args[:7] == ["aws", "--region", "us-east-1", "--no-cli-pager", "ecr", "describe-image-scan-findings", "--repository-name"] and
            type(args[7]) is str and re.fullmatch(r"[a-z0-9][a-z0-9._/-]*", args[7]) is not None and
            args[8] == "--image-id" and type(args[9]) is str and
            re.fullmatch(r"imageDigest=sha256:[a-f0-9]{64}", args[9]) is not None and
            args[10:] == ["--output", "json"])


def bounded_command(args, timeout=30, input_bytes=None, report=None, scan_not_found=False):
    """Drain both pipes while running; abort before combined output exceeds 16 MiB.

    Failed command bytes and stderr are never returned or logged. This applies to
    long Docker builds and short cleanup probes alike.
    """
    need(type(timeout) in (int, float) and 0 < timeout <= 1600, "COMMAND_BOUND")
    need(input_bytes is None or type(input_bytes) is bytes and len(input_bytes) <= 16384, "COMMAND_BOUND")
    need(type(scan_not_found) is bool and (not scan_not_found or _scan_read_command(args)), "COMMAND_BOUND")
    process, started = None, time.monotonic()
    def mark(status, exit_code=None, output_bytes=0):
        if report is not None:
            report({"status": status, "exitCode": exit_code if type(exit_code) is int and -255 <= exit_code <= 255 else None,
                    "outputBytes": min(max(0, output_bytes), 17 * 1024**2),
                    "elapsedMs": min(max(0, int((time.monotonic() - started) * 1000)), 1600000)})
    try:
        process = subprocess.Popen(args, stdin=subprocess.PIPE if input_bytes is not None else subprocess.DEVNULL,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        chunks, errors, state, guard = [], bytearray(), {"bytes": 0, "overflow": False, "writeFailed": False, "errorBytes": 0}, threading.Lock()

        def drain(stream, capture):
            while True:
                block = stream.read(65536)
                if not block:
                    return
                with guard:
                    state["bytes"] += len(block)
                    if state["bytes"] > 16 * 1024**2:
                        state["overflow"] = True
                        try:
                            process.kill()
                        except OSError:
                            pass
                    elif capture:
                        chunks.append(block)
                    elif scan_not_found:
                        state["errorBytes"] += len(block)
                        if state["errorBytes"] <= 4096:
                            errors.extend(block)

        def write_input():
            try:
                process.stdin.write(input_bytes)
                process.stdin.close()
            except OSError:
                state["writeFailed"] = True

        readers = [threading.Thread(target=drain, args=(process.stdout, True), daemon=True),
                   threading.Thread(target=drain, args=(process.stderr, False), daemon=True)]
        for reader in readers:
            reader.start()
        writer = threading.Thread(target=write_input, daemon=True) if input_bytes is not None else None
        if writer is not None:
            writer.start()
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
            mark("TIMEOUT", output_bytes=state["bytes"])
            raise ValueError("PRODUCT_IMAGE_COMMAND_UNAVAILABLE_OR_TIMEOUT") from None
        for reader in readers:
            reader.join(timeout=5)
        if writer is not None:
            writer.join(timeout=5)
        bounded = not any(reader.is_alive() for reader in readers) and (writer is None or not writer.is_alive()) and not state["overflow"] and not state["writeFailed"]
        if not bounded:
            mark("BOUND", process.returncode, state["bytes"])
        need(bounded, "COMMAND_BOUND")
        if process.returncode != 0:
            # AWS CLI v2's service-error exit plus its complete single-line
            # envelope is recognized only for the exact digest-bound scan read.
            # Oversized, mixed, unrelated and malformed errors remain fatal.
            if (scan_not_found and process.returncode == 254 and not chunks and
                    0 < state["errorBytes"] <= 4096 and
                    re.fullmatch(rb"\r?\n?An error occurred \(ScanNotFoundException\) when calling the DescribeImageScanFindings operation: [^\r\n]*\r?\n?", errors)):
                raise ScanNotFoundPending() from None
            mark("EXIT_NONZERO", process.returncode, state["bytes"])
        return process.returncode, b"".join(chunks)
    except OSError:
        mark("UNAVAILABLE")
        raise ValueError("PRODUCT_IMAGE_COMMAND_UNAVAILABLE_OR_TIMEOUT") from None
    finally:
        if process is not None:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=5)
            for stream in (process.stdin, process.stdout, process.stderr):
                if stream is not None:
                    try:
                        stream.close()
                    except OSError:
                        pass


def run(args, timeout=30, input_bytes=None, report=None, scan_not_found=False):
    # Never return/log a failed command's output (Docker/AWS may contain secrets).
    code, stdout = bounded_command(args, timeout=timeout, input_bytes=input_bytes, report=report, scan_not_found=scan_not_found)
    need(code == 0, "COMMAND_FAILED")
    return stdout


def seal(repository, commit, archive, output):
    need(COMMIT.fullmatch(commit) and not archive.exists() and not output.exists(), "SEAL_INPUT")
    actual = run(["git", "-C", str(repository), "rev-parse", commit + "^{commit}"]).decode().strip()
    need(actual == commit, "SOURCE_COMMIT")
    tree = run(["git", "-C", str(repository), "ls-tree", "-rlz", "--full-tree", commit])
    objects, total = {}, 0
    for row in tree.split(b"\0"):
        if not row:
            continue
        header, path_bytes = row.split(b"\t", 1)
        mode, kind, oid, size = header.decode().split()
        path = safe_path(path_bytes.decode("utf-8"))
        need(kind == "blob" and mode in ("100644", "100755") and COMMIT.fullmatch(oid) and
             size.isdecimal() and int(size) <= 128 * 1024**2, "GIT_MEMBER_TYPE")
        total += int(size)
        need(len(objects) < 50000 and total <= 1024**3 - 16 * 1024**2, "GIT_SOURCE_BOUND")
        objects[path] = (mode, oid)
    # Git for Windows omits ZIP Unix modes and may apply core.autocrlf. Verify
    # blob bytes, then author portable ZIP modes from the authoritative Git tree.
    with tempfile.TemporaryDirectory(prefix="meri-source-seal-", dir=archive.parent) as temporary:
        raw = Path(temporary) / "git.zip"
        run(["git", "-C", str(repository), "-c", "core.autocrlf=false", "-c", "core.eol=lf", "archive", "--format=zip", "--output=" + str(raw.resolve()), commit], timeout=120)
        members = archive_members(raw)
        need(set(members) == set(objects), "GIT_MEMBER_SET")
        with zipfile.ZipFile(raw) as source, zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED) as target:
            for path in sorted(objects):
                mode, oid = objects[path]
                payload = source.read(path)
                git_hash = hashlib.sha1(b"blob " + str(len(payload)).encode() + b"\0" + payload).hexdigest()
                need(git_hash == oid, "GIT_MEMBER_BYTES")
                row = zipfile.ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
                row.create_system = 3
                row.external_attr = int(mode, 8) << 16
                row.compress_type = zipfile.ZIP_DEFLATED
                target.writestr(row, payload)
                members[path]["mode"] = mode
            target.comment = commit.encode("ascii")
    manifest = {"contract": "meri.source-members.v1", "sourceCommit": commit, "files": [members[p] for p in sorted(members)]}
    with output.open("xb") as target:
        target.write(encoded(manifest))
    return {"status": "SEALED_SOURCE_ONLY", "sourceCommit": commit, "archiveSha256": file_sha(archive, 1024**3), "sourceManifestSha256": file_sha(output, 32*1024**2), "fileCount": len(members)}


def verify(archive, manifest_path, pin):
    need(file_sha(archive, 1024**3) == pin["archive"]["sha256"], "ARCHIVE_SHA_MISMATCH")
    need(manifest_path.stat().st_size <= 32*1024**2, "MANIFEST_BOUND")
    manifest_bytes = manifest_path.read_bytes()
    need(sha(manifest_bytes) == pin["manifest"]["sha256"], "MANIFEST_SHA_MISMATCH")
    manifest = exact(decode(manifest_bytes), ["contract", "sourceCommit", "files"])
    need(manifest["contract"] == "meri.source-members.v1" and manifest["sourceCommit"] == pin["sourceCommit"], "SOURCE_COMMIT")
    rows = manifest["files"]
    need(type(rows) is list and 0 < len(rows) <= 50000, "MANIFEST_SHAPE")
    expected = {}
    for row in rows:
        exact(row, ["path", "sha256", "bytes", "mode"])
        path = safe_path(row["path"])
        need(path not in expected and SHA.fullmatch(row["sha256"]) and type(row["bytes"]) is int and row["bytes"] >= 0 and row["mode"] in ("100644", "100755"), "MANIFEST_SHAPE")
        expected[path] = row
    need(list(expected) == sorted(expected), "MANIFEST_ORDER")
    measured = archive_members(archive)
    need(measured == expected, "SOURCE_MEMBERS_MISMATCH")
    for path, digest in [("apps/runtime/Dockerfile", pin["dockerfileSha256"]), (RUNNER, pin["runnerSha256"]), (VERIFIER, pin["verifierSha256"]), (PRODUCER, pin["producerSha256"])]:
        need(path in measured and measured[path]["sha256"] == digest, "SOURCE_PIN_MISMATCH")
    need(0 < measured[RUNNER]["bytes"] <= 1024**2, "RUNNER_BOUND")
    return {"status": "VERIFIED_SOURCE_ONLY", "sourceCommit": pin["sourceCommit"], "archiveSha256": pin["archive"]["sha256"], "sourceManifestSha256": pin["manifest"]["sha256"], "fileCount": len(measured), "runnerBytes": measured[RUNNER]["bytes"]}


def validate_request(value):
    p = exact(value, ["sourceCommit", "archive", "manifest", "dockerfileSha256", "nodeImageUri", "nodeVersion", "runnerSha256", "runtimeUser", "codeBuildProjectArn", "ecrRepositoryUri", "imageTag", "verifierSha256", "producerSha256"])
    need(COMMIT.fullmatch(p["sourceCommit"]), "REQUEST_PIN")
    for key in ["dockerfileSha256", "runnerSha256", "verifierSha256", "producerSha256"]:
        need(type(p[key]) is str and SHA.fullmatch(p[key]), "REQUEST_PIN")
    for key in ["archive", "manifest"]:
        item = exact(p[key], ["bucket", "key", "versionId", "sha256"])
        need(re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", item["bucket"]) and SHA.fullmatch(item["sha256"]), "REQUEST_OBJECT")
        need(all(type(item[k]) is str and 0 < len(item[k]) <= 1024 and not re.search(r"[\x00-\x20\x7f]", item[k]) for k in ["key", "versionId"]), "REQUEST_OBJECT")
        need(item["versionId"] != "null" and not item["key"].startswith("-"), "REQUEST_OBJECT")
    need(re.fullmatch(r"public\.ecr\.aws/docker/library/node@sha256:[a-f0-9]{64}", p["nodeImageUri"]) and re.fullmatch(r"v24\.[0-9]+\.[0-9]+", p["nodeVersion"]), "NODE_PIN")
    need(re.fullmatch(r"[1-9][0-9]*:[1-9][0-9]*", p["runtimeUser"]), "RUNTIME_USER")
    need(re.fullmatch(r"arn:aws:codebuild:us-east-1:967807252336:project/[A-Za-z0-9_-]+", p["codeBuildProjectArn"]), "PROJECT_PIN")
    need(re.fullmatch(r"967807252336\.dkr\.ecr\.us-east-1\.amazonaws\.com/[a-z0-9._/-]+", p["ecrRepositoryUri"]), "REPOSITORY_PIN")
    need(re.fullmatch(r"product-" + p["sourceCommit"] + r"-[a-f0-9]{32}", p["imageTag"]), "TAG_PIN")
    return p



def main():
    parser = argparse.ArgumentParser(description=__doc__, epilog="Exit: 0 success/help; 2 invalid input, failed check, unavailable command or timeout. No automatic retries.")
    commands = parser.add_subparsers(dest="mode", required=True)
    sealing = commands.add_parser("seal", help="Offline: create exact Git archive and member manifest; output paths must be absent")
    sealing.add_argument("--repository", type=Path, required=True)
    sealing.add_argument("--commit", required=True)
    sealing.add_argument("--archive", type=Path, required=True)
    sealing.add_argument("--output", type=Path, required=True)
    command = commands.add_parser("verify", help="Offline source verification")
    command.add_argument("--request", type=Path, required=True)
    command.add_argument("--archive", type=Path, required=True)
    command.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.mode == "seal":
            result = seal(args.repository, args.commit, args.archive, args.output)
        else:
            pin = validate_request(decode(args.request.read_bytes()))
            result = verify(args.archive, args.manifest, pin)
        print(json.dumps(result, sort_keys=True))
        return 0
    except Exception:
        print("PRODUCT_IMAGE_CHECK_FAILED", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
