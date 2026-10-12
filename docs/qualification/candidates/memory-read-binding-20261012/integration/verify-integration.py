"""Verify reviewed source bytes, preserved base files and local check receipts."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__, epilog='Exit 0: verified receipt written. Exit 1: mismatch. Exit 2: invalid arguments.')
parser.parse_args()
root = Path(__file__).resolve().parents[5]
evidence = Path(__file__).resolve().parent
base = '7ba0e9d10ebf684e162dcc7c143915afdbf00f32'
tested = 'd0f4ca2ca0bbeda0b336130cfd4fb36f4ab60d59'
binding = 'a210db8445537ccfad301d1266e9c53ea71201ac'
policy = '81be4ebf1a7483e80ae96fe787404c770958622e'


def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)


def sha(data):
    return hashlib.sha256(data).hexdigest()


source_paths = git('diff', '--name-only', base, 'HEAD', '--', 'packages', 'apps', 'scripts',
                   'package.json', 'package-lock.json', 'docs/coordination/r2').decode().splitlines()
assert len(source_paths) == 10
reviewed = []
for path in source_paths:
    author = policy if 'memory-review-policy' in path else binding
    actual = (root / path).read_bytes()
    assert actual == git('show', f'{author}:{path}'), f'Reviewed source changed: {path}'
    assert actual == git('show', f'{tested}:{path}'), f'Tested source changed: {path}'
    reviewed.append({'path': path, 'authorCommit': author, 'sha256': sha(actual), 'bytes': len(actual)})
allowed = set(source_paths) | {'docs/CAPABILITY-CATALOG.md', 'docs/qualification/G1-REMAINING-WORK.md'}
preserved = []
base_paths = git('ls-tree', '-r', '--name-only', base).decode().splitlines()
for path in base_paths:
    if path not in allowed:
        actual = (root / path).read_bytes()
        assert actual == git('show', f'{base}:{path}'), f'Original file changed: {path}'
        preserved.append({'path': path, 'sha256': sha(actual)})
subprocess.run(['git', 'merge-base', '--is-ancestor', base, 'HEAD'], cwd=root, check=True)
assert not git('diff', tested, '--', 'packages', 'apps', 'scripts', 'package.json', 'package-lock.json')

checks = []
for label in ['combined-root', 'combined-gateway', 'combined-independent', 'combined-public', 'original-release-control']:
    path = evidence / f'{label}.json'
    receipt = json.loads(path.read_text())
    assert receipt['sourceHead'] == tested and receipt['sourceDiffBytes'] == 0
    assert receipt['exitCode'] == 0 and not receipt['timedOut']
    assert receipt['ownedProcessGroupAbsent'] and not receipt['ownedGroupKillRequired']
    for stream in receipt['streams']:
        data = (root / stream['path']).read_bytes()
        assert len(data) == stream['bytes'] and sha(data) == stream['sha256']
    checks.append({'receipt': str(path.relative_to(root)), 'sha256': sha(path.read_bytes()),
                   'ownedPidAndPgid': receipt['ownedPidAndPgid'], 'ownedGroupAbsent': True})

catalog = json.loads((root / 'packages/contracts/retrieval-0.2/catalog.json').read_bytes())
originals = {row['id']: row for row in catalog['originals']}
seen = set()
for line in (root / 'docs/CAPABILITY-CATALOG.md').read_text().splitlines():
    if not line.startswith('| '):
        continue
    cells = [cell.strip() for cell in line.split('|')]
    if cells[1] not in originals:
        continue
    row = originals[cells[1]]
    assert cells[2] == row['disposition']
    replacement = row['replacement']
    expected = f"`{replacement['id']}@{replacement['version']}` / none" if replacement else (
        'deferred / none' if row['disposition'] == 'deferred' else 'pending / none')
    assert cells[3] == expected
    seen.add(cells[1])
assert len(seen) == 139
accounting = json.loads((evidence / 'capability-accounting.json').read_text())
assert accounting['canonicalCatalog']['sha256'] == sha((root / accounting['canonicalCatalog']['path']).read_bytes())
result = {
    'decision': 'ACCEPT_SOURCE_ONLY', 'testedSource': tested,
    'testedTree': git('rev-parse', f'{tested}^{{tree}}').decode().strip(),
    'preservedBase': base, 'baseTrackedFiles': len(base_paths),
    'unchangedBaseFiles': len(preserved),
    'unchangedManifestSha256': sha(json.dumps(preserved, sort_keys=True).encode()),
    'reviewedSource': reviewed, 'checks': checks,
    'capabilityDocumentationMatches139Rows': True, 'accounting': accounting['counts'],
    'runtimeAcceptance': False, 'allOperationsUnavailable': True,
}
(evidence / 'verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: value for key, value in result.items() if key not in ['reviewedSource', 'checks']}))
