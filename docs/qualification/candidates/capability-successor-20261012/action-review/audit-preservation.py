"""Read-only exact-commit and frozen-control audit; no application ports."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[5]
BASE = '5b1b5985bc73cbfe901c17e65acf9fd50b3d7e33'
AUTHOR = '59a2b629cda0d3838ec1b5235d2a8d64aadf3402'
REVIEW = 'docs/qualification/candidates/capability-successor-20261012/action-review/'
EVIDENCE = 'docs/qualification/candidates/capability-successor-20261012/action-author/'
ALLOWED = {
    'apps/gateway/test/memory-context-independent.test.mjs',
    'packages/contracts/retrieval-0.2/catalog-validation.mjs',
    'packages/contracts/retrieval-0.2/catalog.json',
    'packages/contracts/test/retrieval-catalog-bindings.test.mjs',
    'packages/contracts/test/retrieval-mail.test.mjs',
    'packages/contracts/test/retrieval-memory-binding.test.mjs',
    'packages/contracts/test/retrieval-operational-reads.test.mjs',
}


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def blob(ref, path):
    return git('show', f'{ref}:{path}')


def tree(ref):
    records = git('ls-tree', '-rz', ref).split(b'\0')
    return {r.split(b'\t', 1)[1].decode(): r.split(b'\t', 1)[0]
            for r in records if r}


checks = []


def check(label, condition):
    assert condition, label
    checks.append(label)


before, after = tree(BASE), tree(AUTHOR)
changed = {p for p in before if after.get(p) != before[p]}
check('exact author tree', git('rev-parse', AUTHOR + '^{tree}').strip().decode()
      == '2f58dc3a7fda1dee62820a71f13030638ede24fa')
check('only seven allocated original files changed', changed == ALLOWED)
check('original file count and unchanged count', len(before) == 4893 and len(before) - len(changed) == 4886)
for path in sorted(changed):
    check('original snapshot: ' + path, blob(AUTHOR, EVIDENCE + 'original/' + path) == blob(BASE, path))

manifest = json.loads(blob(AUTHOR, EVIDENCE + 'source-manifest.json'))
for record in manifest['source']:
    data = blob(AUTHOR, record['path'])
    check('author source manifest: ' + record['path'], len(data) == record['bytes']
          and hashlib.sha256(data).hexdigest() == record['sha256'])
    check('review tree source equals author: ' + record['path'], (ROOT / record['path']).read_bytes() == data)

controls = json.loads((ROOT / REVIEW / 'controls-before-freeze.json').read_text())
for record in controls['files']:
    data = (ROOT / record['path']).read_bytes()
    check('frozen independent control unchanged: ' + record['path'], len(data) == record['bytes']
          and hashlib.sha256(data).hexdigest() == record['sha256'])

catalog_path = 'packages/contracts/retrieval-0.2/catalog.json'
old_catalog, catalog = [json.loads(blob(ref, catalog_path)) for ref in (BASE, AUTHOR)]
check('all original rows identical', old_catalog['originals'] == catalog['originals'])
check('all original descriptors identical', old_catalog['operations'] == catalog['operations'][:14])
check('139 originals with 96 selected and 43 deferred', len(catalog['originals']) == 139
      and sum(x['disposition'] == 'selected' for x in catalog['originals']) == 96
      and sum(x['disposition'] == 'deferred' for x in catalog['originals']) == 43)
check('15 typed operations, 14 mapped and 82 selected unmapped', len(catalog['operations']) == 15
      and sum(x['state'] == 'mapped' for x in catalog['originals']) == 14
      and sum(x['disposition'] == 'selected' and x['replacement'] is None for x in catalog['originals']) == 82)
action = next(x for x in catalog['originals'] if x['id'] == 'query_action_items')
check('native action row remains pending/null', action['state'] == 'pending' and action['replacement'] is None)
check('all descriptors remain pending and unavailable', all(x['handler'] is None
      and x['availability'] == 'unimplemented' and x['qualification'] == 'pending'
      and x['retry']['maxRetries'] == 0 for x in catalog['operations']))
for label in ('baseline', 'exact-freeze'):
    receipt = json.loads((ROOT / REVIEW / f'{label}.json').read_text())
    for name, value in receipt['streams'].items():
        data = (ROOT / REVIEW / value['path']).read_bytes()
        check(f'{label} raw {name} unchanged', len(data) == value['bytes']
              and hashlib.sha256(data).hexdigest() == value['sha256'])
    check(label + ' owned process group absent', receipt['ownedProcessGroupAbsent'] and not receipt['externalTimeout'])
check('source whitespace passes', subprocess.run(['git', 'diff', '--check', BASE, AUTHOR], cwd=ROOT).returncode == 0)
print(json.dumps({'base': BASE, 'author': AUTHOR, 'checksPassed': len(checks), 'checks': checks,
                  'originalFiles': len(before), 'unchangedOriginalFiles': len(before) - len(changed),
                  'changedOriginalPaths': sorted(changed), 'nativeOrNetworkActions': False}, indent=2))
