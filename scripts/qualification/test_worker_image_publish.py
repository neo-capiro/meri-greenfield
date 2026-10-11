"""Offline publication controls; no AWS, Docker, login, build, or container runs."""
import copy
import os
from pathlib import Path
import sys
import tarfile
import tempfile
import time
import unittest
from unittest.mock import patch
from types import SimpleNamespace

import worker_image_build as build
import worker_image_collect as collect
import worker_image_publish as publish
import worker_context
import test_worker_image_build as existing

COMMIT = 'c'*40
TOKEN = '41173c6e-56a8-4fb0-834c-1c2c47c3e517'
IID = 'sha256:'+'a'*64
PIN = 'b'*64


def subject():
    manifest = {'schema': collect.PUBLISH_SCHEMA, 'sourceCommit': COMMIT, 'runUuid': TOKEN,
                'publication': build.publication(COMMIT, TOKEN)}
    static = {'sourceCommit': COMMIT, 'status': 'BUILD_ONLY_STATIC_EVIDENCE', 'captureComplete': True,
              'physicalCleanupConfirmed': True, 'containerStarted': False, 'ecrPublished': False,
              'image': {'Id': IID}}
    return manifest, static


class Publication(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name)
        collect.save(self.output/'source-post.json', {'sourceStable': True, 'inputManifestSha256': PIN,
                                                     'contextManifestSha256': collect.CONTEXT_SHA})
        self.env = patch.dict(os.environ, {'INPUT_MANIFEST_SHA256': PIN}); self.env.start(); self.addCleanup(self.env.stop)

    def transport(self, failure=None):
        calls = []; secrets = []; auth_path = self.output/'meri-worker-auth.deadbeef'
        manifest_bytes = collect.encoded({'schemaVersion': 2, 'config': {'digest': IID}, 'layers': []})
        digest = 'sha256:'+collect.digest(manifest_bytes.decode('ascii').encode('utf-8'))
        tag = build.publication(COMMIT, TOKEN)['imageTag']
        caller = {'Account': publish.ACCOUNT, 'Arn': 'arn:aws:sts::'+publish.ACCOUNT+':assumed-role/'+publish.BUILDER_ROLE+'/synthetic',
                  'UserId': 'synthetic'}
        image = {'imageDetails': [{'registryId': publish.ACCOUNT, 'repositoryName': publish.REPOSITORY,
                  'imageTags': [tag], 'imageDigest': digest}]}
        batch = {'images': [{'registryId': publish.ACCOUNT, 'repositoryName': publish.REPOSITORY,
                  'imageId': {'imageTag': tag, 'imageDigest': digest}, 'imageManifest': manifest_bytes.decode('ascii')}], 'failures': []}
        def auth():
            auth_path.mkdir(); return auth_path, 'deadbeef', (1, 2)
        def login(directory, seconds):
            calls.append('login'); self.assertEqual(directory, auth_path)
        def private(argv, seconds):
            calls.append(argv[3]); self.assertTrue(seconds > 0)
            self.assertNotIn('password', ' '.join(argv).lower())
            if argv[3] == 'push' and failure == 'lost-push': raise TimeoutError('synthetic lost push ACK')
        def call(label, argv, *bounds):
            calls.append(label)
            self.assertNotIn('describe-repositories', argv)
            if label in ('ecr-caller', 'ecr-push-caller'):
                bad = copy.deepcopy(caller)
                if failure == 'caller' and label == 'ecr-caller': bad['Account'] = 'foreign'
                return collect.encoded(bad)
            if label == 'ecr-tag': return b''
            if label == 'ecr-image': return collect.encoded(image)
            if label == 'ecr-manifest':
                bad = copy.deepcopy(batch)
                if failure == 'manifest': bad['images'][0]['imageManifest'] = '{}'
                return collect.encoded(bad)
            if label == 'ecr-auth-cleanup':
                if failure != 'cleanup': auth_path.rmdir()
                return collect.encoded({'schema': 'meri-worker-auth-cleanup/1', 'status': 'CLEANED',
                                        'verifiedAbsent': failure != 'cleanup', 'rootObserved': True,
                                        'boundIdentity': [1, 2], 'directoryName': auth_path.name})
            self.fail(label)
        return call, login, private, auth, calls, secrets

    def test_explicit_publish_binding_and_distinct_review(self):
        manifest, _ = subject()
        publish.validate_publication(manifest['publication'], COMMIT, TOKEN)
        wrong = dict(manifest['publication'], imageTag='foreign')
        with self.assertRaises(ValueError): publish.validate_publication(wrong, COMMIT, TOKEN)
        req = {'schema': build.PUBLISH_SCHEMA, 'authority': {'capturedAt': build.dt.datetime.now(build.dt.timezone.utc).isoformat()},
               'authoritySha256': 'a'*64, 'helperFiles': []}
        raw = b'request'
        good = {'decision': 'APPROVE_ONE_WORKER_IMAGE_PUBLISH_BUILD_ONLY', 'requestSha256': collect.digest(raw),
                'closureSha256': collect.digest(collect.encoded([])), 'authoritySha256': 'a'*64,
                'reviewer': 'synthetic', 'notes': 'offline'}
        blob = collect.encoded(good); build.check_review(req, raw, blob, collect.digest(blob))
        old = dict(good, decision='APPROVE_ONE_WORKER_IMAGE_BUILD_ONLY'); blob = collect.encoded(old)
        with self.assertRaises(ValueError): build.check_review(req, raw, blob, collect.digest(blob))
        start = build.start_input(dict(req, sourceCommit=COMMIT, runUuid=TOKEN, archive={'sha256': 'a'*64,
            'key': 'inputs/sdk-worker-image-'+TOKEN+'/source.zip'}, inputSha256='b'*64,
            resultKey='results/sdk-worker-image-'+TOKEN+'/evidence.tar.gz'), 'immutable')
        self.assertEqual(start['autoRetryLimitOverride'], 0)
        self.assertIn({'name': 'WORKER_IMAGE_MODE', 'value': 'publish', 'type': 'PLAINTEXT'}, start['environmentVariablesOverride'])
        self.assertIn('1680s', start['buildspecOverride'])
        self.assertIn('1560s', build.recipe().decode('ascii'))

    def test_publish_postbuild_fallback_is_bounded_failure_evidence(self):
        post = collect.loads(build.recipe(True))['phases']['post_build']['commands'][0]
        self.assertNotIn('__PUBLISH_FAILURE__', collect.loads(build.recipe())['phases']['post_build']['commands'][0])
        body = post.split("<<'__PUBLISH_FAILURE__'\n", 1)[1].split('\n__PUBLISH_FAILURE__', 1)[0]
        previous = Path.cwd()
        try:
            os.chdir(self.output)
            with patch.dict(os.environ, {'SOURCE_COMMIT': COMMIT}):
                exec(compile(body, '<publish-failure-fallback>', 'exec'), {'__name__': '__main__'})
        finally:
            os.chdir(previous)
        bundle = self.output/'worker-image-result.tar.gz'
        self.assertLess(bundle.stat().st_size, 4096)
        with tarfile.open(bundle, 'r:gz') as archive:
            self.assertEqual(archive.getnames(), ['preflight-failure.json'])
            receipt = collect.loads(archive.extractfile('preflight-failure.json').read())
        self.assertEqual(receipt['status'], 'PREFLIGHT_OR_BUNDLE_FAILED')
        self.assertEqual(receipt['sourceCommit'], COMMIT)
        self.assertFalse(receipt['scanAdmitted'] or receipt['runtimeAdmitted'] or receipt['g1Admitted'])

    def test_owner_repository_authority_precedes_consumption(self):
        repo = {'repositories': [{'registryId': build.ACCOUNT,
            'repositoryArn': 'arn:aws:ecr:'+build.REGION+':'+build.ACCOUNT+':repository/'+build.authority.REPOSITORY,
            'repositoryName': build.authority.REPOSITORY,
            'repositoryUri': build.authority.REPOSITORY_URI, 'imageTagMutability': 'IMMUTABLE',
            'imageScanningConfiguration': {'scanOnPush': True},
            'encryptionConfiguration': {'encryptionType': 'KMS', 'kmsKey': build.KMS}}]}
        auth = existing.request()['authority']; auth['repository'] = repo
        auth['authorityRecords']['repository'] = 'f'*64
        build.validate_authority(auth, True)
        bad = copy.deepcopy(repo); bad['repositories'][0]['imageTagMutability'] = 'MUTABLE'
        with self.assertRaises(ValueError): build.validate_repository(bad)
        req = existing.request(); req['schema'] = build.PUBLISH_SCHEMA; req['authority'] = auth
        seen = []
        def call(label, args):
            seen.append(label)
            if label == 'caller': return auth['caller']
            if label == 'repository': return bad
            self.fail(label)
        with patch.object(build.authority, 'one_project'), patch.object(build, 'pins', return_value=[]):
            with self.assertRaises(ValueError):
                build.dispatch(self.output, req, b'request', 'review', call)
        self.assertEqual(seen, ['caller', 'repository'])
        self.assertFalse((self.output/'execution-reserved.json').exists())

    def test_owner_execute_refuses_repository_drift_before_any_write(self):
        repo = {'repositories': [{'registryId': build.ACCOUNT,
            'repositoryArn': 'arn:aws:ecr:'+build.REGION+':'+build.ACCOUNT+':repository/'+build.authority.REPOSITORY,
            'repositoryName': build.authority.REPOSITORY,
            'repositoryUri': build.authority.REPOSITORY_URI, 'imageTagMutability': 'IMMUTABLE',
            'imageScanningConfiguration': {'scanOnPush': True},
            'encryptionConfiguration': {'encryptionType': 'KMS', 'kmsKey': build.KMS}}]}
        req = existing.request(); req['schema'] = build.PUBLISH_SCHEMA
        req['authority']['repository'] = repo
        req['authority']['authorityRecords']['repository'] = 'f'*64
        review = self.output/'review.json'; collect.write(review, b'{}')
        seen = []
        def capture(folder, label, args, **kwargs):
            seen.append((label, args))
            if label == 'caller': value = req['authority']['caller']
            elif label == 'repository':
                value = copy.deepcopy(repo); value['repositories'][0]['imageTagMutability'] = 'MUTABLE'
            else: self.fail(label)
            target = folder/label; target.mkdir(); collect.write(target/'stdout.bin', collect.encoded(value))
            return value
        with patch.object(build, 'slot', return_value=self.output), \
             patch.object(build, 'load', return_value=(req, b'request')), \
             patch.object(build, 'check_review'), patch.object(build.authority, 'one_project'), \
             patch.object(build.aws_evidence, 'capture', capture):
            with self.assertRaises(ValueError): build.execute(self.output, review, 'f'*64)
        self.assertEqual([label for label, _ in seen], ['caller', 'repository'])
        self.assertFalse((self.output/'execution-reserved.json').exists())
        self.assertFalse((self.output/'upload-attempted.json').exists())
        self.assertFalse((self.output/'start-build-attempted.json').exists())

    def test_publish_manifest_pins_both_new_sources(self):
        root = self.output/'archive'; root.mkdir()
        names = [path for path, _ in build.worker_context.MEMBERS]
        names += [collect.ASSEMBLER, collect.COLLECTOR, build.PUBLISHER, build.CLEANER]
        rows = []
        for name in names:
            raw = (build.ROOT/name).read_bytes()
            target = root/name; target.parent.mkdir(parents=True, exist_ok=True)
            collect.write(target, raw)
            rows.append({'path': name, 'bytes': len(raw), 'sha256': collect.digest(raw)})
        recipe = build.recipe(True); collect.write(root/'buildspec.json', recipe)
        rows.append({'path': 'buildspec.json', 'bytes': len(recipe), 'sha256': collect.digest(recipe)})
        value = {'schema': collect.PUBLISH_SCHEMA, 'sourceCommit': COMMIT, 'runUuid': TOKEN,
                 'contextManifestSha256': collect.CONTEXT_SHA, 'members': rows,
                 'publication': build.publication(COMMIT, TOKEN)}
        raw = collect.encoded(value)
        collect.validate_input(root, raw, collect.digest(raw))
        wrong = copy.deepcopy(value); wrong['publication']['repositoryUri'] = 'foreign'
        bad = collect.encoded(wrong)
        with self.assertRaises(ValueError): collect.validate_input(root, bad, collect.digest(bad))
        (root/build.PUBLISHER).write_bytes(b'x')
        with self.assertRaises(ValueError): collect.validate_input(root, raw, collect.digest(raw))

    def test_success_exact_manifest_cleanup_and_no_admission(self):
        manifest, static = subject(); call, login, private, auth, calls, _ = self.transport()
        result = publish.execute(self.output, manifest, static, call, time.monotonic()+1000,
                                 login=login, private=private, auth=auth)
        self.assertEqual(result['status'], 'PUBLISHED_NOT_ADMITTED')
        self.assertTrue(result['pushAttempted'] and result['ownedCredentialsPurged'])
        self.assertFalse(result['scanAdmitted'] or result['runtimeAdmitted'] or result['g1Admitted'])
        self.assertEqual(calls.count('push'), 1)
        self.assertNotIn('ecr-repository', calls)
        self.assertLess(calls.index('ecr-push-caller'), calls.index('push'))
        self.assertLess(calls.index('ecr-manifest'), calls.index('ecr-auth-cleanup'))
        self.assertTrue((self.output/'ecr-push-attempt.json').exists())
        self.assertFalse((self.output/'meri-worker-auth.deadbeef').exists())
        self.assertNotIn('synthetic-secret', (self.output/'publication-result.json').read_text())

    def test_static_or_source_post_failure_prevents_all_ecr(self):
        manifest, static = subject(); call, login, private, auth, calls, _ = self.transport()
        for changed in (dict(static, physicalCleanupConfirmed=False), dict(static, captureComplete=False),
                        dict(static, containerStarted=True)):
            with self.assertRaises(ValueError):
                publish.execute(self.output, manifest, changed, call, time.monotonic()+1000,
                                login=login, private=private, auth=auth)
        self.assertEqual(calls, [])
        (self.output/'source-post.json').write_text('{"sourceStable":false}')
        with self.assertRaises(ValueError):
            publish.execute(self.output, manifest, static, call, time.monotonic()+1000,
                            login=login, private=private, auth=auth)
        self.assertEqual(calls, [])

    def test_failure_and_unknown_push_stay_consumed_and_bundled(self):
        for failure, attempted in (('caller', False), ('lost-push', True), ('manifest', True), ('cleanup', True)):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temp:
                output = Path(temp); collect.save(output/'source-post.json', {'sourceStable': True, 'inputManifestSha256': PIN,
                                                                               'contextManifestSha256': collect.CONTEXT_SHA})
                self.output = output
                manifest, static = subject(); call, login, private, auth, calls, _ = self.transport(failure)
                result = publish.execute(output, manifest, static, call, time.monotonic()+1000,
                                         login=login, private=private, auth=auth)
                self.assertEqual(result['status'], 'FAILED_OR_UNKNOWN')
                self.assertEqual(result['pushAttempted'], attempted)
                self.assertEqual(calls.count('push'), int(attempted))
                self.assertFalse(result['scanAdmitted'] or result['runtimeAdmitted'])
                self.assertEqual((output/'ecr-push-attempt.json').exists(), attempted)
                collect.bundle(output, output/'bundle.tar.gz')
                self.assertTrue((output/'publication-result.json').exists())

    def test_collector_orders_source_post_publication_and_bundle(self):
        for fail_source in (False, True):
            with self.subTest(fail_source=fail_source), tempfile.TemporaryDirectory() as temp:
                root = Path(temp).resolve(); manifest, static = subject(); static = copy.deepcopy(static)
                manifest['members'] = [{'path': name} for name in
                    ({path for path, _ in worker_context.MEMBERS} |
                     {collect.ASSEMBLER, collect.COLLECTOR, collect.PUBLISHER, collect.CLEANER, 'buildspec.json'})]
                raw = collect.encoded(manifest); context_raw = b'fixed context'; calls = []
                env = {'CODEBUILD_SRC_DIR': str(root), 'SOURCE_COMMIT': COMMIT,
                       'SOURCE_ARCHIVE_SHA256': 'a'*64, 'SOURCE_S3_VERSION': 'immutable-version',
                       'RESULT_KEY': 'results/sdk-worker-image-'+TOKEN+'/evidence.tar.gz',
                       'INPUT_MANIFEST_SHA256': collect.digest(raw), 'WORKER_IMAGE_MODE': 'publish'}
                original_read = collect.read
                def read(path, cap):
                    if path == root/'worker-image-input.json': return raw
                    if path == root/'.meri-worker-context'/'manifest.json': return context_raw
                    return original_read(path, cap)
                checks = 0
                def validate(*args):
                    nonlocal checks
                    checks += 1
                    if checks == 2 and fail_source: raise ValueError('synthetic source drift')
                    return manifest
                def publication(output, *_):
                    calls.append('publish')
                    self.assertEqual(collect.loads((output/'source-post.json').read_bytes())['sourceStable'], True)
                    return {'status': 'PUBLISHED_NOT_ADMITTED', 'imageDigest': 'sha256:'+'d'*64}
                def bundle(output, destination):
                    calls.append('bundle')
                    result = collect.loads((output/'result.json').read_bytes())
                    self.assertEqual(result['ecrPublished'], not fail_source)
                    self.assertFalse(result['scanAdmitted'] or result['runtimeAdmitted'] or result['g1Admitted'])
                    collect.write(destination, b'completed synthetic archive')
                fake_file = root/'scripts/qualification/worker_image_collect.py'
                with patch.object(collect, '__file__', str(fake_file)), patch.object(collect.sys, 'platform', 'linux'), \
                     patch.object(collect.sys, 'argv', ['worker_image_collect.py', '--collect']), \
                     patch.dict(os.environ, env), patch.object(collect, 'read', read), \
                     patch.object(collect, 'validate_input', validate), \
                     patch.object(collect, 'CONTEXT_SHA', collect.digest(context_raw)), \
                     patch.object(collect.shutil, 'disk_usage', return_value=SimpleNamespace(free=3*1024**3)), \
                     patch.object(worker_context, 'verify_context'), \
                     patch.object(collect, 'Commands', return_value=lambda *args: b''), \
                     patch.object(collect, 'collect', return_value=static), \
                     patch.object(publish, 'execute', publication), patch.object(collect, 'bundle', bundle):
                    if fail_source:
                        with self.assertRaises(ValueError): collect.main()
                    else: self.assertEqual(collect.main(), 0)
                self.assertEqual(calls, ['bundle'] if fail_source else ['publish', 'bundle'])
                self.assertEqual((root/'worker-image-result.tar.gz').read_bytes(), b'completed synthetic archive')
                self.assertFalse((root/'worker-image-result.partial.tar.gz').exists())


if __name__ == '__main__': unittest.main()
