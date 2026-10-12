"""Reproduce the bounded handover source/context inventory; no network or writes outside output.

Run from the backend checkout with the exact local frontend/evidence roots available.
Snapshot closure is not a claim of semantic file reads or an installed-dependency SBOM.
"""

import hashlib
import json
import os
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[4]
OUTPUT = ROOT / "docs/handover/20261012"
WORKSPACE = ROOT.parent
ENV = {**os.environ, "GIT_NO_LAZY_FETCH": "1"}


def git(root, *args, payload=None):
    return subprocess.check_output(["git", *args], cwd=root, env=ENV, input=payload)


def write(name, value):
    (OUTPUT / name).write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def snapshot(name, root, ref, repository, public_ref):
    entries = []
    for item in git(root, "ls-tree", "-r", "-l", "-z", ref).split(b"\0"):
        if not item:
            continue
        meta, path = item.split(b"\t", 1)
        mode, kind, blob, size = meta.split()
        if kind != b"blob":
            raise ValueError("Unexpected non-blob source entry")
        entries.append({"path": path.decode(), "gitBlob": blob.decode(), "bytes": int(size), "mode": mode.decode()})
    unique = list(dict.fromkeys(row["gitBlob"] for row in entries))
    raw = git(root, "cat-file", "--batch", payload=("\n".join(unique) + "\n").encode())
    hashes = {}
    offset = 0
    for expected in unique:
        end = raw.index(b"\n", offset)
        header = raw[offset:end].split()
        if len(header) != 3 or header[0].decode() != expected or header[1] != b"blob":
            raise ValueError("Incomplete local object closure; do not fetch implicitly")
        size = int(header[2])
        body = raw[end + 1:end + 1 + size]
        if len(body) != size or raw[end + 1 + size:end + 2 + size] != b"\n":
            raise ValueError("Truncated source object")
        if hashlib.sha1(b"blob " + str(size).encode() + b"\0" + body).hexdigest() != expected:
            raise ValueError("Git object identity mismatch")
        hashes[expected] = hashlib.sha256(body).hexdigest()
        offset = end + size + 2
    if offset != len(raw):
        raise ValueError("Unexpected batch output")
    for row in entries:
        row["sha256"] = hashes[row["gitBlob"]]
    identity = {"name": name, "repository": repository, "localRef": ref,
                "tree": git(root, "rev-parse", ref + "^{tree}").decode().strip(),
                "publicRef": public_ref, "usage": "COMPLETE_TRACKED_SNAPSHOT_NOT_READ_AUDIT",
                "fileCount": len(entries), "totalBytes": sum(r["bytes"] for r in entries), "files": entries}
    path = "snapshots/" + name + ".json"
    write(path, identity)
    body = (OUTPUT / path).read_bytes()
    return {k: identity[k] for k in identity if k != "files"} | {
        "inventory": "docs/handover/20261012/" + path, "inventoryBytes": len(body),
        "inventorySha256": hashlib.sha256(body).hexdigest()}


def evidence_snapshot():
    root = WORKSPACE / "meri-aws-shipper-review-20261011"
    entries = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or ".git" in path.parts:
            continue
        relative = path.relative_to(root).as_posix()
        if not relative.startswith("docs/"):
            continue
        body = path.read_bytes()
        entries.append({"path": relative, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(),
                        "gitBlob": hashlib.sha1(b"blob " + str(len(body)).encode() + b"\0" + body).hexdigest()})
    value = {"name": "aws-shipper-materialized", "repository": "neo-capiro/meri-greenfield",
             "publicRef": "28fbfc7e40799fdb4e59eabd35c5b9bf80f117d9", "localRef": None,
             "usage": "MATERIALIZED_SCRUBBED_EVIDENCE_NOT_GIT_CHECKOUT", "fileCount": len(entries),
             "totalBytes": sum(r["bytes"] for r in entries), "files": entries}
    path = "snapshots/aws-shipper-materialized.json"
    write(path, value)
    body = (OUTPUT / path).read_bytes()
    return {k: value[k] for k in value if k != "files"} | {
        "inventory": "docs/handover/20261012/" + path, "inventoryBytes": len(body),
        "inventorySha256": hashlib.sha256(body).hexdigest()}


