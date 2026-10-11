"""Fixed CodeBuild ECR publication after SDK worker static evidence and cleanup.

No scan, runtime, or G1 admission is made here. An attempted push is never retried.
"""
import json
import os
from pathlib import Path
import re
import secrets
import signal
import stat
import subprocess
import time

import worker_image_collect as evidence

ACCOUNT = '967807252336'
REGION = 'us-east-1'
REPOSITORY = 'meri-greenfield/qualification-worker'
URI = ACCOUNT+'.dkr.ecr.'+REGION+'.amazonaws.com/'+REPOSITORY
KMS = 'arn:aws:kms:us-east-1:'+ACCOUNT+':key/1cca74fc-d9ae-43a6-8bfd-b93107e90042'
BUILDER_ROLE = 'MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H'
PARENT = Path('/tmp')
AUTH_PREFIX = 'meri-worker-auth.'
SHA = re.compile(r'sha256:[a-f0-9]{64}')


def validate_publication(value, commit, token):
    evidence.need(type(value) is dict and value == {
        'repositoryName': REPOSITORY, 'repositoryUri': URI,
        'imageTag': 'sdk-'+commit+'-'+token, 'scanAdmission': 'HOLD'},
        'fixed source/run publication binding')
    evidence.need(re.fullmatch(r'[a-f0-9]{40}', commit) and
                  re.fullmatch(r'[a-f0-9-]{36}', token), 'publication source/run identity')
    return value


def _json(raw):
    return evidence.loads(raw)


def _caller(raw):
    value = _json(raw)
    evidence.need(type(value) is dict and set(value) == {'Account', 'Arn', 'UserId'}
                  and value['Account'] == ACCOUNT and type(value['UserId']) is str
                  and 0 < len(value['UserId']) <= 256
                  and type(value['Arn']) is str and value['Arn'].startswith(
                      'arn:aws:sts::'+ACCOUNT+':assumed-role/'+BUILDER_ROLE+'/'),
                  'fixed CodeBuild caller')
    return value


def _readback(description_raw, manifest_raw, tag, iid):
    description = _json(description_raw)
    rows = description.get('imageDetails') if type(description) is dict else None
    evidence.need(type(rows) is list and len(rows) == 1, 'single exact ECR tag')
    row = rows[0]; digest = row.get('imageDigest')
    evidence.need(row.get('registryId') == ACCOUNT and row.get('repositoryName') == REPOSITORY
                  and type(row.get('imageTags')) is list and tag in row['imageTags']
                  and type(digest) is str and SHA.fullmatch(digest), 'exact tagged ECR digest')
    batch = _json(manifest_raw)
    images = batch.get('images') if type(batch) is dict else None
    evidence.need(type(images) is list and len(images) == 1 and batch.get('failures') == [], 'single ECR manifest')
    image = images[0]; image_id = image.get('imageId')
    raw = image.get('imageManifest')
    evidence.need(image.get('registryId') == ACCOUNT and image.get('repositoryName') == REPOSITORY
                  and type(image_id) is dict and image_id.get('imageDigest') == digest
                  and image_id.get('imageTag') == tag and type(raw) is str and len(raw) <= 8*1024*1024
                  and 'sha256:'+evidence.digest(raw.encode('utf-8')) == digest, 'exact registry manifest hash')
    content = _json(raw.encode('utf-8'))
    evidence.need(type(content) is dict and content.get('schemaVersion') == 2
                  and type(content.get('config')) is dict and content['config'].get('digest') == iid,
                  'registry config/local image IID binding')
    return digest


def _kill(child):
    if child is not None and child.poll() is None:
        try: os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError: pass
        child.wait(timeout=5)


def _wait(child, seconds):
    try: return child.wait(timeout=seconds)
    except subprocess.TimeoutExpired:
        _kill(child)
        raise TimeoutError('private command deadline') from None


def private_run(argv, seconds):
    """Never retain command output or credentials; no shell or automatic retry."""
    evidence.need(0 < seconds <= 300, 'private command deadline bound')
    child = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, shell=False, start_new_session=True)
    try: evidence.need(_wait(child, seconds) == 0, 'private command failed')
    finally: _kill(child)


def private_login(directory, seconds):
    """Pipe the AWS password directly to Docker stdin without reading or logging it."""
    evidence.need(0 < seconds <= 90, 'login deadline bound')
    aws = docker = None; start = time.monotonic()
    try:
        aws = subprocess.Popen(['aws', 'ecr', 'get-login-password', '--region', REGION],
                               stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                               shell=False, start_new_session=True)
        docker = subprocess.Popen(['docker', '--config', str(directory), 'login', '--username', 'AWS',
                                   '--password-stdin', URI.split('/')[0]],
                                  stdin=aws.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                  shell=False, start_new_session=True)
        aws.stdout.close()
        docker_code = _wait(docker, seconds)
        remaining = seconds-(time.monotonic()-start)
        evidence.need(remaining > 0 and _wait(aws, remaining) == 0 and docker_code == 0,
                      'private ECR login failed')
    finally:
        _kill(docker); _kill(aws)


def make_auth():
    parent = PARENT.lstat()
    evidence.need(stat.S_ISDIR(parent.st_mode) and parent.st_uid == 0 and
                  stat.S_IMODE(parent.st_mode) == 0o1777, 'fixed trusted auth parent')
    nonce = secrets.token_hex(4)
    path = PARENT/(AUTH_PREFIX+nonce)
    path.mkdir(mode=0o700, exist_ok=False)
    observed = path.lstat()
    evidence.need(stat.S_ISDIR(observed.st_mode) and observed.st_uid == 0 and
                  stat.S_IMODE(observed.st_mode) == 0o700 and observed.st_dev > 0 and
                  observed.st_ino > 0, 'private owned Docker config')
    return path, nonce, (observed.st_dev, observed.st_ino)


