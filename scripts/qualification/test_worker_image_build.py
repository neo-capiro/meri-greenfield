"""Offline controls only; never dispatch Docker/AWS or execute a worker."""
import copy
import datetime as dt
import io
import json
from pathlib import Path
import tarfile
import tempfile
import time
import unittest
from unittest.mock import patch

import worker_image_build as build
import worker_image_collect as collect

TOKEN = '41173c6e-56a8-4fb0-834c-1c2c47c3e517'
IID = 'sha256:'+'a'*64
CID = 'b'*64
NAME = 'meri-worker-evidence-'+TOKEN


def project():
    return {'arn': f'arn:aws:codebuild:{build.REGION}:{build.ACCOUNT}:project/{build.PROJECT}',
            'name': build.PROJECT, 'serviceRole': build.ROLE, 'encryptionKey': build.KMS,
            'timeoutInMinutes': 30, 'queuedTimeoutInMinutes': 5, 'concurrentBuildLimit': 1,
            'source': {'type': 'S3', 'location': 'old', 'buildspec': 'old ECR recipe never run'},
            'environment': {'type': 'LINUX_CONTAINER', 'image': 'aws/codebuild/standard:7.0',
                            'computeType': 'BUILD_GENERAL1_SMALL', 'privilegedMode': True, 'environmentVariables': []},
            'cache': {'type': 'NO_CACHE'}, 'tags': [], 'logsConfig': {'cloudWatchLogs': {'status': 'ENABLED'}}}


def request():
    caller = {'Account': build.ACCOUNT, 'Arn': 'arn:aws:iam::967807252336:user/hermes-cli', 'UserId': 'synthetic-user-id'}
    auth = {'decision': 'ROOT_REVIEWED_WORKER_BUILDER_AUTHORITY', 'capturedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
            'caller': caller, 'project': project(), 'authorityRecords': {k: 'f'*64 for k in
                ('roleTrust', 'inlinePolicy', 'attachedPolicies', 'kmsKey', 'kmsPolicy')}}
    return {'sourceCommit': 'c'*40, 'runUuid': TOKEN, 'helperFiles': [], 'authority': auth, 'authoritySha256': 'a'*64,
            'builderProject': project(), 'inputSha256': 'd'*64,
            'archive': {'sha256': collect.digest(b'zip'), 'bytes': 3, 'key': 'inputs/sdk-worker-image-'+TOKEN+'/source.zip'},
            'resultKey': 'results/sdk-worker-image-'+TOKEN+'/evidence.tar.gz'}


def image():
    return [{'Id': IID, 'Os': 'linux', 'Architecture': 'amd64', 'Config': {'User': '10001:10001',
        'WorkingDir': '/workspace/conversation', 'Entrypoint': ['node', '/opt/meri-worker/probes/runtime.mjs'],
        'Volumes': {'/workspace': {}, '/tmp': {}}, 'Labels': None, 'Env': ['MERI_QUALIFICATION_ONLY=true',
        'MERI_SOURCES_ENABLED=false', 'CHROMIUM_SANDBOX_REQUIRED=true']}, 'RootFS': {'Type': 'layers', 'Layers': [IID]}}]


def container():
    return [{'Id': CID, 'Name': '/'+NAME, 'Image': IID,
        'Config': {'Labels': {'meri.worker.collector': TOKEN}, 'User': '10001:10001', 'Entrypoint': ['/__meri_never_started__']},
        'State': {'Status': 'created', 'Running': False, 'StartedAt': '0001-01-01T00:00:00Z'},
        'HostConfig': {'NetworkMode': 'none', 'ReadonlyRootfs': True, 'CapDrop': ['ALL'], 'SecurityOpt': ['no-new-privileges'], 'Privileged': False},
        'Mounts': [{'Destination': p, 'Type': 'volume', 'Name': h*64} for p, h in [('/workspace', 'd'), ('/tmp', 'e')]]}]


def tar_bytes(items):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode='w') as tar:
        for name, raw, kind in items:
            info = tarfile.TarInfo(name); info.size = len(raw); info.type = kind
            if kind == tarfile.SYMTYPE: info.linkname = 'elsewhere'; info.size = 0
            tar.addfile(info, io.BytesIO(raw) if kind == tarfile.REGTYPE else None)
    return buffer.getvalue()


