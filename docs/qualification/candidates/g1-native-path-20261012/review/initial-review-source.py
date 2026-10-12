"""Independent frozen-source review. Only stdlib parsing and read-only Git calls.
Never imports project entries, creates sockets, or invokes proposed runtime commands.
"""
import ast
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import subprocess

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
ORIGINAL='72f228b32257acd25c81e74674d5231aac7087d8'
REPAIRED='f3db1505cbd2987244875097712d78a69da190c3'
PR16='e8d2c0d0e5db8fb01ba2df26c4eb3f79b296c0b5'
PR15='14be9fc614568a74133b89f2b229e50c9b030322'
FROZEN='8e50b8b7efeed2a9b251ad5658b58934246f16a4'
PLAN='docs/plans/MERI-G1-SOURCE-TO-NATIVE.md'
P='docs/qualification/candidates/g1-native-path-20261012/integration/'
checks=[]; observed=[]
def git(*args):
    p=subprocess.run(['git',*args],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=10,check=False)
    if len(p.stdout)>2*1024*1024 or len(p.stderr)>65536: raise RuntimeError('READ_OUTPUT_BOUND')
    return p

def blob(ref,path):
    p=git('show',ref+':'+path)
    if p.returncode:raise RuntimeError('READ_FAILED:'+path)
    return p.stdout

def text(ref,path):return blob(ref,path).decode()
def obj(ref,path):return json.loads(blob(ref,path))
def sha(raw):return hashlib.sha256(raw).hexdigest()
def ck(name,value):checks.append({'name':name,'passed':bool(value)})
def ancestor(a,b):return git('merge-base','--is-ancestor',a,b).returncode==0
plan=text(REPAIRED,PLAN);original=text(ORIGINAL,PLAN)
ck('original-single-parent-PR16',git('show','-s','--format=%P',ORIGINAL).stdout.decode().strip()==PR16)
ck('repair-single-parent-original',git('show','-s','--format=%P',REPAIRED).stdout.decode().strip()==ORIGINAL)
ck('repair-only-plan',git('diff','--name-only',ORIGINAL,REPAIRED).stdout.decode().splitlines()==[PLAN])
ck('original-allocation-only',set(git('diff','--name-only',PR16,ORIGINAL).stdout.decode().splitlines())=={PLAN,'docs/coordination/tasks/MERI-G1-NATIVE-PATH-20261012.md',P+'pr-stack-observation.json',P+'pr-stack-ancestry.json',P+'plan-link-check.json'})
ck('original-label-defect-confirmed','L3/N2/N4' in original)
ck('repair-exact-phase-labels','L3/N2/N4' not in plan and all(x in plan for x in ('T1_TEMPORAL_NATIVE_DESIGN','N2_TASK_A_B','N3_OFFICE','N4_BROWSER_RENDERER')))
obs=obj(ORIGINAL,P+'pr-stack-observation.json');ancestry=obj(ORIGINAL,P+'pr-stack-ancestry.json')
ck('eight-expected-PRs',[x['number'] for x in obs['rows']]==[7,10,11,12,13,14,15,16])
ck('all-dated-open-draft-unmerged',all(x['state']=='open' and x['draft'] and not x['merged'] for x in obs['rows']))
ck('no-execution-authority-readback',not obs['executionAuthority'] and not ancestry['mergePerformed'])
for i,row in enumerate(obs['rows']):
    a=ancestry['rows'][i]; head=row['head_sha'];base=row['base_sha']
    actualtree=git('rev-parse',head+'^{tree}').stdout.decode().strip()
    ck('PR'+str(row['number'])+'-ancestry',ancestor(base,head))
    ck('PR'+str(row['number'])+'-exact-record',a['pr']==row['number'] and a['base']==base and a['head']==head and a['tree']==actualtree and a['ancestorExit']==0)
    if i:ck('PR'+str(row['number'])+'-adjacent-base',base==obs['rows'][i-1]['head_sha'] and row['base']==obs['rows'][i-1]['head'])
    ck('PR'+str(row['number'])+'-in-plan',head in plan)
ck('PR2-already-ancestral',ancestor('65d9c750639e0d370985827983f24019a3f585ab',obs['rows'][0]['head_sha']))
ck('PR8-PR9-not-feature-stack',all(x['number'] not in (2,8,9) for x in obs['rows']) and 'evidence-only' in plan and 'preserves candidates/handover' in plan)
oldlinks=obj(ORIGINAL,P+'plan-link-check.json')
ck('original-link-receipt-hash-valid',oldlinks['planSha256']==sha(original.encode()))
links=[]
for link in re.findall(r'\]\(([^)]+)\)',plan):
    if '://' in link:continue
    rel=(ROOT/PLAN).parent.joinpath(link).resolve().relative_to(ROOT).as_posix()
    exists=git('cat-file','-e',REPAIRED+':'+rel).returncode==0
    links.append({'link':link,'resolvedPath':rel,'existsAtRepairedFreeze':exists})
    ck('link:'+link,exists)
