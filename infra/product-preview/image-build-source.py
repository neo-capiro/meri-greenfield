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
import os
import time
import zipfile

SHA = re.compile(r"[a-f0-9]{64}\Z")
COMMIT = re.compile(r"[a-f0-9]{40}\Z")
# The one public certificate file the sealed source may carry: the pinned Amazon
# RDS global CA bundle baked into the image for node-postgres verify-full.
RDS_CA_BUNDLE = "apps/runtime/certs/rds-global-bundle.pem"
RDS_CA_LOCK = "apps/runtime/certs/rds-global-bundle.lock.json"
RDS_CA_IMAGE_PATH = "/opt/meri/certs/rds-global-bundle.pem"
PEM_CERTIFICATE = re.compile(rb"-----BEGIN CERTIFICATE-----\n(?:[A-Za-z0-9+/]{1,64}\n)*[A-Za-z0-9+/]{0,63}={0,2}\n?-----END CERTIFICATE-----\n")


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


def certificate_count(payload):
    """Count PEM certificates; anything else (a key, another block, stray bytes) refuses."""
    need(type(payload) is bytes and 0 < len(payload) <= 1024**2 and payload.isascii() and b"\r" not in payload, "PUBLIC_CA_BUNDLE")
    blocks = PEM_CERTIFICATE.findall(payload)
    need(blocks and b"".join(blocks) == payload, "PUBLIC_CA_BUNDLE")
    return len(blocks)


def rds_ca_lock(payload, bundle):
    """The committed lock pins the bundle's exact bytes, digest and certificate count."""
    need(type(payload) is bytes and 0 < len(payload) <= 65536, "RDS_CA_LOCK")
    lock = exact(decode(payload), ["schemaVersion", "contract", "source", "retrievedOn", "path", "imagePath", "sha256", "bytes", "certificateCount", "requiredSubjects"])
    need(lock["schemaVersion"] == 1 and type(lock["schemaVersion"]) is int and lock["contract"] == "meri.rds-ca-bundle.v1" and
         lock["source"] == "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem" and
         lock["path"] == RDS_CA_BUNDLE and lock["imagePath"] == RDS_CA_IMAGE_PATH and
         type(lock["sha256"]) is str and SHA.fullmatch(lock["sha256"]) and lock["sha256"] == sha(bundle) and
         type(lock["bytes"]) is int and lock["bytes"] == len(bundle) and
         type(lock["certificateCount"]) is int and lock["certificateCount"] == certificate_count(bundle), "RDS_CA_LOCK")
    return lock


def safe_path(value):
    need(type(value) is str and value and not re.search(r"[\\\x00-\x1f\x7f:]", value), "MEMBER_PATH")
    need(not value.startswith("/") and all(p not in ("", ".", "..") for p in value.split("/")), "MEMBER_PATH")
    need(str(PurePosixPath(value)) == value and value.isascii(), "MEMBER_PATH")
    return value


def private_path(path):
    need(not any(p in (".git", "node_modules", ".aws", ".codex", ".agents") for p in path.split("/")), "PRIVATE_MEMBER")
    need(not any(p.startswith(".env") or p == "credentials" for p in path.split("/")) and (path == RDS_CA_BUNDLE or not path.endswith((".key", ".pem"))), "PRIVATE_MEMBER")


