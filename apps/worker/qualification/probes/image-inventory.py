#!/usr/bin/env python3
"""Original stdlib static inventory; actual CLI is Linux-build-only.

Names identify candidates, not renamed copies or feature absence. No scanned
content is executed. Missing coverage, errors, races and limits fail closed.
Offline tests import _inventory with fabricated roots/pins and fake platform;
the CLI has no platform or pin-override escape hatch.
"""
import argparse
import hashlib
import json
import os
import stat
import sys
import time

SCHEMA = "meri.qualification.image-inventory/1"
OUTPUT_PATH = "/opt/meri-worker/image-inventory.json"
REQUIRED_ROOTS = ("/opt/meri-worker", "/opt/meri-venv", "/opt/meri-browsers", "/usr", "/etc",
                  "/var/lib/dpkg", "/bin", "/sbin", "/lib", "/lib64", "/root", "/home", "/scripts")
ROOT_ALIASES = {"/bin": "/usr/bin", "/sbin": "/usr/sbin", "/lib": "/usr/lib", "/lib64": "/usr/lib64"}
DEFAULT_EXCLUDES = ("/proc", "/sys", "/dev", "/run")
_BROWSER = "/opt/meri-browsers/chromium-1247/chrome-linux64/"
_HELPER_HASH = "be9f5d4be90fa60b985ad3069812b144ba7331fed0c3f980c6d9399d37d60314"
PINNED_FILES = {
    "/opt/meri-worker/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude":
        {"sha256": "4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358"},
    _BROWSER + "chrome": {"sha256": "adf078f8f80eb9e980a07b4418af23b0f4008a83bc5756d5588055bc4d76c5a0"},
    _BROWSER + "chrome_sandbox": {"sha256": _HELPER_HASH, "mode": "4755", "uid": 0, "gid": 0},
    _BROWSER + "chrome-sandbox": {"sha256": _HELPER_HASH, "mode": "4755", "uid": 0, "gid": 0},
}
_JAVA_NAMES = {"java", "javac", "jar", "keytool", "jexec", "rmiregistry"}


def is_candidate(name):
    if name == "tiffcrop": return "tiffcrop"
    if name.startswith("libdigestmd5"): return "libdigestmd5"
    if name in _JAVA_NAMES or name.startswith(("libjvm", "libjli")): return "java-jvm"
    return None


def path_under(path, root):
    return path == root or path.startswith(root.rstrip(os.sep) + os.sep)


def _identity(st):
    return (st.st_dev, st.st_ino, st.st_mode, st.st_uid, st.st_gid, st.st_size,
            st.st_mtime_ns, st.st_ctime_ns)


def _is_link(path):
    return os.path.islink(path) or bool(getattr(os.path, "isjunction", lambda p: False)(path))


class _Bound(Exception):
    pass


class Limits:
    def __init__(self, args, clock=time.monotonic):
        self.clock, self.start = clock, clock()
        self.deadline_ms, self.max_entries = args.deadline_ms, args.max_entries
        self.max_events, self.max_manifest_bytes = args.max_events, args.max_manifest_bytes
        self.entries, self.events, self.bytes, self.exceeded = 0, 0, 2048, None

    def check(self):
        if self.exceeded: raise _Bound(self.exceeded)
        if (self.clock() - self.start) * 1000 >= self.deadline_ms:
            self.exceeded = "deadline"
            raise _Bound(self.exceeded)

    def add(self, value, *, entry=False):
        self.check()
        self.entries += int(entry)
        self.events += 1
        # A record can also appear in candidate and privilege views.
        self.bytes += 5 * len(json.dumps(value, sort_keys=True).encode("utf-8")) + 128
        if self.entries > self.max_entries: self.exceeded = "max-entries"
        elif self.events > self.max_events: self.exceeded = "max-events"
        elif self.bytes > self.max_manifest_bytes: self.exceeded = "max-manifest-bytes"
        if self.exceeded: raise _Bound(self.exceeded)


def _directory_chain(path, limits):
    """Capture real ancestors, including the filesystem root; never follow links."""
    chain = {}
    while True:
        limits.check()
        st = os.lstat(path)
        if _is_link(path): raise OSError("root link ancestor refused")
        if not stat.S_ISDIR(st.st_mode): raise OSError("ancestor-not-a-directory")
        chain[path] = _identity(st)
        parent = os.path.dirname(path)
        if parent == path: break
        path = parent
    _check_directories(chain, limits)
    return chain


