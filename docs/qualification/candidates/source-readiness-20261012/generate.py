#!/usr/bin/env python3
"""Derive an offline evidence snapshot from immutable local Git objects.

Usage: python3 docs/qualification/candidates/source-readiness-20261012/generate.py [--check]
No network, cloud, provider, database, production import or runtime admission.
Exit 0: generated/exact; 1: --check drift; 2: missing/invalid pinned input.
Writes only the four named generated JSON files beside this script.
"""

import argparse
import collections
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
PINS = {
    "accepted": "5ee46446b5f60034916f00b2a665b3e2bef9cf60",
    "preservation": "c57b7d26df7de2acbd8c7d8edc7098f7d495053a",
    "shipper": "28fbfc7e40799fdb4e59eabd35c5b9bf80f117d9",
    "main": "8b123bea4c90794dc2d766814b6ddbdbfe0928bc",
}
EXPECTED_TREES = {
    "accepted": "985e0fdafe23d68b6f2e81a092cf098d8ede3182",
    "preservation": "66135fa4cc69de9fbae12d77b4cc3bc24305a074",
}


def need(condition, message):
    if not condition:
        raise ValueError(message)


def git(*args):
    env = dict(os.environ, GIT_NO_LAZY_FETCH="1", GIT_TERMINAL_PROMPT="0")
    return subprocess.check_output(["git", "-C", str(ROOT), *args], env=env)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encode(data):
    return (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode()


def derive():
    manifest = {}

    def source(key):
        alias, path = key.split(":", 1)
        ref = PINS[alias]
        raw = git("show", f"{ref}:{path}")
        manifest[key] = {
            "repository": "neo-capiro/meri-greenfield", "commit": ref,
            "path": path, "gitBlob": git("rev-parse", f"{ref}:{path}").decode().strip(),
            "bytes": len(raw), "sha256": sha(raw),
            "url": f"https://github.com/neo-capiro/meri-greenfield/blob/{ref}/{path}",
            "usage": "PINNED_BYTES; source inventory is not an independent implementation review",
        }
        return raw

    def load(key):
        return json.loads(source(key))

    refs = {}
    for alias, ref in PINS.items():
        tree = git("rev-parse", ref + "^{tree}").decode().strip()
        need(alias not in EXPECTED_TREES or tree == EXPECTED_TREES[alias], f"tree mismatch: {alias}")
        refs[alias] = {"commit": ref, "tree": tree, "observation": "LOCAL_IMMUTABLE_GIT_OBJECT; remote not refreshed by this author"}

    requirements_bytes = (HERE / "g1-requirements.json").read_bytes()
    requirements = json.loads(requirements_bytes)
    need(requirements["status"] == "NOT_EXECUTABLE", "requirements must remain non-executable")
    for row in requirements["requirements"]:
        for key in row["sources"]:
            source(key)
    for path in ["AGENTS.md", "docs/IMPLEMENTATION-STANDARDS.md", "docs/qualification/G1-REMAINING-WORK.md",
                 "packages/contracts/test/retrieval-catalog-bindings.test.mjs", "packages/contracts/test/retrieval-r2.test.mjs",
                 "docs/coordination/r2/requirements.json", "docs/coordination/r2/tickets.json"]:
        source("accepted:" + path)

    ledger_key = "accepted:docs/coordination/r2/capabilities.json"
    catalog_key = "accepted:packages/contracts/retrieval-0.2/catalog.json"
    skills_key = "accepted:docs/coordination/r2/skills.json"
    ledger, catalog, skills = load(ledger_key), load(catalog_key), load(skills_key)
    need(sha(source("accepted:docs/plans/MERI-DEPLOYMENT.md")) == ledger["planSha256"] == skills["planSha256"],
         "adopted R2 plan digest mismatch")
    need(ledger["sourceCommit"] == skills["sourceCommit"] == catalog["sourceRegistryCommit"],
         "canonical producer registry revision mismatch")
    originals = {r["id"]: r for r in catalog["originals"]}
    operations = {(r["operation"]["id"], r["operation"]["version"]): r for r in catalog["operations"]}
    need(len(originals) == len(catalog["originals"]) == len(ledger["records"]) == 139, "139 unique original IDs required")
    need(len(operations) == len(catalog["operations"]) == 13, "13 unique operations required")
    need([r["fields"]["ID"] for r in ledger["records"]] == [r["id"] for r in catalog["originals"]], "canonical original order/IDs differ")
    for operation in operations.values():
        need(operation["handler"] is None and operation["availability"] == "unimplemented" and
             operation["qualification"] == "pending" and operation["retry"]["maxRetries"] == 0,
             "all current operations must stay unavailable without retries")

    rows = []
    for index, record in enumerate(ledger["records"]):
        fields, scope = record["fields"], record["acceptedScope"]
        need(record["runtimeParity"] == "NOT_QUALIFIED", "no capability runtime qualification may be inferred")
        original = originals[fields["ID"]]
        need(original["disposition"] == scope["disposition"] and original["boundary"] == scope["boundary"], "scope mismatch")
        replacement = original["replacement"]
        operation = operations[(replacement["id"], replacement["version"])] if replacement else None
        selected = scope["disposition"] == "selected"
        state = "BOUND_UNAVAILABLE" if operation else "SELECTED_UNMAPPED" if selected else "DEFERRED"
        need(original["state"] == ("mapped" if operation else "pending" if selected else "deferred"), "catalog state mismatch")
        reason = ("Canonical operation contract bound; handler null, availability unimplemented, qualification pending, retries zero."
                  if operation else "Selected intent has no canonical operation replacement; no runtime parity qualified."
                  if selected else "Preserved outside the explicitly selected initial scope; deferral is not deletion.")
        next_dependency = ("Qualified source-specific implementation, trusted current authorization, provenance/paging/failure semantics and independent acceptance before enabling."
                           if operation else "REL-02: scoped canonical typed contract and operation mapping, followed by adapter/policy/evidence qualification."
                           if selected else "Explicit scope selection and separate policy/side-effect/fixture acceptance before implementation or exposure.")
        rows.append({
            "id": fields["ID"], "category": fields["Category"], "acceptedScope": scope,
            "catalogState": original["state"], "status": state, "reason": reason,
            "nextDependency": next_dependency, "originalParityAction": fields["Action to retain parity"],
            "replacement": replacement, "handler": operation["handler"] if operation else None,
            "availability": operation["availability"] if operation else "unavailable",
            "qualification": operation["qualification"] if operation else "not_qualified",
            "runtimeParity": record["runtimeParity"], "enabled": False,
            "ledgerPointer": f"{ledger_key}#/records/{index}", "workbookRow": record["row"],
            "catalogPointer": f"{catalog_key}#/originals/{index}",
            "producerMetadataLocators": fields["Pinned source references"].splitlines(),
        })
    counts = dict(collections.Counter(r["status"] for r in rows))
    need(counts == {"DEFERRED": 43, "SELECTED_UNMAPPED": 83, "BOUND_UNAVAILABLE": 13}, "scope count mismatch")
    skill_rows = [{"id": r["fields"]["ID"], "intent": r["fields"]["Current capability"],
                   "status": "PROPOSED_PENDING", "manifestVersion": r["manifestVersion"],
                   "reason": r["integrationDisposition"], "nextDependency": r["fields"]["Action to retain parity"],
                   "sourcePointer": f"{skills_key}#/records/{i}", "enabled": False}
                  for i, r in enumerate(skills["records"])]
    need(len(skill_rows) == len({r["id"] for r in skill_rows}) == 14 and
         all(r["manifestVersion"] is None for r in skill_rows), "14 pending original skill IDs required")
    accounting = {"schema": "meri-derived-source-accounting/1", "status": "SOURCE_SNAPSHOT_NOT_RUNTIME_REGISTRY",
                  "sourceCommit": PINS["accepted"], "canonicalInputs": [ledger_key, catalog_key, skills_key],
                  "summary": {"original": 139, "selected": 96, "deferred": 43, "boundUnavailable": 13,
                              "selectedUnmapped": 83, "enabled": 0, "originalSkillsPending": 14},
                  "records": rows, "skills": skill_rows,
                  "limitations": ["Historical ownerOverride/staffing fields do not supersede current user/continuation direction.",
                                  "New independent candidate results require an explicitly refreshed source snapshot.",
                                  "Producer locators are metadata only; no private producer implementation bodies copied."]}

    scan_key = "shipper:docs/qualification/aws-shipper-20261011-r1/canonical-repaired-scan-hold-scaffold.json"
    scan = load(scan_key)
    finding_rows = [{"index": r["index"], "name": r["rawFinding"]["name"], "severity": r["rawFinding"]["severity"],
                     "observedProvider": r["observedProvider"], "disposition": r["disposition"],
                     "sourcePointer": f"{scan_key}#/findings/{i}"} for i, r in enumerate(scan["findings"])]
    need(len(finding_rows) == scan["findingCount"] == 47 and all(r["disposition"]["status"] == "OPEN" for r in finding_rows), "47 OPEN image findings required")
    need(dict(collections.Counter(r["severity"] for r in finding_rows)) ==
         {"CRITICAL": 5, "HIGH": 17, "MEDIUM": 17, "LOW": 7, "UNDEFINED": 1}, "severity mismatch")
    findings = {"schema": "meri-derived-image-hold-accounting/1", "status": "FORBIDDEN_TO_LAUNCH",
                "evidence": scan["evidence"], "scanMetadata": scan["scanMetadata"], "severityCounts": scan["severityCounts"],
                "findingCount": 47, "findings": finding_rows, "olderVendorObligationsClosed": False,
                "runtimeAdmitted": False, "historicalScanImmutableLocator": None}

    packet = {"schema": "meri-source-readiness-packet/1", "status": "NOT_EXECUTABLE", "asOf": "2026-10-12",
              "authorReview": "PENDING_INDEPENDENT_PARENT_REVIEW", "refs": refs,
              "gates": {"G0": "ACCEPTED_HISTORICAL", "G1": "OPEN", **{f"G{i}": "UNENTERED" for i in range(2, 8)}},
              "capabilitySummary": accounting["summary"], "requirements": requirements["requirements"],
              "candidateBoundary": {"memory": "PRESERVED_UNREVIEWED_AT_PIN", "gateway": "HOLD_AT_PIN",
                                    "selfApprovalConflict": "DOT_DECISION_REQUIRED; no consequential semantics chosen"},
              "currentExecutionAuthority": {"runner": None, "caller": None, "account": None, "region": None,
                  "taskIdentity": None, "fence": None, "imageDigest": None, "sourceContextArchive": None,
                  "actionResourceAllowlist": [], "exactActionApproval": None, "securityApproval": None,
                  "infrastructureCostCeilingUsd": None, "paidModelHistoricalCapUsd": 10,
                  "paidModelSpentUsd": None, "paidModelReservedUsd": None, "paidModelRemainingUsd": None,
                  "durableLedger": None, "deadline": None, "cleanupOwner": None, "rollbackEvidence": None},
              "stateSelection": {"eventualState": "existing Aurora", "historicalSelectedCluster": "capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv",
                  "currentCapacityVerified": False, "newRdsAuthorized": False, "networkChangeAuthorized": False, "databaseChangeAuthorized": False},
              "runtimeReceiptFlags": {"completeRecoveryCheckpoint": False, "sessionStoreQualified": False},
              "authorTaskActions": {"localGitReads": True, "localSourceChecks": True, "cloudCommands": 0, "networkRequests": 0,
                  "providerCalls": 0, "paidModelCalls": 0, "customerDataActions": 0, "resourceChanges": 0},
              "externalPolicy": {"repository": "neo-capiro/capiro-agent-ops", "status": "PARENT_REPORTED_404",
                  "retrievedByThisAuthor": False, "affectedActions": "Host/Hermes actions requiring current private policy remain blocked"},
              "independentSourceWorkMayContinue": True,
              "requirementsInput": {"path": "g1-requirements.json", "bytes": len(requirements_bytes), "sha256": sha(requirements_bytes)}}
    return {"capability-accounting.json": accounting, "image-findings.json": findings,
            "packet.json": packet, "source-manifest.json": {"schema": "meri-readiness-source-manifest/1",
            "refs": refs, "scope": "Exact bytes of cited files only; not full source/image closure, read audit or runtime acceptance.",
            "sources": dict(sorted(manifest.items()))}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="compare committed generated bytes; write nothing")
    args = parser.parse_args()
    try:
        products = derive()
        drift = []
        for name, data in products.items():
            raw, target = encode(data), HERE / name
            if args.check:
                if not target.is_file() or target.read_bytes() != raw:
                    drift.append(name)
            else:
                target.write_bytes(raw)
        if drift:
            print(json.dumps({"status": "FAIL_GENERATED_DRIFT", "files": drift}))
            return 1
        print(json.dumps({"status": "PASS_CHECK" if args.check else "GENERATED", "products": list(products),
                          "summary": products["capability-accounting.json"]["summary"],
                          "sourceFiles": len(products["source-manifest.json"]["sources"]), "runtimeAdmission": False}))
        return 0
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError) as error:
        print(f"ERROR_INVALID_INPUT: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
