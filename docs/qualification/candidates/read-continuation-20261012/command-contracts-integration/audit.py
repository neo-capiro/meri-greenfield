"""Exact private command composition audit over local Git objects only."""
from pathlib import Path
import hashlib
import json
import subprocess

root = Path(__file__).resolve().parents[5]
packet = Path(__file__).resolve().parent
base = 'cff71e1ba8ca8dea8970ad0c778b580a73f84815'
source = 'bdbb14603cfab0d52d483956f7f1a7e373abb3cb'
author = '844b9b00639d3fa712e15ed5e0872702ee1a974d'
review = '757e3e691f4578781116d81fb516b5c9f454325a'
checks = []
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)
def check(condition, label):
    if not condition:
        raise AssertionError(label)
    checks.append(label)
def tree(ref):
    records = {}
    for row in git('ls-tree', '-rz', ref).split(b'\0'):
        if row:
            identity, path = row.split(b'\t', 1)
            records[path.decode()] = identity.decode()
    return records
head = git('rev-parse', 'HEAD').decode().strip()
before, after = tree(base), tree(head)
check(len(before) == 6947, 'All6947baseline paths accounted for')
for path, identity in before.items():
    check(after.get(path) == identity, 'Original blob/mode unchanged ' + path)
source_paths = git('diff', '--name-only', base, source, '--', 'packages').decode().splitlines()
check(len(source_paths) == 6, 'Exactly six independently accepted family files')
accepted = []
for path in source_paths:
    raw = git('show', source + ':' + path)
    check((root / path).read_bytes() == raw, 'Exact accepted source ' + path)
    accepted.append({'path': path, 'source': source, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
expected_code = set(source_paths) | {'packages/contracts/commands-0.2/validate.mjs',
    'packages/contracts/test/command-payloads-independent.test.mjs'}
optional_review_test = 'packages/contracts/test/command-contracts-integration-independent.test.mjs'
if optional_review_test in after:
    expected_code.add(optional_review_test)
new_code = {p for p in after.keys() - before.keys() if p.startswith(('apps/', 'packages/', 'scripts/'))}
check(new_code == expected_code, 'Only accepted families, canonical loader and independent controls added')
packets = []
for role, ref in [('author', author), ('review', review)]:
    manifest_path = 'docs/qualification/candidates/read-continuation-20261012/command-payloads-' + role + '/manifest.json'
    raw = git('show', ref + ':' + manifest_path)
    manifest = json.loads(raw)
    check((root / manifest_path).read_bytes() == raw, 'Exact immutable family manifest ' + role)
    entries = manifest['entries']
    check(len({x['path'] for x in entries}) == len(entries), 'Unique manifest entries ' + role)
    for entry in entries:
        data = git('show', ref + ':' + entry['path'])
        check(len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256'], 'Immutable packet hash ' + role + ':' + entry['path'])
        check((root / entry['path']).read_bytes() == data, 'Imported packet bytes ' + role + ':' + entry['path'])
    packets.append({'role': role, 'ref': ref, 'manifest': manifest_path, 'sha256': hashlib.sha256(raw).hexdigest(), 'members': len(entries)})
catalog = json.loads((root / 'packages/contracts/retrieval-0.2/catalog.json').read_text())
check(len(catalog['originals']) == 139, 'All139originals retained')
check(sum(x['disposition'] == 'selected' for x in catalog['originals']) == 96, '96selected unchanged')
check(sum(x['disposition'] == 'deferred' for x in catalog['originals']) == 43, '43deferred unchanged')
check(sum(x['state'] == 'mapped' for x in catalog['originals']) == 62, 'PR31read mappings unchanged by private command work')
check(all(x['handler'] is None and x['availability'] == 'unimplemented' for x in catalog['operations']), 'Every existing read handler remains unavailable')
result = {'sourceHead': head, 'base': base, 'familySource': source, 'familyAuthorPacket': author,
    'familyReview': review, 'passed': len(checks), 'failed': 0, 'originalTrackedPaths': len(before),
    'acceptedSourceFiles': accepted, 'packets': packets, 'checks': checks,
    'runtimeAccepted': False, 'sourceEnabled': False, 'sourceMappingsChanged': False}
(packet / 'audit-results.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'checks'}))
