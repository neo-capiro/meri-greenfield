"""Independent finite tests of the one-canary owner fallback.

All AWS calls and evidence writes use strict in-memory fakes. No CLI, native
task, filesystem cleanup or network operation is executed. A stop acknowledgement
never establishes STOPPED or managed-survival qualification.
"""
import copy
import datetime as dt
import hashlib
import importlib.util
import io
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).with_name('canary_cleanup.py')
EXPECTED_SOURCE_SHA256 = 'f67a0e587326281903c97d7772b8b73941981248d90759bc105eeadd4eb7de51'
raw = SOURCE.read_bytes()
if hashlib.sha256(raw).hexdigest() != EXPECTED_SOURCE_SHA256:
    raise AssertionError('fallback source changed; independent test pin requires review')
spec = importlib.util.spec_from_file_location('reviewed_canary_cleanup', SOURCE)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

ARN = m.TASK_PREFIX + '1' * 32
T0 = int(dt.datetime(2026, 10, 10, 15, 0, tzinfo=dt.timezone.utc).timestamp() * 1000)
CALLER = {'UserId': 'AIDA6CVOOW5YCNOGMSALQ', 'Account': '967807252336',
          'Arn': 'arn:aws:iam::967807252336:user/capirocli'}


def task():
    return {'taskArn': ARN, 'clusterArn': m.CLUSTER,
            'taskDefinitionArn': m.DEFINITION, 'startedBy': m.RUN,
            'group': 'meri-greenfield-qualification:canary',
            'tags': [{'key': 'QualificationRun', 'value': m.RUN},
                     {'key': 'QualificationProbe', 'value': 'canary'},
                     {'key': 'MeriComponent', 'value': 'native-enforcement'}],
            'createdAt': '2026-10-10T15:00:00Z', 'lastStatus': 'RUNNING'}


class MemoryPath:
    def __init__(self, fs, parts=('runtime',)):
        self.fs, self.parts = fs, parts

    def __truediv__(self, name):
        if not isinstance(name, str) or '/' in name or name in ('.', '..'):
            raise AssertionError('unexpected evidence path')
        return MemoryPath(self.fs, self.parts + (name,))

    def is_dir(self):
        return self.parts in self.fs['dirs']

    def mkdir(self, exist_ok=False):
        if self.parts in self.fs['dirs']:
            if not exist_ok:
                raise FileExistsError('consumed fake evidence path')
        elif self.parts[:-1] not in self.fs['dirs']:
            raise FileNotFoundError('missing fake parent')
        else:
            self.fs['dirs'].add(self.parts)

    def read_bytes(self):
        if self.parts not in self.fs['files']:
            raise FileNotFoundError('missing fake evidence')
        return self.fs['files'][self.parts]

    def open(self, mode):
        if mode != 'xb' or self.parts in self.fs['files']:
            raise FileExistsError('exclusive fake file only')
        if self.parts[:-1] not in self.fs['dirs']:
            raise FileNotFoundError('missing fake directory')
        path = self

        class Writer(io.BytesIO):
            def __exit__(self, *exc):
                path.fs['files'][path.parts] = self.getvalue()
                return super().__exit__(*exc)
        return Writer()


