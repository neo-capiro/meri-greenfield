"""Local immutable metadata/preservation audit. Never imports private producer source."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];E=Path(__file__).resolve().parent
BASE='a3e946c1fa264ae7b33205f5b87804ee1ef75773';SOURCE,AUTHOR=sys.argv[1:3];checks=[]
def check(n,ok):
    checks.append({'name':n,'pass':bool(ok)})
    if not ok: raise AssertionError(n)
def git(*args,repo=ROOT):return subprocess.check_output(['git','-C',str(repo),*args])
def blob(ref,p,repo=ROOT):return git('show',ref+':'+p,repo=repo)
def entries(ref):
    return {line.split('\t',1)[1]:line.split('\t',1)[0].split()[2] for line in git('ls-tree','-r',ref).decode().splitlines()}
old,source,author,review=map(entries,[BASE,SOURCE,AUTHOR,'HEAD'])
for name,tree in [('source',source),('author',author),('review',review)]:check('all original bytes '+name,all(tree.get(p)==h for p,h in old.items()))
paths=['packages/contracts/retrieval-0.2/state-bill-identity.mjs','packages/contracts/retrieval-0.2/state-status-votes-validation.mjs','packages/contracts/retrieval-0.2/state-status-votes.schema.json','packages/contracts/test/retrieval-state-status-votes.test.mjs'];ids=[]
for p in paths:
 b=blob(SOURCE,p);check('exact source '+p,b==blob(AUTHOR,p)==(ROOT/p).read_bytes());ids.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':source[p]})
report='docs/coordination/reports/CODEX-STATE-STATUS-VOTES-AUTHOR-20261012.md';prefix='docs/qualification/candidates/read-continuation-20261012/state-status-votes-author/'
check('source only allocated additions',all(p in {*paths,report} or p.startswith(prefix) for p in set(source)-set(old)))
check('closeout metadata only',all(p==report or p.startswith(prefix) for p in set(source)|set(author) if source.get(p)!=author.get(p)))
refs=json.loads((E/'reference-identities.json').read_text());private={}
for r in refs['references']:
 p=r['path'];b=blob(refs['inventoryPin'],p,Path('/workspace/capirov2'));private[p]=b;x=r['frozen']
 check('pin '+p,len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'] and git('rev-parse',refs['inventoryPin']+':'+p,repo=Path('/workspace/capirov2')).decode().strip()==x['blob'])
 check('observed '+p,b==blob(refs['observedPin'],p,Path('/workspace/capirov2')))
module=(ROOT/paths[1]).read_text();helper=(ROOT/paths[0]).read_text();defs=json.loads((ROOT/paths[2]).read_text())['$defs']
check('imports only canonical snapshot/identity/label vocabulary',re.findall(r"import .* from '([^']+)'",module)==['./operation-contracts.mjs','./state-bill-identity.mjs','./state-legislation.schema.json'])
check('identity no imports',not re.search(r'\bimport\b',helper))
check('no live sources or clock effects',all(x not in module+helper for x in ['Date.now','fetch(','setTimeout(','process.','node:','PrismaClient','@capiro','@temporal','Worker(']))
check('shared labels reused',"existingStateSchema.$defs.StateBillStatusLabels.const" in module)
check('three status branches',len(defs['StateBillStatusOutput']['oneOf'])==3)
check('no unresolved billId','billId' not in defs['StateBillStatusUnresolved']['properties'])
check('resolved absent id required','billId' in defs['StateBillStatusAbsent']['required'])
check('typed raw limit strict union',defs['StateFloorVotesRequest']['properties']['limit']=={'anyOf':[{'type':'number'},{'type':'string'},{'type':'null'}]})
for name in ['StateBillStatusRequest','StateFloorVotesRequest']:
 check('closed request '+name,defs[name]['additionalProperties'] is False)
 check('no actor/client/authority input '+name,not {'actorId','tenantId','clientId','resolvedBillId','authorized'}&set(defs[name]['properties']))
for name in ['StateBillStatusFound','StateFloorVotesOutput']:
 check('closed output '+name,defs[name]['additionalProperties'] is False)
 check('no invented completeness or authority '+name,not {'complete','authoritative','total','verified','current'}&set(defs[name]['properties']))
for name in ['recentActions','votes']:check('status15 window '+name,defs['StateBillStatusFound']['properties'][name]['maxItems']==15)
check('floor25 window',defs['StateFloorVotesOutput']['properties']['votes']['maxItems']==25)
for name in ['StateStatusVote','StateFloorVote']:
 for field in ['yeas','nays','nv','absent']:check('signed Int '+name+field,defs[name]['properties'][field]=={'type':'integer','minimum':-2147483648,'maximum':2147483647})
check('labels omission representable','statusLabel' not in defs['StateBillStatusFound']['required'] and 'statusLabel' not in defs['StateStatusCompanion']['required'])
wrapper=private['apps/api/src/meri/meri-tools.service.ts'].decode();status='\n'.join(wrapper.splitlines()[5552:5684]);votes='\n'.join(wrapper.splitlines()[5690:5756]);resolver='\n'.join(wrapper.splitlines()[3726:3767]);live=private['apps/api/src/meri/meri-state-bill-live.ts'].decode()
check('source stored separate field projection',all(x in status for x in ['state: true','sessionKey: true','identifier: true','where: { id: billId }']))
check('source status15 both windows',len(re.findall(r'take:\s*15',status))==2)
check('source floor returned count','votesFound: votes.length' in votes)
check('source unresolved return before query','votesFound: 0' in votes and votes.index('votesFound: 0')<votes.index('const query'))
check('source resolver newest candidate','syncedAt' in resolver and 'desc' in resolver and 'take: 1' in resolver)
check('source resolver delegates live miss','lookupStateBillLive' in resolver)
check('source live quota and ingestion remain outside',all(x in live for x in ['reserveLiveQuota','upsertNormalizedStateBill','normalizeLegiscanBill']))
check('wrapper not current actor proof','actorId' not in status+votes and 'tenantId' not in status+votes)
check('controller declares standard user',"@Roles('standard_user')" in private['apps/api/src/meri/meri.controller.ts'].decode())
check('source service guard configuration dependent','MERI_TOOLS_REQUIRE_SERVICE_SECRET' in private['apps/api/src/meri/tool-service-secret.guard.ts'].decode())
for name in ['initial-independent','final-independent']:
 r=json.loads((E/(name+'.json')).read_text());check('group absent '+name,r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 for stream in r['streams']:
  b=(ROOT/stream['path']).read_bytes();check('raw '+stream['path'],len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256'])
 check('stderr empty '+name,not(E/(name+'.stderr.bin')).read_bytes())
for r in json.loads((E/'initial-source-identities.json').read_text())['files']:
 b=(E/'strict-union-failed-source'/Path(r['path']).name).read_bytes();check('failed preimage '+r['path'],len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'])
check('independent assertions unchanged',blob('9262ce5f5d0f69f211a1ef0480deb7502a0aebed','packages/contracts/test/retrieval-state-status-votes-independent.test.mjs')==(ROOT/'packages/contracts/test/retrieval-state-status-votes-independent.test.mjs').read_bytes())
check('no private full bodies in review additions',all(b not in (ROOT/p).read_bytes() for b in private.values() for p in set(review)-set(old) if (ROOT/p).is_file()))
check('source whitespace',subprocess.run(['git','diff','--check',BASE,SOURCE],cwd=ROOT,capture_output=True).returncode==0)
result={'base':BASE,'source':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'authorMetadata':AUTHOR,'authorTree':git('rev-parse',AUTHOR+'^{tree}').decode().strip(),'reviewHeadAtAudit':git('rev-parse','HEAD').decode().strip(),'originalsPreserved':len(old),'checks':checks,'sourceIdentities':ids,'privateSourceExecuted':False,'runtime':'UNRUN_UNAVAILABLE'}
(E/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'checks':len(checks),'passed':sum(c['pass'] for c in checks),'originalsPreserved':len(old)}))
