"""Synthetic fake Docker transport only; no images, engines or commands run."""
import contextlib
import copy
import io
from pathlib import Path
import tarfile
import tempfile
import time
import unittest
from unittest.mock import patch

import proxy_runtime_collect as m

RUN = '11111111-1111-4111-8111-111111111111'
IID = 'sha256:'+'a'*64
CID = 'b'*64
DATA = {key: ('synthetic-'+key).encode() for key in m.EXPECTED}
SYNTHETIC = {key: {**row, 'bytes': len(DATA[key]), 'sha256': m.common.digest(DATA[key])}
             for key, row in m.EXPECTED.items()}


def tar(raw, name, kind=tarfile.REGTYPE, extra=False):
    out = io.BytesIO()
    with tarfile.open(fileobj=out, mode='w', format=tarfile.USTAR_FORMAT) as archive:
        item = tarfile.TarInfo(name); item.type = kind
        if kind == tarfile.REGTYPE:
            item.size = len(raw); archive.addfile(item, io.BytesIO(raw))
        else:
            item.linkname = 'elsewhere'; archive.addfile(item)
        if extra:
            archive.addfile(tarfile.TarInfo('extra'))
    return out.getvalue()


class Fake:
    def __init__(self):
        self.image = [{'Id': IID, 'Os': 'linux', 'Architecture': 'amd64', 'Config': {
            'User': '10001:10001', 'WorkingDir': '/tmp', 'Entrypoint': m.ENTRY, 'Volumes': None,
            'Labels': {}, 'Env': ['PYTHONDONTWRITEBYTECODE=1', 'PIP_NO_INDEX=1',
            'PIP_DISABLE_PIP_VERSION_CHECK=1', 'LITELLM_LOCAL_MODEL_COST_MAP=True',
            'HOME=/tmp/meri-home', 'TMPDIR=/tmp']}}]
        self.container = [{'Id': CID, 'Name': '/meri-proxy-runtime4-'+RUN, 'Image': IID,
            'Config': {'Labels': {m.LABEL: RUN}, 'User': '10001:10001', 'WorkingDir': '/tmp',
                       'Env': copy.deepcopy(self.image[0]['Config']['Env']),
                       'Entrypoint': ['/meri-runtime4-never-start']},
            'State': {'Status': 'created', 'Running': False, 'StartedAt': '0001-01-01T00:00:00Z'},
            'HostConfig': {'NetworkMode': 'none', 'ReadonlyRootfs': True, 'CapDrop': ['ALL'],
                           'SecurityOpt': ['no-new-privileges'], 'Privileged': False}, 'Mounts': []}]
        self.calls = []; self.lost_ack = False; self.absence = b''; self.preexisting = b''; self.tar_change = None

    def __call__(self, label, argv, *, seconds, cap):
        self.calls.append((label, argv))
        assert argv[0] == 'docker' and seconds > 0 and 0 < cap <= 33*1024*1024
        if label == 'image': return m.common.encoded(self.image)
        if label == 'pre-create-absence': return self.preexisting
        if label == 'create':
            if self.lost_ack: raise TimeoutError('synthetic lost ACK')
            return (CID+'\n').encode()
        if label in ('created', 'cleanup-owner'): return m.common.encoded(self.container)
        if label.startswith('body-'):
            key = label[5:]; name = Path(SYNTHETIC[key]['path']).name
            raw = tar(DATA[key], name)
            return self.tar_change(key, raw) if self.tar_change else raw
        if label == 'remove': return (CID+'\n').encode()
        if label == 'container-absence': return self.absence
        raise AssertionError('unexpected command')


