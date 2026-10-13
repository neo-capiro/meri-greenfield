#!/usr/bin/env python3
"""Offline metadata/protocol/preservation checks; no imports of private code."""
import hashlib,json,pathlib,subprocess
P=pathlib.Path(__file__).resolve().parent
ROOT=P.parents[4]
checks=[]
def check(name,value):
 checks.append({'name':name,'passed':bool(value)})
def git(root,*args):return subprocess.check_output(['git','-C',str(root),*args],stderr=subprocess.PIPE)
a=json.loads((P/'reference-identities.json').read_text())
for r in a['references']:
 repo=a['repositories'][r['repository']]
 raw=git(repo['path'],'show',r['commit']+':'+r['path'])
 check(r['id']+':identity',len(raw)==r['bytes'] and hashlib.sha256(raw).hexdigest()==r['sha256'] and git(repo['path'],'rev-parse',r['commit']+':'+r['path']).decode().strip()==r['blob'])
 check(r['id']+':locators',all(1<=x['firstLine']<=x['lastLine']<=len(raw.splitlines()) for x in r['locators']))
p=json.loads((P/'proposed-protocol.json').read_text())
check('proposal-not-current-route',p['status']=='PROPOSED_CAPIRO_OWNER_IMPLEMENTATION_REQUIRED' and p['qualification']['existingEndpoint'] is False)
check('identity-no-caller-authority',p['identity']['request']=={})
check('context-closed-selectors',p['context']['requestFields']==['identitySha256','conversationId','clientId'])
check('fresh-principal-and-revision',all(x in p['context']['responseFields'] for x in ['principal','identityRevision','identitySha256']))
check('context-no-mero-run-fields',not(set(p['context']['responseFields']) & set(['runId','attemptId','workerId','writerFence','scopes','approval'])))
check('all-full-binding-fields-owned-by-meri',p['meriJoin']['bindingFields']==['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence'])
check('current-session-required-not-claimed',p['qualification']['instantClerkSessionRevocation']=='REQUIRED_FOR_BRIDGE_NOT_IMPLEMENTED_BY_TRACED_VERIFIER')
base='ad0bdfeb830fee11f1f39c4a8a7037215595c4cf'
check('tracked-source-preserved',not git(ROOT,'diff','--name-only',base,'--','apps','packages','scripts','evals').strip())
check('all-original-tracked-files-preserved',not git(ROOT,'diff','--name-only',base,'--diff-filter=MD').strip())
allowed=['docs/coordination/reports/CODEX-CAPIRO-APPLICATION-AUTHORITY-REQUEST-20261013.md','docs/qualification/candidates/application-adapters-20261013/capiro-boundary/']
paths=git(ROOT,'ls-files','--others','--exclude-standard').decode().splitlines()+git(ROOT,'diff','--name-only',base).decode().splitlines()
check('all-changes-in-allocated-docs',all(any(x==prefix or x.startswith(prefix) for prefix in allowed) for x in paths))
check('no-runtime-or-private-bodies',a['runtimeExecuted'] is False and a['privateBodiesRetained'] is False)
result={'kind':'offline-source-metadata-and-boundary-audit','checks':checks,'passed':sum(c['passed'] for c in checks),'total':len(checks),'runtimeExecuted':False}
(P/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':result['passed'],'total':result['total'],'failed':[c['name'] for c in checks if not c['passed']]}))
raise SystemExit(0 if result['passed']==result['total'] else 1)
