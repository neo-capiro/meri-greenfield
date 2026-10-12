"""Independent exact-byte preservation review. No database or source mutations."""
import ast
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path('/workspace/meri-g1-durable-budget-20261012')
OUT = Path(__file__).parent
BASE = '1e6d430cf9c239caca4198aea42a762f13021cd5'
CANDIDATE = 'd58a2b1c51c43420fa64c1036c509ab14d872996'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def old(path):
    return git('show', BASE + ':' + path)

def frozen(path):
    return git('show', CANDIDATE + ':' + path)

checks = []
def check(name, condition):
    checks.append({'name': name, 'passed': bool(condition)})
    assert condition, name

check('exact candidate HEAD', git('rev-parse', 'HEAD').decode().strip() == CANDIDATE)
check('clean author worktree', git('status', '--porcelain') == b'')
changes = [line.split('\t') for line in git('diff', '--name-status', BASE, CANDIDATE).decode().splitlines()]
modified = [path for status, path in changes if status != 'A']
check('only four approved existing files modified', set(modified) == {
    'apps/gateway/index.mjs', 'apps/proxy/qualification/state/ledger.py',
    'apps/proxy/qualification/state/postgres_store.py',
    'apps/proxy/qualification/test/test_postgres_state.py'})
check('no deleted or renamed paths', all(s in ['A', 'M'] for s, p in changes))
check('all new source paths allocated', all(
    p.startswith(('docs/qualification/candidates/g1-durable-budget-20261012/author/',
                  'apps/gateway/budget/')) or p in {
        'apps/gateway/test/durable-tool-budget.test.mjs',
        'apps/gateway/test/postgres-tool-budget.test.mjs',
        'apps/proxy/qualification/state/migrations/0002_tool_budget.sql',
        'apps/proxy/qualification/test/test_tool_budget_source.py',
        'docs/coordination/reports/MERI-G1-DURABLE-BUDGET-20261012.md',
        'docs/coordination/tasks/MERI-G1-DURABLE-BUDGET-20261012.md'}
    for s, p in changes if s == 'A'))
entry = 'apps/gateway/index.mjs'
check('entire original gateway entry prefix exact', frozen(entry).startswith(old(entry)))
pgtest = 'apps/proxy/qualification/test/test_postgres_state.py'
inverse = frozen(pgtest).replace(b';cls.store.migrate_tool_budget()', b'').replace(
    b'meri_qualification.tool_reservations,meri_qualification.tool_grant_bindings,meri_qualification.tool_run_allocations,', b'')
check('real engine fixture inverse exactly reproduces original bytes', inverse == old(pgtest))
oldtree = ast.parse(old(pgtest)); newtree = ast.parse(frozen(pgtest))
methods = lambda t: {n.name: ast.dump(n, include_attributes=False) for n in ast.walk(t)
                     if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name.startswith('test_')}
check('all original real engine test method ASTs exact', methods(oldtree) == methods(newtree))
store = 'apps/proxy/qualification/state/postgres_store.py'
addition = b'    def migrate_tool_budget(self):\n        """Explicit owner upgrade after 0001; never called automatically."""\n        sql = (Path(__file__).parent / "migrations/0002_tool_budget.sql").read_text(encoding="utf-8")\n        return self.transact(lambda cursor: cursor.execute(sql))\n\n'
check('explicit loader inverse exactly reproduces original store', frozen(store).replace(addition, b'') == old(store))
protected = []
for path in git('ls-tree', '-r', '--name-only', BASE).decode().splitlines():
    if path.startswith(('packages/contracts/', 'apps/gateway/dispatch/', 'apps/gateway/authorization/',
                        'apps/gateway/catalog/', 'apps/gateway/test/')) or path.endswith(('package-lock.json', 'package.json')) or path == 'apps/proxy/qualification/state/migrations/0001_qualification_state.sql':
        check('protected original byte equality: ' + path, old(path) == frozen(path))
        protected.append(path)
manifest = json.loads((ROOT / 'docs/qualification/candidates/g1-durable-budget-20261012/author/source-manifest.json').read_text())
for row in manifest['files']:
    raw = (ROOT / row['path']).read_bytes()
    check('author source receipt verified: ' + row['path'], len(raw) == row['bytes'] and hashlib.sha256(raw).hexdigest() == row['sha256'] and raw == frozen(row['path']))
patch = git('diff', '--binary', BASE, CANDIDATE, '--', 'apps/')
(OUT / 'exact-source.patch').write_bytes(patch)
receipt = {'base': BASE, 'candidate': CANDIDATE, 'tree': git('rev-parse', CANDIDATE+'^{tree}').decode().strip(),
           'source_patch_sha256': hashlib.sha256(patch).hexdigest(), 'checks': checks,
           'protected_files': len(protected), 'original_engine_test_methods': len(methods(oldtree)),
           'changed_source_files': manifest['files'], 'modified_original_paths': modified,
           'all_passed': all(c['passed'] for c in checks)}
(OUT / 'final-preservation.json').write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps({k: receipt[k] for k in ['candidate', 'tree', 'source_patch_sha256', 'protected_files', 'original_engine_test_methods', 'all_passed']}))
print('passed checks:', len(checks))
