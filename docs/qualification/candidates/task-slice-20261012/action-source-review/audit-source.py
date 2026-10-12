"""Read-only Git/source audit; no private producer bodies enter this packet."""
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];BASE='77cedb126d57a0223d2df42ad2f3fe988eb51759';AUTHOR='eaa00fd0ea8ec98bc77b050caaa6526a2738405e';SHARED='84a9313735ec9fb079e35a92adb074f6afaf32e7';PROFILE='2c21104fd51608293fe21914e6f057691b4decb4'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def blob(ref,p):return git('show',ref+':'+p)
def tree(ref):
 return {p.decode():header.decode().split()[-1] for item in git('ls-tree','-rz',ref).split(b'\0') if item for header,p in [item.split(b'\t',1)]}
checks=0
def check(ok,label):
 global checks
 checks+=1
 if not ok:raise AssertionError(label)
before=tree(BASE);after=tree('HEAD');allow={'apps/gateway/dispatch/operation-context.mjs','apps/gateway/dispatch/read-result-envelope.mjs','packages/contracts/retrieval-0.2/catalog-validation.mjs'}
changed=[]
for p,h in before.items():
 check(p in after,'base entry removed: '+p)
 if after[p]!=h:changed.append(p);check(p in allow,'unallocated change: '+p)
 else:check(True,'unchanged')
check(set(changed)==allow,'exact three original source deltas')
source=[]
for name in ['request-context','projection','http-adapter','handler']:
 p=f'apps/gateway/sources/action-items/{name}.mjs';b=blob('HEAD',p);check(b==blob(AUTHOR,p),'author exact '+p);source.append({'path':p,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)})
for p,ref in [('apps/gateway/dispatch/action-read-context.mjs',SHARED),('apps/gateway/dispatch/operation-context.mjs',SHARED),('apps/gateway/dispatch/read-result-envelope.mjs',PROFILE),('packages/contracts/retrieval-0.2/catalog-validation.mjs',PROFILE)]:
 b=blob('HEAD',p);check(b==blob(ref,p),'shared exact '+p);source.append({'path':p,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)})
catalog=json.loads(blob('HEAD','packages/contracts/retrieval-0.2/catalog.json'));check(len(catalog['operations'])==97,'97 descriptors');check(all(x['handler'] is None and x['availability']=='unimplemented' for x in catalog['operations']),'all unavailable');check(blob('HEAD','packages/contracts/retrieval-0.2/catalog.json')==blob(BASE,'packages/contracts/retrieval-0.2/catalog.json'),'catalog byte identical');check(blob('HEAD','packages/contracts/meri.schema.json')==blob(BASE,'packages/contracts/meri.schema.json'),'public0.1 exact')
refs=json.loads((Path(__file__).parent/'reference-identities.json').read_text())['references'];private=Path('/workspace/capirov2')
for r in refs:
 for key in ['pinned','observed']:
  d=subprocess.check_output(['git','show',r[key]['commit']+':'+r['path']],cwd=private);check(len(d)==r[key]['bytes'] and hashlib.sha256(d).hexdigest()==r[key]['sha256'],'private hash '+r['path'])
 check(r['pinned']['sha256']==r['observed']['sha256'],'private unchanged')
for path in Path(__file__).parent.glob('*.json'):
 if path.name in ['manifest.json']:continue
 try:r=json.loads(path.read_text())
 except json.JSONDecodeError:continue
 if isinstance(r,dict) and 'ownedPidAndPgid' in r:
  check(r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'],'capture cleanup '+path.name)
  for s in r['streams']:
   d=(ROOT/s['path']).read_bytes();check(hashlib.sha256(d).hexdigest()==s['sha256'] and len(d)==s['bytes'],'raw hash '+s['path'])
print(json.dumps({'checksPassed':checks,'reviewHead':git('rev-parse','HEAD').decode().strip(),'base':BASE,'author':AUTHOR,'rootProfile':PROFILE,'rootRepair':SHARED,'baseEntries':len(before),'unchangedBaseEntries':len(before)-len(changed),'changedOriginals':changed,'pairedPrivateReferences':len(refs),'source':source,'runtimeAccepted':False},indent=2))
