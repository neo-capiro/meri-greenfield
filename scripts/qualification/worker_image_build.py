"""Fixed worker build-only preparation/one dispatch/read-only reconciliation. No image admission."""
import argparse
import base64
import datetime as dt
import io
import json
import re
import sys
import time
import uuid
import zipfile
from pathlib import Path

if __name__ == '__main__':
    # Isolated direct CLI execution omits the script directory from sys.path.
    sys.path.insert(0, str(Path(__file__).resolve().parent))

import aws_evidence
import host_assets_build as authority
import host_assets_source as source
import worker_context
import worker_image_collect as collector

ROOT = Path(__file__).resolve().parents[2]
REFERENCE = '5192c575e78957bd4bc8d2c512a1efb5b455a884'
ACCOUNT, REGION, PROJECT = authority.ACCOUNT, authority.REGION, authority.PROJECT
BUCKET, KMS, ROLE = authority.BUCKET, authority.KMS, authority.BUILDER_ROLE
SCHEMA = 'meri-worker-image-build/1'
WORKER_BUILDER_PRINCIPAL = 'arn:aws:iam::967807252336:user/hermes-cli'
PYTHON = Path('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
PYTHON_SHA = '10d845f50a2af64e3500bb2fcb348b5bc98a75d8ddada63e45ba1da6a1fc79d1'
HELPERS = ('worker_image_build.py', 'worker_image_collect.py', 'worker_context.py',
           'host_assets_build.py', 'host_assets_source.py', 'aws_evidence.py',
           'teststate_request.py', 'readonly_shapes.py')
ORIGINAL = tuple(p for p, _ in worker_context.MEMBERS)+(collector.ASSEMBLER,)
PACKAGING_CHANGES = {
    'apps/worker/qualification/.dockerignore',
    'apps/worker/qualification/Dockerfile',
    'apps/worker/qualification/README.md',
    'apps/worker/qualification/component-pins.json',
    'apps/worker/qualification/package.json',
    'apps/worker/qualification/package-lock.json',
    'apps/worker/qualification/probes/image-inventory.py',
    'apps/worker/qualification/probes/image-inventory.test.mjs',
    'apps/worker/qualification/probes/static.test.mjs',
    collector.ASSEMBLER,
}
need, sha, save, write, encoded, loads, read = (collector.need, collector.digest, collector.save,
                                             collector.write, collector.encoded, collector.loads, collector.read)


def pins():
    need(Path(sys.executable) == PYTHON and sys.version_info[:3] == (3, 12, 14)
         and sha(read(PYTHON, 1024*1024)) == PYTHON_SHA, 'fixed owner Python runtime')
    runtime = Path(sys.base_prefix)
    names = [ROOT/'scripts/qualification'/p for p in HELPERS]+[Path(sys.executable)]
    names += sorted(p for p in (runtime/'Lib').rglob('*.py') if 'site-packages' not in p.parts)
    names += sorted(runtime.glob('*.dll'))+sorted((runtime/'DLLs').glob('*.pyd'))+sorted((runtime/'DLLs').glob('*.dll'))
    return [{'path': str(p), 'bytes': len(raw), 'sha256': sha(raw)} for p in names
            for raw in [read(p, 16*1024*1024)]]


def slot(path, create=False):
    path = Path(path).absolute()
    need(path.parent == ROOT/'.task-inputs' and re.fullmatch('sdk-worker-image-build-[a-z0-9-]{1,80}', path.name), 'fixed owned evidence slot')
    for parent in path.parents:
        need(parent.resolve() == parent and not parent.is_symlink(), 'plain evidence ancestors')
    need(not path.is_symlink() and path.resolve() == path, 'plain evidence path')
    if create: path.mkdir(exist_ok=False)
    else: need(path.is_dir(), 'prepared evidence required')
    return path


def git_files(commit, names, capture=None, prefix='source'):
    need(type(commit) is str and re.fullmatch('[a-f0-9]{40}', commit), 'exact source commit')
    tree = source.git_read(ROOT, ['ls-tree', '-r', '-z', '-l', commit, '--', *names], prefix+'-tree', capture)
    entries = {}
    for row in tree.rstrip(b'\0').split(b'\0'):
        header, path = row.split(b'\t'); mode, kind, oid, size = header.split(); path = path.decode('ascii')
        need(mode in (b'100644', b'100755') and kind == b'blob' and path not in entries
             and re.fullmatch(b'[a-f0-9]{40}', oid) and 0 < int(size) <= 2*1024*1024, 'plain bounded Git blob')
        entries[path] = (oid, int(size))
    need(set(entries) == set(names), 'exact Git membership')
    raw = source.git_read(ROOT, ['cat-file', '--batch'], prefix+'-blobs', capture,
                          b''.join(entries[p][0]+b'\n' for p in names))
    result, cursor = {}, 0
    for name in names:
        oid, size = entries[name]; end = raw.index(b'\n', cursor)
        need(raw[cursor:end] == oid+b' blob '+str(size).encode(), 'Git header')
        result[name] = raw[end+1:end+1+size]
        need(raw[end+1+size:end+2+size] == b'\n', 'Git terminator'); cursor = end+2+size
    need(cursor == len(raw), 'extra Git data'); return result


def baseline(commit, capture=None):
    stable = tuple(p for p in ORIGINAL if p not in PACKAGING_CHANGES)
    old = git_files(REFERENCE, stable, capture, 'reference')
    current = git_files(commit, ORIGINAL+(collector.COLLECTOR,), capture, 'candidate')
    need(all(current[p] == old[p] for p in stable), 'stable fixture source drift')
    need(all(current[p] == read(ROOT/p, 2*1024*1024) for p in ORIGINAL), 'candidate Git/current drift')
    need(current[collector.COLLECTOR] == read(ROOT/collector.COLLECTOR, 2*1024*1024), 'collector Git/current drift')
    need(sha(current[collector.ASSEMBLER]) == collector.ASSEMBLER_SHA, 'assembler reference pin')
    return current


def validate_authority(value):
    need(type(value) is dict and set(value) == {'decision', 'capturedAt', 'caller', 'project', 'authorityRecords'}
         and value['decision'] == 'ROOT_REVIEWED_WORKER_BUILDER_AUTHORITY', 'root authority descriptor')
    caller = value['caller']
    need(type(caller) is dict and set(caller) == {'Account', 'Arn', 'UserId'} and caller['Account'] == ACCOUNT
         and caller['Arn'] == WORKER_BUILDER_PRINCIPAL and type(caller['UserId']) is str and 0 < len(caller['UserId']) <= 256, 'full fixed caller')
    project = authority.project_configuration(value['project'])
    need(project.get('arn') == f'arn:aws:codebuild:{REGION}:{ACCOUNT}:project/{PROJECT}'
         and project.get('name') == PROJECT and project.get('serviceRole') == ROLE and project.get('encryptionKey') == KMS
         and project.get('timeoutInMinutes') == 30 and project.get('queuedTimeoutInMinutes') == 5
         and project.get('concurrentBuildLimit') == 1 and project.get('vpcConfig') in (None, {}), 'isolated builder identity')
    env = project['environment']
    need(env.get('type') == 'LINUX_CONTAINER' and env.get('image') == 'aws/codebuild/standard:7.0'
         and env.get('computeType') == 'BUILD_GENERAL1_SMALL' and env.get('privilegedMode') is True
         and all(not r['name'].upper().startswith(('AWS_', 'ANTHROPIC_', 'OPENAI_'))
                 and r['name'] not in ('DATABASE_URL', 'LITELLM_MASTER_KEY') for r in env['environmentVariables']), 'builder environment')
    records = value['authorityRecords']
    need(type(records) is dict and set(records) == {'roleTrust', 'inlinePolicy', 'attachedPolicies', 'kmsKey', 'kmsPolicy'}
         and all(type(v) is str and re.fullmatch('[a-f0-9]{64}', v) for v in records.values()), 'reviewed role/KMS raw evidence references')
    stamp = dt.datetime.fromisoformat(value['capturedAt']); need(stamp.tzinfo is not None, 'authority UTC offset')
    return project


def recipe():
    # Build phase failure still enters post_build. A missing/incomplete bundle is never acceptance.
    upload = """set -eu
test -f worker-image-result.tar.gz
test ! -L worker-image-result.tar.gz
checksum=$(python3 -I -B -S -c 'import base64,hashlib; print(base64.b64encode(hashlib.file_digest(open("worker-image-result.tar.gz","rb"),"sha256").digest()).decode())')
timeout --signal=TERM --kill-after=5s 60s aws s3api put-object --bucket meri-greenfield-qual-build-967807252336-us-east-1 --key "$RESULT_KEY" --body worker-image-result.tar.gz --if-none-match '*' --server-side-encryption aws:kms --ssekms-key-id arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042 --checksum-algorithm SHA256 --checksum-sha256 "$checksum" --region us-east-1 --no-cli-pager
"""
    return encoded({'version': '0.2', 'env': {'shell': 'bash', 'variables': {'AWS_MAX_ATTEMPTS': '1', 'AWS_RETRY_MODE': 'standard', 'AWS_PAGER': ''}},
                    'phases': {'build': {'commands': ['timeout --signal=TERM --kill-after=5s 1560s python3 -I -B -S scripts/qualification/worker_image_collect.py --collect']},
                               'post_build': {'commands': [upload]}}, 'artifacts': {'files': []}})


def prepare(commit, path, authority_file, authority_sha):
    authority_raw = read(Path(authority_file).absolute(), 2*1024*1024)
    need(sha(authority_raw) == authority_sha, 'external authority SHA')
    observed = loads(authority_raw); project = validate_authority(observed)
    files = baseline(commit); before = pins(); token = str(uuid.uuid4())
    helper_blobs = git_files(commit, tuple('scripts/qualification/'+p for p in HELPERS), prefix='helpers')
    need(all(v == read(ROOT/p, 2*1024*1024) for p, v in helper_blobs.items()), 'helper raw Git/current identity')
    files['buildspec.json'] = recipe()
    content = {'schema': collector.SCHEMA, 'sourceCommit': commit, 'runUuid': token,
               'contextManifestSha256': collector.CONTEXT_SHA,
               'members': [{'path': p, 'bytes': len(raw), 'sha256': sha(raw)} for p, raw in sorted(files.items())]}
    files['worker-image-input.json'] = encoded(content)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_STORED) as archive:
        for name, raw in sorted(files.items()):
            item = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0)); item.create_system = 3; item.external_attr = 0o100644 << 16
            archive.writestr(item, raw)
    packed = buffer.getvalue(); need(len(files) == 48 and len(packed) <= 8*1024*1024, '48-member bounded archive')
    need(pins() == before and baseline(commit) == {p: v for p, v in files.items() if p not in ('buildspec.json', 'worker-image-input.json')}, 'prepare source stability')
    request = {'schema': SCHEMA, 'sourceCommit': commit, 'runUuid': token, 'helperFiles': before,
               'authority': observed, 'authoritySha256': sha(authority_raw), 'builderProject': project,
               'inputSha256': sha(files['worker-image-input.json']), 'recipeSha256': sha(recipe()),
               'archive': {'bytes': len(packed), 'sha256': sha(packed), 'entries': 48,
                           'key': 'inputs/sdk-worker-image-'+token+'/source.zip'},
               'resultKey': 'results/sdk-worker-image-'+token+'/evidence.tar.gz'}
    evidence = slot(path, True)
    capture = evidence/'git-prepare'; capture.mkdir()
    need(baseline(commit, capture) == {p: v for p, v in files.items() if p not in ('buildspec.json', 'worker-image-input.json')}, 'retained Git source drift')
    need(git_files(commit, tuple(helper_blobs), capture, 'helpers') == helper_blobs and pins() == before, 'retained Git helper drift')
    write(evidence/'source.zip', packed); write(evidence/'buildspec.json', recipe())
    write(evidence/'worker-image-input.json', files['worker-image-input.json']); write(evidence/'authority.json', authority_raw)
    save(evidence/'request.json', request)
    return {'status': 'PREPARED_NOT_ADMITTED', 'requestSha256': sha(encoded(request)), 'awsCalls': 0}


