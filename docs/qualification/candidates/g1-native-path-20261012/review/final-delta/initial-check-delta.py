"""Narrow frozen roadmap/source review; read-only Git and stdlib only."""
import ast
import hashlib
import json
from pathlib import Path
import re
import subprocess
ROOT=Path(__file__).resolve().parents[6]
OLD='f3db1505cbd2987244875097712d78a69da190c3'
NEW='c60bc58092c9ed34f2c5d718afe4d678f6cf79d4'
PLAN='docs/plans/MERI-G1-SOURCE-TO-NATIVE.md'
NATIVE='a9d5d849fe3065ee1aec2b17806e6b6219a511c7'
PACKET='724850cb6cc84c8381fb52aec23b582e0e3b5872'
NREVIEW='c7a6b079feb0b4e57310d8068ab106347fa3c24f'
BUDGET='ea7b0bae9b630f750f7f329a144f3cc34f959b00'
BREVIEW='ea5fe073513ab49ae61d9c291ccd11ff3803b32b'
checks=[];sources=[]
def git(*args):
 p=subprocess.run(['git',*args],cwd=ROOT,capture_output=True,timeout=10,check=False)
 if len(p.stdout)>2097152 or len(p.stderr)>65536:raise RuntimeError('SOURCE_READ_BOUND')
 return p

def raw(ref,path):
 p=git('show',ref+':'+path)
 if p.returncode:raise RuntimeError('SOURCE_READ_FAILED:'+path)
 return p.stdout

def source(ref,path):
 b=raw(ref,path);sources.append({'ref':ref,'path':path,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()});return b.decode()
def ck(name,passed):checks.append({'name':name,'passed':bool(passed)})
old=source(OLD,PLAN);plan=source(NEW,PLAN)
ck('exact-integrated-tree',git('rev-parse',NEW+'^{tree}').stdout.decode().strip()=='f46871502fbf61612a2193708dc441fd153034af')
ck('narrow-plan-delta8plus2',git('diff','--numstat',OLD,NEW,'--',PLAN).stdout.decode().strip().split('\t')[:2]==['8','2'])
for ref in [OLD,NATIVE,PACKET,NREVIEW,BUDGET,BREVIEW]:ck('accepted-ancestry:'+ref,git('merge-base','--is-ancestor',ref,NEW).returncode==0)
np='docs/qualification/candidates/native-supervisor-20261012/author/'
for f in ['run-supervised.py','supervision.py','source-checks.py']:
 ck('native-source-exact:'+f,raw(NEW,np+f)==raw(NATIVE,np+f))
for f in ['postgres-budget.integration.mjs','postgres-budget-native-fixture.mjs','postgres-budget-child.mjs','postgres-budget-admission.test.mjs']:
 ck('budget-source-exact:'+f,raw(NEW,'apps/gateway/test/'+f)==raw(BUDGET,'apps/gateway/test/'+f))
