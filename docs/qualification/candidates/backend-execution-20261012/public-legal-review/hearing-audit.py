#!/usr/bin/env python3
"""Immutable source metadata and public DTO projection audit; no private execution."""
import hashlib,json,re,subprocess
from pathlib import Path
P=Path(__file__).resolve().parent;ROOT=P.parents[4];checks=[]
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT)
def private(ref,p):return subprocess.check_output(['git','-C','/workspace/capirov2','show',ref+':'+p])
def check(n,x):checks.append({'name':n,'pass':bool(x)})
source='77522c80132c8454781d54156fa61669bc5c823f';base='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8';frozen='fd8765ec01d292013758606204f2c9d886cd31c1';current=subprocess.check_output(['git','-C','/workspace/capirov2','rev-parse','4be13b0b'],text=True).strip()
files=['packages/contracts/retrieval-0.2/public-domain-hearings.schema.json','packages/contracts/retrieval-0.2/public-domain-hearing-records.schema.json','packages/contracts/retrieval-0.2/public-domain-hearings-validation.mjs','packages/contracts/test/retrieval-public-domain-hearings.test.mjs']
for p in files:check('exact exercised source '+p,(ROOT/p).read_bytes()==git('show',source+':'+p))
def tree(ref):return dict((r.split(b'\t',1)[1].decode(),r.split(b'\t',1)[0].decode()) for r in git('ls-tree','-rz',ref).split(b'\0') if r)
old,new=tree(base),tree(source);check('all7677 PR35 entries unchanged',len(old)==7677 and all(new.get(p)==v for p,v in old.items()))
paths=['apps/api/src/meri/meri-tools.service.ts','apps/api/src/meri/meri-context-plane.service.ts','apps/api/prisma/schema.prisma','apps/api/src/engagement/engagement-access.helpers.ts','apps/api/src/retrieval/adapters/hearings-retrieval.adapter.ts','apps/api/src/retrieval/adapters/published-hearing-records.ts','apps/api/src/retrieval/adapters/hearing-content-chunks.ts','apps/api/src/retrieval/adapters/government-work-retrieval.helpers.ts','apps/api/src/retrieval/retrieval-v2.types.ts','apps/api/src/retrieval/retrieval-v2.service.ts','apps/api/src/retrieval/coverage-manifest.ts','apps/intel-api/src/hearing/hearing-record-retrieval.controller.ts','apps/intel-api/src/hearing/hearing-record-workflow.service.ts','apps/intel-api/src/hearing/published-record-domain.ts','apps/intel-api/src/sourcedata/hearing-records.repository.ts','apps/intel-api/src/hearing/hearing-publication.service.ts','apps/intel-api/src/feature-flags/feature-flag.service.ts','apps/intel-api/src/tracker/reports/report.service.ts','apps/intel-api/src/tracker/keywords/keyword-rule.service.ts','apps/intel-api/src/tracker/folders/folder-tracker.service.ts','apps/intel-api/src/sourcedata/folder-source-data.repository.ts','apps/intel-api/prisma/migrations/20260913010000_hearing_record_reconciliation/migration.sql']
refs=[]
for p in paths:
 pins=[]
 for ref in [frozen,current]:
  b=private(ref,p);pins.append({'commit':ref,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()})
 refs.append({'path':p,'versions':pins});check('unchanged source pair '+p,pins[0]['sha256']==pins[1]['sha256'])
