"""Offline Git/data audit only; no imports of product or private source code."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[5]
BASE = 'e0163fb65a639a28d9423e929058b40b48cc556d'
CANDIDATE = 'c463f7f7e7580e26d07b31c5f4020eaa469d4f67'
LANE = Path(__file__).resolve().parent
checks = []
def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)
def blob(ref, path):
    return git('show', f'{ref}:{path}')
def sha(data):
    return hashlib.sha256(data).hexdigest()
def check(name, passed):
    checks.append({'name': name, 'passed': bool(passed)})
def tree(ref, *paths):
    values = {}
    for row in git('ls-tree', '-rz', ref, '--', *paths).split(b'\0'):
        if row:
            meta, path = row.split(b'\t', 1)
            values[path.decode()] = meta.decode()
    return values

check('candidate exact tree', git('rev-parse', f'{CANDIDATE}^{{tree}}').decode().strip() == '552b333286dc42d98602fc255b2e3ec75d834c4a')
check('criteria precedes candidate integration in review ancestry', subprocess.run(['git','merge-base','--is-ancestor','8f140ec62b5b9b52024698016ce180422b5299e4','HEAD'],cwd=ROOT).returncode == 0)
check('candidate preserved in review ancestry', subprocess.run(['git','merge-base','--is-ancestor',CANDIDATE,'HEAD'],cwd=ROOT).returncode == 0)
old = tree(BASE)
new = tree(CANDIDATE)
check('every baseline tracked path retained', set(old) <= set(new))
protected = ['apps/proxy','apps/worker','apps/control','infra','scripts','package.json','package-lock.json',
             'packages/contracts/meri.schema.json','packages/contracts/validate.mjs','packages/contracts/package.json',
             'packages/contracts/generate.mjs','packages/contracts/dist','docs/plans','docs/handover']
for prefix in protected:
    check(f'protected tree unchanged: {prefix}', tree(BASE,prefix) == tree(CANDIDATE,prefix))
for path, identity in old.items():
    if path.startswith('apps/gateway/') and '/test/' not in path:
        check(f'gateway source unchanged: {path}', identity == new[path])
changes = [p for p in old if old[p] != new[p]]
allowed = {'packages/contracts/retrieval-0.2/catalog.json','packages/contracts/retrieval-0.2/catalog-validation.mjs',
           'packages/contracts/retrieval-0.2/validate.mjs','packages/contracts/retrieval-0.2/operation-contracts.mjs',
           'docs/RETRIEVAL-CONTRACT.md'}
for path in changes:
    check(f'existing-file scope: {path}', path in allowed or path.startswith('packages/contracts/test/') or path in {
        'apps/gateway/test/action-item-context-independent.test.mjs','apps/gateway/test/mail-context-independent.test.mjs',
        'apps/gateway/test/memory-context-independent.test.mjs'})
helper = 'packages/contracts/retrieval-0.2/operation-contracts.mjs'
added = b'// Private domain validators may share this exact admission boundary when called\n// outside the resolver. Keep one owner for inert JSON checks and resource limits.\nexport {copyData as snapshotOperationData};\n\n'
check('helper is only exact four-line export addition', blob(CANDIDATE,helper).replace(added,b'',1) == blob(BASE,helper))
family_refs = {
    'client-registry': 'deba2c13c612845b4f65e38c263982c698bb4361',
    'business-development': 'bf9a06cfba22c5c3bac87949689348b16febcbc5',
    'research-portfolio': '088cfa10df8af518795a10590ce3e17c8b4fad8a',
}
family_identities = []
for family, ref in family_refs.items():
    for suffix in ['.schema.json','-validation.mjs']:
        path = f'packages/contracts/retrieval-0.2/{family}{suffix}'
        raw = blob(CANDIDATE,path)
        check(f'accepted author bytes: {path}', raw == blob(ref,path))
        check(f'review checkout source bytes: {path}', raw == (ROOT/path).read_bytes())
        family_identities.append({'path':path,'authorRef':ref,'sha256':sha(raw),'bytes':len(raw)})
for ref in ['c245d4f','ac3f609','bf430c5']:
    paths = git('diff-tree','--no-commit-id','--name-only','-r',ref).decode().splitlines()
    check(f'domain final review commit has no production edits: {ref}', bool(paths) and all(p.startswith('docs/') or (p.startswith('packages/contracts/test/') and 'independent' in p) for p in paths))
for path in new:
    if path.startswith(('packages/','apps/')) and not (path.startswith('packages/contracts/test/') or path.startswith('apps/gateway/test/')):
        check(f'candidate production equals checked review: {path}', blob(CANDIDATE,path) == (ROOT/path).read_bytes())

# Capture receipts authenticate retained streams, not private source or live truth.
# Nonzero source diffs and historical nonzero exits remain visible.
receipt_rows = []
for path in sorted((ROOT/'docs/qualification/candidates/capability-next-20261012').glob('*/*.json')):
    if path.parent == LANE:
        continue
    value = json.loads(path.read_bytes())
    if not isinstance(value,dict) or not all(k in value for k in ['command','streams','ownedProcessGroupAbsent']):
        continue
    for stream in value['streams']:
        target = ROOT/stream['path']
        check(f'stream retained: {stream["path"]}',target.is_file() and len(target.read_bytes()) == stream['bytes'] and sha(target.read_bytes()) == stream['sha256'])
    check(f'owned group absence receipt: {path.relative_to(ROOT)}', value['ownedProcessGroupAbsent'] is True)
    receipt_rows.append({'path':str(path.relative_to(ROOT)), 'exitCode':value['exitCode'],
                         'sourceHead':value['sourceHead'],'sourceDiffBytes':value.get('sourceDiffBytes'),
                         'timedOut':value['timedOut']})
baseline = json.loads((LANE/'baseline.json').read_bytes())
old_catalog = json.loads(blob(BASE,'packages/contracts/retrieval-0.2/catalog.json'))
check('pre-candidate baseline original rows exact',baseline['originals'] == old_catalog['originals'])
check('pre-candidate baseline prior descriptors exact',baseline['descriptors'] == old_catalog['operations'])
check('pre-candidate raw catalog binding exact',baseline['catalogRawSha256'] == sha(blob(BASE,'packages/contracts/retrieval-0.2/catalog.json')))
failed=[row for row in checks if not row['passed']]
print(json.dumps({'candidate':CANDIDATE,'base':BASE,'scope':'OFFLINE_SOURCE_ONLY','passed':len(checks)-len(failed),
 'failed':len(failed),'checks':checks,'familyIdentities':family_identities,'captureReceipts':receipt_rows,
 'priorTrackedPaths':len(old),'candidateTrackedPaths':len(new),'existingChangedPaths':changes},indent=2))
raise SystemExit(1 if failed else 0)
