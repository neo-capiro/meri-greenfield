"""Exact test-only candidate and forward/inverse audit; no product execution."""
from pathlib import Path
import hashlib,json,re,subprocess,sys,tempfile
R=Path(__file__).resolve().parents[5];E=Path(__file__).resolve().parent
BASE='1375349a62f4abc036ee091d0d2ebe3a6ec62910'; CANDIDATE=sys.argv[1]
def git(*args):return subprocess.check_output(['git',*args],cwd=R)
def blob(ref,path):return git('show',ref+':'+path)
def tree(ref):
 result={}
 for row in git('ls-tree','-r','-z',ref).split(b'\0'):
  if row:
   key,path=row.split(b'\t',1);result[path.decode()]=key.decode()
 return result
def sha(b):return hashlib.sha256(b).hexdigest()
checks=0;failed=[]
def check(v,label):
 global checks
 checks+=1
 if not v:failed.append(label)
base,current=tree(BASE),tree(CANDIDATE)
paths=json.loads((E/'initial-failure-census.json').read_text())['testPaths'];check(len(paths)==15,'exact15 paths')
for path,value in base.items():
 if path not in paths:check(current.get(path)==value,'untouched:'+path)
changes=sorted(p for p in base if current.get(p)!=base[p]);check(changes==paths,'existing diff exactly15 failing paths')
root11=json.loads(blob(BASE,'docs/qualification/candidates/vertical-source-20261012/integration/all-test-expectation-changes.json'))['changes']
check(not set(paths)&{r['path'] for r in root11},'disjoint root11')
for path in ['packages/contracts/test/backend-execution-expectations.mjs','packages/contracts/test/vertical-source-expectations.mjs']:
 check(current[path]==base[path],'root helper exact:'+path)
added=[p for p in current if p not in base and p.startswith(('apps/','packages/'))]
check(added==['packages/contracts/test/vertical-continuation-expectations.mjs'],'new test helper only')
forward=git('diff','--binary',BASE,CANDIDATE,'--',*paths);inverse=git('diff','--binary',CANDIDATE,BASE,'--',*paths)
(E/'independent-forward.patch').write_bytes(forward);(E/'independent-inverse.patch').write_bytes(inverse)
rows=[]
with tempfile.TemporaryDirectory(prefix='meri-test-review-') as tmp:
 root=Path(tmp)
 for path in paths:
  before,after=blob(BASE,path),blob(CANDIDATE,path);p=root/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(before)
  old_cases=len(re.findall(rb'\btest\s*\(',before));new_cases=len(re.findall(rb'\btest\s*\(',after))
  check(old_cases==new_cases,'case count:'+path)
  check(len(re.findall(rb'\bassert\.',after))>=len(re.findall(rb'\bassert\.',before)),'assertion count:'+path)
  check(not re.search(rb'\b(?:test|describe)\s*\.\s*(?:skip|todo|only)\b',after),'no skip/todo/only:'+path)
  rows.append({'path':path,'beforeSha256':sha(before),'afterSha256':sha(after),'beforeTests':old_cases,'afterTests':new_cases,'beforeAssertions':len(re.findall(rb'\bassert\.',before)),'afterAssertions':len(re.findall(rb'\bassert\.',after))})
 applied=subprocess.run(['git','apply','--check','-'],cwd=root,input=forward,capture_output=True);check(applied.returncode==0,'forward applicable')
 if applied.returncode==0:
  subprocess.run(['git','apply','-'],cwd=root,input=forward,check=True)
  for path in paths:check((root/path).read_bytes()==blob(CANDIDATE,path),'forward exact:'+path)
  reapplied=subprocess.run(['git','apply','--check','-'],cwd=root,input=inverse,capture_output=True);check(reapplied.returncode==0,'inverse applicable')
  if reapplied.returncode==0:
   subprocess.run(['git','apply','-'],cwd=root,input=inverse,check=True)
   for path in paths:check((root/path).read_bytes()==blob(BASE,path),'inverse exact:'+path)
result={'verdict':'PASS' if not failed else 'FAIL','base':BASE,'candidate':CANDIDATE,'checks':checks,'failed':failed,'originalEntries':len(base),'untouchedOriginalEntries':len(base)-len(paths),'modifiedExistingPaths':changes,'newAppsPackagesPaths':added,'forwardSha256':sha(forward),'inverseSha256':sha(inverse),'files':rows,'scope':'Counts supplement individual semantic diff review; neither counts nor reversibility alone proves correct assertions.'}
(E/'audit-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));raise SystemExit(bool(failed))
