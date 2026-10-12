"""Read-only exact-source, scope and raw-stream verification. No database access."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

review = Path(__file__).resolve().parent
source = Path('/workspace/meri-g1-next-behavior-20261012')
base = '690bac4cd44112b161d8e02818aeae7639ce237a'
revocation = '7831e5c0780ffaf233b81867b0e250bdbf02fbbd'
final = '4c1c6c7e382d3bab6aa32c0ea1dfd228482c7dee'
prefix = 'apps/control/qualification-sdk-fixture/'
changed_expected = {prefix + path for path in ['state/registry.mjs', 'state/README.md',
                                              'service/handlers.mjs', 'service/README.md']}

def git(*args):
    return subprocess.check_output(['git', '-C', str(source), *args])

def tree(ref):
    result = {}
    for entry in git('ls-tree', '-rz', ref).split(b'\0'):
        if entry:
            meta, path = entry.split(b'\t', 1)
            result[path.decode()] = meta.decode()
    return result

assert git('rev-parse', 'HEAD').decode().strip() == final
assert not git('status', '--porcelain')
subprocess.run(['git', '-C', str(source), 'merge-base', '--is-ancestor', revocation, final], check=True)
before, after = tree(base), tree(final)
changed = {p for p in before if before[p] != after.get(p)}
assert changed == changed_expected, changed
files = {}
for name in ['state/registry.mjs', 'state/revocation.mjs', 'state/README.md',
             'state/test/revocation.test.mjs', 'state/test/revocation-postgres.test.mjs',
             'service/handlers.mjs', 'service/README.md', 'service/test/cancellation.test.mjs',
             'state/errors.mjs', 'state/store.mjs', 'state/binding.mjs',
             'state/credential-resolution.mjs',
             'state/migrations/0001_qualification_sdk_fixture_state.sql']:
    path = prefix + name
    data = (source / path).read_bytes()
    assert data == git('show', f'{final}:{path}'), path
    if name.startswith('state/'):
        assert data == git('show', f'{revocation}:{path}'), path
    files[path] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                   'gitBlob': after[path].split()[-1]}
baseline_handler = git('show', f'{base}:{prefix}service/handlers.mjs')
assert baseline_handler == git('show', f'{revocation}:{prefix}service/handlers.mjs')
checks = {}
for receipt in sorted(review.glob('*.json')):
    value = json.loads(receipt.read_text())
    if 'streams' not in value:
        continue
    for stream in value['streams'].values():
        data = (review / stream['path']).read_bytes()
        assert len(data) == stream['bytes']
        assert hashlib.sha256(data).hexdigest() == stream['sha256']
    stdout = (review / value['streams']['stdout']['path']).read_text()
    counts = {name: int(found[-1]) for name in ['tests', 'pass', 'fail', 'skipped']
              if (found := re.findall(r'\b' + name + r'\s+(\d+)\b', stdout))}
    checks[receipt.name] = {'exitCode': value['exitCode'], 'counts': counts,
                            'externalTimeout': value['externalTimeout'],
                            'ownedProcessGroupAbsent': value['ownedProcessGroupAbsent']}
result = {'verdict': 'PASS', 'base': base, 'revocation': revocation, 'final': final,
          'finalTree': git('rev-parse', final + '^{tree}').decode().strip(),
          'authorWorktreeClean': True, 'baseFiles': len(before),
          'unchangedBaseFiles': len(before) - len(changed), 'changedBaseFiles': sorted(changed),
          'baselineHandlerSha256': hashlib.sha256(baseline_handler).hexdigest(),
          'files': files, 'checks': checks,
          'databaseExecution': 'UNRUN', 'nativeRuntime': 'UNRUN'}
(review / 'final-source-verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'verdict': result['verdict'], 'unchangedBaseFiles': result['unchangedBaseFiles'],
                  'checksWithVerifiedStreams': len(checks), 'sourceFiles': len(files)}))
