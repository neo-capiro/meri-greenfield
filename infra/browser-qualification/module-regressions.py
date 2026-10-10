#!/usr/bin/env python3
"""W02-17 module-aware pure regressions for the extracted host_evidence package.

WHAT THIS FILE IS: a pure, in-process harness. It DOES import the production
entry (host-evidence.py) and its sibling host_evidence package, reads the three
immutable oracle fixtures and their source, and uses a small TEST-ONLY owner
proxy to replay the historical fixtures. Local source/fixture reads and Python
imports are permitted; proc/kernel reads, process, signal, socket and network
effects are faked. This is not a universal import-time IO proof.

WHY A PROXY: the two reviewed fixtures (codex-observer-checkpoint-audit.py and
owner-regressions-adapted.py) were authored against the single-file observer and
patch the loaded module `m`. After extraction the moved collector bodies resolve
their DEFINING module's globals, so patching the entry alias is no longer
effective for collector internals (W02-17 brief, "critical patch routing"). The
proxy routes collector-internal attribute access/patch to the collection module
while entry-owned CLI/capture/signal names stay on the entry.

FIXTURE BYTES ARE UNCHANGED: explicit loader/exit wiring and the two known final
result-write lines are adapted with checked anchor counts. The codex fixture
runs twice (once directly, once embedded inside the owner fixture, which keeps
its original `assert summary['failed']==0`), and owner runs once. The original
result-file writes are captured in memory instead of overwriting prior captured
files. All 23 + 33 original case names/inputs/assertions are preserved.

Run: <python> -B infra/browser-qualification/module-regressions.py
"""
import contextlib
import hashlib
import importlib.util
import io
import json
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parents[2]
INFRA = REPO / "infra" / "browser-qualification"
ENTRY = INFRA / "host-evidence.py"
TASK = REPO / ".task-inputs"

FIXTURE_SHA = {
    "codex-observer-checkpoint-audit.py": "d1900a591a6b43b92f194223b2be1838e2d3e15eb4454d78b7e23b02140275e2",
    "owner-regressions-adapted.py": "383360dd17127cae2df73c25cb5b963e0c0e283a29022701573509231661c528",
    "observer-before-4863878.py": "cbfd952e97936dcf5a1538ff769e4a897308d55482417fb5055860c45b27f471",
}


def fail(reason, **facts):
    print(json.dumps({"ok": False, "reason": reason, **facts}, indent=2))
    sys.exit(1)


# 1) verify the immutable oracle inputs before use
for name, sha in FIXTURE_SHA.items():
    path = TASK / name
    if not path.exists():
        fail("fixture missing", file=name)
    got = hashlib.sha256(path.read_bytes()).hexdigest()
    if got != sha:
        fail("fixture hash mismatch", file=name, expected=sha, got=got)

# 2) load the entry (which imports the sibling host_evidence package)
sys.dont_write_bytecode = True
if str(INFRA) not in sys.path:
    sys.path.insert(0, str(INFRA))
spec = importlib.util.spec_from_file_location("host_evidence_entry", str(ENTRY))
entry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(entry)
col = sys.modules["host_evidence.collection"]

# 3) test-only module-aware owner proxy
COLLECTION_OWNED = {
    "_read", "_boot_id", "_starttime", "_hash_exe", "_ns_inodes", "_file_identity",
    "_EXE_HASH_CACHE", "_evidence_read", "_task_ids", "_CollectionIssue",
    "_check_deadline", "_status_fields", "_process_identity", "_proc_record",
    "_threads", "_runner", "running_containers", "normalize_version", "preflight",
}


class _OwnerProxy:
    """Routes get/set/del to the module that actually owns the name."""

    def __init__(self):
        object.__setattr__(self, "_collection_owned", COLLECTION_OWNED)

    def _target(self, name):
        return col if name in self._collection_owned else entry

    def __getattr__(self, name):
        return getattr(self._target(name), name)

    def __setattr__(self, name, value):
        setattr(self._target(name), name, value)

    def __delattr__(self, name):
        delattr(self._target(name), name)


M = _OwnerProxy()

# in-memory capture of the original oracle summaries (no files overwritten)
ORACLE_SINK = []

