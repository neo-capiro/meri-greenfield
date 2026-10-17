"""Reconstruct the historical contract proof from explicit local Git repositories.

No network, checkout, application startup, installation, build, credentials or
archive extraction. Writes only the explicitly selected NEW JSON output file.
Backend is a required handoff input but is not a contract-proof dependency.
See CONTRACT-REPRODUCTION.md for pins, prerequisites and limits.
"""
import argparse
import base64
import hashlib
import io
import json
import os
import sys
from pathlib import Path, PurePosixPath
import subprocess
import tarfile

MERI_COMMIT = "38f52df94b1738649776792b2a28aac743801c19"
FRONTEND_COMMIT = "e0b47a34d00b8c181420188ed39a1d849e25ec0a"
TARBALL_PATH = "vendor/capiro-meri-contracts-0.1.8.tgz"
EXPECTED_TARBALL_BLOB = "cbd7cd8246fee5feef17a1119dc93e66df06a5a6"
EXPECTED_TARBALL_SHA = "0b0dffa63e19c55a3bc91e0c6b39cd5ad5916c6941ae1ccdc92098ba580d9820"
PLAN_COMMIT = "6d796834aab693e90a3a052548c4c51a03ebe3c3"
PLAN_PATH = "docs/non-meri-continuation-20261016/FIRST-CHAT-PREVIEW-BINDING-PLAN-20261017.md"
PLAN_BLOB = "936dc12f1dfe82b297db8ecae6666706878562cc"
PLAN_SHA = "99662ac647ef5a6be3672f0dc489173719ec39cda08a375b38ca1f67ae436b62"
SCRIPT_PATH = "docs/handover/20261017/fable-shipping/reproduce-contract-compatibility.py"


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def blob_hash(raw):
    return hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()


def git(repo, *args):
    # Do not let a partial clone lazily fetch a missing object. No Git transport,
    # credential helper or checkout operation is requested by this script.
    env = dict(os.environ)
    env.update(GIT_NO_LAZY_FETCH="1", GIT_ALLOW_PROTOCOL="", GIT_TERMINAL_PROMPT="0", GIT_OPTIONAL_LOCKS="0")
    for key in tuple(env):
        if key.startswith("GIT_TRACE"):
            del env[key]
    result = subprocess.run(
        ["git", "--no-pager", "-c", "protocol.allow=never", "-C", str(repo), *args], env=env,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15, check=False,
    )
    if result.returncode:
        raise RuntimeError("LOCAL_GIT_READ_FAILED")
    if len(result.stdout) > 3 * 1024 * 1024:
        raise ValueError("GIT_OBJECT_BOUND_EXCEEDED")
    return result.stdout


def show(repo, commit, path, missing_allowed=False):
    if missing_allowed:
        # An absent tree entry is distinct from a failed/denied Git read.
        row = git(repo, "ls-tree", "-z", commit, "--", path)
        if not row:
            return None
        head, name = row.rstrip(b"\0").split(b"\t", 1)
        if name.decode("utf8") != path or head.split()[1] != b"blob":
            raise ValueError("GIT_BLOB_REQUIRED")
    return git(repo, "show", "--no-textconv", commit + ":" + path)


def repository(value):
    result = Path(value).resolve(strict=True)
    if not result.is_dir() or git(result, "rev-parse", "--show-object-format").strip() != b"sha1":
        raise ValueError("LOCAL_SHA1_GIT_REPOSITORY_REQUIRED")
    return result


def normalize_provenance_path(relative):
    parts = []
    for part in PurePosixPath("packages/contracts", relative).parts:
        if part == "..":
            if not parts:
                raise ValueError("PROVENANCE_PATH_REFUSED")
            parts.pop()
        else:
            parts.append(part)
    path = "/".join(parts)
    if not path.startswith(("packages/contracts/", "apps/control/conversations/")):
        raise ValueError("PROVENANCE_SCOPE_REFUSED")
    return path


