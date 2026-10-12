"""Data/AST consistency checks; never imports or executes inspected sources.

Run from repository root with the restricted staging directory as the sole arg.
Output contains check names only. No native target, path value or body is printed.
"""
import ast
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path.cwd()
HERE = Path(__file__).resolve().parent
PRIVATE = Path(sys.argv[1])
results = []


def check(name, predicate):
    results.append({"name": name, "passed": bool(predicate)})


def load(path):
    return json.loads(path.read_bytes())


def matches(path, row):
    raw = path.read_bytes()
    return len(raw) == row["bytes"] and hashlib.sha256(raw).hexdigest() == row["sha256"]


mapping = load(HERE / "exact-inputs.json")
staging = load(HERE / "staging-inventory.json")
manifest = load(PRIVATE / "manifest.relay.json")
provenance = load(PRIVATE / "provenance-and-bindings.verified.json")
review = load(PRIVATE / "supervisor-source-review.verified.json")
proposal = load(PRIVATE / "proposal-relayed.json")
derivative = load(PRIVATE / "visible-candidate-differences.derived.json")
wrapper = ast.parse((ROOT / "docs/qualification/candidates/native-supervisor-20261012/author/run-supervised.py").read_text())
inventory = ast.parse((ROOT / "scripts/qualification/worker_runner_inventory.py").read_text())
private_source = ast.parse((PRIVATE / "supervisor-decoded.py.txt").read_text())
constants = {node.targets[0].id: ast.literal_eval(node.value) for node in wrapper.body
             if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)}
bind = next(node for node in wrapper.body if isinstance(node, ast.FunctionDef) and node.name == "bind")
action_keys = next(ast.literal_eval(node.value) for node in bind.body
                   if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "names" for t in node.targets))
mapped_keys = {row["actionKey"] for row in mapping["wrapperConsumedRecords"]}
mapped_keys |= {row["field"] for row in mapping["remainingActionFields"]} | {"selectedExecutable"}
check("exact-nine-action-keys", mapped_keys == action_keys and len(action_keys) == 9)
check("all-five-missing-pins-remain-none", all(constants[name] is None for name in
      ["SOURCE_VERIFICATION_SHA256", "PRIOR_MANIFEST_SHA256", "GIT_EXECUTABLE", "GIT_EXECUTABLE_SHA256", "GIT_EXECUTABLE_BYTES"]))
check("local-staging-membership", sorted(p.name for p in PRIVATE.iterdir()) == sorted(r["name"] for r in staging["files"]) and len(staging["files"]) == mapping["localStagedFileCount"])
check("local-staging-byte-identities", all(matches(PRIVATE / r["name"], r) for r in staging["files"]))
member_rows = {row["name"]: row for row in manifest["files"]}
check("packet-thirteen-name-rows-not-paths", len(member_rows) == 13 and all(set(row) == {"name", "bytes", "sha256"} for row in manifest["files"]) and manifest["manifestSelfExcluded"] is True)
check("two-immediate-exact-pins", len(mapping["immediateMinimalRelay"]) == 2 and all(
      row["expectedBytes"] == member_rows[row["member"]]["bytes"] and row["expectedSha256"] == member_rows[row["member"]]["sha256"]
      for row in mapping["immediateMinimalRelay"]))
check("two-immediate-members-not-staged", all(not (PRIVATE / row["member"]).exists() for row in mapping["immediateMinimalRelay"]))
verified_paths = [PRIVATE / "supervisor-decoded.py.txt", PRIVATE / "supervisor-source-review.verified.json",
                  PRIVATE / "provenance-and-bindings.verified.json", ROOT / "docs/qualification/candidates/native-ancestor-diagnosis-20261012/inspect-ancestor-metadata.py"]