class FallbackTests(unittest.TestCase):
    def setUp(self):
        self.fs = {'dirs': {('runtime',)}, 'files': {}}
        self.root = MemoryPath(self.fs)
        self.reservation = {'runUuid': m.RUN,
                            'staticBindingId': '03735688327d41c6bad35e86ef4f8f1cc93d3cbfd3eb8844433fab5be2bdd8f0',
                            't0Ms': T0}
        self.fs['files'][('runtime', 'execution-reserved.json')] = m.encode(self.reservation)
        self.response = {'tasks': [task()], 'failures': []}
        self.caller, self.fail, self.trace = dict(CALLER), None, []
        self.guard = patch.object(m.subprocess, 'run', side_effect=AssertionError('REAL PROCESS FORBIDDEN'))
        self.evidence = patch.object(m, 'EVIDENCE', self.root)
        self.calls = patch.object(m, 'capture', self.capture)
        self.guard.start(); self.evidence.start(); self.calls.start()
        self.addCleanup(self.calls.stop); self.addCleanup(self.evidence.stop); self.addCleanup(self.guard.stop)

    def capture(self, out, label, args):
        self.trace.append((label, copy.deepcopy(args)))
        if label == self.fail:
            raise subprocess.TimeoutExpired(['FAKE_AWS'], 45)
        if label == 'caller':
            self.assertEqual(args, ['sts', 'get-caller-identity'])
            return copy.deepcopy(self.caller)
        if label == 'task-before':
            self.assertEqual(args, ['ecs', 'describe-tasks', '--cluster', m.CLUSTER, '--tasks', ARN, '--include', 'TAGS'])
            return copy.deepcopy(self.response)
        if label == 'stop-task':
            self.assertEqual(args[:6], ['ecs', 'stop-task', '--cluster', m.CLUSTER, '--task', ARN])
            marker = m.parse((out / 'stop-attempted.json').read_bytes())
            self.assertEqual(marker['taskArn'], ARN)
            self.assertEqual(marker['qualification'], 'FAILED_OR_UNKNOWN')
            return {'task': {'taskArn': ARN, 'lastStatus': 'STOPPING'}}
        raise AssertionError('unexpected fake operation')

    def no_stop(self):
        self.assertFalse(any(args[:2] == ['ecs', 'stop-task'] for _, args in self.trace))

    def refuse_task(self, mutate):
        mutate(self.response)
        with self.assertRaises((ValueError, TypeError)):
            m.execute(ARN)
        self.no_stop()

    def test_exact_positive_has_one_stop_and_no_terminal_or_qualification_claim(self):
        result = m.execute(ARN)
        self.assertEqual([label for label, _ in self.trace], ['caller', 'task-before', 'stop-task'])
        self.assertEqual(result, {'status': 'STOP_REQUESTED_NOT_TERMINAL_CONFIRMED', 'qualification': 'FAILED_OR_UNKNOWN', 'taskArn': ARN})

    def test_already_stopped_is_no_mutation_and_still_not_survival_pass(self):
        self.response['tasks'][0]['lastStatus'] = 'STOPPED'
        result = m.execute(ARN)
        self.no_stop()
        self.assertEqual(result['status'], 'ALREADY_STOPPED_NO_MUTATION')
        self.assertEqual(result['qualification'], 'FAILED_OR_UNKNOWN')

    def test_each_identity_mismatch_denies_stop(self):
        for key, value in [('taskArn', m.TASK_PREFIX+'2'*32), ('clusterArn', 'foreign'),
                           ('taskDefinitionArn', m.DEFINITION[:-1]+'2'), ('startedBy', 'foreign'), ('group', 'family:canary')]:
            response = {'tasks': [task()], 'failures': []}; response['tasks'][0][key] = value
            with self.subTest(field=key), self.assertRaises(ValueError):
                m.owned_task(response, ARN, T0, T0+1000)

    def test_foreign_namespace_denies_before_any_aws_call(self):
        for arn in (ARN.replace('967807252336', '111111111111'), ARN.replace('qualification/', 'current-meri/'), ARN+' ', ARN.upper(), '--task'):
            with self.subTest(arn=arn), self.assertRaises(ValueError):
                m.execute(arn)
        self.assertEqual(self.trace, [])

    def test_current_wrong_tag_denies_stop(self):
        self.refuse_task(lambda r: r['tasks'][0]['tags'][0].update(value='foreign-run'))

    def test_missing_duplicate_extra_and_malformed_tags_refused(self):
        for tags in ([], task()['tags'][:2], [task()['tags'][0]]*3,
                     task()['tags']+[{'key':'extra','value':'x'}], [{'key':'x','value':'y','extra':'z'}]*3):
            r={'tasks':[task()],'failures':[]};r['tasks'][0]['tags']=tags
            with self.subTest(tags=tags), self.assertRaises(ValueError):
                m.owned_task(r,ARN,T0,T0+1000)

    def test_ambiguous_task_readback_denies_stop(self):
        self.refuse_task(lambda r: r['tasks'].append(task()))

    def test_missing_task_denies_stop(self):
        self.refuse_task(lambda r: r.update(tasks=[]))

    def test_service_failures_denies_stop(self):
        self.refuse_task(lambda r: r.update(failures=[{'arn':ARN,'reason':'MISSING'}]))

    def test_unexpected_response_field_denies_stop(self):
        self.refuse_task(lambda r: r.update(nextToken='unknown-page'))

    def test_wrong_definition_denies_stop_composed(self):
        self.refuse_task(lambda r: r['tasks'][0].update(taskDefinitionArn=m.DEFINITION[:-1]+'2'))

    def test_wrong_caller_denies_before_task_or_stop(self):
        self.caller['Arn']='arn:aws:iam::967807252336:user/other'
        with self.assertRaises(ValueError):m.execute(ARN)
        self.assertEqual([x[0] for x in self.trace],['caller']);self.no_stop()

    def test_reservation_mismatch_denies_before_calls(self):
        self.reservation['runUuid']='foreign'
        self.fs['files'][('runtime','execution-reserved.json')]=m.encode(self.reservation)
        with self.assertRaises(ValueError):m.execute(ARN)
        self.assertEqual(self.trace,[])

    def test_missing_runtime_evidence_denies_before_calls(self):
        self.fs['dirs'].clear()
        with self.assertRaises(ValueError):m.execute(ARN)
        self.assertEqual(self.trace,[])

    def test_creation_window_timezone_and_type_refusals(self):
        for created in ('2026-10-10T14:59:58Z','2026-10-10T15:15:01Z','2026-10-10T15:00:00',False,1,None,'invalid'):
            r={'tasks':[task()],'failures':[]};r['tasks'][0]['createdAt']=created
            with self.subTest(created=created),self.assertRaises(ValueError):m.owned_task(r,ARN,T0,T0+1000)
        for t0,now in ((True,T0),(T0,False),(T0+1,T0)):
            with self.subTest(t0=t0,now=now),self.assertRaises(ValueError):m.owned_task({'tasks':[task()],'failures':[]},ARN,t0,now)

    def test_creation_exact_boundaries_and_offset_are_admitted(self):
        for created, now in (('2026-10-10T14:59:59Z',T0),('2026-10-10T15:00:01+00:00',T0),('2026-10-10T11:00:00-04:00',T0),('2026-10-10T15:15:00Z',T0+900000)):
            r={'tasks':[task()],'failures':[]};r['tasks'][0]['createdAt']=created
            with self.subTest(created=created):self.assertEqual(m.owned_task(r,ARN,T0,now)['taskArn'],ARN)

    def test_unknown_state_denies_stop(self):
        self.refuse_task(lambda r:r['tasks'][0].update(lastStatus='UNKNOWN'))

    def test_unknown_stop_consumes_attempt_and_never_retries(self):
        self.fail='stop-task'
        with self.assertRaises(subprocess.TimeoutExpired):m.execute(ARN)
        with self.assertRaises(FileExistsError):m.execute(ARN)
        self.assertEqual(sum(label=='stop-task' for label,_ in self.trace),1)

    def test_unknown_read_consumes_attempt_without_stop(self):
        self.fail='task-before'
        with self.assertRaises(subprocess.TimeoutExpired):m.execute(ARN)
        with self.assertRaises(FileExistsError):m.execute(ARN)
        self.no_stop()

    def test_successful_stop_also_consumes_attempt(self):
        m.execute(ARN)
        with self.assertRaises(FileExistsError):m.execute(ARN)
        self.assertEqual(sum(label=='stop-task' for label,_ in self.trace),1)

    def test_duplicate_json_keys_and_predecode_byte_cap_refuse(self):
        for raw in (b'{"runUuid":"x","runUuid":"y"}',b' '*(1024*1024+1)):
            with self.assertRaises(ValueError):m.parse(raw)


if __name__=='__main__':
    unittest.main(verbosity=2)
