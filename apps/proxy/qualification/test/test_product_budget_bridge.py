"""Focused product budget bridge checks; scripted SQL only, no DB or provider."""
from datetime import timedelta
import sys
import unittest
from unittest.mock import patch

from apps.proxy.product.model_budget import ProductModelBudget
from apps.proxy.qualification.state.ledger import Settlement
from apps.proxy.qualification.state.pricing import Pricing, StateDenied, PRICING_REVISION
from apps.proxy.qualification.test.test_tool_budget_source import (
    BINDING, BODY, COUNT_MODEL_ID, GRANT, NOW, CountObservation,
    ScriptedStore, TRANSPORT, binding_row,
)


def product(steps):
    store = ScriptedStore(steps, cap=2000)
    store.budget_namespace = "product"
    bridge = ProductModelBudget(store, grant_id=GRANT, binding=BINDING,
        capability_sha256="c" * 64, raw_request_sha256="d" * 64,
        pricing=Pricing(NOW + timedelta(hours=1)))
    return store, bridge


def budget_steps():
    return [("FROM meri_product_budget.budget", {
        "quarantined": False, "consumed_micro_usd": 0, "cap_micro_usd": 2000,
    }), ("clock_timestamp()", {"now": NOW})]


def authority_steps(allocation=True):
    return [("FROM meri_product_budget.runs", binding_row()),
        ("FROM meri_product_budget.grants", binding_row() | {
            "state": "ACTIVE", "capability_sha256": "c" * 64,
            "expires_at": NOW + timedelta(minutes=1),
        }),
        ("FROM meri_product_budget.tool_run_allocations",
            {"max_cost_micro_usd": 2000} if allocation else None)]


