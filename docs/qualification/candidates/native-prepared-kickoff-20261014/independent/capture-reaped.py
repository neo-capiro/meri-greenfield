"""Owned local source-check capture with Linux descendant reaping; no network API."""
import ctypes
import datetime
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[5]
evidence = Path(__file__).resolve().parent
label, *command = sys.argv[1:]
if not command or not label.replace('-', '').isalnum():
    raise SystemExit('label and command required')
if sys.platform != 'linux' or ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
    raise SystemExit('Linux child subreaper required before process allocation')
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
diff = subprocess.check_output(['git', 'diff', 'HEAD', '--', 'apps', 'packages', 'scripts', 'package.json', 'package-lock.json'], cwd=root)
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
clock = time.monotonic()
reaped = []
# This fresh Python process owns only the command below and kernel-adopted
# descendants. Reap them while the command runs, including detached native
# groups; waiting for Node first would prevent its group-absence proof.
observed_children = {}
def reap_owned(child):
    while True:
        try:
            # WNOWAIT exposes only an OWNED exited child before reaping, so its
            # kernel parent/group can be recorded without scanning other PIDs.
            observed = os.waitid(os.P_ALL, 0, os.WEXITED | os.WNOHANG | os.WNOWAIT)
            if observed is None:
                return True  # At least one owned child remains alive.
            stat = Path(f'/proc/{observed.si_pid}/stat').read_text()
            fields = stat[stat.rfind(')') + 2:].split()
            if int(fields[1]) != os.getpid():
                raise RuntimeError('Adopted child parent changed')
            observed_children[observed.si_pid] = {'parentPid': os.getpid(), 'processGroup': int(fields[2]), 'birthTicks': fields[19]}
            pid, status = os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
            return False  # Kernel proves this owner has no remaining children.
        if pid == 0:
            return True
        # waitpid(-1) can return only a child owned by THIS fresh process.
        proof = {'kernelWaitpidChildOf': os.getpid(), **observed_children.get(pid, {})}
        if pid == child.pid:
            child.returncode = os.waitstatus_to_exitcode(status)
        else:
            reaped.append({'pid': pid, 'status': status, **proof})
with (evidence / f'{label}.stdout.bin').open('xb') as stdout, (evidence / f'{label}.stderr.bin').open('xb') as stderr:
    child = subprocess.Popen(command, cwd=root, stdout=stdout, stderr=stderr, start_new_session=True)
    timed_out = False
    deadline = time.monotonic() + 600
    while child.returncode is None:
        adopted_absent = not reap_owned(child)
        if child.returncode is not None:
            break
        if time.monotonic() >= deadline:
            timed_out = True
            os.killpg(child.pid, signal.SIGKILL)
            break
        time.sleep(0.01)
    if child.returncode is None:
        stop_deadline = time.monotonic() + 5
        while child.returncode is None and time.monotonic() < stop_deadline:
            reap_owned(child)
            time.sleep(0.01)
    if child.returncode is None:
        raise RuntimeError('Owned command termination unknown')
    code = child.returncode
    cleanup_end = time.monotonic() + 5
    killed = False
    absent = False
    adopted_absent = False
    while time.monotonic() < cleanup_end:
        adopted_absent = not reap_owned(child)
        try:
            os.killpg(child.pid, 0)
        except ProcessLookupError:
            absent = True
        if absent and adopted_absent:
            break
        if not absent and not killed:
            os.killpg(child.pid, signal.SIGKILL)
            killed = True
        time.sleep(0.01)
records = []
for stream in ['stdout', 'stderr']:
    path = evidence / f'{label}.{stream}.bin'
    data = path.read_bytes()
    records.append({'path': path.relative_to(root).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
receipt = {'command': command, 'cwd': str(root), 'sourceHead': head,
           'sourceDiffSha256': hashlib.sha256(diff).hexdigest(), 'sourceDiffBytes': len(diff),
           'captureSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
           'startedAt': started, 'durationSeconds': round(time.monotonic() - clock, 3),
           'exitCode': code, 'timedOut': timed_out, 'ownedPidAndPgid': child.pid,
           'ownedProcessGroupAbsent': absent, 'ownedGroupKillRequired': killed,
           'ownedAdoptedChildrenAbsent': adopted_absent,
           'reapedDescendants': reaped, 'streams': records,
           'rerunReason': os.environ.get('MERI_CHECK_REASON', 'Baseline or newly changed source check; raw result preserved.'),
           'scope': 'TASK_OWNED_QUALIFICATION_HOST_INIT_REAPING_NOT_PRODUCTION_ISOLATION_OR_RUNTIME_ADMISSION'}
(evidence / f'{label}.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
print((evidence / f'{label}.stdout.bin').read_text(errors='replace')[-350:])
raise SystemExit(0 if code == 0 and absent and adopted_absent and not timed_out else 1)
