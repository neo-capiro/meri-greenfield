"""Owner-only v3 support packaging: local preparation, one reviewed dispatch, read-only reconciliation.

Default is prepare. Execute never polls, retries a mutation, runs assets or admits an image.
Review JSON must bind request/helper/archive/recipe hashes with decision
APPROVE_ONE_HOST_ASSETS_BUILD_V3. Unknown outcomes consume the reservation permanently.
"""
import argparse
import base64
import datetime as dt
from pathlib import Path
import re
import uuid

import aws_evidence
import host_assets_source as source

ROOT = source.ROOT
ACCOUNT, REGION = '967807252336', 'us-east-1'
PRINCIPAL = 'arn:aws:iam::967807252336:user/capirocli'
PROJECT = 'meri-greenfield-qualification-build'
BUCKET = 'meri-greenfield-qual-build-967807252336-us-east-1'
KMS = 'arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042'
REPOSITORY = 'meri-greenfield/qualification-worker'
REPOSITORY_URI = ACCOUNT + '.dkr.ecr.' + REGION + '.amazonaws.com/' + REPOSITORY
BUILDER_ROLE = 'arn:aws:iam::967807252336:role/MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H'
PROJECT_FILE = 'docs/coordination/private-evidence/qualification-build-context/project.json'
PROJECT_SHA = '4a4279a20d8a9b4c3dff4088c560b2f1e340ce0fdbac66966e719d684b7788e6'
LEGACY_SPEC_SHA = 'f2b85ee04a9bf77c71d1c5032e0b6152f1ac0fbb1bc161f08ce64c146ef97433'
HELPERS = ('host_assets_source.py', 'host_assets_build.py', 'aws_evidence.py',
           'teststate_request.py', 'readonly_shapes.py')
require, sha, json_bytes, parse_json = source.require, source.sha, source.json_bytes, source.parse_json
save_new, write_new = source.save_new, source.write_new


def ordered(records, key, fields):
    require(isinstance(records, list) and all(isinstance(row, dict) and set(row) == fields for row in records), 'configuration record fields')
    require(all(isinstance(row[key], str) for row in records) and len({row[key] for row in records}) == len(records), 'configuration record names')
    return sorted(records, key=lambda row: row[key])


def project_configuration(project):
    # Compare EVERY non-observational project field; unknown additions refuse.
    value = parse_json(json_bytes(project))
    require(isinstance(value, dict), 'project object')
    for key in ('created', 'lastModified'):
        value.pop(key, None)
    env = value.get('environment')
    require(isinstance(env, dict), 'project environment')
    env['environmentVariables'] = ordered(env.get('environmentVariables'), 'name', {'name', 'value', 'type'})
    require(all(row['type'] == 'PLAINTEXT' and isinstance(row['value'], str) for row in env['environmentVariables']), 'secret or nonstring project environment')
    value['tags'] = ordered(value.get('tags'), 'key', {'key', 'value'})
    return value


def reviewed_project():
    raw = (ROOT / PROJECT_FILE).read_bytes()
    require(sha(raw) == PROJECT_SHA, 'fixed builder evidence drift')
    evidence = parse_json(raw)
    require(set(evidence) == {'projects', 'projectsNotFound'} and evidence['projectsNotFound'] == [] and len(evidence['projects']) == 1, 'fixed builder evidence shape')
    project = project_configuration(evidence['projects'][0])
    require(project.get('arn') == f'arn:aws:codebuild:{REGION}:{ACCOUNT}:project/{PROJECT}' and project.get('serviceRole') == BUILDER_ROLE and project.get('encryptionKey') == KMS, 'builder authority identity')
    require(sha(project['source']['buildspec'].encode()) == LEGACY_SPEC_SHA, 'configured worker recipe drift')
    return project


def helper_records():
    return [{'path': 'scripts/qualification/' + name, 'bytes': len(raw), 'sha256': sha(raw)}
            for name in HELPERS for raw in [(ROOT / 'scripts/qualification' / name).read_bytes()]]


def evidence_path(path, create=False):
    value = Path(path).absolute()
    parent = ROOT / 'docs/coordination/private-evidence'
    require(value.parent == parent and re.fullmatch(r'CODEX-G1-host-assets-[a-z0-9-]{1,100}', value.name), 'fixed new evidence path required')
    require(not value.is_symlink() and value.resolve() == value and value.parent.resolve() == parent.absolute(), 'evidence reparse/parent alias refused')
    if create:
        value.mkdir(exist_ok=False)
    else:
        require(value.is_dir(), 'prepared evidence missing')
    return value


