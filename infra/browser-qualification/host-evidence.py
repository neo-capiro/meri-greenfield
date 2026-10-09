#!/usr/bin/env python3
# W02-06 browser-host observer + pure classifiers. PREPARATION ONLY - NOT run.
# Single source of truth for version normalisation, host preflight, the bounded
# observation collector/classifier and bounded --watch polling. security.test.mjs
# (next checkpoint) and pure fake-proc harnesses drive every mode offline. Records
# only safe versions/hashes/configuration. Fail closed. A Node process is never
# the browser. The pinned executable is hashed through /proc/<pid>/exe (the
# container mount namespace), never the host /opt path.
import argparse, hashlib, json, os, re, selectors, signal, subprocess, sys, time, uuid

BROWSER_ROOT = "/opt/meri-browsers"
PINNED_BROWSER_EXE = "/opt/meri-browsers/chromium-1247/chrome-linux64/chrome"
PINNED_BROWSER_SHA256 = "adf078f8f80eb9e980a07b4418af23b0f4008a83bc5756d5588055bc4d76c5a0"
BROWSER_EXE_PATTERN = re.compile(r"^/opt/meri-browsers/chromium-[0-9]+/chrome-linux64/chrome$")
NODE_EXE = re.compile(r"(^|[\\/])node(\.exe)?$", re.IGNORECASE)
PINNED_IMAGE = ("967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/"
                "qualification-worker@sha256:7327f04575b09a633730b0ffe4b5fdeeeffe151a5c0db6dc027cc6edb8960d75")
DISABLING_FLAGS = ("--no-sandbox", "--disable-setuid-sandbox", "--disable-seccomp-filter-sandbox",
                   "--disable-namespace-sandbox", "--no-zygote", "--disable-gpu-sandbox", "--disable-sandbox")
CHROMIUM_SAFE_KINDS = ("browser", "renderer")
NS_KEYS = ("user", "mnt", "pid", "net", "ipc", "uts", "cgroup")
CAP_KEYS = ("capInhHex", "capPrmHex", "capEffHex", "capBndHex", "capAmbHex")
MAX_PIDS, MAX_THREADS, MAX_FIELD = 4096, 4096, 512
MAX_EXE_BYTES = 512 * 1024 * 1024
MAX_COMMAND_BYTES = 65536
MAX_OBSERVATION_BYTES = 2 * 1024 * 1024
MAX_POLL_SECONDS = 300
MAX_EXPORT_BYTES, MAX_EXPORT_EVENTS, MAX_EXPORT_CALLS = 8192, 40, 12
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_CANCEL = {"flag": False}
_EXE_HASH_CACHE = {}


def _read(path, limit=4096):
    try:
        with open(path, "r", errors="replace") as fh:
            return fh.read(limit)
    except OSError:
        return None


def _read_bytes(path, limit=MAX_EXE_BYTES):
    try:
        with open(path, "rb") as fh:
            return fh.read(limit)
    except OSError:
        return None
    except MemoryError:
        return None


def _atomic_write(path, text):
    tmp = path + ".tmp.%d" % os.getpid()
    with open(tmp, "w") as fh:
        fh.write(text)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, path)


def _boot_id(root="/proc"):
    return (_read(os.path.join(root, "sys/kernel/random/boot_id")) or "").strip() or None


