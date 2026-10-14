"""Run one command under a Linux child subreaper so orphaned grandchildren are reaped.

The existing per-check capture (apps/runtime/evidence/capture-reaped.py) writes receipts into the
repository evidence directory; this wrapper writes nothing and only forwards the exit code.
Usage: python3 -I subreaper.py -- <command...>   Exit: the command's exit code; 2 usage; 3 unsupported host.
"""
import ctypes, os, signal, subprocess, sys, time

def reap():
    while True:
        try:
            pid, _ = os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
            return
        if pid == 0:
            return

def main(argv):
    if argv[:1] == ['--']:
        argv = argv[1:]
    if not argv:
        print('usage: subreaper.py -- <command...>', file=sys.stderr)
        return 2
    if sys.platform != 'linux' or ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
        print('Linux child subreaper unavailable', file=sys.stderr)
        return 3
    signal.signal(signal.SIGCHLD, lambda *_: None)
    child = subprocess.Popen(argv, start_new_session=True)
    while True:
        try:
            code = child.wait(timeout=0.2)
            break
        except subprocess.TimeoutExpired:
            reap()
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        reap()
        try:
            os.killpg(child.pid, 0)
        except ProcessLookupError:
            break
        time.sleep(0.05)
    return code

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