def main():
    (OUTPUT / "snapshots").mkdir(exist_ok=True)
    candidate = git(ROOT, "rev-parse", "HEAD").decode().strip()
    rows = [snapshot("backend-accepted", ROOT, "ddb92c6e08bcedf4063897e37ca05d14614f72ea",
                     "neo-capiro/meri-greenfield", "5ee46446b5f60034916f00b2a665b3e2bef9cf60"),
            snapshot("backend-candidate-freeze", ROOT, candidate, "neo-capiro/meri-greenfield", None),
            snapshot("frontend", WORKSPACE / "capiro-frontend-preservation-publication-20261011",
                     "d792cb5791a998dc886c74d24da086703879878f", "neo-capiro/capiro-frontend",
                     "3cc30ff3182e8050d563516607866cf07efe2aef"), evidence_snapshot()]
    write("SOURCE-SNAPSHOTS.json", {"schema": "meri-handover-source-snapshots/1", "snapshots": rows,
          "limitations": ["Final handover additions are listed by the final published Git tree; self-referential inventory hashes are not invented.",
                          "Backend candidate has a locally identified pre-handover tree; publication binds the complete final descendant.",
                          "Installed dependencies/private implementation/customer bytes are excluded; not a read audit or SBOM."]})
    manifest_paths = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / "docs").rglob("context-files.json"))
    frontend_manifest = "docs/qualification/candidates/run-workspace-20261012/context-files.json"
    groups = [
        ("backend-policy-plan", ["AGENTS.md", "README.md", "docs/IMPLEMENTATION-STANDARDS.md", "package.json", "package-lock.json", "docs/plans/", "docs/decisions/", "docs/qualification/G1-REMAINING-WORK.md", "docs/qualification/"]),
        ("historical-pickup", ["docs/handover/20261011/", "docs/coordination/REMOTE-CLEANUP-BOUNDARY-20261011.md"]),
        ("human-inputs", ["docs/handover/20261012/inputs/manifest.json", "docs/handover/20261012/inputs/"]),
        ("current-source-and-evidence", ["apps/", "packages/contracts/", "scripts/qualification/", "infra/", "docs/coordination/tasks/", "docs/coordination/reports/", "docs/qualification/candidates/"]),
        ("frontend-source-and-context", ["AGENTS.md", "ARCHITECTURE.md", "apps/web/", "packages/", "docs/coordination/", "docs/qualification/", "docs/handover/", frontend_manifest]),
        ("private-producer-locators", ["docs/handover/20261012/PRIVATE-SOURCE-REFERENCES.json", "docs/qualification/candidates/memory-proposals-20261012/context-files.json"]),
        ("owned-proof-helpers", ["docs/handover/20261012/context-helpers/manifest.json"]),
        ("external-design-research-runtime", manifest_paths),
    ]
    write("CONTEXT-INDEX.json", {"schema": "meri-handover-context-index/1", "sourceSnapshots": rows,
          "groups": [{"name": name, "paths": paths, "resolution": "Complete immutable source inventory plus author/reviewer usage labels; paths may denote directory groups, not fabricated file reads"} for name, paths in groups],
          "backendAuthorReviewerContextManifests": manifest_paths,
          "frontendAuthorContextManifest": {"repository": "neo-capiro/capiro-frontend", "ref": "3cc30ff3182e8050d563516607866cf07efe2aef", "path": frontend_manifest},
          "externalContext": {"figma": {"file": "Zc2dEN5aLU47dVdsewDmiJ", "nodes": ["411:40601", "439:81406", "442:81437", "442:81682", "443:82175", "443:82027", "443:84463", "443:84316", "456:90811"]},
                              "sharedPolicy": {"repository": "neo-capiro/capiro-agent-ops", "currentPolicyVerified": False, "inheritedBootstrapRef": "b2b0ce8c2bf03817b81e671d968b7892985b8d06", "paths": ["BOOTSTRAP.md", "AGENTS.md", "hermes/OPERATING.md", "actual host-specific path map"]},
                              "skills": ["skill://flora-artifact-skills/root/.codex/skills/builtins/documents", "figma:figma-design-to-code", "personal-context:personal-context"],
                              "officialResearchUrls": "critical-applicability author context contains 117 individual locators and retrieval-status labels; no claim all were retrieved",
                              "portfolioReportedCheckpoint": {"sha": "85aa5c0a816f52e23a0def34e91353ba41eda163", "sourceVerifiedHere": False, "bundleSha256": "e20a45c16b40200c9d7178be3c4aff4d24c18d775cd3646e003f38ea6cb3e7f2"}},
          "completeness": {"allTrackedSnapshotPathsIncluded": True, "knownPersistedInputsIncluded": True, "osFileReadAuditExists": False, "preCompactionFullCommandTranscriptExists": False, "completeInstalledDependencySBOM": False,
                           "distinction": "Snapshot closure, byte verification, actual semantic reads and referenced/unavailable context are separate claims; preserve worker usage labels."},
          "excluded": ["Credentials/historical login tokens", "14 private Capiro source bodies (hash/refetch metadata retained)", "Private source ZIP/customer payloads", "Installed dependencies/disposable build caches", "Unrelated other-session files"]})
    print(json.dumps({"snapshots": [{k: r[k] for k in ["name", "fileCount", "totalBytes"]} for r in rows], "contextManifests": len(manifest_paths)}))


if __name__ == "__main__":
    main()
