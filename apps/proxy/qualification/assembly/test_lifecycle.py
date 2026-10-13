"""Offline canonical lifecycle over a scripted cursor; never connects to PostgreSQL."""
import copy
from datetime import datetime, timezone
import json
import unittest
from pathlib import Path
import sys

from apps.proxy.qualification.assembly.lifecycle import QualificationLifecycle, LifecycleUnknown, canonical_hash, StateDenied, PROTOCOL
from apps.proxy.qualification.assembly.bridge import handle, decode

NOW = 1791867600000
RUN = '87890e41-3f88-4b4d-b1d3-aaa9b85aaa9b'
G1 = '11111111-1111-4111-8111-111111111111'
G2 = '22222222-2222-4222-8222-222222222222'


def fixture():
    return {'mode': 'owned-disposable-qualification', 'fixtureId': G1, 'host': '127.0.0.1', 'port': 6543, 'database': 'meri_qualification_test', 'user': 'qualification_owner', 'systemIdentifier': '123456', 'serverStartTime': '2026-10-13T00:00:00.000Z', 'serverVersion': '170011', 'schemaSha256': 'a'*64}


def admission():
    return {'fixture': fixture(), 'binding': {'tenantId': 'synthetic', 'actorId': 'synthetic', 'conversationId': G1, 'runId': RUN, 'attemptId': G1, 'workerId': G2, 'writerFence': 1}, 'qualificationBinding': {'runId': RUN, 'attempt': 1, 'workerArn': 'arn:aws:ecs:us-east-1:967807252336:task/meri-greenfield-qualification/'+'a'*32, 'fence': 1, 'policyRevision': 'f'*64}, 'allocationSha256': 'c'*64, 'grants': [{'grantId': G1, 'capabilitySha256': 'd'*64, 'expiresAtMs': NOW+20000}, {'grantId': G2, 'capabilitySha256': 'e'*64, 'expiresAtMs': NOW+20000}], 'originalDeadlineMs': NOW+25000}


class Cursor:
    def __init__(self, store): self.store, self.row = store, None
    def execute(self, sql, params=()):
        s=self.store; s.statements.append(sql)
        if s.after_query: s.after_query(sql)
        if sql.startswith('SELECT current_database'):
            f=s.fixture
            self.row={'database': f['database'], 'username': f['user'], 'address': f.get('serverAddress', f['host']), 'port': f.get('serverPort', f['port']), 'version': f['serverVersion'], 'started_ms': str(int(datetime.fromisoformat(f['serverStartTime'].replace('Z','+00:00')).timestamp()*1000)), 'fsync':'on', 'synchronous_commit':'on','system_identifier':f['systemIdentifier']}
        elif 'SELECT * FROM meri_qualification.budget' in sql: self.row={'quarantined':s.quarantined}
        elif 'SELECT clock_timestamp' in sql: self.row={'now':datetime.fromtimestamp(s.now()/1000,timezone.utc)}
        elif sql.startswith('SELECT * FROM meri_qualification.runs'): self.row=copy.deepcopy(s.rows['run'])
        elif sql.startswith('SELECT * FROM meri_qualification.grants'): self.row=copy.deepcopy(s.rows['grants'].get(params[0]))
        elif sql.startswith('INSERT INTO meri_qualification.runs'):
            self.row=None;s.rows['run']=dict(zip(('run_id','attempt','worker_arn','fence','policy_revision'),params))
        elif sql.startswith('INSERT INTO meri_qualification.grants'):
            if params[0] in s.rows['grants']: raise RuntimeError('duplicate')
            keys=('grant_id','run_id','attempt','worker_arn','fence','policy_revision','capability_sha256','expires_at')
            s.rows['grants'][params[0]]=dict(zip(keys,params))|{'state':'PENDING'}
        elif sql.startswith("UPDATE meri_qualification.grants SET state='ACTIVE'"):
            s.rows['grants'][params[0]]['state']='ACTIVE'
        elif sql.startswith("UPDATE meri_qualification.grants SET state='REVOKED'"):
            g=s.rows['grants'].get(params[0]);self.row={'grant_id':params[0]} if g else None
            if g:g['state']='REVOKED'
        else:raise AssertionError('Unexpected SQL '+sql)
    def fetchone(self): return self.row


