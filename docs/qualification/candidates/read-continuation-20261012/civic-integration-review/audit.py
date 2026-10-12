"""Offline exact Git/file correspondence; no private repository or runtime access."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[5]
E=Path(__file__).resolve().parent
BASE='c1c9bfde7dd466a0474589a224a99b44277adbc9'
CANDIDATE=sys.argv[1]
checks=[]
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def blob(ref,path):return git('show',f'{ref}:{path}')
def digest(data):return hashlib.sha256(data).hexdigest()
def check(name,actual,expected=True):
 checks.append({'name':name,'passed':actual==expected,'actual':actual,'expected':expected})
def tree(ref):
 return {entry.split(b'\t',1)[1].decode():entry.split(b'\t',1)[0].decode() for entry in git('ls-tree','-rz',ref).split(b'\0') if entry}
base,candidate=tree(BASE),tree(CANDIDATE)
check('PR30 ancestor',subprocess.run(['git','merge-base','--is-ancestor',BASE,CANDIDATE],cwd=ROOT).returncode,0)
manifest=json.loads(blob(CANDIDATE,'docs/qualification/candidates/read-continuation-20261012/civic-integration/test-expectation-updates.json'))
previous=json.loads(blob(BASE,'docs/qualification/candidates/read-continuation-20261012/reference-integration/test-expectation-updates.json'))
expected_tests={x['path'] for x in previous['changes']}|{'packages/contracts/test/retrieval-reference-integration-independent.test.mjs'}
check('exact16 old-test allowlist',sorted(x['path'] for x in manifest['changes']),sorted(expected_tests))
canonical={'packages/contracts/retrieval-0.2/'+name for name in ['catalog.json','catalog-validation.mjs','validate.mjs']}
changed=sorted(p for p,entry in base.items() if candidate.get(p)!=entry)
check('only canonical3 and16 old expectations change',changed,sorted(canonical|expected_tests))
for row in manifest['changes']:
 path=row['path']; old=blob(BASE,path);new=blob(CANDIDATE,path);text=old.decode()
 check('test before hash '+path,digest(old),row['beforeSha256']);check('test after hash '+path,digest(new),row['afterSha256'])
 for r in row['replacements']:
  check('replacement count '+path+' '+r['old'],text.count(r['old']),r['count']);text=text.replace(r['old'],r['new'])
 check('complete test correspondence '+path,text.encode()==new)
freezes=json.loads(blob(CANDIDATE,'docs/qualification/candidates/read-continuation-20261012/civic-integration/candidate-freezes.json'))
expected_families={'state-status-votes','regulatory-dockets','tenant-contacts','entity-candidates','tracked-bills','intelligence-summary'}
check('six reviewed families',set(x['family'] for x in freezes['families'])==expected_families)
check('no pending family',freezes.get('unintegratedPendingReview'),[])
for family in freezes['families']:
 name=family['family']; source=family['source'];check(name+' runtime not accepted',family.get('runtimeAccepted'),False)
 check(name+' source tree',git('rev-parse',source+'^{tree}').decode().strip(),family['sourceTree'])
 check(name+' independent review object',len(git('rev-parse',family['review']).decode().strip()),40)
 paths=['packages/contracts/retrieval-0.2/'+name+suffix for suffix in ['-validation.mjs','.schema.json']]
 if name=='state-status-votes':paths.append('packages/contracts/retrieval-0.2/state-bill-identity.mjs')
 for path in paths:
  exact=family.get('rootRepair',source) if name=='tenant-contacts' else source
  check('accepted source bytes '+path,blob(CANDIDATE,path)==blob(exact,path))
 if name=='tenant-contacts':
  check('contact repair accepted',family.get('repairReviewPending'),False)
  check('contact repair review object',len(git('rev-parse',family['repairReview']).decode().strip()) if family.get('repairReview') else None,40)
for path in ['packages/contracts/test/retrieval-civic-integration-independent.test.mjs']:
 check('frozen reviewer controls tracked',path in tree('HEAD'))
sourcefiles={p:digest(blob(CANDIDATE,p)) for p in candidate if p.startswith('packages/contracts/retrieval-0.2/') and (p not in base or p in canonical)}
result={'base':BASE,'candidate':CANDIDATE,'candidateTree':git('rev-parse',CANDIDATE+'^{tree}').decode().strip(),'checkCount':len(checks),'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'baseFileCount':len(base),'unchangedOriginalFiles':len(base)-len(changed),'changedOriginalPaths':changed,'sourceFiles':sourcefiles,'checks':checks,'scope':'OFFLINE_SOURCE_CORRESPONDENCE_NO_RUNTIME_ACCEPTANCE'}
(E/'audit-results.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['checks','sourceFiles']}))
for c in checks:
 if not c['passed']:print(json.dumps(c))
raise SystemExit(result['failed']!=0)
