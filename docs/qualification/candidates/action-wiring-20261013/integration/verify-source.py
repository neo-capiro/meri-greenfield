"""Audit exact reviewed source, immutable originals and evidence; no services."""
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[5]
base = 'a385fed03b6700bbccb158643793d0be29ccc5ed'
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
packet = Path(__file__).parent
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
assert all(after.get(path) == value for path, value in before.items())
sources = []
for ref, paths in {
    '7cea5042a57f3fa9202d87b0c3ba433d7c77a9dd': [
        'apps/control/action-application/index.mjs',
        'apps/control/action-application/session.mjs',
        'apps/control/action-application/http.mjs'],
    '5fed7fcf558fa74f3b368fb81f3245847a552ee5': [
        'apps/control/action-application/local/demo.mjs',
        'apps/control/action-application/local/flow.mjs',
        'scripts/local-followthrough/run.mjs'],
    '2c8b793569c9a4b19db5a939909fbefdb8ac3ca8': [
        'apps/control/action-application/node-http.mjs',
        'scripts/local-followthrough/http-run.mjs'],
}.items():
    for path in paths:
        data = blob(head, path)
        assert data == blob(ref, path), path
        sources.append({'path': path, 'acceptedSource': ref, 'sha256': hashlib.sha256(data).hexdigest()})
manifests = []
for name in ['application-author', 'application-review', 'local-author', 'local-review', 'eval-proposal', 'http-author', 'http-review']:
    path = f'docs/qualification/candidates/action-wiring-20261013/{name}/manifest.json'
    raw = blob(head, path)
    manifest = json.loads(raw)
    members = manifest.get('members', manifest.get('entries'))
    assert members
    for member in members:
        data = blob(head, member['path'])
        assert len(data) == member['bytes'] and hashlib.sha256(data).hexdigest() == member['sha256'], member['path']
    manifests.append({'path': path, 'members': len(members), 'sha256': hashlib.sha256(raw).hexdigest()})
catalog = json.loads(blob(head, 'packages/contracts/retrieval-0.2/catalog.json'))
ledger = json.loads(blob(head, 'docs/coordination/r2/capabilities.json'))
counts = {kind: sum(row['acceptedScope']['disposition'] == kind for row in ledger['records']) for kind in ['selected', 'deferred']}
assert len(catalog['originals']) == len(ledger['records']) == 139 and counts == {'selected': 96, 'deferred': 43}
assert len(catalog['operations']) == 97
assert all(op['handler'] is None and op['availability'] == 'unimplemented' and op['qualification'] == 'pending' and op['retry']['maxRetries'] == 0 for op in catalog['operations'])
proposal = json.loads(blob(head, 'docs/qualification/candidates/action-wiring-20261013/eval-proposal/pilot-proposal.json'))
cost = Decimal(18) * (Decimal(8000) * Decimal('3.30') + Decimal(256) * Decimal('16.50')) / Decimal(1000000)
assert cost == Decimal(proposal['costing']['theoreticalMaximumUsd']) == Decimal('0.551232')
assert proposal['executedProviderCalls'] == 0 and proposal['spendAuthorized'] is False
check = subprocess.run(['git', 'diff', '--check', base, head, '--', 'apps', 'packages', 'scripts'], cwd=root, capture_output=True, text=True)
assert check.returncode == 0, check.stdout + check.stderr
receipt = {'base': base, 'sourceHead': head, 'originalEntriesUnchanged': len(before), 'reviewedRunnableFiles': sources,
           'componentManifests': manifests, 'componentManifestMembers': sum(x['members'] for x in manifests),
           'catalog': {'original': 139, **counts, 'unavailable': 97}, 'authoredWhitespaceExitCode': check.returncode,
           'pilotArithmeticVerified': str(cost), 'paidCalls': 0, 'runtimeQualifiedByThisPacket': False}
(packet / 'source-verification.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'originalEntriesUnchanged': len(before), 'reviewedRunnableFiles': len(sources), 'manifestMembers': receipt['componentManifestMembers'], 'catalog': receipt['catalog']}))
