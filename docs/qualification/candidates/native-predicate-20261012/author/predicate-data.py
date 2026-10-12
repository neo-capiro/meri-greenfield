"""Content-free analysis of the exact recorded observation, never a native gate.

This owns only JSON arithmetic. It does not implement or assume the private
NativeMetadata.cs Same/Hash methods and never imports or executes those sources.
Pass the restricted pinned-members directory to read the two exact known files.
"""
import hashlib
import json
from pathlib import Path
import sys

PINS = {
    "candidate-hash-and-paths.json": (60160, "1817c1d72c2bbfafba943d0cbff4314ac210694a481565b5036a986087659d84"),
    "collect.ps1": (23776, "729298afadd57a97fe8325ff862d0e208befd9392b4befa5f91053dddfcd25e1"),
}
ROLES = ("executable", "root", "Lib", "DLLs")
IDENTITY_FIELDS = ("VolumeSerialHex", "FileId128Hex", "Attributes", "ReparseTag", "Directory", "DeletePending")


def direct_changes(left, right):
    """Exact JSON field differences; this is explicitly not private Same."""
    return sorted(key for key in set(left) | set(right)
                  if key not in left or key not in right
                  or type(left[key]) is not type(right[key]) or left[key] != right[key])


def aggregate(hash_present, hash_stable, identity_stable, all_fields_stable):
    """Four conjuncts visible at collector line94, with no omitted predicate."""
    return all(value is True for value in
               (hash_present, hash_stable, identity_stable, all_fields_stable))


def analyze(record):
    rows = []
    changed_names = set()
    for role in ROLES:
        before, after = record["before"][role], record["after"][role]
        equal_count = len(before["entries"]) == len(after["entries"])
        base = before["passed"] is True and after["passed"] is True and equal_count
        changes = []
        six_equal = base
        for index, (left, right) in enumerate(zip(before["entries"], after["entries"], strict=True)):
            changed = direct_changes(left, right)
            if changed:
                changed_names.add(left["Path"])
            changes.append({"ancestorIndexZeroBased": index, "changedFields": changed})
            six_equal = six_equal and not any(field in changed for field in IDENTITY_FIELDS)
        rows.append({"role": role, "entryCount": len(changes), "beforePassed": before["passed"],
                     "afterPassed": after["passed"], "sixFieldIdentityAndPlainMetadataStable": six_equal,
                     "exactJsonFieldsEqual": base and all(not row["changedFields"] for row in changes),
                     "pairs": changes})
    hash_record = record["hash"]
    pair_differences = []
    if hash_record is not None:
        pairs = [("opened-before/opened-after", hash_record["OpenedBefore"], hash_record["OpenedAfter"]),
                 ("opened-before/named-during", hash_record["OpenedBefore"], hash_record["NamedDuring"]),
                 ("named-before/opened-before", record["before"]["executable"]["entries"][-1], hash_record["OpenedBefore"]),
                 ("opened-after/named-after", hash_record["OpenedAfter"], record["after"]["executable"]["entries"][-1])]
        pair_differences = [{"pair": name, "changedFields": direct_changes(left, right)} for name, left, right in pairs]
    flags = {name: record[name] for name in ["executableBeforeOpenedAfterStable",
             "pathIdentityAndPlainMetadataStable", "allRecordedPathFieldsStable", "boundedHashObservationAccepted"]}
    recomputed = aggregate(hash_record is not None, flags["executableBeforeOpenedAfterStable"],
                           flags["pathIdentityAndPlainMetadataStable"], flags["allRecordedPathFieldsStable"])
    return {"roleComparisons": rows, "pairedEntries": sum(row["entryCount"] for row in rows),
            "changedPairs": sum(bool(pair["changedFields"]) for row in rows for pair in row["pairs"]),
            "uniqueChangedNamedPaths": len(changed_names), "hashRecordFieldDifferences": pair_differences,
            "reportedOutcomes": flags, "recomputedCollectorConjunction": recomputed,
            "conjunctionMatchesRecordedRejection": recomputed == flags["boundedHashObservationAccepted"],
            "privateSameDefinitionReviewed": False, "privateHashLifecycleReviewed": False,
            "directJsonEqualityIsPrivateSameProof": False, "nativeAdmission": False}


def controls():
    rows = []
    def check(name, condition):
        rows.append({"name": name, "passed": condition is True})
    check("all-four-conjuncts-required", aggregate(True, True, True, True))
    for index in range(4):
        values = [True] * 4
        values[index] = False
        check("false-conjunct-" + str(index) + "-refuses", not aggregate(*values))
    check("missing-hash-refuses", not aggregate(False, True, True, True))
    check("recorded-all-fields-failure-refuses", not aggregate(True, True, True, False))
    check("invalid-three-conjunct-control-would-accept", all([True, True, True]) is True and not aggregate(True, True, True, False))
    baseline = {name: "synthetic" for name in IDENTITY_FIELDS}
    baseline["LastAccessTime"] = 10
    check("identical-json-has-no-differences", direct_changes(baseline, baseline) == [])
    for field in IDENTITY_FIELDS:
        changed = dict(baseline, **{field: "changed"})
        check("detect-" + field, direct_changes(baseline, changed) == [field])
    changed = dict(baseline, LastAccessTime=11)
    check("access-time-difference-retained", direct_changes(baseline, changed) == ["LastAccessTime"])
    check("access-time-not-in-six-field-predicate", "LastAccessTime" not in IDENTITY_FIELDS)
    check("missing-field-detected", direct_changes({"Size": 1}, {}) == ["Size"])
    check("bool-is-not-integer-field-equality", direct_changes({"Size": True}, {"Size": 1}) == ["Size"])
    return rows


def main(directory):
    private = Path(directory)
    received = {}
    for name, (size, digest) in PINS.items():
        raw = (private / name).read_bytes()
        if len(raw) != size or hashlib.sha256(raw).hexdigest() != digest:
            raise ValueError("exact member identity mismatch: " + name)
        received[name] = raw
    result = analyze(json.loads(received["candidate-hash-and-paths.json"]))
    result["inputPins"] = [{"name": name, "bytes": size, "sha256": digest}
                           for name, (size, digest) in PINS.items()]
    result["controls"] = controls()
    result["passed"] = sum(row["passed"] for row in result["controls"])
    result["failed"] = sum(not row["passed"] for row in result["controls"])
    result["collectorExecuted"] = False
    print(json.dumps(result, indent=2))
    return 0 if result["failed"] == 0 and result["conjunctionMatchesRecordedRejection"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
