#!/usr/bin/env python3
"""Offline metadata-only verification; no imports of product/runtime modules."""
import pathlib,json,hashlib,subprocess,decimal
P=pathlib.Path(__file__).resolve().parent
ROOT=pathlib.Path(subprocess.check_output(['git','rev-parse','--show-toplevel'],cwd=P,text=True).strip())
checks=[]
def check(name,value):
 checks.append({'name':name,'passed':bool(value)})
def read(n):return json.loads((P/n).read_text())
r=read('source-identities.json');base=r['base']
for x in r['references']:
 b=subprocess.check_output(['git','show',base+':'+x['path']],cwd=ROOT)
 check('source:'+x['path'],len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'] and subprocess.check_output(['git','rev-parse',base+':'+x['path']],cwd=ROOT,text=True).strip()==x['blob'])
c=read('cases.json');p=read('pricing.json');caps=p['caps'];cases=c['cases']
check('six-exact-case-identities',[x['id'] for x in cases]==['P01','P02','P03','P04','P05','P06'])
check('all-prompts-present',all(len(x['prompt'])>30 for x in cases))
check('zero-qualified-real',c['qualifiedRealRequests']==c['humanAuthoredCases']==0 and all(x['humanAuthorshipVerified'] is False for x in cases))
check('implemented-routes',[x['api']['path'].split('/')[-1] for x in cases]==['query','query','draft','prepare','execute','query'])
check('no-task-effects',all(x['maxSyntheticEffects']['taskEffects']==0 for x in cases))
check('no-false-rate',p['publicAwsMatchedRate']['inputUsdPerMillionTokens'] is None and p['publicAwsMatchedRate']['outputUsdPerMillionTokens'] is None)
check('count-tokens-published-zero',p['countTokens']['publishedUsdPerRequest']=='0')
check('operation-caps',caps['inferenceAttempts']==caps['countTokensAttempts']==18 and caps['totalProviderHttpOperations']==36)
check('token-caps',caps['inputTokensTotal']==18*8000==144000 and caps['outputTokensTotal']==18*256==4608)
check('no-spend-approval',caps['approved'] is False and caps['historicalAllowanceRemainder']=='UNKNOWN_NOT_REUSED')
D=decimal.Decimal; old=p['formula']['priorConditionalIllustrationOnly'];i=D(old['inputUsdPerMillionTokens']);o=D(old['outputUsdPerMillionTokens'])
check('conditional-max',str((D(144000)*i+D(4608)*o)/D(1000000))==old['maximumTokenUsd'])
check('conditional-estimate',str(D(12)*(D(4000)*i+D(128)*o)/D(1000000))==old['estimatedUsd'])
wire=json.loads(subprocess.check_output(['git','show',base+':'+cases[0]['wireGold']],cwd=ROOT));steps=wire['steps'];q=steps[0]['response'];page=q['observation']['result'];a=page['actions'][0]
check('actual-one-synthetic-row',len(page['actions'])==1 and a['id']==cases[0]['expected']['actionId'] and a['clientId']==cases[0]['expected']['clientId'])
check('actual-recommendation-gold',all(a[k]==cases[0]['expected'][k] for k in ['title','whatChanged','whyItMatters','recommendedAction']) and q['acceptedTasks'] is False)
check('actual-coverage-gold',page['coverage']['enumeration']=='unknown' and page['sources'][0]['freshness']=='unknown' and page['sources'][0]['asOf'] is None and page['negativeAssertion']['kind']=='none' and page['evidenceReady'] is False and page['pageCoverage']['complete'] is True)
check('actual-draft-task',steps[1]['response']['task']==cases[2]['expected']['task'])
check('actual-prepare-status',steps[2]['response']['status']=='approval_required')
check('actual-unapproved-error',steps[3]['httpStatus']==409 and steps[3]['response']=={'error':cases[4]['expected']['error']})
check('source-derived-revocation',b"fail('UNAUTHENTICATED',401)" in subprocess.check_output(['git','show',base+':apps/control/action-application/index.mjs'],cwd=ROOT))
check('real-manifest-unchanged-zero',json.loads(subprocess.check_output(['git','show',base+':evals/retrieval-r2/manifest.json'],cwd=ROOT))['realRequestsReceived']==0)
for x in read('direct-price-list-reads.json'):check('retained-zero-byte-failure:'+x['url'],x['bytes']==0 and '403' in x['error'] and x['candidateLocationExistenceVerified'] is False)
result={'scope':'offline metadata/source-byte and exact synthetic-gold checks only; no model/API/runtime execution','passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks}
print(json.dumps(result,indent=2));raise SystemExit(0 if not result['failed'] else 1)