def normalize_version(tool, raw):
    raw = (raw or "").strip()
    pats = {"aws": r"aws-cli/(\d+)\.(\d+)\.(\d+)", "docker": r"^(\d+)\.(\d+)\.(\d+)$",
            "runc": r"runc version (\d+)\.(\d+)\.(\d+)",
            "containerd": r"containerd[^\n]*?v?(\d+)\.(\d+)\.(\d+)", "libseccomp": r"libseccomp\.so\.(\d+)"}
    m = re.search(pats[tool], raw) if tool in pats else None
    if tool == "libseccomp":
        if not m:
            return {"tool": tool, "raw": raw[:200], "normalized": None, "ok": False, "reason": "libseccomp ABI not found"}
        return {"tool": tool, "raw": raw[:200], "normalized": m.group(1), "ok": True, "note": "ABI major only; not a package version"}
    if not m:
        return {"tool": tool, "raw": raw[:200], "normalized": None, "ok": False, "reason": "unrecognised %s version format" % tool}
    if tool == "aws" and m.group(1) != "2":
        return {"tool": tool, "raw": raw[:200], "normalized": None, "ok": False, "reason": "expected AWS CLI major version 2"}
    if tool == "docker" and raw != "25.0.16":
        return {"tool": tool, "raw": raw[:200], "normalized": raw, "ok": False, "reason": "require Docker 25.0.16 exactly"}
    return {"tool": tool, "raw": raw[:200], "normalized": ".".join(m.groups()), "ok": True}


def preflight():
    problems, checks = [], {}
    if os.geteuid() != 0:
        problems.append("observer must run as root on the guest")
    mx = (_read("/proc/sys/user/max_user_namespaces") or "").strip()
    checks["user.max_user_namespaces"] = mx or "unavailable"
    try:
        if int(mx) < 1:
            problems.append("user.max_user_namespaces is not positive")
    except ValueError:
        problems.append("user.max_user_namespaces unreadable")
    up = _read("/proc/sys/kernel/unprivileged_userns_clone")
    checks["kernel.unprivileged_userns_clone"] = up.strip() if up is not None else "absent"
    if up is not None and up.strip() != "1":
        problems.append("kernel.unprivileged_userns_clone present but not 1")
    checks["kernel.unprivileged_bpf_disabled"] = (_read("/proc/sys/kernel/unprivileged_bpf_disabled") or "unavailable").strip()
    checks["kernel.apparmor_restrict_unprivileged_userns"] = (_read("/proc/sys/kernel/apparmor_restrict_unprivileged_userns") or "absent").strip()
    checks["lsm"] = (_read("/sys/kernel/security/lsm") or "unavailable").strip()
    if checks["lsm"] not in ("unavailable", "") and "capability" not in checks["lsm"]:
        problems.append("kernel LSM list lacks 'capability'")
    if _read("/proc/self/status") is None:
        problems.append("/proc/self/status unavailable")
    if not os.path.isdir("/proc/1/ns"):
        problems.append("kernel namespace support unavailable (/proc/1/ns missing)")
    return {"ok": not problems, "problems": problems, "checks": checks}


# --- pure helpers ----------------------------------------------------------
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


# --- strict fail-closed classifier -----------------------------------------
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


