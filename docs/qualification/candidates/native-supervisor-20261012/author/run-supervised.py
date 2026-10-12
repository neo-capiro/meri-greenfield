"""Source-only adaptation of the exact ancestor wrapper; native entry is HOLD.

The historical wrapper and diagnostic remain unchanged. This module has no CLI
that executes them. run_supervised is the concrete future composition, pending
independent review, private exact binding, a qualified enclosing watchdog and
specific action authority. Importing this file performs no I/O or execution.
"""
import hashlib
import json
from pathlib import Path, PureWindowsPath
import stat
import subprocess
import threading
import time

SCRIPT_BYTES = 6297
SCRIPT_SHA = "9514b8e8ad0aff24e1eea7e782dd32178d856011fafcb750ce2c0f9a715c6efd"
EXECUTABLE_BYTES = 91648
EXECUTABLE_SHA = "f1d8d2aa2a8ad7c74b6c6300b29cfdbcb484fc7ffad99b7fbfe1e31c048343b9"
ORIGINAL_RECEIPT_SHA = "9b0b0633ce4f1bec0c59fa4acc8e1637f7236a1e1b87a4a5e2aae3fcbc302842"
SOURCE_COMMIT = "c225c4f6247c22c8906a23758477e431e3d88c15"
SOURCE_TREE = "196ae19a744e40ba1a2b528daddeb42abe47ea94"
# The parent has not relayed these complete, independently reviewed records.
# Source edits plus independent review are necessary to bind them. A caller's
# label or shortened list must never substitute for preserved membership.
SOURCE_VERIFICATION_SHA256 = None
PRIOR_MANIFEST_SHA256 = None
GIT_EXECUTABLE = None
GIT_EXECUTABLE_SHA256 = None
GIT_EXECUTABLE_BYTES = None


def require(predicate, reason):
    if not predicate:
        raise ValueError(reason)


def local_path(value):
    require(type(value) is str and 0 < len(value) <= 1024 and "\x00" not in value,
            "private_absolute_local_path_required")
    path = PureWindowsPath(value)
    require(path.is_absolute() and len(path.drive) == 2 and path.drive[1] == ":"
            and path.drive[0].isalpha() and ".." not in path.parts
            and str(path) == value and len(path.parents) <= 64,
            "private_absolute_local_path_required")
    return path


def bind(action, original_raw):
    """Exact private action, distinct from the original executable selection."""
    require(type(action) is dict, "private_action_required")
    names = {"selectedExecutable", "script", "cwd", "repository", "originalOutput",
             "destination", "originalReceipt", "sourceVerification", "priorManifest"}
    require(set(action) == names, "exact_private_action_fields_required")
    paths = {name: local_path(action[name]) for name in names}
    require(len(original_raw) == 1407 and hashlib.sha256(original_raw).hexdigest()
            == ORIGINAL_RECEIPT_SHA, "original_receipt_identity")
    original = json.loads(original_raw)
    require(original["retryAllowed"] is False and type(original["exitCode"]) is int
            and original["exitCode"] == 2, "original_refusal_receipt_required")
    require(original["sourceCommit"] == SOURCE_COMMIT and original["sourceTree"] == SOURCE_TREE,
            "original_source_binding")
    argv = original["argv"]
    require(type(argv) is list and argv.count("--output") == 1, "original_output_binding")
    output = argv[argv.index("--output") + 1]
    require(action["repository"] == original["cwd"] and action["originalOutput"] == output,
            "original_repository_output_unchanged")
    require(paths["script"].name == "inspect-ancestor-metadata.py"
            and paths["script"].parent == paths["cwd"], "diagnostic_location_binding")
    receipt_path = paths["originalReceipt"]
    require(receipt_path.name == "receipt.json" and receipt_path.parent.name == "collector-command"
            and receipt_path.parent.parent.name == "originals"
            and paths["sourceVerification"] == receipt_path.parent.parent / "source-verification.json",
            "original_source_verification_location")
    destination = paths["destination"]
    # No write can fall into the preserved source, original output or script tree.
    for preserved in (paths["repository"], paths["originalOutput"], paths["cwd"]):
        require(destination != preserved and preserved not in destination.parents
                and destination not in preserved.parents, "fresh_destination_separation")
    return [action["selectedExecutable"], "-I", "-B", "-S", action["script"],
            "--repository", action["repository"], "--original-output", action["originalOutput"]]


