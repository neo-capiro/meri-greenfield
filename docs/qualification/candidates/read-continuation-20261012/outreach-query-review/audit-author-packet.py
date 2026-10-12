"""Read exact author Git objects and verify evidence without importing target code."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
PREFIX = "docs/qualification/candidates/read-continuation-20261012/outreach-query-author/"
SOURCE = "51a296e7d4a1f3ecc2f2f844e3baeeb11f70962f"
packet = sys.argv[1]
checks = []


def read(path, pin=packet):
    return subprocess.check_output(["git", "-C", str(ROOT), "show", pin + ":" + path])


def check(name, passed):
    checks.append({"name": name, "passed": bool(passed)})


manifest_bytes = read(PREFIX + "manifest.json")
manifest = json.loads(manifest_bytes)
entries = manifest["members"]
check("manifest source binding", manifest["source"] == SOURCE)
names = [row["path"] for row in entries]
check("unique safe author manifest members", len(names) == len(set(names))
      and all(not Path(name).is_absolute() and ".." not in Path(name).parts for name in names))
tracked = set(subprocess.check_output(["git", "-C", str(ROOT), "ls-tree", "-r", "--name-only", packet, "--", PREFIX], text=True).splitlines())
expected_extra = {"docs/coordination/reports/CODEX-OUTREACH-QUERY-AUTHOR-20261012.md", "packages/contracts/retrieval-0.2/outreach-query.schema.json", "packages/contracts/retrieval-0.2/outreach-query-validation.mjs", "packages/contracts/test/retrieval-outreach-query.test.mjs"}
check("complete author packet membership", set(names) == (tracked - {PREFIX + "manifest.json"}) | expected_extra)
for row in entries:
    raw = read(row["path"])
    check(row["path"], len(raw) == row["bytes"] and hashlib.sha256(raw).hexdigest() == row["sha256"])
for name in ["outreach-query.schema.json", "outreach-query-validation.mjs"]:
    path = "packages/contracts/retrieval-0.2/" + name
    check(name + " unchanged final packet source", read(path) == read(path, SOURCE))
    check(name + " unchanged through author fixture correction", read(PREFIX + "initial-source/" + name) == read(path, SOURCE))
test_path = "packages/contracts/test/retrieval-outreach-query.test.mjs"
check("author test unchanged final packet", read(test_path) == read(test_path, SOURCE))
captures = []
for label in ["focused-first", "focused-corrected", "focused-freeze", "source-audit", "source-audit-final"]:
    receipt = json.loads(read(PREFIX + label + ".json"))
    check(label + " bounded owned process cleanup", not receipt["timedOut"] and receipt["ownedProcessGroupAbsent"])
    for stream in receipt["streams"]:
        raw = read(stream["path"])
        check(stream["path"] + " receipt binding", len(raw) == stream["bytes"]
              and hashlib.sha256(raw).hexdigest() == stream["sha256"])
    captures.append({"label": label, "exitCode": receipt["exitCode"], "sourceHead": receipt["sourceHead"],
                     "sourceDiffBytes": receipt["sourceDiffBytes"], "ownedGroup": receipt["ownedPidAndPgid"]})
first = read(PREFIX + "focused-first.stdout.bin").decode()
fixed = read(PREFIX + "focused-freeze.stdout.bin").decode()
check("first author35pass2fail retained", "pass 35" in first and "fail 2" in first)
check("exact author37pass retained", "pass 37" in fixed and "fail 0" in fixed)
check("first failure exit retained", captures[0]["exitCode"] == 1)
check("successful final captures", all(row["exitCode"] == 0 for row in captures if row["label"] in ["focused-corrected", "focused-freeze", "source-audit-final"]))
result = {"scope": "EXACT_GIT_PACKET_METADATA_ONLY", "sourceCommit": SOURCE, "authorPacket": packet,
          "manifestSha256": hashlib.sha256(manifest_bytes).hexdigest(), "manifestMembers": len(entries),
          "captures": captures, "passed": sum(row["passed"] for row in checks),
          "failed": sum(not row["passed"] for row in checks), "checks": checks}
(HERE / "author-packet-audit.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({key: value for key, value in result.items() if key != "checks"}))
raise SystemExit(1 if result["failed"] else 0)
