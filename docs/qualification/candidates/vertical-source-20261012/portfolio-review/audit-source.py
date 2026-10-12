"""Read-only Git/data audit. Private bodies stay in memory; no producer execution."""
import collections, hashlib, json, re, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
OUT=Path(__file__).resolve().parent
BASE='26f11758'; CANDIDATE='62062236e38ac77b9494a04668df6969ab1f33e2'
checks=[]
def check(name,value):
 checks.append({'name':name,'passed':bool(value)})
def git(*args,repo=ROOT): return subprocess.check_output(['git','-C',str(repo),*args])
def blob(ref,path): return git('show',f'{ref}:{path}')
def digest(b): return hashlib.sha256(b).hexdigest()
def tree(ref):
 rows={}
 for r in git('ls-tree','-r','-z',ref).split(b'\0'):
  if r:
   meta,name=r.split(b'\t',1); rows[name.decode()]=meta.split()[2].decode()
 return rows
original=tree(BASE);current=tree('HEAD')
allowed={'apps/gateway/dispatch/operation-context.mjs','apps/gateway/sources/memory-proposals/http-adapter.mjs','apps/gateway/sources/memory-proposals/request-context.mjs','packages/contracts/retrieval-0.2/catalog-validation.mjs','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/retrieval-0.2/validate.mjs'}
changes=[p for p,h in original.items() if current.get(p)!=h]
check('only six explicitly allocated original files change',set(changes)==allowed)
check('all other original Git entries preserved',all(current.get(p)==h for p,h in original.items() if p not in allowed))
protected=[p for p in original if p.startswith(('packages/contracts/contracts-0.1/','packages/contracts/distribution/')) or p in ['packages/contracts/validate.mjs','packages/contracts/package-lock.json','package-lock.json','package.json','packages/runtime/operation-lifetime.mjs','apps/gateway/dispatch/tool-dispatch.mjs','apps/gateway/sources/memory-proposals/handler.mjs','apps/gateway/sources/memory-proposals/query.mjs']]
for p in protected:check('protected '+p,current.get(p)==original[p])
paths=git('diff','--name-only',BASE,'f8caa12c','--','apps','packages').decode().splitlines()
for p in paths:check('exact final source '+p,(ROOT/p).read_bytes()==blob(CANDIDATE,p))
for p in original:
 if '/test/' in p and p.endswith(('.mjs','.py','.ts')):check('original test '+p,current.get(p)==original[p])
old=json.loads(blob(BASE,'packages/contracts/retrieval-0.2/catalog.json'));new=json.loads((ROOT/'packages/contracts/retrieval-0.2/catalog.json').read_bytes())
check('139 original capabilities',len(new['originals'])==139)
check('96 selected 43 deferred',collections.Counter(x['disposition'] for x in new['originals'])=={'selected':96,'deferred':43})
check('85 typed 84 mapped 12 pending',len(new['operations'])==85 and collections.Counter(x['state'] for x in new['originals'])=={'mapped':84,'pending':12,'deferred':43})
check('catalog version only prescribed 0.2.12',new['catalogVersion']=='0.2.12')
for a in old['originals']:
 b=next(x for x in new['originals'] if x['id']==a['id'])
 if a['id']=='get_research_evidence':check('only evidence maps',b['state']=='mapped' and b['replacement']=={'id':'get_research_evidence','version':'0.2.0'})
 elif a['id']=='list_research_portfolios':
  check('list portfolio footnote only',{k:v for k,v in a.items() if k!='boundary'}=={k:v for k,v in b.items() if k!='boundary'})
 else:check('original accounting '+a['id'],a==b)
for a in old['operations']:
 b=next(x for x in new['operations'] if x['operation']==a['operation'])
 if a['operation']['id']=='get_research_portfolio':
  check('existing portfolio descriptor footnote only',{k:v for k,v in a.items() if k!='limitations'}=={k:v for k,v in b.items() if k!='limitations'})
 else:check('existing descriptor '+a['operation']['id'],a==b)
for a in new['operations']:check('production disabled '+a['operation']['id'],a['handler'] is None and a['availability']=='unimplemented' and a['qualification']=='pending')
p='packages/contracts/retrieval-0.2/research-portfolio-evidence.schema.json';schema=json.loads((ROOT/p).read_bytes());entry=next(x for x in new['operations'] if x['operation']['id']=='get_research_evidence')
check('both schema hashes exact',all(entry[k]['sha256']==digest((ROOT/p).read_bytes()) for k in ['inputSchema','outputSchema']))
check('new input is actual model request',entry['inputSchema']['id']==schema['$id']+'#/$defs/ResearchPortfolioEvidenceInput')
check('raw member and historical selectors unadvertised',all(set(x['properties'])<=set(['origin','recordId','conversationId']) for x in schema['$defs']['ResearchPortfolioEvidenceInput']['oneOf']))
reg='packages/contracts/retrieval-0.2/catalog-validation.mjs';prior=blob(BASE,reg).decode();now=(ROOT/reg).read_text();start=now.index("  Object.freeze({id: 'get_research_evidence'");end=now.index("  Object.freeze({id: 'get_research_portfolio'",start)
check('canonical registry exact previous bytes plus one insertion',now[:start]+now[end:]==prior)
insert=now[start:end]
check('trusted binding subject context only',"['binding', 'subject']" in insert and "dispatchProfile: 'portfolio-evidence/1'" in insert)
ctx='apps/gateway/sources/memory-proposals/request-context.mjs';oldctx=blob(BASE,ctx).decode();newctx=(ROOT/ctx).read_text();shared=(ROOT/'apps/gateway/sources/source-admission.mjs').read_text()
for name,nextname in [('ownFields','frozenData'),('frozenData','readContext')]:
 body=oldctx[oldctx.index('export function '+name):oldctx.index('export function '+nextname)]
 check('exact extracted '+name,body.rstrip() in shared)