def load(evidence):
    raw = read(evidence/'request.json', 2*1024*1024); request = loads(raw)
    need(type(request) is dict and set(request) == {'schema', 'sourceCommit', 'runUuid', 'helperFiles', 'authority', 'authoritySha256',
         'builderProject', 'inputSha256', 'recipeSha256', 'archive', 'resultKey'} and request['schema'] == SCHEMA, 'prepared request')
    token = request['runUuid']; need(type(token) is str and str(uuid.UUID(token)) == token and uuid.UUID(token).version == 4, 'request UUID')
    need(request['helperFiles'] == pins() and request['builderProject'] == validate_authority(request['authority']), 'execution closure/project drift')
    authority_raw = read(evidence/'authority.json', 2*1024*1024)
    need(sha(authority_raw) == request['authoritySha256'] and loads(authority_raw) == request['authority'], 'authority raw binding')
    expected_files = baseline(request['sourceCommit']); expected_files['buildspec.json'] = recipe()
    manifest_raw = read(evidence/'worker-image-input.json', 2*1024*1024); content = loads(manifest_raw)
    need(content == {'schema': collector.SCHEMA, 'sourceCommit': request['sourceCommit'], 'runUuid': token,
         'contextManifestSha256': collector.CONTEXT_SHA,
         'members': [{'path': p, 'bytes': len(v), 'sha256': sha(v)} for p, v in sorted(expected_files.items())]}, 'exact input rows')
    expected_files['worker-image-input.json'] = manifest_raw
    packed = read(evidence/'source.zip', 8*1024*1024)
    need(request['archive'] == {'bytes': len(packed), 'sha256': sha(packed), 'entries': 48, 'key': 'inputs/sdk-worker-image-'+token+'/source.zip'}
         and request['resultKey'] == 'results/sdk-worker-image-'+token+'/evidence.tar.gz'
         and request['inputSha256'] == sha(manifest_raw) and request['recipeSha256'] == sha(recipe())
         and read(evidence/'buildspec.json', 65536) == recipe(), 'fixed archive/recipe/keys')
    with zipfile.ZipFile(io.BytesIO(packed)) as archive:
        entries = archive.infolist()
        need(len(entries) == 48 and {e.filename for e in entries} == set(expected_files)
             and all((e.external_attr >> 16) == 0o100644 and not e.is_dir() and e.file_size == len(expected_files[e.filename])
                     and archive.read(e) == expected_files[e.filename] for e in entries), 'exact regular ZIP bytes')
    return request, raw