wrapper=source(NEW,np+'run-supervised.py');lifecycle=source(NEW,np+'supervision.py');tree=ast.parse(wrapper)
fun=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='run_supervised')
body=ast.get_source_segment(wrapper,fun)
ck('clock-at-function-entry',isinstance(fun.body[1],ast.Assign) and ast.unparse(fun.body[1].value)=='lifecycle.Budget(time.monotonic)')
ck('immutable-missing-pins',all(x in wrapper for x in ['SOURCE_VERIFICATION_SHA256 = None','PRIOR_MANIFEST_SHA256 = None','GIT_EXECUTABLE = None','GIT_EXECUTABLE_SHA256 = None','GIT_EXECUTABLE_BYTES = None']))
ck('blocked-before-fs',body.index('HOLD_unresolved_exact_preservation_records')<body.index('fs = inventory.Filesystem()') and body.index('HOLD_unresolved_native_git_identity')<body.index('fs = inventory.Filesystem()'))
ck('publication-and-hard-limit-not-accepted',all(x in wrapper for x in ['"hardTotalProven": False','"evidencePublicationVerified": False','"runtimeAccepted": False','"buildAccepted": False','"g1Accepted": False']))
ck('explicit-executable-and-fresh-slot','return [action["selectedExecutable"], "-I", "-B", "-S"' in wrapper and 'destination.mkdir(exist_ok=False)' in wrapper and 'with (destination / name).open("xb")' in wrapper)
ck('canonical-diagnostic-unchanged',raw(OLD,'docs/qualification/candidates/native-ancestor-diagnosis-20261012/inspect-ancestor-metadata.py')==raw(NEW,'docs/qualification/candidates/native-ancestor-diagnosis-20261012/inspect-ancestor-metadata.py'))
ck('native-read-and-EOF-boundaries','1048577 - count' in wrapper and 'row["observed"] += len(content)' in lifecycle and 'if content == b""' in lifecycle and 'Unknown ownership cannot permit snapshot or close' in lifecycle)
nr=source(NEW,'docs/coordination/reports/MERI-NATIVE-SUPERVISOR-REVIEW-20261012.md')
ck('native-review-limited-accept','**ACCEPT_SOURCE — limited' in nr and 'blocked partial' in nr and NATIVE in nr and PACKET in nr and 'verified\nevidence publication remain HOLD' in nr)
b=source(NEW,'apps/gateway/test/postgres-budget.integration.mjs');helper=source(NEW,'apps/gateway/test/postgres-budget-native-fixture.mjs')
ck('nine-case-source-structure',len(re.findall(r'^test\(',b,re.M))==3 and "for(const phase of ['reserve','settle'])test(" in b and 'for(const sameInvocation of [true,false])test(' in b and 'for(const modelHold of [91,90])test(' in b)
ck('native-name-outside-ordinary-discovery',not 'postgres-budget.integration.mjs'.endswith('.test.mjs') and '// UNRUN real-engine source.' in b)
ck('explicit-admission-before-load','const admission=parseNativeAdmission({...process.env});' in b and b.index('parseNativeAdmission({...process.env})')<b.index('await Promise.all'))
ck('original30s-before-fork-send',all(x in b for x in ['Date.now()+30000','if(Date.now()>=deadline)','groupActive();\n      const child=fork','children.forEach(({child},n)=>{groupActive();child.send(payloads[n]);})']))
ck('child-reservation-clipped','deadlineMs:Math.min(s.reserve.deadlineMs,deadline)' in b)
ck('synthetic-post-commit-loss-labelled',"if(args[0]==='COMMIT'&&loseCommit&&!fired)" in helper and "kind:'synthetic-post-commit-loss'" in helper and 'synthetic lost ${phase} acknowledgement after real COMMIT' in b)
ck('password-and-engine-identity-required',all(x in helper for x in ["typeof c.password !== 'string'",'password:c.password','pg_control_system()',"verifyDatabase(pool,c,{empty=false}"])) and 'verifyDatabase(owner.pool,admission,{empty:true})' in b)
ck('unavailable-gateway-retained','assert.equal(gateway.sourceEnabled,false)' in b and 'await assert.rejects(gateway.execute(requestJson,s.credential,s.invocationJson),/UNAVAILABLE/)' in b)
br=source(NEW,'docs/coordination/reports/MERI-G1-BUDGET-NATIVE-TESTS-REVIEW-20261012.md')
ck('budget-source-only-accept','**ACCEPT_SOURCE_TESTS**' in br and BUDGET in br and '9 UNRUN' in br and 'no outcome/readback or reconciliation API' in br)
unchanged=['docs/qualification/candidates/g1-execution-options-20261012','docs/qualification/candidates/ubuntu-source-assessment-20261012','docs/plans/MERI-DEPLOYMENT.md','packages/contracts','apps/gateway/index.mjs','apps/gateway/budget/postgres-tool-budget.mjs','apps/gateway/budget/postgres-budget-store.mjs','apps/proxy/qualification/state/migrations']
for path in unchanged:ck('frozen-or-production-unchanged:'+path,not git('diff','--name-only',OLD,NEW,'--',path).stdout)
def section(s,start,end):return s.split(start,1)[1].split(end,1)[0]
ck('image-decision-byte-unchanged',section(old,'## Image decision','## First bounded')==section(plan,'## Image decision','## First bounded'))
ck('L1-authority-text-unchanged',section(old,'## First bounded','L1 supplies')==section(plan,'## First bounded','L1 supplies'))
ck('L1-durable-gaps-not-erased',section(old,'L1 supplies','## Subsequent') in section(plan,'L1 supplies','The new [budget test source]'))
ck('no-new-test-action-authority','They do not expand the frozen L1 command set' in plan and 'Every real-engine case remains UNRUN' in plan and 'existing separately admitted `pg_control_system()` read privilege' in plan)
ck('remaining-producer-api-and-restart-gaps',all(x in plan for x in ['no durable outcome/readback API','no real trusted invocation producer','server-restart test/owner composition','verified evidence writer','interpreter startup/imports still need outer coverage']))
ck('critical-path-byte-unchanged',old.split('## Subsequent gates and exact handoff to shipping',1)[1]==plan.split('## Subsequent gates and exact handoff to shipping',1)[1])
links=[]
for link in re.findall(r'\]\(([^)]+)\)',plan):
 if '://' in link:continue
 path=(ROOT/PLAN).parent.joinpath(link).resolve().relative_to(ROOT).as_posix();ok=git('cat-file','-e',NEW+':'+path).returncode==0;links.append({'link':link,'exists':ok});ck('link:'+link,ok)
result={'decision':'ACCEPT_SOURCE_PACKET' if all(x['passed'] for x in checks) else 'HOLD','reviewedCommit':NEW,'previousAcceptedPlan':OLD,'planSha256':hashlib.sha256(plan.encode()).hexdigest(),'checks':len(checks),'passed':sum(x['passed'] for x in checks),'failed':[x['name'] for x in checks if not x['passed']],'runtimeTests':'UNRUN','nativeEntriesImportedOrExecuted':False,'scope':'Narrow roadmap delta; static Git/AST/data only; no repeat of prior183 controls','checksDetail':checks,'sourceIdentities':sources,'links':links}
print(json.dumps(result,indent=2));raise SystemExit(0 if result['decision']=='ACCEPT_SOURCE_PACKET' else 1)
