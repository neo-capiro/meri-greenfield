"""Offline metadata checks only; never import or execute inspected application code."""
import hashlib
import json
import pathlib
import re
import subprocess
from decimal import Decimal

ROOT = pathlib.Path(__file__).resolve().parents[5]
PACKET = pathlib.Path(__file__).resolve().parent
BASE = 'f8e3507307640ee6b4904782cfb20f2b05e5e7b0'
CAPIRO = pathlib.Path('/workspace/capirov2')
REPORT = 'docs/coordination/reports/CODEX-ACTION-HOST-PILOT-20261013.md'
PREFIX = 'docs/qualification/candidates/action-host-20261013/pilot/'
checks = []
def check(name, value):
    checks.append({'name': name, 'passed': bool(value)})
def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args])
def read(name):
    return json.loads((PACKET / name).read_text())
def show(repo, ref, path):
    return git(repo, 'show', ref + ':' + path)
def identity(repo, row):
    ref = row.get('ref', row.get('commit'))
    raw = show(repo, ref, row['path'])
    check(row['path'] + ' exact bytes', len(raw) == row['bytes'] and hashlib.sha256(raw).hexdigest() == row['sha256'])
    check(row['path'] + ' blob', git(repo, 'rev-parse', ref + ':' + row['path']).decode().strip() == row['blob'])
    if 'observedRef' in row:
        observed = git(repo, 'rev-parse', row['observedRef'] + ':' + row['path']).decode().strip()
        check(row['path'] + ' paired identity', observed == row['observedBlob'] == row['blob'] and row['changed'] is False)

meri = read('meri-inventory.json')
capiro = read('capiro-provenance.json')
pilot = read('revised-pilot.json')
for row in meri['allEvalFiles']:
    identity(ROOT, row)
for row in read('local-references.json')['references']:
    identity(ROOT, row)
for row in capiro['primaryReferences']:
    identity(CAPIRO, row)
paths = git(ROOT, 'ls-tree', '-r', '--name-only', BASE, 'evals').decode().splitlines()
check('complete current eval path census', sorted(paths) == sorted(r['path'] for r in meri['allEvalFiles']) and len(paths) == 21)
check('27 paired legacy references', len(capiro['primaryReferences']) == 27)
check('zero qualified human provenance', meri['qualifiedHumanCases'] == capiro['qualifiedHumanCases'] == pilot['qualifiedRealRequests'] == 0)
manifest = json.loads(show(ROOT, BASE, 'evals/retrieval-r2/manifest.json'))
check('unchanged canonical received-real count', manifest['realRequestsReceived'] == 0 and manifest['caseIds'] == [])
ids = [f'{n:02}' for n in range(1, 76)]
check('75 spec and structured identities', [r['id'] for r in capiro['legacy75']['specRows']] == ids and [r['id'] for r in capiro['legacy75']['structuredRows']] == ids)
spec = show(CAPIRO, capiro['pin'], 'evals/meri/live-75-case-spec.md').decode().splitlines()
for row in capiro['legacy75']['specRows']:
    check('spec row ' + row['id'], hashlib.sha256(spec[row['line']-1].encode()).hexdigest() == row['rowSha256'])
structured = show(CAPIRO, capiro['pin'], 'evals/meri/simple/original-cases.mjs').decode().splitlines()
for row in capiro['legacy75']['structuredRows']:
    check('structured row ' + row['id'], bool(re.search(r"id:\s*['\"]" + row['id'] + r"['\"]", structured[row['line']-1])) and row['qualifiedForCurrentRealCorpus'] is False)
