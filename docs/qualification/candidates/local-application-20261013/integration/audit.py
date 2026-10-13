"""Verify retained source/evidence and bounded integration receipts; no application imports."""
from pathlib import Path
import hashlib,json,os,subprocess
root=Path(__file__).resolve().parents[5]; packet=Path(__file__).resolve().parent
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):return {p.decode():m.decode() for item in git('ls-tree','-rz',ref).split(b'\0') if item for m,p in [item.split(b'\t',1)]}
checks=[]
def check(name,ok):
    checks.append({'name':name,'pass':bool(ok)})
    if not ok:raise AssertionError(name)
base='334890d930fbdb209044c30ff552409bcb86240e'; original=tree(base); current=tree('HEAD')
exceptions=['apps/control/action-host/local/recovery.mjs','apps/gateway/local-action/gateway.mjs']
approved=exceptions+['docs/coordination/tasks/CODEX-LOCAL-APPLICATION-20261013.md']
changes=[p for p,v in original.items() if current.get(p)!=v]
check('only two allocated original source paths and root outline changed',sorted(changes)==sorted(approved))
check('all original tests and public package bytes retained',all(current.get(p)==v for p,v in original.items() if p not in approved))
source='fc76ac68f8e2b2b0de6f214326a7f67b9a7ef661'
accepted=tree(source)
paths=exceptions+[p for p in accepted if p.startswith('apps/control/action-host/local-integration/') and p.endswith('.mjs')]
for p in paths:check('reviewed source '+p,current.get(p)==accepted[p])
counts={}
for manifest in sorted(packet.parent.glob('*/manifest.json')):
    if manifest.parent==packet:continue
    members=json.loads(manifest.read_text())['members'];counts[manifest.parent.name]=len(members)
    for member in members:
        raw=(root/member['path']).read_bytes()
        check('manifest '+member['path'],len(raw)==member['bytes'] and hashlib.sha256(raw).hexdigest()==member['sha256'])
receipts=[]
for label in ['integrated-check','scripted-application']:
    r=json.loads((packet/(label+'.json')).read_text())
    check('bounded passing receipt '+label,r['exitCode']==0 and not r['timedOut'] and r['sourceDiffBytes']==0 and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'])
    for stream in r['streams']:
        raw=(root/stream['path']).read_bytes()
        check('raw stream '+stream['path'],len(raw)==stream['bytes'] and hashlib.sha256(raw).hexdigest()==stream['sha256'])
    try:os.killpg(r['ownedPidAndPgid'],0);absent=False
    except ProcessLookupError:absent=True
    check('fresh owned group absence '+label,absent)
    receipts.append({key:r[key] for key in ['sourceHead','ownedPidAndPgid','durationSeconds']})
result=json.loads((packet/'scripted-application.stdout.bin').read_text())
check('scripted receipt does not claim native evidence',result['nativeDatabase'] is False and result['poolEvidence']=='scripted-shared-state' and result['productionActivated'] is False)
check('one shared allocation and expected aggregate',result['allocations']==1 and result['grants']==2 and result['reservations']==2 and result['chargedMicroUsd']=='20')
check('one read/effect and closed owner',result['stats']['sourceReads']==1 and result['stats']['taskEffects']==1 and result['stats']['closed'] is True)
check('owned pools/listeners closed',result['freshPools']=={'opened':2,'closed':2} and result['listeners']==[{'closed':True,'listening':False,'activeSockets':0}]*3)
summary={'base':base,'reviewedSource':source,'originalEntries':len(original),'originalEntriesUnchanged':len(original)-len(changes),'approvedOriginalChanges':changes,'laneManifestMembers':counts,'receipts':receipts,'passed':len(checks),'failed':0,'checks':checks}
(packet/'audit.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k!='checks'}))
