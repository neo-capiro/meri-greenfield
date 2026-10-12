"""Read root capture receipts and immutable source only; never rerun their commands."""
import hashlib
import json
import os
import re
import subprocess
import sys

target, broad_label, public_label = sys.argv[1:4]
prefix = 'docs/qualification/candidates/backend-execution-20261012/integration/'
checks = []
def git(*args):
    return subprocess.check_output(['git', *args])
def blob(ref, path):
    return git('show', ref + ':' + path)
def sha(data):
    return hashlib.sha256(data).hexdigest()
def same(label, actual, expected):
    checks.append({'label': label, 'pass': actual == expected})
    if actual != expected:
        checks[-1].update(actual=actual, expected=expected)
def products(ref, public=False):
    raw = git('ls-tree', '-rz', ref, 'apps', 'packages', 'scripts', 'package.json', 'package-lock.json')
    if not public:
        return raw
    # Public capture preceded the20th private retrieval expectation fix. Compare
    # all production plus the two actual public check files, not unrelated tests.
    return b'\0'.join(row for row in raw.split(b'\0') if row and
        (b'/test/' not in row and b'/tests/' not in row or
         row.endswith((b'packages/contracts/test/public-types.ts', b'packages/contracts/test/public-package.test.mjs'))))

paths = git('ls-tree', '-r', '--name-only', target, prefix).decode().splitlines()
receipts = []
for path in paths:
    if not path.endswith('.json'):
        continue
    value = json.loads(blob(target, path))
    if not isinstance(value, dict) or not all(k in value for k in ['command', 'sourceHead', 'streams', 'ownedPidAndPgid']):
        continue
    for stream in value['streams']:
        raw = blob(target, stream['path'])
        same('capture raw ' + stream['path'], [len(raw), sha(raw)], [stream['bytes'], stream['sha256']])
    same('capture owned cleanup ' + path, [value['ownedProcessGroupAbsent'], value['timedOut'], value['ownedGroupKillRequired']], [True, False, False])
    receipts.append({'path': path, 'source': value['sourceHead'], 'exitCode': value['exitCode'], 'ownedPidAndPgid': value['ownedPidAndPgid'], 'reapedDescendants': value.get('reapedDescendants', [])})

final_results = []
for kind, label in [('broad', broad_label), ('public', public_label)]:
    path = prefix + label + '.json'
    receipt = json.loads(blob(target, path))
    same('final ' + kind + ' capture exit and clean source', [receipt['exitCode'], receipt['sourceDiffBytes']], [0, 0])
    same('final ' + kind + ' exact checked tree', sha(products(receipt['sourceHead'], kind == 'public')), sha(products(target, kind == 'public')))
    output = blob(target, receipt['streams'][0]['path']).decode()
    same('final ' + kind + ' no failing tests', bool(re.search(r'(?:#|ℹ) fail 0\b', output)), True)
    same('final ' + kind + ' no skipped tests', bool(re.search(r'(?:#|ℹ) skipped 0\b', output)), True)
    counts = re.findall(r'(?:#|ℹ) tests (\d+)\b', output)
    final_results.append({'kind': kind, 'path': path, 'source': receipt['sourceHead'], 'testCounts': [int(n) for n in counts], 'durationSeconds': receipt['durationSeconds'], 'group': receipt['ownedPidAndPgid'], 'reapedDescendants': receipt.get('reapedDescendants', [])})

for path, ref in [
 ('apps/control/schedules/temporal-inspection.mjs', 'c78a4dff30f825441da5c32015d90647be107b3a'),
 ('packages/contracts/schedules-0.2/inspection-validation.mjs', 'c78a4dff30f825441da5c32015d90647be107b3a'),
 ('packages/contracts/schedules-0.2/inspection.schema.json', 'c78a4dff30f825441da5c32015d90647be107b3a'),
 ('packages/contracts/retrieval-0.2/public-domain-registry.mjs', '0463c80a521c0d0db83f3769b1511e54a4d8b3f5'),
 ('packages/contracts/retrieval-0.2/public-domain-datasets.json', '0463c80a521c0d0db83f3769b1511e54a4d8b3f5')]:
    same('accepted supporting source ' + path, sha(blob(target, path)), sha(blob(ref, path)))

failures = [row for row in checks if not row['pass']]
print(json.dumps({'scope': 'ROOT_RECEIPT_VERIFICATION_NOT_TEST_RERUN_OR_RUNTIME', 'target': target,
                  'checks': len(checks), 'passed': len(checks)-len(failures), 'failures': failures,
                  'finalResults': final_results, 'capturesIncludingRetainedFailures': receipts}, indent=2))
raise SystemExit(1 if failures else 0)
