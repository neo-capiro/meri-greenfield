"""Exact public Git/document audit; never accesses private or native inputs."""
import ast
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

root = Path(sys.argv[1])
freeze, author, reviewer = sys.argv[2:5]
base = 'bf41cf69ebe892705cdd6f041dd2f1fb323048f5'
roadmap = 'docs/plans/MERI-G1-SOURCE-TO-NATIVE.md'
source = 'scripts/qualification/worker_runner_inventory.py'
new_test = 'scripts/qualification/test_worker_runner_hash_deadline.py'
report = 'docs/coordination/reports/MERI-NATIVE-HELPER-INTEGRATION-20261012.md'
evidence = 'docs/qualification/candidates/native-helper-integration-20261012/integration/'
checks = []

def git(*args):
    return subprocess.check_output(['git', '-C', str(root), *args], timeout=10)

def body(path, ref=freeze):
    return git('show', ref + ':' + path)

def js(path):
    return json.loads(body(path))

def tree(ref):
    return {v.split(b'\t', 1)[1].decode(): v.split(b'\t', 1)[0].split()[2].decode()
            for v in git('ls-tree', '-rz', ref).split(b'\0') if v}

def check(name, value):
    checks.append({'name': name, 'passed': bool(value)})

before, after = tree(base), tree(freeze)
changed = sorted(p for p in before if before[p] != after.get(p))
new = sorted(set(after) - set(before))
check('PR20 base ancestry', subprocess.run(['git', '-C', str(root), 'merge-base', '--is-ancestor', base, freeze], timeout=10).returncode == 0)
check('only allocated existing source and canonical roadmap changed', changed == sorted([source, roadmap]))
check('all other pre-existing files preserved', all(after.get(p) == value for p, value in before.items() if p not in [source, roadmap]))
allowed_names = {new_test}
allowed_names.update(f'docs/coordination/{kind}/{name}.md' for kind in ['tasks', 'reports'] for name in [
    'MERI-NATIVE-HELPER-20261012', 'MERI-NATIVE-HELPER-SOURCE-20261012',
    'MERI-NATIVE-HELPER-SOURCE-REVIEW-20261012', 'MERI-NATIVE-HELPER-INTEGRATION-20261012'])
allowed_prefixes = ['docs/qualification/candidates/native-helper-20261012/', evidence]
check('new files within explicit allocation', all(p in allowed_names or any(p.startswith(q) for q in allowed_prefixes) for p in new))
for ref in [author, reviewer]:
    accepted = tree(ref)
    additions = [p for p in accepted if p not in before]
    check('exact accepted lane additions preserved ' + ref, all(after.get(p) == accepted[p] for p in additions))
check('production repair exactly matches accepted author', after[source] == tree(author)[source])
check('new regression test exactly matches accepted author', after[new_test] == tree(author)[new_test])
old_ast, new_ast = ast.parse(body(source, base)), ast.parse(body(source))
scoped = {'ancestors', 'hash_file'}
check('all other public source AST nodes unchanged',
      [ast.dump(n) for n in old_ast.body if getattr(n, 'name', None) not in scoped] ==
      [ast.dump(n) for n in new_ast.body if getattr(n, 'name', None) not in scoped])
check('hash_file public signature unchanged',
      ast.dump(next(n.args for n in old_ast.body if getattr(n, 'name', None) == 'hash_file')) ==
      ast.dump(next(n.args for n in new_ast.body if getattr(n, 'name', None) == 'hash_file')))
