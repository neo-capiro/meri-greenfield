"""Fresh ingress grant read; durable cost reservation stays in PostgresLedger."""
import hmac

from .grants import Grants, RunBinding, identifier, same_binding
from .pricing import StateDenied, digest


class GrantAdmission:
    """Trusted composition supplies the existing store, never an HTTP reader seam."""

    def __init__(self, store, grant_id, binding, capability_sha256):
        if type(binding) is not RunBinding:
            raise StateDenied("TYPED_BINDING_REQUIRED")
        self.store = store
        self.grant_id = identifier(grant_id)
        self.binding = binding
        self.capability_sha256 = digest(capability_sha256)

    def check(self):
        """No auth cache, activation, mutation, budget refund or provider send."""
        def operation(cursor):
            budget = self.store.budget(cursor)
            if budget["quarantined"]:
                raise StateDenied("BUDGET_QUARANTINED")
            Grants._current(cursor, self.binding)
            cursor.execute("SELECT * FROM meri_qualification.grants WHERE grant_id=%s",
                           (self.grant_id,))
            grant = cursor.fetchone()
            if (not grant or grant["state"] != "ACTIVE"
                or not same_binding(grant, self.binding)
                or grant["expires_at"] <= budget["now"]
                or not hmac.compare_digest(grant["capability_sha256"], self.capability_sha256)):
                raise StateDenied("INGRESS_GRANT_DENIED")
        self.store.transact(operation)
