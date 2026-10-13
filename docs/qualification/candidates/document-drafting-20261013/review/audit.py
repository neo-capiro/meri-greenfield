"""Read-only exact Git preservation and captured-stream audit; no service access."""
import hashlib,json,os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
base='b5243ae164f68c7591b039e8365d9897390543d2'
author='8e21145f7f4745d20e84c3c2e51efcd93d33483f'
fixture='929ea5cc'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):
 result={}
 for entry in git('ls-tree','-rz',ref).split(b'\0'):
  if entry:
   metadata,path=entry.split(b'\t',1);result[path.decode()]=metadata.decode()
 return result
before=tree(base);after=tree('HEAD')
changed=[p for p,v in before.items() if after.get(p)!=v]
assert not changed,changed
pins=[]
for ref,paths in [(author,['apps/control/document-application/'+p for p in ['index.mjs','current.mjs','http.mjs','test/application.test.mjs']]),(fixture,['apps/control/document-application/local/'+p for p in ['fixture.mjs','ports.mjs','mount.mjs','flow.mjs','inspect_docx.py','local.test.mjs']]+['scripts/local-document/run.mjs'])]:
 for path in paths:
  expected=git('show',ref+':'+path);actual=(root/path).read_bytes();assert expected==actual,path
  pins.append({'path':path,'gitRef':ref,'sha256':hashlib.sha256(actual).hexdigest(),'bytes':len(actual)})
receipts=[]
for label in ['first','isolated','port-boundaries-before','repaired']:
 r=json.loads((evidence/(label+'.json')).read_text())
 assert r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired']
 assert r['sourceDiffBytes']==0
 try:os.killpg(r['ownedPidAndPgid'],0)
 except ProcessLookupError:pass
 else:raise AssertionError('owned group remains')
 for stream in r['streams']:
  raw=(root/stream['path']).read_bytes();assert len(raw)==stream['bytes'];assert hashlib.sha256(raw).hexdigest()==stream['sha256']
 receipts.append({'label':label,'exitCode':r['exitCode'],'group':r['ownedPidAndPgid'],'freshAbsent':True})
catalog=json.loads((root/'packages/contracts/retrieval-0.2/catalog.json').read_text())
summary={'base':base,'reviewHead':git('rev-parse','HEAD').decode().strip(),'authorSource':author,'rootFixtureSource':fixture,'originalEntries':len(before),'unchangedOriginalEntries':len(before),'originalChanges':changed,'pins':pins,'receipts':receipts,'scope':'SOURCE_ONLY; actual local DOCX and HTTP, synthetic identity/SQL; no native qualification'}
print(json.dumps(summary,indent=2))
