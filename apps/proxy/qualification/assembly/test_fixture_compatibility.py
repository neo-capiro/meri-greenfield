"""Source-only endpoint/scope compatibility controls; no database or driver."""
import copy
import json
import unittest
from .test_lifecycle import admission, ScriptedStore, NOW, PROTOCOL
from .lifecycle import QualificationLifecycle, StateDenied, canonical_hash, fixture_admission
from .bridge import decode

MAPPED = {'serverAddress': '172.17.0.2', 'serverPort': 5432}
SCOPE = {'mode': 'preserve-declared-evidence', 'namespaces': [{'name': f'evidence_{i:02}', 'owner': 'qualification_owner'} for i in range(25)]}

class FixtureCompatibility(unittest.TestCase):
    def fixture(self):
        a=admission();a['fixture'].update(port=55432, **MAPPED, schemaScope=copy.deepcopy(SCOPE));return a
    def make(self, a, s):
        return QualificationLifecycle(s,a,deadline_ms=NOW+15000,now_ms=lambda:NOW)
    def test_mapped_server25_scope_same_admission(self):
        a=self.fixture();s=ScriptedStore();s.fixture=copy.deepcopy(a['fixture']);self.assertEqual(self.make(a,s).run('prepare')['status'],'PREPARED');self.assertEqual(len(s.rows['grants']),2)
    def test_mapped_engine_mismatch_never_writes(self):
        for key,value in [('serverAddress','172.17.0.3'),('serverPort',5433),('database','other'),('systemIdentifier','999')]:
            a=self.fixture();s=ScriptedStore();s.fixture=copy.deepcopy(a['fixture']);s.fixture[key]=value
            with self.subTest(key=key),self.assertRaises(StateDenied):self.make(a,s).run('prepare')
            self.assertIsNone(s.rows['run']);self.assertFalse(any(x.startswith('INSERT') for x in s.statements))
    def test_dial_uses_loopback_not_server_tuple(self):
        a=self.fixture();frame={'schema':PROTOCOL['schema'],'operation':'prepare','connection':{'host':'127.0.0.1','port':55432,'dbname':'meri_qualification_test','user':'qualification_owner'},'admission':a,'admissionSha256':canonical_hash(a),'deadlineMs':NOW+15000,'grantId':None}
        self.assertEqual(decode(json.dumps(frame).encode())['admission'],a)
        for change in ({'host':'172.17.0.2'},{'port':5432}):
            bad=copy.deepcopy(frame);bad['connection'].update(change)
            with self.assertRaises(Exception):decode(json.dumps(bad).encode())
    def test_optional_fields_fully_bind_hash(self):
        a=self.fixture();base=canonical_hash(a)
        for change in ({'serverPort':5433},{'serverAddress':'172.17.0.3'},{'schemaScope':{'mode':SCOPE['mode'],'namespaces':SCOPE['namespaces'][:-1]}}):
            b=copy.deepcopy(a);b['fixture'].update(change);self.assertNotEqual(canonical_hash(b),base)
    def test_invalid_server_and_scope_shapes(self):
        for change in ({'serverAddress':'db.local'}, {'serverAddress':'::1%lo'}, {'serverPort':0}, {'serverPort':True}, {'extra':1}, {'schemaScope':{'mode':'ignore','namespaces':[]}}, {'schemaScope':{'mode':SCOPE['mode'],'namespaces':[{'name':'public','owner':'qualification_owner'}]}}, {'schemaScope':{'mode':SCOPE['mode'],'namespaces':[SCOPE['namespaces'][0]]*2}}):
            a=self.fixture();a['fixture'].update(change)
            with self.subTest(change=change),self.assertRaises(Exception):fixture_admission(a['fixture'])
        for key in MAPPED:
            a=self.fixture();del a['fixture'][key]
            with self.assertRaises(StateDenied):fixture_admission(a['fixture'])
    def test_legacy_descriptor_keeps_strict_engine_identity(self):
        a=admission();s=ScriptedStore();self.assertEqual(self.make(a,s).run('prepare')['status'],'PREPARED')
        s=ScriptedStore();s.fixture['host']='172.17.0.2'
        with self.assertRaises(StateDenied):self.make(a,s).run('prepare')

if __name__=='__main__':unittest.main()
