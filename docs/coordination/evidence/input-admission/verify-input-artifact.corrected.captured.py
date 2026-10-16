#!/usr/bin/env python3
"""Verify the bounded, additive Meri input package without extraction or subprocesses.

Usage: python verify-input-artifact.py --repo=CHECKOUT --artifact=PACKAGE.tgz
       --expected-source=FULL_COMMIT --report=TASK_LOCAL_REPORT.json
Exit 0 confirms the checks in the JSON report; exit 1 reports a verification
failure; argparse exits 2 for invalid CLI syntax. The source commit is a caller
label only. An independent Git comparison remains required.
"""
from __future__ import annotations

import argparse
import base64
from datetime import datetime, timezone
import gzip
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import tarfile


COMPRESSED_LIMIT = 32 * 1024 * 1024
DECOMPRESSED_LIMIT = 128 * 1024 * 1024
BASELINE_PATH = "docs/coordination/evidence/input-admission/frozen-dist-baseline.json"
BASELINE_LF_SHA256 = "49c6c94f45a80d8e6b3424d411b5e7c7ed126969da2541a7a65d03f96c2b4c64"
FROZEN_BASE = "14f0bc2e5716af7c00925d13d3365b26182c9e56"
MERI_SHA256 = "e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b"
LOCK_SHA256 = "418a5af3b8673d9cdd2faed654b0d94586b03afdca4b23a1a7995462686e54e3"
CANONICAL_BROWSER_SHA256 = "94465895c6a063536cd4de3ce84d6f736e8475890a663ef80e9c5d748992cea1"
NEW_DIST = {"conversation-input." + suffix for suffix in ("mjs", "d.ts", "schema.json", "metadata.json")}
ROOT_FILES = {"package.json", "meri.schema.json", "validate.mjs", "README.md", "THIRD-PARTY-NOTICES.md"}
DEPENDENCIES = {"ajv": "8.20.0", "ajv-formats": "3.0.1", "canonicalize": "5.1.0"}
DEV_DEPENDENCIES = {"esbuild": "0.28.2", "json-schema-to-typescript": "16.0.0", "typescript": "5.9.3"}
OLD_EXPORTS = {
    ".": {"types": "./dist/index.d.ts", "default": "./dist/browser.mjs"},
    "./browser": {"types": "./dist/browser.d.ts", "default": "./dist/browser.mjs"},
    "./node": "./validate.mjs",
    "./metadata": {"types": "./dist/metadata.d.ts", "default": "./dist/metadata.mjs"},
    "./schema": "./meri.schema.json",
}
for _family in ("action-application", "document-application", "conversation-application", "conversation-lifecycle", "conversation-history"):
    OLD_EXPORTS["./" + _family] = {"types": "./dist/" + _family + ".d.ts", "default": "./dist/" + _family + ".mjs"}
    OLD_EXPORTS["./" + _family + "/schema"] = "./dist/" + _family + ".schema.json"
EXPECTED_EXPORTS = {
    **OLD_EXPORTS,
    "./conversation-input": {"types": "./dist/conversation-input.d.ts", "default": "./dist/conversation-input.mjs"},
    "./conversation-input/schema": "./dist/conversation-input.schema.json",
}
ROOT_METADATA_SOURCES = {
    "../../apps/control/conversations/service.mjs",
    "../../apps/control/conversations/input/http.mjs",
}
REQUIRED_METADATA_SOURCES = {
    "generate-input.mjs", "document-application/boundary.mjs", "meri.schema.json",
    *("conversation-input/" + name + ".mjs" for name in ("protocol", "schema", "semantics", "shape", "validate", "receive")),
    *("dist/conversation-application." + suffix for suffix in ("mjs", "d.ts", "schema.json", "metadata.json")),
    *ROOT_METADATA_SOURCES,
}
HEX256 = re.compile(r"^[0-9a-f]{64}$")
CONSTRAINT = "expected-source is a caller-supplied label; this verifier does not invoke Git or verify that the checkout HEAD equals that commit. Root must independently bind Git source and the recorded source-file hashes."


class VerificationFailure(Exception):
    pass


