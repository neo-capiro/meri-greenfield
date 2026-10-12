"""Independent, offline packet integrity review; no image or external calls."""
from pathlib import Path
import collections, hashlib, json, subprocess
BASE = "90b4dc8472da13cdee9f49cdc0b4c8306ecbdc73"
AUTHOR = "9aff2d9e1e125fe9e0fc4d2e7bef49d7ff623d53"
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
A = Path("/workspace/meri-image-patch-author-20261012")
U = Path("/workspace/meri-image-upstream-evidence-20261012")
P = Path("/workspace/meri-image-source-preparation-20261012")
PREFIX = Path("docs/qualification/candidates/image-patch-20261012")
def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, timeout=15)
def sha(data):
    return hashlib.sha256(data).hexdigest()
def require(value, name):
    if not value: raise ValueError(name)
def load(path):
    return json.loads(path.read_bytes())
require(subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=A).decode().strip() == AUTHOR, "exact_author_freeze")
changed = git("diff", "--name-status", BASE, AUTHOR).decode().splitlines()
require(all(line.startswith("A\t") and line.split("\t", 1)[1].startswith("docs/") for line in changed), "all_existing_source_and_guards_unchanged")
base_count = len(git("ls-tree", "-r", "--name-only", BASE).splitlines())
verification = load(A / PREFIX / "author/author-verification.json")
for name, record in verification["evidence"].items():
    data = (A / PREFIX / "author" / name).read_bytes()
    require(len(data) == record["bytes"] and sha(data) == record["sha256"], "author_evidence_" + name)
require((A / PREFIX / "author/baseline-context-a.manifest.json").read_bytes() == (HERE / "context-manifest.json").read_bytes(), "independent_author_manifest_equal")
matrix_path = U / PREFIX / "upstream/upstream-matrix.json"
matrix = load(matrix_path)
rows = matrix["rows"]
scan = json.loads(git("show", "28fbfc7e40799fdb4e59eabd35c5b9bf80f117d9:docs/qualification/aws-shipper-20261011-r1/captures/ecr-canonical-repaired-scan/stdout.bin"))["imageScanFindings"]["findings"]
old = {"CVE-2026-" + x for x in ["95619", "78410", "78408", "76642", "78409", "107708", "107778"]}
require(len(rows) == 54 and len({r["cve"] for r in rows}) == 54, "unique54")
require({r["cve"] for r in rows} == {r["name"] for r in scan} | old, "exact_union54")
by_cve = {r["cve"]: r for r in rows}
for original in scan:
    attrs = {a["key"]: a["value"] for a in original["attributes"]}
    row = by_cve[original["name"]]
    require((row["cohort"], row["scannerSeverity"], row["scannerSourcePackage"], row["scannerSourceVersion"]) == ("CURRENT_47", original["severity"], attrs["package_name"], attrs["package_version"]), "exact47_" + original["name"])
for row in rows:
    ref = row["cohortEvidence"]
    raw = git("show", ref["commit"] + ":" + ref["path"])
    require(len(raw) == ref["bytes"] and sha(raw) == ref["sha256"], "row_provenance_" + row["cve"])
    require(row["cve"] in raw.decode(), "row_mentioned_in_preserved_basis")
    require(row["acceptedImageDisposition"] == "OPEN" and row["signedSnapshotCompatibility"] == "UNVERIFIED" and row["debianTrixie"]["fixedVersionVerified"] is None, "no_row_closed")
require(matrix["approvedRecipeDelta"] is None and matrix["approvedSnapshotDelta"] is None and matrix["executionAdmission"] == "NOT_EXECUTABLE", "no_admission")
helper = P / PREFIX / "integration/verify-held-inputs.py"
expected = P / PREFIX / "integration/held-inputs-verification.json"
require(load(HERE / "final-parent-held-inputs.stdout.txt") == load(expected), "parent_receipt_exact_replay")
print(json.dumps({"verdict": "ACCEPT_SOURCE_PREPARATION", "patchedImage": "HOLD", "authorCommit": AUTHOR, "allBaseFilesUnchanged": base_count, "authorEvidenceFilesHashVerified": len(verification["evidence"]), "all54CohortEvidenceHashVerified": True, "exactOriginal47": True, "oldAndOmittedRetained": sorted(old), "imageDispositions": dict(collections.Counter(r["acceptedImageDisposition"] for r in rows)), "sidStatus": dict(collections.Counter(r["debianSid"]["status"] for r in rows)), "matrixSha256": sha(matrix_path.read_bytes()), "parentVerifierSha256": sha(helper.read_bytes()), "parentReceiptSha256": sha(expected.read_bytes()), "runtimeAccepted": False, "buildAuthorized": False}, indent=2))
