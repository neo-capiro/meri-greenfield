"""Trusted authoritative run/fence state and pending/active opaque grant hashes."""
from dataclasses import dataclass
import re
import uuid
from .pricing import StateDenied, digest, utc
from .sql import budget_tables

WORKER = re.compile(r"arn:aws:ecs:us-east-1:967807252336:task/[A-Za-z0-9_-]{1,255}/[0-9a-f]{32}\Z")


def identifier(value):
    if type(value) is not str:
        raise StateDenied("INVALID_UUID")
    try:
        if str(uuid.UUID(value)) != value:
            raise ValueError()
    except ValueError:
        raise StateDenied("INVALID_UUID") from None
    return value


@dataclass(frozen=True)
class RunBinding:
    run_id: str
    attempt: int
    worker_arn: str
    fence: int
    policy_revision: str

    def __post_init__(self):
        identifier(self.run_id)
        for value in (self.attempt, self.fence):
            if type(value) is not int or not 1 <= value <= 2**31-1:
                raise StateDenied("INVALID_RUN_SEQUENCE")
        if type(self.worker_arn) is not str or not WORKER.fullmatch(self.worker_arn):
            raise StateDenied("INVALID_WORKER_IDENTITY")
        digest(self.policy_revision)

    def values(self):
        return (self.run_id, self.attempt, self.worker_arn, self.fence, self.policy_revision)


def same_binding(row, binding):
    return tuple(str(row[k]) if k == "run_id" else row[k] for k in
                 ("run_id", "attempt", "worker_arn", "fence", "policy_revision")) == binding.values()


class Grants:
    def __init__(self, store):
        self.store = store

    def set_current_run(self, binding):
        if type(binding) is not RunBinding:
            raise StateDenied("TYPED_BINDING_REQUIRED")
        def operation(cursor):
            self.store.budget(cursor)
            cursor.execute("SELECT * FROM meri_qualification.runs WHERE run_id=%s", (binding.run_id,))
            old = cursor.fetchone()
            if old and (binding.attempt <= old["attempt"] or binding.fence <= old["fence"]):
                raise StateDenied("RUN_SEQUENCE_NOT_ADVANCED")
            cursor.execute("INSERT INTO meri_qualification.runs(run_id,attempt,worker_arn,fence,policy_revision) VALUES(%s,%s,%s,%s,%s) ON CONFLICT(run_id) DO UPDATE SET attempt=excluded.attempt,worker_arn=excluded.worker_arn,fence=excluded.fence,policy_revision=excluded.policy_revision", binding.values())
        self.store.transact(operation)

    def create_pending(self, grant_id, binding, capability_sha256, expires_at):
        identifier(grant_id);digest(capability_sha256);expires_at=utc(expires_at)
        if type(binding) is not RunBinding:
            raise StateDenied("TYPED_BINDING_REQUIRED")
        def operation(cursor):
            budget=self.store.budget(cursor)
            self._current(cursor,binding)
            if expires_at <= budget["now"]:
                raise StateDenied("GRANT_ALREADY_EXPIRED")
            cursor.execute("INSERT INTO meri_qualification.grants(grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,'PENDING')", (grant_id,*binding.values(),capability_sha256,expires_at))
        self.store.transact(operation)

    def activate(self, grant_id, binding):
        """Trusted caller must first independently establish this exact live worker."""
        identifier(grant_id)
        if type(binding) is not RunBinding:
            raise StateDenied("TYPED_BINDING_REQUIRED")
        def operation(cursor):
            budget=self.store.budget(cursor);self._current(cursor,binding)
            cursor.execute("SELECT * FROM meri_qualification.grants WHERE grant_id=%s",(grant_id,));grant=cursor.fetchone()
            if not grant or grant["state"]!="PENDING" or not same_binding(grant,binding) or grant["expires_at"]<=budget["now"]:
                raise StateDenied("GRANT_ACTIVATION_DENIED")
            cursor.execute("UPDATE meri_qualification.grants SET state='ACTIVE' WHERE grant_id=%s",(grant_id,))
        self.store.transact(operation)

    def revoke(self, grant_id):
        identifier(grant_id)
        def operation(cursor):
            self.store.budget(cursor)
            cursor.execute("UPDATE meri_qualification.grants SET state='REVOKED' WHERE grant_id=%s RETURNING grant_id",(grant_id,))
            if cursor.fetchone() is None:
                raise StateDenied("GRANT_NOT_FOUND")
        self.store.transact(operation)

    @staticmethod
    def _current(cursor,binding,*,namespace="qualification"):
        cursor.execute(f"SELECT * FROM {budget_tables(namespace)['runs']} WHERE run_id=%s",(binding.run_id,));row=cursor.fetchone()
        if not row or not same_binding(row,binding):
            raise StateDenied("STALE_RUN_BINDING")
