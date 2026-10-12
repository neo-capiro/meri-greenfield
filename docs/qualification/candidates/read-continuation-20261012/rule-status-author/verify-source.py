"""Offline rule-contract source and metadata audit; no legacy/runtime imports."""
from pathlib import Path
import hashlib
import json
import subprocess

lane = Path(__file__).resolve().parent
root = lane.parents[4]
base = '2aa0a33bdaf36af1224cfdb840bc493e53cea9f3'
candidate = '95442b40d006e48e2215d6acec09fd7f029a2b9b'
checks = []


def git(*args, cwd=root):
    return subprocess.check_output(['git', *args], cwd=cwd)


def check(name, value):
    checks.append({'name': name, 'passed': bool(value)})


def tree(commit):
    files = {}
    for row in git('ls-tree', '-rz', commit).split(b'\0'):
        if row:
            meta, path = row.split(b'\t', 1)
            files[path.decode()] = meta.split()[2].decode()
    return files


original, current = tree(base), tree(candidate)
for path, blob in original.items():
    check('original:' + path, current.get(path) == blob)
source = []
for name in ['rule-status.schema.json', 'rule-status-validation.mjs']:
    path = 'packages/contracts/retrieval-0.2/' + name
    raw = (root / path).read_bytes()
    check('source-freeze:' + name, raw == git('show', f'{candidate}:{path}'))
    source.append({'path': path, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
names = set()
for path in sorted((root / 'packages/contracts/retrieval-0.2').glob('*.schema.json')):
    for name in json.loads(path.read_text()).get('$defs', {}):
        check('definition-unique:' + name, name not in names)
        names.add(name)
references = json.loads((lane / 'reference-identities.json').read_text())['references']
for reference in references:
    for version in reference['versions']:
        ref = version['commit'] + ':' + reference['path']
        raw = git('show', ref, cwd='/workspace/capirov2')
        check('reference:' + ref, len(raw) == version['bytes'] and hashlib.sha256(raw).hexdigest() == version['sha256'] and
              git('rev-parse', ref, cwd='/workspace/capirov2').decode().strip() == version['blob'])
    check('reference-no-drift:' + reference['path'], reference['versions'][0]['blob'] == reference['versions'][1]['blob'])
receipt = json.loads((lane / 'focused-first.json').read_text())
check('focused:exit', receipt['exitCode'] == 0 and not receipt['timedOut'])
check('focused:cleanup', receipt['ownedProcessGroupAbsent'])
check('focused:source', receipt['sourceHead'] == candidate and receipt['sourceDiffBytes'] == 0)
for entry in receipt['streams']:
    raw = (root / entry['path']).read_bytes()
    check('stream:' + entry['path'], len(raw) == entry['bytes'] and hashlib.sha256(raw).hexdigest() == entry['sha256'])
summary = {'scope': 'OFFLINE_SOURCE_REFERENCE_PRESERVATION', 'base': base, 'candidate': candidate,
           'passed': sum(x['passed'] for x in checks), 'total': len(checks), 'referenceFiles': len(references),
           'privateDefinitions': len(names), 'sourceFiles': source,
           'failed': [x for x in checks if not x['passed']],
           'checksSha256': hashlib.sha256(json.dumps(checks, sort_keys=True).encode()).hexdigest()}
print(json.dumps(summary, indent=2))
raise SystemExit(0 if all(x['passed'] for x in checks) else 1)
