"""Offline original-tree, exact accepted-source and source-check evidence audit."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys

root = Path(__file__).resolve().parents[5]
packet = Path(__file__).resolve().parent
base = '84c2ca01d0bce025a0003b6e724d675a05f2975a'
production = '863b71de6dc0a965f9961184d65c83f484ce5fb0'
source, review = sys.argv[1:3]

def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)

def tree(ref):
    return {path.decode(): meta.decode() for item in git('ls-tree', '-rz', ref).split(b'\0') if item
            for meta, path in [item.split(b'\t', 1)]}

checks = []
def check(name, ok):
    checks.append({'name': name, 'pass': bool(ok)})
    if not ok:
        raise AssertionError(name)

original, current, accepted, reviewed = map(tree, [base, 'HEAD', source, review])
allowed = {
    'apps/gateway/index.mjs',
    'apps/gateway/budget/tool-budget-binding.mjs',
    'apps/gateway/local-action/control-authorizer.mjs',
}
changed = {path for path, blob in original.items() if current.get(path) != blob}
check('only allocated original source seams changed', changed <= allowed)
check('all original paths preserved', all(path in current for path in original))
check('all original tests contracts registry and failure evidence unchanged',
      all(current.get(path) == blob for path, blob in original.items() if path not in allowed))
catalog = json.loads((root / 'packages/contracts/retrieval-0.2/catalog.json').read_text())
scope = {'originals': len(catalog['originals']),
         'selected': sum(item['disposition'] == 'selected' for item in catalog['originals']),
         'deferred': sum(item['disposition'] == 'deferred' for item in catalog['originals']),
         'mapped': sum(item['state'] == 'mapped' for item in catalog['originals']),
         'operations': len(catalog['operations'])}
check('full original capability denominator preserved', scope == {
    'originals': 139, 'selected': 96, 'deferred': 43, 'mapped': 96, 'operations': 97})
check('all production operation descriptors remain unavailable', all(
    item['handler'] is None and item['availability'] == 'unimplemented'
    and item['qualification'] == 'pending' and item['retry']['maxRetries'] == 0
    for item in catalog['operations']))
author_source = [path for path in accepted if path.startswith(('apps/', 'packages/'))
                 and accepted[path] != original.get(path)
                 and not path.startswith('apps/control/admitted-runs/independent/')]
for path in author_source:
    check('accepted source ' + path, current.get(path) == accepted[path])
production_tree = tree(production)
production_files = [path for path in author_source if path.endswith('.mjs') and '/test/' not in path]
check('seven reviewed production files', len(production_files) == 7)
for path in production_files:
    check('reviewed production freeze ' + path, current.get(path) == production_tree[path])
review_source = [path for path in reviewed if path.startswith('apps/control/admitted-runs/independent/')]
for path in review_source:
    check('independent control ' + path, current.get(path) == reviewed[path])

manifests = {}
for lane in ['author', 'review']:
    manifest = packet.parent / lane / 'manifest.json'
    value = json.loads(manifest.read_text())
    members = value['members']
    manifests[lane] = len(members)
    for member in members:
        raw = (root / member['path']).read_bytes()
        check('retained ' + member['path'], len(raw) == member['bytes']
              and hashlib.sha256(raw).hexdigest() == member['sha256'])

receipts = []
for label in ['integrated-check', 'mounted-http']:
    value = json.loads((packet / (label + '.json')).read_text())
    check('passing bounded check ' + label, value['exitCode'] == 0 and not value['timedOut']
          and value['sourceDiffBytes'] == 0 and value['ownedProcessGroupAbsent']
          and not value['ownedGroupKillRequired'])
    for member in value['streams']:
        raw = (root / member['path']).read_bytes()
        check('exact output ' + member['path'], len(raw) == member['bytes']
              and hashlib.sha256(raw).hexdigest() == member['sha256'])
    try:
        os.killpg(value['ownedPidAndPgid'], 0)
        absent = False
    except ProcessLookupError:
        absent = True
    check('freshly absent owned process group ' + label, absent)
    receipts.append({'label': label, 'testedHead': value['sourceHead'],
                     'ownedPidAndPgid': value['ownedPidAndPgid']})

result = {'base': base, 'authorIntegrationCommit': source, 'productionFreeze': production, 'independentReview': review,
          'originalEntries': len(original), 'originalEntriesUnchanged': len(original)-len(changed),
          'allocatedOriginalChanges': sorted(changed), 'acceptedFiles': len(author_source),
          'independentFiles': len(review_source), 'laneManifestMembers': manifests,
          'capabilityScope': scope,
          'receipts': receipts, 'passed': len(checks), 'failed': 0, 'checks': checks}
(packet / 'audit.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: value for key, value in result.items() if key != 'checks'}))
