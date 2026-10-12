"""Allocated-test preservation and exact inverse audit; local source only."""
import hashlib,json,re,subprocess,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[5];evidence=Path(__file__).resolve().parent
base='1375349a62f4abc036ee091d0d2ebe3a6ec62910';source='2955ec6cfd1b38908cc62d9a1f5a8800bf7f5bdc'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):
 rows={}
 for entry in git('ls-tree','-rz',ref).split(b'\0'):
  if entry:
   value,path=entry.split(b'\t',1);rows[path.decode()]=value.decode()
 return rows
allow=json.loads((evidence/'allowlist.json').read_text())['existingTestPaths']
a,b=tree(base),tree(source)
changed={p for p in a if a[p]!=b.get(p)};assert changed==set(allow)
assert all(a[p]==b[p] for p in a if p not in allow)
root_changes=json.loads(git('show',base+':docs/qualification/candidates/vertical-source-20261012/integration/all-test-expectation-changes.json'))['changes']
protected={r['path']for r in root_changes}|{'packages/contracts/test/vertical-source-expectations.mjs','packages/contracts/test/backend-execution-expectations.mjs'}
assert not protected.intersection(changed)
helper='packages/contracts/test/vertical-continuation-expectations.mjs'
assert {p for p in set(b)-set(a) if p.startswith(('apps/','packages/'))}=={helper}
for name,x,y in [('forward.patch',base,source),('inverse.patch',source,base)]:
 assert (evidence/name).read_bytes()==git('diff','--binary',x,y,'--',*allow)
changes=[]
# Test declarations (including loop templates) remain byte-identical; counts
# distinguish static call sites from generated runtime cases.
case_pattern=r"\btest\s*\(\s*(['\"`])([^\n]*?)\1"
assert_pattern=r'\bassert(?:\.[A-Za-z]+)?\s*\('
with tempfile.TemporaryDirectory(prefix='meri-test-inverse-') as directory:
 temp=Path(directory)
 for p in allow:
  before=git('show',base+':'+p);after=git('show',source+':'+p)
  assert (root/p).read_bytes()==after
  old,new=before.decode(),after.decode()
  assert re.findall(case_pattern,old)==re.findall(case_pattern,new),p
  assert re.findall(r'\btest\.(?:skip|todo|only)\b',old)==re.findall(r'\btest\.(?:skip|todo|only)\b',new),p
  old_asserts=len(re.findall(assert_pattern,old));new_asserts=len(re.findall(assert_pattern,new));assert new_asserts>=old_asserts,p
  q=temp/p;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(before)
  changes.append({'path':p,'beforeSha256':hashlib.sha256(before).hexdigest(),'afterSha256':hashlib.sha256(after).hexdigest(),'beforeTests':len(re.findall(case_pattern,old)),'afterTests':len(re.findall(case_pattern,new)),'beforeAssertions':old_asserts,'afterAssertions':new_asserts})
 subprocess.run(['git','apply',str(evidence/'forward.patch')],cwd=temp,check=True)
 assert all((temp/p).read_bytes()==git('show',source+':'+p)for p in allow)
 subprocess.run(['git','apply',str(evidence/'inverse.patch')],cwd=temp,check=True)
 assert all((temp/p).read_bytes()==git('show',base+':'+p)for p in allow)
print(json.dumps({'status':'PASS','base':base,'source':source,'originalGitEntries':len(a),'unchangedOriginalGitEntries':len(a)-len(changed),'exactChangedTestFiles':len(changed),'rootProtectedPathsUnchanged':sorted(protected),'originalFixturesAndProductionUnchanged':True,'newTestHelper':helper,'forwardThenInverseExact':True,'staticTestDeclarations':sum(r['beforeTests']for r in changes),'staticAssertionCallsBefore':sum(r['beforeAssertions']for r in changes),'staticAssertionCallsAfter':sum(r['afterAssertions']for r in changes),'changes':changes,'scope':'LOCAL_SOURCE_ONLY_NO_RUNTIME_ADMISSION'},indent=2))