class Evidence:
    def __init__(self, args: argparse.Namespace):
        self.result = {
            "schema": "meri.input-artifact-verification/1",
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "expectedSource": args.expected_source,
            "sourceCommitVerified": False,
            "constraints": [CONSTRAINT],
            "limits": {"compressedBytes": COMPRESSED_LIMIT, "decompressedBytes": DECOMPRESSED_LIMIT},
            "checks": [], "files": [], "metadataSources": [],
        }

    def check(self, name: str, passed: bool, **details) -> bool:
        self.result["checks"].append({"name": name, "passed": bool(passed), **details})
        return bool(passed)

    def require(self, name: str, passed: bool, **details):
        if not self.check(name, passed, **details):
            raise VerificationFailure(name)


def hashes(value) -> dict:
    return {"bytes": len(value), "sha256": hashlib.sha256(value).hexdigest()}


def json_object(raw: bytes):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("duplicate JSON key: " + key)
            result[key] = value
        return result

    def invalid_constant(value):
        raise ValueError("invalid JSON constant: " + value)

    return json.loads(raw.decode("utf-8", errors="strict"), object_pairs_hook=unique, parse_constant=invalid_constant)


def safe_file(path: Path, root: Path, limit: int = COMPRESSED_LIMIT) -> bytes:
    resolved = path.resolve(strict=True)
    if not resolved.is_relative_to(root) or not stat.S_ISREG(path.lstat().st_mode) or path.is_symlink():
        raise ValueError("source is not an in-root regular file: " + str(path))
    size = resolved.stat().st_size
    if not 0 <= size <= limit:
        raise ValueError("source byte limit exceeded: " + str(path))
    with resolved.open("rb") as stream:
        raw = stream.read(limit + 1)
    if len(raw) != size or len(raw) > limit:
        raise ValueError("source changed while reading or exceeded byte limit: " + str(path))
    return raw


def clean_relative(value: str) -> bool:
    if not isinstance(value, str) or not value or "\\" in value or ":" in value or any(ord(c) < 32 or ord(c) == 127 for c in value):
        return False
    path = PurePosixPath(value)
    return not path.is_absolute() and path.as_posix() == value and all(p not in ("", ".", "..") for p in path.parts)


def metadata_source_path(name: str, repo: Path, contracts: Path) -> Path:
    if name in ROOT_METADATA_SOURCES:
        target = contracts.joinpath(*PurePosixPath(name).parts).resolve(strict=True)
        if not target.is_relative_to(repo):
            raise ValueError("metadata root source escaped repository")
        return target
    if not clean_relative(name):
        raise ValueError("invalid contracts-relative metadata path: " + str(name))
    target = contracts.joinpath(*PurePosixPath(name).parts).resolve(strict=True)
    if not target.is_relative_to(contracts):
        raise ValueError("metadata contracts source escaped package")
    return target


