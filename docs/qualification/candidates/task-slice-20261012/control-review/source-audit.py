import subprocess,json,hashlib,pathlib
BASE='77cedb126d57a0223d2df42ad2f3fe988eb51759';SOURCE='6f14d780a40e878fa62bc928c4d520286313f56c';ROOT=pathlib.Path(__file__).resolve().parents[5];HERE=pathlib.Path(__file__).resolve().parent
checks=[]
def check(label,value):checks.append({'check':label,'pass':bool(value)})
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def tree(ref):
 out={}
 for row in git('ls-tree','-rz','--full-tree',ref).split(b'\0'):
  if row:
   meta,path=row.split(b'\t',1);out[path.decode()]=meta.decode().split()[2]
 return out
old,new=tree(BASE),tree(SOURCE);changes=[p for p,v in old.items() if new.get(p)!=v];check('all base tracked blobs unchanged',not changes)
source=[]
for p in sorted(new):
 if p.startswith('apps/control/task-lookup/'):
  expected=git('show',SOURCE+':'+p);actual=(ROOT/p).read_bytes();check('exact frozen '+p,actual==expected);source.append({'path':p,'bytes':len(actual),'sha256':hashlib.sha256(actual).hexdigest()})
for ref,p in [('4ea00e93','apps/control/task-lookup/delivery.test.mjs'),('f61086cc','apps/control/task-lookup/postgres-results.test.mjs')]:check('original test prefix '+p,(ROOT/p).read_bytes().startswith(git('show',ref+':'+p)))
b=(ROOT/'apps/control/task-lookup/binding.mjs').read_text();d=(ROOT/'apps/control/task-lookup/delivery.mjs').read_text();sql=(ROOT/'apps/control/task-lookup/migrations/0001_task_lookup.sql').read_text();pg=(ROOT/'apps/control/task-lookup/postgres-results.mjs').read_text()
for name,value in [('public UIEvent reused',"validateShape('UIEvent',value)" in b),('shared lifetime reused',"packages/runtime/operation-lifetime.mjs" in d),('fixed actions query',"id:'actions.query',version:'0.2.0'" in b),('original subject scope exact',"same(out.subject.scopes,c.scopes)" in b),('immutable result reference read case only',"resultReference.toLowerCase()!==resultReference.toLowerCase()" in d),('tenant keyed lookup',"PRIMARY KEY(tenant_id,lookup_id)" in sql),('tenant keyed result uniqueness',"UNIQUE(tenant_id,result_reference)" in sql),('run event sequence uniqueness',"PRIMARY KEY(tenant_id,run_id,sequence)" in sql),('event ownership FK',"FOREIGN KEY(tenant_id,lookup_id)" in sql),('result state record equivalence',"CHECK ((state='RESULT')=(record IS NOT NULL))" in sql),('row lock transitions',"FOR UPDATE" in pg),('only undispatched or dispatched may ERROR',"['CLAIMED','DISPATCHING'].includes(row.state)" in pg),('uncertain transaction evicts client',"release')(reusable?undefined:failure)" in pg),('no pool close',".end(" not in pg),('no store install/import driver',"from 'pg'" not in pg)]:check(name,value)
receipts=[]
for path in sorted(HERE.glob('*.json')):
 try:r=json.loads(path.read_text())
 except:continue
 if 'ownedPidAndPgid' not in r:continue
 check(path.name+' group cleanup',r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired']);
 for s in r.get('streams',[]):
  content=(ROOT/s['path']).read_bytes();check(path.name+' raw '+s['path'],len(content)==s['bytes'] and hashlib.sha256(content).hexdigest()==s['sha256'])
 receipts.append({'path':str(path.relative_to(ROOT)),'head':r['sourceHead'],'exitCode':r['exitCode'],'sourceDiffBytes':r['sourceDiffBytes'],'pgid':r['ownedPidAndPgid']})
result={'base':BASE,'source':SOURCE,'originals':len(old),'changedOriginals':changes,'sourceFiles':source,'receipts':receipts,'checks':checks,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'scope':'source/data only; no PostgreSQL or service operation'}
(HERE/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['base','source','originals','changedOriginals','passed','failed']}));raise SystemExit(bool(result['failed']))
