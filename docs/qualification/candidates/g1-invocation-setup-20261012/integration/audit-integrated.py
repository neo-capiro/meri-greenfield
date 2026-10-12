"""Read-only integrated Git/evidence audit; no runtime candidate imports."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
BASE = '6cfb1f9a4d8acd66c5bd8d38d892d656fa3cd89e'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def ident(raw):
    return {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

def tree(commit):
    return {r.split(b'\t', 1)[1].decode(): r.split(b'\t', 1)[0]
            for r in git('ls-tree', '-rz', commit).split(b'\0') if r}

baseline, current = tree(BASE), tree('HEAD')
expected = {
    'apps/gateway/budget/README.md',
    'apps/gateway/budget/durable-tool-dispatch.mjs',
    'apps/gateway/budget/postgres-tool-budget.mjs',
    'apps/gateway/budget/postgres-budget-store.mjs',
    'apps/gateway/dispatch/tool-dispatch.mjs',
    'apps/proxy/qualification/state/postgres_store.py',
    'docs/plans/MERI-G1-SOURCE-TO-NATIVE.md',
}
changed = {p for p, oid in baseline.items() if current.get(p) != oid}
assert changed == expected, sorted(changed)
lanes = json.loads((HERE / 'accepted-lanes.json').read_text())
lane_results = []
for lane in lanes:
    commit = lane['commit']
    paths = git('diff', '--name-only', BASE, commit).decode().splitlines()
    for path in paths:
        assert (ROOT / path).read_bytes() == git('show', commit + ':' + path), path
    lane_results.append({**lane, 'filesMatched': len(paths),
                         'tree': git('rev-parse', commit + '^{tree}').decode().strip()})

receipts = []
for path in sorted(HERE.glob('*.json')):
    record = json.loads(path.read_text())
    if not isinstance(record, dict) or 'captureSha256' not in record:
        continue
    expected_exit = 1 if path.stem == 'native-prefix-integrated' else 0
    assert record['exitCode'] == expected_exit and not record['timedOut'], path.name
    assert record['ownedProcessGroupAbsent'] and record['sourceDiffBytes'] == 0, path.name
    assert record['captureSha256'] == ident((HERE / 'capture-reaped.py').read_bytes())['sha256']
    for stream in record['streams']:
        assert ident((ROOT / stream['path']).read_bytes()) == {k: stream[k] for k in ('bytes', 'sha256')}
    receipts.append({'label': path.stem, 'exitCode': record['exitCode'],
                     'ownedProcessGroupAbsent': True, 'streamsMatched': len(record['streams'])})

# The native assessment deliberately froze the old roadmap; retain its failing
# current-tree assertion and verify that historical binding against its own base.
prefix = ROOT / 'docs/qualification/candidates/native-prefix-20261012/author'
packet = json.loads((prefix / 'assessment.json').read_text())
pin = next(r for r in packet['sourceBindings'] if r['path'] == 'docs/plans/MERI-G1-SOURCE-TO-NATIVE.md')
assert ident(git('show', BASE + ':' + pin['path'])) == {k: pin[k] for k in ('bytes', 'sha256')}
replay = json.loads((HERE / 'native-prefix-integrated.stdout.bin').read_bytes())
assert replay['passed'] == 281 and replay['failed'] == 1
assert [r['name'] for r in replay['checks'] if not r['passed']] == ['frozen source: ' + pin['path']]

# Screen supplied private values without publishing the values themselves.
private = Path('/workspace/private-native-supervisor-relay-20261012')
needles = set()
def collect(value):
    if isinstance(value, str) and re.match(r'^[A-Za-z]:[\\/]', value) and not re.fullmatch(r'[A-Za-z]:[\\/]', value):
        needles.update((value.encode(), json.dumps(value)[1:-1].encode()))
    elif isinstance(value, dict):
        for child in value.values(): collect(child)
    elif isinstance(value, list):
        for child in value: collect(child)

for name in ('supervisor-source-review.verified.json', 'provenance-and-bindings.verified.json'):
    raw = (private / name).read_bytes()
    needles.add(raw)
    collect(json.loads(raw))
paths = set(git('diff', '--name-only', BASE, 'HEAD').decode().splitlines())
paths.update(git('ls-files', '--others', '--exclude-standard').decode().splitlines())
for path in paths:
    raw = (ROOT / path).read_bytes()
    assert not any(n in raw for n in needles), 'Private material: ' + path
    assert not re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-proj-[A-Za-z0-9_-]{20,}', raw), 'Credential marker: ' + path

result = {
    'decision': 'PASS_SOURCE_AND_EVIDENCE_INTEGRITY_ONLY',
    'head': git('rev-parse', 'HEAD').decode().strip(), 'base': BASE,
    'originalFiles': len(baseline), 'unchangedOriginalFiles': len(baseline) - len(changed),
    'changedOriginalPaths': sorted(changed), 'acceptedLanes': lane_results,
    'allOriginalTestsContractsLocksMigrationsPreserved': True,
    'frozenL1AndImagePacketsPreserved': True, 'captureReceipts': receipts,
    'historicalRoadmapPin': {'matchesOwnBase': True, 'currentReplay': '281 PASS / 1 retained expected roadmap hash failure'},
    'privacyScreen': {'files': len(paths), 'knownPrivateNeedles': len(needles), 'matches': 0,
                      'limitation': 'Known supplied private bodies/paths and named credential markers only.'},
    'nativeImportsOrExecution': False,
}
name = sys.argv[1]
assert re.fullmatch(r'[a-z-]+\.json', name)
with (HERE / name).open('x') as output:
    output.write(json.dumps(result, indent=2) + '\n')
print(json.dumps({'decision': result['decision'], 'originalFiles': len(baseline),
                  'unchanged': result['unchangedOriginalFiles'], 'laneFiles': sum(r['filesMatched'] for r in lane_results),
                  'receiptGroupsAbsent': len(receipts), 'privacyFiles': len(paths)}))
