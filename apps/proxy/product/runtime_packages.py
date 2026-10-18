"""Verify the proxy's Wolfi runtime packages against runtime-packages.lock.json.

Runs inside the final image after the offline, signed-index ``apk add``. Exit 0 prints a
content-free receipt; any mismatch exits 2. The installed APK database must contain
exactly the lock's base plus additional name/version pairs, the interpreter must be the
pinned minor version, and every required path must exist. No network, no writes.
Usage: python -I -B -m apps.proxy.product.runtime_packages verify --lock FILE [--root DIR]
"""
import hashlib
import json
import os
import sys
from pathlib import Path

DB_PATHS = ("lib/apk/db/installed", "usr/lib/apk/db/installed", "var/lib/apk/db/installed")


class RuntimePackagesRefused(Exception):
    pass


def _refuse():
    raise RuntimePackagesRefused("PROXY_RUNTIME_PACKAGES_REFUSED")


def load_lock(path):
    raw = Path(path).read_bytes()
    lock = json.loads(raw)
    keys = {"schemaVersion", "platform", "runtimeImageUri", "pythonPackage", "pythonPackageVersion",
            "pythonMinor", "glibcVersion", "basePackages", "additionalPackages", "repositoryIndex", "requiredPaths"}
    if type(lock) is not dict or set(lock) != keys or lock["schemaVersion"] != 1 or lock["platform"] != "linux/amd64":
        _refuse()
    names = [p["name"] for p in lock["basePackages"] + lock["additionalPackages"]]
    if len(names) != len(set(names)) or not all(type(p.get("version")) is str and p["version"] for p in
                                                 lock["basePackages"] + lock["additionalPackages"]):
        _refuse()
    if not any(p["name"] == lock["pythonPackage"] and p["version"] == lock["pythonPackageVersion"]
               for p in lock["additionalPackages"]):
        _refuse()
    return lock, hashlib.sha256(raw).hexdigest()


def installed_set(root):
    found = [Path(root, p) for p in DB_PATHS if Path(root, p).is_file()]
    if len({f.resolve() for f in found}) != 1:
        _refuse()
    rows, seen = [], set()
    for block in found[0].read_text(encoding="utf-8").split("\n\n"):
        if not block.strip():
            continue
        fields = dict((line[0], line[2:]) for line in block.split("\n") if len(line) > 2 and line[1] == ":")
        name, version = fields.get("P"), fields.get("V")
        if not name or not version or name in seen:
            _refuse()
        seen.add(name)
        rows.append((name, version))
    return sorted(rows)


def verify(lock_path, root="/", version_info=None):
    lock, lock_sha = load_lock(lock_path)
    expected = sorted((p["name"], p["version"]) for p in lock["basePackages"] + lock["additionalPackages"])
    actual = installed_set(root)
    if actual != expected:
        _refuse()
    version = version_info or sys.version_info
    if "%d.%d" % tuple(version[:2]) != lock["pythonMinor"]:
        _refuse()
    for path in lock["requiredPaths"]:
        if not Path(root, path.lstrip("/")).exists():
            _refuse()
    return {"schemaVersion": 1, "status": "PROXY_RUNTIME_PACKAGES_VERIFIED",
            "runtimeBaseImageUri": lock["runtimeImageUri"], "runtimePackagesSha256": lock_sha,
            "installedPackageSetSha256": hashlib.sha256(json.dumps(actual).encode()).hexdigest(),
            "pythonVersion": "%d.%d.%d" % tuple(version[:3]), "packageCount": len(actual)}


def main(argv):
    if len(argv) not in (3, 5) or argv[0] != "verify" or argv[1] != "--lock" or (len(argv) == 5 and argv[3] != "--root"):
        print("usage: runtime_packages verify --lock FILE [--root DIR]", file=sys.stderr)
        return 2
    try:
        print(json.dumps(verify(argv[2], argv[4] if len(argv) == 5 else "/"), sort_keys=True))
        return 0
    except (RuntimePackagesRefused, OSError, ValueError, KeyError, TypeError):
        print("PROXY_RUNTIME_PACKAGES_REFUSED", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
