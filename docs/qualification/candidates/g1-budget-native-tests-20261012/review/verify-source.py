"""Offline source preservation only; never imports or executes a native test entry."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('source_root', type=Path)
parser.add_argument('commit')
args = parser.parse_args()
root = args.source_root.resolve()
base = 'e8d2c0d0e5db8fb01ba2df26c4eb3f79b296c0b5'
def git(*argv):
    return subprocess.check_output(['git', '-C', str(root), *argv])
assert git('rev-parse', 'HEAD').decode().strip() == args.commit
assert git('status', '--porcelain') == b''
original = git('ls-tree', '-r', '--name-only', base).decode().splitlines()
changed = git('diff', '--name-only', base, args.commit).decode().splitlines()
original_changes = [p for p in changed if p in original]
assert original_changes == ['apps/gateway/budget/README.md'], original_changes
tests = ['apps/gateway/test/postgres-budget' + suffix for suffix in [
    '.integration.mjs', '-native-fixture.mjs', '-child.mjs', '-admission.test.mjs']]
permitted_prefixes = ('docs/qualification/candidates/g1-budget-native-tests-20261012/author/',
    'docs/coordination/tasks/MERI-G1-BUDGET-NATIVE-TESTS-',
    'docs/coordination/reports/MERI-G1-BUDGET-NATIVE-TESTS-')
assert all(p in tests + original_changes or p.startswith(permitted_prefixes) for p in changed), changed
assert all(p in changed for p in tests)
assert not (root / 'apps/gateway/test/postgres-budget.integration.test.mjs').exists()
assert root / tests[0] not in list((root / 'apps/gateway/test').glob('*.test.mjs'))
assert root / tests[3] in list((root / 'apps/gateway/test').glob('*.test.mjs'))
hashes = {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in tests + original_changes}
for p in tests + original_changes:
    assert (root / p).read_bytes() == git('show', f'{args.commit}:{p}')
integration = (root / tests[0]).read_text()
fixture = (root / tests[1]).read_text()
child = (root / tests[2]).read_text()
assert integration.index('const admission=parseNativeAdmission') < integration.index("import('../budget/")
assert child.index('const admission=parseNativeAdmission') < child.index('await openNativePool')
assert "sourceEnabled:true" not in integration.replace(' ', '')
assert "pool.end" not in git('show', f'{args.commit}:apps/gateway/budget/postgres-budget-store.mjs').decode()
assert '8.23.1' in fixture
assert 'synthetic-post-commit-loss' in fixture
assert git('diff', '--check', base, args.commit) == b''
print(json.dumps({'verdict':'PASS_SOURCE_PRESERVATION', 'base':base, 'commit':args.commit,
    'tree':git('rev-parse', f'{args.commit}^{{tree}}').decode().strip(),
    'originalTrackedFiles':len(original), 'unchangedOriginalFiles':len(original)-len(original_changes),
    'changedOriginalFiles':original_changes, 'hashes':hashes,
    'nativeEntryExecuted':False, 'databaseOperations':0}, indent=2))
