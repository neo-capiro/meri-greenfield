"""Parse target source; execute only new isolated lifecycle definitions with fakes.

Never import the wrapper/lifecycle/diagnostic, call Popen, start a real thread,
sleep, create a native child, or touch the supplied Windows candidate.
"""
import ast
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
raw = (ROOT / "supervision.py").read_bytes()
tree = ast.parse(raw)
selected = [node for node in tree.body if isinstance(node, (ast.ClassDef, ast.FunctionDef))]
names = {node.name for node in selected}
if names != {"Refusal", "Budget", "capture"}:
    raise AssertionError("unexpected isolated definitions")
namespace = {}
# Compile only these new pure definitions; no target module import/entry or
# historical supervisor compilation. Every effect is supplied below as a fake.
exec(compile(ast.Module(body=selected, type_ignores=[]), "isolated-lifecycle", "exec"), namespace)
Budget, capture = namespace["Budget"], namespace["capture"]


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


class Stream:
    def __init__(self, chunks, clock, step=0.0):
        self.chunks = list(chunks)
        self.clock, self.step, self.closed = clock, step, False

    def read(self, size):
        self.clock.now += self.step
        result = self.chunks.pop(0) if self.chunks else b""
        if isinstance(result, Exception):
            raise result
        return result

    def close(self):
        self.closed = True


class Thread:
    def __init__(self, target):
        self.target = target

    def start(self):
        self.target()

    def join(self, timeout):
        if not timeout > 0:
            raise AssertionError("unbounded/zero join")

    def is_alive(self):
        return False


class Child:
    def __init__(self, clock, stdout, stderr, code=0):
        self.stdout, self.stderr = Stream(stdout, clock), Stream(stderr, clock)
        self.code, self.kills, self.waits = code, 0, []

    def poll(self):
        return self.code

    def kill(self):
        self.kills += 1
        self.code = -9

    def wait(self, timeout):
        self.waits.append(timeout)
        if not timeout > 0:
            raise AssertionError("unbounded/zero wait")
        return self.code


checks = []


def need(value, label):
    if not value:
        raise AssertionError(label)
    checks.append(label)


def run(stdout=(), stderr=(), code=0, before=0.0, spawn_delay=0.0, factory=Thread):
    clock = Clock()
    budget = Budget(clock)
    clock.now = before
    child = Child(clock, stdout, stderr, code)
    calls = []

    def spawn(argv, cwd):
        calls.append((argv, cwd))
        clock.now += spawn_delay
        return child

    result = capture(["fixed-candidate"], "fixed-cwd", budget,
                     spawn=spawn, make_thread=factory, sleep=clock.sleep)
    return result, child, calls, clock


result, child, calls, _ = run([b"{}", b""], [b""])
need(result["observationEligible"] and result["streams"]["stdout"]["eof"], "genuine-eof-settled-observation")
need(not result["hardTotalProven"] and not result["runtimeAccepted"], "source-never-native-admission")
need(child.stdout.closed and child.stderr.closed, "settled-streams-closed")
result, _, _, _ = run([b"x" * 32768, b""])
need(result["observationEligible"] and len(result["streams"]["stdout"]["data"]) == 32768, "stdout-exact-cap")
result, _, _, _ = run([], [b"x" * 65536, b""])
need(result["observationEligible"], "stderr-exact-cap")
for name, count in (("stdout", 32769), ("stderr", 65537)):
    args = {name: [b"x" * count], "code": None}
    result, child, _, _ = run(**args)
    need(not result["observationEligible"] and result["streams"][name]["overflow"]
         and child.kills == 1, name + "-overflow-cancels")
for value in (None, "text", OSError("private detail")):
    result, child, _, _ = run([value], code=None)
    need(not result["observationEligible"] and result["streams"]["stdout"]["error"]
         and child.kills == 1, "reader-error-" + type(value).__name__)
result, _, calls, _ = run(before=10.0)
need(not calls and not result["observationEligible"], "expired-before-spawn")
result, child, _, _ = run(code=None, spawn_delay=10.1)
need(child.kills == 1 and not result["observationEligible"], "late-spawn-contained-without-reset")
result, child, _, _ = run(code=None, spawn_delay=15.1)
need(child.kills == 1 and not child.waits and not result["observationEligible"], "late-total-no-unbounded-wait")
result, child, _, clock = run(code=None)
need(child.kills == 1 and clock.now <= 15 and not result["observationEligible"], "polling-action-cutoff")
result, _, _, _ = run(code=False)
need(not result["observationEligible"], "boolean-exit-refused")


class Unsettled(Thread):
    def start(self):
        pass

    def is_alive(self):
        return True


result, child, _, _ = run(factory=Unsettled)
need(result["streams"] is None and not child.stdout.closed and not result["observationEligible"],
     "unsettled-reader-no-snapshot-or-close")

wrapper = (ROOT / "run-supervised.py").read_bytes()
parsed = ast.parse(wrapper)
need(not any(isinstance(node, ast.Assert) for node in ast.walk(parsed)), "explicit-refusals-not-asserts")
need(all(isinstance(node, (ast.Import, ast.ImportFrom, ast.Assign, ast.FunctionDef, ast.If))
         or isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant)
         for node in parsed.body), "wrapper-top-level-declarations-only")
need(b"HOLD: source review only" in wrapper and b"__name__" in wrapper, "native-cli-unadmitted")
need(b"subprocess.Popen" in wrapper and b"shell=False" in wrapper and b"bufsize=0" in wrapper,
     "concrete-native-adapter-present-unrun")
need(b"destination.mkdir(exist_ok=False)" in wrapper and b'.open("xb")' in wrapper,
     "exclusive-evidence-allocation")
need(b"inventory.hash_file" in wrapper and b"inventory.identity" in wrapper,
     "canonical-identity-owner-reused")
need(b".read_bytes(" not in wrapper and b"1048577 - count" in wrapper
     and b"json_open_identity_changed" in wrapper and b"json_named_file_changed" in wrapper,
     "bounded-json-opened-and-named-bracket")
entry = next(node for node in parsed.body if isinstance(node, ast.FunctionDef) and node.name == "run_supervised")
text_entry = ast.unparse(entry)
need(text_entry.index("HOLD_unresolved_exact_preservation_records") < text_entry.index("inventory.Filesystem")
     and text_entry.index("HOLD_unresolved_native_git_identity") < text_entry.index("inventory.Filesystem"),
     "unresolved-records-helper-refuse-before-native-ports")
need(b'["git",' not in wrapper and b"[GIT_EXECUTABLE," in wrapper,
     "no-ambient-git-fallback")
print(json.dumps({"checksPassed": len(checks), "checks": checks,
                  "lifecycleSha256": hashlib.sha256(raw).hexdigest(),
                  "wrapperSha256": hashlib.sha256(wrapper).hexdigest(),
                  "mechanism": "AST-isolated new lifecycle definitions with inert Python objects only",
                  "nativeProcesses": 0, "realThreads": 0, "targetImports": 0,
                  "actualSupervisorExecuted": False, "runtimeAccepted": False}, indent=2))
