from pathlib import Path
import hashlib,json,subprocess,sys
root=Path(__file__).resolve().parents[5];base='61ffc8f2487a010c9baba0c8e18088b42569d90a';candidate=sys.argv[1]
def git(*a):return subprocess.check_output(['git',*a],cwd=root)
def tree(r):
 out={}
 for row in git('ls-tree','-rz',r).split(b'\0'):
  if row:
   meta,path=row.split(b'\t');out[path.decode()]=meta.decode()
 return out
def blob(p,r=candidate):return git('show',r+':'+p)
checks=[]
def check(n,b):checks.append({'name':n,'pass':bool(b)})
a,b=tree(base),tree(candidate)
for p,v in a.items():check('preserved:'+p,b.get(p)==v)
allowed='docs/qualification/candidates/action-host-20261013/pilot-addendum/'
for p in b.keys()-a.keys():check('allocated:'+p,p.startswith(allowed) or p in ['docs/coordination/tasks/CODEX-ACTION-HOST-PILOT-ADDENDUM-20261013.md','docs/coordination/reports/CODEX-ACTION-HOST-PILOT-ADDENDUM-20261013.md'])
pilot='docs/qualification/candidates/action-host-20261013/pilot/'
m=json.loads(blob(pilot+'manifest.json'))
for row in m['members']:
 v=blob(row['path']);check('sealed-original:'+row['path'],len(v)==row['bytes'] and hashlib.sha256(v).hexdigest()==row['sha256'])
v=json.loads(blob(pilot+'revised-pilot.json'));check('36-operations',v['limits']['providerHttpOperationsTotal']==36);check('18-inference',v['limits']['inferenceAttemptsTotal']==18);check('18-counts',v['limits']['countTokensAttemptsTotal']==18);check('unapproved-ceiling',v['costing']['proposedInferenceApprovalCeilingUsd']=='0.75' and v['spendAuthorized'] is False);check('account-rates-unverified',v['costing']['accountPricesVerified'] is False);check('provider-executions-zero',v['executedProviderCalls']==0)
report={'base':base,'candidate':candidate,'originalEntries':len(a),'originalChanged':sum(b.get(p)!=v for p,v in a.items()),'addedPaths':sorted(b.keys()-a.keys()),'checks':len(checks),'passed':sum(c['pass'] for c in checks),'failed':[c for c in checks if not c['pass']],'providerApiActions':0};print(json.dumps(report,indent=2));raise SystemExit(bool(report['failed']))