author_receipt = js('docs/qualification/candidates/native-helper-20261012/author/verification-receipt.json')
check('author retained baseline21/11 and repaired32/0', author_receipt['baseline']['passed'] == 21 and author_receipt['baseline']['failed'] == 11 and author_receipt['baseline']['exitCode'] == 1 and author_receipt['repaired']['passed'] == 32 and author_receipt['repaired']['failed'] == 0 and author_receipt['repaired']['exitCode'] == 0)
check('author source hash binds actual repaired file', hashlib.sha256(body(source)).hexdigest() == author_receipt['sourceSha256'])
check('maintained test inert qualification reported honestly', author_receipt['maintainedTests']['testMethodsPassed'] == 9 and author_receipt['nativeExecution'] is False and author_receipt['privateSourceExecutedImportedOrCompiled'] is False and author_receipt['g1Accepted'] is False)
manifest = js('docs/qualification/candidates/native-helper-20261012/author/freeze-manifest.json')
check('all author manifest file hashes preserved exactly', all(len(body(x['path'])) == x['bytes'] and hashlib.sha256(body(x['path'])).hexdigest() == x['sha256'] for x in manifest['files']))

review_path = 'docs/qualification/candidates/native-helper-20261012/review/'
rmanifest = js(review_path + 'review-manifest.json')
check('independent decision binds exact accepted author and native HOLD', rmanifest['candidate'] == author and rmanifest['verdict'] == 'ACCEPT_SOURCE' and rmanifest['nativeAcceptance'] == 'HOLD')
for name, passed, failed in [('deadline-baseline.json', 2, 7), ('deadline-exact-freeze.json', 9, 0), ('preservation-exact-freeze.json', 25, 0), ('static-exact-freeze.json', 18, 0), ('private-facts-final.json', 31, 0), ('author-manifest-integrity.json', 22, 0)]:
    receipt = js(review_path + name)
    check('preserved exact independent result ' + name, receipt['passed'] == passed and receipt['failed'] == failed)
facts = js(review_path + 'private-facts-final.json')
check('actual13-field comparison includes access time', len(facts['comparisonFields']) == 13 and 'LastAccessTime' in facts['comparisonFields'])
check('twelve failures remain access-time-only', len(facts['failedPairs']) == 12 and all(x['fields'] == ['LastAccessTime'] for x in facts['failedPairs']))
check('private facts retain nonexecution and no waiver', all(facts[k] is False for k in ['privateSourceExecuted', 'privateSourceCompiled', 'nativeObservationsRecreated', 'runtimeAccepted', 'accessTimeWaiver']))
intake = js(evidence + 'helper-intake.json')
check('exact helper identity received as data', intake['name'] == 'NativeMetadata.cs' and intake['bytes'] == 6163 and intake['sha256'] == 'f551d7287611b982a93eebf02e93719bfdce355609bd7ca4f9cd546ae9bf0a4c' and intake['verified'] is True)
check('helper intake retains non-execution/privacy boundary', intake['executed'] is False and intake['compiled'] is False and intake['privateBodiesAndPathsPublished'] is False)
check('failed local transcription remains distinct from corruption', intake['failedLocalTranscriptions'] == 1 and intake['localFailedTranscriptionPreserved'] is True and intake['failedTranscriptionIsParentCorruptionEvidence'] is False)
a = js(evidence + 'access-restriction.json')
check('access restriction supersedes alternative handoff', a['supersedes'] == 'PR20 proposal to arrange an alternative external metadata handoff' and a['nativePrefixPath'] == 'BLOCKED_UNTIL_OWNER_ENABLED_NORMAL_ROUTE')
check('all prohibited bypass routes retained', a['prohibitedRoutesForSameBlockedMetadata'] == ['another host', 'mirror', 'relay', 'local computer'])
check('no repeated retrieval/setup/install/security action', a['additionalMetadataRetrievals'] == 0 and a['setupActions'] == 0 and a['nativeInstallation'] is False and a['securityOrNetworkChanges'] is False and a['unchangedFailureMetadataPr'] is False)
pr = js(evidence + 'pr20-base-readback.json')
check('captured PR20 head/base draft unmerged', pr['head'] == base and pr['base'] == '15f671a65365e3401f0ce07b46deb4cf63538346' and pr['draft'] is True and pr['merged'] is False and pr['state'] == 'open')
acceptance = js(evidence + 'source-acceptance.json')
check('root acceptance exact refs and source hash', acceptance['author'] == author and acceptance['reviewer'] == reviewer and acceptance['decision'] == 'ACCEPT_SOURCE' and acceptance['sourceSha256'] == hashlib.sha256(body(source)).hexdigest())
check('root native and connectivity flags remain false', acceptance['privateHelperNativeAcceptance'] == 'HOLD' and acceptance['hardPhysicalDeadlineQualified'] is False and acceptance['sourceConnectivityEnabled'] is False and acceptance['privateImplementationCopiedIntoProduct'] is False)
for name in ['captured-deadline', 'captured-preservation', 'helper-data', 'maintained', 'preservation-privacy']:
    receipt = js(evidence + name + '.json')
    check('root raw stream integrity ' + name, all(len(body(x['path'])) == x['bytes'] and hashlib.sha256(body(x['path'])).hexdigest() == x['sha256'] for x in receipt['streams']))
    check('root owned check completed and group absent ' + name, receipt['exitCode'] == 0 and receipt['timedOut'] is False and receipt['ownedProcessGroupAbsent'] is True)
