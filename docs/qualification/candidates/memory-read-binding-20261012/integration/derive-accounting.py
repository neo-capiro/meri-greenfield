"""Offline evidence derived from the canonical catalog; never a runtime registry."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[5]
BASE = '7ba0e9d10ebf684e162dcc7c143915afdbf00f32'
CATALOG = 'packages/contracts/retrieval-0.2/catalog.json'
LEDGER = 'docs/coordination/r2/capabilities.json'
OPERATION = {'id': 'memory.list_own_proposals', 'version': '0.2.0'}

parser = argparse.ArgumentParser(description=__doc__, epilog='Exit 0: verified and wrote derived receipt. Exit 1: preservation failure. Exit 2: invalid arguments.')
parser.parse_args()


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def digest(data):
    return hashlib.sha256(data).hexdigest()


prior_bytes = git('show', f'{BASE}:{CATALOG}')
current_bytes = (ROOT / CATALOG).read_bytes()
prior, current = json.loads(prior_bytes), json.loads(current_bytes)
ledger_bytes = (ROOT / LEDGER).read_bytes()
assert ledger_bytes == git('show', f'{BASE}:{LEDGER}'), 'Original inventory bytes changed'
ledger = json.loads(ledger_bytes)
expected = [{'id': row['fields']['ID'], 'disposition': row['acceptedScope']['disposition'],
             'boundary': row['acceptedScope']['boundary']} for row in ledger['records']]
assert [{key: row[key] for key in ('id', 'disposition', 'boundary')}
        for row in current['originals']] == expected
assert len(current['originals']) == 139
assert len({row['id'] for row in current['originals']}) == 139
assert len(current['operations']) == 14
old_operations = {row['operation']['id']: row for row in prior['operations']}
operations = {row['operation']['id']: row for row in current['operations']}
assert len(old_operations) == 13 and len(operations) == 14
assert all(operations[key] == row for key, row in old_operations.items()), 'Old descriptor changed'
assert set(operations) - set(old_operations) == {OPERATION['id']}
assert len(prior['originals']) == len(current['originals'])
changed = [(old, new) for old, new in zip(prior['originals'], current['originals']) if old != new]
assert len(changed) == 1 and changed[0][0]['id'] == 'list_memory_proposals'
old, new = changed[0]
assert old['state'] == 'pending' and old['replacement'] is None
assert new == {**old, 'state': 'mapped', 'replacement': OPERATION}

for row in operations.values():
    assert row['handler'] is None and row['availability'] == 'unimplemented'
    assert row['qualification'] == 'pending' and row['retry']['maxRetries'] == 0
    assert row['retry']['retryableCodes'] == []

allowed_changes = {
    CATALOG,
    'packages/contracts/retrieval-0.2/catalog-validation.mjs',
    'packages/contracts/retrieval-0.2/operation-contracts.mjs',
    'packages/contracts/retrieval-0.2/validate.mjs',
    'packages/contracts/test/retrieval-catalog-bindings.test.mjs',
    'packages/contracts/test/retrieval-mail.test.mjs',
    'packages/contracts/test/retrieval-memory-proposals.test.mjs',
    'packages/contracts/test/retrieval-memory-binding.test.mjs',
    # Separately reviewed descriptive policy alignment; no operation is added.
    'packages/contracts/retrieval-0.2/memory-review-policy.mjs',
    'packages/contracts/test/retrieval-memory-review-policy.test.mjs',
}
changes = git('diff', '--name-only', BASE, '--', 'apps', 'packages', 'scripts',
              'package.json', 'package-lock.json', 'docs/coordination/r2').decode().splitlines()
assert set(changes) <= allowed_changes, f'Unallocated source changes: {set(changes) - allowed_changes}'
records = []
for original in current['originals']:
    row = {**original, 'availability': None, 'qualification': None, 'handler': None}
    if original['replacement'] is not None:
        operation = operations[original['replacement']['id']]
        assert original['replacement'] == operation['operation']
        row.update({key: operation[key] for key in ('availability', 'qualification', 'handler')})
    records.append(row)
counts = {
    'original': len(records),
    'selected': sum(row['disposition'] == 'selected' for row in records),
    'deferred': sum(row['disposition'] == 'deferred' for row in records),
    'boundUnavailable': sum(row['state'] == 'mapped' and row['availability'] == 'unimplemented' for row in records),
    'selectedUnmapped': sum(row['disposition'] == 'selected' and row['state'] == 'pending' for row in records),
}
assert counts == {'original': 139, 'selected': 96, 'deferred': 43, 'boundUnavailable': 14, 'selectedUnmapped': 82}
receipt = {
    'scope': 'DERIVED_SOURCE_EVIDENCE_NOT_EXECUTABLE_NOT_A_REGISTRY',
    'sourceHead': git('rev-parse', 'HEAD').decode().strip(),
    'preservedBase': BASE,
    'canonicalCatalog': {'path': CATALOG, 'sha256': digest(current_bytes), 'priorSha256': digest(prior_bytes)},
    'canonicalInventory': {'path': LEDGER, 'sha256': digest(ledger_bytes)},
    'originalThirteenDescriptorsUnchanged': True,
    'onlyOriginalMappingChanged': 'list_memory_proposals',
    'sourceChanges': changes,
    'counts': counts,
    'records': records,
}
output = Path(__file__).with_name('capability-accounting.json')
output.write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'status': 'PASS', 'counts': counts, 'output': str(output.relative_to(ROOT)),
                  'sha256': digest(output.read_bytes())}))