def execute(output, manifest, static_result, call, end, *, login=private_login,
            private=private_run, auth=make_auth):
    """Consume one push attempt. Only dependency seams are replaceable in offline tests."""
    output = Path(output); commit = manifest['sourceCommit']; token = manifest['runUuid']
    binding = validate_publication(manifest['publication'], commit, token)
    iid = static_result.get('image', {}).get('Id')
    evidence.need(static_result.get('sourceCommit') == commit and static_result.get('status') == 'BUILD_ONLY_STATIC_EVIDENCE'
                  and static_result.get('captureComplete') is True and static_result.get('physicalCleanupConfirmed') is True
                  and static_result.get('containerStarted') is False and static_result.get('ecrPublished') is False
                  and type(iid) is str and SHA.fullmatch(iid), 'static result and owned cleanup before ECR')
    source_post = _json(evidence.read(output/'source-post.json', 65536))
    evidence.need(source_post == {'sourceStable': True, 'inputManifestSha256': os.environ['INPUT_MANIFEST_SHA256'],
                                  'contextManifestSha256': evidence.CONTEXT_SHA},
                  'source-post gate before ECR')
    result = {'schema': 'meri-worker-image-publication/1', 'status': 'FAILED_OR_UNKNOWN',
              'sourceCommit': commit, 'runUuid': token, 'imageTag': binding['imageTag'],
              'imageId': iid, 'pushAttempted': False, 'retryAllowed': False,
              'scanAdmitted': False, 'runtimeAdmitted': False, 'g1Admitted': False}
    directory = None; identity = None; cleanup_ok = False; logout_ok = False; published = None
    try:
        evidence.need(time.monotonic()+180 < end, 'publication/readback/cleanup reserve')
        caller = _caller(call('ecr-caller', ['aws', 'sts', 'get-caller-identity', '--region', REGION,
                                             '--output', 'json', '--no-cli-pager'], 45, 65536))
        directory, nonce, identity = auth()
        login(directory, min(90, end-time.monotonic()-150))
        target = URI+':'+binding['imageTag']
        call('ecr-tag', ['docker', '--config', str(directory), 'tag', iid, target], 45, 65536)
        evidence.need(_caller(call('ecr-push-caller', ['aws', 'sts', 'get-caller-identity', '--region', REGION,
                             '--output', 'json', '--no-cli-pager'], 45, 65536)) == caller, 'fresh equal builder caller')
        evidence.need(_json(evidence.read(output/'source-post.json', 65536)) == source_post,
                      'source-post drift before push')
        evidence.save(output/'ecr-push-attempt.json', {'sourceCommit': commit, 'runUuid': token,
                      'imageId': iid, 'imageTag': binding['imageTag'], 'retryAllowed': False,
                      'status': 'OUTCOME_UNKNOWN_NO_RETRY'})
        result['pushAttempted'] = True
        private(['docker', '--config', str(directory), 'push', target],
                min(240, end-time.monotonic()-150))
        described = call('ecr-image', ['aws', 'ecr', 'describe-images', '--repository-name', REPOSITORY,
                         '--image-ids', 'imageTag='+binding['imageTag'], '--region', REGION,
                         '--output', 'json', '--no-cli-pager'], 60, 8*1024*1024)
        row = _json(described)['imageDetails'][0]; digest = row['imageDigest']
        evidence.need(type(digest) is str and SHA.fullmatch(digest), 'ECR digest pre-readback')
        raw_manifest = call('ecr-manifest', ['aws', 'ecr', 'batch-get-image', '--repository-name', REPOSITORY,
                            '--image-ids', 'imageTag='+binding['imageTag'], '--region', REGION,
                            '--output', 'json', '--no-cli-pager'], 60, 8*1024*1024)
        published = _readback(described, raw_manifest, binding['imageTag'], iid)
        result['imageDigest'] = published
    except BaseException as error:
        result['failureClass'] = type(error).__name__
    finally:
        if directory is not None:
            try:
                private(['docker', '--config', str(directory), 'logout', URI.split('/')[0]],
                        min(30, max(1, end-time.monotonic()-40)))
                logout_ok = True
            except BaseException as error: result['logoutFailureClass'] = type(error).__name__
            try:
                raw = call('ecr-auth-cleanup', ['python3', '-I', '-B', '-S',
                           'scripts/clear-qualification-docker-config.py', '--nonce', nonce,
                           '--identity', str(identity[0])+':'+str(identity[1])], 35, 65536)
                receipt = _json(raw)
                evidence.need(receipt.get('schema') == 'meri-worker-auth-cleanup/1'
                              and receipt.get('status') == 'CLEANED' and receipt.get('verifiedAbsent') is True
                              and receipt.get('rootObserved') is True
                              and receipt.get('boundIdentity') == list(identity)
                              and receipt.get('directoryName') == AUTH_PREFIX+nonce
                              and not directory.exists() and not directory.is_symlink(), 'owned credential purge')
                cleanup_ok = True
            except BaseException as error: result['cleanupFailureClass'] = type(error).__name__
        result['ownedCredentialsPurged'] = cleanup_ok
        result['logoutConfirmed'] = logout_ok
        if published and cleanup_ok and logout_ok: result['status'] = 'PUBLISHED_NOT_ADMITTED'
        evidence.save(output/'publication-result.json', result)
    return result
