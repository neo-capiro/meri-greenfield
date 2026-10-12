"""Offline review packet hashes; no source/native imports or external actions."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
REPORT = "docs/coordination/reports/CODEX-OUTREACH-QUERY-REVIEW-20261012.md"
TEST = "packages/contracts/test/retrieval-outreach-query-independent.test.mjs"
EXCLUDED = {"manifest.json", "packet-verification.json"}


def main():
    manifest = json.loads((HERE / "manifest.json").read_text())
    checks = []

    def check(name, passed):
        checks.append({"name": name, "passed": bool(passed)})

    names = [row["path"] for row in manifest["entries"]]
    expected = sorted([str(p.relative_to(ROOT)) for p in HERE.iterdir()
                       if p.is_file() and p.name not in EXCLUDED] + [REPORT, TEST])
    check("safe unique exact packet membership", len(set(names)) == len(names)
          and sorted(names) == expected and all(not Path(n).is_absolute() and ".." not in Path(n).parts for n in names))
    check("accepted immutable source", manifest["sourceCommit"] == "51a296e7d4a1f3ecc2f2f844e3baeeb11f70962f"
          and manifest["sourceTree"] == "c8bccc24fefd239707389df8114157411dca4807")
    for row in manifest["entries"]:
        raw = (ROOT / row["path"]).read_bytes()
        check(row["path"], len(raw) == row["bytes"] and hashlib.sha256(raw).hexdigest() == row["sha256"])
    for label in ["focused-first", "source-audit"]:
        receipt = json.loads((HERE / (label + ".json")).read_text())
        check(label + " captured successfully", receipt["exitCode"] == 0 and receipt["sourceDiffBytes"] == 0
              and not receipt["timedOut"] and receipt["ownedProcessGroupAbsent"])
        for stream in receipt["streams"]:
            raw = (ROOT / stream["path"]).read_bytes()
            check(stream["path"] + " receipt binding", len(raw) == stream["bytes"]
                  and hashlib.sha256(raw).hexdigest() == stream["sha256"])
    check("source audit passed", json.loads((HERE / "audit-results.json").read_text())["failed"] == 0)
    check("author packet passed", json.loads((HERE / "author-packet-audit.json").read_text())["failed"] == 0)
    cleanup = json.loads((HERE / "cleanup.json").read_text())
    check("owned resources closed", cleanup["ownedDependenciesRemoved"] and all(x["absent"] for x in cleanup["ownedGroups"]))
    result = {"scope": "OFFLINE_PACKET_VERIFICATION_ONLY", "sourceCommit": manifest["sourceCommit"],
              "manifestSha256": hashlib.sha256((HERE / "manifest.json").read_bytes()).hexdigest(),
              "memberCount": len(names), "passed": sum(c["passed"] for c in checks),
              "failed": sum(not c["passed"] for c in checks), "checks": checks}
    (HERE / "packet-verification.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({key: value for key, value in result.items() if key != "checks"}))
    return 1 if result["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
