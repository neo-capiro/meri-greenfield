"""Closed trusted ledger selection. Never accept a SQL schema from a request."""
from .pricing import StateDenied


def budget_schema(namespace):
    if namespace == "qualification":
        return "meri_qualification"
    if namespace == "product":
        return "meri_product_budget"
    raise StateDenied("BUDGET_NAMESPACE_REFUSED")


def store_namespace(store):
    # Historical qualification doubles and callers retain their existing default.
    namespace = getattr(store, "namespace", "qualification")
    budget_schema(namespace)
    return namespace