def verify_run_record(record=None, expected=None):
    # NOTE (this checkpoint): unchanged. Several injectable run-record checks
    # (CapAdd, docker socket mount, worker credential env, wrong entrypoint,
    # negative resource bounds, seccomp=unconfined containment, browser/observer
    # payload detail) are DEFERRED to the next bounded session and are disclosed
    # as still-failing. Only signature wiring stays compatible with the strict classifier.
    rec, exp, reasons = record or {}, expected or {}, []
    obs, insp = rec.get("observation") or {}, rec.get("inspect") or {}
    if not obs or not insp:
        return {"ok": False, "reasons": ["missing observation and/or docker inspect record"]}
    host, cfg = insp.get("HostConfig") or {}, insp.get("Config") or {}
    expected_run = exp.get("runId") or rec.get("runId")
    expected_image = exp.get("image") or PINNED_IMAGE
    reasons.extend(classify(obs, {"runId": expected_run, "exeSha256": exp.get("exeSha256")})["reasons"])
    if obs.get("containerId") and insp.get("Id") and obs["containerId"] != insp["Id"]:
        reasons.append("observation containerId does not match docker inspect Id")
    labels = cfg.get("Labels") or {}
    if labels.get("meri.qualification.run") != expected_run:
        reasons.append("docker inspect label is not bound to the run")
    if cfg.get("Image") != expected_image:
        reasons.append("docker inspect image is not the pinned qualification image")
    if (host.get("NetworkMode") or "") != "none":
        reasons.append("container is not on network none")
    if (cfg.get("User") or "") != "10001:10001":
        reasons.append("container user is not 10001:10001")
    if not _list_has(host.get("CapDrop"), "ALL"):
        reasons.append("container does not drop ALL capabilities")
    secopts = host.get("SecurityOpt") or []
    if not any("no-new-privileges" in s and "false" not in s for s in secopts):
        reasons.append("container is missing no-new-privileges")
    if not any(s.startswith("seccomp=") for s in secopts):
        reasons.append("container is missing an explicit seccomp profile")
    if host.get("ReadonlyRootfs") is not True:
        reasons.append("container root filesystem is not read-only")
    if not isinstance(host.get("PidsLimit"), int) or host["PidsLimit"] <= 0:
        reasons.append("container pids limit is not bounded")
    if not host.get("Memory") or not host.get("NanoCpus") or not host.get("ShmSize"):
        reasons.append("container memory/cpu/shm bounds missing")
    if host.get("Privileged") is True or host.get("IpcMode") == "host" or host.get("PidMode") == "host":
        reasons.append("container uses privileged/host namespaces")
    if not any(m.get("Destination") == "/workspace" and m.get("RW") for m in (insp.get("Mounts") or [])):
        reasons.append("container lacks a writable /workspace mount")
    if rec.get("status") != 0:
        reasons.append("authoritative browser exit status is not 0 (got %r)" % (rec.get("status"),))
    for name in ("browser", "observer"):
        if not rec.get(name):
            reasons.append("missing %s record bound to this run" % name)
    return {"ok": not reasons, "reasons": reasons}


# --- bounded real collector (fake-injectable root/runner) ------------------
class _CollectionIssue(Exception):
    pass


def _check_deadline(deadline=None):
    if _CANCEL["flag"] or (deadline is not None and time.monotonic() >= deadline):
        raise _CollectionIssue("collection cancelled/deadline reached")


def _evidence_read(path, limit=4096, deadline=None):
    _check_deadline(deadline)
    value = _read(path, limit + 1)
    _check_deadline(deadline)
    if value is None or len(value) > limit or "\ufffd" in value:
        raise _CollectionIssue("unreadable/truncated " + os.path.basename(path))
    return value


def _status_fields(pid, root="/proc", deadline=None, path=None):
    text = _evidence_read(path or os.path.join(root, str(pid), "status"), deadline=deadline)
    out = {}
    for line in text.splitlines():
        m = re.match(r"^(PPid|Tgid|Name|Threads|Uid|Gid|CapInh|CapPrm|CapEff|CapBnd|CapAmb|NoNewPrivs|Seccomp|Seccomp_filters|NSpid):\s*(.*)$", line)
        if m:
            out[m.group(1)] = m.group(2).strip()
    return out


def _ns_inodes(pid, root="/proc"):
    out = {}
    for ns in NS_KEYS:
        try:
            out[ns] = os.readlink(os.path.join(root, str(pid), "ns", ns))
        except OSError:
            out[ns] = "unavailable"
    return out


def _starttime(pid, root="/proc", deadline=None):
    stat = _evidence_read(os.path.join(root, str(pid), "stat"), deadline=deadline)
    try:
        return stat.rsplit(")", 1)[1].split()[19]
    except (IndexError, ValueError):
        raise _CollectionIssue("malformed process stat")


def _file_identity(st):
    return (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns, st.st_ctime_ns)


