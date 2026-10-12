"""Proposed read-only Windows diagnostics; no collector execution or admission.

Use --help for explicit inputs. Exit0 means diagnostic observation only;
exit2 means bounded refusal. Native execution requires separate parent approval.
No writes, collector imports, child processes, network, AWS or provider calls.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import time


MAX_STREAM_BYTES = 65536
MAX_ENTRIES = 80000
MAX_FILES = 20000
MAX_OUTPUT_BYTES = 1024 * 1024
MAX_ISSUE_EXAMPLES = 100
MAX_FILE_BYTES = 16 * 1024 * 1024
GENERIC = b'Runner capture refused/failed; no build authority granted.'
PIPE = b'Runner capture refused: VERSION_PIPE_EOF_INCOMPLETE; DESCENDANT_TEARDOWN_UNQUALIFIED; no build authority.'


class Refusal(Exception):
    pass


def deadline(end):
    if time.monotonic() >= end:
        raise Refusal('diagnostic_deadline')


def fixed_drive(path):
    """Reject UNC, mapped/network/removable drives before filesystem metadata IO."""
    if sys.platform != 'win32':
        raise Refusal('native_windows_required')
    if not path.is_absolute() or '..' in path.parts or str(path).startswith('\\\\'):
        raise Refusal('absolute_local_path_required')
    import ctypes
    function = ctypes.WinDLL('kernel32', use_last_error=True).GetDriveTypeW
    function.argtypes = [ctypes.c_wchar_p]
    function.restype = ctypes.c_uint
    if function(path.anchor) != 3:  # DRIVE_FIXED; never probe a remote drive.
        raise Refusal('fixed_local_drive_required')


def is_link(info):
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, 'st_file_attributes', 0) & 0x400)


def directory_ancestors(path, end):
    fixed_drive(path)
    for parent in reversed((path, *path.parents)):
        deadline(end)
        info = os.lstat(parent)
        if is_link(info) or not stat.S_ISDIR(info.st_mode):
            raise Refusal('plain_local_directory_ancestors_required')


def file_identity(info):
    return (info.st_dev, info.st_ino, info.st_nlink, info.st_size,
            info.st_mtime_ns, info.st_ctime_ns)


def inspect_stream(path, end):
    directory_ancestors(path.parent, end)
    deadline(end)
    before = os.lstat(path)
    if is_link(before) or not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
        raise Refusal('single_plain_stream_file_required')
    if not 0 <= before.st_size <= MAX_STREAM_BYTES:
        raise Refusal('original_stream_size_bound')
    with path.open('rb') as stream:
        opened = os.fstat(stream.fileno())
        if file_identity(opened) != file_identity(before):
            raise Refusal('stream_open_identity_changed')
        raw = stream.read(MAX_STREAM_BYTES + 1)
        if file_identity(os.fstat(stream.fileno())) != file_identity(opened):
            raise Refusal('stream_changed_during_read')
    deadline(end)
    if len(raw) != before.st_size or file_identity(os.lstat(path)) != file_identity(before):
        raise Refusal('stream_named_identity_changed')
    labels = {
        GENERIC + b'\n': 'canonical_generic_LF', GENERIC + b'\r\n': 'canonical_generic_CRLF',
        PIPE + b'\n': 'canonical_pipe_LF', PIPE + b'\r\n': 'canonical_pipe_CRLF',
        b'': 'empty',
    }
    return {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
            'knownMessage': labels.get(raw), 'bodyContentsOmitted': True}


def scan_stdlib(lib, end):
    """Stat selected .py entries, never open bodies or traverse links/reparse."""
    pending, entries, files, total = [lib], 0, 0, 0
    counts, examples = {}, []

    def issue(code, path, info):
        counts[code] = counts.get(code, 0) + 1
        if len(examples) < MAX_ISSUE_EXAMPLES:
            examples.append({'reason': code, 'relativePath': path.relative_to(lib).as_posix(),
                             'bytes': info.st_size, 'links': info.st_nlink})

    while pending:
        deadline(end)
        folder = pending.pop()
        root_info = os.lstat(folder)
        if is_link(root_info) or not stat.S_ISDIR(root_info.st_mode):
            raise Refusal('stdlib_directory_changed_or_reparse')
        with os.scandir(folder) as members:
            for entry in members:
                deadline(end)
                entries += 1
                if entries > MAX_ENTRIES:
                    raise Refusal('directory_entry_bound')
                path = Path(entry.path)
                if path.parent != folder or len(str(path)) > 1024:
                    raise Refusal('stdlib_path_bound')
                if path.name.casefold() == 'site-packages':
                    continue
                info = os.lstat(path)
                if is_link(info):
                    issue('link_or_reparse_not_followed', path, info)
                elif stat.S_ISDIR(info.st_mode):
                    pending.append(path)
                elif path.suffix.casefold() == '.py':
                    files += 1
                    total += info.st_size
                    if files > MAX_FILES:
                        raise Refusal('selected_file_bound')
                    if not stat.S_ISREG(info.st_mode):
                        issue('nonregular_selected_py', path, info)
                    elif info.st_nlink != 1:
                        issue('multiply_linked_selected_py', path, info)
                    elif info.st_size == 0:
                        issue('zero_byte_selected_py', path, info)
                    elif info.st_size > MAX_FILE_BYTES:
                        issue('oversized_selected_py', path, info)
    return {'selectedPyFiles': files, 'directoryEntriesObserved': entries,
            'selectedPyMetadataBytes': total, 'issueCounts': counts, 'issueExamples': examples,
            'examplesTruncated': sum(counts.values()) > len(examples),
            'fileBodiesRead': 0, 'collectorInventoryReplayed': False}


def metadata(repository, output, end):
    directory_ancestors(repository, end)
    directory_ancestors(output.parent, end)
    output_syntax = (output.parent == repository / '.task-inputs' and
                     re.fullmatch(r'worker-runner-capture-[a-z0-9-]{1,80}', output.name) is not None)
    try:
        slot_info = os.lstat(output)
        slot = {'exists': True, 'linkOrReparse': is_link(slot_info)}
    except FileNotFoundError:
        slot = {'exists': False, 'linkOrReparse': False}
    base = Path(sys.base_prefix)
    roots = {}
    for label, path in [('basePrefix', base), ('Lib', base / 'Lib'), ('DLLs', base / 'DLLs')]:
        directory_ancestors(path, end)
        roots[label] = 'plain_local_directory_observed'
    return {'runtime': {'platform': sys.platform, 'version': list(sys.version_info[:3]),
                        'prefixEqualsBasePrefix': sys.prefix == sys.base_prefix,
                        'systemrootPresent': bool(os.environ.get('SYSTEMROOT'))},
            'outputSyntaxMatchesCollector': output_syntax, 'originalSlot': slot,
            'selectedRoots': roots, 'stdlib': scan_stdlib(base / 'Lib', end),
            'limitations': ['Current metadata cannot reconstruct the failed run.',
                           'No executable/DLL/helper hashes or lstat-fstat/full-inventory acceptance.',
                           'No AWS executable/version invocation or output-slot write.',
                           'Not a hostile-filesystem race proof or hard syscall deadline.']}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_subparsers(dest='mode', required=True)
    evidence = modes.add_parser('evidence', help='read original bounded stdout/stderr bytes; bodies omitted')
    evidence.add_argument('--stdout-file', type=Path, required=True)
    evidence.add_argument('--stderr-file', type=Path, required=True)
    native = modes.add_parser('metadata', help='current runtime and selected stdlib metadata only')
    native.add_argument('--repository', type=Path, required=True)
    native.add_argument('--original-output', type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if sys.platform != 'win32' or sys.version_info[:3] != (3, 11, 15):
            raise Refusal('actual_windows_python_3_11_15_required')
        end = time.monotonic() + 10
        observed = ({'stdout': inspect_stream(args.stdout_file, end), 'stderr': inspect_stream(args.stderr_file, end)}
                    if args.mode == 'evidence' else metadata(args.repository, args.original_output, end))
        result = {'status': 'DIAGNOSTIC_ONLY_NO_ADMISSION', 'mode': args.mode, 'observation': observed,
                  'collectorExecuted': False, 'awsRequests': 0, 'awsCliExecuted': False,
                  'writes': 0, 'runnerQualified': False, 'buildAuthorized': False}
        raw = (json.dumps(result, ensure_ascii=True, sort_keys=True) + '\n').encode('ascii')
        if len(raw) > MAX_OUTPUT_BYTES:
            raise Refusal('output_size_bound')
        sys.stdout.buffer.write(raw)
        return 0
    except Refusal as error:
        print(json.dumps({'status': 'DIAGNOSTIC_REFUSED', 'reason': str(error), 'runnerQualified': False}))
        return 2
    except OSError as error:
        print(json.dumps({'status': 'DIAGNOSTIC_REFUSED', 'reason': 'filesystem_or_native_api_error',
                          'errno': error.errno, 'winerror': getattr(error, 'winerror', None), 'runnerQualified': False}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
