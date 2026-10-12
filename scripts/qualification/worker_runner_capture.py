"""Read-only Windows runner observations. No AWS requests or build authority."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

if __name__ == '__main__':
    sys.path.insert(0, str(Path(__file__).resolve().parent))

import worker_image_build as builder
import worker_build_binding as binding
import worker_runner_inventory as filesystem

ROOT = Path(__file__).resolve().parents[2]
AWS_EXE = r'C:\Program Files\Amazon\AWSCLIV2\aws.exe'
HELPERS = tuple('scripts/qualification/' + name for name in builder.HELPERS) + (
    'scripts/qualification/worker_build_binding.py',
    'scripts/qualification/worker_runner_inventory.py',
    'scripts/qualification/worker_runner_capture.py')


def encoded(value):
    return (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=True, allow_nan=False) + '\n').encode('ascii')


def observed_runtime():
    return {'platform': sys.platform, 'executable': sys.executable,
            'basePrefix': sys.base_prefix, 'version': list(sys.version_info[:3])}


def validate_config(output, read_only, runtime, repository):
    if read_only is not True or not output:
        raise ValueError('explicit read-only capture and fresh output required')
    if runtime['platform'] != 'win32' or runtime['version'] != [3, 11, 15]:
        raise ValueError('actual Windows Python 3.11.15 runner required')
    path = Path(output)
    if not path.is_absolute() or '..' in path.parts or path.parent != Path(repository) / '.task-inputs' \
            or not re.fullmatch(r'worker-runner-capture-[a-z0-9-]{1,80}', path.name):
        raise ValueError('fresh allocated runner output slot required')
    return path


class VersionPipeBoundaryError(ValueError):
    """Direct child exited; inherited pipe/descendant teardown is unqualified."""


def native_version(argv, *, seconds, cap, clock=time.monotonic, pause=time.sleep):
    """Bound direct-child ownership and require EOF without reader threads."""
    if argv != [AWS_EXE, '--version']:
        raise ValueError('canonical version command required')
    if type(seconds) not in (int, float) or not 0 < seconds <= 5 or type(cap) is not int or not 0 < cap <= 65536:
        raise ValueError('bounded local version command required')
    systemroot = os.environ.get('SYSTEMROOT')
    if not systemroot:
        raise ValueError('Windows SYSTEMROOT required')
    env = {'SYSTEMROOT': systemroot, 'AWS_EC2_METADATA_DISABLED': 'true',
           'AWS_MAX_ATTEMPTS': '1', 'AWS_PAGER': ''}
    buffers = {'stdout': bytearray(), 'stderr': bytearray()}
    eof = set()
    end = clock() + seconds

    def stop():
        if child.poll() is None:
            try:
                child.kill()
            except ProcessLookupError:
                pass

    child = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, shell=False, env=env, bufsize=0)
    try:
        if sys.platform == 'win32':
            import ctypes
            from ctypes import wintypes
            import msvcrt
            peek = ctypes.WinDLL('kernel32', use_last_error=True).PeekNamedPipe
            peek.argtypes = (wintypes.HANDLE, wintypes.LPVOID, wintypes.DWORD,
                             wintypes.LPDWORD, wintypes.LPDWORD, wintypes.LPDWORD)
            peek.restype = wintypes.BOOL

            def ready(stream):
                available = wintypes.DWORD()
                if not peek(msvcrt.get_osfhandle(stream.fileno()), None, 0, None,
                            ctypes.byref(available), None):
                    error = ctypes.get_last_error()
                    if error == 109:  # ERROR_BROKEN_PIPE: all writers closed.
                        return b''
                    raise OSError(error, 'version pipe inspection failed')
                return os.read(stream.fileno(), min(4096, available.value)) if available.value else None
        else:
            for stream in (child.stdout, child.stderr):
                os.set_blocking(stream.fileno(), False)

            def ready(stream):
                try:
                    return os.read(stream.fileno(), 4096)
                except BlockingIOError:
                    return None

        while True:
            if clock() >= end:
                if child.poll() is None:
                    raise subprocess.TimeoutExpired(argv, seconds)
                raise VersionPipeBoundaryError('VERSION_PIPE_EOF_INCOMPLETE; DESCENDANT_TEARDOWN_UNQUALIFIED')
            for name, stream in (('stdout', child.stdout), ('stderr', child.stderr)):
                if name in eof:
                    continue
                chunk = ready(stream)
                if chunk == b'':
                    eof.add(name)
                elif chunk is not None:
                    if len(buffers[name]) + len(chunk) > cap:
                        raise ValueError('bounded version output exceeded')
                    buffers[name].extend(chunk)
            if child.poll() is not None and eof == {'stdout', 'stderr'}:
                code = child.wait(timeout=3)
                return code, bytes(buffers['stdout']), bytes(buffers['stderr'])
            pause(min(0.01, max(0, end - clock())))
    finally:
        stop()
        try:
            child.wait(timeout=3)
        finally:
            # Unbuffered handles have no buffered-reader lock; inherited writers
            # cannot keep parent close() waiting. Descendants are not owned here.
            for stream in (child.stdout, child.stderr):
                stream.close()


def capture(output, read_only, *, runtime=None, repository=ROOT, fs=None,
            clock=time.monotonic, version_runner=native_version, aws_executable=AWS_EXE):
    runtime = observed_runtime() if runtime is None else runtime
    output = validate_config(output, read_only, runtime, repository)
    fs = fs or filesystem.Filesystem()
    end = clock() + 60
    filesystem.ancestors(output.parent, fs)
    try:
        fs.lstat(output)
    except FileNotFoundError:
        pass
    else:
        raise ValueError('fresh runner output already exists')
    measured = filesystem.inventory(runtime['executable'], runtime['basePrefix'], repository,
                                    HELPERS, fs=fs, clock=clock, end=end)
    before = filesystem.hash_file(Path(aws_executable), fs=fs, clock=clock, end=end, cap=16*1024*1024)
    filesystem.check_deadline(end, clock)
    remaining = end - clock()
    if remaining <= 0:
        raise ValueError('runner capture deadline before native invocation')
    code, stdout, stderr = version_runner([AWS_EXE, '--version'], seconds=min(5, remaining), cap=65536)
    if code != 0 or len(stdout) > 65536 or len(stderr) > 65536 \
            or not re.fullmatch(rb'aws-cli/[0-9]+\.[0-9]+\.[0-9]+[^\r\n]*\r?\n?', stdout):
        raise ValueError('canonical AWS CLI version observation required')
    after = filesystem.hash_file(Path(aws_executable), fs=fs, clock=clock, end=end, cap=16*1024*1024)
    if before != after:
        raise ValueError('AWS CLI changed during version capture')
    post = filesystem.inventory(runtime['executable'], runtime['basePrefix'], repository,
                                HELPERS, fs=fs, clock=clock, end=end)
    if measured != post:
        raise ValueError('runtime/helper snapshot changed during local version capture')
    result = {'schema': 'meri-worker-runner-observation/1', 'status': 'SOURCE_ONLY_MEASURED_NOT_EXECUTABLE',
              'capturedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
              'targetExpectation': {'account': binding.ACCOUNT, 'region': binding.REGION,
                                    'profile': binding.PROFILE, 'callerArn': binding.PRINCIPAL},
              'callerObserved': False, 'stsEvidenceRequiredSeparately': True,
              'runtime': dict(runtime, files=measured['files']), 'helperFiles': measured['helperFiles'],
              'coverage': measured['coverage'], 'totalBytes': measured['totalBytes'],
              'awsCli': dict(before, version=stdout.decode('ascii').strip(), wholeInstallationQualified=False),
              'awsRequests': 0, 'runnerQualified': False, 'buildAuthorized': False,
              'scanAdmitted': False, 'runtimeAdmitted': False, 'g1Admitted': False}
    artifacts = {'runner-capture.json': encoded(result), 'aws-cli-version.stdout.bin': stdout,
                 'aws-cli-version.stderr.bin': stderr}
    if len(artifacts['runner-capture.json']) > 4 * 1024 * 1024:
        raise ValueError('runner observation byte bound')
    artifacts['capture-index.json'] = encoded({'files': [
        {'path': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
        for name, raw in sorted(artifacts.items())]})
    filesystem.check_deadline(end, clock)
    filesystem.write_result(output, artifacts, fs=fs, clock=clock, end=end)
    return {'status': result['status'], 'awsRequests': 0, 'runnerQualified': False,
            'buildAuthorized': False, 'output': str(output)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False,
        epilog='Exit 0: measured source-only observations. Exit 2: invalid configuration, unsupported host or bounded capture failure. No AWS request or build admission.')
    parser.add_argument('--output')
    parser.add_argument('--read-only-host-capture', action='store_true')
    args = parser.parse_args(argv)
    try:
        result = capture(args.output, args.read_only_host_capture)
    except VersionPipeBoundaryError:
        print('Runner capture refused: VERSION_PIPE_EOF_INCOMPLETE; DESCENDANT_TEARDOWN_UNQUALIFIED; no build authority.', file=sys.stderr)
        return 2
    except (OSError, ValueError, subprocess.SubprocessError):
        print('Runner capture refused/failed; no build authority granted.', file=sys.stderr)
        return 2
    print(encoded(result).decode('ascii'), end='')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
