"""Observe current Windows ancestor metadata only; no collector or admission.

Run with the original Python using -I -B -S and the existing 15-second external
supervisor. Exit 0 is observation only; exit 2 is a bounded refusal. No file
bodies, directory listing, filesystem writes, subprocesses or network calls.
"""
import argparse
import json
import os
from pathlib import Path
import re
import stat
import sys
import time

MAX_PATH_CHARS = 1024
MAX_ANCESTORS = 64
MAX_OUTPUT_BYTES = 32768
ROLES = ('repository', 'output-parent', 'basePrefix', 'Lib', 'DLLs')


class Refusal(Exception):
    def __init__(self, reason, observation=None):
        self.reason = reason
        self.observation = observation


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise Refusal('invalid_arguments')


def deadline(end):
    if time.monotonic() >= end:
        raise Refusal('diagnostic_deadline')


def local_syntax(path):
    text = str(path)
    if (not 0 < len(text) <= MAX_PATH_CHARS or '\x00' in text or
            not path.is_absolute() or '..' in path.parts or
            text.startswith('\\\\') or re.fullmatch(r'[A-Za-z]:', path.drive) is None):
        raise Refusal('absolute_fixed_local_path_required')
    if len(path.parents) + 1 > MAX_ANCESTORS:
        raise Refusal('ancestor_count_bound')


def fixed_drive(path):
    # Called only after runtime and syntax admission; never probe UNC or devices.
    import ctypes
    function = ctypes.WinDLL('kernel32', use_last_error=True).GetDriveTypeW
    function.argtypes = [ctypes.c_wchar_p]
    function.restype = ctypes.c_uint
    drive_type = function(path.anchor)
    if drive_type != 3:
        raise Refusal('fixed_local_drive_required', {'driveType': drive_type})


def numeric(value):
    return value if type(value) is int and -(2**31) <= value < 2**32 else None


def inspect_role(role, path, end):
    if role not in ROLES:
        raise Refusal('unknown_role')
    context = {'role': role, 'ancestorOrdinal': None, 'ancestorCount': None,
               'stage': 'syntax'}
    try:
        local_syntax(path)
        parents = tuple(reversed((path, *path.parents)))
        context['ancestorCount'] = len(parents)
        deadline(end)
        context['stage'] = 'drive_type'
        fixed_drive(path)
        deadline(end)
        for ordinal, parent in enumerate(parents, 1):
            context.update(ancestorOrdinal=ordinal, stage='lstat')
            deadline(end)
            info = os.lstat(parent)
            deadline(end)
            mode = numeric(info.st_mode)
            attributes = numeric(getattr(info, 'st_file_attributes', None))
            tag = numeric(getattr(info, 'st_reparse_tag', None))
            if mode is None:
                raise Refusal('invalid_stat_mode')
            predicates = {'symbolic_link': stat.S_ISLNK(mode),
                          'reparse_point': bool((attributes or 0) & 0x400),
                          'not_directory': not stat.S_ISDIR(mode)}
            if any(predicates.values()):
                raise Refusal('plain_local_directory_ancestors_required', {
                    'predicates': predicates, 'mode': mode,
                    'fileAttributes': attributes, 'reparseTag': tag})
        return {'role': role, 'ancestorCount': len(parents),
                'status': 'plain_directory_metadata_observed'}
    except Refusal as error:
        raise Refusal(error.reason, {**context, **(error.observation or {})}) from None
    except OSError as error:
        raise Refusal('filesystem_or_native_api_error', {
            **context, 'errno': numeric(error.errno),
            'winerror': numeric(getattr(error, 'winerror', None))}) from None


def metadata(repository, output, end):
    if sys.platform != 'win32' or sys.version_info[:3] != (3, 11, 15):
        raise Refusal('actual_windows_python_3_11_15_required')
    base = Path(sys.base_prefix)
    paths = (repository, output.parent, base, base / 'Lib', base / 'DLLs')
    # Reject every unsafe role syntactically before any native/metadata operation.
    # The supplied output is also checked, although only its parent is statted.
    for role, path in (('repository', repository), ('original-output', output), *zip(ROLES[1:], paths[1:])):
        try:
            local_syntax(path)
        except Refusal as error:
            raise Refusal(error.reason, {'completedRoles': [], 'rejected': {
                'role': role, 'stage': 'syntax', 'ancestorOrdinal': None,
                'ancestorCount': None}}) from None
    completed = []
    try:
        for role, path in zip(ROLES, paths):
            completed.append(inspect_role(role, path, end))
    except Refusal as error:
        raise Refusal(error.reason, {'completedRoles': completed,
                                    'rejected': error.observation}) from None
    return {'completedRoles': completed, 'rejected': None}


def main(argv=None):
    result = {'status': 'DIAGNOSTIC_REFUSED', 'runnerQualified': False,
              'buildAuthorized': False, 'runtimeAccepted': False,
              'collectorExecuted': False, 'fileBodiesRead': 0,
              'filesystemWrites': 0, 'childProcesses': 0}
    code = 2
    try:
        parser = Parser(prog='inspect-ancestor-metadata.py', description=__doc__, allow_abbrev=False)
        parser.add_argument('--repository', type=Path, required=True)
        parser.add_argument('--original-output', type=Path, required=True)
        args = parser.parse_args(argv)
        result['observation'] = metadata(args.repository, args.original_output, time.monotonic() + 10)
        result['status'] = 'DIAGNOSTIC_ONLY_NO_ADMISSION'
        code = 0
    except Refusal as error:
        result.update(reason=error.reason, observation=error.observation)
    except Exception:
        # Do not let unexpected exception text disclose receipt paths.
        result.update(reason='unexpected_diagnostic_error', observation=None)
    raw = (json.dumps(result, ensure_ascii=True, sort_keys=True) + '\n').encode('ascii')
    if len(raw) > MAX_OUTPUT_BYTES:
        raw = b'{"status":"DIAGNOSTIC_REFUSED","reason":"output_size_bound","runnerQualified":false}\n'
        code = 2
    sys.stdout.buffer.write(raw)
    return code


if __name__ == '__main__':
    raise SystemExit(main())
