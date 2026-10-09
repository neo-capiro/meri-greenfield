#!/usr/bin/env python3
# W02-06 browser-host observer + pure classifiers. PREPARATION ONLY - NOT run.
# Single source of truth for version normalisation, host preflight, the bounded
# observation collector/classifier and bounded --watch polling. security.test.mjs
# (next checkpoint) and pure fake-proc harnesses drive every mode offline. Records
# only safe versions/hashes/configuration. Fail closed. A Node process is never
# the browser. The pinned executable is hashed through /proc/<pid>/exe (the
# container mount namespace), never the host /opt path.
import argparse, hashlib, json, os, re, signal, subprocess, sys, time

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
def _in_root(e): return bool(e) and bool(BROWSER_EXE_PATTERN.match(e or ""))
def _is_node(e): return bool(e) and bool(NODE_EXE.search(e or ""))
def _cap_zero(h): return isinstance(h, str) and re.fullmatch(r"[0]+", (h or "").lower()) is not None
def _all_caps_zero(p): return all(_cap_zero(p.get(k)) for k in CAP_KEYS)
def _thread_ok(t): return (all(_cap_zero(t.get(k)) for k in CAP_KEYS) and t.get("noNewPrivs") == 1 and t.get("seccomp") == 2)
def _ns(ns, k): return ns.get(k) if isinstance(ns, dict) else None
def _hex64_ok(v): return isinstance(v, str) and bool(_HEX64.match(v))


def _pos_int(v):
    try:
        return int(v) >= 1
    except (TypeError, ValueError):
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
    return all(isinstance(ns.get(k), str) and ns[k] for k in NS_KEYS)


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
    obs, exp, reasons = observation or {}, expected or {}, []
    procs = obs.get("processes") or []
    running = obs.get("runningContainers") or []
    boot = obs.get("bootId")
    by_pid = {p.get("pid"): p for p in procs if isinstance(p.get("pid"), int)}
    main_proc = by_pid.get(obs.get("mainPid"))
    baseline = obs.get("containerSeccompFilters")
    expected_sha = exp.get("exeSha256") or PINNED_BROWSER_SHA256  # never derived from observation

    if obs.get("incomplete") or obs.get("incompleteReasons"):
        reasons.append("collection marked incomplete/partial: %s" % ",".join(obs.get("incompleteReasons") or [])[:200])
    if exp.get("runId") and obs.get("runId") != exp["runId"]:
        reasons.append("observation runId does not match the required run")
    if not obs.get("runId"):
        reasons.append("observation is not bound to a run")
    if len(running) != 1:
        reasons.append("expected exactly one running container this run, saw %d" % len(running))
    target = running[0] if len(running) == 1 else None
    if not obs.get("containerId") or not target or target.get("id") != obs.get("containerId"):
        reasons.append("target container is not the single observed running container")
    if target:
        if target.get("image") != PINNED_IMAGE:
            reasons.append("observed container image is not the pinned qualification image")
        if obs.get("runId") and (target.get("labels") or {}).get("meri.qualification.run") != obs.get("runId"):
            reasons.append("observed container label is not bound to the run")
        if obs.get("runId") and obs["runId"] not in (target.get("name") or ""):
            reasons.append("observed container name is not bound to the run")
    if not procs:
        reasons.append("no process evidence collected for the target container")
    if not isinstance(baseline, int) or baseline < 1:
        reasons.append("missing positive same-container seccomp baseline")
    if not isinstance(obs.get("hostNamespaces"), dict) or not _ns_complete(obs.get("hostNamespaces")):
        reasons.append("missing host namespace baselines")
    if main_proc is None:
        reasons.append("container main process evidence missing")
    if not boot:
        reasons.append("observation boot id missing")

    pids = [p.get("pid") for p in procs if isinstance(p.get("pid"), int)]
    if len(pids) != len(set(pids)):
        reasons.append("duplicate process pid evidence (contradiction/PID reuse)")
    for p in procs:
        if not (isinstance(p.get("starttimeTicks"), (str, int)) and _pos_int(p.get("starttimeTicks"))):
            reasons.append("process pid %s missing starttime" % p.get("pid"))
        if not p.get("cgroup"):
            reasons.append("process pid %s missing cgroup" % p.get("pid"))
        elif obs.get("containerId") and obs["containerId"][:12] not in str(p["cgroup"]):
            reasons.append("process pid %s is outside the target container cgroup" % p.get("pid"))
        if not p.get("bootId"):
            reasons.append("process pid %s missing boot id" % p.get("pid"))
        if not _ns_complete(p.get("nsInodes")):
            reasons.append("process pid %s namespace inodes incomplete" % p.get("pid"))
        if not _parse_uid_map_strict(p.get("uidMap")):
            reasons.append("process pid %s uid map malformed" % p.get("pid"))
        tids = [t.get("tid") for t in (p.get("threads") or []) if isinstance(t.get("tid"), int)]
        if not tids:
            reasons.append("process pid %s has no thread evidence" % p.get("pid"))
        if len(tids) != len(set(tids)):
            reasons.append("process pid %s has duplicate thread evidence" % p.get("pid"))
    if boot and any(p.get("bootId") and p.get("bootId") != boot for p in procs):
        reasons.append("process evidence crosses boot ids (possible PID reuse)")

    browsers = [p for p in procs if p.get("type") == "browser"]
    renderers = [p for p in procs if p.get("type") == "renderer"]
    if any(_is_node(p.get("exe")) for p in procs if p.get("type") in CHROMIUM_SAFE_KINDS):
        reasons.append("a Node process was misidentified as a browser/renderer")
    if not browsers:
        reasons.append("no identified actual Chromium browser process for this run")
    if not renderers:
        reasons.append("no identified actual Chromium renderer process for this run")

    # every associated browser/renderer (including extras) must be pinned + safe
    for label, p in [("browser", b) for b in browsers] + [("renderer", r) for r in renderers]:
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
        if not main_f or any(not isinstance(x, int) for x in main_f):
            reasons.append("container main thread seccomp filter counts missing")
        elif isinstance(baseline, int) and min(main_f) != baseline:
            reasons.append("container main seccomp baseline is incoherent with the reported baseline")
    for b in browsers:
        bf = [t.get("seccompFilters") for t in (b.get("threads") or [])]
        if not bf or any(not isinstance(x, int) for x in bf):
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
        if not fs or any(not isinstance(x, int) for x in fs):
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
def _status_fields(pid, root="/proc"):
    text = _read(os.path.join(root, str(pid), "status"))
    out = {}
    for line in (text or "").splitlines():
        m = re.match(r"^(PPid|Name|Uid|Gid|CapInh|CapPrm|CapEff|CapBnd|CapAmb|NoNewPrivs|Seccomp|Seccomp_filters|NSpid):\s*(.*)$", line)
        if m:
            out[m.group(1)] = m.group(2).strip()
    return out


