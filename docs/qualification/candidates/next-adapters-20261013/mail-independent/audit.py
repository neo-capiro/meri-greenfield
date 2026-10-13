"""Read-only exact source/blob preservation audit. No install or runtime access."""
import hashlib,json,pathlib,subprocess
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[4]
BASE='a2aef4a5fcd3c19cec974dc62b69222836d71b3e'
INITIAL='39333d5c3ff6800515ee814a6eb39105c1793a6a'
SOURCE='6499f960f92f4a42f3bfa388fba68e026e1628ca'
PR54='70516e5c9681917ce493bbc50e3023494f2e1209'
records=[]
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def blob(pin,path):return git('show',pin+':'+path)
def check(name,condition,**facts):
 records.append({'check':name,'pass':bool(condition),**facts})
 if not condition:raise AssertionError(name)
def tree(pin):
 result={}
 for row in git('ls-tree','-r','-z',pin).split(b'\0'):
  if row:
   head,path=row.split(b'\t',1);result[path.decode()]=head.decode()
 return result
check('exact initial tree',git('rev-parse',INITIAL+'^{tree}').decode().strip()=='b5937b0ecd9509c9dcd1bce27a7bbe5d6923bfa0')
check('exact repaired tree',git('rev-parse',SOURCE+'^{tree}').decode().strip()=='e8b5103b7704f937b378a712831d1491e57f65ce')
check('repair exact parent',git('rev-parse',SOURCE+'^').decode().strip()==INITIAL)
bt,it,st=tree(BASE),tree(INITIAL),tree(SOURCE)
check('all original PR60 entries retained exactly',all(st.get(p)==v for p,v in bt.items()),originalEntryCount=len(bt))
check('initial adds mail only',all(p.startswith('apps/gateway/sources/mail/') for p in it.keys()-bt.keys()),newEntries=sorted(it.keys()-bt.keys()))
check('repaired adds mail only',all(p.startswith('apps/gateway/sources/mail/') for p in st.keys()-bt.keys()),newEntries=sorted(st.keys()-bt.keys()))
changed=[p for p in st.keys()|it.keys() if st.get(p)!=it.get(p)]
check('repair modifies mail namespace only',all(p.startswith('apps/gateway/sources/mail/') for p in changed),changedEntries=sorted(changed))
for path in ['apps/gateway/sources/mail/handler.mjs','apps/gateway/sources/mail/request-context.mjs','apps/gateway/sources/mail/http-adapter.mjs',
 'apps/gateway/dispatch/tool-dispatch.mjs','apps/gateway/dispatch/mail-read-context.mjs','apps/gateway/authorization/current-tool-authority.mjs',
 'apps/gateway/sources/source-admission.mjs','apps/gateway/sources/json-response.mjs']:
 data=blob(SOURCE,path)
 check('reviewed blob '+path,(ROOT/path).read_bytes()==data,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),gitEntry=st[path])
check('HTTP adapter byte-identical to initial',blob(SOURCE,'apps/gateway/sources/mail/http-adapter.mjs')==blob(INITIAL,'apps/gateway/sources/mail/http-adapter.mjs'))
check('initial author assertions retained',blob(SOURCE,'apps/gateway/sources/mail/test/read-adapter.test.mjs')==blob(INITIAL,'apps/gateway/sources/mail/test/read-adapter.test.mjs'))
for path in ['packages/contracts/package.json','packages/contracts/README.md']:
 check('public PR54 publication retained '+path,blob(SOURCE,path)==blob(PR54,path),sha256=hashlib.sha256(blob(SOURCE,path)).hexdigest())
check('package publication version 0.1.2',json.loads(blob(SOURCE,'packages/contracts/package.json'))['version']=='0.1.2')
schema=json.loads(blob(SOURCE,'packages/contracts/meri.schema.json'))
check('public wire schema remains 0.1.0',schema['$id']=='urn:meri:contracts:0.1.0')
check('independent 21 source unchanged since initial HOLD',(HERE/'independent.test.mjs').read_bytes()==blob('09b19aca','docs/qualification/candidates/next-adapters-20261013/mail-independent/independent.test.mjs'),sha256=hashlib.sha256((HERE/'independent.test.mjs').read_bytes()).hexdigest())
mail={p:{'gitEntry':v,'bytes':len(blob(SOURCE,p)),'sha256':hashlib.sha256(blob(SOURCE,p)).hexdigest()} for p,v in st.items() if p.startswith('apps/gateway/sources/mail/')}
out={'decision':'PASS_SOURCE_PRESERVATION','reviewedCommit':SOURCE,'reviewedTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'baseline':BASE,'initialHold':INITIAL,
 'checks':records,'checkCount':len(records),'mailBlobs':mail,'runtimeAcceptance':False}
assert not (HERE/'source-audit.json').exists()
(HERE/'source-audit.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'reviewedCommit':SOURCE,'checks':len(records),'originalEntries':len(bt),'mailEntries':len(mail),'result':'PASS'}))
