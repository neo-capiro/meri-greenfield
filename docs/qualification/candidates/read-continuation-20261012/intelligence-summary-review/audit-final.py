"""Read-only metadata audit. No private module import or execution."""
import hashlib,json,pathlib,subprocess,sys
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[4]
BASE='c1c9bfde7dd466a0474589a224a99b44277adbc9'
SOURCE=sys.argv[1]
checks=[]
def check(name,ok):
 checks.append({'name':name,'passed':bool(ok)})
def git(*args):return subprocess.check_output(['git','-C',str(ROOT),*args])
def tree(ref):
 return {r.split('\t',1)[1]:r.split('\t',1)[0].split()[2] for r in git('ls-tree','-r',ref).decode().splitlines()}
base=tree(BASE);current=tree('HEAD')
changed=[p for p,h in base.items() if current.get(p)!=h]
check('All original tracked blobs preserved',not changed)
files=['packages/contracts/retrieval-0.2/intelligence-summary.schema.json','packages/contracts/retrieval-0.2/intelligence-summary-validation.mjs','packages/contracts/test/retrieval-intelligence-summary.test.mjs']
sourceFiles=[]
for p in files:
 try:
  expected=git('show',SOURCE+':'+p);actual=(ROOT/p).read_bytes()
  check('Exact author source '+p,expected==actual)
  sourceFiles.append({'path':p,'bytes':len(actual),'sha256':hashlib.sha256(actual).hexdigest()})
 except Exception as e:check('Exact author source '+p,False)
refs=json.loads((HERE/'reference-identities.json').read_text())['references']
for row in refs:
 for v in row['versions']:
  data=subprocess.check_output(['git','-C','/workspace/capirov2','show',v['commit']+':'+row['path']])
  blob=subprocess.check_output(['git','-C','/workspace/capirov2','rev-parse',v['commit']+':'+row['path']],text=True).strip()
  check('Pinned metadata '+v['commit'][:7]+':'+row['path'],blob==v['blob'] and len(data)==v['bytes'] and hashlib.sha256(data).hexdigest()==v['sha256'])
 check('No observed drift '+row['path'],row['versions'][0]['blob']==row['versions'][1]['blob'])
schema=json.loads((ROOT/files[0]).read_text())
check('Canonical private schema URN',schema['$id']=='urn:meri:retrieval:intelligence-summary:0.2.0')
check('Exact public0.1 files unchanged',all(current.get(p)==h for p,h in base.items() if p.startswith('packages/contracts/') and ('0.1' in p or '/generated/' in p)))
check('Exact canonical catalog/loader/registry unchanged',all(current.get(p)==h for p,h in base.items() if p.startswith('packages/contracts/') and ('catalog' in p or 'registry' in p or 'load' in p or p.endswith('operation-contracts.mjs'))))
check('Dependency manifests/locks unchanged',all(current.get(p)==h for p,h in base.items() if p.endswith(('package.json','package-lock.json','pnpm-lock.yaml'))))
check('No source app changes',all(current.get(p)==h for p,h in base.items() if p.startswith('apps/')))
result={'base':BASE,'source':SOURCE,'head':git('rev-parse','HEAD').decode().strip(),'originalCount':len(base),'originalChanged':changed,'sourceFiles':sourceFiles,'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'privateSourceExecuted':False,'runtimeAccepted':False}
print(json.dumps(result,indent=2));sys.exit(bool(result['failed']))