def request_for(commit, content, archive, token, created):
    digest = sha(archive)
    return {'schema': 'meri-host-assets-build-review/3', 'sourceCommit': commit,
            'createdAt': created, 'idempotencyToken': token,
            'content': content, 'helperFiles': helper_records(),
            'builderProject': reviewed_project(), 'builderEvidenceSha256': PROJECT_SHA,
            'legacyConfiguredBuildspecSha256': LEGACY_SPEC_SHA,
            'legacyConfiguredBuildspecExecution': 'FORBIDDEN: exact v3 buildspec override only',
            'archive': {'name': 'source.zip', 'bytes': len(archive), 'entries': 28,
                        'sha256': digest, 'key': 'inputs/host-assets-' + commit + '/' + digest + '.zip'},
            'imageTag': 'host-assets-' + commit,
            'resultKey': 'results/host-assets-' + commit + '/manifest.json',
            'target': {'account': ACCOUNT, 'region': REGION, 'profile': 'capiro-dev', 'principal': PRINCIPAL,
                       'project': PROJECT, 'bucket': BUCKET, 'repositoryUri': REPOSITORY_URI, 'kmsKeyArn': KMS},
            'admission': 'ONE support packaging dispatch only; no runtime, worker build or security/G1 acceptance'}


def prepare(commit, path):
    evidence = evidence_path(path, create=True)
    (evidence / 'git-prepare').mkdir()
    content, archive, files = source.snapshot(ROOT, commit, evidence / 'git-prepare')
    request = request_for(commit, content, archive, str(uuid.uuid4()), dt.datetime.now(dt.timezone.utc).isoformat())
    write_new(evidence / 'source.zip', archive)
    write_new(evidence / 'buildspec-override.json', files[content['buildspec']['path']])
    save_new(evidence / 'review-request.json', request)
    save_new(evidence / 'prepared.json', {'status': 'PREPARED_LOCAL_ONLY', 'requestSha256': sha(json_bytes(request)), 'awsCalls': 0})
    return {'status': 'PREPARED_LOCAL_ONLY', 'evidence': str(evidence), 'requestSha256': sha(json_bytes(request)), 'awsCalls': 0}


def load_prepared(evidence, remeasure=True):
    raw = (evidence / 'review-request.json').read_bytes()
    request = parse_json(raw)
    require(request.get('schema') == 'meri-host-assets-build-review/3', 'review schema')
    token = request.get('idempotencyToken')
    require(isinstance(token, str) and str(uuid.UUID(token)) == token and uuid.UUID(token).version == 4, 'UUID v4 token required')
    if remeasure:
        (evidence / 'git-execute').mkdir(exist_ok=False)
        content, archive, files = source.snapshot(ROOT, request['sourceCommit'], evidence / 'git-execute')
        expected = request_for(request['sourceCommit'], content, archive, token, request['createdAt'])
        require(request == expected and raw == json_bytes(expected), 'prepared source/helper/authority request drift')
        require((evidence / 'source.zip').read_bytes() == archive and (evidence / 'buildspec-override.json').read_bytes() == files[content['buildspec']['path']], 'prepared archive/recipe drift')
    else:
        require(raw == json_bytes(request) and request['helperFiles'] == helper_records(), 'reconcile request/helper drift')
        require(json_bytes(request['builderProject']) == json_bytes(reviewed_project()) and request['content'] == source.content_for(request['sourceCommit']), 'reconcile fixed authority drift')
    return request, raw


def check_review(request, raw, review, digest):
    require(re.fullmatch('[a-f0-9]{64}', digest or '') and sha(review) == digest, 'review raw SHA256 mismatch')
    value = parse_json(review)
    fields = {'decision', 'requestSha256', 'sourceCommit', 'archiveSha256', 'buildspecSha256', 'helperFilesSha256', 'reviewer', 'notes'}
    require(isinstance(value, dict) and set(value) == fields and value['decision'] == 'APPROVE_ONE_HOST_ASSETS_BUILD_V3', 'exact independent review decision required')
    for key, expected in {'requestSha256': sha(raw), 'sourceCommit': request['sourceCommit'],
                          'archiveSha256': request['archive']['sha256'], 'buildspecSha256': request['content']['buildspec']['sha256'],
                          'helperFilesSha256': sha(json_bytes(request['helperFiles']))}.items():
        require(value[key] == expected, 'review binding mismatch: ' + key)
    require(all(isinstance(value[key], str) and 0 < len(value[key]) <= 4000 for key in ('reviewer', 'notes')), 'review attribution required')


