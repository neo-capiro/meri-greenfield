"""Real PostgreSQL qualification tests. Explicit synthetic test engine opt-in only."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
import hashlib
import json
import os
import socket
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import uuid

from apps.proxy.qualification.state.pricing import CAP_MICRO_USD,PRICING_REVISION,Pricing,StateDenied,liability
from apps.proxy.qualification.state.postgres_store import CommitUncertain,PostgresStore
from apps.proxy.qualification.state.grants import Grants,RunBinding
from apps.proxy.qualification.state.ledger import PostgresLedger,Settlement
from apps.proxy.qualification.runtime.bedrock_body import BodyLimits,NativeBody,COUNT_MODEL_ID,INVOKE_URLS,inspect_native_request
from apps.proxy.qualification.runtime.bedrock_transport import CountObservation,HoldReceipt,BedrockSendGuard,guarded_client
import httpx

ROOT=Path(__file__).resolve().parents[4]
OLD_SITE=ROOT/'.task-inputs/CODEX-G1-proxy-transport-spike-1/venv/Lib/site-packages'
NOW=lambda:datetime.now(timezone.utc)
RAW=json.dumps({'anthropic_version':'bedrock-2023-05-31','max_tokens':16,'messages':[{'role':'user','content':'synthetic'}]},separators=(',',':')).encode()
BODY=inspect_native_request('POST',sorted(INVOKE_URLS)[0],RAW,BodyLimits())
COUNT=CountObservation(123,BODY.sha256,COUNT_MODEL_ID,'fixture')
RAW_SHA=hashlib.sha256(b'synthetic-original-request').hexdigest()


class PricingTests(unittest.TestCase):
    def test_exact_integer_ceiling_and_full_envelope(self):
        self.assertEqual(liability(8192,256,reserve=True),58292)
        self.assertEqual(liability(123,16,reserve=True),1076)
        self.assertEqual(liability(123,7),522)
        self.assertEqual(CAP_MICRO_USD,10000000)

    def test_invalid_counts_and_revision(self):
        for counts in ((True,1),(65537,1),(1,8193),(0,1),(-1,1),(1.0,1)):
            with self.subTest(counts=counts),self.assertRaises(StateDenied):liability(*counts,reserve=True)
        with self.assertRaises(StateDenied):Pricing(NOW()+timedelta(hours=1),'a'*64)
        with self.assertRaises(StateDenied):Pricing(datetime.now())

    def test_database_configuration_and_connection_errors_are_closed(self):
        base={'host':'127.0.0.1','port':5432,'dbname':'meri_qualification_test','user':'synthetic'}
        for change in ({'dbname':'current_app'},{'port':True},{'host':'127.0.0.1,other'},{'host':'db.internal'},{'password':{}}):
            with self.subTest(change=change),self.assertRaises(StateDenied):PostgresStore(base|change)
        PostgresStore(base|{'host':'db.internal','sslmode':'verify-full','sslrootcert':'reviewed-ca.pem'})
        with socket.socket() as lease:
            lease.bind(('127.0.0.1',0));port=lease.getsockname()[1]
            # Bound but not listening; no arbitrary external endpoint is contacted.
            store=PostgresStore(base|{'port':port})
            with self.assertRaisesRegex(StateDenied,'^DATABASE_CONNECTION_FAILED$'):store.connect()


@unittest.skipUnless(os.environ.get('MERI_TEST_ENGINE'),'real temporary PostgreSQL engine explicitly required')
class PostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        engine=json.loads(Path(os.environ['MERI_TEST_ENGINE']).read_bytes())
        if (engine['host']!='127.0.0.1' or engine['database']!='meri_qualification_test'
            or engine['user']!='qualification_owner' or type(engine['port']) is not int):
            raise RuntimeError('unexpected test database')
        cls.params={k:engine[k] for k in ('host','port','user')};cls.params['dbname']=engine['database']
        cls.store=PostgresStore(cls.params);cls.store.migrate_new_database();cls.store.migrate_tool_budget()
        with cls.store.connect() as connection:
            row=connection.execute('SHOW fsync').fetchone()
            if row['fsync']!='on':raise RuntimeError('fsync disabled')
            if connection.execute('SHOW synchronous_commit').fetchone()['synchronous_commit']!='on':raise RuntimeError('synchronous commit disabled')

    def setUp(self):
        # Explicit synthetic fixture reset between independent cases, never a
        # runtime API or demonstration that production budget may be reset.
        with self.store.connect() as c:
            c.execute('TRUNCATE meri_qualification.tool_reservations,meri_qualification.tool_grant_bindings,meri_qualification.tool_run_allocations,meri_qualification.requests,meri_qualification.grants,meri_qualification.runs')
            c.execute('UPDATE meri_qualification.budget SET consumed_micro_usd=0,quarantined=false WHERE id=1')
        self.grants=Grants(self.store)

    def grant(self,*,activate=True,expires=None,binding=None):
        binding=binding or RunBinding(str(uuid.uuid4()),1,'arn:aws:ecs:us-east-1:967807252336:task/MeriGreenfield-Qualification/'+uuid.uuid4().hex,1,'1'*64)
        self.grants.set_current_run(binding)
        grant_id=str(uuid.uuid4());cap=hashlib.sha256(uuid.uuid4().bytes+uuid.uuid4().bytes).hexdigest()
        self.grants.create_pending(grant_id,binding,cap,expires or NOW()+timedelta(minutes=5))
        if activate:self.grants.activate(grant_id,binding)
        return PostgresLedger(self.store,grant_id=grant_id,binding=binding,capability_sha256=cap,raw_request_sha256=RAW_SHA,pricing=Pricing(NOW()+timedelta(minutes=10)),expected_count_origin='fixture')

    def row(self,request_id):
        with self.store.connect() as c:return c.execute('SELECT * FROM meri_qualification.requests WHERE request_id=%s',(request_id,)).fetchone()

    def evidence(self,**extra):
        values=dict(native_body_sha256=BODY.sha256,raw_request_sha256=RAW_SHA,pricing_revision=PRICING_REVISION,evidence_sha256='e'*64,input_tokens=123,output_tokens=7)
        return Settlement(**(values|extra))

    def test_pending_activation_and_exact_receipt(self):
        ledger=self.grant(activate=False)
        with self.assertRaises(StateDenied):ledger.reserve_sync('pending',BODY,COUNT)
        self.assertIsNone(self.row('pending'))
        self.grants.activate(ledger.grant_id,ledger.binding)
        receipt=ledger.reserve_sync('active',BODY,COUNT)
        self.assertIs(type(receipt),HoldReceipt)
        self.assertEqual((receipt.request_id,receipt.native_body_sha256,receipt.state),('active',BODY.sha256,'UNKNOWN'))
        self.assertEqual(self.row('active')['hold_micro_usd'],1076)

    def test_duplicate_slot_and_one_active_per_grant(self):
        ledger=self.grant();ledger.reserve_sync('slot',BODY,COUNT)
        for name in ('slot','another'):
            with self.assertRaises(StateDenied):ledger.reserve_sync(name,BODY,COUNT)
        other=self.grant()
        with self.assertRaises(StateDenied):other.reserve_sync('slot',BODY,COUNT)
        self.assertEqual(ledger.snapshot()['unresolved'],1)

    def test_expiry_revocation_and_reconnect_never_release_unknown(self):
        ledger=self.grant();ledger.reserve_sync('unknown',BODY,COUNT)
        self.grants.revoke(ledger.grant_id)
        with self.store.connect() as c:c.execute("UPDATE meri_qualification.grants SET expires_at=clock_timestamp()-interval '1 hour'")
        reconnected=PostgresStore(self.params)
        ledger.store=reconnected
        self.assertEqual(ledger.snapshot()['held'],1076)
        with self.assertRaises(StateDenied):ledger.reserve_sync('expired',BODY,COUNT)
        self.assertEqual(self.row('unknown')['state'],'UNKNOWN')

    def test_revoked_replaced_grant_only_reconciles_original_usage(self):
        ledger=self.grant();ledger.reserve_sync('historical',BODY,COUNT)
        self.grants.revoke(ledger.grant_id);b=ledger.binding
        self.grants.set_current_run(RunBinding(b.run_id,2,b.worker_arn,2,'2'*64))
        with self.assertRaises(StateDenied):ledger.reserve_sync('stale-after-revoke',BODY,COUNT)
        self.assertEqual(ledger.settle_complete('historical',self.evidence())['actual_micro_usd'],522)
        self.assertEqual(ledger.snapshot()['held'],0)
        self.assertEqual(ledger.snapshot()['consumed_micro_usd'],522)

    def test_forged_native_body_cannot_bypass_semantic_envelope(self):
        ledger=self.grant()
        with self.assertRaises(StateDenied):ledger.reserve_sync('forged-output',NativeBody(RAW,BODY.sha256,256),COUNT)
        raw=json.dumps(json.loads(RAW)|{'thinking':{'type':'enabled','budget_tokens':100}}).encode()
        forged=NativeBody(raw,hashlib.sha256(raw).hexdigest(),16)
        with self.assertRaises(ValueError):ledger.reserve_sync('forged-thinking',forged,CountObservation(123,forged.sha256,COUNT_MODEL_ID,'fixture'))
        self.assertEqual(ledger.snapshot()['unresolved'],0)

    def test_stale_attempt_worker_policy_and_fence_denied_with_old_hold_counted(self):
        ledger=self.grant();ledger.reserve_sync('old',BODY,COUNT)
        old=ledger.binding
        newer=RunBinding(old.run_id,2,'arn:aws:ecs:us-east-1:967807252336:task/MeriGreenfield-Qualification/'+uuid.uuid4().hex,2,'2'*64)
        self.grants.set_current_run(newer)
        with self.assertRaises(StateDenied):ledger.reserve_sync('stale',BODY,COUNT)
        with self.assertRaises(StateDenied):self.grants.activate(ledger.grant_id,old)
        with self.assertRaises(StateDenied):self.grants.set_current_run(old)
        self.assertEqual(ledger.snapshot()['held'],1076)

    def test_capability_count_model_body_and_pricing_mismatch(self):
        ledger=self.grant();ledger.capability_sha256='f'*64
        with self.assertRaises(StateDenied):ledger.reserve_sync('forged',BODY,COUNT)
        ledger=self.grant()
        for count in (CountObservation(123,'f'*64,COUNT_MODEL_ID,'fixture'),CountObservation(123,BODY.sha256,'other','fixture'),CountObservation(123,BODY.sha256,COUNT_MODEL_ID,'aws-counttokens'),CountObservation(8193,BODY.sha256,COUNT_MODEL_ID,'fixture')):
            with self.assertRaises(StateDenied):ledger.reserve_sync('bad-count',BODY,count)
        ledger.pricing=Pricing(NOW()-timedelta(seconds=1))
        with self.assertRaises(StateDenied):ledger.reserve_sync('old-price',BODY,COUNT)
        self.assertEqual(ledger.snapshot()['unresolved'],0)

    def test_lost_commit_acknowledgement_denies_but_durable_hold_remains(self):
        ledger=self.grant()
        def lost():raise ConnectionError('synthetic lost commit acknowledgement')
        ledger.store=PostgresStore(self.params,after_commit=lost)
        with self.assertRaises(CommitUncertain):ledger.reserve_sync('lost-ack',BODY,COUNT)
        self.assertEqual(self.row('lost-ack')['state'],'UNKNOWN')
        ledger.store=PostgresStore(self.params)
        with self.assertRaises(StateDenied):ledger.reserve_sync('lost-ack',BODY,COUNT)
        self.assertEqual(ledger.snapshot()['held'],1076)

    def test_settle_complete_bound_usage_then_next_slot(self):
        ledger=self.grant();ledger.reserve_sync('complete',BODY,COUNT)
        self.assertEqual(ledger.settle_complete('complete',self.evidence()),{'actual_micro_usd':522,'quarantined':False})
        snap=ledger.snapshot();self.assertEqual((snap['consumed_micro_usd'],snap['held']),(522,0))
        with self.assertRaises(StateDenied):ledger.settle_complete('complete',self.evidence())
        ledger.reserve_sync('next-slot',BODY,COUNT)
        self.assertEqual(ledger.snapshot()['held'],1076)

    def test_incomplete_mismatched_settlement_preserves_liability(self):
        ledger=self.grant();ledger.reserve_sync('incomplete',BODY,COUNT)
        for evidence in (None,{},self.evidence(native_body_sha256='f'*64),self.evidence(raw_request_sha256='f'*64),self.evidence(pricing_revision='f'*64)):
            with self.assertRaises(StateDenied):ledger.settle_complete('incomplete',evidence)
        self.assertEqual(ledger.snapshot()['held'],1076)
        self.assertEqual(self.row('incomplete')['state'],'UNKNOWN')

    def test_renewed_pricing_expiry_cannot_rebind_original_settlement(self):
        ledger=self.grant();ledger.reserve_sync('old-expiry',BODY,COUNT)
        original=ledger.pricing
        ledger.pricing=Pricing(original.valid_until+timedelta(minutes=1))
        with self.assertRaises(StateDenied):ledger.settle_complete('old-expiry',self.evidence())
        self.assertEqual(ledger.snapshot()['held'],1076)
        ledger.pricing=original
        self.assertEqual(ledger.settle_complete('old-expiry',self.evidence())['actual_micro_usd'],522)

    def test_settlement_considers_other_unresolved_holds(self):
        first=self.grant();second=self.grant()
        first.reserve_sync('first',BODY,COUNT);second.reserve_sync('second',BODY,COUNT)
        # Simulate contradictory externally reconciled liability in synthetic DB.
        # The adapter must quarantine, rather than ignore the second UNKNOWN.
        with self.store.connect() as c:c.execute('UPDATE meri_qualification.budget SET consumed_micro_usd=%s WHERE id=1',(10000000-1076,))
        self.assertTrue(first.settle_complete('first',self.evidence())['quarantined'])
        self.assertEqual(second.snapshot()['held'],1076)

    def test_excess_actual_is_recorded_unclamped_and_quarantines(self):
        ledger=self.grant();ledger.reserve_sync('excess',BODY,COUNT)
        outcome=ledger.settle_complete('excess',self.evidence(output_tokens=1000000))
        self.assertTrue(outcome['quarantined']);self.assertGreater(outcome['actual_micro_usd'],10000000)
        self.assertEqual(ledger.snapshot()['consumed_micro_usd'],outcome['actual_micro_usd'])
        other=self.grant()
        with self.assertRaises(StateDenied):other.reserve_sync('quarantined',BODY,COUNT)

    def test_positive_no_dispatch_is_separate_and_bound(self):
        ledger=self.grant();ledger.reserve_sync('not-sent',BODY,COUNT)
        kw=dict(native_body_sha256=BODY.sha256,raw_request_sha256=RAW_SHA,pricing_revision=PRICING_REVISION,evidence_sha256='e'*64)
        with self.assertRaises(StateDenied):ledger.reconcile_no_dispatch('not-sent',**(kw|{'raw_request_sha256':'f'*64}))
        self.assertEqual(ledger.snapshot()['held'],1076)
        ledger.reconcile_no_dispatch('not-sent',**kw)
        self.assertEqual((ledger.snapshot()['held'],ledger.snapshot()['consumed_micro_usd']),(0,0))
        with self.assertRaises(StateDenied):ledger.reconcile_no_dispatch('not-sent',**kw)

    def test_actual_database_lock_contention_never_exceeds_cap(self):
        ledgers=[self.grant() for _ in range(8)];barrier=threading.Barrier(8)
        with self.store.connect() as c:c.execute('UPDATE meri_qualification.budget SET consumed_micro_usd=%s WHERE id=1',(10000000-1076,))
        def compete(pair):
            index,ledger=pair;barrier.wait(timeout=5)
            try:ledger.reserve_sync('race-'+str(index),BODY,COUNT);return True
            except StateDenied:return False
        with ThreadPoolExecutor(max_workers=8) as pool:outcomes=list(pool.map(compete,enumerate(ledgers)))
        self.assertEqual(sum(outcomes),1)
        snap=ledgers[0].snapshot();self.assertEqual(snap['consumed_micro_usd']+snap['held'],10000000)

    def test_expiry_is_evaluated_after_real_budget_lock_wait(self):
        ledger=self.grant(expires=NOW()+timedelta(milliseconds=350))
        blocker=self.store.connect();blocker.execute('SELECT * FROM meri_qualification.budget WHERE id=1 FOR UPDATE')
        with ThreadPoolExecutor(max_workers=1) as pool:
            future=pool.submit(ledger.reserve_sync,'lock-expired',BODY,COUNT)
            time.sleep(.5);blocker.rollback();blocker.close()
            with self.assertRaises(StateDenied):future.result(timeout=5)
        self.assertIsNone(self.row('lock-expired'))

    def child(self,ledger,request_id,*,crash=False):
        # Actual separate interpreter and DB connection, not an in-memory model.
        payload={'params':self.params,'grant_id':ledger.grant_id,'binding':ledger.binding.values(),'cap':ledger.capability_sha256,'request_id':request_id,'crash':crash}
        code="import sys,json,os;sys.path.insert(0,"+repr(str(ROOT))+");sys.path.append("+repr(str(OLD_SITE))+");from apps.proxy.qualification.test.test_postgres_state import *;p=json.loads(sys.stdin.buffer.read());b=RunBinding(*p['binding']);l=PostgresLedger(PostgresStore(p['params']),grant_id=p['grant_id'],binding=b,capability_sha256=p['cap'],raw_request_sha256=RAW_SHA,pricing=Pricing(NOW()+timedelta(minutes=5)),expected_count_origin='fixture');\ntry:\n l.reserve_sync(p['request_id'],BODY,COUNT)\nexcept StateDenied:\n sys.exit(3)\nif p['crash']:os._exit(17)\nprint('armed')\n"
        return [str(sys.executable),'-I','-B','-c',code],json.dumps(payload).encode()

    def test_process_death_after_commit_and_reconnect(self):
        ledger=self.grant();args,data=self.child(ledger,'process-death',crash=True)
        p=subprocess.run(args,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,shell=False,timeout=30)
        self.assertEqual(p.returncode,17,p.stderr.decode(errors='replace'))
        self.assertEqual(self.row('process-death')['state'],'UNKNOWN')
        ledger.store=PostgresStore(self.params)
        self.assertEqual(ledger.snapshot()['held'],1076)
        with self.assertRaises(StateDenied):ledger.reserve_sync('after-reconnect',BODY,COUNT)

    def test_cross_process_cap_contention(self):
        ledgers=[self.grant() for _ in range(3)]
        with self.store.connect() as c:c.execute('UPDATE meri_qualification.budget SET consumed_micro_usd=%s WHERE id=1',(10000000-1076,))
        children=[]
        try:
            for i,ledger in enumerate(ledgers):
                args,data=self.child(ledger,'process-race-'+str(i));p=subprocess.Popen(args,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,shell=False);p.stdin.write(data);p.stdin.close();p.stdin=None;children.append(p)
            outcomes=[]
            for p in children:
                out,err=p.communicate(timeout=30);outcomes.append(p.returncode)
                self.assertIn(p.returncode,(0,3),err.decode(errors='replace'))
            self.assertEqual(outcomes.count(0),1)
            snap=ledgers[0].snapshot();self.assertEqual(snap['consumed_micro_usd']+snap['held'],10000000)
        finally:
            for p in children:
                if p.poll() is None:p.kill();p.wait(timeout=5)

    def test_cancelled_wait_keeps_actual_committed_unknown(self):
        ledger=self.grant();committed=threading.Event();release=threading.Event()
        def observer():committed.set();release.wait(timeout=3)
        ledger.store=PostgresStore(self.params,after_commit=observer)
        async def exercise():
            task=asyncio.create_task(ledger.reserve_and_arm_once('cancelled',BODY,COUNT))
            try:
                self.assertTrue(await asyncio.to_thread(committed.wait,3))
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):await task
            finally:release.set()
        asyncio.run(exercise())
        ledger.store=PostgresStore(self.params)
        self.assertEqual(self.row('cancelled')['state'],'UNKNOWN');self.assertEqual(ledger.snapshot()['held'],1076)

    def test_real_guard_receipt_is_committed_before_fake_transport_send(self):
        ledger=self.grant();observed=[]
        class Counter:
            async def count(self,parameters):return COUNT
        async def exercise():
            guard=BedrockSendGuard(request_id='guard-slot',counter=Counter(),ledger=ledger,deadline=time.monotonic()+10,expected_count_origin='fixture')
            async def fake(request):
                observed.append(self.row('guard-slot')['state'])
                return httpx.Response(200,json={'synthetic':True})
            client=guarded_client(guard,transport=httpx.MockTransport(fake))
            try:
                await client.post(sorted(INVOKE_URLS)[0],data=RAW,headers={'content-type':'application/json'})
            finally:await client.close()
            self.assertTrue(guard.armed)
        asyncio.run(exercise());self.assertEqual(observed,['UNKNOWN'])


if __name__=='__main__':unittest.main(verbosity=2)
