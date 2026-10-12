"""Offline Git/data/link checks for the exact reviewed integration documentation.

Usage: python audit-final-docs.py ROOT EXACT_COMMIT
No target-source imports, native target commands, network or mutation of ROOT.
Semantic conclusions are separately recorded by the independent reviewer.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(sys.argv[1]).resolve()
FREEZE = sys.argv[2]
HERE = Path(__file__).resolve().parent
BASE = '6cfb1f9a4d8acd66c5bd8d38d892d656fa3cd89e'
PLAN = 'docs/plans/MERI-G1-SOURCE-TO-NATIVE.md'
REPORT = 'docs/coordination/reports/MERI-G1-INVOCATION-SETUP-20261012.md'
PREFIX = 'docs/qualification/candidates/g1-invocation-setup-20261012/integration/'
checks = []

def check(name, passed, detail=None):
    checks.append({'name': name, 'passed': bool(passed), 'detail': detail})

def git(*args):
    return subprocess.run(['git', '-C', str(ROOT), *args], capture_output=True, check=True, timeout=30).stdout

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

check('exact-root-head', git('rev-parse', 'HEAD').decode().strip() == FREEZE)
parent = git('rev-parse', FREEZE + '^').decode().strip()
tree = git('rev-parse', FREEZE + '^{tree}').decode().strip()
changes = [line.split('\t') for line in git('diff', '--name-status', parent, FREEZE).decode().splitlines()]
check('final-freeze-documentation-only', all(path.startswith('docs/') for _, path in changes), changes)
prerequisites = json.loads((HERE / 'prerequisite-audit.json').read_bytes())
for row in prerequisites['protectedInputs']:
    raw = (ROOT / row['path']).read_bytes()
    check('frozen-input:' + row['path'], len(raw) == row['bytes'] and sha(raw) == row['sha256'] and git('show', BASE + ':' + row['path']) == raw)
plan = (ROOT / PLAN).read_text()
report = (ROOT / REPORT).read_text()
anchors = []
for name, body in [(PLAN, plan), (REPORT, report)]:
    raw = (ROOT / name).read_bytes()
    anchors.append({'path': name, 'bytes': len(raw), 'sha256': sha(raw)})
    check('exact-frozen-bytes:' + name, git('show', FREEZE + ':' + name) == raw)
    missing = []
    links = []
    for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', body):
        if target.startswith(('https://', 'http://', '#')):
            continue
        target = target.split('#', 1)[0]
        resolved = (ROOT / name).parent / target
        links.append(target)
        if not resolved.exists(): missing.append(target)
    check('local-links:' + name, not missing, {'checked': len(links), 'missing': missing})
rows = json.loads((ROOT / PREFIX / 'pr-stack-observation.json').read_bytes())['prs']
previous = None
for row in rows:
    result = subprocess.run(['git', '-C', str(ROOT), 'merge-base', '--is-ancestor', row['base_sha'], row['head_sha']], capture_output=True, timeout=30)
    check('ancestry-and-roadmap:PR' + str(row['number']), result.returncode == 0 and (previous is None or row['base_sha'] == previous) and row['head_sha'] in plan)
    previous = row['head_sha']
check('historical-roadmap-baseline-preserved', sha(git('show', BASE + ':' + PLAN)) == json.loads((HERE / 'frozen-criteria.json').read_bytes())['historicalRoadmap']['sha256'])
legacy = json.loads((ROOT / PREFIX / 'native-prefix-integrated.stdout.bin').read_bytes())
failed = [r for r in legacy['checks'] if not r['passed']]
check('prefix-only-historical-roadmap-failure-retained', legacy['passed'] == 281 and legacy['failed'] == 1 and failed == [{'name': 'frozen source: ' + PLAN, 'passed': False}], failed)
original = json.loads((ROOT / 'docs/qualification/candidates/native-prefix-20261012/author/verification.json').read_bytes())
check('prefix-original282-pass-retained', original['passed'] == 282 and original['failed'] == 0)
check('final-doc-whitespace', not git('diff', '--check', parent, FREEZE, '--', PLAN, REPORT))
result = {'base': BASE, 'rootFreeze': FREEZE, 'rootParent': parent, 'rootTree': tree, 'documentAnchors': anchors,
          'method': 'Offline Git metadata, JSON, hashing and local link reads only',
          'checks': checks, 'passed': sum(r['passed'] for r in checks), 'failed': sum(not r['passed'] for r in checks),
          'nativeExecution': False, 'targetImported': False, 'runtimeAccepted': False, 'ownedJobsRemaining': 0}
(HERE / 'final-doc-audit.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'passed': result['passed'], 'failed': result['failed'], 'rootFreeze': FREEZE}))
sys.exit(0 if not result['failed'] else 1)
