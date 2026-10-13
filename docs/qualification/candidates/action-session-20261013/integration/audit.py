"""Check accepted session bytes, original entry preservation and captured owned cleanup."""
from pathlib import Path
import hashlib,json,os,subprocess,sys
root=Path(__file__).resolve().parents[5]; packet=Path(__file__).resolve().parent
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):return {p.decode():m.decode() for item in git('ls-tree','-rz',ref).split(b'\0') if item for m,p in [item.split(b'\t',1)]}
checks=[]
def check(name,ok):
 checks.append({'name':name,'pass':bool(ok)})
 if not ok:raise AssertionError(name)
source=sys.argv[1]; base='658bb5c0f8c47b80904cbc5c7453b3f8c3dba79c'
original=tree(base); current=tree('HEAD'); accepted=tree(source)
exceptions=['apps/control/action-host/local-integration/case.mjs','apps/control/action-host/local-integration/ports.mjs']
changed=[p for p,v in original.items() if current.get(p)!=v]
check('only two allocated existing case files changed',sorted(changed)==sorted(exceptions))
check('all original tests public contracts and evidence retained',all(current.get(p)==v for p,v in original.items() if p not in exceptions))
for p in exceptions+[p for p in accepted if p.startswith('apps/control/action-host/session/') and p.endswith('.mjs')]:
 check('exact reviewed source '+p,current.get(p)==accepted[p])
pilot_source='d16896b348daa765f3cb069732c9a70e5ffe13b0'; pilot_tree=tree(pilot_source)
for p in [p for p in pilot_tree if p.startswith('evals/action-followthrough/local-baseline/') and p.endswith('.mjs')]:
 check('exact reviewed pilot source '+p,current.get(p)==pilot_tree[p])
counts={}
for manifest in sorted(packet.parent.glob('*/manifest.json')):
 if manifest.parent==packet:continue
 members=json.loads(manifest.read_text())['members']; counts[manifest.parent.name]=len(members)
 for member in members:
  raw=(root/member['path']).read_bytes()
  check('retained '+member['path'],len(raw)==member['bytes'] and hashlib.sha256(raw).hexdigest()==member['sha256'])
receipts=[]
for label in ['integrated-check','pilot-baseline-tests','pilot-baseline-cli']:
 r=json.loads((packet/(label+'.json')).read_text())
 check('bounded clean passing capture '+label,r['exitCode']==0 and not r['timedOut'] and r['sourceDiffBytes']==0 and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'])
 for s in r['streams']:
  raw=(root/s['path']).read_bytes();check('captured '+s['path'],len(raw)==s['bytes'] and hashlib.sha256(raw).hexdigest()==s['sha256'])
 try:os.killpg(r['ownedPidAndPgid'],0);absent=False
 except ProcessLookupError:absent=True
 check('owned group freshly absent '+label,absent)
 receipts.append({'label':label,'testedHead':r['sourceHead'],'ownedProcessGroupAbsent':r['ownedPidAndPgid']})
baseline=json.loads((packet/'pilot-baseline-cli.stdout.bin').read_text())
check('all six baseline rows accounted and passed',baseline['caseCount']==6 and baseline['passed']==6 and [c['id'] for c in baseline['cases']]==['P01','P02','P03','P04','P05','P06'])
check('no real or model/provider/native claims',baseline['qualifiedRealRequests']==0 and baseline['modelCalls']==0 and baseline['providerCalls']==0 and baseline['nativeDatabase'] is False)
check('all six prohibit approvals/effects and close',all(c['effects']['approvals']==0 and c['effects']['taskEffects']==0 and c['cleanup']=={'closed':True,'postCloseStatus':401,'noAdditionalEffects':True} for c in baseline['cases']))
summary={'base':base,'reviewedSource':source,'reviewedPilotSource':pilot_source,'originalEntries':len(original),'originalEntriesUnchanged':len(original)-len(changed),'approvedChanges':changed,'laneManifestMembers':counts,'receipts':receipts,'passed':len(checks),'failed':0,'checks':checks}
(packet/'audit.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k!='checks'}))
