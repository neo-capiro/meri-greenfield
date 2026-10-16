"""SYNTHETIC: retained proxy against scripted product SQL. No DB, TLS, provider or driver import."""
from datetime import timedelta
import sys
import time
import types
import importlib
import unittest
from unittest.mock import patch
from apps.proxy.qualification.state.admission import GrantAdmission
from apps.proxy.qualification.state.grants import Grants
from apps.proxy.qualification.state.namespace import budget_schema
from apps.proxy.qualification.state.ledger import Settlement
from apps.proxy.qualification.state.pricing import StateDenied, Pricing, PRICING_REVISION
from apps.proxy.qualification.runtime.ingress import PeerLease
from apps.proxy.qualification.runtime.product import product_request_owners
from .test_tool_budget_source import (ScriptedStore, reserve_steps, ledger, binding_row,
    CountObservation, TRANSPORT, NOW, GRANT, BINDING, BODY, COUNT_MODEL_ID)


def product_store(steps, **options):
    store = ScriptedStore([(sql.replace('meri_qualification.', 'meri_product_budget.'), row) for sql, row in steps], **options)
    store.namespace = 'product'
    return store


def reserve(store):
    with patch.dict(sys.modules, {TRANSPORT.__name__: TRANSPORT}):
        return ledger(store).reserve_sync('collision', BODY, CountObservation(123, BODY.sha256, COUNT_MODEL_ID, 'fixture'))


