"""Bounded local checks with raw streams and exact owned process accounting."""
import ctypes
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

directory = Path(__file__).resolve().parent
label, *command = sys.argv[1:]
libc = ctypes.CDLL(None, use_errno=True)
if libc.prctl(36, 1, 0, 0, 0) != 0:
    raise OSError(ctypes.get_errno(), 'SUBREAPER_FAILED')
started = time.time()
with (directory / f'{label}.stdout.txt').open('wb') as out, (directory / f'{label}.stderr.txt').open('wb') as err:
    process = subprocess.Popen(command, stdout=out, stderr=err, start_new_session=True)
    timed_out = False
    try:
        code = process.wait(timeout=30)
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(process.pid, signal.SIGTERM)
        try:
            code = process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            code = process.wait(timeout=3)
reaped = []
for _ in range(50):
    try:
        child, status = os.waitpid(-1, os.WNOHANG)
        if child:
            reaped.append({'pid': child, 'status': status})
            continue
        time.sleep(0.01)
    except ChildProcessError:
        break
try:
    os.killpg(process.pid, 0)
    absent = False
except ProcessLookupError:
    absent = True
receipt = {'command': command, 'cwd': os.getcwd(), 'startUnixSeconds': started,
           'elapsedSeconds': time.time() - started, 'exitCode': code,
           'ownedPidAndGroup': process.pid, 'externalTimeout': timed_out,
           'ownedProcessGroupAbsent': absent, 'reapedDescendants': reaped, 'streams': {}}
for name in ['stdout', 'stderr']:
    path = directory / f'{label}.{name}.txt'
    data = path.read_bytes()
    receipt['streams'][name] = {'path': path.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
(directory / f'{label}.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
sys.exit(code if code >= 0 else 1)
