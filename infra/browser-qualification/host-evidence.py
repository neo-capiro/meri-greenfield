#!/usr/bin/env python3
# W02-06 browser-host observer + pure classifiers. PREPARATION ONLY - NOT run.
# Single source of truth for version normalisation, host preflight, the bounded
# observation collector/classifier and bounded --watch polling. security.test.mjs
# and pure fake-proc harnesses drive these modes offline. Codex owner completion
# changes deferred admission/export/bootstrap helpers only; the39 reviewed
# collector/classifier/poll/version/helper bodies remain exactly at4fd85f7.
# Records
# only safe versions/hashes/configuration. Fail closed. A Node process is never
# the browser. The pinned executable is hashed through /proc/<pid>/exe (the
# container mount namespace), never the host /opt path.
import argparse, base64, hashlib, json, math, os, re, selectors, signal, subprocess, sys, time, uuid

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


# --- Codex owner completion: deferred admission/export; collector unchanged ---
BROWSER_VERSION = "155.0.8059.12"
PROBE_CMD = "/opt/meri-worker/probes/browser.mjs"
EXPECTED_SECCOMP_PATH = "/opt/meri-browser-host/seccomp.json"
EXPECTED_SECCOMP_SHA256 = "e62f4c3e3e7ce6de099ba7a0e3df0881b7b407b74dc664aef70f76f6316385c6"
WORKSPACE_SOURCE = "/workspace/browser-host"
RESOURCE_CAPS = {"PidsLimit": 512, "Memory": 4 * 1024 ** 3, "NanoCpus": 2 * 10 ** 9, "ShmSize": 1 * 1024 ** 3}
EXPORT_CHUNK_RAW_MAX, EXPORT_CHUNK_B64_MAX, EXPORT_EVENT_MAX = 6144, 8192, 12 * 1024
EXPORT_TOTAL_RAW_MAX, EXPORT_MAX_EVENTS, EXPORT_MAX_CALLS = 8 * 1024 * 1024, 1500, 32
EXPORT_BATCH_BYTES, EXPORT_BATCH_EVENTS, EXPORT_EVENT_OVERHEAD = 900 * 1024, 100, 26
CAPTURE_FILE_MAX = 2 * 1024 * 1024
REQUIRED_SUBSTEPS = ("get_config", "nav-fixture", "snapshot", "download-nav", "download-bytes",
                     "version-nav", "version-eval", "sandbox-nav", "sandbox-eval")
SHA256_PREFIXED = re.compile(r"^sha256:[0-9a-f]{64}$")
SUPPORT_PATTERN = re.compile(r"^" + re.escape(PINNED_IMAGE.split("@")[0]) + r"@sha256:[0-9a-f]{64}$")
SAFE_IMAGE_ENV = {
    "PATH": "/opt/meri-venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "NODE_VERSION": "24.21.0", "YARN_VERSION": "1.22.22",
    "HOME": "/workspace/home", "TMPDIR": "/tmp", "CLAUDE_CONFIG_DIR": "/workspace/config",
    "PLAYWRIGHT_BROWSERS_PATH": "/opt/meri-browsers", "NODE_ENV": "production",
    "MERI_QUALIFICATION_ONLY": "true", "MERI_SOURCES_ENABLED": "false", "CHROMIUM_SANDBOX_REQUIRED": "true",
}
CONTEXT_KEYS = {"run", "supportImage", "workerImage", "profileSha", "source"}
RECORD_NAMES = {"run-record", "observer", "browser", "inspect", "versions", "preflight", "browserStdout", "browserStderr", "capture", "exit", "timer"}


def _finite_json(value):
    try:
        return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False, ensure_ascii=False)
    except (TypeError, ValueError):
        return None


def _exact_keys(value, keys):
    return isinstance(value, dict) and set(value) == set(keys)


def _strict_json(text):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result: raise ValueError("duplicate JSON key")
            result[key] = value
        return result
    def constant(_value): raise ValueError("nonfinite JSON")
    return json.loads(text, object_pairs_hook=pairs, parse_constant=constant)


def _bounded_text(path, limit=CAPTURE_FILE_MAX):
    """Bound before allocation; reject replacement, links, nonregular or changed input."""
    import stat
    listed = os.lstat(path)
    if not stat.S_ISREG(listed.st_mode) or listed.st_nlink != 1 or listed.st_size > limit:
        raise ValueError("unsafe/oversize evidence file: " + os.path.basename(path))
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_BINARY", 0)
    fd = os.open(path, flags)
    try:
        before = os.fstat(fd)
        if _evidence_identity(before) != _evidence_identity(listed) or before.st_nlink != 1:
            raise ValueError("evidence file changed before read")
        chunks, total = [], 0
        while True:
            chunk = os.read(fd, min(65536, limit - total + 1))
            if not chunk:
                break
            total += len(chunk)
            if total > limit:
                raise ValueError("evidence file exceeds bound")
            chunks.append(chunk)
        after = os.fstat(fd)
        if _evidence_identity(after) != _evidence_identity(before) or after.st_nlink != 1 or total != before.st_size or _evidence_identity(os.lstat(path)) != _evidence_identity(listed):
            raise ValueError("evidence file changed during read")
        return b"".join(chunks).decode("utf-8", "strict")
    finally:
        os.close(fd)


