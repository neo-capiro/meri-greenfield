"""Read-only integration boundary check; never runs a database or native runtime."""
import ast
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[5]
BASE = '1e6d430cf9c239caca4198aea42a762f13021cd5'
PREFIX = 'apps/control/qualification-sdk-fixture/service/'
ALLOWED_CHANGED = {
    PREFIX + 'control.mjs', PREFIX + 'README.md',
    'apps/proxy/qualification/state/ledger.py',
    'apps/proxy/qualification/state/postgres_store.py',
    'apps/proxy/qualification/test/test_postgres_state.py',
    'apps/gateway/index.mjs',
}
ALLOWED_NEW = {
    PREFIX + 'run-stop.mjs', PREFIX + 'test/run-stop.test.mjs',
    *('apps/gateway/budget/' + name for name in (
        'postgres-tool-budget.mjs', 'tool-budget-binding.mjs',
        'postgres-budget-store.mjs', 'durable-tool-dispatch.mjs', 'README.md')),
    'apps/gateway/test/durable-tool-budget.test.mjs',
    'apps/gateway/test/postgres-tool-budget.test.mjs',
    'apps/proxy/qualification/state/migrations/0002_tool_budget.sql',
    'apps/proxy/qualification/test/test_tool_budget_source.py',
}


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def tree(ref):
    return {path.decode(): metadata.decode() for item in git('ls-tree', '-rz', ref).split(b'\0')
            if item for metadata, path in [item.split(b'\t', 1)]}


head = git('rev-parse', 'HEAD').decode().strip()
old, new = tree(BASE), tree(head)
changed = sorted(path for path in old if old[path] != new.get(path))
added = sorted(set(new) - set(old))
assert not set(old) - set(new), 'original file removed'
assert set(changed) <= ALLOWED_CHANGED, changed
assert all(path.startswith('docs/') or path in ALLOWED_NEW for path in added), added
assert not git('diff', 'HEAD', '--', 'apps', 'packages', 'scripts', 'package.json', 'package-lock.json'), 'uncommitted source'

# Original PostgreSQL test assertions survive; only explicitly allocated fixture
# setup may change. Real PostgreSQL remains an independent, unrun gate.
test_path = 'apps/proxy/qualification/test/test_postgres_state.py'


def test_bodies(raw):
    return {node.name: ast.dump(node, include_attributes=False)
            for node in ast.walk(ast.parse(raw))
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith('test_')}


before = test_bodies(git('show', BASE + ':' + test_path))
after = test_bodies((ROOT / test_path).read_bytes())
assert before == after, 'original PostgreSQL test body changed'
entry_path = 'apps/gateway/index.mjs'
old_entry = git('show', BASE + ':' + entry_path)
old_factory = old_entry[old_entry.index(b'export function createSourceDisabledGateway'):]
assert old_factory in (ROOT / entry_path).read_bytes(), 'original gateway factory changed'

files = {}
for path in changed + sorted(set(added) & ALLOWED_NEW):
    data = (ROOT / path).read_bytes()
    assert data == git('show', head + ':' + path), path
    files[path] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

result = {
    'verdict': 'PASS', 'base': BASE, 'sourceHead': head,
    'tree': git('rev-parse', head + '^{tree}').decode().strip(),
    'originalFiles': len(old), 'unchangedOriginalFiles': len(old) - len(changed),
    'changedOriginalFiles': changed, 'originalPostgresTestBodiesPreserved': len(before),
    'newSourceFiles': sorted(set(added) & ALLOWED_NEW), 'sourceFiles': files,
    'scope': 'LOCAL_SOURCE_PRESERVATION_ONLY',
    'publicContracts': 'UNCHANGED', 'privateContracts': 'UNCHANGED',
    'canonicalCatalogAndOriginalSourceDisabledFactory': 'UNCHANGED',
    'originalMigration0001': 'UNCHANGED', 'workerImageAndCollector': 'UNCHANGED',
    'databaseEngine': 'UNRUN', 'nativeRuntime': 'UNRUN',
}
print(json.dumps(result, indent=2))