def read_archive(artifact: Path, evidence: Evidence):
    evidence.require("artifact.regular", artifact.is_file() and not artifact.is_symlink() and stat.S_ISREG(artifact.lstat().st_mode))
    evidence.require("artifact.compressedLimit", 0 < artifact.stat().st_size <= COMPRESSED_LIMIT, observed=artifact.stat().st_size)
    with artifact.open("rb") as stream:
        compressed = stream.read(COMPRESSED_LIMIT + 1)
    evidence.require("artifact.compressedSnapshot", 0 < len(compressed) <= COMPRESSED_LIMIT and len(compressed) == artifact.stat().st_size)
    evidence.result["artifact"] = {"path": str(artifact), **hashes(compressed), "npmIntegrity": "sha512-" + base64.b64encode(hashlib.sha512(compressed).digest()).decode("ascii"), "npmShasum": hashlib.sha1(compressed).hexdigest()}
    decompressed = bytearray()
    with gzip.GzipFile(fileobj=io.BytesIO(compressed), mode="rb") as stream:
        while True:
            block = stream.read(min(65536, DECOMPRESSED_LIMIT + 1 - len(decompressed)))
            if not block:
                break
            decompressed.extend(block)
            if len(decompressed) > DECOMPRESSED_LIMIT:
                evidence.require("artifact.decompressedLimit", False, observed=len(decompressed))
    evidence.check("artifact.decompressedLimit", len(decompressed) <= DECOMPRESSED_LIMIT, observed=len(decompressed))
    evidence.result["artifact"]["decompressedBytes"] = len(decompressed)
    evidence.require("tar.blockAlignment", len(decompressed) >= 1024 and len(decompressed) % 512 == 0)
    entries, folded, offset, ended = {}, set(), 0, False
    while offset < len(decompressed):
        header = bytes(decompressed[offset:offset + 512])
        if not any(header):
            evidence.require("tar.zeroTerminator", len(decompressed) - offset >= 1024 and not any(memoryview(decompressed)[offset:]))
            ended = True
            break
        evidence.require("tar.entryCountLimit", len(entries) < 64, observed=len(entries))
        member = tarfile.TarInfo.frombuf(header, encoding="utf-8", errors="strict")
        name = member.name
        evidence.require("tar.regularEntry", member.type in (tarfile.REGTYPE, tarfile.AREGTYPE) and not member.linkname and member.sparse is None, path=name, type=repr(member.type))
        evidence.require("tar.safeEntryPath", clean_relative(name) and name.startswith("package/") and len(PurePosixPath(name).parts) >= 2 and not name.endswith("/"), path=name)
        evidence.require("tar.uniqueEntry", name not in entries and name.casefold() not in folded, path=name)
        evidence.require("tar.entrySize", isinstance(member.size, int) and 0 <= member.size <= DECOMPRESSED_LIMIT, path=name, observed=member.size)
        start, end = offset + 512, offset + 512 + member.size
        evidence.require("tar.entryBounds", end <= len(decompressed), path=name)
        entry = {"path": name, "offset": start, **hashes(memoryview(decompressed)[start:end])}
        entries[name] = entry
        folded.add(name.casefold())
        offset = start + ((member.size + 511) // 512) * 512
    evidence.require("tar.terminated", ended)
    evidence.result["artifact"]["entryCount"] = len(entries)
    return decompressed, entries


def packed_bytes(name: str, archive: bytearray, entries: dict) -> bytes:
    row = entries["package/" + name]
    return bytes(archive[row["offset"]:row["offset"] + row["bytes"]])


def verify(args: argparse.Namespace, evidence: Evidence):
    repo = Path(args.repo).resolve(strict=True)
    evidence.require("source.repositoryDirectory", repo.is_dir())
    contracts = (repo / "packages" / "contracts").resolve(strict=True)
    evidence.require("source.packageWithinRepository", contracts.is_dir() and contracts.is_relative_to(repo))
    evidence.require("source.commitLabelFormat", bool(re.fullmatch(r"[0-9a-f]{40}", args.expected_source)))
    evidence.result["source"] = {"repo": str(repo), "contracts": str(contracts)}
    baseline_raw = safe_file(repo / BASELINE_PATH, repo)
    evidence.require("baseline.pinnedNormalizedBytes", hashlib.sha256(baseline_raw.replace(b"\r\n", b"\n")).hexdigest() == BASELINE_LF_SHA256, **hashes(baseline_raw), normalizedLfSha256=hashlib.sha256(baseline_raw.replace(b"\r\n", b"\n")).hexdigest())
    baseline = json_object(baseline_raw)
    evidence.require("baseline.acceptedOwner", isinstance(baseline, dict) and baseline.get("base") == FROZEN_BASE and baseline.get("oldDistUnchanged") is True and isinstance(baseline.get("files"), list) and len(baseline["files"]) == 26)
    old_names = set()
    for row in baseline["files"]:
        evidence.require("baseline.rowShape", isinstance(row, dict) and set(row) == {"path", "bytes", "sha256"} and isinstance(row["path"], str) and row["path"].startswith("packages/contracts/dist/") and clean_relative(row["path"]) and type(row["bytes"]) is int and row["bytes"] >= 0 and isinstance(row["sha256"], str) and bool(HEX256.fullmatch(row["sha256"])))
        local_name = row["path"].removeprefix("packages/contracts/")
        evidence.require("baseline.uniqueDistRow", local_name not in old_names, path=local_name)
        old_names.add(local_name)
    artifact_arg = Path(args.artifact).absolute()
    archive, entries = read_archive(artifact_arg, evidence)
    expected_entries = {"package/" + name for name in ROOT_FILES | old_names | {"dist/" + name for name in NEW_DIST}}
    evidence.require("tar.exactPublicFileSet", set(entries) == expected_entries, missing=sorted(expected_entries - set(entries)), unexpected=sorted(set(entries) - expected_entries))
    evidence.check("tar.privateInputSourceAbsent", not any(name.startswith("package/conversation-input/") for name in entries))
    evidence.check("tar.packageLockAbsent", "package/package-lock.json" not in entries)
    for row in baseline["files"]:
        name = row["path"].removeprefix("packages/contracts/")
        source = hashes(safe_file(repo / row["path"], repo))
        packed = entries["package/" + name]
        evidence.check("frozen.dist", source == {"bytes": row["bytes"], "sha256": row["sha256"]} and packed["bytes"] == row["bytes"] and packed["sha256"] == row["sha256"], path=name, expected=row, source=source, packed={k: packed[k] for k in ("bytes", "sha256")})
    for name in sorted(NEW_DIST):
        source = hashes(safe_file(contracts / "dist" / name, contracts))
        packed = entries["package/dist/" + name]
        evidence.check("new.dist", source == {k: packed[k] for k in ("bytes", "sha256")}, path="dist/" + name, source=source, packed={k: packed[k] for k in ("bytes", "sha256")})
    dist_names = {path.name for path in (contracts / "dist").iterdir() if path.is_file()}
    evidence.check("source.exactDistFileSet", dist_names == {PurePosixPath(n).name for n in old_names} | NEW_DIST, observed=sorted(dist_names))
    for name in sorted(ROOT_FILES):
        source = hashes(safe_file(contracts / name, contracts))
        packed = entries["package/" + name]
        evidence.check("package.rootFileMatchesSource", source == {k: packed[k] for k in ("bytes", "sha256")}, path=name, source=source, packed={k: packed[k] for k in ("bytes", "sha256")})
    evidence.check("frozen.meriSchema", entries["package/meri.schema.json"]["sha256"] == MERI_SHA256 and hashlib.sha256(safe_file(contracts / "meri.schema.json", contracts)).hexdigest() == MERI_SHA256, expectedSha256=MERI_SHA256)
    lock = hashes(safe_file(contracts / "package-lock.json", contracts))
    evidence.check("frozen.packageLock", lock["sha256"] == LOCK_SHA256, expectedSha256=LOCK_SHA256, observed=lock)
    package = json_object(packed_bytes("package.json", archive, entries))
    evidence.require("package.object", isinstance(package, dict))
    evidence.check("package.identity", package.get("name") == "@capiro/meri-contracts" and package.get("version") == "0.1.7" and package.get("private") is True and package.get("type") == "module" and package.get("license") == "UNLICENSED", packageName=package.get("name"), version=package.get("version"))
    evidence.check("package.exactExports", package.get("exports") == EXPECTED_EXPORTS, expected=EXPECTED_EXPORTS, observed=package.get("exports"))
    evidence.check("package.exactDependencies", package.get("dependencies") == DEPENDENCIES and package.get("devDependencies") == DEV_DEPENDENCIES and not any(key in package for key in ("peerDependencies", "optionalDependencies", "bundledDependencies", "bundleDependencies", "overrides", "resolutions")), dependencies=package.get("dependencies"), devDependencies=package.get("devDependencies"))
    evidence.check("package.engineAndFiles", package.get("engines") == {"node": ">=24 <25"} and package.get("files") == ["meri.schema.json", "validate.mjs", "dist", "README.md", "THIRD-PARTY-NOTICES.md"])
    metadata = json_object(packed_bytes("dist/conversation-input.metadata.json", archive, entries))
    evidence.require("metadata.object", isinstance(metadata, dict))
    evidence.check("metadata.identity", metadata.get("packageVersion") == "0.1.7" and metadata.get("inputVersion") == "1.0.0" and metadata.get("schemaId") == "urn:meri:conversation-input:1.0.0")
    evidence.check("metadata.schemaHash", metadata.get("schemaSha256") == entries["package/dist/conversation-input.schema.json"]["sha256"], observed=metadata.get("schemaSha256"))
    expected_imports = [{"path": "./conversation-application.mjs", "artifact": "dist/conversation-application.mjs", "sha256": CANONICAL_BROWSER_SHA256}]
    evidence.check("metadata.exactCanonicalBrowserImport", metadata.get("browserImports") == expected_imports and entries["package/dist/conversation-application.mjs"]["sha256"] == CANONICAL_BROWSER_SHA256, expected=expected_imports, observed=metadata.get("browserImports"))
    sources = metadata.get("sources")
    evidence.require("metadata.sourcesBounded", isinstance(sources, list) and 1 <= len(sources) <= 64)
    source_names = set()
    for row in sources:
        evidence.require("metadata.sourceRowShape", isinstance(row, dict) and set(row) == {"path", "bytes", "sha256"} and isinstance(row["path"], str) and type(row["bytes"]) is int and 0 <= row["bytes"] <= COMPRESSED_LIMIT and isinstance(row["sha256"], str) and bool(HEX256.fullmatch(row["sha256"])))
        name = row["path"]
        evidence.require("metadata.uniqueSource", name not in source_names, path=name)
        source_names.add(name)
        target = metadata_source_path(name, repo, contracts)
        source = hashes(safe_file(target, repo if name in ROOT_METADATA_SOURCES else contracts))
        matched = source == {"bytes": row["bytes"], "sha256": row["sha256"]}
        evidence.check("metadata.sourceMatches", matched, path=name, expected={k: row[k] for k in ("bytes", "sha256")}, observed=source)
        evidence.result["metadataSources"].append({"path": name, "resolvedPath": str(target), **source, "matched": matched})
    evidence.check("metadata.exactSourceOwners", source_names == REQUIRED_METADATA_SOURCES, missing=sorted(REQUIRED_METADATA_SOURCES - source_names), unexpected=sorted(source_names - REQUIRED_METADATA_SOURCES))
    schema = json_object(packed_bytes("dist/conversation-input.schema.json", archive, entries))
    evidence.check("schema.identity", isinstance(schema, dict) and schema.get("$id") == "urn:meri:conversation-input:1.0.0")
    module = packed_bytes("dist/conversation-input.mjs", archive, entries)
    evidence.check("browser.canonicalSiblingLiteral", b'"./conversation-application.mjs"' in module or b"'./conversation-application.mjs'" in module)
    declarations = packed_bytes("dist/conversation-input.d.ts", archive, entries)
    evidence.check("types.canonicalPublicSelfReference", b"@capiro/meri-contracts/conversation-application" in declarations and b"from './conversation-application.mjs'" not in declarations and b'from "./conversation-application.mjs"' not in declarations)
    declaration_text = declarations.decode("utf-8", errors="strict")
    uses_error_name = bool(re.search(r"\bConversationInputErrorResponse\b", declaration_text))
    declares_error_name = bool(re.search(r"\b(?:type|interface)\s+ConversationInputErrorResponse\b", declaration_text))
    evidence.check("types.knownMissingErrorAliasRegression", not uses_error_name or declares_error_name, usesAdvertisedErrorName=uses_error_name, declaresAdvertisedErrorName=declares_error_name, limit="Known declaration-name regression only; actual no-skip TypeScript evidence remains separately required")
    evidence.result["files"] = [{k: row[k] for k in ("path", "bytes", "sha256")} for _, row in sorted(entries.items())]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--artifact", required=True)
    parser.add_argument("--expected-source", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    evidence = Evidence(args)
    report = Path(args.report).absolute().resolve()
    task_root = Path(__file__).resolve().parent
    try:
        # The only write is a task-local report outside the source checkout.
        repo = Path(args.repo).resolve()
        evidence.require("report.taskLocalOutsideSource", report.is_relative_to(task_root) and not report.is_relative_to(repo) and report != Path(args.artifact).absolute().resolve() and report != Path(__file__).resolve())
        evidence.result["verifier"] = {"path": str(Path(__file__).resolve()), **hashes(Path(__file__).read_bytes()), "python": sys.version.split()[0]}
        verify(args, evidence)
    except Exception as error:
        evidence.result["failure"] = {"type": type(error).__name__, "message": str(error)}
    evidence.result["finishedAt"] = datetime.now(timezone.utc).isoformat()
    evidence.result["passed"] = "failure" not in evidence.result and all(row["passed"] for row in evidence.result["checks"])
    evidence.result["checksPassed"] = sum(row["passed"] for row in evidence.result["checks"])
    evidence.result["checksFailed"] = sum(not row["passed"] for row in evidence.result["checks"])
    if not report.is_relative_to(task_root) or report.is_relative_to(Path(args.repo).resolve()) or report in (Path(args.artifact).absolute().resolve(), Path(__file__).resolve()):
        print(json.dumps(evidence.result, indent=2), file=sys.stdout)
        return 1
    try:
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps(evidence.result, indent=2) + "\n", encoding="utf-8")
    except OSError as error:
        evidence.result["passed"] = False
        evidence.result["reportWriteFailure"] = {"type": type(error).__name__, "message": str(error)}
        print(json.dumps(evidence.result, indent=2), file=sys.stdout)
        return 1
    print(json.dumps({"passed": evidence.result["passed"], "report": str(report), "checksPassed": evidence.result["checksPassed"], "checksFailed": evidence.result["checksFailed"], "sourceCommitVerified": False, "constraints": [CONSTRAINT]}, separators=(",", ":")))
    return 0 if evidence.result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
