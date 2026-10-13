"""Read-only exact Git/source/receipt audit; no application or service imports."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

BASE = 'b23a2cd027d43740bd99f937366e9be2df1be3ad'
SOURCE = '0715c71025a72312917c7cc0714951be814f7ae3'
AUTHOR = '7a5664ca4a9caff48784ba1ad0809ae2d3d8f62a'
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
checks = []
def check(name, value):
    checks.append({'name': name, 'pass': bool(value)})
def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])
def blob(ref, path):
    return git('show', f'{ref}:{path}')
def sha(value):
    return hashlib.sha256(value).hexdigest()
def tree(ref):
    return {record.split(b'\t', 1)[1].decode(): record.split(b'\t', 1)[0].decode()
            for record in git('ls-tree', '-r', '-z', ref).split(b'\0') if record}

base, source, author, review = map(tree, [BASE, SOURCE, AUTHOR, 'HEAD'])
for label, entries in [('source', source), ('author packet', author), ('review', review)]:
    check(f'all {len(base)} original entries unchanged in {label}', all(entries.get(p) == value for p, value in base.items()))
paths = ['apps/control/action-followthrough/index.mjs', 'apps/control/action-followthrough/selection.mjs']
identities = []
for path in paths:
    data = blob(SOURCE, path)
    check(f'exact tested and final-author source {path}', data == (ROOT / path).read_bytes() == blob(AUTHOR, path))
    identities.append({'path': path, 'bytes': len(data), 'sha256': sha(data)})
new_code = sorted(p for p in source if p not in base and p.startswith(('apps/', 'packages/', 'scripts/')))
check('only two production files and two author test files added', new_code == sorted(paths + [
    'apps/control/action-followthrough/test/fixture.mjs', 'apps/control/action-followthrough/test/workflow.test.mjs']))
test_path = 'apps/control/action-followthrough/workflow-independent.test.mjs'
check('final independent controls unchanged from pre-repair negative freeze',
      (ROOT / test_path).read_bytes() == blob('97d583cb6a8f75b8f8287b8bd9c379e83c8bbe11', test_path))
catalog = json.loads(blob(SOURCE, 'packages/contracts/retrieval-0.2/catalog.json'))
check('139 original scope remains 96 selected / 43 deferred', len(catalog['originals']) == 139 and
      sum(o['disposition'] == 'selected' for o in catalog['originals']) == 96 and
      sum(o['disposition'] == 'deferred' for o in catalog['originals']) == 43)
check('all 97 catalog entries remain unavailable without handlers', len(catalog['operations']) == 97 and
      all(o['handler'] is None and o['availability'] == 'unimplemented' and o['qualification'] == 'pending' for o in catalog['operations']))
manifest_path = 'docs/qualification/candidates/action-followthrough-20261013/workflow-author/manifest.json'
manifest_bytes = blob(AUTHOR, manifest_path)
manifest = json.loads(manifest_bytes)
check('author manifest exact source/base pins', manifest['source'] == SOURCE and manifest['base'] == BASE)
for member in manifest['members']:
    data = blob(AUTHOR, member['path'])
    check(f"author member {member['path']}", len(data) == member['bytes'] and sha(data) == member['sha256'])
captures = []
for label, passed, failed in [('initial', 0, 28), ('canonical-fixture', 28, 0), ('configuration-before', 0, 2), ('final', 30, 0)]:
    receipt = json.loads((HERE / f'{label}.json').read_text())
    for stream in receipt['streams']:
        data = (ROOT / stream['path']).read_bytes()
        check(f'{label} stream hash {Path(stream["path"]).name}', len(data) == stream['bytes'] and sha(data) == stream['sha256'])
    stdout = (HERE / f'{label}.stdout.bin').read_text()
    check(f'{label} exact counts', f'pass {passed}\n' in stdout and f'fail {failed}\n' in stdout)
    check(f'{label} no source diff', receipt['sourceDiffBytes'] == 0)
    check(f'{label} recorded physical cleanup', receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and not receipt['ownedGroupKillRequired'])
    absent = False
    try:
        os.killpg(receipt['ownedPidAndPgid'], 0)
    except ProcessLookupError:
        absent = True
    check(f'{label} owned group freshly absent', absent)
    captures.append({'label': label, 'passed': passed, 'failed': failed, 'sourceHead': receipt['sourceHead'],
                     'processGroup': receipt['ownedPidAndPgid'], 'freshlyAbsent': absent})
result = {'decision': 'PASS' if all(c['pass'] for c in checks) else 'FAIL', 'base': BASE, 'source': SOURCE,
          'authorPacket': AUTHOR, 'reviewHead': git('rev-parse', 'HEAD').decode().strip(),
          'originalEntries': len(base), 'sourceIdentities': identities, 'authorManifestMembers': len(manifest['members']),
          'authorManifestSha256': sha(manifest_bytes), 'captures': captures,
          'passed': sum(c['pass'] for c in checks), 'total': len(checks), 'checks': checks,
          'scope': 'LOCAL_SOURCE_ONLY; no SQL engine, network, provider or runtime admission'}
print(json.dumps(result, indent=2))
raise SystemExit(0 if result['decision'] == 'PASS' else 1)
