"""Read-only Git/source/receipt audit; never imports application or driver code."""
import hashlib, json, os, subprocess, sys
from pathlib import Path
root = Path(__file__).resolve().parents[5]
evidence = Path(__file__).resolve().parent
base = 'd68615c9861315ac1c6ee616697f7ad0093d9192'
author, cli = sys.argv[1:3]
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)
def tree(ref):
    result = {}
    for row in git('ls-tree', '-r', '-z', ref).split(b'\0'):
        if row:
            meta, name = row.split(b'\t', 1)
            result[name.decode()] = meta.decode()
    return result
before, current = tree(base), tree('HEAD')
changed = [p for p, ident in before.items() if current.get(p) != ident]
assert not changed, changed
sources = []
for ref, paths in [(author, ['apps/gateway/local-action/' + n + '.mjs' for n in ['identity','gateway','control-authorizer','case']]), (cli, ['scripts/local-action/' + n + '.mjs' for n in ['admission','cli']])]:
    for path in paths:
        expected = git('show', ref + ':' + path)
        assert git('show', 'HEAD:' + path) == expected
        assert (root/path).read_bytes() == expected
        sources.append({'path': path, 'reference': ref, 'bytes': len(expected), 'sha256': hashlib.sha256(expected).hexdigest()})
catalog = json.loads(git('show', 'HEAD:packages/contracts/retrieval-0.2/catalog.json'))
assert len(catalog['originals']) == 139 and len(catalog['operations']) == 97
assert all(row['handler'] is None for row in catalog['operations'])
# All original catalog bytes, public contracts and runtime paths are preserved above.
receipts = []
for path in sorted(evidence.glob('*.json')):
    value = json.loads(path.read_bytes())
    if not isinstance(value, dict) or 'ownedPidAndPgid' not in value:
        continue
    assert value['ownedProcessGroupAbsent'] and not value['timedOut']
    for stream in value['streams']:
        data = (root/stream['path']).read_bytes()
        assert len(data) == stream['bytes'] and hashlib.sha256(data).hexdigest() == stream['sha256']
    try:
        os.killpg(value['ownedPidAndPgid'], 0)
    except ProcessLookupError:
        pass
    else:
        raise AssertionError('owned capture process group remains')
    receipts.append({'path': path.name, 'exitCode': value['exitCode'], 'processGroupAbsentNow': True})
result = {'base': base, 'reviewHead': git('rev-parse','HEAD').decode().strip(), 'originalEntries': len(before), 'unchangedEntries': len(before), 'changedOriginalEntries': changed, 'sources': sources, 'receipts': receipts, 'scope': 'SOURCE_ONLY; inert SQL and HTTP ports; native engine UNRUN', 'publicCatalogNativeWorkerFrontendPreserved': True}
print(json.dumps(result, indent=2))