class ProductBudgetTests(unittest.TestCase):
    def test_product_store_configuration_and_migration_refusal_are_inert(self):
        driver=types.ModuleType('psycopg'); driver.__version__='3.3.3'
        driver.connect=lambda **_: self.fail('No connection is authorized by this synthetic test')
        rows=types.ModuleType('psycopg.rows'); rows.dict_row=object()
        name='apps.proxy.qualification.state.postgres_store'
        with patch.dict(sys.modules, {'psycopg':driver,'psycopg.rows':rows}):
            previous=sys.modules.pop(name,None)
            try:
                Store=importlib.import_module(name).PostgresStore
                params={'host':'127.0.0.1','port':5432,'dbname':'meri_product','user':'synthetic'}
                store=Store(params,namespace='product')
                for method in (store.migrate_new_database,store.migrate_tool_budget,store.migrate_tool_invocations):
                    with self.assertRaisesRegex(StateDenied,'PRODUCT_MIGRATION_OWNER_REQUIRED'): method()
                with self.assertRaises(StateDenied): Store(params)
                with self.assertRaises(StateDenied): Store(params,namespace='product;DROP')
                with self.assertRaises(AttributeError): store.namespace='qualification'
                cursor=ScriptedStore([('FROM meri_product_budget.budget',{'id':1}),('clock_timestamp()',{'now':NOW})])
                self.assertEqual(store.budget(cursor)['now'],NOW)
                self.assertIn('FOR UPDATE',cursor.seen[0])
            finally:
                sys.modules.pop(name,None)
                if previous is not None: sys.modules[name]=previous

    def test_closed_namespace_and_no_second_product_grant_writer(self):
        for name in ('public', 'meri_product_budget', '', None, 'product;DROP'):
            with self.subTest(name=name), self.assertRaises(StateDenied): budget_schema(name)
        with self.assertRaisesRegex(StateDenied, 'OWNED_BY_NATIVE_ADMISSION'): Grants(product_store([]))

    def test_product_model_reserves_same_combined_liability_and_run_cap(self):
        store = product_store(reserve_steps(held=924, run_total=924) + [('INSERT INTO meri_qualification.requests', None)], cap=2000)
        self.assertEqual(reserve(store).state, 'UNKNOWN')
        self.assertTrue(all('meri_qualification.' not in sql for sql in store.seen))
        self.assertFalse(store.steps)
        for kwargs in ({'held':925}, {'run_total':925}):
            with self.subTest(kwargs=kwargs), self.assertRaisesRegex(StateDenied, 'BUDGET_EXHAUSTED'):
                reserve(product_store(reserve_steps(**kwargs), cap=2000))

    def test_missing_product_allocation_is_denied_before_arm(self):
        steps = reserve_steps(); steps[-2] = ('tool_run_allocations', None)
        store = product_store(steps)
        with self.assertRaisesRegex(StateDenied, 'PRODUCT_ALLOCATION_REQUIRED'): reserve(store)
        self.assertFalse(any('INSERT' in sql for sql in store.seen))

    def test_expired_revoked_and_retargeted_product_grant_are_denied(self):
        for change in ({'state':'REVOKED'}, {'expires_at':NOW}, {'worker_arn':BINDING.worker_arn[:-1]+'b'}, {'fence':2}):
            steps=reserve_steps(); sql,row=steps[1]; steps[1]=(sql,row|change)
            store=product_store(steps)
            with self.subTest(change=change), self.assertRaisesRegex(StateDenied, 'GRANT_ADMISSION_DENIED'): reserve(store)
            self.assertFalse(any('INSERT' in sql for sql in store.seen))

    def test_product_admission_and_reservation_share_peer_store_grant_and_pinned_counter(self):
        store=product_store([]); peer=PeerLease('10.77.0.9', time.monotonic(), BINDING, GRANT)
        owners=product_request_owners(store=store,peer=peer,capability_sha256='c'*64,raw_request_sha256='d'*64,pricing=Pricing(NOW+timedelta(hours=1)))
        self.assertIs(owners.ingress.authority.store, owners.ledger.store)
        self.assertEqual(owners.ledger.namespace, 'product')
        self.assertEqual(owners.ledger.expected_count_origin, 'aws-counttokens')
        self.assertEqual(owners.ingress.authority.grant_id, owners.ledger.grant_id)
        with self.assertRaisesRegex(StateDenied, 'PRODUCT_PROXY_BINDING_REQUIRED'):
            product_request_owners(store=ScriptedStore([]),peer=peer,capability_sha256='c'*64,raw_request_sha256='d'*64,pricing=Pricing(NOW+timedelta(hours=1)))

    def test_product_ingress_preserves_only_pinned_cli_query_before_any_state_or_provider(self):
        from .test_ingress import fixture
        store,ingress,scope=fixture();store.namespace='product'
        owners=product_request_owners(store=store,peer=ingress.peer,capability_sha256=ingress.authority.capability_sha256,raw_request_sha256='d'*64,pricing=Pricing(NOW+timedelta(hours=1)))
        owners.ingress.validate_scope(scope)
        for query in (b'',b'beta=false',b'beta=true&x=1',b'beta=%74rue'):
            with self.subTest(query=query),self.assertRaisesRegex(StateDenied,'INFERENCE_ROUTE_REQUIRED'): owners.ingress.validate_scope(scope|{'query_string':query})
        self.assertEqual(store.calls,0)

    def test_current_product_admission_uses_product_run_and_grant_rows(self):
        store=product_store(reserve_steps()[:2]);GrantAdmission(store,GRANT,BINDING,'c'*64).check()
        self.assertFalse(store.steps);self.assertTrue(all('meri_qualification.' not in sql for sql in store.seen))

    def test_product_unknown_snapshot_never_refunds_and_late_settlement_needs_original_not_current_grant(self):
        store=product_store([('budget_liabilities', {'held':1076,'unresolved':1})])
        self.assertEqual(ledger(store).snapshot()['held'],1076)
        original=binding_row()|{'grant_id':GRANT,'state':'UNKNOWN','native_body_sha256':BODY.sha256,'raw_request_sha256':'d'*64,'pricing_revision':PRICING_REVISION,'pricing_valid_until':NOW+timedelta(hours=1),'input_tokens':123,'max_output_tokens':16,'hold_micro_usd':1076}
        store=product_store([('FROM meri_qualification.requests',original),("NOT (kind='model' AND slot=%s)",{'held':0}),('tool_run_allocations',{'max_cost_micro_usd':2000}),("NOT (kind='model' AND slot=%s)",{'total':0}),('UPDATE meri_qualification.budget',None),('UPDATE meri_qualification.requests',None)])
        self.assertEqual(ledger(store).settle_complete('collision',Settlement(BODY.sha256,'d'*64,PRICING_REVISION,'e'*64,123,7))['actual_micro_usd'],522)
        self.assertFalse(any('.grants ' in sql for sql in store.seen),'late usage settles after revocation or expiry')
        self.assertTrue(all('meri_qualification.' not in sql for sql in store.seen))


if __name__ == '__main__': unittest.main()
