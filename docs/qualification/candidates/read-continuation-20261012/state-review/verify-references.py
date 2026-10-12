"""Offline metadata-only replay; never import or publish private source bodies."""
from pathlib import Path
import hashlib
import json
import subprocess

evidence = Path(__file__).resolve().parent
packet = json.loads((evidence / 'reference-identities.json').read_text())
repository = Path('/workspace/capirov2')
checks = []


def check(name, actual, expected):
    checks.append({'name': name, 'passed': actual == expected})


for ref in packet['references']:
    path = ref['path']
    raw = subprocess.check_output(['git', 'show', f"{packet['sourceCommit']}:{path}"], cwd=repository)
    blob = subprocess.check_output(['git', 'rev-parse', f"{packet['sourceCommit']}:{path}"], cwd=repository, text=True).strip()
    observed = subprocess.check_output(['git', 'rev-parse', f"{packet['observedCommit']}:{path}"], cwd=repository, text=True).strip()
    check(path + ':pinned-blob', blob, ref['blob'])
    check(path + ':observed-blob', observed, ref['observedBlob'])
    check(path + ':no-drift', observed, blob)
    check(path + ':sha256', hashlib.sha256(raw).hexdigest(), ref['sha256'])
    check(path + ':bytes', len(raw), ref['bytes'])

print(json.dumps({'scope': 'OFFLINE_REFERENCE_METADATA_ONLY', 'passed': sum(x['passed'] for x in checks),
                  'total': len(checks), 'privateBodiesPublished': False, 'sourceExecuted': False,
                  'checks': checks}, indent=2))
raise SystemExit(0 if all(x['passed'] for x in checks) else 1)
