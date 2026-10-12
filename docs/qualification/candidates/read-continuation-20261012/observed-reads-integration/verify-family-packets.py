"""Verify immutable family packet bytes from local Git without producer execution."""
from pathlib import Path
import hashlib
import json
import subprocess

root = Path(__file__).resolve().parents[5]
packet = Path(__file__).resolve().parent
prefix = 'docs/qualification/candidates/read-continuation-20261012/'
families = json.loads((packet / 'candidate-freezes.json').read_text())['families']
results = []
checks = []
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)
def check(value, label):
    if not value:
        raise AssertionError(label)
    checks.append(label)
for family in families:
    for role, ref in [('author', family['packet']), ('review', family.get('repairReview', family['review']))]:
        folder = prefix + family['family'] + '-' + role + '/'
        paths = git('ls-tree', '-r', '--name-only', ref, '--', folder).decode().splitlines()
        names = [p for p in paths if Path(p).name.lower() in ['manifest.json', 'packet-manifest.json', 'canonical-followup-manifest.json', 'review-manifest.json']]
        if family['family'] == 'tenant-contacts' and role == 'review':
            names = [p for p in names if p.endswith('/canonical-followup-manifest.json')]
        check(len(names) == 1, 'One immutable manifest ' + family['family'] + ':' + role)
        manifest_path = names[0]
        raw = git('show', ref + ':' + manifest_path)
        manifest = json.loads(raw)
        members = manifest.get('files', manifest.get('members'))
        check(isinstance(members, list) and bool(members), 'Manifest members ' + manifest_path)
        check(len({x['path'] for x in members}) == len(members), 'Unique manifest members ' + manifest_path)
        for entry in members:
            body = git('show', ref + ':' + entry['path'])
            check(len(body) == entry['bytes'] and hashlib.sha256(body).hexdigest() == entry['sha256'],
                  'Exact packet member ' + ref + ':' + entry['path'])
        results.append({'family': family['family'], 'role': role, 'ref': ref, 'manifest': manifest_path,
                        'sha256': hashlib.sha256(raw).hexdigest(), 'verifiedMembers': len(members)})
result = {'passed': len(checks), 'failed': 0, 'packets': results,
          'scope': 'Immutable local Git packet integrity only; no source execution or runtime acceptance.'}
(packet / 'family-packet-integrity.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
