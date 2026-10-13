"""Independent immutable source/receipt audit; no candidate import or service access."""
import hashlib,json,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[5]
ep=Path(__file__).resolve().parent
base='f3127d742b6b4ec556b00dba939d35e5622a9ad1'
candidate,application=sys.argv[1:]
def git(*a):return subprocess.check_output(['git',*a],cwd=root)
def tree(ref):
 out={}
 for row in git('ls-tree','-rz',ref).split(b'\0'):
  if row:
   meta,path=row.split(b'\t');out[path.decode()]=meta.decode()
 return out
checks=[]
def check(label,ok):checks.append({'check':label,'pass':bool(ok)})
old,new=tree(base),tree(candidate)
for p,meta in old.items():check('preserved:'+p,new.get(p)==meta)
local=['apps/control/action-application/local/demo.mjs','apps/control/action-application/local/flow.mjs','apps/control/action-application/local/local.test.mjs','scripts/local-followthrough/run.mjs']
app=['apps/control/action-application/'+p for p in ['index.mjs','http.mjs','session.mjs','README.md']]
identities=[]
for p in local+app:
 b=git('show',candidate+':'+p);identities.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':new[p].split()[2]})
 check('working-tree:'+p,(root/p).read_bytes()==b)
 if p in app:check('application-dependency:'+p,b==git('show',application+':'+p))
catalog=json.loads(git('show',candidate+':packages/contracts/retrieval-0.2/catalog.json'))
check('97-production-operations',len(catalog['operations'])==97)
check('all-handlers-null',all(x['handler'] is None for x in catalog['operations']))
check('all-unavailable',all(x['availability']=='unimplemented' for x in catalog['operations']))
receipts=[]
for p in sorted(ep.glob('*.json')):
 obj=json.loads(p.read_bytes())
 if 'ownedPidAndPgid' not in obj:continue
 receipts.append({'path':p.name,'exitCode':obj['exitCode'],'pid':obj['ownedPidAndPgid'],'absent':obj['ownedProcessGroupAbsent']})
 check('owned-group-absent:'+p.name,obj['ownedProcessGroupAbsent'])
 for s in obj['streams']:
  b=(root/s['path']).read_bytes();check('stream:'+s['path'],len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'])
summary={'base':base,'candidate':candidate,'applicationDependency':application,'originalEntries':len(old),'originalChanged':sum(new.get(p)!=m for p,m in old.items()),'sourceIdentities':identities,'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failed':[x for x in checks if not x['pass']],'receipts':receipts,'runtimeQualified':False,'databaseExecuted':False}
print(json.dumps(summary,indent=2));sys.exit(bool(summary['failed']))
