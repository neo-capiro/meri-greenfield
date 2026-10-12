#!/usr/bin/env python3
"""Read-only Git/JSON scope audit. No product/private code is imported or run."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--capiro-repo', required=True, type=Path)
args = parser.parse_args()
packet = Path(__file__).resolve().parent
def git(repo, *argv):
    return subprocess.check_output(['git', '-C', str(repo), *argv], stderr=subprocess.PIPE)
root = Path(git(packet, 'rev-parse', '--show-toplevel').decode().strip())
def load(path):
    return json.loads(path.read_text())
def digest(data):
    return hashlib.sha256(data).hexdigest()
checks = []
def check(name, result):
    checks.append({'name': name, 'passed': bool(result)})

refs = load(packet / 'source-reference-identities.json')
check('twenty paired references', len(refs) == 20)
for row in refs:
    for side in ('frozen', 'observed'):
        item = row[side]
        data = git(args.capiro_repo, 'show', item['ref'] + ':' + row['path'])
        check(row['path'] + ':' + side + ':blob', git(args.capiro_repo, 'rev-parse', item['ref'] + ':' + row['path']).decode().strip() == item['blob'])
        check(row['path'] + ':' + side + ':bytes', len(data) == item['bytes'])
        check(row['path'] + ':' + side + ':hash', digest(data) == item['sha256'])
    check(row['path'] + ':no drift', row['frozen']['blob'] == row['observed']['blob'] and row['changed'] is False)
for item in load(packet / 'authority-and-reuse-identities.json'):
    data = git(root, 'show', item['ref'] + ':' + item['path'])
    check(item['path'] + ':authority blob', git(root, 'rev-parse', item['ref'] + ':' + item['path']).decode().strip() == item['blob'])
    check(item['path'] + ':authority bytes/hash', len(data) == item['bytes'] and digest(data) == item['sha256'])

base = '1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8'
base_catalog = git(root, 'show', base + ':packages/contracts/retrieval-0.2/catalog.json')
current_catalog = root / 'packages/contracts/retrieval-0.2/catalog.json'
check('catalog bytes unchanged', current_catalog.read_bytes() == base_catalog)
row = next(item for item in json.loads(base_catalog)['originals'] if item['id'] == 'get_research_evidence')
check('selected original remains pending/null', row['disposition'] == 'selected' and row['state'] == 'pending' and row['replacement'] is None)
check('Portfolio boundary remains recorded', 'Research Portfolio' in row['boundary'])
proposal = load(packet / 'api-proposal.json')
check('proposal not implemented', proposal['status'] == 'PROPOSAL_ONLY_REQUIRES_ROOT_INTERFACE_REVIEW')
check('no source/runtime activation', proposal['sourceConnected'] is False and proposal['runtimeQualified'] is False)
check('binding/subject only', proposal['contextKeys'] == ['binding', 'subject'])
check('named view proposals', [x['origin'] for x in proposal['variants']] == ['review', 'snapshot', 'current_continuity'])
continuity = proposal['variants'][2]
check('no arbitrary annual read selectors', {'recordId','decisionIds','knownAt','asOfFiscalYear','historical','cursor','limit'} == set(continuity['forbiddenSelectors']))
check('raw/history gaps explicit', len(proposal['remainingOwnerFacts']) == 3)
check('census not exposure authority', 'not a source exposure allowlist' in load(packet / 'storage-field-census.json')['scope'])

manifest = load(packet / 'manifest.json')
check('unique packet paths', len(manifest['members']) == len({x['path'] for x in manifest['members']}))
for item in manifest['members']:
    path = Path(item['path'])
    check(str(path) + ':relative', not path.is_absolute() and '..' not in path.parts)
    data = (root / path).read_bytes()
    check(str(path) + ':packet bytes/hash', len(data) == item['bytes'] and digest(data) == item['sha256'])
failures = [x for x in checks if not x['passed']]
print(json.dumps({'checks': len(checks), 'passed': len(checks)-len(failures), 'failed': len(failures), 'failures': failures, 'manifestSha256': digest((packet/'manifest.json').read_bytes()), 'productionCodeExecuted': False, 'runtimeQualified': False}, indent=2))
raise SystemExit(bool(failures))
