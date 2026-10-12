"""Immutable test-patch inverse and complete base-tree preservation audit; no product imports."""
import hashlib
import json
import subprocess
import sys

BASE = '1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8'
SOURCE = 'ea94aff840424843b4b6efbfc21fb9d195f7ff54'
target = sys.argv[1]
manifest_ref = sys.argv[2] if len(sys.argv) > 2 else target
expected_test_files = int(sys.argv[3]) if len(sys.argv) > 3 else 19
prefix = 'docs/qualification/candidates/backend-execution-20261012/integration/'

def git(*args):
    return subprocess.check_output(['git', *args])

def blob(ref, path):
    return git('show', ref + ':' + path)

def digest(data):
    return hashlib.sha256(data).hexdigest()

checks = []
def same(label, actual, expected):
    checks.append({'label': label, 'pass': actual == expected})
    if actual != expected:
        checks[-1]['actual'] = actual
        checks[-1]['expected'] = expected

manifest = json.loads(blob(manifest_ref, prefix + 'test-expectation-updates.json'))
same('manifest original base', manifest['base'], BASE)
same('explicit old test path count', len(manifest['changes']), expected_test_files)
same('unique old test path count', len({row['path'] for row in manifest['changes']}), expected_test_files)
for row in manifest['changes']:
    path = row['path']
    original = blob(BASE, path).decode()
    current = blob(target, path).decode()
    same('test before hash ' + path, digest(original.encode()), row['beforeSha256'])
    same('test after hash ' + path, digest(current.encode()), row['afterSha256'])
    forward = original
    steps = []
    for i, patch in enumerate(row['replacements']):
        old, new = patch['old'], patch['new']
        positions = patch.get('positionsBefore', [0] if patch.get('wholeFileStep') else None)
        if positions is None:
            raise ValueError('No exact patch offsets for ' + path)
        same(f'patch count {path}:{i}', len(positions), patch['count'])
        same(f'patch order {path}:{i}', positions, sorted(set(positions)))
        for pos in positions:
            same(f'patch preimage {path}:{i}:{pos}', forward[pos:pos + len(old)], old)
        after_positions = [pos + j * (len(new) - len(old)) for j, pos in enumerate(positions)]
        for pos in reversed(positions):
            forward = forward[:pos] + new + forward[pos + len(old):]
        steps.append((old, new, after_positions))
    same('forward exact ' + path, digest(forward.encode()), digest(current.encode()))
    inverse = current
    for old, new, positions in reversed(steps):
        for pos in reversed(positions):
            same(f'inverse preimage {path}:{pos}', inverse[pos:pos + len(new)], new)
            inverse = inverse[:pos] + old + inverse[pos + len(new):]
    same('inverse original bytes ' + path, digest(inverse.encode()), digest(original.encode()))

command = json.loads(blob(target, prefix + 'command-namespace-expectation.json'))
old = blob(BASE, command['path'])
new = blob(target, command['path'])
same('private command namespace before hash', digest(old), command['beforeSha256'])
same('private command namespace after hash', digest(new), command['afterSha256'])
same('private command namespace sole transform', old.replace(command['old'].encode(), command['new'].encode()), new)
same('private command namespace exact inverse', new.replace(command['new'].encode(), command['old'].encode()), old)

def tree(ref):
    result = {}
    for entry in git('ls-tree', '-rz', ref).split(b'\0'):
        if entry:
            metadata, name = entry.split(b'\t', 1)
            result[name.decode()] = metadata.decode()
    return result

before_tree, current_tree, source_tree = tree(BASE), tree(target), tree(SOURCE)
production = {
    'apps/gateway/dispatch/dispatch-lifetime.mjs',
    'apps/gateway/dispatch/operation-context.mjs',
    'apps/gateway/dispatch/read-result-envelope.mjs',
    'packages/contracts/commands-0.2/validate.mjs',
    'packages/contracts/retrieval-0.2/catalog-validation.mjs',
    'packages/contracts/retrieval-0.2/catalog.json',
    'packages/contracts/retrieval-0.2/validate.mjs',
}
allowed = production | {row['path'] for row in manifest['changes']} | {command['path']}
changed = [p for p in before_tree if before_tree[p] != current_tree.get(p)]
same('exact existing-file allowlist', sorted(changed), sorted(allowed))
same('all7677 original entries still present', len(set(before_tree) & set(current_tree)), 7677)
for path, metadata in before_tree.items():
    if path not in allowed:
        same('unchanged original ' + path, current_tree.get(path), metadata)
for path, metadata in source_tree.items():
    if path.startswith(('apps/', 'packages/', 'scripts/')) and '/test/' not in path and '/tests/' not in path:
        same('exact tested production ' + path, current_tree.get(path), metadata)
same('no production addition after source freeze', sorted(p for p in current_tree if p.startswith(('apps/', 'packages/', 'scripts/')) and '/test/' not in p and '/tests/' not in p and p not in source_tree), [])
failures = [c for c in checks if not c['pass']]
print(json.dumps({'scope': 'INERT_GIT_OBJECT_AUDIT_NOT_RUNTIME', 'base': BASE, 'source': SOURCE,
                  'target': target, 'manifestRef': manifest_ref, 'checks': len(checks),
                  'passed': len(checks) - len(failures), 'failures': failures,
                  'baseEntries': len(before_tree), 'untouchedBaseEntries': len(before_tree) - len(changed),
                  'changedOriginalPaths': changed}, indent=2))
raise SystemExit(1 if failures else 0)