def _hash_exe(pid, root="/proc", deadline=None):
    """Hash one open executable FD; bind it to the path before and after.
    Cache only stable verified file identities, never a single path stat."""
    path = os.path.join(root, str(pid), "exe")
    try:
        _check_deadline(deadline)
        before = _file_identity(os.stat(path))
        with open(path, "rb") as fh:
            opened = _file_identity(os.fstat(fh.fileno()))
            if opened != before or not 0 < opened[2] <= MAX_EXE_BYTES:
                return None
            digest = _EXE_HASH_CACHE.get(opened)
            if digest is None:
                sha, total = hashlib.sha256(), 0
                while True:
                    _check_deadline(deadline)
                    chunk = fh.read(min(1024 * 1024, MAX_EXE_BYTES - total + 1))
                    _check_deadline(deadline)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > MAX_EXE_BYTES:
                        return None
                    sha.update(chunk)
                if total != opened[2]:
                    return None
                digest = sha.hexdigest()
            if _file_identity(os.fstat(fh.fileno())) != opened:
                return None
        if _file_identity(os.stat(path)) != opened:
            return None
        _check_deadline(deadline)
        if len(_EXE_HASH_CACHE) >= MAX_PIDS:
            _EXE_HASH_CACHE.clear()
        _EXE_HASH_CACHE[opened] = digest
        return digest
    except (OSError, MemoryError):
        return None


def _task_ids(pid, root, deadline):
    _check_deadline(deadline)
    tids = sorted(int(t) for t in os.listdir(os.path.join(root, str(pid), "task")) if t.isdigit())
    _check_deadline(deadline)
    if not tids or len(tids) > MAX_THREADS or any(t < 1 for t in tids):
        raise _CollectionIssue("thread inventory empty/truncated")
    return tids


def _threads(pid, root="/proc", deadline=None, declared=None):
    tids = _task_ids(pid, root, deadline)
    if not _pos_int(declared) or int(declared) != len(tids) or pid not in tids:
        raise _CollectionIssue("thread count does not match declared Threads/leader")
    out = []
    for tid in tids:
        path = os.path.join(root, str(pid), "task", str(tid), "status")
        sf = _status_fields(tid, root, deadline, path)
        record = {"tid": tid, "capInhHex": sf.get("CapInh", "missing"), "capPrmHex": sf.get("CapPrm", "missing"),
                  "hostUids": [int(i) for i in sf.get("Uid", "").split()],
                  "hostGids": [int(i) for i in sf.get("Gid", "").split()],
                  "capEffHex": sf.get("CapEff", "missing"), "capBndHex": sf.get("CapBnd", "missing"),
                  "capAmbHex": sf.get("CapAmb", "missing"),
                  "noNewPrivs": int(sf.get("NoNewPrivs", -1)), "seccomp": int(sf.get("Seccomp", -1)),
                  "seccompFilters": int(sf["Seccomp_filters"]) if sf.get("Seccomp_filters", "").isdigit() else None}
        if sf != _status_fields(tid, root, deadline, path):
            raise _CollectionIssue("thread status changed during collection")
        if sf.get("Tgid") is not None and sf["Tgid"] != str(pid):
            raise _CollectionIssue("thread Tgid does not match process")
        out.append(record)
    if tids != _task_ids(pid, root, deadline):
        raise _CollectionIssue("thread census changed during collection")
    return out


def _process_identity(pid, root, deadline):
    _check_deadline(deadline)
    status = _status_fields(pid, root, deadline)
    identity = {"status": status, "starttime": _starttime(pid, root, deadline),
                "bootId": _boot_id(root), "ns": _ns_inodes(pid, root),
                "cgroup": _evidence_read(os.path.join(root, str(pid), "cgroup"), deadline=deadline).strip(),
                "exe": os.readlink(os.path.join(root, str(pid), "exe"))}
    _check_deadline(deadline)
    return identity


