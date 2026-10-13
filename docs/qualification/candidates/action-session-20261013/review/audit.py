"""Read-only exact-source/packet audit; no target service or module execution."""
import hashlib,json,os,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[5];e=Path(__file__).resolve().parent
base='9815492c51d35be3e83f08e6a5b086269437af04';source=sys.argv[1];packet=sys.argv[2] if len(sys.argv)>2 else None
def git(*a):return subprocess.check_output(['git',*a],cwd=root)
def tree(ref):return{r.split(b'\t',1)[1].decode():r.split(b'\t',1)[0].decode() for r in git('ls-tree','-rz',ref).split(b'\0') if r}
a,b=tree(base),tree(source);changed=sorted(p for p in a if a[p]!=b.get(p));assert changed==['apps/control/action-host/local-integration/case.mjs','apps/control/action-host/local-integration/ports.mjs'],changed
identities=[]
for p in sorted(b):
 if p in changed or p.startswith('apps/control/action-host/session/'):
  raw=git('show',f'{source}:{p}');assert(root/p).read_bytes()==raw,p;identities.append({'path':p,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
captures=[]
for label in ['owner-before','http-before','root-http-before','final-source']:
 r=json.loads((e/f'{label}.json').read_text());assert r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired']
 for s in r['streams']:
  raw=(root/s['path']).read_bytes();assert len(raw)==s['bytes'] and hashlib.sha256(raw).hexdigest()==s['sha256']
 try:os.killpg(r['ownedPidAndPgid'],0)
 except ProcessLookupError:pass
 else:raise AssertionError(r['ownedPidAndPgid'])
 captures.append({'label':label,'exitCode':r['exitCode'],'pgid':r['ownedPidAndPgid'],'freshAbsent':True})
result={'status':'PASS','base':base,'source':source,'baseEntries':len(a),'unchanged':len(a)-len(changed),'onlyOriginalChanges':changed,'sourceIdentities':identities,'captures':captures,'nativeAuthExecuted':False}
if packet:
 mp='docs/qualification/candidates/action-session-20261013/author/manifest.json';raw=git('show',f'{packet}:{mp}');m=json.loads(raw)
 for row in m['members']:
  blob=git('show',f"{packet}:{row['path']}");assert len(blob)==row['bytes'] and hashlib.sha256(blob).hexdigest()==row['sha256']
 result['authorPacket']={'commit':packet,'manifestSha256':hashlib.sha256(raw).hexdigest(),'membersVerified':len(m['members'])}
(e/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['sourceIdentities','captures']}))
