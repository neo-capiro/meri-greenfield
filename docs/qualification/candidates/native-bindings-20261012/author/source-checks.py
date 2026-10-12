"""AST-only native wrapper review plus isolated writer with in-memory ports."""
import ast
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent
raw = (ROOT / "evidence-writer.py").read_bytes()
tree = ast.parse(raw)
selected = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.ClassDef))
            and node.name in ("Refusal", "write_reserved")]
caps_node = next(node.value for node in tree.body if isinstance(node, ast.Assign)
                 and any(isinstance(target, ast.Name) and target.id == "CAPS" for target in node.targets))
namespace = {"hashlib": hashlib, "Path": PurePosixPath, "stat": stat, "CAPS": ast.literal_eval(caps_node)}
exec(compile(ast.Module(body=selected, type_ignores=[]), "isolated-writer", "exec"), namespace)
write_reserved = namespace["write_reserved"]


class Budget:
    total_end = 15

    def __init__(self, now=0):
        self.now = now

    def clock(self):
        return self.now

    def remaining(self, phase):
        if phase != "total":
            raise AssertionError("writer changed phase")
        return max(0, 15 - self.now)

    def check(self, phase):
        if self.remaining(phase) <= 0:
            raise TimeoutError("shared deadline")


class Entries:
    def __init__(self, values):
        self.values = values

    def __enter__(self):
        return iter(self.values)

    def __exit__(self, *args):
        return None


class Memory:
    def __init__(self, budget, scenario="", step=65536):
        self.budget, self.scenario, self.step = budget, scenario, step
        self.root = PurePosixPath("/owned")
        self.files, self.handles, self.events = {}, {}, []
        self.next_id, self.directory_id, self.generation = 11, 10, 0
        if scenario == "foreign":
            self.files[self.root / "foreign.bin"] = {"id": 11, "raw": b"preserved"}

    def metadata(self, path):
        if path == self.root:
            return SimpleNamespace(st_dev=1, st_ino=self.directory_id, st_mode=stat.S_IFDIR | 0o700,
                                   st_nlink=1, st_size=len(self.files), st_mtime_ns=self.generation,
                                   st_ctime_ns=0, st_file_attributes=0)
        row = self.files[path]
        return SimpleNamespace(st_dev=1, st_ino=row["id"], st_mode=stat.S_IFREG | 0o600,
                               st_nlink=1, st_size=len(row["raw"]), st_mtime_ns=len(row["raw"]),
                               st_ctime_ns=0, st_file_attributes=0)

    def children(self, destination):
        values = sorted(self.files)
        if self.scenario == "duplicate" and values:
            values.append(values[0])
        return Entries(values)

    def open_exclusive(self, path):
        self.events.append("open")
        if path in self.files:
            raise FileExistsError()
        if self.scenario == "invalid_fd":
            return False
        descriptor = self.next_id
        self.next_id += 1
        self.files[path] = {"id": descriptor, "raw": b""}
        self.handles[descriptor] = path
        self.generation += 1
        if self.scenario == "late_open":
            self.budget.now = 16
        return descriptor

    def write(self, descriptor, raw):
        self.events.append("write")
        if self.scenario == "zero_write":
            return 0
        if self.scenario == "bool_write":
            return True
        if self.scenario == "oversized_write":
            return len(raw) + 1
        if self.scenario == "write_error":
            raise OSError()
        count = min(self.step, len(raw))
        self.files[self.handles[descriptor]]["raw"] += raw[:count]
        if self.scenario == "late_write":
            self.budget.now = 16
        return count

    def fsync(self, descriptor):
        self.events.append("fsync")
        if self.scenario == "fsync_error":
            raise OSError()
        if self.scenario == "late_fsync":
            self.budget.now = 16

    def fstat(self, descriptor):
        return self.metadata(self.handles[descriptor])

    def close(self, descriptor):
        self.events.append("close")
        if self.scenario == "close_error":
            raise OSError()
        del self.handles[descriptor]
        if self.scenario == "late_close":
            self.budget.now = 16


class Inventory:
    @staticmethod
    def identity(info):
        return (info.st_dev, info.st_ino, info.st_mode, info.st_nlink, info.st_size,
                info.st_mtime_ns, info.st_ctime_ns, info.st_file_attributes)

    def plain(self, path, fs, directory=False):
        info = fs.metadata(path)
        expected = stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode) and info.st_nlink == 1
        if not expected or info.st_file_attributes & 0x400:
            raise ValueError("canonical predicate refused")
        return info

    def ancestors(self, path, fs):
        if path != fs.root:
            raise ValueError("unexpected ancestor role")

    def hash_file(self, path, *, fs, clock, end, cap, allow_empty):
        fs.events.append("readback")
        raw = fs.files[path]["raw"]
        if len(raw) > cap or not allow_empty and not raw:
            raise ValueError("readback bound")
        if fs.scenario == "late_readback":
            fs.budget.now = 16
        digest = hashlib.sha256(raw).hexdigest()
        if fs.scenario == "bad_readback":
            digest = "0" * 64
        return {"bytes": len(raw), "sha256": digest}


