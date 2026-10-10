"""W02-17 collector extraction: bounded real collector (verbatim bodies).

Owns the ONE shared `_CANCEL` and ONE `_EXE_HASH_CACHE` dicts. Bounded,
fake-injectable root/runner; no import-time host IO.
"""
import hashlib
import json
import os
import re
import selectors
import subprocess
import time

from .classification import (
    _cgroup_matches,
    _hex64_ok,
    _in_root,
    _pos_int,
    _uuid_ok,
)
from .config import (
    MAX_COMMAND_BYTES,
    MAX_EXE_BYTES,
    MAX_FIELD,
    MAX_OBSERVATION_BYTES,
    MAX_PIDS,
    MAX_POLL_SECONDS,
    MAX_THREADS,
    NS_KEYS,
    PINNED_BROWSER_SHA256,
)
from .evidence_io import _read

_CANCEL = {"flag": False}
_EXE_HASH_CACHE = {}

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
