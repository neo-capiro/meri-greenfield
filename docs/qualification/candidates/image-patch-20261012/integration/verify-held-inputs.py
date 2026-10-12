#!/usr/bin/env python3
"""Read preserved Git objects; emit a receipt. Exit 0 verified, 1 failure, 2 usage."""
import argparse
import collections
import hashlib
import json
import subprocess

REF = "28fbfc7e40799fdb4e59eabd35c5b9bf80f117d9"
PREFIX = "docs/qualification/aws-shipper-20261011-r1/"
EXPECTED = {
    "captures/ecr-canonical-repaired-scan/stdout.bin":
        (59680, "3e7a92a7e8a876b5468b5495f3b415c8d0728ee8b28af69f21b175f60ea4e127"),
    "historical-artifacts/00-image-inventory.json":
        (5684552, "6b7675aa90422a9572a902012cebef87c78af7c6669f9b1fed20668e1b17c74c"),
    "historical-artifacts/01-os-installed-packages.txt":
        (8570, "1fa4f64de64341e41eb02988cb362a393102949122b331a44334049aee121c83"),
    "historical-reconciliation.json":
        (40866, "939be78af9316ae5679c5e4ea6f78cd97b15a203c7808319de36fd8fa67feb79"),
}


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    objects = {}
    receipts = []
    for suffix, (size, sha256) in EXPECTED.items():
        data = subprocess.run(
            ["git", "show", REF + ":" + PREFIX + suffix], check=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15,
        ).stdout
        actual = hashlib.sha256(data).hexdigest()
        assert len(data) == size and actual == sha256, suffix
        objects[suffix] = data
        receipts.append({"path": PREFIX + suffix, "bytes": size, "sha256": actual})

    scan = json.loads(objects["captures/ecr-canonical-repaired-scan/stdout.bin"])
    findings = scan["imageScanFindings"]["findings"]
    counts = dict(collections.Counter(row["severity"] for row in findings))
    assert len(findings) == 47
    assert len({row["name"] for row in findings}) == 47
    assert counts == {"CRITICAL": 5, "HIGH": 17, "MEDIUM": 17, "LOW": 7, "UNDEFINED": 1}
    assert counts == scan["imageScanFindings"]["findingSeverityCounts"]
    assert scan["imageScanStatus"]["status"] == "COMPLETE"
    assert not scan.get("nextToken")
    digest = "sha256:8d1ec09aa78f47a11019089dacde93289fc66a39f55bd4357e59eeb25d9b52ac"
    assert scan["imageId"]["imageDigest"] == digest

    inventory = json.loads(objects["historical-artifacts/00-image-inventory.json"])
    assert len(inventory["entries"]) == 26901
    packages = objects["historical-artifacts/01-os-installed-packages.txt"].decode().splitlines()
    assert len(packages) == 325 and all("=" in row for row in packages)
    print(json.dumps({
        "status": "PRESERVED_INPUTS_VERIFIED", "sourceCommit": REF,
        "objects": receipts, "heldImageDigest": digest,
        "heldScanCount": len(findings), "heldScanSeverityCounts": counts,
        "heldScanCompletedAt": scan["imageScanFindings"]["imageScanCompletedAt"],
        "heldScanNames": sorted(row["name"] for row in findings),
        "binaryPackageRows": len(packages),
        "inventoryEntryTypes": dict(collections.Counter(row["type"] for row in inventory["entries"])),
        "inventoryDeclaredCoverage": inventory["coverage"],
        "limitations": [
            "Historical preserved evidence; no current scan or image operation performed.",
            "Binary package names do not independently establish source-package mapping.",
            "Inventory hashes are not license bodies or proof of whole-image absence.",
            "The separate upstream matrix carries all 54 current and historical obligations.",
        ],
        "imageLaunchAuthorized": False, "buildAuthorized": False,
        "runtimeAccepted": False, "g1Accepted": False,
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
