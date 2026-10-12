"""Reconstruct original gateway file bytes using retained SHA256s, not Git identity."""
import hashlib
import json
from pathlib import Path
import shutil
import sys

root = Path(__file__).resolve().parents[4]
target = Path(sys.argv[1]).resolve()
target.mkdir(exist_ok=False)
manifest = json.loads((root / 'docs/qualification/candidates/gateway-source-disabled-20261012/independent-review-20261012/context-files.json').read_text())
rows = []
for row in manifest['files']:
    if not row['path'].startswith('apps/gateway/'):
        continue
    content = (root / row['path']).read_bytes()
    if row['path'].endswith('/tool-dispatch.mjs'):
        content = content.replace(b'      lifetime.limitDeadline(release.deadlineMs);\n', b'').replace(b'      lifetime.limitDeadline(final.deadlineMs);\n', b'')
    if row['path'].endswith('/gateway.test.mjs'):
        content = content.split(b"test('a deadline shortened during the handler bounds parked settlement and preserves uncertainty'")[0].rstrip() + b'\n'
    digest = hashlib.sha256(content).hexdigest()
    assert digest == row['sha256'], (row['path'], digest, row['sha256'])
    output = target / row['path']
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(content)
    rows.append({'path': row['path'], 'bytes': len(content), 'sha256': digest, 'retainedOriginalHashMatches': True})
(target / 'packages').symlink_to(root / 'packages', target_is_directory=True)
(target / 'node_modules').symlink_to(root / 'node_modules', target_is_directory=True)
control = Path('docs/qualification/candidates/gateway-source-disabled-20261012/independent-review-20261012/release-deadline-control.mjs')
(target / control).parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(root / control, target / control)
receipt = {'classification': 'EXACT_ORIGINAL_GATEWAY_FILE_HASHES_WITH_ACCEPTED13_CURRENT_CONTRACTS',
           'historicalCommitObjectAvailable': False, 'noHistoricalCommitOrTreeIdentityClaim': True,
           'target': str(target), 'borrowedReadOnlyPackages': str(root / 'packages'), 'files': rows}
(Path(__file__).resolve().parent / 'original-reconstruction.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
