"""Fixed qualification lifecycle using canonical Grants; never a parallel state machine."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import time

from ..state.grants import Grants, RunBinding, identifier
from ..state.admission import GrantAdmission
from ..state.pricing import StateDenied, digest

PROTOCOL = json.loads((Path(__file__).resolve().parents[4] / 'packages/contracts/qualification-assembly-0.2/protocol.json').read_text())
SAFE = 9007199254740991


def exact(value, fields):
    if type(value) is not dict or set(value) != set(fields):
        raise StateDenied('LIFECYCLE_SHAPE')
    return value


def integer(value):
    if type(value) is not int or not 0 < value <= SAFE:
        raise StateDenied('LIFECYCLE_INTEGER')
    return value


def canonical_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def admission(value):
    a = exact(value, PROTOCOL['admissionFields'])
    q = exact(a['qualificationBinding'], PROTOCOL['qualificationFields'])
    b = RunBinding(q['runId'], q['attempt'], q['workerArn'], q['fence'], q['policyRevision'])
    full = exact(a['binding'], ['tenantId', 'actorId', 'conversationId', 'runId', 'attemptId', 'workerId', 'writerFence'])
    for name in ('tenantId', 'actorId'):
        if type(full[name]) is not str or not 1 <= len(full[name]) <= 256:
            raise StateDenied('LIFECYCLE_BINDING')
    for name in ('conversationId', 'runId', 'attemptId', 'workerId'):
        identifier(full[name])
    if full['runId'] != b.run_id or type(full['writerFence']) is not int or full['writerFence'] != b.fence:
        raise StateDenied('LIFECYCLE_BINDING')
    digest(a['allocationSha256']); integer(a['originalDeadlineMs'])
    grants = a['grants']
    if type(grants) is not list or len(grants) != 2:
        raise StateDenied('LIFECYCLE_GRANTS')
    for grant in grants:
        exact(grant, PROTOCOL['grantFields']); identifier(grant['grantId']); digest(grant['capabilitySha256'])
        if integer(grant['expiresAtMs']) > a['originalDeadlineMs']:
            raise StateDenied('LIFECYCLE_EXPIRY')
    if len({g['grantId'] for g in grants}) != 2 or len({g['capabilitySha256'] for g in grants}) != 2:
        raise StateDenied('LIFECYCLE_GRANTS')
    fixture = exact(a['fixture'], ['mode', 'fixtureId', 'host', 'port', 'database', 'user', 'systemIdentifier', 'serverStartTime', 'serverVersion', 'schemaSha256'])
    if fixture['mode'] != 'owned-disposable-qualification' or fixture['host'] != '127.0.0.1' or fixture['database'] != 'meri_qualification_test' or fixture['user'] != 'qualification_owner' or not 1 <= integer(fixture['port']) <= 65535:
        raise StateDenied('LIFECYCLE_FIXTURE')
    if any(type(fixture[k]) is not str or not 1 <= len(fixture[k]) <= 128 for k in ('fixtureId', 'systemIdentifier', 'serverStartTime', 'serverVersion')):
        raise StateDenied('LIFECYCLE_FIXTURE')
    identifier(fixture['fixtureId']); digest(fixture['schemaSha256'])
    return a, b


class LifecycleUnknown(StateDenied):
    """A write was attempted; no implicit retry, reseed or compensating refund."""


class _CheckedCursor:
    def __init__(self, cursor, check): self.cursor, self.check = cursor, check
    def execute(self, *args):
        self.check(); result = self.cursor.execute(*args); self.check(); return result
    def fetchone(self):
        self.check(); value = self.cursor.fetchone(); self.check(); return value


class _CheckedStore:
    def __init__(self, store, check): self.store, self.check = store, check
    def transact(self, operation):
        self.check()
        def bounded(cursor):
            self.check(); result = operation(_CheckedCursor(cursor, self.check)); self.check(); return result
        result = self.store.transact(bounded); self.check(); return result
    def budget(self, cursor): return self.store.budget(cursor)


class QualificationLifecycle:
    def __init__(self, store, value, *, deadline_ms, now_ms=None):
        self.value, self.binding = admission(value)
        self.now = now_ms or (lambda: time.time_ns() // 1000000)
        self.deadline = min(integer(deadline_ms), self.value['originalDeadlineMs'])
        self.store = _CheckedStore(store, self.check)
        self.grants = Grants(self.store)
        self.check()

    def check(self):
        at = self.now()
        if type(at) is not int or at < 0 or at >= self.deadline or any(at >= g['expiresAtMs'] for g in self.value['grants']):
            raise StateDenied('LIFECYCLE_DEADLINE')

    def verify_fixture(self):
        expected = self.value['fixture']
        def read(cursor):
            cursor.execute("SELECT current_database() AS database,current_user AS username,inet_server_addr()::text AS address,inet_server_port() AS port,current_setting('server_version_num') AS version,floor(extract(epoch FROM pg_postmaster_start_time())*1000)::text AS started_ms,current_setting('fsync') AS fsync,current_setting('synchronous_commit') AS synchronous_commit,(SELECT system_identifier::text FROM pg_control_system()) AS system_identifier")
            row = cursor.fetchone()
            if not row or any(row[key] != expected[field] for key, field in [('database', 'database'), ('username', 'user'), ('address', 'host'), ('port', 'port'), ('version', 'serverVersion'), ('system_identifier', 'systemIdentifier')]) or row['fsync'] != 'on' or row['synchronous_commit'] != 'on':
                raise StateDenied('LIFECYCLE_FIXTURE_MISMATCH')
            stamp = datetime.fromisoformat(expected['serverStartTime'].replace('Z', '+00:00'))
            if stamp.tzinfo is None or row['started_ms'] != str(int(stamp.timestamp() * 1000)):
                raise StateDenied('LIFECYCLE_FIXTURE_MISMATCH')
        self.store.transact(read)

    def run(self, operation, grant_id=None):
        if operation not in PROTOCOL['operations']:
            raise StateDenied('LIFECYCLE_OPERATION')
        selected = next((g for g in self.value['grants'] if g['grantId'] == grant_id), None)
        if (operation == 'activate' and selected is None) or (operation != 'activate' and grant_id is not None):
            raise StateDenied('LIFECYCLE_GRANT')
        self.verify_fixture()
        attempted = False
        try:
            if operation == 'prepare':
                attempted = True; self.grants.set_current_run(self.binding)
                for g in self.value['grants']:
                    self.check(); self.grants.create_pending(g['grantId'], self.binding, g['capabilitySha256'], datetime.fromtimestamp(g['expiresAtMs'] / 1000, timezone.utc))
                status = 'PREPARED'
            elif operation == 'activate':
                # Only the fixed trusted Node coordinator calls this after consuming a branded observation.
                attempted = True; self.grants.activate(selected['grantId'], self.binding); status = 'ACTIVE'
            elif operation == 'revoke':
                for g in self.value['grants']:
                    self.check(); attempted = True; self.grants.revoke(g['grantId'])
                status = 'REVOKED'
            else:
                for g in self.value['grants']:
                    self.check(); GrantAdmission(self.store, g['grantId'], self.binding, g['capabilitySha256']).check()
                status = 'ADMITTED'
            self.check()
            return {'schema': PROTOCOL['schema'], 'operation': operation, 'admissionSha256': canonical_hash(self.value), 'grantId': grant_id, 'status': status}
        except Exception:
            if attempted: raise LifecycleUnknown('LIFECYCLE_WRITE_UNKNOWN') from None
            raise StateDenied('LIFECYCLE_READ_REFUSED') from None
