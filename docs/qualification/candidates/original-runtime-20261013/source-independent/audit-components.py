"""Read-only component provenance/preservation audit; native source DATA only."""
import hashlib,json,pathlib,subprocess,os,tarfile
HERE=pathlib.Path(__file__).resolve().parent
PRODUCER=pathlib.Path('/workspace/meri-original-producer-source-review')
PUBLIC=pathlib.Path('/workspace/meri-public-lifecycle-source-review')
BASE='66818b539b9910d9081fb19b2713b5713daefc81'
P='692480d5c0aed72d9db083b7bafb6684b9786241';L='cd033ae7890fab4b4df887bfb7f663e12c785362'
def git(root,*args):return subprocess.check_output(['git',*args],cwd=root)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def pinned(root,pin):return {'commit':git(root,'rev-parse','HEAD').decode().strip(),'tree':git(root,'rev-parse',pin+'^{tree}').decode().strip()}
assert pinned(PRODUCER,P)['commit']==P and pinned(PUBLIC,L)['commit']==L
producerChanges=git(PRODUCER,'diff','--name-only',BASE,P).decode().splitlines()
assert all(p.startswith('apps/gateway/sources/original-tracking/') or p.startswith('apps/gateway/test/original-tracking-') for p in producerChanges)
reference=json.loads((PRODUCER/'apps/gateway/sources/original-tracking/protocol-reference.json').read_text());native=[]
for item in reference['references']:
 for version in item['versions']:
  raw=git('/workspace/capirov2','show',version['commit']+':'+item['path']);blob=git('/workspace/capirov2','rev-parse',version['commit']+':'+item['path']).decode().strip()
  assert blob==version['blob'] and len(raw)==version['bytes'] and sha(raw)==version['sha256']
  native.append({'path':item['path'],'commit':version['commit'],'blob':blob,'sha256':sha(raw),'bytes':len(raw),'exact':True})
preserved=[]
dist=git(PUBLIC,'ls-tree','-r','--name-only',BASE,'packages/contracts/dist').decode().splitlines()
extra=['packages/contracts/generate.mjs','packages/contracts/generate-actions.mjs','packages/contracts/generate-documents.mjs','packages/contracts/generate-conversations.mjs','packages/contracts/meri.schema.json','apps/control/conversations/service.mjs','apps/control/conversations/http.mjs','apps/control/conversations/events.mjs','packages/contracts/retrieval-0.2/catalog.json','packages/skills/assets.json']
assets=json.loads((PUBLIC/'packages/skills/assets.json').read_text())
for a in assets['assets']:
 for key in ['manifestPath','prosePath']:extra.append(str((PUBLIC/'packages/skills'/a[key]).resolve().relative_to(PUBLIC)))
for path in dist+extra:
 current=(PUBLIC/path).read_bytes();assert current==git(PUBLIC,'show',BASE+':'+path)
 preserved.append({'path':path,'bytes':len(current),'sha256':sha(current),'exactBase':True})
tar=PUBLIC/'packages/contracts/conversation-lifecycle/evidence/capiro-meri-contracts-0.1.4.tgz'
with tarfile.open(tar) as archive:
 names=archive.getnames();assert not any('/conversation-lifecycle/' in n for n in names)
 metadata=json.load(archive.extractfile('package/package.json'));assert metadata['version']=='0.1.4'
 for path in dist:assert archive.extractfile('package/'+path.removeprefix('packages/contracts/')).read()==(PUBLIC/path).read_bytes()
record={'producer':pinned(PRODUCER,P),'publicLifecycle':pinned(PUBLIC,L),'base':BASE,'producerChanges':producerChanges,'producerChangesExclusivelyOwned':True,'nativeProtocolDataReferences':native,'nativeProtocolImports':0,'nativeProtocolExecutions':0,'liveQualification':False,'priorDistFilesExact':len(dist),'preservedPublicAndOriginalPaths':preserved,'tarball':{'sha256':sha(tar.read_bytes()),'packageVersion':metadata['version'],'allPriorDistFilesExact':True,'privateLifecycleSourcePresent':False},'publicPackageVersion':json.loads((PUBLIC/'packages/contracts/package.json').read_text())['version'],'originalAssets':len(assets['assets']),'modelCalls':0,'nativeDbCalls':0,'networkCalls':0}
target=HERE/'component-audit-details.json';assert not target.exists();target.write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record,indent=2))
