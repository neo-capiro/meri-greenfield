"""Offline source/gold/receipt audit; no application, provider, model or native call."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[5];ev=Path(__file__).resolve().parent;base='658bb5c0f8c47b80904cbc5c7453b3f8c3dba79c'
def git(*a):return subprocess.check_output(['git',*a],cwd=root)
checks=[]
def check(n,v):checks.append({'name':n,'passed':bool(v)})
paths=['docs/qualification/candidates/local-application-20261013/pilot/cases.json','apps/control/action-application/local/demo.mjs','packages/contracts/dist/action-application.mjs','docs/qualification/candidates/task-slice-20261012/action-source-author/accepted-action-fixture.mjs','docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs','packages/runtime/operation-lifetime.mjs']
pins=[]
for p in paths:
 b=git('show',base+':'+p);current=git('show','HEAD:'+p);check('unchanged dependency '+p,b==current);pins.append({'path':p,'commit':base,'blob':git('rev-parse',base+':'+p).decode().strip(),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
for label in ['initial','focused','cleanup-repair','final-baseline']:
 r=json.loads((ev/(label+'.json')).read_text());check(label+' exit',r['exitCode']==0 and not r['timedOut']);check(label+' cleanup',r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired']);check(label+' source freeze',r['sourceDiffBytes']==0)
 for s in r['streams']:
  b=(root/s['path']).read_bytes();check(label+' '+s['path'].rsplit('.',2)[-2],len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'])
r=json.loads((ev/'final-baseline.stdout.bin').read_text());check('six complete successes',r['caseCount']==r['passed']==6 and r['status']=='PASS' and [x['id'] for x in r['cases']]==['P01','P02','P03','P04','P05','P06'])
check('no approvals or effects',all(x['effects']['taskEffects']==x['effects']['approvals']==0 for x in r['cases']));check('all sessions closed/refused',all(x['cleanup']=={'closed':True,'postCloseStatus':401,'noAdditionalEffects':True} for x in r['cases']))
check('gold bytes correlated',r['casesSha256']==pins[0]['sha256']);check('bounded receipt',(ev/'final-baseline.stdout.bin').stat().st_size<=262144)
check('no model quality/native claim',r['qualifiedRealRequests']==r['modelCalls']==r['providerCalls']==0 and r['nativeDatabase'] is False)
allowed=['evals/action-followthrough/local-baseline/','docs/qualification/candidates/action-session-20261013/pilot-baseline-author/','docs/coordination/tasks/CODEX-ACTION-PILOT-BASELINE-20261013.md','docs/coordination/reports/CODEX-ACTION-PILOT-BASELINE-20261013.md']
changes=[x.split('\t') for x in git('diff','--name-status',base,'HEAD').decode().splitlines()]
check('exclusive additions only',all(s=='A' and any(p.startswith(a) for a in allowed) for s,p in changes));check('no production or schema edit',not git('diff','--name-only',base,'HEAD','--','apps','packages'))
source=(root/'evals/action-followthrough/local-baseline/run.mjs').read_text();check('no approve invocation','.approve(' not in source);check('public receiver used','receiveActionResponse' in source);check('canonical lifetime used','createOperationLifetime' in source)
result={'base':base,'head':git('rev-parse','HEAD').decode().strip(),'originalEntriesPreserved':len(git('ls-tree','-r','--name-only',base).splitlines()),'passed':sum(c['passed'] for c in checks),'total':len(checks),'checks':checks,'sourcePins':pins}
(ev/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(result['passed'],result['total']);raise SystemExit(0 if result['passed']==result['total'] else 1)
