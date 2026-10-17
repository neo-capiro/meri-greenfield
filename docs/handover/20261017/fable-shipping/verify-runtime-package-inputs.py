"""Read-only integrity check for retained PUBLIC runtime inputs. No network or writes.

Exit 0: exact retained snapshot matches its source lock. Exit 2: refusal.
This does not run apk, verify RSA signatures, install packages or qualify an image.
"""
import sys
sys.dont_write_bytecode = True
import hashlib
import json
import os
from pathlib import Path
import re
import stat

HERE = Path(__file__).resolve().parent
REPOSITORY = HERE.parents[3]
LIMIT = 16 * 1024 * 1024
HASH = re.compile(r"[a-f0-9]{64}\Z")
FAILURE = "PUBLIC_RUNTIME_PACKAGE_INPUTS_REFUSED"


def need(ok):
    if not ok:
        raise ValueError(FAILURE)


def duplicate_free(rows):
    result = {}
    for key, value in rows:
        need(key not in result)
        result[key] = value
    return result


def read_regular(path, maximum):
    before = path.lstat()
    need(stat.S_ISREG(before.st_mode) and 0 < before.st_size <= maximum)
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags)
    with os.fdopen(descriptor, "rb") as source:
        opened = os.fstat(source.fileno())
        need((before.st_dev, before.st_ino) == (opened.st_dev, opened.st_ino))
        chunks, total = [], 0
        while True:
            block = source.read(65536)
            if not block:
                break
            total += len(block)
            need(total <= maximum)
            chunks.append(block)
        after = os.fstat(source.fileno())
        need((opened.st_dev, opened.st_ino, opened.st_size, opened.st_mtime_ns, opened.st_ctime_ns) ==
             (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns))
    need(total == before.st_size)
    return b"".join(chunks)


def document(path, maximum=256 * 1024):
    raw = read_regular(path, maximum)
    return raw, json.loads(raw.decode("utf-8"), object_pairs_hook=duplicate_free)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def verify(lock_path, inputs):
    need(inputs.is_dir() and not inputs.is_symlink())
    need({path.name for path in inputs.iterdir()} ==
         {".gitattributes", "README.md", "provenance.json", "public-signing-key.txt", "x86_64"})
    payload_directory = inputs / "x86_64"
    need(payload_directory.is_dir() and not payload_directory.is_symlink())
    raw, lock = document(lock_path)
    _, record = document(inputs / "provenance.json")
    need(record.get("schemaVersion") == 1 and record.get("status") == "RETAINED_PUBLIC_INPUTS_ONLY")
    need(sha(raw) == record.get("runtimePackagesSha256") and lock.get("schemaVersion") == 1 and
         lock.get("platform") == "linux/amd64" and lock.get("runtimeImageUri") == record.get("runtimeBaseImageUri"))
    rows = [lock["repositoryIndex"], *lock["additionalPackages"]]
    need(len(rows) == 5 and sum(row["bytes"] for row in rows) <= 64 * 1024 * 1024)
    expected, total = [], 0
    for row in rows:
        file = row["file"]
        need(type(file) is str and re.fullmatch(r"[A-Za-z0-9._+-]+", file) and
             (file == "APKINDEX.tar.gz" or file.endswith(".apk")))
        need(row["url"] == "https://packages.wolfi.dev/os/x86_64/" + file and
             type(row["bytes"]) is int and 0 < row["bytes"] <= LIMIT and
             type(row["sha256"]) is str and HASH.fullmatch(row["sha256"]))
        payload = read_regular(payload_directory / file, LIMIT)
        need(len(payload) == row["bytes"] and sha(payload) == row["sha256"])
        total += len(payload)
        expected.append({key: row[key] for key in ("file", "url", "sha256", "bytes")})
    need(record.get("artifacts") == expected and len({row["file"] for row in rows}) == len(rows))
    need({path.name for path in payload_directory.iterdir()} == {row["file"] for row in rows})
    key = read_regular(inputs / "public-signing-key.txt", 8192)
    need(key.startswith(b"-----BEGIN PUBLIC KEY-----\n") and key.endswith(b"-----END PUBLIC KEY-----\n") and b"PRIVATE" not in key)
    public = record["publicSigningKey"]
    need(public["file"] == "public-signing-key.txt" and public["bytes"] == len(key) and
         sha(key) == public["sha256"] == lock["repositoryIndex"]["signingKeySha256"] and
         public["sourceImageUri"] == lock["runtimeImageUri"] and public["sourcePath"] == "/etc/apk/keys/wolfi-signing.rsa.pub")
    observed = record["recordedIndexSignatureObservation"]
    need(observed["indexSha256"] == lock["repositoryIndex"]["sha256"] and observed["indexBytes"] == lock["repositoryIndex"]["bytes"] and
         observed["keySha256"] == sha(key) and observed["compressedVerified"] is True)
    need(read_regular(inputs / ".gitattributes", 4096) == b"x86_64/* -text\npublic-signing-key.txt -text\n")
    read_regular(inputs / "README.md", 64 * 1024)
    return {"schemaVersion": 1, "status": "PUBLIC_RUNTIME_PACKAGE_INPUTS_VERIFIED",
            "runtimePackagesSha256": sha(raw), "publicFiles": len(rows) + 1, "totalPublicBytes": total + len(key)}


def main(args):
    if args in (["--help"], ["-h"]):
        print("Usage: verify-runtime-package-inputs.py [--lock FILE] [--inputs DIRECTORY]\n"
              "Defaults are relative to this script/repository, not the working directory.\n"
              "Read-only: no network/writes. Exit: 0 verified/help; 2 refused. No signature execution or image acceptance.")
        return 0
    try:
        options = {}
        need(len(args) % 2 == 0)
        for index in range(0, len(args), 2):
            name = args[index]
            need(name in ("--lock", "--inputs") and name not in options)
            options[name] = args[index + 1]
        lock = Path(options.get("--lock", REPOSITORY / "infra/product-preview/runtime-packages.lock.json"))
        inputs = Path(options.get("--inputs", HERE / "runtime-package-inputs"))
        print(json.dumps(verify(lock, inputs), sort_keys=True))
        return 0
    except Exception:
        print(FAILURE, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
