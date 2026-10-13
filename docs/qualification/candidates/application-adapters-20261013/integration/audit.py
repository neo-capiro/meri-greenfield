"""Offline integration preservation, immutable lane manifests and owned check captures."""
from pathlib import Path
import hashlib,json,os,subprocess,sys
root=Path(__file__).resolve().parents[5]; packet=Path(__file__).resolve().parent
base='ad0bdfeb830fee11f1f39c4a8a7037215595c4cf'
source,review=sys.argv[1:3]
def git(*args,cwd=root): return subprocess.check_output(['git',*args],cwd=cwd)
def tree(ref): return {p.decode():m.decode() for item in git('ls-tree','-rz',ref).split(b'\0') if item for m,p in [item.split(b'\t',1)]}
checks=[]
def check(name,ok):
 checks.append({'name':name,'pass':bool(ok)})
 if not ok: raise AssertionError(name)
original,current,accepted,reviewed=tree(base),tree('HEAD'),tree(source),tree(review)
exceptions=['apps/control/action-host/session/README.md','apps/control/action-host/session/owner.mjs']
changed=[p for p,v in original.items() if current.get(p)!=v]
check('only allocated original session seam and documentation changed',sorted(changed)==sorted(exceptions))
check('all original tests contracts registry and failures preserved',all(current.get(p)==v for p,v in original.items() if p not in exceptions))
for p in exceptions+[p for p in accepted if p.startswith(('apps/control/action-host/application-adapters/','packages/contracts/action-authority-0.2/')) and p.endswith('.mjs')]:
 check('accepted author source '+p,current.get(p)==accepted[p])
for p in reviewed:
 if p.startswith(('apps/control/action-host/application-adapters/','packages/contracts/action-authority-0.2/')) and p.endswith('-independent.test.mjs'):
  check('exact independent controls '+p,current.get(p)==reviewed[p])
counts={}
for manifest in sorted(packet.parent.glob('*/manifest.json')):
 if manifest.parent==packet: continue
 members=json.loads(manifest.read_text())['members']; counts[manifest.parent.name]=len(members)
 for member in members:
  raw=(root/member['path']).read_bytes()
  check('retained '+member['path'],len(raw)==member['bytes'] and hashlib.sha256(raw).hexdigest()==member['sha256'])
references=json.loads((packet.parent/'capiro-boundary/reference-identities.json').read_text())
for reference in references['references']:
 repo=references['repositories'][reference['repository']]['path']
 raw=git('show',reference['commit']+':'+reference['path'],cwd=repo)
 check('exact private source reference '+reference['id'],len(raw)==reference['bytes'] and hashlib.sha256(raw).hexdigest()==reference['sha256'])
receipts=[]
for label in ['integrated-check','mounted-http']:
 r=json.loads((packet/(label+'.json')).read_text())
 check('bounded passing capture '+label,r['exitCode']==0 and not r['timedOut'] and r['sourceDiffBytes']==0 and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'])
 for stream in r['streams']:
  raw=(root/stream['path']).read_bytes()
  check('exact captured '+stream['path'],len(raw)==stream['bytes'] and hashlib.sha256(raw).hexdigest()==stream['sha256'])
 try: os.killpg(r['ownedPidAndPgid'],0); absent=False
 except ProcessLookupError: absent=True
 check('owned group freshly absent '+label,absent)
 receipts.append({'label':label,'testedHead':r['sourceHead'],'ownedPidAndPgid':r['ownedPidAndPgid']})
summary={'base':base,'reviewedSource':source,'reviewerSource':review,'originalEntries':len(original),'originalEntriesUnchanged':len(original)-len(changed),'approvedChanges':changed,'laneManifestMembers':counts,'privateReferenceCount':len(references['references']),'receipts':receipts,'passed':len(checks),'failed':0,'checks':checks}
(packet/'audit.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k!='checks'}))
