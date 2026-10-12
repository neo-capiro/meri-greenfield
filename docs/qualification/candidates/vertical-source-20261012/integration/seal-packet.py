"""Seal tracked continuation bytes after review; no runtime or publication action."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
BASE = 'e5fb3963de787bbd7b7663316c368f15814897da'
full_test_freeze, independent_review = sys.argv[1:]

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

head = git('rev-parse', 'HEAD').decode().strip()
assert not git('diff', 'HEAD', '--'), 'Commit reviewed bytes before sealing'
prefix = OUT.relative_to(ROOT).as_posix()
excluded = [f'{prefix}/{name}' for name in [
    'packet-manifest.json', 'packet-verification.json', 'sealed-publication-receipt.json']]
paths = sorted(p for p in git('diff', '--name-only', BASE, head).decode().splitlines()
               if p not in excluded)
files = []
for path in paths:
    data = git('show', f'{head}:{path}')
    files.append({'path': path, 'gitBlob': git('rev-parse', f'{head}:{path}').decode().strip(),
                  'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
manifest = {'schema': 'meri.vertical-source-publication-manifest/1',
            'recordedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'base': BASE, 'snapshotCommit': head,
            'canonicalProductionFreeze': 'c80260046e33d742811fca6f553af4033eb393bc',
            'fullTestFreeze': full_test_freeze, 'independentReview': independent_review,
            'scope': 'Every changed/new tracked file relative to PR37; exact original preservation is separately audited. Source-only; production disabled and runtime unqualified.',
            'excludedSealFiles': excluded, 'files': files}
data = (json.dumps(manifest, indent=2) + '\n').encode()
(OUT / 'packet-manifest.json').write_bytes(data)
checks = []
for row in files:
    current = git('show', f'{head}:{row["path"]}')
    checks.append(len(current) == row['bytes'] and hashlib.sha256(current).hexdigest() == row['sha256'])
assert all(checks)
verification = {'snapshotCommit': head, 'members': len(files),
                'passed': sum(checks), 'failed': len(checks)-sum(checks),
                'manifestSha256': hashlib.sha256(data).hexdigest(),
                'sourceEnabled': False, 'runtimeAccepted': False}
(OUT / 'packet-verification.json').write_text(json.dumps(verification, indent=2) + '\n')
print(json.dumps(verification))
