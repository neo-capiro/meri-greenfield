#!/usr/bin/env python3
# W02-06 browser-host observer + pure classifiers. PREPARATION ONLY - NOT run.
# W02-20 completes the focused extraction: the entry now only suppresses bytecode,
# imports the host_evidence modules explicitly and runs the CLI guard. Version
# normalisation, collection/classification, bounded polling, source binding, run
# admission, browser capture and the export protocol live in their own modules.
# security.test.mjs and pure fake-proc harnesses drive these modes offline. The39
# reviewed collector/classifier/poll/version/helper bodies remain exactly at4fd85f7.
# Records only safe versions/hashes/configuration. Fail closed. A Node process is
# never the browser. The pinned executable is hashed through /proc/<pid>/exe (the
# container mount namespace), never the host /opt path.
import sys

sys.dont_write_bytecode = True

import argparse, base64, hashlib, json, math, os, re, selectors, signal, subprocess, time, uuid


# The only executable entry gate uses stdlib before any package import. Its
# expectation comes from the reviewed loader on a protected privileged host.
_GATE_ASSETS = (
    "bootstrap.sh", "host-evidence.py", "host_evidence/__init__.py",
    "host_evidence/admission.py", "host_evidence/browser_capture.py",
    "host_evidence/classification.py", "host_evidence/cli.py",
    "host_evidence/collection.py", "host_evidence/config.py",
    "host_evidence/evidence_io.py", "host_evidence/export_protocol.py",
    "host_evidence/poll.py", "host_evidence/source_binding.py", "seccomp.json",
)
_GATE_MANIFEST = "source-manifest.v2.json"
_GATE_SCHEMA = "meri-browser-source/2"
_GATE_PROFILE_SHA = "e62f4c3e3e7ce6de099ba7a0e3df0881b7b407b74dc664aef70f76f6316385c6"


def _asset_gate_identity(value):
    return (value.st_dev, value.st_ino, value.st_mode, value.st_nlink,
            value.st_uid, value.st_size, value.st_mtime_ns,
            getattr(value, "st_birthtime_ns", value.st_ctime_ns) if os.name == "nt" else value.st_ctime_ns)


def _asset_gate_read(path, limit):
    import stat
    fd = None
    try:
        listed = os.lstat(path)
        if (not stat.S_ISREG(listed.st_mode) or listed.st_nlink != 1 or listed.st_uid != 0
                or stat.S_IMODE(listed.st_mode) != 0o600 or not 0 < listed.st_size <= limit):
            raise ValueError("gate file refused")
        fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_BINARY", 0))
        opened = os.fstat(fd)
        if _asset_gate_identity(listed) != _asset_gate_identity(opened):
            raise ValueError("gate file refused")
        chunks, total = [], 0
        while total <= limit:
            chunk = os.read(fd, min(65536, limit + 1 - total))
            if not chunk:
                break
            chunks.append(chunk)
            total += len(chunk)
        if total != opened.st_size or total > limit:
            raise ValueError("gate file refused")
        if _asset_gate_identity(opened) != _asset_gate_identity(os.fstat(fd)) or _asset_gate_identity(opened) != _asset_gate_identity(os.lstat(path)):
            raise ValueError("gate file refused")
        return b"".join(chunks)
    finally:
        if fd is not None:
            os.close(fd)


def _asset_gate_manifest(root):
    raw = _asset_gate_read(os.path.join(root, _GATE_MANIFEST), 32768)

    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("duplicate manifest key")
            result[key] = value
        return result

    data = json.loads(raw.decode("ascii"), object_pairs_hook=pairs)
    if (json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True) + "\n").encode("ascii") != raw:
        raise ValueError("noncanonical manifest")
    if type(data) is not dict or set(data) != {"assets", "schema"} or data["schema"] != _GATE_SCHEMA:
        raise ValueError("manifest schema refused")
    if type(data["assets"]) is not list or len(data["assets"]) != 14:
        raise ValueError("manifest records refused")
    for path, record in zip(_GATE_ASSETS, data["assets"]):
        if type(record) is not dict or set(record) != {"path", "bytes", "sha256"} or record["path"] != path:
            raise ValueError("manifest path refused")
        size, sha = record["bytes"], record["sha256"]
        if type(size) is not int or not 0 < size <= 2097152:
            raise ValueError("manifest size refused")
        if type(sha) is not str or re.fullmatch(r"[0-9a-f]{64}", sha) is None:
            raise ValueError("manifest hash refused")
    if data["assets"][-1]["sha256"] != _GATE_PROFILE_SHA:
        raise ValueError("manifest profile refused")
    return data


