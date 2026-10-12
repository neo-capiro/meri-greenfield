"""Data and lexical checks only; private members are never imported or executed.

Pass the private pinned-members directory. Output contains member identities,
original field names, ordinal roles and comparison booleans only. Never bodies
or personal paths. The missing native helper is a dependency, not an inferred
implementation of Same/Hash/Named.
"""
import ast
import hashlib
import json
from pathlib import Path
import re
import sys

PRIVATE = Path(sys.argv[1])
HERE = Path(__file__).resolve().parent
ROOT = Path.cwd()
criteria = json.loads((HERE / 'frozen-criteria.json').read_bytes())
checks = []

def check(name, ok):
    checks.append({'name': name, 'passed': bool(ok)})

for row in criteria['privateMembers']:
    raw = (PRIVATE / row['name']).read_bytes()
    check('exact-member:' + row['name'], len(raw) == row['bytes'] and hashlib.sha256(raw).hexdigest() == row['sha256'])
    if not checks[-1]['passed']:
        raise SystemExit('Private member identity mismatch; no parsing performed')
record = json.loads((PRIVATE / 'candidate-hash-and-paths.json').read_bytes())
source = (PRIVATE / 'collect.ps1').read_text(encoding='utf-8-sig')
roles = ['executable', 'root', 'Lib', 'DLLs']
inline_fields = ['VolumeSerialHex', 'FileId128Hex', 'Attributes', 'ReparseTag', 'Directory', 'DeletePending']
inline_lines = [line for line in source.splitlines() if '$roleIdentity' in line and 'VolumeSerialHex' in line]
check('one-inline-six-field-comparison', len(inline_lines) == 1 and re.findall(r'\$x\.([A-Za-z0-9_]+)', inline_lines[0]) == inline_fields and inline_lines[0].count('-ne') == 6)
check('native-helper-loading-reference', 'NativeMetadata.cs' in source and bool(re.search(r'\bAdd-Type\s+-Path\s+\$nativeSourcePath', source)))
check('no-local-helper-substitute', not (PRIVATE / 'NativeMetadata.cs').exists())
check('Same-delegated-three-call-sites', len(re.findall(r'\[SourceReviewNative1\]::Same\(', source)) == 3)
check('hash-bounds-delegated', bool(re.search(r'\[SourceReviewNative1\]::Hash\(\$candidate\s*,\s*8388608\s*,\s*10000\s*\)', source)))
roles_out, differences = [], []
for role in roles:
    before, after = record['before'][role], record['after'][role]
    equal_counts = len(before['entries']) == len(after['entries'])
    local = []
    for index, (a, b) in enumerate(zip(before['entries'], after['entries'], strict=True)):
        changed = [k for k in sorted(set(a) | set(b)) if type(a.get(k)) is not type(b.get(k)) or a.get(k) != b.get(k)]
        if changed:
            row = {'role': role, 'entryIndex': index, 'changedFields': changed}
            local.append(row)
            differences.append(row)
    identity = before['passed'] is True and after['passed'] is True and equal_counts and all(all(a[f] == b[f] for f in inline_fields) for a,b in zip(before['entries'],after['entries']))
    reported = next(r for r in record['comparisons'] if r['role'] == role)
    check('inline-identity:' + role, identity and reported['identityAndPlainMetadataStable'] is True)
    check('strict-record-differences:' + role, len(local) == 3 and [r['entryIndex'] for r in local] == [0,1,2] and all(r['changedFields'] == ['LastAccessTime'] for r in local) and reported['allRecordedFieldsIncludingTimesStable'] is False)
    roles_out.append({'role': role, 'entries': len(before['entries']), 'inlineIdentityRecomputed': identity, 'strictRecordEquality': not local, 'reportedSameAggregate': reported['allRecordedFieldsIncludingTimesStable']})
check('thirty-five-pairs-twelve-differences', sum(r['entries'] for r in roles_out) == 35 and len(differences) == 12)
pairs = [
 ('named-before/opened-before', record['before']['executable']['entries'][-1], record['hash']['OpenedBefore']),
 ('opened-before/named-during', record['hash']['OpenedBefore'], record['hash']['NamedDuring']),
 ('opened-before/opened-after', record['hash']['OpenedBefore'], record['hash']['OpenedAfter']),
 ('opened-after/named-after', record['hash']['OpenedAfter'], record['after']['executable']['entries'][-1])]
for label,a,b in pairs:
    check('complete-executable-record-equality:' + label, a == b and all(type(a[k]) is type(b[k]) for k in a))
check('known-selected-size-hash', record['hash']['BytesRead'] == 91648 and record['hash']['Sha256'] == 'f1d8d2aa2a8ad7c74b6c6300b29cfdbcb484fc7ffad99b7fbfe1e31c048343b9')
check('reported-hash-flags-no-error', record['hashError'] is None and all(record['hash'][k] is True for k in ['OpenedStable','NamedMatchesOpened','ReadShareOnly']))
acceptance_line = next(line for line in source.splitlines() if line.strip().startswith('$observationAccepted='))
check('exact-four-term-acceptance-conjunction', re.findall(r'\$([A-Za-z]+)', acceptance_line) == ['observationAccepted','null','hashResult','hashStable','identityStable','allFieldsStable'] and acceptance_line.count('-and') == 3 and '-or' not in acceptance_line)
check('recorded-rejection-preserved', record['executableBeforeOpenedAfterStable'] is True and record['pathIdentityAndPlainMetadataStable'] is True and record['allRecordedPathFieldsStable'] is False and record['boundedHashObservationAccepted'] is False and len(record['blockers']) == 1)
module = ast.parse((ROOT / 'scripts/qualification/worker_runner_inventory.py').read_text())
identity = next(n for n in module.body if isinstance(n, ast.FunctionDef) and n.name == 'identity')
attrs = {n.attr for n in ast.walk(identity) if isinstance(n, ast.Attribute)}
check('canonical-modification-change-timestamps-retained', {'st_mtime_ns','st_ctime_ns'} <= attrs and 'st_atime_ns' not in attrs)
result = {'base':criteria['base'],'scope':'Complete record and caller-predicate facts only; helper implementation remains unavailable',
          'memberIdentities':criteria['privateMembers'],'roles':roles_out,'differences':differences,
          'inlineIdentityFields':inline_fields,'privateNativeDependency':{'member':'NativeMetadata.cs','bytes':6163,'sha256':'f551d7287611b982a93eebf02e93719bfdce355609bd7ca4f9cd546ae9bf0a4c','methods':['Same','Hash','Named']},
          'limitations':['Strict JSON equality is independently recomputed; it is not execution or an inferred implementation of SourceReviewNative1.Same.','No cause of LastAccessTime change is established.','Hash open/read/close/share/cancellation implementation requires the exact helper.','Reported bounds and flags are historical observations, not native requalification.'],
          'checks':checks,'passed':sum(r['passed'] for r in checks),'failed':sum(not r['passed'] for r in checks),
          'privateSourceExecuted':False,'nativeExecution':False,'admissionChanged':False}
(HERE / 'full-member-data-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':result['passed'],'failed':result['failed'],'pairedRecords':35,'differingRecords':12,'helperRequired':True,'nativeExecution':False}))
sys.exit(0 if result['failed'] == 0 else 1)