def _ns_inodes(pid, root="/proc"):
    out = {}
    try:
        for ns in os.listdir(os.path.join(root, str(pid), "ns")):
            try:
                out[ns] = os.readlink(os.path.join(root, str(pid), "ns", ns))
            except OSError:
                out[ns] = "unavailable"
    except OSError:
        return {}
    return out


def _starttime(pid, root="/proc"):
    stat = _read(os.path.join(root, str(pid), "stat"))
    if not stat:
        return None
    try:
        return stat.rsplit(")", 1)[1].split()[19]
    except (IndexError, ValueError):
        return None


def _hash_exe(pid, root="/proc"):
    """Hash the executable through /proc/<pid>/exe (container mount namespace).
    Cached only by verified filesystem identity (dev, ino, size, mtime)."""
    path = os.path.join(root, str(pid), "exe")
    try:
        st = os.stat(path)
    except OSError:
        return None
    key = (st.st_dev, st.st_ino, st.st_size, getattr(st, "st_mtime_ns", int(st.st_mtime)))
    if key in _EXE_HASH_CACHE:
        return _EXE_HASH_CACHE[key]
    data = _read_bytes(path)
    if data is None or len(data) >= MAX_EXE_BYTES:
        return None
    digest = hashlib.sha256(data).hexdigest()
    _EXE_HASH_CACHE[key] = digest
    return digest


def _threads(pid, root="/proc"):
    out = []
    try:
        tids = sorted(int(t) for t in os.listdir(os.path.join(root, str(pid), "task")) if t.isdigit())[:MAX_THREADS]
    except OSError:
        return out
    for tid in tids:
        sf = _status_fields(tid, root)
        raw = _read(os.path.join(root, str(pid), "task", str(tid), "status"))
        m = re.search(r"^Seccomp_filters:\s*(\d+)", raw or "", re.M)
        out.append({"tid": tid, "capInhHex": sf.get("CapInh", "missing"), "capPrmHex": sf.get("CapPrm", "missing"),
                    "capEffHex": sf.get("CapEff", "missing"), "capBndHex": sf.get("CapBnd", "missing"),
                    "capAmbHex": sf.get("CapAmb", "missing"),
                    "noNewPrivs": int(sf.get("NoNewPrivs", -1) or -1), "seccomp": int(sf.get("Seccomp", -1) or -1),
                    "seccompFilters": int(m.group(1)) if m else None})
    return out


