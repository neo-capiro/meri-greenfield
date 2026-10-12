"""Read-only Git byte audit for the exact ten-family integration; no target imports."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[5]
EVIDENCE=Path(__file__).resolve().parent
candidate, expectations_path=sys.argv[1:]
expectations=json.loads(Path(expectations_path).read_text())
baseline=json.loads((EVIDENCE/'baseline.json').read_text())
pins=json.loads((EVIDENCE/'accepted-family-pins.json').read_text())
checks=[]
def git(*args):
    return subprocess.check_output(['git',*args],cwd=ROOT)
def blob(ref,path):
    return git('show',f'{ref}:{path}')
def tree(ref):
    rows={}
    for entry in git('ls-tree','-rz',ref).split(b'\0'):
        if entry:
            meta,path=entry.split(b'\t',1)
            rows[path.decode()]=meta.split()[2].decode()
    return rows
def check(name,condition):
    checks.append({'name':name,'result':'PASS' if condition else 'FAIL'})
def digest(data):
    return hashlib.sha256(data).hexdigest()

candidate=git('rev-parse',candidate).decode().strip()
recorded={row['path']:row['blob'] for row in baseline['files']}
old=tree(baseline['base'])
check('recorded baseline contains exact original PR28 blobs',all(recorded.get(path)==oid for path,oid in old.items()))
check('only preexisting reviewer criteria added to baseline snapshot',set(recorded)-set(old)=={'docs/qualification/candidates/read-continuation-20261012/reference-integration-review/criteria.json'})
current=tree(candidate)
changed=sorted(path for path,old_blob in old.items() if current.get(path)!=old_blob)
check('exact reviewed existing-path changes only',changed==sorted(expectations['changedOriginalPaths']))
check('no original files deleted',all(path in current for path in old))
check('original public0.1 package and dependencies untouched',all(current.get(p)==oid for p,oid in old.items() if (p.startswith('packages/contracts/') and not p.startswith(('packages/contracts/retrieval-0.2/','packages/contracts/test/'))) or p.endswith(('package-lock.json','package.json'))))
runtime_test_changes=set(expectations.get('allowedRuntimeTestChanges',[]))
check('only reviewed gateway test expectations exempted from runtime byte equality',runtime_test_changes.issubset(set(expectations['changedOriginalPaths'])) and all(p.startswith('apps/gateway/test/') and p.endswith('.test.mjs') for p in runtime_test_changes))
check('runtime production, worker, proxy and Python source unchanged',all(current.get(p)==oid for p,oid in old.items() if p.startswith(('apps/','scripts/')) and p not in runtime_test_changes))
check('canonical bounded JSON snapshot owner unchanged',current['packages/contracts/retrieval-0.2/operation-contracts.mjs']==old['packages/contracts/retrieval-0.2/operation-contracts.mjs'])
identity_changes={row['path']:row for row in expectations.get('familyIdentityChanges',[])}
check('at most exact two authorized family identity changes',set(identity_changes).issubset({'packages/contracts/retrieval-0.2/legislative-directory.schema.json','packages/contracts/retrieval-0.2/rule-status.schema.json'}))
for lane in pins['lanes']:
    for row in lane['files']:
        data=blob(candidate,row['path'])
        original=blob(lane['source'],row['path'])
        if row['path'] in identity_changes:
            change=identity_changes[row['path']]
            before,after=change['oldId'].encode(),change['newId'].encode()
            check('exact authorized single schema identity replacement: '+row['path'],original.count(before)==1 and data==original.replace(before,after,1) and digest(data)==change['sha256'])
        else:
            check(f"accepted {lane['lane']} bytes: {row['path']}",len(data)==row['bytes'] and digest(data)==row['sha256'] and data==original)
    review_files=git('diff-tree','--no-commit-id','--name-only','-r',lane['independentReview']).decode().splitlines()
    check(f"independent verdict object exists: {lane['lane']}",len(review_files)>0)
for row in expectations['reviewedExistingPatches']:
    patch=git('diff',baseline['base'],candidate,'--',row['path'])
    check('reviewed exact existing patch: '+row['path'],digest(patch)==row['patchSha256'])
for entry in expectations.get('rootReceipts',[]):
    receipt=json.loads(blob(candidate,entry['path']))
    check('root receipt successful bounded cleanup: '+entry['path'],receipt['exitCode']==0 and receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and not receipt['ownedGroupKillRequired'])
    for stream in receipt['streams']:
        data=blob(candidate,stream['path'])
        check('root stream exact: '+stream['path'],len(data)==stream['bytes'] and digest(data)==stream['sha256'])
    if entry.get('sourceHead') is not None:
        check('root receipt exact source head: '+entry['path'],receipt['sourceHead']==entry['sourceHead'])
result={'candidate':candidate,'tree':git('rev-parse',candidate+'^{tree}').decode().strip(),'base':baseline['base'],'originalFiles':len(old),'unchangedOriginalFiles':len(old)-len(changed),'changedOriginalPaths':changed,'checks':checks,'passed':sum(x['result']=='PASS' for x in checks),'failed':sum(x['result']=='FAIL' for x in checks),'scope':'READ_ONLY_GIT_SOURCE_EVIDENCE_NOT_RUNTIME'}
print(json.dumps(result,indent=2))
raise SystemExit(0 if result['failed']==0 else 1)