NODE_SCHEMA_PROBE = r"""
const vm = require('node:vm');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const source = JSON.parse(input);
  const clean = value => value.split('\n')
    .filter(line => !line.startsWith('import ')).join('\n').replace(/\bexport /g, '');
  // These inert protocol dependencies do not participate in schema construction.
  // The existing-input 2 MiB bridge cap was already observed in the common DTO.
  const protocol = vm.runInNewContext(
    '(()=>{' + clean(source.protocol) +
      ';return {conversationInitialInputMetadata,initialInputErrorStatuses};})()',
    {conversationInputMetadata: {authentication: {}, limits: {responseBytes: 2097152}}},
    {timeout: 1000},
  );
  const schema = vm.runInNewContext(
    '(()=>{' + clean(source.schema) + ';return initialInputSchema();})()',
    protocol, {timeout: 1000},
  );
  process.stdout.write(JSON.stringify(schema));
});
"""


def normalize_schema(value, document, documents, depth=0):
    if depth >= 80:
        raise ValueError("SCHEMA_REFERENCE_DEPTH_REFUSED")
    if isinstance(value, list):
        return [normalize_schema(item, document, documents, depth + 1) for item in value]
    if not isinstance(value, dict):
        return value
    if "$ref" in value:
        if len(value) != 1:
            raise ValueError("REFERENCE_SIBLINGS_REQUIRE_REVIEW")
        uri, fragment = value["$ref"].split("#", 1)
        owner = documents[uri] if uri else document
        target = owner
        for key in fragment.strip("/").split("/"):
            if key:
                target = target[key.replace("~1", "/").replace("~0", "~")]
        return normalize_schema(target, owner, documents, depth + 1)
    result = {
        key: normalize_schema(item, document, documents, depth + 1)
        for key, item in value.items()
        if key not in {"$defs", "$id", "$schema", "title", "description"}
    }
    for key in ("required", "enum"):
        if key in result:
            result[key] = sorted(result[key], key=lambda item: json.dumps(item, sort_keys=True))
    return result


def canonical_sha(value):
    return sha(json.dumps(value, sort_keys=True, separators=(",", ":")).encode())


