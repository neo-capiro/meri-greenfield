"""Content-free exact Git/source review; does not execute SDK or application code."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[5]
EVIDENCE = Path(__file__).resolve().parent
BASE = 'e5fb3963de787bbd7b7663316c368f15814897da'
CANDIDATE = 'b5d0f55108a375ce15eed97d3a7a6926558221af'
FIRST = '6f8be6b140a1859cefd1880d77219ea23986de2f'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def tree(ref):
    result = {}
    for line in git('ls-tree', '-rz', '--full-tree', ref).split(b'\0'):
        if not line:
            continue
        header, name = line.split(b'\t', 1)
        mode, kind, oid = header.decode().split()
        result[name.decode()] = {'mode': mode, 'kind': kind, 'oid': oid}
    return result

checks = []
def check(name, passed, detail=None):
    checks.append({'name': name, 'passed': bool(passed), 'detail': detail})

before, candidate, local = tree(BASE), tree(CANDIDATE), tree('HEAD')
changed_originals = [p for p, v in before.items() if candidate.get(p) != v]
check('all original Git members preserved', not changed_originals, {'count': len(before), 'changed': changed_originals})
protected = json.loads((EVIDENCE / 'protected-baseline.json').read_text())['files']
for entry in protected:
    data = (ROOT / entry['path']).read_bytes()
    check('protected:' + entry['path'], len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256'])

source_paths = [p for p in candidate if p not in before and p.startswith(('apps/', 'packages/'))]
source_manifest = []
for path in source_paths:
    expected = git('show', f'{CANDIDATE}:{path}')
    observed = (ROOT / path).read_bytes()
    check('exact source:' + path, expected == observed and local.get(path) == candidate[path])
    source_manifest.append({'path': path, 'gitBlob': candidate[path]['oid'], 'bytes': len(expected), 'sha256': hashlib.sha256(expected).hexdigest()})
check('exact allocated source count', len(source_paths) == 10, source_paths)
first_tests = git('show', f'{FIRST}:apps/control/test/schedule-lifecycle.test.mjs')
check('initial author test file retained as byte prefix', (ROOT / 'apps/control/test/schedule-lifecycle.test.mjs').read_bytes().startswith(first_tests), {'initialBytes': len(first_tests)})

source = (ROOT / 'apps/control/schedules/schedule-lifecycle.mjs').read_text()
check('concrete PostgreSQL factory composes actual owner', 'scheduleOwner:createPostgresScheduleOwner({pool})' in source)
check('canonical lifetime imported', "../../../packages/runtime/operation-lifetime.mjs" in source)
check('existing inspector reused', "from './temporal-inspection.mjs'" in source)
check('no module-local alternate timers', 'setTimeout(' not in source and 'setInterval(' not in source)
owner = (ROOT / 'apps/control/schedules/postgres-schedule-owner.mjs').read_text()
ddl = (ROOT / 'apps/control/schedules/migrations/0001_schedule_owner.sql').read_text()
check('atomic missing-row creation serializes using advisory transaction lock', 'pg_advisory_xact_lock' in owner)
check('retained intent binds digest and generation comparison', 'intent_sha256' in owner and 'generation=$7' in owner and 'active_intent=$3' in owner)
check('database schema preserves tenant-qualified primary keys', 'PRIMARY KEY(tenant_id,schedule_id)' in ddl and 'PRIMARY KEY(tenant_id,intent_id)' in ddl)
check('database unresolved intent states explicit', "'CLAIMED','DISPATCHING','ACKNOWLEDGED','UNKNOWN'" in ddl)
check('no implicit migration execution/import', 'readFile' not in owner and '.sql' not in owner)

sdk = json.loads((EVIDENCE / 'sdk-reference-identities.json').read_text())
donor = Path('/workspace/meri-temporal-recovery-20261012/apps/control/qualification-temporal/node_modules/@temporalio/client')
check('installed SDK version is exact', json.loads((donor / 'package.json').read_text())['version'] == sdk['version'] == '1.24.0')
for item in sdk['files']:
    data = (donor / item['path']).read_bytes()
    check('SDK metadata:' + item['path'], len(data) == item['bytes'] and hashlib.sha256(data).hexdigest() == item['sha256'])
for label, expected in [('independent-first', 0), ('independent-expanded', 1), ('owner-first', 0), ('repaired-first', 0), ('missing-before', 1), ('missing-repaired', 0), ('status-before', 1), ('list-errors-before', 1), ('final-behavior', 0)]:
    receipt = json.loads((EVIDENCE / (label + '.json')).read_text())
    check('raw receipt:' + label, receipt['exitCode'] == expected and receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and receipt['sourceDiffBytes'] == 0)
    for stream in receipt['streams']:
        data = (ROOT / stream['path']).read_bytes()
        check('raw stream:' + stream['path'], len(data) == stream['bytes'] and hashlib.sha256(data).hexdigest() == stream['sha256'])

result = {'base': BASE, 'candidate': CANDIDATE, 'candidateTree': git('rev-parse', CANDIDATE + '^{tree}').decode().strip(),
          'scope': 'SOURCE_ONLY; static markers supplement actual 134 behavioral tests, not proof of SQL/server semantics',
          'originalMembers': len(before), 'sourceManifest': source_manifest,
          'passed': sum(c['passed'] for c in checks), 'failed': sum(not c['passed'] for c in checks), 'checks': checks,
          'runtimeAccepted': False, 'sqlExecuted': False, 'sdkExecuted': False}
(EVIDENCE / 'source-audit-results.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'passed': result['passed'], 'failed': result['failed'], 'originalMembers': len(before), 'candidate': CANDIDATE}))
raise SystemExit(bool(result['failed']))
