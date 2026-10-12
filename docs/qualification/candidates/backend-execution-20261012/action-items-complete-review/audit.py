import argparse,hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];HERE=Path(__file__).resolve().parent
BASE='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8'
FILES=['packages/contracts/retrieval-0.2/action-items-complete-validation.mjs','packages/contracts/retrieval-0.2/action-items-complete.schema.json','packages/contracts/test/retrieval-action-items-complete.test.mjs']
def git(*a,cwd=ROOT):return subprocess.check_output(['git',*a],cwd=cwd)
def tree(ref):
 result={}
 for row in git('ls-tree','-r','-z',ref).split(b'\0'):
  if row:
   metadata,path=row.split(b'\t',1);result[path.decode()]=metadata.decode()
 return result
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--packet');o=ap.parse_args();checks=[]
 def check(name,value):
  checks.append({'name':name,'passed':bool(value)})
  if not value:raise AssertionError(name)
 base,source,current=tree(BASE),tree(o.source),tree('HEAD')
 check('all originals exact author source',all(source.get(k)==v for k,v in base.items()))
 check('all originals exact reviewer tree',all(current.get(k)==v for k,v in base.items()))
 identities=[]
 for p in FILES:
  b=git('show',o.source+':'+p);check(p+' exact review bytes',(ROOT/p).read_bytes()==b);identities.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 allowed={*FILES,'docs/coordination/tasks/CODEX-ACTION-ITEMS-COMPLETE-20261012.md','docs/coordination/reports/CODEX-ACTION-ITEMS-COMPLETE-20261012.md'}
 check('author source adds only allocated paths',all(p in allowed or p.startswith('docs/qualification/candidates/backend-execution-20261012/action-items-complete/') for p in set(source)-set(base)))
 for entry in json.loads((HERE/'reference-identities.json').read_text())['sources']:
  for identity in entry['identities']:
   b=git('show',identity['commit']+':'+entry['path'],cwd=Path('/workspace/capirov2'));check(entry['path']+' '+identity['commit'][:7],len(b)==identity['bytes'] and hashlib.sha256(b).hexdigest()==identity['sha256'])
 # Check authored module imports and exact reuse; behavioral tests are separate.
 module=(ROOT/FILES[0]).read_text();check('sole snapshot import',module.count('import ')==1 and "from './operation-contracts.mjs'" in module)
 check('no source effect or clock token',not any(s in module for s in ['Date.now','fetch(','process.env','setTimeout(','createConnection']))
 check('existing scoped validator and full binding remain connected','assertActionItemClientScopedPage(page,request' in module and 'canonicalSha256(page.binding)!==canonicalSha256(context.binding)' in module)
 schema=json.loads((ROOT/FILES[1]).read_text());check('input reuses canonical raw shape',schema['$defs']['ActionItemsCompleteInput']=={'$ref':'urn:meri:retrieval:operational-reads:0.2.0#/$defs/ActionItemReadInput'})
 check('unscoped exact envelope',set(schema['$defs']['ActionItemsUnscopedPage']['properties'])=={'tool','generatedAt','total','actions'})
 if o.packet:
  packet=tree(o.packet);check('packet source unchanged',all(packet[p]==source[p] for p in FILES));check('packet original preservation',all(packet.get(k)==v for k,v in base.items()))
 (HERE/'source-preservation.json').write_text(json.dumps({'source':o.source,'sourceTree':git('rev-parse',o.source+'^{tree}').decode().strip(),'originalEntries':len(base),'sourceIdentities':identities,'passed':len(checks),'failed':0,'checks':checks},indent=2)+'\n');print(json.dumps({'passed':len(checks),'failed':0,'originalEntries':len(base)}))
if __name__=='__main__':main()