def _check_directories(chain, limits):
    for path, identity in chain.items():
        limits.check()
        if _is_link(path): raise OSError("link ancestor refused")
        st = os.lstat(path)
        if not stat.S_ISDIR(st.st_mode) or _identity(st) != identity:
            raise OSError("directory/ancestor identity changed:" + path)


def _safe_path(path, root, chain=None, limits=None):
    if not path_under(path, root): raise OSError("path outside declared root")
    parent = os.path.dirname(path)
    while True:
        if limits: limits.check()
        if _is_link(parent): raise OSError("link ancestor refused")
        if chain is not None:
            st = os.lstat(parent)
            if not stat.S_ISDIR(st.st_mode) or _identity(st) != chain.get(parent):
                raise OSError("directory/ancestor identity changed:" + parent)
        above = os.path.dirname(parent)
        if above == parent: break
        parent = above


def sha256_file(path, expected_stat, limits, hash_limit, root, chain=None):
    _safe_path(path, root, chain, limits)
    limits.check()
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0))
    try:
        opened = os.fstat(fd)
        if not stat.S_ISREG(opened.st_mode) or _identity(opened) != _identity(expected_stat):
            raise OSError("file identity changed before hash")
        if opened.st_size > hash_limit: raise OSError("hash-size-limit")
        sha, size = hashlib.sha256(), 0
        while True:
            limits.check()
            chunk = os.read(fd, min(1 << 20, hash_limit - size + 1))
            limits.check()
            if not chunk: break
            size += len(chunk)
            if size > hash_limit: raise OSError("hash-size-limit")
            sha.update(chunk)
        if size != opened.st_size or _identity(os.fstat(fd)) != _identity(opened):
            raise OSError("file identity changed during hash")
        _safe_path(path, root, chain, limits)
        if _is_link(path) or _identity(os.lstat(path)) != _identity(opened):
            raise OSError("file path changed during hash")
        limits.check()
        return sha.hexdigest()
    finally:
        os.close(fd)


def _record(path, root, limits, hash_limit, chain, expected_identity=None):
    limits.check()
    _safe_path(path, root, chain, limits)
    st = os.lstat(path)
    identity = _identity(st)
    if expected_identity is not None and identity != expected_identity:
        raise OSError("record identity changed")
    link = stat.S_ISLNK(st.st_mode) or _is_link(path)
    kind = "symlink" if link else "file" if stat.S_ISREG(st.st_mode) else "dir" if stat.S_ISDIR(st.st_mode) else "other"
    rec = {"path": path, "type": kind, "mode": format(stat.S_IMODE(st.st_mode), "04o"),
           "uid": st.st_uid, "gid": st.st_gid, "size": st.st_size}
    if link: rec["target"] = os.readlink(path)
    elif kind == "file": rec["sha256"] = sha256_file(path, st, limits, hash_limit, root, chain)
    _safe_path(path, root, chain, limits)
    if _identity(os.lstat(path)) != identity: raise OSError("record identity changed")
    if link and os.readlink(path) != rec["target"]: raise OSError("link target changed")
    limits.check()
    return rec, identity


def _check_alias(alias, limits):
    path, identity, target = alias
    limits.check()
    st = os.lstat(path)
    if (not (stat.S_ISLNK(st.st_mode) or _is_link(path))
            or _identity(st) != identity or os.readlink(path) != target):
        raise OSError("root alias identity/target changed")
    limits.check()