def native_spawn(argv, cwd):
    return subprocess.Popen(argv, cwd=cwd, stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            shell=False, bufsize=0)


def native_thread(target):
    return threading.Thread(target=target, daemon=True)


def checked_file(path, budget, inventory, fs, *, expected_bytes=None, expected_sha=None):
    budget.check("action")
    record = inventory.hash_file(Path(path), fs=fs, clock=budget.clock,
                                 end=budget.action_end, cap=1048576, allow_empty=True)
    budget.check("action")
    if expected_bytes is not None:
        require(record["bytes"] == expected_bytes, "file_byte_identity")
    if expected_sha is not None:
        require(record["sha256"] == expected_sha, "file_hash_identity")
    return record


def read_json(path, budget, inventory, fs):
    budget.check("action")
    path = Path(path)
    inventory.ancestors(path.parent, fs)
    before = inventory.plain(path, fs)
    require(0 < before.st_size <= 1048576, "json_file_byte_bound")
    descriptor = fs.open_read(path)
    chunks, count = [], 0
    try:
        opened = fs.fstat(descriptor)
        require((opened.st_dev, opened.st_ino, opened.st_size, opened.st_nlink) ==
                (before.st_dev, before.st_ino, before.st_size, before.st_nlink)
                and stat.S_ISREG(opened.st_mode), "json_open_identity_changed")
        while True:
            budget.check("action")
            chunk = fs.read(descriptor, min(65536, 1048577 - count))
            budget.check("action")
            require(type(chunk) is bytes, "json_binary_read_required")
            if chunk == b"":
                break
            count += len(chunk)
            require(count <= 1048576 and count <= before.st_size, "json_growing_file_refused")
            chunks.append(chunk)
        require(inventory.identity(fs.fstat(descriptor)) == inventory.identity(opened),
                "json_opened_file_changed")
    finally:
        fs.close(descriptor)
    budget.check("action")
    require(inventory.identity(inventory.plain(path, fs)) == inventory.identity(before)
            and count == before.st_size, "json_named_file_changed")
    raw = b"".join(chunks)
    value = json.loads(raw)
    budget.check("action")
    return value, raw


def fixed_git(repository, args, budget, capture):
    result = capture([GIT_EXECUTABLE, "-C", repository, *args], repository, budget,
                     spawn=native_spawn, make_thread=native_thread, sleep=time.sleep)
    require(result["observationEligible"] and result["exitCode"] == 0, "original_git_verification_failed")
    return result["streams"]["stdout"]["data"].decode("ascii").strip()


def verify_original_source(action, verification, budget, inventory, fs, capture):
    repository = action["repository"]
    require(fixed_git(repository, ["rev-parse", "HEAD"], budget, capture) == SOURCE_COMMIT,
            "original_source_commit_changed")
    require(fixed_git(repository, ["rev-parse", "HEAD^{tree}"], budget, capture) == SOURCE_TREE,
            "original_source_tree_changed")
    require(not fixed_git(repository, ["status", "--porcelain", "--untracked-files=all"], budget, capture),
            "original_source_worktree_changed")
    rows = verification["files"]
    require(type(rows) is list and 0 < len(rows) <= 256, "source_verification_bound")
    seen, total = set(), 0
    for row in rows:
        relative = PureWindowsPath(row["path"])
        require(not relative.is_absolute() and not relative.drive and ".." not in relative.parts
                and row["path"] not in seen, "source_verification_relative_path")
        seen.add(row["path"])
        record = checked_file(Path(repository) / row["path"], budget, inventory, fs,
                              expected_bytes=row["bytes"], expected_sha=row["sha256"])
        total += record["bytes"]
        require(total <= 16777216, "source_verification_aggregate_bound")
    return {"trackedFilesVerified": len(rows), "allOriginalSizesAndHashesMatch": True,
            "gitStatusClean": True}


