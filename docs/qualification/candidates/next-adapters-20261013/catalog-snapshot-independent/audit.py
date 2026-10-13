"""Exact source, accepted history and retained failure audit; source-only."""
import gzip,hashlib,json,pathlib,re,subprocess
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[4]
SOURCE='eda892e204e65ac9860a008002c262d7207523b8'
PARENT='4c8606976d0f0b6e898fea1a4b3830be8c327071'
ACCEPTED='93845774d352fc9a0ad12cc7bc8bd3d4612a322c'
PROFILE='2c21104fd51608293fe21914e6f057691b4decb4'
PR60='a2aef4a5fcd3c19cec974dc62b69222836d71b3e'
TEST='packages/contracts/test/vertical-final-integration-independent.test.mjs'
SNAPSHOT='docs/qualification/candidates/vertical-source-20261012/vertical-final-review/pr37-identities.json'
CATALOG='packages/contracts/retrieval-0.2/catalog-validation.mjs'
ROOT_EVIDENCE='docs/qualification/candidates/next-adapters-20261013/root/'
records=[]
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def blob(pin,path):return git('show',pin+':'+path)
def check(name,value,**facts):
 records.append({'check':name,'pass':bool(value),**facts})
 if not value:raise AssertionError(name)
def tree(pin):
 result={}
 for line in git('ls-tree','-r','-z',pin).split(b'\0'):
  if line:
   entry,path=line.split(b'\t',1);result[path.decode()]=entry.decode()
 return result
check('exact source tree',git('rev-parse',SOURCE+'^{tree}').decode().strip()=='704de8142cebe4665e87c082bce0e0dbd273aa23')
check('exact published parent',git('rev-parse',SOURCE+'^').decode().strip()==PARENT)
for pin in [PROFILE,PR60,ACCEPTED,PARENT]:
 check('accepted ancestor '+pin,subprocess.run(['git','merge-base','--is-ancestor',pin,SOURCE],cwd=ROOT).returncode==0)
before,after=tree(PARENT),tree(SOURCE)
allowed={TEST,'docs/coordination/tasks/CODEX-NEXT-ADAPTERS-20261013.md',ROOT_EVIDENCE+'catalog-snapshot-deltas.json'}
deltas={path for path in before.keys()|after.keys() if before.get(path)!=after.get(path)}
check('exact three allocated changed files',deltas==allowed,changed=sorted(deltas))
check('all other published parent entries exact',all(after.get(path)==entry for path,entry in before.items() if path not in allowed),originalEntries=len(before),exactRetainedEntries=sum(after.get(path)==entry for path,entry in before.items()))
accepted=tree(ACCEPTED)
production={p:v for p,v in accepted.items() if not p.startswith('docs/') and p!=TEST}
check('all other accepted non-documentation entries exact',all(after.get(p)==v for p,v in production.items()),entryCount=len(production))
for pin in [PR60,ACCEPTED,PARENT]:check('immutable PR37 snapshot preserved '+pin,blob(SOURCE,SNAPSHOT)==blob(pin,SNAPSHOT),sha256=hashlib.sha256(blob(pin,SNAPSHOT)).hexdigest())
check('historical test preimage exact PR60',blob(PARENT,TEST)==blob(PR60,TEST))
old=blob(PARENT,TEST)
old_title=b"test('final all84 prior descriptors and full callback bodies survive with only two precise Portfolio footnotes',()=>{"
new_title=b"test('final all84 prior descriptors and callback bodies retain two Portfolio footnotes and accepted action dispatch metadata',()=>{"
old_loop=b" for(const old of prior.bindings){const b=resolve(old.id).binding,serial=JSON.parse(JSON.stringify(b,(_k,v)=>typeof v==='function'?{source:v.toString()}:v));assert.equal(hash(serial),old.sha256,old.id);}\n"
new_loop=b" for(const old of prior.bindings){const b=resolve(old.id).binding,serial=JSON.parse(JSON.stringify(b,(_k,v)=>typeof v==='function'?{source:v.toString()}:v));\n  // Accepted2c21104 adds metadata only; retain the complete original callback hash.\n  if(old.id==='actions.query'){assert.equal(serial.dispatchProfile,'actions-complete/1');delete serial.dispatchProfile;}\n  assert.equal(hash(serial),old.sha256,old.id);}\n"
check('unique original title/loop',old.count(old_title)==1 and old.count(old_loop)==1)
check('only deliberate title and one binding assertion repaired',old.replace(old_title,new_title).replace(old_loop,new_loop)==blob(SOURCE,TEST),preimageSha256=hashlib.sha256(old).hexdigest(),repairedSha256=hashlib.sha256(blob(SOURCE,TEST)).hexdigest())
old_catalog=blob(PROFILE+'^',CATALOG)
anchor=b'    contextKeys: Object.freeze(["binding", "clientResolution"]),\n'
replacement=b'    contextKeys: Object.freeze(["binding", "clientResolution"]), dispatchProfile: \'actions-complete/1\',\n'
check('accepted profile addition has unique exact anchor',old_catalog.count(anchor)==1)
check('accepted original catalog edit is one field only',old_catalog.replace(anchor,replacement)==blob(PROFILE,CATALOG))
for path in ['packages/contracts/package.json','packages/contracts/README.md','packages/contracts/meri.schema.json',CATALOG,'packages/contracts/retrieval-0.2/catalog.json',SNAPSHOT]:
 check('current reviewed bytes '+path,(ROOT/path).read_bytes()==blob(SOURCE,path),sha256=hashlib.sha256(blob(SOURCE,path)).hexdigest())
