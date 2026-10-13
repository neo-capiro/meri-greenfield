"""Fixed qualification lifecycle using canonical Grants; never a parallel state machine."""
from datetime import datetime, timezone
import hashlib
import ipaddress
import re
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
    fixture_admission(a['fixture'])
    return a, b


def fixture_admission(value):
    required = {'mode', 'fixtureId', 'host', 'port', 'database', 'user', 'systemIdentifier', 'serverStartTime', 'serverVersion', 'schemaSha256'}
    optional = {'serverAddress', 'serverPort', 'schemaScope'}
    if type(value) is not dict or not required <= value.keys() or value.keys() - required - optional:
        raise StateDenied('LIFECYCLE_FIXTURE')
    f = value
    if f['mode'] != 'owned-disposable-qualification' or f['host'] != '127.0.0.1' or f['database'] != 'meri_qualification_test' or f['user'] != 'qualification_owner' or not 1 <= integer(f['port']) <= 65535:
        raise StateDenied('LIFECYCLE_FIXTURE')
    for key, pattern in [('fixtureId', r'[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}'), ('systemIdentifier', r'[0-9]{1,20}'), ('serverVersion', r'[1-9][0-9]{5}'), ('serverStartTime', r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z')]:
        if type(f[key]) is not str or re.fullmatch(pattern, f[key]) is None:
            raise StateDenied('LIFECYCLE_FIXTURE')
    try:
        stamp = datetime.fromisoformat(f['serverStartTime'].replace('Z', '+00:00'))
        if stamp.isoformat(timespec='milliseconds').replace('+00:00', 'Z') != f['serverStartTime']:
            raise ValueError()
    except ValueError:
        raise StateDenied('LIFECYCLE_FIXTURE') from None
    digest(f['schemaSha256'])
    if ('serverAddress' in f) != ('serverPort' in f):
        raise StateDenied('LIFECYCLE_FIXTURE')
    if 'serverAddress' in f:
        try:
            if type(f['serverAddress']) is not str or '%' in f['serverAddress']:
                raise ValueError()
            ipaddress.ip_address(f['serverAddress'])
        except ValueError:
            raise StateDenied('LIFECYCLE_FIXTURE') from None
        if integer(f['serverPort']) > 65535:
            raise StateDenied('LIFECYCLE_FIXTURE')
    if 'schemaScope' in f:
        scope = exact(f['schemaScope'], ['mode', 'namespaces'])
        if scope['mode'] != 'preserve-declared-evidence' or type(scope['namespaces']) is not list or not 1 <= len(scope['namespaces']) <= 128:
            raise StateDenied('LIFECYCLE_FIXTURE')
        names = []
        for item in scope['namespaces']:
            exact(item, ['name', 'owner'])
            if any(type(item[k]) is not str or re.fullmatch(r'[a-z_][a-z0-9_]{0,62}', item[k]) is None for k in ('name', 'owner')) or item['name'].startswith('pg_') or item['name'] in ('public', 'information_schema', 'meri_qualification', 'meri_task_lookup'):
                raise StateDenied('LIFECYCLE_FIXTURE')
            names.append(item['name'])
        if len(set(names)) != len(names):
            raise StateDenied('LIFECYCLE_FIXTURE')
    return f


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
    def budget(self, cursor):
        value = self.store.budget(cursor)
        if value['quarantined']: raise StateDenied('BUDGET_QUARANTINED')
        return value


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
            cursor.execute("SELECT current_database() AS database,current_user AS username,pg_catalog.host(pg_catalog.inet_server_addr()) AS address,inet_server_port() AS port,current_setting('server_version_num') AS version,floor(extract(epoch FROM pg_postmaster_start_time())*1000)::text AS started_ms,current_setting('fsync') AS fsync,current_setting('synchronous_commit') AS synchronous_commit,(SELECT system_identifier::text FROM pg_control_system()) AS system_identifier")
            row = cursor.fetchone()
            if not row or any(row[key] != expected[field] for key, field in [('database', 'database'), ('username', 'user'), ('version', 'serverVersion'), ('system_identifier', 'systemIdentifier')]) or row['address'] != expected.get('serverAddress', expected['host']) or row['port'] != expected.get('serverPort', expected['port']) or row['fsync'] != 'on' or row['synchronous_commit'] != 'on':
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
