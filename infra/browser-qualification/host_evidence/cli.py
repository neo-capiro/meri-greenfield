"""W02-20 CLI: bounded stdout dump, invocation-only signal handlers and main.

_dump, _install_signals and main moved verbatim. The CLI imports the caller-local
aliases it actually invokes (collect_observation, run_bounded_poll, _atomic_write,
the capture/export/admission helpers), so historical main/watch fixtures must patch
THESE bindings. _CANCEL stays collection-owned. Import installs no signals and
invokes no application filesystem/process/network IO; the main guard calls main().
"""
import argparse
import json
import os
import signal
import sys
import time

from .admission import timer_record, verify_run_record
from .browser_capture import assemble_run_record, capture_browser
from .classification import _uuid_ok, classify
from .collection import _CANCEL, collect_observation, normalize_version, preflight
from .config import (
    BROWSER_EXE_PATTERN, BROWSER_ROOT, EXPECTED_SECCOMP_PATH, EXPECTED_SECCOMP_SHA256,
    MAX_OBSERVATION_BYTES, MAX_POLL_SECONDS, PINNED_BROWSER_EXE, PINNED_BROWSER_SHA256,
    PINNED_IMAGE,
)
from .evidence_io import _atomic_write, _load_json
from .export_protocol import (
    assemble_export_records, build_export_protocol, classify_put_response,
    render_export_batches, validate_export,
)
from .poll import run_bounded_poll

def _dump(obj, path=None):
    text=json.dumps(obj,indent=2,allow_nan=False)
    print(text)
    if path:_atomic_write(path,text+"\n")
    return 0 if obj.get("ok",True) else 3

def _install_signals():
    def handler(signum, frame):
        _CANCEL["flag"] = True
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            signal.signal(sig, handler)
        except (ValueError, OSError):
            pass

