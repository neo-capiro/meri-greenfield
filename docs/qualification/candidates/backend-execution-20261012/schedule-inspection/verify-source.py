"""Offline source/SDK-file/capture audit. Does not execute SDK or private sources."""
from pathlib import Path
import json,hashlib,subprocess,os
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
checks=[]
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def check(ok,label):checks.append({'check':label,'pass':bool(ok)})
base='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8'
head=git('rev-parse','HEAD').decode().strip()
def tree(ref):return {x.split(None,3)[3]:x.split(None,3)[:3]for x in git('ls-tree','-r',ref).decode().splitlines()}
old,new=tree(base),tree(head)
check(all(new.get(k)==v for k,v in old.items()),f'all {len(old)} original Git entries preserved')
shared='packages/runtime/operation-lifetime.mjs'
check((root/shared).read_bytes()==git('show','37f84fcb3bf2d34ae59673b1644fac64f1ef798c:'+shared),'exact root-owned shared lifetime dependency')
for item in json.loads((evidence/'sdk-metadata.json').read_text())['installed']:
    data=Path(item['path']).read_bytes()
    check(len(data)==item['bytes']and hashlib.sha256(data).hexdigest()==item['sha256'],'SDK metadata '+Path(item['path']).name)
for path in evidence.glob('*.json'):
    receipt=json.loads(path.read_text())
    if not isinstance(receipt,dict)or'ownedPidAndPgid'not in receipt:continue
    check(receipt['ownedProcessGroupAbsent']and not receipt['timedOut']and not receipt['ownedGroupKillRequired'],'bounded exit '+path.name)
    for stream in receipt['streams']:
        data=(root/stream['path']).read_bytes()
        check(len(data)==stream['bytes']and hashlib.sha256(data).hexdigest()==stream['sha256'],'raw output '+Path(stream['path']).name)
    try:os.killpg(receipt['ownedPidAndPgid'],0)
    except ProcessLookupError:absent=True
    else:absent=False
    check(absent,'owned group absent '+str(receipt['ownedPidAndPgid']))
for path in ['apps/control/schedules/temporal-inspection.mjs','apps/control/test/temporal-inspection.test.mjs','packages/contracts/schedules-0.2/inspection.schema.json','packages/contracts/schedules-0.2/inspection-validation.mjs']:
    check(git('show',head+':'+path)==(root/path).read_bytes(),'frozen source '+path)
result={'base':base,'sourceFreeze':head,'passed':sum(x['pass']for x in checks),'total':len(checks),'checks':checks,'scope':'OFFLINE_SOURCE_ONLY_NO_SDK_SERVICE'}
(evidence/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k]for k in ['sourceFreeze','passed','total','scope']}))
raise SystemExit(0 if all(x['pass']for x in checks)else 1)