check("four-current-already-verified-identities", all(matches(path, row) for path, row in zip(verified_paths, mapping["alreadyVerifiedNoRelayNeeded"], strict=True)))
check("local-derivative-explicit-incompleteness", derivative["fullMemberPreservedOrVerified"] is False and derivative["actualComparisonSourceAvailable"] is False and derivative["relayHasLiteralTruncationMarker"] is True)
check("original-candidate-pointers-not-invented", mapping["immediateMinimalRelay"][0]["exactOriginalJsonPointersKnown"] is False)
receipt, source_record, prior = mapping["wrapperConsumedRecords"]
check("original-receipt-pin-distinct-from-ancestor", receipt["expectedBytes"] == provenance["originalCollectorReceipt"]["bytes"] == 1407 and receipt["expectedSha256"] == provenance["originalCollectorReceipt"]["sha256"] == constants["ORIGINAL_RECEIPT_SHA"] and member_rows["past-ancestor-command-receipt.json"]["bytes"] == 2206)
check("original-source-commit-tree", receipt["requiredValues"]["sourceCommit"] == constants["SOURCE_COMMIT"] == provenance["originalSourceCommit"] and receipt["requiredValues"]["sourceTree"] == constants["SOURCE_TREE"] == provenance["originalSourceTree"])
check("original-verification-identity-not-invented", source_record["expectedBytes"] is None and source_record["expectedSha256"] is None)
check("original-records-not-in-new-packet", not any(name in member_rows for name in [receipt["exactOriginalMember"], source_record["exactOriginalMember"], "source-and-input-verification.json"]))
supplier = prior["potentialExistingSupplier"]
check("prior-audit-reference-pin", supplier["referenceBytes"] == provenance["priorFullAuditReference"]["bytes"] == 42321 and supplier["referenceSha256"] == provenance["priorFullAuditReference"]["sha256"])
private_literals = {node.value for node in ast.walk(private_source) if isinstance(node, ast.Constant) and isinstance(node.value, str)}
check("current-source-writes-prior-list-fields", {"priorEvidenceFilesUnchanged", "priorEvidenceFileCount"} <= private_literals)
check("historical-wrapper-pin-not-inferred", review["historicalReceiptPinsWrapperSourceHash"] is False)
check("same-git-path-and-missing-identity-fields", provenance["currentGitPins"]["executable"] == provenance["currentTrackedStatus"]["executable"] and all(set(provenance[key]) == {"executable", "arguments", "exitCode", "stdout", "stderr", "timeoutSeconds"} for key in ["currentGitPins", "currentTrackedStatus"]))
check("selected-python-known-pin", mapping["executableBindings"]["selectedPython"]["knownBytes"] == constants["EXECUTABLE_BYTES"] and mapping["executableBindings"]["selectedPython"]["knownSha256"] == constants["EXECUTABLE_SHA"])
check("proposal-selector-argument-agreement", proposal["diagnosticSource"]["path"] == proposal["argv"][4] and proposal["repository"] == proposal["argv"][6] and proposal["originalOutput"] == proposal["argv"][8] and proposal["selectedExecutable"] == proposal["argv"][0])
identity = next(node for node in inventory.body if isinstance(node, ast.FunctionDef) and node.name == "identity")
attrs = {node.attr for node in ast.walk(identity) if isinstance(node, ast.Attribute)}
check("canonical-timestamps-distinct-from-private-comparison", {"st_mtime_ns", "st_ctime_ns"} <= attrs and "st_atime_ns" not in attrs and mapping["canonicalIdentityPredicates"]["excludedTimestampField"] == "st_atime_ns")
check("wrapper-creates-unused-destination", any(isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "mkdir" and any(key.arg == "exist_ok" and isinstance(key.value, ast.Constant) and key.value.value is False for key in node.keywords) for node in ast.walk(wrapper)) and "must not pre-exist" in mapping["remainingActionFields"][-1]["rule"])
check("mapping-preserves-hold", all(mapping[key] is False for key in ["admissionChanged", "privateBodiesPublished", "nativeExecution", "g1Accepted"]))
print(json.dumps({"method": "JSON data and AST parsing only; inspected sources never imported, compiled or executed", "passed": sum(row["passed"] for row in results), "failed": sum(not row["passed"] for row in results), "checks": results}, indent=2))
sys.exit(0 if all(row["passed"] for row in results) else 1)