def _proc_record(pid, status, root="/proc", main_pid=None, deadline=None):
    before = _process_identity(pid, root, deadline)
    if before["status"] != status:
        raise _CollectionIssue("process status changed since ancestry census")
    raw = _evidence_read(os.path.join(root, str(pid), "cmdline"), deadline=deadline)
    cmdline = [c for c in raw.split("\0") if c]
    if not raw.endswith("\0") or len(cmdline) > 64 or any(len(c) > MAX_FIELD for c in cmdline):
        raise _CollectionIssue("argv evidence truncated/oversized")
    exe = before["exe"]
    flags = [a for a in cmdline if a.startswith("--type=")]
    if len(flags) > 1:
        raise _CollectionIssue("conflicting Chromium process type flags")
    if _in_root(exe):
        ptype = flags[0].split("=", 1)[1] if flags else "browser"
    else:
        ptype = "main" if pid == main_pid else "other"
    digest = _hash_exe(pid, root, deadline) if _in_root(exe) else None
    threads = _threads(pid, root, deadline, status.get("Threads"))
    uid_map = _evidence_read(os.path.join(root, str(pid), "uid_map"), deadline=deadline).strip()
    after = _process_identity(pid, root, deadline)
    if before != after:
        raise _CollectionIssue("process identity/status changed during collection (PID reuse)")
    return {"pid": pid, "ppid": int(status.get("PPid", 0)), "exe": exe, "exeSha256": digest,
            "hostUids": [int(i) for i in status.get("Uid", "").split()],
            "hostGids": [int(i) for i in status.get("Gid", "").split()],
            "cmdline": cmdline, "type": ptype,
            "capInhHex": status.get("CapInh", "missing"), "capPrmHex": status.get("CapPrm", "missing"),
            "capEffHex": status.get("CapEff", "missing"), "capBndHex": status.get("CapBnd", "missing"),
            "capAmbHex": status.get("CapAmb", "missing"),
            "noNewPrivs": int(status.get("NoNewPrivs", -1)), "seccomp": int(status.get("Seccomp", -1)),
            "uidMap": uid_map, "nsInodes": before["ns"], "bootId": before["bootId"],
            "starttimeTicks": before["starttime"], "cgroup": before["cgroup"], "threads": threads}


def _runner(args, timeout=8):
    """Bound stdout while reading; a Docker invocation shares the poll deadline."""
    proc = None
    try:
        if timeout <= 0:
            return None
        end, data = time.monotonic() + timeout, bytearray()
        proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        with selectors.DefaultSelector() as sel:
            sel.register(proc.stdout, selectors.EVENT_READ)
            while True:
                remaining = end - time.monotonic()
                if remaining <= 0 or _CANCEL["flag"]:
                    return None
                ready = sel.select(min(remaining, 0.1))
                if not ready:
                    continue
                chunk = os.read(proc.stdout.fileno(), min(8192, MAX_COMMAND_BYTES - len(data) + 1))
                if not chunk:
                    break
                data.extend(chunk)
                if len(data) > MAX_COMMAND_BYTES:
                    return None
        return data.decode("utf-8", "strict") if proc.wait(timeout=max(0.001, end - time.monotonic())) == 0 else None
    except (subprocess.SubprocessError, OSError, UnicodeError):
        return None
    finally:
        if proc is not None:
            if proc.poll() is None:
                proc.kill()
            try:
                proc.wait(timeout=0.5)
            except subprocess.SubprocessError:
                pass
            if proc.stdout:
                proc.stdout.close()


def running_containers(runner, docker="docker"):
    out = runner([docker, "ps", "--no-trunc", "--format", "{{.ID}}|{{.Names}}|{{.Image}}|{{.Labels}}"])
    if out is None or len(out.encode("utf-8")) > MAX_COMMAND_BYTES:
        raise _CollectionIssue("running-container inventory unavailable/truncated")
    rows = []
    for line in out.splitlines():
        p = line.split("|")
        if len(p) != 4:
            raise _CollectionIssue("malformed running-container inventory")
        rows.append({"id": p[0], "name": p[1], "image": p[2],
                     "labels": dict(kv.split("=", 1) for kv in p[3].split(",") if "=" in kv)})
    return rows


