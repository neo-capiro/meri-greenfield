"""Exact private Unicode delta; preserve public and unrelated/native source."""
import gzip,hashlib,json,pathlib,re,subprocess
HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parents[4]
SOURCE='516eb2a922c106745d0164bd9819a6bec2c104cc'
PARENT='c9dee2fc91c8ef218bc96fa815f003474c9a32a8'
PR61='1c79a912b6589ccd1004c12a9981bc146d79e8bc'
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
check('exact repair tree',git('rev-parse',SOURCE+'^{tree}').decode().strip()=='4c102dbf74caa3efddf0723ab9035e7064dbe9de')
check('exact parent',git('rev-parse',SOURCE+'^').decode().strip()==PARENT)
before,after=tree(PARENT),tree(SOURCE)
validator='packages/contracts/retrieval-0.2/mail-validation.mjs';legacy='packages/contracts/test/retrieval-mail.test.mjs'
existing={'docs/coordination/tasks/CODEX-WORKFLOW-BATCH-20261013.md',validator,legacy}
modified={p for p,v in before.items() if after.get(p)!=v}
check('exact three authorized existing changes',modified==existing,modified=sorted(modified))
check('every other parent entry exact',all(after.get(p)==v for p,v in before.items() if p not in existing),entries=len(before),exactEntries=len(before)-len(modified))
new=sorted(after.keys()-before.keys())
check('only allocated helper/test/retained receipt additions',len(new)==8 and all(p in ['packages/contracts/retrieval-0.2/mail-utf16.mjs','packages/contracts/test/retrieval-mail-unicode.test.mjs'] or p.startswith('docs/qualification/candidates/workflow-batch-20261013/root/utf16-contract-') for p in new),newEntries=new)
for prefix in ['packages/contracts/dist/','packages/skills/originals/','apps/worker/','infra/','apps/gateway/authorization/','apps/gateway/dispatch/','apps/gateway/sources/']:
 values={p:v for p,v in before.items() if p.startswith(prefix)}
 check('protected prefix '+prefix,all(after.get(p)==v for p,v in values.items()),entries=len(values))
schemas={p:v for p,v in before.items() if p.endswith('.schema.json')}
check('all schemas exact',all(after.get(p)==v for p,v in schemas.items()),schemaCount=len(schemas))
for path in ['packages/contracts/package.json','packages/contracts/README.md','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/retrieval-0.2/catalog-validation.mjs','packages/contracts/retrieval-0.2/bill-text-validation.mjs','packages/contracts/retrieval-0.2/operation-contracts.mjs','packages/contracts/test/backend-execution-expectations.mjs']:
 check('protected canonical blob '+path,blob(SOURCE,path)==blob(PARENT,path),sha256=hashlib.sha256(blob(SOURCE,path)).hexdigest())
check('published0.1.3 package retained',blob(SOURCE,'packages/contracts/package.json')==blob(PR61,'packages/contracts/package.json') and json.loads(blob(SOURCE,'packages/contracts/package.json'))['version']=='0.1.3')
old=blob(PARENT,legacy);current=blob(SOURCE,legacy)
old_title=b"test('UTF-16 offsets count a surrogate pair as two units and permit its legacy split',()=>{"
new_title=b"test('UTF-16 offsets retain whole surrogate pairs and refuse a legacy split before hashing',()=>{"
old_assert=b"  p.nextBodyOffsets=[{messageId,bodyOffset:1}];p.coverage.truncated=true;assertMailThreadSourcePage(p,request);\n"
new_assert=b"  p.nextBodyOffsets=[{messageId,bodyOffset:1}];p.coverage.truncated=true;assert.throws(()=>assertMailThreadSourcePage(p,request),/UTF-16/);\n"
anchor=b"  p.messages[0].section.text='\xf0\x9f\x98\x80';assert.throws(()=>assertMailThreadSourcePage(p,request),/UTF-16/);\n"
addition=b"  p.messages[0].section.endExclusive=2;p.messages[0].section.hasMore=false;p.nextBodyOffsets=[];p.coverage.truncated=false;assertMailThreadSourcePage(p,request);\n"
check('one deliberate historical surrogate test changes only',old.count(old_title)==old.count(old_assert)==old.count(anchor)==1 and old.replace(old_title,new_title).replace(old_assert,new_assert).replace(anchor,anchor+addition)==current,preimageSha256=hashlib.sha256(old).hexdigest(),newSha256=hashlib.sha256(current).hexdigest())
for label,passed,failed in [('utf16-contract-focused',155,1),('utf16-contract-preserved',156,0)]:
 path='docs/qualification/candidates/workflow-batch-20261013/root/'+label
 receipt=json.loads(blob(SOURCE,path+'.json'));raw=gzip.decompress(blob(SOURCE,path+'.stdout.gz'))
 check('retained author raw '+label,hashlib.sha256(raw).hexdigest()==receipt['blobs']['stdout']['rawSha256'])
 for key,count in [('tests',156),('pass',passed),('fail',failed)]:check('retained author count '+label+'/'+key,bool(re.search(rb'^# '+key.encode()+rb' '+str(count).encode()+rb'$',raw,re.M)))
check('prior compatibility-gap evidence unchanged',all(after.get(p)==v for p,v in before.items() if p.startswith('docs/qualification/candidates/workflow-batch-20261013/source-independent/')))
modules={p:{'sha256':hashlib.sha256(blob(SOURCE,p)).hexdigest(),'bytes':len(blob(SOURCE,p))} for p in [validator,'packages/contracts/retrieval-0.2/mail-utf16.mjs']}
for path,facts in modules.items():check('reviewed module bytes '+path,hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==facts['sha256'],**facts)
out={'decision':'PASS_PRIVATE_UNICODE_PRESERVATION','reviewedCommit':SOURCE,'reviewedTree':'4c102dbf74caa3efddf0723ab9035e7064dbe9de','checkCount':len(checks),'checks':checks,'intentionalBehavior':'Well-formed scalar windows with UTF16 positions, at most one start overlap/end clipping, one-unit whole-pair progress exception; no codec/hash/schema/catalog/public/input-normalizer change.','nativeAcceptance':False}
assert not (HERE/'unicode-source-audit.json').exists();(HERE/'unicode-source-audit.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'result':'PASS_PRIVATE_UNICODE_PRESERVATION','checks':len(checks),'parentEntries':len(before),'exactParentEntries':len(before)-len(modified)}))