def check_review(request, raw, review_raw, review_sha):
    need(type(review_sha) is str and re.fullmatch('[a-f0-9]{64}', review_sha) and sha(review_raw) == review_sha, 'external review pin')
    review = loads(review_raw)
    need(type(review) is dict and set(review) == {'decision', 'requestSha256', 'closureSha256', 'authoritySha256', 'reviewer', 'notes'}
         and review['decision'] == 'APPROVE_ONE_WORKER_IMAGE_BUILD_ONLY'
         and review['requestSha256'] == sha(raw) and review['closureSha256'] == sha(encoded(request['helperFiles']))
         and review['authoritySha256'] == request['authoritySha256']
         and all(type(review[k]) is str and 0 < len(review[k]) <= 4000 for k in ('reviewer', 'notes')), 'exact worker-only owner admission')
    age = (dt.datetime.now(dt.timezone.utc)-dt.datetime.fromisoformat(request['authority']['capturedAt'])).total_seconds()
    need(0 <= age < 600, 'fresh root role/KMS authority required')


def start_input(request, version):
    need(type(version) is str and re.fullmatch('[A-Za-z0-9._~+/=-]{1,1024}', version) and version != 'null' and not version.startswith('-'), 'immutable source version')
    variables = {'SOURCE_COMMIT': request['sourceCommit'], 'SOURCE_ARCHIVE_SHA256': request['archive']['sha256'],
                 'SOURCE_S3_VERSION': version, 'INPUT_MANIFEST_SHA256': request['inputSha256'], 'RESULT_KEY': request['resultKey']}
    return {'projectName': PROJECT, 'sourceTypeOverride': 'S3', 'sourceLocationOverride': BUCKET+'/'+request['archive']['key'],
            'sourceVersion': version, 'buildspecOverride': recipe().decode('ascii'), 'timeoutInMinutesOverride': 30,
            'queuedTimeoutInMinutesOverride': 5, 'autoRetryLimitOverride': 0, 'idempotencyToken': request['runUuid'],
            'environmentVariablesOverride': [{'name': k, 'value': v, 'type': 'PLAINTEXT'} for k, v in variables.items()]}


