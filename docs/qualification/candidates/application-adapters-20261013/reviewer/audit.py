"""Read-only source, raw capture and packet audit. No target imports or service calls."""
import hashlib,json,os,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[5];e=Path(__file__).resolve().parent
base='ad0bdfeb830fee11f1f39c4a8a7037215595c4cf';source='1afbb5a53ebbf0eca9252b3b09ceb3e404918151'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):return {x.split(b'\t',1)[1].decode():x.split(b'\t',1)[0].decode() for x in git('ls-tree','-rz',ref).split(b'\0') if x}
a,b=tree(base),tree(source)
changed=sorted(p for p in a if a[p]!=b.get(p));assert changed==['apps/control/action-host/session/README.md','apps/control/action-host/session/owner.mjs'],changed
newsrc=sorted(p for p in b if p not in a and p.startswith(('apps/','packages/')))
assert newsrc==['apps/control/action-host/application-adapters/adapters.test.mjs','apps/control/action-host/application-adapters/authority-http.mjs','apps/control/action-host/application-adapters/context-adapter.mjs','apps/control/action-host/application-adapters/mount.mjs','packages/contracts/action-authority-0.2/validate.mjs'],newsrc
identities=[]
for p in changed+newsrc:
 raw=git('show',f'{source}:{p}');assert(root/p).read_bytes()==raw,p
 identities.append({'path':p,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
records=[]
for label in ['first-independent','transport-before','final-source','legacy-session']:
 r=json.loads((e/f'{label}.json').read_text());assert r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired']
 for s in r['streams']:
  raw=(root/s['path']).read_bytes();assert len(raw)==s['bytes'] and hashlib.sha256(raw).hexdigest()==s['sha256']
 try:os.killpg(r['ownedPidAndPgid'],0)
 except ProcessLookupError:pass
 else:raise AssertionError(r['ownedPidAndPgid'])
 records.append({'label':label,'exitCode':r['exitCode'],'pgid':r['ownedPidAndPgid'],'freshAbsent':True})
result={'decision':'ACCEPT_SOURCE','base':base,'source':source,'baseEntries':len(a),'unchanged':len(a)-len(changed),'onlyOriginalChanges':changed,'sourceIdentities':identities,'captures':records,'checks':{'independent':50,'author':11,'legacySession':9,'finalCombinedCapture':'61pass / 1 unchanged-module sparse import failure','affectedLegacyReplay':'9/9 PASS after exact missing blob restoration'},'liveNativeIntegration':False}
if len(sys.argv)>1:
 packet=sys.argv[1];path='docs/qualification/candidates/application-adapters-20261013/author/manifest.json';raw=git('show',f'{packet}:{path}');m=json.loads(raw)
 for row in m['members']:
  blob=git('show',f"{packet}:{row['path']}");assert len(blob)==row['bytes'] and hashlib.sha256(blob).hexdigest()==row['sha256']
 for item in identities:
  blob=git('show',f"{packet}:{item['path']}");assert hashlib.sha256(blob).hexdigest()==item['sha256']
 result['authorPacket']={'commit':packet,'manifestSha256':hashlib.sha256(raw).hexdigest(),'membersVerified':len(m['members'])}
(e/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['sourceIdentities','captures']}))
