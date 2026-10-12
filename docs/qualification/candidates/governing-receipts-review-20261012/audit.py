#!/usr/bin/env python3
"""Independent immutable Git/JSON audit; never imports the author's generators."""
import collections
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

BASE = 'f7db1ae9557d14f227a32dcc891ce5cbaecc7ff4'
CANDIDATE = sys.argv[1]
P = 'docs/qualification/candidates/read-continuation-20261012/plan-receipt-join/'
LEDGER = 'docs/qualification/candidates/read-continuation-20261012/plan-reconciliation/normative-id-ledger.json'
REPORT = 'docs/coordination/reports/CODEX-PLAN-RECEIPT-JOIN-20261012.md'
TASK = 'docs/coordination/tasks/CODEX-PLAN-RECEIPT-JOIN-20261012.md'
checks = []

def git(*args):
    return subprocess.check_output(['git', *args])

def raw(ref, path):
    return git('show', ref + ':' + path)

def data(path, ref=CANDIDATE):
    return json.loads(raw(ref, path))

def sha(value):
    return hashlib.sha256(value).hexdigest()

def blob(value):
    return hashlib.sha1(b'blob ' + str(len(value)).encode() + b'\0' + value).hexdigest()

def check(value, name):
    checks.append({'name': name, 'pass': bool(value)})

def tree(ref):
    result = {}
    for entry in git('ls-tree', '-rz', ref).split(b'\0'):
        if entry:
            meta, path = entry.split(b'\t', 1)
            result[path.decode()] = meta.decode()
    return result

baseline = data(LEDGER, BASE)['requirements']
joined = data(P + 'requirements.json')
receipts = data(P + 'receipts.json')
boundary = data(P + 'boundaries.json')
plan = raw(BASE, 'docs/plans/MERI-DEPLOYMENT.md').decode().splitlines()
expected_ids = ([f'W{i:02}' for i in range(12)] + [f'R-{i:02}' for i in range(1, 13)]
                + [f'REL-{i:02}' for i in range(1, 10)] + [f'G{i}' for i in range(8)]
                + [f'RG-{i:02}' for i in range(1, 13)])

def structural_errors(document, registry):
    errors = []
    rows = document['requirements']
    if [r['id'] for r in rows] != expected_ids:
        errors.append('exact53membership')
    by_id = {r['id']: r for r in registry['receipts']}
    if len(by_id) != len(registry['receipts']):
        errors.append('duplicateReceipt')
    original_by_id = {r['id']: r for r in baseline}
    for r in rows:
        original = original_by_id.get(r['id'])
        if not original or (r['originalLocator'], r['originalRequirement']) != (original['locator'], original['requirement']):
            errors.append('originalRequirement')
        if r['status'] != ('completed-source' if r['id'] in {'W00', 'G0'} else 'pending') or r['qualifiedRuntime'] is not False:
            errors.append('wholeGatePromotion')
        if not all(isinstance(r[k], str) and r[k].strip() for k in ['owner', 'remaining', 'nextParallelSourceOrMetadataWork', 'decisionOrExternalPrerequisite', 'completedSourceComponents']):
            errors.append('missingActionableOwnerOrGap')
        for receipt_id in r['sourceReceiptIds'] + r['reportedRuntimeReceiptIds']:
            if receipt_id not in by_id:
                errors.append('danglingReceipt')
    for receipt_id in ['native-reported', 'sdk-image-reported', 'shipping-reported', 'frontend-earlier-cohort']:
        r = by_id[receipt_id]
        if r.get('qualifiedRuntimeByThisLane') is not False or 'parent-reported' not in r['provenance'] or 'identity' in r:
            errors.append('promotedParentReport')
    return errors

