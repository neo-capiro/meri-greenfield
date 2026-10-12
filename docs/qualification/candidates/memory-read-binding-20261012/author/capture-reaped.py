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
with (evidence / f'{label}.stdout.bin').open('xb') as stdout, (evidence / f'{label}.stderr.bin').open('xb') as stderr:
    child = subprocess.Popen(command, cwd=root, stdout=stdout, stderr=stderr, start_new_session=True)
    timed_out = False
    try:
        code = child.wait(timeout=240)
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(child.pid, signal.SIGKILL)
        code = child.wait(timeout=5)
    # Reap only this owned group; a reparented zombie still makes killpg(0) succeed.
    cleanup_end = time.monotonic() + 5
    killed = False
    absent = False
    while time.monotonic() < cleanup_end:
        while True:
            try:
                pid, status = os.waitpid(-child.pid, os.WNOHANG)
            except ChildProcessError:
                break
            if pid == 0:
                break
            reaped.append({'pid': pid, 'status': status})
        try:
            os.killpg(child.pid, 0)
        except ProcessLookupError:
            absent = True
            break
        if not killed:
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
           'reapedDescendants': reaped, 'streams': records,
           'rerunReason': 'Bounded source binding check; immutable label records this attempt separately.',
           'scope': 'LOCAL_SOURCE_ONLY_NOT_RUNTIME_ADMISSION'}
(evidence / f'{label}.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
print((evidence / f'{label}.stdout.bin').read_text(errors='replace')[-350:])
raise SystemExit(0 if code == 0 and absent and not timed_out else 1)
