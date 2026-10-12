"""Verify exact reviewed source, retained originals and completed local checks."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser(description=__doc__, epilog='Exit 0: verified receipt. Exit 1: mismatch. Exit 2: invalid arguments.')
parser.parse_args()
root = Path(__file__).resolve().parents[5]
evidence = Path(__file__).resolve().parent
base = '5db2714b6dcbd3109c528e0afafcb654216133ca'
author = '5ebe58d6480496689f409b03060b5fdb76c5d7fe'
review = 'fc725f80a52a13c3958fc615880f9d65821a95d7'
tested = '7fadbbf987b85755a39898527509e17953f1a750'


def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)


def sha(data):
    return hashlib.sha256(data).hexdigest()


source_paths = {
    'apps/gateway/dispatch/memory-read-context.mjs',
    'apps/gateway/dispatch/operation-context.mjs',
    'apps/gateway/dispatch/read-result-envelope.mjs',
    'apps/gateway/dispatch/tool-dispatch.mjs',
    'apps/gateway/test/memory-context-independent.test.mjs',
    'apps/gateway/test/memory-context.test.mjs',
    'packages/contracts/retrieval-0.2/catalog-validation.mjs',
}
changed = set(git('diff', '--name-only', base, '--', 'apps', 'packages', 'scripts',
                  'package.json', 'package-lock.json', 'docs/coordination/r2').decode().splitlines())
assert changed == source_paths, changed ^ source_paths
reviewed = []
for path in sorted(source_paths):
    owner = review if path.endswith('memory-context-independent.test.mjs') else author
    actual = (root / path).read_bytes()
    assert actual == git('show', f'{owner}:{path}'), path
    assert actual == git('show', f'{tested}:{path}'), path
    reviewed.append({'path': path, 'ownerCommit': owner, 'sha256': sha(actual), 'bytes': len(actual)})
for ancestor in [base, author, review, tested]:
    subprocess.run(['git', 'merge-base', '--is-ancestor', ancestor, 'HEAD'], cwd=root, check=True)
assert not git('diff', tested, '--', 'apps', 'packages', 'scripts', 'package.json', 'package-lock.json')

allowed = source_paths | {'docs/qualification/G1-REMAINING-WORK.md'}
base_paths = git('ls-tree', '-r', '--name-only', base).decode().splitlines()
preserved = []
for path in base_paths:
    if path not in allowed:
        actual = (root / path).read_bytes()
        assert actual == git('show', f'{base}:{path}'), f'Original changed: {path}'
        preserved.append({'path': path, 'sha256': sha(actual)})

checks = []
for label, count in [('combined-root', 244), ('combined-gateway', 146),
                     ('combined-independent', 35), ('combined-public', 7),
                     ('original-release-control', None)]:
    path = evidence / f'{label}.json'
    receipt = json.loads(path.read_text())
    assert receipt['sourceHead'] == tested and receipt['sourceDiffBytes'] == 0
    assert receipt['exitCode'] == 0 and not receipt['timedOut']
    assert receipt['ownedProcessGroupAbsent'] and not receipt['ownedGroupKillRequired']
    for stream in receipt['streams']:
        raw = (root / stream['path']).read_bytes()
        assert len(raw) == stream['bytes'] and sha(raw) == stream['sha256']
    stdout = (evidence / f'{label}.stdout.bin').read_text()
    if count is not None:
        assert re.search(rf'(?m)^.*tests {count}$', stdout)
        assert re.search(rf'(?m)^.*pass {count}$', stdout)
        assert re.search(r'(?m)^.*fail 0$', stdout)
    else:
        assert '"completedWithin100ms":true' in stdout and '"failureCode":"DEADLINE"' in stdout
    checks.append({'label': label, 'tests': count, 'receiptSha256': sha(path.read_bytes()),
                   'ownedProcessGroupAbsent': True, 'pidAndPgid': receipt['ownedPidAndPgid']})

acceptance_path = evidence.parent / 'review/acceptance.json'
acceptance = json.loads(acceptance_path.read_text())
assert acceptance['decision'] == 'ACCEPT_SOURCE' and acceptance['authorCommit'] == author
for record in acceptance['sourceFiles']:
    assert sha((root / record['path']).read_bytes()) == record['sha256']
for record in acceptance['independentChecks']:
    assert sha((acceptance_path.parent / record['receipt']).read_bytes()) == record['sha256']

catalog_path = 'packages/contracts/retrieval-0.2/catalog.json'
catalog_bytes = (root / catalog_path).read_bytes()
assert catalog_bytes == git('show', f'{base}:{catalog_path}')
catalog = json.loads(catalog_bytes)
originals = catalog['originals']
assert len(originals) == 139 and len(catalog['operations']) == 14
for row in catalog['operations']:
    assert row['handler'] is None and row['availability'] == 'unimplemented'
    assert row['qualification'] == 'pending' and row['retry']['maxRetries'] == 0
counts = {'original': len(originals),
          'selected': sum(row['disposition'] == 'selected' for row in originals),
          'deferred': sum(row['disposition'] == 'deferred' for row in originals),
          'boundUnavailable': sum(row['state'] == 'mapped' for row in originals),
          'selectedUnmapped': sum(row['disposition'] == 'selected' and row['state'] == 'pending' for row in originals)}
assert counts == {'original':139, 'selected':96, 'deferred':43, 'boundUnavailable':14, 'selectedUnmapped':82}
handoff = root / 'docs/coordination/reports/CAPIRO-MEMORY-WORDING-HANDOFF-20261012.md'
assert sha(handoff.read_bytes()) == 'de5ef566d45b74b0468e597ab991414b1730a0ccdc769edbf78e230201e2439f'
diagnostic = root / 'docs/qualification/candidates/native-capture-diagnosis-20261012/inspect-local-metadata.py'
assert sha(diagnostic.read_bytes()) == '3780982e6906e6798232d9a7d7f1c5efa07f6dd7b9a25356976a2a73ed026bd3'

result = {'decision':'ACCEPT_SOURCE_ONLY', 'testedSource':tested,
          'testedTree':git('rev-parse', f'{tested}^{{tree}}').decode().strip(),
          'preservedBase':base, 'author':author, 'review':review,
          'baseTrackedFiles':len(base_paths), 'unchangedBaseFiles':len(preserved),
          'preservedManifestSha256':sha(json.dumps(preserved, sort_keys=True).encode()),
          'reviewedSource':reviewed, 'checks':checks, 'counts':counts,
          'canonicalCatalogUnchanged':True, 'canonicalCatalogSha256':sha(catalog_bytes),
          'public01AndRawMemorySchemaUnchanged':True, 'originalControlsUnchanged':True,
          'all14OperationsUnavailable':True, 'runtimeAccepted':False, 'g1':'OPEN'}
(evidence / 'verification.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({key:value for key,value in result.items() if key not in ['reviewedSource','checks']}))
