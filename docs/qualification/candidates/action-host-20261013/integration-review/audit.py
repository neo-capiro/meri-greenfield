"""Read-only exact source and capture binding; no product execution."""
import hashlib,json,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[5]
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):
 result={}
 for row in git('ls-tree','-r','-z',ref).split(b'\0'):
  if row:
   meta,path=row.split(b'\t',1);result[path.decode()]=meta.decode()
 return result
source=sys.argv[1];base='28a7d9de32c75b4352efdd90843dddabe57f2224';checks=[]
def check(name,value):
 checks.append({'name':name,'passed':bool(value)})
 if not value:raise AssertionError(name)
a,b,c=tree(base),tree(source),tree('HEAD')
check('all original entries preserve exact mode/blob',all(b.get(p)==m for p,m in a.items()))
paths=['apps/control/action-host/local/recovery.mjs','apps/control/action-host/local/fixture.mjs','scripts/local-followthrough/host-run.mjs']
for p in paths:check('reviewed working source '+p,c[p]==b[p] and (root/p).read_bytes()==git('show',source+':'+p))
for ref,paths2 in [('7c67345398aa5422f6c760f009b729d082cfeaea',['apps/control/action-host/'+p for p in ['index.mjs','current.mjs','resolver.mjs']]),('c581c63764f67a9a7a5ee9090cba9e103aa486d7',['apps/control/action-host/durable/index.mjs'])]:
 for p in paths2:check('independently accepted dependency '+p,git('show',source+':'+p)==git('show',ref+':'+p))
for label in ['deadline-before','deadline-real-before','deadline-repaired','coherent-first','coherent-final']:
 receipt=json.loads((Path(__file__).parent/(label+'.json')).read_text())
 check(label+' owned process absent',receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'])
 check(label+' exact source diff0',receipt['sourceDiffBytes']==0)
 for row in receipt['streams']:
  blob=(root/row['path']).read_bytes();check(label+' '+row['path'].split('.')[-2]+' raw hash',len(blob)==row['bytes'] and hashlib.sha256(blob).hexdigest()==row['sha256'])
 check(label+' capture producer',receipt['captureSha256']==hashlib.sha256(Path(__file__).with_name('capture-reaped.py').read_bytes()).hexdigest())
final=json.loads(Path(__file__).with_name('coherent-final.json').read_text());check('final capture passes',final['exitCode']==0)
for p in ['packages/contracts/schema.json','packages/contracts/validate.mjs','packages/contracts/retrieval-0.2/operation-catalog.json']:
 if p in a:check('canonical/public preserved '+p,b[p]==a[p])
result={'source':source,'tree':git('rev-parse',source+'^{tree}').decode().strip(),'base':base,'originalEntries':len(a),'checks':checks,'passed':len(checks),'failed':0,'scope':'Source/local synthetic only; no native database, shared aggregate, production identity or activation qualification.'}
print(json.dumps(result,indent=2))
