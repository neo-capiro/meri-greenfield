#!/usr/bin/env python3
"""Metadata/projection audit only: no private import, query or execution."""
import hashlib,json,re,subprocess
from pathlib import Path
P=Path(__file__).resolve().parent;ROOT=P.parents[4]
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT)
def private(ref,p):return subprocess.check_output(['git','-C','/workspace/capirov2','show',ref+':'+p])
def check(n,x):checks.append({'name':n,'pass':bool(x)})
checks=[];source='64853d387fe98e3ff117fd6ad9c3652bf5465276';base='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8';frozen='fd8765ec01d292013758606204f2c9d886cd31c1';current=subprocess.check_output(['git','-C','/workspace/capirov2','rev-parse','4be13b0b'],text=True).strip()
files=['packages/contracts/retrieval-0.2/research-legal-news.schema.json','packages/contracts/retrieval-0.2/research-legal-news-validation.mjs','packages/contracts/test/retrieval-research-legal-news.test.mjs']
for p in files:check('exercised exact candidate '+p,(ROOT/p).read_bytes()==git('show',source+':'+p))
def tree(ref):
 return dict((row.split(b'\t',1)[1].decode(),row.split(b'\t',1)[0].decode()) for row in git('ls-tree','-rz',ref).split(b'\0') if row)
old,new=tree(base),tree(source);check('all7677 baseline entries unchanged',len(old)==7677 and all(new.get(p)==v for p,v in old.items()))
paths=['apps/api/src/meri/meri-tools.service.ts','apps/api/prisma/schema.prisma','apps/api/src/engagement/engagement-access.helpers.ts','apps/intel-api/src/tracker/keywords/keyword-meri.controller.ts','apps/intel-api/src/tracker/keywords/internal-workflow.controller.ts','apps/intel-api/src/tracker/editorial/evidence.service.ts','apps/intel-api/src/tracker/editorial/publisher-coverage.ts','apps/intel-api/src/tracker/research/research.service.ts','apps/intel-api/src/tracker/reports/report.service.ts','apps/intel-api/src/tracker/keywords/keyword-rule.service.ts','apps/intel-api/src/tracker/folders/folder-tracker.service.ts','apps/intel-api/src/feature-flags/feature-flag.service.ts','apps/intel-api/src/sourcedata/folder-source-data.repository.ts','packages/shared/src/legiwatch-query.ts','packages/shared/src/legiwatch-phase8.ts','apps/api/prisma/migrations/20280914030000_legiwatch_news_fiscal/migration.sql','apps/intel-api/prisma/migrations/20260914030000_legiwatch_news_editorial/migration.sql']
refs=[]
for p in paths:
 pins=[]
 for ref in [frozen,current]:
  b=private(ref,p);pins.append({'commit':ref,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()})
 refs.append({'path':p,'versions':pins});check('frozen/current same '+p,pins[0]['sha256']==pins[1]['sha256'])
d=json.loads(git('show',source+':'+files[0]))['$defs'];code=git('show',source+':'+files[1]).decode()
check('closed exact five trusted facts',set(d['ResearchLegalNewsContext']['properties'])==set(d['ResearchLegalNewsContext']['required'])=={'clientResolution','effectiveScope','windowAsOf','defaultYear','owner'} and d['ResearchLegalNewsContext']['additionalProperties'] is False)
check('canonical client-resolution reused',d['ResearchLegalNewsContext']['properties']['clientResolution']=={'$ref':'urn:meri:retrieval:outreach-query:0.2.0#/$defs/OutreachQueryContext/properties/clientResolution'})
check('canonical logical AST schema reused',any('research-legal-legislation' in json.dumps(x) for x in d.values()))
check('existing budget property owner reused','urn:meri:retrieval:florida-budget:0.2.0#/$defs/FloridaBudgetDocument/properties/' in json.dumps(d))
check('canonical inert/date helpers reused',"from './operation-contracts.mjs'" in code and "from './public-data-deadlines.mjs'" in code)
check('no ambient/native/source runtime',all(x not in code for x in ['fetch(', 'process.env', '$queryRaw', 'compileNewsQuery(', 'Date.now(', 'new Date()', 'node:child_process']))