ck('link-count13',len(links)==13)
# Freeze preservation. Recheck source inventory against PR15, not changed PR16 files.
fdir='docs/qualification/candidates/g1-execution-options-20261012/author/'
files=git('ls-tree','-r','--name-only',FROZEN,'--',fdir,'docs/coordination/reports/MERI-G1-EXECUTION-OPTIONS-20261012.md').stdout.decode().splitlines()
ck('earlier-packet14files',len(files)==14)
for path in files:ck('frozen:'+path,blob(FROZEN,path)==blob(REPAIRED,path))
inv=obj(FROZEN,fdir+'source-evidence.json')
for row in inv['files']:ck('PR15-source:'+row['path'],len(blob(PR15,row['path']))==row['bytes'] and sha(blob(PR15,row['path']))==row['sha256'])
cat=obj(PR16,'packages/contracts/retrieval-0.2/catalog.json')
ck('139-96-43',len(cat['originals'])==139 and Counter(x['disposition'] for x in cat['originals'])==Counter(selected=96,deferred=43))
ck('14bound82unmapped',Counter(x['state'] for x in cat['originals'])==Counter(mapped=14,pending=82,deferred=43))
ck('14all-unavailable',len(cat['operations'])==14 and all(x['handler'] is None and x['availability']=='unimplemented' and x['qualification']=='pending' for x in cat['operations']))
ck('no-catalog-or-public-contract-change',not git('diff','--name-only',PR15,REPAIRED,'--','packages/contracts').stdout)
ck('no-lock-migration-or-recipe-changes',not git('diff','--name-only',PR15,REPAIRED,'--','**/package-lock.json','**/migrations/*.sql','**/Dockerfile','**/component-pins.json').stdout)
canonical=obj(PR16,'docs/qualification/candidates/ubuntu-source-assessment-20261012/author/obligations-54.json')
functions=obj(PR16,'docs/qualification/candidates/ubuntu-source-assessment-20261012/author/package-function-assessment.json')
ck('54-obligations-preserved',len(canonical['rows'])==54 and all(x['candidateDisposition']=='OPEN' for x in canonical['rows']))
ck('54-cohorts',Counter(x['cohort'] for x in canonical['rows'])==Counter(CURRENT_47=47,OLDER_FIVE=5,HISTORICAL_OMITTED_TWO=2))
ck('35functions-preserved',len(functions['directMappings'])==35)
ck('image-nonwaivable',all(x in plan for x in ('No complete supported patched composition is established','Approval cannot waive missing evidence','No build/push/launch is authorized','8d1ec09aa78f47a11019089dacde93289fc66a39f55bd4357e59eeb25d9b52ac')))
execution=obj(PR16,fdir+'execution-plan.json');local=next(x for x in execution['phases'] if x['id']=='L1_DISPOSABLE_STATE')
ck('frozen-L1-not-authorized',execution['executionAdmission']=='NOT_EXECUTABLE' and not execution['permissionGranted'])
ck('only-L1-first-permission',[x['id'] for x in execution['phases'] if x['includedInFirstPermissionProposal']]==['L1_DISPOSABLE_STATE'])
ck('PG-original-envelope',local['budget']['totalWorkSeconds']==720 and local['budget']['totalCleanupCutoffSeconds']==900 and local['budget']['attemptsPerCommand']==1)
ck('PG-zero-provider-cloud',local['budget']['providerCalls']==0 and local['budget']['providerUsd']==0 and local['budget']['newCloudResources']==0)
ck('PG-two-DBowners',len(local['resources']['testRoles'])==2 and local['resources']['maximumAdditionalTlsListeners']==2 and local['resources']['transientNegativeBoundSockets']==1)
ck('PG-identity-auth-cleanup-plan',all(x in plan for x in ('system_identifier','PID plus OS creation identity','empty schemas','no untrusted local peers','reject other TCP/socket access','verify process and PostgreSQL/TLS listener absence','UNKNOWN remains HOLD')))
py=text(PR16,'apps/proxy/qualification/test/test_postgres_state.py');tree=ast.parse(py)
methods={c.name:sum(isinstance(n,ast.FunctionDef) and n.name.startswith('test_') for n in c.body) for c in tree.body if isinstance(c,ast.ClassDef)}
ck('Python-exact20plus3',methods=={'PricingTests':3,'PostgresTests':20})
ck('Python-migration-order-reset','cls.store.migrate_new_database();cls.store.migrate_tool_budget()' in py and 'TRUNCATE meri_qualification.tool_reservations' in py)
ingress=text(PR16,'apps/control/qualification-sdk-fixture/service/test/registry-ingress.test.mjs')
ck('SDK-first-migration-two-listeners','await store.migrateNewDatabase()' in ingress and ingress.count('= await start(')==2)
for file,count in [('state/test/registry.test.mjs',6),('state/test/revocation-postgres.test.mjs',3),('service/test/registry-ingress.test.mjs',1)]:
    ck('test-count:'+file,len(re.findall(r'^test\(',text(PR16,'apps/control/qualification-sdk-fixture/'+file),re.M))==count)
