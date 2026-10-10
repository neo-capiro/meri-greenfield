"""W02-20 browser capture: one bounded attach/start plus run-record assembly.

capture_browser and assemble_run_record moved verbatim; process_platform_linux
stays the single production host-IO placement check so callers/tests can route
the platform patch to THIS module. _CANCEL is the collection-owned dict imported,
never copied. Import is inert: no signals, subprocess or filesystem IO at import.
"""
import os
import selectors
import signal
import subprocess
import sys
import time

from .classification import _hex64_ok
from .collection import _CANCEL
from .config import CAPTURE_FILE_MAX, EXPECTED_SECCOMP_PATH, EXPECTED_SECCOMP_SHA256, PINNED_IMAGE
from .evidence_io import _bounded_text, _load_json, _strict_json
from .source_binding import source_manifest

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
