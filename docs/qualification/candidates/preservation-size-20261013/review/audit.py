"""Local Git/source preservation and owned-capture audit; no native evidence access."""
import hashlib,json,os,pathlib,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[5]
packet=pathlib.Path(__file__).resolve().parent
base='a16e52ef5bd8d570c995dff298facbc0d1969000'
source=sys.argv[1]
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def entries(ref):
 rows={}
 for raw in git('ls-tree','-r','-z',ref).split(b'\0'):
  if raw:
   ident,path=raw.split(b'\t',1);rows[path.decode()]=ident.decode()
 return rows
before,after=entries(base),entries('HEAD')
assert not(set(before)-set(after))
changed=sorted(p for p in before if before[p]!=after[p])
allowed=['apps/control/qualified-application/schema-contract.mjs','apps/control/qualified-application/schema.mjs']
assert changed==allowed,(changed,allowed)
pins=[]
for path in allowed+['apps/control/qualified-application/schema-preservation.mjs']:
 expected=git('show',f'{source}:{path}');actual=(root/path).read_bytes();assert actual==expected,path
 pins.append({'path':path,'bytes':len(actual),'sha256':hashlib.sha256(actual).hexdigest()})
assert git('show',base+':apps/control/qualified-application/schema-preservation.mjs')==(root/'apps/control/qualified-application/schema-preservation.mjs').read_bytes()
checks=[]
for label in ['baseline','final']:
 receipt=json.loads((packet/(label+'.json')).read_text())
 assert receipt['sourceDiffBytes']==0 and receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and not receipt['ownedGroupKillRequired']
 for stream in receipt['streams']:
  raw=(root/stream['path']).read_bytes();assert len(raw)==stream['bytes'] and hashlib.sha256(raw).hexdigest()==stream['sha256']
 try:os.killpg(receipt['ownedPidAndPgid'],0)
 except ProcessLookupError:pass
 else:raise AssertionError('owned process group remains')
 checks.append({'label':label,'exitCode':receipt['exitCode'],'group':receipt['ownedPidAndPgid'],'freshlyAbsent':True})
assert checks[0]['exitCode']==1 and checks[1]['exitCode']==0
out={'base':base,'sourceFreeze':git('rev-parse',source).decode().strip(),'originalEntries':len(before),'unchangedOriginalEntries':len(before)-len(changed),'approvedOriginalChanges':changed,'sourcePins':pins,'captures':checks,'allOriginalTestsAndMigrationsUnchanged':True,'nativeFixtureAndSQLUnchanged':True,'dependencyLinksCreated':False,'nativeOrDatabaseActivity':False}
(packet/'audit.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out))
