"""Offline exact-byte and review-boundary checks; no runtime or source execution."""
from pathlib import Path
import hashlib
import json
import subprocess

evidence = Path(__file__).resolve().parent
root = evidence.parents[4]
base = 'f45f155d0128ae4ac269989f60121e4f04b207de'
candidate = '3444e7fd48fe07a9df23fe5ee460cea22f886012'
source_paths = [
    'packages/contracts/retrieval-0.2/state-legislation.schema.json',
    'packages/contracts/retrieval-0.2/state-legislation-validation.mjs',
    'packages/contracts/test/retrieval-state-legislation.test.mjs',
]
own_test = 'packages/contracts/test/retrieval-state-legislation-independent.test.mjs'
report = 'docs/coordination/reports/CODEX-READ-CONTINUATION-STATE-REVIEW-20261012.md'
prefix = 'docs/qualification/candidates/read-continuation-20261012/'
checks = []
files = []


def check(name, passed):
    checks.append({'name': name, 'passed': bool(passed)})


def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)


for path in source_paths:
    pinned = git('show', f'{candidate}:{path}')
    actual = (root / path).read_bytes()
    check(path + ':exact-candidate', actual == pinned)
    files.append({'path': path, 'sha256': hashlib.sha256(actual).hexdigest(), 'bytes': len(actual),
                  'candidateBlob': git('rev-parse', f'{candidate}:{path}').decode().strip()})
changes = git('diff', '--name-only', base, 'HEAD').decode().splitlines()
for path in changes:
    check('allocated:' + path, path in source_paths + [own_test, report] or
          path.startswith(prefix + 'state-review/') or path.startswith(prefix + 'state-author/'))
for path in ['packages/contracts/retrieval-0.2/catalog.json',
             'packages/contracts/retrieval-0.2/operation-contracts.mjs',
             'packages/contracts/retrieval-0.2/validate.mjs']:
    check(path + ':baseline-preserved', (root / path).read_bytes() == git('show', f'{base}:{path}'))
for label in ['reference-verification', 'independent-first', 'state-combined']:
    receipt = json.loads((evidence / f'{label}.json').read_text())
    check(label + ':exit', receipt['exitCode'] == 0 and not receipt['timedOut'])
    check(label + ':cleanup', receipt['ownedProcessGroupAbsent'])
    check(label + ':clean-source', receipt['sourceDiffBytes'] == 0)
    for stream in receipt['streams']:
        raw = (root / stream['path']).read_bytes()
        check(stream['path'] + ':hash', hashlib.sha256(raw).hexdigest() == stream['sha256'])
        check(stream['path'] + ':bytes', len(raw) == stream['bytes'])
first = json.loads((root / (prefix + 'state-author/focused-first.json')).read_text())
check('author-initial-failure-preserved', first['exitCode'] != 0 and first['ownedProcessGroupAbsent'])
check('state-independent-count', 'tests 27' in (evidence / 'state-combined.stdout.bin').read_text() or
      'tests 47' in (evidence / 'state-combined.stdout.bin').read_text())
print(json.dumps({'scope': 'SOURCE_ONLY_EXACT_BYTES_AND_PRESERVATION', 'candidate': candidate,
                  'base': base, 'passed': sum(c['passed'] for c in checks), 'total': len(checks),
                  'files': files, 'checks': checks}, indent=2))
raise SystemExit(0 if all(c['passed'] for c in checks) else 1)