def archive_members(archive):
    need(archive.stat().st_size <= 1024**3, "ARCHIVE_BOUND")
    result = {}
    with zipfile.ZipFile(archive) as source:
        rows = source.infolist()
        need(0 < len(rows) <= 50000 and sum(row.file_size for row in rows) <= 2 * 1024**3, "ARCHIVE_BOUND")
        names = [safe_path(row.filename.rstrip("/") if row.is_dir() else row.filename) for row in rows]
        need(len({name.casefold() for name in names}) == len(names), "DUPLICATE_MEMBER")
        seen = set()
        for row in rows:
            path = safe_path(row.filename.rstrip("/") if row.is_dir() else row.filename)
            need(path.casefold() not in seen, "DUPLICATE_MEMBER")
            seen.add(path.casefold())
            private_path(path)
            mode = row.external_attr >> 16
            need(not row.flag_bits & 1 and not stat.S_ISLNK(mode), "MEMBER_TYPE")
            if row.is_dir():
                need(stat.S_IFMT(mode) in (0, stat.S_IFDIR), "MEMBER_TYPE")
                continue
            need(stat.S_IFMT(mode) in (0, stat.S_IFREG) and row.file_size <= 128 * 1024**2, "MEMBER_TYPE")
            payload = source.read(row)
            if path == RDS_CA_BUNDLE:
                certificate_count(payload)
            result[path] = {"path": path, "sha256": sha(payload), "bytes": len(payload), "mode": "100755" if mode & 0o111 else "100644"}
    folded = {name.casefold() for name in result}
    need(all(not any(str(ancestor).casefold() in folded for ancestor in list(PurePosixPath(path).parents)[:-1]) for path in result), "MEMBER_ANCESTOR")
    return result


def run(args, timeout=30):
    """Git only: bounded private output; failures never expose subprocess stderr."""
    need(0 < timeout <= 120 and args[0] == "git", "COMMAND_BOUND")
    with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
        process = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=out, stderr=err)
        started = time.monotonic()
        try:
            while process.poll() is None:
                need(time.monotonic() - started < timeout, "COMMAND_TIMEOUT")
                need(os.fstat(out.fileno()).st_size + os.fstat(err.fileno()).st_size <= 16*1024**2, "COMMAND_BOUND")
                time.sleep(0.01)
            need(os.fstat(out.fileno()).st_size + os.fstat(err.fileno()).st_size <= 16*1024**2, "COMMAND_BOUND")
            need(process.returncode == 0, "COMMAND_FAILED")
            out.seek(0)
            return out.read()
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=5)


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
        with zipfile.ZipFile(raw) as source:
            rds_ca_lock(source.read(RDS_CA_LOCK), source.read(RDS_CA_BUNDLE))
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


def read_manifest(path, commit, digest):
    need(type(commit) is str and COMMIT.fullmatch(commit) and type(digest) is str and SHA.fullmatch(digest), "SOURCE_PIN")
    need(path.stat().st_size <= 32*1024**2, "MANIFEST_BOUND")
    payload = path.read_bytes()
    need(sha(payload) == digest, "MANIFEST_SHA_MISMATCH")
    manifest = exact(decode(payload), ["contract", "sourceCommit", "files"])
    need(manifest["contract"] == "meri.source-members.v1" and manifest["sourceCommit"] == commit, "SOURCE_COMMIT")
    rows = manifest["files"]
    need(type(rows) is list and 0 < len(rows) <= 50000, "MANIFEST_SHAPE")
    expected, seen, total = {}, set(), 0
    for row in rows:
        exact(row, ["path", "sha256", "bytes", "mode"])
        name = safe_path(row["path"])
        private_path(name)
        need(name.casefold() not in seen and type(row["sha256"]) is str and SHA.fullmatch(row["sha256"]) and
             type(row["bytes"]) is int and 0 <= row["bytes"] <= 128*1024**2 and row["mode"] in ("100644", "100755"), "MANIFEST_SHAPE")
        total += row["bytes"]
        need(total <= 2*1024**3, "MANIFEST_BOUND")
        expected[name] = row
        seen.add(name.casefold())
    need(list(expected) == sorted(expected), "MANIFEST_ORDER")
    need(all(not any(str(parent).casefold() in seen for parent in list(PurePosixPath(name).parents)[:-1]) for name in expected), "MEMBER_ANCESTOR")
    need(RDS_CA_BUNDLE in expected and RDS_CA_LOCK in expected, "RDS_CA_LOCK")
    return expected


