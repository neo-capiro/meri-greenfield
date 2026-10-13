"""Finite local check capture; exact commands, pins, raw bytes, exit and reaped process evidence."""
import ctypes, datetime, gzip, hashlib, json, os, pathlib, re, signal, subprocess, sys, time

here = pathlib.Path(__file__).resolve().parent
root = here.parents[4]
label, *command = sys.argv[1:]
assert re.fullmatch(r'[a-z0-9-]+', label) and command
assert not (here / (label + '.json')).exists(), 'Never overwrite a check receipt'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
pin = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
tree = subprocess.check_output(['git', 'rev-parse', 'HEAD^{tree}'], cwd=root, text=True).strip()
# This finite verification parent adopts its own orphaned grandchildren so build
# helpers can be reaped here rather than becoming zombies under the host's PID1.
subreaper = ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) == 0
process = subprocess.Popen(command, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
t = time.monotonic()
timed_out = False
try:
    out, err = process.communicate(timeout=180)
except subprocess.TimeoutExpired:
    timed_out = True
    os.killpg(process.pid, signal.SIGTERM)
    try:
        out, err = process.communicate(timeout=2)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        out, err = process.communicate()
reaped_descendants = []
cleanup_cutoff = time.monotonic() + 2
while True:
    if subreaper:
        while True:
            try:
                child, status = os.waitpid(-1, os.WNOHANG)
            except ChildProcessError:
                break
            if child == 0:
                break
            reaped_descendants.append({'pid': child, 'waitStatus': status})
    try:
        os.killpg(process.pid, 0)
        group_absent = False
    except ProcessLookupError:
        group_absent = True
    if group_absent or time.monotonic() >= cleanup_cutoff:
        break
    time.sleep(0.02)
blobs = {}
for suffix, raw in [('stdout', out), ('stderr', err)]:
    path = here / (label + '.' + suffix + '.gz')
    path.write_bytes(gzip.compress(raw, mtime=0))
    blobs[suffix] = {'path': path.name, 'rawBytes': len(raw), 'rawSha256': hashlib.sha256(raw).hexdigest()}
text = out.decode('utf8', errors='replace')
counts = {key: int(values[-1]) for key in ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'] if (values := re.findall(r'^# ' + key + r' (\d+)$', text, re.M))}
record = {'schema': 'meri.local-check-capture/1', 'commit': pin, 'tree': tree, 'command': command, 'startedAt': started, 'seconds': time.monotonic() - t, 'exitCode': process.returncode, 'timedOut': timed_out, 'counts': counts, 'blobs': blobs, 'ownedProcessId': process.pid, 'processReaped': process.poll() is not None, 'ownedProcessGroupAbsent': group_absent, 'finiteParentSubreaper': subreaper, 'reapedDescendants': reaped_descendants}
(here / (label + '.json')).write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record))
sys.exit(1 if timed_out or not group_absent else process.returncode)
