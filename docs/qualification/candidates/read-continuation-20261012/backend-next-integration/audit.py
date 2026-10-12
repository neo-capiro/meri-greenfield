"""Verify the exact source composition and full inventory using local Git only."""
from pathlib import Path
import hashlib
import json
import subprocess

root = Path(__file__).resolve().parents[5]
packet = Path(__file__).resolve().parent
base = 'ede7b56845816d38d0bbffab5a657aaa4f978739'
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
    'packages/contracts/retrieval-0.2/pe-references-validation.mjs',
    'packages/contracts/test/retrieval-pe-references.test.mjs',
}
changed = {path for path, identity in old_tree.items() if current_tree.get(path) != identity}
check(changed == allowed, 'Only three canonical files, reviewed PE ownership repair and explicit test expectations changed')
check(len(old_tree) == 7186, 'All 7186 PR32 original tracked paths accounted for')
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
check(len(ids) == 4, 'Exactly four reviewed original capability mappings')
check(catalog['catalogVersion'] == '0.2.10', 'Private catalog version 0.2.10')
check(len(catalog['originals']) == 139, 'All 139 original capabilities')
check(sum(x['disposition'] == 'selected' for x in catalog['originals']) == 96, '96 selected capabilities')
check(sum(x['disposition'] == 'deferred' for x in catalog['originals']) == 43, '43 deferred capabilities')
check(sum(x['state'] == 'mapped' for x in catalog['originals']) == 70, '70 mapped unavailable capabilities')
check(sum(x['disposition'] == 'selected' and x['state'] == 'pending' for x in catalog['originals']) == 26, '26 selected pending capabilities')
check(len(catalog['operations']) == 71, '71 typed unavailable operations')
for prior in old['originals']:
    expected = dict(prior)
    if prior['id'] in ids:
        expected.update(state='mapped', replacement={'id': prior['id'], 'version': '0.2.0'})
    check(next(x for x in catalog['originals'] if x['id'] == prior['id']) == expected, 'Exact original disposition/boundary ' + prior['id'])
check([x for x in catalog['operations'] if x['operation']['id'] not in ids] == old['operations'], 'All 67 prior descriptors identical and ordered')
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
        before, after = blob(expected_ref, path), (root / path).read_bytes()
        check(after == before, 'Exact independently accepted source ' + family['family'] + ':' + path)
        source_files[path] = {'path': path, 'originalSource': family['source'], 'expectedSource': expected_ref,
                             'sha256': hashlib.sha256(after).hexdigest()}
    check(git('rev-parse', family['source'] + '^{tree}').decode().strip() == family['sourceTree'], 'Exact source tree ' + family['family'])
    check(family.get('runtimeAccepted') is False, 'No runtime promotion ' + family['family'])
check(len(source_files) == 6, 'All six accepted new-read source and author-test files accounted for')

# The reviewed PE ownership repair is the only prior domain source change.
repair_ref = '8dcc6e13f360c15d9ba0f7c9fbd3419f1318afe3'
for path in ['packages/contracts/retrieval-0.2/pe-references-validation.mjs', 'packages/contracts/test/retrieval-pe-references.test.mjs']:
    check((root / path).read_bytes() == blob(repair_ref, path), 'Exact reviewed PE repair ' + path)
    source_files[path] = {'path': path, 'expectedSource': repair_ref, 'sha256': hashlib.sha256((root / path).read_bytes()).hexdigest()}
correction = json.loads((packet.parent / 'pe-reference-detachment/test-expectation-update.json').read_text())
restored = (root / correction['path']).read_text().replace(correction['after'], correction['before'])
check(restored.encode() == blob(base, correction['path']), 'PE ownership assertion inverse restores PR32')
# Every added executable/test source must be bound to an accepted immutable packet.
for entry in json.loads((packet / 'source-provenance.json').read_text())['files']:
    body = (root / entry['path']).read_bytes()
    check(body == blob(entry['reference'], entry['path']), 'Exact added source provenance ' + entry['path'])
    source_files[entry['path']] = {'path': entry['path'], 'expectedSource': entry['reference'], 'sha256': hashlib.sha256(body).hexdigest()}
added_code = {p for p in current_tree if p not in old_tree and p.startswith(('packages/', 'apps/', 'scripts/'))}
check(added_code <= set(source_files), 'All added code and tests have exact accepted provenance')

source_files = list(source_files.values())

ledger = {'catalogVersion': catalog['catalogVersion'], 'original': 139, 'selected': 96, 'deferred': 43,
          'mappedUnavailable': 70, 'selectedPending': 26, 'typedUnavailable': 71,
          'sourceEnabled': False, 'runtimeAccepted': False, 'records': catalog['originals']}
(packet / 'capability-ledger.json').write_text(json.dumps(ledger, indent=2) + '\n')
(packet / 'accepted-source-files.json').write_text(json.dumps(source_files, indent=2) + '\n')
result = {'sourceHead': head, 'sourceTree': git('rev-parse', head + '^{tree}').decode().strip(),
          'base': base, 'passed': len(checks), 'failed': 0, 'originalTrackedPaths': len(old_tree),
          'allowedOriginalChanges': sorted(allowed), 'acceptedDomainFiles': len(source_files),
          'runtimeAccepted': False, 'checks': checks}
(packet / 'audit-results.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: value for key, value in result.items() if key != 'checks'}))
