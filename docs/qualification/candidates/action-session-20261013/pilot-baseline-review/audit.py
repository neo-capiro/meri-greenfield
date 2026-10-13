"""Offline source preservation and receipt audit; no target imports."""
from pathlib import Path
import hashlib,json,subprocess,sys
BASE='658bb5c0f8c47b80904cbc5c7453b3f8c3dba79c'
CANDIDATE=sys.argv[1]
checks=[]
def check(n,v,d=None):checks.append({'name':n,'passed':bool(v),'detail':d})
def blob(ref,path):return subprocess.check_output(['git','show',ref+':'+path])
def tree(ref):return {r.split(b'\t',1)[1].decode():r.split(b'\t',1)[0].decode() for r in subprocess.check_output(['git','ls-tree','-r','-z',ref]).split(b'\0') if r}
a,b=tree(BASE),tree(CANDIDATE);changed=[p for p,v in a.items() if b.get(p)!=v];added=sorted(set(b)-set(a))
check('all-original-files-exact',not changed,{'originals':len(a),'changed':changed})
allowed=('evals/action-followthrough/local-baseline/','docs/qualification/candidates/action-session-20261013/pilot-baseline-author/')
names={'docs/coordination/tasks/CODEX-ACTION-PILOT-BASELINE-20261013.md','docs/coordination/reports/CODEX-ACTION-PILOT-BASELINE-20261013.md'}
check('author-exclusive-additions',all(p.startswith(allowed) or p in names for p in added),added)
run=blob(CANDIDATE,'evals/action-followthrough/local-baseline/run.mjs').decode();cli=blob(CANDIDATE,'evals/action-followthrough/local-baseline/cli.mjs').decode()
check('actual-demo-import','apps/control/action-application/local/demo.mjs' in run)
check('actual-public-receiver','packages/contracts/dist/action-application.mjs' in run and 'receiveActionResponse(route,response.status,raw)' in run)
check('canonical-lifetime-reuse','packages/runtime/operation-lifetime.mjs' in run and 'cleanup.run' in run)
check('no-approval-call','.approve(' not in run)
check('single-create-site',run.count('createDemo({mode,ttlMs:10000})')==1)
check('six-denominator','caseCount:6' in run and 'results.push(row)' in run and "for(const c of gold.cases)" in run)
check('gold-import','local-application-20261013/pilot/cases.json' in run)
check('zero-model-human-native-claims','qualifiedRealRequests:0,modelCalls:0,providerCalls:0,nativeDatabase:false' in run)
check('bounded-local-receipt','MAX_BYTES=262144' in run and "BASELINE_OUTPUT_LIMIT" in run)
check('cli-help-before-graph',cli.index("args[0]==='--help'")<cli.index("await import('./run.mjs')"))
check('cli-argument-refusal',"BASELINE_ARGUMENTS" in cli and 'return 2;' in cli)
check('cli-inert-import',"if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)" in cli)
check('fixed-route-allowlist',"['query','draft','prepare','execute']" in run)
source=[]
for p in added:
 if p.endswith('.mjs'):
  raw=blob(CANDIDATE,p);source.append({'path':p,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
gold='docs/qualification/candidates/local-application-20261013/pilot/cases.json';goldBytes=blob(BASE,gold)
check('exact-accepted-pilot',goldBytes==blob('a20f1a2dea79a19fdd17c3485a9448db478dd080',gold))
result={'candidate':CANDIDATE,'base':BASE,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks,'sourceIdentities':source,'goldSha256':hashlib.sha256(goldBytes).hexdigest(),'nativeRuntimeAccepted':False}
print(json.dumps(result,indent=2));raise SystemExit(bool(result['failed']))