def _evidence_identity(st):
    # Python on Windows reports path ctime as birthtime but descriptor ctime as
    # change time. Authoring fixtures compare birthtime consistently there.
    # Actual Linux guest retains the full inode/size/mtime/ctime comparison.
    changed = getattr(st, "st_birthtime_ns", None) if os.name == "nt" else st.st_ctime_ns
    return (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns, changed)


def source_manifest():
    folder = os.path.dirname(os.path.abspath(__file__))
    names = {"observer": "host-evidence.py", "bootstrap": "bootstrap.sh", "seccomp": "seccomp.json"}
    if not os.path.exists(os.path.join(folder, "seccomp.json")):
        names["seccomp"] = "seccomp.chromium-155-amd64.json"
    result = {}
    for key, name in names.items():
        raw = _bounded_text(os.path.join(folder, name), CAPTURE_FILE_MAX).encode("utf-8")
        result[key] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    return result


def _context_ok(ctx, run):
    return (_exact_keys(ctx, CONTEXT_KEYS) and ctx["run"] == run and ctx["workerImage"] == PINNED_IMAGE
            and isinstance(ctx["supportImage"], str) and SUPPORT_PATTERN.fullmatch(ctx["supportImage"]) is not None and ctx["supportImage"] != PINNED_IMAGE
            and ctx["profileSha"] == EXPECTED_SECCOMP_SHA256
            and isinstance(ctx["source"], dict) and set(ctx["source"]) == {"observer", "bootstrap", "seccomp"}
            and all(_exact_keys(v, {"bytes", "sha256"}) and type(v["bytes"]) is int and 0 < v["bytes"] <= CAPTURE_FILE_MAX
                    and _hex64_ok(v["sha256"]) for v in ctx["source"].values())
            and ctx["source"]["seccomp"]["sha256"] == EXPECTED_SECCOMP_SHA256)


def _sandbox_rows_ok(sandbox):
    if not isinstance(sandbox, dict) or not isinstance(sandbox.get("rows"), list):
        return ["chrome://sandbox rows unavailable"]
    found = {}
    for row in sandbox["rows"]:
        if not isinstance(row, list) or not row or row[0] not in ("Layer 1 Sandbox", "Seccomp-BPF sandbox"):
            continue
        if len(row) != 2 or any(not isinstance(x, str) for x in row): return ["chrome://sandbox row malformed"]
        label, value = [x.strip() for x in row]
        if label in ("Layer 1 Sandbox", "Seccomp-BPF sandbox"):
            if label in found:
                return ["chrome://sandbox duplicate/ambiguous row"]
            found[label] = value
    return [] if found.get("Layer 1 Sandbox") in ("Namespace", "SUID") and found.get("Seccomp-BPF sandbox") == "Yes" else ["sandbox rows do not prove Layer1 + seccomp"]


def timer_record(active, target, next_deadline, run_id, uptime=None):
    """Accept systemd's raw microseconds or formatted monotonic duration.
    Prove the EXISTING timer leaves480s for this bootstrap; never rearm it."""
    units={"us":.000001,"µs":.000001,"ms":.001,"s":1,"min":60,"h":3600,"d":86400,"w":604800}
    seconds=None
    if isinstance(next_deadline,str) and len(next_deadline)<=128:
        if re.fullmatch(r"[0-9]+",next_deadline):seconds=int(next_deadline)/1000000
        else:
            parts=next_deadline.split()
            matches=[re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)(us|µs|ms|s|min|h|d|w)",part) for part in parts]
            if matches and all(matches):seconds=sum(float(m[1])*units[m[2]] for m in matches)
    if uptime is None:
        try:uptime=float((_read("/proc/uptime",512) or "").split()[0])
        except (ValueError,IndexError):uptime=None
    if seconds is not None and not math.isfinite(seconds):seconds=None
    valid_uptime=type(uptime) in (float,int) and 0<=uptime<10**9
    if not valid_uptime:uptime=None
    remaining=seconds-uptime if seconds is not None and valid_uptime else None
    ok=(_uuid_ok(run_id) and active=="active" and target=="meri-browser-assets-poweroff-"+run_id+".service"
        and remaining is not None and 480<=remaining<=900)
    return {"ok":ok,"active":active,"target":target,"next":next_deadline,"uptime":uptime,"remainingSeconds":remaining}