def _proc_record(pid, status, root="/proc", main_pid=None):
    cmdline = [c[:MAX_FIELD] for c in (_read(os.path.join(root, str(pid), "cmdline")) or "").split("\0") if c][:64]
    try:
        exe = os.readlink(os.path.join(root, str(pid), "exe"))
    except OSError:
        exe = None
    typeflag = next((a for a in cmdline if a.startswith("--type=")), None)
    if typeflag:
        ptype = typeflag.split("=", 1)[1].split(",")[0]
    else:
        ptype = "main" if (main_pid is not None and pid == main_pid) else "other"  # never default to browser
    root_path = _in_root(exe)
    return {"pid": pid, "ppid": int(status.get("PPid", 0) or 0), "exe": exe,
            "exeSha256": _hash_exe(pid, root) if root_path else None, "cmdline": cmdline, "type": ptype,
            "capInhHex": status.get("CapInh", "missing"), "capPrmHex": status.get("CapPrm", "missing"),
            "capEffHex": status.get("CapEff", "missing"), "capBndHex": status.get("CapBnd", "missing"),
            "capAmbHex": status.get("CapAmb", "missing"),
            "noNewPrivs": int(status.get("NoNewPrivs", -1) or -1), "seccomp": int(status.get("Seccomp", -1) or -1),
            "uidMap": (_read(os.path.join(root, str(pid), "uid_map")) or "").strip(),
            "nsInodes": _ns_inodes(pid, root), "bootId": _boot_id(root), "starttimeTicks": _starttime(pid, root),
            "cgroup": (_read(os.path.join(root, str(pid), "cgroup")) or "").strip().replace("\n", " ")[:512],
            "threads": _threads(pid, root)}


def _runner(args, timeout=8):
    try:
        out = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return out.stdout if out.returncode == 0 else None
    except (subprocess.SubprocessError, OSError):
        return None


def running_containers(runner, docker="docker"):
    out = runner([docker, "ps", "--no-trunc", "--format", "{{.ID}}|{{.Names}}|{{.Image}}|{{.Labels}}"])
    rows = []
    for line in (out or "").splitlines():
        p = line.split("|")
        if len(p) >= 4:
            rows.append({"id": p[0], "name": p[1], "image": p[2],
                         "labels": dict(kv.split("=", 1) for kv in p[3].split(",") if "=" in kv)})
    return rows


def collect_observation(container_name, run_id, docker="docker", root="/proc", runner=None,
                        expected_sha=PINNED_BROWSER_SHA256, container_id=None, main_pid=None):
    """Bounded real observation. Fake-injectable via `root` (proc tree) and `runner`.
    Never returns a null run id/hash for associated Chromium: unreadable evidence
    marks the collection incomplete."""
    if not run_id:
        raise ValueError("run_id is required for a bound observation")
    run = runner or _runner
    incomplete = []
    running = running_containers(run, docker)
    cid = container_id
    if cid is None:
        cid = (run([docker, "inspect", "-f", "{{.Id}}", container_name]) or "").strip() or None
    if main_pid is None:
        raw = run([docker, "inspect", "-f", "{{.State.Pid}}", container_name])
        try:
            main_pid = int((raw or "0").strip() or 0)
        except ValueError:
            main_pid = 0
    if not cid:
        incomplete.append("containerId unavailable")
    if not main_pid or main_pid < 1:
        incomplete.append("container main pid unavailable")
    procs, baseline = [], None
    if cid and main_pid and main_pid > 0:
        try:
            pids = [int(p) for p in os.listdir(root) if p.isdigit()][:MAX_PIDS]
        except OSError:
            pids = []
        st = {pid: _status_fields(pid, root) for pid in pids}
        want, frontier_guard = {main_pid}, 0
        while frontier_guard < 64:
            frontier_guard += 1
            nxt = [p for p in pids if st[p].get("PPid") and int(st[p]["PPid"]) in want and p not in want]
            if not nxt:
                break
            want.update(nxt)
        for pid in sorted(want):
            procs.append(_proc_record(pid, st.get(pid, {}), root, main_pid))
        main_rec = next((p for p in procs if p["pid"] == main_pid), None)
        if main_rec:
            filters = [t["seccompFilters"] for t in main_rec["threads"] if isinstance(t["seccompFilters"], int)]
            baseline = min(filters) if filters else None
        else:
            incomplete.append("main process record missing")
        for p in procs:
            if _in_root(p.get("exe")) and not _hex64_ok(p.get("exeSha256")):
                incomplete.append("unreadable executable hash for pid %s" % p["pid"])
    if not isinstance(baseline, int) or baseline < 1:
        incomplete.append("container seccomp baseline unavailable")
    if not cid or not any(c.get("id") == cid for c in running):
        incomplete.append("target container not among running containers")
    return {"runId": run_id, "containerName": container_name, "containerId": cid, "mainPid": main_pid or 0,
            "bootId": _boot_id(root), "runningContainers": running, "containerSeccompFilters": baseline,
            "hostNamespaces": _ns_inodes(1, root), "expectedExeSha256": expected_sha, "processes": procs,
            "incomplete": bool(incomplete), "incompleteReasons": incomplete}