def collect_observation(container_name, run_id, docker="docker", root="/proc", runner=None,
                        expected_sha=PINNED_BROWSER_SHA256, container_id=None, main_pid=None, deadline=None):
    """Collect one coherent bounded snapshot. Any bound/race/read gap is explicit."""
    if not _uuid_ok(run_id) or expected_sha != PINNED_BROWSER_SHA256:
        raise ValueError("canonical run_id and compiled executable pin required")
    deadline = deadline if deadline is not None else time.monotonic() + MAX_POLL_SECONDS
    base_runner = runner or _runner
    def run(args):
        _check_deadline(deadline)
        value = base_runner(args, timeout=min(8, max(0, deadline - time.monotonic())))
        _check_deadline(deadline)
        if value is not None and len(value.encode("utf-8")) > MAX_COMMAND_BYTES:
            raise _CollectionIssue("command output truncated/oversized")
        return value
    incomplete, procs, baseline, running, host_ns, boot = [], [], None, [], {}, None
    process_bytes, thread_count = 0, 0
    cid = container_id
    try:
        running = running_containers(run, docker)
        if cid is None or main_pid is None:
            raw = run([docker, "inspect", "-f", "{{.Id}}|{{.State.Pid}}", container_name])
            fields = (raw or "").strip().split("|")
            if len(fields) != 2 or not _hex64_ok(fields[0]) or not _pos_int(fields[1]):
                raise _CollectionIssue("container identity/main PID unavailable")
            if cid is not None and cid != fields[0]:
                raise _CollectionIssue("conflicting container identity")
            if main_pid is not None and main_pid != int(fields[1]):
                raise _CollectionIssue("conflicting container main PID")
            cid, main_pid = fields[0], int(fields[1])
        if not _hex64_ok(cid) or type(main_pid) is not int or main_pid < 1:
            raise _CollectionIssue("container identity/main PID unavailable")
        boot, host_ns = _boot_id(root), _ns_inodes(1, root)
        _check_deadline(deadline)
        pids = sorted(int(p) for p in os.listdir(root) if p.isdigit())
        if len(pids) > MAX_PIDS or any(p < 1 for p in pids):
            raise _CollectionIssue("PID census truncated/oversized")
        st = {}
        for pid in pids:
            try:
                st[pid] = _status_fields(pid, root, deadline)
            except (OSError, _CollectionIssue):
                # A disappearing unknown process could have been associated;
                # refuse this sample rather than silently dropping evidence.
                incomplete.append("PID census status unreadable/partial")
                _check_deadline(deadline)
        want = {main_pid}
        for _ in range(MAX_PIDS):
            nxt = {p for p in st if _pos_int(st[p].get("PPid")) and int(st[p]["PPid"]) in want} - want
            if not nxt:
                break
            want.update(nxt)
        else:
            raise _CollectionIssue("ancestry census truncated")
        # Include same-cgroup processes even if ancestry was lost/reparented.
        for pid in pids:
            try:
                cg = _evidence_read(os.path.join(root, str(pid), "cgroup"), deadline=deadline)
                if _cgroup_matches(cg, cid):
                    want.add(pid)
            except (OSError, _CollectionIssue):
                incomplete.append("PID cgroup census unreadable/partial")
                _check_deadline(deadline)
        for pid in sorted(want):
            try:
                record = _proc_record(pid, st.get(pid, {}), root, main_pid, deadline)
                process_bytes += len(json.dumps(record).encode("utf-8"))
                thread_count += len(record["threads"])
                if process_bytes > MAX_OBSERVATION_BYTES // 2 or thread_count > MAX_THREADS:
                    raise _CollectionIssue("process/thread evidence exceeds total byte/count bound")
                procs.append(record)
            except (OSError, ValueError, _CollectionIssue) as exc:
                incomplete.append("pid %s incomplete: %s" % (pid, str(exc)[:120]))
                _check_deadline(deadline)
                if process_bytes > MAX_OBSERVATION_BYTES // 2 or thread_count > MAX_THREADS:
                    raise _CollectionIssue("total process/thread evidence truncated")
        # Revalidate every captured process after the whole census, not merely
        # after its own hash, so mixed-generation snapshots cannot pass.
        for p in procs:
            current = _process_identity(p["pid"], root, deadline)
            if (current["starttime"] != p["starttimeTicks"] or current["bootId"] != p["bootId"]
                    or current["ns"] != p["nsInodes"] or current["cgroup"] != p["cgroup"]
                    or current["exe"] != p["exe"] or current["status"] != st.get(p["pid"])
                    or _task_ids(p["pid"], root, deadline) != [t["tid"] for t in p["threads"]]):
                incomplete.append("process identity changed after census")
        if boot != _boot_id(root) or host_ns != _ns_inodes(1, root):
            incomplete.append("host boot/namespace identity changed")
        main_rec = next((p for p in procs if p["pid"] == main_pid), None)
        if main_rec:
            fs = [t["seccompFilters"] for t in main_rec["threads"] if type(t["seccompFilters"]) is int]
            baseline = min(fs) if fs else None
        for p in procs:
            if _in_root(p.get("exe")) and not _hex64_ok(p.get("exeSha256")):
                incomplete.append("unreadable executable hash for pid %s" % p["pid"])
        _check_deadline(deadline)
    except (OSError, ValueError, _CollectionIssue) as exc:
        incomplete.append(str(exc)[:160])
    if not isinstance(baseline, int) or baseline < 1:
        incomplete.append("container seccomp baseline unavailable")
    if not cid or not any(c.get("id") == cid for c in running):
        incomplete.append("target container not among running containers")
    return {"runId": run_id, "containerName": container_name, "containerId": cid, "mainPid": main_pid or 0,
            "bootId": boot, "runningContainers": running, "containerSeccompFilters": baseline,
            "hostNamespaces": host_ns, "expectedExeSha256": PINNED_BROWSER_SHA256, "processes": procs,
            "incomplete": bool(incomplete), "incompleteReasons": sorted(set(incomplete))}