def build_input(request, version, spec):
    require(isinstance(version, str) and re.fullmatch('[A-Za-z0-9._~+/=-]{1,1024}', version) and not version.startswith('-') and version != 'null', 'immutable S3 version required')
    variables = {'IMAGE_TAG': request['imageTag'], 'SOURCE_COMMIT': request['sourceCommit'],
                 'SOURCE_S3_VERSION': version, 'SOURCE_ARCHIVE_SHA256': request['archive']['sha256'],
                 'ASSET_EXPECTED_B64': base64.b64encode(json_bytes(request['content'])).decode()}
    return {'projectName': PROJECT, 'sourceTypeOverride': 'S3',
            'sourceLocationOverride': BUCKET + '/' + request['archive']['key'], 'sourceVersion': version,
            'buildspecOverride': spec, 'timeoutInMinutesOverride': 10, 'queuedTimeoutInMinutesOverride': 5,
            'environmentVariablesOverride': [{'name': key, 'value': value, 'type': 'PLAINTEXT'} for key, value in variables.items()],
            'idempotencyToken': request['idempotencyToken']}


def validate_build(build, request, start):
    prefix = PROJECT + ':'
    identifier = build.get('id', '')
    require(identifier.startswith(prefix) and re.fullmatch('[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', identifier[len(prefix):]) and build.get('arn') == f'arn:aws:codebuild:{REGION}:{ACCOUNT}:build/' + identifier and build.get('projectName') == PROJECT, 'returned build identity')
    project = request['builderProject']
    environment = parse_json(json_bytes(project['environment']))
    variables = {row['name']: row for row in environment['environmentVariables']}
    variables.update({row['name']: row for row in start['environmentVariablesOverride']})
    environment['environmentVariables'] = ordered(list(variables.values()), 'name', {'name', 'value', 'type'})
    actual_env = parse_json(json_bytes(build.get('environment', {})))
    actual_env['environmentVariables'] = ordered(actual_env.get('environmentVariables'), 'name', {'name', 'value', 'type'})
    require(build.get('sourceVersion') == start['sourceVersion'] and build.get('timeoutInMinutes') == 10 and build.get('queuedTimeoutInMinutes') == 5, 'returned source version/deadline drift')
    require(build.get('source') == dict(project['source'], location=start['sourceLocationOverride'], buildspec=start['buildspecOverride']) and json_bytes(actual_env) == json_bytes(environment) and build.get('serviceRole') == project['serviceRole'] and build.get('encryptionKey') == KMS and build.get('cache') == project['cache'], 'returned build authority/override drift')
    require(build.get('artifacts') == {'location': ''} and build.get('logs', {}).get('cloudWatchLogs') == project['logsConfig']['cloudWatchLogs'], 'returned artifact/log drift')
    require(build.get('vpcConfig') in (None, {}) and not any(build.get(key) for key in ('secondarySources', 'secondarySourceVersions', 'secondaryArtifacts', 'fileSystemLocations', 'buildBatchArn')) and not build.get('logs', {}).get('s3Logs'), 'returned network/secondary/batch configuration')


def identity(call, label):
    result = call(label, ['sts', 'get-caller-identity'])
    require(result.get('Account') == ACCOUNT and result.get('Arn') == PRINCIPAL, 'fresh STS identity mismatch')


def one_project(call, label, expected):
    result = call(label, ['codebuild', 'batch-get-projects', '--names', PROJECT])
    require(result.get('projectsNotFound') == [] and len(result.get('projects', [])) == 1, 'missing/ambiguous builder')
    require(json_bytes(project_configuration(result['projects'][0])) == json_bytes(expected), 'full builder configuration drift')


def existing_builds(call, prefix):
    result = call(prefix + '-list', ['codebuild', 'list-builds-for-project', '--project-name', PROJECT, '--sort-order', 'DESCENDING'])
    ids = result.get('ids')
    require(isinstance(ids, list) and len(ids) <= 100 and len(set(ids)) == len(ids) and not result.get('nextToken') and all(isinstance(value, str) and value.startswith(PROJECT + ':') for value in ids), 'builder activity incomplete/invalid')
    if not ids:
        return []
    result = call(prefix + '-describe', ['codebuild', 'batch-get-builds', '--ids', *ids])
    builds = result.get('builds', [])
    require(result.get('buildsNotFound', []) == [] and len(builds) == len(ids) and {row.get('id') for row in builds} == set(ids), 'builder activity readback incomplete')
    return builds