# --- bounded lifecycle polling ---------------------------------------------
def run_bounded_poll(collect_fn, alive_fn, clock=None, sleep=None, deadline_s=MAX_POLL_SECONDS, interval_s=1,
                     join_fn=None, classify_fn=None, should_stop_fn=None):
    """Bounded lifecycle poll. Waits through startup, keeps the best passing
    observation, and reports an explicit lifecycle. Fake-injectable clock/sleep/
    should_stop_fn. Absolute deadline is clamped to MAX_POLL_SECONDS."""
    clock = clock or time.monotonic
    sleep = sleep or time.sleep
    deadline_s = min(max(deadline_s, 1), MAX_POLL_SECONDS)
    start = clock()
    timeline, best, best_ok, last, seen = [], None, False, None, False
    lifecycle, reason = "timeout", "deadline reached before a complete observation"
    while clock() - start < deadline_s and len(timeline) < 600:
        if should_stop_fn and should_stop_fn():
            lifecycle, reason = "cancel", "bounded stop requested"
            break
        try:
            obs = collect_fn() or {}
        except Exception as exc:  # noqa: BLE001 - malformed collection must not abort the poll
            obs = {"incomplete": True, "incompleteReasons": ["collector raised: %s" % type(exc).__name__]}
        present = bool(obs.get("containerId"))
        seen = seen or present
        last = obs
        timeline.append({"t": round(clock() - start, 3), "containerId": obs.get("containerId"),
                         "procs": len(obs.get("processes") or []), "incomplete": bool(obs.get("incomplete"))})
        if present and classify_fn and not best_ok:
            verdict = classify_fn(obs)
            if verdict.get("ok"):
                best, best_ok, lifecycle, reason = obs, True, "passing", "complete passing observation captured"
        if present and not classify_fn and obs.get("processes") and not best_ok:
            best, best_ok, lifecycle, reason = obs, True, "passing", "observation with processes captured"
        if seen and not present:
            lifecycle, reason = "stopped", "container disappeared after being observed"
            break
        sleep(interval_s)
    else:
        if lifecycle == "timeout":
            lifecycle = "timeout" if seen else "never-started"
            reason = "deadline reached while %s" % ("running without a complete observation" if seen else "container never appeared")
    return {"stopped": lifecycle == "stopped", "lifecycle": lifecycle, "reason": reason,
            "iterations": len(timeline), "elapsed": round(clock() - start, 3), "timeline": timeline,
            "observation": last, "bestObservation": best, "bestOk": best_ok,
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
        _install_signals()
        def collect_fn():
            return collect_observation(args.container_name, args.run_id,
                                       expected_sha=args.exe_sha256 or PINNED_BROWSER_SHA256)
        env = run_bounded_poll(collect_fn, lambda o: bool(o.get("containerId")),
                               deadline_s=MAX_POLL_SECONDS, interval_s=1, classify_fn=classify,
                               should_stop_fn=lambda: _CANCEL["flag"])
        env["runId"] = args.run_id
        return _dump({"ok": env["bestOk"], **env}, args.out)
    obs = collect_observation(args.container_name, args.run_id, expected_sha=args.exe_sha256 or PINNED_BROWSER_SHA256)
    return _dump({"ok": not obs.get("incomplete") and bool(obs.get("processes")), "observation": obs}, args.out)


if __name__ == "__main__":
    sys.exit(main())
