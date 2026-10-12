"""Final additive join audit. Historical 98-check script and receipts remain immutable."""
from pathlib import Path
import hashlib,json,os,re,subprocess,sys,tempfile
R=Path(__file__).resolve().parents[5];O=Path(__file__).resolve().parent
BASE='e5fb3963de787bbd7b7663316c368f15814897da';CANDIDATE=sys.argv[1]; GENERAL=sys.argv[2]
refs={'commands':'ca506ba1591b35eae5d389e551787017328eea73','portfolio':'62062236e38ac77b9494a04668df6969ab1f33e2','schedules':'d9296aa2db1290091a355c47fb1db3d87ac98665','artifacts':'47aef9f9a58d14a932ddc0b8cfdaf1475a5cb1ae','commandContract':'83d0f5951a5e0c5d86d3a8684c2396b6cf13f794','canonical':'c80260046e33d742811fca6f553af4033eb393bc'}
checks=[]
def check(n,b):checks.append({'name':n,'passed':bool(b)})
def git(*args,env=None):return subprocess.check_output(['git','-C',str(R),*args],env=env)
def blob(ref,p):return git('show',ref+':'+p)
def tree(ref):
 d={}
 for row in git('ls-tree','-r','-z',ref).split(b'\0'):
  if row:
   a,p=row.split(b'\t');d[p.decode()]=a.split()[2].decode()
 return d
old=tree(BASE);new=tree(CANDIDATE)
TEST_SOURCE='2955ec6cfd1b38908cc62d9a1f5a8800bf7f5bdc'
TEST_REVIEW='d19f73649bec835da360265f603c87ef170efb92'
expectationPaths=[
 'apps/gateway/test/action-item-context-independent.test.mjs','apps/gateway/test/capability-next-independent.test.mjs','apps/gateway/test/mail-context-independent.test.mjs','apps/gateway/test/memory-context-independent.test.mjs',
 'packages/contracts/test/backend-execution-expectations.mjs','packages/contracts/test/retrieval-catalog-bindings.test.mjs','packages/contracts/test/retrieval-memory-binding.test.mjs','packages/contracts/test/retrieval-reference-integration-independent.test.mjs','packages/contracts/test/retrieval-selected-next-bindings.test.mjs','packages/contracts/test/retrieval-selected-next-independent.test.mjs']
oldBindings={
 'apps/gateway/authorization/current-tool-authority.mjs':'commands','apps/gateway/budget/postgres-tool-budget.mjs':'commands','apps/gateway/budget/tool-budget-dispatch.mjs':'commands','apps/gateway/index.mjs':'commands','packages/contracts/commands-0.2/artifact-file-validation.mjs':'commands',
 'apps/gateway/dispatch/operation-context.mjs':'portfolio','apps/gateway/sources/memory-proposals/http-adapter.mjs':'portfolio','apps/gateway/sources/memory-proposals/request-context.mjs':'portfolio','packages/contracts/commands-0.2/validate.mjs':'commandContract',
 'packages/contracts/retrieval-0.2/catalog-validation.mjs':'canonical','packages/contracts/retrieval-0.2/catalog.json':'canonical','packages/contracts/retrieval-0.2/validate.mjs':'canonical',
 'packages/contracts/test/command-artifact-file.test.mjs':'commands'}
# Only the separately reviewed finite test continuation supplements the first ten.
continuationPaths=git('diff','--name-only',TEST_SOURCE+'^',TEST_SOURCE,'--','packages/contracts/test').decode().splitlines()
continuationExisting=[p for p in continuationPaths if p in old]
check('accepted continuation has14 further PR37 tests',len(continuationExisting)==14 and not set(continuationExisting)&set(expectationPaths))
expectationPaths+=continuationExisting
for p in continuationPaths:check('accepted test continuation exact '+p,blob(CANDIDATE,p)==blob(TEST_SOURCE,p))
for p in ['packages/contracts/test/vertical-source-expectations.mjs','packages/contracts/test/backend-execution-expectations.mjs']:
 check('initial root helper remains exact '+p,blob(CANDIDATE,p)==blob('7c92f09870496855e968784c30869f185f39250f',p))
