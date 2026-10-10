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
