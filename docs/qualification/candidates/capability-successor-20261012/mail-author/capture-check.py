"""Capture an owned ordinary source check with finite process-group cleanup."""
import hashlib, json, os, pathlib, signal, subprocess, sys, time
out = pathlib.Path(sys.argv[1]); argv = sys.argv[2:]; started = time.monotonic()
with out.with_suffix('.stdout').open('wb') as stdout, out.with_suffix('.stderr').open('wb') as stderr:
    child = subprocess.Popen(argv, stdout=stdout, stderr=stderr, start_new_session=True)
    timed_out = False
    try:
        code = child.wait(timeout=45)
    except subprocess.TimeoutExpired:
        timed_out = True; os.killpg(child.pid, signal.SIGKILL); code = child.wait(timeout=5)
streams = {}
for name in ['stdout', 'stderr']:
    raw = out.with_suffix('.'+name).read_bytes()
    streams[name] = {'path': str(out.with_suffix('.'+name)), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
receipt = {'argv': argv, 'cwd': os.getcwd(), 'exitCode': code, 'timedOut': timed_out,
           'elapsedSeconds': time.monotonic()-started, 'reaped': child.poll() is not None, 'streams': streams}
out.with_suffix('.json').write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps(receipt)); raise SystemExit(code if code >= 0 else 1)
