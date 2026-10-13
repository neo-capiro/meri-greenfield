from pathlib import Path
from decimal import Decimal as D
import json,hashlib,subprocess
r=Path(__file__).resolve().parents[5];ref='cd88c8dec7035da9fb6019f98572da4814af3411';prefix='docs/qualification/candidates/action-host-20261013/pilot-addendum/'
def blob(p):return subprocess.check_output(['git','show',ref+':'+p],cwd=r)
def obj(n):return json.loads(blob(prefix+n))
c=[]
def check(n,b):c.append({'name':n,'passed':bool(b)})
raw=blob(prefix+'manifest.json');check('manifest-pin',hashlib.sha256(raw).hexdigest()=='3c2bbda326c5ff190867bf8825e82d33c380034af161710fd805e671466ad1c0')
for m in json.loads(raw)['members']:
 b=blob(m['path']);check('member:'+m['path'],len(b)==m['bytes'] and hashlib.sha256(b).hexdigest()==m['sha256'])
d=obj('decision.json');p=d['preservedProposal'];f=obj('documentation-findings.json');o=obj('rendered-observations.json');ret=obj('public-retrievals.json');w=f['webToolResponse'];ob=w['retainedObservationArtifact'];b=blob(ob['path'])
check('dated-observations',f['date']==o['observedDate']==w['retrievalDate']=='2026-10-13')
check('retained-observation-pin',len(b)==ob['bytes'] and hashlib.sha256(b).hexdigest()==ob['sha256'])
check('no-raw-or-full-response-identity',w['rawHtmlSha256'] is None and w['fullResponseRetained'] is False)
check('two-proxy-denials',len(ret['records'])==2 and all('403' in x['error'] and not x['bodyRetained'] and x['credentialsSupplied'] is False for x in ret['records']))
check('counting-fee-explicit',d['countTokens']['documentedApiFeeUsdPerAttempt']=='0' and d['countTokens']['documentedApiFeeUsdMaximum']=='0')
check('no-live-support-claim',d['countTokens']['runtimeCompatibility']=='UNRUN' and d['countTokens']['accountAvailabilityVerified'] is False)
check('unchanged-limits',p['inferenceAttempts']==18 and p['countTokensAttempts']==18 and p['providerHttpOperations']==36)
check('spend-unapproved',p['inferenceApprovalCeilingUsd']=='0.75' and p['spendAuthorized'] is False and p['accountPricesVerified'] is False)
check('no-provider-actions',all(d['activity'][k]==0 for k in ['providerApiCalls','accountApiCalls','modelCalls']))
check('inference-arithmetic',D(18)*(D(8000)*D('3.30')+D(256)*D('16.50'))/1000000==D(p['maximumInferenceUsdAtAdmittedRates']) and D(12)*(D(4000)*D('3.30')+D(128)*D('16.50'))/1000000==D(p['estimatedInferenceUsd']))
check('exact-two-official-sources',[x['url'] for x in o['sources']]==['https://docs.aws.amazon.com/bedrock/latest/userguide/count-tokens.html','https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html'])
check('author41-receipt',obj('verification.json')['passed']==obj('verification.json')['total']==41)
print(json.dumps({'candidate':ref,'checks':len(c),'passed':sum(x['passed'] for x in c),'failed':[x for x in c if not x['passed']],'detail':c},indent=2));raise SystemExit(any(not x['passed'] for x in c))