def validate_build(build, request, start):
    retry = build.get('autoRetryConfig')
    # Initial builds can include the observed counter; neither shape permits retries.
    need(type(retry) is dict and set(retry) in ({'autoRetryLimit'}, {'autoRetryLimit', 'autoRetryNumber'})
         and all(type(value) is int and value == 0 for value in retry.values()), 'exact zero build retries')
    identifier = build.get('id', '')
    need(re.fullmatch(re.escape(PROJECT)+':[a-f0-9-]{36}', identifier)
         and str(uuid.UUID(identifier.split(':')[1])) == identifier.split(':')[1]
         and build.get('arn') == f'arn:aws:codebuild:{REGION}:{ACCOUNT}:build/'+identifier and build.get('projectName') == PROJECT, 'build identity')
    project = request['builderProject']; env = loads(encoded(project['environment']))
    variables = {r['name']: r for r in env['environmentVariables']}; variables.update({r['name']: r for r in start['environmentVariablesOverride']})
    env['environmentVariables'] = authority.ordered(list(variables.values()), 'name', {'name', 'value', 'type'})
    actual_env = loads(encoded(build.get('environment', {})))
    actual_env['environmentVariables'] = authority.ordered(actual_env.get('environmentVariables'), 'name', {'name', 'value', 'type'})
    need(build.get('sourceVersion') == start['sourceVersion'] and build.get('timeoutInMinutes') == 30
         and build.get('queuedTimeoutInMinutes') == 5
         and build.get('source') == dict(project['source'], location=start['sourceLocationOverride'], buildspec=start['buildspecOverride'])
         and actual_env == env and build.get('serviceRole') == ROLE and build.get('encryptionKey') == KMS
         and build.get('cache') == project['cache'] and build.get('artifacts') == {'location': ''}
         and build.get('logs', {}).get('cloudWatchLogs') == project['logsConfig']['cloudWatchLogs'], 'full build source/role/retry/config')
    need(build.get('vpcConfig') in (None, {}) and not any(build.get(k) for k in ('secondarySources', 'secondarySourceVersions',
         'secondaryArtifacts', 'fileSystemLocations', 'buildBatchArn')) and not build.get('logs', {}).get('s3Logs'), 'build secondary/network refusal')


