"""Exact test-helper delta and unchanged accepted production proof."""
import gzip,hashlib,json,pathlib,re,subprocess
HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parents[4]
SOURCE='18f77ae73d23f888ea3e46216cd1ab2ed1c22df0'
PARENT='c37cae311aab1578182a2391a3f7fd3f066a0e6e'
BASE='1c79a912b6589ccd1004c12a9981bc146d79e8bc'
HELPER='packages/contracts/test/backend-execution-expectations.mjs'
checks=[]
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def blob(pin,path):return git('show',pin+':'+path)
def check(name,value,**facts):
 checks.append({'check':name,'pass':bool(value),**facts})
 if not value:raise AssertionError(name)
def tree(pin):
 out={}
 for row in git('ls-tree','-r','-z',pin).split(b'\0'):
  if row:
   entry,path=row.split(b'\t',1);out[path.decode()]=entry.decode()
 return out
check('exact helper freeze tree',git('rev-parse',SOURCE+'^{tree}').decode().strip()=='e9ec569d549b3263b88ba3620a0124c9b33c7d10')
check('exact accepted source parent',git('rev-parse',SOURCE+'^').decode().strip()==PARENT)
before,after=tree(PARENT),tree(SOURCE)
changed=sorted(p for p in before.keys()|after.keys() if before.get(p)!=after.get(p))
check('helper plus owned root receipts only',len(changed)==7 and HELPER in changed and all(p==HELPER or p.startswith('docs/qualification/candidates/workflow-batch-20261013/root/') for p in changed),changed=changed)
production={p:v for p,v in before.items() if not p.startswith('docs/') and p!=HELPER}
check('every other executable/test/package/native source entry exact',all(after.get(p)==v for p,v in production.items()),entries=len(production))
old=blob(PARENT,HELPER)
anchor=b"  if(row.id==='list_global_datasets')result={...result,dispatchProfile:'dataset-metadata/1'};\n"
addition=b"  const passiveProfiles={read_monday_client_boards:'bound-projection/1',search_memory:'bound-projection/1',\n    get_client_context:'bound-projection/1',find_contacts:'bound-projection/1',resolve_entity:'bound-projection/1',\n    read_client_documents:'client-documents/1'};\n  if(Object.hasOwn(passiveProfiles,row.id)) {\n    assert.equal(Object.hasOwn(row,'dispatchProfile'),false,'Historical snapshot already has a dispatch profile');\n    result={...result,dispatchProfile:passiveProfiles[row.id]};\n  }\n"
check('unique original expected-binding anchor',old.count(anchor)==1)
check('only exact six profiles and absent-old-field guard added',old.replace(anchor,anchor+addition)==blob(SOURCE,HELPER),oldSha256=hashlib.sha256(old).hexdigest(),newSha256=hashlib.sha256(blob(SOURCE,HELPER)).hexdigest())
check('all four consuming test files byte-identical to PR61',all(blob(SOURCE,'packages/contracts/test/'+name)==blob(BASE,'packages/contracts/test/'+name) for name in ['retrieval-backend-next-independent.test.mjs','retrieval-civic-integration-independent.test.mjs','retrieval-observed-integration-independent.test.mjs','retrieval-reference-integration-independent.test.mjs']))
for path in ['packages/contracts/package.json','packages/contracts/README.md','packages/contracts/retrieval-0.2/catalog.json','packages/skills/originals/mail_history/1.0.0/SKILL.md','packages/skills/originals/mail_history/1.0.0/manifest.json']:
 check('protected public/catalog/original skill '+path,blob(SOURCE,path)==blob(BASE,path),sha256=hashlib.sha256(blob(SOURCE,path)).hexdigest())
path='docs/qualification/candidates/workflow-batch-20261013/root/contracts-stable'
receipt=json.loads(blob(SOURCE,path+'.json'));raw=gzip.decompress(blob(SOURCE,path+'.stdout.gz'))
check('retained broad failed output hash',hashlib.sha256(raw).hexdigest()==receipt['blobs']['stdout']['rawSha256'])
for key,count in [('tests',4204),('pass',4199),('fail',5)]:check('retained broad failed count '+key,bool(re.search(rb'^# '+key.encode()+rb' '+str(count).encode()+rb'$',raw,re.M)))
check('missing original vm flag retained transparently','--experimental-vm-modules' not in receipt['command'])
owned={p:hashlib.sha256(blob(SOURCE,p)).hexdigest() for p in after if p.startswith(('apps/gateway/sources/client-evidence/','apps/gateway/sources/identity-contacts/','apps/gateway/sources/client-knowledge/')) and p.endswith('.mjs') and '/test/' not in p}
for p,digest in owned.items():check('reviewed production bytes '+p,hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==digest,sha256=digest)
out={'decision':'PASS_SOURCE_HELPER_PRESERVATION','reviewedCommit':SOURCE,'reviewedTree':'e9ec569d549b3263b88ba3620a0124c9b33c7d10','acceptedSixSourcePin':PARENT,'checkCount':len(checks),'checks':checks,'retainedBroadReceipt':receipt,'broadSuiteIndependentlyRerun':False,'runtimeAcceptance':False}
assert not (HERE/'helper-source-audit.json').exists();(HERE/'helper-source-audit.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'result':'PASS_SOURCE_HELPER_PRESERVATION','checks':len(checks),'unchangedNonDocumentationEntries':len(production),'reviewedProductionModules':len(owned)}))