check('memory readContext byte-identical',oldctx[oldctx.index('export function readContext'):]==newctx[newctx.index('export function readContext'):])
reader=(ROOT/'apps/gateway/sources/json-response.mjs').read_text();oldhttp=blob(BASE,'apps/gateway/sources/memory-proposals/http-adapter.mjs').decode()
for token in ["new TextDecoder('utf-8'",'Number.isSafeInteger(Number(length))','bytes!==Number(length)','part.value instanceof Uint8Array','reader.cancel()','reader.releaseLock()']:
 check('reader retains '+token,re.sub(r'\s+','',token) in re.sub(r'\s+','',reader) and re.sub(r'\s+','',token) in re.sub(r'\s+','',oldhttp))
for family in ['memory-proposals','research-portfolio-evidence']:
 body=(ROOT/f'apps/gateway/sources/{family}/http-adapter.mjs').read_text();check('response ownership repair '+family,body.index('acquiredResponse')<body.index('await fetchImpl') and re.search(r'acquiredResponse\s*=\s*result',body) and 'finally' in body)
check('original memory acquisition also lacked outer response owner', 'acquiredResponse' not in blob('e5fb3963','apps/gateway/sources/memory-proposals/http-adapter.mjs').decode())
# Exact private source hashes, method locators and content-free behavioral assertions only.
references=[];privates={};privateRepo='/workspace/capirov2'
privatePaths=['packages/shared/src/research-portfolios.ts','apps/api/src/research-portfolios/research-portfolios.controller.ts','apps/api/src/research-portfolios/research-portfolio-review.service.ts','apps/api/src/research-portfolios/research-portfolio-analytics.service.ts','apps/api/src/research-portfolios/research-portfolio-access.ts','apps/api/src/research-portfolios/research-portfolio-meri-scope.service.ts']
for p in privatePaths:
 versions=[]
 for ref in ['fd8765ec01d292013758606204f2c9d886cd31c1','4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace']:
  b=git('show',ref+':'+p,repo=privateRepo);versions.append({'ref':ref,'blob':git('rev-parse',ref+':'+p,repo=privateRepo).decode().strip(),'bytes':len(b),'sha256':digest(b)})
  if ref.startswith('fd8765'):privates[p]=b.decode()
 references.append({'path':p,'versions':versions});check('private source no drift '+p,versions[0]['sha256']==versions[1]['sha256'])
def method(p,name):
 s=privates[p];pattern=r'^  (?:(?:private|public|protected) )?(?:async )?'+name+r'\('
 m=re.search(pattern,s,re.M);assert m,name
 nxt=re.search(r'^  (?:(?:private|public|protected) )?(?:async )?\w+\(',s[m.end():],re.M)
 b=s[m.start():m.end()+nxt.start()] if nxt else s[m.start():]
 return b
reviewP=privatePaths[2];analyticsP=privatePaths[3];controllerP=privatePaths[1]
for name,path in [('listReviews',reviewP),('getAnnualReview',reviewP),('snapshot',analyticsP)]:
 b=method(path,name);check('source viewer gate '+name,"'viewer'" in b);check('source tenant transaction '+name,'withTenant' in b)
for name,route,callee in [('listReviews',':portfolioId/reviews','reviewService.listReviews'),('getAnnualReview',':portfolioId/annual-review','reviewService.getAnnualReview'),('snapshot',':portfolioId/snapshots/:snapshotId','analyticsService.snapshot')]:
 b=method(controllerP,name);check('fixed controller delegate '+name,callee in b)
 check('actual existing GET '+name, re.search(r"@Get\(['\"]"+re.escape(route)+r"['\"]\)",privates[controllerP]) is not None)
annual=method(reviewP,'getAnnualReview');project=method(reviewP,'projectAnnualReview')
check('annual GET explicitly passes false persistence',re.search(r'projectAnnualReview\([\s\S]*?,\s*false\)',annual) is not None)
check('annual persistence branch is conditional','if (persist)' in project)
check('annual readonly projection retains persisted discriminator','persisted: persist' in project)
lanes=method(reviewP,'listReviews')
for lane in ['mine','team','deferred','resolved']:check('existing review lane '+lane,repr(lane) in lanes)
for name in ['evidenceFor','evidenceAgainst']:
 check('review DTO projects '+name,name in method(reviewP,'reviewDto'))
for name in ['clientAccessRequirements','versions','limitations','observedAt','readAt']:
 check('retained snapshot DTO projects '+name,name in method(analyticsP,'snapshotDto'))
metadata={'references':references,'limits':'Only static source predicates and locator/hash metadata, no private body/import/execution; current source/provider/policy/database behavior UNRUN.'}
(OUT/'reference-identities.json').write_text(json.dumps(metadata,indent=2)+'\n')
result={'base':BASE,'candidate':CANDIDATE,'reviewHead':git('rev-parse','HEAD').decode().strip(),'originalEntries':len(original),'unchangedOriginalEntries':len(original)-len(changes),'changedOriginalPaths':changes,'exactCandidatePaths':paths,'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'privateSourceExecuted':False,'runtimeAccepted':False}
(OUT/'source-audit-result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['candidate','originalEntries','unchangedOriginalEntries','passed','failed']}))
for x in checks:
 if not x['passed']:print('FAILED: '+x['name'])
raise SystemExit(bool(result['failed']))