CODEX_WRITE = "(HERE/'codex-observer-checkpoint-results.json').write_text"
OWNER_WRITE = "(HERE/'owner-regressions-adapted-results.json').write_text"


def patch_codex(text, embedded):
    """Adapt ONLY the two loader lines, the final result-write line and the exit.

    `embedded=True` restores the owner fixture's original embedded assertion
    (never softened); `embedded=False` captures the direct run's status.
    """
    hits = {"loader": 0, "write": 0, "exit": 0}
    out = []
    for line in text.split("\n"):
        if line.startswith("spec = importlib.util.spec_from_file_location"):
            hits["loader"] += 1
            continue
        if line.startswith("m = importlib.util.module_from_spec(spec)"):
            hits["loader"] += 1
            continue
        if line.startswith(CODEX_WRITE):
            hits["write"] += 1
            out.append("_ORACLE_SINK.append(summary)")
            continue
        if line.startswith("sys.exit(1 if summary"):
            hits["exit"] += 1
            out.append("assert summary['failed']==0" if embedded
                       else "_codex_failed=summary['failed']")
            continue
        out.append(line)
    assert hits == {"loader": 2, "write": 1, "exit": 1}, hits
    return "\n".join(out)


def patch_owner(text):
    hits = {"a": 0, "audit": 0, "write": 0, "exit": 0}
    out = []
    for line in text.split("\n"):
        if line.startswith("a={'__file__'"):
            hits["a"] += 1
            out.append("a={'__file__':str(HERE/'codex-observer-checkpoint-audit.py'),"
                       "'__name__':'owner_replay_fixtures','m':M,'_ORACLE_SINK':ORACLE_SINK}")
            continue
        if line.startswith("audit=(HERE/"):
            hits["audit"] += 1
            out.append("audit=CODEX_EMBEDDED")
            continue
        if line.startswith(OWNER_WRITE):
            hits["write"] += 1
            out.append("_owner_summary_captured=True")
            continue
        if line.startswith("raise SystemExit(1 if summary"):
            hits["exit"] += 1
            out.append("_owner_failed=summary['failed']")
            continue
        out.append(line)
    assert hits == {"a": 1, "audit": 1, "write": 1, "exit": 1}, hits
    return "\n".join(out)


codex_direct = patch_codex((TASK / "codex-observer-checkpoint-audit.py").read_text(), embedded=False)
codex_embedded = patch_codex((TASK / "codex-observer-checkpoint-audit.py").read_text(), embedded=True)
owner_src = patch_owner((TASK / "owner-regressions-adapted.py").read_text())

g = {"__file__": str(TASK / "codex-observer-checkpoint-audit.py"),
     "__name__": "codex_audit_direct", "m": M, "_ORACLE_SINK": ORACLE_SINK}
o = {"__file__": str(TASK / "owner-regressions-adapted.py"),
     "__name__": "owner_adapted", "M": M, "ORACLE_SINK": ORACLE_SINK,
     "CODEX_EMBEDDED": codex_embedded}

errors = {}
codex_buf, owner_buf = io.StringIO(), io.StringIO()
try:
    with contextlib.redirect_stdout(codex_buf):
        exec(compile(codex_direct, g["__file__"], "exec"), g)
except Exception as exc:  # noqa: BLE001 - surface the exact failing harness
    errors["codexDirect"] = "%s: %s" % (type(exc).__name__, exc)
try:
    with contextlib.redirect_stdout(owner_buf):
        exec(compile(owner_src, o["__file__"], "exec"), o)
except Exception as exc:  # noqa: BLE001
    errors["owner"] = "%s: %s" % (type(exc).__name__, exc)

# direct + embedded codex summaries captured in ORACLE_SINK; owner summary on `o`
direct = ORACLE_SINK[0] if len(ORACLE_SINK) >= 1 else {}
embedded = ORACLE_SINK[1] if len(ORACLE_SINK) >= 2 else {}
owner_summary = o.get("summary", {})

# 4) explicit new cases: shared-state identity + effective patch routing (fully faked)
new_cases = []


def xcheck(name, condition, **facts):
    new_cases.append(dict(name=name, passed=bool(condition), **facts))