# --- bounded lifecycle polling ---------------------------------------------
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


# --- bounded, hash-bound evidence export -----------------------------------
def build_export_plan(records, run_id, stream, index=0, now_ms=None):
    events, total, keys = [], 0, []
    for name in sorted(records):
        value = records[name]
        text = (value if isinstance(value, str) else json.dumps(value, sort_keys=True))[:MAX_EXPORT_BYTES]
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        keys.append({"name": name, "sha256": digest, "bytes": len(text)})
        msg = json.dumps({"run": run_id, "index": index, "record": name, "sha256": digest, "body": text})
        if total + len(msg) > MAX_EXPORT_BYTES or len(events) >= MAX_EXPORT_EVENTS:
            break
        events.append({"timestamp": now_ms or 0, "message": msg}); total += len(msg)
    return {"logStream": stream, "run": run_id, "events": events, "records": keys,
            "bytes": total, "calls": 1, "index": index}


def classify_put_response(response):
    try:
        parsed = json.loads(response) if isinstance(response, str) else response
    except (ValueError, TypeError):
        return {"ok": False, "reason": "unparseable PutLogEvents response"}
    bad = {k: v for k, v in ((parsed or {}).get("rejectedLogEventsInfo") or {}).items() if v}
    if bad:
        return {"ok": False, "reason": "rejectedLogEventsInfo present", "rejected": bad}
    return {"ok": True, "rejected": {}}


def _load_json(path, default=None):
    try:
        with open(path, "r", errors="replace") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def _dump(obj, path=None):
    text = json.dumps(obj, indent=2)
    print(text)
    if path:
        _atomic_write(path, text + "\n")
    return 0 if obj.get("ok", True) else 3


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
                 "--poll-selftest", "--put-response", "--export-plan", "--run-id", "--exe-sha256"):
        ap.add_argument(flag)
    ap.add_argument("--parse-version", nargs=2, metavar=("TOOL", "RAW"))
    ap.add_argument("--status", type=int)
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
        plan = build_export_plan(spec.get("records") or {}, spec.get("runId"), spec.get("stream", "s"),
                                 index=spec.get("index", 0), now_ms=spec.get("nowMs"))
        plan["ok"] = len(plan["events"]) > 0 and plan["bytes"] <= MAX_EXPORT_BYTES
        return _dump(plan, args.out)
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


if __name__ == "__main__":
    sys.exit(main())
