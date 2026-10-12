#!/usr/bin/env python3
"""Offline hashes and packet membership only; no command/runtime imports."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
MANIFEST = HERE / "manifest.json"
REPORT = "docs/coordination/reports/CODEX-COMMAND-CONTRACTS-INTEGRATION-REVIEW-20261012.md"
TEST = "packages/contracts/test/command-contracts-integration-independent.test.mjs"
EXCLUDED = {"manifest.json", "packet-verification.json"}


def verify():
    manifest = json.loads(MANIFEST.read_text())
    checks = []

    def check(name, passed):
        checks.append({"name": name, "passed": bool(passed)})

    entries = manifest["entries"]
    names = [row["path"] for row in entries]
    check("unique safe member names", len(names) == len(set(names)) and all(
        not Path(name).is_absolute() and ".." not in Path(name).parts for name in names))
    expected = sorted([str(path.relative_to(ROOT)) for path in HERE.iterdir()
                       if path.is_file() and path.name not in EXCLUDED] + [REPORT, TEST])
    check("exact allocated packet membership", sorted(names) == expected)
    check("exact source binding", manifest["sourceCommit"] == "5fca98580c5d93c9f9aa4a3ed518e926e087846c"
          and manifest["sourceTree"] == "f242534f5a55495a0d0f421eb97c2fd746d88748")
    for row in entries:
        raw = (ROOT / row["path"]).read_bytes()
        check(row["path"], len(raw) == row["bytes"] and hashlib.sha256(raw).hexdigest() == row["sha256"])
    for label in ["connected-first", "source-audit"]:
        receipt = json.loads((HERE / (label + ".json")).read_text())
        check(label + " successful bounded capture", receipt["exitCode"] == 0
              and receipt["sourceDiffBytes"] == 0 and not receipt["timedOut"]
              and receipt["ownedProcessGroupAbsent"])
        for stream in receipt["streams"]:
            raw = (ROOT / stream["path"]).read_bytes()
            check(stream["path"] + " receipt binding", len(raw) == stream["bytes"]
                  and hashlib.sha256(raw).hexdigest() == stream["sha256"])
    cleanup = json.loads((HERE / "cleanup.json").read_text())
    check("owned cleanup recorded", cleanup["ownedDependenciesRemoved"]
          and all(row["absent"] for row in cleanup["ownedGroups"]))
    result = {"scope": "OFFLINE_PACKET_VERIFICATION_ONLY", "sourceCommit": manifest["sourceCommit"],
              "manifestSha256": hashlib.sha256(MANIFEST.read_bytes()).hexdigest(),
              "memberCount": len(entries), "passed": sum(row["passed"] for row in checks),
              "failed": sum(not row["passed"] for row in checks), "checks": checks}
    (HERE / "packet-verification.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({key: value for key, value in result.items() if key != "checks"}))
    return 1 if result["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(verify())
