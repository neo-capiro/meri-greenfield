"""Bounded local-only check capture; command arrays, raw streams, physical exit."""
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
try:
    os.killpg(process.pid, 0)
    group_absent = False
except ProcessLookupError:
    group_absent = True
receipt = {'command': command, 'cwd': os.getcwd(), 'startUnixSeconds': started,
           'elapsedSeconds': time.time() - started, 'exitCode': code,
           'externalTimeout': timed_out, 'ownedProcessGroupAbsent': group_absent,
           'fixtureRoot': os.environ.get('GATEWAY_FIXTURE_ROOT'), 'streams': {}}
for stream in ['stdout', 'stderr']:
    path = directory / f'{label}.{stream}.txt'
    data = path.read_bytes()
    receipt['streams'][stream] = {'path': path.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
(directory / f'{label}.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
sys.exit(code if code >= 0 else 1)