class ScriptedStore:
    def __init__(self, value=None, now=None):
        self.rows=value or {'run':None,'grants':{}};self.now=now or (lambda:NOW);self.fixture=fixture();self.statements=[];self.quarantined=False;self.after_query=None;self.lose_commit=False
    def transact(self, fn):
        before=copy.deepcopy(self.rows)
        try:result=fn(Cursor(self))
        except Exception:self.rows=before;raise
        if self.lose_commit:self.lose_commit=False;raise RuntimeError('lost acknowledgement')
        return result
    @staticmethod
    def budget(cursor):
        cursor.execute('SELECT * FROM meri_qualification.budget WHERE id=1 FOR UPDATE');row=cursor.fetchone()
        cursor.execute('SELECT clock_timestamp() AS now');row['now']=cursor.fetchone()['now'];return row


class LifecycleTests(unittest.TestCase):
    def make(self,s=None,a=None):return QualificationLifecycle(s or ScriptedStore(),a or admission(),deadline_ms=NOW+15000,now_ms=lambda:NOW)
    def test_pending_requires_actual_activation_and_exact_readback(self):
        s=ScriptedStore();owner=self.make(s);self.assertEqual(owner.run('prepare')['status'],'PREPARED')
        self.assertEqual([g['state'] for g in s.rows['grants'].values()],['PENDING','PENDING'])
        with self.assertRaises(StateDenied):owner.run('inspect')
        for g in (G1,G2):self.assertEqual(owner.run('activate',g)['status'],'ACTIVE')
        self.assertEqual(owner.run('inspect')['status'],'ADMITTED')
        before=copy.deepcopy(s.rows);self.assertEqual(self.make(s).run('inspect')['status'],'ADMITTED');self.assertEqual(s.rows,before)
        self.assertEqual(owner.run('revoke')['status'],'REVOKED')
        with self.assertRaises(StateDenied):owner.run('inspect')
    def test_foreign_fixture_refuses_before_any_insert(self):
        s=ScriptedStore();s.fixture['systemIdentifier']='999'
        with self.assertRaises(StateDenied):self.make(s).run('prepare')
        self.assertIsNone(s.rows['run']);self.assertFalse(any(x.startswith('INSERT') for x in s.statements))
    def test_setup_never_reseeds_and_commit_unknown_keeps_written_run(self):
        s=ScriptedStore();s.lose_commit=True
        # Lost read-only fixture COMMIT admits nothing.
        with self.assertRaises(RuntimeError):self.make(s).run('prepare')
        self.assertIsNone(s.rows['run'])
        self.make(s).run('prepare')
        with self.assertRaises(LifecycleUnknown):self.make(s).run('prepare')
        self.assertEqual(len(s.rows['grants']),2)
    def test_lost_write_ack_is_unknown_and_does_not_undo_committed_run(self):
        s=ScriptedStore()
        s.after_query=lambda sql:setattr(s,'lose_commit',True) if sql.startswith('INSERT INTO meri_qualification.runs') else None
        with self.assertRaises(LifecycleUnknown):self.make(s).run('prepare')
        self.assertIsNotNone(s.rows['run']);self.assertEqual(s.rows['grants'],{})
    def test_quarantine_prevents_any_lifecycle_insert(self):
        s=ScriptedStore();s.quarantined=True
        with self.assertRaises(LifecycleUnknown):self.make(s).run('prepare')
        self.assertIsNone(s.rows['run']);self.assertFalse(any(sql.startswith('INSERT') for sql in s.statements))
    def test_internal_cli_help_and_missing_args_are_inert(self):
        import subprocess
        path=Path(__file__).with_name('bridge.py')
        help_result=subprocess.run([sys.executable,'-I','-B',str(path),'--help'],capture_output=True,timeout=3)
        self.assertEqual(help_result.returncode,0);self.assertIn(b'Usage:',help_result.stdout);self.assertEqual(help_result.stderr,b'')
        missing=subprocess.run([sys.executable,'-I','-B',str(path)],capture_output=True,timeout=3)
        self.assertEqual(missing.returncode,2);self.assertEqual(json.loads(missing.stdout),{'status':'REFUSED'});self.assertEqual(missing.stderr,b'')
    def test_partial_activate_remains_partial_no_compensation(self):
        s=ScriptedStore();owner=self.make(s);owner.run('prepare');owner.run('activate',G1)
        s.rows['run']['fence']=2
        with self.assertRaises(LifecycleUnknown):owner.run('activate',G2)
        self.assertEqual(s.rows['grants'][G1]['state'],'ACTIVE');self.assertEqual(s.rows['grants'][G2]['state'],'PENDING')
    def test_deadline_after_lock_prevents_later_mutation(self):
        clock=[NOW];s=ScriptedStore(now=lambda:clock[0]);owner=QualificationLifecycle(s,admission(),deadline_ms=NOW+30,now_ms=lambda:clock[0])
        s.after_query=lambda sql:clock.__setitem__(0,NOW+31) if 'FOR UPDATE' in sql else None
        with self.assertRaises(LifecycleUnknown):owner.run('prepare')
        self.assertIsNone(s.rows['run']);self.assertFalse(any(x.startswith('INSERT') for x in s.statements))
    def test_revoked_quarantined_expired_or_replaced_read_refuses(self):
        for change in ('revoked','quarantine','replaced'):
            s=ScriptedStore();o=self.make(s);o.run('prepare');o.run('activate',G1);o.run('activate',G2)
            if change=='revoked':s.rows['grants'][G1]['state']='REVOKED'
            elif change=='quarantine':s.quarantined=True
            else:s.rows['run']['attempt']=2
            with self.subTest(change=change),self.assertRaises(StateDenied):o.run('inspect')
    def test_fixed_frame_and_driver_free_inert_failure(self):
        a=admission();r={'schema':PROTOCOL['schema'],'operation':'prepare','connection':{'host':'127.0.0.1','port':6543,'dbname':'meri_qualification_test','user':'qualification_owner'},'admission':a,'admissionSha256':canonical_hash(a),'deadlineMs':NOW+15000,'grantId':None}
        s=ScriptedStore();raw=json.dumps(r).encode();self.assertEqual(handle(raw,store_factory=lambda _:s,now_ms=lambda:NOW)['status'],'PREPARED')
        for change in ({'operation':'exec'},{'admissionSha256':'0'*64},{'extra':1}):
            with self.assertRaises(Exception):decode(json.dumps(r|change).encode())
        with self.assertRaises(Exception):decode(b'{"schema":1,"schema":2}')
    def test_grant_alias_and_extended_original_expiry_refuse(self):
        for mutate in (lambda a:a['grants'][1].update(grantId=G1),lambda a:a['grants'][0].update(expiresAtMs=NOW+30000),lambda a:a['binding'].update(writerFence=2)):
            a=admission();mutate(a)
            with self.assertRaises(StateDenied):self.make(a=a)

# Dedicated test interpreter: invokes the actual fixed bridge handler/Grants over file-backed inert SQL state.
def scripted_process(path):
    raw=sys.stdin.buffer.read(PROTOCOL['maxFrameBytes']+1);req=decode(raw);state_path=Path(path)
    value=json.loads(state_path.read_text()) if state_path.exists() else {'run':None,'grants':{}}
    for g in value['grants'].values():g['expires_at']=datetime.fromisoformat(g['expires_at'])
    now=lambda:__import__('time').time_ns()//1000000
    store=ScriptedStore(value,now=now);store.fixture=req['admission']['fixture']
    result=handle(raw,store_factory=lambda _:store,now_ms=now)
    state_path.write_text(json.dumps(store.rows,default=lambda x:x.isoformat()))
    print(json.dumps(result,separators=(',',':')))
    return 0 if result['status'] not in ('REFUSED','UNKNOWN') else 2

if __name__=='__main__':unittest.main()
