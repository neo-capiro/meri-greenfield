"""Inert product accounting facade; no DB connection, grant activation or transport.

Trusted startup must supply the SAME product transaction owner used by admission.
The existing ledger still owns its explicitly qualified native envelope/pricing;
this facade does not qualify additional models, token bounds or provider policy.
Actual peer/count/complete-usage provenance remains the proxy owner's obligation.
"""
from ..qualification.state.admission import GrantAdmission
from ..qualification.state.ledger import PostgresLedger
from ..qualification.state.pricing import StateDenied
from ..qualification.state.sql import locked_budget

class ProductModelStore:
    __slots__ = ("_transact",)
    budget_namespace = "product"

    def __init__(self, transaction_owner):
        transact = getattr(transaction_owner, "transact", None)
        if not callable(transact) or getattr(transaction_owner, "budget_namespace", None) != "product":
            raise StateDenied("PRODUCT_TRANSACTION_OWNER_REQUIRED")
        self._transact = transact

    def transact(self, operation):
        return self._transact(operation)

    @staticmethod
    def budget(cursor):
        return locked_budget(cursor, "product")

class ProductModelBudget:
    """Explicit borrowed owners only; no HTTP/request-configurable namespace."""
    __slots__ = ("admission", "ledger")

    def __init__(self, transaction_owner, *, grant_id, binding, capability_sha256,
                 raw_request_sha256, pricing):
        store = ProductModelStore(transaction_owner)
        self.admission = GrantAdmission(store, grant_id, binding, capability_sha256)
        self.ledger = PostgresLedger(store, grant_id=grant_id, binding=binding,
            capability_sha256=capability_sha256, raw_request_sha256=raw_request_sha256,
            pricing=pricing, expected_count_origin="aws-counttokens")
