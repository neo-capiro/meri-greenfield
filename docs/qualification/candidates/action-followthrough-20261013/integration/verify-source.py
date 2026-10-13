"""Exact Git preservation, reviewed-source and packet verification; no services."""
import hashlib
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[5]
base = 'cacbe543941db52cc8dcf085bf96c1919e8c155f'
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
def blob(ref, path):
    return subprocess.check_output(['git', 'show', f'{ref}:{path}'], cwd=root)
def tree(ref):
    result = {}
    for row in subprocess.check_output(['git', 'ls-tree', '-rz', ref], cwd=root).split(b'\0'):
        if row:
            meta, path = row.split(b'\t', 1)
            result[path.decode()] = meta.decode()
    return result
before, after = tree(base), tree(head)
changed = [path for path, value in before.items() if after.get(path) != value]
assert not changed, changed
reviewed = {
    '0715c71025a72312917c7cc0714951be814f7ae3': [
        'apps/control/action-followthrough/index.mjs',
        'apps/control/action-followthrough/selection.mjs'],
    '33a0d21b005d32d9c27de5f3a7939b77588921db': [
        'evals/task-lookup/execution/admission.mjs',
        'evals/task-lookup/execution/execute.mjs'],
    '924979b527b1b8c7f3f7883ceddd2cf78eebd63f': [
        'apps/control/commands/approval-metadata/index.mjs',
        'apps/control/commands/approval-metadata/binding.mjs',
        'apps/control/commands/approval-metadata/owner.mjs',
        'apps/control/commands/approval-metadata/postgres-store.mjs',
        'apps/control/commands/approval-metadata/migrations/0001_approval_metadata.sql'],
}
sources = []
for ref, paths in reviewed.items():
    for path in paths:
        data = blob(head, path)
        assert data == blob(ref, path), path
        sources.append({'path': path, 'reviewedSource': ref, 'sha256': hashlib.sha256(data).hexdigest()})
manifests = []
for component in ['workflow-author', 'workflow-review', 'eval-author', 'eval-review', 'metadata-author', 'metadata-review']:
    path = f'docs/qualification/candidates/action-followthrough-20261013/{component}/manifest.json'
    raw = blob(head, path)
    manifest = json.loads(raw)
    entries = manifest.get('members', manifest.get('entries'))
    assert isinstance(entries, list) and entries, path
    for entry in entries:
        data = blob(head, entry['path'])
        assert len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256'], entry['path']
    manifests.append({'path': path, 'members': len(entries), 'sha256': hashlib.sha256(raw).hexdigest()})
catalog = json.loads(blob(head, 'packages/contracts/retrieval-0.2/catalog.json'))
ledger = json.loads(blob(head, 'docs/coordination/r2/capabilities.json'))
counts = {kind: sum(r['acceptedScope']['disposition'] == kind for r in ledger['records']) for kind in ['selected', 'deferred']}
assert len(catalog['originals']) == len(ledger['records']) == 139
assert counts == {'selected': 96, 'deferred': 43}, counts
assert len(catalog['operations']) == 97
assert all(o['handler'] is None and o['availability'] == 'unimplemented' and o['qualification'] == 'pending' and o['retry']['maxRetries'] == 0 for o in catalog['operations'])
check = subprocess.run(['git', 'diff', '--check', base, head, '--', 'apps', 'packages', 'evals', 'scripts'], cwd=root, capture_output=True, text=True)
assert check.returncode == 0, check.stdout + check.stderr
result = {'base': base, 'sourceHead': head, 'originalEntries': len(before), 'originalEntriesUnchanged': len(before), 'reviewedProductionFiles': sources, 'componentManifests': manifests, 'componentManifestMembers': sum(x['members'] for x in manifests), 'catalog': {'original': 139, **counts, 'unavailable': 97}, 'authoredSourceWhitespaceExitCode': check.returncode, 'runtimeQualified': False}
(Path(__file__).parent / 'source-verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'originalEntriesUnchanged': len(before), 'reviewedProductionFiles': len(sources), 'componentManifestMembers': result['componentManifestMembers'], 'catalog': result['catalog']}))
