"""W02-20 run admission: sandbox rows, timer window, browser/inspect reasons.

Bodies moved verbatim from the entry; _inspect_reasons carries the ONE permitted
value-node change (the reviewed seccomp profile is read from the canonical
_source_root()). Admission resolves the imported source_manifest/_context_ok
callers on this module. Import is inert.
"""
import hashlib
import json
import math
import os
import re

from .classification import _hex64_ok, _pos_int, _uuid_ok, classify
from .config import (
    BROWSER_VERSION, DISABLING_FLAGS, EXPECTED_SECCOMP_PATH, EXPECTED_SECCOMP_SHA256,
    MAX_PIDS, PINNED_BROWSER_EXE, PINNED_BROWSER_SHA256, PINNED_IMAGE,
    PINNED_WORKER_CONFIG_ID, PINNED_WORKER_KIND, PINNED_WORKER_REVISION, PROBE_CMD,
    REQUIRED_SUBSTEPS, RESOURCE_CAPS, SAFE_IMAGE_ENV, WORKSPACE_SOURCE,
)
from .evidence_io import _bounded_text, _read, _strict_json
from .source_binding import _context_ok, _source_root, source_manifest

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
    elif cfg["Labels"].get("org.opencontainers.image.revision") != PINNED_WORKER_REVISION:
        reasons.append("worker OCI source revision label mismatch")
    elif cfg["Labels"].get("meri.qualification.kind") != PINNED_WORKER_KIND:
        reasons.append("worker qualification kind label mismatch")
    if image != PINNED_IMAGE or cfg.get("Image") != PINNED_IMAGE:
        reasons.append("immutable worker image reference mismatch")
    # record.imageID (the assembled record) and inspect.Image (the daemon's image
    # config ID) must EACH independently equal the accepted configuration ID. A
    # record and inspect that agree on the same substituted IID are still rejected.
    if image_id != PINNED_WORKER_CONFIG_ID or insp.get("Image") != PINNED_WORKER_CONFIG_ID:
        reasons.append("worker image configuration IID mismatch")
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
                folder=_source_root()
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
