"""Read exact Git objects and existing capture; no product import or execution."""
import hashlib,json,os,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
base='f8e3507307640ee6b4904782cfb20f2b05e5e7b0'
source='7c67345398aa5422f6c760f009b729d082cfeaea'
packet=sys.argv[1]
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def blob(ref,path):return git('show',f'{ref}:{path}')
def tree(ref):
 out={}
 for raw in git('ls-tree','-rz','--full-tree',ref).split(b'\0'):
  if not raw:continue
  head,path=raw.split(b'\t',1);out[path.decode()]=head.decode()
 return out
checks=[]
def check(name,value):
 checks.append({'name':name,'pass':bool(value)})
 if not value:raise AssertionError(name)
before,after=tree(base),tree('HEAD')
check('all original Git entries retain exact mode/type/blob',all(after.get(p)==v for p,v in before.items()))
source_paths=['apps/control/action-host/'+p for p in ['index.mjs','current.mjs','resolver.mjs']]
identities=[]
for p in source_paths:
 data=blob(source,p);check('tested source exact '+p,(root/p).read_bytes()==data==blob(packet,p))
 check('no test import '+p,b'/test/' not in data and b'fixture.mjs' not in data)
 identities.append({'path':p,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
receipt=json.loads((evidence/'independent-first.json').read_text())
check('32 controls completed without skip',b'pass 32' in (evidence/'independent-first.stdout.bin').read_bytes() and b'fail 0' in (evidence/'independent-first.stdout.bin').read_bytes() and b'skipped 0' in (evidence/'independent-first.stdout.bin').read_bytes())
check('successful bounded capture',receipt['exitCode']==0 and not receipt['timedOut'] and receipt['ownedProcessGroupAbsent'] and not receipt['ownedGroupKillRequired'])
check('exact tested production and independent source',all(blob(receipt['sourceHead'],p)==(root/p).read_bytes() for p in source_paths+['apps/control/action-host/binding-independent.test.mjs']))
for r in receipt['streams']:
 data=(root/r['path']).read_bytes();check('raw stream '+r['path'],len(data)==r['bytes'] and hashlib.sha256(data).hexdigest()==r['sha256'])
try:os.killpg(receipt['ownedPidAndPgid'],0);absent=False
except ProcessLookupError:absent=True
check('owned group freshly absent',absent)
manifest_path='docs/qualification/candidates/action-host-20261013/binding-author/manifest.json'
manifest_bytes=blob(packet,manifest_path);manifest=json.loads(manifest_bytes)
for r in manifest['members']:
 data=blob(packet,r['path']);check('author member '+r['path'],len(data)==r['bytes'] and hashlib.sha256(data).hexdigest()==r['sha256'])
result={'base':base,'source':source,'authorPacket':packet,'originalEntries':len(before),'originalEntriesUnchanged':len(before),'sourceIdentities':identities,'authorManifestMembers':len(manifest['members']),'authorManifestSha256':hashlib.sha256(manifest_bytes).hexdigest(),'independentTests':32,'ownedProcessGroup':receipt['ownedPidAndPgid'],'ownedProcessGroupFreshlyAbsent':absent,'checks':checks,'passed':len(checks),'failed':0,'scope':'source only; no native authentication, database, deployment, public catalog activation or durability claim'}
(evidence/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['checks','sourceIdentities']}))