check('reviewed original40 canonical controls unchanged',blob(CANDIDATE,'packages/contracts/test/vertical-final-integration-independent.test.mjs')==blob('82afd622cec8713a2b801428ae7f6b580c57b18e','packages/contracts/test/vertical-final-integration-independent.test.mjs'))
changed=[p for p,h in old.items() if new.get(p)!=h]
check('only declared PR37 existing files changed',set(changed)==set(expectationPaths)|set(oldBindings))
check('all other original Git entries exact',all(new.get(p)==h for p,h in old.items() if p not in changed))
identities=[]
def bound(p,ref):
 b=blob(CANDIDATE,p);check('accepted source exact '+p,b==blob(ref,p));identities.append({'path':p,'source':ref,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
for p,kind in oldBindings.items():bound(p,refs[kind])
newProduction=[p for p in new if p not in old and p.startswith(('apps/','packages/')) and '/test/' not in p and '.test.' not in p and not p.endswith('.md')]
newExact={'apps/artifacts/postgres-service.mjs':'a73b65dc05b7554c0592bec22d940ef781344dd6','apps/artifacts/postgres-analysis.mjs':GENERAL,'apps/control/commands/tool-interface.mjs':'d0433f7c7e52e6dbc606a9937f92705a42ac863a'}
for p in newProduction:
 if p in newExact:bound(p,newExact[p]);continue
 if p.startswith(('apps/artifacts/','packages/contracts/artifacts-0.2/')):kind='artifacts'
 elif p.startswith(('apps/control/schedules/','packages/contracts/schedules-0.2/')):kind='schedules'
 elif p.startswith('apps/control/commands/'):kind='commands'
 elif p.startswith('packages/contracts/commands-0.2/tool-interface'):kind='commandContract'
 elif p.startswith('packages/contracts/commands-0.2/'):kind='commands'
 elif p.startswith('packages/contracts/retrieval-0.2/execution-'):kind='canonical'
 elif p.startswith('packages/contracts/retrieval-0.2/research-portfolio-evidence'):kind='portfolio'
 elif p.startswith('apps/gateway/sources/'):kind='portfolio'
 elif p=='apps/gateway/budget/tool-budget-execution.mjs':kind='commands'
 else:check('recognized allocated new production '+p,False);continue
 bound(p,refs[kind])
# Preserve all25 changed original tests, including the previously accepted artifact semantics.
expectationPaths.append('packages/contracts/test/command-artifact-file.test.mjs')
check('exact25 existing PR37 test paths',len(expectationPaths)==25 and len(set(expectationPaths))==25)
# Independently restore their complete historical bytes in an isolated index.
forward=git('diff','--binary',BASE,CANDIDATE,'--',*expectationPaths);inverse=git('diff','--binary',CANDIDATE,BASE,'--',*expectationPaths)
(O/'final-test-expectation-reviewed-forward.patch').write_bytes(forward);(O/'final-test-expectation-reviewed-inverse.patch').write_bytes(inverse)
fd,index=tempfile.mkstemp(prefix='meri-vertical-final-index-',dir='/tmp');os.close(fd);os.unlink(index)
env={**os.environ,'GIT_INDEX_FILE':index}
try:
 git('read-tree',CANDIDATE,env=env)
 subprocess.run(['git','-C',str(R),'apply','--cached','--binary','-'],input=inverse,env=env,check=True,capture_output=True)
 for p in expectationPaths:check('inverse restores full original test '+p,git('show',':'+p,env=env)==blob(BASE,p))
finally:
 if os.path.exists(index):os.unlink(index)
testDeltas=[]
for p in expectationPaths:
 a=blob(BASE,p).decode();b=blob(CANDIDATE,p).decode()
 testCount=lambda s:len(re.findall(r'\btest\s*\(',s))
 assertCount=lambda s:len(re.findall(r'\bassert\s*\.',s))
 check('original test declaration count '+p,testCount(a)==testCount(b))
 check('assertion count retained or enlarged '+p,assertCount(b)>=assertCount(a))
 testDeltas.append({'path':p,'beforeSha256':hashlib.sha256(a.encode()).hexdigest(),'afterSha256':hashlib.sha256(b.encode()).hexdigest(),'testDeclarationsBefore':testCount(a),'testDeclarationsAfter':testCount(b),'assertionsBefore':assertCount(a),'assertionsAfter':assertCount(b)})
# The whole original requirement object must remain exact, not just the counts.
req=json.loads(blob(CANDIDATE,'docs/qualification/candidates/vertical-source-20261012/integration/requirements-continuation.json'))
gov=req['governingSource'];raw=blob(gov['commit'],gov['path']);prior=json.loads(raw)
check('exact governing requirement bytes hash',hashlib.sha256(raw).hexdigest()==gov['sha256'])
check('all53 whole requirement objects retained',[x['governingRequirement'] for x in req['records']]==prior['requirements'])
check('whole runtime requirements not promoted',req['counts']=={'requirements':53,'completedSourceDiscovery':2,'wholePending':51,'wholeRuntimeQualified':0} and all(x['wholeCriterionPromotion'] is False and x['qualifiedRuntime'] is False for x in req['records']))
public=[p for p in old if p.startswith('packages/contracts/dist/') or p in ['packages/contracts/meri.schema.json','packages/contracts/validate.mjs','packages/contracts/package.json','packages/contracts/package-lock.json','package.json','package-lock.json']]
check('all public schemas distribution and dependency files exact',all(new.get(p)==old[p] for p in public))
result={'base':BASE,'candidate':CANDIDATE,'candidateTree':git('rev-parse',CANDIDATE+'^{tree}').decode().strip(),'originalEntries':len(old),'originalEntriesExact':len(old)-len(changed),'changedExisting':changed,'sourceIdentities':identities,'testContinuationSource':TEST_SOURCE,'testContinuationReview':TEST_REVIEW,'generalBudgetSource':GENERAL,'testDeltas':testDeltas,'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'runtimeAccepted':False}
(O/'final-integration-audit-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['candidate','originalEntries','originalEntriesExact','passed','failed','runtimeAccepted']}))
if result['failed']:print(json.dumps([x for x in checks if not x['passed']]))
raise SystemExit(bool(result['failed']))
