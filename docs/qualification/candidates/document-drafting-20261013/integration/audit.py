"""Source preservation and scope audit; no network or native fixture access."""
import hashlib
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[5]
base = 'b5243ae164f68c7591b039e8365d9897390543d2'
author = '8e21145f7f4745d20e84c3c2e51efcd93d33483f'


def git(*args):
    return subprocess.check_output(['git', '-c', 'gc.auto=0', *args], cwd=root)


def tree(ref):
    entries = {}
    for record in git('ls-tree', '-rz', ref).split(b'\0'):
        if record:
            meta, path = record.split(b'\t', 1)
            entries[path.decode()] = meta.decode()
    return entries


before, current = tree(base), tree('HEAD')
preserved = all(current.get(path) == entry for path, entry in before.items())
assert preserved, 'A pre-existing source/evidence entry changed or disappeared'
assert not git('diff', '--name-only', base, '--', *before), 'A pre-existing working-tree entry changed'
catalog = json.loads((root / 'packages/contracts/retrieval-0.2/catalog.json').read_text())
originals, operations = catalog['originals'], catalog['operations']
selected = [item for item in originals if item['disposition'] == 'selected']
deferred = [item for item in originals if item['disposition'] == 'deferred']
assert (len(originals), len(selected), len(deferred), len(operations)) == (139, 96, 43, 97)
assert all(item['state'] == 'mapped' for item in selected)
assert all(item['handler'] is None and item['availability'] == 'unimplemented' and item['qualification'] == 'pending' and item['retry']['maxRetries'] == 0 for item in operations)
modules = {}
for name in ['current.mjs', 'http.mjs', 'index.mjs']:
    path = 'apps/control/document-application/' + name
    raw = (root / path).read_bytes()
    assert raw == git('show', author + ':' + path), 'Production module differs from author freeze'
    modules[path] = {'sha256': hashlib.sha256(raw).hexdigest(), 'lines': len(raw.splitlines())}
assert not git('diff', '--check')
report = {'status': 'PASS', 'base': base, 'head': git('rev-parse', 'HEAD').decode().strip(),
          'authorSource': author, 'originalEntriesPreservedUnchanged': len(before),
          'newEntries': len(current) - len(before), 'originals': 139, 'selected': 96, 'deferred': 43,
          'selectedMapped': 96, 'operations': 97, 'allProductionOperationsUnavailable': True,
          'publicContractsUnchanged': True, 'allOriginalTestsUnchanged': True,
          'migrationsUnchanged': True, 'privateSchemasAndCatalogUnchanged': True,
          'productionModules': modules, 'scope': 'SOURCE_ONLY'}
path = Path(__file__).with_name('audit.json')
if path.exists():
    raise SystemExit('Refusing to replace prior audit evidence')
path.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
