"""Offline plan integrity/source checks. No project imports, sockets or processes."""
import ast
from collections import Counter
import hashlib
import json
from pathlib import Path
import re

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
checks=[]
def check(name, condition):
    checks.append({'name':name,'passed':bool(condition)})
def read(path): return (ROOT/path).read_text()
def obj(path): return json.loads(read(path))
def digest(raw): return hashlib.sha256(raw).hexdigest()
plan=json.loads((HERE/'execution-plan.json').read_text())
image=json.loads((HERE/'image-options.json').read_text())
sources=json.loads((HERE/'source-evidence.json').read_text())
manifest=json.loads((HERE/'manifest.json').read_text())
base='14be9fc614568a74133b89f2b229e50c9b030322'
check('exact-base', plan['baseCommit']==image['baseCommit']==sources['baseCommit']==base)
for row in manifest['files']+sources['files']:
    path=ROOT/row['path']
    check('hash:'+row['path'],path.is_file() and len(path.read_bytes())==row['bytes'] and digest(path.read_bytes())==row['sha256'])
check('no-execution-authority',plan['executionAdmission']=='NOT_EXECUTABLE' and not plan['permissionGranted'] and not plan['automaticChaining'] and not plan['allPhasesExecuted'] and not plan['sourceConnectivityEnabled'])
check('all-nine-phases-unrun',len(plan['phases'])==9 and all(x['executionResult']=='UNRUN' for x in plan['phases']))
check('only-L1-first-permission',[x['id'] for x in plan['phases'] if x['includedInFirstPermissionProposal']]==['L1_DISPOSABLE_STATE'])
check('no-new-rds',not plan['existingAuroraSelection']['newRdsAllowed'] and not plan['existingAuroraSelection']['networkOrDatabaseChangeAllowed'] and plan['existingAuroraSelection']['selectedForEventualState'])
check('no-fully-patched-candidate',not image['fullySupportedPatchedSetEstablished'] and not image['recipeChanged'] and image['executionAdmission']=='NOT_EXECUTABLE')
check('old-image-never-launch',image['oldImageNeverLaunch']=='sha256:8d1ec09aa78f47a11019089dacde93289fc66a39f55bd4357e59eeb25d9b52ac')
old=obj(image['canonicalObligations']);functions=obj(image['requiredFunctions']);derived=sources['inheritedObligations']['rows']
check('exact54cohorts',Counter(x['cohort'] for x in old['rows'])==Counter({'CURRENT_47':47,'OLDER_VENDOR_5':5,'HISTORICAL_OMITTED_2':2}))
check('no-obligation-or-severity-loss',[(x['cve'],x['cohort'],x['sourcePackage'],x['severity'],x['nextDependency']) for x in derived]==[(x['cve'],x['cohort'],x['originalSourcePackage'],x['scannerSeverity'],x['nextDependency']) for x in old['rows']])
check('no-row-closure',len(derived)==54 and all(x['candidateDisposition']=='OPEN' for x in derived))
check('all35functions',len(functions['directMappings'])==35 and sources['requiredDirectFunctions']['names']==[x['originalName'] for x in functions['directMappings']])
check('scope-current14plus82',image['scopePreserved']=={'obligations':54,'directFunctions':35,'originalCapabilities':139,'selected':96,'deferred':43,'boundUnavailable':14,'selectedUnmapped':82,'namedSkillsPending':14})
phases={x['id']:x for x in plan['phases']};local=phases['L1_DISPOSABLE_STATE'];host=phases['L2_NATIVE_PROXY_TLS_AUTH']['commandTemplates'][0]['argv']
check('host-no-isolated-import-mode','-I' not in host and host[1]=='-B')
runner=read('apps/proxy/qualification/linux/postgres-fixture/run-fixture.py')
check('host-sibling-imports',all(t in runner for t in ('from config import','from docker_capture import','import native_bootstrap')))
check('host-readme-exact-mode','python3 -B /reviewed/postgres-fixture/run-fixture.py' in read('apps/proxy/qualification/linux/postgres-fixture/README.md'))
check('peer-retains-isolated-mode',"'-I','-B','/run/prisma-peer.py'" in runner)
py=read('apps/proxy/qualification/test/test_postgres_state.py');tree=ast.parse(py)
counts={c.name:sum(isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name.startswith('test_') for n in c.body) for c in tree.body if isinstance(c,ast.ClassDef)}
check('python-real20-pricing3',counts=={'PricingTests':3,'PostgresTests':20})
check('OLD_SITE-appended', 'sys.path.append(' in py and 'repr(str(OLD_SITE))' in py)
check('negative-socket-bound-not-listening',"lease.bind(('127.0.0.1',0))" in py and 'Bound but not listening' in py)
check('migration0001then0002','cls.store.migrate_new_database();cls.store.migrate_tool_budget()' in py)
for filename,count in [('state/test/registry.test.mjs',6),('state/test/revocation-postgres.test.mjs',3),('service/test/registry-ingress.test.mjs',1)]:
    text=read('apps/control/qualification-sdk-fixture/'+filename)
    check('top-tests:'+filename,len(re.findall(r'^test\(',text,re.M))==count)
ingress=read('apps/control/qualification-sdk-fixture/service/test/registry-ingress.test.mjs')
check('ingress-migrates-first','await store.migrateNewDatabase()' in ingress and local['commandTemplates'][1]['argv'][-1].endswith('registry-ingress.test.mjs'))
check('two-ingress-listeners',ingress.count('= await start(')==2 and local['resources']['maximumAdditionalTlsListeners']==2)
check('two-db-role-bindings',[x['name'] for x in local['resources']['testRoles']]==['qualification_owner','qualification_sdk_fixture_owner'])
check('fresh-identity-and-auth',len(local['resources']['identityAdmission'])>=4 and local['resources']['authenticationProposal']['status']=='OWNER_CHOICE_REQUIRED_NOT_CONFIGURED')
check('L1-bounded-zero-provider',local['budget']['attemptsPerCommand']==1 and local['budget']['providerCalls']==0 and local['budget']['newCloudResources']==0 and local['budget']['providerUsd']==0 and local['budget']['incrementalCloudUsd']==0 and local['budget']['totalWorkSeconds']==720 and local['budget']['totalCleanupCutoffSeconds']==900)
check('real-js-engine-gap-retained',len(local['requiredNextSourceTests'])==3 and 'scripted SQL' in ' '.join(local['doesNotProve']))
check('no-cloud-cost-invented',all(x['budget'].get('cloudUsd') is None for x in plan['phases']))
cor=json.loads((HERE/'proposal-corrections.json').read_text())
check('rejected-draft-preserved',digest((HERE/'rejected-draft-execution-plan.json').read_bytes())==cor['rejectedDraftSha256'] and not cor['runtimeCommandsExecuted'])
check('rejected-host-I-retained','-I' in next(x for x in json.loads((HERE/'rejected-draft-execution-plan.json').read_text())['phases'] if x['id']=='L2_NATIVE_PROXY_TLS_AUTH')['commandTemplates'][0]['argv'])
result={'status':'PASS' if all(c['passed'] for c in checks) else 'FAIL','scope':'Offline file/source integrity only; no native/project/runtime execution','checks':len(checks),'failed':[c['name'] for c in checks if not c['passed']], 'baseCommit':base, 'runtimeTests':'UNRUN','permissionGranted':False}
print(json.dumps(result,indent=2))
raise SystemExit(0 if result['status']=='PASS' else 1)