checks = []


def need(value, name):
    if not value:
        raise AssertionError(name)
    checks.append(name)


def run(scenario="", *, artifacts=None, step=65536, now=0, owned=(1, 10)):
    budget = Budget(now)
    memory = Memory(budget, scenario, step)
    if artifacts is None:
        artifacts = {"command-receipt.json": b"{}", "stdout.bin": b"result", "stderr.bin": b""}
    outcome = write_reserved(memory.root, owned, artifacts, budget=budget,
                             inventory=Inventory(), fs=memory, writes=memory)
    return outcome, memory


for step in (65536, 1):
    outcome, memory = run(step=step)
    need(outcome["readbackAndMembershipMatched"] and not memory.handles,
         "complete-readback-short-write-" + str(step))
    need(memory.files[memory.root / "stdout.bin"]["raw"] == b"result", "exact-output-" + str(step))
    need(not outcome["nativePublicationQualified"] and not outcome["runtimeAccepted"],
         "fake-success-never-native-acceptance-" + str(step))
for scenario in ("zero_write", "bool_write", "oversized_write", "write_error", "fsync_error",
                 "close_error", "late_open", "late_write", "late_fsync", "late_close",
                 "late_readback", "bad_readback", "duplicate"):
    outcome, memory = run(scenario)
    need(not outcome["readbackAndMembershipMatched"] and outcome["errors"], scenario + "-hold")
    need(bool(memory.files) and outcome["partialFilesPreserved"], scenario + "-partial-preserved")
outcome, memory = run("invalid_fd")
need(not outcome["readbackAndMembershipMatched"] and "close" not in memory.events,
     "invalid-fd-never-closed-as-owned")
outcome, memory = run("foreign")
need(not outcome["readbackAndMembershipMatched"] and not memory.events
     and memory.files[memory.root / "foreign.bin"]["raw"] == b"preserved", "foreign-member-untouched")
outcome, memory = run(owned=(1, 99))
need(not outcome["readbackAndMembershipMatched"] and not memory.events, "reserved-identity-substitution")
outcome, memory = run(now=16)
need(not outcome["readbackAndMembershipMatched"] and not memory.events, "original-budget-no-reset")
for artifacts in ({"bad.bin": b"x"}, {"command-receipt.json": b""},
                  {"command-receipt.json": b"x" * 262145}, {"command-receipt.json": bytearray(b"{}")},
                  {"command-receipt.json": b"{}", "stderr.bin": b"x" * 65537}):
    outcome, memory = run(artifacts=artifacts)
    need(not outcome["readbackAndMembershipMatched"] and not memory.events, "bounded-artifact-refusal-" + str(len(checks)))

wrapper_path = ROOT.parents[1] / "native-supervisor-20261012/author/run-supervised.py"
wrapper = wrapper_path.read_bytes()
parsed = ast.parse(wrapper)
need(b"evidence_writer.write_reserved(" in wrapper and b"budget=budget" in wrapper,
     "actual-wrapper-composes-same-budget-writer")
need(b'"evidencePublicationVerified": False' in wrapper and b"SOURCE_VERIFICATION_SHA256 = None" in wrapper,
     "native-entry-and-publication-remain-held")
need(b'"--no-optional-locks"' in wrapper and b'"core.fsmonitor=false"' in wrapper
     and b'"core.untrackedCache=false"' in wrapper and b'"--untracked-files=all"' in wrapper
     and b'"--ignore-submodules=all"' not in wrapper, "readonly-git-flags-with-full-status")
need(b"os.O_EXCL" in raw and b"os.fsync" in raw and b"os.O_CREAT" in raw,
     "native-exclusive-fsync-adapter-ast-only")
need(b'"O_NOFOLLOW"' in raw and b"destination.mkdir(exist_ok=False)" in wrapper,
     "reserved-mkdir-and-no-follow-source-composition")
need(not any(isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
             and node.func.attr in ("unlink", "rmdir", "remove", "rename", "replace")
             for node in ast.walk(tree)), "no-delete-rename-replace-fallback")
print(json.dumps({"checksPassed": len(checks), "checks": checks,
                  "writerSha256": hashlib.sha256(raw).hexdigest(),
                  "wrapperSha256": hashlib.sha256(wrapper).hexdigest(),
                  "mechanism": "AST-isolated new writer only; all files, descriptors and clocks are in-memory ports",
                  "candidateEntryImported": False, "NativeWritesExecuted": False,
                  "nativeFileOperations": 0, "nativeProcesses": 0,
                  "nativePublicationQualified": False, "runtimeAccepted": False}, indent=2))
