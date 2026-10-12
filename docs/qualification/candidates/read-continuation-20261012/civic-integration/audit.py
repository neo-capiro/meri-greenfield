"""Verify the exact source composition and full inventory using local Git only."""
from pathlib import Path
import hashlib
import json
import subprocess

root = Path(__file__).resolve().parents[5]
packet = Path(__file__).resolve().parent
base = 'c1c9bfde7dd466a0474589a224a99b44277adbc9'
checks = []
def check(condition, label):
    if not condition:
        raise AssertionError(label)
    checks.append(label)
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)
def blob(ref, path):
    return git('show', ref + ':' + path)
def tree(ref):
    rows = {}
    for line in git('ls-tree', '-rz', ref).split(b'\0'):
        if not line:
            continue
        metadata, name = line.split(b'\t', 1)
        rows[name.decode()] = metadata.decode()
    return rows

head = git('rev-parse', 'HEAD').decode().strip()
old_tree, current_tree = tree(base), tree(head)
updates = json.loads((packet / 'test-expectation-updates.json').read_text())
allowed = {row['path'] for row in updates['changes']} | {
    'packages/contracts/retrieval-0.2/catalog.json',
    'packages/contracts/retrieval-0.2/catalog-validation.mjs',
    'packages/contracts/retrieval-0.2/validate.mjs',
}
changed = {path for path, identity in old_tree.items() if current_tree.get(path) != identity}
check(changed == allowed, 'Only three canonical composition files and sixteen explicit original test expectations changed')
check(len(old_tree) == 6528, 'All 6528 PR30 original tracked paths accounted for')
for path, identity in old_tree.items():
    if path not in allowed:
        check(current_tree.get(path) == identity, 'Preserved original ' + path)
for row in updates['changes']:
    check(hashlib.sha256(blob(base, row['path'])).hexdigest() == row['beforeSha256'], 'Original test preimage ' + row['path'])
    check(hashlib.sha256((root / row['path']).read_bytes()).hexdigest() == row['afterSha256'], 'Explicit test patch ' + row['path'])
    inverse = (root / row['path']).read_text()
    for edit in reversed(row['replacements']):
        check(inverse.count(edit['new']) == edit['count'], 'Exact inverse edit occurrence ' + row['path'])
        inverse = inverse.replace(edit['new'], edit['old'])
    check(inverse.encode() == blob(base, row['path']), 'Exact inverse prior test ' + row['path'])

catalog_path = 'packages/contracts/retrieval-0.2/catalog.json'
old = json.loads(blob(base, catalog_path))
catalog = json.loads((root / catalog_path).read_text())
ids = set(updates['explicitNewOperationIds'])
check(len(ids) == 7, 'Exactly seven reviewed original capability mappings')
check(catalog['catalogVersion'] == '0.2.8', 'Private catalog version 0.2.8')
check(len(catalog['originals']) == 139, 'All 139 original capabilities')
check(sum(x['disposition'] == 'selected' for x in catalog['originals']) == 96, '96 selected capabilities')
check(sum(x['disposition'] == 'deferred' for x in catalog['originals']) == 43, '43 deferred capabilities')
check(sum(x['state'] == 'mapped' for x in catalog['originals']) == 62, '62 mapped unavailable capabilities')
check(sum(x['disposition'] == 'selected' and x['state'] == 'pending' for x in catalog['originals']) == 34, '34 selected pending capabilities')
check(len(catalog['operations']) == 63, '63 typed unavailable operations')
for prior in old['originals']:
    expected = dict(prior)
    if prior['id'] in ids:
        expected.update(state='mapped', replacement={'id': prior['id'], 'version': '0.2.0'})
    check(next(x for x in catalog['originals'] if x['id'] == prior['id']) == expected, 'Exact original disposition/boundary ' + prior['id'])
check([x for x in catalog['operations'] if x['operation']['id'] not in ids] == old['operations'], 'All 56 prior descriptors identical and ordered')
schemas = {}
for file in (root / 'packages/contracts/retrieval-0.2').glob('*.schema.json'):
    raw = file.read_bytes()
    schema = json.loads(raw)
    schemas[schema['$id']] = (schema, hashlib.sha256(raw).hexdigest())
for row in catalog['operations']:
    name = row['operation']['id']
    for field in ['inputSchema', 'outputSchema']:
        identifier, definition = row[field]['id'].split('#/$defs/')
        schema, digest = schemas[identifier]
        check(identifier.startswith('urn:meri:') and definition in schema['$defs'] and row[field]['sha256'] == digest, 'Exact canonical schema identity/hash ' + name + ':' + field)
    check(row['handler'] is None and row['availability'] == 'unimplemented' and row['qualification'] == 'pending', 'Unavailable pending operation ' + name)

accepted = json.loads((packet / 'candidate-freezes.json').read_text())
check(accepted['unintegratedPendingReview'] == [], 'Every imported family independently accepted')
source_files = {}
for family in accepted['families']:
    paths = git('diff', '--name-only', family['base'], family['source'], '--', 'packages').decode().splitlines()
    for path in paths:
        expected_ref = family['source']
        if family['family'] == 'tenant-contacts':
            expected_ref = family['rootAuthorTestCorrection'] if path.startswith('packages/contracts/test/') else family['rootRepair']
        before, after = blob(expected_ref, path), (root / path).read_bytes()
        check(after == before, 'Exact independently accepted source ' + family['family'] + ':' + path)
        source_files[path] = {'path': path, 'originalSource': family['source'], 'expectedSource': expected_ref,
                             'sha256': hashlib.sha256(after).hexdigest()}
    check(git('rev-parse', family['source'] + '^{tree}').decode().strip() == family['sourceTree'], 'Exact source tree ' + family['family'])
    check(family.get('runtimeAccepted') is False, 'No runtime promotion ' + family['family'])
# State syntax is one shared dependency, not duplicated by the entity family.
check(blob('a25516ae8d2c44638800e492e439e212098dc750', 'packages/contracts/retrieval-0.2/state-bill-identity.mjs') ==
      (root / 'packages/contracts/retrieval-0.2/state-bill-identity.mjs').read_bytes(), 'Exact shared accepted state helper')
check(len(source_files) == 19, 'All nineteen accepted domain source and author-test files accounted for')
source_files = list(source_files.values())

ledger = {'catalogVersion': catalog['catalogVersion'], 'original': 139, 'selected': 96, 'deferred': 43,
          'mappedUnavailable': 62, 'selectedPending': 34, 'typedUnavailable': 63,
          'sourceEnabled': False, 'runtimeAccepted': False, 'records': catalog['originals']}
(packet / 'capability-ledger.json').write_text(json.dumps(ledger, indent=2) + '\n')
(packet / 'accepted-source-files.json').write_text(json.dumps(source_files, indent=2) + '\n')
result = {'sourceHead': head, 'sourceTree': git('rev-parse', head + '^{tree}').decode().strip(),
          'base': base, 'passed': len(checks), 'failed': 0, 'originalTrackedPaths': len(old_tree),
          'allowedOriginalChanges': sorted(allowed), 'acceptedDomainFiles': len(source_files),
          'runtimeAccepted': False, 'checks': checks}
(packet / 'audit-results.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: value for key, value in result.items() if key != 'checks'}))
