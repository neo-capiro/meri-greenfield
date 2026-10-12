"""Exercise public hash_file definitions only, with in-memory filesystem ports.

The private helper, collector, supervisor, diagnostic and native adapters are
never imported, compiled or executed. All inspected runtime ports below are fake.
"""
import ast
import hashlib
import json
from pathlib import Path
import stat
import sys
from types import SimpleNamespace


def isolated(path):
    raw = path.read_bytes()
    parsed = ast.parse(raw)
    names = {"identity", "check_deadline", "plain", "ancestors", "hash_file"}
    definitions = [node for node in parsed.body if isinstance(node, ast.FunctionDef) and node.name in names]
    assert {node.name for node in definitions} == names
    namespace = {"Path": Path, "stat": stat, "hashlib": hashlib}
    exec(compile(ast.Module(body=definitions, type_ignores=[]), "<public-functions-with-inert-ports>", "exec"), namespace)
    return namespace["hash_file"], hashlib.sha256(raw).hexdigest()


class InertFilesystem:
    def __init__(self, late):
        self.now = 0
        self.late = late
        self.events = []
        self.reads = 0
        self.stats = 0
        self.named = 0

    def clock(self):
        return self.now

    def event(self, name):
        self.events.append({"port": name, "startedAt": self.now})
        if name == self.late:
            self.now = 10

    def info(self, directory=False):
        return SimpleNamespace(st_dev=1, st_ino=2, st_mode=(stat.S_IFDIR if directory else stat.S_IFREG) | 0o600,
                               st_nlink=1, st_size=3, st_mtime_ns=4, st_ctime_ns=5, st_file_attributes=0)

    def lstat(self, path):
        self.named += 1
        name = "ancestor-root" if str(path) == "/" else "ancestor-parent" if str(path) == "/inert" else "named-before" if self.named == 3 else "named-after"
        self.event(name)
        return self.info(directory=str(path) != "/inert/member")

    def open_read(self, path):
        self.event("open")
        return 17

    def fstat(self, descriptor):
        assert descriptor == 17
        self.stats += 1
        self.event("opened-before" if self.stats == 1 else "opened-after")
        return self.info()

    def read(self, descriptor, size):
        assert descriptor == 17 and size == 65536
        self.reads += 1
        self.event("read-data" if self.reads == 1 else "read-eof")
        return b"abc" if self.reads == 1 else b""

    def close(self, descriptor):
        assert descriptor == 17
        self.event("close")


def run(source):
    hash_file, digest = isolated(source)
    observations, checks = [], []
    for late in [None, "ancestor-root", "ancestor-parent", "named-before", "open", "opened-before", "read-data", "read-eof", "opened-after", "close", "named-after"]:
        fs = InertFilesystem(late)
        result = None
        error = None
        try:
            result = hash_file(Path("/inert/member"), fs=fs, clock=fs.clock, end=10, cap=3)
        except Exception as exc:
            error = {"type": type(exc).__name__, "message": str(exc)}
        ports = [event["port"] for event in fs.events]
        after_expiry = [event["port"] for event in fs.events if event["startedAt"] >= 10 and event["port"] != "close"]
        row = {"latePort": late, "result": result, "error": error, "events": fs.events,
               "nonCleanupPortsAfterExpiry": after_expiry, "closeCount": ports.count("close")}
        observations.append(row)
        name = late or "on-time"
        if late is None:
            checks.append({"name": name + "-hash-result", "passed": result is not None and result["bytes"] == 3 and result["sha256"] == hashlib.sha256(b"abc").hexdigest() and error is None})
        else:
            checks.append({"name": name + "-deadline-refusal", "passed": result is None and error == {"type": "ValueError", "message": "runner inventory deadline"}})
            checks.append({"name": name + "-no-later-observation", "passed": not after_expiry})
        checks.append({"name": name + "-owned-close-once", "passed": ports.count("close") == (1 if "open" in ports else 0)})
    return {"sourceSha256": digest, "mechanism": "AST-isolated public functions; explicit inert fs and clock only", "observations": observations,
            "checks": checks, "passed": sum(row["passed"] for row in checks), "failed": sum(not row["passed"] for row in checks), "nativeExecution": False}


if __name__ == "__main__":
    source = Path(sys.argv[1]) if len(sys.argv) == 2 else Path("scripts/qualification/worker_runner_inventory.py")
    result = run(source)
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["failed"] == 0 else 1)