class Controls(unittest.TestCase):
    def test_strict_json(self):
        for value in (b'{"a":1,"a":2}', b'{"a":NaN}'):
            with self.assertRaises(ValueError): collect.loads(value)

    def test_authority_full_identity_and_role(self):
        value = request()['authority']; self.assertEqual(build.validate_authority(value), project())
        self.assertEqual(build.WORKER_BUILDER_PRINCIPAL, 'arn:aws:iam::967807252336:user/hermes-cli')
        for field in ('UserId', 'Account', 'Arn'):
            wrong = copy.deepcopy(value); wrong['caller'][field] = ''
            with self.assertRaises(ValueError): build.validate_authority(wrong)
        old = copy.deepcopy(value); old['caller']['Arn'] = build.authority.PRINCIPAL
        with self.assertRaises(ValueError): build.validate_authority(old)
        wrong = copy.deepcopy(value); wrong['project']['serviceRole'] = 'foreign'
        with self.assertRaises(ValueError): build.validate_authority(wrong)

    def test_authority_credentials_refused(self):
        value = request()['authority']; value['project']['environment']['environmentVariables'] = [{'name': 'AWS_SECRET_ACCESS_KEY', 'type': 'PLAINTEXT', 'value': 'synthetic'}]
        with self.assertRaises(ValueError): build.validate_authority(value)

    def test_recipe_fixed_build_only(self):
        recipe = collect.loads(build.recipe()); text = build.recipe().decode()
        self.assertNotIn('ecr', text); self.assertNotIn('docker push', text)
        self.assertIn('--if-none-match', text); self.assertIn('1560s', text)
        self.assertEqual(set(recipe['phases']), {'build', 'post_build'})

    def test_review_separate_exact_and_fresh(self):
        req = request(); raw = b'fixed request'
        review = {'decision': 'APPROVE_ONE_WORKER_IMAGE_BUILD_ONLY', 'requestSha256': collect.digest(raw),
                  'closureSha256': collect.digest(collect.encoded([])), 'authoritySha256': req['authoritySha256'], 'reviewer': 'synthetic', 'notes': 'offline'}
        rr = collect.encoded(review); build.check_review(req, raw, rr, collect.digest(rr))
        for field, replacement in [('decision', 'APPROVE_ONE_HOST_ASSETS_BUILD_V3'), ('requestSha256', '0'*64)]:
            wrong = dict(review, **{field: replacement}); data = collect.encoded(wrong)
            with self.assertRaises(ValueError): build.check_review(req, raw, data, collect.digest(data))
        req['authority']['capturedAt'] = (dt.datetime.now(dt.timezone.utc)-dt.timedelta(seconds=601)).isoformat()
        with self.assertRaises(ValueError): build.check_review(req, raw, rr, collect.digest(rr))

    def test_version_no_null_and_no_retry(self):
        for version in (None, '', 'null', '-option', ['version']):
            with self.assertRaises(ValueError): build.start_input(request(), version)
        start = build.start_input(request(), 'immutable-version')
        self.assertEqual((start['autoRetryLimitOverride'], start['timeoutInMinutesOverride']), (0, 30))

    def test_collector_full_source_preflight_and_drift(self):
        root = Path(self.temp.name)
        names = [p for p, _ in build.worker_context.MEMBERS]+[collect.ASSEMBLER, collect.COLLECTOR]
        rows = []
        for name in names:
            raw = (build.ROOT/name).read_bytes(); target = root/name; target.parent.mkdir(parents=True, exist_ok=True)
            collect.write(target, raw); rows.append({'path': name, 'bytes': len(raw), 'sha256': collect.digest(raw)})
        collect.write(root/'buildspec.json', build.recipe()); rows.append({'path': 'buildspec.json', 'bytes': len(build.recipe()), 'sha256': collect.digest(build.recipe())})
        value = {'schema': collect.SCHEMA, 'sourceCommit': 'c'*40, 'runUuid': TOKEN, 'contextManifestSha256': collect.CONTEXT_SHA, 'members': rows}
        raw = collect.encoded(value); collect.validate_input(root, raw, collect.digest(raw))
        with self.assertRaises(ValueError): collect.validate_input(root, raw, 'f'*64)
        (root/collect.COLLECTOR).write_bytes(b'x'*rows[-2]['bytes'])
        with self.assertRaises(ValueError): collect.validate_input(root, raw, collect.digest(raw))
        self.assertFalse((root/'.meri-worker-evidence').exists())

    def test_source_missing_and_duplicate_before_output(self):
        root = Path(self.temp.name)
        value = {'schema': collect.SCHEMA, 'sourceCommit': 'c'*40, 'runUuid': TOKEN, 'contextManifestSha256': collect.CONTEXT_SHA,
                 'members': [{'path': 'missing', 'bytes': 1, 'sha256': 'a'*64}]*47}
        raw = collect.encoded(value)
        with self.assertRaises((ValueError, OSError)): collect.validate_input(root, raw, collect.digest(raw))
        self.assertFalse((root/'.meri-worker-evidence').exists())

    def test_real_owner_execution_closure_pins(self):
        rows = build.pins(); values = {r['path']: r for r in rows}
        self.assertEqual(values[str(build.PYTHON)]['sha256'], '10d845f50a2af64e3500bb2fcb348b5bc98a75d8ddada63e45ba1da6a1fc79d1')
        self.assertIn(str(build.PYTHON.parent/'python312.dll'), values)
        self.assertIn(str(build.PYTHON.parent/'Lib/zipfile/__init__.py'), values)
        self.assertEqual(values[str(build.ROOT/'scripts/qualification/worker_context.py')]['sha256'], collect.ASSEMBLER_SHA)

    def test_context_manifest_pin_tracks_candidate_bytes(self):
        files = {p: (build.ROOT/p).read_bytes() for p, _ in build.worker_context.MEMBERS}
        self.assertEqual(build.context_manifest_sha(files), collect.CONTEXT_SHA)
        changed = dict(files)
        path = 'packages/contracts/qualification-sdk/wire.mjs'
        changed[path] += b'\n'
        self.assertNotEqual(build.context_manifest_sha(changed), collect.CONTEXT_SHA)

    def dispatch_case(self, failure=None):
        folder = Path(self.temp.name); req = request(); collect.write(folder/'source.zip', b'zip'); seen = []
        start = build.start_input(req, 'immutable-version')
        def call(label, args):
            seen.append(label)
            if label.endswith('caller') or label == 'caller': return req['authority']['caller']
            if label in ('project', 'dispatch-project'): return {'projects': [project()], 'projectsNotFound': []}
            if label == 'activity-list': return {'ids': [], **({'nextToken': None} if failure == 'pagination' else {})}
            if label == 'upload':
                self.assertTrue((folder/'execution-reserved.json').is_file()); self.assertTrue((folder/'upload-attempted.json').is_file())
                return {'VersionId': 'immutable-version', 'ChecksumSHA256': 'Sg==', 'ServerSideEncryption': 'aws:kms', 'SSEKMSKeyId': build.KMS}
            if label == 'source-head': return {'VersionId': 'immutable-version', 'ChecksumSHA256': 'Sg==', 'ContentLength': 3,
                'ServerSideEncryption': 'aws:kms', 'SSEKMSKeyId': build.KMS, 'Metadata': {'sourcecommit': req['sourceCommit'], 'archivesha256': req['archive']['sha256']}}
            if label == 'start-build':
                self.assertTrue((folder/'start-build-attempted.json').is_file())
                if failure == 'lost': raise TimeoutError('synthetic lost ACK')
                return {'build': {'id': build.PROJECT+':'+TOKEN}}
            self.fail(label)
        import base64
        checksum = base64.b64encode(bytes.fromhex(req['archive']['sha256'])).decode()
        def transport(label, args):
            value = call(label, args)
            if label in ('upload', 'source-head'): value['ChecksumSHA256'] = checksum
            return value
        with patch.object(build, 'pins', return_value=[]), patch.object(build, 'validate_build'):
            if failure:
                with self.assertRaises((TimeoutError, ValueError)): build.dispatch(folder, req, b'raw', 'review', transport)
            else: self.assertEqual(build.dispatch(folder, req, b'raw', 'review', transport)['status'], 'DISPATCHED_NOT_ACCEPTED')
        return folder, seen, req, start

    def setUp(self): self.temp = tempfile.TemporaryDirectory()
    def tearDown(self): self.temp.cleanup()

    def test_dispatch_one_upload_one_start(self):
        folder, seen, _, _ = self.dispatch_case()
        self.assertEqual((seen.count('upload'), seen.count('start-build')), (1, 1))
        self.assertTrue((folder/'execution-reserved.json').is_file())

    def test_lost_ack_consumes_forever(self):
        folder, seen, _, _ = self.dispatch_case('lost')
        self.assertEqual(seen.count('start-build'), 1)
        self.assertEqual(collect.loads((folder/'outcome.json').read_bytes())['status'], 'CONSUMED_UNKNOWN_NO_RETRY')
        with self.assertRaises(FileExistsError): collect.save(folder/'execution-reserved.json', {})

    def test_pagination_before_reserve(self):
        folder, seen, _, _ = self.dispatch_case('pagination')
        self.assertFalse((folder/'execution-reserved.json').exists()); self.assertNotIn('upload', seen)

    def test_build_ack_full_source_and_retry(self):
        req = request(); start = build.start_input(req, 'immutable-version'); p = project()
        env = copy.deepcopy(p['environment']); env['environmentVariables'] = sorted(start['environmentVariablesOverride'], key=lambda r: r['name'])
        value = {'id': build.PROJECT+':'+TOKEN, 'arn': f'arn:aws:codebuild:{build.REGION}:{build.ACCOUNT}:build/'+build.PROJECT+':'+TOKEN,
                 'projectName': build.PROJECT, 'sourceVersion': 'immutable-version', 'timeoutInMinutes': 30, 'queuedTimeoutInMinutes': 5,
                 'autoRetryConfig': {'autoRetryLimit': 0}, 'source': dict(p['source'], location=start['sourceLocationOverride'], buildspec=start['buildspecOverride']),
                 'environment': env, 'serviceRole': build.ROLE, 'encryptionKey': build.KMS, 'cache': p['cache'], 'artifacts': {'location': ''},
                 'logs': {'cloudWatchLogs': p['logsConfig']['cloudWatchLogs']}}
        build.validate_build(value, req, start)
        for key, wrong in [('autoRetryConfig', {'autoRetryLimit': 1}), ('sourceVersion', 'foreign'), ('serviceRole', 'foreign')]:
            with self.assertRaises(ValueError): build.validate_build(dict(value, **{key: wrong}), req, start)

    def test_tar_exact_regular(self):
        self.assertEqual(collect.unpack_artifact(tar_bytes([('runtime-versions.txt', b'version', tarfile.REGTYPE)]), 'runtime-versions.txt'), b'version')
        for items in [[('../runtime-versions.txt', b'', tarfile.REGTYPE)], [('runtime-versions.txt', b'', tarfile.SYMTYPE)],
                      [('runtime-versions.txt', b'', tarfile.REGTYPE)]*2]:
            with self.assertRaises(ValueError): collect.unpack_artifact(tar_bytes(items), 'runtime-versions.txt')

    def test_image_iid_platform_volumes_credentials(self):
        collect.validate_image(image(), IID)
        for mutate in [lambda r: r.update(Id='foreign'), lambda r: r.update(Architecture='arm64'),
                       lambda r: r['Config']['Volumes'].update({'/extra': {}}), lambda r: r['Config']['Env'].append('AWS_ACCESS_KEY_ID=synthetic')]:
            value = image(); mutate(value[0])
            with self.assertRaises(ValueError): collect.validate_image(value, IID)

    def test_two_owned_anonymous_volumes(self):
        self.assertEqual(collect.owned_container(container(), IID, NAME, TOKEN), (CID, ['d'*64, 'e'*64]))
        for mutate in [lambda r: r.update(Image='foreign'), lambda r: r['State'].update(Running=True),
                       lambda r: r['HostConfig'].update(Binds=['/host:/tmp']), lambda r: r['Mounts'][0].update(Type='bind')]:
            value = container(); mutate(value[0])
            with self.assertRaises(ValueError): collect.owned_container(value, IID, NAME, TOKEN)

    def test_inventory_frozen_binary_pins_and_source_entries(self):
        component = collect.loads((build.ROOT/'apps/worker/qualification/component-pins.json').read_bytes())
        browser = component['chromium']; sdk = next(r for r in component['npm'] if r['name'] == '@anthropic-ai/claude-agent-sdk')
        pins = {browser['installedPaths']['chrome']: {'sha256': browser['perFilePins']['chrome-linux64/chrome']},
                '/opt/meri-worker/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude': {'sha256': sdk['bundledCli']['linuxX64BinaryChecksum']}}
        pins.update({p: {'sha256': browser['perFilePins']['chrome-linux64/chrome_sandbox'], 'mode': '4755', 'uid': 0, 'gid': 0} for p in collect.HELPERS})
        entries = [dict(path=p, type='file', **pin) for p, pin in pins.items()]
        source = {'contextPath': 'probes/sdk-interruption.mjs', 'bytes': 123, 'sha256': 'a'*64}
        entries.append({'path': '/opt/meri-worker/probes/sdk-interruption.mjs', 'type': 'file', 'size': 123, 'sha256': 'a'*64})
        private = {'contextPath': 'build-dependencies/contracts/qualification-sdk/wire.mjs', 'bytes': 321, 'sha256': 'b'*64}
        entries.append({'path': '/packages/contracts/qualification-sdk/wire.mjs', 'type': 'file', 'size': 321, 'sha256': 'b'*64})
        value = {'schema': 'meri.qualification.image-inventory/1', 'ok': True, 'refused': False, 'truncated': False,
                 'coverage': {'complete': True}, 'summary': {'roots': sorted(collect.REQUIRED_ROOTS), 'errors': 0,
                 'expectationFailures': 0, 'unexpectedPrivilegeEntries': 0, 'limitsExceeded': None}, 'errors': [], 'unexpectedPrivilegeFiles': [],
                 'entries': entries, 'expectations': [{'path': p, 'status': 'match', 'expected': pin} for p, pin in pins.items()],
                 'privilegeFiles': [{'path': p} for p in collect.HELPERS]}
        collect.validate_inventory(collect.encoded(value), [source, private], component)
        with self.assertRaises(ValueError):
            collect.validate_inventory(collect.encoded(value),
                                       [source, {'contextPath': 'build-dependencies/foreign/unknown.mjs',
                                                 'bytes': 1, 'sha256': 'f'*64}], component)
        for mutate in [lambda r: r['expectations'][0]['expected'].update(sha256='f'*64),
                       lambda r: r['entries'][-1].update(sha256='f'*64), lambda r: r.update(truncated=True),
                       lambda r: r['privilegeFiles'].append({'path': '/foreign'})]:
            wrong = copy.deepcopy(value); mutate(wrong)
            with self.assertRaises(ValueError): collect.validate_inventory(collect.encoded(wrong), [source, private], component)

    def test_lost_create_ack_owned_cleanup_both_volumes(self):
        output = Path(self.temp.name); seen = []; manifest = {'sourceCommit': 'c'*40, 'runUuid': TOKEN}
        def call(label, args, *bounds):
            seen.append(label)
            if label == 'docker-build': collect.write(output/'image.iid', IID.encode()); return b''
            if label == 'image-inspect': return collect.encoded(image())
            if label == 'container-create': raise TimeoutError('lost ACK')
            if label in ('container-inspect', 'cleanup-inspect'): return collect.encoded(container())
            if label == 'container-remove': return CID.encode()+b'\n'
            if label == 'container-absence' or label.startswith('volume-absence'): return b''
            self.fail(label)
        result = collect.collect(output, manifest, output, output, call, time.monotonic()+1000)
        self.assertEqual(result['status'], 'FAILED_OR_UNKNOWN'); self.assertTrue(result['physicalCleanupConfirmed'])
        self.assertFalse(result['captureComplete']); self.assertEqual(seen[-2:], ['volume-absence-0', 'volume-absence-1'])
        self.assertNotIn('start', seen)

    def test_foreign_create_never_remove(self):
        output = Path(self.temp.name); seen = []
        def call(label, args, *bounds):
            seen.append(label)
            if label == 'docker-build': collect.write(output/'image.iid', IID.encode()); return b''
            if label == 'image-inspect': return collect.encoded(image())
            if label == 'container-create': return CID.encode()
            if label == 'container-inspect':
                value = container(); value[0]['Image'] = 'foreign'; return collect.encoded(value)
            self.fail(label)
        result = collect.collect(output, {'sourceCommit': 'c'*40, 'runUuid': TOKEN}, output, output, call, time.monotonic()+1000)
        self.assertFalse(result['physicalCleanupConfirmed']); self.assertNotIn('container-remove', seen)

    def test_bounded_bundle_prefix_and_exclusions(self):
        folder = Path(self.temp.name); output = folder/'out'; output.mkdir()
        collect.write(output/'a.json', b'123456'); collect.write(output/'b.bin', b'abcdef')
        target = folder/'result.tar.gz'; collect.bundle(output, target, byte_limit=8, member_limit=4)
        with tarfile.open(target) as archive:
            manifest = collect.loads(archive.extractfile('capture-manifest.json').read())
            self.assertFalse(manifest['complete']); self.assertEqual(sum(r['budgetCharged'] for r in manifest['files']), 8)
            self.assertEqual(sum(r['bytes'] for r in manifest['files']), 8)

    def test_bundle_after_copy_metadata_failure_retained(self):
        folder = Path(self.temp.name); output = folder/'out'; output.mkdir(); target = output/'a.bin'; collect.write(target, b'abcdef')
        original = Path.lstat; calls = 0
        def lstat(path, *args, **kwargs):
            nonlocal calls
            if path == target:
                calls += 1
                if calls == 4: raise OSError('synthetic post-copy metadata error')
            return original(path, *args, **kwargs)
        with patch.object(Path, 'lstat', lstat): collect.bundle(output, folder/'result.tar.gz', byte_limit=6)
        with tarfile.open(folder/'result.tar.gz') as archive:
            row = collect.loads(archive.extractfile('capture-manifest.json').read())['files'][0]
            self.assertEqual(row['budgetCharged'], 6); self.assertEqual(row['bytes'], 6); self.assertFalse(row['complete'])

    def test_json_float_overflow_and_nested_nonfinite_refused(self):
        for value in (b'1e309', b'-1e309', b'{"nested":[1e309]}', b'{"nested":-1e309}',
                      b'Infinity', b'-Infinity', b'{"nested":[NaN]}', b'{"a":1,"a":2}', b'"\xff"'):
            with self.subTest(value=value):
                with self.assertRaises(ValueError): collect.loads(value)

    def test_json_finite_floats_preserved(self):
        self.assertEqual(collect.loads(b'{"tiny":1e-309,"negative":-2.5,"large":1e308,"zero":0.0}'),
                         {'tiny': 1e-309, 'negative': -2.5, 'large': 1e308, 'zero': 0.0})
        self.assertEqual(collect.loads(b'{"nested":[1.25,true,null]}'), {'nested': [1.25, True, None]})

    def test_create_ack_bound_to_owned_inspect_before_artifacts(self):
        for ack, reaches_artifact in ((CID.encode()+b'\n', True), (b'f'*64, False)):
            with self.subTest(ack=ack), tempfile.TemporaryDirectory() as temp:
                output = Path(temp); seen = []; removes = []
                def call(label, args, *bounds):
                    seen.append(label)
                    if label == 'docker-build': collect.write(output/'image.iid', IID.encode()); return b''
                    if label == 'image-inspect': return collect.encoded(image())
                    if label == 'container-create': return ack
                    if label in ('container-inspect', 'cleanup-inspect'): return collect.encoded(container())
                    if label == 'artifact-0': raise TimeoutError('synthetic artifact failure after identity gate')
                    if label == 'container-remove': removes.append(args[-1]); return CID.encode()+b'\n'
                    if label == 'container-absence' or label.startswith('volume-absence'): return b''
                    self.fail(label)
                result = collect.collect(output, {'sourceCommit': 'c'*40, 'runUuid': TOKEN}, output, output, call, time.monotonic()+1000)
                self.assertEqual('artifact-0' in seen, reaches_artifact)
                self.assertEqual(removes, [CID])
                self.assertEqual(result['failureClass'], 'TimeoutError' if reaches_artifact else 'ValueError')
                self.assertEqual(result['status'], 'FAILED_OR_UNKNOWN')
                self.assertTrue(result['physicalCleanupConfirmed'])
                self.assertFalse(result['captureComplete'])

    def test_cleanup_inspect_retains_exact_cid_and_volume_set(self):
        for drift in ('cid', 'volume', 'duplicate-volume', 'order-only'):
            with self.subTest(drift=drift), tempfile.TemporaryDirectory() as temp:
                output = Path(temp); seen = []
                def call(label, args, *bounds):
                    seen.append(label)
                    if label == 'docker-build': collect.write(output/'image.iid', IID.encode()); return b''
                    if label == 'image-inspect': return collect.encoded(image())
                    if label == 'container-create': return CID.encode()
                    if label == 'container-inspect': return collect.encoded(container())
                    if label == 'cleanup-inspect':
                        value = container()
                        if drift == 'cid': value[0]['Id'] = 'c'*64
                        elif drift == 'volume': value[0]['Mounts'][0]['Name'] = 'f'*64
                        elif drift == 'duplicate-volume': value[0]['Mounts'][0]['Name'] = value[0]['Mounts'][1]['Name']
                        else: value[0]['Mounts'].reverse()
                        return collect.encoded(value)
                    if label == 'artifact-0': raise TimeoutError('synthetic artifact boundary')
                    if label == 'container-remove': self.assertEqual(args[-1], CID); return CID.encode()
                    if label == 'container-absence' or label.startswith('volume-absence'): return b''
                    self.fail(label)
                result = collect.collect(output, {'sourceCommit': 'c'*40, 'runUuid': TOKEN}, output, output, call, time.monotonic()+1000)
                self.assertEqual('container-remove' in seen, drift == 'order-only')
                self.assertEqual(result['physicalCleanupConfirmed'], drift == 'order-only')
                if drift != 'order-only':
                    self.assertEqual(result['cleanupFailureClass'], 'ValueError')
                    self.assertNotIn('container-absence', seen)
                    self.assertFalse(any(label.startswith('volume-absence') for label in seen))
                self.assertFalse(result['captureComplete'])


    def test_initial_full_ack_with_zero_retry_counter(self):
        req, start, ack = full_ack()
        build.validate_build(ack, req, start)
        ack['autoRetryConfig'] = {'autoRetryLimit': 0, 'autoRetryNumber': 0}
        build.validate_build(ack, req, start)
        self.assertEqual(start['autoRetryLimitOverride'], 0)

    def test_full_ack_retry_fields_are_closed_integer_zero(self):
        req, start, ack = full_ack()
        invalid = [None, [], {}, {'autoRetryNumber': 0}, {'autoRetryLimit': 0, 'nextAutoRetry': None},
                   {'autoRetryLimit': 0, 'autoRetryNumber': 0, 'unknown': 0}]
        for field in ('autoRetryLimit', 'autoRetryNumber'):
            for value in (1, -1, False, True, 0.0, '0', None, [], {}):
                invalid.append({'autoRetryLimit': 0, 'autoRetryNumber': 0} | {field: value})
        for retry in invalid:
            with self.subTest(retry=retry), self.assertRaises(ValueError):
                build.validate_build(dict(ack, autoRetryConfig=retry), req, start)

    def test_full_ack_zero_counter_does_not_waive_other_bindings(self):
        req, start, ack = full_ack()
        ack['autoRetryConfig'] = {'autoRetryLimit': 0, 'autoRetryNumber': 0}
        for field, value in (('sourceVersion', 'foreign'), ('serviceRole', 'foreign'),
                             ('encryptionKey', 'foreign'), ('queuedTimeoutInMinutes', 6)):
            with self.subTest(field=field), self.assertRaises(ValueError):
                build.validate_build(dict(ack, **{field: value}), req, start)


def full_ack():
    """Independent complete synthetic ACK, using the existing literal project fixture."""
    req = request(); start = build.start_input(req, 'immutable-version'); p = project()
    env = copy.deepcopy(p['environment'])
    env['environmentVariables'] = sorted(start['environmentVariablesOverride'], key=lambda row: row['name'])
    ack = {'id': build.PROJECT+':'+TOKEN, 'arn': f'arn:aws:codebuild:{build.REGION}:{build.ACCOUNT}:build/'+build.PROJECT+':'+TOKEN,
           'projectName': build.PROJECT, 'sourceVersion': 'immutable-version', 'timeoutInMinutes': 30,
           'queuedTimeoutInMinutes': 5, 'autoRetryConfig': {'autoRetryLimit': 0},
           'source': dict(p['source'], location=start['sourceLocationOverride'], buildspec=start['buildspecOverride']),
           'environment': env, 'serviceRole': build.ROLE, 'encryptionKey': build.KMS, 'cache': p['cache'],
           'artifacts': {'location': ''}, 'logs': {'cloudWatchLogs': p['logsConfig']['cloudWatchLogs']}}
    return req, start, ack


if __name__ == '__main__': unittest.main()