def verify(archive, manifest, commit, archive_sha, manifest_sha):
    need(type(archive_sha) is str and SHA.fullmatch(archive_sha) and file_sha(archive, 1024**3) == archive_sha, "ARCHIVE_SHA_MISMATCH")
    expected = read_manifest(manifest, commit, manifest_sha)
    measured = archive_members(archive)
    need(measured == expected, "SOURCE_MEMBERS_MISMATCH")
    with zipfile.ZipFile(archive) as source:
        rds_ca_lock(source.read(RDS_CA_LOCK), source.read(RDS_CA_BUNDLE))
    return {"status": "VERIFIED_SOURCE_ONLY", "sourceCommit": commit, "fileCount": len(measured)}


def verify_tree(directory, manifest, commit, manifest_sha):
    """Validate CodeBuild's extracted source before Docker; never extract untrusted paths."""
    expected = read_manifest(manifest, commit, manifest_sha)
    need(directory.is_dir() and not directory.is_symlink(), "SOURCE_DIRECTORY")
    found, seen = set(), set()
    for base, dirs, files in os.walk(directory, followlinks=False):
        for name in dirs + files:
            path = Path(base) / name
            relative = safe_path(path.relative_to(directory).as_posix())
            private_path(relative)
            need(relative.casefold() not in seen, "DUPLICATE_MEMBER")
            seen.add(relative.casefold())
            before = path.lstat()
            need(not stat.S_ISLNK(before.st_mode), "MEMBER_TYPE")
            if name in dirs:
                need(stat.S_ISDIR(before.st_mode) and any(p.startswith(relative + "/") for p in expected), "SOURCE_MEMBERS_MISMATCH")
                continue
            need(relative in expected and stat.S_ISREG(before.st_mode), "SOURCE_MEMBERS_MISMATCH")
            row = expected[relative]
            need(before.st_size == row["bytes"] and file_sha(path, 128*1024**2) == row["sha256"] and
                 ("100755" if before.st_mode & 0o111 else "100644") == row["mode"], "SOURCE_MEMBERS_MISMATCH")
            after = path.lstat()
            need((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_mode) ==
                 (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_mode), "SOURCE_CHANGED")
            found.add(relative)
    need(found == set(expected), "SOURCE_MEMBERS_MISMATCH")
    rds_ca_lock((directory / RDS_CA_LOCK).read_bytes(), (directory / RDS_CA_BUNDLE).read_bytes())
    return {"status": "VERIFIED_SOURCE_ONLY", "sourceCommit": commit, "fileCount": len(found)}


def main():
    parser = argparse.ArgumentParser(description=__doc__, epilog="Exit: 0 success/help; 2 refused input/check. No automatic retries.")
    commands = parser.add_subparsers(dest="mode", required=True)
    sealing = commands.add_parser("seal", help="Create exact Git ZIP and member manifest; outputs must be absent")
    sealing.add_argument("--repository", type=Path, required=True)
    sealing.add_argument("--commit", required=True)
    sealing.add_argument("--archive", type=Path, required=True)
    sealing.add_argument("--output", type=Path, required=True)
    for mode in ("verify", "verify-tree"):
        command = commands.add_parser(mode, help="Offline exact source verification")
        command.add_argument("--manifest", type=Path, required=True)
        command.add_argument("--commit", required=True)
        command.add_argument("--manifest-sha256", required=True)
        if mode == "verify":
            command.add_argument("--archive", type=Path, required=True)
            command.add_argument("--archive-sha256", required=True)
        else:
            command.add_argument("--directory", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.mode == "seal":
            result = seal(args.repository, args.commit, args.archive, args.output)
        elif args.mode == "verify":
            result = verify(args.archive, args.manifest, args.commit, args.archive_sha256, args.manifest_sha256)
        else:
            result = verify_tree(args.directory, args.manifest, args.commit, args.manifest_sha256)
        print(json.dumps(result, sort_keys=True))
        return 0
    except Exception:
        print("PRODUCT_IMAGE_CHECK_FAILED", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
