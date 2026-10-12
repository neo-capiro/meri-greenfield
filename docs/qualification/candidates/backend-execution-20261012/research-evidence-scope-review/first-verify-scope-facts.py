#!/usr/bin/env python3
"""Read-only repository/schema metadata; no private imports or services."""
import hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];checks=[]
def g(repo,*a):return subprocess.check_output(['git','-C',str(repo),*a])
def get(ref,path,repo=ROOT):return g(repo,'show',ref+':'+path)
def check(n,x):checks.append({'name':n,'pass':bool(x)})
def pin(ref,p,repo):
 b=get(ref,p,repo);return {'commit':ref,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()}
BASE='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8';FROZEN='fd8765ec01d292013758606204f2c9d886cd31c1';CURRENT='4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace';C=Path('/workspace/capirov2')
d011=g(ROOT,'rev-parse','3406ed7e').decode().strip();r2=g(ROOT,'rev-parse','e14564e6').decode().strip()
authorities=[]
for ref,p in [(d011,'docs/coordination/DECISIONS.md'),(BASE,'docs/CAPABILITY-SCOPE.md'),(r2,'docs/coordination/reports/CODEX-R2-ADOPTION.md'),(BASE,'docs/coordination/r2/capabilities.json'),(BASE,'docs/plans/revisions/20261010-R2/inventory-stored-cells.json')]:authorities.append({'path':p,**pin(ref,p,ROOT)})
dec=get(d011,authorities[0]['path']).decode();scope=get(BASE,'docs/CAPABILITY-SCOPE.md').decode();adopt=get(r2,'docs/coordination/reports/CODEX-R2-ADOPTION.md').decode();ledger=json.loads(get(BASE,'docs/coordination/r2/capabilities.json'))
rows=ledger if isinstance(ledger,list) else next(v for v in ledger.values() if isinstance(v,list) and v and 'fields' in v[0]);native=[r for r in rows if 'acceptedScope' in r]
check('D011 human explicitly accepts96/43 and basic Portfolio reads','## D011 Accepted v1 scope' in dec and '96 selected and 43 explicitly deferred' in dec and 'basic Research Portfolio/Business Development reads' in dec)
check('scope accepts new implementation not parity/grant','intended new implementation scope, not accepted parity or a source permission grant' in dec)
check('all139 retained with96selected43deferred',len(native)==139 and sum(r['acceptedScope']['disposition']=='selected' for r in native)==96 and sum(r['acceptedScope']['disposition']=='deferred' for r in native)==43)
byid={r['fields']['ID']:r for r in native};row=byid['get_research_evidence']
check('evidence selected Portfolio boundary',row['acceptedScope']['disposition']=='selected' and 'Research Portfolio record/evidence/history' in row['acceptedScope']['boundary'])
check('review workflow and analytics deferred',all(byid[k]['acceptedScope']['disposition']=='deferred' for k in ['get_research_portfolio_reviews','get_research_portfolio_analytics','add_research_portfolio_review_note']))
check('R2 labels explicitly separate scope','96 selected /43 deferred' in adopt and 'labels are a separate inventory dimension' in adopt and 'do not revoke accepted reads or promote deferred commands' in adopt)
stored=json.loads(get(BASE,'docs/plans/revisions/20261010-R2/inventory-stored-cells.json'));sheet=next(s for s in stored if s['name']=='Native backend');cells=next(r for r in sheet['rows'] if str(r['row'])=='27')['cells'];vals=[x.get('value','') for x in cells]
check('stored original Native backend27 preserved', 'get_research_evidence' in vals and any('immutable attachment evidence' in str(x) for x in vals))
paths=['packages/shared/src/research-portfolios.ts','apps/api/prisma/schema.prisma','apps/api/src/research-portfolios/research-portfolio-meri-tools.service.ts','apps/api/src/research-portfolios/research-portfolio-meri-scope.service.ts','apps/api/src/research-portfolios/research-portfolio-access.ts','apps/api/src/research-portfolios/research-portfolio-review.service.ts','apps/api/src/research-portfolios/research-portfolios.service.ts','apps/api/src/research-portfolios/research-portfolio-changes.service.ts','apps/api/src/research-portfolios/research-portfolio-analytics.service.ts','apps/api/src/meri/meri-tools.service.ts','apps/api/src/meri/meri-research-evidence.helpers.ts','apps/api/src/meri/meri-research-handoff.ts','apps/api/src/memory/memory-wall.helpers.ts']
refs=[]
for p in paths:
 versions=[pin(ref,p,C) for ref in [FROZEN,CURRENT]];refs.append({'path':p,'versions':versions});check('paired source unchanged '+p,versions[0]['sha256']==versions[1]['sha256'])
