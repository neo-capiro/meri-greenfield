"""Read-only exact source/reference audit, no private implementation execution."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];E=Path(__file__).resolve().parent
BASE='a3e946c1fa264ae7b33205f5b87804ee1ef75773';SOURCE,AUTHOR=sys.argv[1:3];checks=[]
def check(n,ok):
 checks.append({'name':n,'pass':bool(ok)})
 if not ok:raise AssertionError(n)
def git(*args,repo=ROOT):return subprocess.check_output(['git','-C',str(repo),*args])
def blob(ref,p,repo=ROOT):return git('show',ref+':'+p,repo=repo)
def entries(ref):return {x.split('\t',1)[1]:x.split('\t',1)[0].split()[2] for x in git('ls-tree','-r',ref).decode().splitlines()}
old,source,author,review=map(entries,[BASE,SOURCE,AUTHOR,'HEAD'])
for name,tree in [('source',source),('author',author),('review',review)]:check('all original bytes '+name,all(tree.get(p)==h for p,h in old.items()))
paths=['packages/contracts/retrieval-0.2/tracked-bills-validation.mjs','packages/contracts/retrieval-0.2/tracked-bills.schema.json','packages/contracts/test/retrieval-tracked-bills.test.mjs'];ids=[]
for p in paths:
 b=blob(SOURCE,p);check('exact source '+p,b==blob(AUTHOR,p)==(ROOT/p).read_bytes());ids.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':source[p]})
report='docs/coordination/reports/CODEX-TRACKED-BILLS-AUTHOR-20261012.md';prefix='docs/qualification/candidates/read-continuation-20261012/tracked-bills-author/'
check('source adds only allocated files',all(p in {*paths,report} or p.startswith(prefix) for p in set(source)-set(old)))
check('author metadata only after source',all(p==report or p.startswith(prefix) for p in set(source)|set(author) if source.get(p)!=author.get(p)))
refs=json.loads((E/'reference-identities.json').read_text());private={}
for r in refs['references']:
 p=r['path'];b=blob(refs['inventoryPin'],p,Path('/workspace/capirov2'));private[p]=b;x=r['frozen']
 check('pinned '+p,len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'] and git('rev-parse',refs['inventoryPin']+':'+p,repo=Path('/workspace/capirov2')).decode().strip()==x['blob'])
 check('observed unchanged '+p,b==blob(refs['observedPin'],p,Path('/workspace/capirov2')))
module=(ROOT/paths[0]).read_text();defs=json.loads((ROOT/paths[1]).read_text())['$defs']
check('canonical admission sole import',re.findall(r"import .* from '([^']+)'",module)==['./operation-contracts.mjs'])
check('no runtime/native/clock effects',all(x not in module for x in ['Date.now','fetch(','setTimeout(','process.','node:','PrismaClient','@capiro','@temporal','Worker(']))
check('only family factory exported',re.findall(r'export function (\w+)',module)==['createTrackedBillsValidators'])
check('result uses detached validated page','return page;' in module and 'return result;' not in module)
check('context exact keys',set(defs['TrackedBillsContext']['required'])=={'binding','subject','clientReference'} and defs['TrackedBillsContext']['additionalProperties'] is False)
check('raw selector only',set(defs['TrackedBillsRequest']['properties'])=={'clientId'} and defs['TrackedBillsRequest']['required']==['clientId'])
check('normalized client uuid',defs['TrackedBillsInput']['properties']['clientId']=={'type':'string','format':'uuid'})
check('result wrapper exact',set(defs['TrackedBillsResult']['required'])=={'binding','subject','data'} and defs['TrackedBillsResult']['additionalProperties'] is False)
check('raw data exact fields',set(defs['TrackedBillsData']['properties'])=={'tool','generatedAt','clientId','total','bills'})
check('full rows no guessed cap','maxItems' not in defs['TrackedBillsData']['properties']['bills'])
check('no silent truncation','.bills.slice' not in module and '.slice(0,50)' not in module and '.slice(0, 50)' not in module)
check('full return count',defs['TrackedBillsData']['properties']['total']=={'type':'integer','minimum':0,'maximum':9007199254740991})
check('tracking exact wire fields',set(defs['TrackedBillsRow']['required'])=={'id','billId','note','createdAt','bill'})
check('tracking UUID identity',defs['TrackedBillsRow']['properties']['id']=={'type':'string','format':'uuid'})
check('tracking nullable note',set(defs['TrackedBillsRow']['properties']['note']['type'])=={'string','null'})
check('nullable global enrichment',{'type':'null'} in defs['TrackedBillsRow']['properties']['bill']['anyOf'])
check('global projection exact',set(defs['TrackedBillsBill']['required'])=={'identifier','title','latestActionDate','latestActionText','status','actionTexts','sponsorName','sponsorParty','subjectNames'})
for field in ['latestActionText','status','sponsorName','sponsorParty']:check('stored nullable '+field,set(defs['TrackedBillsBill']['properties'][field]['type'])=={'string','null'})
for field in ['actionTexts','subjectNames']:check('stored full string array '+field,defs['TrackedBillsBill']['properties'][field]=={'type':'array','items':{'type':'string'}})
check('title no truncation/cap',defs['TrackedBillsBill']['properties']['title']=={'type':'string'})
wrapper=private['apps/api/src/meri/meri-tools.service.ts'].decode();method='\n'.join(wrapper.splitlines()[8479:8491]);visibility='\n'.join(wrapper.splitlines()[9788:9829]);owner=private['apps/api/src/intelligence/intelligence.service.ts'].decode();lookup='\n'.join(owner.splitlines()[4406:4452]);listing='\n'.join(owner.splitlines()[4454:4472]);models=private['apps/api/prisma/schema.prisma'].decode();model=re.search(r'model TrackedBill \{([\s\S]*?)\n\}',models).group(1)
check('source required selector80',bool(re.search(r"requiredString\(input, 'clientId', 80\)",method)))
check('visibility precedes tenant listing',method.index('ensureClientVisible')<method.index('listTrackedBills'))
check('source raw total returned','total: bills.length' in method)
check('visibility excludes archived',"not: 'archived'" in visibility)
check('visibility tenant name branch',"mode: 'insensitive'" in visibility and 'ctx.tenantId' in visibility and 'UUID_RE.test' in visibility)
check('visibility no actor wall proof','actorId' not in visibility and 'userId' not in visibility)
check('listing tenant and exact client','withTenant' in listing and 'tenantId' in listing and 'where: { clientId }' in listing)
check('listing createdAt descending',bool(re.search(r"createdAt:\s*'desc'",listing)))
check('listing no take/limit',not re.search(r'\b(?:take|limit):',listing))
check('nullable lookup fallback',bool(re.search(r'billById\.get\(t\.billId\)\s*\?\?\s*null',listing)))
check('actual per-client uniqueness','@@unique([clientId, billId])' in model)
check('actual UUID tracking primary',bool(re.search(r'\bid\s+String[^\n]*@id[^\n]*@db\.Uuid',model)))
check('global id selector not tenant',bool(re.search(r'WHERE\s+cb\.id\s*=\s*ANY',lookup,re.I)) and not re.search(r'\btenant',lookup,re.I))
check('SQL full action array no limit',bool(re.search(r'ARRAY\s*\(\s*SELECT',lookup,re.I)) and not re.search(r'\bLIMIT\b',lookup,re.I))
check('subjects array fallback',bool(re.search(r'subjectNames:\s*b\.subjects\s*\?\?\s*\[\]',lookup)))
check('HTTP role declaration',"@Roles('standard_user')" in private['apps/api/src/meri/meri.controller.ts'].decode())
check('HTTP secret remains external','MERI_TOOLS_REQUIRE_SERVICE_SECRET' in private['apps/api/src/meri/tool-service-secret.guard.ts'].decode())
for name in ['initial-independent','snapshot-independent','final-independent']:
 r=json.loads((E/(name+'.json')).read_text());check('owned group absent '+name,r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 for x in r['streams']:
  b=(ROOT/x['path']).read_bytes();check('raw '+x['path'],len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'])
 check('stderr empty '+name,not(E/(name+'.stderr.bin')).read_bytes())
check('failure source stable before/after initial',(E/'initial-source-before.json').read_bytes()==(E/'initial-source-after.json').read_bytes())
check('mutation source same retained preimage',(E/'initial-source-before.json').read_bytes()==(E/'snapshot-source-after.json').read_bytes())
for x in json.loads((E/'initial-source-before.json').read_text()):
 b=(E/'initial-source'/Path(x['path']).name).read_bytes();check('preimage '+x['path'],len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'])
check('first24 controls preserved',(ROOT/'packages/contracts/test/retrieval-tracked-bills-independent.test.mjs').read_bytes().startswith(blob('bcd0d6b6115b49b873047744b38c4abce604bc62','packages/contracts/test/retrieval-tracked-bills-independent.test.mjs')))
check('all26 controls unchanged',blob('946faec','packages/contracts/test/retrieval-tracked-bills-independent.test.mjs')==(ROOT/'packages/contracts/test/retrieval-tracked-bills-independent.test.mjs').read_bytes())
check('no full private bodies copied',all(b not in (ROOT/p).read_bytes() for b in private.values() for p in set(review)-set(old) if (ROOT/p).is_file()))
check('source whitespace',subprocess.run(['git','diff','--check',BASE,SOURCE],cwd=ROOT,capture_output=True).returncode==0)
result={'base':BASE,'source':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'authorMetadata':AUTHOR,'authorTree':git('rev-parse',AUTHOR+'^{tree}').decode().strip(),'reviewHeadAtAudit':git('rev-parse','HEAD').decode().strip(),'originalsPreserved':len(old),'checks':checks,'sourceIdentities':ids,'privateSourceExecuted':False,'runtime':'UNRUN_UNAVAILABLE'}
(E/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'checks':len(checks),'passed':sum(c['pass'] for c in checks),'originalsPreserved':len(old)}))