def execute(path, review_path, review_sha, capture=None):
    evidence = evidence_path(path)
    require(not (evidence / 'execution-reserved.json').exists(), 'reservation already consumed; read-only reconciliation only')
    request, raw = load_prepared(evidence)
    check_review(request, raw, Path(review_path).read_bytes(), review_sha)
    save_new(evidence / 'execution-reserved.json', {'requestSha256': sha(raw), 'reviewSha256': review_sha,
             'idempotencyToken': request['idempotencyToken'], 'reservedAt': dt.datetime.now(dt.timezone.utc).isoformat()})
    capture = aws_evidence.capture if capture is None else capture
    def call(label, args, mutation=False):
        if mutation:
            save_new(evidence / (label + '-attempted.json'), {'arguments': args, 'requestSha256': sha(raw), 'status': 'MUTATION_OUTCOME_UNKNOWN_UNTIL_READBACK'})
        return capture(evidence, label, args)
    try:
        identity(call, 'preflight-identity')
        repo = call('repository', ['ecr', 'describe-repositories', '--repository-names', REPOSITORY]).get('repositories', [])
        require(len(repo) == 1 and repo[0].get('repositoryArn') == f'arn:aws:ecr:{REGION}:{ACCOUNT}:repository/{REPOSITORY}' and repo[0].get('repositoryUri') == REPOSITORY_URI and repo[0].get('imageTagMutability') == 'IMMUTABLE' and repo[0].get('encryptionConfiguration') == {'encryptionType': 'KMS', 'kmsKey': KMS}, 'repository identity/immutability/KMS drift')
        one_project(call, 'project-preflight', request['builderProject'])
        require(all(build.get('buildStatus') in {'SUCCEEDED', 'FAILED', 'FAULT', 'STOPPED', 'TIMED_OUT'} for build in existing_builds(call, 'activity')), 'active/unknown builder activity')
        archive = (evidence / 'source.zip').read_bytes()
        checksum = base64.b64encode(bytes.fromhex(request['archive']['sha256'])).decode()
        identity(call, 'upload-identity')
        require(sha(archive) == request['archive']['sha256'] and request['helperFiles'] == helper_records(), 'local authority changed before upload')
        metadata = {'sourcecommit': request['sourceCommit'], 'archivesha256': request['archive']['sha256']}
        upload = call('upload', ['s3api', 'put-object', '--bucket', BUCKET, '--key', request['archive']['key'], '--body', str(evidence / 'source.zip'), '--if-none-match', '*', '--server-side-encryption', 'aws:kms', '--ssekms-key-id', KMS, '--checksum-algorithm', 'SHA256', '--checksum-sha256', checksum, '--metadata', json_bytes(metadata).decode()], mutation=True)
        version = upload.get('VersionId')
        start = build_input(request, version, (evidence / 'buildspec-override.json').read_text(encoding='utf-8'))
        require(upload.get('ChecksumSHA256') == checksum and upload.get('ServerSideEncryption') == 'aws:kms' and upload.get('SSEKMSKeyId') == KMS, 'upload checksum/KMS unconfirmed')
        head = call('source-head', ['s3api', 'head-object', '--bucket', BUCKET, '--key', request['archive']['key'], '--version-id', version, '--checksum-mode', 'ENABLED'])
        require(head.get('VersionId') == version and head.get('ChecksumSHA256') == checksum and head.get('ContentLength') == len(archive) and head.get('ServerSideEncryption') == 'aws:kms' and head.get('SSEKMSKeyId') == KMS and head.get('Metadata') == metadata, 'source version/checksum/metadata readback drift')
        save_new(evidence / 'source-verified.json', {'sourceVersion': version, 'checksumSHA256': checksum})
        save_new(evidence / 'start-build-input.json', start)
        one_project(call, 'project-dispatch', request['builderProject'])
        identity(call, 'dispatch-identity')
        require(request['helperFiles'] == helper_records() and sha((evidence / 'source.zip').read_bytes()) == request['archive']['sha256'] and sha((evidence / 'buildspec-override.json').read_bytes()) == request['content']['buildspec']['sha256'] and (evidence / 'start-build-input.json').read_bytes() == json_bytes(start), 'local dispatch authority drift')
        result = call('start-build', ['codebuild', 'start-build', '--cli-input-json', 'file://' + str(evidence / 'start-build-input.json')], mutation=True)
        build = result.get('build', {})
        validate_build(build, request, start)
        outcome = {'status': 'DISPATCHED_NOT_ACCEPTED', 'buildId': build['id'], 'buildArn': build['arn'], 'sourceVersion': version, 'requestSha256': sha(raw)}
        save_new(evidence / 'outcome.json', outcome)
        return outcome
    except BaseException as error:
        save_new(evidence / 'outcome.json', {'status': 'STOPPED_OR_OUTCOME_UNCERTAIN', 'errorType': type(error).__name__, 'requestSha256': sha(raw), 'recovery': 'Reservation remains consumed. Read-only reconciliation required; never retry upload or StartBuild.'})
        raise


