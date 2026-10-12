"""Pinned Git/data inspection only; no service or native qualification operations."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[5]
BASE = 'e0163fb65a639a28d9423e929058b40b48cc556d'
ORIGINAL = '56a917f59e849630f50933e31703a2c7c262be1d'
REPAIR = 'deba2c13c612845b4f65e38c263982c698bb4361'
REVIEWED = '8f44407cbd2f4529e89ebff8547efadb58847c2a'
P = 'docs/qualification/candidates/capability-next-20261012/registry-review/'
checks = []
def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)
def blob(commit, path):
    return git('show', commit + ':' + path)
def sha(data):
    return hashlib.sha256(data).hexdigest()
def check(name, condition):
    checks.append({'name': name, 'pass': bool(condition)})
paths = ['packages/contracts/retrieval-0.2/client-registry-validation.mjs',
         'packages/contracts/retrieval-0.2/client-registry.schema.json',
         'packages/contracts/retrieval-0.2/validate.mjs',
         'packages/contracts/test/retrieval-client-registry.test.mjs']
expected = set(paths)
changed = set(git('diff', '--name-only', BASE, REVIEWED, '--', 'apps', 'packages', 'scripts', 'infra').decode().splitlines())
check('only-allocated-family-loader-author-test-changes', changed == expected)
check('schema-unmodified-by-repair', blob(REVIEWED, paths[1]) == blob(ORIGINAL, paths[1]))
check('loader-unmodified-by-repair', blob(REVIEWED, paths[2]) == blob(ORIGINAL, paths[2]))
for path in [paths[0], paths[3]]:
    check('reviewed-repair-exact-author-bytes:' + path, blob(REVIEWED, path) == blob(REPAIR, path))
source = []
for path in paths:
    data = blob(REVIEWED, path)
    check('review-worktree-exact-reviewed-bytes:' + path, (ROOT / path).read_bytes() == data)
    source.append({'path': path, 'bytes': len(data), 'sha256': sha(data), 'blob': git('rev-parse', REVIEWED + ':' + path).decode().strip()})
protected = ['apps', 'scripts', 'infra', 'package.json', 'package-lock.json',
    'packages/contracts/package.json', 'packages/contracts/package-lock.json', 'packages/contracts/dist',
    'packages/contracts/meri.schema.json', 'packages/contracts/validate.mjs',
    'packages/contracts/retrieval-0.2/catalog.json', 'packages/contracts/retrieval-0.2/catalog-validation.mjs',
    'packages/contracts/retrieval-0.2/operation-contracts.mjs',
    'docs/CAPABILITIES.json', 'docs/CAPABILITY-SCOPE.md', 'docs/coordination/r2', 'docs/plans']
check('public-runtime-catalog-registry-resolver-lock-plan-ledger-preserved', git('diff', '--name-only', BASE, REVIEWED, '--', *protected) == b'')
prior_schemas = git('ls-tree', '-r', '--name-only', BASE, 'packages/contracts/retrieval-0.2').decode().splitlines()
for path in prior_schemas:
    if path.endswith('.schema.json'):
        check('prior-schema-unchanged:' + path, blob(BASE, path) == blob(REVIEWED, path))
catpath = 'packages/contracts/retrieval-0.2/catalog.json'
catalog = json.loads(blob(REVIEWED, catpath))
check('all-original139-rows-preserved', catalog['originals'] == json.loads(blob(BASE, catpath))['originals'] and len(catalog['originals']) == 139)
check('prior15-descriptors-preserved', catalog['operations'] == json.loads(blob(BASE, catpath))['operations'] and len(catalog['operations']) == 15)
check('dispositions96-selected43-deferred', sum(r['disposition'] == 'selected' for r in catalog['originals']) == 96 and sum(r['disposition'] == 'deferred' for r in catalog['originals']) == 43)
check('registry-not-yet-catalog-bound-at-reviewed-freeze', all(r['operation']['id'] != 'lookup_client_registry' for r in catalog['operations']))
native = next(r for r in catalog['originals'] if r['id'] == 'lookup_client_registry')
check('registry-native-pending-null-at-reviewed-freeze', native['state'] == 'pending' and native['replacement'] is None)
check('all-prior-operations-unavailable', all(r['availability'] == 'unimplemented' and r['handler'] is None and r['qualification'] == 'pending' for r in catalog['operations']))
check('RC1-branch-preserved', git('rev-parse', 'release/meri-rc1-20261012').decode().strip() == '2f06feccca731d6cd388612cd568185ecc29668f')
check('RC1-tag-preserved', git('rev-parse', 'meri-rc1-20261012^{}').decode().strip() == '2f06feccca731d6cd388612cd568185ecc29668f')
check('main-ref-preserved', git('rev-parse', 'origin/main').decode().strip() == '8b123bea4c90794dc2d766814b6ddbdbfe0928bc')
receipts = []
for name, code in [('first-independent', 1), ('repaired-unchanged-controls', 0), ('reference-audit', 1),
                   ('reference-audit-corrected', 1), ('reference-audit-final', 0), ('final-family', 0)]:
    path = ROOT / (P + name + '.json')
    raw = path.read_bytes(); r = json.loads(raw)
    check('preserved-receipt-outcome:' + name, r['exitCode'] == code and r['timedOut'] is False and r['ownedProcessGroupAbsent'] is True)
    for stream in r['streams']:
        data = (ROOT / stream['path']).read_bytes()
        check('exact-raw-stream:' + stream['path'], len(data) == stream['bytes'] and sha(data) == stream['sha256'])
    receipts.append({'path': path.relative_to(ROOT).as_posix(), 'bytes': len(raw), 'sha256': sha(raw), 'exitCode':code})
result = {'sourceFreeze': ORIGINAL, 'requiredAuthorRepair': REPAIR, 'reviewedComposite': REVIEWED,
    'reviewedTree': git('rev-parse', REVIEWED + '^{tree}').decode().strip(), 'source': source,
    'checks': checks, 'passed': sum(c['pass'] for c in checks), 'failed': sum(not c['pass'] for c in checks),
    'receipts': receipts, 'runtimeAccepted': False, 'catalogBindingAccepted': False}
print(json.dumps(result, indent=2))
raise SystemExit(1 if result['failed'] else 0)
