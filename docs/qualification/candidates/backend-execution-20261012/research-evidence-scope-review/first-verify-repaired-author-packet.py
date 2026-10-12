#!/usr/bin/env python3
import hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];A='f749dd4dfd3989466fa663de98ac3f94cb2d8800';B='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8';P='docs/qualification/candidates/backend-execution-20261012/research-evidence-scope/';C='/workspace/capirov2';checks=[]
def get(ref,p,repo=ROOT):return subprocess.check_output(['git','-C',str(repo),'show',ref+':'+p])
def js(p):return json.loads(get(A,P+p))
def check(n,v):checks.append({'name':n,'pass':bool(v)})
def tree(ref):
 b=subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-rz',ref]);return dict((r.split(b'\t')[1].decode(),r.split(b'\t')[0].decode()) for r in b.split(b'\0') if r)
m=js('manifest.json');mb=get(A,P+'manifest.json');old,new=tree(B),tree(A)
check('all7677 originals preserved',len(old)==7677 and all(new.get(p)==v for p,v in old.items()))
check('author additions only allocated documentation',all(p.startswith(P) or p in ['docs/coordination/reports/CODEX-RESEARCH-EVIDENCE-SCOPE-20261012.md','docs/coordination/tasks/CODEX-RESEARCH-EVIDENCE-SCOPE-20261012.md'] for p in set(new)-set(old)))
check('manifest11members unique',len(m['members'])==len({x['path'] for x in m['members']})==11)
for x in m['members']:
 b=get(A,x['path']);check('author member '+x['path'],len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'])
refs=js('source-reference-identities.json');check('20 paired source references',len(refs)==20)
for r in refs:
 for k in ['frozen','observed']:
  x=r[k];b=get(x['ref'],r['path'],C);check('source metadata '+k+' '+r['path'],len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==x['blob'])
 check('paired drift truthful '+r['path'],r['changed']==(r['frozen']['sha256']!=r['observed']['sha256']))
census=js('storage-field-census.json');schema=get(census['source'],'apps/api/prisma/schema.prisma',C).decode();check('16models labelled census not allowlist',len(census['models'])==16 and 'not a source exposure allowlist' in census['scope'])
for r in census['models']:
 match=re.search(r'model '+r['model']+r'\s*\{(.*?)\n\}',schema,re.S);check('model line '+r['model'],match is not None and schema[:match.start()].count('\n')+1==r['line'])
 for f in r['fields']:check('stored scalar '+r['model']+'.'+f['name'],bool(re.search(r'^\s*'+f['name']+r'\s+'+re.escape(f['prismaType'])+r'(?:\s|$)',match[1],re.M)))
a=js('api-proposal.json');check('proposal not implementation or mapping','PROPOSAL_ONLY' in a['status'] and a['originalMappingRemains']=='pending/null' and a['runtimeQualified'] is False and a['sourceConnected'] is False)
check('exact selected intent and canonical context',a['operation']=='get_research_evidence' and a['contextKeys']==['binding','subject'] and not a['requestAuthorityFields'])
check('three explicit proposed variants',[x['origin'] for x in a['variants']]==['review','snapshot','current_continuity'])
for x in a['variants']:check('branch-owned coverage '+x['origin'],all(k in x for k in ['request','dataProjection','sourceRead','paging','coverage']))
c=a['variants'][2];check('current continuity no invented selectors',set(c['forbiddenSelectors'])=={'recordId','decisionIds','knownAt','asOfFiscalYear','historical','cursor','limit'})
check('raw/historical evidence not silently excluded',{'raw member evidence','older decision/continuity storage'}<=set(a['notAutomaticallyExcludedEvidence']))
check('remaining inclusion questions explicit',len(a['remainingOwnerFacts'])==3)
v=js('verify-result.json');check('author metadata verifier194pass',v['checks']==v['passed']==194 and v['failed']==0 and v['failures']==[])

initial='07ac4c756c7b313d2f698c32c62de5a7321358a9'
changed=set(subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',initial,A],text=True).splitlines())
check('narrow documentary repair only',changed=={P+'api-proposal.json',P+'independent-findings.json',P+'manifest.json',P+'verify-result.json','docs/coordination/reports/CODEX-RESEARCH-EVIDENCE-SCOPE-20261012.md'})
check('known final tree',subprocess.check_output(['git','-C',str(ROOT),'rev-parse',A+'^{tree}'],text=True).strip()=='07d2d1f4974a5893118c023bddb8222133307ff3')
check('known final manifest identity',hashlib.sha256(mb).hexdigest()=='4734a2548af621ed23ff518a7fc26642b2fcb5881200b8ee8bffaf67e0410847')
f=js('independent-findings.json')
check('both semantic findings preserved',f['reviewedFreeze']==initial and [x['id'] for x in f['findings']]==['scope-wording-derivation','review-lane-selection'] and f['productionChanges'] is False)
check('exact review source seam not default-lane absence','current viewer/tenant/portfolio policy' in a['variants'][0]['sourceSelectionSeam'] and 'default/incomplete lane does not establish absence' in a['variants'][0]['sourceSelectionSeam'])
check('native annual derivation remains explicit','derives continuity facts even with persistence disabled' in c['executionBoundary'] and 'retained-only projection would require its own explicit selector/exposure contract' in c['executionBoundary'])
report=get(A,'docs/coordination/reports/CODEX-RESEARCH-EVIDENCE-SCOPE-20261012.md').decode()
check('report excludes analytics not all current derivation','analytics/fit recomputation' in report and 'must not claim retained-only execution' in report and 'qualified complete lane coverage' in report)
original=json.loads(get(initial,P+'verify-result.json'))
check('original192pass preserved',original['checks']==original['passed']==192 and original['failed']==0)
check('manifest covers exact author additions',set(new)-set(old)=={x['path'] for x in m['members']}|{P+x for x in m['exclusions']})

result={'verdict':'ACCEPT_METADATA','author':A,'authorTree':subprocess.check_output(['git','-C',str(ROOT),'rev-parse',A+'^{tree}'],text=True).strip(),'status':'PASS' if all(x['pass'] for x in checks) else 'FAIL','passed':sum(x['pass'] for x in checks),'total':len(checks),'manifestSha256':hashlib.sha256(mb).hexdigest(),'manifestMembers':len(m['members']),'checks':checks,'implementationAccepted':False,'completeMappingAccepted':False,'runtimeAccepted':False,'scope':'Authority/carrier/API proposal metadata only; current continuity computation and exact-review lane scope remain explicit design conditions.'}
print(json.dumps(result,indent=2));raise SystemExit(0 if result['status']=='PASS' else 1)