shared=get(FROZEN,paths[0],C).decode();review=get(FROZEN,paths[5],C).decode();tools=get(FROZEN,paths[2],C).decode();prisma=get(FROZEN,paths[1],C).decode()
m=re.search(r'export interface ResearchPortfolioReviewEvidenceDto\s*\{(.*?)\n\}',shared,re.S);fields=re.findall(r'^\s+(\w+)\??:',m[1],re.M)
check('exact4 actual review evidence fields',fields==['sourceRevisionId','locator','quote','stance'])
check('review evidence nullable quote and stance','quote: string | null' in m[1] and "'for' | 'against'" in m[1])
union=tools[tools.index('export type ResearchPortfolioMeriToolName'):tools.index('const NAMES')]
check('no existing Portfolio get_research_evidence method',"'get_research_evidence'" not in union and "'get_research_portfolio_reviews'" in union)
method=review[review.index('  async listReviews('):review.index('  async assignReview(')]
check('existing review list read has no take/cursor', 'tx.researchPortfolioReview.findMany' in method and 'this.loadAuthorized' in method and "'viewer'" in method and 'take:' not in method and 'cursor:' not in method)
check('review list alone does not establish source locator permission','clientMemoryAllowed' not in method and 'sourceRevision' not in method)
model=re.search(r'model ResearchPortfolioReview\s*\{(.*?)\n\}',prisma,re.S)[1]
for f in ['id','tenantId','portfolioId']:check('stored review UUID '+f,bool(re.search(r'^\s*'+f+r'\s+String[^\n]*@db.Uuid',model,re.M)))
check('evidence storage is Json rather than constrained item relation',all(re.search(r'^\s*'+f+r'\s+Json\b',model,re.M) for f in ['evidenceFor','evidenceAgainst']))
portfolio=json.loads(get(BASE,'packages/contracts/retrieval-0.2/research-portfolio.schema.json'));context=portfolio['$defs']['ResearchPortfolioContext']
check('canonical existing context binding subject only',set(context['properties'])==set(context['required'])=={'binding','subject'} and context['additionalProperties'] is False)
legacy=get(FROZEN,paths[10],C).decode();check('legacy evidence is separate Clio session attachment projection',all(x in legacy for x in ['clioResearchSession.findFirst','clioAttachment.findMany','clientMemoryAllowed','attachmentIds']))
biz=get(BASE,'packages/contracts/retrieval-0.2/business-development-validation.mjs').decode();check('BizDev evidence is separate operation','get_business_development_evidence' in biz and 'get_research_evidence' not in biz)
result={'status':'PASS' if all(x['pass'] for x in checks) else 'FAIL','base':BASE,'authorityPins':authorities,'references':refs,'reviewEvidenceFields':fields,'nativeBackend27':{'row':27,'id':row['fields']['ID'],'currentCapability':row['fields']['Current capability'],'acceptedBoundary':row['acceptedScope']['boundary']},'passed':sum(x['pass'] for x in checks),'total':len(checks),'checks':checks,'scope':'Documentary/source-contract facts only. No API or runtime source qualification inferred; interpretation is in independent report.'}
print(json.dumps(result,indent=2));raise SystemExit(0 if result['status']=='PASS' else 1)
