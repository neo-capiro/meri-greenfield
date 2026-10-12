"""Actual model ledger reconciliation with scripted SQL rows; no DB/driver/model call."""
from pathlib import Path
from datetime import datetime,timedelta,timezone
import json,sys,unittest
sys.path.insert(0,sys.argv.pop(1))
from apps.proxy.qualification.state.ledger import PostgresLedger,Settlement
from apps.proxy.qualification.state.grants import RunBinding
from apps.proxy.qualification.state.pricing import Pricing,StateDenied,liability

class Fixture:
 def __init__(self,cap=10000000,run_cap=None):
  self.now=datetime.now(timezone.utc);self.pricing=Pricing(self.now+timedelta(hours=1))
  self.binding=RunBinding('22222222-2222-4222-8222-222222222222',1,'arn:aws:ecs:us-east-1:967807252336:task/Independent/'+'a'*32,1,'a'*64)
  self.grant='88888888-8888-4888-8888-888888888888';self.slot='same-slot';self.run_cap=run_cap
  self.state={'cap_micro_usd':cap,'consumed_micro_usd':100,'quarantined':False,'now':self.now}
  self.row=dict(zip(('run_id','attempt','worker_arn','fence','policy_revision'),self.binding.values()))
  self.row.update(grant_id=self.grant,state='UNKNOWN',native_body_sha256='b'*64,raw_request_sha256='c'*64,pricing_revision=self.pricing.revision,pricing_valid_until=self.pricing.valid_until,input_tokens=123,max_output_tokens=16,hold_micro_usd=1076)
  self.tool_unknown=1076;self.debits=0;self.commands=[];self.rows=None;self.missing_view=False
  self.ledger=PostgresLedger(self,grant_id=self.grant,binding=self.binding,capability_sha256='d'*64,raw_request_sha256='c'*64,pricing=self.pricing,expected_count_origin='fixture')
 def transact(self,operation):return operation(self)
 def budget(self,cursor):return dict(self.state)
 def execute(self,sql,args=()):
  self.commands.append((sql,args))
  if 'FROM meri_qualification.requests WHERE request_id=' in sql:self.rows=self.row
  elif 'FROM meri_qualification.tool_run_allocations' in sql:self.rows=None if self.run_cap is None else {'max_cost_micro_usd':self.run_cap}
  elif 'FROM meri_qualification.budget_liabilities' in sql:
   if self.missing_view:raise RuntimeError('scripted missing0002 view')
   if 'NOT (' in sql:
    # Exact domain exclusion matters: this tool has the same textual slot ID.
    if "NOT (kind='model' AND slot=%s)" not in sql:raise AssertionError('untyped cross-domain exclusion')
    self.rows={'held':self.tool_unknown} if ' AS held' in sql else {'total':100+self.tool_unknown}
   elif ' AS unresolved' in sql:
    self.rows={'held':self.tool_unknown+(1076 if self.row['state']=='UNKNOWN' else 0),'unresolved':1+(self.row['state']=='UNKNOWN')}
   else:raise AssertionError('unexpected accounting query')
  elif sql.startswith('UPDATE meri_qualification.budget'):
   self.debits+=1;self.state['consumed_micro_usd']+=args[0];self.state['quarantined']|=args[1]
  elif sql.startswith('UPDATE meri_qualification.requests'):
   self.row['state']='SETTLED';self.row['actual_micro_usd']=args[0]
  else:raise AssertionError('unsupported independent SQL:'+sql)
 def fetchone(self):return self.rows
 def evidence(self):return Settlement('b'*64,'c'*64,self.pricing.revision,'e'*64,123,7)

class Controls(unittest.TestCase):
 def test_typed_slot_collision_retains_tool_unknown_and_quarantines_global_overrun(self):
  f=Fixture(cap=1500);r=f.ledger.settle_complete(f.slot,f.evidence())
  self.assertEqual(r['actual_micro_usd'],522);self.assertTrue(r['quarantined']);self.assertEqual(f.state['consumed_micro_usd'],622)
  self.assertEqual(f.tool_unknown,1076);self.assertEqual(f.debits,1)
 def test_run_cap_includes_shared_unknown_and_settled_once(self):
  for limit,expected in [(1698,False),(1697,True)]:
   f=Fixture(run_cap=limit);r=f.ledger.settle_complete(f.slot,f.evidence());self.assertEqual(r['quarantined'],expected)
 def test_historical_settlement_is_not_new_authority_and_replay_cannot_debit(self):
  f=Fixture();f.ledger.settle_complete(f.slot,f.evidence())
  self.assertFalse(any('FROM meri_qualification.grants' in q for q,_ in f.commands))
  with self.assertRaises(StateDenied):f.ledger.settle_complete(f.slot,f.evidence())
  self.assertEqual(f.debits,1);self.assertEqual(f.state['consumed_micro_usd'],622)
 def test_snapshot_reports_both_unknown_rows_without_readding_settled_consumption(self):
  f=Fixture();r=f.ledger.snapshot();self.assertEqual(r['held'],2152);self.assertEqual(r['unresolved'],2);self.assertEqual(r['consumed_micro_usd'],100)
 def test_missing0002_refuses_before_mutating_consumed_or_releasing_hold(self):
  f=Fixture();f.missing_view=True
  with self.assertRaises(RuntimeError):f.ledger.settle_complete(f.slot,f.evidence())
  self.assertEqual(f.debits,0);self.assertEqual(f.row['state'],'UNKNOWN');self.assertEqual(f.state['consumed_micro_usd'],100)

unittest.main()