d=json.loads(git('show',source+':'+files[0]))['$defs'];rd=json.loads(git('show',source+':'+files[1]))['$defs'];code=git('show',source+':'+files[2]).decode()
check('context exact two trusted facts',set(d['PublicDomainHearingsContext']['properties'])==set(d['PublicDomainHearingsContext']['required'])=={'tenantId','clientResolution'} and not d['PublicDomainHearingsContext']['additionalProperties'])
check('canonical context reused',d['PublicDomainHearingsContext']['properties']['clientResolution']['$ref']=='urn:meri:retrieval:outreach-query:0.2.0#/$defs/OutreachQueryContext/properties/clientResolution')
check('full envelope exact without generatedAt',set(d['PublicDomainHearingsOutput']['properties'])==set(d['PublicDomainHearingsOutput']['required'])=={'tool','note','coverage','observability','records'})
check('canonical inert/date helpers','snapshotOperationData' in code and "from './operation-contracts.mjs'" in code and "from './public-data-deadlines.mjs'" in code)
check('no runtime/source/parser effects',all(x not in code for x in ['fetch(', 'process.env', '$queryRaw', 'Date.now(', 'new Date()', 'node:child_process','decodeHearingContentCursor(']))
adapter=private(frozen,paths[4]).decode();projection=[]
for m in re.finditer(r'jsonb_build_object\(',adapter):
 i=m.end();depth=1;quoted=False;j=i
 while depth:
  c=adapter[j]
  if c=="'":quoted=not quoted
  elif not quoted and c=='(':depth+=1
  elif not quoted and c==')':depth-=1
  j+=1
 projection.append(set(re.findall(r"(?:^|,)\s*'([^']+)'\s*,",adapter[i:j-1])))
for name,keys in zip(['HearingEventPayload','HearingOfficialPayload','HearingSegmentPayload','HearingIntelligencePayload','HearingRelevancePayload'],projection):check('SQL projection complete '+name,set(d[name]['properties'])==set(d[name]['required'])==keys and not d[name]['additionalProperties'])
check('five source projections found',len(projection)==5)
check('ordinary never whole coverage',d['HearingCoverage']['properties']['complete']=={'const':False} and d['HearingSourceCoverage']['properties']['coverageComplete']=={'const':False})
check('stored hearing ID not invented UUID',d['HearingEventPayload']['properties']['id']=={'type':'string'})
check('official null hearing preserved','null' in d['HearingOfficialPayload']['properties']['hearingId']['type'])
check('private payload owners present',all(x in rd for x in ['HearingPublishedBrief','HearingBriefPayload','HearingReconciliation','HearingReconciliationPayload','HearingRecordClaim','HearingRecordAssessment','HearingRecordReview','HearingPublishedRecord']))
chunk=private(frozen,paths[6]).decode();published=private(frozen,paths[5]).decode();workflow=private(frozen,paths[12]).decode()
check('chunk original UTF16 thresholds and plain JSON hash',all(x in chunk for x in ['JSON.stringify(payload)','6500','2000',"createHash('sha256')"]))
check('known published continuation mismatch remains source fact',all(x in chunk for x in ['event','official','segment','insight','relevance']) and "key = 'published:'" in published and "filter.recordsView + ':'" in published)
check('read service still verifies declared private content digest',"digest(payload) !== row.content_hash" in workflow)
check('private source owner and context remain runtime gates',all(x in workflow for x in ['owner_clerk_id','authorize(ctx','lockContext']) and 'EXACT_AUTHORIZED_CLIENT_REQUIRED' in private(frozen,paths[11]).decode())
for label,count,fail in [('hearing-first',76,3),('hearing-corrected',87,0),('hearing-final',97,0)]:
 r=json.loads((P/(label+'.json')).read_text());check(label+' exact source and cleanup',r['sourceDiffBytes']==0 and r['ownedProcessGroupAbsent'] and not r['timedOut'] and r['exitCode']==(1 if fail else 0))
 for s in r['streams']:
  b=(ROOT/s['path']).read_bytes();check(label+' raw '+Path(s['path']).name,len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'])
 text=(P/(label+'.stdout.bin')).read_text();check(label+' totals',f'tests {count}' in text and f'fail {fail}' in text)
result={'status':'PASS' if all(c['pass'] for c in checks) else 'FAIL','source':source,'tree':git('rev-parse',source+'^{tree}').decode().strip(),'base':base,'originalEntries':len(old),'passed':sum(c['pass'] for c in checks),'total':len(checks),'references':refs,'checks':checks,'scope':'All hearing DTO branches only. No current source/actor/client/folder authority, source version truth, private source execution, cryptographic completeness of unseen fragments, published continuation qualification or native/runtime acceptance.'}
print(json.dumps(result,indent=2));raise SystemExit(0 if result['status']=='PASS' else 1)
