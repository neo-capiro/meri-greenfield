"""Record exact final source/test deltas; preserve prior historical evidence."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
BASE = 'e5fb3963de787bbd7b7663316c368f15814897da'

def git(*args, env=None):
    return subprocess.check_output(['git', *args], cwd=ROOT, env=env)

def tree(ref):
    return {line.split('\t', 1)[1]: line.split('\t', 1)[0]
            for line in git('ls-tree', '-r', ref).decode().splitlines()}

def sha(value):
    return hashlib.sha256(value).hexdigest()

head = git('rev-parse', 'HEAD').decode().strip()
before, after = tree(BASE), tree(head)
deleted = sorted(set(before) - set(after))
changed = sorted(path for path in before if path in after and before[path] != after[path])
added = sorted(set(after) - set(before))
assert not deleted, deleted
tests = [path for path in changed if '/test/' in path]
rows = []
for path in tests:
    old, new = git('show', f'{BASE}:{path}'), git('show', f'{head}:{path}')
    declarations = lambda data: re.findall(rb'\b(?:test|it)\s*\(\s*[\'"`]([^\'"`]+)', data)
    assert declarations(old) == declarations(new), path
    assertions = lambda data: len(re.findall(rb'\bassert(?:\.[A-Za-z]+)?\s*\(', data))
    assert assertions(new) >= assertions(old), path
    rows.append({'path': path, 'beforeSha256': sha(old), 'afterSha256': sha(new),
                 'beforeTests': len(declarations(old)), 'afterTests': len(declarations(new)),
                 'beforeAssertions': assertions(old), 'afterAssertions': assertions(new)})
forward = git('diff', '--binary', BASE, head, '--', *tests)
inverse = git('diff', '--binary', head, BASE, '--', *tests)
with tempfile.TemporaryDirectory(prefix='meri-vertical-inverse-', dir='/tmp') as temp:
    env = {**os.environ, 'GIT_INDEX_FILE': str(Path(temp) / 'index')}
    git('read-tree', head, env=env)
    subprocess.run(['git', 'apply', '--cached', '--binary', '-'], cwd=ROOT, env=env,
                   input=inverse, check=True)
    restored = tree(git('write-tree', env=env).decode().strip())
    assert all(restored[path] == before[path] for path in tests)
    assert all(restored[path] == after[path] for path in after if path not in tests)
for name, data in [('final-test-expectation-forward.patch', forward),
                   ('final-test-expectation-inverse.patch', inverse)]:
    (OUT / name).write_bytes(data)
(OUT / 'final-test-expectation-changes.json').write_text(json.dumps({
    'base': BASE, 'head': head, 'changes': rows,
    'inverseRestoresEveryOriginalTestByte': True,
    'inverseChangesNoOtherPath': True,
    'newArtifactStageTest': 'packages/contracts/test/vertical-execution-integration-independent.test.mjs',
    'newArtifactStageNote': 'Not present at PR37; its later8 mapping expectation changes are separately preserved and independently reviewed in test-continuation-author/review.',
    'forwardSha256': sha(forward), 'inverseSha256': sha(inverse),
    'scope': 'Finite independently reviewed expectation changes; no assertion deletion or runtime admission.'
}, indent=2) + '\n')
protected = ['apps/worker/', 'apps/control/qualification-sdk-fixture/', 'packages/runtime/',
             'packages/contracts/qualification-sdk/', 'packages/contracts/dist/']
protected_files = [p for p in before if any(p.startswith(prefix) for prefix in protected)]
protected_files += [p for p in before if p.endswith('package.json') or p.endswith('package-lock.json')]
protected_files += ['packages/contracts/meri.schema.json', 'packages/contracts/validate.mjs',
                    'packages/contracts/generate.mjs', 'packages/contracts/README.md',
                    'packages/contracts/THIRD-PARTY-NOTICES.md']
assert all(before[p] == after[p] for p in protected_files)
result = {'base': BASE, 'head': head, 'originalEntries': len(before),
          'unchangedOriginalEntries': len(before)-len(changed), 'deletedEntries': deleted,
          'changedOriginalEntries': [{'path': p, 'beforeGitEntry': before[p], 'afterGitEntry': after[p]} for p in changed],
          'newEntries': len(added), 'originalTestPathsChanged': len(tests),
          'testDeclarationsRetained': sum(x['beforeTests'] for x in rows),
          'assertionCallsitesBefore': sum(x['beforeAssertions'] for x in rows),
          'assertionCallsitesAfter': sum(x['afterAssertions'] for x in rows),
          'protectedPrefixes': protected, 'protectedFileCount': len(set(protected_files)),
          'protectedFilesExact': True,
          'meaning': 'Original source is preserved except the explicit reviewed source/test deltas listed. No deleted paths; no public/dependency/native-owner edits.'}
(OUT / 'final-source-preservation.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k not in ['changedOriginalEntries', 'protectedPrefixes', 'meaning']}))
