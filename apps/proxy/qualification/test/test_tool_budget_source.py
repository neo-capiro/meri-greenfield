"""Actual Python ledger decisions against scripted SQL; no driver/DB/provider import."""
import ast
from dataclasses import dataclass
from datetime import datetime,timedelta,timezone
import hashlib
import json
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

from apps.proxy.qualification.state.ledger import PostgresLedger,Settlement
from apps.proxy.qualification.state.grants import RunBinding
from apps.proxy.qualification.state.pricing import Pricing,StateDenied,PRICING_REVISION
from apps.proxy.qualification.runtime.bedrock_body import BodyLimits,COUNT_MODEL_ID,INVOKE_URLS,inspect_native_request

NOW=datetime(2026,10,12,tzinfo=timezone.utc)
RUN='11111111-1111-4111-8111-111111111111'
GRANT='22222222-2222-4222-8222-222222222222'
BINDING=RunBinding(RUN,1,'arn:aws:ecs:us-east-1:967807252336:task/Synthetic/'+'a'*32,1,'b'*64)
RAW=json.dumps({'anthropic_version':'bedrock-2023-05-31','max_tokens':16,'messages':[{'role':'user','content':'synthetic'}]},separators=(',',':')).encode()
BODY=inspect_native_request('POST',sorted(INVOKE_URLS)[0],RAW,BodyLimits())

@dataclass(frozen=True)
class CountObservation:
    input_tokens:int; native_body_sha256:str; model_id:str; origin:str
@dataclass(frozen=True)
class HoldReceipt:
    request_id:str; native_body_sha256:str; state:str
TRANSPORT=types.ModuleType('apps.proxy.qualification.runtime.bedrock_transport')
TRANSPORT.CountObservation=CountObservation;TRANSPORT.HoldReceipt=HoldReceipt

class ScriptedStore:
    def __init__(self,steps,cap=10000000):
        self.steps=list(steps);self.seen=[]
        self.row={'now':NOW,'quarantined':False,'consumed_micro_usd':0,'cap_micro_usd':cap}
    def transact(self,operation):return operation(self)
    def budget(self,cursor):self.seen.append('LOCK');return self.row
    def execute(self,sql,params=()):
        self.seen.append(sql)
        if not self.steps:raise AssertionError('Unexpected SQL: '+sql)
        expected,self.result=self.steps.pop(0)
        if expected not in sql:raise AssertionError((expected,sql))
        if isinstance(self.result,Exception):raise self.result
    def fetchone(self):return self.result

def ledger(store):return PostgresLedger(store,grant_id=GRANT,binding=BINDING,capability_sha256='c'*64,raw_request_sha256='d'*64,pricing=Pricing(NOW+timedelta(hours=1)),expected_count_origin='fixture')
def binding_row():return dict(zip(('run_id','attempt','worker_arn','fence','policy_revision'),BINDING.values()))
def reserve_steps(held=0,run_total=0,cap=2000):
    return [('FROM meri_qualification.runs',binding_row()),('FROM meri_qualification.grants',binding_row()|{'state':'ACTIVE','capability_sha256':'c'*64,'expires_at':NOW+timedelta(minutes=1)}),("(kind='model' AND slot=%s)",None),("budget_liabilities WHERE state='UNKNOWN'",{'held':held}),('tool_run_allocations',{'max_cost_micro_usd':cap}),('budget_liabilities WHERE run_id=%s',{'total':run_total})]

class ToolBudgetSourceTests(unittest.TestCase):
    def reserve(self,store):
        with patch.dict(sys.modules,{TRANSPORT.__name__:TRANSPORT}):
            return ledger(store).reserve_sync('collision',BODY,CountObservation(123,BODY.sha256,COUNT_MODEL_ID,'fixture'))
    def test_model_reserve_counts_shared_global_hold(self):
        store=ScriptedStore(reserve_steps(held=925),cap=2000)
        with self.assertRaisesRegex(StateDenied,'BUDGET_EXHAUSTED'):self.reserve(store)
        self.assertFalse(store.steps);self.assertFalse(any('INSERT' in sql for sql in store.seen))
    def test_model_reserve_exact_global_and_run_bound(self):
        store=ScriptedStore(reserve_steps(held=924,run_total=924)+[('INSERT INTO meri_qualification.requests',None)],cap=2000)
        self.assertEqual(self.reserve(store).state,'UNKNOWN');self.assertFalse(store.steps)
    def test_model_reserve_counts_shared_run_settled_and_unknown(self):
        store=ScriptedStore(reserve_steps(run_total=925))
        with self.assertRaisesRegex(StateDenied,'BUDGET_EXHAUSTED'):self.reserve(store)
        self.assertFalse(store.steps)
    def test_missing_migration_fails_before_send_receipt(self):
        steps=reserve_steps();steps[2]=(steps[2][0],RuntimeError('synthetic undefined table'))
        with self.assertRaises(RuntimeError):self.reserve(ScriptedStore(steps))
    def test_model_snapshot_keeps_original_shape_with_combined_counts(self):
        store=ScriptedStore([('budget_liabilities',{'held':45,'unresolved':2})]);result=ledger(store).snapshot()
        self.assertEqual((result['held'],result['unresolved']),(45,2));self.assertFalse(store.steps)
    def test_settlement_excludes_only_model_slot_and_quarantines_shared_run_overage(self):
        original=binding_row()|{'grant_id':GRANT,'state':'UNKNOWN','native_body_sha256':BODY.sha256,'raw_request_sha256':'d'*64,'pricing_revision':PRICING_REVISION,'pricing_valid_until':NOW+timedelta(hours=1),'input_tokens':123,'max_output_tokens':16,'hold_micro_usd':1076}
        store=ScriptedStore([('FROM meri_qualification.requests',original),("NOT (kind='model' AND slot=%s)",{'held':70}),('tool_run_allocations',{'max_cost_micro_usd':591}),("NOT (kind='model' AND slot=%s)",{'total':70}),('UPDATE meri_qualification.budget',None),('UPDATE meri_qualification.requests',None)])
        result=ledger(store).settle_complete('collision',Settlement(BODY.sha256,'d'*64,PRICING_REVISION,'e'*64,123,7))
        self.assertEqual(result,{'actual_micro_usd':522,'quarantined':True});self.assertFalse(store.steps)
    def test_loader_is_explicit_and_migration_preserves_domain_identity(self):
        root=Path(__file__).resolve().parents[4];tree=ast.parse((root/'apps/proxy/qualification/state/postgres_store.py').read_text())
        cls=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='PostgresStore')
        methods={n.name:ast.get_source_segment((root/'apps/proxy/qualification/state/postgres_store.py').read_text(),n) for n in cls.body if isinstance(n,ast.FunctionDef)}
        self.assertNotIn('0002',methods['migrate_new_database']);self.assertIn('0002_tool_budget.sql',methods['migrate_tool_budget'])
        sql=(root/'apps/proxy/qualification/state/migrations/0002_tool_budget.sql').read_text()
        self.assertIn("'model'::text AS kind",sql);self.assertIn("'tool'::text AS kind",sql);self.assertIn('charged_micro_usd',sql)

if __name__=='__main__':unittest.main()
