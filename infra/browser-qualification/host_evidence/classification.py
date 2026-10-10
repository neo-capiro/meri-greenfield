"""W02-17 collector extraction: pure classifiers/predicates (verbatim).

No host IO: only stdlib regex/uuid and immutable config values are read.
"""
import re
import uuid

from .config import (
    MAX_FIELD,
    MAX_PIDS,
    MAX_THREADS,
    NS_KEYS,
    BROWSER_EXE_PATTERN,
    CAP_KEYS,
    CHROMIUM_SAFE_KINDS,
    DISABLING_FLAGS,
    NODE_EXE,
    PINNED_BROWSER_EXE,
    PINNED_BROWSER_SHA256,
    PINNED_IMAGE,
    _HEX64,
)

def _in_root(e): return e == PINNED_BROWSER_EXE


def _is_node(e): return bool(e) and bool(NODE_EXE.search(e or ""))


def _cap_zero(h): return isinstance(h, str) and re.fullmatch(r"[0]+", (h or "").lower()) is not None


def _cap_valid(h): return isinstance(h, str) and re.fullmatch(r"[0-9a-fA-F]{1,16}", h) is not None


def _all_caps_zero(p): return all(_cap_zero(p.get(k)) for k in CAP_KEYS)


def _thread_ok(t): return (all(_cap_zero(t.get(k)) for k in CAP_KEYS) and t.get("noNewPrivs") == 1 and t.get("seccomp") == 2)


def _ns(ns, k): return ns.get(k) if isinstance(ns, dict) else None


def _hex64_ok(v): return isinstance(v, str) and bool(_HEX64.match(v))


def _worker_ids_ok(v): return isinstance(v, list) and len(v) == 4 and all(type(i) is int and i == 10001 for i in v)


def _pos_int(v):
    return not isinstance(v, bool) and isinstance(v, (str, int)) and str(v).isdigit() and int(v) >= 1


def _uuid_ok(v):
    try:
        return isinstance(v, str) and str(uuid.UUID(v)) == v
    except (ValueError, TypeError, AttributeError):
        return False


def _parse_uid_map_strict(text):
    """Parse the ENTIRE uid/gid mapping: every non-empty line is exactly three
    non-negative integers with length>0; no trailing garbage, no substring match."""
    if not isinstance(text, str) or not text.strip():
        return False
    for line in text.strip().splitlines():
        parts = line.split()
        if len(parts) != 3 or not all(p.isdigit() for p in parts) or int(parts[2]) < 1:
            return False
    return True


def _ns_complete(ns):
    if not isinstance(ns, dict):
        return False
    return all(isinstance(ns.get(k), str) and re.fullmatch(k + r":\[[1-9][0-9]*\]", ns[k]) for k in NS_KEYS)


def _cgroup_matches(text, cid):
    return isinstance(text, str) and _hex64_ok(cid) and re.search(r"(?<![0-9a-f])" + cid + r"(?![0-9a-f])", text) is not None


def _ancestry_ok(proc, target_pid, by_pid, max_depth=32, seen=None):
    """True iff proc descends from target_pid with no cycle."""
    seen = seen or set()
    cur, depth = proc, 0
    while cur is not None and depth < max_depth:
        if cur.get("ppid") == target_pid:
            return True
        pid = cur.get("pid")
        if pid in seen:
            return False
        seen.add(pid)
        cur = by_pid.get(cur.get("ppid"))
        depth += 1
    return False


