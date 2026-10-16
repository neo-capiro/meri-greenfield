"""Explicit PostgreSQL connections and transactions; no automatic migration/retry."""
from pathlib import Path
import re
import psycopg
from psycopg.rows import dict_row

from .pricing import StateDenied
from .namespace import budget_schema


class CommitUncertain(StateDenied):
    """Dispatch must be denied; reconnect/reconcile without refunding UNKNOWN."""


class PostgresStore:
    def __init__(self, connection_parameters, *, after_commit=None, namespace='qualification'):
        self._namespace = namespace
        self._schema = budget_schema(namespace)
        # Trusted operator configuration, never parsed from agent HTTP input.
        allowed = {"host", "port", "dbname", "user", "password", "sslmode", "sslrootcert"}
        if type(connection_parameters) is not dict or set(connection_parameters) - allowed:
            raise StateDenied("INVALID_DATABASE_CONFIGURATION")
        if not {"host", "port", "dbname", "user"} <= set(connection_parameters):
            raise StateDenied("INCOMPLETE_DATABASE_CONFIGURATION")
        database_pattern = r"meri_qualification(?:_[a-z0-9_]+)?" if namespace == 'qualification' else r"meri_product(?:_[a-z0-9_]+)?"
        if (type(connection_parameters["dbname"]) is not str
            or not re.fullmatch(database_pattern,connection_parameters["dbname"])):
            raise StateDenied("QUALIFICATION_DATABASE_REQUIRED" if namespace == 'qualification' else "PRODUCT_DATABASE_REQUIRED")
        if (type(connection_parameters["host"]) is not str or not re.fullmatch(r"[A-Za-z0-9.-]+",connection_parameters["host"])
            or type(connection_parameters["user"]) is not str or not connection_parameters["user"]
            or type(connection_parameters["port"]) is not int or not 1<=connection_parameters["port"]<=65535):
            raise StateDenied("INVALID_DATABASE_CONFIGURATION")
        if connection_parameters["host"]!="127.0.0.1" and (connection_parameters.get("sslmode")!="verify-full"
            or type(connection_parameters.get("sslrootcert")) is not str or not connection_parameters["sslrootcert"]):
            raise StateDenied("VERIFIED_DATABASE_TLS_REQUIRED")
        if psycopg.__version__!="3.3.3":
            raise StateDenied("UNQUALIFIED_DRIVER_VERSION")
        if "password" in connection_parameters and type(connection_parameters["password"]) is not str:
            raise StateDenied("INVALID_DATABASE_CONFIGURATION")
        if after_commit is not None and not callable(after_commit):
            raise StateDenied("INVALID_COMMIT_OBSERVER")
        self.parameters = dict(connection_parameters)
        self.after_commit = after_commit  # Trusted test seam for lost acknowledgements.

    def connect(self):
        try:
            return psycopg.connect(**self.parameters, connect_timeout=5,
                                   application_name="meri-"+self.namespace+"-state", row_factory=dict_row)
        except Exception:
            raise StateDenied("DATABASE_CONNECTION_FAILED") from None

    def transact(self, operation):
        connection = self.connect()
        committing = False
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL statement_timeout = '5s'")
                cursor.execute("SET LOCAL lock_timeout = '2s'")
                result = operation(cursor)
            committing = True
            connection.commit()
            if self.after_commit is not None:
                self.after_commit()
            return result
        except Exception as exc:
            if committing:
                raise CommitUncertain("COMMIT_ACKNOWLEDGEMENT_UNKNOWN") from None
            try:
                connection.rollback()
            except Exception:
                pass
            if isinstance(exc, StateDenied):
                raise
            raise StateDenied("DATABASE_TRANSACTION_FAILED") from None
        finally:
            try:
                connection.close()
            except Exception:
                raise StateDenied("DATABASE_CLOSE_UNKNOWN") from None

    def migrate_new_database(self):
        """Explicit owner/test operation; schema must not exist already."""
        self._qualification_migration()
        sql = (Path(__file__).parent / "migrations/0001_qualification_state.sql").read_text(encoding="utf-8")
        return self.transact(lambda cursor: cursor.execute(sql))

    def migrate_tool_budget(self):
        """Explicit owner upgrade after 0001; never called automatically."""
        self._qualification_migration()
        sql = (Path(__file__).parent / "migrations/0002_tool_budget.sql").read_text(encoding="utf-8")
        return self.transact(lambda cursor: cursor.execute(sql))

    def migrate_tool_invocations(self):
        """Explicit owner upgrade after 0002; never called automatically."""
        self._qualification_migration()
        sql = (Path(__file__).parent / "migrations/0003_tool_invocations.sql").read_text(encoding="utf-8")
        return self.transact(lambda cursor: cursor.execute(sql))

    @property
    def namespace(self):
        return self._namespace

    def _qualification_migration(self):
        if self.namespace != 'qualification':
            raise StateDenied('PRODUCT_MIGRATION_OWNER_REQUIRED')

    def budget(self, cursor):
        cursor.execute(f"SELECT * FROM {self._schema}.budget WHERE id=1 FOR UPDATE")
        row = cursor.fetchone()
        if row is None:
            raise StateDenied("BUDGET_UNAVAILABLE")
        # Evaluate expiry AFTER the lock wait, not in a pre-lock target list.
        cursor.execute("SELECT clock_timestamp() AS now")
        row["now"] = cursor.fetchone()["now"]
        return row
