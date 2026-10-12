"""Verify exact final source, protected baseline files and retained raw receipts."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source_root', type=Path, help='clean checkout of the exact author freeze')
args = parser.parse_args()
root = args.source_root.resolve()
review = Path(__file__).resolve().parent
base = '1e6d430cf9c239caca4198aea42a762f13021cd5'
final = '357251ee531bf4da9778116090ec22a4a8ee27a3'
prefix = 'apps/control/qualification-sdk-fixture/'

def git(*values):
    return subprocess.check_output(['git', '-C', str(root), *values])

def tree(ref):
    output = {}
    for item in git('ls-tree', '-rz', ref).split(b'\0'):
        if item:
            metadata, path = item.split(b'\t', 1)
            output[path.decode()] = metadata.decode()
    return output

assert git('rev-parse', 'HEAD').decode().strip() == final
assert not git('status', '--porcelain')
before, after = tree(base), tree(final)
changed = sorted(path for path in before if before[path] != after.get(path))
assert changed == [prefix + 'service/README.md', prefix + 'service/control.mjs']
new = sorted(set(after) - set(before))
allowed_new = {prefix + 'service/run-stop.mjs', prefix + 'service/test/run-stop.test.mjs',
               'docs/coordination/tasks/MERI-G1-RUNTIME-OWNER-20261012.md',
               'docs/coordination/reports/MERI-G1-RUNTIME-OWNER-20261012.md'}
assert all(path in allowed_new or path.startswith('docs/qualification/candidates/g1-runtime-owner-20261012/author/') for path in new)
files = {}
for path in changed + [prefix + name for name in ['service/run-stop.mjs', 'service/test/run-stop.test.mjs',
        'service/handlers.mjs', 'state/registry.mjs', 'state/revocation.mjs', 'state/errors.mjs',
        'state/store.mjs', 'ingress/index.mjs', 'ingress/dispatch.mjs']]:
    data = (root / path).read_bytes()
    assert data == git('show', f'{final}:{path}')
    files[path] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                   'gitBlob': after[path].split()[-1]}
receipts = {}
for path in sorted(review.glob('*.json')):
    value = json.loads(path.read_text())
    if not isinstance(value, dict) or 'streams' not in value:
        continue
    for stream in value['streams'].values():
        data = (review / stream['path']).read_bytes()
        assert len(data) == stream['bytes']
        assert hashlib.sha256(data).hexdigest() == stream['sha256']
    text = (review / value['streams']['stdout']['path']).read_text()
    counts = {key: int(matches[-1]) for key in ['tests', 'pass', 'fail', 'skipped']
              if (matches := re.findall(r'\b' + key + r'\s+(\d+)\b', text))}
    receipts[path.name] = {'exitCode': value['exitCode'], 'counts': counts,
                           'ownedProcessGroupAbsent': value['ownedProcessGroupAbsent'],
                           'externalTimeout': value['externalTimeout']}
    assert value['ownedProcessGroupAbsent'] and not value['externalTimeout']
result = {'verdict': 'PASS', 'base': base, 'final': final,
          'finalTree': git('rev-parse', final + '^{tree}').decode().strip(),
          'authorWorktreeClean': True, 'baseFiles': len(before),
          'unchangedBaseFiles': len(before) - len(changed), 'changedBaseFiles': changed,
          'newFiles': new, 'files': files, 'receipts': receipts,
          'databaseEngine': 'UNRUN', 'nativeRuntime': 'UNRUN',
          'workerTls': 'SIMULATED_ONLY', 'objectStore': 'SCRIPTED_LOCAL_ONLY'}
(review / 'final-source-verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'verdict': result['verdict'], 'unchangedBaseFiles': result['unchangedBaseFiles'],
                  'rawReceiptsVerified': len(receipts), 'tree': result['finalTree']}))
