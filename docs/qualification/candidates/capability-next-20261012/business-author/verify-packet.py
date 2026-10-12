"""Offline packet checks; no source/provider/native execution."""
from pathlib import Path
import hashlib
import json
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
checks = []


def check(label, value):
    checks.append({'check': label, 'passed': bool(value)})


def digest(data):
    return hashlib.sha256(data).hexdigest()


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, timeout=10)


manifest = json.loads((HERE / 'manifest.json').read_bytes())
for row in manifest['entries']:
    path = ROOT / row['path']
    check('contained path ' + row['path'], path.resolve().is_relative_to(ROOT))
    raw = path.read_bytes()
    check('manifest bytes ' + row['path'], len(raw) == row['bytes'] and digest(raw) == row['sha256'])

preservation = json.loads((HERE / 'source-preservation.json').read_bytes())
check('exact source/tree', git('rev-parse', preservation['source'] + '^{tree}').decode().strip() == preservation['sourceTree'])
check('sole existing-file change belongs to root', preservation['changedOriginalPaths'] == ['packages/contracts/retrieval-0.2/operation-contracts.mjs'])
check('root dependency source exact', git('show', preservation['rootDependencyOriginal'] + ':packages/contracts/retrieval-0.2/operation-contracts.mjs') == git('show', preservation['rootDependencyCherryPick'] + ':packages/contracts/retrieval-0.2/operation-contracts.mjs'))
for row in preservation['ownNewSourceFiles']:
    raw = git('show', preservation['source'] + ':' + row['path'])
    check('frozen source ' + row['path'], len(raw) == row['bytes'] and digest(raw) == row['sha256'])
    check('working source ' + row['path'], (ROOT / row['path']).read_bytes() == raw)
check('no original tests changed', preservation['originalTestsChanged'] == [])

for label, code, count in [('focused-first', 1, None), ('focused-second', 0, 31), ('focused-canonical', 0, 33), ('original-contracts', 0, 295)]:
    receipt = json.loads((HERE / (label + '.json')).read_bytes())
    check(label + ' exit', receipt['exitCode'] == code and not receipt['timedOut'])
    check(label + ' group absent', receipt['ownedProcessGroupAbsent'] and not receipt['ownedGroupKillRequired'])
    for stream in receipt['streams']:
        raw = (ROOT / stream['path']).read_bytes()
        check(label + ' stream', len(raw) == stream['bytes'] and digest(raw) == stream['sha256'])
    if count is not None:
        raw = (HERE / (label + '.stdout.bin')).read_text()
        check(label + ' count', f'ℹ pass {count}\n' in raw and 'ℹ fail 0\n' in raw)
    if label == 'focused-first':
        check('original strict compiler failure retained', 'strictTypes' in (HERE / (label + '.stdout.bin')).read_text())
    if label == 'focused-second':
        check('pre-helper exact patch retained', digest((HERE / 'source-before-snapshot.patch').read_bytes()) == receipt['sourceDiffSha256'])
    if label == 'focused-canonical':
        check('validated source exact patch retained', digest((HERE / 'source-validated.patch').read_bytes()) == receipt['sourceDiffSha256'])
    if label == 'original-contracts':
        check('root tests exact frozen source', receipt['sourceHead'] == preservation['source'] and receipt['sourceDiffBytes'] == 0)
first = HERE / 'failures/focused-first'
for row in json.loads((first / 'source-identities.json').read_bytes())['files']:
    raw = (first / Path(row['path']).name).read_bytes()
    check('initial failure source ' + row['path'], len(raw) == row['bytes'] and digest(raw) == row['sha256'])

result = {'scope': 'OFFLINE_SOURCE_EVIDENCE_ONLY', 'source': preservation['source'],
          'passed': sum(row['passed'] for row in checks), 'failed': sum(not row['passed'] for row in checks), 'checks': checks}
print(json.dumps(result, indent=2))
raise SystemExit(0 if result['failed'] == 0 else 1)
