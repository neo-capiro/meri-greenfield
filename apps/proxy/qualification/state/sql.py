"""Closed budget identities and the existing locked DB-clock read; no connections."""
from types import MappingProxyType
from .pricing import StateDenied

_NAMES = ("budget", "runs", "grants", "requests", "budget_liabilities", "tool_run_allocations")
_TABLES = {name: MappingProxyType({table: f"{schema}.{table}" for table in _NAMES})
           for name, schema in (("qualification", "meri_qualification"), ("product", "meri_product_budget"))}

def budget_tables(namespace="qualification"):
    if type(namespace) is not str or namespace not in _TABLES:
        raise StateDenied("INVALID_BUDGET_NAMESPACE")
    return _TABLES[namespace]

def store_namespace(store):
    namespace = getattr(store, "budget_namespace", "qualification")
    budget_tables(namespace)
    return namespace

def locked_budget(cursor, namespace="qualification"):
    cursor.execute(f"SELECT * FROM {budget_tables(namespace)['budget']} WHERE id=1 FOR UPDATE")
    row = cursor.fetchone()
    if row is None:
        raise StateDenied("BUDGET_UNAVAILABLE")
    cursor.execute("SELECT clock_timestamp() AS now")
    row["now"] = cursor.fetchone()["now"]
    return row
