"""Read-only source and reference identity audit. No native/source service execution."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

lane = Path(__file__).resolve().parent
root = lane.parents[4]
base = '4280ebaba4cab554baf7e6b23175c34d21027097'
candidate = 'c511b4bf6ee3f30674f3bd7badae79df82a61aab'
checks = []


def git(*args, cwd=root):
    return subprocess.check_output(['git', *args], cwd=cwd)


def check(name, value):
    checks.append({'name': name, 'passed': bool(value)})


for record in git('ls-tree', '-rz', base).split(b'\0'):
    if not record:
        continue
    metadata, raw_path = record.split(b'\t', 1)
    path = raw_path.decode()
    actual = git('rev-parse', f'{candidate}:{path}').decode().strip()
    check('original:' + path, actual == metadata.split()[2].decode())

source = []
for filename in ['legislative-directory.schema.json', 'legislative-directory-validation.mjs']:
    path = 'packages/contracts/retrieval-0.2/' + filename
    raw = (root / path).read_bytes()
    check('source-freeze:' + filename, raw == git('show', f'{candidate}:{path}'))
    source.append({'path': path, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})

references = json.loads((lane / 'reference-identities.json').read_text())['references']
for reference in references:
    for version in reference['versions']:
        raw = git('show', version['commit'] + ':' + reference['path'], cwd='/workspace/capirov2')
        check('reference:' + version['commit'] + ':' + reference['path'],
              len(raw) == version['bytes'] and hashlib.sha256(raw).hexdigest() == version['sha256'] and
              git('rev-parse', version['commit'] + ':' + reference['path'], cwd='/workspace/capirov2').decode().strip() == version['blob'])
    check('reference-no-drift:' + reference['path'], reference['versions'][0]['blob'] == reference['versions'][1]['blob'])

schema = json.loads((root / source[0]['path']).read_text())
state_ref = git('show', 'fd8765ec01d292013758606204f2c9d886cd31c1:packages/shared/src/us-states.ts', cwd='/workspace/capirov2').decode()
vocabulary = dict(re.findall(r"^  ([A-Z]{2}): '([^']+)',", state_ref, re.M))
check('state-vocabulary-exact', len(vocabulary) == 56 and schema['$defs']['DirectoryStateNames']['const'] == vocabulary)
names = set()
for path in sorted((root / 'packages/contracts/retrieval-0.2').glob('*.schema.json')):
    for name in json.loads(path.read_text()).get('$defs', {}):
        check('definition-unique:' + name, name not in names)
        names.add(name)

for label, expected in [('focused-first', 0), ('duplicate-before', 1), ('focused-repaired', 0)]:
    receipt = json.loads((lane / (label + '.json')).read_text())
    check(label + ':exit-and-cleanup', receipt['exitCode'] == expected and not receipt['timedOut'] and receipt['ownedProcessGroupAbsent'])
    check(label + ':clean-source', receipt['sourceDiffBytes'] == 0)
    for entry in receipt['streams']:
        raw = (root / entry['path']).read_bytes()
        check('stream:' + entry['path'], len(raw) == entry['bytes'] and hashlib.sha256(raw).hexdigest() == entry['sha256'])

summary = {'scope': 'SOURCE_AND_REFERENCE_METADATA_ONLY', 'base': base, 'candidate': candidate,
           'passed': sum(item['passed'] for item in checks), 'total': len(checks),
           'referenceFiles': len(references), 'privateDefinitions': len(names), 'sourceFiles': source,
           'failed': [item for item in checks if not item['passed']],
           'checksSha256': hashlib.sha256(json.dumps(checks, sort_keys=True).encode()).hexdigest()}
print(json.dumps(summary, indent=2))
raise SystemExit(0 if all(item['passed'] for item in checks) else 1)