def _browser_payload_reasons(browser):
    if not isinstance(browser, dict):
        return ["browser payload missing/not an object"]
    reasons = []
    required = {"probe", "uid", "serverVersion", "browserVersion", "versionData", "sandbox", "browserProcess", "rendererProcess", "processes", "procEvidence", "download", "rawResults", "prelaunch", "stepSequence", "reasons", "evidencePaths", "effectiveFlagsSource", "disablingFlags", "ok", "sandboxVerified", "stderr", "tools"}
    if not required.issubset(browser):
        reasons.append("browser payload lacks complete existing probe fields")
    if browser.get("probe") != "browser" or browser.get("ok") is not True or browser.get("sandboxVerified") is not True:
        reasons.append("browser probe did not pass")
    if type(browser.get("uid")) is not int or browser["uid"] != 10001:
        reasons.append("browser uid must be integer10001")
    if browser.get("reasons") != [] or browser.get("disablingFlags") != [] or browser.get("effectiveFlagsSource") != "proc":
        reasons.append("browser failures/flags/process evidence inconclusive")
    version = browser.get("versionData")
    if (browser.get("browserVersion") != BROWSER_VERSION or not isinstance(version, dict)
            or not isinstance(version.get("userAgent"), str) or "Chrome/" + BROWSER_VERSION not in version["userAgent"]
            or not isinstance(version.get("text"), str)):
        reasons.append("browser version evidence missing/wrong")
    seq, tools = browser.get("stepSequence"), browser.get("tools")
    if not isinstance(seq, dict) or not isinstance(tools, list) or any(not isinstance(t, str) for t in tools):
        reasons.append("browser sequence/tools malformed")
    else:
        optional = "browser_get_config" not in tools
        expected_ran = list(REQUIRED_SUBSTEPS[1:] if optional else REQUIRED_SUBSTEPS)
        expected_not = ["get_config"] if optional else []
        details = seq.get("details")
        if seq.get("order") != list(REQUIRED_SUBSTEPS) or seq.get("ran") != expected_ran or seq.get("notRun") != expected_not or seq.get("stoppedAfter") is not None:
            reasons.append("browser sequence is not the actual complete ordered flow")
        exact = {"get_config": "browser_get_config tool absent" if optional else "ok", "nav-fixture": "ok", "snapshot": "marker present", "download-nav": "ok", "download-bytes": "bytes match", "version-nav": "ok", "version-eval": BROWSER_VERSION, "sandbox-nav": "ok", "sandbox-eval": "rows captured"}
        if details != exact:
            reasons.append("browser substep details report failure/missing facts")
    dl = browser.get("download")
    download_sha = hashlib.sha256(b"meri-loopback-fixture-download\n").hexdigest()
    if (not isinstance(dl, dict) or dl.get("found") is not True or dl.get("payloadMatches") is not True
            or dl.get("sha256") != download_sha or dl.get("expectedSha256") != download_sha
            or type(dl.get("bytes")) is not int or dl["bytes"] != 31
            or not isinstance(dl.get("file"), str) or not re.fullmatch(r"[A-Za-z0-9_.-]*meri-fixture[A-Za-z0-9_.-]*", dl["file"])):
        reasons.append("browser loopback download facts disagree with known fixture")
    reasons.extend(_sandbox_rows_ok(browser.get("sandbox")))
    paths = browser.get("evidencePaths")
    root = paths[0] if isinstance(paths, list) and paths and isinstance(paths[0], str) else ""
    if not re.fullmatch(r"/workspace/qualification-browser/probe-[0-9a-f-]{36}", root) or not _uuid_ok(root.rsplit("probe-", 1)[-1]):
        reasons.append("browser profile/output run path missing")
    for name, kind in (("browserProcess", "browser"), ("rendererProcess", "renderer")):
        proc = browser.get(name)
        if not isinstance(proc, dict) or not _pos_int(proc.get("pid")) or proc.get("exe") != PINNED_BROWSER_EXE or not isinstance(proc.get("argv"), list):
            reasons.append("browser process identity missing/wrong: " + name)
            continue
        argv = proc["argv"]
        if any(not isinstance(a, str) or any(flag in a for flag in DISABLING_FLAGS) for a in argv):
            reasons.append("browser process argv unsafe")
        if kind == "browser" and (any(a.startswith("--type=") for a in argv if isinstance(a,str)) or "--user-data-dir=" + root + "/profile" not in argv):
            reasons.append("browser process profile/type does not match actual probe")
        if kind == "renderer" and (proc.get("type") != "renderer" or "--type=renderer" not in argv):
            reasons.append("renderer type/argv missing")
    processes = browser.get("processes")
    if not isinstance(processes, list) or not processes or len(processes) > MAX_PIDS or any(not isinstance(p, dict) for p in processes):
        reasons.append("browser process inventory missing/malformed")
    else:
        for name in ("browserProcess", "rendererProcess"):
            selected = browser.get(name)
            if isinstance(selected,dict) and not any(all(p.get(k)==selected.get(k) for k in ("pid","exe","argv")) for p in processes):reasons.append("selected process absent from actual inventory")
        if any(not isinstance(p.get("argv"),list) or any(not isinstance(a,str) or any(f in a for f in DISABLING_FLAGS) for a in p["argv"]) for p in processes):reasons.append("process inventory argv unsafe/malformed")
    raw = browser.get("rawResults")
    required_raw = {"nav", "snapshot", "download", "versionNav", "version", "sandboxNav", "sandbox"}
    if not isinstance(raw, dict) or not required_raw.issubset(raw) or any(not isinstance(raw[k], str) or not raw[k] or re.search(r"^###\s+Error\s*$", raw[k], re.M) for k in required_raw if isinstance(raw,dict) and k in raw):
        reasons.append("actual browser tool response evidence missing/failed")
    if not isinstance(browser.get("procEvidence"), dict) or not {"self", "browser", "renderer"}.issubset(browser["procEvidence"]):
        reasons.append("browser process observation fields missing")
    elif any(not isinstance(v,dict) or not isinstance(v.get("namespaces"),dict) or not isinstance(v.get("status"),str) or not isinstance(v.get("uid_map"),str) or not isinstance(v.get("gid_map"),str) for v in browser["procEvidence"].values()):
        reasons.append("browser process observation structure malformed")
    if not isinstance(browser.get("prelaunch"), dict) or not browser["prelaunch"]:
        reasons.append("browser prelaunch diagnostics missing")
    return reasons


