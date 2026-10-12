"""Read-only independent frozen source/evidence audit; no service or target runtime."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[5]
BASE = '2f06feccca731d6cd388612cd568185ecc29668f'
SOURCE = '6d2b0b0b2b53a7c229a84a7a44bf8feb9b1140f6'
TREE = '63e61fd05f4d02b1734ad82c467124db62c7759c'
PACKET = 'e38dc366d66ba7f285402c4365fd465fa29f8833'
P = 'docs/qualification/candidates/capability-successor-20261012/'
checks = []

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def blob(commit, path):
    return git('show', commit + ':' + path)

def check(name, condition):
    checks.append({'name': name, 'pass': bool(condition)})

def sha(data):
    return hashlib.sha256(data).hexdigest()

def test_totals(text, expected):
    values = dict(re.findall(r'^(?:#|ℹ) (tests|pass|fail) ([0-9]+)$', text, re.MULTILINE))
    return values == {'tests': str(expected), 'pass': str(expected), 'fail': '0'}

def record_array(data, key):
    """Extract exact JSON object lexemes independently of serialization choices."""
    text = data.decode()
    pos = re.search(r'"' + re.escape(key) + r'"\s*:\s*\[', text).end()
    out = []
    decoder = json.JSONDecoder()
    while True:
        while text[pos].isspace() or text[pos] == ',':
            pos += 1
        if text[pos] == ']':
            return out
        value, end = decoder.raw_decode(text, pos)
        out.append((value, text[pos:end].encode()))
        pos = end

check('exact-source-tree', git('rev-parse', SOURCE + '^{tree}').decode().strip() == TREE)
check('review-worktree-source-head', git('rev-parse', 'HEAD').decode().strip() == SOURCE)
check('tracked-source-worktree-clean', git('diff', '--name-only') == b'')
changes = [line.split('\t') for line in git('diff', '--name-status', BASE, SOURCE).decode().splitlines()]
modified_expected = {
    'apps/gateway/dispatch/operation-context.mjs', 'apps/gateway/dispatch/tool-dispatch.mjs',
    'apps/gateway/test/memory-context-independent.test.mjs', 'docs/CAPABILITY-CATALOG.md',
    'packages/contracts/retrieval-0.2/catalog-validation.mjs', 'packages/contracts/retrieval-0.2/catalog.json',
    *['packages/contracts/test/' + name + '.test.mjs' for name in
      ['retrieval-catalog-bindings', 'retrieval-mail', 'retrieval-memory-binding', 'retrieval-operational-reads']]}
check('exact-existing-file-change-scope', {p for status, p in changes if status != 'A'} == modified_expected)
check('no-deletion-rename', all(status in ('A', 'M') for status, _ in changes))
production = [p for _, p in changes if p.startswith(('apps/', 'packages/')) and '/test/' not in p]
action_paths = ['packages/contracts/retrieval-0.2/catalog-validation.mjs', 'packages/contracts/retrieval-0.2/catalog.json']
mail_paths = ['apps/gateway/dispatch/' + p + '.mjs' for p in ['mail-read-context', 'operation-context', 'tool-dispatch']]
check('exact-five-production-files', set(production) == set(action_paths + mail_paths))
for commit, paths in [('59a2b629cda0d3838ec1b5235d2a8d64aadf3402', action_paths), ('8c4ec8dc2a9caad8640eb9f4741f5de2d7696887', mail_paths)]:
    for path in paths:
        check('accepted-lane-production-bytes:' + path, blob(commit, path) == blob(SOURCE, path))
protected = ['apps/proxy', 'apps/worker', 'apps/control', 'scripts', 'infra', 'package.json', 'package-lock.json',
    'packages/contracts/package.json', 'packages/contracts/package-lock.json', 'packages/contracts/dist',
    'packages/contracts/meri.schema.json', 'packages/contracts/validate.mjs',
    'packages/contracts/retrieval-0.2/validate.mjs', 'packages/contracts/retrieval-0.2/operation-contracts.mjs',
    'packages/contracts/retrieval-0.2/*schema.json', 'packages/contracts/retrieval-0.2/*-validation.mjs',
    ':!packages/contracts/retrieval-0.2/catalog-validation.mjs', 'docs/CAPABILITIES.json', 'docs/CAPABILITY-SCOPE.md',
    'docs/coordination/r2', 'docs/plans']
check('protected-runtime-public-schema-sdk-ledger-plan-identical', git('diff', '--name-only', BASE, SOURCE, '--', *protected) == b'')
catpath = 'packages/contracts/retrieval-0.2/catalog.json'
before, after = blob(BASE, catpath), blob(SOURCE, catpath)
old, new = json.loads(before), json.loads(after)
check('all-original-row-objects-and-order', new['originals'] == old['originals'])
check('all-original-row-literal-bytes', record_array(before, 'originals') == record_array(after, 'originals'))
oldops, newops = record_array(before, 'operations'), record_array(after, 'operations')
check('all-original14-descriptor-literal-bytes-and-order', len(oldops) == 14 and oldops == newops[:14])
counts = {'originals': len(new['originals']), 'selected': sum(r['disposition'] == 'selected' for r in new['originals']),
    'deferred': sum(r['disposition'] == 'deferred' for r in new['originals']), 'mapped': sum(r['state'] == 'mapped' for r in new['originals']),
    'pendingSelected': sum(r['disposition'] == 'selected' and r['state'] == 'pending' for r in new['originals']), 'typedOperations': len(new['operations'])}
check('exact-capability-counts', counts == {'originals':139, 'selected':96, 'deferred':43, 'mapped':14, 'pendingSelected':82, 'typedOperations':15})
check('all-typed-operations-remain-unavailable', all(r['handler'] is None and r['availability'] == 'unimplemented' and r['qualification'] == 'pending' and r['retry']['maxRetries'] == 0 and r['retry']['retryableCodes'] == [] for r in new['operations']))
action = next(r for r in new['originals'] if r['id'] == 'query_action_items')
actionop = next(r for r in new['operations'] if r['operation']['id'] == 'query_action_items')
check('partial-action-original-pending-null-without-alias', action['state'] == 'pending' and action['replacement'] is None and actionop['aliases'] == [])
registry = blob(SOURCE, action_paths[0]).decode()
check('sole-explicit-partial-binding', registry.count("nativeCoverage:'partial'") == 1 or registry.count("nativeCoverage: 'partial'") == 1)
check('two-explicit-mail-dispatch-profiles', registry.count("dispatchProfile:'mail-candidates/1'") + registry.count("dispatchProfile: 'mail-candidates/1'") == 2)
refs = {'refs/heads/release/meri-rc1-20261012':BASE, 'refs/heads/task/meri-native-helper-integration-20261012':BASE,
    'refs/tags/meri-rc1-20261012':'b157217e69d36da1b53fa5944a0781a2f53a2f79', 'refs/tags/meri-rc1-20261012^{}':BASE,
    'refs/remotes/origin/main':'8b123bea4c90794dc2d766814b6ddbdbfe0928bc'}
for ref, expected in refs.items():
    check('preserved-local-ref:' + ref, git('rev-parse', ref).decode().strip() == expected)
packet_changes = git('diff', '--name-status', SOURCE, PACKET).decode().splitlines()
check('root-receipt-commit-additions-only-in-integration', all(line.startswith('A\t' + P + 'integration/') for line in packet_changes))
check('root-receipt-tree', git('rev-parse', PACKET + '^{tree}').decode().strip() == '4f419f4bb9ea2e5abd948506b0bf256841965b41')
receipts = []
for name in ['combined-source', 'public-distribution', 'preservation', 'remote-preservation', 'final-whitespace', 'retained-packets']:
    path = P + 'integration/' + name + '.json'
    raw = blob(PACKET, path)
    r = json.loads(raw)
    check('root-receipt-exact-source:' + name, r['sourceHead'] == SOURCE and r['sourceDiffBytes'] == 0 and r['sourceDiffSha256'] == sha(b''))
    check('root-receipt-success-cleanup:' + name, r['exitCode'] == 0 and r['timedOut'] is False and r['ownedProcessGroupAbsent'] is True)
    check('root-receipt-capture-binding:' + name, r['captureSha256'] == sha(blob(SOURCE, P + 'integration/capture-reaped.py')))
    for stream in r['streams']:
        data = blob(PACKET, stream['path'])
        check('root-stream-bytes:' + stream['path'], len(data) == stream['bytes'] and sha(data) == stream['sha256'])
    receipts.append({'path': path, 'bytes': len(raw), 'sha256': sha(raw), 'sourceHead': r['sourceHead'], 'exitCode': r['exitCode'], 'ownedProcessGroupAbsent': r['ownedProcessGroupAbsent']})
combined = blob(PACKET, P + 'integration/combined-source.stdout.bin').decode()
public = blob(PACKET, P + 'integration/public-distribution.stdout.bin').decode()
check('root-broad-tap637-pass-zero-fail', test_totals(combined, 637))
check('root-public-tap7-pass-zero-fail', test_totals(public, 7))
remote = dict(line.split('\t')[::-1] for line in blob(PACKET, P + 'integration/remote-preservation.stdout.bin').decode().splitlines())
check('remote-receipt-exact-five-refs', remote == {('refs/heads/main' if k == 'refs/remotes/origin/main' else k): v for k, v in refs.items()})
packet_members = []
for name, key, expected_count in [('action-author/source-manifest.json', 'source', 9), ('action-review/review-manifest.json', 'files', 18), ('mail-author/manifest.json', 'entries', 32), ('mail-review/review-manifest.json', 'files', 21)]:
    raw = blob(SOURCE, P + name)
    data = json.loads(raw)
    rows = data[key]
    check('lane-manifest-exact-count:' + name, len(rows) == expected_count and len({r['path'] for r in rows}) == expected_count)
    for row in rows:
        content = blob(SOURCE, row['path'])
        check('lane-preserved-member:' + row['path'], len(content) == row['bytes'] and sha(content) == row['sha256'])
    packet_members.append({'manifest': P + name, 'members': len(rows), 'sha256': sha(raw)})
for name, key in [('action-review/review-manifest.json', 'decision'), ('mail-review/review-manifest.json', 'verdict')]:
    check('independent-lane-acceptance:' + name, json.loads(blob(SOURCE, P + name))[key] == 'ACCEPT_SOURCE')
cleanup = json.loads(blob(SOURCE, P + 'action-author/cleanup.json'))
check('historical-cleanup-failure-not-erased', cleanup['physicalGroupCleanup'] == 'FAIL_EXITED_ZOMBIES_ADOPTED_BY_PID1' and cleanup['liveOwnedProcesses'] == 0 and sum(len(r['members']) for r in cleanup['receipts']) == 5)
raw = json.loads(blob(SOURCE, P + 'integration/raw-whitespace-before-attributes.json'))
check('historical-whitespace-exit2-preserved', raw['exitCode'] == 2)
for stream in raw['streams']:
    data = blob(SOURCE, stream['path'])
    check('historical-whitespace-stream:' + stream['path'], len(data) == stream['bytes'] and sha(data) == stream['sha256'])
attrs = [line for line in blob(SOURCE, P + '.gitattributes').decode().splitlines() if line and not line.startswith('#')]
check('scoped-raw-whitespace-rules-only', attrs == ['**/*.stdout* -whitespace', '**/*.stderr* -whitespace'])
for path, expected in [(P + 'integration-review/focused-connected.stdout.bin', 'unset'), (P + 'integration-review/audit-integration.py', 'unspecified'), ('apps/gateway/dispatch/mail-read-context.mjs', 'unspecified'), ('docs/CAPABILITY-CATALOG.md', 'unspecified')]:
    check('whitespace-attribute:' + path, git('check-attr', 'whitespace', '--', path).decode().strip().endswith(': ' + expected))
focused_path = ROOT / (P + 'integration-review/focused-connected.json')
focused = json.loads(focused_path.read_bytes())
check('independent-focused-source-cleanup', focused['sourceHead'] == SOURCE and focused['sourceDiffBytes'] == 0 and focused['exitCode'] == 0 and focused['ownedProcessGroupAbsent'] is True and focused['timedOut'] is False)
for stream in focused['streams']:
    data = (ROOT / stream['path']).read_bytes()
    check('independent-focused-stream:' + stream['path'], len(data) == stream['bytes'] and sha(data) == stream['sha256'])
focused_stdout = (ROOT / (P + 'integration-review/focused-connected.stdout.bin')).read_text()
check('independent-focused127', test_totals(focused_stdout, 127))
check('first-page-rotation-and-page-mismatch-controls-present', 'first-page current decision IDs may rotate' in focused_stdout and 'full previous/current page decision mismatch still refuses' in focused_stdout)
result = {'reviewedSource': SOURCE, 'reviewedTree': TREE, 'rootReceiptCommit': PACKET, 'base': BASE,
    'passed': sum(c['pass'] for c in checks), 'failed': sum(not c['pass'] for c in checks), 'checks': checks,
    'ledger': counts, 'rootReceipts': receipts, 'laneManifests': packet_members, 'runtimeAccepted': False,
    'historicalCleanup': 'FAIL_EXITED_ZOMBIES_ADOPTED_BY_PID1_RETAINED_NO_CLEANUP_ATTEMPT'}
print(json.dumps(result, indent=2))
raise SystemExit(1 if result['failed'] else 0)
