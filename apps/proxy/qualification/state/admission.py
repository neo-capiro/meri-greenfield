"""Fresh ingress grant read; durable cost reservation stays in PostgresLedger."""
import hmac

from .grants import Grants, RunBinding, identifier, same_binding
from .pricing import StateDenied, digest
from .sql import budget_tables, store_namespace


class GrantAdmission:
    """Trusted composition supplies the SQL store in the original mode.

    Explicit product-owner mode uses the exact authenticated admission reader;
    HTTP inputs cannot choose a store, reader, callback or namespace.
    """

    def __init__(self, store, grant_id, binding, capability_sha256):
        if type(binding) is not RunBinding:
            raise StateDenied("TYPED_BINDING_REQUIRED")
        self.store = store
        self.grant_id = identifier(grant_id)
        self.binding = binding
        self.capability_sha256 = digest(capability_sha256)
        self.namespace = store_namespace(store)
        self.tables = budget_tables(self.namespace)
        self._product_owner = None

    @classmethod
    def from_product_owner(cls, *, reader, expected_source, expires_at_ms):
        """Trusted startup only. No store/cursor or boolean authority callback."""
        # Lazy import avoids a product/qualification import cycle. Exact reader
        # type retains the authenticated source checks in the cohesive product owner.
        from ...product.owner_admission import ProductOwnerAdmissionReader
        if cls is not GrantAdmission or type(reader) is not ProductOwnerAdmissionReader:
            raise StateDenied("PRODUCT_OWNER_READER_REQUIRED")
        source = reader._bind(expected_source, expires_at_ms)
        value = cls.__new__(cls)
        import json
        fields = json.loads(source)
        q = fields[3]
        value.store, value.tables = None, None
        value.grant_id = identifier(fields[1])
        value.binding = RunBinding(q[0], q[1], q[2], q[3], q[4])
        value.capability_sha256 = digest(fields[2])
        value.namespace = "product"
        value._product_owner = (reader, source, expires_at_ms)
        return value

    def check(self):
        """No auth cache, activation, mutation, budget refund or provider send."""
        if self._product_owner is not None:
            reader, source, expires_at_ms = self._product_owner
            reader.check_current_sync(source, expires_at_ms)
            return
        def operation(cursor):
            budget = self.store.budget(cursor)
            if budget["quarantined"]:
                raise StateDenied("BUDGET_QUARANTINED")
            Grants._current(cursor, self.binding, namespace=self.namespace)
            cursor.execute(f"SELECT * FROM {self.tables['grants']} WHERE grant_id=%s",
                           (self.grant_id,))
            grant = cursor.fetchone()
            if (not grant or grant["state"] != "ACTIVE"
                or not same_binding(grant, self.binding)
                or grant["expires_at"] <= budget["now"]
                or not hmac.compare_digest(grant["capability_sha256"], self.capability_sha256)):
                raise StateDenied("INGRESS_GRANT_DENIED")
            if self.namespace == "product":
                cursor.execute(f"SELECT max_cost_micro_usd FROM {self.tables['tool_run_allocations']} WHERE run_id=%s", (self.binding.run_id,))
                if cursor.fetchone() is None:
                    raise StateDenied("PRODUCT_ALLOCATION_REQUIRED")
        self.store.transact(operation)