def dispatch(evidence, request, raw, review_sha, call):
    """Private synthetic transport seam. Production passes only canonical bounded capture."""
    need(call('caller', ['sts', 'get-caller-identity']) == request['authority']['caller'], 'fresh full caller')
    authority.one_project(call, 'project', request['builderProject'])
    def complete(label, args):
        value = call(label, args); need('nextToken' not in value and 'NextToken' not in value, 'incomplete activity page'); return value
    need(all(r.get('buildStatus') in {'SUCCEEDED', 'FAILED', 'FAULT', 'STOPPED', 'TIMED_OUT'}
             for r in authority.existing_builds(complete, 'activity')), 'active/unknown builder')
    need(request['helperFiles'] == pins(), 'closure before reserve')
    save(evidence/'execution-reserved.json', {'requestSha256': sha(raw), 'reviewSha256': review_sha, 'runUuid': request['runUuid'], 'retryAllowed': False})
    def mutate(label, args):
        save(evidence/(label+'-attempted.json'), {'arguments': args, 'status': 'OUTCOME_UNKNOWN_NO_RETRY'})
        return call(label, args)
    try:
        checksum = base64.b64encode(bytes.fromhex(request['archive']['sha256'])).decode('ascii')
        metadata = {'sourcecommit': request['sourceCommit'], 'archivesha256': request['archive']['sha256']}
        need(call('upload-caller', ['sts', 'get-caller-identity']) == request['authority']['caller'], 'upload caller')
        need(sha(read(evidence/'source.zip', 8*1024*1024)) == request['archive']['sha256'], 'preupload bytes')
        upload = mutate('upload', ['s3api', 'put-object', '--bucket', BUCKET, '--key', request['archive']['key'], '--body', str(evidence/'source.zip'),
            '--if-none-match', '*', '--server-side-encryption', 'aws:kms', '--ssekms-key-id', KMS, '--checksum-algorithm', 'SHA256',
            '--checksum-sha256', checksum, '--metadata', encoded(metadata).decode('ascii')])
        version = upload.get('VersionId'); start = start_input(request, version)
        need(upload.get('ChecksumSHA256') == checksum and upload.get('ServerSideEncryption') == 'aws:kms' and upload.get('SSEKMSKeyId') == KMS, 'upload ACK')
        head = call('source-head', ['s3api', 'head-object', '--bucket', BUCKET, '--key', request['archive']['key'], '--version-id', version, '--checksum-mode', 'ENABLED'])
        need(head.get('VersionId') == version and head.get('ChecksumSHA256') == checksum and head.get('ContentLength') == request['archive']['bytes']
             and head.get('Metadata') == metadata and head.get('ServerSideEncryption') == 'aws:kms' and head.get('SSEKMSKeyId') == KMS, 'exact immutable source HEAD')
        save(evidence/'start-build-input.json', start)
        authority.one_project(call, 'dispatch-project', request['builderProject'])
        need(call('dispatch-caller', ['sts', 'get-caller-identity']) == request['authority']['caller'] and request['helperFiles'] == pins()
             and sha(read(evidence/'source.zip', 8*1024*1024)) == request['archive']['sha256'], 'immediate dispatch binding')
        result = mutate('start-build', ['codebuild', 'start-build', '--cli-input-json', 'file://'+str(evidence/'start-build-input.json')])
        validate_build(result['build'], request, start)
        outcome = {'status': 'DISPATCHED_NOT_ACCEPTED', 'buildId': result['build']['id'], 'sourceVersion': version, 'runtimeAdmitted': False}
        save(evidence/'outcome.json', outcome); return outcome
    except BaseException as error:
        save(evidence/'outcome.json', {'status': 'CONSUMED_UNKNOWN_NO_RETRY', 'errorClass': type(error).__name__, 'runtimeAdmitted': False}); raise


