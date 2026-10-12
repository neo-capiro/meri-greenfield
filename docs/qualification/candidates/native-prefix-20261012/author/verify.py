"""Offline retained-evidence verifier. No target imports, process launch or network.

Usage: python -I -B -S docs/qualification/candidates/native-prefix-20261012/author/verify.py
Exit 0: retained source/metadata assertions pass; exit 1: assertion fails.
Passing this verifier does not admit artifacts, setup, database or runtime work.
"""
import argparse
import hashlib
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    here = Path(__file__).resolve().parent
    root = here.parents[4]
    checks = []

    def check(name, value):
        checks.append({"name": name, "passed": bool(value)})

    def digest(path):
        return hashlib.sha256(path.read_bytes()).hexdigest()

    packet = json.loads((here / "assessment.json").read_text())
    manifest = json.loads((here / "manifest.json").read_text())
    for row in manifest["files"]:
        path = root / row["path"]
        check("file hash: " + row["path"], digest(path) == row["sha256"])
        check("file bytes: " + row["path"], path.stat().st_size == row["bytes"])
    for row in packet["sourceBindings"]:
        path = root / row["path"]
        check("frozen source: " + row["path"], digest(path) == row["sha256"]
              and path.stat().st_size == row["bytes"])
    retrievals = json.loads((here / "retrievals.json").read_text())
    for row in retrievals:
        path = here / row["path"]
        check("retrieval body: " + row["name"], digest(path) == row["sha256"]
              and path.stat().st_size == row["bytes"])
        check("retrieval cap: " + row["name"], row["bytes"] <= row["limitBytes"])
    receipt = json.loads((here / "host-dependency-query.json").read_text())
    check("read-only package query", receipt["argv"][:2] == ["dpkg-query", "-W"])
    check("missing dependency exit retained", receipt["exitCode"] == 1)
    for stream, row in receipt["streams"].items():
        path = here / row["path"]
        check("package query " + stream, digest(path) == row["sha256"]
              and path.stat().st_size == row["bytes"])
    check("external input decision", packet["decision"] == "HOLD_EXTERNAL_INPUT")
    check("inert candidate", packet["executionStatus"] == "NOT_EXECUTABLE")
    for key in ["targetPayloadAcquired", "targetPayloadExtracted", "targetRuntimeExecuted", "qualificationExecuted"]:
        check(key, packet[key] is False)
    check("no setup command", packet["authority"]["setupCommand"] is None)
    check("no setup approval", packet["authority"]["setupApprovalRequested"] is False)
    check("no L1 approval", packet["authority"]["l1ApprovalRequested"] is False)
    check("no invented signatures", packet["metadataPrerequisites"]["InRelease"]["signatureVerification"]
          == "UNRUN_MISSING_RAW_INPUTS")
    check("rendered metadata not authentication", packet["metadataPrerequisites"]["renderedHashesAreNotAuthenticated"])
    check("two package leads only", len(packet["packageLeads"]) == 2
          and all(row["sha256"] is None for row in packet["packageLeads"]))
    check("listed subtotal", sum(row["listedBytes"] for row in packet["packageLeads"])
          == packet["twoPackageListedBytesSubtotal"] == 18737216)
    check("subtotal not closure", packet["subtotalIsClosureOrDownloadApproval"] is False)
    check("conditional relocation retained", packet["relocation"]["status"] == "NOT_SUBSTANTIATED_NOT_PROVEN_IMPOSSIBLE")
    for needle in ["make_relative_path", "goto no_match", "strlcpy(ret_path, target_path"]:
        check("upstream path mechanism: " + needle, needle in (here / "raw/postgres17-path.c").read_text())
    check("Python native loader retained", "ctypes.cdll.LoadLibrary(libname)" in
          (here / "raw/psycopg333-libpq-ctypes.py").read_text())
    wheels = packet["pythonDriver"]["wheels"]
    check("two wheel metadata records", len(wheels) == 2)
    check("Python bytes subtotal", sum(row["bytes"] for row in wheels)
          == packet["pythonDriver"]["wheelBytesSubtotal"] == 257382)
    for row in wheels:
        metadata = json.loads((here / row["metadata"]).read_text())
        wheel = next(item for item in metadata["urls"] if item["filename"] == row["file"])
        check("wheel metadata: " + row["file"], wheel["digests"]["sha256"] == row["sha256"]
              and wheel["size"] == row["bytes"] and wheel["url"] == row["url"])
        check("wheel unacquired: " + row["file"], row["payloadAcquired"] is False)
    lock = json.loads((root / packet["nodeDriver"]["canonicalLock"]).read_text())
    nodes = packet["nodeDriver"]["packages"]
    check("all14 locked Node packages retained", len(nodes) == packet["nodeDriver"]["packageCount"]
          == len(lock["packages"]) - 1 == 14)
    for row in nodes:
        expected = lock["packages"][row["canonicalLockPath"]]
        metadata = json.loads((here / row["registryMetadata"]).read_text())
        check("Node registry+lock: " + row["name"],
              row["version"] == metadata["version"] == expected["version"]
              and row["integrity"] == metadata["dist"]["integrity"] == expected["integrity"]
              and row["tarballUrl"] == metadata["dist"]["tarball"] == expected["resolved"])
        check("Node unacquired: " + row["name"], row["payloadAcquired"] is False)
    result = {"scope": "OFFLINE_METADATA_AND_SOURCE_ONLY", "passed": sum(r["passed"] for r in checks),
              "failed": sum(not r["passed"] for r in checks), "checks": checks,
              "setupAndRuntime": "HOLD_EXTERNAL_INPUT_NOT_EXECUTABLE"}
    print(json.dumps(result, indent=2))
    return 0 if result["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
