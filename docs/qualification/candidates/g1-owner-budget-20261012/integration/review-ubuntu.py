"""Independent frozen-data cross-check; no author code import or network."""
import collections
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from urllib.parse import unquote

root = Path(sys.argv[1]).resolve()
packet = root / 'docs/qualification/candidates/ubuntu-source-assessment-20261012/author'
freeze = '7f6154e8a2f518a7860bc2421dd6853ff358e156'
base = '1e6d430cf9c239caca4198aea42a762f13021cd5'
read = lambda path: json.loads(path.read_bytes())
git = lambda *args: subprocess.check_output(['git', '-C', str(root), *args])
assert git('rev-parse', 'HEAD').decode().strip() == freeze
assert not git('status', '--porcelain')
changes = git('diff', '--name-status', base, freeze).decode().splitlines()
assert all(line.startswith('A\tdocs/') for line in changes), changes
matrix = read(packet / 'obligations-54.json')
original = read(root / 'docs/qualification/candidates/image-patch-20261012/upstream/upstream-matrix.json')
identity = lambda rows: sorted((r['cve'], r['cohort'], r['scannerSeverity']) for r in rows)
assert identity(matrix['rows']) == identity(original['rows'])
assert len(matrix['rows']) == 54
assert all(r['acceptedImageDisposition'] == r['candidateDisposition'] == 'OPEN' for r in matrix['rows'])
packages = read(packet / 'package-function-assessment.json')
observed = [r['latestObservedMetadata'] for r in packages['directMappings']] + packages['supportingPackages']
matches = []
for row in matrix['rows']:
    if row['ubuntuVendorStatus'] not in ('fixed', 'not_affected'):
        continue
    provider = row['ubuntuSourceProvider']
    versions = {r['Version'] for r in observed if r.get('Source', r['Package']).split(' ', 1)[0] == provider}
    purls = [u for statement in row['matchedStatements'] for u in statement['sourcePurls']]
    assert purls
    for purl in purls:
        assert purl.startswith('pkg:deb/ubuntu/' + provider + '@')
        version, qualifiers = purl.split('@', 1)[1].split('?', 1)
        assert unquote(version) in versions
        assert set(qualifiers.split('&')) == {'arch=source', 'distro=resolute'}
    matches.append({'cve': row['cve'], 'provider': provider, 'status': row['ubuntuVendorStatus'], 'purls': purls})
assert len(matches) == 22
assert len(packages['directMappings']) == 35 and len(packages['indices']) == 6
assert packages['dependencySolver'] == 'UNRUN' and packages['payloadDownloadCount'] == 0
assert all(p['immutableSelectedVersion'] is None for p in packages['directMappings'])
prerequisites = read(packet / 'source-prerequisites.json')
assert not prerequisites['immutableSourceCandidateCreated'] and not prerequisites['recipeChanged']
assert not any(step['complete'] for step in prerequisites['steps'])
print(json.dumps({'verdict': 'ACCEPT_SOURCE_EVIDENCE_ONLY', 'authorFreeze': freeze,
    'originalFilesUnchanged': True, 'retainedObligations': 54, 'imageDispositionsOpen': 54,
    'vendorCounts': dict(collections.Counter(r['ubuntuVendorStatus'] for r in matrix['rows'])),
    'exactVersionMatches': matches, 'directFunctions': 35, 'indices': 6,
    'matrixSha256': hashlib.sha256((packet/'obligations-54.json').read_bytes()).hexdigest(),
    'immutableRecipe': 'HOLD_NOT_DEMONSTRABLE', 'runtime': 'UNRUN'}, indent=2))
