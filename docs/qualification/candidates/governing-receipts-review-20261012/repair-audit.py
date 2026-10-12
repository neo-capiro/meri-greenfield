#!/usr/bin/env python3
"""Read-only check of the narrowly repaired documentary delta."""
import hashlib
import json
import subprocess

BEFORE = '39b6da63289241b368a5003d47e98352c7cbc817'
AFTER = 'e652b5d5abd52b2d10fafbbe0e0f74c163fe786a'
P = 'docs/qualification/candidates/read-continuation-20261012/plan-receipt-join/'
checks = []
def raw(c, p): return subprocess.check_output(['git', 'show', c + ':' + p])
def data(c, p): return json.loads(raw(c, P + p))
def check(v, n): checks.append({'name': n, 'pass': bool(v)})
old, new = data(BEFORE, 'requirements.json')['requirements'], data(AFTER, 'requirements.json')['requirements']
for a, b in zip(old, new):
    allowed = {'statusScope'}
    if a['id'] == 'W00':
        allowed |= {'status', 'completedSourceComponents', 'sourceReceiptIds', 'reportedRuntimeReceiptIds', 'remaining', 'owner', 'nextParallelSourceOrMetadataWork', 'decisionOrExternalPrerequisite'}
    if a['id'] in {'REL-07', 'REL-08'}:
        allowed.add('remaining')
    check({k: v for k, v in a.items() if k not in allowed} == {k: v for k, v in b.items() if k not in allowed}, a['id'] + ' unaffected semantics preserved')
    check('not downstream implementation or runtime' in b['statusScope'], a['id'] + ' amended scope label remains bounded')
record = data(AFTER, 'precision-correction/finding-and-preimage.json')
check(record['oldRows'] == [r for r in old if r['id'] in {'W00', 'REL-07', 'REL-08'}], 'all three original affected rows exactly preserved')
for e in record['oldFiles']:
    value = raw(e['ref'], e['path'])
    check(e['ref'] == BEFORE and (len(value), hashlib.sha256(value).hexdigest()) == (e['bytes'], e['sha256']), 'preserved original identity ' + e['path'].removeprefix(P))
for old_name, name in [('verification.json', 'prior-verification.json'), ('verify.stdout', 'prior-verify.stdout'), ('verify.stderr', 'prior-verify.stderr')]:
    check(raw(BEFORE, P + old_name) == raw(AFTER, P + 'precision-correction/' + name), 'old raw author receipt ' + old_name)
old_receipts, new_receipts = data(BEFORE, 'receipts.json')['receipts'], data(AFTER, 'receipts.json')['receipts']
check(old_receipts == [r for r in new_receipts if r['id'] not in {'g0-discovery', 'r2-adoption'}], 'all original20 receipt records unchanged')
check({r['id'] for r in new if r['status'] == 'completed-source'} == {'W00', 'G0'}, 'only prior discovery completed;51 remaining pending')
for stem, code in [('whitespace-all', 2), ('whitespace-authored', 0)]:
    receipt = data(AFTER, stem + '.json')
    for stream in ['stdout', 'stderr']:
        check(hashlib.sha256(raw(AFTER, P + stem + '.' + stream)).hexdigest() == receipt[stream + 'Sha256'], stem + ' ' + stream + ' integrity')
    check(receipt['exitCode'] == code, stem + ' original exit preserved')
check(len(raw(AFTER, P + 'whitespace-all.stdout').decode().splitlines()) == 5, 'exact five extra-LF warning preimages')
for name in ['boundaries.json', 'frontend/STATUS.json', 'frontend/SOURCE.json', 'frontend/publication-review.md']:
    check(raw(BEFORE, P + name) == raw(AFTER, P + name), 'unrelated boundaries/source report unchanged ' + name)
result = {'before': BEFORE, 'after': AFTER, 'passed': sum(c['pass'] for c in checks), 'total': len(checks), 'checks': checks}
print(json.dumps(result, indent=2))
raise SystemExit(0 if all(c['pass'] for c in checks) else 1)
