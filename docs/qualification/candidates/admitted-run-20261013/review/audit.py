"""Read-only Git preservation and owned capture verification; no runtime qualification."""
from pathlib import Path
import hashlib,json,os,subprocess,sys
root=Path(__file__).resolve().parents[5]
e=Path(__file__).resolve().parent
base='84c2ca01d0bce025a0003b6e724d675a05f2975a'
source='863b71de6dc0a965f9961184d65c83f484ce5fb0'
allowed={'apps/gateway/index.mjs','apps/gateway/budget/tool-budget-binding.mjs','apps/gateway/local-action/control-authorizer.mjs'}
production=sorted(allowed|{'apps/gateway/budget/admitted-run-owner.mjs','apps/gateway/budget/admitted-run-binding.mjs','apps/gateway/authorization/task-lookup-authorizer.mjs','apps/control/admitted-runs/mount.mjs'})
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):
 return {path:(meta.split()[0],meta.split()[2]) for line in git('ls-tree','-rz',ref).decode().split('\0') if line for meta,path in [line.split('\t',1)]}
before,after=tree(base),tree('HEAD');changed=[p for p in before if after.get(p)!=before[p]]
assert set(changed)==allowed,(changed,allowed)
sources=[]
for path in production:
 expected=git('show',source+':'+path);actual=(root/path).read_bytes();assert actual==expected,path
 sources.append({'path':path,'bytes':len(actual),'sha256':hashlib.sha256(actual).hexdigest()})
captures=[]
for label in ['owner-initial','mount-initial','repaired-plus-host','command-receipt-before','final-independent']:
 receipt=json.loads((e/(label+'.json')).read_text())
 assert not receipt['timedOut'] and receipt['ownedProcessGroupAbsent'] and not receipt['ownedGroupKillRequired']
 for stream in receipt['streams']:
  raw=(root/stream['path']).read_bytes();assert len(raw)==stream['bytes'] and hashlib.sha256(raw).hexdigest()==stream['sha256']
 try:os.killpg(receipt['ownedPidAndPgid'],0)
 except ProcessLookupError:pass
 else:raise AssertionError('owned process group persists')
 captures.append({'label':label,'exitCode':receipt['exitCode'],'groupAbsent':True,'streamsVerified':True})
result={'base':base,'acceptedProduction':source,'reviewHead':git('rev-parse','HEAD').decode().strip(),'baseEntries':len(before),'unchangedBaseEntries':len(before)-len(changed),'changedOriginalPaths':changed,'production':sources,'captures':captures,'scope':'READ_ONLY_SOURCE_AUDIT_NOT_NATIVE_QUALIFICATION'}
(e/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'baseEntries':len(before),'unchanged':len(before)-len(changed),'sourceFiles':len(sources),'captures':len(captures),'status':'PASS'}))
