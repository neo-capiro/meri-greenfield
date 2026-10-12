"""Bind independently reviewed metadata packets; no source or runtime execution."""
from pathlib import Path
import hashlib
import json
import subprocess

root = Path(__file__).resolve().parents[5]
packet = Path(__file__).resolve().parent
base = 'f7db1ae9557d14f227a32dcc891ce5cbaecc7ff4'
checks = 0

def require(value, label):
    global checks
    if not value:
        raise AssertionError(label)
    checks += 1

def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)

def tree(ref):
    result = {}
    for row in git('ls-tree', '-rz', ref).split(b'\0'):
        if not row:
            continue
        identity, path = row.split(b'\t', 1)
        result[path.decode()] = identity
    return result

head = git('rev-parse', 'HEAD').decode().strip()
old, current = tree(base), tree(head)
for path, identity in old.items():
    require(current.get(path) == identity, 'Original entry preserved: ' + path)
added = sorted(set(current) - set(old))
for path in added:
    require(path.startswith('docs/'), 'Metadata only: ' + path)

pins = json.loads((packet / 'pins.json').read_text())
results = []
for pin in pins['packets']:
    ref, path = pin['reference'], pin['manifest']
    raw = git('show', ref + ':' + path)
    require((root / path).read_bytes() == raw, 'Exact original manifest: ' + path)
    manifest = json.loads(raw)
    members = manifest.get('members', manifest.get('entries', manifest.get('files')))
    require(isinstance(members, list) and bool(members), 'Nonempty manifest: ' + path)
    require(len({m['path'] for m in members}) == len(members), 'Unique members: ' + path)
    for member in members:
        body = git('show', ref + ':' + member['path'])
        require(hashlib.sha256(body).hexdigest() == member['sha256'], 'Immutable member hash: ' + member['path'])
        if 'bytes' in member:
            require(len(body) == member['bytes'], 'Immutable member bytes: ' + member['path'])
        require((root / member['path']).read_bytes() == body, 'Imported member bytes: ' + member['path'])
    results.append({'reference': ref, 'manifest': path, 'members': len(members), 'sha256': hashlib.sha256(raw).hexdigest()})

result = {'base': base, 'head': head, 'baselineEntriesPreserved': len(old),
          'addedMetadataPaths': len(added), 'passed': checks, 'failed': 0,
          'packets': results, 'runtimeAccepted': False, 'sourceEnabled': False,
          'scope': 'Metadata preservation and correspondence, not runtime qualification'}
(packet / 'audit-result.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