def _inspect_reasons(insp, run_id, image, image_id, profile_path, profile_sha):
    if not isinstance(insp, dict):
        return ["docker inspect missing"]
    host, cfg, state = insp.get("HostConfig"), insp.get("Config"), insp.get("State")
    if not all(isinstance(x,dict) for x in (host,cfg,state)):
        return ["docker inspect config/state malformed"]
    reasons = []
    cid = insp.get("Id")
    if not _hex64_ok(cid) or insp.get("Name") != "/meri-browser-probe-" + run_id:
        reasons.append("docker container id/name mismatch")
    if not isinstance(cfg.get("Labels"),dict) or cfg["Labels"].get("meri.qualification.run") != run_id:
        reasons.append("docker label run mismatch")
    if image != PINNED_IMAGE or cfg.get("Image") != PINNED_IMAGE or not isinstance(image_id,str) or not SHA256_PREFIXED.fullmatch(image_id) or insp.get("Image") != image_id:
        reasons.append("immutable worker image/config imageID mismatch")
    if cfg.get("User") != "10001:10001" or cfg.get("Entrypoint") != ["node"] or cfg.get("Cmd") != [PROBE_CMD] or cfg.get("WorkingDir") != "/workspace/conversation":
        reasons.append("container user/entrypoint/command/cwd mismatch")
    env = cfg.get("Env")
    if not isinstance(env,list) or any(not isinstance(e,str) or "=" not in e for e in env):
        reasons.append("container environment malformed")
    else:
        pairs = [e.split("=",1) for e in env]
        values = dict(pairs)
        if len(values) != len(pairs) or any(k not in SAFE_IMAGE_ENV or SAFE_IMAGE_ENV[k] != v for k,v in pairs) or set(values) != set(SAFE_IMAGE_ENV):
            reasons.append("container environment differs from reviewed safe image ENV")
    if host.get("NetworkMode") != "none" or host.get("CapDrop") != ["ALL"] or host.get("CapAdd") not in (None,[]):
        reasons.append("container network/capabilities mismatch")
    secopts = host.get("SecurityOpt")
    if not isinstance(secopts,list) or len(secopts)!=2 or len([s for s in secopts if s in ("no-new-privileges","no-new-privileges=true")]) != 1:
        reasons.append("container NNP/security options mismatch")
    else:
        profiles=[s[8:] for s in secopts if isinstance(s,str) and s.startswith("seccomp=")]
        profile_ok = len(profiles)==1 and profiles[0] == EXPECTED_SECCOMP_PATH
        if len(profiles)==1 and profiles[0].startswith("{"):
            try:
                folder=os.path.dirname(os.path.abspath(__file__))
                path=os.path.join(folder,"seccomp.json")
                if not os.path.exists(path):path=os.path.join(folder,"seccomp.chromium-155-amd64.json")
                profile_ok = json.loads(profiles[0]) == json.loads(_bounded_text(path))
            except (OSError,ValueError):profile_ok=False
        if not profile_ok:reasons.append("container seccomp option differs from reviewed profile")
    if profile_path != EXPECTED_SECCOMP_PATH or profile_sha != EXPECTED_SECCOMP_SHA256:
        reasons.append("seccomp source path/hash mismatch")
    if host.get("ReadonlyRootfs") is not True or host.get("Privileged") is not False or host.get("PidMode") not in ("","private") or host.get("IpcMode") != "private":
        reasons.append("root/privilege/namespaces mismatch")
    for key,cap in RESOURCE_CAPS.items():
        if type(host.get(key)) is not int or not 0 < host[key] <= cap:reasons.append("resource bound invalid: "+key)
    if any(host.get(k) not in (None,[]) for k in ("Devices","DeviceRequests","VolumesFrom")):
        reasons.append("extra devices/volumes forbidden")
    if host.get("Binds") != [WORKSPACE_SOURCE+":/workspace:rw"] or host.get("Tmpfs") != {"/tmp":"rw,noexec,nosuid,size=512m"}:
        reasons.append("fresh workspace/tmp binding mismatch")
    mounts=insp.get("Mounts")
    seen=set()
    if not isinstance(mounts,list):reasons.append("mount list missing")
    else:
        for mount in mounts:
            if not isinstance(mount,dict):reasons.append("malformed mount");continue
            dest=mount.get("Destination")
            if dest in seen:reasons.append("duplicate mount")
            seen.add(dest)
            if dest=="/workspace":
                if mount.get("Source")!=WORKSPACE_SOURCE or mount.get("Type")!="bind" or mount.get("RW") is not True:reasons.append("workspace source/type/RW mismatch")
            elif dest in ("/tmp","/dev/shm"):
                if mount.get("Type")!="tmpfs" or mount.get("Source") not in (None,"") or mount.get("RW") is not True:reasons.append("unexpected runtime tmpfs")
            elif dest in ("/etc/hosts","/etc/hostname","/etc/resolv.conf"):
                if mount.get("RW") is not False or mount.get("Source")!="/var/lib/docker/containers/"+str(cid)+dest[4:]:reasons.append("unexpected runtime config mount")
            else:reasons.append("extra mount forbidden")
        if "/workspace" not in seen:reasons.append("workspace mount missing")
    if state.get("Running") is not False or type(state.get("ExitCode")) is not int or state["ExitCode"]!=0 or state.get("OOMKilled") is not False or state.get("Error")!="" or state.get("Status")!="exited":
        reasons.append("container final state is not clean stopped exit0")
    return reasons