def reconcile(path, capture=None):
    """Read-only observations after uncertain dispatch. No mutation, retry or acceptance."""
    evidence = evidence_path(path)
    require((evidence / 'execution-reserved.json').is_file(), 'no consumed reservation')
    request, raw = load_prepared(evidence, remeasure=False)
    require(parse_json((evidence / 'execution-reserved.json').read_bytes())['requestSha256'] == sha(raw), 'reservation binding drift')
    destination = evidence / ('reconcile-' + str(uuid.uuid4()))
    destination.mkdir(exist_ok=False)
    capture = aws_evidence.capture if capture is None else capture
    call = lambda label, args: capture(destination, label, args)
    identity(call, 'identity')
    one_project(call, 'project', request['builderProject'])
    builds = existing_builds(call, 'activity')
    observed_source = None
    if (evidence / 'upload-attempted.json').is_file():
        head = call('source-head', ['s3api', 'head-object', '--bucket', BUCKET, '--key', request['archive']['key'], '--checksum-mode', 'ENABLED'])
        checksum = base64.b64encode(bytes.fromhex(request['archive']['sha256'])).decode()
        require(head.get('ContentLength') == request['archive']['bytes'] and head.get('ChecksumSHA256') == checksum and head.get('ServerSideEncryption') == 'aws:kms' and head.get('SSEKMSKeyId') == KMS and head.get('Metadata') == {'sourcecommit': request['sourceCommit'], 'archivesha256': request['archive']['sha256']}, 'reconcile source readback drift')
        observed_source = {'versionId': head.get('VersionId'), 'checksumSHA256': checksum}
    matched = []
    start_path = evidence / 'start-build-input.json'
    if start_path.is_file():
        start = parse_json(start_path.read_bytes())
        version = parse_json((evidence / 'source-verified.json').read_bytes())['sourceVersion']
        require(start == build_input(request, version, (evidence / 'buildspec-override.json').read_text(encoding='utf-8')), 'reconcile StartBuild input drift')
        for build in builds:
            if build.get('sourceVersion') == version and build.get('source', {}).get('location') == start['sourceLocationOverride']:
                validate_build(build, request, start)
                matched.append({'id': build['id'], 'status': build.get('buildStatus')})
    result = {'status': 'READ_ONLY_RECONCILIATION_NOT_ACCEPTANCE', 'requestSha256': sha(raw), 'matchingBuilds': matched, 'observedSource': observed_source,
              'limits': 'A missing match does not prove no launch. Pagination/unknowns refuse. Owner must reconcile S3 upload and any build; reservation never becomes reusable.'}
    save_new(destination / 'result.json', result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--execute', action='store_true')
    mode.add_argument('--reconcile', action='store_true')
    parser.add_argument('--source-commit')
    parser.add_argument('--evidence', required=True)
    parser.add_argument('--review-file')
    parser.add_argument('--review-sha256')
    args = parser.parse_args()
    if args.execute:
        require(not args.source_commit and args.review_file and args.review_sha256, 'execute requires prepared evidence and exact review only')
        result = execute(args.evidence, args.review_file, args.review_sha256)
    elif args.reconcile:
        require(not (args.source_commit or args.review_file or args.review_sha256), 'reconcile takes prepared evidence only')
        result = reconcile(args.evidence)
    else:
        require(args.source_commit and not (args.review_file or args.review_sha256), 'prepare requires explicit source commit only')
        result = prepare(args.source_commit, args.evidence)
    print(json_bytes(result).decode(), end='')


if __name__ == '__main__':
    main()