def walk_root(root, excludes, limits, hash_limit, entries, errors, aliases):
    def append(rec):
        limits.add(rec, entry=True)
        entries.append(rec)
    def error(path, exc):
        rec = {"path": path, "error": type(exc).__name__ + ":" + str(exc)[:160]}
        limits.add(rec)
        errors.append(rec)
    try:
        limits.check()
        if any(path_under(root, e) for e in excludes): raise OSError("declared root excluded")
        chain = _directory_chain(os.path.dirname(root), limits)
        initial = os.lstat(root)
        if not (stat.S_ISDIR(initial.st_mode) or stat.S_ISLNK(initial.st_mode) or _is_link(root)):
            raise OSError("root-not-a-directory")
        rec, root_identity = _record(root, root, limits, hash_limit, chain, _identity(initial))
        append(rec)
        if rec["type"] == "symlink":
            target = os.path.normpath(os.path.join(os.path.dirname(root), rec["target"]))
            if aliases.get(root) != target:
                raise OSError("unreviewed/missing root alias target")
            target_chain = _directory_chain(target, limits)
            for path, identity in target_chain.items():
                if path in chain and chain[path] != identity: raise OSError("alias ancestor changed")
                chain[path] = identity
            alias = (root, root_identity, rec["target"])
            _check_alias(alias, limits)
            _check_directories(chain, limits)
            _check_alias(alias, limits)
            return chain, alias
        if rec["type"] != "dir": raise OSError("root-not-a-directory")
        chain[root] = root_identity
        def onerror(exc): error(getattr(exc, "filename", None) or root, exc)
        for dirpath, dirnames, filenames in os.walk(root, followlinks=False, onerror=onerror):
            limits.check()
            _safe_path(os.path.join(dirpath, ".entry"), root, chain, limits)
            descend = []
            for name in sorted(dirnames + filenames):
                limits.check()
                path = os.path.join(dirpath, name)
                if any(path_under(path, e) for e in excludes): continue
                try:
                    item, identity = _record(path, root, limits, hash_limit, chain)
                    append(item)
                    if name in dirnames and item["type"] == "dir":
                        chain[path] = identity
                        descend.append(name)
                except OSError as exc: error(path, exc)
            dirnames[:] = descend
            _safe_path(os.path.join(dirpath, ".entry"), root, chain, limits)
        _check_directories(chain, limits)
        return chain, None
    except OSError as exc:
        error(root, exc)


def parse_args(argv=None):
    ap = argparse.ArgumentParser(description="Static Linux-build image inventory")
    for flag in ("--root", "--exclude", "--expect-file", "--expect-sha256", "--allow-suid"):
        ap.add_argument(flag, action="append", default=[])
    ap.add_argument("--deadline-ms", type=int, default=120000)
    ap.add_argument("--max-entries", type=int, default=300000)
    ap.add_argument("--max-events", type=int, default=2000000)
    ap.add_argument("--max-manifest-bytes", type=int, default=33554432)
    ap.add_argument("--max-hash-bytes", type=int, default=512 * 1024 * 1024)
    ap.add_argument("--out")
    return ap.parse_args(argv)


