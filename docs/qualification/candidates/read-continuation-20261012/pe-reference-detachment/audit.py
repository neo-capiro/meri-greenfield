"""Verify exact bounded source change, reversible test edit and raw receipts."""
from pathlib import Path
import hashlib
import json
import subprocess

root = Path(__file__).resolve().parents[5]
evidence = Path(__file__).resolve().parent
base = 'ede7b56845816d38d0bbffab5a657aaa4f978739'
passed = 0

def require(value, message):
    global passed
    if not value:
        raise AssertionError(message)
    passed += 1

def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)

def tree(ref):
    result = {}
    for row in git('ls-tree', '-rz', ref).split(b'\0'):
        if row:
            info, path = row.split(b'\t', 1)
            result[path.decode()] = info.decode()
    return result

original, current = tree(base), tree('HEAD')
module = 'packages/contracts/retrieval-0.2/pe-references-validation.mjs'
test = 'packages/contracts/test/retrieval-pe-references.test.mjs'
for path, identity in original.items():
    require(path in current, f'Missing original {path}')
    if path not in [module, test]:
        require(current[path] == identity, f'Changed original {path}')
before = git('show', f'{base}:{module}')
require(before.count(b'    return value;') == 1, 'One exact return site')
require((root / module).read_bytes() == before.replace(b'    return value;', b'    return page;'), 'Exact one-line source repair')
correction = json.loads((evidence / 'test-expectation-update.json').read_text())
old_test = git('show', f'{base}:{test}')
new_test = (root / test).read_bytes()
require((evidence / 'original-author-test.mjs.txt').read_bytes() == old_test, 'Exact original test preimage')
require(old_test.count(correction['before'].encode()) == 1, 'One original assertion replacement')
require(new_test == old_test.replace(correction['before'].encode(), correction['after'].encode()), 'Exact intended assertion edit')
require(new_test.replace(correction['after'].encode(), correction['before'].encode()) == old_test, 'Inverse restores original test')
for side, data in [('before', old_test), ('after', new_test)]:
    require(hashlib.sha256(data).hexdigest() == correction[side + 'Sha256'], 'Test content hash')
receipts = []
for name, code, passes, failures in [('original-negative', 1, 3, 6), ('repaired-original-tests', 1, 70, 1), ('repaired-focused', 1, 84, 2), ('repaired-focused-complete', 1, 84, 2), ('repaired-focused-final', 1, 85, 1), ('repaired-focused-all-inputs', 0, 144, 0)]:
    receipt = json.loads((evidence / f'{name}.json').read_text())
    require(receipt['exitCode'] == code and receipt['sourceDiffBytes'] == 0, f'Exact source/result for {name}')
    require(receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and not receipt['ownedGroupKillRequired'], f'Owned group exited {name}')
    for stream in receipt['streams']:
        data = (root / stream['path']).read_bytes()
        require(len(data) == stream['bytes'] and hashlib.sha256(data).hexdigest() == stream['sha256'], f'Raw stream hash {name}')
    stdout = (evidence / f'{name}.stdout.bin').read_text()
    require(f'ℹ pass {passes}\n' in stdout and f'ℹ fail {failures}\n' in stdout, f'Counts {name}')
    receipts.append({'label': name, 'passed': passes, 'failed': failures, 'source': receipt['sourceHead'], 'ownedProcessGroupAbsent': True})
catalog = json.loads((root / 'packages/contracts/retrieval-0.2/catalog.json').read_text())
require(len(catalog['originals']) == 139, 'Full original scope')
require(all(o['handler'] is None for o in catalog['operations']), 'All handlers unavailable')
result = {'base': base, 'sourceHead': git('rev-parse', 'HEAD').decode().strip(), 'baselinePaths': len(original), 'unchangedBaselinePaths': len(original) - 2, 'onlyChangedBaselinePaths': [module, test], 'passed': passed, 'failed': 0, 'receipts': receipts, 'runtimeAccepted': False, 'sourceEnabled': False}
(evidence / 'audit-results.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