def columns(text,table):
 text=re.sub(r'--[^\n]*','',text);m=re.search(r'CREATE TABLE '+table+r'\s*\((.*?)\n\);',text,re.S)
 if not m:raise ValueError('Table missing '+table)
 body=m[1];parts=[];last=depth=i=0;quoted=False
 while i<len(body):
  c=body[i]
  if c=="'":
   if quoted and i+1<len(body) and body[i+1]=="'":i+=2;continue
   quoted=not quoted
  if not quoted:
   if c=='(':depth+=1
   if c==')':depth-=1
   if c==',' and depth==0:parts.append(body[last:i]);last=i+1
  i+=1
 parts.append(body[last:]);return [m[1] for p in parts if (m:=re.match(r'\s*([a-z_]+)\s+(?:text|integer|int|boolean|jsonb|timestamptz)\b',p))]
fiscal=private(frozen,paths[-2]).decode();editorial=private(frozen,paths[-1]).decode()
news=set(columns(fiscal,'legiwatch_news_observation'))|{'is_current'};person=set(columns(fiscal,'florida_personnel_observation'));budget=set(columns(fiscal,'florida_budget_document'));monitor=set(columns(editorial,'intel_legiwatch_news_monitor'))
expected={'ResearchLegalNewsArticle':news|{'saved','tracking_version'},'ResearchLegalNewsPersonnel':person|{'saved','tracking_version'},'ResearchLegalNewsSourceNews':news|{'sourceUrl','text','observedAt','complete','authority'},'ResearchLegalNewsSourceBudget':budget|{'revision','sourceUrl','text','observedAt','authority','rights'},'ResearchLegalNewsSourcePersonnel':person|{'title','sourceUrl','text','observedAt','complete','authority','rights'},'ResearchLegalNewsMonitor':monitor|{'interpretation'},'ResearchLegalNewsSourceResearch':set('id billId revision title sourceUrl text sections observedAt complete authority rights'.split()),'ResearchLegalNewsCoverage':set(columns(fiscal,'legiwatch_source_coverage'))|{'intake','retained'}}
for n,keys in expected.items():check('DDL/projection exact columns '+n,set(d[n]['properties'])==set(d[n]['required'])==keys and d[n]['additionalProperties'] is False)
publisher=private(frozen,'apps/intel-api/src/tracker/editorial/publisher-coverage.ts').decode();body=re.search(r'export const publisherIntakeEndpoints = \[(.*?)\] as const',publisher,re.S)[1]
endpoints=[]
for x in re.findall(r'\{(.*?)\}',body,re.S):
 values=dict(re.findall(r"(publisher|slug|url):\s*'([^']*)'",x));
 if len(values)!=3:raise ValueError('Unclosed endpoint metadata')
 endpoints.append(values)
check('all7 exact public endpoint metadata entries',len(endpoints)==7 and endpoints==d['ResearchLegalNewsIntakeEndpoints']['const'])
check('rights exact DDL enum',d['ResearchLegalNewsArticle']['properties']['rights']['enum']==['headline_link','excerpt','full_text'])
for label,code,tests,failures in [('news-first',1,35,1),('news-corrected',0,116,0),('news-final',0,120,0)]:
 r=json.loads((P/(label+'.json')).read_text());check(label+' source and cleanup',r['exitCode']==code and r['ownedProcessGroupAbsent'] and not r['timedOut'] and r['sourceDiffBytes']==0)
 for st in r['streams']:
  b=(ROOT/st['path']).read_bytes();check(label+' raw '+Path(st['path']).name,len(b)==st['bytes'] and hashlib.sha256(b).hexdigest()==st['sha256'])
 text=(P/(label+'.stdout.bin')).read_text();check(label+' totals',f'tests {tests}' in text and f'fail {failures}' in text)
result={'status':'PASS' if all(x['pass'] for x in checks) else 'FAIL','source':source,'tree':git('rev-parse',source+'^{tree}').decode().strip(),'base':base,'originalEntries':len(old),'passed':sum(x['pass'] for x in checks),'total':len(checks),'references':refs,'checks':checks,'scope':'Source DTO only. No private implementation executed; no current tenant/folder/actor authorization, provider/intake/corpus truth or runtime acceptance.'}
print(json.dumps(result,indent=2));raise SystemExit(0 if result['status']=='PASS' else 1)
