"""Fixed stdin/stdout owner bridge; no shell, arbitrary operation, migration, or import I/O."""
import json
from pathlib import Path
import sys

if __package__ in (None, ''):
    sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from apps.proxy.qualification.assembly.lifecycle import PROTOCOL, QualificationLifecycle, LifecycleUnknown, admission, exact, integer, canonical_hash


def _pairs(items):
    out = {}
    for key, value in items:
        if key in out: raise ValueError('DUPLICATE_FIELD')
        out[key] = value
    return out


def decode(raw):
    if type(raw) is not bytes or not 0 < len(raw) <= PROTOCOL['maxFrameBytes']:
        raise ValueError('FRAME_LIMIT')
    value = json.loads(raw.decode('utf-8'), object_pairs_hook=_pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('NONFINITE')))
    exact(value, PROTOCOL['requestFields'])
    if value['schema'] != PROTOCOL['schema'] or value['operation'] not in PROTOCOL['operations']:
        raise ValueError('PROTOCOL')
    admission(value['admission']); integer(value['deadlineMs'])
    if canonical_hash(value['admission']) != value['admissionSha256']:
        raise ValueError('ADMISSION_HASH')
    connection = value['connection']
    fixture = value['admission']['fixture']
    if type(connection) is not dict or any(connection.get(k) != fixture[f] for k, f in [('host', 'host'), ('port', 'port'), ('dbname', 'database'), ('user', 'user')]):
        raise ValueError('CONNECTION_FIXTURE_MISMATCH')
    return value


def handle(raw, *, store_factory=None, now_ms=None):
    value = decode(raw)
    try:
        if store_factory is None:
            from apps.proxy.qualification.state.postgres_store import PostgresStore
            store_factory = PostgresStore
        store = store_factory(value['connection'])
        return QualificationLifecycle(store, value['admission'], deadline_ms=value['deadlineMs'], now_ms=now_ms).run(value['operation'], value['grantId'])
    except Exception as error:
        return {'schema': PROTOCOL['schema'], 'operation': value['operation'], 'admissionSha256': value['admissionSha256'], 'grantId': value['grantId'], 'status': 'UNKNOWN' if isinstance(error, LifecycleUnknown) else 'REFUSED'}


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args == ['--help']:
        print('Usage: bridge.py --stdio (trusted qualification owner only; one bounded JSON frame)'); return 0
    if args != ['--stdio']:
        print('{"status":"REFUSED"}'); return 2
    try:
        raw = sys.stdin.buffer.read(PROTOCOL['maxFrameBytes'] + 1)
        result = handle(raw)
        print(json.dumps(result, sort_keys=True, separators=(',', ':')))
        return 0 if result['status'] not in ('UNKNOWN', 'REFUSED') else 2
    except Exception:
        print('{"status":"REFUSED"}'); return 2

if __name__ == '__main__':
    raise SystemExit(main())
