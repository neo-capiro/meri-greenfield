"""Offline proposal integrity/arithmetic only; no model, network or target execution."""
import hashlib
import json
import subprocess
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
BASE = 'f3127d742b6b4ec556b00dba939d35e5622a9ad1'
REPORT = 'docs/coordination/reports/CODEX-ACTION-WIRING-EVAL-PROPOSAL-20261013.md'
PACKET = 'docs/qualification/candidates/action-wiring-20261013/eval-proposal/'
checks = []

def check(name, value):
    checks.append({'name': name, 'passed': bool(value)})

def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])

p = json.loads((HERE / 'pilot-proposal.json').read_text())
l, c = p['limits'], p['costing']
check('six distinct literal prompt templates, not received real corpus', len(p['cases']) == 6 and len({x['id'] for x in p['cases']}) == 6 and all(x['promptTemplate'] and x['goldOutline'] for x in p['cases']) and p['realRequestsReceived'] == 0)
check('provider and identity', p['model']['provider'] == 'Amazon Bedrock' and p['model']['profile'] == 'us.anthropic.claude-sonnet-4-6' and p['model']['sdkVersion'] == '0.3.295')
check('bounded sessions and all provider requests', l['serialSessions'] == 6 and l['providerRequestsTotal'] == l['serialSessions'] * l['providerRequestsPerSession'] == 18)
check('total input/output limits', l['inputTokensTotal'] == 18 * 8000 and l['outputTokensTotal'] == 18 * 256)
rate_in = Decimal(c['maximumAdmittedRatesPerMillion']['input'])
rate_out = Decimal(c['maximumAdmittedRatesPerMillion']['output'])
maximum = (l['inputTokensTotal'] * rate_in + l['outputTokensTotal'] * rate_out) / 1000000
estimate = c['estimatedCalls'] * (c['estimatedInputPerCall'] * rate_in + c['estimatedOutputPerCall'] * rate_out) / 1000000
check('exact maximum arithmetic', maximum == Decimal(c['theoreticalMaximumUsd']) == Decimal('0.551232'))
check('exact estimate arithmetic', estimate == Decimal(c['estimatedUsd']) == Decimal('0.183744'))
check('new bounded proposal, no old allowance reuse', maximum <= Decimal(c['proposedInferenceApprovalCeilingUsd']) == Decimal('0.75') and not p['spendAuthorized'] and p['historical10UsdRemainder'] == 'UNKNOWN_NOT_USED')
check('prices and runtime not manufactured', not c['accountPricesVerified'] and p['status'] == 'PROPOSAL_NOT_EXECUTABLE' and p['executedProviderCalls'] == 0)
check('no extra model services/cache', all(l[k] == 0 for k in ['retries', 'fallbacks', 'subagents', 'paidJudges', 'serverTools']) and l['cache'] == 'DISABLED_REQUIRED')
check('full main gates preserved', p['scoring']['mainGatesUnchanged'] == {'realSeeds':75,'expandedCases':200,'originalRealTasks':60,'completionPercent':90,'factualCorrectnessPercent':95,'adversarialIsolationCases':100})
front = json.loads((HERE / 'frontend-reference-identities.json').read_text())
check('six pinned frontend source references without bodies', len(front['files']) == 6 and not front['privateBodiesRetained'] and all(x['ref'] == '7c87678730538958ace9762f824dc3e588bf445b' and len(x['blob']) == 40 and 'content' not in x for x in front['files']))
for ref in json.loads((HERE / 'local-reference-identities.json').read_text())['files']:
    body = git('show', ref['commit'] + ':' + ref['path'])
    check('reference:' + ref['path'], len(body) == ref['bytes'] and hashlib.sha256(body).hexdigest() == ref['sha256'] and git('rev-parse', ref['commit'] + ':' + ref['path']).decode().strip() == ref['blob'])
changed = git('diff', '--name-only', BASE, 'HEAD').decode().splitlines()
dirty = git('diff', '--name-only', 'HEAD').decode().splitlines()
untracked = git('ls-files', '--others', '--exclude-standard').decode().splitlines()
check('exclusive allocated paths', all(x == REPORT or x.startswith(PACKET) for x in changed + dirty + untracked))
entries = git('ls-tree', '-r', BASE).decode().splitlines()
current = dict(line.split('\t', 1)[::-1] for line in git('ls-tree', '-r', 'HEAD').decode().splitlines())
check('all original tracked tree entries preserved', all(current.get(line.split('\t', 1)[1]) == line.split('\t', 1)[0] for line in entries))
result = {'status': 'PASS' if all(x['passed'] for x in checks) else 'FAIL', 'checks': checks, 'passed': sum(x['passed'] for x in checks), 'failed': sum(not x['passed'] for x in checks), 'baselineEntriesVerified': len(entries), 'paidCalls': 0, 'nativeOrDatabaseExecution': False}
print(json.dumps(result, indent=2))
raise SystemExit(0 if result['status'] == 'PASS' else 1)