texts = {p: body(p).decode() for p in [roadmap, report]}
check('both docs name the received exact helper', all('NativeMetadata.cs' in t and intake['sha256'] in t for t in texts.values()))
check('both docs retain cooperative-only limits', all('cooperative' in t and 'watchdog' in t for t in texts.values()))
check('both docs supersede prior handoff and forbid all bypasses', all('supersedes PR20' in t and all(route in t for route in ['another host', 'mirror', 'relay', 'local computer']) for t in texts.values()))
check('both docs distinguish original-deadline cleanup from hard bounds', all('exactly once' in t and 'original deadline' in t for t in texts.values()))
check('both docs bind source-only nonexecution to continuation', all('In this source continuation' in t for t in texts.values()))
check('received helper no longer presented as missing', 'sole additional member currently requested' not in texts[roadmap] and 'Until it arrives' not in texts[roadmap] and 'must not be requested again' in texts[roadmap])

check('canonical scope and disabled status retained', all(x in texts[roadmap] for x in ['139 original capabilities:96 selected/43 deferred', '14 bound but unavailable/82 selected unmapped', '14 named skills unqualified', 'G0 accepted; G1 OPEN; G2–G7 unentered', 'All source connectivity stays disabled']))
check('architecture ownership retained', all(x in texts[roadmap] for x in ['Claude Agent SDK', 'Temporal durability', 'AI SDK/Elements', 'Public0.1/private0.2', 'Existing Aurora stays selected']))
check('frozen L1 remains unauthorized', 'NOT_EXECUTABLE and not authorized' in texts[roadmap])
check('separate wrapper preservation and identity gaps visible', all(x in texts[roadmap] for x in ['source-verification.json', 'priorEvidenceFileCount', 'priorEvidenceFilesUnchanged', 'Git executable', 'enclosing watchdog']))
check('new docs do not contain personal Windows home paths', not any(re.search(rb'[A-Za-z]:[\\/]Users[\\/][^\s\\/"<>]+', body(p)) for p in [roadmap, report, *[p for p in new if p.startswith(evidence) and p.endswith('.json')]]))
check('no private helper body added', not any(p.endswith('/NativeMetadata.cs') for p in new))
result = {'rootFreeze': freeze, 'rootTree': git('rev-parse', freeze+'^{tree}').decode().strip(), 'base': base, 'author': author, 'reviewer': reviewer, 'checks': checks, 'passed': sum(c['passed'] for c in checks), 'failed': [c['name'] for c in checks if not c['passed']], 'originalFiles': len(before), 'unchangedOriginalFiles': len(before)-len(changed), 'changedOriginalFiles': changed, 'newFiles': len(new), 'hashes': [{'path': p, 'bytes': len(body(p)), 'sha256': hashlib.sha256(body(p)).hexdigest()} for p in [roadmap, report, source, new_test]], 'privateInputAccessed': False, 'nativeTargetExecuted': False, 'retrievalPerformed': False, 'limits': 'Public-object integration audit; no private source remeasurement or native behavioral qualification.'}
print(json.dumps(result, indent=2))
sys.exit(1 if result['failed'] else 0)
