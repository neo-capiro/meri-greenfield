"""Owned local fixture: exact accepted contract files plus exact candidate gateway."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile

root = Path(__file__).resolve().parents[4]
target = Path(sys.argv[1]).resolve()
source_ref = sys.argv[2]
accepted = '5ee46446b5f60034916f00b2a665b3e2bef9cf60'
target.mkdir(exist_ok=False)
rows = []
for ref, path in [(accepted, 'packages/contracts'), (source_ref, 'apps/gateway'),
                  (source_ref, 'docs/qualification/candidates/gateway-source-disabled-20261012/independent-review-20261012/release-deadline-control.mjs')]:
    raw = subprocess.check_output(['git', 'archive', '--format=tar', ref, path], cwd=root)
    with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
        for member in archive:
            if member.isdir():
                continue
            assert member.isfile() and not member.name.startswith('/') and '..' not in Path(member.name).parts
            content = archive.extractfile(member).read()
            output = target / member.name
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(content)
            rows.append({'path': member.name, 'ref': ref, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
(target / 'node_modules').symlink_to(root / 'node_modules', target_is_directory=True)
receipt = {'classification': 'SOURCE_ONLY_ACCEPTED13_CONTRACT_COMPOSITION', 'candidate': source_ref,
           'acceptedContractCommit': accepted, 'target': str(target), 'borrowedDependencies': str(root / 'node_modules'), 'files': rows}
(Path(__file__).resolve().parent / 'accepted-composition.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'candidate':source_ref,'accepted':accepted,'files':len(rows),'target':str(target)}))
