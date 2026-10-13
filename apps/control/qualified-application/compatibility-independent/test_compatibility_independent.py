"""Independent source controls; fixed read-only fake cursor, no SQL engine/driver."""
import copy
import json
import unittest
from apps.proxy.qualification.assembly.lifecycle import (
    QualificationLifecycle, fixture_admission, canonical_hash, StateDenied, PROTOCOL)
from apps.proxy.qualification.assembly.bridge import decode

NOW = 1791849600000
UUIDS = [f'{n:08x}-1111-4111-8111-111111111111' for n in range(1, 7)]

def make_admission():
    return {
        'fixture': {'mode': 'owned-disposable-qualification', 'fixtureId': UUIDS[0],
            'host': '127.0.0.1', 'port': 55432, 'database': 'meri_qualification_test',
            'user': 'qualification_owner', 'systemIdentifier': '7400000000000000001',
            'serverStartTime': '2026-10-13T00:00:00.000Z', 'serverVersion': '160006',
            'schemaSha256': 'a'*64, 'serverAddress': '172.17.0.2', 'serverPort': 5432,
            'schemaScope': {'mode': 'preserve-declared-evidence', 'namespaces': [
                {'name': f'evidence_{i:02}', 'owner': 'qualification_owner'} for i in range(25)]}},
        'binding': {'tenantId': 'synthetic-review', 'actorId': 'synthetic-review',
            'conversationId': UUIDS[0], 'runId': UUIDS[1], 'attemptId': UUIDS[2],
            'workerId': UUIDS[3], 'writerFence': 1},
        'qualificationBinding': {'runId': UUIDS[1], 'attempt': 1,
            'workerArn': 'arn:aws:ecs:us-east-1:111111111111:task/review/'+'a'*32,
            'fence': 1, 'policyRevision': 'b'*64},
        'allocationSha256': 'c'*64,
        'grants': [{'grantId': UUIDS[i+4], 'capabilitySha256': str(i+4)*64,
                    'expiresAtMs': NOW+20000} for i in range(2)],
        'originalDeadlineMs': NOW+25000}

def frame(a=None):
    a = a or make_admission()
    return {'schema': PROTOCOL['schema'], 'operation': 'inspect',
            'connection': {'host': a['fixture']['host'], 'port': a['fixture']['port'],
                           'dbname': a['fixture']['database'], 'user': a['fixture']['user']},
            'admission': a, 'admissionSha256': canonical_hash(a),
            'deadlineMs': NOW+15000, 'grantId': None}

def encode(value): return json.dumps(value).encode()

class ReadOnlyPort:
    def __init__(self, f, change=None, after=None):
        self.queries, self.fetches, self.after = [], 0, after
        self.row = {'database': f['database'], 'username': f['user'],
            'address': f.get('serverAddress', f['host']), 'port': f.get('serverPort', f['port']),
            'version': f['serverVersion'], 'started_ms': str(NOW), 'fsync': 'on',
            'synchronous_commit': 'on', 'system_identifier': f['systemIdentifier']}
        if change: self.row.update(change)
    def transact(self, fn): return fn(self)
    def execute(self, sql):
        assert sql.startswith('SELECT current_database()')
        self.queries.append(sql)
        if self.after: self.after()
    def fetchone(self): self.fetches += 1; return copy.deepcopy(self.row)

