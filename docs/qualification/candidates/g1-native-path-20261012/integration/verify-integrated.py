"""Offline source/evidence integrity; does not import qualification targets."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
BASE = "e8d2c0d0e5db8fb01ba2df26c4eb3f79b296c0b5"
checks = []


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def record(name, condition):
    checks.append({"name": name, "passed": bool(condition)})


def digest(data):
    return hashlib.sha256(data).hexdigest()


def verify_file(path, expected):
    data = (ROOT / path).read_bytes()
    record(path, len(data) == expected["bytes"] and digest(data) == expected["sha256"])


manifests = [
    "native-supervisor-20261012/author/current-manifest.json",
    "native-supervisor-20261012/review/review-manifest.json",
    "g1-budget-native-tests-20261012/review/manifest-final.json",
    "g1-native-path-20261012/review/manifest.json",
    "g1-native-path-20261012/review/final-delta/manifest.json",
]
manifest_receipts = []
for suffix in manifests:
    path = Path("docs/qualification/candidates") / suffix
    data = (ROOT / path).read_bytes()
    parsed = json.loads(data)
    entries = parsed["files"]
    if isinstance(entries, dict):
        entries = [{"path": str(path.parent / name), **value} for name, value in entries.items()]
    for entry in entries:
        verify_file(entry["path"], entry)
    manifest_receipts.append({"path": str(path), "bytes": len(data), "sha256": digest(data), "files": len(entries)})

native_dir = "docs/qualification/candidates/native-supervisor-20261012/author/"
budget_dir = "apps/gateway/test/"
accepted = {
    "724850cb6cc84c8381fb52aec23b582e0e3b5872": [native_dir + name for name in ["run-supervised.py", "supervision.py", "source-checks.py"]],
    "ea7b0bae9b630f750f7f329a144f3cc34f959b00": [budget_dir + name for name in ["postgres-budget-admission.test.mjs", "postgres-budget-child.mjs", "postgres-budget-native-fixture.mjs", "postgres-budget.integration.mjs"]] + ["apps/gateway/budget/README.md"],
}
source_receipts = []
for commit, paths in accepted.items():
    for path in paths:
        current = (ROOT / path).read_bytes()
        record("accepted source " + path, current == git("show", commit + ":" + path))
        source_receipts.append({"path": path, "commit": commit, "bytes": len(current), "sha256": digest(current)})

original = git("ls-tree", "-r", "--name-only", BASE).decode().splitlines()
unchanged = [path for path in original if (ROOT / path).read_bytes() == git("show", BASE + ":" + path)]
changed = sorted(set(original) - set(unchanged))
record("all original files preserved except explicit budget README addition", changed == ["apps/gateway/budget/README.md"])

plan = ROOT / "docs/plans/MERI-G1-SOURCE-TO-NATIVE.md"
links = []
for target in re.findall(r"\]\(([^)]+)\)", plan.read_text()):
    if not target.startswith(("https://", "http://", "#")):
        resolved = (plan.parent / target.split("#", 1)[0]).resolve()
        links.append({"target": target, "exists": resolved.is_file()})
record("all final plan local links", all(item["exists"] for item in links))
record("exact independently accepted plan", digest(plan.read_bytes()) == "9e786e216e6c43de8202d7bd407975fc70987e53bd87ff2a9fc01840de094f04")

captures = []
for path in sorted(OUT.glob("*.json")):
    receipt = json.loads(path.read_text())
    if not isinstance(receipt, dict) or "ownedPidAndPgid" not in receipt:
        continue
    for stream in receipt["streams"]:
        verify_file(stream["path"], stream)
    good = receipt["exitCode"] == 0 and receipt["ownedProcessGroupAbsent"] and not receipt["timedOut"]
    record("capture complete " + path.name, good)
    captures.append({"path": str(path.relative_to(ROOT)), "exitCode": receipt["exitCode"], "ownedProcessGroupAbsent": receipt["ownedProcessGroupAbsent"]})

report = {
    "scope": "OFFLINE_SOURCE_INTEGRITY_ONLY_NOT_RUNTIME_ADMISSION",
    "sourceHead": git("rev-parse", "HEAD").decode().strip(),
    "base": BASE, "originalFiles": len(original), "originalFilesUnchanged": len(unchanged),
    "originalFilesChanged": changed, "acceptedSources": source_receipts,
    "manifests": manifest_receipts, "planSha256": digest(plan.read_bytes()),
    "planLinks": links, "completedCaptures": captures, "checks": checks,
    "passed": sum(item["passed"] for item in checks),
    "failed": sum(not item["passed"] for item in checks),
    "nativeTargetImportsOrExecution": False, "g1Accepted": False,
}
print(json.dumps(report, indent=2))
raise SystemExit(1 if report["failed"] else 0)
