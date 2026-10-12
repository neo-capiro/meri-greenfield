"""Verify an exact documentation freeze using Git, byte reads and JSON only.

Arguments: author worktree, restricted staging directory. Never imports or
executes inspected sources; only the separately reviewed data/AST checker runs.
No private values or argument paths are emitted into the receipt.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

AUTHOR = Path(sys.argv[1])
PRIVATE = Path(sys.argv[2])
HERE = Path(__file__).resolve().parent
BASE = '6cfb1f9a4d8acd66c5bd8d38d892d656fa3cd89e'
FREEZE = 'e58bbdf110014493b19a0186ecff2df1ddc107a7'
TREE = 'e8a9c5dd54cb3b206c864576b05943ddd8d6bbf5'
PREFIX = 'docs/qualification/candidates/supervisor-exact-inputs-20261012/author/'
REPORT = 'docs/coordination/reports/MERI-SUPERVISOR-EXACT-INPUTS-20261012.md'
checks = []

def check(name, ok):
    checks.append({'name': name, 'passed': bool(ok)})

def git(*args):
    return subprocess.run(['git', '-C', str(AUTHOR), *args], capture_output=True, check=True, timeout=30).stdout

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

check('exact-author-head', git('rev-parse', 'HEAD').decode().strip() == FREEZE)
check('exact-author-tree', git('rev-parse', 'HEAD^{tree}').decode().strip() == TREE)
check('clean-author-worktree', not git('status', '--porcelain'))
changes = [line.split('\t') for line in git('diff', '--name-status', BASE, FREEZE).decode().splitlines()]
check('only-nine-new-allocated-files', len(changes) == 9 and all(status == 'A' and (path == REPORT or path.startswith(PREFIX)) for status, path in changes))
manifest_path = PREFIX + 'freeze-manifest.json'
manifest_raw = (AUTHOR / manifest_path).read_bytes()
manifest = json.loads(manifest_raw)
check('manifest-base-self-excluded', manifest['base'] == BASE and manifest['selfExcluded'] is True)
check('complete-eight-member-manifest', len(manifest['files']) == 8 and {r['path'] for r in manifest['files']} == {p for _, p in changes} - {manifest_path})
for row in manifest['files']:
    raw = (AUTHOR / row['path']).read_bytes()
    check('member-integrity:' + row['path'].split('/')[-1], len(raw) == row['bytes'] and digest(raw) == row['sha256'] and git('show', FREEZE + ':' + row['path']) == raw)
criteria = json.loads((HERE / 'frozen-criteria.json').read_bytes())
for row in criteria['sourceAnchors']:
    raw = (AUTHOR / row['path']).read_bytes()
    check('unchanged-source:' + row['path'].split('/')[-1], len(raw) == row['bytes'] and digest(raw) == row['sha256'] and git('show', BASE + ':' + row['path']) == raw)
check('whitespace-clean', not git('diff', '--check', BASE, FREEZE))
private_values = set()
def walk(value):
    if isinstance(value, str):
        if re.match(r'^[A-Za-z]:[\\/]', value) or value.startswith('\\\\'):
            private_values.add(value)
    elif isinstance(value, list):
        for item in value: walk(item)
    elif isinstance(value, dict):
        for item in value.values(): walk(item)
for name in ['provenance-and-bindings.verified.json', 'supervisor-source-review.verified.json', 'proposal-relayed.json']:
    walk(json.loads((PRIVATE / name).read_bytes()))
packet = [(AUTHOR / path).read_bytes() for _, path in changes]
leaks = 0
for value in private_values:
    for spelling in [value, json.dumps(value)[1:-1]]:
        leaks += sum(spelling.encode() in raw for raw in packet)
check('no-known-private-path-value-leaks', len(private_values) > 0 and leaks == 0)
run = subprocess.run([sys.executable, str(AUTHOR / PREFIX / 'check-map.py'), str(PRIVATE)], cwd=AUTHOR, capture_output=True, timeout=30)
(HERE / 'exact-freeze-data-ast.stdout.json').write_bytes(run.stdout)
(HERE / 'exact-freeze-data-ast.stderr.txt').write_bytes(run.stderr)
parsed = json.loads(run.stdout)
check('exact-freeze-author-data-ast-replay', run.returncode == 0 and parsed['passed'] == 23 and parsed['failed'] == 0 and not run.stderr)
check('replay-matches-frozen-receipt', run.stdout == (AUTHOR / PREFIX / 'data-ast-checks.stdout.json').read_bytes())
receipt = {'base': BASE, 'authorCommit': FREEZE, 'authorTree': TREE,
           'method': 'Git metadata, byte hashing, JSON and reviewed data/AST checker only; no inspected source import or execution',
           'authorManifestSha256': digest(manifest_raw), 'authorManifestMembers': 8,
           'knownPrivatePathValuesScanned': len(private_values), 'knownPrivatePathValueLeaks': leaks,
           'authorDataAstReplay': {'passed': parsed['passed'], 'failed': parsed['failed'], 'exitCode': run.returncode},
           'checks': checks, 'passed': sum(r['passed'] for r in checks), 'failed': sum(not r['passed'] for r in checks),
           'targetImported': False, 'nativeExecution': False, 'runtimeAccepted': False, 'ownedJobsRemaining': 0}
(HERE / 'exact-freeze-integrity.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'passed': receipt['passed'], 'failed': receipt['failed'], 'authorDataAstReplay': receipt['authorDataAstReplay'], 'manifestSha256': receipt['authorManifestSha256']}))
sys.exit(0 if not receipt['failed'] else 1)
