"""Exact initial source preservation audit; no native/runtime operation."""
import hashlib,json,pathlib,re,subprocess
HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parents[4]
BASE='1c79a912b6589ccd1004c12a9981bc146d79e8bc'
SOURCE='c37cae311aab1578182a2391a3f7fd3f066a0e6e'
CLIENT='5e2e2d9d0e5182df679b205e135be739608c60bb'
KNOWLEDGE='2781bbb6ea3d59a338745826ef10cd5205794cb9'
IDENTITY='d3d2da10fc2a539ee40cb694a36750904a2f7aeb'
records=[]
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def blob(pin,path):return git('show',pin+':'+path)
def check(name,value,**facts):
 records.append({'check':name,'pass':bool(value),**facts})
 if not value:raise AssertionError(name)
def tree(pin):
 result={}
 for row in git('ls-tree','-r','-z',pin).split(b'\0'):
  if row:
   entry,path=row.split(b'\t',1);result[path.decode()]=entry.decode()
 return result
check('exact source tree',git('rev-parse',SOURCE+'^{tree}').decode().strip()=='502c245b3b93a7676580595255740db98361505d')
check('published PR61 ancestor',subprocess.run(['git','merge-base','--is-ancestor',BASE,SOURCE],cwd=ROOT).returncode==0)
before,after=tree(BASE),tree(SOURCE)
authorized={'apps/control/document-application/local/fixture.mjs','apps/gateway/dispatch/operation-context.mjs','apps/gateway/dispatch/read-result-envelope.mjs','apps/gateway/dispatch/tool-dispatch.mjs','packages/contracts/retrieval-0.2/catalog-validation.mjs','packages/contracts/test/vertical-final-integration-independent.test.mjs'}
changed={path for path,entry in before.items() if after.get(path)!=entry}
check('only six authorized existing paths change',changed==authorized,changed=sorted(changed))
check('all unrelated base entries exact',all(after.get(path)==entry for path,entry in before.items() if path not in authorized),baseEntryCount=len(before),unchangedCount=sum(after.get(path)==entry for path,entry in before.items()))
for prefix,pin in [('apps/gateway/sources/client-evidence/',CLIENT),('apps/gateway/sources/identity-contacts/',IDENTITY),('apps/gateway/sources/client-knowledge/',KNOWLEDGE)]:
 donor={p:v for p,v in tree(pin).items() if p.startswith(prefix)}
 check('worker blobs integrated exactly '+prefix,all(after.get(p)==v for p,v in donor.items()),workerCommit=pin,entries=len(donor))
for prefix in ['packages/contracts/dist/','packages/skills/originals/','apps/worker/','infra/']:
 paths={p:v for p,v in before.items() if p.startswith(prefix)}
 check('protected prefix exact '+prefix,all(after.get(p)==v for p,v in paths.items()),entries=len(paths))
for path in ['packages/contracts/package.json','packages/contracts/README.md','packages/contracts/meri.schema.json','packages/contracts/retrieval-0.2/catalog.json','docs/qualification/candidates/vertical-source-20261012/vertical-final-review/pr37-identities.json','apps/gateway/authorization/current-tool-authority.mjs','apps/gateway/sources/source-admission.mjs','apps/gateway/sources/json-response.mjs']:
 check('protected canonical blob '+path,blob(SOURCE,path)==blob(BASE,path),sha256=hashlib.sha256(blob(BASE,path)).hexdigest())
locks={p:v for p,v in before.items() if p.endswith(('package-lock.json','pnpm-lock.yaml','yarn.lock'))}
check('all dependency lockfile entries exact',bool(locks) and all(after.get(p)==v for p,v in locks.items()),paths=sorted(locks))
check('public package still 0.1.3',json.loads(blob(SOURCE,'packages/contracts/package.json'))['version']=='0.1.3')
profiles={'read_monday_client_boards':'bound-projection/1','search_memory':'bound-projection/1','get_client_context':'bound-projection/1','find_contacts':'bound-projection/1','resolve_entity':'bound-projection/1','read_client_documents':'client-documents/1'}
path='packages/contracts/retrieval-0.2/catalog-validation.mjs'
text=blob(SOURCE,path).decode();normalized=[];current=None;seen={}
for line in text.splitlines(keepends=True):
 match=re.search(r"Object\.freeze\(\{id: '([^']+)'",line)
 if match:current=match.group(1)
 if current in profiles and 'contextKeys:' in line:
  field=", dispatchProfile: '"+profiles[current]+"'"
  check('exact one accepted profile '+current,line.count(field)==1)
  line=line.replace(field,'');seen[current]=seen.get(current,0)+1
 normalized.append(line)
check('six profile additions and every callback byte exact',seen==dict.fromkeys(profiles,1) and ''.join(normalized).encode()==blob(BASE,path),profiles=profiles)
path='packages/contracts/test/vertical-final-integration-independent.test.mjs'
old=blob(BASE,path);actual=blob(SOURCE,path)
old_title=b'callback bodies retain two Portfolio footnotes and accepted action dispatch metadata'
new_title=b'callback bodies retain two Portfolio footnotes and accepted passive projection dispatch metadata'
addition=b"  const projected=['read_monday_client_boards','search_memory','get_client_context','find_contacts','resolve_entity'];\n  if(projected.includes(old.id)){assert.equal(serial.dispatchProfile,'bound-projection/1');delete serial.dispatchProfile;}\n  if(old.id==='read_client_documents'){assert.equal(serial.dispatchProfile,'client-documents/1');delete serial.dispatchProfile;}\n"
anchor=b"  if(old.id==='actions.query'){assert.equal(serial.dispatchProfile,'actions-complete/1');delete serial.dispatchProfile;}\n"
check('unique historical assertion anchor/title',old.count(anchor)==1 and old.count(old_title)==1)
check('historical assertion retains all other bytes',old.replace(old_title,new_title).replace(anchor,anchor+addition)==actual)
blobs={p:{'gitEntry':after[p],'sha256':hashlib.sha256(blob(SOURCE,p)).hexdigest(),'bytes':len(blob(SOURCE,p))} for p in sorted(authorized|{'apps/gateway/dispatch/projection-read-context.mjs'})}
out={'decision':'PASS_SIX_SOURCE_PRESERVATION','reviewedCommit':SOURCE,'reviewedTree':'502c245b3b93a7676580595255740db98361505d','base':BASE,'checkCount':len(records),'checks':records,'reviewedChangedBlobs':blobs,'runtimeAcceptance':False}
assert not (HERE/'six-source-audit.json').exists();(HERE/'six-source-audit.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'result':'PASS_SOURCE_PRESERVATION','checks':len(records),'baseEntries':len(before),'exactBaseEntries':len(before)-len(changed)}))
