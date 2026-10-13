"""Concise exact-source preservation check. Reads Git objects; no services or jobs."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[5]
git = lambda *args: subprocess.check_output(['git', *args], cwd=root)
base = '77cedb126d57a0223d2df42ad2f3fe988eb51759'
head = git('rev-parse', 'HEAD').decode().strip()
def entries(ref):
    return {line.split(b'\t', 1)[1].decode(): line.split(b'\t', 1)[0].decode()
            for line in git('ls-tree', '-r', '-z', ref).split(b'\0') if line}
before, after = entries(base), entries(head)
allowed = {'apps/gateway/dispatch/operation-context.mjs',
           'apps/gateway/dispatch/read-result-envelope.mjs',
           'packages/contracts/retrieval-0.2/catalog-validation.mjs'}
assert before.keys() <= after.keys(), 'Original path removed'
changed = {p for p in before if before[p] != after[p]}
test_helper = 'packages/contracts/test/vertical-source-expectations.mjs'
assert changed == allowed | {test_helper}, changed
old_helper = git('show', f'{base}:{test_helper}')
assert git('show', f'{head}:{test_helper}') == old_helper.replace(
    b'export const verticalDispatchProfiles=Object.freeze([\n',
    b"export const verticalDispatchProfiles=Object.freeze([\n ['actions.query','actions-complete/1'],\n")
groups = {
    '84a9313735ec9fb079e35a92adb074f6afaf32e7': sorted(allowed | {'apps/gateway/dispatch/action-read-context.mjs'}),
    'eaa00fd0ea8ec98bc77b050caaa6526a2738405e': [p for p in after if p.startswith('apps/gateway/sources/action-items/')],
    '6f14d780a40e878fa62bc928c4d520286313f56c': ['apps/control/task-lookup/'+p for p in ['binding.mjs','delivery.mjs','index.mjs','postgres-results.mjs','migrations/0001_task_lookup.sql']],
    'a57f5cf0e2345975ec11a3c2f43157c6e6769a73': ['evals/task-lookup/'+p for p in ['cli.mjs','contracts.mjs','corpus.mjs','score.mjs']],
}
source = []
for ref, paths in groups.items():
    for path in paths:
        actual = git('show', f'{head}:{path}')
        assert actual == git('show', f'{ref}:{path}'), path
        source.append({'path': path, 'reviewedSource': ref, 'sha256': hashlib.sha256(actual).hexdigest()})
catalog = json.loads(git('show', f'{head}:packages/contracts/retrieval-0.2/catalog.json'))
assert len(catalog['originals']) == 139
assert sum(r['disposition'] == 'selected' for r in catalog['originals']) == 96
assert sum(r['disposition'] == 'deferred' for r in catalog['originals']) == 43
assert len(catalog['operations']) == 97
assert all(r['handler'] is None and r['qualification'] == 'pending' and r['availability'] != 'enabled' and r['retry']['maxRetries'] == 0 for r in catalog['operations'])
protected = ['apps/worker', 'apps/proxy', 'packages/runtime', 'apps/control/qualification-sdk-fixture']
assert all(git('rev-parse', f'{base}:{p}') == git('rev-parse', f'{head}:{p}') for p in protected)
requirements_path = 'docs/qualification/candidates/vertical-source-20261012/integration/requirements-continuation.json'
assert git('show', f'{base}:{requirements_path}') == git('show', f'{head}:{requirements_path}')
requirements = json.loads(git('show', f'{head}:{requirements_path}'))
assert requirements['counts'] == {'requirements': 53, 'completedSourceDiscovery': 2, 'wholePending': 51, 'wholeRuntimeQualified': 0}
result = {'sourceHead': head, 'base': base, 'originalEntries': len(before),
          'originalEntriesUnchanged': len(before)-len(changed), 'changedOriginals': sorted(changed),
          'originalTestModulesChanged': 0, 'originalTestHelperChange': {'path': test_helper, 'change': 'One explicit expected actions.query/actions-complete/1 entry; all prior expectations retained.'},
          'reviewedProductionFiles': source, 'protectedTreesUnchanged': protected,
          'nativeProbeTree': git('rev-parse', f'{head}:apps/worker/qualification/probes').decode().strip(),
          'catalog': {'original': 139, 'selected': 96, 'deferred': 43, 'unavailable': 97},
          'wholeRequirements': requirements['counts'], 'runtimeQualified': False}
Path(__file__).with_name('source-verification.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k != 'reviewedProductionFiles'}))
