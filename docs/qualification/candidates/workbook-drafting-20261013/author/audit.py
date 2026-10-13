"""Read-only source/receipt preservation; no generator, provider or database action."""
import hashlib,json,os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
base='bc8b65cc7186e449cf20b4956e4cd88684b35325'
source='10295f0448a8c4f0a3464b7802b845efb1c00a33'
def git(*args): return subprocess.check_output(['git',*args],cwd=root)
def tree(rev):
 out={}
 for entry in git('ls-tree','-rz',rev).split(b'\0'):
  if not entry: continue
  meta,path=entry.split(b'\t',1);out[path.decode()]=meta.decode()
 return out
checks=[]
def check(name,passed):
 checks.append({'name':name,'passed':bool(passed)})
 if not passed: raise AssertionError(name)
old,new=tree(base),tree(source)
allowed={f'apps/control/document-application/{name}' for name in ['OUTLINE.md','README.md','current.mjs','index.mjs','local/fixture.mjs']}
unchanged=[p for p,ident in old.items() if new.get(p)==ident]
check('all baseline entries preserved except five allocated paths',set(old)-set(unchanged)==allowed)
for path in ['apps/control/document-application/test/application.test.mjs','apps/control/document-application/independent/application-independent.test.mjs','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/meri.schema.json','apps/artifacts/service.mjs','apps/artifacts/postgres-service.mjs','apps/artifacts/python/office.py']:
 check(path+' unchanged',old[path]==new[path])
fixture='apps/control/document-application/local/fixture.mjs'
check('fixture equals exact root dependency',git('show',source+':'+fixture)==git('show','00032028b57141631c3bbd6a6cc34d5d2bcad9e8:'+fixture))
paths=['apps/control/document-application/'+name for name in ['index.mjs','current.mjs','format-admission.mjs','README.md','OUTLINE.md','test/workbook-application.test.mjs','local/fixture.mjs']]
source_files=[]
for path in paths:
 content=git('show',source+':'+path)
 check(path+' worktree matches source',(root/path).read_bytes()==content)
 source_files.append({'path':path,'gitBlob':git('rev-parse',source+':'+path).decode().strip(),'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()})
for label,expected in [('workbook-initial',1),('workbook-fixture-corrected',0),('workbook-frozen',0)]:
 receipt=json.loads((evidence/(label+'.json')).read_text())
 check(label+' exit preserved',receipt['exitCode']==expected)
 check(label+' bounded clean capture',not receipt['timedOut'] and not receipt['ownedGroupKillRequired'] and receipt['ownedProcessGroupAbsent'])
 try: os.killpg(receipt['ownedPidAndPgid'],0)
 except ProcessLookupError: absent=True
 else: absent=False
 check(label+' group physically absent',absent)
 for stream in receipt['streams']:
  b=(root/stream['path']).read_bytes()
  check(stream['path']+' exact',len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256'])
 if label=='workbook-frozen':
  check('final exact immutable source',receipt['sourceHead']==source and receipt['sourceDiffBytes']==0)
check('initial test preimage retained',(evidence/'workbook-initial-test.mjs.txt').exists())
result={'base':base,'source':source,'baselineEntries':len(old),'unchangedBaselineEntries':len(unchanged),'allocatedChangedPaths':sorted(allowed),'checks':checks,'sourceFiles':source_files,'scope':'LOCAL_SOURCE_AND_RECEIPT_AUDIT_NO_NATIVE_QUALIFICATION'}
(evidence/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':len(checks),'total':len(checks),'unchangedBaselineEntries':len(unchanged)}))