def _asset_gate_tree(root):
    import stat
    # Check every ancestor without following a link. Fixed loader installation
    # is /opt/meri-browser-host; named fixture imports never execute this gate.
    current = root
    while True:
        value = os.lstat(current)
        if not stat.S_ISDIR(value.st_mode) or value.st_uid != 0 or value.st_mode & 0o022:
            raise ValueError("gate ancestor refused")
        parent = os.path.dirname(current)
        if parent == current:
            break
        current = parent
    package = os.path.join(root, "host_evidence")
    for directory in (root, package):
        value = os.lstat(directory)
        if not stat.S_ISDIR(value.st_mode) or value.st_uid != 0 or stat.S_IMODE(value.st_mode) != 0o700:
            raise ValueError("gate directory refused")
    if set(os.listdir(root)) != {"bootstrap.sh", "host-evidence.py", "host_evidence", "seccomp.json", _GATE_MANIFEST}:
        raise ValueError("gate tree refused")
    if set(os.listdir(package)) != {p.split("/", 1)[1] for p in _GATE_ASSETS if "/" in p}:
        raise ValueError("gate package refused")


def _asset_gate_check():
    root = os.path.dirname(os.path.abspath(__file__))
    _asset_gate_tree(root)
    data = _asset_gate_manifest(root)
    for record in data["assets"]:
        raw = _asset_gate_read(os.path.join(root, *record["path"].split("/")), record["bytes"])
        if len(raw) != record["bytes"] or hashlib.sha256(raw).hexdigest() != record["sha256"]:
            raise ValueError("gate source refused")
    _asset_gate_tree(root)
    if _asset_gate_manifest(root) != data:
        raise ValueError("gate manifest changed")
    return root


if __name__ == "__main__":
    try:
        sys.path.insert(0, _asset_gate_check())
    except (OSError, ValueError, UnicodeError, RecursionError):
        raise SystemExit("browser-host gate: reviewed source tree refused") from None

from host_evidence.classification import (
    _all_caps_zero, _ancestry_ok, _cap_valid, _cap_zero, _cgroup_matches, _hex64_ok,
    _in_root, _is_node, _list_has, _ns, _ns_complete, _parse_uid_map_strict, _pos_int,
    _thread_ok, _uuid_ok, _worker_ids_ok, classify,
)
from host_evidence.collection import (
    _CANCEL, _CollectionIssue, _EXE_HASH_CACHE, _boot_id, _check_deadline,
    _evidence_read, _file_identity, _hash_exe, _ns_inodes, _proc_record,
    _process_identity, _runner, _starttime, _status_fields, _task_ids, _threads,
    collect_observation, normalize_version, preflight, running_containers,
)
from host_evidence.config import (
    BROWSER_EXE_PATTERN, BROWSER_ROOT, BROWSER_VERSION, CAP_KEYS, CAPTURE_FILE_MAX,
    CHROMIUM_SAFE_KINDS, CONTEXT_KEYS, DISABLING_FLAGS, EXPECTED_SECCOMP_PATH,
    EXPECTED_SECCOMP_SHA256, EXPORT_BATCH_BYTES, EXPORT_BATCH_EVENTS, EXPORT_CHUNK_B64_MAX,
    EXPORT_CHUNK_RAW_MAX, EXPORT_EVENT_MAX, EXPORT_EVENT_OVERHEAD, EXPORT_MAX_CALLS,
    EXPORT_MAX_EVENTS, EXPORT_TOTAL_RAW_MAX, MAX_COMMAND_BYTES, MAX_EXE_BYTES,
    MAX_EXPORT_BYTES, MAX_EXPORT_CALLS, MAX_EXPORT_EVENTS, MAX_FIELD, MAX_OBSERVATION_BYTES,
    MAX_PIDS, MAX_POLL_SECONDS, MAX_THREADS, NODE_EXE, NS_KEYS, PINNED_BROWSER_EXE,
    PINNED_BROWSER_SHA256, PINNED_IMAGE, PINNED_WORKER_CONFIG_ID, PINNED_WORKER_KIND,
    PINNED_WORKER_REVISION, PROBE_CMD, RECORD_NAMES, REQUIRED_SUBSTEPS, RESOURCE_CAPS,
    SAFE_IMAGE_ENV, SHA256_PREFIXED, SUPPORT_PATTERN, WORKSPACE_SOURCE, _HEX64,
)
from host_evidence.evidence_io import (
    _atomic_write, _bounded_text, _evidence_identity, _exact_keys, _finite_json,
    _load_json, _read, _read_bytes, _strict_json,
)
from host_evidence.poll import run_bounded_poll
from host_evidence.source_binding import _context_ok, source_manifest
from host_evidence.admission import (
    _browser_payload_reasons, _inspect_reasons, _sandbox_rows_ok, timer_record,
    verify_run_record,
)
from host_evidence.browser_capture import assemble_run_record, capture_browser, process_platform_linux
from host_evidence.export_protocol import (
    assemble_export_records, build_export_protocol, classify_put_response,
    render_export_batches, validate_export,
)
from host_evidence.cli import _dump, _install_signals, main


if __name__ == "__main__":
    sys.exit(main())
