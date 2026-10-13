"""Read-only source identity audit. No private source bodies are written."""
from pathlib import Path
import subprocess,json,hashlib,os
root=Path(__file__).resolve().parents[5];ev=Path(__file__).resolve().parent
base='a0614e7e16d6f92d0ca6eaa192cea7c5def21ec8';source='375bdddc412a5a44edc0892341b4b0950666a396'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):
 out={}
 for r in git('ls-tree','-rz',ref).split(b'\0'):
  if r:
   meta,path=r.split(b'\t',1);out[path.decode()]=meta.decode()
 return out
before=tree(base);after=tree('HEAD');changes=[p for p,b in before.items() if after.get(p)!=b]
expected=['apps/control/action-host/application-adapters/README.md','apps/control/action-host/application-adapters/authority-http.mjs']
assert sorted(changes)==sorted(expected),changes
p=expected[1];assert git('show',base+':'+p).splitlines()[1:]==(root/p).read_bytes().splitlines()[1:]
sourcePins=[]
for path in [*expected,*[p for p in after if p.startswith('apps/control/action-host/application-adapters/cross-repo/')]]:
 data=(root/path).read_bytes();assert data==git('show',source+':'+path),path;sourcePins.append({'path':path,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
pins=json.loads((root/'apps/control/action-host/application-adapters/cross-repo/pins.json').read_text());repo='/tmp/capiro-endpoint-integration-source-20261013.git'
assert subprocess.check_output(['git','--git-dir='+repo,'rev-parse',pins['commit']+'^{tree}'],text=True).strip()==pins['tree']
for p in pins['members']:
 b=subprocess.check_output(['git','--git-dir='+repo,'show',pins['commit']+':'+p['path']]);assert len(b)==p['bytes'] and hashlib.sha256(b).hexdigest()==p['sha256']
b=Path('/workspace/meri-read-continuation-20261012/packages/contracts/node_modules/typescript/lib/typescript.js').read_bytes();assert len(b)==pins['compiler']['bytes'] and hashlib.sha256(b).hexdigest()==pins['compiler']['sha256']
checks=[]
for label in ['first','final']:
 r=json.loads((ev/(label+'.json')).read_text());assert r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'] and r['sourceDiffBytes']==0
 try:os.killpg(r['ownedPidAndPgid'],0)
 except ProcessLookupError:pass
 else:raise AssertionError('owned process remains')
 for stream in r['streams']:
  b=(root/stream['path']).read_bytes();assert len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256']
 checks.append({'label':label,'exitCode':r['exitCode'],'group':r['ownedPidAndPgid'],'physicallyAbsent':True})
print(json.dumps({'base':base,'sourceFreeze':'9063f707','documentationFreeze':source,'reviewHead':git('rev-parse','HEAD').decode().strip(),'originalEntries':len(before),'unchangedOriginalEntries':len(before)-len(changes),'approvedOriginalChanges':changes,'authorityExecutableLinesUnchanged':True,'sourcePins':sourcePins,'capiroCommit':pins['commit'],'capiroTree':pins['tree'],'capiroPinsVerified':len(pins['members']),'compilerVerified':pins['compiler'],'captures':checks,'privateBodiesStored':False,'liveNativeOrProviderActivity':False},indent=2))