class ProductBudgetBridgeTests(unittest.TestCase):
    def test_borrows_only_a_product_transaction_owner(self):
        with self.assertRaisesRegex(StateDenied, "PRODUCT_TRANSACTION_OWNER_REQUIRED"):
            ProductModelBudget(ScriptedStore([]), grant_id=GRANT, binding=BINDING,
                capability_sha256="c" * 64, raw_request_sha256="d" * 64,
                pricing=Pricing(NOW + timedelta(hours=1)))

    def test_admission_requires_current_product_run_grant_and_allocation(self):
        store, bridge = product(budget_steps() + authority_steps())
        bridge.admission.check()
        self.assertFalse(store.steps)
        self.assertFalse(any("meri_qualification" in sql for sql in store.seen))
        store, bridge = product(budget_steps() + authority_steps(allocation=False))
        with self.assertRaisesRegex(StateDenied, "PRODUCT_ALLOCATION_REQUIRED"):
            bridge.admission.check()
        self.assertFalse(store.steps)

    def test_reserve_uses_product_liabilities_and_requires_allocation(self):
        store, bridge = product([])
        with patch.dict(sys.modules, {TRANSPORT.__name__: TRANSPORT}):
            with self.assertRaisesRegex(StateDenied, "NATIVE_COUNT_BINDING_MISMATCH"):
                bridge.ledger.reserve_sync("product_slot", BODY,
                    CountObservation(123, BODY.sha256, COUNT_MODEL_ID, "fixture"))
        self.assertEqual(store.seen, [])
        steps = budget_steps() + authority_steps()[:2] + [
            ("FROM meri_product_budget.budget_liabilities WHERE (kind='model'", None),
            ("FROM meri_product_budget.budget_liabilities WHERE state='UNKNOWN'", {"held": 0}),
            authority_steps()[2],
            ("FROM meri_product_budget.budget_liabilities WHERE run_id=%s", {"total": 0}),
            ("INSERT INTO meri_product_budget.requests", None),
        ]
        store, bridge = product(steps)
        count = CountObservation(123, BODY.sha256, COUNT_MODEL_ID, "aws-counttokens")
        with patch.dict(sys.modules, {TRANSPORT.__name__: TRANSPORT}):
            receipt = bridge.ledger.reserve_sync("product_slot", BODY, count)
        self.assertEqual(receipt.state, "UNKNOWN")
        self.assertFalse(store.steps)
        self.assertFalse(any("meri_qualification" in sql for sql in store.seen))
        steps = budget_steps() + authority_steps()[:2] + [
            ("FROM meri_product_budget.budget_liabilities WHERE (kind='model'", None),
            ("FROM meri_product_budget.budget_liabilities WHERE state='UNKNOWN'", {"held": 0}),
            authority_steps(allocation=False)[2],
        ]
        store, bridge = product(steps)
        with patch.dict(sys.modules, {TRANSPORT.__name__: TRANSPORT}):
            with self.assertRaisesRegex(StateDenied, "PRODUCT_ALLOCATION_REQUIRED"):
                bridge.ledger.reserve_sync("product_slot", BODY, count)
        self.assertFalse(store.steps)
        self.assertFalse(any("INSERT" in sql for sql in store.seen))

    def test_product_reserve_counts_unknown_liability_against_global_cap(self):
        steps = budget_steps() + authority_steps()[:2] + [
            ("FROM meri_product_budget.budget_liabilities WHERE (kind='model'", None),
            ("FROM meri_product_budget.budget_liabilities WHERE state='UNKNOWN'", {"held": 1000}),
            authority_steps()[2],
            ("FROM meri_product_budget.budget_liabilities WHERE run_id=%s", {"total": 0}),
        ]
        store, bridge = product(steps)
        count = CountObservation(123, BODY.sha256, COUNT_MODEL_ID, "aws-counttokens")
        with patch.dict(sys.modules, {TRANSPORT.__name__: TRANSPORT}):
            with self.assertRaisesRegex(StateDenied, "AGGREGATE_BUDGET_EXHAUSTED"):
                bridge.ledger.reserve_sync("product_slot", BODY, count)
        self.assertFalse(store.steps)
        self.assertFalse(any("INSERT" in sql for sql in store.seen))

    def test_product_reserve_enforces_run_allocation(self):
        steps = budget_steps() + authority_steps()[:2] + [
            ("FROM meri_product_budget.budget_liabilities WHERE (kind='model'", None),
            ("FROM meri_product_budget.budget_liabilities WHERE state='UNKNOWN'", {"held": 0}),
            authority_steps()[2],
            ("FROM meri_product_budget.budget_liabilities WHERE run_id=%s", {"total": 1000}),
        ]
        store, bridge = product(steps)
        count = CountObservation(123, BODY.sha256, COUNT_MODEL_ID, "aws-counttokens")
        with patch.dict(sys.modules, {TRANSPORT.__name__: TRANSPORT}):
            with self.assertRaisesRegex(StateDenied, "AGGREGATE_BUDGET_EXHAUSTED"):
                bridge.ledger.reserve_sync("product_slot", BODY, count)
        self.assertFalse(store.steps)
        self.assertFalse(any("INSERT" in sql for sql in store.seen))

    def test_complete_settlement_charges_only_the_product_tables(self):
        original = binding_row() | {
            "grant_id": GRANT, "state": "UNKNOWN", "native_body_sha256": BODY.sha256,
            "raw_request_sha256": "d" * 64, "pricing_revision": PRICING_REVISION,
            "pricing_valid_until": NOW + timedelta(hours=1),
            "input_tokens": 123, "max_output_tokens": 16, "hold_micro_usd": 1076,
        }
        steps = budget_steps() + [
            ("FROM meri_product_budget.requests", original),
            ("FROM meri_product_budget.budget_liabilities WHERE state='UNKNOWN' AND NOT", {"held": 0}),
            authority_steps()[2],
            ("FROM meri_product_budget.budget_liabilities WHERE run_id=%s AND NOT", {"total": 0}),
            ("UPDATE meri_product_budget.budget", None),
            ("UPDATE meri_product_budget.requests", None),
        ]
        store, bridge = product(steps)
        result = bridge.ledger.settle_complete("product_slot", Settlement(
            BODY.sha256, "d" * 64, PRICING_REVISION, "e" * 64, 123, 7))
        self.assertEqual(result, {"actual_micro_usd": 522, "quarantined": False})
        self.assertFalse(store.steps)
        self.assertFalse(any("meri_qualification" in sql for sql in store.seen))


if __name__ == "__main__":
    unittest.main()