check('published package remains 0.1.3',json.loads(blob(SOURCE,'packages/contracts/package.json'))['version']=='0.1.3')
check('public wire remains 0.1.0',json.loads(blob(SOURCE,'packages/contracts/meri.schema.json'))['$id']=='urn:meri:contracts:0.1.0')
historical=[]
for label,tests,passed in [('contracts-final',4204,4203),('historical-vertical-baseline',40,39)]:
 receipt=json.loads(blob(SOURCE,ROOT_EVIDENCE+label+'.json'))
 raw=gzip.decompress(blob(SOURCE,ROOT_EVIDENCE+label+'.stdout.gz'))
 check('retained failure raw hash '+label,hashlib.sha256(raw).hexdigest()==receipt['blobs']['stdout']['rawSha256'])
 for key,value in [('tests',tests),('pass',passed),('fail',1)]:check('retained failure count '+label+'/'+key,bool(re.search(rb'^# '+key.encode()+rb' '+str(value).encode()+rb'$',raw,re.M)))
 check('same exact old/new binding hashes in failure '+label,all(v.encode() in raw for v in ['f86b3316cd727bd6edfd6bd1c544f2fba5ae2269814b150a28cda4e999ebcfca','7db58f4c6274657311825cff0017bcff49e1d0aa52a20dfe99d27a989d30a587']))
 historical.append({'label':label,'receipt':receipt,'reexecutedByIndependentReviewer':False})
out={'decision':'PASS_SOURCE_PRESERVATION','reviewedCommit':SOURCE,'reviewedTree':'704de8142cebe4665e87c082bce0e0dbd273aa23','checkCount':len(records),'checks':records,'retainedHistoricalFailures':historical,
 'receiptLimit':'Historical baseline command targets its explicit PR60 worktree, while the receipt commit field identifies root accepted938. Independently verified byte equality supplies the source bridge; this audit does not relabel the receipt. Original full-suite process-group-absence=false is retained and is not replaced by the independent cleanup receipts.',
 'nativeAcceptance':False,'publicPackageChange':False}
assert not (HERE/'source-audit.json').exists()
(HERE/'source-audit.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'result':'PASS_SOURCE_PRESERVATION','checks':len(records),'publishedParentEntries':len(before),'acceptedNonDocumentationEntries':len(production)}))
