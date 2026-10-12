import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[1]
evidence = root / 'docs/qualification/candidates/sessionstore-consolidation-20261011'
evidence.mkdir(parents=True, exist_ok=True)
scratch = root / '.task-inputs/check-tmp'
scratch.mkdir(exist_ok=True)
node = Path('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node')
native = root / 'apps/worker/qualification/checkpoint/native-session-files.mjs'
candidate = native.read_bytes()
env = {key: value for key, value in os.environ.items() if key in ['PATH', 'LANG', 'LC_ALL', 'SYSTEMROOT', 'SystemRoot']}
env.update({'TMPDIR': str(scratch), 'GIT_NO_LAZY_FETCH': '1', 'NODE_ENV': 'test'})

def check(label, args, cwd, timeout=90):
    out = evidence / (label + '.stdout.bin')
    err = evidence / (label + '.stderr.bin')
    started = time.time()
    timed_out = False
    with out.open('xb') as stdout, err.open('xb') as stderr:
        process = subprocess.Popen([str(node), *args], cwd=cwd, env=env,
                                   stdout=stdout, stderr=stderr, start_new_session=True)
        try:
            code = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(process.pid, signal.SIGKILL)
            code = process.wait(timeout=10)
    try:
        os.killpg(process.pid, 0)
        absent = False
    except ProcessLookupError:
        absent = True
    record = {'argv': [str(node), *args], 'cwd': str(cwd), 'startedAtEpochSeconds': started,
              'endedAtEpochSeconds': time.time(), 'timeoutSeconds': timeout, 'timedOut': timed_out,
              'exitCode': code, 'ownedProcessGroupAbsent': absent,
              'runtime': {'version': '24.19.0', 'sha256': hashlib.sha256(node.read_bytes()).hexdigest()},
              'nativeCaptureSha256': hashlib.sha256(native.read_bytes()).hexdigest(),
              'temporaryRoot': str(scratch), 'networkIsolation': 'not an OS network sandbox',
              'stdout': {'bytes': out.stat().st_size, 'sha256': hashlib.sha256(out.read_bytes()).hexdigest()},
              'stderr': {'bytes': err.stat().st_size, 'sha256': hashlib.sha256(err.read_bytes()).hexdigest()}}
    (evidence / (label + '.json')).write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps({'label': label, 'exitCode': code, 'bytes': record['stdout']['bytes'], 'groupAbsent': absent}))
    if timed_out or not absent:
        raise RuntimeError('owned check process cleanup not proved')
    return code

if len(sys.argv) > 1:
    raise SystemExit(check(sys.argv[1], sys.argv[2:], root, 120))

worker = root / 'apps/worker/qualification'
try:
    original = subprocess.check_output(['git', 'show', 'a5c41c7afdd9ec235ac3a0184a96e4c457ef2f90:apps/worker/qualification/checkpoint/native-session-files.mjs'], cwd=root, env=env)
    native.write_bytes(original)
    baseline = check('borrowed-parent-original-control', ['--test', '--test-name-pattern=unrelated sibling creation',
                     'checkpoint/native-capture-boundaries.test.mjs'], worker)
finally:
    native.write_bytes(candidate)

focused = check('focused-source', ['--test', 'probes/static.test.mjs', 'checkpoint/native-session-files.test.mjs',
                    'checkpoint/native-capture-boundaries.test.mjs', 'checkpoint/session-store.test.mjs'], worker)
sdk_args = json.loads((root / 'package.json').read_text())['scripts']['check:sdk-evidence'].split()[1:]
integrated = check('existing-sdk-evidence', sdk_args, root, 120)
(evidence / 'check-summary.json').write_text(json.dumps({'originalPositiveControl': baseline,
    'focusedSource': focused, 'existingSdkEvidence': integrated,
    'candidateSourceRestored': native.read_bytes() == candidate,
    'temporaryRootEmptyAfterChecks': not any(scratch.iterdir()),
    'sourceOnly': True, 'g1Accepted': False, 'sessionStoreQualified': False,
    'completeRecoveryCheckpoint': False}, indent=2) + '\n')
if baseline != 1 or focused != 0 or integrated != 0:
    raise SystemExit(1)