xcheck("state-identity-cancel-shared", entry._CANCEL is col._CANCEL)
xcheck("state-identity-hash-cache-shared", entry._EXE_HASH_CACHE is col._EXE_HASH_CACHE)
entry._CANCEL["flag"] = True
xcheck("state-identity-cancel-mutation-propagates", col._CANCEL["flag"] is True)
entry._CANCEL["flag"] = False

from unittest.mock import patch as _patch  # test-only in-process patching


def _raises_collection_issue(fn):
    try:
        fn()
    except col._CollectionIssue:
        return True
    return False


# (a) entry alias is NOT effective: collection reads through its own binding.
# Fully faked - the entry alias returns a valid value, the collection binding
# returns None; the collection body must use the collection binding (and thus
# fail) and must never read a real/arbitrary path.
with _patch.object(entry, "_read", return_value="abc") as entry_read, \
        _patch.object(col, "_read", return_value=None) as collection_read:
    alias_ineffective = _raises_collection_issue(
        lambda: col._evidence_read("w02-17-synthetic-read"))
xcheck("fake-effect-entry-alias-patch-not-effective",
       alias_ineffective and entry_read.call_count == 0
       and collection_read.call_args_list == [(("w02-17-synthetic-read", 4097), {})],
       entry_read_calls=entry_read.call_count, collection_read_calls=collection_read.call_count)

# (b) the collection name IS the effective binding.
with _patch.object(col, "_read", return_value="abc") as collection_read:
    effective_value = col._evidence_read("w02-17-synthetic-read")
xcheck("fake-effect-collection-read-effective", effective_value == "abc"
       and collection_read.call_args_list == [(("w02-17-synthetic-read", 4097), {})],
       collection_read_calls=collection_read.call_count)

# (c) collect_observation resolves collector internals from collection, not entry.
_orig_hash = col._hash_exe
with _patch.object(col, "_hash_exe", return_value="d" * 64):
    resolved = col.collect_observation.__globals__["_hash_exe"]
    xcheck("fake-effect-collector-internals-resolve-on-collection",
           resolved is col._hash_exe and resolved() == "d" * 64)
    xcheck("fake-effect-entry-alias-not-remapped", entry._hash_exe is _orig_hash)

# 5) integrity assertions (expected counts must be asserted, not just reported)
integrity = []


def icheck(name, condition, **facts):
    integrity.append(dict(name=name, passed=bool(condition), **facts))


icheck("oracle-two-codex-executions", len(ORACLE_SINK) == 2, got=len(ORACLE_SINK))
icheck("codex-direct-23-cases", len(direct.get("observations", [])) == 23,
       got=len(direct.get("observations", [])))
icheck("codex-embedded-23-cases", len(embedded.get("observations", [])) == 23,
       got=len(embedded.get("observations", [])))
icheck("owner-33-cases", len(owner_summary.get("results", [])) == 33,
       got=len(owner_summary.get("results", [])))
icheck("no-harness-errors", not errors, errors=errors)


def _counts(cases):
    return {"count": len(cases), "passed": sum(c["passed"] for c in cases),
            "failed": sum(not c["passed"] for c in cases)}


summary = {
    "ok": False,
    "dependencyGraph": {
        "config": [],
        "evidence_io": ["config"],
        "classification": ["config"],
        "collection": ["config", "evidence_io", "classification"],
        "poll": ["config"],
        "entry": ["config", "evidence_io", "classification", "collection", "poll"],
    },
    "fixtures": {k: "verified" for k in FIXTURE_SHA},
    "errors": errors,
    "codexDirect": dict(_counts(direct.get("observations", [])),
                        observations=direct.get("observations", [])),
    "codexEmbedded": dict(_counts(embedded.get("observations", [])),
                          observations=embedded.get("observations", [])),
    "owner": dict(_counts(owner_summary.get("results", [])),
                  results=owner_summary.get("results", [])),
    "newCases": dict(_counts(new_cases), cases=new_cases),
    "integrity": dict(_counts(integrity), checks=integrity),
    "interpreter": sys.version.split()[0],
}
failed = (summary["codexDirect"]["failed"] + summary["codexEmbedded"]["failed"]
          + summary["owner"]["failed"] + summary["newCases"]["failed"]
          + summary["integrity"]["failed"])
summary["ok"] = failed == 0
print(json.dumps(summary, indent=2))
sys.exit(0 if summary["ok"] else 1)