class Collector(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name).absolute()
        self.addCleanup(self.temp.cleanup)
        self.mock = patch.object(m, 'EXPECTED', SYNTHETIC); self.mock.start(); self.addCleanup(self.mock.stop)
        self.recipe = b'fixed synthetic recipe\n'
        self.context = m.common.encoded({'schema': 'synthetic.context/1', 'sourceCommit': 'c'*40,
            'files': [{'path': 'Dockerfile', 'bytes': len(self.recipe), 'sha256': m.common.digest(self.recipe)}]})
        self.binding = {'schema': 'meri.proxy.runtime4.collect-input/1', 'runId': RUN,
            'sourceCommit': 'c'*40, 'imageId': IID, 'contextSha256': m.common.digest(self.context),
            'recipeSha256': m.common.digest(self.recipe), 'bodies': copy.deepcopy(SYNTHETIC),
            'sources': {name: {'bytes': len(path.read_bytes()), 'sha256': m.common.digest(path.read_bytes())}
                        for name, path in m.SOURCES.items()}}
        self.fake = Fake()

    def run_collect(self, mutate=None, **kwargs):
        value = copy.deepcopy(self.binding)
        if mutate: mutate(value)
        raw = m.common.encoded(value)
        return m.collect(raw, m.common.digest(raw), context_raw=kwargs.get('context', self.context),
            recipe_raw=kwargs.get('recipe', self.recipe), output=self.root/'out',
            deadline=kwargs.get('deadline', time.monotonic()+90), transport=self.fake)

    def test_exact_four_measured_after_positive_cleanup(self):
        result = self.run_collect()
        self.assertTrue(result['collectionPassed']); self.assertFalse(result['runtimeAdmitted'])
        self.assertEqual(set(result['bodies']), set(DATA))
        for key, raw in DATA.items(): self.assertEqual((self.root/'out'/(key+'.bin')).read_bytes(), raw)
        self.assertTrue(all(args[1] not in ('start', 'exec', 'build', 'pull', 'push') for _, args in self.fake.calls))

    def test_wrong_source_refuses_before_output_or_transport(self):
        with self.assertRaisesRegex(ValueError, 'source drift'):
            self.run_collect(lambda b: b['sources']['proxy_runtime_collect.py'].update(sha256='0'*64))
        self.assertFalse((self.root/'out').exists()); self.assertEqual(self.fake.calls, [])

    def test_wrong_context_recipe_and_body_expectations(self):
        for field in ('contextSha256', 'recipeSha256'):
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.run_collect(lambda b: b.update({field: '0'*64}))
        with self.assertRaises(ValueError): self.run_collect(lambda b: b['bodies']['cli'].update(bytes=1))
        self.assertEqual(self.fake.calls, [])

    def test_closed_binding_duplicate_and_nonfinite(self):
        for raw in (b'{"a":1,"a":2}', b'{"a":NaN}'):
            with self.assertRaises(ValueError):
                m.collect(raw, m.common.digest(raw), context_raw=self.context, recipe_raw=self.recipe,
                          output=self.root/'out', deadline=time.monotonic()+90, transport=self.fake)
        with self.assertRaises(ValueError): self.run_collect(lambda b: b.update(extra=True))

    def test_body_size_float_cannot_equal_integer_expectation(self):
        with self.assertRaisesRegex(ValueError, 'primitive body record'):
            self.run_collect(lambda b: b['bodies']['schema'].update(bytes=float(b['bodies']['schema']['bytes'])))
        self.assertEqual(self.fake.calls, []); self.assertFalse((self.root/'out').exists())

    def test_deadline_and_existing_output_refuse(self):
        with self.assertRaises(ValueError): self.run_collect(deadline=time.monotonic()+20)
        (self.root/'out').mkdir()
        with self.assertRaises(ValueError): self.run_collect()
        self.assertEqual(self.fake.calls, [])

    def test_wrong_iid_and_credential_env_do_not_create(self):
        self.fake.image[0]['Id'] = 'sha256:'+'f'*64
        self.assertFalse(self.run_collect()['collectionPassed'])
        self.assertEqual([x[0] for x in self.fake.calls], ['image'])

    def test_credential_environment_refuses_before_create(self):
        self.fake.image[0]['Config']['Env'].append('AWS_ACCESS_KEY_ID=synthetic')
        result = self.run_collect()
        self.assertFalse(result['collectionPassed']); self.assertFalse(result['cleanupConfirmed'])
        self.assertEqual([x[0] for x in self.fake.calls], ['image'])

    def test_declared_volume_refused_before_create(self):
        self.fake.image[0]['Config']['Volumes'] = {'/tmp': {}}
        self.assertFalse(self.run_collect()['collectionPassed'])
        self.assertEqual([x[0] for x in self.fake.calls], ['image'])

    def test_lost_ack_reconciles_owned_cleanup_but_never_passes(self):
        self.fake.lost_ack = True
        result = self.run_collect()
        self.assertFalse(result['collectionPassed']); self.assertTrue(result['cleanupConfirmed'])
        self.assertEqual(result['errorType'], 'TimeoutError'); self.assertEqual(result['bodies'], {})

    def test_preexisting_exact_name_is_never_adopted_or_removed(self):
        self.fake.preexisting = (CID+'\n').encode()
        result = self.run_collect()
        self.assertFalse(result['createAttempted']); self.assertFalse(result['collectionPassed'])
        self.assertEqual([x[0] for x in self.fake.calls], ['image', 'pre-create-absence'])
        self.assertFalse((self.root/'out'/'create-attempt.json').exists())

    def test_attempt_receipt_exists_before_send_and_lost_ack_is_retained(self):
        original = self.fake
        def transport(label, argv, **kwargs):
            if label == 'create':
                attempt = m.common.loads((self.root/'out'/'create-attempt.json').read_bytes())
                self.assertEqual(attempt['state'], 'ATTEMPT_BEFORE_SEND_NO_RETRY')
                self.assertEqual(attempt['imageId'], IID)
                raise TimeoutError('synthetic lost ACK')
            return original(label, argv, **kwargs)
        self.fake = transport
        result = self.run_collect()
        self.assertTrue(result['createAttempted']); self.assertEqual(result['containerId'], CID)
        self.assertTrue(result['cleanupConfirmed']); self.assertFalse(result['collectionPassed'])

    def test_cleanup_owner_drift_prevents_remove(self):
        original = self.fake
        def transport(label, argv, **kwargs):
            if label == 'cleanup-owner': original.container[0]['Image'] = 'sha256:'+'f'*64
            return original(label, argv, **kwargs)
        self.fake = transport
        result = self.run_collect()
        self.assertFalse(result['collectionPassed']); self.assertFalse(result['cleanupConfirmed'])
        self.assertNotIn('remove', [x[0] for x in original.calls])

    def test_foreign_container_never_removed(self):
        self.fake.container[0]['Config']['Labels'][m.LABEL] = 'foreign'
        result = self.run_collect()
        self.assertFalse(result['cleanupConfirmed'])
        self.assertNotIn('remove', [x[0] for x in self.fake.calls])

    def test_same_image_container_environment_override_is_not_owned(self):
        self.fake.container[0]['Config']['Env'].append('DATABASE_URL=synthetic')
        result = self.run_collect()
        self.assertFalse(result['cleanupConfirmed']); self.assertNotIn('remove', [x[0] for x in self.fake.calls])

    def test_started_or_mounted_container_never_removed(self):
        self.fake.container[0]['State']['Running'] = True
        result = self.run_collect(); self.assertFalse(result['cleanupConfirmed'])
        self.assertNotIn('remove', [x[0] for x in self.fake.calls])

    def test_mount_and_changed_cleanup_owner_are_not_removed(self):
        self.fake.container[0]['Mounts'] = [{'Type': 'volume', 'Name': 'foreign'}]
        result = self.run_collect()
        self.assertFalse(result['cleanupConfirmed']); self.assertNotIn('remove', [x[0] for x in self.fake.calls])

    def test_cleanup_absence_uncertainty_never_passes(self):
        self.fake.absence = (CID+'\n').encode()
        result = self.run_collect()
        self.assertFalse(result['collectionPassed']); self.assertFalse(result['cleanupConfirmed'])
        self.assertEqual(result['cleanupErrorType'], 'ValueError')

    def test_body_substitution_retains_failure_and_cleans(self):
        self.fake.tar_change = lambda key, raw: tar(b'x'*len(DATA[key]), Path(SYNTHETIC[key]['path']).name)
        result = self.run_collect()
        self.assertFalse(result['collectionPassed']); self.assertTrue(result['cleanupConfirmed'])
        self.assertEqual(result['bodies'], {})

    def test_tar_links_traversal_extra_truncation_hidden_tail_refused(self):
        key = 'schema'; name = Path(SYNTHETIC[key]['path']).name
        values = [tar(DATA[key], name, tarfile.SYMTYPE), tar(DATA[key], '../'+name),
                  tar(DATA[key], name, extra=True), tar(DATA[key], name)[:1024],
                  tar(DATA[key], name)+b'x'*512, b'x'*(len(DATA[key])+10241)]
        for raw in values:
            with self.subTest(size=len(raw)), self.assertRaises((ValueError, tarfile.TarError)):
                m.body(raw, key)

    def test_aggregate_cap_and_post_source_drift_refuse(self):
        with patch.object(m, 'AGGREGATE_CAP', 1):
            result = self.run_collect()
        self.assertFalse(result['collectionPassed']); self.assertTrue(result['cleanupConfirmed'])

    def test_live_source_copy_drift_disqualifies_measurement(self):
        copied = self.root/'source.py'; copied.write_bytes(m.SOURCES['proxy_runtime_collect.py'].read_bytes())
        def mutate_source(key, raw):
            copied.write_bytes(b'changed source')
            return raw
        self.fake.tar_change = mutate_source
        with patch.dict(m.SOURCES, {'proxy_runtime_collect.py': copied}):
            result = self.run_collect()
        self.assertFalse(result['sourceStable']); self.assertFalse(result['collectionPassed'])
        self.assertTrue(result['cleanupConfirmed'])

    def test_safe_help_and_missing_configuration(self):
        for argv, code in [(['--help'], 0), ([], 2), (['--image', IID], 2)]:
            with self.subTest(argv=argv), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as caught: m.main(argv)
                self.assertEqual(caught.exception.code, code)


if __name__ == '__main__':
    unittest.main()
