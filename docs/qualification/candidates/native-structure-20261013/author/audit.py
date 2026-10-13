"""Immutable source/SQL/test mapping/receipt audit; no native inputs or services."""
import hashlib,json,os,subprocess,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[5];e=Path(__file__).resolve().parent
base='67ccac716bd6cbce4ee04e439a085bab75ae21a5';source='ac9d7cdb1fb870619148a81adb69ab6b7409636d'
def git(*args,cwd=root):return subprocess.check_output(['git',*args],cwd=cwd)
def blob(rev,p):return git('show',rev+':'+p)
def tree(rev):
 out={}
 for raw in git('ls-tree','-rz',rev).split(b'\0'):
  if raw:
   ident,p=raw.split(b'\t');out[p.decode()]=ident.decode()
 return out
checks=[]
def check(name,ok):
 checks.append({'name':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
a,b=tree(base),tree(source)
changed={p for p in a if a[p]!=b.get(p)}
expected={'packages/contracts/retrieval-0.2/operation-contracts.mjs','apps/control/qualified-application/schema-contract.mjs','apps/control/qualified-application/schema-preservation.mjs',*[f'apps/control/qualified-application/{n}' for n in ['schema-size.test.mjs','schema-size-independent.test.mjs','schema-size-inventory.test.mjs']]}
check('six allocated existing files only',changed==expected)
for p in ['apps/control/qualified-application/schema.mjs','packages/contracts/commands-0.2/execution-boundary.mjs','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/meri.schema.json']:
 check(p+' unchanged',a[p]==b[p])
p='packages/contracts/retrieval-0.2/operation-contracts.mjs'
old=blob(base,p).decode();new=blob(source,p).decode()
oldbody=old.split('function copyData(value) {',1)[1].split('// Private domain validators',1)[0]
newbody=new.split('function copyDataWithLimits(value, limits) {',1)[1].split('// Private domain validators',1)[0]
check('one canonical walker mechanically unchanged except parameter owner',oldbody.replace('JSON_LIMITS','limits')==newbody)
check('ordinary wrapper fixed',"function copyData(value) {\n  return copyDataWithLimits(value, JSON_LIMITS);\n}" in new)
check('ordinary limits fixed',"Object.freeze({nodes: 100000, depth: 64, bytes: 16 * 1024 * 1024})" in new)
check('private preservation fixed node profile',"Object.freeze({...JSON_LIMITS, nodes: 250000})" in new)
p='apps/control/qualified-application/schema-preservation.mjs'
for symbol in ['namespaceSQL','preservationSQL']:
 def sql(s):
  start=s.index('export const '+symbol+'=');end=s.index(';',start)+1
  return s[start:end]
 check(symbol+' exact original bytes',sql(blob(base,p).decode())==sql(blob(source,p).decode()))
check('full JSON digest unchanged',"sha256(JSON.stringify({namespaces,metadata}))" in blob(source,p).decode())
for p in a:
 if 'migration' in p and p.endswith('.sql'):check(p+' unchanged',a[p]==b[p])
mapping=json.loads((e/'test-expectation-map.json').read_text())
with tempfile.TemporaryDirectory(prefix='meri-structure-inverse-') as temp:
 t=Path(temp)
 for row in mapping:
  p=row['path'];before=blob(base,p);after=blob(source,p)
  check(p+' saved preimage',before==(root/row['preimage']).read_bytes())
  check(p+' hashes',hashlib.sha256(before).hexdigest()==row['beforeSha256'] and hashlib.sha256(after).hexdigest()==row['afterSha256'])
  target=t/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(after)
 subprocess.run(['git','apply','--reverse',str(e/'test-expectation-map.patch')],cwd=t,check=True,capture_output=True)
 for row in mapping:check(row['path']+' inverse exact', (t/row['path']).read_bytes()==blob(base,row['path']))
for label,code in [('structure-before',1),('structure-repaired',1),('structure-final',0)]:
 rec=json.loads((e/(label+'.json')).read_text())
 check(label+' recorded outcome',rec['exitCode']==code and rec['sourceDiffBytes']==0)
 check(label+' bounded clean group',not rec['timedOut'] and not rec['ownedGroupKillRequired'] and rec['ownedProcessGroupAbsent'])
 try:os.killpg(rec['ownedPidAndPgid'],0)
 except ProcessLookupError:absent=True
 else:absent=False
 check(label+' physically absent',absent)
 for stream in rec['streams']:
  raw=(root/stream['path']).read_bytes();check(stream['path']+' exact',len(raw)==stream['bytes'] and hashlib.sha256(raw).hexdigest()==stream['sha256'])
 if label=='structure-final':check('final exact frozen source',rec['sourceHead']==source)
sourceFiles=[]
for p in sorted(expected|{'apps/control/qualified-application/schema-structure.test.mjs'}):
 raw=blob(source,p);check(p+' worktree frozen',(root/p).read_bytes()==raw)
 sourceFiles.append({'path':p,'gitBlob':git('rev-parse',source+':'+p).decode().strip(),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
result={'base':base,'source':source,'unchangedOriginalEntries':len(a)-len(changed),'allocatedChangedPaths':sorted(changed),'checks':checks,'sourceFiles':sourceFiles}
(e/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':len(checks),'total':len(checks),'unchangedOriginalEntries':len(a)-len(changed)}))
