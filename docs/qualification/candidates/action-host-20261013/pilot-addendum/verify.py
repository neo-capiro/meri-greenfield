"""Offline documentation/preservation/arithmetic checks. Never fetches or calls a provider."""
from pathlib import Path
from decimal import Decimal as D
import subprocess,json,hashlib
root=Path(__file__).resolve().parents[5];ev=Path(__file__).resolve().parent
base='61ffc8f2487a010c9baba0c8e18088b42569d90a';sealed='9e08fc64471a28e2249dc5d7c5f48fbc8589e2b1'
def git(*a):return subprocess.check_output(['git',*a],cwd=root)
def blob(ref,path):return git('show',ref+':'+path)
checks=[]
def check(name,value):checks.append({'name':name,'passed':bool(value)})
prefix='docs/qualification/candidates/action-host-20261013/pilot/'
manifest=json.loads(blob(sealed,prefix+'manifest.json'))
for m in manifest['members']:
 b=blob(sealed,m['path']);check('sealed hash '+m['path'],len(b)==m['bytes'] and hashlib.sha256(b).hexdigest()==m['sha256']);check('original unchanged '+m['path'],b==blob('HEAD',m['path']))
check('sealed manifest unchanged',blob(sealed,prefix+'manifest.json')==blob('HEAD',prefix+'manifest.json'))
original=json.loads(blob(sealed,prefix+'revised-pilot.json'));d=json.loads((ev/'decision.json').read_text());p=d['preservedProposal'];l=original['limits'];c=original['costing']
for new,old in [('inferenceAttempts','inferenceAttemptsTotal'),('countTokensAttempts','countTokensAttemptsTotal'),('providerHttpOperations','providerHttpOperationsTotal'),('inputTokensMaximum','inputTokensTotal'),('outputTokensMaximum','outputTokensTotal')]:check('preserved '+new,p[new]==l[old])
check('operation sum',p['inferenceAttempts']+p['countTokensAttempts']==p['providerHttpOperations']==36)
check('cap unapproved',p['inferenceApprovalCeilingUsd']==c['proposedInferenceApprovalCeilingUsd']=='0.75' and p['spendAuthorized'] is False and original['spendAuthorized'] is False)
check('account rates remain unverified',p['accountPricesVerified'] is False and c['accountPricesVerified'] is False)
check('inference maximum exact',D(18)*(D(8000)*D('3.30')+D(256)*D('16.50'))/D(1000000)==D(p['maximumInferenceUsdAtAdmittedRates'])==D(c['theoreticalMaximumUsd']))
check('inference estimate exact',D(12)*(D(4000)*D('3.30')+D(128)*D('16.50'))/D(1000000)==D(p['estimatedInferenceUsd'])==D(c['estimatedUsd']))
check('count fee exact',D(18)*D(d['countTokens']['documentedApiFeeUsdPerAttempt'])==D(d['countTokens']['documentedApiFeeUsdMaximum'])==0)
check('route unchanged',p['modelProfile']==original['model']['profile'] and p['region']==original['model']['region'])
check('runtime remains unrun',d['countTokens']['runtimeCompatibility']=='UNRUN' and d['countTokens']['accountAvailabilityVerified'] is False)
check('no provider/account/model calls',all(d['activity'][k]==0 for k in ['providerApiCalls','accountApiCalls','modelCalls']))
r=json.loads((ev/'public-retrievals.json').read_text());check('retrieval script pinned',r['scriptSha256']==hashlib.sha256((ev/'capture-public-docs.py').read_bytes()).hexdigest())
check('two direct failures preserved',len(r['records'])==2 and all('403' in x['error'] and x['bodyRetained'] is False for x in r['records']))
f=json.loads((ev/'documentation-findings.json').read_text());check('rendered versus raw provenance',f['webToolResponse']['rawHtmlSha256'] is None and f['webToolResponse']['utf8Bytes']==29400)
allowed=[str(ev.relative_to(root))+'/', 'docs/coordination/tasks/CODEX-ACTION-HOST-PILOT-ADDENDUM-20261013.md','docs/coordination/reports/CODEX-ACTION-HOST-PILOT-ADDENDUM-20261013.md']
changes=[x.split('\t') for x in git('diff','--name-status',base,'HEAD').decode().splitlines()]
check('all additions exclusively owned',all(s=='A' and any(p.startswith(a) for a in allowed) for s,p in changes))
check('no production/source delta',not git('diff','--name-only',base,'HEAD','--','apps','packages','scripts'))
result={'base':base,'head':git('rev-parse','HEAD').decode().strip(),'sealedPilot':sealed,'originalEntriesPreserved':len(git('ls-tree','-r','--name-only',base).splitlines()),'passed':sum(x['passed'] for x in checks),'total':len(checks),'checks':checks}
(ev/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(result['passed'],result['total'])
raise SystemExit(0 if result['passed']==result['total'] else 1)