def execute(path, review_file, review_sha):
    evidence = slot(path); need(not (evidence/'execution-reserved.json').exists(), 'consumed; read-only reconciliation only')
    request, raw = load(evidence); check_review(request, raw, read(Path(review_file).absolute(), 65536), review_sha)
    end = time.monotonic()+600
    def call(label, args):
        remaining = min(45, end-time.monotonic()); need(remaining > 0, 'whole dispatch deadline')
        value = aws_evidence.capture(evidence, label, args, timeout=remaining, profile='default')
        need(loads(read(evidence/label/'stdout.bin', 8*1024*1024)) == value, 'strict captured API JSON')
        return value
    return dispatch(evidence, request, raw, review_sha, call)


def reconcile(path):
    evidence = slot(path); request, raw = load(evidence)
    need(loads(read(evidence/'execution-reserved.json', 65536))['requestSha256'] == sha(raw), 'consumed request required')
    destination = evidence/'read-only-reconciliation'; destination.mkdir(exist_ok=False)
    end = time.monotonic()+300
    def call(label, args):
        need(end-time.monotonic() > 0, 'readback deadline')
        value = aws_evidence.capture(destination, label, args, timeout=min(45, end-time.monotonic()), profile='default')
        need(loads(read(destination/label/'stdout.bin', 8*1024*1024)) == value, 'strict captured API JSON')
        need(type(value) is dict and 'nextToken' not in value and 'NextToken' not in value, 'complete readback'); return value
    need(call('caller', ['sts', 'get-caller-identity']) == request['authority']['caller'], 'readback caller')
    authority.one_project(call, 'project', request['builderProject'])
    builds = authority.existing_builds(call, 'activity'); matched = []
    if (evidence/'start-build-input.json').exists():
        start = loads(read(evidence/'start-build-input.json', 65536))
        need(start == start_input(request, start['sourceVersion']), 'retained exact start request')
        for build in builds:
            if build.get('sourceVersion') == start['sourceVersion'] and build.get('source', {}).get('location') == start['sourceLocationOverride']:
                validate_build(build, request, start); matched.append({'id': build['id'], 'status': build.get('buildStatus')})
    need(len(matched) <= 1, 'ambiguous build')
    result = {'status': 'READ_ONLY_NOT_ACCEPTANCE', 'matchingBuilds': matched, 'absenceProven': False, 'retryAllowed': False}
    save(destination/'result.json', result); return result


def main():
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument('action', choices=['prepare', 'execute', 'reconcile']); parser.add_argument('--evidence', required=True)
    for name in ('source-commit', 'authority-file', 'authority-sha256', 'review-file', 'review-sha256'): parser.add_argument('--'+name)
    args = parser.parse_args()
    if args.action == 'prepare':
        need(args.source_commit and args.authority_file and args.authority_sha256 and not (args.review_file or args.review_sha256), 'prepare requires exact source and external authority pin')
        result = prepare(args.source_commit, args.evidence, args.authority_file, args.authority_sha256)
    elif args.action == 'execute':
        need(args.review_file and args.review_sha256 and not (args.source_commit or args.authority_file or args.authority_sha256), 'execute requires separate review only')
        result = execute(args.evidence, args.review_file, args.review_sha256)
    else:
        need(not any((args.source_commit, args.authority_file, args.authority_sha256, args.review_file, args.review_sha256)), 'read-only reconciliation takes no authority overrides')
        result = reconcile(args.evidence)
    print(encoded(result).decode('ascii'), end='')


if __name__ == '__main__':
    try: main()
    except Exception:
        print('Worker build refused/failed; preserve consumed evidence and reconcile only.', file=sys.stderr)
        raise SystemExit(2) from None
