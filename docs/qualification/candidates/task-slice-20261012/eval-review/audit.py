"""Independent Git-only source/preservation audit; never imports candidate code."""
from pathlib import Path
import subprocess,json,hashlib,sys
root=Path(__file__).resolve().parents[5]
base='77cedb126d57a0223d2df42ad2f3fe988eb51759'
source=sys.argv[1]
def git(*a):return subprocess.check_output(['git',*a],cwd=root)
def tree(ref):
 result={}
 for row in git('ls-tree','-rz',ref).split(b'\0'):
  if row:
   meta,path=row.split(b'\t',1);result[path.decode()]=meta.decode()
 return result
original,current=tree(base),tree(source)
checks=[]
def check(name,condition,details=None):checks.append({'name':name,'passed':bool(condition),'details':details})
changed=[p for p,v in original.items() if current.get(p)!=v]
check('all original mode/blob entries exact',not changed,{'originalCount':len(original),'differences':changed})
added=[p for p in current if p not in original]
allowed=('evals/task-lookup/','docs/qualification/candidates/task-slice-20261012/eval-author/')
exact={'docs/coordination/tasks/CODEX-TASK-LOOKUP-EVAL-20261012.md','docs/coordination/reports/CODEX-TASK-LOOKUP-EVAL-20261012.md'}
check('source additions stay in exclusive author paths',all(p.startswith(allowed) or p in exact for p in added),added)
for path in ['evals/retrieval-r2/manifest.json','docs/ROUTING-EVALUATION.md','docs/coordination/r2/gates.json','docs/plans/MERI-DEPLOYMENT.md','packages/contracts/meri.schema.json','packages/contracts/validate.mjs']:
 check('baseline immutable '+path,current.get(path)==original[path])
m=json.loads(git('show',source+':evals/retrieval-r2/manifest.json'))
check('canonical real corpus remains zero',m['realRequestsReceived']==0 and m['caseIds']==[] and m['results'] is None)
check('seed75 expanded200 preserved',m['realSeedMinimum']==75 and m['expandedCasesMinimum']==200)
check('optional components disabled',m['optionalDecisions']=='DISABLED' and m['optionalJev']=='DISABLED')
rows=[]
for p in added:
 if p.startswith('evals/task-lookup/'):
  data=git('show',source+':'+p);rows.append({'path':p,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'modeBlob':current[p]})
check('actual new tooling source present',any(p.endswith('/corpus.mjs') for p in added) and any(p.endswith('/score.mjs') for p in added))
out={'base':base,'source':git('rev-parse',source).decode().strip(),'tree':git('rev-parse',source+'^{tree}').decode().strip(),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks,'sourceFiles':rows,'scope':'SOURCE_METADATA_ONLY'}
print(json.dumps(out,indent=2))
raise SystemExit(0 if all(c['passed'] for c in checks) else 1)