def _inventory(args, *, platform, required_roots, pins, aliases=None, clock=time.monotonic,
               output_path=OUTPUT_PATH):
    """Internal fixture injection; CLI supplies compiled platform, roots and pins."""
    refused = {"schema": SCHEMA, "ok": False, "refused": True}
    if platform != "linux":
        return {**refused, "platform": platform, "reason": "non-linux platform refused; no roots opened"}, 3
    roots = args.root
    if (not roots or len(roots) != len(set(roots)) or set(roots) != set(required_roots)
            or any(not os.path.isabs(r) or os.path.normpath(r) != r for r in roots)):
        return {**refused, "reason": "nonempty exact declared absolute roots required"}, 2
    aliases = aliases or {}
    if any(a not in roots or not any(path_under(t, r) for r in roots if r not in aliases) for a, t in aliases.items()):
        return {**refused, "reason": "root alias target must have declared canonical coverage"}, 2
    if not args.out or not output_path or args.out != output_path:
        return {**refused, "reason": "output must use the dedicated inventory path"}, 2
    if (args.deadline_ms < 0 or args.max_entries < 1 or args.max_events < 1
            or args.max_manifest_bytes < 4096 or args.max_hash_bytes < 1):
        return {**refused, "reason": "invalid bounds; manifest minimum4096 bytes"}, 2
    pairs = list(zip(args.expect_file, args.expect_sha256))
    allow = set(args.allow_suid)
    permitted = {p for p, v in pins.items() if v.get("mode") == "4755" and v.get("uid") == 0 and v.get("gid") == 0}
    if (len(args.expect_file) != len(args.expect_sha256) or len(args.expect_file) != len(set(args.expect_file))
            or any(p not in pins or pins[p]["sha256"] != h for p, h in pairs)
            or not allow.issubset(permitted)):
        return {**refused, "reason": "expectations/allowlist must match exact compiled paths and pins"}, 2
    excludes = list(DEFAULT_EXCLUDES)
    for e in args.exclude:
        if not os.path.isabs(e) or os.path.normpath(e) != e:
            return {**refused, "reason": "absolute canonical exclusions required"}, 2
        if any(path_under(r, e) or path_under(e, r) for r in roots):
            return {**refused, "reason": "exclusion would weaken declared static coverage"}, 2
        if e not in excludes: excludes.append(e)
    if args.out: excludes.append(os.path.abspath(args.out))
    limits, entries, errors, snapshots = Limits(args, clock), [], [], []
    try:
        for root in sorted(roots):
            snapshot = walk_root(root, excludes, limits, args.max_hash_bytes, entries, errors, aliases)
            if snapshot is not None: snapshots.append((root, snapshot))
        # Observe all successful roots/aliases again before declaring coverage.
        # This detects observed mutations; it is not an atomic filesystem snapshot.
        for root, (chain, alias) in snapshots:
            try:
                _check_directories(chain, limits)
                if alias: _check_alias(alias, limits)
            except OSError as exc:
                error = {"path": root, "error": type(exc).__name__ + ":" + str(exc)[:160]}
                limits.add(error)
                errors.append(error)
        limits.check()
    except _Bound:
        pass
    entries.sort(key=lambda e: e["path"])
    candidates, privilege, unreviewed = [], [], []
    by_path = {e["path"]: e for e in entries}
    expectations = []
    for path, pin in sorted(pins.items()):
        rec = by_path.get(path)
        match = rec is not None and rec["type"] == "file" and all(rec.get(k) == v for k, v in pin.items())
        expectations.append({"path": path, "status": "match" if match else "unresolved/mismatch",
                             "expected": pin, "observed": rec})
    for rec in entries:
        candidate = is_candidate(os.path.basename(rec["path"]))
        if candidate: candidates.append({**rec, "kind": candidate})
        if int(rec["mode"], 8) & 0o6000:
            privilege.append(rec)
            pin = pins.get(rec["path"])
            if (rec["path"] not in allow or not pin or rec["type"] != "file"
                    or not all(rec.get(k) == v for k, v in pin.items())):
                unreviewed.append(rec)
    complete = not limits.exceeded and not errors
    ok = complete and not unreviewed and all(e["status"] == "match" for e in expectations)
    summary = {"roots": sorted(roots), "exclusions": sorted(excludes), "entries": len(entries),
               "files": sum(e["type"] == "file" for e in entries), "symlinks": sum(e["type"] == "symlink" for e in entries),
               "candidates": len(candidates), "privilegeEntries": len(privilege), "unexpectedPrivilegeEntries": len(unreviewed),
               "expectations": len(expectations), "expectationFailures": sum(e["status"] != "match" for e in expectations),
               "errors": len(errors), "limitsExceeded": limits.exceeded, "elapsedMs": int((clock() - limits.start) * 1000)}
    manifest = {"schema": SCHEMA, "ok": bool(ok), "refused": False, "platform": platform, "summary": summary,
                "coverage": {"complete": bool(complete), "scope": "declared roots/aliases; names do not prove renamed features absent"},
                "truncated": bool(limits.exceeded), "expectations": expectations, "candidates": candidates,
                "privilegeFiles": privilege, "unexpectedPrivilegeFiles": unreviewed, "errors": errors, "entries": entries}
    try:
        limits.check()
    except _Bound:
        manifest["ok"], manifest["truncated"], manifest["coverage"]["complete"] = False, True, False
        summary["limitsExceeded"] = limits.exceeded
    if len(json.dumps(manifest, sort_keys=True).encode("utf-8")) > args.max_manifest_bytes:
        manifest = {"schema": SCHEMA, "ok": False, "refused": False, "truncated": True,
                    "coverage": {"complete": False}, "reason": "max-manifest-bytes; records suppressed",
                    "summary": {"entries": len(entries), "errors": len(errors), "limitsExceeded": "max-manifest-bytes"},
                    "entries": [], "candidates": [], "privilegeFiles": [], "unexpectedPrivilegeFiles": [], "errors": []}
    return manifest, 0 if manifest["ok"] else 1


def emit(manifest, out):
    encoded = json.dumps(manifest, sort_keys=True)
    if out:
        temp = out + ".tmp"
        with open(temp, "x", encoding="utf-8") as fh:
            fh.write(encoded)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(temp, out)
    sys.stdout.write(json.dumps({k: manifest.get(k) for k in ("ok", "refused", "summary", "reason")}, sort_keys=True) + "\n")


def main(argv=None):
    args = parse_args(argv)
    manifest, code = _inventory(args, platform=sys.platform, required_roots=REQUIRED_ROOTS,
                                pins=PINNED_FILES, aliases=ROOT_ALIASES)
    emit(manifest, OUTPUT_PATH if sys.platform == "linux" and not manifest["refused"] else None)
    return code


if __name__ == "__main__": raise SystemExit(main())
