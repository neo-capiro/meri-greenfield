"""Read-only Git/source receipt audit; no target module import or native access."""
import hashlib,json,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
E=Path(__file__).resolve().parent
BASE='334890d930fbdb209044c30ff552409bcb86240e'
SOURCE='fc76ac68f8e2b2b0de6f214326a7f67b9a7ef661'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def tree(ref):
 return {r.split(b'\t',1)[1].decode():r.split(b'\t',1)[0].decode() for r in git('ls-tree','-rz',ref).split(b'\0') if r}
a,b=tree(BASE),tree(SOURCE)
changed=sorted(p for p in a if a[p]!=b.get(p))
expected=['apps/control/action-host/local/recovery.mjs','apps/gateway/local-action/gateway.mjs']
assert changed==expected,(changed,expected)
sourcePaths=sorted(p for p in b if p.startswith('apps/control/action-host/local-integration/') or p in expected)
identities=[]
for p in sourcePaths:
 raw=git('show',f'{SOURCE}:{p}')
 assert (ROOT/p).read_bytes()==raw,p
 identities.append({'path':p,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
checks=[]
for label in ['initial-controls','coherent-controls','direct-readback-before','original-parked-callbacks','final-source']:
 r=json.loads((E/f'{label}.json').read_text())
 assert r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired']
 for s in r['streams']:
  raw=(ROOT/s['path']).read_bytes();assert len(raw)==s['bytes'] and hashlib.sha256(raw).hexdigest()==s['sha256']
 try:os.killpg(r['ownedPidAndPgid'],0)
 except ProcessLookupError:pass
 else:raise AssertionError(('owned process group remains',r['ownedPidAndPgid']))
 checks.append({'label':label,'exitCode':r['exitCode'],'group':r['ownedPidAndPgid'],'freshAbsent':True})
assert all(a[p]==b[p] for p in a if p.startswith(('packages/contracts/','apps/worker/')))
result={'decision':'PASS','base':BASE,'source':SOURCE,'baseEntries':len(a),'unchangedBaseEntries':len(a)-len(changed),'onlyChangedExisting':changed,'sourceIdentities':identities,'captures':checks,'nativeEngineExecuted':False,'scope':'SOURCE_ONLY; existing inert SQL boundaries and loopback HTTP'}
(E/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':'PASS','baseEntries':len(a),'unchanged':len(a)-len(changed),'exactSourceFiles':len(identities),'captures':len(checks)}))