recovery=text(PR16,'apps/control/qualification-temporal/recovery-activities.mjs');workflow=text(PR16,'apps/control/qualification-temporal/recovery-workflow.ts')
ck('Temporal-exact-owner',all(x in recovery for x in ('control.registry.readPublication','verifyRetirement({ producer','control.registry.replaceRun','DENIED_STALE_BINDING','encodeFixtureRequest','decodeFixtureResponse','control.stopRun','completeRecoveryCheckpoint: false, sessionStoreQualified: false')))
ck('Temporal-one-shot-and-unknown',all(x in recovery for x in ("let state = 'NOT_STARTED', attempted = false",'FixtureRecoveryUncertain','nonRetryable: true')) and "cause.type === 'FixtureRecoveryUncertain'" in workflow and 'maximumAttempts: 1' in workflow)
ck('Temporal-separate-new-entry',git('cat-file','-e',PR15+':apps/control/qualification-temporal/recovery-workflow.ts').returncode!=0 and 'illustrative workflow and its fixed approval activity are not authorization' in text(PR16,'apps/control/qualification-temporal/README.md'))
ck('Temporal-old-example-not-rewritten',blob(PR15,'apps/control/qualification-temporal/activities.ts')==blob(PR16,'apps/control/qualification-temporal/activities.ts') and blob(PR15,'apps/control/qualification-temporal/workflow.ts')==blob(PR16,'apps/control/qualification-temporal/workflow.ts'))
ck('Temporal-real-runtime-gap-retained',all(x in plan for x in ('Actual retirement provider','managed Worker/server/topology','durable unknown-outcome reconciliation','process-local one-shot state is not durable recovery')))
owned=text(PR16,'apps/worker/qualification/probes/owned-probe-child.mjs');runtime=text(PR16,'apps/worker/qualification/probes/runtime.mjs')
ck('worker-shared-child-owner',"from './owned-probe-child.mjs'" in runtime and 'runOwnedProbeChild' in runtime and 'defaultProbeGroup' in owned)
ck('physical-gates-retained',all(x in plan for x in ('Physical descendants absent','browser AND renderer','physical A retirement','No new RDS','provider calls/spend remain zero')))
# Last phrase is tested exactly as written; evidence controls fail rather than rewrite source to suit them.
ck('policy-choice-documented','policy choice approved by Neo' in text(PR16,'docs/decisions/MEMORY-ADMIN-SELF-APPROVAL-20261012.md') and 'wording API makes no authorization decision' in plan)
ck('private-evidence-distinction',all(x in plan for x in ('It has not independently materialized the ZIP','current bytes cannot establish what ran historically','Exact supporting JSON/member listing has been requested','all admission flags false')))
ck('native-and-paid-holds',all(x in plan for x in ('G1 OPEN','G2–G7 unentered','No proposed diagnostic, interpreter, wrapper or collector is executed','reconcile the historical aggregate$10 allowance','no new RDS/network/database changes')))
result={'schema':'meri-independent-native-plan-review/1','originalCommit':ORIGINAL,'repairedCommit':REPAIRED,'PR16':PR16,'planSha256':sha(plan.encode()),'checks':len(checks),'passed':sum(x['passed'] for x in checks),'failed':[x['name'] for x in checks if not x['passed']],'nativeCommandsExecuted':False,'reviewScope':'Frozen source/documents, read-only Git and stdlib AST/data checks; not runtime acceptance','checksDetail':checks,'repairedPlanLinks':links,'limitations':['GitHub open/draft/unmerged statuses are dated connector observations; no fresh remote refresh performed.','Private wrapper/ZIP/supporting JSON not independently read by this reviewer. Plan attributes current metadata to parent/root and retains HOLD; independent supervisor review is separate.','No production/source/native test or proposed command executed.']}
print(json.dumps(result,indent=2))
raise SystemExit(0 if not result['failed'] else 1)
