"""Read-only Git byte preservation check for the exact author freeze."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[5]
base = '5db2714b6dcbd3109c528e0afafcb654216133ca'
head = sys.argv[1]
run = lambda *args: subprocess.check_output(['git', *args], cwd=root)
allowed = {'apps/gateway/dispatch/tool-dispatch.mjs', 'packages/contracts/retrieval-0.2/catalog-validation.mjs'}
paths = run('ls-tree', '-r', '--name-only', base).decode().splitlines()
changes = []
for path in paths:
    old, new = run('show', f'{base}:{path}'), run('show', f'{head}:{path}')
    if old != new:
        changes.append({'path': path, 'baseSha256': hashlib.sha256(old).hexdigest(), 'candidateSha256': hashlib.sha256(new).hexdigest()})
assert {row['path'] for row in changes} == allowed, changes
metadata = changes[1] if changes[1]['path'].startswith('packages') else changes[0]
path = metadata['path']
old, new = run('show', f'{base}:{path}'), run('show', f'{head}:{path}')
assert new.replace(b"    dispatchProfile: 'memory-proposals/1',\n", b'') == old
receipt = {'base': base, 'candidate': head, 'originalTrackedFiles': len(paths),
           'unchangedOriginalFiles': len(paths)-len(changes), 'changedOriginalFiles': changes,
           'canonicalBindingDelta': 'memory-only dispatchProfile metadata; all other original registry bytes unchanged',
           'unchangedOriginalContracts': len([p for p in paths if p.startswith('packages/contracts/')])-1,
           'unchangedOriginalGatewayTests': [p for p in paths if p.startswith('apps/gateway/test/')],
           'newPaths': run('diff', '--name-only', '--diff-filter=A', base, head).decode().splitlines()}
output = Path(__file__).resolve().parent / 'source-preservation.json'
output.write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps({key:value for key,value in receipt.items() if key not in ['newPaths','changedOriginalFiles']}))