def verify_run_record(record=None, expected=None):
    if not isinstance(record,dict):return {"ok":False,"reasons":["run record not an object"]}
    rec, exp, reasons=record, expected or {}, []
    run=exp.get("runId") or rec.get("runId")
    if not _uuid_ok(run):return {"ok":False,"reasons":["canonical run UUID required"]}
    if rec.get("runId")!=run:reasons.append("run mismatch")
    ctx={"run":run,"supportImage":rec.get("supportImage"),"workerImage":rec.get("workerImage"),"profileSha":rec.get("profile",{}).get("sha256") if isinstance(rec.get("profile"),dict) else None,"source":rec.get("source")}
    if not _context_ok(ctx,run):reasons.append("support/worker/profile/source context missing or malformed")
    if exp.get("supportImage") and rec.get("supportImage")!=exp["supportImage"]:reasons.append("support image differs from owner expected digest")
    try:
        if rec.get("source")!=source_manifest():reasons.append("actual source hashes/sizes mismatch")
    except (OSError,ValueError):reasons.append("actual source hashes unavailable")
    env=rec.get("observer")
    if not isinstance(env,dict):reasons.append("observer envelope missing")
    else:
        if env.get("runId")!=run or env.get("ok") is not True or env.get("bestOk") is not True or not isinstance(env.get("bestClassification"),dict) or env["bestClassification"].get("ok") is not True or env.get("unsafeClassification") is not None or env.get("incomplete"):
            reasons.append("observer envelope failed/incomplete/unsafe")
        best=env.get("bestObservation")
        if not isinstance(best,dict):reasons.append("full best observation missing")
        else:
            reasons.extend("best observation: "+r for r in classify(best,{"runId":run,"exeSha256":PINNED_BROWSER_SHA256})["reasons"])
            if not isinstance(rec.get("inspect"),dict) or best.get("containerId")!=rec["inspect"].get("Id"):reasons.append("observer/inspect container id mismatch")
    reasons.extend(_browser_payload_reasons(rec.get("browser")))
    profile=rec.get("profile") if isinstance(rec.get("profile"),dict) else {}
    reasons.extend(_inspect_reasons(rec.get("inspect"),run,rec.get("workerImage"),rec.get("imageID"),profile.get("path"),profile.get("sha256")))
    if type(rec.get("status")) is not int or rec["status"]!=0 or rec.get("exit")!="0":reasons.append("authoritative exit is not integer0/string0")
    stdout=rec.get("browserStdout")
    try:
        if not isinstance(stdout,str) or _strict_json(stdout)!=rec.get("browser"):reasons.append("full actual browser stdout JSON does not match browser record")
    except (ValueError,TypeError):reasons.append("browser stdout is not complete JSON")
    capture=rec.get("capture")
    if not isinstance(capture,dict) or capture.get("ok") is not True or type(capture.get("status")) is not int or capture.get("status")!=0 or capture.get("timedOut") is not False or capture.get("overflow") is not False or capture.get("error") is not None or capture.get("clientReaped") is not True:reasons.append("attach capture incomplete/unclean")
    joined=rec.get("observerJoin")
    if not isinstance(joined,dict) or joined.get("reaped") is not True or type(joined.get("status")) is not int or joined["status"]!=0 or joined.get("forced") is not False:reasons.append("observer join unconfirmed/forced/nonzero")
    versions=rec.get("versions")
    if not isinstance(versions,dict) or set(versions)!={"aws","docker","runc","containerd","libseccomp"} or versions.get("docker")!="25.0.16" or versions.get("libseccomp")!="2" or not str(versions.get("aws","")).startswith("2.") or any(not isinstance(v,str) or not re.fullmatch(r"[0-9.]+",v) for v in versions.values()):reasons.append("versions missing/unreviewed")
    if not isinstance(rec.get("preflight"),dict) or rec["preflight"].get("ok") is not True:reasons.append("preflight did not pass")
    if not isinstance(rec.get("pythonVersion"),str) or not re.fullmatch(r"3\.9\.[0-9]+",rec["pythonVersion"]):reasons.append("actual guest Python3.9 patch version missing/unreviewed")
    timer=rec.get("timer")
    if not isinstance(timer,dict) or timer_record(timer.get("active"),timer.get("target"),timer.get("next"),run,timer.get("uptime"))!=timer or timer.get("ok") is not True:reasons.append("existing timer active/schedule window facts missing")
    return {"ok":not reasons,"reasons":reasons}