class CompatibilityIndependent(unittest.TestCase):
    def test_mapped_server_and25_scope_preserved_in_actual_decode(self):
        f = frame(); before = copy.deepcopy(f)
        self.assertEqual(decode(encode(f)), f)
        self.assertEqual(f, before)
        self.assertEqual(len(f['admission']['fixture']['schemaScope']['namespaces']), 25)
    def test_actual_fixture_verifier_uses_server_not_dial(self):
        a = make_admission(); s = ReadOnlyPort(a['fixture'])
        QualificationLifecycle(s, a, deadline_ms=NOW+10000, now_ms=lambda: NOW).verify_fixture()
        self.assertEqual(len(s.queries), 1); self.assertEqual(s.fetches, 1)
    def test_legacy_server_fallback_remains(self):
        a = make_admission()
        for k in ('serverAddress', 'serverPort', 'schemaScope'): del a['fixture'][k]
        s = ReadOnlyPort(a['fixture'])
        QualificationLifecycle(s, a, deadline_ms=NOW+10000, now_ms=lambda: NOW).verify_fixture()
        self.assertEqual(decode(encode(frame(a)))['admission'], a)
    def test_query_returning_after_deadline_prevents_fetch(self):
        a = make_admission(); clock = [NOW]
        s = ReadOnlyPort(a['fixture'], after=lambda: clock.__setitem__(0, NOW+10000))
        owner = QualificationLifecycle(s, a, deadline_ms=NOW+10000, now_ms=lambda: clock[0])
        with self.assertRaises(StateDenied): owner.verify_fixture()
        self.assertEqual(s.fetches, 0); self.assertEqual(len(s.queries), 1)
    def test_full_compatibility_facts_in_original_admission_hash(self):
        for edit in (lambda f: f.update(serverAddress='192.0.2.1'),
                     lambda f: f.update(serverPort=5433),
                     lambda f: f['schemaScope']['namespaces'][0].update(owner='other_owner')):
            value = frame(); edit(value['admission']['fixture'])
            with self.assertRaisesRegex(ValueError, 'ADMISSION_HASH'): decode(encode(value))


def invalid_fixture(label, edit):
    def check(self):
        f = make_admission()['fixture']; edit(f)
        with self.assertRaises(StateDenied): fixture_admission(f)
    setattr(CompatibilityIndependent, 'test_closed_fixture_'+label, check)
for label, edit in {
    'unpaired_address': lambda f: f.pop('serverPort'),
    'unpaired_port': lambda f: f.pop('serverAddress'),
    'hostname': lambda f: f.update(serverAddress='postgres.local'),
    'ipv6_zone': lambda f: f.update(serverAddress='fe80::1%eth0'),
    'bool_port': lambda f: f.update(serverPort=True),
    'zero_port': lambda f: f.update(serverPort=0),
    'scope_null': lambda f: f.update(schemaScope=None),
    'scope_empty': lambda f: f['schemaScope'].update(namespaces=[]),
    'scope_overlimit': lambda f: f['schemaScope'].update(namespaces=[{'name': 'n_'+str(i), 'owner':'qualification_owner'} for i in range(129)]),
    'scope_duplicate': lambda f: f['schemaScope']['namespaces'].append(f['schemaScope']['namespaces'][0]),
    'public': lambda f: f['schemaScope']['namespaces'][0].update(name='public'),
    'target': lambda f: f['schemaScope']['namespaces'][0].update(name='meri_qualification'),
    'system': lambda f: f['schemaScope']['namespaces'][0].update(name='pg_temp'),
    'leaf_extra': lambda f: f['schemaScope']['namespaces'][0].update(grant=True),
    'fixture_extra': lambda f: f.update(grant=True),
}.items(): invalid_fixture(label, edit)

for field, value in {'address':'127.0.0.1','port':55432,'database':'other',
                    'username':'other','version':'170000','started_ms':'0',
                    'system_identifier':'999','fsync':'off','synchronous_commit':'off'}.items():
    def check(self, field=field, value=value):
        a=make_admission(); s=ReadOnlyPort(a['fixture'], {field:value})
        with self.assertRaises(StateDenied):
            QualificationLifecycle(s,a,deadline_ms=NOW+10000,now_ms=lambda:NOW).verify_fixture()
        self.assertEqual(len(s.queries),1)
    setattr(CompatibilityIndependent,'test_observed_identity_'+field,check)

for field, value in {'host':'172.17.0.2','port':5432,'dbname':'other','user':'other'}.items():
    def check(self, field=field, value=value):
        f=frame(); f['connection'][field]=value
        with self.assertRaisesRegex(ValueError,'CONNECTION_FIXTURE_MISMATCH'): decode(encode(f))
    setattr(CompatibilityIndependent,'test_dial_'+field,check)

if __name__ == '__main__': unittest.main()