suite = json.loads(show(CAPIRO, capiro['pin'], 'evals/meri/suite-contract.json'))
check('26 synthetic mechanism cases', suite['totalCases'] == capiro['offline26']['declaredTotal'] == sum(capiro['offline26']['groupCounts'].values()) == 26)
goldens = git(CAPIRO, 'ls-tree', '-r', '--name-only', capiro['pin'], 'apps/api-strategy/eval/goldens').decode().splitlines()
check('14 strategy goldens', len([p for p in goldens if p.endswith('.json')]) == capiro['strategyGoldens']['files'] == 14)
check('75 adapted IDs distinct from human provenance', len(set(capiro['internalAdaptations']['declaredLiteralIds'] + capiro['internalAdaptations']['programTaskIds'])) == capiro['internalAdaptations']['totalDistinct'] == 75)
extension = show(CAPIRO, capiro['pin'], 'evals/meri/commitments-deliverables-extension.md').decode()
check('7 extension scenarios', sorted(set(re.findall(r'CD-0[1-7]', extension))) == capiro['commitmentsExtension']['ids'] == [f'CD-{n:02}' for n in range(1,8)])
extraction = json.loads(show(CAPIRO, capiro['pin'], '.session5-live/frozen-corpus.json'))
check('8 extraction entries are not human cases', len(extraction['entries']) == capiro['publicExtractionCorpus']['entries'] == 8)
route = json.loads(show(ROOT, BASE, 'apps/proxy/qualification/proxy-config.json'))['model_list'][0]
check('source-selected route', route['litellm_params']['model'] == pilot['model']['proxyRoute'] and route['litellm_params']['aws_region_name'] == pilot['model']['region'] and route['model_name'] == pilot['model']['localAlias'])
components = show(ROOT, BASE, 'docs/COMPONENTS.md').decode()
check('pinned SDK version', '@anthropic-ai/claude-agent-sdk' in components and pilot['model']['sdkVersion'] in components)
check('CountTokens source owner exists', b'count_tokens' in show(ROOT, BASE, 'apps/proxy/qualification/runtime/aws_counter.py'))
limits = pilot['limits']
check('18 plus18 distinct attempts', limits['inferenceAttemptsTotal'] + limits['countTokensAttemptsTotal'] == limits['providerHttpOperationsTotal'] == 36)
check('all six sessions retained', limits['humanRequests'] == limits['serialSessions'] == len(pilot['cases']) == 6 and limits['inferenceAttemptsPerSession'] * 6 == 18)
check('token totals', limits['inputTokensPerRequest'] * 18 == limits['inputTokensTotal'] == 144000 and limits['outputTokensPerRequest'] * 18 == limits['outputTokensTotal'] == 4608)
est = 12 * (4000 * Decimal('3.30') + 128 * Decimal('16.50')) / 1000000
maximum = 18 * (8000 * Decimal('3.30') + 256 * Decimal('16.50')) / 1000000
check('exact inference estimate', est == Decimal(pilot['costing']['estimatedUsd']) == Decimal('0.183744'))
check('exact inference maximum', maximum == Decimal(pilot['costing']['theoreticalMaximumUsd']) == Decimal('0.551232'))
check('separate unapproved inference ceiling', Decimal('0.75') == Decimal(pilot['costing']['proposedInferenceApprovalCeilingUsd']) > maximum and pilot['spendAuthorized'] is False and pilot['costing']['accountPricesVerified'] is False)
check('strict previous18 alternative9', pilot['operationAccounting']['strictPrior18TotalAlternative']['pairedInferencesMaximum'] == 18//2 == 9)
check('no calls or corpus relabeling', pilot['executedProviderCalls'] == pilot['realRequestsReceived'] == 0 and pilot['corpus']['caseTemplatesAreRealRequests'] is False)
old = json.loads(show(ROOT, BASE, pilot['previousProposal']['path']))
check('all prior literal templates preserved', pilot['cases'] == old['cases'])
old_prefix = 'docs/qualification/candidates/action-wiring-20261013/eval-proposal/'
old_files = git(ROOT, 'ls-tree', '-r', '--name-only', BASE, old_prefix).decode().splitlines()
check('all prior packet blobs unchanged', all(git(ROOT, 'rev-parse', BASE + ':' + p) == git(ROOT, 'rev-parse', 'HEAD:' + p) for p in old_files))
base_entries = dict(line.split(b'\t',1)[::-1] for line in git(ROOT,'ls-tree','-r',BASE).splitlines())
head_entries = dict(line.split(b'\t',1)[::-1] for line in git(ROOT,'ls-tree','-r','HEAD').splitlines())
check('all original tree entries preserved', all(head_entries.get(p) == value for p,value in base_entries.items()))
changed = set(git(ROOT,'diff','--name-only',BASE).decode().splitlines()) | set(git(ROOT,'ls-files','--others','--exclude-standard').decode().splitlines())
check('exclusive allocated paths', all(p == REPORT or p.startswith(PREFIX) for p in changed))
result = {'kind':'OFFLINE_METADATA_ONLY','base':BASE,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'originalEntries':len(base_entries),'oldPacketMembers':len(old_files),'checks':checks}
print(json.dumps(result, indent=2))
raise SystemExit(1 if result['failed'] else 0)
