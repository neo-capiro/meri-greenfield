"""Independent Git/hash/source-metadata checks only; no private code execution."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
BASE = "4c40fb4c35d716dcd1e3b09ec29647ccca5a1326"
source = sys.argv[1]
checks = []


def git(*args, repo=ROOT):
    return subprocess.check_output(["git", "-C", str(repo), *args])


def check(name, passed):
    checks.append({"name": name, "passed": bool(passed)})


def tree(pin):
    return {part.split(b"\t", 1)[1].decode(): part.split(b"\t", 1)[0].decode()
            for part in git("ls-tree", "-r", "-z", pin).split(b"\0") if part}


baseline, candidate = tree(BASE), tree(source)
check("all7161 baseline blobs preserved", len(baseline) == 7161 and all(candidate.get(p) == blob for p, blob in baseline.items()))
owned_source = ["packages/contracts/retrieval-0.2/outreach-query.schema.json",
                "packages/contracts/retrieval-0.2/outreach-query-validation.mjs",
                "packages/contracts/test/retrieval-outreach-query.test.mjs"]
check("only three package additions", sorted(p for p in set(candidate) - set(baseline) if p.startswith("packages/")) == sorted(owned_source))
for path in owned_source:
    raw = git("show", source + ":" + path)
    check(path + " exact working source", raw == (ROOT / path).read_bytes())
ref = json.loads((HERE / "reference-identities.json").read_text())
for row in ref["references"]:
    check(row["path"] + " pinned no drift", row["unchanged"])
    for version in row["versions"]:
        raw = git("show", version["pin"] + ":" + row["path"], repo="/workspace/capirov2")
        check(row["path"] + " " + version["pin"][:8], len(raw) == version["bytes"] and hashlib.sha256(raw).hexdigest() == version["sha256"])
schema = json.loads((ROOT / owned_source[0]).read_text())
check("private namespace", schema["$id"] == "urn:meri:retrieval:outreach-query:0.2.0")
body = (ROOT / owned_source[1]).read_text()
check("canonical inert snapshot owner used", "snapshotOperationData" in body and "./operation-contracts.mjs" in body)
check("no private implementation import", "@capiro/" not in body and "apps/api/" not in body)
result = {"scope": "SOURCE_AND_DATA_METADATA_ONLY", "sourceCommit": source,
          "sourceTree": git("rev-parse", source + "^{tree}").decode().strip(),
          "baselineCount": len(baseline), "pairedReferenceCount": len(ref["references"]),
          "passed": sum(row["passed"] for row in checks), "failed": sum(not row["passed"] for row in checks), "checks": checks}
(HERE / "audit-results.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
raise SystemExit(1 if result["failed"] else 0)
