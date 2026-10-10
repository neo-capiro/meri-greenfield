"""Offline Git/source/transaction controls. AWS capture is always a fake; no build is launched."""
import base64
import copy
import io
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import host_assets_source as source
import host_assets_build as build

REAL_ROOT = source.ROOT


def git(repo, *args):
    env = {key: value for key, value in os.environ.items() if not key.upper().startswith('GIT_')}
    env.update(GIT_OPTIONAL_LOCKS='0', GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='NUL', GIT_TERMINAL_PROMPT='0')
    result = subprocess.run([source.GIT, '-c', 'core.hooksPath=NUL', '-c', 'core.fsmonitor=false',
                             '-c', 'user.name=Offline Fixture', '-c', 'user.email=fixture@example.invalid',
                             '-C', str(repo), *args], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, shell=False, timeout=30, env=env)
    if result.returncode:
        raise AssertionError(result.stderr.decode(errors='replace'))
    return result.stdout.decode().strip()


class FakeAWS:
    def __init__(self, evidence):
        self.evidence = evidence
        self.request = source.parse_json((evidence / 'review-request.json').read_bytes())
        self.project = source.parse_json((build.ROOT / build.PROJECT_FILE).read_bytes())['projects'][0]
        self.trace = []
        self.fail = None
        self.drift = None
        self.active = False
        self.reconciling = False

    def actual_build(self):
        start = source.parse_json((self.evidence / 'start-build-input.json').read_bytes())
        env = copy.deepcopy(self.project['environment'])
        old = {row['name']: row for row in env['environmentVariables']}
        old.update({row['name']: row for row in start['environmentVariablesOverride']})
        env['environmentVariables'] = list(old.values())
        identifier = build.PROJECT + ':11111111-1111-4111-8111-111111111111'
        return {'id': identifier, 'arn': 'arn:aws:codebuild:us-east-1:967807252336:build/' + identifier,
                'projectName': build.PROJECT, 'sourceVersion': 'fixed-source-version',
                'timeoutInMinutes': 10, 'queuedTimeoutInMinutes': 5, 'buildStatus': 'IN_PROGRESS',
                'source': dict(self.project['source'], location=start['sourceLocationOverride'], buildspec=start['buildspecOverride']),
                'environment': env, 'serviceRole': self.project['serviceRole'], 'encryptionKey': build.KMS,
                'cache': self.project['cache'], 'artifacts': {'location': ''},
                'logs': {'cloudWatchLogs': self.project['logsConfig']['cloudWatchLogs']}}

    def __call__(self, output, label, args):
        self.trace.append((label, args))
        if args[:2] in (['s3api', 'put-object'], ['codebuild', 'start-build']):
            assert (self.evidence / 'execution-reserved.json').is_file()
            assert (self.evidence / (label + '-attempted.json')).is_file()
        if label == self.fail:
            raise subprocess.TimeoutExpired(['FAKE_AWS'], 1)
        if args[:2] == ['sts', 'get-caller-identity']:
            return {'Account': build.ACCOUNT, 'Arn': build.PRINCIPAL}
        if args[:2] == ['ecr', 'describe-repositories']:
            return {'repositories': [{'repositoryArn': 'arn:aws:ecr:us-east-1:967807252336:repository/' + build.REPOSITORY,
                    'repositoryUri': build.REPOSITORY_URI, 'imageTagMutability': 'IMMUTABLE',
                    'encryptionConfiguration': {'encryptionType': 'KMS', 'kmsKey': build.KMS}}]}
        if args[:2] == ['codebuild', 'batch-get-projects']:
            value = copy.deepcopy(self.project)
            if self.drift == 'project':
                value['environment']['privilegedMode'] = False
            if self.drift == 'project-bool':
                value['environment']['privilegedMode'] = 1
            return {'projects': [value], 'projectsNotFound': []}
        if args[:2] == ['codebuild', 'list-builds-for-project']:
            return {'ids': [build.PROJECT + ':11111111-1111-4111-8111-111111111111'] if self.active or self.reconciling else []}
        if args[:2] == ['codebuild', 'batch-get-builds']:
            if self.active:
                return {'builds': [{'id': args[3], 'buildStatus': 'IN_PROGRESS'}], 'buildsNotFound': []}
            return {'builds': [self.actual_build()], 'buildsNotFound': []}
        checksum = base64.b64encode(bytes.fromhex(self.request['archive']['sha256'])).decode()
        common = {'VersionId': 'fixed-source-version', 'ChecksumSHA256': checksum,
                  'ServerSideEncryption': 'aws:kms', 'SSEKMSKeyId': build.KMS}
        if args[:2] == ['s3api', 'put-object']:
            if self.drift == 'version':
                common['VersionId'] = None
            return common
        if args[:2] == ['s3api', 'head-object']:
            common.update(ContentLength=self.request['archive']['bytes'], Metadata={
                'sourcecommit': self.request['sourceCommit'], 'archivesha256': self.request['archive']['sha256']})
            if self.drift == 'head':
                common['ChecksumSHA256'] = 'wrong'
            return common
        if args[:2] == ['codebuild', 'start-build']:
            value = self.actual_build()
            if self.drift == 'build-role':
                value['serviceRole'] = 'arn:aws:iam::967807252336:role/wrong'
            if self.drift == 'build-id':
                value['id'] = build.PROJECT + ':' + '-' * 36
                value['arn'] = 'arn:aws:codebuild:us-east-1:967807252336:build/' + value['id']
            return {'build': value}
        raise AssertionError('unexpected fake operation: ' + repr(args))


class HostAssetsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.accepted_content, cls.accepted_archive, cls.files = source.snapshot(REAL_ROOT, source.SOURCE_REFERENCE)
        cls.project_raw = (REAL_ROOT / build.PROJECT_FILE).read_bytes()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='meri-host-assets-offline-')
        self.repo = Path(self.temp.name).resolve()
        for path, raw in self.files.items():
            destination = self.repo / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(raw)
        git(self.repo, 'init', '-q')
        git(self.repo, 'add', '--', *[p[0] for p in source.PINS])
        git(self.repo, 'commit', '-q', '-m', 'synthetic fixed source fixture')
        self.commit = git(self.repo, 'rev-parse', 'HEAD')
        project = self.repo / build.PROJECT_FILE
        project.parent.mkdir(parents=True, exist_ok=True)
        project.write_bytes(self.project_raw)
        for name in build.HELPERS:
            destination = self.repo / 'scripts/qualification' / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(REAL_ROOT / 'scripts/qualification' / name, destination)
        self.root_patch = patch.object(build, 'ROOT', self.repo)
        self.root_patch.start()
        self.no_real_aws = patch.object(build.aws_evidence, 'capture', side_effect=AssertionError('REAL AWS FORBIDDEN IN TEST'))
        self.no_real_aws.start()
        self.evidence = self.repo / 'docs/coordination/private-evidence/CODEX-G1-host-assets-test'

    def tearDown(self):
        self.no_real_aws.stop()
        self.root_patch.stop()
        self.temp.cleanup()

    def ready(self):
        build.prepare(self.commit, self.evidence)
        request = source.parse_json((self.evidence / 'review-request.json').read_bytes())
        review = {'decision': 'APPROVE_ONE_HOST_ASSETS_BUILD_V2',
                  'requestSha256': source.sha((self.evidence / 'review-request.json').read_bytes()),
                  'sourceCommit': self.commit, 'archiveSha256': request['archive']['sha256'],
                  'buildspecSha256': request['content']['buildspec']['sha256'],
                  'helperFilesSha256': source.sha(source.json_bytes(request['helperFiles'])),
                  'reviewer': 'SYNTHETIC_TEST_ONLY', 'notes': 'No external authority; fake capture only'}
        review_path = self.evidence / 'review.json'
        review_path.write_bytes(source.json_bytes(review))
        return request, review_path, source.sha(review_path.read_bytes()), FakeAWS(self.evidence)

    def test_exact_27_public_files_only_and_deterministic_zip(self):
        private = self.repo / '.task-inputs/do-not-package.txt'
        private.parent.mkdir(); private.write_text('SYNTHETIC_NOT_A_SECRET')
        content, archive, _ = source.snapshot(self.repo, self.commit)
        self.assertEqual(archive, source.snapshot(self.repo, self.commit)[1])
        self.assertEqual(len(content['sourceFiles']), 14)
        self.assertEqual(len(content['ownerFiles']), 10)
        self.assertEqual(content['schema'], 'meri-host-assets-build-input/2')
        with zipfile.ZipFile(io.BytesIO(archive)) as packed:
            self.assertEqual(packed.namelist(), [p[0] for p in source.PINS])
            self.assertEqual(len(packed.namelist()), 27)
            for path, size, digest in source.PINS:
                self.assertEqual(source.sha(packed.read(path)), digest)
                self.assertEqual(len(packed.read(path)), size)
                self.assertNotIn('.task-inputs', path)

    def test_dirty_worktree_is_not_source_authority(self):
        (self.repo / source.PINS[0][0]).write_bytes(b'dirty uncommitted replacement')
        self.assertEqual(source.snapshot(self.repo, self.commit)[1], self.accepted_archive)

    def test_same_size_committed_source_drift_refuses(self):
        path = self.repo / source.PINS[0][0]
        raw = path.read_bytes(); path.write_bytes(bytes([raw[0] ^ 1]) + raw[1:])
        git(self.repo, 'add', '--', source.PINS[0][0]); git(self.repo, 'commit', '-q', '-m', 'SYNTHETIC drift')
        with self.assertRaisesRegex(ValueError, 'source hash drift'):
            source.snapshot(self.repo, git(self.repo, 'rev-parse', 'HEAD'))

    def test_missing_committed_source_refuses(self):
        git(self.repo, 'rm', '--cached', '--', source.PINS[0][0]); git(self.repo, 'commit', '-q', '-m', 'SYNTHETIC missing')
        with self.assertRaisesRegex(ValueError, 'missing fixed public source'):
            source.snapshot(self.repo, git(self.repo, 'rev-parse', 'HEAD'))

    def test_committed_symlink_mode_refuses_without_creating_os_symlink(self):
        oid = git(self.repo, 'rev-parse', self.commit + ':' + source.PINS[0][0])
        git(self.repo, 'update-index', '--cacheinfo', '120000,' + oid + ',' + source.PINS[0][0])
        git(self.repo, 'commit', '-q', '-m', 'SYNTHETIC symlink mode')
        with self.assertRaisesRegex(ValueError, 'nonregular'):
            source.snapshot(self.repo, git(self.repo, 'rev-parse', 'HEAD'))

    def test_source_commit_requires_literal_40hex(self):
        for value in ('HEAD', self.commit + ' ', 'A' * 40, None):
            with self.assertRaisesRegex(ValueError, '40-hex'):
                source.snapshot(self.repo, value)

    def test_builder_entire_configuration_and_secret_drift_refuse(self):
        expected = build.reviewed_project()
        old = source.parse_json(self.project_raw)['projects'][0]
        reordered = copy.deepcopy(old); reordered['tags'].reverse(); reordered['created'] = 'changed-observation'
        self.assertEqual(build.project_configuration(reordered), expected)
        for mutate in (lambda p: p.update(unreviewed=True), lambda p: p['environment'].update(computeType='OTHER')):
            actual = copy.deepcopy(old); mutate(actual)
            self.assertNotEqual(build.project_configuration(actual), expected)
        actual = copy.deepcopy(old); actual['environment']['environmentVariables'][0]['type'] = 'SECRETS_MANAGER'
        with self.assertRaisesRegex(ValueError, 'secret'):
            build.project_configuration(actual)

    def test_fixed_project_evidence_raw_drift_refuses_local_prepare(self):
        with (self.repo / build.PROJECT_FILE).open('ab') as stream: stream.write(b' ')
        with self.assertRaisesRegex(ValueError, 'builder evidence drift'):
            build.prepare(self.commit, self.evidence)
        self.assertFalse((self.evidence / 'execution-reserved.json').exists())

    def test_exact_review_bindings_and_duplicate_keys(self):
        request, path, digest, fake = self.ready(); raw = (self.evidence / 'review-request.json').read_bytes()
        value = source.parse_json(path.read_bytes())
        for key in ('requestSha256', 'sourceCommit', 'archiveSha256', 'buildspecSha256', 'helperFilesSha256'):
            changed = dict(value); changed[key] = '0' * 64; data = source.json_bytes(changed)
            with self.assertRaisesRegex(ValueError, 'review binding'):
                build.check_review(request, raw, data, source.sha(data))
        with self.assertRaisesRegex(ValueError, 'duplicate JSON key'):
            source.parse_json(b'{"decision":"x","decision":"y"}')

    def test_successful_fake_transaction_has_exact_v2_override_and_two_mutations(self):
        request, path, digest, fake = self.ready()
        result = build.execute(self.evidence, path, digest, fake)
        self.assertEqual(result['status'], 'DISPATCHED_NOT_ACCEPTED')
        mutations = [args[:2] for _, args in fake.trace if args[:2] in (['s3api', 'put-object'], ['codebuild', 'start-build'])]
        self.assertEqual(mutations, [['s3api', 'put-object'], ['codebuild', 'start-build']])
        start = source.parse_json((self.evidence / 'start-build-input.json').read_bytes())
        self.assertEqual(start['projectName'], 'meri-greenfield-qualification-build')
        self.assertEqual(start['timeoutInMinutesOverride'], 10)
        self.assertEqual(start['sourceVersion'], 'fixed-source-version')
        self.assertEqual(start['buildspecOverride'].encode(), self.files['infra/qualification/host-assets.buildspec.json'])
        variables = {row['name']: row['value'] for row in start['environmentVariablesOverride']}
        self.assertEqual(set(variables), {'IMAGE_TAG','SOURCE_COMMIT','SOURCE_S3_VERSION','SOURCE_ARCHIVE_SHA256','ASSET_EXPECTED_B64'})
        self.assertEqual(source.parse_json(base64.b64decode(variables['ASSET_EXPECTED_B64'])), request['content'])
        with self.assertRaisesRegex(ValueError, 'reservation already consumed'):
            build.execute(self.evidence, path, digest, fake)
        self.assertEqual(len([row for row in fake.trace if row[0] == 'start-build']), 1)

    def test_active_builder_or_project_drift_stops_before_upload(self):
        request, path, digest, fake = self.ready(); fake.active = True
        with self.assertRaisesRegex(ValueError, 'active/unknown'):
            build.execute(self.evidence, path, digest, fake)
        self.assertFalse(any(args[:2] == ['s3api', 'put-object'] for _, args in fake.trace))

    def test_project_drift_stops_before_upload(self):
        request, path, digest, fake = self.ready(); fake.drift = 'project'
        with self.assertRaisesRegex(ValueError, 'full builder configuration drift'):
            build.execute(self.evidence, path, digest, fake)
        self.assertFalse(any(label == 'upload' for label, _ in fake.trace))

    def test_head_or_missing_version_stops_without_start(self):
        request, path, digest, fake = self.ready(); fake.drift = 'head'
        with self.assertRaisesRegex(ValueError, 'source version/checksum'):
            build.execute(self.evidence, path, digest, fake)
        self.assertFalse(any(label == 'start-build' for label, _ in fake.trace))
        self.assertTrue((self.evidence / 'upload-attempted.json').is_file())

    def test_missing_immutable_version_stops_without_start(self):
        request, path, digest, fake = self.ready(); fake.drift = 'version'
        with self.assertRaisesRegex(ValueError, 'immutable S3 version'):
            build.execute(self.evidence, path, digest, fake)
        self.assertFalse(any(label == 'start-build' for label, _ in fake.trace))

    def test_unknown_upload_consumes_reservation_with_no_retry(self):
        request, path, digest, fake = self.ready(); fake.fail = 'upload'
        with self.assertRaises(subprocess.TimeoutExpired): build.execute(self.evidence, path, digest, fake)
        self.assertEqual(source.parse_json((self.evidence / 'outcome.json').read_bytes())['status'], 'STOPPED_OR_OUTCOME_UNCERTAIN')
        with self.assertRaisesRegex(ValueError, 'reservation already consumed'): build.execute(self.evidence, path, digest, fake)
        self.assertEqual(len([row for row in fake.trace if row[0] == 'upload']), 1)
        self.assertFalse(any(label == 'start-build' for label, _ in fake.trace))

    def test_unknown_start_readonly_reconciliation_does_not_retry_or_accept(self):
        request, path, digest, fake = self.ready(); fake.fail = 'start-build'
        with self.assertRaises(subprocess.TimeoutExpired): build.execute(self.evidence, path, digest, fake)
        fake.fail = None; fake.reconciling = True; count = len(fake.trace)
        result = build.reconcile(self.evidence, fake)
        self.assertEqual(result['status'], 'READ_ONLY_RECONCILIATION_NOT_ACCEPTANCE')
        self.assertEqual(len(result['matchingBuilds']), 1)
        self.assertFalse(any(args[:2] in (['s3api','put-object'],['codebuild','start-build']) for _, args in fake.trace[count:]))
        self.assertEqual(len([row for row in fake.trace if row[0] == 'start-build']), 1)

    def test_returned_build_authority_drift_stays_unaccepted(self):
        request, path, digest, fake = self.ready(); fake.drift = 'build-role'
        with self.assertRaisesRegex(ValueError, 'returned build authority'):
            build.execute(self.evidence, path, digest, fake)
        self.assertEqual(source.parse_json((self.evidence / 'outcome.json').read_bytes())['status'], 'STOPPED_OR_OUTCOME_UNCERTAIN')

    def test_prepared_archive_helper_or_request_drift_refuses_before_calls(self):
        request, path, digest, fake = self.ready()
        with (self.evidence / 'source.zip').open('ab') as stream: stream.write(b'X')
        with self.assertRaisesRegex(ValueError, 'archive/recipe drift'):
            build.execute(self.evidence, path, digest, fake)
        self.assertEqual(fake.trace, [])

    def test_prepared_helper_drift_refuses_before_calls(self):
        request, path, digest, fake = self.ready()
        with (self.repo / 'scripts/qualification/host_assets_source.py').open('ab') as stream: stream.write(b'\n')
        with self.assertRaisesRegex(ValueError, 'source/helper/authority request drift'):
            build.execute(self.evidence, path, digest, fake)
        self.assertEqual(fake.trace, [])

    def test_project_bool_number_substitution_refuses(self):
        request, path, digest, fake = self.ready(); fake.drift = 'project-bool'
        with self.assertRaisesRegex(ValueError, 'full builder configuration drift'):
            build.execute(self.evidence, path, digest, fake)
        self.assertFalse(any(label == 'upload' for label, _ in fake.trace))

    def test_returned_malformed_build_uuid_refuses(self):
        request, path, digest, fake = self.ready(); fake.drift = 'build-id'
        with self.assertRaisesRegex(ValueError, 'returned build identity'):
            build.execute(self.evidence, path, digest, fake)
        self.assertEqual(len([row for row in fake.trace if row[0] == 'start-build']), 1)

    def test_unknown_upload_readonly_reconciliation_observes_source_without_retry(self):
        request, path, digest, fake = self.ready(); fake.fail = 'upload'
        with self.assertRaises(subprocess.TimeoutExpired):
            build.execute(self.evidence, path, digest, fake)
        fake.fail = None; count = len(fake.trace)
        result = build.reconcile(self.evidence, fake)
        self.assertEqual(result['status'], 'READ_ONLY_RECONCILIATION_NOT_ACCEPTANCE')
        self.assertEqual(result['matchingBuilds'], [])
        self.assertEqual(result['observedSource']['versionId'], 'fixed-source-version')
        self.assertFalse(any(args[:2] in (['s3api','put-object'],['codebuild','start-build']) for _, args in fake.trace[count:]))
        self.assertEqual(len([row for row in fake.trace if row[0] == 'upload']), 1)

    def test_evidence_destination_is_exclusive(self):
        build.prepare(self.commit, self.evidence)
        with self.assertRaises(FileExistsError): build.prepare(self.commit, self.evidence)
        with self.assertRaisesRegex(ValueError, 'fixed new evidence path'):
            build.prepare(self.commit, self.repo / 'arbitrary-output')


if __name__ == '__main__':
    unittest.main(verbosity=2)