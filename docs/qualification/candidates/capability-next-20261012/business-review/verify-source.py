"""Offline Git/data audit; never imports a producer or candidate runtime."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[5]
SOURCE = 'bf9a06cfba22c5c3bac87949689348b16febcbc5'
AUTHOR = '92d90eaee967d675724a3b8ce4079121e1961f9a'
BASE = 'e0163fb65a639a28d9423e929058b40b48cc556d'
DEPENDENCY = '443814c519edacb88eeae215d6f0c41c57e51a96'
ROOT_DEPENDENCY = '685fe100233da10991485be49b2a1e8e31dd8308'
FAMILY = [
    'packages/contracts/retrieval-0.2/business-development.schema.json',
    'packages/contracts/retrieval-0.2/business-development-validation.mjs',
    'packages/contracts/test/retrieval-business-development.test.mjs',
]
HELPER = 'packages/contracts/retrieval-0.2/operation-contracts.mjs'
checks = []


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def blob(commit, path):
    return git('show', f'{commit}:{path}')


def tree(commit):
    result = {}
    for row in git('ls-tree', '-rz', commit).split(b'\0'):
        if row:
            metadata, path = row.split(b'\t', 1)
            result[path.decode()] = metadata.decode()
    return result


def check(name, value):
    checks.append({'name': name, 'pass': bool(value)})


before, source, author = tree(BASE), tree(SOURCE), tree(AUTHOR)
changed = [path for path in before if before[path] != source.get(path)]
check('all original paths preserved except exact root-owned export', changed == [HELPER])
check('shared helper dependency equals root source',
      blob(SOURCE, HELPER) == blob(DEPENDENCY, HELPER) == blob(ROOT_DEPENDENCY, HELPER))
check('family commit adds exactly three allocated files',
      set(source) - set(tree(DEPENDENCY)) == set(FAMILY))
check('family commit changes no dependency paths',
      all(source[path] == value for path, value in tree(DEPENDENCY).items()))
source_files = []
for path in FAMILY:
    raw = blob(SOURCE, path)
    check(f'exact source and final packet bytes: {path}',
          (ROOT / path).read_bytes() == raw == blob(AUTHOR, path))
    source_files.append({'path': path, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
check('all prior contract tests unchanged', all(source[p] == value for p, value in before.items()
      if p.startswith('packages/contracts/test/')))
check('public distribution and all dependency manifests unchanged',
      all(source[p] == value for p, value in before.items()
          if '0.1' in p or p.endswith(('package.json', 'package-lock.json'))))
check('catalog and loader unchanged by family', all(source[p] == before[p] for p in [
    'packages/contracts/validate.mjs', 'packages/contracts/retrieval-0.2/validate.mjs',
    'packages/contracts/retrieval-0.2/catalog.json']))
manifest_path = 'docs/qualification/candidates/capability-next-20261012/business-author/manifest.json'
manifest_raw = blob(AUTHOR, manifest_path)
manifest = json.loads(manifest_raw)
check('author manifest exact recorded identity', hashlib.sha256(manifest_raw).hexdigest() ==
      '29ee050d6de12c02f13783d69ea711171ee5a4a99859b5f457841e65f2bbe66a')
check('author manifest source freeze', manifest['sourceCommit'] == SOURCE)
for row in manifest['entries']:
    raw = blob(AUTHOR, row['path'])
    check(f'author packet member: {row["path"]}', len(raw) == row['bytes'] and
          hashlib.sha256(raw).hexdigest() == row['sha256'])
evidence = Path(__file__).resolve().parent
refs = json.loads((evidence / 'pinned-reference-identities.json').read_text())
check('all 18 inspected reference identities have no observed drift',
      len(refs['references']) == 18 and all(not row['drift'] for row in refs['references']))
check('exact 45 fact allowlist equality recorded', json.loads((evidence / 'allowlist-match.json').read_text())['matched'])
for name, expected in [('independent-first', 39), ('full-source', 334)]:
    receipt = json.loads((evidence / f'{name}.json').read_text())
    check(f'{name} source-only capture exited and owned group absent', receipt['exitCode'] == 0 and
          receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and not receipt['ownedGroupKillRequired'])
    for row in receipt['streams']:
        raw = (ROOT / row['path']).read_bytes()
        check(f'{name} exact stream {Path(row["path"]).suffix}', len(raw) == row['bytes'] and
              hashlib.sha256(raw).hexdigest() == row['sha256'])
    output = (evidence / f'{name}.stdout.bin').read_text()
    check(f'{name} expected test total', f'pass {expected}' in output and 'fail 0' in output)
result = {'sourceCommit': SOURCE, 'authorEvidenceCommit': AUTHOR,
          'originalPaths': len(before), 'originalIdentical': len(before)-len(changed),
          'expectedOriginalChanges': changed, 'sourceFiles': source_files,
          'authorManifestMembers': len(manifest['entries']), 'checks': checks,
          'passed': sum(row['pass'] for row in checks), 'failed': sum(not row['pass'] for row in checks),
          'sourceExecution': False, 'runtimeAccepted': False}
print(json.dumps(result, indent=2))
raise SystemExit(0 if not result['failed'] else 1)
