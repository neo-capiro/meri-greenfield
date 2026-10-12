"""Verify retained metadata evidence offline; no retrieval or target execution.

Usage: python -I -B -S docs/qualification/candidates/pgdg-metadata-20261012/author/verify.py
Exit0: checks pass; exit1: evidence or preserved-source assertion fails.
"""
import argparse
import hashlib
import json
from pathlib import Path


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    here = Path(__file__).resolve().parent
    root = here.parents[4]
    checks = []

    def check(name, value):
        checks.append({"name": name, "passed": bool(value)})

    def sha(path):
        return hashlib.sha256(path.read_bytes()).hexdigest()

    packet = json.loads((here / "decision-package.json").read_text())
    manifest = json.loads((here / "manifest.json").read_text())
    for row in manifest["files"]:
        path = root / row["path"]
        check("artifact: " + row["path"], sha(path) == row["sha256"] and path.stat().st_size == row["bytes"])
    for row in packet["preservedSourceBindings"]:
        path = root / row["path"]
        check("preserved: " + row["path"], sha(path) == row["sha256"] and path.stat().st_size == row["bytes"])
    receipts = json.loads((here / "retrievals.json").read_text())
    check("bounded8 requests", len(receipts["records"]) == 8 and receipts["maxConcurrentRequests"] == 4)
    for row in receipts["records"]:
        path = here / row["path"]
        check("exact failure: " + row["name"], row["bytes"] == path.stat().st_size == 0
              and row["sha256"] == sha(path)
              and row["error"] == "<urlopen error Tunnel connection failed: 403 Forbidden>")
        check("bounded metadata: " + row["name"], row["url"].startswith(("https://apt.postgresql.org/", "https://www.postgresql.org/"))
              and row["perResponseCapBytes"] == 1500000 and row["socketTimeoutSeconds"] == 10
              and row["startedAt"] <= row["endedAt"])
    web = json.loads((here / "web-fallback.json").read_text())
    check("rendered not raw", web["kind"] == "SUPPORTED_WEB_TOOL_RENDERED_OUTPUT_NOT_ORIGIN_BYTES")
    check("source decision", packet["decision"] == "HOLD_EXTERNAL_INPUT" and packet["executionStatus"] == "NOT_EXECUTABLE")
    check("no signature claim", packet["researchDelta"]["signatureVerification"] == "UNRUN_MISSING_RAW_INPUTS_AND_TRUST")
    check("no unsupported prefix claim", packet["researchDelta"]["newBuildOrPrefixSupport"] == "NONE_ESTABLISHED")
    check("no setup approval or command", packet["nextSetupDecision"]["setupApprovalRequested"] is False
          and packet["nextSetupDecision"]["setupCommand"] is None)
    for key in ["targetPayloadAcquired", "targetPayloadHeadersAcquired", "targetMaterializedInstalledImportedExecuted", "hostChanged", "databaseOrNativeActions", "cloudProviderPaidActions"]:
        check(key, packet[key] is False)
    proposed = packet["externalDecisionPackage"]
    check("metadata groups", len(proposed["rawMetadataGroups"]) == 6)
    check("bounded proposed intake", proposed["maxRawMetadataMembers"] == 7
          and proposed["maxTotalMembersIncludingProvenanceAndSupportProfile"] == 9
          and proposed["maxDecodedTransferBytes"] == 4194304
          and proposed["maxIndividualMetadataBytes"] == 1500000)
    for row in proposed["rawMetadataGroups"]:
        for url in row["urls"]:
            check("not target payload: " + url, not url.endswith((".deb", ".whl", ".tar.gz", ".tar.xz", ".zip")))
    result = {"scope": "OFFLINE_METADATA_AND_SOURCE_PRESERVATION_ONLY", "passed": sum(row["passed"] for row in checks),
              "failed": sum(not row["passed"] for row in checks), "checks": checks,
              "setupAndRuntime": "HOLD_EXTERNAL_INPUT_NOT_EXECUTABLE"}
    print(json.dumps(result, indent=2))
    return 0 if result["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
