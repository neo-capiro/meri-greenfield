"""Check retained author/reviewer bytes after integration, without native calls."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[5]
directory = Path(__file__).resolve().parent.parent
packets = [
    ('action-author/source-manifest.json', 'source'),
    ('action-review/review-manifest.json', 'files'),
    ('mail-author/manifest.json', 'entries'),
    ('mail-review/review-manifest.json', 'files'),
]
results = []
for relative, field in packets:
    path = directory / relative
    manifest = json.loads(path.read_bytes())
    for member in manifest[field]:
        target = (root / member['path']).resolve()
        assert target.is_relative_to(root), member['path']
        data = target.read_bytes()
        assert len(data) == member['bytes'], member['path']
        assert hashlib.sha256(data).hexdigest() == member['sha256'], member['path']
    results.append({'packet': relative, 'members': len(manifest[field]),
                    'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
print(json.dumps({'decision': 'PASS_RETAINED_PACKET_BYTES', 'packets': results,
                  'runtimeAccepted': False}, indent=2))