def prove(args):
    meri, frontend = repository(args.meri_repo), repository(args.frontend_repo)
    repository(args.backend_repo)  # Explicit handoff inventory only; no wire claim.
    for repo, commit in ((meri, MERI_COMMIT), (frontend, FRONTEND_COMMIT), (frontend, PLAN_COMMIT)):
        if git(repo, "cat-file", "-t", commit).strip() != b"commit":
            raise ValueError("PINNED_LOCAL_COMMIT_REQUIRED")
    plan = show(frontend, PLAN_COMMIT, PLAN_PATH)
    if len(plan) != 17615 or sha(plan) != PLAN_SHA or blob_hash(plan) != PLAN_BLOB:
        raise ValueError("PINNED_BINDING_PLAN_MISMATCH")
    archive = show(frontend, FRONTEND_COMMIT, TARBALL_PATH)
    if sha(archive) != EXPECTED_TARBALL_SHA or blob_hash(archive) != EXPECTED_TARBALL_BLOB:
        raise ValueError("PINNED_FRONTEND_TARBALL_MISMATCH")
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as tar:
        members = {}
        for item in tar:
            if not item.isfile():
                continue
            if not item.name.startswith("package/") or item.size > 2 * 1024 * 1024:
                raise ValueError("TARBALL_MEMBER_REFUSED")
            name = item.name.removeprefix("package/")
            if name in members:
                raise ValueError("DUPLICATE_TARBALL_MEMBER")
            members[name] = tar.extractfile(item).read()
    if len(members) != 39:
        raise ValueError("TARBALL_MEMBER_COUNT_MISMATCH")
    metadata_raw = members["dist/conversation-initial-input.metadata.json"]
    metadata = json.loads(metadata_raw)
    provenance = []
    for entry in metadata["sources"]:
        path = normalize_provenance_path(entry["path"])
        actual = show(meri, MERI_COMMIT, path, missing_allowed=True)
        provenance.append({
            "metadataPath": entry["path"], "canonicalMeriPath": path,
            "expectedSha256": entry["sha256"], "expectedBytes": entry["bytes"],
            "actualSha256": sha(actual) if actual is not None else None,
            "actualBytes": len(actual) if actual is not None else None,
            "actualGitBlob": blob_hash(actual) if actual is not None else None,
            "matches": actual is not None and sha(actual) == entry["sha256"]
                and len(actual) == entry["bytes"],
        })
    if len(provenance) != 22 or sum(row["matches"] for row in provenance) != 21:
        raise ValueError("PROVENANCE_RESULT_CHANGED")
    if [row["canonicalMeriPath"] for row in provenance if not row["matches"]] != [
        "packages/contracts/generate-initial-input.mjs"
    ]:
        raise ValueError("UNEXPECTED_PROVENANCE_DIFFERENCE")
    browser_pins = []
    for entry in metadata["browserImports"]:
        path = normalize_provenance_path(str(PurePosixPath("dist", entry["path"])))
        actual = show(meri, MERI_COMMIT, path)
        repeated = any(row["canonicalMeriPath"] == path and row["expectedSha256"] == entry["sha256"] for row in provenance)
        browser_pins.append({"canonicalMeriPath": path, "expectedSha256": entry["sha256"],
                             "actualSha256": sha(actual), "matches": sha(actual) == entry["sha256"],
                             "repeatsDistinctSourcePin": repeated})
    if len(browser_pins) != 1 or not all(row["matches"] and row["repeatsDistinctSourcePin"] for row in browser_pins):
        raise ValueError("BROWSER_IMPORT_RESULT_CHANGED")
    public_files = []
    for path, expected in members.items():
        actual = show(meri, MERI_COMMIT, "packages/contracts/" + path, missing_allowed=True)
        public_files.append({
            "tarMember": "package/" + path, "meriPath": "packages/contracts/" + path,
            "frontendMemberSha256": sha(expected),
            "meriSha256": sha(actual) if actual is not None else None,
            "meriGitBlob": blob_hash(actual) if actual is not None else None,
            "result": "ABSENT" if actual is None else "IDENTICAL" if actual == expected else "DIFFERENT",
        })
    counts = {status: sum(row["result"] == status for row in public_files)
              for status in ("IDENTICAL", "ABSENT", "DIFFERENT")}
    if counts != {"IDENTICAL": 34, "ABSENT": 4, "DIFFERENT": 1}:
        raise ValueError("PUBLIC_MEMBER_RESULT_CHANGED")
    protocol_path = "packages/contracts/conversation-initial-input/protocol.mjs"
    schema_path = "packages/contracts/conversation-initial-input/schema.mjs"
    protocol_raw = show(meri, MERI_COMMIT, protocol_path)
    schema_raw = show(meri, MERI_COMMIT, schema_path)
    probe = subprocess.run(
        [args.node, "-e", NODE_SCHEMA_PROBE],
        input=json.dumps({"protocol": protocol_raw.decode(), "schema": schema_raw.decode()}).encode(),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5, check=False,
        env={key: os.environ[key] for key in ("PATH", "SystemRoot", "WINDIR", "LANG", "LC_ALL", "TMP", "TEMP") if key in os.environ},
    )
    if probe.returncode or len(probe.stdout) > 3 * 1024 * 1024:
        raise ValueError("PURE_SCHEMA_PROBE_FAILED")
    private_schema = json.loads(probe.stdout)
    public_schema = json.loads(members["dist/conversation-initial-input.schema.json"])
    documents = {value["$id"]: value for value in (
        private_schema,
        json.loads(show(meri, MERI_COMMIT, "packages/contracts/meri.schema.json")),
        json.loads(show(meri, MERI_COMMIT, "packages/contracts/dist/conversation-input.schema.json")),
    )}
    definitions = []
    for name, value in private_schema["$defs"].items():
        left = normalize_schema(value, private_schema, documents)
        right = normalize_schema(public_schema["$defs"][name], public_schema, documents)
        definitions.append({
            "definition": name, "equal": left == right,
            "privateNormalizedSha256": canonical_sha(left),
            "publicNormalizedSha256": canonical_sha(right),
            "normalizedValidationShape": left,
        })
    if len(definitions) != 5 or not all(row["equal"] for row in definitions):
        raise ValueError("SCHEMA_RESULT_CHANGED")
    meri_manifest = json.loads(show(meri, MERI_COMMIT, "packages/contracts/package.json"))
    meri_lock = json.loads(show(meri, MERI_COMMIT, "packages/contracts/package-lock.json"))
    frontend_manifest = json.loads(members["package.json"])
    return {
        "schemaVersion": 1, "status": "PINNED_READ_ONLY_SOURCE_COMPATIBILITY_PROOF",
        "method": "Local Git object bytes, in-memory tar members and pure schema constructors only",
        "reproductionScript": {"path": SCRIPT_PATH,
                               "sha256": sha(Path(__file__).read_bytes())},
        "sourceIdentities": {
            "meri": {"commit": MERI_COMMIT,
                     "tree": git(meri, "rev-parse", MERI_COMMIT + "^{tree}").decode().strip()},
            "frontend": {"commit": FRONTEND_COMMIT,
                         "tree": git(frontend, "rev-parse", FRONTEND_COMMIT + "^{tree}").decode().strip()},
        },
        "bindingPlan": {"commit": PLAN_COMMIT, "path": PLAN_PATH,
                        "gitBlob": PLAN_BLOB, "sha256": sha(plan), "bytes": len(plan)},
        "backendInput": {"localGitRepositoryValidated": True, "usedInContractProof": False,
                         "note": "No backend commit/compatibility/activation claim is made by this historical Meri/frontend comparison."},
        "frontendTarball": {"path": TARBALL_PATH, "bytes": len(archive),
                            "gitBlob": blob_hash(archive), "sha256": sha(archive),
                            "sri": "sha512-" + base64.b64encode(hashlib.sha512(archive).digest()).decode()},
        "versions": {"frontendConsumer": frontend_manifest["version"],
                     "meriProducerManifest": meri_manifest["version"],
                     "meriProducerLock": meri_lock["version"]},
        "provenanceMetadata": {"member": "package/dist/conversation-initial-input.metadata.json",
                               "sha256": sha(metadata_raw), "raw": metadata},
        "distinctProvenance": {"matched": 21, "total": 22, "rows": provenance},
        "browserImportPins": {"note": "The common conversation-input.mjs pin repeats a matching source row; including it yields 22/23 entries.",
                              "matchedIncludingDuplicate": sum(row["matches"] for row in provenance + browser_pins),
                              "totalIncludingDuplicate": len(provenance) + len(browser_pins),
                              "rows": browser_pins, "raw": metadata["browserImports"]},
        "publicMemberComparison": {"counts": counts, "rows": public_files},
        "schemaProbe": {"protocolSource": protocol_path, "protocolSha256": sha(protocol_raw),
                        "schemaSource": schema_path, "schemaSourceSha256": sha(schema_raw),
                        "rawPrivateConstructedSchema": private_schema, "rawFrontendPublicSchema": public_schema,
                        "definitions": definitions,
                        "normalization": "Expand exact JSON refs; omit descriptive annotations; normalize required/enum order; retain validation keywords and values",
                        "inertProtocolContext": {"authentication": {}, "limits": {"responseBytes": 2097152}}},
        "limits": {"network": False, "sourceWrites": False, "applicationInitialization": False,
                   "installOrBuild": False, "liveCompatibilityEstablished": False,
                   "historicalExactPinsOnly": True, "outputWrite": "One explicit new JSON file only"},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--meri-repo", required=True, help="Local Meri Git repository containing exact 38f objects")
    parser.add_argument("--frontend-repo", required=True, help="Local frontend Git repository containing e0 tarball and 6d binding-plan objects")
    parser.add_argument("--backend-repo", required=True, help="Local backend Git repository; validated only, not used as contract evidence")
    parser.add_argument("--node", required=True, help="Existing Node executable; no runtime install is attempted")
    parser.add_argument("--output", required=True, help="New JSON file in an existing directory; never overwritten")
    args = parser.parse_args()
    output = Path(args.output).absolute()
    if output.exists() or output.is_symlink() or not output.parent.is_dir():
        raise ValueError("NEW_OUTPUT_PATH_REQUIRED")
    proof = prove(args)
    encoded = json.dumps(proof, sort_keys=True, indent=2) + "\n"
    if len(encoded.encode("utf8")) > 1024 * 1024:
        raise ValueError("PROOF_OUTPUT_BOUND_EXCEEDED")
    # Exclusive creation follows every proof assertion. No private cache/input
    # JSON or machine-specific source location is emitted into the receipt.
    with output.open("x", encoding="utf8", newline="\n") as stream:
        stream.write(encoded)
    print("CONTRACT_REPRODUCTION_RECORDED")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError, KeyError, TypeError):
        print("CONTRACT_REPRODUCTION_REFUSED", file=sys.stderr)
        sys.exit(2)