def classify(observation=None, expected=None):
    if not isinstance(observation, dict) or (expected is not None and not isinstance(expected, dict)):
        return {"ok": False, "reasons": ["malformed observation/expectations"]}
    obs, exp, reasons = observation or {}, expected or {}, []
    procs = obs.get("processes") or []
    running = obs.get("runningContainers") or []
    if (not isinstance(procs, list) or len(procs) > MAX_PIDS or any(not isinstance(p, dict) for p in procs)
            or not isinstance(running, list) or any(not isinstance(c, dict) for c in running)):
        return {"ok": False, "reasons": ["malformed/bounded process or container inventory"]}
    if any(not isinstance(p.get("threads"), list) or len(p["threads"]) > MAX_THREADS
           or any(not isinstance(t, dict) for t in p["threads"])
           or not isinstance(p.get("cmdline"), list) or len(p["cmdline"]) > 64
           or any(not isinstance(a, str) or len(a) > MAX_FIELD for a in p["cmdline"]) for p in procs):
        return {"ok": False, "reasons": ["malformed/bounded thread or argv evidence"]}
    if (type(obs.get("mainPid")) is not int or obs["mainPid"] < 1
            or any(type(p.get("pid")) is not int or p["pid"] < 1
                   or type(p.get("ppid")) is not int or p["ppid"] < 1 for p in procs)):
        return {"ok": False, "reasons": ["process/main/parent PID is not a positive integer"]}
    boot = obs.get("bootId")
    by_pid = {p.get("pid"): p for p in procs if isinstance(p.get("pid"), int)}
    main_proc = by_pid.get(obs.get("mainPid"))
    baseline = obs.get("containerSeccompFilters")
    expected_sha = PINNED_BROWSER_SHA256
    if exp.get("exeSha256") not in (None, PINNED_BROWSER_SHA256):
        reasons.append("requested executable hash is not the compiled pin")

    if obs.get("incomplete") or obs.get("incompleteReasons"):
        reasons.append("collection marked incomplete/partial: %s" % ",".join(obs.get("incompleteReasons") or [])[:200])
    if exp.get("runId") and obs.get("runId") != exp["runId"]:
        reasons.append("observation runId does not match the required run")
    if not _uuid_ok(obs.get("runId")) or (exp.get("runId") is not None and not _uuid_ok(exp["runId"])):
        reasons.append("observation/required runId is not a canonical UUID")
    if len(running) != 1:
        reasons.append("expected exactly one running container this run, saw %d" % len(running))
    target = running[0] if len(running) == 1 else None
    if not _hex64_ok(obs.get("containerId")) or not target or target.get("id") != obs.get("containerId"):
        reasons.append("target container is not the single observed running container")
    if target:
        if not isinstance(target.get("labels"), dict) or not isinstance(target.get("name"), str):
            return {"ok": False, "reasons": ["malformed container labels/name"]}
        if target.get("image") != PINNED_IMAGE:
            reasons.append("observed container image is not the pinned qualification image")
        if obs.get("runId") and (target.get("labels") or {}).get("meri.qualification.run") != obs.get("runId"):
            reasons.append("observed container label is not bound to the run")
        if obs.get("runId") and obs["runId"] not in (target.get("name") or ""):
            reasons.append("observed container name is not bound to the run")
    if not procs:
        reasons.append("no process evidence collected for the target container")
    if type(baseline) is not int or baseline < 1:
        reasons.append("missing positive same-container seccomp baseline")
    if not isinstance(obs.get("hostNamespaces"), dict) or not _ns_complete(obs.get("hostNamespaces")):
        reasons.append("missing host namespace baselines")
    if main_proc is None:
        reasons.append("container main process evidence missing")
    if not _uuid_ok(boot):
        reasons.append("observation boot id is not a canonical UUID")

    pids = [p.get("pid") for p in procs if isinstance(p.get("pid"), int)]
    if len(pids) != len(set(pids)):
        reasons.append("duplicate process pid evidence (contradiction/PID reuse)")
    all_tids = set()
    for p in procs:
        if not _worker_ids_ok(p.get("hostUids")) or not _worker_ids_ok(p.get("hostGids")):
            reasons.append("process host-view UID/GID evidence is not 10001:10001")
        if any(not _worker_ids_ok(t.get("hostUids")) or not _worker_ids_ok(t.get("hostGids")) for t in p.get("threads", [])):
            reasons.append("thread host-view UID/GID evidence is not 10001:10001")
        if any(not _cap_valid(p.get(k)) for k in CAP_KEYS):
            reasons.append("process capability evidence missing/malformed")
        if any(any(not _cap_valid(t.get(k)) for k in CAP_KEYS) for t in p.get("threads", [])):
            reasons.append("thread capability evidence missing/malformed")
        if type(p.get("pid")) is not int or not _pos_int(p["pid"]):
            reasons.append("process PID is not a positive integer")
        if type(p.get("ppid")) is not int or not _pos_int(p["ppid"]):
            reasons.append("process parent PID is not a positive integer")
        if not (isinstance(p.get("starttimeTicks"), (str, int)) and _pos_int(p.get("starttimeTicks"))):
            reasons.append("process pid %s missing starttime" % p.get("pid"))
        if not p.get("cgroup"):
            reasons.append("process pid %s missing cgroup" % p.get("pid"))
        elif not _cgroup_matches(p["cgroup"], obs.get("containerId")):
            reasons.append("process pid %s is outside the target container cgroup" % p.get("pid"))
        if not _uuid_ok(p.get("bootId")):
            reasons.append("process pid %s missing boot id" % p.get("pid"))
        if not _ns_complete(p.get("nsInodes")):
            reasons.append("process pid %s namespace inodes incomplete" % p.get("pid"))
        if not _parse_uid_map_strict(p.get("uidMap")):
            reasons.append("process pid %s uid map malformed" % p.get("pid"))
        tids = [t.get("tid") for t in (p.get("threads") or []) if isinstance(t.get("tid"), int)]
        if any(type(t.get("tid")) is not int or not _pos_int(t.get("tid")) for t in (p.get("threads") or [])):
            reasons.append("thread TID is not a positive integer")
        if not tids:
            reasons.append("process pid %s has no thread evidence" % p.get("pid"))
        if len(tids) != len(set(tids)):
            reasons.append("process pid %s has duplicate thread evidence" % p.get("pid"))
        if all_tids.intersection(tids):
            reasons.append("thread TID belongs to multiple processes")
        all_tids.update(tids)
        if p.get("pid") not in tids:
            reasons.append("process leader is missing from thread evidence")
        if p.get("incomplete") or p.get("incompleteReasons"):
            reasons.append("process pid %s has incomplete collection" % p.get("pid"))
        parent = by_pid.get(p.get("ppid"))
        if parent and _pos_int(parent.get("starttimeTicks")) and _pos_int(p.get("starttimeTicks")):
            if int(parent["starttimeTicks"]) > int(p["starttimeTicks"]):
                reasons.append("child process predates its reported parent")
    if boot and any(p.get("bootId") and p.get("bootId") != boot for p in procs):
        reasons.append("process evidence crosses boot ids (possible PID reuse)")
    if len(all_tids) > MAX_THREADS:
        reasons.append("total thread inventory exceeds collection bound")

    browsers = [p for p in procs if p.get("type") == "browser"]
    renderers = [p for p in procs if p.get("type") == "renderer"]
    if any(_is_node(p.get("exe")) for p in procs if p.get("type") in CHROMIUM_SAFE_KINDS):
        reasons.append("a Node process was misidentified as a browser/renderer")
    if not browsers:
        reasons.append("no identified actual Chromium browser process for this run")
    if not renderers:
        reasons.append("no identified actual Chromium renderer process for this run")

    # Every actual Chromium helper must be pinned and free of disabling flags.
    # Zygote capabilities are reported separately because they may be local to
    # its child user namespace, unlike browser/renderer capability assertions.
    chromium = [p for p in procs if p.get("type") in ("browser", "renderer", "zygote")
                or bool(BROWSER_EXE_PATTERN.match(p.get("exe") or ""))]
    for p in chromium:
        label = p.get("type") or "Chromium"
        if not _in_root(p.get("exe")):
            reasons.append("%s executable is not the pinned Chromium path" % label)
        elif _is_node(p.get("exe")):
            reasons.append("%s executable is Node, not Chromium" % label)
        if not _hex64_ok(p.get("exeSha256")):
            reasons.append("%s executable hash missing/malformed" % label)
        elif p["exeSha256"] != expected_sha:
            reasons.append("%s executable hash does not match the pinned value" % label)
        for flag in (p.get("cmdline") or []):
            if flag in DISABLING_FLAGS or any(flag.startswith(f + "=") for f in DISABLING_FLAGS):
                reasons.append("%s uses sandbox-disabling flag %s" % (label, flag))
        if label != "browser" and not any(_ancestry_ok(p, b.get("pid"), by_pid) for b in browsers):
            reasons.append("a Chromium helper is not a descendant of an identified browser")
        if p.get("noNewPrivs") != 1 or p.get("seccomp") != 2:
            reasons.append("%s is not NoNewPrivs1/Seccomp2" % label)
        if any(t.get("noNewPrivs") != 1 or t.get("seccomp") != 2 for t in p.get("threads", [])):
            reasons.append("%s thread is not NoNewPrivs1/Seccomp2" % label)
        if label not in CHROMIUM_SAFE_KINDS:
            if not _all_caps_zero(p) or any(not _all_caps_zero(t) for t in p.get("threads", [])):
                outer = {_ns(obs.get("hostNamespaces"), "user"),
                         _ns(main_proc.get("nsInodes") if main_proc else None, "user")}
                outer.update(_ns(b.get("nsInodes"), "user") for b in browsers)
                if _ns(p.get("nsInodes"), "user") in outer:
                    reasons.append("Chromium helper capabilities are not confined to a child user namespace")
            continue
        threads = p.get("threads") or []
        for th in threads:
            if not _thread_ok(th):
                reasons.append("%s thread %s is not all-capsets0/NoNewPrivs1/Seccomp2" % (label, th.get("tid")))
        if not _all_caps_zero(p):
            reasons.append("%s retains host capabilities (one of CapInh/Prm/Eff/Bnd/Amb != 0)" % label)
        if p.get("noNewPrivs") != 1:
            reasons.append("%s NoNewPrivs is not 1" % label)
        if p.get("seccomp") != 2:
            reasons.append("%s Seccomp mode is not 2" % label)

    # ancestry: browsers descend from main; renderers from a browser
    for p in browsers:
        if p.get("ppid") != obs.get("mainPid") and not _ancestry_ok(p, obs.get("mainPid"), by_pid):
            reasons.append("a browser is not a descendant of the container main process")
    for r in renderers:
        if not any(r is b or _ancestry_ok(r, b.get("pid"), by_pid) for b in browsers):
            reasons.append("a renderer is not a descendant of an identified browser")

    # baselines: main and browser thread filter counts must be present and coherent
    if main_proc is not None:
        main_f = [t.get("seccompFilters") for t in (main_proc.get("threads") or [])]
        if not main_f or any(type(x) is not int or x < 1 for x in main_f):
            reasons.append("container main thread seccomp filter counts missing")
        elif isinstance(baseline, int) and min(main_f) != baseline:
            reasons.append("container main seccomp baseline is incoherent with the reported baseline")
    for b in browsers:
        bf = [t.get("seccompFilters") for t in (b.get("threads") or [])]
        if not bf or any(type(x) is not int or x < 1 for x in bf):
            reasons.append("browser thread seccomp filter counts missing")

    # renderer user namespaces distinct from host/container/browser baselines
    baselines = {_ns(obs.get("hostNamespaces"), "user"), _ns(main_proc.get("nsInodes") if main_proc else None, "user")}
    baselines.update(_ns(b.get("nsInodes"), "user") for b in browsers)
    for r in renderers:
        ruser = _ns(r.get("nsInodes"), "user")
        if not ruser:
            reasons.append("a renderer user namespace inode is unavailable")
        elif ruser in baselines:
            reasons.append("a renderer user namespace is not distinct from the host/container/browser baseline")
        if not _parse_uid_map_strict(r.get("uidMap")):
            reasons.append("a renderer user namespace has no valid UID mapping")
        fs = [t.get("seccompFilters") for t in (r.get("threads") or [])]
        if not fs or any(type(x) is not int or x < 1 for x in fs):
            reasons.append("a renderer thread seccomp filter count is missing")
        elif not isinstance(baseline, int) or any(x <= baseline for x in fs):
            reasons.append("a renderer thread seccomp filter count does not strictly exceed the container baseline")

    zygote = [p for p in procs if p.get("type") == "zygote"]
    zygote_local = []
    for z in zygote:
        if _in_root(z.get("exe")) and not _hex64_ok(z.get("exeSha256")):
            reasons.append("zygote executable hash missing/malformed")
        zygote_local.append({"pid": z.get("pid"), "capEffHex": z.get("capEffHex"), "note": "namespace-local; not a host-capability assertion"})
    return {"ok": not reasons, "reasons": reasons,
            "browserPid": browsers[0]["pid"] if browsers else None,
            "rendererPid": renderers[0]["pid"] if renderers else None,
            "browserCount": len(browsers), "rendererCount": len(renderers),
            "zygoteNamespaceLocalCaps": zygote_local}


def _list_has(v, item): return item in v if isinstance(v, list) else v == item
