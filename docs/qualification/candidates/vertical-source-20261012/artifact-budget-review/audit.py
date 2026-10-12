"""Read-only Git/metadata audit; no target import, database, or external operations."""
import hashlib,json,os,re,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
E=Path(__file__).resolve().parent
BASE='23f2ba78879972538fd1b7b7a56b2f8e2626a6c3'
source,packet,label=sys.argv[1:]
rows=[]
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def raw(ref,path):return git('show',ref+':'+path)
def check(name,condition,detail=None):
 rows.append({'name':name,'pass':bool(condition),**({'detail':detail} if detail is not None else {})})
def tree(ref):
 result={}
 for entry in git('ls-tree','-r','-z',ref).split(b'\0'):
  if entry:
   meta,path=entry.split(b'\t',1);result[path.decode()]=meta.decode()
 return result
base=tree(BASE);st=tree(source);pt=tree(packet)
for ref,items in [(source,st),(packet,pt)]:
 differences=[p for p,v in base.items() if items.get(p)!=v]
 check('all original mode/blob entries preserved '+ref,not differences,{'originals':len(base),'differences':differences})
product=['apps/artifacts/postgres-service.mjs','apps/artifacts/test/artifact-postgres-service.test.mjs']
check('new production scope exact',sorted(p for p in st if p not in base and (p.startswith('apps/') or p.startswith('packages/')))==sorted(product))
for p in product:
 check('exact reviewed product '+p,(ROOT/p).read_bytes()==raw(source,p)==raw(packet,p))
text=raw(source,product[0]).decode()
check('accepted public budget owner imported',"from '../gateway/index.mjs'" in text and 'createPostgresBudgetExecution' in text)
check('accepted artifact service imported',"from './service.mjs'" in text and 'createArtifactService' in text)
check('no direct SQL/driver/subprocess imports',not re.search(r'\b(?:SELECT|INSERT|UPDATE|DELETE)\b|(?:from|import).*?(?:[\x27\x22]pg[\x27\x22]|child_process)',text))
check('source disabled by default','sourceEnabled=false' in text)
check('general analysis separate refusal','ANALYSIS_SANDBOX_DISPATCH_REQUIRED' in text)
for p in ['apps/artifacts/service.mjs','apps/gateway/index.mjs','apps/gateway/budget/postgres-tool-budget.mjs','apps/gateway/budget/tool-budget-execution.mjs','packages/runtime/operation-lifetime.mjs','packages/contracts/meri.schema.json','packages/contracts/validate.mjs','packages/contracts/retrieval-0.2/catalog.json']:
 check('canonical unchanged '+p,base[p]==st[p]==pt[p])
manifest_path='docs/qualification/candidates/vertical-source-20261012/artifact-budget-author/manifest.json'
manifest_bytes=raw(packet,manifest_path);manifest=json.loads(manifest_bytes)
check('author manifest binds exact source',manifest['source']==source)
check('manifest names unique',len({r['path'] for r in manifest['members']})==len(manifest['members']))
for record in manifest['members']:
 data=raw(packet,record['path']);check('author member '+record['path'],len(data)==record['bytes'] and hashlib.sha256(data).hexdigest()==record['sha256'])
# Every capture in the author manifest must have original raw streams and exited owned group.
for record in manifest['members']:
 if record['path'].endswith('.json'):
  value=json.loads(raw(packet,record['path']))
  if isinstance(value,dict) and 'command' in value and ('ownedProcessGroupAbsent' in value or 'processGroupAbsent' in value):
   check('author owned group absent '+record['path'],value.get('ownedProcessGroupAbsent',value.get('processGroupAbsent')) is True)
   check('author no test timeout '+record['path'],not value.get('timedOut',False))
   for stream in value.get('streams',[]):
    p=stream['path'];data=raw(packet,p)
    check('author capture bytes '+p,len(data)==stream['bytes'] and hashlib.sha256(data).hexdigest()==stream['sha256'])
for p in E.glob('*.json'):
 try:v=json.loads(p.read_bytes())
 except Exception:continue
 if isinstance(v,dict) and 'captureSha256' in v:
  check('review capture clean source '+p.name,v['sourceDiffBytes']==0)
  check('review owned group absent '+p.name,v['ownedProcessGroupAbsent'] and not v['timedOut'])
  try:os.killpg(v['ownedPidAndPgid'],0);absent=False
  except ProcessLookupError:absent=True
  check('review physical group readback '+p.name,absent)
  for stream in v['streams']:
   b=(ROOT/stream['path']).read_bytes();check('review stream '+stream['path'],len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256'])
result={'source':source,'sourceTree':git('rev-parse',source+'^{tree}').decode().strip(),'authorPacket':packet,'authorManifestSha256':hashlib.sha256(manifest_bytes).hexdigest(),'authorManifestMembers':len(manifest['members']),'originalTrackedEntries':len(base),'checks':len(rows),'passed':sum(r['pass'] for r in rows),'failed':sum(not r['pass'] for r in rows),'rows':rows,'scope':'source and metadata only; no runtime or engine acceptance'}
(E/(label+'.json')).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='rows'}));sys.exit(bool(result['failed']))