check(joined['base'] == receipts['base'] == BASE, 'exact governing base')
check(structural_errors(joined, receipts) == [], 'independent structural and provenance oracle')
check([r['id'] for r in baseline] == expected_ids, 'baseline exact53 normative families')
for r, old in zip(joined['requirements'], baseline):
    label = r['id']
    check(r['originalRequirement'] == plan[r['originalLocator']['line'] - 1], label + ' exact governing plan line')
    check(r['originalRecordSha256'] == sha(json.dumps(old, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()), label + ' original full record identity')
    check(bool(r['sourceReceiptIds']), label + ' supporting receipt links')
    check(all(isinstance(r[k], list) for k in ['sourceReceiptIds', 'reportedRuntimeReceiptIds']), label + ' receipt lists')
optional_ids = {'R-11', 'R-12', 'REL-07', 'REL-08', 'RG-10', 'RG-11'}
check({r['id'] for r in joined['requirements'] if r['optional']} == optional_ids, 'six optional obligations retained')
check(all('disabled/shadow' in r['optionalDisposition'] for r in joined['requirements'] if r['optional']), 'optional qualification remains distinct')
check(boundary['gateStates'] == {'G0': 'accepted discovery', 'G1': 'OPEN', **{f'G{i}': 'unentered' for i in range(2, 8)}}, 'exact G0-G7 states')

by_id = {r['id']: r for r in receipts['receipts']}
check(len(by_id) == len(receipts['receipts']) and len(by_id) >= 20, 'unique original and added discovery receipt records')
source_ids = []
for r in receipts['receipts']:
    if 'identity' not in r:
        continue
    ident = r['identity']
    value = raw(ident['ref'], ident['path'])
    check((len(value), sha(value), blob(value)) == (ident['bytes'], ident['sha256'], ident['gitBlob']), r['id'] + ' actual immutable Git bytes')
    check(bool(r.get('supportedClaim')) and bool(r.get('limit')), r['id'] + ' scope and limit explicit')
    source_ids.append(ident)
check(source_ids == data(P + 'source-identities.json')['records'], 'source identity ledger exactly matches receipt links')
check(joined['originalIndex'] == by_id['plan-index']['identity'], 'original index identity')
rows_by_id = {r['id']: r for r in joined['requirements']}
w00_receipt_paths = {by_id[r]['identity']['path'] for r in rows_by_id['W00']['sourceReceiptIds'] if 'identity' in by_id[r]}
check({'docs/coordination/reports/CODEX-G0-DISCOVERY.md', 'docs/coordination/reports/CODEX-R2-ADOPTION.md'} <= w00_receipt_paths, 'W00 completed discovery has exact prior acceptance and adopted plan receipts')
check(not rows_by_id['W00']['reportedRuntimeReceiptIds'] and 'native-reported' not in rows_by_id['W00']['sourceReceiptIds'], 'later native observations do not reopen discovery')
check(all('unrun' not in rows_by_id[k]['remaining'].lower() for k in ['REL-07', 'REL-08']), 'optional other-owner execution not globally asserted unrun')
check(by_id['combined-review']['identity']['ref'] == 'd0b181e312b797e0fe181c16be814da23e126767', 'exact accepted independent source verdict')
accepted_report = raw(by_id['combined-review']['identity']['ref'], by_id['combined-review']['identity']['path']).decode()
check('**ACCEPT_SOURCE**' in accepted_report and boundary['acceptedRead']['source'] in accepted_report, 'verdict covers exact accepted source')
pub = data(by_id['backend-publication']['identity']['path'], by_id['backend-publication']['identity']['ref'])
check('35' in json.dumps(pub) and boundary['acceptedRead']['source'] in json.dumps(pub), 'local draft publication binds source')

catalog = data('packages/contracts/retrieval-0.2/catalog.json', boundary['acceptedRead']['source'])
prior = data('packages/contracts/retrieval-0.2/catalog.json', BASE)
check((len(catalog['operations']), len(prior['operations'])) == (71, 67), 'current and historical descriptor counts')
check(collections.Counter(r['state'] for r in catalog['originals']) == {'mapped': 70, 'pending': 26, 'deferred': 43}, 'current mapping accounting')
check(collections.Counter(r['disposition'] for r in catalog['originals']) == {'selected': 96, 'deferred': 43}, 'unchanged13996/43 denominator')
check([(r['id'], r['disposition']) for r in catalog['originals']] == [(r['id'], r['disposition']) for r in prior['originals']], 'all original identities and selection preserved')
check(all(o['handler'] is None and o['availability'] == 'unimplemented' and o['qualification'] == 'pending' for o in catalog['operations']), 'all71 unavailable unqualified')
check([r for r in catalog['originals'] if r['id'] in boundary['scopeTensions']] == [r for r in prior['originals'] if r['id'] in boundary['scopeTensions']], 'four actual native row states unchanged')
check(boundary['scopeTensions'] == ['find_path_to', 'confirm_memory', 'correct_memory', 'forget_memory'], 'four tensions named exactly')
check(boundary['skills'] == 14, 'fourteen original skills retained')

original_bounds = {'realTasksMinimum': 60, 'completionRateMinimum': .9, 'factualCorrectnessMinimum': .95, 'adversarialIsolationCasesMinimum': 100, 'unauthorizedDisclosureAllowed': 0, 'sourceCoverageRequired': 1, 'recoveryFixturePassRequired': 1, 'recoverySecondsMaximum': 120, 'duplicateMutationAllowed': 0, 'nativeFilesOpenRequired': 1, 'artifactHumanQualityMinimum': .95, 'concurrentRuns': 10, 'uiAcknowledgementP95SecondsMaximum': 2, 'freshTaskReadinessP95SecondsMaximum': 90, 'allVisibleControlBehaviorRequired': 1}
check(boundary['originalBenchmarks'] == original_bounds, 'original DOCX release thresholds retained')
check((boundary['r2Benchmark']['realSeedRequestsMinimum'], boundary['r2Benchmark']['labelledCasesMinimum'], boundary['r2Benchmark']['syntheticReplacementAllowed']) == (75, 200, False), 'R2 real cohorts supplement originals')
check('not independently located primary' in boundary['r2Benchmark']['stricterOriginalOrdinary8s'], 'strict cohort provenance limit explicit')
check(boundary['nativeReportedCohorts'] == [33, 9, 12], 'native observations distinct cohorts')
check(by_id['native-reported']['claims'] == {'baselineCasesPassed': 33, 'budgetCasesPassed': 9, 'invocationCasesPassed': 12}, 'native reported positive observations retained')
check(by_id['sdk-image-reported']['claims']['image'] == 'pending' and by_id['sdk-image-reported']['claims']['cacheCleanupReportedGB'] == 30.6, 'cleanup not image acceptance')
check(by_id['shipping-reported']['claims']['buildId'] == '18b3316a-9403-40f9-807b-3ddf24c40d7b' and by_id['shipping-reported']['claims']['startedUTC'] == '2026-10-12T19:42:46Z', 'shipping dated start identity')
check('not queried' in boundary['shipping']['latestIndependentState'], 'no invented terminal shipping result')

front = by_id['frontend']
origins = data(P + 'frontend/origins.json')
check(len(front['files']) == 5, 'five frontend metadata files only')
for ident in front['files']:
    value = raw(CANDIDATE, P + ident['path'])
    name = Path(ident['path']).name
    check((len(value), sha(value), blob(value)) == (ident['bytes'], ident['sha256'], ident['gitBlob']), name + ' retained frontend bytes match recorded blob')
    check((origins['files'][name]['blob'], origins['files'][name]['url']) == (ident['gitBlob'], ident['url']), name + ' frontend locator matches recorded origin')
    failed = raw(CANDIDATE, P + 'frontend/initial-extra-newline.' + name)
    check(failed == value + b'\n', name + ' exact failed-copy preimage preserved')
check(front['publication'] == '7aca86e7d64cfdb85d09d424a07e6186339fc24c' and front['source'] == 'ee01be3b2c5c64a53744994ae4ad0d992a111054', 'frontend source and publication distinction')
status = data(P + 'frontend/STATUS.json')
check(status['remainingOutsideGroup'] == 18 and status['fullRowAcceptance'] == 'NO_NEW_FULL_ROW_ACCEPTANCE' and status['nativeAcceptance'].startswith('UNRUN'), 'frontend remaining and native limits')
check(sum(status['checks'][k] for k in ['rootTests', 'transportTests', 'portfolioUnitTests', 'capiroUnitTests']) == 1432, 'frontend combined local cohort count')
check((status['checks']['modulesBrowserTests'], status['checks']['portfolioMeriBrowserTests'], status['checks']['elementsTests']) == (182, 1051, 15), 'frontend separate browser/Elements cohorts')
check(status['initialElementsAttempt']['passed'] == 12 and status['initialElementsAttempt']['failed'] == 3, 'frontend reported initial failure retained')
check(front['shippingSource'] == status['frozenShippingSource'] == boundary['shipping']['sourceFromFrontendReceipt'] != front['source'], 'older frozen shipping source distinct from current reviewed repairs')
check(by_id['frontend-earlier-cohort']['claims'] == {'source': front['source'], 'independentBrowserPass': 81, 'unitPass': 46, 'openFindings': 18, 'nativePortfolioRowsUnaccepted': 337}, 'earlier parent cohort not overwritten or added')

before, after = tree(BASE), tree(CANDIDATE)
unchanged = sum(after.get(path) == value for path, value in before.items())
check(unchanged == len(before), 'every governing-base blob and mode preserved')
added = set(after) - set(before)
check(all(p in {REPORT, TASK} or p.startswith(P) for p in added), 'exclusive additive metadata paths')
manifest = data(P + 'manifest.json')
member_paths = [r['path'] for r in manifest['members']]
check(len(set(member_paths)) == len(member_paths), 'manifest names unique')
check(set(member_paths) == added - {P + 'manifest.json'}, 'complete exact author manifest membership')
for entry in manifest['members']:
    value = raw(CANDIDATE, entry['path'])
    check((len(value), sha(value)) == (entry['bytes'], entry['sha256']), 'manifest ' + entry['path'].removeprefix(P))
verify = data(P + 'verification.json')
check(sha(raw(CANDIDATE, P + 'verify.stdout')) == verify['stdoutSha256'] and sha(raw(CANDIDATE, P + 'verify.stderr')) == verify['stderrSha256'] and sha(raw(CANDIDATE, P + 'verify.py')) == verify['verifierSha256'], 'author verification source and raw streams bound')
check(verify['exitCode'] == 0 and isinstance(verify['result']['checks'], int) and verify['result']['checks'] >= 751 and json.loads(raw(CANDIDATE, P + 'verify.stdout')) == verify['result'], 'author documentary checks receipt matches raw output; not rerun')

negative = []
def refuse(name, mutate, expected):
    doc, registry = copy.deepcopy(joined), copy.deepcopy(receipts)
    mutate(doc, registry)
    errors = structural_errors(doc, registry)
    negative.append({'name': name, 'expected': expected, 'observed': errors, 'pass': expected in errors})

refuse('remove requirement', lambda d, r: d['requirements'].pop(), 'exact53membership')
refuse('duplicate requirement', lambda d, r: d['requirements'].append(copy.deepcopy(d['requirements'][0])), 'exact53membership')
refuse('change governing requirement', lambda d, r: d['requirements'][0].__setitem__('originalRequirement', 'reduced scope'), 'originalRequirement')
refuse('promote source to runtime', lambda d, r: d['requirements'][1].__setitem__('qualifiedRuntime', True), 'wholeGatePromotion')
refuse('close G1 with component passes', lambda d, r: next(x for x in d['requirements'] if x['id'] == 'G1').__setitem__('status', 'completed-source'), 'wholeGatePromotion')
refuse('reopen accepted W00 discovery', lambda d, r: next(x for x in d['requirements'] if x['id'] == 'W00').__setitem__('status', 'pending'), 'wholeGatePromotion')
refuse('remove accountable owner', lambda d, r: d['requirements'][1].__setitem__('owner', ''), 'missingActionableOwnerOrGap')
refuse('invent receipt pointer', lambda d, r: d['requirements'][1]['sourceReceiptIds'].append('not-supplied'), 'danglingReceipt')
refuse('promote native reported pass', lambda d, r: next(x for x in r['receipts'] if x['id'] == 'native-reported').__setitem__('qualifiedRuntimeByThisLane', True), 'promotedParentReport')
refuse('forge parent report local identity', lambda d, r: next(x for x in r['receipts'] if x['id'] == 'shipping-reported').__setitem__('identity', {}), 'promotedParentReport')
check(all(x['pass'] for x in negative), 'ten independent negative controls refuse promotion or loss')

result = {'verdict': 'PASS' if all(c['pass'] for c in checks) else 'FAIL', 'candidate': CANDIDATE, 'tree': git('rev-parse', CANDIDATE + '^{tree}').decode().strip(), 'checksPassed': sum(c['pass'] for c in checks), 'checksTotal': len(checks), 'originalBlobsPreserved': unchanged, 'originalBlobs': len(before), 'authorManifestMembers': len(member_paths), 'receiptRecords': len(by_id), 'negativeControls': negative, 'checks': checks, 'limits': ['Only local immutable Git and retained JSON bytes read.', 'No author generator/verifier or project/native code executed.', 'Frontend origin blob correspondence verified against author retained connector identities, without a new remote fetch or full raw suite audit.', 'Native and shipping remain parent-reported; G1 OPEN/G2-G7 unentered.']}
print(json.dumps(result, indent=2))
sys.exit(0 if result['verdict'] == 'PASS' else 1)