def build_export_protocol(records, run_id, context=None, timestamp=None):
    if not _uuid_ok(run_id) or not _context_ok(context,run_id):return {"ok":False,"reason":"canonical run and complete context required"}
    if not isinstance(records,dict) or not records or len(records)>64 or any(not isinstance(n,str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}",n) for n in records):return {"ok":False,"reason":"bounded named records required"}
    stamp=int(time.time()*1000) if timestamp is None else timestamp
    if type(stamp) is not int or stamp<1:return {"ok":False,"reason":"positive integer millisecond timestamp required"}
    stream="host-"+run_id;events=[];entries=[];total=0
    for name in sorted(records):
        text=records[name] if isinstance(records[name],str) else _finite_json(records[name])
        if text is None:return {"ok":False,"reason":"nonfinite/malformed record"}
        raw=text.encode("utf-8");total+=len(raw)
        if total>EXPORT_TOTAL_RAW_MAX:return {"ok":False,"reason":"aggregate raw bytes exceed fixed bound"}
        chunks=[raw[i:i+EXPORT_CHUNK_RAW_MAX] for i in range(0,len(raw),EXPORT_CHUNK_RAW_MAX)] or [b""]
        entries.append({"name":name,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest(),"chunks":len(chunks)})
        for i,chunk in enumerate(chunks):
            doc={"kind":"chunk","run":run_id,"stream":stream,"record":name,"index":i,"count":len(chunks),"bytes":len(chunk),"sha256":hashlib.sha256(chunk).hexdigest(),"data":base64.b64encode(chunk).decode("ascii")}
            message=_finite_json(doc)
            if len(message.encode("utf-8"))>EXPORT_EVENT_MAX:return {"ok":False,"reason":"event exceeds fixed bound"}
            events.append({"timestamp":stamp,"message":message})
    manifest={"kind":"manifest","run":run_id,"stream":stream,"context":context,"records":entries,"count":len(entries),"totalRawBytes":total}
    msg=_finite_json(manifest)
    if msg is None or len(msg.encode("utf-8"))>EXPORT_EVENT_MAX:return {"ok":False,"reason":"manifest exceeds fixed bound"}
    end={"kind":"end","run":run_id,"stream":stream,"records":len(entries),"events":len(events)+2,"totalRawBytes":total,"manifestSha256":hashlib.sha256(msg.encode("utf-8")).hexdigest()}
    events.extend([{"timestamp":stamp,"message":msg},{"timestamp":stamp,"message":_finite_json(end)}])
    validated=validate_export(events,run_id,stream,context)
    if not validated["ok"]:return validated
    return {"ok":True,"run":run_id,"stream":stream,"events":events,"batches":validated["batches"],"manifest":manifest,"totalRawBytes":total,"calls":validated["calls"]}


def validate_export(events, expected_run=None, expected_stream=None, expected_context=None):
    def bad(reason):return {"ok":False,"reason":reason}
    if not isinstance(events,list) or not 3<=len(events)<=EXPORT_MAX_EVENTS:return bad("event count malformed/over fixed bound")
    parsed=[]
    shapes={"chunk":{"kind","run","stream","record","index","count","bytes","sha256","data"},"manifest":{"kind","run","stream","context","records","count","totalRawBytes"},"end":{"kind","run","stream","records","events","totalRawBytes","manifestSha256"}}
    for event in events:
        if not isinstance(event,dict) or set(event)-{"timestamp","message","ingestionTime","eventId","logStreamName"} or type(event.get("timestamp")) is not int or event["timestamp"]<1 or not isinstance(event.get("message"),str):return bad("event envelope malformed")
        message=event["message"]
        if len(message.encode("utf-8"))>EXPORT_EVENT_MAX:return bad("event exceeds fixed byte bound")
        try:doc=_strict_json(message)
        except (ValueError,TypeError):return bad("event JSON malformed")
        if not isinstance(doc,dict) or doc.get("kind") not in shapes or not _exact_keys(doc,shapes[doc["kind"]]) or _finite_json(doc) is None:return bad("event kind/fields malformed or nonfinite")
        parsed.append(doc)
    run=parsed[0]["run"];stream=parsed[0]["stream"]
    if not _uuid_ok(run) or stream!="host-"+run or expected_run not in (None,run) or expected_stream not in (None,stream) or any(d["run"]!=run or d["stream"]!=stream for d in parsed):return bad("run/stream binding mismatch")
    if any("logStreamName" in e and e["logStreamName"]!=stream for e in events):return bad("retrieval stream mismatch")
    if parsed[-2]["kind"]!="manifest" or parsed[-1]["kind"]!="end" or any(d["kind"]!="chunk" for d in parsed[:-2]):return bad("exact chunks/manifest/final-end sequence required")
    manifest,end=parsed[-2:]
    if not _context_ok(manifest["context"],run) or expected_context is not None and manifest["context"]!=expected_context:return bad("complete expected context mismatch")
    entries=manifest["records"]
    if not isinstance(entries,list) or not 1<=len(entries)<=64 or type(manifest["count"]) is not int or manifest["count"]!=len(entries):return bad("manifest count/records malformed")
    names=[];total=0;cursor=0;decoded={}
    for entry in entries:
        if not _exact_keys(entry,{"name","bytes","sha256","chunks"}) or not isinstance(entry["name"],str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}",entry["name"]) or entry["name"] in names or not _hex64_ok(entry["sha256"]) or type(entry["bytes"]) is not int or not 0<=entry["bytes"]<=EXPORT_TOTAL_RAW_MAX or type(entry["chunks"]) is not int or entry["chunks"]!=max(1,(entry["bytes"]+EXPORT_CHUNK_RAW_MAX-1)//EXPORT_CHUNK_RAW_MAX):return bad("manifest record malformed/duplicate")
        names.append(entry["name"]);parts=[]
        for i in range(entry["chunks"]):
            if cursor>=len(parsed)-2:return bad("missing chunk")
            doc=parsed[cursor];cursor+=1
            if doc["record"]!=entry["name"] or type(doc["index"]) is not int or doc["index"]!=i or type(doc["count"]) is not int or doc["count"]!=entry["chunks"] or type(doc["bytes"]) is not int or not _hex64_ok(doc["sha256"]) or not isinstance(doc["data"],str) or len(doc["data"])>EXPORT_CHUNK_B64_MAX:return bad("chunk sequence/count/fields mismatch")
            try:raw=base64.b64decode(doc["data"],validate=True)
            except (ValueError,TypeError):return bad("invalid base64")
            if base64.b64encode(raw).decode("ascii")!=doc["data"] or len(raw)>EXPORT_CHUNK_RAW_MAX or doc["bytes"]!=len(raw) or hashlib.sha256(raw).hexdigest()!=doc["sha256"]:return bad("chunk bytes/hash/base64 mismatch")
            parts.append(raw)
        raw=b"".join(parts)
        if len(raw)!=entry["bytes"] or hashlib.sha256(raw).hexdigest()!=entry["sha256"]:return bad("record reconstructed bytes/hash mismatch")
        try:decoded[entry["name"]]=raw.decode("utf-8","strict")
        except UnicodeError:return bad("record UTF8 malformed")
        total+=len(raw)
    if names!=sorted(names) or cursor!=len(parsed)-2:return bad("extra/reordered records")
    if type(manifest["totalRawBytes"]) is not int or manifest["totalRawBytes"]!=total or total>EXPORT_TOTAL_RAW_MAX or type(end["totalRawBytes"]) is not int or end["totalRawBytes"]!=total or type(end["records"]) is not int or end["records"]!=len(entries) or type(end["events"]) is not int or end["events"]!=len(parsed) or end["manifestSha256"]!=hashlib.sha256(_finite_json(manifest).encode("utf-8")).hexdigest():return bad("final end/count/hash/aggregate mismatch")
    batches=[];current=[];size=0
    for i,event in enumerate(events):
        amount=len(event["message"].encode("utf-8"))+EXPORT_EVENT_OVERHEAD
        if current and (len(current)>=EXPORT_BATCH_EVENTS or size+amount>EXPORT_BATCH_BYTES):batches.append(current);current=[];size=0
        current.append(i);size+=amount
    if current:batches.append(current)
    if len(batches)>EXPORT_MAX_CALLS:return bad("call count exceeds fixed bound")
    return {"ok":True,"run":run,"stream":stream,"context":manifest["context"],"records":len(entries),"totalRawBytes":total,"events":len(parsed),"calls":len(batches),"batches":batches,"reconstructed":decoded}


def classify_put_response(response):
    try:parsed=_strict_json(response) if isinstance(response,str) else response
    except (ValueError,TypeError):return {"ok":False,"reason":"malformed PutLogEvents JSON"}
    if not isinstance(parsed,dict) or set(parsed)-{"nextSequenceToken","rejectedLogEventsInfo","rejectedEntityInfo"}:return {"ok":False,"reason":"unknown/error PutLogEvents fields"}
    if "nextSequenceToken" in parsed and (not isinstance(parsed["nextSequenceToken"],str) or not parsed["nextSequenceToken"]):return {"ok":False,"reason":"malformed sequence token"}
    if "rejectedEntityInfo" in parsed:return {"ok":False,"reason":"entity rejection"}
    info=parsed.get("rejectedLogEventsInfo",{})
    if not isinstance(info,dict) or set(info)-{"tooNewLogEventStartIndex","tooOldLogEventEndIndex","expiredLogEventEndIndex"} or info:return {"ok":False,"reason":"malformed/rejected event indexes (including0)"}
    return {"ok":True}


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


def render_export_batches(plan, out_dir):
    if not isinstance(plan,dict) or plan.get("ok") is not True:raise ValueError("export plan failed")
    checked=validate_export(plan.get("events"),plan.get("run"),plan.get("stream"))
    if not checked["ok"] or plan.get("batches")!=checked["batches"] or plan.get("calls")!=checked["calls"]:raise ValueError("export plan not complete/canonical")
    os.mkdir(out_dir,0o700)
    for i,batch in enumerate(checked["batches"]):
        rows=[{"timestamp":plan["events"][j]["timestamp"],"message":plan["events"][j]["message"]} for j in batch]
        with open(os.path.join(out_dir,"batch-%03d.json"%i),"x",encoding="utf-8") as fh:fh.write(json.dumps(rows,ensure_ascii=False))
    return len(checked["batches"])


def _load_json(path, default=None):
    try:return _strict_json(_bounded_text(path,EXPORT_TOTAL_RAW_MAX*3))
    except (OSError,ValueError,UnicodeError):return default


def _dump(obj, path=None):
    text=json.dumps(obj,indent=2,allow_nan=False)
    print(text)
    if path:_atomic_write(path,text+"\n")
    return 0 if obj.get("ok",True) else 3


def capture_browser(container_id, evidence_dir, deadline_s=120, popen=None, selector_factory=None, clock=None):
    """One attach/start of an already-owned container. Linux only in production.
    Bound both pipes while reading; kill/reap the client group on all error paths.
    The outer bootstrap separately stops and inspects the owned container."""
    if not _hex64_ok(container_id) or type(deadline_s) is not int or not 1<=deadline_s<=120:raise ValueError("capture requires owned64ID and bounded deadline")
    popen=popen or subprocess.Popen;selector_factory=selector_factory or selectors.DefaultSelector;clock=clock or time.monotonic
    proc=None;data={"stdout":bytearray(),"stderr":bytearray()};timed=False;overflow=False;error=None;reaped=False;rc=None
    end=clock()+deadline_s
    try:
        proc=popen(["docker","start","--attach",container_id],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,bufsize=0)
        with selector_factory() as sel:
            sel.register(proc.stdout,selectors.EVENT_READ,"stdout");sel.register(proc.stderr,selectors.EVENT_READ,"stderr")
            active=2
            while active:
                if _CANCEL["flag"]:error="cancelled";break
                remaining=end-clock()
                if remaining<=0:timed=True;break
                ready=sel.select(min(remaining,.1))
                for key,_mask in ready:
                    chunk=os.read(key.fileobj.fileno(),min(65536,CAPTURE_FILE_MAX-sum(map(len,data.values()))+1))
                    if not chunk:sel.unregister(key.fileobj);active-=1;continue
                    if sum(map(len,data.values()))+len(chunk)>CAPTURE_FILE_MAX:overflow=True;break
                    data[key.data].extend(chunk)
                if overflow:break
            if not timed and not overflow and error is None:
                left=end-clock();timed=left<=0
                rc=proc.wait(timeout=max(.001,left));reaped=True
                timed=timed or clock()>=end
    except (OSError,ValueError,subprocess.SubprocessError) as exc:error=type(exc).__name__
    finally:
        if proc is not None:
            if not reaped:
                try:
                    if process_platform_linux() and type(proc.pid) is int and proc.pid>1:os.killpg(proc.pid,signal.SIGKILL)
                    else:proc.kill()
                except OSError:pass
                try:rc=proc.wait(timeout=1);reaped=True
                except subprocess.SubprocessError:pass
            for stream in (proc.stdout,proc.stderr):
                try:stream.close()
                except (OSError,AttributeError):pass
    for name,raw in data.items():
        with open(os.path.join(evidence_dir,"browser."+name),"xb") as fh:fh.write(raw)
    return {"ok":rc==0 and not timed and not overflow and error is None and reaped,"status":rc,"timedOut":timed,"overflow":overflow,"error":error,"clientReaped":reaped,"stdoutBytes":len(data["stdout"]),"stderrBytes":len(data["stderr"])}


def process_platform_linux():
    return sys.platform.startswith("linux")


def assemble_run_record(evidence_dir, run_id, status, assets_image=None, worker_image=None,
                        profile_path=EXPECTED_SECCOMP_PATH, profile_sha=EXPECTED_SECCOMP_SHA256):
    def load(name,default=None):return _load_json(os.path.join(evidence_dir,name),default)
    def read(name):
        try:return _bounded_text(os.path.join(evidence_dir,name))
        except OSError:return ""
    stdout=read("browser.stdout");browser=None
    try:browser=_strict_json(stdout)
    except (ValueError,TypeError):pass
    insp=load("container-inspect.json")
    if isinstance(insp,list):insp=insp[0] if len(insp)==1 else None
    return {"runId":run_id,"status":status,"supportImage":assets_image,"workerImage":worker_image or PINNED_IMAGE,
            "profile":{"path":profile_path,"sha256":profile_sha},"source":source_manifest(),
            "observer":load("host-evidence.json",{}),"browser":browser,"inspect":insp,
            "imageID":insp.get("Image") if isinstance(insp,dict) else None,"exit":read("authoritative-exit").strip(),
            "versions":load("versions.json"),"pythonVersion":".".join(str(n) for n in sys.version_info[:3]),"preflight":load("preflight.json"),"timer":load("timer.json"),
            "browserStdout":stdout,"browserStderr":read("browser.stderr"),"capture":load("capture.json"),"observerJoin":load("observer-join.json")}


def assemble_export_records(record, run_id, context=None):
    records={name:record.get(key) for name,key in (("observer","observer"),("browser","browser"),("inspect","inspect"),("versions","versions"),("preflight","preflight"),("browserStdout","browserStdout"),("browserStderr","browserStderr"),("capture","capture"),("observerJoin","observerJoin"),("exit","exit"),("timer","timer"))}
    records["run-record"]=record
    ctx={"run":run_id,"supportImage":record.get("supportImage"),"workerImage":record.get("workerImage"),"profileSha":record.get("profile",{}).get("sha256"),"source":record.get("source")}
    if context is not None and context!=ctx:raise ValueError("caller context disagrees with run record")
    return {"records":records,"runId":run_id,"context":ctx}


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


if __name__ == "__main__":
    sys.exit(main())