def main(argv=None):
    ap = argparse.ArgumentParser(description="browser-host observer (preparation only)")
    for flag in ("--container-name", "--out", "--verify", "--fixture", "--fixture-run",
                 "--poll-selftest", "--put-response", "--export-plan", "--run-id", "--exe-sha256",
                 "--assemble-run-record", "--export-protocol", "--validate-export", "--export-batches", "--out-dir",
                 "--assets-image", "--worker-image", "--profile-path", "--profile-sha", "--stream", "--capture-browser", "--context-file"):
        ap.add_argument(flag)
    ap.add_argument("--parse-version", nargs=2, metavar=("TOOL", "RAW"))
    ap.add_argument("--timer-state", nargs=3, metavar=("ACTIVE", "TARGET", "NEXT"))
    ap.add_argument("--status", type=int)
    ap.add_argument("--deadline", type=int, default=120)
    ap.add_argument("--watch", action="store_true")
    ap.add_argument("--pins-json", action="store_true")
    ap.add_argument("--preflight-only", action="store_true")
    args = ap.parse_args(argv)
    if args.pins_json:
        return _dump({"ok": True, "image": PINNED_IMAGE, "browserRoot": BROWSER_ROOT,
                      "pinnedBrowserExe": PINNED_BROWSER_EXE, "pinnedBrowserSha256": PINNED_BROWSER_SHA256,
                      "browserExePattern": BROWSER_EXE_PATTERN.pattern}, args.out)
    if args.parse_version:
        return _dump(normalize_version(args.parse_version[0], args.parse_version[1]), args.out)
    if args.timer_state:
        return _dump(timer_record(*args.timer_state, args.run_id), args.out)
    if args.preflight_only:
        return _dump(preflight(), args.out)
    if args.poll_selftest:
        script = _load_json(args.poll_selftest, {}) or {}
        seq = list(script.get("observations") or [])
        step, clock = {"i": 0}, {"t": 0.0}
        def collect_fn():
            o = seq[min(step["i"], len(seq) - 1)]; step["i"] += 1; return o
        def fake_sleep(d): clock["t"] += d
        res = run_bounded_poll(collect_fn, lambda o: bool(o.get("containerId")),
                               clock=lambda: clock["t"], sleep=fake_sleep,
                               deadline_s=script.get("deadline_s", 300), interval_s=script.get("interval_s", 2),
                               classify_fn=lambda o: {"ok": bool(o.get("processes"))})
        return _dump({"ok": res["bestOk"] or res["lifecycle"] in ("timeout", "never-started", "stopped", "cancel"), **res}, args.out)
    if args.put_response:
        with open(args.put_response) as fh:
            return _dump(classify_put_response(fh.read()), args.out)
    if args.export_plan:
        spec = _load_json(args.export_plan, {}) or {}
        plan = build_export_protocol(spec.get("records") or {}, spec.get("runId"), spec.get("context"))
        return _dump(plan, args.out)
    if args.capture_browser:
        _install_signals()
        return _dump(capture_browser(args.capture_browser, args.out_dir, args.deadline), args.out)
    if args.assemble_run_record:
        if not _uuid_ok(args.run_id):
            return _dump({"ok": False, "reason": "canonical run id required"}, args.out)
        rec = assemble_run_record(args.assemble_run_record, args.run_id, args.status, args.assets_image,
                                  args.worker_image, args.profile_path or EXPECTED_SECCOMP_PATH,
                                  args.profile_sha or EXPECTED_SECCOMP_SHA256)
        spec = assemble_export_records(rec, args.run_id)
        _atomic_write(os.path.join(args.assemble_run_record, "run-record.json"), json.dumps(rec, indent=2) + "\n")
        _atomic_write(os.path.join(args.assemble_run_record, "export-spec.json"), json.dumps(spec, indent=2) + "\n")
        return _dump({"ok": True, "runRecord": os.path.join(args.assemble_run_record, "run-record.json")}, args.out)
    if args.export_protocol:
        spec = _load_json(args.export_protocol, {}) or {}
        return _dump(build_export_protocol(spec.get("records") or {}, spec.get("runId"), spec.get("context")), args.out)
    if args.validate_export:
        doc = _load_json(args.validate_export, {}) or {}
        events = doc.get("events") if isinstance(doc, dict) else doc
        context = _load_json(args.context_file) if args.context_file else None
        if args.context_file and not isinstance(context, dict):
            return _dump({"ok": False, "reason": "owner context file unavailable/malformed"}, args.out)
        return _dump(validate_export(events, args.run_id, args.stream, context), args.out)
    if args.export_batches:
        try:
            count = render_export_batches(_load_json(args.export_batches, {}) or {}, args.out_dir or ".")
        except (OSError, ValueError) as exc:
            return _dump({"ok": False, "reason": str(exc)[:160]}, args.out)
        return _dump({"ok": count >= 1, "batches": count}, args.out)
    if args.fixture_run:
        rec = _load_json(args.fixture_run, {}) or {}
        return _dump(verify_run_record(rec, {"runId": args.run_id, "exeSha256": args.exe_sha256}), args.out)
    if args.fixture or args.verify:
        doc = _load_json(args.fixture or args.verify, {}) or {}
        obs = doc.get("observation", doc) if isinstance(doc, dict) else doc
        return _dump(classify(obs, {"runId": args.run_id, "exeSha256": args.exe_sha256}), args.out)
    if args.watch:
        if not _uuid_ok(args.run_id) or args.exe_sha256 not in (None, PINNED_BROWSER_SHA256) or not args.container_name:
            return _dump({"ok": False, "reason": "watch requires a container name, canonical run UUID and compiled pin"}, args.out)
        _install_signals()
        deadline = time.monotonic() + MAX_POLL_SECONDS
        def collect_fn():
            return collect_observation(args.container_name, args.run_id,
                                       expected_sha=PINNED_BROWSER_SHA256, deadline=deadline)
        env = run_bounded_poll(collect_fn, lambda o: bool(o.get("containerId")),
                               deadline_s=MAX_POLL_SECONDS, interval_s=1, deadline=deadline,
                               classify_fn=lambda o: classify(o, {"runId": args.run_id, "exeSha256": PINNED_BROWSER_SHA256}),
                               should_stop_fn=lambda: _CANCEL["flag"])
        env["runId"] = args.run_id
        result = {"ok": env["bestOk"], **env}
        text = json.dumps(result, indent=2)
        if len(text.encode("utf-8")) > MAX_OBSERVATION_BYTES:
            result = {"ok": False, "runId": args.run_id, "reason": "observer checkpoint exceeds byte bound", "incomplete": True}
            text = json.dumps(result, indent=2)
        # Persist the authoritative bounded checkpoint before stdout can block.
        if args.out:
            _atomic_write(args.out, text + "\n")
        return _dump(result)
    obs = collect_observation(args.container_name, args.run_id, expected_sha=args.exe_sha256 or PINNED_BROWSER_SHA256)
    return _dump({"ok": not obs.get("incomplete") and bool(obs.get("processes")), "observation": obs}, args.out)
