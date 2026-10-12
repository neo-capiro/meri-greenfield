"""Offline immutable source/SDK and owned capture audit; no service operations."""
import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[5]; packet=pathlib.Path(__file__).resolve().parent
base='e5fb3963de787bbd7b7663316c368f15814897da'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):
 result={}
 for row in git('ls-tree','-rz',ref).split(b'\0'):
  if row:
   meta,path=row.split(b'\t');result[path.decode()]=meta.decode()
 return result
checks=[]
def check(name,ok):checks.append({'name':name,'passed':bool(ok)})
a=tree(base);b=tree('HEAD');check('all original Git entries unchanged',all(b.get(p)==v for p,v in a.items()))
check('initial adapter test prefix unchanged',(root/'apps/control/test/schedule-lifecycle.test.mjs').read_bytes().startswith(git('show','6f8be6b1:apps/control/test/schedule-lifecycle.test.mjs')))
check('original owner tests unchanged',(root/'apps/control/test/schedule-lifecycle-postgres.test.mjs').read_bytes()==git('show','7bdb0e14:apps/control/test/schedule-lifecycle-postgres.test.mjs'))
refs=json.loads((packet/'sdk-reference-identities.json').read_text())
for ref in refs['references']:
 data=(pathlib.Path(refs['donor'])/ref['relativePath']).read_bytes();check('SDK '+ref['relativePath'],len(data)==ref['bytes'] and hashlib.sha256(data).hexdigest()==ref['sha256'])
receipts=[]
for p in sorted(packet.glob('*.json')):
 row=json.loads(p.read_text())
 if 'ownedPidAndPgid' not in row:continue
 receipts.append(p.name);check(p.name+' clean source',row['sourceDiffBytes']==0);check(p.name+' physically exited',row['ownedProcessGroupAbsent'] and not row['timedOut'] and not row['ownedGroupKillRequired'])
 for s in row['streams']:
  data=(root/s['path']).read_bytes();check(s['path'],len(data)==s['bytes'] and hashlib.sha256(data).hexdigest()==s['sha256'])
check('failed negative controls retained',all(json.loads((packet/(name+'.json')).read_text())['exitCode']==1 for name in ['owner-page-negative','cursor-page-negative','update-proxy-negative','missing-temporal-negative','status-negative','list-errors-negative']))
source=[]
for p in sorted(b):
 if p in a or not (p.startswith('apps/control/') or p.startswith('packages/contracts/')):continue
 data=git('show','HEAD:'+p);source.append({'path':p,'gitEntry':b[p],'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
result={'base':base,'head':git('rev-parse','HEAD').decode().strip(),'originalEntries':len(a),'source':source,'receipts':receipts,'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'scope':'Offline source only; real PostgreSQL and Temporal UNRUN'}
(packet/'audit-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['head','originalEntries','passed','failed']}))
raise SystemExit(bool(result['failed']))
