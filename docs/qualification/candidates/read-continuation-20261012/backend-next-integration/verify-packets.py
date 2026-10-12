"""Verify accepted packet membership against immutable Git and imported bytes."""
from pathlib import Path
import hashlib
import json
import subprocess

root = Path(__file__).resolve().parents[5]
packet = Path(__file__).resolve().parent
pins = json.loads((packet / 'packet-pins.json').read_text())
checks = 0
results = []
provenance = {}

def require(value, message):
    global checks
    if not value:
        raise AssertionError(message)
    checks += 1

def blob(ref, path):
    return subprocess.check_output(['git', 'show', ref + ':' + path], cwd=root)

for pin in pins['packets']:
    ref, path = pin['reference'], pin['manifest']
    raw = blob(ref, path)
    require((root / path).read_bytes() == raw, 'Exact imported manifest ' + path)
    document = json.loads(raw)
    members = document.get('entries', document.get('members', document.get('files')))
    require(isinstance(members, list) and bool(members), 'Nonempty manifest ' + path)
    require(len({m['path'] for m in members}) == len(members), 'Unique manifest members ' + path)
    for entry in members:
        data = blob(ref, entry['path'])
        require(hashlib.sha256(data).hexdigest() == entry['sha256'], 'Immutable manifest hash ' + entry['path'])
        if 'bytes' in entry:
            require(len(data) == entry['bytes'], 'Immutable byte count ' + entry['path'])
        require((root / entry['path']).read_bytes() == data, 'Exact imported packet member ' + entry['path'])
        if entry['path'].startswith(('packages/', 'apps/', 'scripts/')):
            provenance[entry['path']] = {'path': entry['path'], 'reference': ref}
    results.append({'reference': ref, 'manifest': path, 'members': len(members), 'sha256': hashlib.sha256(raw).hexdigest()})
for entry in pins.get('additionalCode', []):
    require((root / entry['path']).read_bytes() == blob(entry['reference'], entry['path']), 'Exact additional reviewed code ' + entry['path'])
    provenance[entry['path']] = entry
(packet / 'source-provenance.json').write_text(json.dumps({'files': [provenance[k] for k in sorted(provenance)]}, indent=2) + '\n')
result = {'passed': checks, 'failed': 0, 'packets': results, 'boundCodeFiles': len(provenance), 'runtimeAccepted': False}
(packet / 'packet-integrity.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
