"""Bounded source-only process capture, retaining stdout/stderr and result identity."""
import hashlib
import json
import os
import pathlib
import signal
import subprocess
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
WORKTREE = pathlib.Path('/workspace/meri-n209-source-review')
label = sys.argv[1]
argv = sys.argv[2:]
started = time.time()
proc = subprocess.Popen(argv, cwd=WORKTREE, stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE, start_new_session=True,
                        env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1',
                             'MERI_REVIEW_SOURCE_ROOT': str(WORKTREE)})
timeout = False
try:
    out, err = proc.communicate(timeout=240)
except subprocess.TimeoutExpired:
    timeout = True
    os.killpg(proc.pid, signal.SIGKILL)
    out, err = proc.communicate(timeout=10)
record = {
    'label': label, 'argv': argv, 'cwd': str(WORKTREE),
    'reviewedCommit': subprocess.check_output(
        ['git', 'rev-parse', 'HEAD'], cwd=WORKTREE).decode().strip(),
    'timeoutSeconds': 240, 'timedOut': timeout, 'returncode': proc.returncode,
    'taskEnvironment': {'PYTHONDONTWRITEBYTECODE': '1',
                        'MERI_REVIEW_SOURCE_ROOT': str(WORKTREE)},
    'durationSeconds': round(time.time()-started, 3),
    'processReaped': proc.poll() is not None,
    'stdoutBytes': len(out), 'stderrBytes': len(err),
    'stdoutSha256': hashlib.sha256(out).hexdigest(),
    'stderrSha256': hashlib.sha256(err).hexdigest(),
    'evidenceKind': 'local-source-only-process', 'nativeRuntimeAcceptance': False,
}
(HERE / f'{label}.stdout.txt').write_bytes(out)
(HERE / f'{label}.stderr.txt').write_bytes(err)
(HERE / f'{label}.json').write_text(json.dumps(record, indent=2)+'\n')
print(json.dumps(record))
raise SystemExit(0 if proc.returncode == 0 and not timeout else 1)
