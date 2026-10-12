"""Fresh runner binding proposals and root review; never authorize a build."""
import datetime as dt
from pathlib import PurePosixPath, PureWindowsPath
import re

import worker_image_collect as evidence

SCHEMA = 'meri-worker-runner-binding/1'
PRINCIPAL = 'arn:aws:iam::967807252336:user/capirocli'
ACCOUNT = '967807252336'
PROFILE = 'capiro-dev'
REGION = 'us-east-1'
REVIEW_DECISION = 'ROOT_REVIEWED_WORKER_RUNNER_BINDING_ONLY'
SHA256 = re.compile('[a-f0-9]{64}')
GIT_ID = re.compile('[a-f0-9]{40}')


def _hash(value):
    evidence.need(type(value) is str and SHA256.fullmatch(value), 'explicit SHA-256 binding')


def _windows_path(value):
    evidence.need(type(value) is str and 0 < len(value) <= 1024, 'Windows path')
    path = PureWindowsPath(value)
    evidence.need(path.is_absolute() and not path.drive.startswith('\\\\')
                  and '..' not in path.parts and '.' not in path.parts
                  and str(path) == value, 'canonical absolute Windows path')
    return path


def _records(rows, *, windows):
    evidence.need(type(rows) is list and 0 < len(rows) <= 20000, 'bounded full closure records')
    names, total = set(), 0
    for row in rows:
        evidence.need(type(row) is dict and set(row) == {'path', 'bytes', 'sha256'}, 'closure record fields')
        name = row['path']
        if windows:
            key = str(_windows_path(name)).casefold()
        else:
            evidence.need(type(name) is str and PurePosixPath(name).as_posix() == name
                          and not PurePosixPath(name).is_absolute()
                          and all(part not in ('', '.', '..') for part in name.split('/')), 'repository-relative helper path')
            key = name
        evidence.need(key not in names, 'duplicate closure path')
        names.add(key)
        evidence.need(type(row['bytes']) is int and 0 < row['bytes'] <= 16*1024*1024, 'bounded closure file')
        _hash(row['sha256']); total += row['bytes']
    evidence.need(total <= 256*1024*1024, 'aggregate closure bound')
    return names


def validate_proposal(raw, expected_sha256, helper_paths):
    """Validate input shape and exact source/runner references, not their authority."""
    _hash(expected_sha256)
    evidence.need(len(raw) <= 4*1024*1024 and evidence.digest(raw) == expected_sha256, 'external runner binding pin')
    value = evidence.loads(raw)
    fields = {'schema', 'sourceCommit', 'sourceTree', 'contextManifestSha256', 'assemblerSha256',
              'authoritySha256', 'target', 'runtime', 'helperFiles'}
    evidence.need(type(value) is dict and set(value) == fields and value['schema'] == SCHEMA, 'runner binding fields')
    for field in ('sourceCommit', 'sourceTree'):
        evidence.need(type(value[field]) is str and GIT_ID.fullmatch(value[field]), 'exact Git binding')
    for field in ('contextManifestSha256', 'assemblerSha256', 'authoritySha256'):
        _hash(value[field])
    target = value['target']
    evidence.need(type(target) is dict and set(target) == {'account', 'region', 'profile', 'caller'}
                  and (target['account'], target['region'], target['profile']) == (ACCOUNT, REGION, PROFILE), 'fresh runner target')
    caller = target['caller']
    evidence.need(type(caller) is dict and set(caller) == {'Account', 'Arn', 'UserId'}
                  and caller['Account'] == ACCOUNT and caller['Arn'] == PRINCIPAL
                  and type(caller['UserId']) is str and 0 < len(caller['UserId']) <= 256, 'full fresh runner caller')
    runtime = value['runtime']
    evidence.need(type(runtime) is dict and set(runtime) == {'platform', 'executable', 'basePrefix', 'version', 'files'}
                  and runtime['platform'] == 'win32', 'explicit Windows runner runtime')
    executable = _windows_path(runtime['executable']); prefix = _windows_path(runtime['basePrefix'])
    version = runtime['version']
    evidence.need(type(version) is list and len(version) == 3
                  and all(type(item) is int and 0 <= item < 10000 for item in version)
                  and version[0] == 3, 'exact Python version')
    runtime_names = _records(runtime['files'], windows=True)
    evidence.need(str(executable).casefold() in runtime_names, 'executable included in runtime closure')
    for row in runtime['files']:
        path = _windows_path(row['path'])
        evidence.need(path == executable or path.is_relative_to(prefix), 'runtime closure outside base prefix')
    helpers = _records(value['helperFiles'], windows=False)
    evidence.need(helpers == set(helper_paths), 'exact helper closure membership')
    return value


def validate_review(value, raw, review_raw, review_sha256, *, now):
    """A fresh root binding review is distinct from one-build/cost approval."""
    _hash(review_sha256)
    evidence.need(len(review_raw) <= 65536 and evidence.digest(review_raw) == review_sha256, 'external runner review pin')
    review = evidence.loads(review_raw)
    evidence.need(type(review) is dict and set(review) == {
        'decision', 'bindingSha256', 'sourceCommit', 'sourceTree', 'closureSha256', 'authoritySha256',
        'capturedAt', 'expiresAt', 'reviewer'}, 'runner review fields')
    evidence.need(review['decision'] == REVIEW_DECISION and review['bindingSha256'] == evidence.digest(raw)
                  and review['sourceCommit'] == value['sourceCommit'] and review['sourceTree'] == value['sourceTree']
                  and review['authoritySha256'] == value['authoritySha256']
                  and review['closureSha256'] == evidence.digest(evidence.encoded({
                      'runtime': value['runtime'], 'helperFiles': value['helperFiles']})), 'exact reviewed runner closure')
    evidence.need(type(review['reviewer']) is str and 0 < len(review['reviewer']) <= 256, 'named root reviewer')
    for field in ('capturedAt', 'expiresAt'):
        evidence.need(type(review[field]) is str, 'review time')
    start = dt.datetime.fromisoformat(review['capturedAt']); end = dt.datetime.fromisoformat(review['expiresAt'])
    evidence.need(start.utcoffset() == end.utcoffset() == dt.timedelta(0)
                  and now.tzinfo is not None and 0 < (end-start).total_seconds() <= 600
                  and start <= now < end, 'fresh bounded root runner review')
    return review


def require_observed_binding(value, *, runtime_files, runtime_identity, helper_files, caller):
    """Future execution must supply freshly measured bytes and trusted STS identity."""
    runtime = value['runtime']
    expected_identity = {name: runtime[name] for name in ('platform', 'executable', 'basePrefix', 'version')}
    evidence.need(runtime_identity == expected_identity and runtime_files == runtime['files']
                  and helper_files == value['helperFiles'] and caller == value['target']['caller'],
                  'fresh runtime/helper/caller observation required')