def verify_prior(manifest, budget, inventory, fs):
    # Membership must come from the preserved, independently reviewed original
    # evidence manifest. A caller-created short list is not complete preservation.
    rows = manifest["files"]
    require(type(rows) is list and 0 < len(rows) <= 256, "prior_manifest_bound")
    records, seen, total = [], set(), 0
    for row in rows:
        path = str(local_path(row["path"]))
        require(path.casefold() not in seen, "prior_manifest_duplicate")
        seen.add(path.casefold())
        record = checked_file(path, budget, inventory, fs,
                              expected_bytes=row["bytes"], expected_sha=row["sha256"])
        total += record["bytes"]
        require(total <= 16777216, "prior_manifest_aggregate_bound")
        records.append(record)
    return records


def run_supervised(action, *, lifecycle, inventory):
    """Unadmitted concrete native composition; NEVER invoke under this task.

    lifecycle is the exact sibling source; inventory is the unchanged canonical
    scripts/qualification/worker_runner_inventory.py module. These are explicit
    composition dependencies, not target-selected modules or caller booleans.
    The caller must first qualify a real enclosing watchdog and approve the exact
    private action. This function alone cannot enforce that external boundary.
    """
    budget = lifecycle.Budget(time.monotonic)
    # No filesystem read, allocation, Git or child call can occur while these
    # preservation inputs are unresolved. They are not caller-supplied flags.
    require(SOURCE_VERIFICATION_SHA256 is not None and PRIOR_MANIFEST_SHA256 is not None,
            "HOLD_unresolved_exact_preservation_records")
    require(GIT_EXECUTABLE is not None and GIT_EXECUTABLE_SHA256 is not None
            and GIT_EXECUTABLE_BYTES is not None, "HOLD_unresolved_native_git_identity")
    local_path(GIT_EXECUTABLE)
    require(type(action) is dict and "originalReceipt" in action, "private_action_required")
    local_path(action["originalReceipt"])
    fs = inventory.Filesystem()
    destination = None
    # Fixed original receipt must be read without changing its contents.
    original, original_raw = read_json(action["originalReceipt"], budget, inventory, fs)
    argv = bind(action, original_raw)
    verification, verification_raw = read_json(action["sourceVerification"], budget, inventory, fs)
    prior_manifest, prior_manifest_raw = read_json(action["priorManifest"], budget, inventory, fs)
    require(hashlib.sha256(verification_raw).hexdigest() == SOURCE_VERIFICATION_SHA256,
            "source_verification_record_identity")
    require(hashlib.sha256(prior_manifest_raw).hexdigest() == PRIOR_MANIFEST_SHA256,
            "prior_manifest_record_identity")
    prior_before = verify_prior(prior_manifest, budget, inventory, fs)
    script_before = checked_file(action["script"], budget, inventory, fs,
                                 expected_bytes=SCRIPT_BYTES, expected_sha=SCRIPT_SHA)
    executable_before = checked_file(action["selectedExecutable"], budget, inventory, fs,
                                     expected_bytes=EXECUTABLE_BYTES, expected_sha=EXECUTABLE_SHA)
    git_before = checked_file(GIT_EXECUTABLE, budget, inventory, fs,
                              expected_bytes=GIT_EXECUTABLE_BYTES, expected_sha=GIT_EXECUTABLE_SHA256)
    source_before = verify_original_source(action, verification, budget, inventory, fs, lifecycle.capture)
    parent = Path(action["originalOutput"]).parent
    inventory.ancestors(parent, fs)
    parent_before = inventory.identity(inventory.plain(parent, fs, directory=True))
    destination = Path(action["destination"])
    inventory.ancestors(destination.parent, fs)
    budget.check("action")
    destination.mkdir(exist_ok=False)
    owned = inventory.identity(inventory.plain(destination, fs, directory=True))[:2]
    budget.check("action")
    result = lifecycle.capture(argv, action["cwd"], budget, spawn=native_spawn,
                               make_thread=native_thread, sleep=time.sleep)
    # Capture failure is preserved as bounded raw streams where settled. It does
    # not authorize a retry or bypass subsequent preservation checks.
    post_error = None
    try:
        verify_original_source(action, verification, budget, inventory, fs, lifecycle.capture)
        require(verify_prior(prior_manifest, budget, inventory, fs) == prior_before, "prior_evidence_changed")
        require(checked_file(action["selectedExecutable"], budget, inventory, fs) == executable_before,
                "selected_executable_changed")
        require(checked_file(action["script"], budget, inventory, fs) == script_before, "diagnostic_source_changed")
        require(checked_file(GIT_EXECUTABLE, budget, inventory, fs) == git_before, "git_executable_changed")
        require(read_json(action["originalReceipt"], budget, inventory, fs)[1] == original_raw,
                "original_receipt_changed")
        require(read_json(action["sourceVerification"], budget, inventory, fs)[1] == verification_raw,
                "source_verification_changed")
        require(read_json(action["priorManifest"], budget, inventory, fs)[1] == prior_manifest_raw,
                "prior_manifest_changed")
        require(inventory.identity(inventory.plain(parent, fs, directory=True)) == parent_before,
                "original_output_parent_changed")
    except Exception as error:
        post_error = type(error).__name__
    observed = None
    if result["observationEligible"] and post_error is None:
        raw = result["streams"]["stdout"]["data"]
        require(raw.isascii(), "diagnostic_ascii_required")
        require("C:\\" not in raw.decode("ascii") and "/Users/" not in raw.decode("ascii"),
                "diagnostic_private_path_refused")
        observed = json.loads(raw)
        for name in ("runnerQualified", "buildAuthorized", "runtimeAccepted", "collectorExecuted"):
            require(observed.get(name) is False, "diagnostic_admission_field")
        for name in ("fileBodiesRead", "filesystemWrites", "childProcesses"):
            require(type(observed.get(name)) is int and observed[name] == 0, "diagnostic_scope_field")
    artifacts = {}
    streams = result.pop("streams")
    if streams is not None:
        for name, row in streams.items():
            raw = row.pop("data")
            artifacts[name + ".bin"] = raw
            row.update(retainedBytes=len(raw), retainedSha256=hashlib.sha256(raw).hexdigest())
        result["streams"] = streams
    receipt = {"command": result, "argv": argv, "sourceBefore": source_before,
               "diagnosticOutput": observed, "postVerificationError": post_error,
               "collectorRerun": False, "previousDiagnosticRerun": False,
               "runtimeAccepted": False, "buildAccepted": False, "g1Accepted": False,
               "historicalSupervisorIdentityEstablished": False,
               "priorCandidateFullBracketAccepted": False,
               "wrapperElapsedBeforeEvidenceSeconds": budget.clock() - budget.started,
               "cooperativeTotalSeconds": 15, "hardTotalProven": False,
               "externalFinalTimeAndExitReceiptRequired": True,
               "evidencePublicationVerified": False,
               "publicationHold": "exclusive raw writes lack verified final readback and membership"}
    artifacts["command-receipt.json"] = (json.dumps(receipt, ensure_ascii=True, indent=2) + "\n").encode("ascii")
    for name, raw in artifacts.items():
        budget.check("total")
        require(inventory.identity(inventory.plain(destination, fs, directory=True))[:2] == owned,
                "owned_destination_substituted")
        with (destination / name).open("xb") as handle:
            handle.write(raw)
        budget.check("total")
    # Packaging/upload is a separate future bounded action; never extend this15s.
    return receipt


if __name__ == "__main__":
    raise SystemExit("HOLD: source review only; no native execution entry is admitted")
