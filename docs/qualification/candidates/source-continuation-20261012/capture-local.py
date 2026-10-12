import datetime
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

root = Path('/workspace/meri-source-continuation-20261012')
evidence = root / 'docs/qualification/candidates/source-continuation-20261012'
label, *command = sys.argv[1:]
if not command or not label.replace('-', '').isalnum():
    raise SystemExit('label and command required')
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
diff = subprocess.check_output(['git', 'diff', 'HEAD', '--', 'apps', 'packages', 'scripts', 'package.json', 'package-lock.json'], cwd=root)
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
clock = time.monotonic()
with (evidence / f'{label}.stdout.bin').open('xb') as stdout, (evidence / f'{label}.stderr.bin').open('xb') as stderr:
    child = subprocess.Popen(command, cwd=root, stdout=stdout, stderr=stderr, start_new_session=True)
    timed_out = False
    try:
        code = child.wait(timeout=240)
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(child.pid, signal.SIGTERM)
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait()
        code = child.returncode
    finally:
        try:
            os.killpg(child.pid, 0)
        except ProcessLookupError:
            group_absent = True
        else:
            group_absent = False
            os.killpg(child.pid, signal.SIGKILL)
    stdout.flush()
    stderr.flush()
records = []
for stream in ['stdout', 'stderr']:
    path = evidence / f'{label}.{stream}.bin'
    data = path.read_bytes()
    records.append({'path': path.relative_to(root).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
receipt = {'command': command, 'cwd': str(root), 'sourceHead': head,
           'sourceDiffSha256': hashlib.sha256(diff).hexdigest(), 'sourceDiffBytes': len(diff),
           'startedAt': started, 'durationSeconds': round(time.monotonic() - clock, 3),
           'exitCode': code, 'timedOut': timed_out, 'ownedProcessGroupAbsentAfterExit': group_absent,
           'streams': records, 'scope': 'LOCAL_SOURCE_ONLY_NOT_RUNTIME_ADMISSION'}
(evidence / f'{label}.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
print((evidence / f'{label}.stdout.bin').read_text(errors='replace')[-700:])
print((evidence / f'{label}.stderr.bin').read_text(errors='replace')[-700:])
raise SystemExit(code if code >= 0 else 1)
