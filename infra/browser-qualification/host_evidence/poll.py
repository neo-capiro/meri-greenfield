"""W02-17 collector extraction: bounded lifecycle poll (verbatim body).

Receives collection/classification callbacks through its existing parameters.
"""
import time

from .config import MAX_POLL_SECONDS

def run_bounded_poll(collect_fn, alive_fn, clock=None, sleep=None, deadline_s=MAX_POLL_SECONDS, interval_s=1,
                     join_fn=None, classify_fn=None, should_stop_fn=None, deadline=None):
    """Bounded lifecycle poll. Waits through startup, keeps the best passing
    observation, and reports an explicit lifecycle. Fake-injectable clock/sleep/
    should_stop_fn. Absolute deadline is clamped to MAX_POLL_SECONDS."""
    clock = clock or time.monotonic
    sleep = sleep or time.sleep
    deadline_s = min(max(deadline_s, 1), MAX_POLL_SECONDS)
    start = clock()
    end = min(start + deadline_s, deadline) if deadline is not None else start + deadline_s
    timeline, best, best_verdict, best_ok, last, seen = [], None, None, False, None, False
    unsafe = None
    lifecycle, reason = "timeout", "deadline reached before a complete observation"
    while clock() < end and len(timeline) < 600:
        if should_stop_fn and should_stop_fn():
            lifecycle, reason = "cancel", "bounded stop requested"
            break
        try:
            obs = collect_fn() or {}
            if not isinstance(obs, dict):
                raise ValueError("collector returned non-object")
        except Exception as exc:  # noqa: BLE001 - malformed collection must not abort the poll
            obs = {"incomplete": True, "incompleteReasons": ["collector raised: %s" % type(exc).__name__]}
        present = bool(obs.get("containerId"))
        seen = seen or present
        last = obs
        timeline.append({"t": round(clock() - start, 3), "containerId": obs.get("containerId"),
                         "procs": len(obs.get("processes") or []), "incomplete": bool(obs.get("incomplete"))})
        late = clock() >= end
        stop_requested = bool(should_stop_fn and should_stop_fn())
        if present and classify_fn:
            try:
                verdict = classify_fn(obs)
                if not isinstance(verdict, dict):
                    raise ValueError("classifier returned non-object")
            except Exception as exc:
                verdict = {"ok": False, "reasons": ["classifier raised: " + type(exc).__name__]}
            late = late or clock() >= end
            if verdict.get("ok") and not best_ok and not late and not stop_requested:
                best, best_verdict, best_ok = obs, verdict, True
                lifecycle, reason = "passing", "complete passing observation captured"
            elif (best is not None and not verdict.get("ok") and obs.get("processes")
                  and not obs.get("incomplete") and not obs.get("incompleteReasons")):
                unsafe = verdict
                best_ok, lifecycle, reason = False, "unsafe", "later complete observation contradicts safe evidence"
                break
        if late:
            lifecycle, reason = "timeout", "collection reached the absolute deadline; no late sample promoted"
            break
        if stop_requested:
            lifecycle, reason = "cancel", "bounded stop requested"
            break
        if present and not classify_fn and obs.get("processes") and not best_ok:
            best, best_ok, lifecycle, reason = obs, True, "passing", "observation with processes captured"
        if seen and not present:
            lifecycle, reason = "stopped", "container disappeared after being observed"
            break
        sleep(min(max(interval_s, 0.01), max(0, end - clock())))
    else:
        if lifecycle == "timeout":
            lifecycle = "timeout" if seen else "never-started"
            reason = "deadline reached while %s" % ("running without a complete observation" if seen else "container never appeared")
    return {"stopped": lifecycle == "stopped", "lifecycle": lifecycle, "reason": reason,
            "iterations": len(timeline), "elapsed": round(clock() - start, 3), "timeline": timeline,
            "observation": last, "bestObservation": best, "bestClassification": best_verdict,
            "bestOk": best_ok, "unsafeClassification": unsafe,
            "join": join_fn(last) if join_fn else None}
