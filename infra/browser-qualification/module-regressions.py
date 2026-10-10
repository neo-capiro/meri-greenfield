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
patch the loaded module `m`. After extraction the moved bodies resolve their
DEFINING module's globals, so patching the entry alias is no longer effective:
collector internals resolve on `collection` (W02-17) and the historical
main/watch patches (`collect_observation`, `run_bounded_poll`, `_install_signals`,
`_dump`, `_atomic_write`, `MAX_OBSERVATION_BYTES`) resolve on the CLI module's
imported caller bindings (W02-20). The proxy routes each name to its actual owner.

FIXTURE BYTES ARE UNCHANGED: explicit loader/exit wiring and the two known final
result-write lines are adapted with checked anchor counts. The codex fixture
runs twice (once directly, once embedded inside the owner fixture, which keeps
its original `assert summary['failed']==0`), and owner runs once. The original
result-file writes are captured in memory instead of overwriting prior captured
files. All 23 + 33 original case names/inputs/assertions are preserved.

Run: <python> -B infra/browser-qualification/module-regressions.py
"""
import ast
import contextlib
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import sys
import tempfile
import uuid

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
cli = sys.modules["host_evidence.cli"]
bc = sys.modules["host_evidence.browser_capture"]
sb = sys.modules["host_evidence.source_binding"]

# 3) test-only module-aware owner proxy
COLLECTION_OWNED = {
    "_read", "_boot_id", "_starttime", "_hash_exe", "_ns_inodes", "_file_identity",
    "_EXE_HASH_CACHE", "_evidence_read", "_task_ids", "_CollectionIssue",
    "_check_deadline", "_status_fields", "_process_identity", "_proc_record",
    "_threads", "_runner", "running_containers", "normalize_version", "preflight",
}
# W02-20: main/watch resolve these through the CLI's imported caller bindings.
CLI_OWNED = {
    "collect_observation", "run_bounded_poll", "_install_signals", "_dump",
    "_atomic_write", "MAX_OBSERVATION_BYTES", "main",
}


class _OwnerProxy:
    """Routes get/set/del to the module that actually owns the name.

    Collector internals resolve on `collection`; historical main/watch patches
    resolve on `cli` (its imported caller bindings); everything else on the entry.
    """

    def __init__(self):
        object.__setattr__(self, "_collection_owned", COLLECTION_OWNED)

    def _target(self, name):
        if name in self._collection_owned:
            return col
        if name in CLI_OWNED:
            return cli
        return entry

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
    """Adapt ONLY the two loader lines, the source-path view, the final
    result-write line and the exit.

    `embedded=True` restores the owner fixture's original embedded assertion
    (never softened); `embedded=False` captures the direct run's status.
    """
    hits = {"loader": 0, "write": 0, "exit": 0, "source": 0}
    out = []
    for line in text.split("\n"):
        if line.startswith("spec = importlib.util.spec_from_file_location"):
            hits["loader"] += 1
            continue
        if line.startswith("m = importlib.util.module_from_spec(spec)"):
            hits["loader"] += 1
            continue
        if line.startswith("SOURCE = HERE.parent"):
            # W02-20: the deferred definitions moved out of the entry, so the
            # legacy single-file owner comparison reads the flattened view.
            hits["source"] += 1
            out.append("SOURCE = pathlib.Path(%r)" % str(COMPOSITE))
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
    assert hits == {"loader": 2, "write": 1, "exit": 1, "source": 1}, hits
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


# Fresh exclusive W02-20 invocation scratch beneath this worktree's ignored .task-inputs.
_HARNESS_SCRATCH = pathlib.Path(tempfile.mkdtemp(dir=str(TASK), prefix="W02-20-harness-"))

# Module files whose definitions may be located for the legacy flattened view.
_PKG_FILES = [ENTRY] + [INFRA / "host_evidence" / (n + ".py") for n in (
    "__init__", "config", "evidence_io", "classification", "collection", "poll",
    "source_binding", "admission", "browser_capture", "export_protocol", "cli")]

# Original single-file order of the 24 moved definitions (W02-20 flattened view).
_DEFER_ORDER = [
    "_finite_json", "_exact_keys", "_strict_json", "_bounded_text", "_evidence_identity",
    "source_manifest", "_context_ok", "_sandbox_rows_ok", "timer_record",
    "_browser_payload_reasons", "_inspect_reasons", "verify_run_record",
    "build_export_protocol", "validate_export", "classify_put_response",
    "render_export_batches", "_load_json", "capture_browser", "process_platform_linux",
    "assemble_run_record", "assemble_export_records", "_dump", "_install_signals", "main",
]


def _flattened_source_path():
    """Flatten the moved definitions into one syntactically valid text in the
    ORIGINAL source order so the legacy single-file owner comparison can locate
    each definition. TEST-ONLY historical single-file representation: every segment
    is the real current source of its owning module (no regeneration; the trailing
    marker keeps the historical boundary index used by observer-before-4863878.py).
    It is NOT the production loading representation -- the production bodies and
    import graph are verified separately -- and it does not prove the unchanged
    oracle ran against production loading without adaptation."""
    located = {}
    for f in _PKG_FILES:
        src = f.read_text(encoding="utf-8")
        for n in ast.parse(src).body:
            if isinstance(n, (ast.FunctionDef, ast.ClassDef)) and n.name not in located:
                located[n.name] = ast.get_source_segment(src, n)
    parts = [ENTRY.read_text(encoding="utf-8")]
    for name in _DEFER_ORDER:
        parts.append(located[name])
    parts.append("# --- bounded real collector (moved to host_evidence modules)")
    path = _HARNESS_SCRATCH / ("flattened-source-%s.py" % uuid.uuid4().hex)
    with open(path, "x", encoding="utf-8") as fh:
        fh.write("\n\n".join(parts))
    return path


COMPOSITE = _flattened_source_path()

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

# ---- W02-20 cases: CLI caller-binding routing, source root, capture, export ----
adm = sys.modules["host_evidence.admission"]
RUN = "b0ae553a-a4c1-44c8-93b4-45afc6ed0139"

# (d) historical main/watch patches must resolve on the CLI imported bindings.
_cli_polls = []


def _watch_poll(collect, alive, **kwargs):
    _cli_polls.append("poll")
    return dict(bestOk=True, bestObservation={"containerId": "c" * 64},
                bestClassification={"ok": True}, observation={}, lifecycle="stopped", timeline=[])


_cap = {}


def _fake_dump(obj, path=None):
    _cap.update(obj)
    return 0 if obj.get("ok") else 3


_watch_args = ["--watch", "--container-name", "meri-browser-probe-" + RUN, "--run-id", RUN, "--out", "fake-only"]
with _patch.object(cli, "_install_signals"), \
        _patch.object(cli, "run_bounded_poll", side_effect=_watch_poll) as cli_poll, \
        _patch.object(cli, "_atomic_write"), _patch.object(cli, "_dump", side_effect=_fake_dump):
    watch_code = entry.main(_watch_args)
xcheck("fake-effect-cli-run-bounded-poll-effective",
       cli_poll.called and watch_code == 0 and _cap.get("runId") == RUN,
       watchCode=watch_code, polls=len(_cli_polls))

_entry_polls = []
with _patch.object(entry, "run_bounded_poll", side_effect=lambda *a, **k: _entry_polls.append(1) or {}), \
        _patch.object(cli, "_install_signals"), \
        _patch.object(cli, "run_bounded_poll", side_effect=_watch_poll), \
        _patch.object(cli, "_atomic_write"), _patch.object(cli, "_dump", side_effect=_fake_dump):
    entry.main(_watch_args)
xcheck("fake-effect-entry-run-bounded-poll-not-used-by-cli", not _entry_polls)

# (e) canonical source root and cwd independence
_obs_sha = hashlib.sha256(ENTRY.read_bytes()).hexdigest()
xcheck("source-root-canonical", sb._source_root() == str(INFRA), got=sb._source_root())
m1 = entry.source_manifest()
_cwd0 = os.getcwd()
with tempfile.TemporaryDirectory(dir=str(_HARNESS_SCRATCH)) as _tmpd:
    try:
        os.chdir(_tmpd)
        m2 = entry.source_manifest()
    finally:
        os.chdir(_cwd0)
xcheck("source-manifest-canonical-root-and-cwd-independent",
       m1 == m2 and m1["observer"]["sha256"] == _obs_sha and m1["seccomp"]["bytes"] == 17188)

# (f) source_manifest locator/reader mapped-IO fixtures. _source_root is faked as
#     an explicit TEST SEAM for guest pathname simulation (not a production root
#     override); _bounded_text and path-exists are intercepted before the caller.
_guest = "/guest/browser-host"
_guest_reads = []


def _guest_reader(path, limit=None):
    _guest_reads.append(path)
    if path.endswith("host-evidence.py"):
        return "OBS"
    if path.endswith("bootstrap.sh"):
        return "BOOT"
    if path.endswith("seccomp.json"):
        return "SEC"
    if path.endswith("seccomp.chromium-155-amd64.json"):
        return "SECFALL"
    raise AssertionError("unexpected source read " + path)


_orig_locator = sb._source_root
_orig_bounded = sb._bounded_text
with _patch.object(sb, "_source_root", return_value=_guest) as _loc, \
        _patch.object(sb.os.path, "exists", return_value=True), \
        _patch.object(sb, "_bounded_text", side_effect=_guest_reader):
    _present = sb.source_manifest()
xcheck("source-manifest-guest-present-seccomp-json",
       _loc.called and set(_present) == {"observer", "bootstrap", "seccomp"}
       and _guest_reads == [os.path.join(_guest, "host-evidence.py"),
                            os.path.join(_guest, "bootstrap.sh"),
                            os.path.join(_guest, "seccomp.json")],
       reads=_guest_reads)

_guest_reads.clear()
with _patch.object(sb, "_source_root", return_value=_guest), \
        _patch.object(sb.os.path, "exists", return_value=False), \
        _patch.object(sb, "_bounded_text", side_effect=_guest_reader):
    _fallback = sb.source_manifest()
xcheck("source-manifest-guest-fallback-profile-name",
       set(_fallback) == {"observer", "bootstrap", "seccomp"}
       and _guest_reads[-1] == os.path.join(_guest, "seccomp.chromium-155-amd64.json"),
       reads=_guest_reads)


def _refusing_reader(path, limit=None):
    raise OSError("missing layout: " + path)


_refused = False
try:
    with _patch.object(sb, "_source_root", return_value="/absent/layout"), \
            _patch.object(sb.os.path, "exists", return_value=True), \
            _patch.object(sb, "_bounded_text", side_effect=_refusing_reader):
        sb.source_manifest()
except OSError:
    _refused = True
xcheck("source-manifest-wrong-layout-refuses-from-source-reads", _refused)
xcheck("source-manifest-locator-and-reader-restored",
       sb._source_root is _orig_locator and sb._bounded_text is _orig_bounded)

# (g) missing/wrong layout refuses through the admission source read
with _patch.object(adm, "source_manifest", side_effect=OSError("missing layout")):
    bad_src = entry.verify_run_record({"runId": RUN, "source": {}})
xcheck("admission-missing-source-refused",
       bad_src["ok"] is False and any("source hashes unavailable" in r for r in bad_src["reasons"]),
       reasons=bad_src["reasons"])

# (h) strict / bounded IO primitives. The bounded-read case deliberately exercises
#     a REAL local file as a bounded filesystem fixture, confined to task scratch.
try:
    entry._strict_json('{"a":1,"a":2}'); _dup = False
except ValueError:
    _dup = True
xcheck("strict-json-duplicate-key-refused", _dup)
_fd, _p = tempfile.mkstemp(dir=str(_HARNESS_SCRATCH)); os.close(_fd)
try:
    with open(_p, "w", encoding="utf-8") as _fh:
        _fh.write("x" * 32)
    try:
        entry._bounded_text(_p, 8); _over = False
    except ValueError:
        _over = True
finally:
    os.remove(_p)
xcheck("bounded-text-oversize-refused", _over)

# (i) capture and assembly CALLER fixtures. Every application filesystem, process
#     and signal operation is intercepted BEFORE invoking the real moved functions;
#     any unanticipated access raises instead of silently using a real/default path.
class _Stream:
    def __init__(self, fd):
        self.fd = fd

    def fileno(self):
        return self.fd

    def close(self):
        pass


class _KillProc:
    def __init__(self):
        self.pid = 4242
        self.stdout = _Stream(100)
        self.stderr = _Stream(101)
        self.kills = 0
        self.waits = 0

    def wait(self, timeout):
        self.waits += 1
        return -9 if self.kills else 0

    def kill(self):
        self.kills += 1


class _NoSel:
    def __enter__(self):
        return self

    def __exit__(self, *a):
        pass

    def register(self, f, e, d=None):
        pass

    def unregister(self, f):
        pass

    def select(self, t):
        return []


class _FakeFile:
    def __init__(self, path, mode):
        self.path = path
        self.mode = mode
        self.data = bytearray()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def write(self, b):
        self.data += b
        return len(b)


_capdir = _HARNESS_SCRATCH / ("capture-%s" % uuid.uuid4().hex)
_capdir.mkdir()
_cap_opens = []


def _strict_capture_open(path, mode="r", *a, **k):
    p = str(path)
    if mode != "xb" or os.path.dirname(p) != str(_capdir) or os.path.basename(p) not in ("browser.stdout", "browser.stderr"):
        raise AssertionError("unexpected application open: %r %r" % (p, mode))
    fh = _FakeFile(p, mode)
    _cap_opens.append(fh)
    return fh


_ticks = iter([0, 10])
_orig_pp = bc.process_platform_linux
_proc = _KillProc()
with _patch.object(bc, "process_platform_linux", return_value=False) as _pp, \
        _patch.object(bc, "open", _strict_capture_open, create=True), \
        _patch.object(bc.os, "read", side_effect=AssertionError("unexpected os.read")), \
        _patch.object(bc.os, "killpg", create=True, side_effect=AssertionError("unexpected killpg")):
    _res = bc.capture_browser("c" * 64, str(_capdir), 5, lambda *a, **k: _proc, _NoSel,
                              lambda: next(_ticks, 10))
xcheck("fake-effect-capture-all-io-intercepted",
       _pp.called and _res["clientReaped"] and _res["ok"] is False and _res["timedOut"] is True
       and _proc.kills == 1 and _proc.waits == 1,
       platformCalls=_pp.call_count, kills=_proc.kills, waits=_proc.waits)
xcheck("fake-effect-capture-exact-two-writes",
       len(_cap_opens) == 2
       and sorted(os.path.basename(f.path) for f in _cap_opens) == ["browser.stderr", "browser.stdout"]
       and all(f.mode == "xb" and bytes(f.data) == b"" for f in _cap_opens),
       opens=[os.path.basename(f.path) for f in _cap_opens])
xcheck("fake-effect-capture-platform-restored-after-context",
       bc.process_platform_linux is _orig_pp)

_A_BOUNDED = {"browser.stdout": '{"probe":"browser"}', "browser.stderr": "err-out", "authoritative-exit": "0"}
_A_LOADED = {"container-inspect.json": {"Id": "c" * 64, "Image": "IID"}, "host-evidence.json": {},
             "versions.json": None, "preflight.json": None, "timer.json": None,
             "capture.json": None, "observer-join.json": None}
_a_bounded_calls = []
_a_load_calls = []


def _ledger_bounded(path, limit=None):
    name = os.path.basename(path)
    _a_bounded_calls.append(name)
    if name not in _A_BOUNDED:
        raise AssertionError("unexpected bounded read " + name)
    return _A_BOUNDED[name]


def _ledger_load(path, default=None):
    name = os.path.basename(path)
    _a_load_calls.append(name)
    if name not in _A_LOADED:
        raise AssertionError("unexpected load " + name)
    return _A_LOADED[name]


_orig_sm = bc.source_manifest
_orig_bt = bc._bounded_text
_orig_lj = bc._load_json
_rec = None
_bsm_called = False
with _patch.object(bc, "source_manifest", return_value={"observer": {"bytes": 3, "sha256": "a" * 64}}) as _bsm, \
        _patch.object(bc, "_bounded_text", side_effect=_ledger_bounded), \
        _patch.object(bc, "_load_json", side_effect=_ledger_load):
    _rec = bc.assemble_run_record("w02-20-synthetic-evidence", RUN, 0)
    _bsm_called = _bsm.called
xcheck("fake-effect-assembly-source-effective-on-browser_capture",
       _bsm_called and _rec["source"] == {"observer": {"bytes": 3, "sha256": "a" * 64}})
xcheck("fake-effect-assembly-exact-read-ledger",
       sorted(_a_bounded_calls) == ["authoritative-exit", "browser.stderr", "browser.stdout"]
       and sorted(_a_load_calls) == sorted(_A_LOADED),
       bounded=_a_bounded_calls, loaded=_a_load_calls)
xcheck("fake-effect-assembly-restored-after-context",
       bc.source_manifest is _orig_sm and bc._bounded_text is _orig_bt and bc._load_json is _orig_lj)

# (j) export protocol reconstruction and corruption
CTX = {"run": RUN,
       "supportImage": "967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:" + "a" * 64,
       "workerImage": entry.PINNED_IMAGE, "profileSha": entry.EXPECTED_SECCOMP_SHA256, "source": m1}
plan = entry.build_export_protocol({"a": "small", "b": "x" * 20000}, RUN, CTX, 1700000000000)
good = entry.validate_export(plan["events"], RUN, plan["stream"], CTX)
corrupt = json.loads(json.dumps(plan["events"]))
corrupt.pop(3)
bad = entry.validate_export(corrupt, RUN, plan["stream"], CTX)
xcheck("export-reconstruction-positive", good["ok"] and good["reconstructed"]["b"] == "x" * 20000)
xcheck("export-corruption-refused", bad["ok"] is False)

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

# W02-20 source-structure integrity (independent AST checks, no regeneration)
_PKG_FILES = [ENTRY] + [INFRA / "host_evidence" / (n + ".py") for n in (
    "__init__", "config", "evidence_io", "classification", "collection", "poll",
    "source_binding", "admission", "browser_capture", "export_protocol", "cli")]


def _top_defs():
    found = {}
    for f in _PKG_FILES:
        for n in ast.parse(f.read_text(encoding="utf-8")).body:
            if isinstance(n, (ast.FunctionDef, ast.ClassDef)):
                found[n.name] = found.get(n.name, 0) + 1
    return found


_defs = _top_defs()
icheck("no-duplicate-source-definitions", all(v == 1 for v in _defs.values()),
       duplicates={k: v for k, v in _defs.items() if v > 1})
# 39 earlier + 24 deferred + 1 new private helper = 64 unique top-level definitions
icheck("source-definition-count-64", len(_defs) == 64, got=len(_defs))
_entry_defs = [n.name for n in ast.parse(ENTRY.read_text(encoding="utf-8")).body
               if isinstance(n, (ast.FunctionDef, ast.ClassDef))]
icheck("entry-is-small-composition", _entry_defs == [], got=_entry_defs)
_assigns = 0
for _f in (INFRA / "host_evidence" / "config.py", INFRA / "host_evidence" / "collection.py"):
    for _n in ast.parse(_f.read_text(encoding="utf-8")).body:
        if isinstance(_n, ast.Assign) and all(isinstance(t, (ast.Name, ast.Tuple)) for t in _n.targets):
            _assigns += 1
icheck("configuration-assignments-38", _assigns == 38, got=_assigns)

_PEX = json.loads((TASK / "W02-20-owner-inputs" / "precise-path-exceptions.json").read_text(encoding="utf-8"))


def _value_dump(func_name, rel_path, src):
    node = next(n for n in ast.parse(src).body if isinstance(n, ast.FunctionDef) and n.name == func_name)
    for part in rel_path:
        node = node[part] if isinstance(part, int) else getattr(node, part)
    return ast.dump(node)


_expected_value = ast.dump(ast.parse("_source_root()", mode="eval").body)
_path_ok = True
for _e in _PEX["exceptions"]:
    _src = (INFRA / "host_evidence" / (_e["targetModule"] + ".py")).read_text(encoding="utf-8")
    if _value_dump(_e["name"], _PEX["functionRelativeAstPaths"][_e["name"]], _src) != _expected_value:
        _path_ok = False
icheck("exactly-two-path-value-node-changes", _path_ok)


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
        "source_binding": ["config", "evidence_io", "classification"],
        "admission": ["source_binding", "config", "evidence_io", "classification"],
        "browser_capture": ["source_binding", "config", "evidence_io", "collection", "classification"],
        "export_protocol": ["source_binding", "config", "evidence_io", "classification"],
        "cli": ["config", "evidence_io", "classification", "collection", "poll", "source_binding",
                "admission", "browser_capture", "export_protocol"],
        "entry": ["config", "evidence_io", "classification", "collection", "poll",
                  "source_binding", "admission", "browser_capture", "export_protocol", "cli"],
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
