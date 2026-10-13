"""Capture one owned local verification process, bounded at 180 seconds.

Usage: python3 capture.py LABEL COMMAND [ARGS...]. Exit 0 pass; 1 check/cleanup failure.
Runs as Linux child subreaper; records/reaps only its own children and descendants.
"""
import ctypes
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
label, *command = sys.argv[1:]
assert command and label.replace('-', '').isalnum()
assert sys.platform == 'linux'
assert ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) == 0
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
diff = subprocess.check_output(['git', 'diff', 'HEAD', '--', 'apps', 'packages', 'scripts'], cwd=ROOT)
clock = time.monotonic()
started = datetime.now(timezone.utc).isoformat()
stdout_path, stderr_path = [HERE / f'{label}.{stream}.txt' for stream in ['stdout', 'stderr']]
with stdout_path.open('xb') as stdout, stderr_path.open('xb') as stderr:
    child = subprocess.Popen(command, cwd=ROOT, stdout=stdout, stderr=stderr, start_new_session=True)
    timed_out = False
    try:
        code = child.wait(timeout=180)
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(child.pid, signal.SIGKILL)
        code = child.wait(timeout=5)
    reaped = []
    descendants = []
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        try:
            pid, status = os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
            break
        if pid:
            reaped.append({'pid': pid, 'waitStatus': status})
            continue
        # Any reparented live process is ours; this fresh wrapper has no other children.
        for entry in Path('/proc').iterdir():
            if not entry.name.isdigit():
                continue
            try:
                rest = (entry / 'stat').read_text().split(') ', 1)[1].split()
                if int(rest[1]) == os.getpid():
                    pid = int(entry.name)
                    descendants.append({'pid': pid, 'state': rest[0], 'group': int(rest[2])})
                    os.kill(pid, signal.SIGKILL)
            except (FileNotFoundError, ProcessLookupError, PermissionError):
                continue
        time.sleep(0.01)
remaining = []
for entry in Path('/proc').iterdir():
    if not entry.name.isdigit():
        continue
    try:
        rest = (entry / 'stat').read_text().split(') ', 1)[1].split()
        if int(rest[1]) == os.getpid():
            remaining.append({'pid': int(entry.name), 'state': rest[0], 'group': int(rest[2])})
    except FileNotFoundError:
        pass
try:
    os.killpg(child.pid, 0)
    group_absent = False
except ProcessLookupError:
    group_absent = True
streams = []
for path in [stdout_path, stderr_path]:
    raw = path.read_bytes()
    streams.append({'path': str(path.relative_to(ROOT)), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
receipt = {'argv': command, 'cwd': str(ROOT), 'reviewedCommit': head, 'implementationDiffBytes': len(diff),
           'startedAt': started, 'durationSeconds': round(time.monotonic() - clock, 3), 'timeoutSeconds': 180,
           'exitCode': code, 'timedOut': timed_out, 'ownedPidAndPgid': child.pid, 'ownedGroupAbsent': group_absent,
           'reapedDescendants': reaped, 'cleanupKills': descendants, 'remainingOwnedChildren': remaining,
           'streams': streams, 'scope': 'LOCAL_SYNTHETIC_SOURCE_QUALIFICATION_ONLY', 'nativeQualified': False}
(HERE / f'{label}.receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
raise SystemExit(0 if code == 0 and group_absent and not remaining and not timed_out else 1)
