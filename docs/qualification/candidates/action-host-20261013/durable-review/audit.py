"""Independent source/preservation audit, without importing candidate implementation."""
from pathlib import Path
import hashlib,json,re,subprocess,sys
root=Path(__file__).resolve().parents[5];ep=Path(__file__).resolve().parent
base='f8e3507307640ee6b4904782cfb20f2b05e5e7b0';candidate=sys.argv[1]
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):
 result={}
 for row in git('ls-tree','-rz',ref).split(b'\0'):
  if row:
   meta,p=row.split(b'\t');result[p.decode()]=meta.decode()
 return result
checks=[]
def check(name,value):checks.append({'name':name,'pass':bool(value)})
old,new=tree(base),tree(candidate)
for p,v in old.items():check('preserved:'+p,new.get(p)==v)
added=[p for p in new if p not in old];prefix='apps/control/action-host/durable/'
for p in added:check('allocated:'+p,p.startswith(prefix) or p.startswith('docs/qualification/candidates/action-host-20261013/durable-author/') or p in ['docs/coordination/tasks/CODEX-ACTION-HOST-DURABLE-20261013.md','docs/coordination/reports/CODEX-ACTION-HOST-DURABLE-20261013.md'])
identities=[]
for p in added:
 if not p.startswith(prefix):continue
 b=git('show',candidate+':'+p);identities.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()});check('working:'+p,(root/p).read_bytes()==b)
 if p.endswith('.mjs') and not p.endswith('.test.mjs') and '/test/' not in p and 'fixture' not in p:
  text=b.decode();check('no-fixture-import:'+p,not re.search(r'(?:from\s*|import\s*\()[\'\"][^\'\"]*(?:/test/|/test-|fixture|/docs/)',text));check('no-pool-shutdown:'+p,not re.search(r'\b(?:pool|journalPool|budgetPool)\s*\.\s*(?:end|close)\s*\(',text))
catalog=json.loads(git('show',candidate+':packages/contracts/retrieval-0.2/catalog.json'));check('97-unavailable',len(catalog['operations'])==97 and all(v['availability']=='unimplemented' and v['handler'] is None for v in catalog['operations']))
for label in sys.argv[2:]:
 r=json.loads((ep/(label+'.json')).read_bytes());check('process-absent:'+label,r['ownedProcessGroupAbsent'] and not r['timedOut']);check('source-diff-zero:'+label,r['sourceDiffBytes']==0)
 for s in r['streams']:
  b=(root/s['path']).read_bytes();check('stream:'+s['path'],len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'])
report={'base':base,'candidate':candidate,'originalEntries':len(old),'originalChanged':sum(new.get(p)!=v for p,v in old.items()),'sourceIdentities':identities,'checks':len(checks),'passed':sum(c['pass'] for c in checks),'failed':[c for c in checks if not c['pass']],'runtimeQualified':False,'nativeDatabaseExecuted':False}
print(json.dumps(report,indent=2));sys.exit(bool(report['failed']))
